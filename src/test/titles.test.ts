import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { deriveTitle } from '../engine/titles';
import { deathOneLiner } from '../engine/deaths';

function game(): GameState {
  return {
    gender: 'male',
    name: '小明',
    age: 80,
    stage: 'elder',
    stageIdx: 6,
    attributes: { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 },
    flags: [],
    history: [],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
  };
}

describe('deriveTitle', () => {
  it('路线结局给专属称号', () => {
    expect(deriveTitle(game(), 'escaped')).toBe('亡命之徒');
    expect(deriveTitle(game(), 'doctor')).toBe('白衣天使');
  });

  it('高财富给隐形富豪（非路线结局）', () => {
    const g = game();
    g.attributes.wealth = 90;
    expect(deriveTitle(g, 'score:60+')).toBe('隐形富豪');
  });

  it('无路线无财富无性格时按评分档兜底', () => {
    expect(deriveTitle(game(), 'score:50+')).toBe('平凡英雄');
  });
});

describe('deathOneLiner', () => {
  it('五类死法都有文案且含享年', () => {
    for (const cause of ['health', 'lifespan', 'accident', 'illness', 'overwork'] as const) {
      const line = deathOneLiner(cause, 70);
      expect(line.length).toBeGreaterThan(0);
      expect(line).toContain('70');
    }
  });

  it('空死因兜底为寿终', () => {
    expect(deathOneLiner(null, 80)).toContain('寿终正寝');
  });
});
