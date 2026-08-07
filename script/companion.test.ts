/**
 * 伴侣互动/称呼替换/退休年龄单元测试（纯函数）。
 *
 * 运行：node --experimental-strip-types --test script/companion.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  buildCompanionEvent,
  COMPANION_DISABLED,
  COMPANION_END_AGE,
  COMPANION_INTERVAL,
  COMPANION_START_AGE,
  companionEnabled,
} from '../src/engine/companion.ts';
import { isRetired, retirementAge } from '../src/engine/retirement.ts';
import { useName } from '../src/utils/naming.ts';
import type { GameState } from '../src/types/index.ts';

// ============ 伴侣互动 ============

test('buildCompanionEvent：love 分类 + 年龄步长 + 题库轮转', () => {
  const e25 = buildCompanionEvent(25);
  assert.strictEqual(e25.category, 'love');
  assert.strictEqual(e25.age, 25);
  assert.ok(e25.id.startsWith('companion_'));
  assert.ok(e25.choices.length >= 2);
  // 同岁同事件（题库按年龄确定性轮转）
  assert.strictEqual(buildCompanionEvent(25).id, e25.id);
  assert.strictEqual(buildCompanionEvent(29).age, 29);
  assert.notStrictEqual(buildCompanionEvent(29).id, e25.id);
});

test('buildCompanionEvent：题库循环覆盖 25-61 岁全部互动点', () => {
  const seen = new Set<string>();
  for (let age = COMPANION_START_AGE; age <= COMPANION_END_AGE; age += COMPANION_INTERVAL) {
    seen.add(buildCompanionEvent(age).id);
  }
  // 题库 8 个，10 个互动点 → 循环复用，无 undefined
  assert.strictEqual(seen.size, 8);
});

test('companionEnabled：已婚且未超龄启用；未婚/超龄禁用', () => {
  assert.strictEqual(companionEnabled(true, 25), true);
  assert.strictEqual(companionEnabled(true, 61), true);
  assert.strictEqual(companionEnabled(true, 65), false);
  assert.strictEqual(companionEnabled(false, 25), false);
  assert.strictEqual(companionEnabled(true, COMPANION_DISABLED), false);
});

// ============ 退休年龄 ============

test('retirementAge：女性 55 / 男性 60', () => {
  assert.strictEqual(retirementAge('female'), 55);
  assert.strictEqual(retirementAge('male'), 60);
});

/** 构造游戏状态 */
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gender: 'male',
    name: '测试',
    age: 50,
    stage: 'adult',
    stageIdx: 4,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'playing',
    deathCause: null,
    goal: null,
    ...overrides,
  };
}

test('isRetired：事件链 flag 优先，年龄线按性别兜底', () => {
  // 50 岁男性未退休
  assert.strictEqual(isRetired(game()), false);
  // 50 岁女性：已达 55 岁线 → 退休
  assert.strictEqual(isRetired(game({ gender: 'female', age: 55 })), true);
  // 59 岁男性未到 60 线
  assert.strictEqual(isRetired(game({ age: 59 })), false);
  assert.strictEqual(isRetired(game({ age: 60 })), true);
  // retired flag 直接退休
  assert.strictEqual(isRetired(game({ flags: ['retired'] })), true);
});

// ============ 称呼替换 ============

test('useName：单字「你」替换为名字', () => {
  assert.strictEqual(useName('你踩着一路风雪来到这个世界', '小明'), '小明踩着一路风雪来到这个世界');
  assert.strictEqual(useName('你的梦想', '小明'), '小明的梦想');
});

test('useName：跳过「你们」「你自己」', () => {
  assert.strictEqual(useName('你们一起长大', '小明'), '你们一起长大');
  assert.strictEqual(useName('你自己决定', '小明'), '你自己决定');
  assert.strictEqual(useName('你的选择只有你自己知道', '小明'), '小明的选择只有你自己知道');
});

test('useName：空名字或纯文本原样返回', () => {
  assert.strictEqual(useName('你好', ''), '你好');
  assert.strictEqual(useName('没有称呼', '小明'), '没有称呼');
});
