import type { EventCategory } from '../types';
import { useMemo } from 'react';

interface Props {
  category: EventCategory | null;
}

/** 分类主色：叠加在阶段场景上的低饱和元素色 */
const CATEGORY_COLOR: Record<EventCategory, string> = {
  family: '#d4a76a',
  career: '#64748b',
  health: '#4ade80',
  friend: '#22d3ee',
  education: '#fbbf24',
  personality: '#a78bfa',
  technology: '#38bdf8',
  love: '#fb7185',
  finance: '#f59e0b',
  hobby: '#f472b6',
  sports: '#fb923c',
};

export default function CategoryDecor({ category }: Props) {
  const svg = useMemo(() => (category ? renderCategory(category) : null), [category]);
  if (!svg) {
    return null;
  }
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-70 transition-opacity duration-700">
      <svg viewBox="0 0 960 400" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
        {svg}
      </svg>
    </div>
  );
}

function renderCategory(category: EventCategory) {
  const c = CATEGORY_COLOR[category];
  const fill = (a: number) => hexToRgba(c, a);
  switch (category) {
    case 'family': return FamilyScene(fill);
    case 'career': return CareerScene(fill);
    case 'health': return HealthScene(fill);
    case 'friend': return FriendScene(fill);
    case 'education': return EducationScene(fill);
    case 'personality': return PersonalityScene(fill);
    case 'technology': return TechnologyScene(fill);
    case 'love': return LoveScene(fill);
    case 'finance': return FinanceScene(fill);
    case 'hobby': return HobbyScene(fill);
    case 'sports': return SportsScene(fill);
  }
}

/** hex 色转 rgba 字符串 */
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ==================== 家庭：沙发 + 台灯 + 窗 ====================
function FamilyScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 沙发 */}
      <rect x="90" y="230" width="200" height="70" rx="18" fill={fill(0.14)} stroke={fill(0.35)} strokeWidth="3" />
      <rect x="110" y="195" width="160" height="50" rx="14" fill={fill(0.1)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="70" y="295" width="18" height="70" rx="6" fill={fill(0.16)} />
      <rect x="292" y="295" width="18" height="70" rx="6" fill={fill(0.16)} />
      {/* 台灯 */}
      <line x1="820" y1="160" x2="820" y2="320" stroke={fill(0.35)} strokeWidth="5" strokeLinecap="round" />
      <path d="M775 165 Q820 130 865 165 Z" fill={fill(0.2)} stroke={fill(0.4)} strokeWidth="3" />
      <ellipse cx="820" cy="330" rx="40" ry="10" fill={fill(0.1)} />
      {/* 窗 */}
      <rect x="700" y="60" width="140" height="110" rx="6" fill={fill(0.06)} stroke={fill(0.3)} strokeWidth="3" />
      <line x1="770" y1="60" x2="770" y2="170" stroke={fill(0.3)} strokeWidth="3" />
      <line x1="700" y1="115" x2="840" y2="115" stroke={fill(0.3)} strokeWidth="3" />
    </g>
  );
}

// ==================== 事业：写字楼 + 办公桌 ====================
function CareerScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 写字楼 */}
      <rect x="700" y="90" width="110" height="280" rx="4" fill={fill(0.1)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="830" y="140" width="80" height="230" rx="4" fill={fill(0.07)} stroke={fill(0.25)} strokeWidth="3" />
      {[130, 170, 210, 250, 290, 330].map(y => (
        <rect key={y} x="720" y={y} width="24" height="16" rx="2" fill={fill(0.25)} />
      ))}
      <rect x="850" y="175" width="18" height="14" rx="2" fill={fill(0.2)} />
      {/* 办公桌 */}
      <rect x="100" y="250" width="230" height="16" rx="6" fill={fill(0.16)} stroke={fill(0.35)} strokeWidth="3" />
      <rect x="120" y="266" width="12" height="80" rx="4" fill={fill(0.14)} />
      <rect x="298" y="266" width="12" height="80" rx="4" fill={fill(0.14)} />
      {/* 电脑 */}
      <rect x="160" y="195" width="110" height="60" rx="4" fill={fill(0.2)} stroke={fill(0.4)} strokeWidth="3" />
      <rect x="185" y="255" width="60" height="8" rx="3" fill={fill(0.2)} />
      <rect x="205" y="263" width="20" height="26" rx="3" fill={fill(0.18)} />
    </g>
  );
}

