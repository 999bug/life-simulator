/**
 * family.ts 纯函数测试：族谱追加世代递增、字段完整、容量裁剪。
 * 运行：node --experimental-strip-types --test script/family.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFamilyMember, parentFlag, FAMILY_MAX } from '../src/engine/family.ts';
import type { FamilyMember, GameState } from '../src/types/index.ts';

/** 构造最小终局状态 */
function game(over: Partial<GameState>): GameState {
  return {
    gender: 'male', name: '小明', age: 80, stage: 'elder', stageIdx: 6,
    attributes: { health: 60, intelligence: 70, wealth: 50, happiness: 65, social: 55, appearance: 45, luck: 50, morality: 60 },
    flags: [], history: [], phase: 'summary', deathCause: 'lifespan', goal: null,
    ...over,
  };
}

test('appendFamilyMember：空族谱追加为第 1 代，字段完整', () => {
  const g = game({ name: '张一', flags: ['doctor'] });
  const family = appendFamilyMember([], g, '20260805');
  assert.strictEqual(family.length, 1);
  const m = family[0];
  assert.strictEqual(m.generation, 1);
  assert.strictEqual(m.name, '张一');
  assert.strictEqual(m.age, 80);
  assert.strictEqual(m.verdict, 'doctor');
  assert.strictEqual(m.date, '20260805');
  assert.strictEqual(typeof m.score, 'number');
  assert.deepStrictEqual(m.attrs, g.attributes);
});

test('appendFamilyMember：世代线性递增，结局路线正确记录', () => {
  let family: FamilyMember[] = [];
  family = appendFamilyMember(family, game({ name: '一代', flags: ['startup_success'] }), '20260801');
  family = appendFamilyMember(family, game({ name: '二代', flags: [] }), '20260802');
  family = appendFamilyMember(family, game({ name: '三代', flags: ['went_to_college'] }), '20260803');
  assert.deepStrictEqual(family.map(m => m.generation), [1, 2, 3]);
  assert.strictEqual(family[0].verdict, 'startup_success');
  assert.strictEqual(family[1].verdict.startsWith('score:'), true);
  assert.strictEqual(family[2].verdict, 'went_to_college');
});

test('appendFamilyMember：超出容量裁掉最老世代，世代号保留原值', () => {
  let family: FamilyMember[] = [];
  for (let i = 0; i < FAMILY_MAX; i++) {
    family = appendFamilyMember(family, game({ name: `第${i + 1}代` }), '20260805');
  }
  assert.strictEqual(family.length, FAMILY_MAX);
  family = appendFamilyMember(family, game({ name: '溢出代' }), '20260806');
  assert.strictEqual(family.length, FAMILY_MAX);
  // 最老的第 1 代被裁掉，首部为第 2 代，末尾为新成员
  assert.strictEqual(family[0].name, '第2代');
  assert.strictEqual(family[0].generation, 2);
  assert.strictEqual(family[family.length - 1].name, '溢出代');
});

test('parentFlag：路线结局注入 parent_ flag，分数档/空族谱不注入', () => {
  assert.strictEqual(parentFlag([]), null);
  const doctor = appendFamilyMember([], game({ flags: ['doctor'] }), '20260805');
  assert.strictEqual(parentFlag(doctor), 'parent_doctor');
  // 分数档结局（无路线 flag）不注入
  const plain = appendFamilyMember([], game({ flags: [] }), '20260805');
  assert.strictEqual(parentFlag(plain), null);
  // 取族谱末尾（最新一代）
  let family = appendFamilyMember([], game({ flags: ['civil_servant'] }), '20260801');
  family = appendFamilyMember(family, game({ flags: ['athlete_pro'] }), '20260802');
  assert.strictEqual(parentFlag(family), 'parent_athlete_pro');
});

test('appendFamilyMember：快速模拟/每日挑战局带标记入谱', () => {
  let family: FamilyMember[] = [];
  family = appendFamilyMember(family, game({ name: '手玩' }), '20260805');
  family = appendFamilyMember(family, game({ name: '自动' }), '20260805', { auto: true });
  family = appendFamilyMember(family, game({ name: '每日' }), '20260805', { daily: true });
  assert.strictEqual(family[0].auto, undefined);
  assert.strictEqual(family[1].auto, true);
  assert.strictEqual(family[2].daily, true);
  // 世代照常递增
  assert.deepStrictEqual(family.map(m => m.generation), [1, 2, 3]);
});

test('parentFlag：快速模拟代不参与传承，向上取最近手玩局', () => {
  let family = appendFamilyMember([], game({ flags: ['doctor'] }), '20260801');
  // 最新一代是快速模拟（startup_success）→ 跳过，取上一代的 doctor
  family = appendFamilyMember(family, game({ flags: ['startup_success'] }), '20260802', { auto: true });
  assert.strictEqual(parentFlag(family), 'parent_doctor');
  // 手玩局为分数档、自动局为路线结局 → 仍不注入（手玩代无路线）
  let family2 = appendFamilyMember([], game({ flags: [] }), '20260801');
  family2 = appendFamilyMember(family2, game({ flags: ['doctor'] }), '20260802', { auto: true });
  assert.strictEqual(parentFlag(family2), null);
  // 每日挑战是手玩局 → 正常参与传承
  const daily = appendFamilyMember([], game({ flags: ['athlete_pro'] }), '20260803', { daily: true });
  assert.strictEqual(parentFlag(daily), 'parent_athlete_pro');
});
