/**
 * 每周挑战单元测试（ISO 周号/周种子/目标抽取/目标判定/当周最佳更新）。
 *
 * 运行：node --experimental-strip-types --test script/weekly.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  checkWeeklyGoal,
  pickWeeklyGoal,
  weekOf,
  weekSeed,
  WEEKLY_GOALS,
} from '../src/engine/weekly.ts';
import { updateWeeklyBest } from '../src/hooks/useGame.ts';
import type { GameState } from '../src/types/index.ts';

/** 构造终局状态 */
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gender: 'male',
    name: '测试',
    age: 40,
    stage: 'adult',
    stageIdx: 4,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
    ...overrides,
  };
}

test('weekOf：ISO 周号（周一为周始）', () => {
  // 2026-08-06 是周四（2026-08-03 周一）→ 2026-W32
  assert.strictEqual(weekOf(new Date(2026, 7, 6)), '2026-W32');
  // 周一与同周周日同属一周
  assert.strictEqual(weekOf(new Date(2026, 7, 3)), '2026-W32');
  assert.strictEqual(weekOf(new Date(2026, 7, 9)), '2026-W32');
  // 跨年：2027-01-01（周五）属 2026 年第 53 周（2026-12-28 为周一）
  assert.strictEqual(weekOf(new Date(2027, 0, 1)), '2026-W53');
});

test('weekSeed：同周同种子、不同周不同种子', () => {
  assert.strictEqual(weekSeed('2026-W32'), weekSeed('2026-W32'));
  assert.notStrictEqual(weekSeed('2026-W32'), weekSeed('2026-W33'));
});

test('pickWeeklyGoal：确定性（同周同目标、跨周可不同）', () => {
  const g1 = pickWeeklyGoal('2026-W32');
  assert.strictEqual(g1.key, pickWeeklyGoal('2026-W32').key);
  assert.ok(WEEKLY_GOALS.some(g => g.key === g1.key));
});

test('checkWeeklyGoal：各目标终局判定', () => {
  const age80 = WEEKLY_GOALS.find(g => g.key === 'age80')!;
  const wealth = WEEKLY_GOALS.find(g => g.key === 'wealth')!;
  const academic = WEEKLY_GOALS.find(g => g.key === 'academic')!;
  const doctor = WEEKLY_GOALS.find(g => g.key === 'doctor')!;
  const family = WEEKLY_GOALS.find(g => g.key === 'family')!;

  assert.strictEqual(checkWeeklyGoal(age80, game({ age: 79 })), false);
  assert.strictEqual(checkWeeklyGoal(age80, game({ age: 80 })), true);
  assert.strictEqual(checkWeeklyGoal(wealth, game({ attributes: { ...game().attributes, wealth: 74 } })), false);
  assert.strictEqual(checkWeeklyGoal(wealth, game({ attributes: { ...game().attributes, wealth: 75 } })), true);
  assert.strictEqual(checkWeeklyGoal(wealth, game({ flags: ['startup_success'] })), true);
  assert.strictEqual(checkWeeklyGoal(academic, game({ flags: ['top_university'] })), true);
  assert.strictEqual(checkWeeklyGoal(academic, game({ flags: ['went_to_college'] })), false);
  assert.strictEqual(checkWeeklyGoal(doctor, game({ flags: ['doctor'] })), true);
  assert.strictEqual(checkWeeklyGoal(family, game({ flags: ['married', 'has_child'], attributes: { ...game().attributes, happiness: 70 } })), true);
  assert.strictEqual(checkWeeklyGoal(family, game({ flags: ['married', 'has_child'], attributes: { ...game().attributes, happiness: 69 } })), false);
});

test('updateWeeklyBest：跨周初始化当周记录', () => {
  const next = updateWeeklyBest({ week: '2026-W31', goalKey: 'age80', bestScore: 80, bestAge: 79, cleared: true }, '2026-W32', 70, 60, false);
  assert.strictEqual(next.week, '2026-W32');
  assert.strictEqual(next.bestScore, 70);
  assert.strictEqual(next.bestAge, 60);
  assert.strictEqual(next.cleared, false);
  assert.strictEqual(next.goalKey, pickWeeklyGoal('2026-W32').key);
});

test('updateWeeklyBest：同周取最佳，通关标记只升不降', () => {
  const prev = { week: '2026-W32', goalKey: 'age80', bestScore: 80, bestAge: 79, cleared: false };
  const next = updateWeeklyBest(prev, '2026-W32', 70, 60, true);
  assert.strictEqual(next.bestScore, 80);
  assert.strictEqual(next.bestAge, 79);
  assert.strictEqual(next.cleared, true);
});
