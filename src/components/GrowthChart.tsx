import { useEffect, useRef, useState } from 'react';
import type { AttrSnapshot, AttributeKey } from '../types';
import { ATTR_META } from '../engine/state';

interface Props {
  snapshots: AttrSnapshot[];
}

/** 图表逻辑尺寸 */
const W = 580;
const H = 270;

/** 绘图区边距（左为 y 轴标签留白） */
const PAD = { top: 14, right: 14, bottom: 26, left: 36 };

/** 字体（与分享卡片一致） */
const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * 绘制成长曲线（无状态纯函数，结算页大图与分享卡片迷你图共用）。
 * x 轴为年龄（0 → 享年），y 轴固定 0-100 便于横向对比；末端圆点标记最终状态。
 *
 * @param ctx 目标 canvas 上下文（调用方负责 DPR 缩放）
 * @param snapshots 每岁属性快照
 * @param w 逻辑宽度
 * @param h 逻辑高度
 * @param mini 迷你模式（分享卡片）：去掉网格与轴标签，仅画背景与折线
 * @param focusKey 聚焦属性：其余属性曲线淡化，聚焦曲线加粗并压在最上层；null 全部正常绘制
 */
export function drawGrowthChart(ctx: CanvasRenderingContext2D, snapshots: AttrSnapshot[], w: number, h: number, mini: boolean = false, focusKey: AttributeKey | null = null): void {
  if (snapshots.length === 0) {
    return;
  }
  const pad = mini ? { top: 8, right: 8, bottom: 8, left: 8 } : PAD;
  const ageMax = snapshots[snapshots.length - 1].age;
  // 横轴右端：享年向上取整到 10 岁（避免刻度挤在边缘）
  const ageCeil = Math.max(10, Math.ceil(ageMax / 10) * 10);
  const x = (age: number) => pad.left + (age / ageCeil) * (w - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / 100) * (h - pad.top - pad.bottom);

  if (!mini) {
    // 网格：y 每 20 一条，x 每 10 岁一条
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= 100; v += 20) {
      ctx.beginPath();
      ctx.moveTo(pad.left, y(v));
      ctx.lineTo(w - pad.right, y(v));
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(String(v), pad.left - 6, y(v));
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let a = 0; a <= ageCeil; a += 10) {
      ctx.beginPath();
      ctx.moveTo(x(a), pad.top);
      ctx.lineTo(x(a), h - pad.bottom);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${a}岁`, x(a), h - pad.bottom + 6);
    }
  }

  // 8 条属性折线（图例与终值由 HTML/调用方承载，canvas 内只画线 + 末端圆点）
  // 聚焦时非焦点线淡化、焦点线最后绘制压在最上层
  const keys = Object.keys(ATTR_META) as AttributeKey[];
  const ordered = focusKey ? [...keys.filter(k => k !== focusKey), focusKey] : keys;
  for (const key of ordered) {
    const meta = ATTR_META[key];
    const focused = key === focusKey;
    ctx.save();
    if (focusKey && !focused) {
      ctx.globalAlpha = 0.1;
    }
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = mini ? 2 : (focused ? 2.5 : 1.5);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    snapshots.forEach((s, i) => {
      const px = x(s.age);
      const py = y(s.attrs[key]);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.stroke();
    // 末端圆点标记最终状态
    const last = snapshots[snapshots.length - 1];
    ctx.fillStyle = meta.color;
    ctx.beginPath();
    ctx.arc(x(last.age), y(last.attrs[key]), mini ? 3 : (focused ? 3.5 : 2.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * 成长曲线：8 维属性随年龄的折线图（canvas 绘制）。
 * x 轴为年龄（0 → 享年），y 轴固定 0-100 便于横向对比；
 * 末端圆点标记最终状态，图例由 HTML 承载（含各属性终值）。
 * 图例可交互：悬停临时聚焦单条曲线（其余淡化），点击固定聚焦、再点取消。
 */
export default function GrowthChart({ snapshots }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 悬停临时预览，点击固定；hover 优先于 pinned
  const [hovered, setHovered] = useState<AttributeKey | null>(null);
  const [pinned, setPinned] = useState<AttributeKey | null>(null);
  const focus = hovered ?? pinned;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || snapshots.length === 0) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    // 高清屏适配：物理像素按 DPR 放大，逻辑坐标不变
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGrowthChart(ctx, snapshots, W, H, false, focus);
  }, [snapshots, focus]);

  if (snapshots.length === 0) {
    return (
      <div className="w-full max-w-[580px] px-5 py-6 bg-[#1a1a2e] rounded-lg border border-white/[0.04]
        text-xs text-white/35 text-center">
        本局缺少成长数据，无法绘制曲线
      </div>
    );
  }

  return (
    <div className="w-full max-w-[580px] animate-[fadeInUp_1.1s_ease]">
      <canvas
        ref={canvasRef}
        style={{ width: W, height: H }}
        className="rounded-lg bg-[#1a1a2e] border border-white/[0.04]"
      />
      {/* 图例：色块 + 属性名 + 终值（悬停聚焦曲线，点击固定） */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
        {(Object.keys(ATTR_META) as AttributeKey[]).map(key => {
          const meta = ATTR_META[key];
          const last = snapshots[snapshots.length - 1];
          const active = focus === key;
          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned(p => (p === key ? null : key))}
              className={`flex items-center gap-1.5 text-[11px] rounded px-1.5 py-0.5 -mx-1.5 transition-all duration-150 cursor-pointer
                ${active ? 'bg-white/10 text-white/90' : focus ? 'text-white/50 opacity-35' : 'text-white/50'}`}
            >
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: meta.color }} />
              {meta.icon} {meta.name}
              <span className={`font-medium ${active ? 'text-white' : 'text-white/80'}`}>{last.attrs[key]}</span>
            </button>
          );
        })}
        <span className="text-[10px] text-white/25 tracking-[1px]">悬停/点击图例聚焦曲线</span>
      </div>
    </div>
  );
}
