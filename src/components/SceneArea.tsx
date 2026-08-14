import { useMemo, type ReactNode } from 'react';
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

      {/* 人物（按阶段 × 性别绘制） */}
      <Character stage={stage} gender={gender} />
    </div>
  );
}

// ==================== 人物：按阶段 × 性别绘制的柔和扁平风角色 ====================

/** 腮红 */
const BLOOD = 'rgba(255,120,100,0.30)';

interface CharacterProps {
  stage: LifeStage;
  gender: 'male' | 'female';
}

function Character({ stage, gender }: CharacterProps) {
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-full flex items-end pointer-events-none">
      {/* 轻摇：以脚底为轴的呼吸感，不打扰阅读 */}
      <div className="h-full animate-sway">
        <svg viewBox="0 0 120 280" className="h-full max-h-[280px] w-auto transition-all duration-700">
          {renderCharacter(stage, gender)}
        </svg>
      </div>
    </div>
  );
}

function renderCharacter(stage: LifeStage, gender: 'male' | 'female'): ReactNode {
  let body: ReactNode;
  switch (stage) {
    case 'infant': body = <InfantCharacter />; break;
    case 'childhood': body = <KidCharacter gender={gender} />; break;
    case 'teen': body = <TeenCharacter gender={gender} />; break;
    case 'young_adult': body = <YoungAdultCharacter gender={gender} />; break;
    case 'adult': body = <AdultCharacter gender={gender} />; break;
    case 'middle_age': body = <MiddleAgeCharacter gender={gender} />; break;
    case 'elder': body = <ElderCharacter gender={gender} />; break;
    default: body = null;
  }
  const infant = stage === 'infant';
  return (
    <g>
      <defs>
        {/* 肤色（左上柔光渐变） */}
        <radialGradient id="char-skin" cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffe6c8" />
          <stop offset="65%" stopColor="#ffd8b1" />
          <stop offset="100%" stopColor="#f0b98e" />
        </radialGradient>
        {/* 脚下柔影 */}
        <radialGradient id="char-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(15,12,8,0.30)" />
          <stop offset="100%" stopColor="rgba(15,12,8,0)" />
        </radialGradient>
      </defs>
      <ellipse
        cx="60"
        cy={infant ? 270 : 274}
        rx={infant ? 22 : 27}
        ry="5.5"
        fill="url(#char-shadow)"
      />
      {body}
    </g>
  );
}

/** 圆点眼睛 */
function DotEyes({ cx, cy, dx = 4.5, r = 1.6, color = '#4a3a30' }: { cx: number; cy: number; dx?: number; r?: number; color?: string }) {
  return (
    <g fill={color}>
      <circle cx={cx - dx} cy={cy} r={r} />
      <circle cx={cx + dx} cy={cy} r={r} />
    </g>
  );
}

/** 微笑 */
function Smile({ cx, cy, w = 5, stroke = '#b06a50' }: { cx: number; cy: number; w?: number; stroke?: string }) {
  return (
    <path d={`M${cx - w} ${cy} q${w} ${w * 0.9} ${w * 2} 0`}
      fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
  );
}

/** 腮红 */
function Blush({ cx, cy, dx = 9, r = 2.6 }: { cx: number; cy: number; dx?: number; r?: number }) {
  return (
    <g fill={BLOOD}>
      <circle cx={cx - dx} cy={cy + 2} r={r} />
      <circle cx={cx + dx} cy={cy + 2} r={r} />
    </g>
  );
}

