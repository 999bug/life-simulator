import { useReducer, useCallback } from 'react';
import type { AttributeKey, Attributes, Choice, GameState, LifeEvent } from '../types';
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
import EVENTS from '../engine/events';

// ============ Action 类型 ============
type Action =
  | { type: 'START_GAME'; gender: 'male' | 'female'; name: string }
  | { type: 'MAKE_CHOICE'; choice: Choice; eventId: string }
  | { type: 'CONTINUE' }
  | { type: 'RESET' };

// ============ 运行时状态（不参与 React 渲染）============
interface RuntimeState {
  game: GameState;
  currentEvent: LifeEvent | null;
  feedback: string | null;
  eventIndex: number;       // 当前事件在 EVENTS 数组中的位置
}

// ============ Reducer ============
function reducer(state: RuntimeState, action: Action): RuntimeState {
  switch (action.type) {
    case 'START_GAME': {
      const game = createInitialState(action.gender, action.name);
      const first = EVENTS.find(e => checkConditions(e, game)) ?? null;
      if (first) {
        game.age = first.age;
        game.stage = getStageForAge(first.age);
        game.stageIdx = STAGE_ORDER.indexOf(game.stage);
      }
      return { game, currentEvent: first, feedback: null, eventIndex: first ? EVENTS.indexOf(first) : 0 };
    }

    case 'MAKE_CHOICE': {
      const { choice, eventId } = action;
      const out = choice.outcomes;

      // 更新属性
      let attrs = applyOutcomes(state.game.attributes, out);

      // 更新标记
      const flags = [...state.game.flags];
      if (out.flags) {
        out.flags.forEach(f => { if (!flags.includes(f)) flags.push(f); });
      }

      // 基于更新后的属性/标记，线性扫描下一个满足条件的事件
      const next = findNextEvent({ ...state.game, attributes: attrs, flags }, state.eventIndex);

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
        phase: gameOver ? 'summary' : 'playing',
      };

      // 构建反馈文本
      let fb = `你选择了「${choice.text}」`;
      const attrChanges: Partial<Attributes> = out.attr ?? {};
      const changedKeys = (Object.keys(attrChanges) as AttributeKey[]).filter(k => attrChanges[k] !== 0);
      if (changedKeys.length > 0) {
        // 反馈展示实际生效值（含收益递减），与属性面板变化一致
        fb += '\n\n' + changedKeys.map(k => {
          const v = effectiveDelta(k, attrChanges[k]!, state.game.attributes);
          return `${v > 0 ? '+' : ''}${v}`;
        }).join('  ');
      }

      return {
        game,
        currentEvent: gameOver ? null : next,
        feedback: fb,
        eventIndex: next ? EVENTS.indexOf(next) : state.eventIndex,
      };
    }

    case 'CONTINUE': {
      // MAKE_CHOICE 已预载下一个事件，这里只清反馈
      return { ...state, feedback: null };
    }

    case 'RESET':
      return createInitialRuntime();

    default:
      return state;
  }
}

// ============ 事件查找 ============

/** 从 fromIndex 之后线性扫描第一个满足条件的事件 */
function findNextEvent(game: GameState, fromIndex: number): LifeEvent | null {
  for (let i = fromIndex + 1; i < EVENTS.length; i++) {
    if (checkConditions(EVENTS[i], game)) {
      return EVENTS[i];
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
      attributes: { health: 80, intelligence: 30, wealth: 20, happiness: 70, social: 20, appearance: 50, luck: 50, morality: 50 },
      flags: [], history: [], phase: 'title',
    },
    currentEvent: null, feedback: null, eventIndex: 0,
  };
}

// ============ Hook ============
export function useGame() {
  const [rt, dispatch] = useReducer(reducer, null, createInitialRuntime);

  const startGame = useCallback((gender: 'male' | 'female', name: string) => {
    dispatch({ type: 'START_GAME', gender, name });
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

  return {
    game: rt.game,
    currentEvent: rt.currentEvent,
    feedback: rt.feedback,
    startGame,
    makeChoice,
    continue: continue_,
    reset,
  };
}
