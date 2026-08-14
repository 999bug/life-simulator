import { verdictTitle } from '../engine/verdict';
import type { ChallengeMode, LeaderboardResponse } from '../utils/api';
import Modal from './Modal';

interface Props {
  mode: ChallengeMode;
  board: LeaderboardResponse;
  onClose: () => void;
}

const MODE_TITLE: Record<ChallengeMode, string> = {
  daily: '📅 每日排行榜',
  weekly: '🗓️ 每周排行榜',
  seed: '🔑 种子排行榜',
};

export default function LeaderboardModal({ mode, board, onClose }: Props) {
  return (
    <Modal onClose={onClose} labelledBy="leaderboard-title" contentClassName="w-[440px] max-w-[92vw] max-h-[82vh] overflow-y-auto">
      <h2 id="leaderboard-title" className="text-[16px] tracking-[4px] text-[#c9a96e] text-center font-normal">
        {MODE_TITLE[mode]}
      </h2>
      <p className="mt-2 text-center text-[11px] tracking-[2px] text-white/40">
        我的排名 {board.myRank ?? '未上榜'}
        <span className="mx-1.5 text-white/20">·</span>
        共 {board.total} 人
      </p>

      <div className="mt-4 flex flex-col gap-1.5">
        {board.entries.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-white/35">还没有成绩，完成一局挑战后即可上榜。</p>
        ) : (
          board.entries.map((entry, index) => {
            const rank = index + 1;
            const isMe = rank === board.myRank;
            return (
              <div
                key={`${entry.deviceId}-${rank}`}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px]
                  ${isMe ? 'border-[#c9a96e]/50 bg-[#c9a96e]/10' : 'border-white/[0.06] bg-white/[0.02]'}`}
              >
                <span className={`w-8 shrink-0 text-center font-semibold ${isMe ? 'text-[#c9a96e]' : 'text-white/35'}`}>
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={isMe ? 'text-[#c9a96e]' : 'text-white/70'}>{isMe ? '你' : '匿名玩家'}</div>
                  <div className="text-[10px] text-white/35 truncate">{verdictTitle(entry.endingKey)}</div>
                </div>
                <span className="shrink-0 text-white/40">享年 {entry.age}</span>
                <span className={`w-9 shrink-0 text-right font-semibold ${isMe ? 'text-[#c9a96e]' : 'text-white/75'}`}>
                  {entry.score}
                </span>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onClose}
        className="mt-4 w-full px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
          border-white/15 text-white/45 hover:border-[#c9a96e]/50 hover:text-[#c9a96e] transition-colors"
      >
        关闭
      </button>
    </Modal>
  );
}
