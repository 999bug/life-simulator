import { useReducer, useCallback, useEffect } from 'react';
import type { AchievementId, AttributeKey, Attributes, Choice, CustomGoal, DeathCause, FamilyMember, GameState, GoalKey, LifeEvent, PaceMode, TypeSpeed } from '../types/index.ts';
import { emptySaves, isValidSaveData, migrateLegacySave, SLOT_COUNT, type SavesV2 } from '../engine/save.ts';
import { checkAchievements } from '../engine/achievements.ts';
import { verdictKey } from '../engine/verdict.ts';
import { appendFamilyMember, loadFamily, parentFlag, saveFamily } from '../engine/family.ts';
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
  STAGE_ORDER,
} from '../engine/state.ts';
import EVENTS, { filterEvents, shuffleEvents, pickFateEvents } from '../engine/events.ts';

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

// ============ Action 类型 ============
export type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed; goal: GoalKey | CustomGoal | null; challenge: boolean; realMode?: boolean; seed?: number; isDaily?: boolean }
  | { type: 'START_AUTO_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'RESTART' }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'CONTINUE' }
  | { type: 'SET_TYPE_SPEED'; typeSpeed: TypeSpeed }
  | { type: 'RESET' }
  | { type: 'CONTINUE_GAME'; slot: number }
  | { type: 'HYDRATE_SAVES'; saves: SavesV2; achievements: AchievementStore }
  | { type: 'ACHIEVEMENTS_PERSISTED' }
  | { type: 'DAILY_UPDATED'; daily: DailyStore }
  | { type: 'FAMILY_UPDATED'; family: FamilyMember[] };

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
  /** 每日挑战记录（今日最佳；标题页展示） */
  daily: DailyStore;
  /** 家族族谱（跨周目；结算时正常局追加一代，快速模拟/每日挑战不写入） */
  family: FamilyMember[];
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
function saveState(rt: RuntimeState): void {
  // 快速模拟与每日挑战为临时局：不写入存档槽位（避免静默覆盖正式存档）
  if (rt.autoPlay || rt.isDaily) {
    return;
  }
  if (!rt.game || rt.game.phase === 'title') {
    return;
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
  };
  saveSaves(saves);
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
}

/**
 * 开局初始化：新状态 + 洗牌 + 首事件预载 + 命运事件抽取。
 * 新一局随机种子洗牌，同岁组顺序每局不同（重玩性）。
 */
function startNewGame(state: RuntimeState, p: StartParams): RuntimeState {
  const game = createInitialState(p.gender, p.name);
  game.goal = p.goal;
  // 属性传承（第 5 周目起）：上一世终局最高 2 项属性各 +8（先继承）
  if (state.stats.lastEndAttrs) {
    game.attributes = applyInheritance(game.attributes, state.stats.lastEndAttrs);
    game.inherited = true;
  }
  // 挑战开局（第 2 周目解锁）：属性整体下调 10 点（与传承独立叠加，后挑战）
  game.challenge = p.challenge;
  if (game.challenge) {
    game.attributes = applyChallenge(game.attributes);
  }
  // 真实模式（第 2 周目解锁）：选项只显示属性倾向箭头
  game.realMode = p.realMode ?? false;
  // 跨代继承：族谱非空时按上一代结局路线注入 parent_ flag（童年继承事件消费）
  const pf = parentFlag(state.family);
  if (pf) {
    game.flags.push(pf);
  }
  const shuffleSeed = p.seed ?? Math.floor(Math.random() * 2 ** 31);
  // 快速模拟用精简档（每岁 1-2 个）；手动模式按所选密度档过滤
  const shuffledEvents = shuffleEvents(filterEvents(EVENTS, p.paceMode, shuffleSeed), shuffleSeed);
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
  return {
    game,
    currentEvent: first,
    feedback: null,
    eventIndex: first ? shuffledEvents.indexOf(first) : 0,
    shuffledEvents,
    skippedEvents: firstScan.skipped,
    shuffleSeed,
    autoPlay: p.autoPlay,
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
    daily: state.daily,
    family: state.family,
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

    case 'RESTART': {
      // 局中重开：沿用本局角色与设置，换新随机种子洗牌（每日挑战局保持固定种子，同日重试同一序列）
      return startNewGame(state, {
        gender: state.game.gender,
        name: state.game.name,
        paceMode: state.paceMode,
        typeSpeed: state.typeSpeed,
        goal: state.game.goal,
        challenge: state.game.challenge ?? false,
        realMode: state.game.realMode ?? false,
        seed: state.isDaily ? state.shuffleSeed : undefined,
        autoPlay: false,
        isDaily: state.isDaily,
      });
    }

    case 'MAKE_CHOICE': {
      const { choice, eventId } = action;
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

      // 基于更新后的属性/标记，线性扫描下一个满足条件的事件
      const nextScan = findNextEvent({ ...state.game, attributes: attrs, flags }, state.eventIndex, state.shuffledEvents);
      const next = nextScan.event;

      // 年龄由下一个事件驱动；没有下一个事件说明全部播完
      const age = next ? next.age : state.game.age;
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

      // 死因：健康归零 → 耗尽；超过寿命或事件播完 → 寿终
      const deathCause: DeathCause | null = isDead
        ? (attrs.health <= 0 ? 'health' : 'lifespan')
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

      // 进入结算：判定本局新解锁成就（纯计算，持久化由 effect 完成）
      const newIds = gameOver
        ? checkAchievements({
            game,
            completedLives: state.achievements.completedLives + 1,
            wasLite: state.paceMode === 'lite',
            wasAuto: state.autoPlay,
            // 累计结局数（含本局）：已有集合 + 本局结局若为新则 +1
            endingsCount: state.achievements.endings.length + (state.achievements.endings.includes(endingKey) ? 0 : 1),
          }).filter(id => !state.achievements.unlocked.includes(id))
        : [];

      return {
        game,
        currentEvent: gameOver ? null : next,
        feedback: fb,
        eventIndex: next ? state.shuffledEvents.indexOf(next) : state.eventIndex,
        skippedEvents: [...state.skippedEvents, ...nextScan.skipped],
        shuffledEvents: state.shuffledEvents,
        shuffleSeed: state.shuffleSeed,
        autoPlay: state.autoPlay,
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
        daily: state.daily,
        family: state.family,
      };
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
      const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed), shuffleSeed);
      const currentEvent = saved.currentEventId
        ? shuffledEvents.find(e => e.id === saved.currentEventId) ?? null
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
        daily: state.daily,
        family: state.family,
      };
    }

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

    case 'FAMILY_UPDATED':
      // 族谱已写入 localStorage，更新运行时族谱（标题页族谱展示）
      return { ...state, family: action.family };

    default:
      return state;
  }
}