/** 短发帽（头顶半圆发片） */
function HairCap({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return <path d={`M${cx - r} ${cy} a${r} ${r} 0 0 1 ${r * 2} 0 z`} fill={color} />;
}

/** 女性长发（两侧垂发 + 顶发片） */
function LongHair({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return (
    <g>
      <ellipse cx={cx - r + 2} cy={cy + r * 0.55} rx={r * 0.48} ry={r * 0.9} fill={color} />
      <ellipse cx={cx + r - 2} cy={cy + r * 0.55} rx={r * 0.48} ry={r * 0.9} fill={color} />
      <HairCap cx={cx} cy={cy - 1} r={r} color={color} />
    </g>
  );
}

/** 站立角色：腿 + 鞋 + 手臂（皮肤手掌） */
function StandingLimbs({
  legX, legY, legW, legH, legColor, shoeColor,
  armX, armY, armW, armH, armColor, handY, shoeW = 8.5,
}: {
  legX: number; legY: number; legW: number; legH: number; legColor: string;
  shoeColor: string; armX: number; armY: number; armW: number; armH: number;
  armColor: string; handY: number; shoeW?: number;
}) {
  const legGap = legW + 1.5;
  const shoeR = shoeW * 0.47;
  return (
    <g>
      {/* 腿 */}
      <rect x={legX} y={legY} width={legW} height={legH} rx={legW / 2} fill={legColor} />
      <rect x={legX + legGap} y={legY} width={legW} height={legH} rx={legW / 2} fill={legColor} />
      {/* 鞋 */}
      <ellipse cx={legX + legW / 2} cy={274} rx={shoeW} ry={shoeR} fill={shoeColor} />
      <ellipse cx={legX + legGap + legW / 2} cy={274} rx={shoeW} ry={shoeR} fill={shoeColor} />
      {/* 手臂 */}
      <rect x={armX} y={armY} width={armW} height={armH} rx={armW / 2} fill={armColor} />
      <rect x={armX + armW + 34} y={armY} width={armW} height={armH} rx={armW / 2} fill={armColor} />
      {/* 手 */}
      <circle cx={armX + armW / 2} cy={handY} r={armW * 0.52} fill="url(#char-skin)" />
      <circle cx={armX + armW + 34 + armW / 2} cy={handY} r={armW * 0.52} fill="url(#char-skin)" />
    </g>
  );
}

/** 婴儿：襁褓中的新生儿（睡眠状） */
function InfantCharacter() {
  return (
    <g>
      {/* 襁褓 */}
      <rect x="32" y="233" width="56" height="41" rx="18" fill="#fdf4e4" />
      <path d="M37 247 q6 4 12 0" stroke="#e8d4b4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M83 247 q-6 4 -12 0" stroke="#e8d4b4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M44 262 q16 6 32 0" stroke="#eeddc0" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* 头后柔光 */}
      <circle cx="60" cy="215" r="19" fill="rgba(255,255,235,0.35)" />
      {/* 头 */}
      <circle cx="60" cy="220" r="14" fill="url(#char-skin)" />
      {/* 胎发 */}
      <path d="M50 210 q3 -6 8 -5 q4 1 6 -2 q3 2 6 3 q3 -1 5 4" fill="none" stroke="#8a6a4a" strokeWidth="2" strokeLinecap="round" />
      {/* 睡眼 */}
      <path d="M53 222 q2.8 3.2 5.6 0" fill="none" stroke="#8a5a40" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M61.4 222 q2.8 3.2 5.6 0" fill="none" stroke="#8a5a40" strokeWidth="1.6" strokeLinecap="round" />
      {/* 嘴 */}
      <path d="M57.2 228.5 q2.8 2.4 5.6 0" fill="none" stroke="#c9805f" strokeWidth="1.5" strokeLinecap="round" />
      {/* 腮红 */}
      <circle cx="52" cy="226" r="2.4" fill={BLOOD} />
      <circle cx="68" cy="226" r="2.4" fill={BLOOD} />
    </g>
  );
}

/** 童年：小个子 + 短裤 + 圆头鞋 */
function KidCharacter({ gender }: { gender: 'male' | 'female' }) {
  const shirt = gender === 'female' ? '#ffab91' : '#ffd54f';
  const shorts = '#5c8dd6';
  const hair = '#3e2f23';
  return (
    <g>
      {/* 腿（光脚） */}
      <rect x="50" y="248" width="8.5" height="24" rx="4.2" fill="url(#char-skin)" />
      <rect x="61.5" y="248" width="8.5" height="24" rx="4.2" fill="url(#char-skin)" />
      {/* 鞋 */}
      <ellipse cx="54" cy="273" rx="7.5" ry="4" fill="#7a5a3a" />
      <ellipse cx="66" cy="273" rx="7.5" ry="4" fill="#7a5a3a" />
      {/* 短裤 */}
      <rect x="46" y="236" width="28" height="17" rx="7" fill={shorts} />
      {/* 手臂 */}
      <rect x="36" y="210" width="9" height="24" rx="4.5" fill={shirt} />
      <rect x="75" y="210" width="9" height="24" rx="4.5" fill={shirt} />
      <circle cx="40.5" cy="236" r="4.5" fill="url(#char-skin)" />
      <circle cx="79.5" cy="236" r="4.5" fill="url(#char-skin)" />
      {/* 上衣 */}
      <rect x="42" y="198" width="36" height="44" rx="14" fill={shirt} />
      <path d="M52 200 q8 8 16 0" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
      {/* 头 */}
      <circle cx="60" cy="181" r="16" fill="url(#char-skin)" />
      {/* 头发 */}
      <HairCap cx={60} cy={180} r={16} color={hair} />
      {gender === 'female' && (
        <g>
          <circle cx="43" cy="178" r="5.5" fill={hair} />
          <circle cx="77" cy="178" r="5.5" fill={hair} />
          <circle cx="43" cy="183" r="1.8" fill="#ff8fb0" />
          <circle cx="77" cy="183" r="1.8" fill="#ff8fb0" />
        </g>
      )}
      {/* 脸 */}
      <DotEyes cx={60} cy={183} />
      <Smile cx={60} cy={189.5} w={4.5} />
      <Blush cx={60} cy={186} dx={8.5} />
    </g>
  );
}

/** 少年：连帽衫 + 牛仔裤 */
function TeenCharacter({ gender }: { gender: 'male' | 'female' }) {
  const hair = gender === 'female' ? '#3a2f28' : '#4a3a2c';
  return (
    <g>
      <StandingLimbs
        legX={50} legY={230} legW={9.5} legH={44} legColor="#3d4a5d"
        shoeColor="#2e3440" armX={34} armY={182} armW={10} armH={30}
        armColor="#5fb8a6" handY={213}
      />
      {/* 连帽衫 */}
      <rect x="41" y="170" width="38" height="66" rx="15" fill="#5fb8a6" />
      <path d="M45 172 q15 -15 30 0 l-2 5 q-13 -8 -26 0 z" fill="#4d9c8c" />
      <path d="M52 216 q8 8 16 0 l0 8 q-8 6 -16 0 z" fill="rgba(255,255,255,0.18)" />
      {/* 头 */}
      <circle cx="60" cy="152" r="17" fill="url(#char-skin)" />
      {/* 头发 */}
      {gender === 'female'
        ? <LongHair cx={60} cy={152} r={17} color={hair} />
        : <HairCap cx={60} cy={151} r={17} color={hair} />}
      {/* 脸 */}
      <DotEyes cx={60} cy={154} />
      <Smile cx={60} cy={160.5} w={5} />
      <Blush cx={60} cy={157} dx={9} />
    </g>
  );
}

/** 青年：衬衫（男）/ 连衣裙（女） */
function YoungAdultCharacter({ gender }: { gender: 'male' | 'female' }) {
  const male = gender === 'male';
  const hair = male ? '#2e2b33' : '#2a2730';
  return (
    <g>
      {male ? (
        <>
          <StandingLimbs
            legX={49} legY={214} legW={10} legH={60} legColor="#6a7480"
            shoeColor="#3a3f47" armX={33} armY={152} armW={10} armH={34}
            armColor="#8fb7e8" handY={186}
          />
          <rect x="41" y="146" width="38" height="74" rx="14" fill="#8fb7e8" />
          <path d="M52 148 l8 8 l8 -8" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* 腿（裙下）+ 鞋 */}
          <rect x="51" y="238" width="8" height="36" rx="4" fill="url(#char-skin)" />
          <rect x="61" y="238" width="8" height="36" rx="4" fill="url(#char-skin)" />
          <ellipse cx="55" cy="274" rx="7.5" ry="3.8" fill="#8a5a78" />
          <ellipse cx="65" cy="274" rx="7.5" ry="3.8" fill="#8a5a78" />
          {/* 裙 */}
          <path d="M41 178 L34 238 Q60 248 86 238 L79 178 Z" fill="#e87b8a" />
          <rect x="41" y="146" width="38" height="40" rx="13" fill="#f28b82" />
          <rect x="33" y="152" width="10" height="32" rx="5" fill="#f28b82" />
          <rect x="77" y="152" width="10" height="32" rx="5" fill="#f28b82" />
          <circle cx="38" cy="184" r="5.2" fill="url(#char-skin)" />
          <circle cx="82" cy="184" r="5.2" fill="url(#char-skin)" />
        </>
      )}
      {/* 头 */}
      <circle cx="60" cy="122" r="19" fill="url(#char-skin)" />
      {male
        ? <HairCap cx={60} cy={121} r={19} color={hair} />
        : <LongHair cx={60} cy={122} r={19} color={hair} />}
      {/* 脸 */}
      <DotEyes cx={60} cy={124} />
      <Smile cx={60} cy={130.5} w={5.5} />
    </g>
  );
}

