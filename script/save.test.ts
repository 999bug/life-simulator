/**
 * 存档 v2 迁移与结构测试。
 *
 * 运行：node --experimental-strip-types --test script/save.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { emptySaves, migrateLegacySave, SLOT_COUNT } from '../src/engine/save.ts';

test('SLOT_COUNT 为 3', () => {
  assert.strictEqual(SLOT_COUNT, 3);
});

test('emptySaves：3 空槽 + active 0', () => {
  const s = emptySaves();
  assert.strictEqual(s.active, 0);
  assert.strictEqual(s.slots.length, 3);
  assert.deepStrictEqual(s.slots, [null, null, null]);
});

test('migrateLegacySave：v1 存档迁入槽 0', () => {
  const v1 = JSON.stringify({
    game: { gender: 'male', name: '小明', age: 30, stage: 'adult', stageIdx: 4, attributes: { health: 60, intelligence: 50, wealth: 40, happiness: 60, social: 40, appearance: 40, luck: 40, morality: 40 }, flags: [], history: [], phase: 'playing', deathCause: null, goal: null },
    currentEventId: 'adult_13', feedback: null, eventIndex: 12, shuffleSeed: 123456,
    paceMode: 'lite', typeSpeed: 'fast',
  });
  const s = migrateLegacySave(v1);
  assert.strictEqual(s.active, 0);
  assert.strictEqual(s.slots[0]?.game.name, '小明');
  assert.strictEqual(s.slots[0]?.shuffleSeed, 123456);
  assert.strictEqual(s.slots[0]?.paceMode, 'lite');
  assert.strictEqual(s.slots[1], null);
  assert.strictEqual(s.slots[2], null);
});

test('migrateLegacySave：非法 JSON 抛错', () => {
  assert.throws(() => migrateLegacySave('not-json'), /JSON|parse/i);
});
