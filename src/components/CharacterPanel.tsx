import { useMemo } from 'react';
import type { PersonaTrait } from '../types';
import { PERSONA_META, type PersonaState } from '../engine/personality';
import { EVENTS } from '../engine/events';

/** 性格维度展示对（条形图左端 → 右端，与结算页画像一致） */
const DIMENSIONS: Array<[PersonaTrait, PersonaTrait]> = [
  ['rational', 'emotional'],
  ['adventurous', 'cautious'],
  ['selfish', 'altruistic'],
];

/**
 * 各性格端专属际遇阈值：EVENTS 中该端 minPersonality 条件的最低要求
 * （如冒险端 pers_0001 阈值为 6）；无该端条件事件返回 undefined（该端无专属际遇）。
 */
function traitThresholds(): Partial<Record<PersonaTrait, number>> {
  const out: Partial<Record<PersonaTrait, number>> = {};
  for (const e of EVENTS) {
    const min = e.conditions?.minPersonality;
    if (!min) {
      continue;
    }
    for (const [t, v] of Object.entries(min) as [PersonaTrait, number][]) {
      if (v > 0 && (out[t] === undefined || v < out[t])) {
        out[t] = v;
      }
    }
  }
  return out;
}

interface Props {
  /** 本局性格画像（GameScreen 由 derivePersona(game.history) 计算后传入） */
  persona: PersonaState;
}

/** 局内性格面板：3 维 6 端进度 + 各端专属际遇距离提示（纯展示，不改变游戏逻辑） */
export default function CharacterPanel({ persona }: Props) {
  // 专属际遇阈值（EVENTS 为运行时 live binding，挂载时数据已就绪，引用固定）
  const thresholds = useMemo(() => traitThresholds(), [EVENTS]);
  // 有专属际遇的性格端（按 PERSONA_META 定义顺序展示：理性/感性/冒险/安稳/利己/利他）
  const thresholdTraits = (Object.keys(PERSONA_META) as PersonaTrait[]).filter(t => thresholds[t] !== undefined);

  return (
    <div className="w-[300px] max-w-[92vw] rounded-xl border border-white/10 bg-black/85 backdrop-blur-md p-3 shadow-2xl shadow-black/60">
      <h4 className="text-[11px] tracking-[3px] text-[#c9a96e] mb-2 font-normal">🧭 性格画像</h4>
      <div className="flex flex-col gap-1.5">
        {DIMENSIONS.map(([a, b]) => {
          const av = persona[a];
          const bv = persona[b];
          const aPct = av + bv > 0 ? (av / (av + bv)) * 100 : 0;
          return (
            <div key={a} className="flex items-center gap-2 text-[10px]"
              title={`${PERSONA_META[a].name} ${av} 次 · ${PERSONA_META[b].name} ${bv} 次`}>
              <span className="w-[48px] text-right shrink-0"
                style={{ color: av > 0 ? PERSONA_META[a].color : 'rgba(255,255,255,0.25)' }}>
                {PERSONA_META[a].icon} {PERSONA_META[a].name}
              </span>
              <div className="flex-1 h-[6px] bg-white/8 rounded-sm overflow-hidden relative">
                {/* 中线（两端对半分界） */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                {av > 0 && (
                  <div className="absolute left-0 top-0 bottom-0 transition-all duration-700"
                    style={{ width: `${aPct}%`, backgroundColor: PERSONA_META[a].color }} />
                )}
                {bv > 0 && (
                  <div className="absolute right-0 top-0 bottom-0 transition-all duration-700"
                    style={{ width: `${100 - aPct}%`, backgroundColor: PERSONA_META[b].color }} />
                )}
              </div>
              <span className="w-[48px] shrink-0"
                style={{ color: bv > 0 ? PERSONA_META[b].color : 'rgba(255,255,255,0.25)' }}>
                {PERSONA_META[b].name} {PERSONA_META[b].icon}
              </span>
            </div>
          );
        })}
      </div>

      {/* 专属际遇：各端距 minPersonality 阈值事件的距离（达标显示已解锁） */}
      {thresholdTraits.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
          <span className="text-[10px] text-white/35 tracking-[2px]">专属际遇</span>
          {thresholdTraits.map(t => {
            const threshold = thresholds[t] ?? 0;
            const cur = persona[t] ?? 0;
            return (
              <span key={t} className="text-[10px]" style={{ color: PERSONA_META[t].color }}>
                {PERSONA_META[t].icon} {PERSONA_META[t].name}
                {cur < threshold ? ` · 距专属际遇还差 ${threshold - cur} 次` : ' · 专属际遇已解锁 ✨'}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
