import { useEffect, useRef } from 'react';
import type { AttributeKey, GameState } from '../types';
import { ATTR_META } from '../engine/state';
import { derivePersona, personaSummary } from '../engine/personality';
import { formatDate } from '../hooks/useGame';

/** 名片数据：单条属性的迷你条展示数据 */
export interface LifeCardAttr {
  /** 属性键 */
  key: AttributeKey;
  /** 图标 */
  icon: string;
  /** 中文名 */
  name: string;
  /** 终局值 0-100 */
  value: number;
  /** 主题色（迷你条前景色） */
  color: string;
}

/** 名片结构化数据（canvas 绘制与测试共用） */
export interface LifeCardData {
  /** 名字 */
  name: string;
  /** 性别图标（♂/♀） */
  genderIcon: string;
  /** 世代标签（如「第 3 代」；无世代为空串） */
  generationLabel: string;
  /** 绘制日期（YYYY-MM-DD 展示格式） */
  date: string;
  /** 结局标题（如「平凡的一生」） */
  verdictTitle: string;
  /** 综合评分 0-100 */
  score: number;
  /** 性格一句话（弱画像时「性格仍在书写中」） */
  personaLine: string;
  /** 8 属性迷你条数据（顺序 = 终局属性表） */
  attrs: LifeCardAttr[];
  /** 底部行文案（享年 + 种子码 + 日期） */
  footer: string;
}

/** 性格画像成形最低总次数（与 personality.ts 的 SUMMARY_MIN_TOTAL 一致） */
const PERSONA_MIN_TOTAL = 2;

/**
 * 组装人生名片数据（纯函数，canvas 绘制与测试共用）。
 * 弱画像（性格总次数 < 2）不写概括句，改为「性格仍在书写中」——
 * 简历卡面向收藏，未成形的人生留白比陈述「没有印记」更得体。
 *
 * @param game 终局状态
 * @param score 综合评分（calcScore 输出）
 * @param verdictTitle 结局标题（SummaryScreen 的 getVerdict 结果）
 * @param seed 本局洗牌种子（可空，名片底部展示种子码）
 * @param generation 本局所属世代（可空）
 * @param date 完成日期 YYYYMMDD（默认当天；测试可注入固定值）
 * @returns 名片结构化数据
 */
export function buildLifeCardData(game: GameState, score: number, verdictTitle: string, seed?: number, generation?: number | null, date: string = formatDate(new Date())): LifeCardData {
  // 性格一句话：画像成形（总分 ≥ 2）才写概括句，弱画像改为「性格仍在书写中」
  const persona = derivePersona(game.history);
  const personaTotal = Object.values(persona).reduce((s, n) => s + n, 0);
  const personaLine = personaTotal >= PERSONA_MIN_TOTAL ? personaSummary(persona) : '性格仍在书写中';

  const attrs: LifeCardAttr[] = (Object.entries(game.attributes) as Array<[AttributeKey, number]>).map(([k, v]) => {
    const meta = ATTR_META[k];
    return { key: k, icon: meta.icon, name: meta.name, value: v, color: meta.color };
  });

  // 日期 YYYYMMDD → YYYY-MM-DD（简历卡的正式书写格式）
  const dateLabel = date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  const footer = `享年 ${game.age} 岁${seed != null ? ` · 🔑 种子 ${seed}` : ''} · ${dateLabel}`;

  return {
    name: game.name,
    genderIcon: game.gender === 'male' ? '♂' : '♀',
    generationLabel: generation != null ? `第 ${generation} 代` : '',
    date: dateLabel,
    verdictTitle,
    score,
    personaLine,
    attrs,
    footer,
  };
}

interface Props {
  game: GameState;
  /** 综合评分（SummaryScreen 已计算） */
  score: number;
  /** 结局标题（SummaryScreen 的 getVerdict 结果） */
  verdictTitle: string;
  /** 本局洗牌种子（名片底部展示种子码，可空） */
  seed?: number;
  /** 本局所属世代（族谱非空时传入，名片顶部展示「第 N 代」） */
  generation?: number | null;
  onClose: () => void;
}

