import type { LifeStage } from '../types';

// 存储键：原始事件流 + 按日聚合
export const EVENTS_KEY = 'life-sim-analytics-events';
export const DAILY_KEY = 'life-sim-analytics-daily';

/** 日期 → YYYYMMDD（本地时区，与 useGame.formatDate 同格式） */
function formatDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${month}${day}`;
}

/** 原始事件流上限：超过裁最旧（localStorage 体积控制） */
const MAX_EVENTS = 300;

export type AnalyticsVariant = 'normal' | 'daily' | 'seed' | 'auto';

export type FeatureKey =
  | 'quick_sim' | 'daily' | 'seed' | 'goal'
  | 'achievements' | 'collection' | 'family' | 'stats' | 'guide' | 'data'
  | 'share_card' | 'biography';

export type AnalyticsEvent =
  | { type: 'game_start'; ts: number; variant: AnalyticsVariant; pace: 'full' | 'lite'; challenge: boolean }
  | { type: 'game_finish'; ts: number; score: number; age: number; endingKey: string }
  | { type: 'game_abandon'; ts: number; age: number }
  | { type: 'stage_reach'; ts: number; stage: LifeStage }
  | { type: 'feature_use'; ts: number; feature: FeatureKey };

export type DailyAgg = {
  starts: number;
  finishes: number;
  abandons: number;
  ageSum: number;
  endings: Record<string, number>;
  variants: Record<string, number>;
  features: Record<string, number>;
};

/** 空聚合结构 */
export function emptyDaily(): DailyAgg {
  return { starts: 0, finishes: 0, abandons: 0, ageSum: 0, endings: {}, variants: {}, features: {} };
}

/** 安全读 JSON（损坏返回 null，与 saveStats 同模式静默降级） */
function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 读取原始事件流与按日聚合（损坏数据降级为空结构）。
 */
export function loadAnalytics(): { events: AnalyticsEvent[]; daily: Record<string, DailyAgg> } {
  const events = readJSON<AnalyticsEvent[]>(EVENTS_KEY);
  const daily = readJSON<Record<string, DailyAgg>>(DAILY_KEY);
  return {
    events: Array.isArray(events) ? events : [],
    // 数组也是 object，需排除（损坏 JSON 可能解析为 []）
    daily: daily && typeof daily === 'object' && !Array.isArray(daily) ? daily : {},
  };
}

/** 事件归入当日聚合 */
function mergeIntoDaily(daily: Record<string, DailyAgg>, e: AnalyticsEvent): void {
  const day = formatDate(new Date(e.ts));
  const agg = daily[day] ?? emptyDaily();
  switch (e.type) {
    case 'game_start':
      agg.starts += 1;
      agg.variants[e.variant] = (agg.variants[e.variant] ?? 0) + 1;
      break;
    case 'game_finish':
      agg.finishes += 1;
      agg.ageSum += e.age;
      agg.endings[e.endingKey] = (agg.endings[e.endingKey] ?? 0) + 1;
      break;
    case 'game_abandon':
      agg.abandons += 1;
      break;
    case 'feature_use':
      agg.features[e.feature] = (agg.features[e.feature] ?? 0) + 1;
      break;
    // stage_reach 不进日聚合（面板不展示，原始流可查）
    default:
      break;
  }
  daily[day] = agg;
}

/**
 * 记录一条埋点事件：追加事件流（截断）+ 累加当日聚合。
 * 任一步写失败静默降级，不影响游戏。
 */
export function track(event: AnalyticsEvent): void {
  try {
    const { events, daily } = loadAnalytics();
    events.push(event);
    // 超过上限裁最旧
    if (events.length > MAX_EVENTS) {
      events.splice(0, events.length - MAX_EVENTS);
    }
    mergeIntoDaily(daily, event);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  } catch {
    // 存储不可用时静默丢弃
  }
}

/** 导出载荷：原始事件流 + 日聚合（供「导出 JSON」下载） */
export function buildExportPayload(): string {
  const { events, daily } = loadAnalytics();
  return JSON.stringify({ exportedAt: new Date().toISOString(), events, daily }, null, 2);
}
