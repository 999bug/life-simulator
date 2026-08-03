/**
 * 引擎 state.ts 单元测试（成长上限 + 属性应用 + 老年衰减）。
 *
 * 运行：node --experimental-strip-types --test script/engine-state.test.ts
 * 说明：Node 22 strip-types 直接执行 TS，与 script/*.test.mjs 数据工具测试分开。
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { applyElderDecay, applyOutcomes, effectiveDelta } from '../src/engine/state.ts';
import type { Attributes } from '../src/types/index.ts';

/** 构造测试用属性表 */
function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50, ...overrides };
}

test('距成长上限足够远时收益全额', () => {
  // 智力 cap 92，当前 30 → 余量 62 ≥ 过渡带 15
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 30 })), 16);
});

test('过渡带内收益线性递减', () => {
  // 智力 80 → 余量 12，16 × 12/15 = 12.8 → 12
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 80 })), 12);
});

test('单次增量钳位到剩余空间，不越过上限', () => {
  // 道德 70 → 余量 18 ≥ 过渡带，大额 35 全额但只吃满剩余 18 → 恰好到 88
  assert.strictEqual(effectiveDelta('morality', 35, attrs({ morality: 70 })), 18);
});

test('达到成长上限后正向收益归零', () => {
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 92 })), 0);
  assert.strictEqual(effectiveDelta('luck', 10, attrs({ luck: 75 })), 0);
});

test('过渡带内正向收益至少生效 1 点', () => {
  assert.strictEqual(effectiveDelta('intelligence', 1, attrs({ intelligence: 91 })), 1);
  assert.strictEqual(effectiveDelta('intelligence', 1, attrs({ intelligence: 90 })), 1);
});

test('负向惩罚全额生效，不受上限影响', () => {
  assert.strictEqual(effectiveDelta('wealth', -20, attrs({ wealth: 90 })), -20);
  assert.strictEqual(effectiveDelta('wealth', -10, attrs({ wealth: 50 })), -10);
});

test('零增量原样返回', () => {
  assert.strictEqual(effectiveDelta('luck', 0, attrs()), 0);
});

test('applyOutcomes 集成上限且不越过', () => {
  const next = applyOutcomes(attrs({ intelligence: 88 }), { attr: { intelligence: 20 } });
  assert.strictEqual(next.intelligence, 92); // 88 + 4（余量钳位）= 上限
});

test('applyOutcomes 负向全额并钳位下限', () => {
  const next = applyOutcomes(attrs({ happiness: 3 }), { attr: { happiness: -10 } });
  assert.strictEqual(next.happiness, 0);
});

test('applyOutcomes 多属性互不影响', () => {
  const next = applyOutcomes(attrs({ wealth: 20, morality: 80 }), { attr: { wealth: 10, morality: 20 } });
  assert.strictEqual(next.wealth, 30);       // 20+10，低值全额
  assert.strictEqual(next.morality, 88);     // 80 + 8（余量钳位）= 上限
});

test('applyOutcomes 未涉及属性保持不变', () => {
  const base = attrs();
  const next = applyOutcomes(base, { attr: { luck: 5 } });
  assert.strictEqual(next.health, 50);
  assert.strictEqual(next.luck, 55);
});

test('老年衰减：运气足够高时不掉血', () => {
  const next = applyElderDecay(attrs({ luck: 80, health: 90 }));
  assert.strictEqual(next.health, 90); // decay = max(0, 3-4) = 0，不回血也不掉血
});

test('老年衰减：运气低时正常掉血', () => {
  const next = applyElderDecay(attrs({ luck: 50, health: 90 }));
  assert.strictEqual(next.health, 89); // decay = max(0, 3-2.5) = 1
});

test('老年衰减：运气极高不回血（修复负衰减）', () => {
  const next = applyElderDecay(attrs({ luck: 100, health: 90 }));
  assert.strictEqual(next.health, 90); // decay = max(0, 3-5) = 0
});
