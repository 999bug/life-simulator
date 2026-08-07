import { describe, expect, it } from 'vitest';
import { CHANGELOG, LATEST_VERSION } from '../data/changelog';

describe('CHANGELOG 更新日志数据', () => {
  it('至少有一个版本条目且最新版本号可读', () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(1);
    expect(LATEST_VERSION).toBe(CHANGELOG[0].version);
  });

  it('版本号唯一且按时间降序（最新在上）', () => {
    const versions = CHANGELOG.map(e => e.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 0; i < CHANGELOG.length - 1; i++) {
      expect(CHANGELOG[i].date >= CHANGELOG[i + 1].date).toBe(true);
    }
  });

  it('每条含日期/标题/非空要点列表', () => {
    for (const entry of CHANGELOG) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.items.length).toBeGreaterThan(0);
      for (const item of entry.items) {
        expect(item.length).toBeGreaterThan(0);
      }
    }
  });
});
