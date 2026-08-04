/**
 * 节奏档位测试（打字速度常量 + filterEvents 抽样引擎）。
 *
 * 运行：node --experimental-strip-types --test script/pace-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { TYPE_SPEED_RANGES } from '../src/engine/state.ts';

test('TYPE_SPEED_RANGES：三档齐全且范围合法', () => {
  assert.deepStrictEqual(Object.keys(TYPE_SPEED_RANGES), ['slow', 'normal', 'fast']);
  for (const [min, max] of Object.values(TYPE_SPEED_RANGES)) {
    assert.ok(min >= 0 && min <= max, `范围非法: ${min}-${max}`);
  }
});
