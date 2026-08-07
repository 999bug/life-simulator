import type { AttributeKey, FamilyMember } from '../types';
import { verdictTitle } from '../engine/verdict';
import { ATTR_META } from '../engine/state';
import { deriveLegacy, legacyBonuses, LEGACY_MIN_GENERATIONS } from '../engine/legacy';

interface Props {
  family: FamilyMember[];
  /** 点击某一代回看其结算页（仅有完整回顾数据的代可点击；不传则纯展示） */
  onRecap?: (member: FamilyMember) => void;
  onClose: () => void;
}

/** 家族族谱模态（标题页入口）：最新一代在上，世代线性向下追溯；有回顾数据的代可点击回看结算页 */
export default function FamilyModal({ family, onRecap, onClose }: Props) {
  const latest = family[family.length - 1];
  // 家族底蕴（手玩代数 + 最近 5 代均值）：标题页实时推导，与开局应用同源
  const legacy = deriveLegacy(family);
  const bonuses = legacyBonuses(legacy);
  const bonusText = Object.entries(bonuses)
    .map(([k, v]) => `${ATTR_META[k as AttributeKey].icon}${ATTR_META[k as AttributeKey].name} +${v}`)
    .join(' ');
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[480px] max-w-[92vw] max-h-[min(520px,86vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">
          家族族谱{latest ? ` · 第 ${latest.generation} 代` : ''}
        </h3>
        {family.length > 0 && (
          legacy.generations >= LEGACY_MIN_GENERATIONS ? (
            <div className="rounded-lg border border-[#c9a96e]/20 bg-[#c9a96e]/5 px-3 py-2.5 flex flex-col gap-1">
              <div className="text-[12px] text-[#c9a96e] tracking-[1px]">🏛️ 家族底蕴 · 第 {legacy.generations} 代</div>
              <div className="text-[11px] text-white/45 leading-relaxed">
                {Object.keys(bonuses).length > 0 ? `家族强项：${bonusText}` : '强项尚未显现——暂无均值达到 70 的属性'}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center text-[11px] text-white/35 leading-relaxed">
              🏛️ 家族底蕴正在积累——多玩几代，天资代代相传
            </div>
          )
        )}
        {family.length === 0 ? (
          <p className="text-center text-[12px] text-white/35 leading-relaxed py-6">
            族谱还是空白。<br />走完一生，你就成为这个家族的第一代。
          </p>
        ) : (
          // 最新一代在上：世代越深（越早）颜色越淡
          [...family].reverse().map(m => {
            const row = (
              <>
                <span className="text-[16px] leading-none">{m.gender === 'male' ? '👨' : '👩'}</span>
                <div className="flex-1">
                  <div className="text-[13px] text-[#c9a96e]">
                    第 {m.generation} 代 · {m.name}
                    {m.auto && <span className="ml-1.5 text-[10px] text-white/35" title="快速模拟：随机选择的一生，不参与传承">⚡</span>}
                    {m.daily && <span className="ml-1.5 text-[10px] text-white/35" title="每日挑战：固定种子的一生">📅</span>}
                  </div>
                  <div className="text-[11px] text-white/35 mt-0.5 leading-relaxed">
                    享年 {m.age} · 评分 {m.score} · {verdictTitle(m.verdict)}
                  </div>
                </div>
                <span className="text-[10px] text-white/25 tracking-[1px]">{m.date.slice(0, 4)}</span>
              </>
            );
            const cls = "flex items-center gap-3 p-3 rounded-lg border border-[#c9a96e]/20 bg-[#c9a96e]/5 w-full text-left font-sans";
            const style = { opacity: Math.max(0.45, 1 - (latest!.generation - m.generation) * 0.08) };
            // 有完整回顾数据的代可点击回看结算页
            return onRecap && m.detail ? (
              <button key={m.generation} onClick={() => onRecap(m)} className={`${cls} hover:border-[#c9a96e]/50 hover:bg-[#c9a96e]/10 transition-all duration-200 cursor-pointer`} style={style}>
                {row}
              </button>
            ) : (
              <div key={m.generation} className={cls} style={style}>
                {row}
              </div>
            );
          })
        )}
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto mt-1
            border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
