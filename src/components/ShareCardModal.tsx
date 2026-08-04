import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';
import { checkGoal } from '../engine/goals';
import { GOALS } from '../engine/goals';

interface Props {
  game: GameState;
  /** 结局标题（SummaryScreen 的 getVerdict 结果，如「辉煌的一生」） */
  verdictTitle: string;
  onClose: () => void;
}

/** 卡片尺寸（960×540 横版） */
const CARD_W = 960;
const CARD_H = 540;

/** 人生总结分享卡片：canvas 绘制，支持下载 PNG */
export default function ShareCardModal({ game, verdictTitle, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const score = calcScore(game.attributes);
    const goalResult = checkGoal(game.goal, game);
    const goalDef = GOALS.find(g => g.key === game.goal);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, '#1a1a30');
    bg.addColorStop(1, '#0a0a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // 顶部标题
    ctx.fillStyle = '#c9a96e';
    ctx.font = '300 44px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('人生模拟器', CARD_W / 2, 84);
    ctx.font = '300 26px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${game.gender === 'male' ? '♂' : '♀'} ${game.name} · 享年 ${game.age} 岁`, CARD_W / 2, 126);

    // 结局标题
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '300 52px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(verdictTitle, CARD_W / 2, 196);
    // 评分
    ctx.fillStyle = '#c9a96e';
    ctx.font = '600 96px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(String(score), CARD_W / 2, 300);
    ctx.font = '300 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('综合评分', CARD_W / 2, 334);

    // 目标
    if (goalDef) {
      ctx.font = '300 22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = goalResult?.achieved ? '#5de8a0' : 'rgba(255,255,255,0.6)';
      ctx.fillText(`${goalDef.icon} 目标「${goalDef.name}」${goalResult?.achieved ? '已达成' : '未达成'}`, CARD_W / 2, 384);
    }

    // 8 属性（两行四列）
    const attrs = Object.entries(game.attributes) as Array<[keyof typeof game.attributes, number]>;
    ctx.font = '400 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    attrs.forEach(([k, v], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 120 + col * 200;
      const y = 430 + row * 44;
      const meta = ATTR_META[k];
      ctx.fillStyle = meta.color;
      ctx.textAlign = 'left';
      ctx.fillText(`${meta.icon} ${meta.name} ${v}`, x, y);
    });

    // 底部水印
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '300 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('由人生模拟器生成', CARD_W / 2, CARD_H - 22);
  }, [game]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const a = document.createElement('a');
    a.download = `${game.name}-人生总结.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className="rounded-2xl shadow-[0_0_60px_rgba(201,169,110,0.15)] max-w-[85vw] h-auto"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            关闭
          </button>
          <button
            onClick={handleDownload}
            className="px-7 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent"
          >
            保存图片
          </button>
        </div>
      </div>
    </div>
  );
}
