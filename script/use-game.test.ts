/**
 * useGame reducer 核心流测试（开局/选择/快照/死亡/跳过收集/读档兜底）。
 *
 * 运行：node --experimental-strip-types --test script/use-game.test.ts
 * 说明：reducer 为纯函数（localStorage 读写仅发生在 createInitialRuntime/effect，
 * node 下 localStorage 未定义由 try/catch 兜底为空结构），可用自制事件数组做确定性断言。
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { reducer, createInitialRuntime } from '../src/hooks/useGame.ts';
import { getStageForAge, STAGE_ORDER } from '../src/engine/state.ts';
import type { Attributes, LifeEvent, RuntimeState } from '../src/types/index.ts';

// RuntimeState 从 useGame 导出，此处类型引用
import type { RuntimeState as Rt } from '../src/hooks/useGame.ts';

/** 构造测试事件 */
function evt(
  id: string, age: number, attrs: Partial<Attributes> = {},
  flags: string[] = [], conditions?: LifeEvent['conditions'],
): LifeEvent {
  return {
    id,
    stage: getStageForAge(age),
    age,
    text: `事件 ${id}`,
    choices: [{ text: '选择', effects: '', outcomes: { attr: attrs, flags } }],
    conditions,
  };
}

/** 构造进行中的运行时状态（覆盖为自制事件数组） */
function mkState(events: LifeEvent[], attrs: Partial<Attributes> = {}): Rt {
  const base = createInitialRuntime();
  const first = events[0];
  const attributes: Attributes = {
    health: 65, intelligence: 25, wealth: 20, happiness: 60,
    social: 25, appearance: 45, luck: 50, morality: 45, ...attrs,
  };
  const stage = getStageForAge(first.age);
  return {
    ...base,
    shuffledEvents: events,
    eventIndex: 0,
    currentEvent: first,
    game: {
      ...base.game,
      age: first.age, stage, stageIdx: STAGE_ORDER.indexOf(stage),
      attributes, phase: 'playing',
      // 与 START_GAME 一致：初始快照（首事件年龄 + 开局属性）
      snapshots: [{ age: first.age, attrs: attributes }],
    },
  };
}

/** 对当前事件做一次选择（取第一个选项） */
function choose(rt: Rt): Rt {
  const e = rt.currentEvent!;
  return reducer(rt, { type: 'MAKE_CHOICE', choice: e.choices[0], eventId: e.id });
}

test('START_GAME：初始快照 + 事件预载 + 参数生效', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'fast', goal: 'wealth',
  });
  assert.strictEqual(rt.game.phase, 'playing');
  assert.strictEqual(rt.game.goal, 'wealth');
  assert.strictEqual(rt.paceMode, 'full');
  assert.strictEqual(rt.typeSpeed, 'fast');
  assert.ok(rt.currentEvent, '应预载首事件');
  // 初始快照：首事件年龄 + 初始属性
  assert.strictEqual(rt.game.snapshots!.length, 1);
  assert.strictEqual(rt.game.snapshots![0].age, rt.game.age);
  assert.strictEqual(rt.game.snapshots![0].attrs.health, 65);
});

test('START_AUTO_GAME：固定全量 + 中速 + 无目标', () => {
  const rt = reducer(createInitialRuntime(), { type: 'START_AUTO_GAME', gender: 'female', name: '小美' });
  assert.strictEqual(rt.autoPlay, true);
  assert.strictEqual(rt.paceMode, 'full');
  assert.strictEqual(rt.typeSpeed, 'normal');
  assert.strictEqual(rt.game.goal, null);
});

