import type { AttributeKey } from '../types';
import type { LifeExport } from '../engine/compare';
import { ATTR_META } from '../engine/state';
import { sfx } from '../utils/sound';

interface Props {
  life: LifeExport;
  onClose: () => void;
  /** 挑战 TA 的人生：锁定该档案的种子（无种子则不显示按钮） */
  onChallenge?: (seed: number) => void;
}

/** 好友人生档案模态：展示导入的人生档案，并可一键锁定其种子发起挑战 */
export default function FriendLifeModal({ life, onClose, onChallenge }: Props) {
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">好友人生档案</h3>
        <p className="text-center text-[11px] text-white/40 tracking-[1px]">
          {life.gender === 'male' ? '♂' : '♀'} {life.name} · 享年 {life.age} 岁 · 评分 {life.score}
        </p>
        <div className="text-center text-[14px] text-[#c9a96e]">{life.endingTitle}</div>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {(Object.keys(ATTR_META) as AttributeKey[]).map(k => {
            const meta = ATTR_META[k];
            return (
              <div key={k} className="text-center p-2 bg-white/[0.03] rounded-lg border border-white/[0.04]">
                <div className="text-[15px]" style={{ color: meta.color }}>{life.attributes[k]}</div>
                <div className="text-[9px] text-white/35 mt-0.5">{meta.icon} {meta.name}</div>
              </div>
            );
          })}
        </div>
        {life.seed != null && (
          <p className="text-[11px] text-white/40 text-center mt-1">🔑 种子 {life.seed} · 同一事件序列，看谁活得更好</p>
        )}
        <div className="flex gap-3 justify-center mt-2">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            关闭
          </button>
          {life.seed != null && onChallenge && (
            <button
              onClick={() => { sfx.select(); onChallenge(life.seed!); }}
              className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
                bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent"
            >
              🔑 挑战 TA 的人生
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
