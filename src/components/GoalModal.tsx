import { useState } from 'react';
import type { AttributeKey, Attributes, CustomGoal, FamilyMember, GoalKey } from '../types';
import { GOALS } from '../engine/goals';
import { ATTR_META } from '../engine/state';
import { VERDICT_META } from '../engine/verdict';
import { sfx } from '../utils/sound';
import { LIFE_ROUTES } from '../engine/routes';

interface Props {
  onSelect: (goal: GoalKey | CustomGoal | null, route?: string) => void;
  onCancel: () => void;
  /** 族谱最新一代（有则展示「你将作为下一代出生」继承提示） */
  latestMember?: FamilyMember;
}

/** 自定义目标：最多勾选属性数 */
const CUSTOM_MAX_ATTRS = 3;
/** 自定义目标滑杆默认目标值 */
const CUSTOM_DEFAULT_TARGET = 60;

/** 目标选择模态：开局选择人生目标（无目标或自定义属性目标亦可） */
export default function GoalModal({ onSelect, onCancel, latestMember }: Props) {
  const [selected, setSelected] = useState<GoalKey | null>(null);
  /** 开局人生路线 key（null = 自由人生） */
  const [route, setRoute] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  /** 自定义目标勾选的属性 */
  const [customAttrs, setCustomAttrs] = useState<AttributeKey[]>([]);
  /** 自定义目标各项目标值 */
  const [customTargets, setCustomTargets] = useState<Partial<Attributes>>({});

  /** 勾选/取消属性（最多 3 项） */
  const toggleAttr = (k: AttributeKey) => {
    if (customAttrs.includes(k)) {
      setCustomAttrs(customAttrs.filter(x => x !== k));
    } else if (customAttrs.length < CUSTOM_MAX_ATTRS) {
      setCustomAttrs([...customAttrs, k]);
    }
  };

  /** 提交自定义目标：勾选的属性 + 各自目标值 */
  const confirmCustom = () => {
    const attrs: Partial<Attributes> = {};
    for (const k of customAttrs) {
      attrs[k] = customTargets[k] ?? CUSTOM_DEFAULT_TARGET;
    }
    sfx.select();
    onSelect({ attrs }, route ?? undefined);
  };

  // 自定义目标面板
  if (showCustom) {
    return (
      <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
        <div className="w-[560px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6
          flex flex-col gap-4" onClick={e => e.stopPropagation()}>
          <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">自定义目标</h3>
          <p className="text-center text-[11px] text-white/40 tracking-[2px]">
            勾选 {CUSTOM_MAX_ATTRS} 个以内属性并设定目标值，结算时逐项达成即达成（最多 {CUSTOM_MAX_ATTRS} 项）
          </p>
          <div className="flex flex-col gap-2.5">
            {(Object.keys(ATTR_META) as AttributeKey[]).map(k => {
              const meta = ATTR_META[k];
              const checked = customAttrs.includes(k);
              const disabled = !checked && customAttrs.length >= CUSTOM_MAX_ATTRS;
              return (
                <label key={k}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all duration-200 font-sans
                    ${checked
                      ? 'border-[#c9a96e]/60 bg-[#c9a96e]/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-[#c9a96e]/40'
                      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleAttr(k)}
                    className="w-4 h-4 accent-[#c9a96e]"
                  />
                  <span className="text-[13px] text-white/80" style={{ color: checked ? meta.color : undefined }}>
                    {meta.icon} {meta.name}
                  </span>
                  {checked && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={customTargets[k] ?? CUSTOM_DEFAULT_TARGET}
                        onChange={e => setCustomTargets({ ...customTargets, [k]: Number(e.target.value) })}
                        className="flex-1 accent-[#c9a96e]"
                      />
                      <span className="text-[13px] text-[#c9a96e] min-w-[24px] text-right">{customTargets[k] ?? CUSTOM_DEFAULT_TARGET}</span>
                    </>
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex gap-3 justify-center mt-1">
            <button
              onClick={() => { sfx.select(); setShowCustom(false); }}
              className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
                border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
            >
              返回
            </button>
            <button
              onClick={confirmCustom}
              disabled={customAttrs.length === 0}
              className={`px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
                ${customAttrs.length > 0
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

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
      <div className="w-[560px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6
        flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">选择你的人生目标</h3>
        <p className="text-center text-[11px] text-white/40 tracking-[2px]">目标影响结算评价，也可以无目的地活一次</p>
        {/* 开局人生路线：这一生想体验什么（可选，默认自由人生） */}
        <div>
          <div className="text-[11px] tracking-[3px] text-white/40 mb-2">🎭 这一生想体验什么</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { sfx.select(); setRoute(null); }}
              className={`px-3 py-1.5 rounded-full text-[12px] border transition-all duration-200 font-sans
                ${route === null
                  ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10'
                  : 'border-white/15 text-white/45 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
            >
              🌱 自由人生
            </button>
            {LIFE_ROUTES.map(r => (
              <button
                key={r.key}
                onClick={() => { sfx.select(); setRoute(r.key); }}
                title={r.desc}
                className={`px-3 py-1.5 rounded-full text-[12px] border transition-all duration-200 font-sans
                  ${route === r.key
                    ? 'border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10'
                    : 'border-white/15 text-white/45 hover:border-[#c9a96e]/40 hover:text-[#c9a96e]'}`}
              >
                {r.icon} {r.name}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-1 leading-relaxed">
            选一条人生路线，开局会埋下对应的际遇，让你稳定体验这一种活法。
          </p>
        </div>
        {/* 家族继承提示：族谱非空时，本局作为下一代出生 */}
        {latestMember && (
          <p className="text-center text-[11px] text-[#c9a96e]/70 tracking-[1px] -mt-1">
            🌳 你将作为家族第 {latestMember.generation + 1} 代出生——上一世 {latestMember.name}（{VERDICT_META[latestMember.verdict]?.title ?? '平凡的一生'}）
          </p>
        )}
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
          {/* 自定义目标入口：进入属性勾选面板 */}
          <button
            onClick={() => { sfx.select(); setShowCustom(true); }}
            className="p-3.5 rounded-xl border border-dashed text-left transition-all duration-200 font-sans
              border-[#c9a96e]/30 bg-[#c9a96e]/5 hover:border-[#c9a96e] hover:bg-[#c9a96e]/10"
          >
            <div className="text-[15px] text-[#c9a96e]">🎯 自定义目标</div>
            <div className="text-[11px] text-white/40 mt-1 leading-relaxed">勾选属性并设定目标值，逐项达成即达成</div>
          </button>
        </div>
        <div className="flex gap-3 justify-center mt-1">
          <button
            onClick={() => { sfx.select(); setSelected(GOALS[Math.floor(Math.random() * GOALS.length)].key); }}
            className="px-5 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-[#8fb8e8]/40 text-[#8fb8e8]/80 hover:border-[#8fb8e8] hover:text-[#8fb8e8]"
          >
            🎲 随机
          </button>
          <button
            onClick={() => { sfx.select(); onSelect(null, route ?? undefined); }}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            无目标，随心而活
          </button>
          <button
            onClick={() => { if (selected) { sfx.select(); onSelect(selected, route ?? undefined); } }}
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
