import { useReducer, useCallback, useEffect } from 'react';
import type { AchievementId, AttributeKey, Attributes, Choice, CustomGoal, DeathCause, FamilyMember, GamePhase, GameState, GoalKey, LifeEvent, PaceMode, TypeSpeed, UndoEntry } from '../types/index.ts';
import { emptySaves, isValidSaveData, migrateLegacySave, SLOT_COUNT, type SavesV2 } from '../engine/save.ts';
import { applyAchievementBonus, checkAchievements } from '../engine/achievements.ts';
import { verdictKey } from '../engine/verdict.ts';
import { appendFamilyMember, loadFamily, parentFlag, saveFamily } from '../engine/family.ts';
import { applyLegacy, deriveLegacy } from '../engine/legacy.ts';
import { applyAllocation, applyTalents } from '../engine/talents.ts';
import { checkWeeklyGoal, pickWeeklyGoal, weekOf, weekSeed, type WeeklyGoal } from '../engine/weekly.ts';
import {
  createInitialState,
  applyOutcomes,
  applyElderDecay,
  getStageForAge,
  checkDeath,
  calcMaxAge,
  calcScore,
  effectiveDelta,
  ageCap,
  ensureInt,
  appendSnapshot,
  applyChallenge,
  applyInheritance,
  scaleOutcomes,
  fatalCause,
  STAGE_ORDER,
} from '../engine/state.ts';
import { EVENTS, filterEvents, shuffleEvents, pickFateEvents } from '../engine/events.ts';
import { derivePersona, meetsPersonality } from '../engine/personality.ts';
import { personaBonds, type PersonaId } from '../engine/personas.ts';
import { buildCompanionEvent, COMPANION_DISABLED, COMPANION_END_AGE, COMPANION_INTERVAL, COMPANION_START_AGE, companionEnabled } from '../engine/companion.ts';
import { ACTIVITIES, pickActivityResult, rollCrime } from '../engine/activities.ts';
import { track } from '../utils/analytics.ts';
import { getRoute } from '../engine/routes.ts';

/** 中途放弃埋点：结算后回标题（phase 已为 summary）不误记，其余情况记放弃 */
export function trackAbandonIfPlaying(phase: GamePhase, age: number): void {
  if (phase !== 'summary') {
    track({ type: 'game_abandon', ts: Date.now(), age });
  }
}

// ============ 成就存储 ============

/** 成就存储 key（跨周目） */
const ACHIEVEMENTS_KEY = 'life-sim-achievements';

/** 成就存储结构 */
interface AchievementStore {
  unlocked: AchievementId[];
  completedLives: number;
  /** 累计达成过的结局 key（verdictKey，去重） */
  endings: string[];
}

/** 读取成就存储；数据损坏或存储不可用时返回空结构 */
function loadAchievements(): AchievementStore {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as AchievementStore;
      if (data && Array.isArray(data.unlocked) && typeof data.completedLives === 'number') {
        // 旧存档无结局集合字段，显式兜底
        return { ...data, endings: Array.isArray(data.endings) ? data.endings : [] };
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { unlocked: [], completedLives: 0, endings: [] };
}

/** 持久化成就存储；存储不可用时静默降级 */
function saveAchievements(store: AchievementStore): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

// ============ 生涯统计存储 ============

/** 生涯统计 key（跨周目） */
const STATS_KEY = 'life-sim-stats';

/** 生涯统计结构 */
export interface StatsStore {
  totalLives: number;
  bestScore: number;
  totalAge: number;
  endings: Record<string, number>;
  /** 上一世终局属性（第 5 周目起开局传承；旧存档缺失 = 无加成） */
  lastEndAttrs?: Partial<Attributes>;
  /** 死法分布：死因 key → 累计次数（旧存档缺失 = 无字段，「花样作死」成就判定用） */
  deaths?: Record<string, number>;
}

/**
 * 累计一局死因到死法分布（纯函数）。
 *
 * @param prev 现有死法分布（旧存档可能缺失）
 * @param cause 本局死因（存活中局兜底为 lifespan）
 * @returns 累计后的新分布
 */
export function accumulateDeaths(prev: Record<string, number> | undefined, cause: DeathCause): Record<string, number> {
  const key = cause ?? 'lifespan';
  return { ...(prev ?? {}), [key]: (prev?.[key] ?? 0) + 1 };
}

/** 读取生涯统计；数据损坏或存储不可用时返回空结构 */
function loadStats(): StatsStore {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as StatsStore;
      if (data && typeof data.totalLives === 'number') {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { totalLives: 0, bestScore: 0, totalAge: 0, endings: {} };
}

/** 持久化生涯统计；存储不可用时静默降级 */
function saveStats(stats: StatsStore): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // 存储不可用静默降级
  }
}

// ============ 每日挑战存储 ============

/** 每日挑战存储 key */
const DAILY_KEY = 'life-sim-daily';

/** 每日挑战存储结构（date 为 YYYYMMDD，仅记录当日最佳） */
export interface DailyStore {
  date: string;
  bestScore: number;
  bestAge: number;
}