/** 成年：白衬衫领带（男）/ 淡紫裙（女） */
function AdultCharacter({ gender }: { gender: 'male' | 'female' }) {
  const male = gender === 'male';
  const hair = male ? '#33302e' : '#40322c';
  return (
    <g>
      {male ? (
        <>
          <StandingLimbs
            legX={48.5} legY={212} legW={10.5} legH={62} legColor="#39465c"
            shoeColor="#262c36" armX={32} armY={150} armW={10.5} armH={36}
            armColor="#e8e8e2" handY={186}
          />
          {/* 衬衫 */}
          <rect x="40" y="144" width="40" height="76" rx="14" fill="#f4f4f0" />
          <path d="M52 148 q8 7 16 0" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
          {/* 领带 */}
          <path d="M56 149 l8 0 l-3 22 l-2 6 z" fill="#7a4a8a" />
        </>
      ) : (
        <>
          <rect x="51" y="238" width="8" height="36" rx="4" fill="url(#char-skin)" />
          <rect x="61" y="238" width="8" height="36" rx="4" fill="url(#char-skin)" />
          <ellipse cx="55" cy="274" rx="7.5" ry="3.8" fill="#6a4a5a" />
          <ellipse cx="65" cy="274" rx="7.5" ry="3.8" fill="#6a4a5a" />
          {/* 连衣裙 */}
          <path d="M41 178 L35 238 Q60 248 85 238 L79 178 Z" fill="#9a7bd6" />
          <rect x="40" y="144" width="40" height="40" rx="13" fill="#a98be0" />
          <rect x="32" y="150" width="10.5" height="32" rx="5" fill="#a98be0" />
          <rect x="77.5" y="150" width="10.5" height="32" rx="5" fill="#a98be0" />
          <circle cx="37" cy="182" r="5.4" fill="url(#char-skin)" />
          <circle cx="83" cy="182" r="5.4" fill="url(#char-skin)" />
        </>
      )}
      {/* 头 */}
      <circle cx="60" cy="122" r="20" fill="url(#char-skin)" />
      {male
        ? <HairCap cx={60} cy={120} r={20} color={hair} />
        : <LongHair cx={60} cy={122} r={20} color={hair} />}
      {/* 脸 */}
      <DotEyes cx={60} cy={124} />
      <Smile cx={60} cy={130.5} w={6} />
    </g>
  );
}

