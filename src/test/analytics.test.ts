import { describe, it, expect, beforeEach } from 'vitest';
import { track, loadAnalytics, buildExportPayload, EVENTS_KEY, DAILY_KEY } from '../utils/analytics';

beforeEach(() => localStorage.clear());

describe('analytics track', () => {
  it('记录开局后当日聚合 starts 累加', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'normal', pace: 'full', challenge: false });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].starts).toBe(1);
  });

  it('结算累加 finishes/ageSum 与结局分布', () => {
    track({ type: 'game_finish', ts: Date.now(), score: 70, age: 60, endingKey: 'top_university' });
    track({ type: 'game_finish', ts: Date.now(), score: 55, age: 40, endingKey: 'top_university' });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].finishes).toBe(2);
    expect(daily[today].ageSum).toBe(100);
    expect(daily[today].endings.top_university).toBe(2);
  });

  it('中途放弃累加 abandons 并写入事件流', () => {
    const ts = Date.now();
    track({ type: 'game_abandon', ts, age: 30 });
    const { events, daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].abandons).toBe(1);
    expect(events).toContainEqual({ type: 'game_abandon', ts, age: 30 });
  });

  it('变体与功能计数各自累加', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'daily', pace: 'lite', challenge: false });
    track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
    track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].variants.daily).toBe(1);
    expect(daily[today].features.share_card).toBe(2);
  });

  it('事件流超过 300 条裁掉最旧，日聚合不截断', () => {
    // 第一条用特征事件（旧 ts + 独立 feature），其后 304 条 guide 事件
    const firstTs = 1700000000000;
    track({ type: 'feature_use', ts: firstTs, feature: 'seed' });
    let lastTs = 0;
    for (let i = 1; i <= 304; i++) {
      lastTs = firstTs + i;
      track({ type: 'feature_use', ts: lastTs, feature: 'guide' });
    }
    const { events, daily } = loadAnalytics();
    expect(events.length).toBe(300);
    // 被裁的是最旧的 5 条：首条 seed 事件已不在，最后一条仍保留
    expect(events.some(e => e.type === 'feature_use' && e.feature === 'seed' && e.ts === firstTs)).toBe(false);
    expect(events.some(e => e.type === 'feature_use' && e.ts === lastTs)).toBe(true);
    // 日聚合按天归并不截断：guide 累计 304 次，且被裁的 seed 事件也仍在日聚合中
    const today = Object.keys(daily)[0];
    expect(daily[today].features.guide).toBe(304);
    expect(daily[today].features.seed).toBe(1);
  });

  it('跨天事件分属不同聚合条目', () => {
    const yesterday = Date.now() - 86400000;
    track({ type: 'game_start', ts: yesterday, variant: 'normal', pace: 'full', challenge: false });
    track({ type: 'game_start', ts: Date.now(), variant: 'normal', pace: 'full', challenge: false });
    const { daily } = loadAnalytics();
    expect(Object.keys(daily).length).toBe(2);
  });

  it('损坏数据返回空结构', () => {
    localStorage.setItem(EVENTS_KEY, 'not-json{{{');
    localStorage.setItem(DAILY_KEY, '[]');
    const { events, daily } = loadAnalytics();
    expect(events).toEqual([]);
    expect(daily).toEqual({});
  });

  it('日聚合含畸形条目时逐条过滤（面板 sumDaily 不崩溃）', () => {
    localStorage.setItem(DAILY_KEY, JSON.stringify({
      '20260806': { starts: 1, finishes: 0, abandons: 0, ageSum: 0, endings: {}, variants: {}, features: {} },
      '20260805': null,
      '20260804': 42,
      '20260803': 'oops',
      '20260802': [1, 2],
      '20260801': { starts: 1, endings: null, variants: {}, features: {} },
    }));
    const { daily } = loadAnalytics();
    expect(Object.keys(daily)).toEqual(['20260806']);
  });

  it('导出载荷含事件流与日聚合', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'seed', pace: 'full', challenge: false });
    const payload = JSON.parse(buildExportPayload());
    expect(payload.daily).toBeTruthy();
    expect(payload.events.length).toBe(1);
  });
});
