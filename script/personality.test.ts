/**
 * personality.ts 纯函数测试：性格映射规则、flag 补充规则、历史推导累积、概括句生成。
 * 运行：node --experimental-strip-types --test script/personality.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traitForOutcome, derivePersona, personaSummary, EMPTY_PERSONA } from '../src/engine/personality.ts';
import { setEvents } from '../src/engine/events.ts';
import type { ChoiceRecord, LifeEvent } from '../src/types/index.ts';

/** 注入最小事件表（测试自包含，不依赖真实数据内容） */
const TEST_EVENTS: LifeEvent[] = [
  {
    id: 't_01', stage: 'teen', age: 18, category: 'education', text: '选择时刻',
    choices: [
      { text: '熬夜刷题', effects: '', outcomes: { attr: { intelligence: 8, happiness: -4 } } },
      { text: '去看演出', effects: '', outcomes: { attr: { happiness: 8, intelligence: -4 } } },
      { text: '押上积蓄创业', effects: '', outcomes: { attr: { wealth: 15, happiness: -10 } } },
      { text: '挪用公款', effects: '', outcomes: { attr: { wealth: 10, morality: -6 } } },
      { text: '做志愿者', effects: '', outcomes: { attr: { morality: 8 } } },
      { text: '平淡度过', effects: '', outcomes: { attr: { happiness: 3 } } },
      { text: '休学一年', effects: '', outcomes: { attr: { happiness: 2 }, flags: ['gap_year'] } },
    ],
  },
  {
    id: 't_02', stage: 'adult', age: 30, category: 'career', text: '职场',
    choices: [
      { text: '稳扎稳打', effects: '', outcomes: { attr: { wealth: 5, happiness: 3 } } },
    ],
  },
];
setEvents(TEST_EVENTS);

/** 构造 t_01 的选择记录（choiceIndex 参数化） */
function rec(choiceIndex: number, age = 18): ChoiceRecord {
  return { age, stage: 'teen', eventId: 't_01', choiceIndex, text: 'x' };
}

// ============ traitForOutcome：效果结构规则 ============

test('traitForOutcome：理性——智力强正且幸福不涨', () => {
  assert.deepStrictEqual(traitForOutcome({ intelligence: 8, happiness: -4 }), ['rational']);
});

test('traitForOutcome：理性边界——智力 6 命中、5 不中', () => {
  assert.deepStrictEqual(traitForOutcome({ intelligence: 6, happiness: 0 }), ['rational']);
  assert.deepStrictEqual(traitForOutcome({ intelligence: 5, happiness: 0 }), []);
});

test('traitForOutcome：感性——幸福强正且智力不涨', () => {
  assert.deepStrictEqual(traitForOutcome({ happiness: 8, intelligence: -4 }), ['emotional']);
});

test('traitForOutcome：冒险——负向与正向总额均达阈值（有得有失才算下注）', () => {
  assert.deepStrictEqual(traitForOutcome({ wealth: 15, happiness: -10 }), ['adventurous']);
  // 只有单边大额不构成冒险
  assert.deepStrictEqual(traitForOutcome({ wealth: 15 }), []);
});

test('traitForOutcome：利己——财富强正且道德不涨', () => {
  assert.deepStrictEqual(traitForOutcome({ wealth: 10, morality: -6 }), ['selfish']);
  // 财富强正但道德也正 → 只标利他
  assert.deepStrictEqual(traitForOutcome({ wealth: 10, morality: 8 }), ['altruistic']);
});

test('traitForOutcome：利他——道德强正', () => {
  assert.deepStrictEqual(traitForOutcome({ morality: 8 }), ['altruistic']);
});

test('traitForOutcome：双端命中（冒险 + 利己）', () => {
  assert.deepStrictEqual(
    traitForOutcome({ wealth: 15, happiness: -10, morality: -2 }),
    ['adventurous', 'selfish'],
  );
});

test('traitForOutcome：无信号返回空（小收益平淡选择不标注）', () => {
  assert.deepStrictEqual(traitForOutcome({ happiness: 3 }), []);
  assert.deepStrictEqual(traitForOutcome({}), []);
});

// ============ traitForOutcome：flag 补充规则 ============

test('traitForOutcome：flag 补充规则（休学一年 → 冒险）', () => {
  assert.deepStrictEqual(traitForOutcome({ happiness: 2 }, ['gap_year']), ['adventurous']);
});

test('traitForOutcome：flag 与效果叠加去重（志愿者 + 道德正 → 单个利他）', () => {
  assert.deepStrictEqual(traitForOutcome({ morality: 8 }, ['volunteer']), ['altruistic']);
});

test('traitForOutcome：未知 flag 不标注', () => {
  assert.deepStrictEqual(traitForOutcome({ happiness: 3 }, ['has_pet']), []);
});

test('traitForOutcome：手工标注优先，不做自动推导叠加（安稳端唯一来源）', () => {
  // 效果弱无自动信号，手工标注 → 安稳
  assert.deepStrictEqual(traitForOutcome({ happiness: 2 }, [], ['cautious']), ['cautious']);
  // 效果强（本会标冒险），手工标注后只按标注走
  assert.deepStrictEqual(traitForOutcome({ wealth: 15, happiness: -10 }, [], ['rational']), ['rational']);
  // 去重 + 白名单过滤（非法值忽略）
  assert.deepStrictEqual(traitForOutcome({}, [], ['altruistic', 'altruistic', 'brave']), ['altruistic']);
});

// ============ derivePersona：历史推导 ============

test('derivePersona：按历史逐条累积', () => {
  // 选项 0 理性 / 选项 3 利己 / 选项 4 利他
  const persona = derivePersona([rec(0), rec(3), rec(4)]);
  assert.strictEqual(persona.rational, 1);
  assert.strictEqual(persona.selfish, 1);
  assert.strictEqual(persona.altruistic, 1);
  assert.strictEqual(persona.adventurous, 0);
});

test('derivePersona：被精简删除的事件跳过（旧存档兼容）', () => {
  const persona = derivePersona([
    rec(0),
    { age: 25, stage: 'adult', eventId: 'ghost_01', choiceIndex: 0, text: 'x' },
  ]);
  assert.strictEqual(persona.rational, 1);
});

test('derivePersona：choiceIndex 越界跳过', () => {
  assert.deepStrictEqual(derivePersona([rec(99)]), EMPTY_PERSONA);
});

test('derivePersona：空历史返回全 0', () => {
  assert.deepStrictEqual(derivePersona([]), EMPTY_PERSONA);
});

// ============ personaSummary：概括句 ============

test('personaSummary：总分不足不成形', () => {
  assert.strictEqual(personaSummary(EMPTY_PERSONA), '这一生没有留下鲜明的性格印记');
  assert.strictEqual(personaSummary({ ...EMPTY_PERSONA, adventurous: 1 }), '这一生没有留下鲜明的性格印记');
});

test('personaSummary：单一端用自身名词', () => {
  const p = { ...EMPTY_PERSONA, adventurous: 5 };
  assert.strictEqual(personaSummary(p), '一个大胆无畏的冒险家');
});

test('personaSummary：跨维 Top2 组合（冒险 + 感性 → 浪漫主义者）', () => {
  const p = { ...EMPTY_PERSONA, adventurous: 5, emotional: 3 };
  assert.strictEqual(personaSummary(p), '一个大胆无畏的浪漫主义者');
});

test('personaSummary：同维对冲端用自身名词', () => {
  const p = { ...EMPTY_PERSONA, rational: 5, emotional: 2 };
  assert.strictEqual(personaSummary(p), '一个理智清醒的思考者');
});
