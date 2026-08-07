import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { personalityEncounters, verdictBasis } from '../components/SummaryScreen';
import { setEvents } from '../engine/events';
import { EMPTY_PERSONA, type PersonaState } from '../engine/personality';
import type { Attributes, ChoiceRecord, GameState, LifeEvent } from '../types';

/** 构造终局状态（默认属性全 50 → 综合评分 50 分 → 平凡的一生） */
function makeGame(overrides: Partial<GameState>): GameState {
  return {
    gender: 'male',
    name: '测试',
    age: 70,
    stage: 'elder',
    stageIdx: 6,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
    ...overrides,
  };
}

/** 全部属性取同值的属性表（分数档测试用） */
function attrsAll(v: number): Attributes {
  return { health: v, intelligence: v, wealth: v, happiness: v, social: v, appearance: v, luck: v, morality: v };
}

describe('verdictBasis', () => {
  it('路线 flag 结局：返回路线中文名', () => {
    const game = makeGame({ flags: ['doctor'] });
    expect(verdictBasis(game, 50)).toBe('命中「医者仁心的一生」路线');
  });

  it('artist 路线：artist_pro / artist_life 任一命中', () => {
    expect(verdictBasis(makeGame({ flags: ['artist_life'] }), 50)).toBe('命中「艺术人生」路线');
  });

  it('多路线 flag 时按判定顺序取最先命中', () => {
    const game = makeGame({ flags: ['doctor', 'startup_success'] });
    expect(verdictBasis(game, 50)).toBe('命中「创业者的传奇」路线');
  });

  it('tech_career：智力 ≥ 60 构成路线结局，不足走分数档', () => {
    const high = makeGame({ flags: ['tech_career'], attributes: { ...attrsAll(50), intelligence: 70 } });
    expect(verdictBasis(high, 50)).toBe('命中「技术精英的一生」路线');
    const low = makeGame({ flags: ['tech_career'], attributes: { ...attrsAll(50), intelligence: 40 } });
    expect(verdictBasis(low, 50)).toBe('综合评分 50 分 · 平凡的一生');
  });

  it('分数档结局：综合评分 N 分 · 档名', () => {
    expect(verdictBasis(makeGame({ attributes: attrsAll(80) }), 80)).toBe('综合评分 80 分 · 辉煌的一生');
    expect(verdictBasis(makeGame({ attributes: attrsAll(50) }), 50)).toBe('综合评分 50 分 · 平凡的一生');
    expect(verdictBasis(makeGame({ attributes: attrsAll(20) }), 20)).toBe('综合评分 20 分 · 艰难的一生');
  });
});

describe('personalityEncounters', () => {
  // 注入与真实数据一致的 6 个性格专属事件（id/title/对应端阈值 6）
  const persEvents: LifeEvent[] = [
    { id: 'pers_0001', stage: 'middle_age', age: 57, title: '说走就走', text: 'x', category: 'personality', choices: [], conditions: { minPersonality: { adventurous: 6 } } },
    { id: 'pers_0002', stage: 'middle_age', age: 58, title: '被一首老歌击中', text: 'x', category: 'personality', choices: [], conditions: { minPersonality: { emotional: 6 } } },
    { id: 'pers_0003', stage: 'middle_age', age: 59, title: '深夜复盘', text: 'x', category: 'personality', choices: [], conditions: { minPersonality: { rational: 6 } } },
    { id: 'pers_0004', stage: 'middle_age', age: 60, title: '被需要的时刻', text: 'x', category: 'personality', choices: [], conditions: { minPersonality: { altruistic: 6 } } },
    { id: 'pers_0005', stage: 'middle_age', age: 62, title: '变故前的直觉', text: 'x', category: 'personality', choices: [], conditions: { minPersonality: { cautious: 6 } } },
    { id: 'pers_0006', stage: 'middle_age', age: 63, title: '到手的机会', text: 'x', category: 'personality', choices: [], conditions: { minPersonality: { selfish: 6 } } },
  ];

  beforeEach(() => {
    setEvents(persEvents);
  });

  afterEach(() => {
    setEvents([]);
  });

  it('已触发：history 中的 pers_ 事件按序输出标题', () => {
    const history: ChoiceRecord[] = [
      { age: 30, stage: 'young_adult', eventId: 'child_01', choiceIndex: 0, text: '普通事件' },
      { age: 57, stage: 'middle_age', eventId: 'pers_0001', choiceIndex: 0, text: '际遇' },
    ];
    const data = personalityEncounters(EMPTY_PERSONA, history);
    expect(data.triggered).toEqual(['说走就走']);
    expect(data.missed).toEqual([]);
  });

  it('未触发但性格足够鲜明：达标端提示差一点（当前 N/阈值）', () => {
    const persona: PersonaState = { ...EMPTY_PERSONA, adventurous: 6, emotional: 3 };
    const data = personalityEncounters(persona, []);
    expect(data.triggered).toEqual([]);
    expect(data.missed).toEqual([{ trait: 'adventurous', count: 6, threshold: 6 }]);
  });

  it('未达阈值不提示', () => {
    const persona: PersonaState = { ...EMPTY_PERSONA, adventurous: 5 };
    const data = personalityEncounters(persona, []);
    expect(data.missed).toEqual([]);
  });

  it('已触发的端不再提示差一点', () => {
    const persona: PersonaState = { ...EMPTY_PERSONA, adventurous: 6 };
    const history: ChoiceRecord[] = [
      { age: 57, stage: 'middle_age', eventId: 'pers_0001', choiceIndex: 0, text: '际遇' },
    ];
    const data = personalityEncounters(persona, history);
    expect(data.triggered).toEqual(['说走就走']);
    expect(data.missed).toEqual([]);
  });

  it('弱画像无触发无达标：返回空数据', () => {
    const data = personalityEncounters(EMPTY_PERSONA, []);
    expect(data.triggered).toEqual([]);
    expect(data.missed).toEqual([]);
  });
});
