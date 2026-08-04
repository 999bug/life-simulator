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
  const dense = Array.from({ length: 13 }, (_, i) => ev(`c${i}`, 5));
  assert.ok(checkDistribution(dense).some(v => v.includes('5 岁') && v.includes('过多')));
  // 0-2 岁每岁 1 个不算过少
  assert.equal(checkDistribution([ev('b01', 0)]).length, 0);
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

test('事件 id 规则校验：2 位主线与 4 位模拟通过，其他抛错', () => {
  assert.strictEqual(isValidEventId('child_01'), true);
  assert.strictEqual(isValidEventId('child_0017'), true);
  assert.strictEqual(isValidEventId('adult_100'), false); // 3 位非法
  assert.strictEqual(isValidEventId('no_number'), false);
});

test('convertAll 对非法 id 抛错（fail fast）', () => {
  assert.throws(() => convertAll([ev('adult_100', 30)]), /非法事件 id/);
  assert.throws(() => convertAll([ev('child_01', 3), ev('a', 5)]), /非法事件 id/);
});