/** 中年：夹克（男，微驼 + 眼镜）/ 开衫长裙（女） */
function MiddleAgeCharacter({ gender }: { gender: 'male' | 'female' }) {
  const male = gender === 'male';
  return (
    <g transform="rotate(-3 60 205)">
      {male ? (
        <>
          <StandingLimbs
            legX={49} legY={214} legW={10.5} legH={60} legColor="#8a7a5a"
            shoeColor="#4a3f30" armX={32} armY={152} armW={10.5} armH={36}
            armColor="#7a5e40" handY={188}
          />
          {/* 夹克 */}
          <rect x="40" y="146" width="40" height="74" rx="14" fill="#8a6a4a" />
          <path d="M52 148 q8 7 16 0" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="2" />
          <circle cx="60" cy="182" r="1.6" fill="#5a4a3a" />
          <circle cx="60" cy="196" r="1.6" fill="#5a4a3a" />
        </>
      ) : (
        <>
          <rect x="51" y="240" width="8" height="34" rx="4" fill="url(#char-skin)" />
          <rect x="61" y="240" width="8" height="34" rx="4" fill="url(#char-skin)" />
          <ellipse cx="55" cy="274" rx="7.5" ry="3.8" fill="#5a4048" />
          <ellipse cx="65" cy="274" rx="7.5" ry="3.8" fill="#5a4048" />
          {/* 长裙 */}
          <path d="M41 180 L36 238 Q60 247 84 238 L79 180 Z" fill="#8a5a68" />
          {/* 开衫 */}
          <rect x="40" y="148" width="40" height="42" rx="13" fill="#a85a6a" />
          <rect x="32" y="154" width="10.5" height="32" rx="5" fill="#a85a6a" />
          <rect x="77.5" y="154" width="10.5" height="32" rx="5" fill="#a85a6a" />
          <circle cx="37" cy="186" r="5.4" fill="url(#char-skin)" />
          <circle cx="83" cy="186" r="5.4" fill="url(#char-skin)" />
        </>
      )}
      {/* 头 */}
      <circle cx="60" cy="126" r="18.5" fill="url(#char-skin)" />
      {/* 头发（带灰） */}
      {male
        ? <HairCap cx={60} cy={124} r={18.5} color="#7a7068" />
        : <LongHair cx={60} cy={126} r={18.5} color="#6a5a50" />}
      {/* 眼镜（男） */}
      {male && (
        <g stroke="#4a4038" strokeWidth="1.6" fill="none">
          <circle cx="53.5" cy="128" r="6.2" />
          <circle cx="66.5" cy="128" r="6.2" />
          <path d="M59.7 128 h0.6" />
        </g>
      )}
      {/* 脸 */}
      <DotEyes cx={60} cy={128} />
      <Smile cx={60} cy={134} w={5.5} />
    </g>
  );
}

