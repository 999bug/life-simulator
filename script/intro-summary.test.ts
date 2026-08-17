/**
 * 童年定格面板推导测试（buildIntroSummary）。
 *
 * 运行：node --experimental-strip-types --test script/intro-summary.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { buildCausalChain, buildIntroSummary } from '../src/engine/introSummary.ts';
import { setEvents } from '../src/engine/events.ts';
import type { AttributeKey, ChoiceRecord, LifeEvent } from '../src/types/index.ts';

/** 构造测试事件（多选项） */
function evt(id: string, age: number, choices: Array<{ attr: Partial<Record<AttributeKey, number>>; text?: string }>): LifeEvent {
  return {
    id,
    stage: 'childhood',
    age,
    text: `事件 ${id}`,
    choices: choices.map(c => ({ text: c.text ?? '选择', effects: '', outcomes: { attr: c.attr } })),
  };
}

test('buildIntroSummary：空历史/空快照 → 空数据', () => {
  setEvents([]);
  const s = buildIntroSummary([], undefined);
  assert.deepStrictEqual(s.milestones, []);
  assert.deepStrictEqual(s.attrGrowth, []);
});

test('buildIntroSummary：关键选择按效果降序取 4 条、按年龄升序展示，效果摘要取绝对值前 2 键', () => {
  setEvents([
    evt('e_01', 3, [{ attr: { intelligence: 8, morality: -5 }, text: '逃学去网吧' }]),
    evt('e_02', 5, [{ attr: { happiness: 2 }, text: '吃糖' }]),
    evt('e_03', 7, [{ attr: { wealth: 15 }, text: '捡到钱' }]),
    evt('e_04', 9, [{ attr: { health: 6, luck: 3 }, text: '学游泳' }]),
    evt('e_05', 11, [{ attr: { social: 10 }, text: '交朋友' }]),
  ]);
  const history: ChoiceRecord[] = [
    { age: 3, stage: 'childhood', eventId: 'e_01', choiceIndex: 0, text: '逃学去网吧' },
    { age: 5, stage: 'childhood', eventId: 'e_02', choiceIndex: 0, text: '吃糖' },
    { age: 7, stage: 'childhood', eventId: 'e_03', choiceIndex: 0, text: '捡到钱' },
    { age: 9, stage: 'childhood', eventId: 'e_04', choiceIndex: 0, text: '学游泳' },
    { age: 11, stage: 'childhood', eventId: 'e_05', choiceIndex: 0, text: '交朋友' },
  ];
  const s = buildIntroSummary(history, undefined);
  // 效果总和：e_03=15、e_01=13、e_05=10、e_04=9 取前 4（e_02=2 被裁）
  assert.strictEqual(s.milestones.length, 4);
  assert.deepStrictEqual(s.milestones.map(m => m.age), [3, 7, 9, 11], '按年龄升序展示');
  assert.strictEqual(s.milestones[0].title, 'e_01', '标题反查事件表');
  assert.ok(s.milestones[0].change.includes('+8 智力'), '效果摘要含主效果');
  assert.ok(s.milestones[0].change.includes('-5 道德'), '效果摘要含次效果（负数保留符号）');
  assert.strictEqual(s.milestones[1].age, 7, '15 点效果应排在前面');
});

test('buildIntroSummary：属性成长取变化 ≥5 的前 3 项（开局 → 童年末快照）', () => {
  const s = buildIntroSummary([], [
    { age: 0, attrs: { health: 65, intelligence: 25, wealth: 20, happiness: 60, social: 25, appearance: 45, luck: 50, morality: 45 } },
    { age: 12, attrs: { health: 80, intelligence: 62, wealth: 22, happiness: 68, social: 45, appearance: 50, luck: 50, morality: 40 } },
  ]);
  // 变化：intelligence +37、social +20、health +15、happiness +8、morality -5 → 取前 3
  assert.strictEqual(s.attrGrowth.length, 3);
  assert.deepStrictEqual(s.attrGrowth.map(g => g.key), ['intelligence', 'social', 'health'], '按变化幅度降序');
  assert.strictEqual(s.attrGrowth[0].from, 25);
  assert.strictEqual(s.attrGrowth[0].to, 62);
});

test('buildIntroSummary：13 岁后的选择不纳入童年定格', () => {
  setEvents([evt('t_01', 18, [{ attr: { wealth: 50 } }])]);
  const s = buildIntroSummary([
    { age: 18, stage: 'teen', eventId: 't_01', choiceIndex: 0, text: '成年选择' },
  ], undefined);
  assert.deepStrictEqual(s.milestones, [], '13 岁后事件不展示');
});

test('buildCausalChain：13 岁起的关键选择按效果降序取 6 条、按年龄升序，13 岁前不纳入', () => {
  setEvents([
    evt('c_01', 8, [{ attr: { intelligence: 12 } }]),   // 童年，应被过滤
    evt('t_01', 18, [{ attr: { wealth: 20 }, text: '创业' }]),
    evt('t_02', 25, [{ attr: { health: 8 } }]),
    evt('t_03', 30, [{ attr: { social: 16 } }]),
    evt('t_04', 40, [{ attr: { happiness: 10 } }]),
    evt('t_05', 50, [{ attr: { morality: 14 } }]),
    evt('t_06', 60, [{ attr: { luck: 6 } }]),
    evt('t_07', 70, [{ attr: { appearance: 4 } }]),     // 效果小，应被裁掉
  ]);
  const history: ChoiceRecord[] = [
    { age: 8, stage: 'childhood', eventId: 'c_01', choiceIndex: 0, text: '童年选择' },
    { age: 18, stage: 'teen', eventId: 't_01', choiceIndex: 0, text: '创业' },
    { age: 25, stage: 'young_adult', eventId: 't_02', choiceIndex: 0, text: '健身' },
    { age: 30, stage: 'adult', eventId: 't_03', choiceIndex: 0, text: '社交' },
    { age: 40, stage: 'adult', eventId: 't_04', choiceIndex: 0, text: '旅行' },
    { age: 50, stage: 'middle_age', eventId: 't_05', choiceIndex: 0, text: '行善' },
    { age: 60, stage: 'middle_age', eventId: 't_06', choiceIndex: 0, text: '拜佛' },
    { age: 70, stage: 'elder', eventId: 't_07', choiceIndex: 0, text: '打扮' },
  ];
  const chain = buildCausalChain(history);
  assert.strictEqual(chain.length, 6, '取效果最显著 6 条');
  assert.ok(chain.every(n => n.age >= 13), '13 岁前的童年选择不纳入');
  assert.deepStrictEqual(chain.map(n => n.age), [18, 25, 30, 40, 50, 60], '按年龄升序展示');
  assert.strictEqual(chain[0].title, 't_01', '20 点效果排最前');
  assert.ok(chain[0].change.includes('+20 财富'), '效果摘要含属性名');
});