/** 日期 → YYYYMMDD 字符串（每日挑战种子与最佳记录共用） */
export function formatDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${month}${day}`;
}

/**
 * 日期字符串 → 确定性种子（逐字符 `(acc * 31 + code) >>> 0`）。
 * 同一天种子相同（每日挑战固定事件序列），不同日期种子不同。
 */
export function dateToSeed(dateStr: string): number {
  let acc = 0;
  for (let i = 0; i < dateStr.length; i++) {
    acc = (acc * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return acc;
}

/** 读取每日挑战存储；数据损坏或存储不可用时返回空结构 */
function loadDaily(): DailyStore {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DailyStore;
      if (data && typeof data.date === 'string') {
        return {
          date: data.date,
          bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
          bestAge: typeof data.bestAge === 'number' ? data.bestAge : 0,
        };
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { date: '', bestScore: 0, bestAge: 0 };
}

/** 持久化每日挑战存储；存储不可用时静默降级 */
function saveDaily(store: DailyStore): void {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

/**
 * 结算时更新今日最佳（纯函数）。
 * 仅当已有记录日期为今日时取 max 更新；跨天或今日首局以本局成绩初始化今日记录。
 *
 * @param prev 现有每日记录
 * @param today 今日日期（YYYYMMDD）
 * @param score 本局综合评分
 * @param age 本局享年
 * @returns 更新后的每日记录
 */
export function updateDailyBest(prev: DailyStore, today: string, score: number, age: number): DailyStore {
  if (prev.date === today) {
    return { date: today, bestScore: Math.max(prev.bestScore, score), bestAge: Math.max(prev.bestAge, age) };
  }
  return { date: today, bestScore: score, bestAge: age };
}

// ============ 后悔回退（undo）============

/** 后悔栈上限：最多回退 5 步（体验与内存平衡） */
export const UNDO_MAX = 5;

/** 从栈中可回退的年龄列表（去重升序，供「回退到 N 岁」选择） */
export function undoableAges(stack: UndoEntry[]): number[] {
  return [...new Set(stack.map(e => e.game.age))].sort((a, b) => a - b);
}

/** 从栈顶往下找最近一个「年龄 ≤ 目标岁」的条目下标；找不到返回 -1 */
export function findUndoEntry(stack: UndoEntry[], age: number): number {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].game.age <= age) {
      return i;
    }
  }
  return -1;
}

/** 回退恢复快照：还原到指定条目（事件/反馈/跳过事件截断/伴侣互动进度） */
function restoreUndo(state: RuntimeState, entry: UndoEntry): RuntimeState {
  // 选择前的事件：伴侣互动不在事件数组中，按互动年龄重建
  let currentEvent: LifeEvent | null = null;
  if (entry.currentEventId) {
    currentEvent = entry.currentEventId.startsWith('companion_')
      ? buildCompanionEvent(entry.companionNextAge)
      : state.shuffledEvents.find(e => e.id === entry.currentEventId) ?? null;
  }
  return {
    ...state,
    game: entry.game,
    currentEvent,
    feedback: entry.feedback,
    eventIndex: entry.eventIndex,
    skippedEvents: state.skippedEvents.slice(0, entry.skippedCount),
    companionNextAge: entry.companionNextAge,
    // 回退后栈顶即该条目的下一层（弹掉的条目已丢弃，不可再回退）
    undoStack: state.undoStack.slice(0, state.undoStack.indexOf(entry)),
  };
}

// ============ 每周挑战存储 ============

/** 每周挑战存储 key */
const WEEKLY_KEY = 'life-sim-weekly';

/** 每周挑战存储结构（week 为 ISO 周标识，仅记录当周最佳） */
export interface WeeklyStore {
  week: string;
  /** 本周目标 key（展示「本周挑战：xxx」） */
  goalKey: string;
  bestScore: number;
  bestAge: number;
  /** 本周是否已通关（达成目标；同周复玩可刷新最佳） */
  cleared: boolean;
}

/** 读取每周挑战存储；数据损坏或存储不可用时返回空结构 */
function loadWeekly(): WeeklyStore {
  try {
    const raw = localStorage.getItem(WEEKLY_KEY);
    if (raw) {
      const data = JSON.parse(raw) as WeeklyStore;
      if (data && typeof data.week === 'string' && typeof data.goalKey === 'string') {
        return {
          week: data.week,
          goalKey: data.goalKey,
          bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
          bestAge: typeof data.bestAge === 'number' ? data.bestAge : 0,
          cleared: Boolean(data.cleared),
        };
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { week: '', goalKey: '', bestScore: 0, bestAge: 0, cleared: false };
}

/** 持久化每周挑战存储；存储不可用时静默降级 */
function saveWeekly(store: WeeklyStore): void {
  try {
    localStorage.setItem(WEEKLY_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

/**
 * 结算时更新当周记录（纯函数）。
 * 跨周或本周首局以本局成绩初始化当周记录；同周取 max，通关标记只升不降。
 *
 * @param prev 现有每周记录
 * @param week 本周标识（ISO 周号）
 * @param score 本局综合评分
 * @param age 本局享年
 * @param cleared 本局是否达成周目标
 * @returns 更新后的每周记录
 */
export function updateWeeklyBest(prev: WeeklyStore, week: string, score: number, age: number, cleared: boolean): WeeklyStore {
  if (prev.week === week) {
    return {
      ...prev,
      bestScore: Math.max(prev.bestScore, score),
      bestAge: Math.max(prev.bestAge, age),
      cleared: prev.cleared || cleared,
    };
  }
  return { week, goalKey: pickWeeklyGoal(week).key, bestScore: score, bestAge: age, cleared };
}

// ============ Action 类型 ============
export type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed; goal: GoalKey | CustomGoal | null; challenge: boolean; realMode?: boolean; seed?: number; isDaily?: boolean; isWeekly?: boolean; talents?: string[]; alloc?: Partial<Attributes>; route?: string }
  | { type: 'START_AUTO_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'REINCARNATE' }
  | { type: 'RESTART' }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'MAKE_ACTION'; activityId: string }
  | { type: 'SKIP_INTRO' }
  | { type: 'FAST_FORWARD_TO'; age: number }
  | { type: 'UNDO' }
  | { type: 'UNDO_TO_AGE'; age: number }
  | { type: 'CONTINUE' }
  | { type: 'SET_TYPE_SPEED'; typeSpeed: TypeSpeed }
  | { type: 'RESET' }
  | { type: 'RESET_FAMILY' }
  | { type: 'CONTINUE_GAME'; slot: number }
  | { type: 'SELECT_SLOT'; slot: number }
  | { type: 'HYDRATE_SAVES'; saves: SavesV2; achievements: AchievementStore }
  | { type: 'SAVES_UPDATED'; saves: SavesV2 }
  | { type: 'ACHIEVEMENTS_PERSISTED' }
  | { type: 'DAILY_UPDATED'; daily: DailyStore }
  | { type: 'DAILY_HISTORY_UPDATED'; dailyHistory: DailyHistory }
  | { type: 'DAILY_STREAK_UPDATED'; dailyStreak: DailyStreak }
  | { type: 'SEED_SCORES_UPDATED'; seedScores: SeedScores }
  | { type: 'FAMILY_UPDATED'; family: FamilyMember[] }
  | { type: 'WEEKLY_UPDATED'; weekly: WeeklyStore };

// ============ 运行时状态（不参与 React 渲染）============
export interface RuntimeState {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  eventIndex: number;       // 当前事件在 shuffledEvents 数组中的位置
  /** 本局事件顺序（同岁组内按种子洗牌，重开一局顺序不同） */
  shuffledEvents: LifeEvent[];
  /** 本局因条件未满足而被跳过的事件（结算页展示「本可发生而未触发」） */
  skippedEvents: LifeEvent[];
  /** 洗牌种子（存档恢复时还原顺序） */
  shuffleSeed: number;
  /** 快速模拟模式：自动随机选择快速走完一生 */
  autoPlay: boolean;
  /** 幼儿期走过场（手动局 0-5 岁自动播放，6 岁起交还玩家；快速模拟局无此标记） */
  introAuto?: boolean;
  /** 快进目标年龄（局内自动随机选择直到该岁后交还手动；null = 未快进） */
  fastForwardUntil?: number | null;
  /** 本局密度档位（开局选定，中途不可切） */
  paceMode: PaceMode;
  /** 打字机速度档（游戏内可随时切换） */
  typeSpeed: TypeSpeed;
  /** v2 存档（3 槽位 + active），HYDRATE_SAVES 水合 */
  saves: SavesV2;
  /** 跨周目成就存储（已解锁列表 + 累计完成局数），HYDRATE_SAVES 水合 */
  achievements: AchievementStore;
  /** 跨周目生涯统计（总局数/最佳评分/平均寿命/结局分布），初始同步读取，结算后写回 */
  stats: StatsStore;
  /** 进入结算但尚未写入成就存储（pending 标志只由 MAKE_CHOICE 的 gameOver 置位，读档恢复不触发） */
  achievementPending: boolean;
  /** 本局新解锁成就（判定后暂存，供结算页展示，不进 GameState） */
  pendingNewIds: AchievementId[];
  /** 本局结算后的累计完成局数（待写入存储） */
  pendingLives: number;
  /** 本局结算的结局 key（verdictKey，待写入存储） */
  pendingEndingKey: string;
  /** 本局命运事件 id 列表（第 3 周目起 1 个，第 5 周目起 2 个：该事件效果 ×1.5；存档还原） */
  fateEventIds: string[];
  /** 每日挑战局：固定种子（同日同序列）+ 不写存档槽（结算仅更新今日最佳） */
  isDaily: boolean;
  /** 每周挑战局：固定种子（同周同序列 + 本周目标）+ 不写存档槽 */
  isWeekly: boolean;
  /** 本周挑战目标（开局时按周种子确定；结算判定通关） */
  weeklyGoal: WeeklyGoal;
  /** 种子挑战局：玩家输入分享的种子码开局（同种子同事件序列），局中重开保持该种子 */
  seedChallenge: boolean;
  /** 每日挑战记录（今日最佳；标题页展示） */
  daily: DailyStore;
  /** 每日挑战历史（按天最佳；StatsModal 周视图展示） */
  dailyHistory: DailyHistory;
  /** 每日挑战连续打卡（连续 3/7 天成就） */
  dailyStreak: DailyStreak;
  /** 每周挑战记录（当周最佳；标题页展示） */
  weekly: WeeklyStore;
  /** 种子挑战本地比分（SeedModal 展示） */
  seedScores: SeedScores;
  /** 家族族谱（跨周目；结算时正常局追加一代，快速模拟/每日挑战不写入） */
  family: FamilyMember[];
  /** 后悔栈：最近 N 步选择前的状态快照（回退上一步/回退到某岁；快速模拟不记录） */
  undoStack: UndoEntry[];
  /** 伴侣互动下次触发年龄（married 后每 4 岁一次；99 = 未启用） */
  companionNextAge: number;
}

// ============ 存档 ============

/** 存档 v2 key（3 槽位 + active） */
const SAVE_KEY_V2 = 'life-sim-saves-v2';
/** 旧版单槽存档 key（首次启动迁移到 v2 后删除） */
const LEGACY_SAVE_KEY = 'life-sim-save-v1';

/** 读取 v2 存档；不存在则尝试迁移旧版；都没有返回空结构 */
function loadSaves(): SavesV2 {
  try {
    const raw = localStorage.getItem(SAVE_KEY_V2);
    if (raw) {
      const data = JSON.parse(raw) as SavesV2;
      if (data && Array.isArray(data.slots) && data.slots.length === SLOT_COUNT && typeof data.active === 'number') {
        // 内容级校验：非法槽置 null；active 越界或非整数回退 0
        const slots = data.slots.map(s => (isValidSaveData(s) ? s : null));
        const active = Number.isInteger(data.active) && data.active >= 0 && data.active < SLOT_COUNT ? data.active : 0;
        return { active, slots };
      }
    }
    // 旧版单槽存档迁移（内容校验失败抛错，由外层 catch 捕获后跳过迁移）
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy) {
      const migrated = migrateLegacySave(legacy);
      // 先写 v2 成功后才删旧键，避免 setItem 失败导致永久丢档
      if (saveSaves(migrated)) {
        localStorage.removeItem(LEGACY_SAVE_KEY);
      }
      return migrated;
    }
  } catch {
    // 存储不可用时静默降级为空结构
  }
  return emptySaves();
}

/** 持久化 v2 存档；写入成功返回 true */
function saveSaves(saves: SavesV2): boolean {
  try {
    localStorage.setItem(SAVE_KEY_V2, JSON.stringify(saves));
    return true;
  } catch {
    // 存储不可用（隐私模式/满额）时静默降级为不保存
    return false;
  }
}

/** 持久化当前状态到 active 槽；标题页状态（新游戏未开始）时不写不删 */
/**
 * 持久化当前状态到 active 槽；标题页状态（新游戏未开始）时不写不删。
 * 返回更新后的 saves（供调用方同步回运行时状态——否则中途回标题时
 * rt.saves 停留在挂载时快照，存档卡不显示且覆盖确认不弹，存在丢档风险）。
 * 内容未变（SAVES_UPDATED 后的重跑）返回 null，避免写库与 dispatch 循环。
 */
export function saveState(rt: RuntimeState): SavesV2 | null {
  // 快速模拟/每日挑战/每周挑战为临时局：不写入存档槽位（避免静默覆盖正式存档）
  if (rt.autoPlay || rt.isDaily || rt.isWeekly) {
    return null;
  }
  if (!rt.game || rt.game.phase === 'title') {
    return null;
  }
  const saves = { ...rt.saves, slots: [...rt.saves.slots] };
  saves.slots[saves.active] = {
    game: rt.game,
    currentEventId: rt.currentEvent?.id ?? null,
    feedback: rt.feedback,
    eventIndex: rt.eventIndex,
    shuffleSeed: rt.shuffleSeed,
    paceMode: rt.paceMode,
    typeSpeed: rt.typeSpeed,
    // 双命运事件（第 5 周目）：写新字段；旧字段保留第一个用于旧版读档兜底
    fateEventIds: rt.fateEventIds,
    fateEventId: rt.fateEventIds[0] ?? null,
    // 后悔栈与伴侣互动进度：读档后可继续回退/继续伴侣互动（旧档无字段 = 空栈/未启用）
    undoStack: rt.undoStack,
    companionNextAge: rt.companionNextAge,
  };
  // 内容未变则跳过写库（防 SAVES_UPDATED 同步后的 effect 重跑循环）
  if (JSON.stringify(saves) === JSON.stringify(rt.saves)) {
    return null;
  }
  return saveSaves(saves) ? saves : null;
}

// ============ 挑战历史存储（每日周视图 + 种子比分）============

/** 每日挑战历史存储 key */
const DAILY_HISTORY_KEY = 'life-sim-daily-history';

/** 每日挑战历史：YYYYMMDD → 当日最佳（玩过的天才有记录，同天覆盖） */
export interface DailyHistory {
  [date: string]: { score: number; age: number };
}

/** 读取每日挑战历史；数据损坏或存储不可用时返回空结构 */
export function loadDailyHistory(): DailyHistory {
  try {
    const raw = localStorage.getItem(DAILY_HISTORY_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DailyHistory;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return {};
}

/** 持久化每日挑战历史；存储不可用时静默降级 */
export function saveDailyHistory(store: DailyHistory): void {
  try {
    localStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

/** 每日挑战连续打卡存储 key */
const DAILY_STREAK_KEY = 'life-sim-daily-streak';

/** 每日挑战连续打卡记录（date = 最近打卡日，count = 连续天数） */
export interface DailyStreak {
  date: string;
  count: number;
}

/** 读取连续打卡记录；数据损坏或存储不可用时返回空结构 */
export function loadDailyStreak(): DailyStreak {
  try {
    const raw = localStorage.getItem(DAILY_STREAK_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DailyStreak;
      if (data && typeof data.date === 'string' && typeof data.count === 'number') {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { date: '', count: 0 };
}

/** 持久化连续打卡记录；存储不可用时静默降级 */
export function saveDailyStreak(store: DailyStreak): void {
  try {
    localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

/**
 * 推进连续打卡：昨天打过 → 连续 +1；今天重复 → 不变；断档（前天及更早）→ 重新开始。
 * 纯函数，确定性可测试。
 */
export function updateDailyStreak(prev: DailyStreak, today: string): DailyStreak {
  if (prev.date === today) {
    return prev;
  }
  // 昨天（YYYYMMDD 解析 → 本地时区回退一天）
  const todayDate = new Date(Number(today.slice(0, 4)), Number(today.slice(4, 6)) - 1, Number(today.slice(6, 8)));
  todayDate.setDate(todayDate.getDate() - 1);
  const prevDay = formatDate(todayDate);
  if (prev.date === prevDay) {
    return { date: today, count: prev.count + 1 };
  }
  return { date: today, count: 1 };
}

/** 追加当日记录：同天只保留最佳（更高评分；平局保留先达者） */
export function updateDailyHistory(prev: DailyHistory, today: string, score: number, age: number): DailyHistory {
  const existing = prev[today];
  if (existing && existing.score >= score) {
    return prev;
  }
  return { ...prev, [today]: { score, age } };
}

/** 种子挑战比分存储 key */
const SEED_SCORES_KEY = 'life-sim-seed-scores';

/** 种子挑战本地比分：种子 → 最佳评分/享年/游玩次数 */
export interface SeedScores {
  [seed: string]: { bestScore: number; bestAge: number; plays: number };
}

/** 读取种子比分；数据损坏或存储不可用时返回空结构 */
export function loadSeedScores(): SeedScores {
  try {
    const raw = localStorage.getItem(SEED_SCORES_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SeedScores;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return {};
}

/** 持久化种子比分；存储不可用时静默降级 */
export function saveSeedScores(store: SeedScores): void {
  try {
    localStorage.setItem(SEED_SCORES_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

/** 记录一局种子挑战：首次 plays=1；复玩 plays+1 且 best 取更高评分（平局保留先达者享年） */
export function recordSeedScore(prev: SeedScores, seed: string, score: number, age: number): SeedScores {
  const existing = prev[seed];
  if (!existing) {
    return { ...prev, [seed]: { bestScore: score, bestAge: age, plays: 1 } };
  }
  const better = score > existing.bestScore;
  return {
    ...prev,
    [seed]: {
      bestScore: Math.max(existing.bestScore, score),
      bestAge: better ? age : existing.bestAge,
      plays: existing.plays + 1,
    },
  };
}

// ============ 开局初始化（START_GAME / START_AUTO_GAME / RESTART 共用）============

/** 开局参数 */
interface StartParams {
  gender: 'male' | 'female';
  name: string;
  paceMode: PaceMode;
  typeSpeed: TypeSpeed;
  goal: GoalKey | CustomGoal | null;
  challenge: boolean;
  /** 真实模式（第 2 周目解锁）：选项隐藏精确数值，只显示属性倾向 */
  realMode?: boolean;
  /** 洗牌种子；缺省随机生成 */
  seed?: number;
  /** 快速模拟：自动随机选择快速走完一生 */
  autoPlay: boolean;
  /** 每日挑战局：固定种子（同日同序列）+ 不写存档槽 */
  isDaily?: boolean;
  /** 每周挑战局：固定种子（同周同序列 + 本周目标）+ 不写存档槽 */
  isWeekly?: boolean;
  /** 本局天赋（开局构筑抽取；局中重开/人生重开保留） */
  talents?: string[];
  /** 开局属性点分配（开局构筑；局中重开/人生重开保留出生配置） */
  alloc?: Partial<Attributes>;
  /** 人生重开（第 6 周目起）：以本局终局属性的一半重新投胎 */
  reincarnateFrom?: Attributes;
  /** 开局人生路线 key（「这一生想体验什么」；缺省 = 自由人生） */
  route?: string;
}

/**
 * 开局初始化：新状态 + 洗牌 + 首事件预载 + 命运事件抽取。
 * 新一局随机种子洗牌，同岁组顺序每局不同（重玩性）。
 */
function startNewGame(state: RuntimeState, p: StartParams): RuntimeState {
  const game = createInitialState(p.gender, p.name);
  game.goal = p.goal;
  // 开局构筑：天赋属性（先天基因）→ 属性点分配（出生配置），叠加在初始属性上
  const talents = p.talents ?? [];
  if (talents.length > 0) {
    game.attributes = applyTalents(game.attributes, talents);
    game.talents = talents;
  }
  if (p.alloc && Object.keys(p.alloc).length > 0) {
    game.attributes = applyAllocation(game.attributes, p.alloc);
    game.allocated = p.alloc;
  }
  // 人生重开（第 6 周目起）：取「初始 + 终局」均值重新投胎（每项保底初始值——活得好才增益，不拖累；不叠加传承/挑战）
  if (p.reincarnateFrom) {
    const attrs = { ...game.attributes };
    for (const k of Object.keys(attrs) as AttributeKey[]) {
      attrs[k] = Math.max(attrs[k], Math.round((attrs[k] + p.reincarnateFrom[k]) / 2));
    }
    game.attributes = attrs;
    game.reincarnated = true;
  } else {
    // 成就加成：每解锁 10 成就开局全属性 +2（祖辈的成就照亮下一代）
    const steps = Math.floor(state.achievements.unlocked.length / 10);
    if (steps > 0) {
      game.attributes = applyAchievementBonus(game.attributes, state.achievements.unlocked.length);
      game.allocBonus = true;
    }
    // 属性传承（第 5 周目起）：上一世终局最高 2 项属性各 +8（先继承）
    if (state.stats.lastEndAttrs) {
      game.attributes = applyInheritance(game.attributes, state.stats.lastEndAttrs);
      game.inherited = true;
    }
    // 家族底蕴（第 2 代手玩局起）：最近手玩代均值 ≥70 的强项属性各 +2，总加成封顶 +6
    game.attributes = applyLegacy(game.attributes, deriveLegacy(state.family));
    // 挑战开局（第 2 周目解锁）：属性整体下调 10 点（与传承独立叠加，后挑战）
    game.challenge = p.challenge;
    if (game.challenge) {
      game.attributes = applyChallenge(game.attributes);
    }
  }
  // 真实模式（第 2 周目解锁）：选项只显示属性倾向箭头
  game.realMode = p.realMode ?? false;
  // 跨代继承：族谱非空时按上一代结局路线注入 parent_ flag（童年继承事件消费）
  const pf = parentFlag(state.family);
  if (pf) {
    game.flags.push(pf);
  }
  // 开局人生路线：注入入口 flag，稳定触发对应事件链（自由人生 = 无注入）
  if (p.route) {
    const route = getRoute(p.route);
    for (const f of route?.seedFlags ?? []) {
      if (!game.flags.includes(f)) {
        game.flags.push(f);
      }
    }
    game.route = p.route;
  }
  const shuffleSeed = p.seed ?? Math.floor(Math.random() * 2 ** 31);
  // 快速模拟用精简档（每岁 1-2 个）；手动模式按所选密度档过滤
  const shuffledEvents = shuffleEvents(filterEvents(EVENTS, p.paceMode, shuffleSeed, getRoute(p.route)?.seedFlags ?? []), shuffleSeed);
  const firstScan = findNextEvent(game, -1, shuffledEvents);
  const first = firstScan.event;
  if (first) {
    game.age = first.age;
    game.stage = getStageForAge(first.age);
    game.stageIdx = STAGE_ORDER.indexOf(game.stage);
    // 初始快照：首事件年龄 + 开局属性（成长曲线起点）
    game.snapshots = appendSnapshot(undefined, game.age, game.attributes, false);
  }
  // 第 3 周目起（累计完成 ≥ 2 局）：抽 1 个本局命运事件；第 5 周目起（累计 ≥ 4 局）：抽 2 个（效果 ×1.5）
  const fateCount = state.stats.totalLives >= 4 ? 2 : 1;
  const fateEvents = state.stats.totalLives >= 2 ? pickFateEvents(shuffleSeed, fateCount) : [];
  // 幼儿期走过场资格：仅普通手动局（非快速模拟/每日/每周/种子）——每日/每周/种子挑战自动随机选择会破坏「同一天同一局」的公平性
  const introEligible = p.seed == null && !p.isDaily && !p.isWeekly && game.age < 6;
  return {
    game,
    currentEvent: first,
    feedback: null,
    eventIndex: first ? shuffledEvents.indexOf(first) : 0,
    shuffledEvents,
    skippedEvents: firstScan.skipped,
    shuffleSeed,
    // 幼儿期走过场：普通手动局 0-5 岁不弹选择面板（introAuto 标记，幻灯片式自主点击翻页，6 岁起交还玩家）；
    // autoPlay 仅快速模拟为 true——幼儿期由 GameScreen 点击推进（onChoice 自动随机选），不做全自动播放
    autoPlay: p.autoPlay,
    introAuto: !p.autoPlay && introEligible,
    fastForwardUntil: null,
    paceMode: p.paceMode,
    typeSpeed: p.typeSpeed,
    saves: state.saves,
    achievements: state.achievements,
    stats: state.stats,
    achievementPending: false,
    pendingNewIds: [],
    pendingLives: 0,
    pendingEndingKey: '',
    fateEventIds: fateEvents.map(e => e.id),
    isDaily: p.isDaily ?? false,
    // 每周挑战局：本周目标由周种子确定（同周全局同一目标）
    isWeekly: p.isWeekly ?? false,
    weeklyGoal: pickWeeklyGoal(weekOf(new Date())),
    // 挑战历史跨局保留（不随开局重置）
    dailyHistory: state.dailyHistory,
    dailyStreak: state.dailyStreak,
    weekly: state.weekly,
    seedScores: state.seedScores,
    // 种子挑战局：玩家输入了种子码且非每日挑战（重开保持种子）
    seedChallenge: p.seed != null && !p.isDaily && !p.isWeekly,
    daily: state.daily,
    family: state.family,
    // 新一局：后悔栈清空；伴侣互动未启用（married 后启用）
    undoStack: [],
    companionNextAge: COMPANION_DISABLED,
  };
}

// ============ Reducer ============
export function reducer(state: RuntimeState, action: Action): RuntimeState {
  switch (action.type) {
    case 'START_GAME':
      return startNewGame(state, {
        gender: action.gender,
        name: action.name,
        paceMode: action.paceMode,
        typeSpeed: action.typeSpeed,
        goal: action.goal,
        challenge: action.challenge,
        realMode: action.realMode ?? false,
        seed: action.seed,
        autoPlay: false,
        isDaily: action.isDaily,
        isWeekly: action.isWeekly,
        talents: action.talents,
        alloc: action.alloc,
        route: action.route,
      });

    case 'START_AUTO_GAME':
      // 快速模拟：精简档抽样（每岁 1-2 个）+ 中速 + 无目标（开局参数全部固定）
      return startNewGame(state, {
        gender: action.gender,
        name: action.name,
        paceMode: 'lite',
        typeSpeed: 'normal',
        goal: null,
        challenge: false,
        autoPlay: true,
      });

    case 'REINCARNATE': {
      // 人生重开（第 6 周目起）：以本局终局属性的一半重新投胎（保底初始值，不叠加传承/挑战）；天赋与出生配置随魂魄保留
      return startNewGame(state, {
        gender: state.game.gender,
        name: state.game.name,
        paceMode: state.paceMode,
        typeSpeed: state.typeSpeed,
        goal: null,
        challenge: false,
        seed: undefined,
        autoPlay: false,
        talents: state.game.talents,
        alloc: state.game.allocated,
        reincarnateFrom: state.game.attributes,
        route: state.game.route,
      });
    }

    case 'RESTART': {
      // 局中重开：沿用本局角色与设置（含开局构筑），换新随机种子洗牌（每日/每周挑战局保持固定种子，同日/同周重试同一序列）
      return startNewGame(state, {
        gender: state.game.gender,
        name: state.game.name,
        paceMode: state.paceMode,
        typeSpeed: state.typeSpeed,
        goal: state.game.goal,
        challenge: state.game.challenge ?? false,
        realMode: state.game.realMode ?? false,
        seed: (state.isDaily || state.isWeekly || state.seedChallenge) ? state.shuffleSeed : undefined,
        autoPlay: false,
        isDaily: state.isDaily,
        isWeekly: state.isWeekly,
        talents: state.game.talents,
        alloc: state.game.allocated,
        route: state.game.route,
      });
    }

    case 'MAKE_CHOICE': {
      const { choice, eventId } = action;
      // 后悔栈：记录选择前状态（快速模拟与幼儿期自动选择不记录——玩家未亲自做选择；最多保留 UNDO_MAX 步）
      const undoStack = state.autoPlay || state.introAuto || state.fastForwardUntil != null
        ? state.undoStack
        : [...state.undoStack, {
            game: state.game,
            eventIndex: state.eventIndex,
            feedback: state.feedback,
            skippedCount: state.skippedEvents.length,
            companionNextAge: state.companionNextAge,
            currentEventId: state.currentEvent?.id ?? null,
          }].slice(-UNDO_MAX);

      // 命运事件（第 3 周目解锁）：该事件所有选项效果 ×1.5
      const out = state.fateEventIds.includes(eventId)
        ? scaleOutcomes(choice.outcomes, FATE_MULTIPLIER)
        : choice.outcomes;

      // 更新属性（当前年龄决定成长上限）
      let attrs = applyOutcomes(state.game.attributes, out, state.game.age);

      // 更新标记
      const flags = [...state.game.flags];
      if (out.flags) {
        out.flags.forEach(f => { if (!flags.includes(f)) flags.push(f); });
      }

      // 基于更新后的属性/标记，线性扫描下一个满足条件的事件（幼儿期跳过同岁剩余，每岁只播 1 张幻灯片）
      const nextScan = findNextEvent({ ...state.game, attributes: attrs, flags }, state.eventIndex, state.shuffledEvents, !!state.introAuto);
      const next = nextScan.event;

      // 伴侣互动（婚后每 4 岁一次，25-61 岁）：到达互动年龄且本事件非伴侣互动 → 先播伴侣互动
      // （不占事件数组位置：eventIndex 仍指正常事件流；下次选择从正常事件继续）
      const playingCompanion = state.currentEvent?.id.startsWith('companion_') ?? false;
      let companionNextAge = state.companionNextAge;
      // 已婚启用：新获得 married flag 时初始化互动年龄（婚后第一个互动 25 岁起）
      if (flags.includes('married') && !state.game.flags.includes('married')) {
        companionNextAge = COMPANION_START_AGE;
      }
      let nextEvent = next;
      if (next && !playingCompanion && companionEnabled(flags.includes('married'), companionNextAge) && next.age >= companionNextAge) {
        // 到达互动年龄且本事件非伴侣互动 → 先播伴侣互动（互动选择完成后再推进下次互动年龄）
        nextEvent = buildCompanionEvent(companionNextAge);
      } else if (playingCompanion && companionNextAge <= COMPANION_END_AGE) {
        // 伴侣互动选择完成：推进下次互动年龄（若已超龄则禁用）
        companionNextAge = companionNextAge + COMPANION_INTERVAL;
      }

      // 年龄由下一个事件驱动；没有下一个事件说明全部播完
      const age = nextEvent ? nextEvent.age : state.game.age;
      const stage = getStageForAge(age);

      // 老年衰减
      if (age >= 65) {
        attrs = applyElderDecay(attrs);
      }

      // 整数保护
      attrs = ensureInt(attrs);

      // 死亡判断（动态寿命）
      const maxAge = calcMaxAge(attrs);
      const isDead = next !== null && checkDeath(age, attrs.health, maxAge);
      const gameOver = isDead || next === null;

      // 死因：致命 flag 优先（意外死亡事件产出 → 细分死因）；健康归零 → 耗尽；超过寿命或事件播完 → 寿终
      const deathCause: DeathCause | null = isDead
        ? (fatalCause(flags) ?? (attrs.health <= 0 ? 'health' : 'lifespan'))
        : (next === null ? 'lifespan' : null);

      // 记录历史
      const history = [...state.game.history, {
        age: state.game.age,
        stage: state.game.stage,
        eventId,
        choiceIndex: state.currentEvent?.choices.indexOf(choice) ?? 0,
        text: choice.text,
        flags: out.flags ?? undefined,
      }];

      // 主动行为记录随岁刷新：进入新岁清空本岁已做活动（每岁每个活动限 1 次——审计发现此前从不重置，实际是「一生一次」）
      const nextActionsDone = age !== state.game.age ? [] : state.game.actionsDone;

      const game: GameState = {
        ...state.game,
        age: isDead ? Math.min(age, maxAge) : age,
        stage,
        stageIdx: STAGE_ORDER.indexOf(stage),
        attributes: attrs,
        flags,
        history,
        deathCause,
        phase: gameOver ? 'summary' : 'playing',
        actionsDone: nextActionsDone,
        // 每岁属性快照：进入新岁或终局时记录（同岁内不重复）
        snapshots: appendSnapshot(state.game.snapshots, isDead ? Math.min(age, maxAge) : age, attrs, gameOver),
      };

      // 构建反馈文本
      let fb = `你选择了「${choice.text}」`;
      const attrChanges: Partial<Attributes> = out.attr ?? {};
      const changedKeys = (Object.keys(attrChanges) as AttributeKey[]).filter(k => attrChanges[k] !== 0);
      if (changedKeys.length > 0) {
        // 反馈展示实际生效值（含年龄上限收益递减）；正向收益距上限 15 点内标注余量
        fb += '\n\n' + changedKeys.map(k => {
          const v = effectiveDelta(k, attrChanges[k]!, state.game.attributes, state.game.age);
          const raw = attrChanges[k]!;
          const room = ageCap(state.game.age, k) - state.game.attributes[k];
          const decayNote = raw > 0 && room < 15 ? `（距上限${Math.max(0, Math.floor(room))}点）` : '';
          return `${v > 0 ? '+' : ''}${v}${decayNote}`;
        }).join('  ');
      }

      // 本局结算的结局 key（verdictKey 纯函数判定：路线 flag 优先，无则按分数档）
      const endingKey = gameOver ? verdictKey(game) : '';
      // 连续打卡：仅每日挑战局推进（判定与持久化同源，当天确定性一致）；普通局沿用当前值
      const dailyStreak = state.isDaily
        ? updateDailyStreak(state.dailyStreak, formatDate(new Date())).count
        : state.dailyStreak.count;

      // 进入结算：判定本局新解锁成就（纯计算，持久化由 effect 完成）
      // 死法分布含本局：跨局累计 + 本局死因（「花样作死」需跨局 3 种死法）
      const deaths = accumulateDeaths(state.stats.deaths, deathCause ?? 'lifespan');
      const newIds = gameOver
        ? checkAchievements({
            game,
            completedLives: state.achievements.completedLives + 1,
            wasLite: state.paceMode === 'lite',
            wasAuto: state.autoPlay,
            // 累计结局数（含本局）：已有集合 + 本局结局若为新则 +1
            endingsCount: state.achievements.endings.length + (state.achievements.endings.includes(endingKey) ? 0 : 1),
            dailyStreak,
            deaths,
          }).filter(id => !state.achievements.unlocked.includes(id))
        : [];

      return {
        game,
        currentEvent: gameOver ? null : nextEvent,
        feedback: fb,
        // 伴侣互动不占事件数组位置：插入互动时 eventIndex 保持「插入点位置」（互动选择后
        // 从插入点继续扫，不跳过下一个正常事件）；互动选择完成（nextEvent = 正常事件）时
        // eventIndex 照常指向下一个正常事件
        eventIndex: (nextEvent !== next)
          ? state.eventIndex
          : (next ? state.shuffledEvents.indexOf(next) : state.eventIndex),
        skippedEvents: [...state.skippedEvents, ...nextScan.skipped],
        shuffledEvents: state.shuffledEvents,
        shuffleSeed: state.shuffleSeed,
        // 幼儿期走过场：到 6 岁清除标记（自动选择期间不记录 undo）
        autoPlay: state.autoPlay,
        introAuto: state.introAuto && age < 6,
        // 快进到目标年龄（或死亡）即交还手动控制
        fastForwardUntil: state.fastForwardUntil != null && !gameOver && age < state.fastForwardUntil
          ? state.fastForwardUntil
          : null,
        paceMode: state.paceMode,
        typeSpeed: state.typeSpeed,
        saves: state.saves,
        achievements: state.achievements,
        stats: state.stats,
        achievementPending: gameOver,
        pendingNewIds: newIds,
        pendingLives: gameOver ? state.achievements.completedLives + 1 : 0,
        pendingEndingKey: endingKey,
        fateEventIds: state.fateEventIds,
        isDaily: state.isDaily,
        isWeekly: state.isWeekly,
        weeklyGoal: state.weeklyGoal,
        weekly: state.weekly,
        dailyHistory: state.dailyHistory,
    dailyStreak: state.dailyStreak,
        seedScores: state.seedScores,
        seedChallenge: state.seedChallenge,
        daily: state.daily,
        family: state.family,
        undoStack,
        companionNextAge,
      };
    }

    case 'MAKE_ACTION': {
      // 主动行为（活动）：局内即时操作——不推年龄、不进 history、不进后悔栈（纯即时，不污染人物推导）
      // 前置校验：任一不满足原样返回（返回原引用，UI 可判断无变化）
      if (state.game.phase !== 'playing') {
        return state;
      }
      if (state.feedback) {
        // 反馈页不行动（纯点击继续）
        return state;
      }
      if (state.autoPlay) {
        // 快速模拟不行动
        return state;
      }
      if ((state.game.actionsDone ?? []).includes(action.activityId)) {
        // 本岁该活动已做过（每岁每个活动限 1 次，防无限刷同一种）
        return state;
      }
      const activity = ACTIVITIES.find(a => a.id === action.activityId);
      if (!activity) {
        return state;
      }
      if (state.game.age < activity.minAge) {
        return state;
      }
      if (activity.requires && !activity.requires.some(f => state.game.flags.includes(f))) {
        return state;
      }
      if (activity.requiresNot && activity.requiresNot.some(f => state.game.flags.includes(f))) {
        return state;
      }
      // requiresPersona：任一人物已出场（好感 ≠ 50，从历史纯推导）即可用
      if (activity.requiresPersona && activity.requiresPersona.length > 0) {
        const bonds = personaBonds(state.game.history);
        if (!activity.requiresPersona.some(p => bonds[p as PersonaId] !== 50)) {
          return state;
        }
      }
      // 结果：犯罪走专用分支（成功率 + 被抓/逃跑，即时操作不需要确定性）；其余从结果池随机
      const result = activity.id === 'crime'
        ? rollCrime(state.game.attributes.luck, state.game.attributes.intelligence, Math.random)
        : pickActivityResult(activity);
      // 属性应用（年龄决定成长上限；活动收益不享受天赋/传承等额外加成）
      const attrs = applyOutcomes(state.game.attributes, result, state.game.age);
      // flags 追加（去重；活动级 flags 与结果变体 flags 同逻辑——犯罪被抓产出 jailed、发动态爆款产出 viral）
      const flags = [...state.game.flags];
      for (const fs of [activity.flags, result.flags]) {
        if (fs) {
          for (const f of fs) {
            if (!flags.includes(f)) {
              flags.push(f);
            }
          }
        }
      }
      const game: GameState = {
        ...state.game,
        attributes: attrs,
        flags,
        actionsDone: [...(state.game.actionsDone ?? []), activity.id],
      };
      // 反馈复用现有机制（CONTINUE 清反馈）；活动不推进事件流
      return { ...state, game, feedback: result.text };
    }

    case 'SKIP_INTRO': {
      // 跳过剩余幼儿期：自动随机选择推进到 6 岁（与逐次自动播放的随机分布一致，可安全快进）
      if (!state.introAuto) {
        return state;
      }
      let game = state.game;
      let currentEvent = state.currentEvent;
      let eventIndex = state.eventIndex;
      const shuffledEvents = state.shuffledEvents;
      let guard = 0;
      while (game.age < 6 && currentEvent && guard++ < 500) {
        const choice = currentEvent.choices[Math.floor(Math.random() * currentEvent.choices.length)];
        const out = state.fateEventIds.includes(currentEvent.id)
          ? scaleOutcomes(choice.outcomes, FATE_MULTIPLIER)
          : choice.outcomes;
        let attrs = applyOutcomes(game.attributes, out, game.age);
        const flags = [...game.flags];
        if (out.flags) {
          out.flags.forEach(f => { if (!flags.includes(f)) flags.push(f); });
        }
        const scan = findNextEvent({ ...game, attributes: attrs, flags }, eventIndex, shuffledEvents, true);
        const next = scan.event;
        const nextAge = next ? next.age : game.age;
        if (nextAge >= 65) {
          attrs = applyElderDecay(attrs);
        }
        attrs = ensureInt(attrs);
        game = { ...game, attributes: attrs, flags, age: nextAge, stage: getStageForAge(nextAge) };
        currentEvent = next;
        eventIndex = next ? shuffledEvents.indexOf(next) : eventIndex;
      }
      return { ...state, game, currentEvent, eventIndex, feedback: null, autoPlay: false, introAuto: false };
    }

    case 'FAST_FORWARD_TO': {
      // 局内快进：仅手动局（非快速模拟/每日/每周/种子，保证挑战公平）；目标年龄须大于当前
      if (state.autoPlay || state.isDaily || state.isWeekly || state.seedChallenge) {
        return state;
      }
      if (state.game.phase !== 'playing' || action.age <= state.game.age) {
        return state;
      }
      return { ...state, fastForwardUntil: action.age };
    }

    case 'UNDO': {
      // 后悔：回退上一步（栈空时原样返回）
      if (state.undoStack.length === 0) {
        return state;
      }
      return restoreUndo(state, state.undoStack[state.undoStack.length - 1]);
    }

    case 'UNDO_TO_AGE': {
      // 后悔：回退到指定岁数（栈中最近一次 ≤ 目标岁的选择前状态）
      const idx = findUndoEntry(state.undoStack, action.age);
      if (idx < 0) {
        return state;
      }
      return restoreUndo(state, state.undoStack[idx]);
    }

    case 'CONTINUE': {
      // MAKE_CHOICE 已预载下一个事件，这里只清反馈
      return { ...state, feedback: null };
    }

    case 'SET_TYPE_SPEED': {
      return { ...state, typeSpeed: action.typeSpeed };
    }

    case 'RESET': {
      // 回到标题：存档保留在槽中（槽位保留结局状态，开新局覆盖）
      const rt = createInitialRuntime();
      return { ...rt, saves: state.saves };
    }

    case 'SELECT_SLOT': {
      // 选择存档槽位：下一局新人生将保存到该槽（空槽可直接选，非空槽点击为继续）
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= SLOT_COUNT) {
        return state;
      }
      const saves = { ...state.saves, active: action.slot };
      saveSaves(saves);
      return { ...state, saves };
    }

    case 'RESET_FAMILY': {
      // 重置家族：清空族谱（家族底蕴随之归零，下一世重新积累）
      saveFamily([]);
      return { ...state, family: [] };
    }

    case 'CONTINUE_GAME': {
      // 从指定槽位恢复：标题页 → 存档中的游戏现场
      const { slot } = action;
      const saved = state.saves.slots[slot];
      if (!saved) {
        return state;
      }
      // 旧版存档无档位字段，显式兜底兼容
      const paceMode = saved.paceMode ?? 'full';
      const typeSpeed = saved.typeSpeed ?? 'normal';
      // 按存档种子还原本局事件顺序（旧版存档无种子则用默认顺序）
      const shuffleSeed = typeof saved.shuffleSeed === 'number' ? saved.shuffleSeed : 0;
      const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed, getRoute(saved.game.route)?.seedFlags ?? []), shuffleSeed);
      // 伴侣互动事件不在事件数组中，按存档的互动年龄重建（旧档无字段 = 未启用）
      const companionAge = typeof saved.companionNextAge === 'number' ? saved.companionNextAge : COMPANION_DISABLED;
      const currentEvent = saved.currentEventId
        ? saved.currentEventId.startsWith('companion_')
          ? (companionAge <= COMPANION_END_AGE ? buildCompanionEvent(companionAge) : null)
          : shuffledEvents.find(e => e.id === saved.currentEventId) ?? null
        : null;
      const saves = { ...state.saves, active: slot, slots: [...state.saves.slots] };
      return {
        // 旧版存档无 deathCause 字段，显式兜底兼容；恢复为手动模式
        game: { ...saved.game, deathCause: saved.game.deathCause ?? null },
        currentEvent,
        feedback: saved.feedback,
        eventIndex: saved.eventIndex,
        skippedEvents: [],
        shuffleSeed,
        shuffledEvents,
        autoPlay: false,
        // 幼儿期中途退出读档：恢复幻灯片标记（自动模拟局不写槽，读档年龄 <6 必为手动局）
        introAuto: saved.game.age < 6,
        fastForwardUntil: null,
        paceMode,
        typeSpeed,
        saves,
        // 读档恢复不经过 MAKE_CHOICE，不重复结算计数
        achievements: state.achievements,
        stats: state.stats,
        achievementPending: false,
        pendingNewIds: [],
        pendingLives: 0,
        pendingEndingKey: '',
        // 旧档无命运事件字段，显式兜底（新档读 fateEventIds，旧档回退单元素）
        fateEventIds: saved.fateEventIds ?? (saved.fateEventId ? [saved.fateEventId] : []),
        isDaily: false,
        isWeekly: false,
        weeklyGoal: pickWeeklyGoal(weekOf(new Date())),
        weekly: state.weekly,
        seedChallenge: false,
        daily: state.daily,
        dailyHistory: state.dailyHistory,
    dailyStreak: state.dailyStreak,
        seedScores: state.seedScores,
        family: state.family,
        // 后悔栈与伴侣互动进度随档恢复（旧档无字段 = 空栈/未启用）
        undoStack: saved.undoStack ?? [],
        companionNextAge: companionAge,
      };
    }

    case 'WEEKLY_UPDATED':
      // 每周挑战最佳已写入 localStorage，更新运行时记录（标题页展示）
      return { ...state, weekly: action.weekly };

    case 'SAVES_UPDATED':
      // 存档已写入 localStorage，同步回运行时（标题页存档卡与覆盖确认读此状态）
      return { ...state, saves: action.saves };

    case 'HYDRATE_SAVES':
      // 存档与成就存储一并水合（成就跨周目，从 localStorage 载入）
      return { ...state, saves: action.saves, achievements: action.achievements };

    case 'ACHIEVEMENTS_PERSISTED': {
      // 成就已写入 localStorage，清除 pending 标志；pendingNewIds 保留到下一局开始（结算页持续展示新解锁）
      return { ...state, achievementPending: false, pendingLives: 0, pendingEndingKey: '' };
    }

    case 'DAILY_UPDATED':
      // 每日挑战最佳已写入 localStorage，更新运行时记录（标题页展示）
      return { ...state, daily: action.daily };

    case 'DAILY_HISTORY_UPDATED':
      // 每日挑战历史已写入 localStorage，更新运行时记录（StatsModal 周视图）
      return { ...state, dailyHistory: action.dailyHistory };

    case 'DAILY_STREAK_UPDATED':
      // 连续打卡已写入 localStorage，更新运行时记录（成就判定用）
      return { ...state, dailyStreak: action.dailyStreak };

    case 'SEED_SCORES_UPDATED':
      // 种子比分已写入 localStorage，更新运行时记录（SeedModal 展示）
      return { ...state, seedScores: action.seedScores };

    case 'FAMILY_UPDATED':
      // 族谱已写入 localStorage，更新运行时族谱（标题页族谱展示）
      return { ...state, family: action.family };

    default:
      return state;
  }
}

// ============ 事件查找 ============

/** 从 fromIndex 之后线性扫描：返回第一个满足条件的事件与扫描中跳过的所有事件（条件不满足） */
function findNextEvent(game: GameState, fromIndex: number, events: LifeEvent[], skipSameAge = false): { event: LifeEvent | null; skipped: LifeEvent[] } {
  const skipped: LifeEvent[] = [];
  for (let i = fromIndex + 1; i < events.length; i++) {
    const e = events[i];
    // 幼儿期幻灯片：跳过同岁剩余事件（每岁只播 1 张；非条件不满足，不进「未触发」列表）
    if (skipSameAge && e.age <= game.age) {
      continue;
    }
    if (checkConditions(e, game)) {
      return { event: e, skipped };
    }
    skipped.push(e);
  }
  return { event: null, skipped };
}

/** 检查事件条件是否满足 */
function checkConditions(e: LifeEvent, game: GameState): boolean {
  const c = e.conditions;
  if (!c) return true;

  if (c.hasFlags) {
    for (const f of c.hasFlags) {
      if (!game.flags.includes(f)) return false;
    }
  }
  if (c.notFlags) {
    for (const f of c.notFlags) {
      if (game.flags.includes(f)) return false;
    }
  }
  if (c.minAttrs) {
    for (const [k, v] of Object.entries(c.minAttrs) as [AttributeKey, number][]) {
      if ((game.attributes[k] ?? 0) < v) return false;
    }
  }
  if (c.maxAttrs) {
    for (const [k, v] of Object.entries(c.maxAttrs) as [AttributeKey, number][]) {
      if ((game.attributes[k] ?? 0) > v) return false;
    }
  }
  // 性格条件：从 history 纯推导（仅带该条件的事件才计算，性能无感）
  if (c.minPersonality) {
    if (!meetsPersonality(derivePersona(game.history), c.minPersonality)) {
      return false;
    }
  }
  return true;
}

export function createInitialRuntime(): RuntimeState {
  return {
    game: {
      gender: 'male', name: '', age: 0, stage: 'infant', stageIdx: 0,
      attributes: { health: 65, intelligence: 25, wealth: 20, happiness: 60, social: 25, appearance: 45, luck: 50, morality: 45 },
      flags: [], history: [], phase: 'title', deathCause: null, goal: null,
    },
    currentEvent: null, feedback: null, eventIndex: 0,
    shuffledEvents: EVENTS,
    skippedEvents: [],
    shuffleSeed: 0,
    autoPlay: false,
    fastForwardUntil: null,
    paceMode: 'full',
    typeSpeed: 'normal',
    saves: emptySaves(),
    // 初始同步读取成就存储（localStorage 同步 API，安全），HYDRATE_SAVES 再水合一次
    achievements: loadAchievements(),
    // 生涯统计同样初始同步读取
    stats: loadStats(),
    achievementPending: false,
    pendingNewIds: [],
    pendingLives: 0,
    pendingEndingKey: '',
    fateEventIds: [],
    isDaily: false,
    isWeekly: false,
    weeklyGoal: pickWeeklyGoal(weekOf(new Date())),
    seedChallenge: false,
    // 每日挑战记录初始同步读取
    daily: loadDaily(),
    // 挑战历史同样初始同步读取
    dailyHistory: loadDailyHistory(),
    dailyStreak: loadDailyStreak(),
    // 每周挑战记录初始同步读取
    weekly: loadWeekly(),
    seedScores: loadSeedScores(),
    // 族谱同样初始同步读取
    family: loadFamily(),
    // 后悔栈与伴侣互动：初始为空/未启用
    undoStack: [],
    companionNextAge: COMPANION_DISABLED,
  };
}

// ============ Hook ============

/** 命运事件效果放大倍数 */
const FATE_MULTIPLIER = 1.5;

/** 快速模拟：事件推进间隔（毫秒） */
const AUTO_PLAY_INTERVAL = 220;
/** 快速模拟：反馈页跳过间隔（毫秒） */
const AUTO_PLAY_FEEDBACK_INTERVAL = 50;

export function useGame() {
  const [rt, dispatch] = useReducer(reducer, null, createInitialRuntime);

  // 挂载时一次性读取/迁移存档（迁移有 localStorage 写入副作用，只跑一次）；成就存储一并载入
  useEffect(() => {
    dispatch({ type: 'HYDRATE_SAVES', saves: loadSaves(), achievements: loadAchievements() });
  }, []);

  // 结算持久化：成就并入结局集合（去重），生涯统计累计本局（与成就同一时机，一次写库），写库后清标志（pending 标志只由 MAKE_CHOICE 的 gameOver 置位，读档恢复到 summary 不会触发）
  useEffect(() => {
    if (!rt.achievementPending) {
      return;
    }
    saveAchievements({
      unlocked: [...new Set([...rt.achievements.unlocked, ...rt.pendingNewIds])],
      completedLives: rt.pendingLives,
      endings: [...new Set([...rt.achievements.endings, rt.pendingEndingKey])],
    });
    const score = calcScore(rt.game.attributes);
    saveStats({
      totalLives: rt.stats.totalLives + 1,
      bestScore: Math.max(rt.stats.bestScore, score),
      totalAge: rt.stats.totalAge + rt.game.age,
      endings: { ...rt.stats.endings, [rt.pendingEndingKey]: (rt.stats.endings[rt.pendingEndingKey] ?? 0) + 1 },
      // 上一世终局属性：下一局开局传承（最高 2 项 ≥50 各 +8）
      lastEndAttrs: rt.game.attributes,
      // 死法分布：累计本局死因（死因缺失局兜底为 lifespan；旧存档无字段自动补齐）
      deaths: accumulateDeaths(rt.stats.deaths, rt.game.deathCause ?? 'lifespan'),
    });
    // 埋点：结算（与成就/统计同一时机，pending 标志保证不重复）
    track({ type: 'game_finish', ts: Date.now(), score, age: rt.game.age, endingKey: rt.pendingEndingKey });
    // 每日挑战局：结算更新今日最佳（跨天则以本局初始化今日记录）+ 追加当日历史（同天保留最佳）
    if (rt.isDaily) {
      const today = formatDate(new Date());
      const nextDaily = updateDailyBest(rt.daily, today, score, rt.game.age);
      saveDaily(nextDaily);
      dispatch({ type: 'DAILY_UPDATED', daily: nextDaily });
      const nextHistory = updateDailyHistory(rt.dailyHistory, today, score, rt.game.age);
      saveDailyHistory(nextHistory);
      dispatch({ type: 'DAILY_HISTORY_UPDATED', dailyHistory: nextHistory });
      // 连续打卡推进（昨天打过 +1，今天重复不变，断档重来）
      const nextStreak = updateDailyStreak(rt.dailyStreak, today);
      saveDailyStreak(nextStreak);
      dispatch({ type: 'DAILY_STREAK_UPDATED', dailyStreak: nextStreak });
    }
    // 每周挑战局：结算更新当周最佳（跨周则以本局初始化当周记录）+ 判定本周目标通关
    if (rt.isWeekly) {
      const week = weekOf(new Date());
      const nextWeekly = updateWeeklyBest(rt.weekly, week, score, rt.game.age, checkWeeklyGoal(rt.weeklyGoal, rt.game));
      saveWeekly(nextWeekly);
      dispatch({ type: 'WEEKLY_UPDATED', weekly: nextWeekly });
    }
    // 种子挑战局：记录该种子本地比分（最佳评分 + 享年 + 游玩次数）
    if (rt.seedChallenge && rt.shuffleSeed != null) {
      const nextScores = recordSeedScore(rt.seedScores, String(rt.shuffleSeed), score, rt.game.age);
      saveSeedScores(nextScores);
      dispatch({ type: 'SEED_SCORES_UPDATED', seedScores: nextScores });
    }
    // 每一生都入族谱（世代 = 族谱长度 + 1）；快速模拟/每日挑战带标记（auto 代不参与传承）；附带回顾数据供结算页回看
    const skippedTitles = [...new Set(rt.skippedEvents.map(e => e.title ?? e.id))];
    const nextFamily = appendFamilyMember(rt.family, rt.game, formatDate(new Date()), { auto: rt.autoPlay, daily: rt.isDaily, skippedTitles });
    saveFamily(nextFamily);
    dispatch({ type: 'FAMILY_UPDATED', family: nextFamily });
    dispatch({ type: 'ACHIEVEMENTS_PERSISTED' });
  }, [rt.achievementPending]);

  // 每次状态变化后持久化到 active 槽（标题页不写不删，保留存档供刷新后继续）；
  // 写入成功后同步回运行时状态（中途回标题时存档卡/覆盖确认读最新存档）
  useEffect(() => {
    const next = saveState(rt);
    if (next) {
      dispatch({ type: 'SAVES_UPDATED', saves: next });
    }
  }, [rt]);

  // 自动推进：快速模拟（到结算）或局内快进（到目标年龄）——随机选择并推进，避开致死选项
  useEffect(() => {
    if ((!rt.autoPlay && rt.fastForwardUntil == null) || rt.game.phase !== 'playing') {
      return;
    }
    const timer = setTimeout(() => {
      if (rt.feedback) {
        dispatch({ type: 'CONTINUE' });
      } else if (rt.currentEvent) {
        const choices = rt.currentEvent.choices;
        // 快速模拟避开致死选项（fatal flag：煤气/坠物/心梗等意外死亡留给手动玩家的真实选择——
        // 「30 秒看一生」的快速模拟体验不应被 21 岁煤气泄漏打断；有非致死选项时才避开）
        const fatalPool = choices.filter(c => (c.outcomes.flags ?? []).some(f => f.startsWith('fatal_')));
        const pool = fatalPool.length > 0 && fatalPool.length < choices.length
          ? choices.filter(c => !fatalPool.includes(c))
          : choices;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        dispatch({ type: 'MAKE_CHOICE', choice: pick, eventId: rt.currentEvent.id });
      }
    }, rt.feedback ? AUTO_PLAY_FEEDBACK_INTERVAL : AUTO_PLAY_INTERVAL);
    return () => clearTimeout(timer);
  }, [rt]);

  const startGame = useCallback((gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed, goal: GoalKey | CustomGoal | null, challenge: boolean = false, realMode: boolean = false, seed?: number | null, talents?: string[], alloc?: Partial<Attributes>, route?: string) => {
    // 埋点：开局（种子挑战 variant=seed，普通开局 variant=normal）
    track({ type: 'game_start', ts: Date.now(), variant: seed != null ? 'seed' : 'normal', pace: paceMode, challenge });
    dispatch({ type: 'START_GAME', gender, name, paceMode, typeSpeed, goal, challenge, realMode, seed: seed ?? undefined, talents, alloc, route });
  }, []);

  const startAutoGame = useCallback((gender: 'male' | 'female', name: string) => {
    // 埋点：快速模拟开局
    track({ type: 'game_start', ts: Date.now(), variant: 'auto', pace: 'lite', challenge: false });
    dispatch({ type: 'START_AUTO_GAME', gender, name });
  }, []);

  // 每日挑战：随机性别/名字 + 固定种子（今日日期哈希）手动开局，不写存档槽
  const startDailyGame = useCallback(() => {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    // 埋点：每日挑战开局
    track({ type: 'game_start', ts: Date.now(), variant: 'daily', pace: 'full', challenge: false });
    dispatch({
      type: 'START_GAME',
      gender,
      name: gender === 'male' ? '小明' : '小美',
      paceMode: 'full',
      typeSpeed: 'normal',
      goal: null,
      challenge: false,
      seed: dateToSeed(formatDate(new Date())),
      isDaily: true,
    });
  }, []);

  // 每周挑战：随机性别/名字 + 固定种子（本周日期哈希）手动开局，本周目标由周种子确定，不写存档槽
  const startWeeklyGame = useCallback(() => {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    // 埋点：每周挑战开局
    track({ type: 'game_start', ts: Date.now(), variant: 'weekly', pace: 'full', challenge: false });
    dispatch({
      type: 'START_GAME',
      gender,
      name: gender === 'male' ? '小明' : '小美',
      paceMode: 'full',
      typeSpeed: 'normal',
      goal: null,
      challenge: false,
      seed: weekSeed(weekOf(new Date())),
      isWeekly: true,
    });
  }, []);

  const restart = useCallback(() => {
    dispatch({ type: 'RESTART' });
  }, []);

  // 人生重开（第 6 周目起）：结算页携半身属性重新投胎
  const reincarnate = useCallback(() => {
    dispatch({ type: 'REINCARNATE' });
  }, []);

  const makeChoice = useCallback((choice: Choice) => {
    if (!rt.currentEvent) return;
    dispatch({ type: 'MAKE_CHOICE', choice, eventId: rt.currentEvent.id });
  }, [rt.currentEvent]);

  // 主动行为：局内发起活动（合法性由 reducer 校验，UI 置灰状态与之同源）
  const makeAction = useCallback((activityId: string) => {
    dispatch({ type: 'MAKE_ACTION', activityId });
  }, []);

  // 跳过剩余幼儿期：自动随机选择推进到 6 岁（幼儿期走过场的快进）
  const skipIntro = useCallback(() => {
    dispatch({ type: 'SKIP_INTRO' });
  }, []);

  // 快进到关键年龄：自动随机选择推进到目标岁后交还手动（目标年龄须大于当前）
  const fastForwardTo = useCallback((age: number) => {
    dispatch({ type: 'FAST_FORWARD_TO', age });
  }, []);

  // 后悔：回退上一步（栈空时 UI 不显示按钮，此处防御性兜底）
  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  // 后悔：回退到指定岁数（栈中最近一次 ≤ 目标岁的选择前状态）
  const undoToAge = useCallback((age: number) => {
    dispatch({ type: 'UNDO_TO_AGE', age });
  }, []);

  const continue_ = useCallback(() => {
    dispatch({ type: 'CONTINUE' });
  }, []);

  // 重置家族：清空族谱（家族面板「重置家族」入口；家族底蕴随族谱归零）
  const resetFamily = useCallback(() => {
    dispatch({ type: 'RESET_FAMILY' });
  }, []);

  const reset = useCallback(() => {
    // 埋点：中途放弃（未到结算回标题 = 流失点；结算后回标题 phase 已是 summary，不误记）
    trackAbandonIfPlaying(rt.game.phase, rt.game.age);
    dispatch({ type: 'RESET' });
  }, [rt.game.phase, rt.game.age]);

  const continueGame = useCallback((slot: number) => {
    dispatch({ type: 'CONTINUE_GAME', slot });
  }, []);

  // 选择存档槽位（空槽选中后下一局新人生保存到该槽）
  const selectSlot = useCallback((slot: number) => {
    dispatch({ type: 'SELECT_SLOT', slot });
  }, []);

  const setTypeSpeed = useCallback((typeSpeed: TypeSpeed) => {
    dispatch({ type: 'SET_TYPE_SPEED', typeSpeed });
  }, []);

  return {
    game: rt.game,
    currentEvent: rt.currentEvent,
    feedback: rt.feedback,
    skippedEvents: rt.skippedEvents,
    saves: rt.saves,
    autoPlay: rt.autoPlay,
    introAuto: rt.introAuto ?? false,
    typeSpeed: rt.typeSpeed,
    achievements: rt.achievements,
    stats: rt.stats,
    newAchievements: rt.pendingNewIds,
    fateEventIds: rt.fateEventIds,
    isDaily: rt.isDaily,
    isWeekly: rt.isWeekly,
    seedChallenge: rt.seedChallenge,
    weeklyGoal: rt.weeklyGoal,
    shuffleSeed: rt.shuffleSeed,
    daily: rt.daily,
    dailyHistory: rt.dailyHistory,
    dailyStreak: rt.dailyStreak,
    weekly: rt.weekly,
    seedScores: rt.seedScores,
    family: rt.family,
    fastForwardUntil: rt.fastForwardUntil ?? null,
    startGame,
    startAutoGame,
    startDailyGame,
    startWeeklyGame,
    restart,
    reincarnate,
    makeChoice,
    makeAction,
    skipIntro,
    fastForwardTo,
    undo,
    undoToAge,
    undoStack: rt.undoStack,
    continue: continue_,
    continueGame,
    selectSlot,
    reset,
    resetFamily,
    setTypeSpeed,
  };
}
