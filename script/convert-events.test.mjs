import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertEvent, convertAll } from './convert-events.mjs';

const base = {
  id: 'test_01',
  age_range: [5, 6],
  category: 'learning',
  title: '测试事件',
  text: '测试文本',
  choices: [{ text: '选项', effects: {}, flags_add: [] }],
};

test('直接映射 + 同属性求和合并', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { learning: 5, knowledge: 3 }, flags_add: [] }] });
  assert.deepEqual(e.choices[0].outcomes.attr, { intelligence: 8 });
  assert.equal(e.choices[0].effects, '🧠+8');
});

test('取反键：pressure+8 与 happiness+3 合并为 happiness-5', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { pressure: 8, happiness: 3 } }] });
  assert.deepEqual(e.choices[0].outcomes.attr, { happiness: -5 });
  assert.equal(e.choices[0].effects, '😊-5');
});

test('正负抵消为 0 的键被删除，展示串为空', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { happiness: 5, pressure: 5 } }] });
  assert.deepEqual(e.choices[0].outcomes.attr, {});
  assert.equal(e.choices[0].effects, '');
});

test('展示串按八大属性固定顺序排列', () => {
  const e = convertEvent({ ...base, choices: [{ text: 'A', effects: { happiness: 5, health: 10 } }] });
  assert.equal(e.choices[0].effects, '💪+10 😊+5');
});

test('conditions：snake_case → camelCase，属性键映射', () => {
  const e = convertEvent({
    ...base,
    conditions: { has_flags: ['married'], not_flags: ['divorced'], min_attrs: { money: 55, empathy: 40 }, max_attrs: { health: 35 } },
  });
  assert.deepEqual(e.conditions, {
    hasFlags: ['married'], notFlags: ['divorced'],
    minAttrs: { wealth: 55, morality: 40 }, maxAttrs: { health: 35 },
  });
});

test('conditions 中出现取反键直接抛错', () => {
  assert.throws(() => convertEvent({ ...base, conditions: { max_attrs: { pressure: 50 } } }), /inverse attr "pressure"/);
});

test('未映射属性键直接抛错', () => {
  assert.throws(() => convertEvent({ ...base, choices: [{ text: 'A', effects: { unknown_attr: 1 } }] }), /unmapped attr "unknown_attr"/);
});

test('stage 按 age_range[0] 推导', () => {
  assert.equal(convertEvent({ ...base, age_range: [0, 1] }).stage, 'infant');
  assert.equal(convertEvent({ ...base, age_range: [7, 7] }).stage, 'childhood');
  assert.equal(convertEvent({ ...base, age_range: [13, 14] }).stage, 'teen');
  assert.equal(convertEvent({ ...base, age_range: [70, 71] }).stage, 'elder');
});

test('flags_add 非空才写入 outcomes.flags', () => {
  const withFlags = convertEvent({ ...base, choices: [{ text: 'A', effects: {}, flags_add: ['book_reader'] }] });
  assert.deepEqual(withFlags.choices[0].outcomes.flags, ['book_reader']);
  const noFlags = convertEvent({ ...base, choices: [{ text: 'A', effects: {}, flags_add: [] }] });
  assert.equal('flags' in noFlags.choices[0].outcomes, false);
});

test('缺字段抛错', () => {
  assert.throws(() => convertEvent({ ...base, title: '' }), /invalid event test_01/);
});

test('convertAll 检测重复 id', () => {
  assert.throws(() => convertAll([base, base]), /duplicate id "test_01"/);
});

test('完整事件形状（无 effects/flags 的叙事选项）', () => {
  const e = convertEvent({ ...base, id: 'birth_01', age_range: [0, 1], choices: [{ text: '……', effects: {}, flags_add: [] }] });
  assert.deepEqual(e, {
    id: 'birth_01', stage: 'infant', age: 0, title: '测试事件', text: '测试文本', category: 'learning',
    choices: [{ text: '……', effects: '', outcomes: { attr: {} } }],
  });
});

test('convertAll 正常路径：全量转换并保持顺序', () => {
  const out = convertAll([base, { ...base, id: 'test_02', age_range: [30, 31] }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 'test_01');
  assert.equal(out[1].stage, 'adult');
});

test('stage 超界（>95 岁）fallback 为 elder', () => {
  assert.equal(convertEvent({ ...base, age_range: [96, 97] }).stage, 'elder');
});
