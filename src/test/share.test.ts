import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { buildChallengeUrl, buildShareText, parseChallengeLink } from '../utils/share';

function minimalGame(age = 80): GameState {
  return {
    gender: 'male',
    name: '小明',
    age,
    stage: 'elder',
    stageIdx: 6,
    attributes: { health: 80, intelligence: 80, wealth: 80, happiness: 80, social: 80, appearance: 80, luck: 80, morality: 80 },
    flags: [],
    history: [],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
  };
}

describe('share utils', () => {
  it('buildChallengeUrl 无查询串时以 ? 拼接种子', () => {
    expect(buildChallengeUrl({ seed: 123 }, 'https://x.example/')).toBe('https://x.example/?seed=123');
  });

  it('buildChallengeUrl 已有查询串时以 & 拼接种子', () => {
    expect(buildChallengeUrl({ seed: 123 }, 'https://x.example/?a=1')).toBe('https://x.example/?a=1&seed=123');
  });

  it('buildChallengeUrl 编码发起人对决信息', () => {
    const url = buildChallengeUrl({ seed: 123, from: '小明', score: 78, age: 82, title: '辉煌的一生' }, 'https://x.example/');
    expect(url).toContain('seed=123');
    expect(url).toContain('from=');
    expect(url).toContain('score=78');
    expect(url).toContain('age=82');
    expect(url).toContain('title=');
  });

  it('parseChallengeLink 解析发起人对决信息', () => {
    expect(parseChallengeLink('?seed=123&from=alice&score=78&age=82&title=great'))
      .toEqual({ seed: 123, from: 'alice', score: 78, age: 82, title: 'great' });
  });

  it('parseChallengeLink 缺种子/非法种子/超界返回 null', () => {
    expect(parseChallengeLink('')).toBeNull();
    expect(parseChallengeLink('?seed=abc')).toBeNull();
    expect(parseChallengeLink('?seed=9999999999')).toBeNull();
  });

  it('buildShareText 含享年、结局与种子', () => {
    const text = buildShareText(minimalGame(82), '辉煌的一生', 123);
    expect(text).toContain('享年 82 岁');
    expect(text).toContain('辉煌的一生');
    expect(text).toContain('种子 123');
  });

  it('buildShareText 无种子时用默认传播文案', () => {
    const text = buildShareText(minimalGame(), '平凡的一生');
    expect(text).toContain('如果重来一次，你会怎么选？');
    expect(text).not.toContain('种子');
  });
});
