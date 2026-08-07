/**
 * personas.ts 纯函数测试：好感度推导正负累积/钳位、未出场保持中性、事件缺失跳过、
 * 关系文案档位、人物表与事件标注一致性。
 * 运行：node --experimental-strip-types --test script/personas.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { setEvents } from '../src/engine/events.ts';
import { PERSONAS, personaBonds, personaRelationText } from '../src/engine/personas.ts';
import type { PersonaBonds } from '../src/engine/personas.ts';
import type { ChoiceRecord, LifeEvent } from '../src/types/index.ts';

/** 带人物标注的事件形状（LifeEvent 类型未收录 persona 字段，运行时由转换器透传） */
interface PersonaLike extends LifeEvent {
  persona?: string;
}

/** 构造带人物标注的合成事件：选项净收益即指定值 */
function mkEvent(id: string, persona: string, nets: number[]): LifeEvent {
  return {
    id, stage: 'childhood', age: 3, text: 't', category: 'friend',
    choices: nets.map(net => ({ text: 'c', effects: '', outcomes: { attr: { happiness: net } } })),
    persona,
  } as LifeEvent;
}

/** 构造一条选择记录 */
function h(eventId: string, choiceIndex: number): ChoiceRecord {
  return { age: 3, stage: 'childhood', eventId, choiceIndex, text: 'c' };
}

test('personaBonds：正/负选择按净收益累积 ±5，零净收益不影响', () => {
  setEvents([
    mkEvent('ev_buddy_pos', 'p_buddy', [10]),
    mkEvent('ev_buddy_neg', 'p_buddy', [-8]),
    mkEvent('ev_buddy_zero', 'p_buddy', [0]),
  ]);
  // 正向 +5
  let bonds = personaBonds([h('ev_buddy_pos', 0)]);
  assert.strictEqual(bonds.p_buddy, 55);
  // 正向两次累积 +10
  bonds = personaBonds([h('ev_buddy_pos', 0), h('ev_buddy_pos', 0)]);
  assert.strictEqual(bonds.p_buddy, 60);
  // 负向 -5
  bonds = personaBonds([h('ev_buddy_neg', 0)]);
  assert.strictEqual(bonds.p_buddy, 45);
  // 净收益为 0 的选择不影响
  bonds = personaBonds([h('ev_buddy_zero', 0)]);
  assert.strictEqual(bonds.p_buddy, 50);
});

test('personaBonds：未出场人物保持中性 50，互不干扰', () => {
  setEvents([mkEvent('ev_buddy_pos', 'p_buddy', [10])]);
  const bonds: PersonaBonds = personaBonds([h('ev_buddy_pos', 0)]);
  assert.strictEqual(bonds.p_buddy, 55);
  for (const def of PERSONAS) {
    if (def.id !== 'p_buddy') {
      assert.strictEqual(bonds[def.id], 50, `${def.name} 未出场应保持 50`);
    }
  }
});

test('personaBonds：事件缺失/非人物事件/未知人物标注均跳过不报错', () => {
  setEvents([
    mkEvent('ev_plain', '', [10]),
    mkEvent('ev_ghost_persona', 'p_ghost', [10]),
  ]);
  const bonds = personaBonds([
    h('ghost_event', 0),       // 事件表不存在
    h('ev_plain', 0),          // 无人物标注
    h('ev_ghost_persona', 0),  // 标注的人物不在人物表
  ]);
  for (const def of PERSONAS) {
    assert.strictEqual(bonds[def.id], 50, `${def.name} 应保持中性`);
  }
});

test('personaBonds：好感度钳位在 0-100', () => {
  setEvents([mkEvent('ev_buddy_pos', 'p_buddy', [10])]);
  // 11 次正向 → 50 + 55 = 105 → 钳到 100
  const many = Array.from({ length: 11 }, () => h('ev_buddy_pos', 0));
  assert.strictEqual(personaBonds(many).p_buddy, 100);
  // 11 次负向 → 50 - 55 = -5 → 钳到 0
  setEvents([mkEvent('ev_buddy_neg', 'p_buddy', [-10])]);
  const manyNeg = Array.from({ length: 11 }, () => h('ev_buddy_neg', 0));
  assert.strictEqual(personaBonds(manyNeg).p_buddy, 0);
});

test('personaRelationText：各档关系文案正确', () => {
  assert.strictEqual(personaRelationText(100), '形影不离');
  assert.strictEqual(personaRelationText(80), '形影不离');
  assert.strictEqual(personaRelationText(79), '交心好友');
  assert.strictEqual(personaRelationText(60), '交心好友');
  assert.strictEqual(personaRelationText(59), '点头之交');
  assert.strictEqual(personaRelationText(40), '点头之交');
  assert.strictEqual(personaRelationText(39), '渐行渐远');
  assert.strictEqual(personaRelationText(25), '渐行渐远');
  assert.strictEqual(personaRelationText(24), '形同陌路');
  assert.strictEqual(personaRelationText(0), '形同陌路');
});

test('PERSONAS：6 人齐全、id 唯一、出场事件标注与 events.json 双向一致', () => {
  // 人物表结构：id 唯一，每人 4 个出场事件
  assert.strictEqual(PERSONAS.length, 6);
  const ids = PERSONAS.map(def => def.id);
  assert.strictEqual(new Set(ids).size, 6, '人物 id 必须唯一');
  for (const def of PERSONAS) {
    assert.ok(def.name, `${def.id} 缺名字`);
    assert.ok(def.icon, `${def.id} 缺图标`);
    assert.ok(def.role, `${def.id} 缺人设`);
    assert.strictEqual(def.events.length, 4, `${def.name} 应有 4 个出场事件`);
  }
  // 注入真实事件数据（persona 字段由 npm run build:events 从 chiled.json 透传）
  const real = JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')) as PersonaLike[];
  setEvents(real);
  // 表 → 数据：每个出场事件存在且标注一致
  for (const def of PERSONAS) {
    for (const id of def.events) {
      const ev = real.find(e => e.id === id);
      assert.ok(ev, `${def.name} 出场事件 ${id} 不在 events.json 中`);
      assert.strictEqual(ev.persona, def.id, `事件 ${id} 的 persona 标注应为 ${def.id}`);
    }
  }
  // 数据 → 表：所有带标注的事件都能映射到人物表（共 24 个）
  const annotated = real.filter(e => e.persona !== undefined);
  assert.strictEqual(annotated.length, 24, 'events.json 应有 24 个带 persona 标注的事件');
  for (const ev of annotated) {
    assert.ok(PERSONAS.some(def => def.id === ev.persona), `事件 ${ev.id} 标注的人物 ${ev.persona} 不在人物表`);
  }
});
