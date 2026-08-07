/**
 * 成就系统单元测试（隐藏成就判定 + 成就加成）。
 *
 * 运行：node --experimental-strip-types --test script/achievements.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { applyAchievementBonus, achievementBonusSteps, checkAchievements } from '../src/engine/achievements.ts';
import { setEvents } from '../src/engine/events.ts';
import type { Attributes, GameState } from '../src/types/index.ts';

// 好感度统计需要事件表（node 无 fetch，直接读产物注入）
setEvents(JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')));

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

/** 构造测试用属性表 */
function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50, ...overrides };
}

test('checkAchievements：金榜题名（重点大学）', () => {
  const ids = checkAchievements({ game: game({ flags: ['top_university'] }), completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
  assert.ok(ids.includes('gaokao_top'));
  const ids2 = checkAchievements({ game: game({ flags: ['went_to_college'] }), completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
  assert.ok(!ids2.includes('gaokao_top'));
});

test('checkAchievements：家和万事兴（家人关系 ≥ 80）', () => {
  // 全正向 family 选择（真实事件数据：family 分类事件的正选项）
  const real = JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')) as Array<{ id: string; age: number; category: string; choices: Array<{ text: string; effects: string; outcomes: { attr: Record<string, number> } }> }>;
  const fam = real.filter(e => e.category === 'family' && e.choices.some(c => Object.values(c.outcomes.attr).reduce((a, b) => a + b, 0) > 0));
  assert.ok(fam.length >= 6, '事件库 family 分类正选项事件应足够构造高好感');
  const history = fam.slice(0, 6).map((e, i) => ({
    age: 30 + i,
    stage: 'adult' as const,
    eventId: e.id,
    choiceIndex: e.choices.findIndex(c => Object.values(c.outcomes.attr).reduce((a, b) => a + b, 0) > 0),
    text: '正选项',
  }));
  const ids = checkAchievements({
    game: game({ history }),
    completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0,
  });
  assert.ok(ids.includes('family_harmony'), `history=${JSON.stringify(history)}`);
});

test('checkAchievements：职场精英（职业等级 ≥ 5）', () => {
  // 22 岁入行医生，从业 12 年 → 等级 5
  const g = game({
    age: 34,
    flags: ['doctor'],
    history: [{ age: 22, stage: 'adult', eventId: 'x', choiceIndex: 0, text: '入职', flags: ['doctor'] }],
  });
  const ids = checkAchievements({ game: g, completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
  assert.ok(ids.includes('job_elite'));
  // 从业不足 10 年（等级 4）不解锁
  const g2 = game({
    age: 31,
    flags: ['doctor'],
    history: [{ age: 22, stage: 'adult', eventId: 'x', choiceIndex: 0, text: '入职', flags: ['doctor'] }],
  });
  const ids2 = checkAchievements({ game: g2, completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
  assert.ok(!ids2.includes('job_elite'));
});

test('checkAchievements：有产者（投资或实业资产）', () => {
  const ids = checkAchievements({ game: game({ flags: ['investor'] }), completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
  assert.ok(ids.includes('asset_owner'));
  const ids2 = checkAchievements({ game: game({ flags: ['startup_success'] }), completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
  assert.ok(ids2.includes('asset_owner'));
});

/** 构造指定性格端命中的选择历史（真实事件数据：取含该端手工标注的事件选项） */
function personaHistory(trait: string, count: number): Array<{ age: number; stage: 'adult'; eventId: string; choiceIndex: number; text: string }> {
  const real = JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')) as Array<{ id: string; choices: Array<{ outcomes: { personality?: string[] } }> }>;
  const events = real.filter(e => e.choices.some(c => (c.outcomes.personality ?? []).includes(trait)));
  assert.ok(events.length >= count, `事件库 ${trait} 标注事件应足够（${events.length} ≥ ${count}）`);
  return events.slice(0, count).map((e, i) => ({
    age: 30 + i,
    stage: 'adult' as const,
    eventId: e.id,
    choiceIndex: e.choices.findIndex(c => (c.outcomes.personality ?? []).includes(trait)),
    text: '性格选择',
  }));
}

/** 通用判定辅助（固定非本局相关输入） */
function check(game: GameState) {
  return checkAchievements({ game, completedLives: 1, wasLite: false, wasAuto: false, endingsCount: 1, dailyStreak: 0 });
}

test('checkAchievements：性格鲜明（任一性格端 ≥ 15）', () => {
  assert.ok(check(game({ history: personaHistory('adventurous', 15) })).includes('vivid_persona'));
  assert.ok(!check(game({ history: personaHistory('adventurous', 14) })).includes('vivid_persona'));
});

test('checkAchievements：六边形战士（六端全部 ≥ 5，隐藏）', () => {
  const all = (n: number) => (['adventurous', 'altruistic', 'cautious', 'emotional', 'rational', 'selfish'] as const)
    .flatMap(t => personaHistory(t, n));
  assert.ok(check(game({ history: all(5) })).includes('hexagon_persona'));
  assert.ok(!check(game({ history: all(4) })).includes('hexagon_persona'));
});

test('checkAchievements：冒险家的一生（冒险端 ≥ 12）', () => {
  assert.ok(check(game({ history: personaHistory('adventurous', 12) })).includes('adventurous_persona'));
  assert.ok(!check(game({ history: personaHistory('adventurous', 11) })).includes('adventurous_persona'));
});

test('checkAchievements：温暖的人（利他端 ≥ 12，隐藏）', () => {
  assert.ok(check(game({ history: personaHistory('altruistic', 12) })).includes('altruistic_persona'));
  assert.ok(!check(game({ history: personaHistory('altruistic', 11) })).includes('altruistic_persona'));
});

test('checkAchievements：改过自新（入狱出狱 + 道德幸福达标）', () => {
  // 入狱 + 出狱 + 道德 60 + 幸福 50 → 解锁
  const ok = check(game({ flags: ['jailed', 'released'], attributes: attrs({ morality: 60, happiness: 50 }) }));
  assert.ok(ok.includes('redeemed_life'));
  // 仅入狱未出狱 → 不解锁
  assert.ok(!check(game({ flags: ['jailed'], attributes: attrs({ morality: 70, happiness: 60 }) })).includes('redeemed_life'));
  // 出狱但道德不达标 → 不解锁
  assert.ok(!check(game({ flags: ['jailed', 'released'], attributes: attrs({ morality: 59, happiness: 60 }) })).includes('redeemed_life'));
  // 出狱但幸福不达标 → 不解锁
  assert.ok(!check(game({ flags: ['jailed', 'released'], attributes: attrs({ morality: 70, happiness: 49 }) })).includes('redeemed_life'));
  // 未入狱（防御性：仅 released）→ 不解锁
  assert.ok(!check(game({ flags: ['released'], attributes: attrs({ morality: 80, happiness: 80 }) })).includes('redeemed_life'));
});

test('checkAchievements：亡命天涯（越狱成功）', () => {
  // 越狱成功 → 解锁
  assert.ok(check(game({ flags: ['escaped'] })).includes('fugitive'));
  // 仅入狱未越狱 → 不解锁
  assert.ok(!check(game({ flags: ['jailed'] })).includes('fugitive'));
  // 黑帮上位不触发本成就（防御性）
  assert.ok(!check(game({ flags: ['gang_boss'] })).includes('fugitive'));
});

test('checkAchievements：黑道风云（黑帮上位）', () => {
  // 黑帮上位 → 解锁
  assert.ok(check(game({ flags: ['gang_boss'] })).includes('gang_lord'));
  // 无 flag → 不解锁（防御性）
  assert.ok(!check(game({ flags: [] })).includes('gang_lord'));
  // 越狱成功不触发本成就（防御性）
  assert.ok(!check(game({ flags: ['escaped'] })).includes('gang_lord'));
});

test('achievementBonusSteps：每 10 个 +1 步，封顶 3 步', () => {
  assert.strictEqual(achievementBonusSteps(0), 0);
  assert.strictEqual(achievementBonusSteps(9), 0);
  assert.strictEqual(achievementBonusSteps(10), 1);
  assert.strictEqual(achievementBonusSteps(25), 2);
  assert.strictEqual(achievementBonusSteps(40), 3);
  assert.strictEqual(achievementBonusSteps(99), 3);
});

test('applyAchievementBonus：全属性 +2/步，钳位 100', () => {
  assert.deepStrictEqual(applyAchievementBonus(attrs(), 5), attrs());
  const next = applyAchievementBonus(attrs(), 10);
  assert.strictEqual(next.health, 52);
  assert.strictEqual(next.luck, 52);
  // 上限钳位
  const capped = applyAchievementBonus(attrs({ health: 99 }), 10);
  assert.strictEqual(capped.health, 100);
  // 两步 +4
  const two = applyAchievementBonus(attrs(), 20);
  assert.strictEqual(two.intelligence, 54);
});
