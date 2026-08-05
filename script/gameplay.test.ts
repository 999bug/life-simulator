/**
 * 玩法功能测试：每日挑战（T7）+ 周目扩展（T5）。
 *
 * 运行：node --experimental-strip-types --test script/gameplay.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { dateToSeed, formatDate, updateDailyBest, reducer, createInitialRuntime } from '../src/hooks/useGame.ts';
import { applyInheritance } from '../src/engine/state.ts';
import { pickFateEvents, pickFateEvent } from '../src/engine/events.ts';
import type { Attributes, DailyStore } from '../src/types/index.ts';
import type { RuntimeState as Rt } from '../src/hooks/useGame.ts';

// ============ T7 每日挑战 ============

test('dateToSeed：确定性哈希（同日期同种子，不同日期不同种子）', () => {
  assert.strictEqual(dateToSeed('20260805'), dateToSeed('20260805'));
  assert.notStrictEqual(dateToSeed('20260805'), dateToSeed('20260806'));
  assert.notStrictEqual(dateToSeed('20260805'), dateToSeed('20250805'));
  assert.strictEqual(typeof dateToSeed('20260805'), 'number');
});

test('formatDate：YYYYMMDD 补零格式', () => {
  assert.strictEqual(formatDate(new Date(2026, 7, 5)), '20260805');
  assert.strictEqual(formatDate(new Date(2026, 0, 3)), '20260103');
});

test('updateDailyBest：仅当日记录取 max，跨天/首局初始化', () => {
  const today: DailyStore = { date: '20260805', bestScore: 70, bestAge: 60 };
  // 同日更高 → 更新
  assert.deepStrictEqual(updateDailyBest(today, '20260805', 80, 65), { date: '20260805', bestScore: 80, bestAge: 65 });
  // 同日更低 → 保持
  assert.deepStrictEqual(updateDailyBest(today, '20260805', 50, 40), { date: '20260805', bestScore: 70, bestAge: 60 });
  // 跨天 → 以本局成绩初始化今日记录
  assert.deepStrictEqual(updateDailyBest(today, '20260806', 55, 50), { date: '20260806', bestScore: 55, bestAge: 50 });
  // 空记录 → 初始化
  assert.deepStrictEqual(updateDailyBest({ date: '', bestScore: 0, bestAge: 0 }, '20260805', 60, 55), { date: '20260805', bestScore: 60, bestAge: 55 });
});

test('每日挑战开局：固定种子 + 手动播放 + 临时局标志', () => {
  const rt = reducer(createInitialRuntime(), {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal',
    goal: null, challenge: false, seed: dateToSeed('20260805'), isDaily: true,
  });
  assert.strictEqual(rt.isDaily, true);
  assert.strictEqual(rt.shuffleSeed, dateToSeed('20260805'));
  assert.strictEqual(rt.autoPlay, false);
  // 每日挑战局重开：保持固定种子（同日重试同一序列）
  const restart = reducer(rt, { type: 'RESTART' });
  assert.strictEqual(restart.isDaily, true);
  assert.strictEqual(restart.shuffleSeed, dateToSeed('20260805'));
});

// ============ T5 周目扩展 ============

/** 构造测试用属性表（与引擎初始属性一致） */
function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { health: 65, intelligence: 25, wealth: 20, happiness: 60, social: 25, appearance: 45, luck: 50, morality: 45, ...overrides };
}

test('applyInheritance：取上一世最高 2 项（值 ≥50）各 +8', () => {
  const last: Partial<Attributes> = { health: 90, wealth: 85, intelligence: 40 };
  const got = applyInheritance(attrs(), last);
  assert.strictEqual(got.health, 73);    // 65 + 8
  assert.strictEqual(got.wealth, 28);    // 20 + 8
  assert.strictEqual(got.intelligence, 25); // 非最高 2 项不继承
  // 不超 100
  assert.strictEqual(applyInheritance(attrs({ health: 98 }), { health: 90 }).health, 100);
});

test('applyInheritance：不足 2 项/值 <50 跳过/无记录无加成', () => {
  // 仅 1 项 ≥50
  const one = applyInheritance(attrs(), { health: 90, wealth: 30 });
  assert.strictEqual(one.health, 73);
  assert.strictEqual(one.wealth, 20);
  // 全部 <50 → 无加成
  assert.deepStrictEqual(applyInheritance(attrs(), { health: 40, wealth: 30 }), attrs());
  // 无上一世记录 → 无加成
  assert.deepStrictEqual(applyInheritance(attrs(), undefined), attrs());
});

test('pickFateEvents：抽 count 个不重复且种子确定，第 1 个与 pickFateEvent 同源', () => {
  const a = pickFateEvents(12345, 2);
  const b = pickFateEvents(12345, 2);
  assert.strictEqual(a.length, 2);
  assert.deepStrictEqual(a.map(e => e.id), b.map(e => e.id));
  assert.notStrictEqual(a[0].id, a[1].id, '两个命运事件不重复');
  assert.strictEqual(a[0].id, pickFateEvent(12345)!.id, '旧种子单抽行为不变');
});

test('START_GAME：第 5 周目（totalLives ≥4）抽 2 个命运事件，第 3 周目仍 1 个', () => {
  const base = createInitialRuntime();
  const mk = (totalLives: number): Rt => reducer({ ...base, stats: { ...base.stats, totalLives } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(mk(0).fateEventIds.length, 0);
  assert.strictEqual(mk(2).fateEventIds.length, 1);
  assert.strictEqual(mk(4).fateEventIds.length, 2);
});

test('START_GAME：第 5 周目开局传承——lastEndAttrs 最高 2 项加成 + inherited 标注', () => {
  const base = createInitialRuntime();
  const rt = reducer({
    ...base,
    stats: { ...base.stats, totalLives: 4, lastEndAttrs: { health: 90, wealth: 85 } },
  }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(rt.game.attributes.health, 73);
  assert.strictEqual(rt.game.attributes.wealth, 28);
  assert.strictEqual(rt.game.inherited, true);
  // 初始快照与传承后属性一致
  assert.strictEqual(rt.game.snapshots![0].attrs.health, 73);
});

test('START_GAME：旧 stats 无 lastEndAttrs 时无传承加成', () => {
  const base = createInitialRuntime();
  const rt = reducer({ ...base, stats: { ...base.stats, totalLives: 4 } }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: false,
  });
  assert.strictEqual(rt.game.attributes.health, 65);
  assert.strictEqual(rt.game.inherited, undefined);
});

test('START_GAME：传承与挑战独立叠加（先 +8 后 -10）', () => {
  const base = createInitialRuntime();
  const rt = reducer({
    ...base,
    stats: { ...base.stats, totalLives: 4, lastEndAttrs: { health: 90, wealth: 85 } },
  }, {
    type: 'START_GAME', gender: 'male', name: '小明', paceMode: 'full', typeSpeed: 'normal', goal: null, challenge: true,
  });
  assert.strictEqual(rt.game.attributes.health, 63); // 65 + 8 - 10
  assert.strictEqual(rt.game.attributes.wealth, 18); // 20 + 8 - 10
});