/** 名片尺寸（640×400 横版简历卡） */
const CARD_W = 640;
const CARD_H = 400;

/** 属性迷你条区：两列四行 */
const ATTR_COL_X = [40, 336];
const ATTR_COL_W = 264;
const ATTR_ROW_H = 40;
const ATTR_TOP = 196;

/**
 * 人生名片模态：一张可下载的视觉简历卡（收藏/简历向，与传播向分享卡差异化）。
 * canvas 绘制深空蓝底 + 金色点缀：顶部名字/世代，主区结局标题 + 大号评分 + 性格一句话，
 * 中部 8 属性迷你条两列，底部享年 + 种子码 + 日期。
 */
export default function LifeCardModal({ game, score, verdictTitle, seed, generation, onClose }: Props) {
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
    const data = buildLifeCardData(game, score, verdictTitle, seed, generation);

    // 背景：深空蓝渐变
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, '#0e1430');
    bg.addColorStop(1, '#060a18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    const F = '"PingFang SC", "Microsoft YaHei", sans-serif';

    // 顶部：名字 + 性别（左）+ 世代（右上）
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9a96e';
    ctx.font = `300 28px ${F}`;
    ctx.fillText(`${data.genderIcon} ${data.name}`, 40, 52);
    if (data.generationLabel) {
      ctx.textAlign = 'right';
      ctx.font = `300 16px ${F}`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(data.generationLabel, CARD_W - 40, 46);
    }

    // 金色分隔线
    ctx.strokeStyle = 'rgba(201,169,110,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 70);
    ctx.lineTo(CARD_W - 40, 70);
    ctx.stroke();

    // 主区：结局标题（左）+ 性格一句话
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `300 26px ${F}`;
    ctx.fillText(data.verdictTitle, 40, 110);
    ctx.font = `300 15px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`🧭 ${data.personaLine}`, 40, 142);

    // 主区右侧：综合评分大号数字
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9a96e';
    ctx.font = `300 64px ${F}`;
    ctx.fillText(String(data.score), CARD_W - 40, 138);
    ctx.font = `300 15px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('综合评分', CARD_W - 40, 160);

    // 属性分隔线
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(40, 178);
    ctx.lineTo(CARD_W - 40, 178);
    ctx.stroke();

    // 8 属性迷你条：两列四行（icon+名 + 迷你条 + 数值）
    ctx.font = `400 15px ${F}`;
    data.attrs.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = ATTR_COL_X[col];
      const y = ATTR_TOP + row * ATTR_ROW_H;

      // icon + 名
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${a.icon} ${a.name}`, x, y + 5);

      // 迷你条（底色 + 按值 0-100 比例的前景色）
      const barX = x + 84;
      const barW = ATTR_COL_W - 84 - 34;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(barX, y - 2, barW, 5);
      ctx.fillStyle = a.color;
      ctx.fillRect(barX, y - 2, Math.round(barW * (a.value / 100)), 5);

      // 数值（列右缘对齐）
      ctx.textAlign = 'right';
      ctx.fillStyle = a.color;
      ctx.font = `400 16px ${F}`;
      ctx.fillText(String(a.value), x + ATTR_COL_W, y + 5);
      ctx.font = `400 15px ${F}`;
    });

    // 底部：金色分隔线 + 享年/种子/日期
    ctx.strokeStyle = 'rgba(201,169,110,0.35)';
    ctx.beginPath();
    ctx.moveTo(40, 356);
    ctx.lineTo(CARD_W - 40, 356);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `300 15px ${F}`;
    ctx.fillText(data.footer, CARD_W / 2, 380);
  }, [game, score, verdictTitle, seed, generation]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const a = document.createElement('a');
    a.download = `${game.name}-人生名片.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center" onClick={onClose}>
      <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className="rounded-xl shadow-[0_0_60px_rgba(201,169,110,0.12)] max-w-[85vw] h-auto"
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
            下载 PNG
          </button>
        </div>
      </div>
    </div>
  );
}