test('MAKE_CHOICE：同岁连续不重复快照，进入新岁追加', () => {
  const events = [
    evt('a_01', 7, { intelligence: 5 }),
    evt('a_02', 7, { health: 3 }),
    evt('b_01', 8, { wealth: 4 }),
  ];
  let rt = mkState(events);
  // 7 岁第一个事件：属性应用 + 同岁不记录快照
  rt = choose(rt);
  assert.strictEqual(rt.game.attributes.intelligence, 30);
  assert.strictEqual(rt.game.snapshots!.length, 1);
  assert.ok(rt.feedback!.startsWith('你选择了「选择」'));
  // 7 岁第二个事件：next 为 8 岁 → 记录 8 岁快照（8 岁起点 = 7 岁末状态）
  rt = choose(rt);
  assert.strictEqual(rt.game.snapshots!.length, 2);
  assert.strictEqual(rt.game.snapshots![1].age, 8);
  // 进入 8 岁事件后播完 → 终局同岁替换该岁条目（仍 2 条）
  rt = choose(rt);
  assert.strictEqual(rt.game.snapshots!.length, 2);
  assert.strictEqual(rt.game.snapshots![1].age, 8);
  // 8 岁财富上限 33，20 距上限 13 < 过渡带 15 → 4×13/15 衰减为 3
  assert.strictEqual(rt.game.snapshots![1].attrs.wealth, 23);
  // 播完 → 结算（8 岁是最后事件）
  assert.strictEqual(rt.game.phase, 'summary');
  assert.strictEqual(rt.game.deathCause, 'lifespan');
});

test('MAKE_CHOICE：健康归零死亡 → 死因/结算标志/快照替换', () => {
  const events = [
    evt('a_01', 7, { happiness: 1 }),
    evt('b_01', 95, {}),
  ];
  let rt = mkState(events, { health: 1 });
  // 7 岁事件后 next 为 95 岁：按 next 年龄先应用老年衰减 health 1-1=0 → 死亡
  rt = choose(rt);
  assert.strictEqual(rt.game.phase, 'summary');
  assert.strictEqual(rt.game.deathCause, 'health');
  assert.strictEqual(rt.game.attributes.health, 0);
  assert.strictEqual(rt.achievementPending, true);
  assert.strictEqual(rt.pendingLives, 1);
  assert.ok(rt.pendingEndingKey.length > 0);
  // 终局快照：死亡岁追加（95 或钳位后年龄）
  const last = rt.game.snapshots![rt.game.snapshots!.length - 1];
  assert.strictEqual(last.age, rt.game.age);
  assert.strictEqual(last.attrs.health, 0);
});

test('MAKE_CHOICE：条件不满足事件被跳过收集', () => {
  const events = [
    evt('ok_01', 7, { happiness: 2 }),                     // 当前事件（满足条件）
    evt('no_01', 7, {}, [], { hasFlags: ['never_got'] }),  // 条件不满足 → 跳过收集
    evt('ok_02', 7, { happiness: 1 }),                     // 满足条件 → 成为下一事件
  ];
  let rt = mkState(events);
  rt = choose(rt);
  assert.strictEqual(rt.skippedEvents.length, 1);
  assert.strictEqual(rt.skippedEvents[0].id, 'no_01');
  assert.strictEqual(rt.currentEvent!.id, 'ok_02');
});

test('CONTINUE 只清反馈；SET_TYPE_SPEED 生效', () => {
  let rt = mkState([evt('a_01', 7, { happiness: 1 })]);
  rt = choose(rt);
  assert.ok(rt.feedback);
  rt = reducer(rt, { type: 'CONTINUE' });
  assert.strictEqual(rt.feedback, null);
  rt = reducer(rt, { type: 'SET_TYPE_SPEED', typeSpeed: 'slow' });
  assert.strictEqual(rt.typeSpeed, 'slow');
});

test('RESET：回标题且保留存档槽位', () => {
  const rt = mkState([evt('a_01', 7, {})]);
  const saves = rt.saves;
  const reset = reducer(rt, { type: 'RESET' });
  assert.strictEqual(reset.game.phase, 'title');
  assert.strictEqual(reset.saves, saves);
  assert.strictEqual(reset.autoPlay, false);
});

