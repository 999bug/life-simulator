import { useState } from 'react';
import type { SeedScores } from '../hooks/useGame';

interface Props {
  /** 确认锁定种子（null = 清除锁定） */
  onConfirm: (seed: number | null) => void;
  onCancel: () => void;
  /** 种子挑战本地比分（输入种子码时展示该种子的最佳成绩） */
  scores?: SeedScores;
}

/** 种子上限（洗牌种子为 2^31 内整数） */
const SEED_MAX = 2 ** 31;

/**
 * 种子挑战输入模态：输入好友分享卡片上的种子码，玩同一序列的人生比分。
 * 纯数字校验，空输入视为清除锁定。
 */
export default function SeedModal({ onConfirm, onCancel, scores = {} }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  // 输入有效种子码时展示该种子的本地最佳成绩（同种子同事件序列，好友比分）
  const validSeed = /^\d+$/.test(value.trim()) && Number(value.trim()) < 2 ** 31 ? value.trim() : '';
  const score = validSeed ? scores[validSeed] : undefined;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed === '') {
      onConfirm(null);
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setError('种子码是一串数字（分享卡片底部可以找到）');
      return;
    }
    const n = Number(trimmed);
    if (!Number.isSafeInteger(n) || n >= SEED_MAX) {
      setError('种子码超出范围，请核对后再输入');
      return;
    }
    onConfirm(n);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onCancel}>
      <div
        className="w-[340px] max-w-[90vw] rounded-2xl bg-[#1a1a2e] border border-[#c9a96e]/30 p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[15px] tracking-[4px] text-[#c9a96e] text-center font-normal">🔑 种子挑战</h3>
        <p className="text-[12px] text-white/50 leading-relaxed tracking-[1px]">
          输入好友分享卡片上的种子码，你将经历与TA完全相同的事件序列——同样的牌，看你们谁打出更好的一生。
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
          placeholder="输入种子码（纯数字）"
          maxLength={10}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-lg
            text-white text-center text-base tracking-[4px] outline-none
            focus:border-[#c9a96e] focus:shadow-[0_0_20px_rgba(201,169,110,0.3)]
            transition-all duration-300 font-sans"
        />
        {error && <p className="text-[11px] text-[#e8a05d] tracking-[1px] text-center">{error}</p>}
        {score && !error && (
          <p className="text-[11px] text-[#c9a96e] tracking-[1px] text-center">
            该种子：最佳评分 {score.bestScore} · 享年 {score.bestAge} · 玩过 {score.plays} 次
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-white/40 hover:text-white/70"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent"
          >
            {value.trim() === '' ? '清除锁定' : '锁定种子'}
          </button>
        </div>
      </div>
    </div>
  );
}
