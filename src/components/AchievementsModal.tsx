import { ACHIEVEMENTS } from '../engine/achievements';
import type { AchievementId } from '../types';

interface Props {
  unlocked: AchievementId[];
  onClose: () => void;
}

/** 成就总览模态（标题页入口） */
export default function AchievementsModal({ unlocked, onClose }: Props) {
  const done = unlocked.length;
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">成就 · {done}/{ACHIEVEMENTS.length}</h3>
        {ACHIEVEMENTS.map(a => {
          const got = unlocked.includes(a.id);
          return (
            <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${got ? 'border-[#c9a96e]/25 bg-[#c9a96e]/5' : 'border-white/[0.06] bg-white/[0.02] opacity-50'}`}>
              <span className="text-[16px] leading-none mt-0.5">{got ? a.icon : '🔒'}</span>
              <div>
                <div className={`text-[13px] ${got ? 'text-[#c9a96e]' : 'text-white/50'}`}>{a.name}</div>
                <div className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{a.desc}</div>
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
