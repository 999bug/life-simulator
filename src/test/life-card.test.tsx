import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LifeCardModal, { buildLifeCardData } from '../components/LifeCardModal';
import { setEvents } from '../engine/events';
import type { Attributes, GameState, LifeEvent } from '../types';

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

/** 全部属性取同值的属性表 */
function attrsAll(v: number): Attributes {
  return { health: v, intelligence: v, wealth: v, happiness: v, social: v, appearance: v, luck: v, morality: v };
}

/** 带手工性格标注的测试事件（强画像测试注入用） */
const PERS_EVENT: LifeEvent = {
  id: 'test_pers_01',
  stage: 'young_adult',
  age: 25,
  title: '测试际遇',
  text: 'x',
  category: 'personality',
  choices: [{ text: '出发', effects: '', outcomes: { attr: {}, personality: ['adventurous'] } }],
};

beforeEach(() => {
  setEvents([PERS_EVENT]);
});

afterEach(() => {
  setEvents([]);
});

describe('buildLifeCardData', () => {
  it('基础组装：名字/性别/结局/评分/日期/8 属性齐全', () => {
    const game = makeGame({ attributes: attrsAll(50) });
    const data = buildLifeCardData(game, 50, '平凡的一生', undefined, undefined, '20260807');
    expect(data.name).toBe('测试');
    expect(data.genderIcon).toBe('♂');
    expect(data.verdictTitle).toBe('平凡的一生');
    expect(data.score).toBe(50);
    expect(data.date).toBe('2026-08-07');
    expect(data.attrs).toHaveLength(8);
    // 属性按终局属性表顺序（两列四行：前 4 个左列，后 4 个右列）
    expect(data.attrs.map(a => a.key)).toEqual(['health', 'intelligence', 'wealth', 'happiness', 'social', 'appearance', 'luck', 'morality']);
    expect(data.attrs[0]).toMatchObject({ key: 'health', icon: '💪', name: '健康', value: 50, color: '#e85d75' });
  });

  it('女性显示 ♀', () => {
    const data = buildLifeCardData(makeGame({ gender: 'female' }), 50, '平凡的一生', undefined, undefined, '20260807');
    expect(data.genderIcon).toBe('♀');
  });

  it('世代：传入显示「第 N 代」，空值不显示', () => {
    expect(buildLifeCardData(makeGame({}), 50, '平凡的一生', undefined, 3, '20260807').generationLabel).toBe('第 3 代');
    expect(buildLifeCardData(makeGame({}), 50, '平凡的一生', undefined, null, '20260807').generationLabel).toBe('');
    expect(buildLifeCardData(makeGame({}), 50, '平凡的一生', undefined, undefined, '20260807').generationLabel).toBe('');
  });

  it('弱画像（无选择记录）：性格行显示「性格仍在书写中」', () => {
    const data = buildLifeCardData(makeGame({ history: [] }), 50, '平凡的一生', undefined, undefined, '20260807');
    expect(data.personaLine).toBe('性格仍在书写中');
  });

  it('画像成形（累计 ≥ 2 次）：性格行显示概括句', () => {
    // 同事件选择两次 → adventurous 累计 2 次 → 成形
    const game = makeGame({
      history: [
        { age: 25, stage: 'young_adult', eventId: 'test_pers_01', choiceIndex: 0, text: '出发' },
        { age: 26, stage: 'young_adult', eventId: 'test_pers_01', choiceIndex: 0, text: '再出发' },
      ],
    });
    const data = buildLifeCardData(game, 50, '平凡的一生', undefined, undefined, '20260807');
    expect(data.personaLine).toBe('一个大胆无畏的冒险家');
  });

  it('底部行：享年 + 日期；种子传入时含种子码', () => {
    const base = buildLifeCardData(makeGame({}), 50, '平凡的一生', undefined, undefined, '20260807');
    expect(base.footer).toBe('享年 70 岁 · 2026-08-07');
    const withSeed = buildLifeCardData(makeGame({}), 50, '平凡的一生', 12345, undefined, '20260807');
    expect(withSeed.footer).toBe('享年 70 岁 · 🔑 种子 12345 · 2026-08-07');
  });
});

describe('LifeCardModal 渲染', () => {
  it('渲染画布与下载/关闭按钮', () => {
    render(
      <LifeCardModal
        game={makeGame({})}
        score={50}
        verdictTitle="平凡的一生"
        seed={12345}
        generation={3}
        onClose={() => {}}
      />,
    );
    // canvas 存在（jsdom 无 2d context，绘制静默降级不报错）
    expect(document.querySelector('canvas')).not.toBeNull();
    expect(screen.getByText('下载 PNG')).not.toBeNull();
    expect(screen.getByText('关闭')).not.toBeNull();
  });

  it('点击关闭触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <LifeCardModal
        game={makeGame({})}
        score={50}
        verdictTitle="平凡的一生"
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击下载 PNG 触发画布导出', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
    render(
      <LifeCardModal
        game={makeGame({})}
        score={50}
        verdictTitle="平凡的一生"
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('下载 PNG'));
    expect(spy).toHaveBeenCalledWith('image/png');
    spy.mockRestore();
  });
});
