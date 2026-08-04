import { useReducer, useCallback, useEffect } from 'react';
import type { AchievementId, AttributeKey, Attributes, Choice, DeathCause, GameState, GoalKey, LifeEvent, PaceMode, TypeSpeed } from '../types';
import { emptySaves, isValidSaveData, migrateLegacySave, SLOT_COUNT, type SavesV2 } from '../engine/save';
import { checkAchievements } from '../engine/achievements';
import {
  createInitialState,
  applyOutcomes,
  applyElderDecay,
  getStageForAge,
  checkDeath,
  calcMaxAge,
  effectiveDelta,
  ensureInt,
  STAGE_ORDER,
} from '../engine/state';
import EVENTS, { filterEvents, shuffleEvents } from '../engine/events';

// ============ 成就存储 ============

/** 成就存储 key（跨周目） */
const ACHIEVEMENTS_KEY = 'life-sim-achievements';

/** 成就存储结构 */
interface AchievementStore {
  unlocked: AchievementId[];
  completedLives: number;
}

/** 读取成就存储；数据损坏或存储不可用时返回空结构 */
function loadAchievements(): AchievementStore {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as AchievementStore;
      if (data && Array.isArray(data.unlocked) && typeof data.completedLives === 'number') {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { unlocked: [], completedLives: 0 };
}

/** 持久化成就存储；存储不可用时静默降级 */
function saveAchievements(store: AchievementStore): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(store));
  } catch {
    // 存储不可用静默降级
  }
}

// ============ Action 类型 ============
type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed; goal: GoalKey | null }
  | { type: 'START_AUTO_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'CONTINUE' }
  | { type: 'SET_TYPE_SPEED'; typeSpeed: TypeSpeed }
  | { type: 'RESET' }
  | { type: 'CONTINUE_GAME'; slot: number }
  | { type: 'HYDRATE_SAVES'; saves: SavesV2; achievements: AchievementStore }
  | { type: 'ACHIEVEMENTS_PERSISTED' };

// ============ 运行时状态（不参与 React 渲染）============
interface RuntimeState {
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
  /** 进入结算但尚未写入成就存储（pending 标志只由 MAKE_CHOICE 的 gameOver 置位，读档恢复不触发） */
  achievementPending: boolean;
  /** 本局新解锁成就（判定后暂存，供结算页展示，不进 GameState） */
  pendingNewIds: AchievementId[];
  /** 本局结算后的累计完成局数（待写入存储） */
  pendingLives: number;
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
  // 快速模拟为临时局：不写入存档槽位（避免静默覆盖正式存档）
  if (rt.autoPlay) {
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
  };
  saveSaves(saves);
}

// ============ Reducer ============
function reducer(state: RuntimeState, action: Action): RuntimeState {
  switch (action.type) {
    case 'START_GAME':
    case 'START_AUTO_GAME': {
      const game = createInitialState(action.gender, action.name);
      // 人生目标仅手动开局可选；快速模拟无目标
      game.goal = action.type === 'START_GAME' ? action.goal : null;
      // 新一局：随机种子洗牌，同岁组顺序每局不同（重玩性）
      const shuffleSeed = Math.floor(Math.random() * 2 ** 31);
      // 快速模拟固定全量事件；手动模式按所选密度档过滤
      const paceMode = action.type === 'START_AUTO_GAME' ? 'full' : action.paceMode;
      const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed), shuffleSeed);
      const firstScan = findNextEvent(game, -1, shuffledEvents);
      const first = firstScan.event;
      if (first) {
        game.age = first.age;
        game.stage = getStageForAge(first.age);
        game.stageIdx = STAGE_ORDER.indexOf(game.stage);
      }
      return {
        game,
        currentEvent: first,
        feedback: null,
        eventIndex: first ? shuffledEvents.indexOf(first) : 0,
        shuffledEvents,
        skippedEvents: firstScan.skipped,
        shuffleSeed,
        autoPlay: action.type === 'START_AUTO_GAME',
        paceMode,
        typeSpeed: action.type === 'START_AUTO_GAME' ? 'normal' : action.typeSpeed,
        saves: state.saves,
        achievements: state.achievements,
        achievementPending: false,
        pendingNewIds: [],
        pendingLives: 0,
      };
    }

    case 'MAKE_CHOICE': {
      const { choice, eventId } = action;
      const out = choice.outcomes;

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
      };

      // 构建反馈文本
      let fb = `你选择了「${choice.text}」`;
      const attrChanges: Partial<Attributes> = out.attr ?? {};
      const changedKeys = (Object.keys(attrChanges) as AttributeKey[]).filter(k => attrChanges[k] !== 0);
      if (changedKeys.length > 0) {
        // 反馈展示实际生效值（含年龄上限收益递减），与属性面板变化一致
        fb += '\n\n' + changedKeys.map(k => {
          const v = effectiveDelta(k, attrChanges[k]!, state.game.attributes, state.game.age);
          return `${v > 0 ? '+' : ''}${v}`;
        }).join('  ');
      }

      // 进入结算：判定本局新解锁成就（纯计算，持久化由 effect 完成）
      const newIds = gameOver
        ? checkAchievements({
            game,
            completedLives: state.achievements.completedLives + 1,
            wasLite: state.paceMode === 'lite',
            wasAuto: state.autoPlay,
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
        achievementPending: gameOver,
        pendingNewIds: newIds,
        pendingLives: gameOver ? state.achievements.completedLives + 1 : 0,
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
        achievementPending: false,
        pendingNewIds: [],
        pendingLives: 0,
      };
    }

    case 'HYDRATE_SAVES':
      // 存档与成就存储一并水合（成就跨周目，从 localStorage 载入）
      return { ...state, saves: action.saves, achievements: action.achievements };

    case 'ACHIEVEMENTS_PERSISTED': {
      // 成就已写入 localStorage，清除 pending 标志；pendingNewIds 保留到下一局开始（结算页持续展示新解锁）
      return { ...state, achievementPending: false, pendingLives: 0 };
    }

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

function createInitialRuntime(): RuntimeState {
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
    achievementPending: false,
    pendingNewIds: [],
    pendingLives: 0,
  };
}

// ============ Hook ============

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

  // 结算成就持久化（pending 标志只由 MAKE_CHOICE 的 gameOver 置位，读档恢复到 summary 不会触发）
  useEffect(() => {
    if (!rt.achievementPending) {
      return;
    }
    saveAchievements({
      unlocked: [...new Set([...rt.achievements.unlocked, ...rt.pendingNewIds])],
      completedLives: rt.pendingLives,
    });
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

  const startGame = useCallback((gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed, goal: GoalKey | null) => {
    dispatch({ type: 'START_GAME', gender, name, paceMode, typeSpeed, goal });
  }, []);

  const startAutoGame = useCallback((gender: 'male' | 'female', name: string) => {
    dispatch({ type: 'START_AUTO_GAME', gender, name });
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
    newAchievements: rt.pendingNewIds,
    startGame,
    startAutoGame,
    makeChoice,
    continue: continue_,
    continueGame,
    reset,
    setTypeSpeed,
  };
}
