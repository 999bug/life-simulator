import { useEffect, useRef, useState } from 'react';
import { verdictTitle } from '../engine/verdict';
import type { ChallengeMode, LeaderboardResponse } from '../utils/api';
import LifeSummaryModal from './LifeSummaryModal';
import Modal from './Modal';

type BoardMap = Partial<Record<ChallengeMode, LeaderboardResponse | null>>;

interface Props {
  boards: BoardMap;
  loading?: boolean;
  error?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
}

const MODE_ORDER: ChallengeMode[] = ['daily', 'weekly', 'auto'];

const MODE_TITLE: Record<ChallengeMode, string> = {
  daily: '📅 每日排行榜',
  weekly: '🗓️ 每周排行榜',
  seed: '🔑 种子排行榜',
  auto: '⚡ 快速模拟榜',
};

function emptyBoard(): LeaderboardResponse {
  return {
    mode: 'daily',
    key: '',
    entries: [],
    myRank: null,
    myPercentile: null,
    total: 0,
  };
}

export default function LeaderboardModal({ boards, loading = false, error = false, onRefresh, onClose }: Props) {
  const available = MODE_ORDER.filter(mode => boards[mode]);
  const [active, setActive] = useState<ChallengeMode>(available[0] ?? 'daily');
  const [selectedEntry, setSelectedEntry] = useState<LeaderboardResponse['entries'][number] | null>(null);
  const didAutoSelect = useRef(false);
  const activeMode: ChallengeMode = boards[active] ? active : (available[0] ?? 'daily');
  const board = boards[activeMode] ?? emptyBoard();
  const noBoards = available.length === 0;

  // 首次加载完成后，自动切到有成绩的榜单，避免用户只看到空榜而误以为成绩没记录。
  useEffect(() => {
    if (didAutoSelect.current || available.length === 0) {
      return;
    }
    const preferred = MODE_ORDER.find(mode => boards[mode]?.entries.length) ?? available[0];
    if (preferred) {
      didAutoSelect.current = true;
      setActive(preferred);
    }
  }, [available, boards]);

  if (selectedEntry) {
    return <LifeSummaryModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />;
  }

  return (
    <Modal onClose={onClose} labelledBy="leaderboard-title" contentClassName="w-[440px] max-w-[92vw] max-h-[82vh] overflow-y-auto">
      <h2 id="leaderboard-title" className="text-[16px] tracking-[4px] text-[#c9a96e] text-center font-normal">
        🏆 排行榜
      </h2>

      {available.length > 0 && (
        <div className="mt-3 flex justify-center gap-2">
          {available.map(mode => (
            <button
              key={mode}
              onClick={() => setActive(mode)}
              className={`px-3 py-1.5 rounded-full text-[11px] tracking-[2px] border font-sans transition-colors
                ${activeMode === mode
                  ? 'border-[#c9a96e] bg-[#c9a96e]/10 text-[#c9a96e]'
                  : 'border-white/10 bg-white/[0.02] text-white/35 hover:text-white/70'}`}
            >
              {MODE_TITLE[mode]}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-center text-[11px] tracking-[2px] text-white/40">
        我的排名 {board.myRank ?? '未上榜'}
        <span className="mx-1.5 text-white/20">·</span>
        共 {board.total} 人
      </p>

      <div className="mt-4 flex flex-col gap-1.5">
        {loading && noBoards ? (
          <p className="py-8 text-center text-[12px] text-white/35">排行榜加载中…</p>
        ) : error && noBoards ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-[12px] text-white/45">排行榜加载失败，请检查网络后重试。</p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-5 py-2 rounded-[30px] text-[11px] tracking-[2px] border border-[#5de8a0]/40 text-[#5de8a0]/80 hover:bg-[#5de8a0]/10"
              >
                ↻ 重试
              </button>
            )}
          </div>
        ) : board.entries.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-white/35">还没有成绩，完成一局对应模式后即可上榜。</p>
        ) : (
          board.entries.map((entry, index) => {
            const rank = index + 1;
            const isMe = rank === board.myRank;
            const name = entry.name?.trim() || '无名玩家';
            return (
              <div
                key={rank}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEntry(entry)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedEntry(entry);
                  }
                }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px]
                  cursor-pointer transition-colors
                  ${isMe ? 'border-[#c9a96e]/50 bg-[#c9a96e]/10 hover:bg-[#c9a96e]/15' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'}`}
              >
                <span className={`w-8 shrink-0 text-center font-semibold ${isMe ? 'text-[#c9a96e]' : 'text-white/35'}`}>
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={isMe ? 'text-[#c9a96e]' : 'text-white/70'}>
                    {isMe ? `${name}（你）` : name}
                  </div>
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

      {onRefresh && !loading && (
        <button
          onClick={onRefresh}
          className="mt-4 w-full px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
            border-white/10 text-white/40 hover:border-[#5de8a0]/40 hover:text-[#5de8a0] transition-colors"
        >
          ↻ 刷新榜单
        </button>
      )}

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