// ============ 事件查找 ============

/** 从 fromIndex 之后线性扫描：返回第一个满足条件的事件与扫描中跳过的所有事件（条件不满足） */
function findNextEvent(game: GameState, fromIndex: number, events: LifeEvent[]): { event: LifeEvent | null; skipped: LifeEvent[] } {
  const skipped: LifeEvent[] = [];
  for (let i = fromIndex + 1; i < events.length; i++) {
    if (checkConditions(events[i], game)) {
      return { event: events[i], skipped };
    }
    skipped.push(events[i]);
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
    // 每日挑战记录初始同步读取
    daily: loadDaily(),
    // 族谱同样初始同步读取
    family: loadFamily(),
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
    });
    // 每日挑战局：结算仅更新今日最佳（跨天则以本局初始化今日记录）
    if (rt.isDaily) {
      const nextDaily = updateDailyBest(rt.daily, formatDate(new Date()), score, rt.game.age);
      saveDaily(nextDaily);
      dispatch({ type: 'DAILY_UPDATED', daily: nextDaily });
    }
    // 正常局（非快速模拟/每日挑战）：本局角色写入族谱，世代 = 族谱长度 + 1
    if (!rt.isDaily && !rt.autoPlay) {
      const nextFamily = appendFamilyMember(rt.family, rt.game, formatDate(new Date()));
      saveFamily(nextFamily);
      dispatch({ type: 'FAMILY_UPDATED', family: nextFamily });
    }
    dispatch({ type: 'ACHIEVEMENTS_PERSISTED' });
  }, [rt.achievementPending]);

  // 每次状态变化后持久化到 active 槽（标题页不写不删，保留存档供刷新后继续）
  useEffect(() => {
    saveState(rt);
  }, [rt]);

  // 快速模拟：自动随机选择并推进，直到结算
  useEffect(() => {
    if (!rt.autoPlay || rt.game.phase !== 'playing') {
      return;
    }
    const timer = setTimeout(() => {
      if (rt.feedback) {
        dispatch({ type: 'CONTINUE' });
      } else if (rt.currentEvent) {
        const choices = rt.currentEvent.choices;
        const pick = choices[Math.floor(Math.random() * choices.length)];
        dispatch({ type: 'MAKE_CHOICE', choice: pick, eventId: rt.currentEvent.id });
      }
    }, rt.feedback ? AUTO_PLAY_FEEDBACK_INTERVAL : AUTO_PLAY_INTERVAL);
    return () => clearTimeout(timer);
  }, [rt]);

  const startGame = useCallback((gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed, goal: GoalKey | CustomGoal | null, challenge: boolean = false, realMode: boolean = false) => {
    dispatch({ type: 'START_GAME', gender, name, paceMode, typeSpeed, goal, challenge, realMode });
  }, []);

  const startAutoGame = useCallback((gender: 'male' | 'female', name: string) => {
    dispatch({ type: 'START_AUTO_GAME', gender, name });
  }, []);

  // 每日挑战：随机性别/名字 + 固定种子（今日日期哈希）手动开局，不写存档槽
  const startDailyGame = useCallback(() => {
    const gender = Math.random() < 0.5 ? 'male' : 'female';
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

  const restart = useCallback(() => {
    dispatch({ type: 'RESTART' });
  }, []);

  const makeChoice = useCallback((choice: Choice) => {
    if (!rt.currentEvent) return;
    dispatch({ type: 'MAKE_CHOICE', choice, eventId: rt.currentEvent.id });
  }, [rt.currentEvent]);

  const continue_ = useCallback(() => {
    dispatch({ type: 'CONTINUE' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const continueGame = useCallback((slot: number) => {
    dispatch({ type: 'CONTINUE_GAME', slot });
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
    typeSpeed: rt.typeSpeed,
    achievements: rt.achievements,
    stats: rt.stats,
    newAchievements: rt.pendingNewIds,
    fateEventIds: rt.fateEventIds,
    isDaily: rt.isDaily,
    daily: rt.daily,
    family: rt.family,
    startGame,
    startAutoGame,
    startDailyGame,
    restart,
    makeChoice,
    continue: continue_,
    continueGame,
    reset,
    setTypeSpeed,
  };
}
