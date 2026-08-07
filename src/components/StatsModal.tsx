import type { FamilyMember } from '../types';
import type { DailyHistory, StatsStore } from '../hooks/useGame';
import { verdictTitle } from '../engine/verdict';

/** 死因中文标签（死法分布展示用） */
const DEATH_LABELS: Record<string, string> = {
  accident: '⚡ 意外身亡',
  illness: '🏥 病逝',
  overwork: '🌆 操劳过度',
  health: '🌙 油尽灯枯',
  lifespan: '🕯️ 寿终正寝',
};

interface Props {
  stats: StatsStore;
  /** 族谱（「每一世」回看列表数据源） */
  family: FamilyMember[];
  /** 每日挑战历史（近 7 天周视图） */
  dailyHistory?: DailyHistory;
  /** 点击某一代回看其结算页（仅有完整回顾数据的代可点击） */
  onRecap: (member: FamilyMember) => void;
  onClose: () => void;
}

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

/** 日期（YYYYMMDD）→ MM-DD 短格式 */
function shortDate(date: string): string {
  return `${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

/** 生涯统计模态：总局数/最佳评分/平均寿命/结局分布 + 每一世回看列表 + 每日挑战周视图 */
export default function StatsModal({ stats, family, dailyHistory = {}, onRecap, onClose }: Props) {
  const avgAge = stats.totalLives > 0 ? Math.round(stats.totalAge / stats.totalLives) : 0;
  const endings = Object.entries(stats.endings).sort((a, b) => b[1] - a[1]);
  const week = lastDays(7);
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[440px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">📊 生涯统计</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="text-2xl text-[#c9a96e]">{stats.totalLives}</div>
            <div className="text-[10px] text-white/40 mt-1">总局数</div>
          </div>
          <div className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="text-2xl text-[#c9a96e]">{stats.bestScore}</div>
            <div className="text-[10px] text-white/40 mt-1">最佳评分</div>
          </div>
          <div className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="text-2xl text-[#c9a96e]">{avgAge}</div>
            <div className="text-[10px] text-white/40 mt-1">平均寿命</div>
          </div>
        </div>
        {/* 无生涯记录：幽默空状态（保留引导信息） */}
        {stats.totalLives === 0 && (
          <p className="text-center text-[12px] text-white/40 leading-relaxed">
            还没有人生数据——快开始第一世吧，人生苦短，模拟器里可以重来
            <span className="block text-[10px] text-white/25 mt-1">此页面不会有排行榜，因为你是唯一的玩家</span>
          </p>
        )}
        {/* 每一世：点击回看该世结算页（仅最近若干代保留完整回顾数据） */}
        {family.length > 0 && (
          <div>
            <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">每一世</h4>
            <div className="flex flex-col gap-1.5">
              {[...family].reverse().map(m => (
                <button
                  key={m.generation}
                  onClick={() => m.detail && onRecap(m)}
                  disabled={!m.detail}
                  className={`flex items-center justify-between text-[12px] py-1.5 px-2 rounded-md border text-left transition-all duration-200 font-sans
                    ${m.detail
                      ? 'border-white/[0.06] bg-white/[0.03] hover:border-[#c9a96e]/40 cursor-pointer'
                      : 'border-transparent opacity-45 cursor-default'}`}
                >
                  <span className="text-white/60">
                    第 {m.generation} 世 · {m.name}{m.auto ? ' ⚡' : ''}{m.daily ? ' 📅' : ''}
                  </span>
                  <span className="text-white/35 text-[11px]">
                    享年 {m.age} · {m.score} 分{m.detail ? ' ›' : ''}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/25 mt-1.5">点击回看该世结算页；仅最近 15 世保留完整回顾</p>
          </div>
        )}
        {/* 每日挑战 · 近 7 天（挑战变成习惯：每天同一天全世界同一局） */}
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">📅 每日挑战 · 近 7 天</h4>
          {week.every(d => !dailyHistory[d]) ? (
            <p className="text-[11px] text-white/30">还没有玩过每日挑战</p>
          ) : (
            <div className="flex flex-col gap-1">
              {week.map(d => {
                const rec = dailyHistory[d];
                return (
                  <div key={d} className={`flex justify-between text-[12px] py-1 border-b border-white/[0.04] ${rec ? '' : 'opacity-40'}`}>
                    <span className="text-white/50">{shortDate(d)}</span>
                    {rec ? (
                      <span className="text-[#c9a96e]">评分 {rec.score} · 享年 {rec.age}</span>
                    ) : (
                      <span className="text-white/25">未挑战</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">结局分布</h4>
          {endings.length === 0 ? (
            <p className="text-[11px] text-white/30">还没有完成任何一局——人生图鉴第一页，等你来填</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {endings.map(([key, n]) => (
                <div key={key} className="flex justify-between text-[12px] py-1 border-b border-white/[0.04]">
                  <span className="text-white/50">{verdictTitle(key)}</span>
                  <span className="text-[#c9a96e]">{n} 局</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 死法分布（死法图鉴：这一世的 N 种走法；旧存档无 deaths 字段不显示） */}
        {stats.deaths && Object.keys(stats.deaths).length > 0 && (
          <div>
            <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">💀 死法分布</h4>
            <div className="flex flex-col gap-1.5">
              {(Object.entries(stats.deaths) as Array<[string, number]>).map(([key, n]) => (
                <div key={key} className="flex justify-between text-[12px] py-1 border-b border-white/[0.04]">
                  <span className="text-white/50">{DEATH_LABELS[key] ?? key}</span>
                  <span className="text-[#c9a96e]">{n} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={onClose} className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]">关闭</button>
      </div>
    </div>
  );
}
