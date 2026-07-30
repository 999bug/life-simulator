import { useReducer, useCallback } from 'react';
import type { AttributeKey, Attributes, Choice, GameState, LifeEvent } from '../types';
import {
  createInitialState,
  applyOutcomes,
  applyElderDecay,
  getStageForAge,
  checkDeath,
  STAGE_ORDER,
  STAGE_META,
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
      const first = findFirstEvent(game);
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

      // 更新年龄
      let age = out.nextAge ?? state.game.age;
      let stage = getStageForAge(age);

      // 老年衰减
      if (age >= 65) {
        attrs = applyElderDecay(attrs);
      }

      // 死亡判断
      const isDead = checkDeath(age, attrs.health);

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
        age: isDead ? Math.min(age, 90) : age,
        stage,
        stageIdx: STAGE_ORDER.indexOf(stage),
        attributes: attrs,
        flags,
        history,
        phase: isDead ? 'summary' : 'playing',
      };

      // 构建反馈文本
      let fb = `你选择了「${choice.text}」`;
      const attrChanges: Partial<Attributes> = out.attr ?? {};
      const changedKeys = (Object.keys(attrChanges) as AttributeKey[]).filter(k => attrChanges[k] !== 0);
      if (changedKeys.length > 0) {
        fb += '\n\n' + changedKeys.map(k => {
          const v = attrChanges[k]!;
          return `${v > 0 ? '+' : ''}${v}`;
        }).join('  ');
      }

      // 找下一个事件
      let next: LifeEvent | null = null;
      let nextIdx = state.eventIndex;

      if (out.final || isDead) {
        next = null;
      } else if (out.nextEvent) {
        // 分支跳转
        const target = EVENTS.find(e => e.id === out.nextEvent);
        if (target) {
          next = target;
          nextIdx = EVENTS.indexOf(target);
        } else {
          next = findNextEvent(game, state.eventIndex);
          nextIdx = next ? EVENTS.indexOf(next) : state.eventIndex + 1;
        }
      } else {
        next = findNextEvent(game, state.eventIndex);
        nextIdx = next ? EVENTS.indexOf(next) : state.eventIndex + 1;
      }

      return { game, currentEvent: next, feedback: fb, eventIndex: nextIdx };
    }

    case 'CONTINUE': {
      if (state.game.phase === 'summary') return state;

      const next = findNextEvent(state.game, state.eventIndex);
      const nextIdx = next ? EVENTS.indexOf(next) : state.eventIndex + 1;

      return {
        ...state,
        currentEvent: next,
        feedback: null,
        eventIndex: nextIdx,
      };
    }

    case 'RESET':
      return createInitialRuntime();

    default:
      return state;
  }
}

// ============ 事件查找 ============

/** 找到初始事件 */
function findFirstEvent(game: GameState): LifeEvent | null {
  for (let i = 0; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    if (e.stage === game.stage && game.age >= e.age - 1 && game.age <= e.age + 1 && checkConditions(e, game)) {
      return e;
    }
  }
  return EVENTS[0] ?? null;
}

/** 找到下一个符合条件的候选事件 */
function findNextEvent(game: GameState, fromIndex: number): LifeEvent | null {
  // 从下一个位置开始扫描
  for (let i = fromIndex + 1; i < EVENTS.length; i++) {
    const e = EVENTS[i];
    // 阶段匹配 + 年龄在合理范围 + 满足条件
    if (e.stage === game.stage && game.age >= e.age - 2 && game.age <= e.age + 3 && checkConditions(e, game)) {
      return e;
    }
  }

  // 当前阶段没找到，推进到下一阶段
  const currentStageIdx = STAGE_ORDER.indexOf(game.stage);
  if (currentStageIdx < STAGE_ORDER.length - 1) {
    const nextStage = STAGE_ORDER[currentStageIdx + 1];
    const [nextMinAge] = STAGE_META[nextStage].range;
    // 更新游戏年龄到下一阶段起始
    game.age = Math.max(game.age, nextMinAge);
    game.stage = nextStage;
    game.stageIdx = currentStageIdx + 1;

    for (let i = 0; i < EVENTS.length; i++) {
      const e = EVENTS[i];
      if (e.stage === nextStage && checkConditions(e, game)) {
        return e;
      }
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
