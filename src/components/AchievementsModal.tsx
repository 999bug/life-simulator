import { ACHIEVEMENTS } from '../engine/achievements';
import type { AchievementTier } from '../engine/achievements';
import type { AchievementId } from '../types';

interface Props {
  unlocked: AchievementId[];
  onClose: () => void;
}

/** 分层元数据：徽章色与档名 */
const TIER_META: Record<AchievementTier, { label: string; color: string; bg: string }> = {
  1: { label: '铜', color: '#c98d5e', bg: 'rgba(201,141,94,0.12)' },
  2: { label: '银', color: '#b8c4d4', bg: 'rgba(184,196,212,0.12)' },
  3: { label: '金', color: '#e8c95d', bg: 'rgba(232,201,93,0.12)' },
};

/** 成就总览模态（标题页入口）：按铜/银/金分层展示 */
export default function AchievementsModal({ unlocked, onClose }: Props) {
  const done = unlocked.length;
  const tiers: AchievementTier[] = [1, 2, 3];
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">成就 · {done}/{ACHIEVEMENTS.length}</h3>
        {tiers.map(tier => {
          const meta = TIER_META[tier];
          const list = ACHIEVEMENTS.filter(a => a.tier === tier);
          const tierDone = list.filter(a => unlocked.includes(a.id)).length;
          return (
            <div key={tier} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] tracking-[2px] px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg }}>
                  {meta.label}牌
                </span>
                <span className="text-[10px] text-white/25">{tierDone}/{list.length}</span>
              </div>
              {list.map(a => {
                const got = unlocked.includes(a.id);
                return (
                  <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${got ? 'border-[#c9a96e]/25 bg-[#c9a96e]/5' : 'border-white/[0.06] bg-white/[0.02] opacity-50'}`}>
                    <span className="text-[16px] leading-none mt-0.5">{got ? a.icon : '🔒'}</span>
                    <div className="flex-1">
                      <div className={`text-[13px] ${got ? 'text-[#c9a96e]' : 'text-white/50'}`}>{a.name}</div>
                      <div className="text-[11px] text-white/35 mt-0.5 leading-relaxed">{a.desc}</div>
                    </div>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5"
                      style={{ color: got ? meta.color : 'rgba(255,255,255,0.25)', background: got ? meta.bg : 'rgba(255,255,255,0.05)' }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
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
