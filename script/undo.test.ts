/**
 * 后悔回退（undo）与伴侣互动播放流集成测试。
 *
 * 运行：node --experimental-strip-types --test script/undo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { reducer, createInitialRuntime, UNDO_MAX, undoableAges, findUndoEntry } from '../src/hooks/useGame.ts';
import { buildCompanionEvent } from '../src/engine/companion.ts';
import type { Attributes, LifeEvent } from '../src/types/index.ts';

/** 构造测试事件 */
function evt(
  id: string, age: number, attrs: Partial<Attributes> = {},
  flags: string[] = [], conditions?: LifeEvent['conditions'],
): LifeEvent {
  return {
    id, stage: 'adult', age,
    title: id,
    text: `${id} 的叙事`,
    category: 'family',
    choices: [{
      text: '选择',
      effects: '',
      outcomes: { attr: attrs, ...(flags.length > 0 ? { flags } : {}) },
    }],
    conditions,
  };
}

/** 开局 + 连续选择，直到达到指定事件 */
function playTo(rt: ReturnType<typeof reducer>, targetId: string) {
  let guard = 0;
  while (rt.currentEvent && rt.currentEvent.id !== targetId && guard < 50) {
    rt = reducer(rt, { type: 'MAKE_CHOICE', choice: rt.currentEvent.choices[0], eventId: rt.currentEvent.id });
    guard++;
  }
  return rt;
}

test('UNDO：回退上一步恢复选择前状态（属性/事件/反馈/跳过）', () => {
  const events = [
    evt('a_01', 7, { intelligence: 5 }),
    evt('a_02', 7, { health: 3 }),
    evt('b_01', 8, { wealth: 4 }),
  ];
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, game: { ...rt.game, age: 7 }, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  // 第一次选择：智力 +5（初始智力 25）
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: events[0].choices[0], eventId: 'a_01' });
  assert.strictEqual(rt.game.attributes.intelligence, 30);
  assert.ok(rt.undoStack.length === 1, '选择后应有 1 步后悔记录');
  // 反馈页继续（真实流程：清反馈后到下一事件）
  rt = reducer(rt, { type: 'CONTINUE' });
  // 第二次选择：健康 +3（初始 65，7 岁上限 75 余量 10 < 过渡带 → 衰减为 +2 = 67）
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: events[1].choices[0], eventId: 'a_02' });
  assert.strictEqual(rt.game.attributes.health, 67);
  assert.strictEqual(rt.undoStack.length, 2);
  // 回退上一步：回到第二次选择前（智力已 +5、健康未 +3）
  const undone = reducer(rt, { type: 'UNDO' });
  assert.strictEqual(undone.game.attributes.health, 65);
  assert.strictEqual(undone.game.attributes.intelligence, 30);
  assert.strictEqual(undone.currentEvent?.id, 'a_02');
  assert.strictEqual(undone.feedback, null);
  assert.strictEqual(undone.undoStack.length, 1);
});

test('UNDO：栈空时原样返回', () => {
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, shuffledEvents: [evt('a_01', 7)], currentEvent: evt('a_01', 7), eventIndex: 0 };
  const before = rt;
  const after = reducer(rt, { type: 'UNDO' });
  assert.strictEqual(after, before);
});

test('UNDO 栈上限：超过 5 步裁掉最旧', () => {
  const events = Array.from({ length: 8 }, (_, i) => evt(`e_${i}`, 7 + i, { health: 1 }));
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  for (const e of events) {
    rt = reducer(rt, { type: 'MAKE_CHOICE', choice: e.choices[0], eventId: e.id });
  }
  assert.strictEqual(rt.undoStack.length, UNDO_MAX);
});

