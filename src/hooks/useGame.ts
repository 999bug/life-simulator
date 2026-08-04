import { useReducer, useCallback, useEffect } from 'react';
import type { AttributeKey, Attributes, Choice, DeathCause, GameState, LifeEvent, PaceMode, TypeSpeed } from '../types';
import { emptySaves, migrateLegacySave, SLOT_COUNT, type SavesV2 } from '../engine/save';
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

// ============ Action 类型 ============
type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string; paceMode: PaceMode; typeSpeed: TypeSpeed }
  | { type: 'START_AUTO_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'CONTINUE' }
  | { type: 'SET_TYPE_SPEED'; typeSpeed: TypeSpeed }
  | { type: 'RESET' }
  | { type: 'CONTINUE_GAME'; slot: number }
  | { type: 'HYDRATE_SAVES'; saves: SavesV2 };

// ============ 运行时状态（不参与 React 渲染）============
interface RuntimeState {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  eventIndex: number;       // 当前事件在 shuffledEvents 数组中的位置
  /** 本局事件顺序（同岁组内按种子洗牌，重开一局顺序不同） */
  shuffledEvents: LifeEvent[];
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
        return data;
      }
    }
    // 旧版单槽存档迁移
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacy) {
      const migrated = migrateLegacySave(legacy);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      saveSaves(migrated);
      return migrated;
    }
  } catch {
    // 存储不可用时静默降级为空结构
  }
  return emptySaves();
}

/** 持久化 v2 存档 */
function saveSaves(saves: SavesV2): void {
  try {
    localStorage.setItem(SAVE_KEY_V2, JSON.stringify(saves));
  } catch {
    // 存储不可用（隐私模式/满额）时静默降级为不保存
  }
}

/** 持久化当前状态到 active 槽；标题页状态（新游戏未开始）时不写不删 */
function saveState(rt: RuntimeState): void {
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
      // 新一局：随机种子洗牌，同岁组顺序每局不同（重玩性）
      const shuffleSeed = Math.floor(Math.random() * 2 ** 31);
      // 快速模拟固定全量事件；手动模式按所选密度档过滤
      const paceMode = action.type === 'START_AUTO_GAME' ? 'full' : action.paceMode;
      const shuffledEvents = shuffleEvents(filterEvents(EVENTS, paceMode, shuffleSeed), shuffleSeed);
      const first = shuffledEvents.find(e => checkConditions(e, game)) ?? null;
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
        shuffleSeed,
        autoPlay: action.type === 'START_AUTO_GAME',
        paceMode,
        typeSpeed: action.type === 'START_AUTO_GAME' ? 'normal' : action.typeSpeed,
        saves: state.saves,
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
      const next = findNextEvent({ ...state.game, attributes: attrs, flags }, state.eventIndex, state.shuffledEvents);

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

      return {
        game,
        currentEvent: gameOver ? null : next,
        feedback: fb,
        eventIndex: next ? state.shuffledEvents.indexOf(next) : state.eventIndex,
        shuffledEvents: state.shuffledEvents,
        shuffleSeed: state.shuffleSeed,
        autoPlay: state.autoPlay,
        paceMode: state.paceMode,
        typeSpeed: state.typeSpeed,
        saves: state.saves,
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
      // 重新开始 = 放弃上一局：仅清除当前 active 槽，保留其他槽位
      const slots = [...state.saves.slots];
      slots[state.saves.active] = null;
      const saves = { active: state.saves.active, slots };
      saveSaves(saves);
      // 快速模拟模式随重新开始退出；标题页状态下 saveState 不写不删
      return { ...createInitialRuntime(), saves };
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
        shuffleSeed,
        shuffledEvents,
        autoPlay: false,
        paceMode,
        typeSpeed,
        saves,
      };
    }

    case 'HYDRATE_SAVES':
      return { ...state, saves: action.saves };

    default:
      return state;
  }
}

// ============ 事件查找 ============

/** 从 fromIndex 之后线性扫描第一个满足条件的事件（在洗牌后的顺序上查找） */
function findNextEvent(game: GameState, fromIndex: number, events: LifeEvent[]): LifeEvent | null {
  for (let i = fromIndex + 1; i < events.length; i++) {
    if (checkConditions(events[i], game)) {
      return events[i];
    }
  }
  return null;
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
      flags: [], history: [], phase: 'title', deathCause: null,
    },
    currentEvent: null, feedback: null, eventIndex: 0,
    shuffledEvents: EVENTS,
    shuffleSeed: 0,
    autoPlay: false,
    paceMode: 'full',
    typeSpeed: 'normal',
    saves: emptySaves(),
  };
}

// ============ Hook ============

/** 快速模拟：事件推进间隔（毫秒） */
const AUTO_PLAY_INTERVAL = 220;
/** 快速模拟：反馈页跳过间隔（毫秒） */
const AUTO_PLAY_FEEDBACK_INTERVAL = 50;

export function useGame() {
  const [rt, dispatch] = useReducer(reducer, null, createInitialRuntime);

  // 挂载时一次性读取/迁移存档（迁移有 localStorage 写入副作用，只跑一次）
  useEffect(() => {
    dispatch({ type: 'HYDRATE_SAVES', saves: loadSaves() });
  }, []);

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

  // 标题页是否有可继续的存档（HYDRATE_SAVES 后生效）
  const hasSave = rt.saves.slots.some(s => s !== null);

  const startGame = useCallback((gender: 'male' | 'female', name: string, paceMode: PaceMode, typeSpeed: TypeSpeed) => {
    dispatch({ type: 'START_GAME', gender, name, paceMode, typeSpeed });
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
    hasSave,
    saves: rt.saves,
    activeSlot: rt.saves.active,
    autoPlay: rt.autoPlay,
    typeSpeed: rt.typeSpeed,
    startGame,
    startAutoGame,
    makeChoice,
    continue: continue_,
    continueGame,
    reset,
    setTypeSpeed,
  };
}
