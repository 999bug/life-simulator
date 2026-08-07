/**
 * legacy.ts 纯函数测试：家族底蕴推导（手玩代数/最近 5 代均值/auto-daily 排除）与开局应用（门槛/封顶/clamp）。
 * 运行：node --experimental-strip-types --test script/legacy.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLegacy, deriveLegacy, legacyBonuses,
  LEGACY_MIN_GENERATIONS, LEGACY_WINDOW, LEGACY_THRESHOLD, LEGACY_BONUS, LEGACY_MAX_TOTAL,
} from '../src/engine/legacy.ts';
import type { Attributes, FamilyMember } from '../src/types/index.ts';

/** 基础属性表（与引擎初始值一致的形状） */
const base: Attributes = { health: 65, intelligence: 25, wealth: 20, happiness: 60, social: 25, appearance: 45, luck: 50, morality: 45 };

/** 构造最小族谱成员 */
function member(over: Partial<FamilyMember>): FamilyMember {
  return {
    name: '家族成员', gender: 'male', generation: 1, age: 80, score: 80, verdict: 'doctor',
    attrs: { ...base },
    date: '20260801',
    ...over,
  };
}

/** 构造 n 代手玩局族谱，第 i 代终局属性为 attr 表 */
function familyOf(attrs: Attributes[], over: Partial<FamilyMember> = {}): FamilyMember[] {
  return attrs.map((a, i) => member({ generation: i + 1, attrs: { ...a }, ...over }));
}

test('deriveLegacy：空族谱与单代手玩无加成', () => {
  const empty = deriveLegacy([]);
  assert.strictEqual(empty.generations, 0);
  assert.deepStrictEqual(empty.attrs, {});
  // 单代手玩（即使属性全高）也不构成底蕴
  const single = deriveLegacy([member({ generation: 1, attrs: { ...base, health: 95 } })]);
  assert.strictEqual(single.generations, 1);
  assert.deepStrictEqual(single.attrs, {});
  // applyLegacy 原样返回且不修改入参
  assert.deepStrictEqual(applyLegacy(base, empty), base);
  assert.deepStrictEqual(applyLegacy(base, single), base);
  assert.deepStrictEqual(base, { health: 65, intelligence: 25, wealth: 20, happiness: 60, social: 25, appearance: 45, luck: 50, morality: 45 });
});

test('deriveLegacy：多代取最近 5 代均值（窗口外代不影响），Math.round', () => {
  // 前 2 代 health=100（窗口外），后 5 代 health=50；世代线性 1-7
  const family: FamilyMember[] = [
    member({ generation: 1, attrs: { ...base, health: 100 } }),
    member({ generation: 2, attrs: { ...base, health: 100 } }),
    member({ generation: 3, attrs: { ...base, health: 50 } }),
    member({ generation: 4, attrs: { ...base, health: 50 } }),
    member({ generation: 5, attrs: { ...base, health: 50 } }),
    member({ generation: 6, attrs: { ...base, health: 50 } }),
    member({ generation: 7, attrs: { ...base, health: 50 } }),
  ];
  const legacy = deriveLegacy(family);
  assert.strictEqual(legacy.generations, 7);
  // 最近 5 代全为 50 → 均值 50（若误取全部 7 代则为 64）
  assert.strictEqual(legacy.attrs.health, 50);
  // 窗口内未刻意设置的属性照常按最近 5 代均值计算
  assert.strictEqual(legacy.attrs.intelligence, 25);
  // 非整除均值 Math.round（60 与 61 → 60.5 → 61）
  const rounded = deriveLegacy(familyOf([{ ...base, health: 60 }, { ...base, health: 61 }]));
  assert.strictEqual(rounded.generations, 2);
  assert.strictEqual(rounded.attrs.health, 61);
});