test('UNDO_TO_AGE：回退到最近一次 ≤ 目标岁的选择前状态', () => {
  const events = [
    evt('a_01', 10, { wealth: 1 }),
    evt('a_02', 10, { wealth: 1 }),
    evt('b_01', 20, { wealth: 1 }),
    evt('b_02', 20, { wealth: 1 }),
    evt('c_01', 30, { wealth: 1 }),
  ];
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, game: { ...rt.game, age: 10 }, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  for (const e of events) {
    rt = reducer(rt, { type: 'MAKE_CHOICE', choice: e.choices[0], eventId: e.id });
  }
  // 栈：e_00(10岁) e_01(10岁) e_02(20岁) e_03(20岁) e_04(30岁)
  assert.deepStrictEqual(undoableAges(rt.undoStack), [10, 20, 30]);
  assert.strictEqual(findUndoEntry(rt.undoStack, 15), 1, '目标 15 岁 → 最近 ≤15 的是第二个 10 岁条目');
  // 回退到 20 岁：最近 ≤20 是 e_03 前的状态（初始财富 20 + 10 岁两次 + 20 岁一次 = 23）
  const undone = reducer(rt, { type: 'UNDO_TO_AGE', age: 20 });
  assert.strictEqual(undone.game.attributes.wealth, 23);
  assert.strictEqual(undone.currentEvent?.id, 'b_02');
  // 弹掉的条目丢弃（不能再回退到 30 岁）
  assert.strictEqual(undone.undoStack.length, 3);
});

test('伴侣互动：married 后到达互动年龄插入 love 事件，选择后推进 4 岁', () => {
  // 24 岁结婚（产出 married），25 岁正常事件流
  const events = [
    evt('marry', 24, {}, ['married']),
    evt('n_25', 25, { wealth: 2 }),
    evt('n_29', 29, { wealth: 2 }),
  ];
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'female', name: '小美', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  // 结婚（产出 married）
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: events[0].choices[0], eventId: 'marry' });
  assert.ok(rt.game.flags.includes('married'));
  // 25 岁事件前应先播伴侣互动（love 分类、年龄 25）
  assert.strictEqual(rt.currentEvent?.id, 'companion_01');
  assert.strictEqual(rt.currentEvent?.age, 25);
  assert.strictEqual(rt.currentEvent?.category, 'love');
  // 选择伴侣互动 → 推进到 26 岁？不——下一个是 25 岁正常事件（年龄不跳）
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: rt.currentEvent.choices[0], eventId: rt.currentEvent.id });
  assert.strictEqual(rt.currentEvent?.id, 'n_25');
  assert.strictEqual(rt.currentEvent?.age, 25);
  // 25 岁事件后：29 岁事件前再插入 29 岁伴侣互动
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: rt.currentEvent.choices[0], eventId: 'n_25' });
  assert.strictEqual(rt.currentEvent?.id, 'companion_02');
  assert.strictEqual(rt.currentEvent?.age, 29);
});

test('伴侣互动：未结婚不插入', () => {
  const events = [evt('n_25', 25, { wealth: 2 })];
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: events[0].choices[0], eventId: 'n_25' });
  assert.ok(!rt.currentEvent?.id.startsWith('companion_'), '未婚不插入伴侣互动');
  assert.strictEqual(rt.currentEvent, null);
});

test('伴侣互动：undo 栈在互动期间正常记录（可回退互动选择）', () => {
  const events = [evt('marry', 24, {}, ['married']), evt('n_25', 25, { wealth: 2 })];
  let rt = reducer(createInitialRuntime(), { type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null });
  rt = { ...rt, shuffledEvents: events, currentEvent: events[0], eventIndex: 0 };
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: events[0].choices[0], eventId: 'marry' });
  rt = reducer(rt, { type: 'MAKE_CHOICE', choice: rt.currentEvent!.choices[0], eventId: rt.currentEvent!.id });
  // 选择伴侣互动后回退 → 回到互动前（伴侣互动未选）
  const undone = reducer(rt, { type: 'UNDO' });
  assert.strictEqual(undone.currentEvent?.id, 'companion_01');
  assert.strictEqual(undone.game.history.length, 1);
});
