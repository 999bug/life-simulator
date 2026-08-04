import type { StatsStore } from '../hooks/useGame';
interface Props {
  stats: StatsStore;
  onClose: () => void;
}

/** 生涯统计模态：总局数/最佳评分/平均寿命/结局分布 */
export default function StatsModal({ stats, onClose }: Props) {
  const avgAge = stats.totalLives > 0 ? Math.round(stats.totalAge / stats.totalLives) : 0;
  const endings = Object.entries(stats.endings).sort((a, b) => b[1] - a[1]);
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[440px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
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
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">结局分布</h4>
          {endings.length === 0 ? (
            <p className="text-[11px] text-white/30">还没有完成任何一局</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {endings.map(([key, n]) => (
                <div key={key} className="flex justify-between text-[12px] py-1 border-b border-white/[0.04]">
                  <span className="text-white/50">{key}</span>
                  <span className="text-[#c9a96e]">{n} 局</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]">关闭</button>
      </div>
    </div>
  );
}