/** 老年：驼背 + 白发（男持拐杖 / 女披肩长裙） */
function ElderCharacter({ gender }: { gender: 'male' | 'female' }) {
  const male = gender === 'male';
  return (
    <g transform="rotate(-6 60 205)">
      {male ? (
        <>
          <StandingLimbs
            legX={50} legY={218} legW={10} legH={56} legColor="#5a6168"
            shoeColor="#33383e" armX={33} armY={158} armW={10} armH={34}
            armColor="#8a9098" handY={192}
          />
          {/* 毛衣 */}
          <rect x="41" y="152" width="38" height="72" rx="14" fill="#9aa0a8" />
          {/* 拐杖（右手边） */}
          <path d="M31 171 q7 -10 13 -3" stroke="#8a6a4a" strokeWidth="4" fill="none" strokeLinecap="round" />
          <line x1="39" y1="173" x2="33" y2="270" stroke="#8a6a4a" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="52" y="244" width="7.5" height="30" rx="3.5" fill="url(#char-skin)" />
          <rect x="60.5" y="244" width="7.5" height="30" rx="3.5" fill="url(#char-skin)" />
          <ellipse cx="55.5" cy="274" rx="7" ry="3.6" fill="#4a4048" />
          <ellipse cx="64.5" cy="274" rx="7" ry="3.6" fill="#4a4048" />
          {/* 长裙 */}
          <path d="M42 186 L37 244 Q60 252 83 244 L78 186 Z" fill="#8a7a6a" />
          {/* 披肩 */}
          <path d="M42 152 q18 -12 36 0 l-6 12 q-12 -6 -24 0 z" fill="#c9a86a" />
          <rect x="41" y="158" width="38" height="36" rx="12" fill="#9a8a78" />
          <rect x="34" y="162" width="10" height="30" rx="5" fill="#c9a86a" />
          <rect x="76" y="162" width="10" height="30" rx="5" fill="#c9a86a" />
          <circle cx="39" cy="192" r="5.2" fill="url(#char-skin)" />
          <circle cx="81" cy="192" r="5.2" fill="url(#char-skin)" />
        </>
      )}
      {/* 头（略前倾） */}
      <circle cx="61" cy="132" r="17" fill="url(#char-skin)" />
      {/* 白发 */}
      {male
        ? <HairCap cx={61} cy={130} r={17} color="#e8e4dc" />
        : <LongHair cx={61} cy={132} r={17} color="#ece8e0" />}
      {/* 皱纹眉角 + 脸 */}
      <path d="M50 129 q-2 -3 0 -5" stroke="rgba(180,120,90,0.5)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M72 129 q2 -3 0 -5" stroke="rgba(180,120,90,0.5)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <DotEyes cx={61} cy={134} dx={4.2} />
      <Smile cx={61} cy={140} w={5} />
    </g>
  );
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
