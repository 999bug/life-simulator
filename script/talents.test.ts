/**
 * 天赋系统单元测试（天赋表/抽卡/应用/互斥/点数/继承存储）。
 *
 * 运行：node --experimental-strip-types --test script/talents.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import {
  applyAllocation,
  applyTalents,
  allocPoints,
  drawTalents,
  getTalent,
  loadInheritTalent,
  saveInheritTalent,
  TALENT_DRAFT_COUNT,
  TALENT_PICK_LIMIT,
  talentConflict,
  TALENTS,
} from '../src/engine/talents.ts';
import type { Attributes } from '../src/types/index.ts';

/** 构造测试用属性表 */
function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50, ...overrides };
}

// localStorage 桩（继承存储读写）
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  key: (i: number) => Array.from(storage.keys())[i] ?? null,
  get length() { return storage.size; },
} as unknown as Storage;

test('天赋表：id 唯一、效果值在 ±15 内、互斥对称', () => {
  const ids = new Set(TALENTS.map(t => t.id));
  assert.strictEqual(ids.size, TALENTS.length, '天赋 id 必须唯一');
  for (const t of TALENTS) {
    for (const v of Object.values(t.attrs ?? {})) {
      assert.ok(Math.abs(v) <= 15, `${t.id} 效果值 ${v} 超范围`);
    }
    for (const ex of t.excludes ?? []) {
      // 互斥必须对称：A 排除 B ⇔ B 排除 A
      const other = getTalent(ex);
      assert.ok(other, `${t.id} 互斥目标 ${ex} 不存在`);
      assert.ok(other!.excludes?.includes(t.id), `${t.id} ↔ ${ex} 互斥不对称`);
    }
  }
});

test('getTalent：已知 id 返回定义，未知返回 undefined', () => {
  assert.strictEqual(getTalent('robust')?.name, '健壮体魄');
  assert.strictEqual(getTalent('nonexistent'), undefined);
});

test('drawTalents：返回 10 个不重复候选', () => {
  const drawn = drawTalents(TALENT_DRAFT_COUNT);
  assert.strictEqual(drawn.length, TALENT_DRAFT_COUNT);
  assert.strictEqual(new Set(drawn).size, TALENT_DRAFT_COUNT, '候选不得重复');
  for (const id of drawn) {
    assert.ok(getTalent(id), `候选 ${id} 必须是有效天赋`);
  }
});

test('drawTalents：继承天赋必定在候选中', () => {
  const drawn = drawTalents(TALENT_DRAFT_COUNT, 'genius');
  assert.ok(drawn.includes('genius'), '继承天赋必须置顶出现');
});

test('applyTalents：按天赋属性求和叠加', () => {
  const next = applyTalents(attrs(), ['robust', 'clever']);
  assert.strictEqual(next.health, 56);
  assert.strictEqual(next.intelligence, 56);
  // 未涉及属性不变
  assert.strictEqual(next.wealth, 50);
});

test('applyTalents：钳位 0-100 且不越界', () => {
  const next = applyTalents(attrs({ health: 98 }), ['iron_body']);
  assert.strictEqual(next.health, 100);
});

test('applyTalents：负向效果同样生效', () => {
  const next = applyTalents(attrs({ happiness: 10 }), ['self_made']);
  assert.strictEqual(next.happiness, 5);
  assert.strictEqual(next.wealth, 60);
});

test('allocPoints：基数 12 + 天赋增减', () => {
  assert.strictEqual(allocPoints([]), 12);
  // 白手起家 -2 / 天降大任 -2
  assert.strictEqual(allocPoints(['self_made']), 10);
  assert.strictEqual(allocPoints(['self_made', 'heavenly']), 8);
});

test('applyAllocation：分配点加到属性上', () => {
  const next = applyAllocation(attrs(), { intelligence: 5, wealth: 3 });
  assert.strictEqual(next.intelligence, 55);
  assert.strictEqual(next.wealth, 53);
});

test('talentConflict：上限/重复/互斥校验', () => {
  // 重复
  assert.strictEqual(talentConflict(['robust'], 'robust'), '已选择');
  // 上限 3
  assert.strictEqual(talentConflict(['a', 'b', 'c'], 'robust'), '最多选择 3 个天赋');
  // 互斥：白手起家 ↔ 富豪世家（提示冲突的另一方）
  assert.strictEqual(talentConflict(['self_made'], 'rich_family'), '与「白手起家」互斥');
  assert.strictEqual(talentConflict(['rich_family'], 'self_made'), '与「富豪世家」互斥');
  // 合法加入
  assert.strictEqual(talentConflict(['robust'], 'clever'), null);
});

test('继承存储：写入可读回，损坏数据返回 null', () => {
  storage.clear();
  assert.strictEqual(loadInheritTalent(), null);
  saveInheritTalent('genius', '20260806');
  assert.deepStrictEqual(loadInheritTalent(), { talentId: 'genius', date: '20260806' });
  // 未知天赋 id 视为损坏
  storage.set('life-sim-talent-inherit', JSON.stringify({ talentId: 'nope', date: 'x' }));
  assert.strictEqual(loadInheritTalent(), null);
});
