import { useState } from 'react';
import type { AttributeKey, Attributes } from '../types';
import { sfx } from '../utils/sound';
import { ATTR_META } from '../engine/state';
import {
  allocPoints,
  drawTalents,
  getTalent,
  RARITY_META,
  TALENT_PICK_LIMIT,
  talentConflict,
  type TalentInherit,
} from '../engine/talents';

interface Props {
  /** 继承天赋（上一世设定传承，抽卡时必定出现并置顶） */
  inheritTalent: TalentInherit | null;
  /** 确认开局构筑（天赋 + 属性分配） */
  onConfirm: (talents: string[], alloc: Partial<Attributes>) => void;
  onCancel: () => void;
}

/** 8 属性分配顺序（与状态栏一致） */
const ATTR_KEYS = Object.keys(ATTR_META) as AttributeKey[];

/**
 * 开局构筑模态：天赋抽卡（10 选 3，4 级稀有度，互斥校验）+ 属性点分配（12 点基数，
 * 天赋可能增减点数）。普通手动开局必走一步——「先天与出身」的仪式感，
 * 每日/每周挑战与种子挑战为公平固定开局不走此模态。
 */
export default function BuildModal({ inheritTalent, onConfirm, onCancel }: Props) {
  // 抽卡候选只在打开时抽一次（含继承天赋置顶）
  const [candidates] = useState(() => drawTalents(10, inheritTalent?.talentId ?? undefined));
  const [picked, setPicked] = useState<string[]>([]);
  // 属性分配：各属性加点（默认全 0）
  const [alloc, setAlloc] = useState<Partial<Attributes>>({});

  const total = allocPoints(picked);
  const used = Object.values(alloc).reduce((a, b) => a + b, 0);
  const remain = total - used;
  const conflict = picked.length >= TALENT_PICK_LIMIT ? '已达上限' : null;

  const toggleTalent = (id: string) => {
    sfx.select();
    if (picked.includes(id)) {
      setPicked(picked.filter(x => x !== id));
      return;
    }
    if (talentConflict(picked, id)) {
      return;
    }
    setPicked([...picked, id]);
  };

  const addAlloc = (k: AttributeKey, delta: number) => {
    sfx.select();
    const cur = alloc[k] ?? 0;
    const next = Math.max(0, Math.min(8, cur + delta));
    setAlloc({ ...alloc, [k]: next });
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
      <div className="w-[560px] max-w-[92vw] max-h-[min(560px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>

        <div className="text-center">
          <h3 className="text-[17px] tracking-[5px] text-[#c9a96e]">开局构筑 · 先天与出身</h3>
          <p className="text-[11px] text-white/35 mt-1.5 leading-relaxed">
            抽 3 个天赋（稀有度 黑/蓝/紫/橙），再分配 {total} 点初始属性。
            天赋会塑造你的起点，也悄悄改变这辈子的剧本。
          </p>
        </div>

        {/* 天赋抽卡区 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] tracking-[3px] text-white/40">🎴 天赋 · 已选 {picked.length}/{TALENT_PICK_LIMIT}</span>
            {inheritTalent && (
              <span className="text-[10px] text-[#e8c95d]/70 tracking-[1px]">
                🧬 上一世传承天赋已置顶
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {candidates.map(id => {
              const t = getTalent(id)!;
              const r = RARITY_META[t.rarity];
              const pickedNow = picked.includes(id);
              const blocked = !pickedNow && talentConflict(picked, id) != null;
              return (
                <button
                  key={id}
                  onClick={() => toggleTalent(id)}
                  disabled={blocked}
                  title={blocked ? talentConflict(picked, id) ?? undefined : t.desc}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all duration-200
                    ${pickedNow
                      ? 'border-[#c9a96e] bg-[#c9a96e]/10 shadow-[0_0_14px_rgba(201,169,110,0.15)]'
                      : blocked
                        ? 'border-white/[0.04] bg-white/[0.01] opacity-35 cursor-not-allowed'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:-translate-y-0.5'}`}
                >
                  <span className="text-[18px] leading-none mt-0.5">{t.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className={`text-[12px] ${pickedNow ? 'text-[#c9a96e]' : 'text-white/70'}`}>{t.name}</span>
                      {id === inheritTalent?.talentId && <span className="text-[9px] text-[#e8c95d]">🧬</span>}
                      <span className="text-[9px] px-1 py-px rounded-sm" style={{ color: r.color, background: `${r.color}1f` }}>{r.label}</span>
                    </span>
                    <span className="block text-[10px] text-white/35 mt-0.5 leading-snug">{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 属性点分配区 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] tracking-[3px] text-white/40">📊 初始属性 · 剩余 {remain} 点</span>
            <span className={`text-[10px] tracking-[1px] ${remain === 0 ? 'text-[#5de8a0]' : 'text-white/30'}`}>
              {remain === 0 ? '分配完成' : `已用 ${used}/${total}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {ATTR_KEYS.map(k => {
              const meta = ATTR_META[k];
              const v = alloc[k] ?? 0;
              return (
                <div key={k} className="flex items-center gap-2 py-1">
                  <span className="text-[12px] w-[18px] text-center shrink-0">{meta.icon}</span>
                  <span className="text-[10px] text-white/40 w-[22px] shrink-0">{meta.name}</span>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => addAlloc(k, -1)}
                      disabled={v <= 0}
                      className="w-6 h-6 rounded-md border border-white/10 text-white/40 hover:border-[#e85d75] hover:text-[#e85d75]
                        disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-white/40 font-sans text-[13px] leading-none"
                    >
                      −
                    </button>
                    <span className={`w-[20px] text-center text-[12px] font-semibold ${v > 0 ? 'text-[#c9a96e]' : 'text-white/30'}`}>{v}</span>
                    <button
                      onClick={() => addAlloc(k, 1)}
                      disabled={remain <= 0 || v >= 8}
                      className="w-6 h-6 rounded-md border border-white/10 text-white/40 hover:border-[#5de8a0] hover:text-[#5de8a0]
                        disabled:opacity-25 disabled:hover:border-white/10 disabled:hover:text-white/40 font-sans text-[13px] leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 操作区 */}
        <div className="flex justify-center gap-3 mt-1">
          <button
            onClick={onCancel}
            className="px-7 py-2.5 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#e85d75]/60 hover:text-[#e85d75]"
          >
            跳过构筑
          </button>
          <button
            onClick={() => {
              sfx.select();
              onConfirm(picked, alloc);
            }}
            className="px-9 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10
              hover:bg-[#c9a96e]/20 hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]"
          >
            {conflict ? '选择 3 个天赋' : `确定 · 开启人生${remain > 0 ? `（剩余 ${remain} 点）` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
