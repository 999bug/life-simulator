import { useMemo } from 'react';
import type { AttributeKey, EventCategory, LifeStage } from '../types';
import SceneDecor from './SceneDecor';
import CategoryDecor from './CategoryDecor';

/** 选项效果主属性 → 背景色调（选择后短暂叠加，属性响应） */
export const ATTR_TINT: Record<AttributeKey, string> = {
  health: '#4ade80',
  intelligence: '#60a5fa',
  wealth: '#fbbf24',
  happiness: '#fb923c',
  social: '#22d3ee',
  appearance: '#f472b6',
  luck: '#a78bfa',
  morality: '#e2e8f0',
};

interface Props {
  stage: LifeStage;
  age: number;
  gender: 'male' | 'female';
  stageLabel: string;
  /** 事件分类（驱动分类场景装饰） */
  category?: EventCategory | null;
  /** 选项效果主属性色调（选择后短暂叠加） */
  tint?: string | null;
}

const STAGE_BG: Record<LifeStage, string> = {
  infant: 'bg-gradient-to-b from-[#d4a76a] via-[#c99555] to-[#b8844a]',
  childhood: 'bg-gradient-to-b from-[#87CEEB] via-[#98D8C8] to-[#7CB342]',
  teen: 'bg-gradient-to-b from-[#2c3e50] via-[#e74c3c]/30 to-[#f39c12]/40',
  young_adult: 'bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]',
  adult: 'bg-gradient-to-b from-[#4a5568] via-[#2d3748] to-[#1a202c]',
  middle_age: 'bg-gradient-to-b from-[#c05621] via-[#dd6b20]/60 to-[#ecc94b]/50',
  elder: 'bg-gradient-to-b from-[#f6ad55] via-[#fbd38d]/60 to-[#fefcbf]/40',
};

export default function SceneArea({ stage, age, gender, stageLabel, category = null, tint = null }: Props) {
  return (
    <div className={`absolute inset-0 h-[55%] overflow-hidden transition-all duration-1000 ${STAGE_BG[stage]}`}>
      {/* 阶段场景装饰 */}
      <SceneDecor stage={stage} />

      {/* 事件分类场景（叠加在阶段场景上，如教室/办公室/医院） */}
      <CategoryDecor category={category} />

      {/* 氛围层：环境光 + 暗角 + 漂移柔光 + 光尘，统一画面景深（不遮挡文字） */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* 顶部环境光 */}
        <div className="absolute inset-x-0 top-0 h-1/2"
          style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)' }} />
        {/* 暗角（聚焦中央人物，营造电影感） */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 48%, rgba(5,8,20,0.32) 100%)' }} />
        {/* 两团缓慢漂移的柔光（暖金 + 冷蓝，随阶段背景自然融合） */}
        <div className="absolute w-[60%] h-[60%] rounded-full blur-3xl animate-drift"
          style={{ left: '-15%', top: '-20%', background: 'radial-gradient(circle, rgba(255,220,170,0.10), transparent 70%)' }} />
        <div className="absolute w-[55%] h-[55%] rounded-full blur-3xl animate-drift-slow"
          style={{ right: '-15%', bottom: '-20%', background: 'radial-gradient(circle, rgba(140,180,255,0.08), transparent 70%)' }} />
        <Motes />
      </div>

      {/* 选项属性色调响应（选择后底部暖光，反馈消失后还原） */}
      {tint && (
        <div className="absolute inset-0 transition-all duration-700"
          style={{ background: `radial-gradient(circle at 50% 85%, ${tint}30, transparent 70%)` }} />
      )}

      {/* 年龄标识 */}
      <div className="absolute top-5 left-6 z-10
        text-sm text-white/85 bg-black/40 backdrop-blur
        px-4 py-2 rounded-full tracking-wider transition-all duration-500">
        {gender === 'male' ? '♂' : '♀'} {age}岁 · {stageLabel}
      </div>

      {/* 阶段标签 */}
      <div className="absolute bottom-10 right-6 z-10
        text-[13px] text-white/80 bg-black/30 backdrop-blur
        px-3 py-1 rounded-full tracking-[4px]">
        {stageLabel}
      </div>

      {/* 人物剪影 */}
      <Character stage={stage} />
    </div>
  );
}

function Character({ stage }: { stage: LifeStage }) {
  const svg = getCharacterSVG(stage);
  // 高度跟随场景区（上限 280px 保持原尺寸），矮屏（横屏手机）等比缩小不露顶
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full flex items-end pointer-events-none">
      <svg viewBox="0 0 120 280" className="h-full max-h-[280px] w-auto transition-all duration-700">
        {svg}
      </svg>
    </div>
  );
}

