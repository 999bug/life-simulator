import type { ChoiceRecord } from '../types';
import { EVENTS } from '../engine/events';
import { MILESTONE_FLAGS } from './SummaryScreen';

interface Props {
  history: ChoiceRecord[];
  onClose: () => void;
}

/**
 * 关键抉择回顾模态（局内「📌 关键抉择」入口）。
 * 列出本局至今产出了里程碑 flag 的选择（高考/升学/结婚/生子/职业/退休等），
 * 按时间正序——「中途重要的选择」随时可回看。
 */
export default function KeyChoicesModal({ history, onClose }: Props) {
  const keyChoices = history.filter(h => (h.flags ?? []).some(f => MILESTONE_FLAGS.includes(f)));
  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/15 bg-[#10101f] shadow-2xl shadow-black/70 p-6 flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[17px] tracking-[5px] text-[#c9a96e]">📌 关键抉择</h3>
        <p className="text-center text-[10px] text-white/50 tracking-[2px]">这一生走到这里，几个重要的路口</p>
        {keyChoices.length === 0 && (
          <p className="text-center text-[12px] text-white/55 py-8">还没有做出影响一生的选择</p>
        )}
        {keyChoices.map((h, i) => {
          const title = EVENTS.find(e => e.id === h.eventId)?.title;
          return (
            <div key={i} className="flex gap-3 py-2.5 border-b border-white/[0.06]">
              <span className="text-[#c9a96e] min-w-[38px] text-[12px] font-semibold pt-0.5">⭐ {h.age}岁</span>
              <div className="min-w-0">
                <div className="text-[12px] text-[#c9a96e]/90">{title ?? '人生事件'}</div>
                <div className="text-[12px] text-white/75 mt-0.5 leading-relaxed">{h.text}</div>
              </div>
            </div>
          );
        })}
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto
            border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