test('deriveLegacy：auto/daily 局排除，只算真实手玩局', () => {
  // 3 代中只有 1 代手玩（auto/daily 属性再高也不计入）→ 不足 2 代无加成
  const legacy = deriveLegacy([
    member({ generation: 1, attrs: { ...base, health: 90 } }),
    member({ generation: 2, auto: true, attrs: { ...base, health: 100 } }),
    member({ generation: 3, daily: true, attrs: { ...base, health: 100 } }),
  ]);
  assert.strictEqual(legacy.generations, 1);
  assert.deepStrictEqual(legacy.attrs, {});
  // 2 代手玩 + auto/daily 混排：均值只算手玩局 (80+60)/2
  const legacy2 = deriveLegacy([
    member({ generation: 1, attrs: { ...base, health: 80 } }),
    member({ generation: 2, auto: true, attrs: { ...base, health: 100 } }),
    member({ generation: 3, attrs: { ...base, health: 60 } }),
    member({ generation: 4, daily: true, attrs: { ...base, health: 100 } }),
  ]);
  assert.strictEqual(legacy2.generations, 2);
  assert.strictEqual(legacy2.attrs.health, 70);
});

test('legacyBonuses/applyLegacy：均值 <70 不生效，≥70 每项 +2（含边界 70）', () => {
  // 均值 69 → 无加成
  const under = deriveLegacy(familyOf([{ ...base, health: 69 }, { ...base, health: 69 }]));
  assert.strictEqual(under.generations, 2);
  assert.deepStrictEqual(legacyBonuses(under), {});
  assert.deepStrictEqual(applyLegacy(base, under), base);
  // 均值恰好 70 → 生效
  const at = deriveLegacy(familyOf([{ ...base, health: 70 }, { ...base, health: 70 }]));
  assert.deepStrictEqual(legacyBonuses(at), { health: 2 });
  // 均值 80 → +2，其余属性不变
  const over = deriveLegacy(familyOf([{ ...base, health: 80 }, { ...base, health: 80 }]));
  assert.deepStrictEqual(legacyBonuses(over), { health: 2 });
  const applied = applyLegacy(base, over);
  assert.strictEqual(applied.health, base.health + LEGACY_BONUS);
  assert.strictEqual(applied.intelligence, base.intelligence);
});

test('legacyBonuses/applyLegacy：总加成封顶 +6（按属性顺序取前 3 项）', () => {
  // 5 项均值 80 → 前 3 项（健康/智力/财富）各 +2，幸福/社交不再享受（封顶 6）
  const strong: Attributes = { health: 80, intelligence: 80, wealth: 80, happiness: 80, social: 80, appearance: 45, luck: 50, morality: 60 };
  const legacy = deriveLegacy(familyOf([strong, strong]));
  assert.strictEqual(legacy.generations, 2);
  assert.deepStrictEqual(legacyBonuses(legacy), { health: 2, intelligence: 2, wealth: 2 });
  const applied = applyLegacy(base, legacy);
  assert.strictEqual(applied.health, 67);
  assert.strictEqual(applied.intelligence, 27);
  assert.strictEqual(applied.wealth, 22);
  assert.strictEqual(applied.happiness, 60);
  assert.strictEqual(applied.social, 25);
});

test('applyLegacy：加成 clamp 0-100，纯函数不修改入参', () => {
  const legacy = deriveLegacy(familyOf([{ ...base, health: 90 }, { ...base, health: 90 }]));
  const nearCap = { ...base, health: 99 };
  const applied = applyLegacy(nearCap, legacy);
  assert.strictEqual(applied.health, 100);
  // 原对象不被修改
  assert.strictEqual(nearCap.health, 99);
  // 多属性场景同样不改入参
  const strong: Attributes = { health: 80, intelligence: 80, wealth: 80, happiness: 50, social: 50, appearance: 45, luck: 50, morality: 60 };
  const multi = deriveLegacy(familyOf([strong, strong]));
  const input = { ...base };
  const out = applyLegacy(input, multi);
  assert.deepStrictEqual(input, base);
  assert.strictEqual(out.health, 67);
});

test('常量语义：代数门槛 2、窗口 5、阈值 70、每项 +2、封顶 +6', () => {
  assert.strictEqual(LEGACY_MIN_GENERATIONS, 2);
  assert.strictEqual(LEGACY_WINDOW, 5);
  assert.strictEqual(LEGACY_THRESHOLD, 70);
  assert.strictEqual(LEGACY_BONUS, 2);
  assert.strictEqual(LEGACY_MAX_TOTAL, 6);
});
