import type { GameState } from '../types';
import { sfx } from '../utils/sound';
import { calcScore } from '../engine/state';
import GrowthChart from './GrowthChart';
import { downloadText } from '../utils/biography';
import { buildAlmanacMarkdown } from '../utils/almanac';
import type { JobStatus } from '../engine/jobs';
import type { NpcBonds } from '../engine/npcs';
import type { GaokaoResult } from '../engine/gaokao';
import type { AssetItem } from '../engine/assets';
import { BOND_META } from '../engine/npcs';
import { track } from '../utils/analytics';

interface Props {
  game: GameState;
  /** 结局标题（结算页 getVerdict 结果） */
  verdictTitle: string;
  verdictDesc: string;
  /** 职业/家人/高考/资产（结算页已算好的推导结果） */
  job: JobStatus | null;
  bonds: NpcBonds;
  gaokao: GaokaoResult | null;
  assets: AssetItem[];
  onClose: () => void;
}

/**
 * 人生年鉴模态：一页纸的终局报告（评分/成长曲线/职业资产/家人/大事记），
 * 可导出 markdown 年鉴存档或转发。
 */
export default function AlmanacModal({ game, verdictTitle, verdictDesc, job, bonds, gaokao, assets, onClose }: Props) {
  const score = calcScore(game.attributes);
  const top = [...Object.entries(game.history)].sort((a, b) => b[1].age - a[1].age).slice(0, 8).reverse();

  return (
    <div className="absolute inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[640px] max-w-[92vw] max-h-[min(600px,88vh)] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <h3 className="text-[18px] tracking-[6px] text-[#c9a96e]">📖 人生年鉴</h3>
          <p className="text-[11px] text-white/35 mt-1">
            {game.gender === 'male' ? '♂' : '♀'} {game.name} · 享年 {game.age} 岁 · 综合评分 {score}
          </p>
        </div>

        {/* 结局 */}
        <div className="text-center px-4 py-3 rounded-xl bg-[#c9a96e]/5 border border-[#c9a96e]/20">
          <div className="text-[15px] text-[#c9a96e] tracking-[2px]">{verdictTitle}</div>
          <p className="text-[11px] text-white/45 mt-1.5 leading-relaxed">{verdictDesc}</p>
        </div>

        {/* 成长曲线 */}
        <div>
          <h4 className="text-[11px] tracking-[3px] text-white/40 mb-2">📈 一生轨迹</h4>
          <GrowthChart snapshots={game.snapshots ?? []} />
        </div>

        {/* 职业 · 学业 · 资产 */}
        <div className="flex flex-wrap gap-2">
          {job && (
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[11px] text-white/60">
              {job.icon} {job.title} · 从业 {job.years} 年
            </span>
          )}
          {gaokao && (
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[11px] text-white/60">
              {gaokao.icon} {gaokao.label}
            </span>
          )}
          {assets.map(a => (
            <span key={a.label} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[11px] text-white/60">
              {a.icon} {a.label}
            </span>
          ))}
        </div>

        {/* 与身边人 */}
        <div>
          <h4 className="text-[11px] tracking-[3px] text-white/40 mb-2">🤝 与身边人</h4>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(bonds) as Array<keyof NpcBonds>).map(k => {
              const meta = BOND_META[k];
              const v = bonds[k];
              return (
                <div key={k} className="flex items-center gap-2 text-[11px]">
                  <span className="w-[52px] text-white/40">{meta.icon} {meta.label}</span>
                  <div className="flex-1 h-[5px] bg-white/8 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm transition-all duration-700" style={{ width: `${v}%`, backgroundColor: meta.color }} />
                  </div>
                  <span className="w-[24px] text-right text-white/50">{v}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 大事记速览 */}
        <div>
          <h4 className="text-[11px] tracking-[3px] text-white/40 mb-2">📖 大事记</h4>
          <div className="flex flex-col gap-1">
            {top.map(([, h]) => (
              <div key={`${h.age}-${h.text}`} className="flex gap-2.5 text-[11px] border-b border-white/[0.03] pb-1">
                <span className="text-[#c9a96e] min-w-[30px] shrink-0">{h.age}岁</span>
                <span className="text-white/45 line-clamp-1">{h.text}</span>
              </div>
            ))}
            {top.length === 0 && <span className="text-[11px] text-white/25">这一生没有任何记录</span>}
          </div>
        </div>

        <div className="flex justify-center gap-3 mt-1">
          <button
            onClick={() => {
              // 埋点：年鉴导出
              track({ type: 'feature_use', ts: Date.now(), feature: 'almanac_export' });
              sfx.select();
              downloadText(
                `${game.name}-人生年鉴.md`,
                buildAlmanacMarkdown(game, verdictTitle, verdictDesc, score, { job, bonds, gaokao, assets }),
              );
            }}
            className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-[#c9a96e] text-[#c9a96e] bg-[#c9a96e]/10
              hover:bg-[#c9a96e]/20 hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]"
          >
            📜 导出年鉴
          </button>
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
