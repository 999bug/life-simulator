import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { buildLifeExport, parseLifeExport } from '../engine/compare';

function minimalGame(): GameState {
  return {
    gender: 'male',
    name: '小明',
    age: 80,
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

describe('life export/import', () => {
  it('buildLifeExport 生成完整档案', () => {
    const life = buildLifeExport(minimalGame(), '辉煌的一生', 123, '20260813');
    expect(life.name).toBe('小明');
    expect(life.age).toBe(80);
    expect(life.seed).toBe(123);
    expect(life.endingTitle).toBe('辉煌的一生');
    expect(life.date).toBe('20260813');
    expect(typeof life.score).toBe('number');
    expect(life.attributes.health).toBe(80);
  });

  it('parseLifeExport 往返一致', () => {
    const life = buildLifeExport(minimalGame(), '平凡的一生', 456, '20260813');
    expect(parseLifeExport(JSON.stringify(life))).toEqual(life);
  });

  it('parseLifeExport 拒绝损坏/非法档案', () => {
    expect(parseLifeExport('')).toBeNull();
    expect(parseLifeExport('not-json')).toBeNull();
    expect(parseLifeExport(JSON.stringify({ app: 'other' }))).toBeNull();
    const bad = buildLifeExport(minimalGame(), 'x', undefined, '20260813');
    bad.attributes = { ...bad.attributes, health: 'bad' as unknown as number };
    expect(parseLifeExport(JSON.stringify(bad))).toBeNull();
  });
});
