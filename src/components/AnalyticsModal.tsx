import { useMemo } from 'react';
import { loadAnalytics, buildExportPayload, emptyDaily, type DailyAgg } from '../utils/analytics';
import { downloadText } from '../utils/biography';
import { sfx } from '../utils/sound';
import { VERDICT_META } from '../engine/verdict';

/** 最近 N 天日期序列（YYYYMMDD，含今天，升序） */
function lastDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${d.getFullYear()}${month}${day}`);
  }
  return days;
}

/** 全部天聚合求和（面板总览） */
function sumDaily(daily: Record<string, DailyAgg>): DailyAgg {
  const acc = emptyDaily();
  for (const d of Object.values(daily)) {
    acc.starts += d.starts;
    acc.finishes += d.finishes;
    acc.abandons += d.abandons;
    acc.ageSum += d.ageSum;
    for (const [k, v] of Object.entries(d.endings)) {
      acc.endings[k] = (acc.endings[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(d.variants)) {
      acc.variants[k] = (acc.variants[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(d.features)) {
      acc.features[k] = (acc.features[k] ?? 0) + v;
    }
  }
  return acc;
}

/** 结局 key → 中文名（VERDICT_META 图鉴表，未收录显示 key 本身） */
function endingLabel(key: string): string {
  return VERDICT_META[key]?.title ?? key;
}

/** 功能 key → 中文名（埋点 FeatureKey 全集，未知 key 显示自身） */
const FEATURE_LABELS: Record<string, string> = {
  quick_sim: '快速模拟',
  daily: '每日挑战',
  weekly: '每周挑战',
  seed: '种子挑战',
  goal: '自定义目标',
  build: '开局构筑',
  achievements: '成就',
  collection: '图鉴',
  family: '家族',
  stats: '生涯',
  guide: '玩法',
  data: '数据面板',
  share_card: '分享卡片',
  share_life: '一键分享',
  biography: '传记导出',
  almanac: '人生年鉴',
  almanac_export: '年鉴导出',
  talent_inherit: '天赋传承',
  life_card: '人生名片',
  life_export: '档案导出',
  life_import: '档案导入',
};

function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key;
}

/** 埋点数据面板：总览 / 近 7 天 / 结局分布 / 功能使用 + 导出 JSON */
export default function AnalyticsModal({ onClose }: { onClose: () => void }) {
  const { daily } = useMemo(loadAnalytics, []);
  const totals = useMemo(() => sumDaily(daily), [daily]);
  const days = useMemo(() => lastDays(7), []);
  const endings = useMemo(
    () => Object.entries(totals.endings).sort((a, b) => b[1] - a[1]),
    [totals.endings],
  );
  const features = useMemo(
    () => Object.entries(totals.features).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [totals.features],
  );
  const rate = totals.starts > 0 ? `${Math.round((totals.finishes / totals.starts) * 100)}%` : '—';
  const avgAge = totals.finishes > 0 ? Math.round(totals.ageSum / totals.finishes) : '—';
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[440px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">📊 数据面板</h3>

        {/* 总览：开局/完成/放弃/完成率/平均享年 */}
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">总览</h4>
          <div className="grid grid-cols-5 gap-2">
            {[
              [String(totals.starts), '总开局'],
              [String(totals.finishes), '完成'],
              [String(totals.abandons), '放弃'],
              [String(rate), '完成率'],
              [String(avgAge), '平均享年'],
            ].map(([value, label]) => (
              <div key={label} className="text-center p-2 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <div className="text-lg text-[#c9a96e]">{value}</div>
                <div className="text-[10px] text-white/40 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 近 7 天：每日开局/完成（无数据行灰显） */}
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">近 7 天</h4>
          <div className="flex flex-col gap-1.5">
            {days.map(day => {
              const agg = daily[day];
              const short = `${day.slice(4, 6)}-${day.slice(6, 8)}`;
              return (
                <div key={day} className={`flex justify-between text-[12px] py-1 border-b border-white/[0.04] ${agg ? 'text-white/50' : 'text-white/25'}`}>
                  <span>{short}</span>
                  <span>开局 {agg?.starts ?? 0} · 完成 {agg?.finishes ?? 0}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 结局分布：次数降序（分数档兜底等未收录 key 直接显示） */}
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">结局分布</h4>
          {endings.length === 0 ? (
            <p className="text-[11px] text-white/30">还没有完成的人生</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {endings.map(([key, n]) => (
                <div key={key} className="flex justify-between text-[12px] py-1 border-b border-white/[0.04]">
                  <span className="text-white/50">{endingLabel(key)}</span>
                  <span className="text-[#c9a96e]">× {n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 功能使用：次数降序前 8 条 */}
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">功能使用</h4>
          {features.length === 0 ? (
            <p className="text-[11px] text-white/30">暂无功能使用记录</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {features.map(([key, n]) => (
                <div key={key} className="flex justify-between text-[12px] py-1 border-b border-white/[0.04]">
                  <span className="text-white/50">{featureLabel(key)}</span>
                  <span className="text-[#c9a96e]">× {n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 导出 JSON + 关闭 */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              sfx.select();
              downloadText('life-sim-analytics.json', buildExportPayload());
            }}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans border-[#c9a96e]/40 text-[#c9a96e] hover:bg-[#c9a96e]/10 hover:border-[#c9a96e] transition-colors duration-200"
          >
            📥 导出 JSON
          </button>
          <button onClick={onClose} className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]">关闭</button>
        </div>
      </div>
    </div>
  );
}
