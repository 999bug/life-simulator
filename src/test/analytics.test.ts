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

  it('变体与功能计数各自累加', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'daily', pace: 'lite', challenge: false });
    track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
    track({ type: 'feature_use', ts: Date.now(), feature: 'share_card' });
    const { daily } = loadAnalytics();
    const today = Object.keys(daily)[0];
    expect(daily[today].variants.daily).toBe(1);
    expect(daily[today].features.share_card).toBe(2);
  });

  it('事件流超过 300 条裁掉最旧', () => {
    for (let i = 0; i < 305; i++) {
      track({ type: 'feature_use', ts: Date.now(), feature: 'guide' });
    }
    const { events } = loadAnalytics();
    expect(events.length).toBe(300);
    // 事件流只保留 300 条；日聚合按天归并，不截断
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

  it('导出载荷含事件流与日聚合', () => {
    track({ type: 'game_start', ts: Date.now(), variant: 'seed', pace: 'full', challenge: false });
    const payload = JSON.parse(buildExportPayload());
    expect(payload.daily).toBeTruthy();
    expect(payload.events.length).toBe(1);
  });
});
