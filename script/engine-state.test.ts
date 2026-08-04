/**
 * 引擎 state.ts 单元测试（年龄锚点成长上限 + 属性应用 + 老年衰减）。
 *
 * 运行：node --experimental-strip-types --test script/engine-state.test.ts
 * 说明：Node 22 strip-types 直接执行 TS，与 script/*.test.mjs 数据工具测试分开。
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { ageCap, applyElderDecay, applyOutcomes, calcMaxAge, effectiveDelta } from '../src/engine/state.ts';
import EVENTS, { shuffleEvents } from '../src/engine/events.ts';
import type { Attributes } from '../src/types/index.ts';

/** 构造测试用属性表 */
function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50, ...overrides };
}

test('ageCap：锚点前取首值，锚点精确命中', () => {
  assert.strictEqual(ageCap(0, 'luck'), 75);          // 恒值锚点
  assert.strictEqual(ageCap(3, 'intelligence'), 55);  // 首锚点前
  assert.strictEqual(ageCap(7, 'intelligence'), 55);  // 精确锚点
  assert.strictEqual(ageCap(30, 'intelligence'), 92);
});

test('ageCap：锚点间线性插值', () => {
  // 智力 7→55、12→72：10 岁 = 55 + 17×3/5 = 65.2 → 65
  assert.strictEqual(ageCap(10, 'intelligence'), 65);
  // 财富 7→30、12→45：10 岁 = 30 + 15×3/5 = 39
  assert.strictEqual(ageCap(10, 'wealth'), 39);
});

test('ageCap：尾锚点后取末值', () => {
  assert.strictEqual(ageCap(100, 'intelligence'), 88); // 65 岁后保持 88
  assert.strictEqual(ageCap(95, 'wealth'), 95);
});

test('effectiveDelta：距年龄上限足够远时全额', () => {
  // 智力 7 岁上限 55，当前 25 → 余量 30 ≥ 过渡带
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 25 }), 7), 16);
});

test('effectiveDelta：过渡带内线性递减且不越上限', () => {
  // 智力 7 岁上限 55，当前 50 → 余量 5，16×5/15 = 5.3 → 5
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 50 }), 7), 5);
  // 智力 40 岁上限 92，当前 88 → 余量 4
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 88 }), 40), 4);
});

test('effectiveDelta：达到当前年龄上限后归零', () => {
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 55 }), 7), 0);
  // 65 岁智力上限降为 88，88 岁? 不——88 智力在 65 岁时已满
  assert.strictEqual(effectiveDelta('intelligence', 16, attrs({ intelligence: 88 }), 65), 0);
});

test('effectiveDelta：过渡带内至少生效 1 点', () => {
  // 智力 7 岁上限 55，当前 54 → 余量 1
  assert.strictEqual(effectiveDelta('intelligence', 1, attrs({ intelligence: 54 }), 7), 1);
});

test('effectiveDelta：负向惩罚全额生效', () => {
  assert.strictEqual(effectiveDelta('wealth', -20, attrs({ wealth: 90 }), 30), -20);
  assert.strictEqual(effectiveDelta('health', -10, attrs({ health: 50 }), 7), -10);
});

test('applyOutcomes：低龄受年龄上限约束', () => {
  // 7 岁智力上限 55：25 + 16 = 41（余量充足，全额）
  const a1 = applyOutcomes(attrs({ intelligence: 25 }), { attr: { intelligence: 16 } }, 7);
  assert.strictEqual(a1.intelligence, 41);
  // 50 + 16 → 只吃 5 → 55（不越上限）
  const a2 = applyOutcomes(attrs({ intelligence: 50 }), { attr: { intelligence: 16 } }, 7);
  assert.strictEqual(a2.intelligence, 55);
});

test('applyOutcomes：同属性成年后上限放宽', () => {
  // 40 岁智力上限 92：88 + 4 = 92
  const next = applyOutcomes(attrs({ intelligence: 88 }), { attr: { intelligence: 16 } }, 40);
  assert.strictEqual(next.intelligence, 92);
});