// ==================== 健康：医疗十字 + 跑步鞋 ====================
function HealthScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 医疗十字 */}
      <rect x="770" y="150" width="60" height="150" rx="10" fill={fill(0.18)} stroke={fill(0.4)} strokeWidth="3" />
      <rect x="725" y="195" width="150" height="60" rx="10" fill={fill(0.18)} stroke={fill(0.4)} strokeWidth="3" />
      {/* 床 */}
      <rect x="90" y="240" width="220" height="70" rx="12" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="90" y="310" width="26" height="50" rx="6" fill={fill(0.14)} />
      <rect x="284" y="310" width="26" height="50" rx="6" fill={fill(0.14)} />
      <rect x="110" y="225" width="80" height="18" rx="8" fill={fill(0.25)} />
      {/* 跑步鞋 */}
      <path d="M620 330 q40 -50 90 -30 l-10 35 q-35 -10 -60 15 z" fill={fill(0.14)} stroke={fill(0.35)} strokeWidth="3" />
    </g>
  );
}

// ==================== 友谊：圆桌双椅 + 咖啡杯 ====================
function FriendScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 圆桌 */}
      <ellipse cx="480" cy="300" rx="120" ry="28" fill={fill(0.1)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="470" y="300" width="20" height="70" rx="6" fill={fill(0.14)} />
      {/* 双椅 */}
      <rect x="300" y="260" width="70" height="90" rx="14" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="600" y="260" width="70" height="90" rx="14" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      {/* 咖啡杯 */}
      <path d="M450 270 h60 v26 a30 30 0 0 1 -60 0 z" fill={fill(0.25)} stroke={fill(0.45)} strokeWidth="3" />
      <path d="M512 275 h22 a14 14 0 0 1 0 26 h-14" fill="none" stroke={fill(0.45)} strokeWidth="3" />
      {/* 热气 */}
      <path d="M470 250 q8 -12 0 -24 q8 -12 0 -24" fill="none" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
      <path d="M490 250 q8 -12 0 -24 q8 -12 0 -24" fill="none" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

// ==================== 教育：黑板 + 书本 ====================
function EducationScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 黑板 */}
      <rect x="110" y="80" width="280" height="180" rx="8" fill={fill(0.08)} stroke={fill(0.35)} strokeWidth="4" />
      <rect x="120" y="90" width="260" height="160" rx="4" fill={fill(0.05)} />
      {/* 板书 */}
      <line x1="160" y1="130" x2="280" y2="130" stroke={fill(0.4)} strokeWidth="4" strokeLinecap="round" />
      <line x1="160" y1="160" x2="240" y2="160" stroke={fill(0.4)} strokeWidth="4" strokeLinecap="round" />
      <circle cx="320" cy="145" r="18" fill="none" stroke={fill(0.4)} strokeWidth="4" />
      {/* 讲台 */}
      <rect x="180" y="260" width="160" height="14" rx="5" fill={fill(0.16)} />
      <rect x="195" y="274" width="12" height="90" rx="4" fill={fill(0.14)} />
      <rect x="313" y="274" width="12" height="90" rx="4" fill={fill(0.14)} />
      {/* 书本堆 */}
      {[0, 1, 2].map(i => (
        <rect key={i} x={740 - i * 12} y={300 - i * 22} width="150" height="22" rx="5" fill={fill(0.12 + i * 0.05)} stroke={fill(0.3)} strokeWidth="3" />
      ))}
    </g>
  );
}

