/**
 * 结局 key 判定引擎测试（verdictKey：13 路线 flag 优先 + 5 档分数兜底）。
 *
 * 运行：node --experimental-strip-types --test script/verdict.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { verdictKey, nextRouteToExplore, VERDICT_ROUTES } from '../src/engine/verdict.ts';
import type { GameState, Attributes } from '../src/types/index.ts';

/** 构造测试用游戏状态；attrs 全属性同值（分数即该值） */
function game(flags: string[], attrsVal: number = 50): GameState {
  const attributes: Attributes = { health: attrsVal, intelligence: attrsVal, wealth: attrsVal, happiness: attrsVal, social: attrsVal, appearance: attrsVal, luck: attrsVal, morality: attrsVal };
  return {
    gender: 'male', name: '小明', age: 50, stage: 'middle_age', stageIdx: 4,
    attributes, flags, history: [], phase: 'summary', deathCause: 'lifespan',
    goal: null,
  };
}

test('verdictKey：13 条路线 flag 命中（单 flag）', () => {
  assert.strictEqual(verdictKey(game(['startup_success'])), 'startup_success');
  assert.strictEqual(verdictKey(game(['world_traveler'])), 'world_traveler');
  assert.strictEqual(verdictKey(game(['grad_school'])), 'grad_school');
  assert.strictEqual(verdictKey(game(['top_university'])), 'top_university');
  assert.strictEqual(verdictKey(game(['retake'])), 'retake');
  assert.strictEqual(verdictKey(game(['doctor'])), 'doctor');
  assert.strictEqual(verdictKey(game(['military_flag'])), 'military_flag');
  assert.strictEqual(verdictKey(game(['athlete_pro'])), 'athlete_pro');
  assert.strictEqual(verdictKey(game(['tech_career'])), 'tech_career');
  assert.strictEqual(verdictKey(game(['went_to_college'])), 'went_to_college');
  assert.strictEqual(verdictKey(game(['skilled_worker'])), 'skilled_worker');
  assert.strictEqual(verdictKey(game(['civil_servant'])), 'civil_servant');
});

test('verdictKey：artist 路线双 flag 任一生效', () => {
  assert.strictEqual(verdictKey(game(['artist_pro'])), 'artist');
  assert.strictEqual(verdictKey(game(['artist_life'])), 'artist');
});

test('verdictKey：多 flag 时按判定顺序取先命中者', () => {
  assert.strictEqual(verdictKey(game(['startup_success', 'went_to_college'])), 'startup_success');
  assert.strictEqual(verdictKey(game(['world_traveler', 'grad_school'])), 'world_traveler');
  assert.strictEqual(verdictKey(game(['doctor', 'went_to_college', 'retake'])), 'retake');
});

test('verdictKey：tech_career 只认 flag 不校验智力（与 SummaryScreen 文案判定不同）', () => {
  assert.strictEqual(verdictKey(game(['tech_career'], 30)), 'tech_career');
});

test('verdictKey：无路线按分数 5 档兜底（全属性同值 = 分数）', () => {
  assert.strictEqual(verdictKey(game([])), 'score:45+');   // 50 分
  assert.strictEqual(verdictKey(game([], 75)), 'score:75+');
  assert.strictEqual(verdictKey(game([], 60)), 'score:60+');
  assert.strictEqual(verdictKey(game([], 45)), 'score:45+');
  assert.strictEqual(verdictKey(game([], 30)), 'score:30+');
  assert.strictEqual(verdictKey(game([], 29)), 'score:low');
});

test('verdictKey：分数档边界（75/60/45/30 临界）', () => {
  assert.strictEqual(verdictKey(game([], 74)), 'score:60+');
  assert.strictEqual(verdictKey(game([], 59)), 'score:45+');
  assert.strictEqual(verdictKey(game([], 44)), 'score:30+');
  assert.strictEqual(verdictKey(game([], 0)), 'score:low');
});

// ============ 下一站线索（留存钩子：nextRouteToExplore）============

test('nextRouteToExplore：返回当前结局之后的第一条未收集路线', () => {
  const collected = new Set(['startup_success', 'world_traveler']);
  const next = nextRouteToExplore('world_traveler', collected);
  assert.strictEqual(next?.key, 'grad_school');
});

test('nextRouteToExplore：未收集的当前路线本身也可被选中（分数档兜底场景）', () => {
  // 分数档 key 不在表内：从第一条开始找未收集
  const collected = new Set(['startup_success']);
  const next = nextRouteToExplore('score:60+', collected);
  assert.strictEqual(next?.key, 'world_traveler');
});

test('nextRouteToExplore：循环滚动——前面全收集时滚到后段未收集路线', () => {
  const collected = new Set(VERDICT_ROUTES.map(r => r.key).filter(k => k !== 'civil_servant'));
  // 当前路线已收集，从之后循环：只有 civil_servant 未收集（滚到表尾）
  const next = nextRouteToExplore('startup_success', collected);
  assert.strictEqual(next?.key, 'civil_servant');
});

test('nextRouteToExplore：跳过当前路线自身（不重复提示刚走完的路）', () => {
  const collected = new Set(['startup_success', 'world_traveler']);
  // 当前路线未收集（异常输入）也绝不提示自己
  const next = nextRouteToExplore('startup_success', collected);
  assert.strictEqual(next?.key, 'grad_school');
});

test('nextRouteToExplore：全部收集返回 null', () => {
  const collected = new Set(VERDICT_ROUTES.map(r => r.key));
  assert.strictEqual(nextRouteToExplore('startup_success', collected), null);
});

test('nextRouteToExplore：当前路线已收集时跳过后面的已收集路线', () => {
  const collected = new Set(['startup_success', 'world_traveler', 'grad_school']);
  const next = nextRouteToExplore('startup_success', collected);
  assert.strictEqual(next?.key, 'top_university');
});
