import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  perAgeDensity, categoryDistribution, flagPairing,
  effectRange, idStats, gapReport,
} from './stats.mjs';

/** fixture 事件构造：与 data-tools.test.mjs 的 ev() 风格一致 */
const ev = (id, age, opts = {}) => ({
  id,
  age_range: [age, age],
  category: opts.category ?? 'family',
  title: 't',
  text: 'x',
  choices: [{ text: 'c', effects: opts.effects ?? {}, flags_add: opts.flagsAdd ?? [] }],
  conditions: { has_flags: opts.hasFlags ?? [], not_flags: [] },
});

test('perAgeDensity：按 age_range[0] 归类计数，0-103 固定长度', () => {
  const events = [ev('a01', 0), ev('b01', 5), ev('b02', 5), ev('c01', 103)];
  const density = perAgeDensity(events);
  assert.equal(density.length, 104);
  assert.equal(density[0], 1);
  assert.equal(density[5], 2);
  assert.equal(density[103], 1);
  assert.equal(density[1], 0);
});

test('perAgeDensity：越界年龄（<0 或 >103）不抛错、不计入', () => {
  const density = perAgeDensity([ev('bad', -1), ev('bad2', 200)]);
  assert.equal(density.every(v => v === 0), true);
});

test('categoryDistribution：按类别计数，数量降序', () => {
  const events = [
    ev('a01', 5, { category: 'family' }),
    ev('a02', 6, { category: 'career' }),
    ev('a03', 7, { category: 'family' }),
    ev('a04', 8, { category: 'health' }),
    ev('a05', 9, { category: 'family' }),
  ];
  assert.deepEqual(categoryDistribution(events), { family: 3, career: 1, health: 1 });
});

test('flagPairing：只生产不消费与只消费不生产都算悬空', () => {
  const events = [
    ev('a01', 5, { flagsAdd: ['married', 'orphan_prod'] }),
    ev('a02', 30, { hasFlags: ['married', 'ghost_cons'] }),
  ];
  const pairing = flagPairing(events);
  assert.deepEqual(pairing.producers, ['married', 'orphan_prod']);
  assert.deepEqual(pairing.consumers, ['ghost_cons', 'married']);
  assert.deepEqual(pairing.dangling, ['ghost_cons', 'orphan_prod']);
});

test('flagPairing：生产消费成对时无悬空；无 flag 时三列表全空', () => {
  const paired = [
    ev('a01', 20, { flagsAdd: ['gap_year'] }),
    ev('a02', 22, { hasFlags: ['gap_year'], flagsAdd: ['gap_year_done'] }),
    ev('a03', 25, { hasFlags: ['gap_year_done'] }),
  ];
  assert.deepEqual(flagPairing(paired).dangling, []);
  assert.deepEqual(flagPairing([ev('a01', 5)]), { producers: [], consumers: [], dangling: [] });
});

test('effectRange：遍历所有 choice effects 取 min/max', () => {
  const events = [
    ev('a01', 5, { effects: { learning: 3, happiness: 5 } }),
    ev('a02', 30, { effects: { money: -5 } }),
  ];
  assert.deepEqual(effectRange(events), { min: -5, max: 5 });
});

test('effectRange：无任何效果值时返回 null', () => {
  assert.equal(effectRange([ev('a01', 5)]), null);
});

test('idStats：2 位后缀算主线，4 位后缀算模拟', () => {
  const events = [ev('child_01', 3), ev('child_0017', 5), ev('primary_0044', 8), ev('young_18', 29)];
  assert.deepEqual(idStats(events), { mainline: 2, generated: 2 });
});

test('gapReport：0-95 岁 <3 个的岁数进 sparse，96-103 岁完整明细进 tail', () => {
  const events = [
    ev('a01', 0),
    ev('b01', 5), ev('b02', 5), ev('b03', 5), ev('b04', 5), ev('b05', 5),
    ev('c01', 10), ev('c02', 10),
    ev('d01', 96),
  ];
  const gap = gapReport(events);
  // 0-95 岁共 96 个岁数，仅 5 岁达标（5 个事件），其余 95 个欠密度
  assert.equal(gap.sparse.length, 95);
  assert.deepEqual(gap.sparse[0], { age: 0, count: 1 });
  assert.ok(gap.sparse.some(item => item.age === 10 && item.count === 2));
  assert.equal(gap.sparse.some(item => item.age === 5), false);
  assert.equal(gap.sparse.some(item => item.age >= 96), false);
  assert.equal(gap.tail.length, 8);
  assert.deepEqual(gap.tail[0], { age: 96, count: 1 });
  assert.deepEqual(gap.tail.at(-1), { age: 103, count: 0 });
});
