import type { LeaderboardEntry } from '../utils/api';
import { ATTR_META } from '../engine/state';
import { verdictTitle } from '../engine/verdict';
import GrowthChart from './GrowthChart';
import Modal from './Modal';

interface Props {
  entry: LeaderboardEntry;
  onClose: () => void;
}

/** 排行榜条目点击后的精简结算页：只看这一生的关键结果，不载入完整历史。 */
export default function LifeSummaryModal({ entry, onClose }: Props) {
  const summary = entry.summary;

  if (!summary) {
    return (
      <Modal onClose={onClose} labelledBy="life-summary-title" contentClassName="w-[440px] max-w-[92vw]">
        <h2 id="life-summary-title" className="text-[16px] tracking-[4px] text-[#c9a96e] text-center font-normal">
          📄 人生结算
        </h2>
        <p className="mt-6 text-center text-[12px] leading-relaxed text-white/45">
          这条旧榜单记录没有保存结算数据。
          <br />
          完成一局新的挑战后，点击新纪录即可查看。
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
            border-white/15 text-white/45 hover:border-[#c9a96e]/50 hover:text-[#c9a96e] transition-colors"
        >
          关闭
        </button>
      </Modal>
    );
  }

  const title = verdictTitle(entry.endingKey);

  return (
    <Modal onClose={onClose} labelledBy="life-summary-title" contentClassName="w-[560px] max-w-[92vw] max-h-[85vh] overflow-y-auto">
      <h2 id="life-summary-title" className="text-[16px] tracking-[4px] text-[#c9a96e] text-center font-normal">
        📄 人生结算
      </h2>

      <div className="mt-4 text-center">
        <div className="text-[13px] text-white/55 tracking-[2px]">
          {summary.gender === 'male' ? '♂' : '♀'} {entry.name} · 享年 {entry.age} 岁
        </div>
        <div className="mt-2 text-[42px] font-extralight text-[#c9a96e] leading-none">{entry.score}</div>
        <div className="mt-1 text-[11px] tracking-[3px] text-white/40">综合评分</div>
        <div className="mt-2 text-[14px] text-white/75 tracking-[2px]">{title}</div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Object.entries(summary.attributes).map(([key, value]) => {
          const meta = ATTR_META[key as keyof typeof summary.attributes];
          return (
            <div
              key={key}
              className="text-center py-2.5 rounded-lg border border-white/[0.05] bg-[#1a1a2e]"
            >
              <div className="text-xl font-light" style={{ color: meta.color }}>{value}</div>
              <div className="mt-1 text-[10px] text-white/40">{meta.icon} {meta.name}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <h3 className="mb-2.5 text-[13px] tracking-[4px] text-[#c9a96e] font-normal">📈 成长曲线</h3>
        <GrowthChart snapshots={summary.snapshots} />
      </div>

      <button
        onClick={onClose}
        className="mt-5 w-full px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
          border-white/15 text-white/45 hover:border-[#c9a96e]/50 hover:text-[#c9a96e] transition-colors"
      >
        关闭
      </button>
    </Modal>
  );
}