// ==================== 个性：对话气泡 + 星 ====================
function PersonalityScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 对话气泡 */}
      <ellipse cx="250" cy="150" rx="130" ry="80" fill={fill(0.1)} stroke={fill(0.35)} strokeWidth="3" />
      <path d="M200 220 l-25 40 q45 -8 60 -34 z" fill={fill(0.1)} stroke={fill(0.35)} strokeWidth="3" />
      <circle cx="210" cy="140" r="10" fill={fill(0.35)} />
      <circle cx="260" cy="140" r="10" fill={fill(0.35)} />
      <path d="M220 175 q40 25 80 0" fill="none" stroke={fill(0.35)} strokeWidth="4" strokeLinecap="round" />
      {/* 星 */}
      <path d="M760 90 l14 30 33 4 -24 22 6 32 -29 -16 -29 16 6 -32 -24 -22 33 -4 z" fill={fill(0.22)} />
      <path d="M860 210 l10 20 22 3 -16 14 4 22 -20 -11 -20 11 4 -22 -16 -14 22 -3 z" fill={fill(0.16)} />
      {/* 发散线 */}
      <line x1="760" y1="45" x2="760" y2="30" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
      <line x1="815" y1="95" x2="832" y2="88" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
      <line x1="715" y1="95" x2="700" y2="105" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

// ==================== 科技：屏幕 + 电路线 ====================
function TechnologyScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 屏幕 */}
      <rect x="680" y="100" width="200" height="140" rx="10" fill={fill(0.08)} stroke={fill(0.35)} strokeWidth="4" />
      <rect x="695" y="115" width="170" height="100" rx="4" fill={fill(0.05)} />
      {/* 屏幕窗口 */}
      <rect x="710" y="135" width="70" height="50" rx="4" fill={fill(0.18)} />
      <rect x="790" y="135" width="60" height="50" rx="4" fill={fill(0.12)} />
      <rect x="710" y="195" width="140" height="8" rx="3" fill={fill(0.16)} />
      <rect x="755" y="260" width="50" height="12" rx="4" fill={fill(0.2)} />
      {/* 电路线 */}
      <path d="M80 320 h120 l30 -40 h60 l30 40 h120" fill="none" stroke={fill(0.35)} strokeWidth="4" />
      <circle cx="80" cy="320" r="10" fill={fill(0.3)} />
      <circle cx="430" cy="320" r="10" fill={fill(0.3)} />
      <rect x="200" y="300" width="34" height="34" rx="6" fill={fill(0.14)} stroke={fill(0.35)} strokeWidth="3" transform="rotate(45 217 317)" />
      <path d="M520 300 h80 l20 -40 h50" fill="none" stroke={fill(0.3)} strokeWidth="4" />
      <circle cx="670" cy="260" r="8" fill={fill(0.25)} />
    </g>
  );
}

// ==================== 爱情：爱心 + 路灯 + 花瓣 ====================
function LoveScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 爱心 */}
      <path d="M480 160 c-30 -45 -110 -20 -95 40 c12 50 95 95 95 95 c0 0 83 -45 95 -95 c15 -60 -65 -85 -95 -40 z" fill={fill(0.16)} stroke={fill(0.4)} strokeWidth="3" />
      {/* 路灯 */}
      <line x1="200" y1="120" x2="200" y2="330" stroke={fill(0.35)} strokeWidth="6" strokeLinecap="round" />
      <path d="M155 130 q45 -28 90 0" fill="none" stroke={fill(0.35)} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="200" cy="135" rx="55" ry="14" fill={fill(0.16)} />
      <line x1="760" y1="120" x2="760" y2="330" stroke={fill(0.35)} strokeWidth="6" strokeLinecap="round" />
      <path d="M715 130 q45 -28 90 0" fill="none" stroke={fill(0.35)} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="760" cy="135" rx="55" ry="14" fill={fill(0.16)} />
      {/* 花瓣 */}
      <ellipse cx="340" cy="80" rx="10" ry="6" fill={fill(0.3)} transform="rotate(-20 340 80)" />
      <ellipse cx="600" cy="60" rx="10" ry="6" fill={fill(0.25)} transform="rotate(15 600 60)" />
      <ellipse cx="420" cy="50" rx="8" ry="5" fill={fill(0.2)} transform="rotate(40 420 50)" />
    </g>
  );
}