test('applyOutcomes：负向全额并钳位下限', () => {
  const next = applyOutcomes(attrs({ happiness: 3 }), { attr: { happiness: -10 } }, 30);
  assert.strictEqual(next.happiness, 0);
});

test('applyOutcomes：多属性互不影响', () => {
  const next = applyOutcomes(attrs({ wealth: 20, morality: 70 }), { attr: { wealth: 10, morality: 20 } }, 40);
  assert.strictEqual(next.wealth, 30);       // 20+10，低值全额
  assert.strictEqual(next.morality, 88);     // 40 岁上限 88：70 + 18（余量钳位）
});

test('applyOutcomes：未涉及属性保持不变', () => {
  const base = attrs();
  const next = applyOutcomes(base, { attr: { luck: 5 } }, 30);
  assert.strictEqual(next.health, 50);
  assert.strictEqual(next.luck, 55);
});

test('calcMaxAge：基础 68 + 健康红利（红利 35 封顶 103）', () => {
  // 红利基于 8 属性平均，用全属性同值构造（attrs 默认其余 7 项为 50）
  const flat = (v: number) => attrs({ health: v, intelligence: v, wealth: v, happiness: v, social: v, appearance: v, luck: v, morality: v });
  assert.strictEqual(calcMaxAge(flat(0)), 68);
  assert.strictEqual(calcMaxAge(flat(100)), 103);  // 68 + 35
  assert.strictEqual(calcMaxAge(flat(77)), 95);    // 68 + 26.95 → round 95
  assert.strictEqual(calcMaxAge(flat(50)), 86);    // 68 + 17.5
});

test('老年衰减：运气好也只掉 1 点（下限 1）', () => {
  assert.strictEqual(applyElderDecay(attrs({ luck: 80, health: 90 })).health, 89);
  assert.strictEqual(applyElderDecay(attrs({ luck: 100, health: 90 })).health, 89);
});

test('老年衰减：运气低时正常掉血', () => {
  assert.strictEqual(applyElderDecay(attrs({ luck: 20, health: 90 })).health, 88); // decay 2
  assert.strictEqual(applyElderDecay(attrs({ luck: 50, health: 90 })).health, 89); // decay 1
});

test('shuffleEvents：洗牌保持事件总数与年龄升序', () => {
  const shuffled = shuffleEvents(EVENTS, 42);
  assert.strictEqual(shuffled.length, EVENTS.length);
  for (let i = 1; i < shuffled.length; i++) {
    assert.ok(shuffled[i].age >= shuffled[i - 1].age, `第 ${i} 个事件年龄回退`);
  }
});

test('shuffleEvents：同种子可复现，不同种子顺序不同', () => {
  const a1 = shuffleEvents(EVENTS, 7).map(e => e.id).join(',');
  const a2 = shuffleEvents(EVENTS, 7).map(e => e.id).join(',');
  const b = shuffleEvents(EVENTS, 8).map(e => e.id).join(',');
  assert.strictEqual(a1, a2);            // 同种子 → 相同顺序
  assert.notStrictEqual(a1, b);          // 不同种子 → 顺序不同
});

test('shuffleEvents：同岁组内 flag 依赖被修正（消费在产出之后）', () => {
  const shuffled = shuffleEvents(EVENTS, 123);
  // 14 岁组：teen_04 消费 first_love，产出者也在 14 岁
  const pos = new Map(shuffled.map((e, i) => [e.id, i]));
  const producers = EVENTS
    .filter(e => e.age === 14 && e.choices.some(c => c.outcomes?.flags?.includes('first_love')))
    .map(e => e.id);
  for (const p of producers) {
    assert.ok(pos.get(p)! < pos.get('teen_04')!, `first_love 产出 ${p} 应在 teen_04 之前`);
  }
});
