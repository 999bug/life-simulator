import { sfx } from '../utils/sound';
import { ATTR_META } from '../engine/state';
import type { IntroSummary } from '../engine/introSummary';

interface Props {
  summary: IntroSummary;
  onClose: () => void;
}

/** 童年定格面板：13 岁交还控制时弹出——0-12 岁的大事记与属性成长，确认后开始少年人生 */
export default function IntroSummaryModal({ summary, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <div
        className="w-[360px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-[#c9a96e]/30 bg-[#10101f] shadow-2xl shadow-black/70 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-[16px] tracking-[4px] text-[#c9a96e]">🌱 你的童年</h3>
          <p className="text-[11px] text-white/40 mt-1">0-12 岁 · 命运在这里生根</p>
        </div>

        {/* 属性成长摘要（开局 → 童年末，变化显著的属性） */}
        {summary.attrGrowth.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {summary.attrGrowth.map(g => (
              <span
                key={g.key}
                className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/5"
                style={{ color: ATTR_META[g.key].color }}
              >
                {ATTR_META[g.key].icon}{ATTR_META[g.key].name} {g.from} → {g.to}
              </span>
            ))}
          </div>
        )}

        {/* 关键选择回顾（效果最显著的几件大事） */}
        {summary.milestones.length > 0 ? (
          <div className="flex flex-col gap-2">
            {summary.milestones.map((m, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#c9a96e]">{m.age} 岁 · {m.title}</span>
                  {m.change && <span className="text-[10px] text-white/50 shrink-0">{m.change}</span>}
                </div>
                <div className="text-[11px] text-white/75 leading-snug mt-1">「{m.choiceText}」</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-[12px] text-white/40 py-2">童年的选择随岁月淡去……</div>
        )}

        <button
          onClick={() => { sfx.select(); onClose(); }}
          className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
            border-[#c9a96e]/60 text-[#c9a96e] hover:bg-[#c9a96e]/10 transition-all duration-200"
        >
          开始 13 岁的人生 →
        </button>
      </div>
    </div>
  );
}
