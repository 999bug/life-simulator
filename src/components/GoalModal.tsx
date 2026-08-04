import { useState } from 'react';
import type { GoalKey } from '../types';
import { GOALS } from '../engine/goals';
import { sfx } from '../utils/sound';

interface Props {
  onSelect: (goal: GoalKey | null) => void;
  onCancel: () => void;
}

/** 目标选择模态：开局选择人生目标（无目标亦可） */
export default function GoalModal({ onSelect, onCancel }: Props) {
  const [selected, setSelected] = useState<GoalKey | null>(null);

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
      <div className="w-[560px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6
        flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">选择你的人生目标</h3>
        <p className="text-center text-[11px] text-white/40 tracking-[2px]">目标影响结算评价，也可以无目的地活一次</p>
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(g => (
            <button
              key={g.key}
              onClick={() => { sfx.select(); setSelected(g.key); }}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 font-sans
                ${selected === g.key
                  ? 'border-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_16px_rgba(201,169,110,0.2)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-[#c9a96e]/40'}`}
            >
              <div className="text-[15px] text-white/85">{g.icon} {g.name}</div>
              <div className="text-[11px] text-white/40 mt-1 leading-relaxed">{g.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-1">
          <button
            onClick={() => { sfx.select(); onSelect(null); }}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            无目标，随心而活
          </button>
          <button
            onClick={() => { if (selected) { sfx.select(); onSelect(selected); } }}
            disabled={!selected}
            className={`px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              ${selected
                ? 'bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent'
                : 'bg-white/[0.06] text-white/30 border-white/[0.08] cursor-not-allowed'}`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