function getCharacterSVG(stage: LifeStage) {
  const cx = 60;
  switch (stage) {
    case 'infant':
      return (
        <>
          <ellipse cx={cx} cy={255} rx="18" ry="22" fill="rgba(255,255,255,0.12)" />
          <circle cx={cx} cy={235} r="12" fill="rgba(255,220,180,0.15)" />
        </>
      );
    case 'childhood':
      return (
        <>
          <circle cx={cx} cy={180} r="16" fill="rgba(255,220,180,0.15)" />
          <rect x={cx - 11} y={196} width="22" height="36" rx="10" fill="rgba(255,255,255,0.1)" />
          <rect x={cx - 13} y={232} width="8" height="28" rx="4" fill="rgba(255,255,255,0.08)" />
          <rect x={cx + 5} y={232} width="8" height="28" rx="4" fill="rgba(255,255,255,0.08)" />
        </>
      );
    case 'teen':
      return (
        <>
          <circle cx={cx} cy={145} r="18" fill="rgba(255,220,180,0.15)" />
          <rect x={cx - 13} y={163} width="26" height="52" rx="12" fill="rgba(255,255,255,0.1)" />
          <rect x={cx - 15} y={215} width="9" height="42" rx="5" fill="rgba(255,255,255,0.08)" />
          <rect x={cx + 6} y={215} width="9" height="42" rx="5" fill="rgba(255,255,255,0.08)" />
        </>
      );
    case 'young_adult':
      return (
        <>
          <circle cx={cx} cy={120} r="20" fill="rgba(255,220,180,0.15)" />
          <rect x={cx - 15} y={140} width="30" height="62" rx="14" fill="rgba(255,255,255,0.1)" />
          <rect x={cx - 17} y={202} width="10" height="52" rx="6" fill="rgba(255,255,255,0.08)" />
          <rect x={cx + 7} y={202} width="10" height="52" rx="6" fill="rgba(255,255,255,0.08)" />
        </>
      );
    case 'adult':
      return (
        <>
          <circle cx={cx} cy={120} r="21" fill="rgba(255,220,180,0.15)" />
          <rect x={cx - 18} y={141} width="36" height="64" rx="15" fill="rgba(255,255,255,0.1)" />
          <rect x={cx - 19} y={205} width="11" height="50" rx="6" fill="rgba(255,255,255,0.08)" />
          <rect x={cx + 8} y={205} width="11" height="50" rx="6" fill="rgba(255,255,255,0.08)" />
        </>
      );
    case 'middle_age':
      return (
        <>
          <circle cx={cx + 3} cy={125} r="21" fill="rgba(255,220,180,0.14)" />
          <rect x={cx - 16} y={147} width="34" height="60" rx="13" fill="rgba(255,255,255,0.09)" transform={`rotate(-3,${cx},${180})`} />
          <rect x={cx - 18} y={207} width="11" height="48" rx="6" fill="rgba(255,255,255,0.07)" />
          <rect x={cx + 7} y={207} width="11" height="48" rx="6" fill="rgba(255,255,255,0.07)" />
        </>
      );
    case 'elder':
      return (
        <>
          <circle cx={cx + 6} cy={135} r="20" fill="rgba(255,220,180,0.12)" />
          <rect x={cx - 14} y={155} width="32" height="54" rx="13" fill="rgba(255,255,255,0.08)" transform={`rotate(-6,${cx},${180})`} />
          <rect x={cx - 17} y={209} width="11" height="45" rx="5" fill="rgba(255,255,255,0.06)" />
          <rect x={cx + 6} y={209} width="11" height="45" rx="5" fill="rgba(255,255,255,0.06)" />
          <line x1={cx + 26} y1={170} x2={cx + 44} y2={265} stroke="rgba(255,255,255,0.12)" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

/** 漂浮光尘：微弱的暖光粒子缓慢上浮，增添氛围（数量克制，避免喧宾夺主） */
function Motes() {
  // 位置用确定性伪随机（不随阶段切换重排，避免闪烁）
  const motes = useMemo(() => Array.from({ length: 18 }).map((_, i) => {
    const seed = (i * 7919 + 13) % 97;
    return {
      left: `${(seed * 37) % 100}%`,
      bottom: `${(seed * 53) % 72}%`,
      size: 2 + (seed % 4),
      delay: `${(i * 0.73) % 12}s`,
      duration: `${9 + (i % 5) * 3}s`,
    };
  }), []);
  return (
    <div className="absolute inset-0">
      {motes.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-[#ffe6b0] animate-mote"
          style={{
            left: m.left,
            bottom: m.bottom,
            width: m.size,
            height: m.size,
            boxShadow: '0 0 6px rgba(255,230,176,0.6)',
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  );
}
