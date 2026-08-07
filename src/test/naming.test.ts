import { describe, expect, it } from 'vitest';
import { useName } from '../utils/naming';
import { isRetired, retirementAge } from '../engine/retirement';
import { buildCompanionEvent } from '../engine/companion';
import type { GameState } from '../types';

describe('useName 称呼替换', () => {
  it('事件文本「你」替换为名字', () => {
    expect(useName('你踩着一路风雪来到这个世界', '小明')).toBe('小明踩着一路风雪来到这个世界');
  });

  it('跳过「你们」「你自己」', () => {
    expect(useName('你们一起长大', '小明')).toBe('你们一起长大');
    expect(useName('你自己决定', '小明')).toBe('你自己决定');
  });

  it('空名字原样返回', () => {
    expect(useName('你好', '')).toBe('你好');
  });
});

describe('retirementAge 退休年龄', () => {
  it('女性 55 / 男性 60', () => {
    expect(retirementAge('female')).toBe(55);
    expect(retirementAge('male')).toBe(60);
  });
});

/** 构造游戏状态 */
function game(overrides: Partial<GameState> = {}): GameState {
  return {
    gender: 'male',
    name: '测试',
    age: 50,
    stage: 'adult',
    stageIdx: 4,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'playing',
    deathCause: null,
    goal: null,
    ...overrides,
  };
}

describe('isRetired', () => {
  it('按性别年龄线退休', () => {
    expect(isRetired(game({ gender: 'female', age: 55 }))).toBe(true);
    expect(isRetired(game({ age: 59 }))).toBe(false);
    expect(isRetired(game({ age: 60 }))).toBe(true);
  });

  it('retired flag 直接退休', () => {
    expect(isRetired(game({ flags: ['retired'] }))).toBe(true);
  });
});

describe('buildCompanionEvent 伴侣互动', () => {
  it('love 分类 + 年龄步长确定性', () => {
    const e = buildCompanionEvent(25);
    expect(e.category).toBe('love');
    expect(e.age).toBe(25);
    expect(e.id.startsWith('companion_')).toBe(true);
    expect(buildCompanionEvent(25).id).toBe(e.id);
  });
});
