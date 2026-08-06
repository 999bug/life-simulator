import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';
import { checkGoal } from '../engine/goals';
import { GOALS } from '../engine/goals';
import { drawGrowthChart } from './GrowthChart';

interface Props {
  game: GameState;
  /** 结局标题（SummaryScreen 的 getVerdict 结果，如「辉煌的一生」） */
  verdictTitle: string;
  /** 本局所属世代（族谱非空时传入，卡片上展示「第 N 代人生」） */
  generation?: number | null;
  onClose: () => void;
}

/** 卡片尺寸（960×540 横版） */
const CARD_W = 960;
const CARD_H = 540;

/** 迷你曲线区（右侧） */
const CHART = { x: 570, y: 130, w: 340, h: 280 };

/** 人生总结分享卡片：canvas 绘制，支持下载 PNG */
export default function ShareCardModal({ game, verdictTitle, generation, onClose }: Props) {
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

    const F = '"PingFang SC", "Microsoft YaHei", sans-serif';
    // 左侧文字列（x=60 起，左对齐）
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9a96e';
    ctx.font = `300 40px ${F}`;
    ctx.fillText('人生模拟器', 60, 84);
    ctx.font = `300 24px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${game.gender === 'male' ? '♂' : '♀'} ${game.name} · 享年 ${game.age} 岁${generation != null ? ` · 第 ${generation} 代` : ''}`, 60, 122);

    // 结局标题
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `300 48px ${F}`;
    ctx.fillText(verdictTitle, 60, 180);
    // 评分
    ctx.fillStyle = '#c9a96e';
    ctx.font = `600 88px ${F}`;
    ctx.fillText(String(score), 60, 270);
    ctx.font = `300 18px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('综合评分', 60, 298);

    // 目标
    if (goalDef) {
      ctx.font = `300 20px ${F}`;
      ctx.fillStyle = goalResult?.achieved ? '#5de8a0' : 'rgba(255,255,255,0.6)';
      ctx.fillText(`${goalDef.icon} 目标「${goalDef.name}」${goalResult?.achieved ? '已达成' : '未达成'}`, 60, 342);
    }

    // 8 属性（两行四列，紧凑）
    const attrs = Object.entries(game.attributes) as Array<[keyof typeof game.attributes, number]>;
    ctx.font = `400 20px ${F}`;
    attrs.forEach(([k, v], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const meta = ATTR_META[k];
      ctx.fillStyle = meta.color;
      ctx.fillText(`${meta.icon} ${meta.name} ${v}`, 60 + col * 122, 404 + row * 36);
    });

    // 右侧迷你成长曲线（无快照时跳过）
    if ((game.snapshots ?? []).length > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(CHART.x, CHART.y, CHART.w, CHART.h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = `300 16px ${F}`;
      ctx.textAlign = 'left';
      ctx.fillText('成长曲线', CHART.x, CHART.y - 10);
      // drawGrowthChart 以 (0,0) 为原点绘制，平移到曲线区
      ctx.save();
      ctx.translate(CHART.x, CHART.y);
      drawGrowthChart(ctx, game.snapshots!, CHART.w, CHART.h, true);
      ctx.restore();
    }

    // 底部 CTA：传播钩子 + 产品名（引导看到卡片的人也来活一次）
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(201,169,110,0.75)';
    ctx.font = `300 19px ${F}`;
    ctx.fillText('如果重来一次，你会怎么选？', CARD_W / 2, CARD_H - 44);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `300 14px ${F}`;
    ctx.fillText('人生模拟器 · 文字人生模拟游戏', CARD_W / 2, CARD_H - 18);
  }, [game, verdictTitle]);

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
