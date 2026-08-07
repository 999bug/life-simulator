/**
 * 目标达成与成就判定引擎测试。
 *
 * 运行：node --experimental-strip-types --test script/goals.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { checkGoal, GOALS } from '../src/engine/goals.ts';
import { checkAchievements, ACHIEVEMENTS } from '../src/engine/achievements.ts';
import type { CustomGoal, GameState, GoalKey, Attributes } from '../src/types/index.ts';

/** 构造测试用游戏状态 */
function game(overrides: Partial<GameState> = {}, attrs: Partial<Attributes> = {}): GameState {
  return {
    gender: 'male', name: '小明', age: 50, stage: 'middle_age', stageIdx: 4,
    attributes: { health: 60, intelligence: 50, wealth: 40, happiness: 60, social: 40, appearance: 40, luck: 40, morality: 40, ...attrs },
    flags: [], history: [], phase: 'summary', deathCause: 'lifespan',
    goal: null, ...overrides,
  };
}

test('GOALS：6 个预设齐全且 key 唯一', () => {
  assert.strictEqual(GOALS.length, 6);
  assert.strictEqual(new Set(GOALS.map(g => g.key)).size, 6);
});

test('checkGoal：财富自由（wealth ≥ 80）', () => {
  assert.strictEqual(checkGoal('wealth', game({}, { wealth: 80 }))!.achieved, true);
  assert.strictEqual(checkGoal('wealth', game({}, { wealth: 65 }))!.achieved, false);
  // startup_success 也算达成
  assert.strictEqual(checkGoal('wealth', game({ flags: ['startup_success'] }))!.achieved, true);
});

test('checkGoal：环游世界（world_traveler flag）', () => {
  assert.strictEqual(checkGoal('travel', game({ flags: ['world_traveler'] }))!.achieved, true);
  assert.strictEqual(checkGoal('travel', game())!.achieved, false);
});

test('checkGoal：学术深耕（grad_school 或 top_university）', () => {
  assert.strictEqual(checkGoal('academic', game({ flags: ['grad_school'] }))!.achieved, true);
  assert.strictEqual(checkGoal('academic', game({ flags: ['top_university'] }))!.achieved, true);
  assert.strictEqual(checkGoal('academic', game())!.achieved, false);
});

test('checkGoal：白衣天使（doctor flag）', () => {
  assert.strictEqual(checkGoal('doctor', game({ flags: ['doctor'] }))!.achieved, true);
  assert.strictEqual(checkGoal('doctor', game())!.achieved, false);
});

test('checkGoal：家庭美满（已婚 + 有娃 + 幸福 ≥ 70）', () => {
  const base = game({ flags: ['married', 'has_child'] }, { happiness: 70 });
  assert.strictEqual(checkGoal('family', base)!.achieved, true);
  assert.strictEqual(checkGoal('family', game({ flags: ['married', 'has_child'] }, { happiness: 60 }))!.achieved, false);
  assert.strictEqual(checkGoal('family', game({ flags: ['married'] }, { happiness: 80 }))!.achieved, false);
});

test('checkGoal：安稳一生（civil_servant 或 settled_down）', () => {
  assert.strictEqual(checkGoal('stable', game({ flags: ['civil_servant'] }))!.achieved, true);
  assert.strictEqual(checkGoal('stable', game({ flags: ['settled_down'] }))!.achieved, true);
  assert.strictEqual(checkGoal('stable', game())!.achieved, false);
});

test('checkGoal：无目标返回 null；未达成含差距提示', () => {
  assert.strictEqual(checkGoal(null, game()), null);
  const r = checkGoal('wealth', game({}, { wealth: 65 }))!;
  assert.strictEqual(r.achieved, false);
  assert.match(r.detail, /65/);
});

test('checkGoal：自定义目标——全部达标/部分达标/空 attrs', () => {
  const custom: CustomGoal = { attrs: { wealth: 80, intelligence: 70 } };
  // 全部达标
  const full = checkGoal(custom, game({}, { wealth: 85, intelligence: 75 }))!;
  assert.strictEqual(full.achieved, true);
  assert.match(full.detail, /财富 85\/80/);
  assert.match(full.detail, /智力 75\/70/);
  // 部分达标（财富达标、智力未达标）
  const partial = checkGoal(custom, game({}, { wealth: 85, intelligence: 60 }))!;
  assert.strictEqual(partial.achieved, false);
  assert.match(partial.detail, /智力 60\/70/);
  // 空 attrs 视为达成
  const empty = checkGoal({ attrs: {} }, game())!;
  assert.strictEqual(empty.achieved, true);
});

test('checkGoal：自定义目标不干扰预设分支（旧字符串 goal 兼容）', () => {
  assert.strictEqual(checkGoal('wealth', game({}, { wealth: 85 }))!.achieved, true);
  assert.strictEqual(checkGoal('wealth', game({}, { wealth: 50 }))!.achieved, false);
  assert.strictEqual(checkGoal('family', game({ flags: ['married', 'has_child'] }, { happiness: 75 }))!.achieved, true);
});

