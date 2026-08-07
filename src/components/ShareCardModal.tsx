import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';
import { checkGoal } from '../engine/goals';
import { GOALS } from '../engine/goals';
import { VERDICT_META, VERDICT_ROUTES } from '../engine/verdict';
import { derivePersona, personaSummary } from '../engine/personality';
import { drawGrowthChart } from './GrowthChart';

interface Props {
  game: GameState;
  /** 结局标题（SummaryScreen 的 getVerdict 结果，如「辉煌的一生」） */
  verdictTitle: string;
  /** 本局结局 key（verdictKey；路线结局查图鉴表展示 icon，分数档无 icon） */
  endingKey: string;
  /** 图鉴收集进度（X/路线总数，卡片展示收集状态驱动分享欲） */
  collectionDone: number;
  /** 每日挑战局：CTA 改为「今日挑战」战绩比较文案 */
  isDaily?: boolean;
  /** 本局所属世代（族谱非空时传入，卡片上展示「第 N 代人生」） */
  generation?: number | null;
  /** 本局洗牌种子（卡片底部展示种子码，好友可挑战同一事件序列） */
  seed?: number;
  onClose: () => void;
}

/** 卡片尺寸（960×540 横版） */
const CARD_W = 960;
const CARD_H = 540;

/** 迷你曲线区（右侧） */
const CHART = { x: 570, y: 130, w: 340, h: 280 };

/** 人生总结分享卡片：canvas 绘制，支持下载 PNG */
export default function ShareCardModal({ game, verdictTitle, endingKey, collectionDone, isDaily = false, generation, seed, onClose }: Props) {
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

    // 路线行：路线结局显示 icon+路线名 + 右侧图鉴收集进度（分数档只显示收集进度）
    const route = VERDICT_META[endingKey];
    ctx.font = `300 20px ${F}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    if (route) {
      ctx.fillText(`${route.icon} ${route.title}`, 60, 322);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(201,169,110,0.8)';
    ctx.fillText(collectionDone >= VERDICT_ROUTES.length ? `🏆 图鉴 ${VERDICT_ROUTES.length}/${VERDICT_ROUTES.length} 全收集` : `📖 图鉴 ${collectionDone}/${VERDICT_ROUTES.length}`, 560, 322);

    // 目标
    if (goalDef) {
      ctx.font = `300 20px ${F}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = goalResult?.achieved ? '#5de8a0' : 'rgba(255,255,255,0.6)';
      ctx.fillText(`${goalDef.icon} 目标「${goalDef.name}」${goalResult?.achieved ? '已达成' : '未达成'}`, 60, 356);
    }

    // 性格概括：画像成形（总分 ≥ 2）才绘制；目标行存在时空隙小，性格行下移贴中
    const persona = derivePersona(game.history);
    const personaTotal = Object.values(persona).reduce((s, n) => s + n, 0);
    if (personaTotal >= 2) {
      ctx.font = `300 15px ${F}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(`🧭 ${personaSummary(persona)}`, 60, goalDef ? 376 : 354);
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

    // 底部：种子挑战码 + 传播 CTA + 产品名
    ctx.textAlign = 'center';
    if (seed != null) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `300 15px ${F}`;
      ctx.fillText(`🔑 种子 ${seed} · 输入同一数字，挑战我走过的这一生`, CARD_W / 2, CARD_H - 66);
    }
    ctx.fillStyle = 'rgba(201,169,110,0.75)';
    ctx.font = `300 19px ${F}`;
    // 每日挑战局：同一天所有人同一局，CTA 突出「今日战绩」比较欲；其余保持传播文案
    ctx.fillText(
      isDaily ? `今日挑战 · 评分 ${score} · 享年 ${game.age}——同样的人生，你拿了几分？` : '如果重来一次，你会怎么选？',
      CARD_W / 2,
      CARD_H - 40,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `300 14px ${F}`;
    ctx.fillText('人生模拟器 · 文字人生模拟游戏', CARD_W / 2, CARD_H - 16);
  }, [game, verdictTitle, endingKey, collectionDone, isDaily, generation, seed]);

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
