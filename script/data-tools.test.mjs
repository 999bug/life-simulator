import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prune, fixGapYear } from './prune-events.mjs';
import { mergeFragments, checkDistribution, checkFlagPairs } from './merge-fragments.mjs';
import { isValidEventId, convertAll } from './convert-events.mjs';

const ev = (id, age, flags = []) => ({
  id, age_range: [age, age + 1], category: 'family', title: 't', text: 'x',
  choices: [{ text: 'c', effects: { happiness: 1 }, flags_add: flags }],
});

test('prune：2 位 id 的原始事件永远保留，4 位 id 按清单过滤', () => {
  const events = [ev('child_01', 3), ev('child_0017', 5), ev('primary_0044', 8), ev('young_18', 29)];
  const out = prune(events, ['child_0017']);
  assert.deepEqual(out.map(e => e.id), ['child_01', 'child_0017', 'young_18']);
});

test('fixGapYear：给 gap_year_done 产出者补 gap_year，重复运行不重复加', () => {
  const events = [ev('young_99', 19, ['gap_year_done'])];
  assert.equal(fixGapYear(events), 1);
  assert.deepEqual(events[0].choices[0].flags_add, ['gap_year_done', 'gap_year']);
  assert.equal(fixGapYear(events), 0);
});

test('mergeFragments：合并、重复 id 幂等跳过、按 age_range[0] 排序', () => {
  const base = [ev('young_01', 18)];
  const out = mergeFragments(base, [[ev('teen_08', 13)], [ev('young_19', 22)]]);
  assert.deepEqual(out.map(e => e.id), ['teen_08', 'young_01', 'young_19']);
  // 幂等：片段中已存在于基础数据的 id 跳过，不抛错不重复
  const again = mergeFragments(out, [[ev('teen_08', 13)], [ev('young_19', 22)]]);
  assert.deepEqual(again.map(e => e.id), ['teen_08', 'young_01', 'young_19']);
});

test('checkDistribution：检出超密度与欠密度年龄', () => {
  const sparse = [ev('a01', 30), ev('a02', 30)];
  const violations = checkDistribution(sparse);
  assert.ok(violations.some(v => v.includes('30 岁') && v.includes('过少')));
  const dense = Array.from({ length: 14 }, (_, i) => ev(`c${i}`, 5));
  assert.ok(checkDistribution(dense).some(v => v.includes('5 岁') && v.includes('过多')));
  // 0-2 岁每岁 3 个不算过少（规则 3-5）
  assert.equal(checkDistribution([ev('b01', 0), ev('b02', 0), ev('b03', 0)]).length, 0);
  // 0-2 岁每岁 1 个算欠密度（低于 3）
  assert.ok(checkDistribution([ev('b01', 0)]).some(v => v.includes('0 岁') && v.includes('3-5')));
});

test('checkFlagPairs：检出无产出者的条件 flag，not_flags 不算悬空', () => {
  const orphan = [{ ...ev('a01', 30), conditions: { has_flags: ['ghost_flag'] } }];
  assert.deepEqual(checkFlagPairs(orphan), ['ghost_flag']);
  const ok = [
    ev('a01', 20, ['married']),
    { ...ev('a02', 30), conditions: { has_flags: ['married'], not_flags: ['divorced'] } },
  ];
  assert.deepEqual(checkFlagPairs(ok), []);
});

test('checkFlagPairs：parent_ 前缀为跨代注入 flag，豁免配对校验', () => {
  const lineage = [{ ...ev('a01', 7), conditions: { has_flags: ['parent_doctor'] } }];
  assert.deepEqual(checkFlagPairs(lineage), []);
  // 拼错的非前缀 flag 仍会被检出
  const typo = [{ ...ev('a02', 7), conditions: { has_flags: ['parentt_doctor'] } }];
  assert.deepEqual(checkFlagPairs(typo), ['parentt_doctor']);
});

test('事件 id 规则校验：2 位主线与 4 位模拟通过，其他抛错', () => {
  assert.strictEqual(isValidEventId('child_01'), true);
  assert.strictEqual(isValidEventId('child_0017'), true);
  assert.strictEqual(isValidEventId('adult_100'), false); // 3 位非法
  assert.strictEqual(isValidEventId('no_number'), false);
});

test('convertAll：选项手工性格标注透传到 outcomes.personality', () => {
  const raw = [{
    id: 'child_0018', age_range: [4, 6], category: 'hobby', title: 't', text: 'x',
    choices: [
      { text: 'a', effects: { happiness: 2 }, personality: ['cautious'] },
      { text: 'b', effects: { happiness: 1 } },
    ],
  }];
  const [ev] = convertAll(raw);
  assert.deepEqual(ev.choices[0].outcomes.personality, ['cautious']);
  assert.equal(ev.choices[1].outcomes.personality, undefined);
});

test('convertAll：min_personality 条件透传与非法值抛错', () => {
  const raw = [{
    id: 'pers_0001', age_range: [25, 25], category: 'personality', title: 't', text: 'x',
    choices: [{ text: 'a', effects: { happiness: 1 } }],
    conditions: { has_flags: [], not_flags: [], min_attrs: {}, max_attrs: {}, min_personality: { adventurous: 6 } },
  }];
  const [ev] = convertAll(raw);
  assert.deepEqual(ev.conditions.minPersonality, { adventurous: 6 });
  // 非法性格端抛错
  const badTrait = [{ ...raw[0], conditions: { min_personality: { brave: 6 } } }];
  assert.throws(() => convertAll(badTrait), /invalid min_personality/);
  // 非法值（<1）抛错
  const badVal = [{ ...raw[0], conditions: { min_personality: { adventurous: 0 } } }];
  assert.throws(() => convertAll(badVal), /invalid min_personality/);
});

test('convertAll：性格标注非法值抛错（fail fast）', () => {
  const bad = [{
    id: 'child_0019', age_range: [4, 6], category: 'hobby', title: 't', text: 'x',
    choices: [{ text: 'a', effects: { happiness: 1 }, personality: ['brave'] }],
  }];
  assert.throws(() => convertAll(bad), /invalid personality/);
  const empty = [{
    id: 'child_0020', age_range: [4, 6], category: 'hobby', title: 't', text: 'x',
    choices: [{ text: 'a', effects: { happiness: 1 }, personality: [] }],
  }];
  assert.throws(() => convertAll(empty), /invalid personality/);
});

test('convertAll 对非法 id 抛错（fail fast）', () => {
  assert.throws(() => convertAll([ev('adult_100', 30)]), /非法事件 id/);
  assert.throws(() => convertAll([ev('child_01', 3), ev('a', 5)]), /非法事件 id/);
});