test('RESTART：局中重开沿用角色/设置/目标/挑战，换新种子重新开局', () => {
  const base = createInitialRuntime();
  const rt = reducer({ ...base, stats: { ...base.stats, totalLives: 2 } }, {
    type: 'START_GAME', gender: 'female', name: '小美', paceMode: 'lite', typeSpeed: 'slow', goal: 'family', challenge: true,
  });
  const restart = reducer(rt, { type: 'RESTART' });
  assert.strictEqual(restart.game.phase, 'playing');
  assert.strictEqual(restart.game.gender, 'female');
  assert.strictEqual(restart.game.name, '小美');
  assert.strictEqual(restart.game.goal, 'family');
  assert.strictEqual(restart.game.challenge, true);
  assert.strictEqual(restart.paceMode, 'lite');
  assert.strictEqual(restart.typeSpeed, 'slow');
  assert.strictEqual(restart.autoPlay, false);
  // 年龄由首事件驱动
  assert.strictEqual(restart.game.age, restart.currentEvent!.age);
  // 换新随机种子（同岁组顺序不同）
  assert.notStrictEqual(restart.shuffleSeed, rt.shuffleSeed);
  // 初始快照：首事件年龄 + 继承开局属性
  assert.strictEqual(restart.game.snapshots!.length, 1);
  assert.strictEqual(restart.game.snapshots![0].attrs.health, 55); // 挑战开局 65-10
});

test('CONTINUE_GAME：旧档字段兜底（paceMode/typeSpeed/deathCause/snapshots）', () => {
  const base = createInitialRuntime();
  const saved = {
    game: {
      ...base.game, phase: 'playing' as const, age: 20,
      attributes: { ...base.game.attributes, health: 80 },
      // 旧档无 deathCause/snapshots 字段
    },
    currentEventId: null,
    feedback: null,
    eventIndex: 0,
    shuffleSeed: 42,
    // 旧档无 paceMode/typeSpeed 字段
  };
  base.saves = { active: 0, slots: [saved, null, null] };
  let rt = reducer(base, { type: 'CONTINUE_GAME', slot: 0 });
  assert.strictEqual(rt.game.phase, 'playing');
  assert.strictEqual(rt.paceMode, 'full');          // 旧档兜底
  assert.strictEqual(rt.typeSpeed, 'normal');
  assert.strictEqual(rt.game.deathCause, null);     // 旧档兜底
  assert.strictEqual(rt.game.snapshots, undefined); // 旧档无快照
  assert.strictEqual(rt.shuffleSeed, 42);           // 种子还原
  assert.strictEqual(rt.autoPlay, false);           // 读档恢复为手动模式
  // 空槽位：不改变状态
  const empty = reducer(rt, { type: 'CONTINUE_GAME', slot: 1 });
  assert.strictEqual(empty, rt);
});

test('START_GAME：挑战开局属性整体下调 10 点', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: true,
  });
  assert.strictEqual(rt.game.challenge, true);
  assert.strictEqual(rt.game.attributes.health, 55);       // 65 - 10
  assert.strictEqual(rt.game.attributes.intelligence, 15); // 25 - 10
  // 初始快照与下调后的属性一致
  assert.strictEqual(rt.game.snapshots![0].attrs.health, 55);
  // 非挑战开局不受影响
  const normal = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(normal.game.challenge, false);
  assert.strictEqual(normal.game.attributes.health, 65);
});

test('START_GAME：周目门控——第 1 局无命运事件，第 3 局起抽取', () => {
  const base = createInitialRuntime();
  // 第 1 局（totalLives=0）：无命运事件
  const round1 = reducer({ ...base, stats: { ...base.stats, totalLives: 0 } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(round1.fateEventIds.length, 0);
  // 第 3 局（totalLives=2）：抽取 1 个命运事件
  const round3 = reducer({ ...base, stats: { ...base.stats, totalLives: 2 } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(round3.fateEventIds.length, 1, '第 3 局应抽取 1 个命运事件');
});

test('MAKE_CHOICE：命运事件效果放大 ×1.5，普通事件不受影响', () => {
  const base = createInitialRuntime();
  // 构造命运事件流：年轻 1 岁事件（+5 智力）+ 普通 2 岁事件
  const base2 = mkState([evt('young_02', 19, { intelligence: 10 }), evt('birth_02', 1, { happiness: 4 })]);
  let rt = { ...base2, stats: { ...base2.stats, totalLives: 2 }, fateEventIds: ['young_02'] };
  // 命运事件：智力 25 + round(10×1.5)=15 → 40
  rt = choose(rt);
  assert.strictEqual(rt.game.attributes.intelligence, 40);
  // 普通事件：幸福 60 + 4 → 64
  rt = choose(rt);
  assert.strictEqual(rt.game.attributes.happiness, 64);
});
