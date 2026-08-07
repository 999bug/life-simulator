/**
 * 人生系统推导单元测试（职业 / 家人关系 / 高考 / 资产）。
 * 全部为从 GameState 推导的纯函数：不占用存档字段，旧存档与回看自动兼容。
 *
 * 运行：node --experimental-strip-types --test script/life-systems.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { jobLevel, jobStatus } from '../src/engine/jobs.ts';
import { npcBonds } from '../src/engine/npcs.ts';
import { gaokaoResult } from '../src/engine/gaokao.ts';
import { assetStatus } from '../src/engine/assets.ts';
import type { GameState, LifeEvent } from '../src/types/index.ts';
import { setEvents } from '../src/engine/events.ts';

/** 构造测试用历史事件（含分类与选项效果，供好感统计） */
function evt(id: string, category: LifeEvent['category'], outcomes: Array<{ text: string; attr: Record<string, number> }>): LifeEvent {
  return {
    id,
    stage: 'adult',
    age: 30,
    category,
    text: id,
    choices: outcomes.map(o => ({ text: o.text, effects: '', outcomes: { attr: o.attr } })),
  };
}

const events: LifeEvent[] = [
  evt('fam_pos', 'family', [{ text: '陪伴', attr: { happiness: 8 } }, { text: '冷落', attr: { happiness: -6 } }]),
  evt('love_pos', 'love', [{ text: '珍惜', attr: { happiness: 5 } }, { text: '背叛', attr: { happiness: -10 } }]),
  evt('fri_pos', 'friend', [{ text: '赴约', attr: { social: 6 } }, { text: '爽约', attr: { social: -4 } }]),
  evt('other', 'career', [{ text: '工作', attr: { wealth: 5 } }]),
];
setEvents(events);

/** 构造终局状态（history 用测试事件） */
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gender: 'male',
    name: '测试',
    age: 40,
    stage: 'adult',
    stageIdx: 4,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
    ...overrides,
  };
}

// ============ 职业 ============

test('jobStatus：无职业 flag 返回 null', () => {
  assert.strictEqual(jobStatus(game()), null);
});

test('jobStatus：flag 命中职业，入行年龄取历史首次产出', () => {
  const g = game({
    flags: ['doctor'],
    history: [
      { age: 22, stage: 'adult', eventId: 'other', choiceIndex: 0, text: '入职', flags: ['doctor'] },
      { age: 30, stage: 'adult', eventId: 'other', choiceIndex: 0, text: '升职' },
    ],
  });
  const job = jobStatus(g);
  assert.strictEqual(job?.title, '医生');
  assert.strictEqual(job?.since, 22);
  assert.strictEqual(job?.years, 18);
});

test('jobStatus：旧存档历史无 flags 字段时 since 为 null（等级兜底 1）', () => {
  const g = game({
    flags: ['doctor'],
    history: [{ age: 22, stage: 'adult', eventId: 'other', choiceIndex: 0, text: '入职' }],
  });
  const job = jobStatus(g);
  assert.strictEqual(job?.title, '医生');
  assert.ok(job !== null && job.since !== null, '有历史记录时仍可近似到入行年龄');
});

test('jobLevel：每 3 年一级，保底 1 级', () => {
  assert.strictEqual(jobLevel(0), 1);
  assert.strictEqual(jobLevel(2), 1);
  assert.strictEqual(jobLevel(3), 2);
  assert.strictEqual(jobLevel(11), 4);
  assert.strictEqual(jobLevel(30), 11);
});

// ============ 家人关系 ============

test('npcBonds：无相关记录时三条线均为中性 50', () => {
  const b = npcBonds(game());
  assert.deepStrictEqual(b, { family: 50, partner: 50, friends: 50 });
});

test('npcBonds：正向选择 +5、负向选择 -5、无关事件不计', () => {
  const g = game({
    history: [
      { age: 30, stage: 'adult', eventId: 'fam_pos', choiceIndex: 0, text: '陪伴' },
      { age: 31, stage: 'adult', eventId: 'fam_pos', choiceIndex: 1, text: '冷落' },
      { age: 32, stage: 'adult', eventId: 'love_pos', choiceIndex: 0, text: '珍惜' },
      { age: 33, stage: 'adult', eventId: 'other', choiceIndex: 0, text: '工作' },
    ],
  });
  const b = npcBonds(g);
  assert.strictEqual(b.family, 50); // +5 -5 抵消
  assert.strictEqual(b.partner, 55);
  assert.strictEqual(b.friends, 50);
});

test('npcBonds：钳位 0-100', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    age: 30 + i,
    stage: 'adult' as const,
    eventId: 'fam_pos',
    choiceIndex: 1,
    text: '冷落',
  }));
  const b = npcBonds(game({ history: many }));
  assert.strictEqual(b.family, 0);
});

// ============ 高考 ============

test('gaokaoResult：按学业 flag 优先级取最高档', () => {
  assert.strictEqual(gaokaoResult(game())?.label, undefined);
  assert.strictEqual(gaokaoResult(game({ flags: ['went_to_college'] }))?.label, '考上大学');
  assert.strictEqual(gaokaoResult(game({ flags: ['top_university'] }))?.label, '考入重点大学');
  assert.strictEqual(gaokaoResult(game({ flags: ['retake'] }))?.label, '复读后上岸');
  assert.strictEqual(gaokaoResult(game({ flags: ['skilled_worker'] }))?.label, '职校毕业');
  assert.strictEqual(gaokaoResult(game({ flags: ['went_to_college', 'top_university'] }))?.label, '考入重点大学');
});

// ============ 资产 ============

test('assetStatus：投资链递进只取最高档', () => {
  const assets = assetStatus(game({ flags: ['investor'] }));
  assert.ok(assets.some(a => a.label === '初具规模的投资'), '投资档位存在');
  assert.ok(!assets.some(a => a.label === '成熟的股票投资'), '低级投资不重复出现');
  const sharp = assetStatus(game({ flags: ['investor', 'investor_sharp'] }));
  assert.ok(sharp.some(a => a.label === '成熟的股票投资'), '投资链取最高档');
  assert.ok(!sharp.some(a => a.label === '初具规模的投资'), '低档被高档替代');
  const combo = assetStatus(game({ flags: ['investor', 'startup_success'] }));
  assert.ok(combo.some(a => a.label === '自有公司'), '实业与投资并列');
});

test('assetStatus：无资产 flag 时按财富档给存款描述', () => {
  const rich = assetStatus(game({ attributes: { ...game().attributes, wealth: 90 } }));
  assert.ok(rich.some(a => a.label === '丰厚存款'));
  const mid = assetStatus(game({ attributes: { ...game().attributes, wealth: 55 } }));
  assert.ok(mid.some(a => a.label === '小有积蓄'));
  const poor = assetStatus(game({ attributes: { ...game().attributes, wealth: 10 } }));
  assert.strictEqual(poor.length, 0);
});