test('ACHIEVEMENTS：38 个定义齐全（含 6 个隐藏成就）', () => {
  assert.strictEqual(ACHIEVEMENTS.length, 38);
  assert.strictEqual(new Set(ACHIEVEMENTS.map(a => a.id)).size, 38);
  // 隐藏成就：6 个，名称/描述不应泄漏条件
  const hidden = ACHIEVEMENTS.filter(a => a.hidden);
  assert.strictEqual(hidden.length, 6);
});

test('checkAchievements：新增 8 个成就判定', () => {
  // 属性平均分 86（≥85 触发 top_score）；余项属性补全使 calcScore 正常
  const g = game({ age: 96, flags: ['married', 'has_child'], attributes: { health: 92, intelligence: 96, wealth: 96, happiness: 85, social: 80, appearance: 80, luck: 80, morality: 80 } });
  const got = checkAchievements({ game: g, completedLives: 10, wasLite: false, wasAuto: false, endingsCount: 5 });
  for (const id of ['top_score', 'genius', 'iron_body', 'rich_king', 'big_family', 'ultra_life', 'five_endings', 'ten_lives'] as const) {
    assert.ok(got.includes(id), `应包含 ${id}`);
  }
});

test('checkAchievements：铜银金分层新增 7 个成就判定', () => {
  // 享年 82 / 财富 65 / 智力 72 / 评分 61（平均 (65+72+61×6)/8 ≈ 62.9）→ 仅触发铜档新成就
  const bronze = game({ age: 82, attributes: { health: 61, intelligence: 72, wealth: 65, happiness: 61, social: 61, appearance: 61, luck: 61, morality: 61 } });
  const gotBronze = checkAchievements({ game: bronze, completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 3 });
  for (const id of ['age_80', 'wealthy_60', 'bright_70', 'score_60', 'three_endings'] as const) {
    assert.ok(gotBronze.includes(id), `应包含 ${id}`);
  }
  assert.ok(!gotBronze.includes('longevity'));
  assert.ok(!gotBronze.includes('rich'));
  assert.ok(!gotBronze.includes('ten_endings'));

  // 评分 92+（全属性 92）且结局 10 种 → 金档 score_92 / ten_endings
  const gold = game({ age: 70, attributes: { health: 92, intelligence: 92, wealth: 92, happiness: 92, social: 92, appearance: 92, luck: 92, morality: 92 } });
  const gotGold = checkAchievements({ game: gold, completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 10 });
  assert.ok(gotGold.includes('score_92'));
  assert.ok(gotGold.includes('ten_endings'));
});

test('checkAchievements：按状态判定全部满足项', () => {
  const g = game({ age: 92, flags: ['world_traveler'], attributes: { wealth: 95, intelligence: 88, health: 80, happiness: 80, social: 70, appearance: 70, luck: 70, morality: 70 } });
  const got = checkAchievements({ game: g, completedLives: 3, wasLite: true, wasAuto: false });
  for (const id of ['first_life', 'longevity', 'rich', 'scholar', 'traveler', 'balanced', 'lite_clear', 'three_lives'] as const) {
    assert.ok(got.includes(id), `应包含 ${id}`);
  }
  assert.ok(!got.includes('early_death'));
  assert.ok(!got.includes('doctor'));
  assert.ok(!got.includes('auto_clear'));
});

test('checkAchievements：英年早逝与快速模拟', () => {
  const g = game({ age: 35 });
  const got = checkAchievements({ game: g, completedLives: 1, wasLite: false, wasAuto: true });
  assert.ok(got.includes('early_death'));
  assert.ok(got.includes('auto_clear'));
  assert.ok(!got.includes('longevity'));
});

test('checkAchievements：挑战开局 70 分以上解锁破局者', () => {
  const input = { game: game({ challenge: true }), completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1 };
  // 默认属性 60/50/40/60/40/40/40/40 = 46 分 → 不满足
  assert.ok(!checkAchievements(input).includes('challenger'));
  // 全属性 75 → 75 分 ≥ 70 → 解锁
  const high = { ...input, game: game({ challenge: true }, { health: 75, intelligence: 75, wealth: 75, happiness: 75, social: 75, appearance: 75, luck: 75, morality: 75 }) };
  assert.ok(checkAchievements(high).includes('challenger'));
  // 非挑战局高分不解锁
  const noChallenge = { ...high, game: game({}, { health: 75, intelligence: 75, wealth: 75, happiness: 75, social: 75, appearance: 75, luck: 75, morality: 75 }) };
  assert.ok(!checkAchievements(noChallenge).includes('challenger'));
});

test('checkAchievements：连续挑战成就（3 天银 / 7 天金）', () => {
  const g = game({ age: 50, attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 } });
  const base = { game: g, completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1 };
  const day2 = checkAchievements({ ...base, dailyStreak: 2 });
  assert.ok(!day2.includes('daily_streak_3'));
  assert.ok(!day2.includes('daily_streak_7'));
  const day3 = checkAchievements({ ...base, dailyStreak: 3 });
  assert.ok(day3.includes('daily_streak_3'));
  assert.ok(!day3.includes('daily_streak_7'));
  const day7 = checkAchievements({ ...base, dailyStreak: 7 });
  assert.ok(day7.includes('daily_streak_3'));
  assert.ok(day7.includes('daily_streak_7'));
});