// ==================== 金融：金币 + 折线 ====================
function FinanceScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 金币堆 */}
      {[0, 1, 2].map(i => (
        <ellipse key={i} cx={230 + i * 8} cy={330 - i * 18} rx={60} ry={16} fill={fill(0.14 + i * 0.05)} stroke={fill(0.35)} strokeWidth="3" />
      ))}
      <circle cx="520" cy="290" r="26" fill={fill(0.2)} stroke={fill(0.4)} strokeWidth="3" />
      <text x="520" y="298" textAnchor="middle" fontSize="24" fill={fill(0.55)} fontWeight="bold">¥</text>
      <circle cx="580" cy="330" r="18" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      {/* 上升折线 */}
      <path d="M700 320 L750 280 L790 300 L850 230 L890 250" fill="none" stroke={fill(0.45)} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="850" cy="230" r="8" fill={fill(0.5)} />
      {/* 箭头 */}
      <path d="M880 220 l8 24 l-18 -4 z" fill={fill(0.5)} />
    </g>
  );
}

// ==================== 爱好：调色板 + 画笔 + 相机 ====================
function HobbyScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 调色板 */}
      <path d="M140 280 a75 75 0 1 0 150 0 a75 75 0 1 0 -150 0 z" fill={fill(0.12)} stroke={fill(0.35)} strokeWidth="3" />
      <circle cx="180" cy="265" r="10" fill={fill(0.3)} />
      <circle cx="240" cy="250" r="10" fill={fill(0.2)} />
      <circle cx="260" cy="300" r="10" fill={fill(0.25)} />
      {/* 画笔 */}
      <line x1="300" y1="330" x2="400" y2="160" stroke={fill(0.4)} strokeWidth="6" strokeLinecap="round" />
      <path d="M400 160 l-18 -6 6 20 z" fill={fill(0.4)} />
      {/* 吉他 */}
      <ellipse cx="720" cy="290" rx="55" ry="80" fill={fill(0.1)} stroke={fill(0.3)} strokeWidth="3" transform="rotate(-12 720 290)" />
      <circle cx="720" cy="265" r="20" fill={fill(0.05)} stroke={fill(0.3)} strokeWidth="3" />
      <line x1="720" y1="215" x2="720" y2="130" stroke={fill(0.3)} strokeWidth="4" />
      <rect x="706" y="118" width="28" height="16" rx="6" fill={fill(0.2)} />
      {/* 音符 */}
      <path d="M830 130 l0 -45 l28 8 l0 45" fill="none" stroke={fill(0.4)} strokeWidth="4" strokeLinecap="round" />
      <circle cx="826" cy="140" r="9" fill={fill(0.35)} />
      <circle cx="854" cy="150" r="9" fill={fill(0.35)} />
    </g>
  );
}

// ==================== 运动：跑道 + 球 + 篮筐 ====================
function SportsScene(fill: (a: number) => string) {
  return (
    <g>
      {/* 跑道 */}
      <path d="M60 340 h840" stroke={fill(0.3)} strokeWidth="4" />
      <path d="M60 360 h840" stroke={fill(0.22)} strokeWidth="4" />
      <path d="M60 340 q-40 10 -40 20 q0 10 40 20" fill="none" stroke={fill(0.3)} strokeWidth="4" />
      <path d="M900 340 q40 10 40 20 q0 10 -40 20" fill="none" stroke={fill(0.3)} strokeWidth="4" />
      {/* 球 */}
      <circle cx="250" cy="290" r="34" fill={fill(0.14)} stroke={fill(0.4)} strokeWidth="3" />
      <path d="M225 272 q35 40 60 0" fill="none" stroke={fill(0.35)} strokeWidth="3" />
      <line x1="250" y1="256" x2="250" y2="324" stroke={fill(0.35)} strokeWidth="3" />
      {/* 篮筐 */}
      <line x1="780" y1="120" x2="780" y2="340" stroke={fill(0.3)} strokeWidth="5" />
      <rect x="780" y="120" width="130" height="16" rx="6" fill={fill(0.15)} stroke={fill(0.35)} strokeWidth="3" />
      <path d="M790 136 l70 40 l12 -22 z" fill={fill(0.08)} stroke={fill(0.35)} strokeWidth="3" />
      <ellipse cx="865" cy="156" rx="40" ry="10" fill="none" stroke={fill(0.35)} strokeWidth="3" />
    </g>
  );
}
