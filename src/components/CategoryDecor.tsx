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
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-80 transition-opacity duration-700">
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
    case 'family': return <FamilyScene fill={fill} />;
    case 'career': return <CareerScene fill={fill} />;
    case 'health': return <HealthScene fill={fill} />;
    case 'friend': return <FriendScene fill={fill} />;
    case 'education': return <EducationScene fill={fill} />;
    case 'personality': return <PersonalityScene fill={fill} />;
    case 'technology': return <TechnologyScene fill={fill} />;
    case 'love': return <LoveScene fill={fill} />;
    case 'finance': return <FinanceScene fill={fill} />;
    case 'hobby': return <HobbyScene fill={fill} />;
    case 'sports': return <SportsScene fill={fill} />;
  }
}

/** hex 色转 rgba 字符串 */
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

type Fill = (a: number) => string;

/** 生成随机 ID，避免多场景 SVG 渐变冲突 */
let _id = 0;
function uid() { return `cg${++_id}`; }

/** 地面（底部平台带 + 边缘高光） */
function Floor({ fill, y = 332, h = 68, edge = 4 }: { fill: Fill; y?: number; h?: number; edge?: number }) {
  return (
    <g>
      <rect x="0" y={y} width="960" height={h} fill={fill(0.08)} />
      <rect x="0" y={y} width="960" height={edge} fill={fill(0.14)} />
    </g>
  );
}

/** 柔色落地影 */
function Shadow({ fill, x, y, rx, ry = 5, opacity = 0.18 }: { fill: Fill; x: number; y: number; rx: number; ry?: number; opacity?: number }) {
  const g = uid();
  return (
    <g>
      <defs>
        <radialGradient id={`${g}-sh`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={fill(opacity)} />
          <stop offset="100%" stopColor={fill(0)} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${g}-sh)`} />
    </g>
  );
}

// ==================== 家庭：暖色客厅 ====================
function FamilyScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} />
      {/* 地毯 */}
      <ellipse cx="300" cy="356" rx="230" ry="26" fill={fill(0.06)} />
      {/* 沙发 */}
      <Shadow fill={fill} x={170} y={318} rx={130} ry={12} />
      <rect x="70" y="300" width="22" height="76" rx="8" fill={fill(0.16)} />
      <rect x="272" y="300" width="22" height="76" rx="8" fill={fill(0.16)} />
      <rect x="60" y="232" width="244" height="76" rx="20" fill={fill(0.13)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="82" y="196" width="200" height="56" rx="16" fill={fill(0.1)} stroke={fill(0.28)} strokeWidth="3" />
      <rect x="92" y="210" width="84" height="40" rx="10" fill={fill(0.17)} />
      <rect x="184" y="210" width="84" height="40" rx="10" fill={fill(0.15)} />
      {/* 抱枕 */}
      <rect x="74" y="270" width="26" height="22" rx="8" fill={fill(0.22)} transform="rotate(-8 87 281)" />
      {/* 茶几 */}
      <rect x="440" y="278" width="120" height="14" rx="6" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="456" y="292" width="10" height="58" rx="4" fill={fill(0.12)} />
      <rect x="534" y="292" width="10" height="58" rx="4" fill={fill(0.12)} />
      {/* 茶杯 */}
      <rect x="480" y="260" width="34" height="20" rx="6" fill={fill(0.22)} stroke={fill(0.4)} strokeWidth="2.5" />
      <path d="M486 248 q6 -8 0 -14" fill="none" stroke={fill(0.3)} strokeWidth="2.5" strokeLinecap="round" />
      {/* 落地灯 */}
      <Shadow fill={fill} x={790} y={332} rx={52} ry={8} />
      <line x1="790" y1="150" x2="790" y2="330" stroke={fill(0.35)} strokeWidth="5" strokeLinecap="round" />
      <path d="M742 158 q48 -30 96 0 q-8 10 -20 8 q-28 -10 -56 0 q-12 2 -20 -8 z" fill={fill(0.18)} stroke={fill(0.35)} strokeWidth="3" />
      <ellipse cx="790" cy="162" rx="26" ry="6" fill={fill(0.3)} />
      <ellipse cx="790" cy="336" rx="34" ry="7" fill={fill(0.14)} />
      {/* 窗户 + 窗帘 + 月亮 */}
      <rect x="700" y="60" width="150" height="130" rx="6" fill={fill(0.07)} stroke={fill(0.3)} strokeWidth="3" />
      <line x1="775" y1="60" x2="775" y2="190" stroke={fill(0.3)} strokeWidth="3" />
      <line x1="700" y1="125" x2="850" y2="125" stroke={fill(0.3)} strokeWidth="3" />
      <circle cx="832" cy="100" r="16" fill={fill(0.22)} />
      <path d="M688 60 q10 12 0 24 l-18 0 q-10 -12 0 -24 z" fill={fill(0.18)} />
      <path d="M862 60 q-10 12 0 24 l18 0 q10 -12 0 -24 z" fill={fill(0.18)} />
      {/* 相框 */}
      <rect x="120" y="80" width="64" height="48" rx="4" fill={fill(0.08)} stroke={fill(0.28)} strokeWidth="3" />
      <rect x="128" y="88" width="48" height="32" rx="2" fill={fill(0.16)} />
      <circle cx="150" cy="100" r="6" fill={fill(0.3)} />
      <rect x="200" y="92" width="52" height="40" rx="4" fill={fill(0.08)} stroke={fill(0.26)} strokeWidth="3" />
      <rect x="207" y="99" width="38" height="26" rx="2" fill={fill(0.14)} />
      {/* 绿植 */}
      <rect x="890" y="288" width="34" height="42" rx="6" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      <path d="M907 288 q-6 -30 6 -44 q10 12 8 34 z" fill={fill(0.2)} />
      <path d="M900 290 q-20 -16 -30 -18 q8 14 22 18 z" fill={fill(0.16)} />
      <path d="M914 290 q18 -14 30 -14 q-8 12 -24 16 z" fill={fill(0.18)} />
    </g>
  );
}

// ==================== 事业：写字楼办公室 ====================
function CareerScene({ fill }: { fill: Fill }) {
  return (
    <g>
      {/* 天花板灯带 */}
      <rect x="0" y="0" width="960" height="14" fill={fill(0.05)} />
      <rect x="420" y="14" width="120" height="6" rx="3" fill={fill(0.2)} />
      <Floor fill={fill} y={330} />
      {/* 落地窗 + 城市剪影 */}
      <rect x="640" y="50" width="320" height="300" rx="6" fill={fill(0.06)} stroke={fill(0.28)} strokeWidth="3" />
      {[700, 790, 880].map((x) => <line key={x} x1={x} y1="50" x2={x} y2="350" stroke={fill(0.25)} strokeWidth="3" />)}
      <line x1="640" y1="200" x2="960" y2="200" stroke={fill(0.25)} strokeWidth="3" />
      <rect x="665" y="90" width="22" height="70" fill={fill(0.14)} />
      <rect x="700" y="120" width="26" height="60" fill={fill(0.12)} />
      <rect x="755" y="80" width="20" height="90" fill={fill(0.15)} />
      <rect x="795" y="110" width="30" height="50" fill={fill(0.11)} />
      <rect x="845" y="95" width="18" height="70" fill={fill(0.14)} />
      <rect x="885" y="130" width="24" height="45" fill={fill(0.12)} />
      {/* 办公桌 */}
      <Shadow fill={fill} x={180} y={322} rx={140} ry={10} />
      <rect x="90" y="252" width="240" height="16" rx="6" fill={fill(0.15)} stroke={fill(0.32)} strokeWidth="3" />
      <rect x="110" y="268" width="12" height="78" rx="4" fill={fill(0.12)} />
      <rect x="298" y="268" width="12" height="78" rx="4" fill={fill(0.12)} />
      {/* 显示器 */}
      <rect x="140" y="196" width="110" height="62" rx="5" fill={fill(0.2)} stroke={fill(0.38)} strokeWidth="3" />
      <rect x="148" y="204" width="94" height="44" rx="3" fill={fill(0.06)} />
      <rect x="156" y="214" width="60" height="6" rx="3" fill={fill(0.3)} />
      <rect x="156" y="228" width="44" height="6" rx="3" fill={fill(0.24)} />
      <rect x="168" y="260" width="54" height="8" rx="3" fill={fill(0.18)} />
      {/* 键盘 / 鼠标 */}
      <rect x="148" y="270" width="80" height="10" rx="4" fill={fill(0.16)} />
      <rect x="240" y="272" width="30" height="14" rx="5" fill={fill(0.14)} />
      {/* 咖啡杯 */}
      <rect x="300" y="228" width="24" height="16" rx="5" fill={fill(0.2)} />
      <path d="M306 216 q4 -6 0 -10" fill="none" stroke={fill(0.28)} strokeWidth="2" strokeLinecap="round" />
      {/* 办公椅 */}
      <rect x="430" y="240" width="70" height="18" rx="8" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="440" y="258" width="10" height="66" rx="4" fill={fill(0.12)} />
      <rect x="480" y="258" width="10" height="66" rx="4" fill={fill(0.12)} />
      <rect x="445" y="200" width="40" height="46" rx="10" fill={fill(0.12)} stroke={fill(0.28)} strokeWidth="3" />
      <line x1="430" y1="258" x2="418" y2="330" stroke={fill(0.2)} strokeWidth="4" strokeLinecap="round" />
      <line x1="500" y1="258" x2="512" y2="330" stroke={fill(0.2)} strokeWidth="4" strokeLinecap="round" />
      {/* 白板 */}
      <rect x="300" y="60" width="220" height="120" rx="6" fill={fill(0.07)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="310" y="70" width="200" height="100" rx="3" fill={fill(0.05)} />
      <rect x="326" y="88" width="60" height="8" rx="3" fill={fill(0.28)} />
      <rect x="326" y="106" width="80" height="8" rx="3" fill={fill(0.24)} />
      <circle cx="430" cy="130" r="20" fill="none" stroke={fill(0.3)} strokeWidth="3" />
      {/* 文件柜 */}
      <rect x="30" y="200" width="54" height="150" rx="4" fill={fill(0.12)} stroke={fill(0.28)} strokeWidth="3" />
      <line x1="30" y1="250" x2="84" y2="250" stroke={fill(0.28)} strokeWidth="3" />
      <line x1="30" y1="300" x2="84" y2="300" stroke={fill(0.28)} strokeWidth="3" />
      <circle cx="76" cy="226" r="2.5" fill={fill(0.4)} />
      <circle cx="76" cy="276" r="2.5" fill={fill(0.4)} />
      {/* 盆栽 */}
      <rect x="560" y="278" width="30" height="46" rx="6" fill={fill(0.12)} stroke={fill(0.28)} strokeWidth="3" />
      <path d="M575 278 q-6 -26 5 -40 q9 12 7 30 z" fill={fill(0.2)} />
      <path d="M568 280 q-16 -14 -26 -16 q8 13 20 16 z" fill={fill(0.15)} />
    </g>
  );
}

// ==================== 健康：病房 + 健康元素 ====================
function HealthScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={330} />
      {/* 医疗十字（墙面挂饰） */}
      <rect x="780" y="60" width="52" height="130" rx="12" fill={fill(0.16)} stroke={fill(0.36)} strokeWidth="3" />
      <rect x="741" y="99" width="130" height="52" rx="12" fill={fill(0.16)} stroke={fill(0.36)} strokeWidth="3" />
      {/* 病床 */}
      <Shadow fill={fill} x={280} y={324} rx={170} ry={12} />
      <rect x="70" y="240" width="230" height="72" rx="14" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="62" y="210" width="26" height="110" rx="8" fill={fill(0.15)} />
      <rect x="282" y="210" width="26" height="110" rx="8" fill={fill(0.13)} />
      {/* 枕头 + 被子 */}
      <rect x="88" y="222" width="72" height="20" rx="9" fill={fill(0.22)} />
      <path d="M120 240 q80 -14 160 6 l0 26 q-80 -14 -160 6 z" fill={fill(0.16)} />
      <path d="M120 252 q80 -12 160 4" fill="none" stroke={fill(0.3)} strokeWidth="2.5" strokeLinecap="round" />
      {/* 输液架 */}
      <line x1="340" y1="120" x2="340" y2="330" stroke={fill(0.32)} strokeWidth="4" strokeLinecap="round" />
      <line x1="312" y1="122" x2="368" y2="122" stroke={fill(0.3)} strokeWidth="4" strokeLinecap="round" />
      <rect x="348" y="130" width="26" height="44" rx="6" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="2.5" />
      <path d="M352 176 q-2 50 4 92" fill="none" stroke={fill(0.3)} strokeWidth="2" />
      {/* 监护仪 */}
      <rect x="660" y="160" width="150" height="96" rx="8" fill={fill(0.1)} stroke={fill(0.32)} strokeWidth="3" />
      <rect x="670" y="170" width="130" height="72" rx="4" fill={fill(0.05)} />
      <path d="M676 206 l10 -14 10 10 12 -18 12 14 14 -22 12 18 12 -12 12 16 14 -20 12 18" fill="none" stroke={fill(0.45)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="690" y="262" width="18" height="10" rx="3" fill={fill(0.24)} />
      <rect x="762" y="262" width="18" height="10" rx="3" fill={fill(0.24)} />
      <line x1="660" y1="256" x2="810" y2="256" stroke={fill(0.28)} strokeWidth="3" />
      <rect x="620" y="280" width="40" height="24" rx="5" fill={fill(0.12)} stroke={fill(0.28)} strokeWidth="2.5" />
      <rect x="600" y="310" width="40" height="24" rx="5" fill={fill(0.1)} stroke={fill(0.26)} strokeWidth="2.5" />
      {/* 药瓶 */}
      <rect x="420" y="250" width="26" height="40" rx="6" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="2.5" />
      <rect x="423" y="242" width="20" height="12" rx="4" fill={fill(0.2)} />
      <rect x="460" y="262" width="22" height="32" rx="5" fill={fill(0.12)} stroke={fill(0.28)} strokeWidth="2.5" />
      <rect x="505" y="270" width="30" height="14" rx="5" fill={fill(0.16)} stroke={fill(0.32)} strokeWidth="2.5" />
      {/* 苹果 + 跑步鞋（健康生活） */}
      <circle cx="850" cy="286" r="22" fill={fill(0.2)} stroke={fill(0.4)} strokeWidth="3" />
      <path d="M850 264 q-4 -12 6 -18" fill="none" stroke={fill(0.35)} strokeWidth="3" strokeLinecap="round" />
      <path d="M856 248 q10 -8 16 -2 q-4 8 -14 8 z" fill={fill(0.28)} />
      <Shadow fill={fill} x={850} y={336} rx={62} ry={8} />
      <path d="M780 330 q34 -40 86 -22 l-6 26 q-30 -8 -52 14 q-20 -12 -44 -8 z" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <line x1="824" y1="314" x2="838" y2="328" stroke={fill(0.28)} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

// ==================== 友谊：咖啡厅小聚 ====================
function FriendScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={330} />
      {/* 吊灯 ×2 */}
      <line x1="400" y1="0" x2="400" y2="70" stroke={fill(0.28)} strokeWidth="3" />
      <path d="M376 70 h48 l-8 22 h-32 z" fill={fill(0.18)} stroke={fill(0.32)} strokeWidth="2.5" />
      <ellipse cx="400" cy="98" rx="16" ry="5" fill={fill(0.3)} />
      <line x1="560" y1="0" x2="560" y2="80" stroke={fill(0.28)} strokeWidth="3" />
      <path d="M536 80 h48 l-8 22 h-32 z" fill={fill(0.16)} stroke={fill(0.3)} strokeWidth="2.5" />
      <ellipse cx="560" cy="108" rx="16" ry="5" fill={fill(0.28)} />
      {/* 圆桌 */}
      <Shadow fill={fill} x={480} y={332} rx={150} ry={12} />
      <rect x="470" y="300" width="20" height="66" rx="6" fill={fill(0.13)} />
      <ellipse cx="480" cy="300" rx="130" ry="30" fill={fill(0.1)} stroke={fill(0.28)} strokeWidth="3" />
      <ellipse cx="480" cy="296" rx="130" ry="26" fill={fill(0.06)} />
      {/* 双椅 */}
      <rect x="300" y="262" width="72" height="20" rx="9" fill={fill(0.13)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="310" y="282" width="10" height="60" rx="4" fill={fill(0.11)} />
      <rect x="352" y="282" width="10" height="60" rx="4" fill={fill(0.11)} />
      <rect x="308" y="218" width="56" height="52" rx="12" fill={fill(0.11)} stroke={fill(0.28)} strokeWidth="3" />
      <rect x="588" y="262" width="72" height="20" rx="9" fill={fill(0.13)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="598" y="282" width="10" height="60" rx="4" fill={fill(0.11)} />
      <rect x="640" y="282" width="10" height="60" rx="4" fill={fill(0.11)} />
      <rect x="596" y="218" width="56" height="52" rx="12" fill={fill(0.11)} stroke={fill(0.28)} strokeWidth="3" />
      {/* 咖啡杯 ×2 + 热气 */}
      <path d="M420 272 h52 v20 a26 26 0 0 1 -52 0 z" fill={fill(0.22)} stroke={fill(0.42)} strokeWidth="2.5" />
      <path d="M474 276 h16 a10 10 0 0 1 0 18 h-12" fill="none" stroke={fill(0.42)} strokeWidth="2.5" />
      <path d="M436 256 q7 -10 0 -20 q7 -10 0 -20" fill="none" stroke={fill(0.3)} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M454 256 q7 -10 0 -20 q7 -10 0 -20" fill="none" stroke={fill(0.3)} strokeWidth="2.5" strokeLinecap="round" />
      {/* 窗 + 街景 */}
      <rect x="40" y="70" width="150" height="150" rx="6" fill={fill(0.07)} stroke={fill(0.3)} strokeWidth="3" />
      <line x1="115" y1="70" x2="115" y2="220" stroke={fill(0.3)} strokeWidth="3" />
      <line x1="40" y1="145" x2="190" y2="145" stroke={fill(0.3)} strokeWidth="3" />
      <circle cx="160" cy="110" r="14" fill={fill(0.2)} />
      <path d="M60 180 q10 -14 20 0 q8 -10 16 0" fill="none" stroke={fill(0.26)} strokeWidth="3" strokeLinecap="round" />
      {/* 挂钟 */}
      <circle cx="840" cy="120" r="34" fill={fill(0.08)} stroke={fill(0.3)} strokeWidth="3" />
      <line x1="840" y1="120" x2="840" y2="100" stroke={fill(0.36)} strokeWidth="3" strokeLinecap="round" />
      <line x1="840" y1="120" x2="856" y2="128" stroke={fill(0.36)} strokeWidth="3" strokeLinecap="round" />
      <circle cx="840" cy="120" r="3" fill={fill(0.4)} />
      {/* 墙上书架 */}
      <rect x="820" y="220" width="90" height="16" rx="4" fill={fill(0.12)} />
      <rect x="825" y="198" width="80" height="12" rx="4" fill={fill(0.1)} />
      <rect x="826" y="174" width="70" height="10" rx="4" fill={fill(0.08)} />
      <rect x="832" y="160" width="10" height="14" rx="2" fill={fill(0.22)} />
      <rect x="846" y="164" width="8" height="10" rx="2" fill={fill(0.16)} />
    </g>
  );
}

// ==================== 教育：教室 ====================
function EducationScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={340} />
      {/* 黑板 */}
      <rect x="120" y="70" width="300" height="190" rx="8" fill={fill(0.08)} stroke={fill(0.35)} strokeWidth="4" />
      <rect x="132" y="82" width="276" height="160" rx="4" fill={fill(0.05)} />
      {/* 板书 */}
      <line x1="160" y1="120" x2="280" y2="120" stroke={fill(0.4)} strokeWidth="4" strokeLinecap="round" />
      <line x1="160" y1="150" x2="240" y2="150" stroke={fill(0.4)} strokeWidth="4" strokeLinecap="round" />
      <circle cx="330" cy="135" r="22" fill="none" stroke={fill(0.4)} strokeWidth="4" />
      <path d="M330 113 l12 44" stroke={fill(0.35)} strokeWidth="3" />
      <rect x="300" y="150" width="60" height="8" rx="3" fill={fill(0.3)} />
      <rect x="160" y="180" width="90" height="8" rx="3" fill={fill(0.28)} />
      {/* 粉笔槽 */}
      <rect x="120" y="256" width="300" height="8" rx="4" fill={fill(0.2)} />
      {/* 讲台 */}
      <rect x="190" y="264" width="160" height="14" rx="5" fill={fill(0.15)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="205" y="278" width="12" height="80" rx="4" fill={fill(0.12)} />
      <rect x="323" y="278" width="12" height="80" rx="4" fill={fill(0.12)} />
      {/* 课桌椅 */}
      <rect x="560" y="250" width="120" height="14" rx="5" fill={fill(0.13)} stroke={fill(0.28)} strokeWidth="3" />
      <rect x="575" y="264" width="10" height="70" rx="4" fill={fill(0.11)} />
      <rect x="655" y="264" width="10" height="70" rx="4" fill={fill(0.11)} />
      <rect x="600" y="212" width="44" height="44" rx="9" fill={fill(0.11)} stroke={fill(0.26)} strokeWidth="3" />
      <rect x="608" y="224" width="28" height="24" rx="4" fill={fill(0.06)} />
      {/* 书包 */}
      <rect x="700" y="330" width="56" height="44" rx="12" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      <path d="M716 330 q0 -14 12 -14 q12 0 12 14" fill="none" stroke={fill(0.3)} strokeWidth="3" />
      <rect x="712" y="340" width="32" height="8" rx="3" fill={fill(0.2)} />
      {/* 书架 */}
      <rect x="40" y="120" width="70" height="220" rx="4" fill={fill(0.1)} stroke={fill(0.26)} strokeWidth="3" />
      <line x1="40" y1="180" x2="110" y2="180" stroke={fill(0.26)} strokeWidth="3" />
      <line x1="40" y1="240" x2="110" y2="240" stroke={fill(0.26)} strokeWidth="3" />
      <line x1="40" y1="300" x2="110" y2="300" stroke={fill(0.26)} strokeWidth="3" />
      <rect x="50" y="132" width="16" height="44" rx="2" fill={fill(0.22)} />
      <rect x="70" y="140" width="14" height="36" rx="2" fill={fill(0.18)} />
      <rect x="88" y="150" width="12" height="26" rx="2" fill={fill(0.24)} />
      <rect x="50" y="192" width="18" height="44" rx="2" fill={fill(0.16)} />
      <rect x="72" y="200" width="12" height="36" rx="2" fill={fill(0.2)} />
      <rect x="50" y="252" width="14" height="44" rx="2" fill={fill(0.2)} />
      <rect x="70" y="260" width="16" height="36" rx="2" fill={fill(0.16)} />
      {/* 地球仪 */}
      <rect x="820" y="270" width="14" height="60" rx="4" fill={fill(0.16)} />
      <ellipse cx="827" cy="334" rx="14" ry="5" fill={fill(0.12)} />
      <circle cx="827" cy="232" r="36" fill={fill(0.1)} stroke={fill(0.32)} strokeWidth="3" />
      <path d="M797 242 q30 -20 60 0" fill="none" stroke={fill(0.28)} strokeWidth="2.5" />
      <path d="M797 242 q30 24 60 0" fill="none" stroke={fill(0.28)} strokeWidth="2.5" />
      <ellipse cx="827" cy="232" rx="10" ry="36" fill="none" stroke={fill(0.28)} strokeWidth="2.5" />
      {/* 文具筒 */}
      <rect x="500" y="298" width="34" height="38" rx="5" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="2.5" />
      <line x1="508" y1="298" x2="504" y2="280" stroke={fill(0.3)} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="517" y1="298" x2="517" y2="276" stroke={fill(0.26)} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="526" y1="298" x2="530" y2="282" stroke={fill(0.32)} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

// ==================== 个性：内心世界 ====================
function PersonalityScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={340} />
      {/* 大对话气泡 */}
      <Shadow fill={fill} x={300} y={262} rx={170} ry={14} />
      <ellipse cx="300" cy="150" rx="150" ry="92" fill={fill(0.1)} stroke={fill(0.35)} strokeWidth="3" />
      <path d="M240 226 l-28 46 q50 -8 68 -38 z" fill={fill(0.1)} stroke={fill(0.35)} strokeWidth="3" />
      {/* 气泡内符号 */}
      <circle cx="255" cy="140" r="11" fill={fill(0.35)} />
      <circle cx="310" cy="140" r="11" fill={fill(0.35)} />
      <path d="M268 178 q32 24 64 0" fill="none" stroke={fill(0.35)} strokeWidth="4" strokeLinecap="round" />
      <path d="M335 110 l8 20 22 3 -16 15 4 22 -18 -10 -18 10 4 -22 -16 -15 22 -3 z" fill={fill(0.3)} />
      {/* 头顶思绪云 */}
      <ellipse cx="620" cy="70" rx="70" ry="34" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <circle cx="660" cy="44" r="22" fill={fill(0.1)} stroke={fill(0.28)} strokeWidth="3" />
      <circle cx="580" cy="48" r="16" fill={fill(0.08)} stroke={fill(0.26)} strokeWidth="3" />
      <circle cx="620" cy="96" r="6" fill={fill(0.3)} />
      <circle cx="646" cy="88" r="6" fill={fill(0.28)} />
      <circle cx="594" cy="86" r="6" fill={fill(0.28)} />
      {/* 发散星（左上） */}
      <path d="M120 90 l12 28 30 4 -22 20 6 30 -26 -15 -26 15 6 -30 -22 -20 30 -4 z" fill={fill(0.24)} />
      <path d="M170 220 l7 16 18 3 -13 11 3 14 -15 -8 -15 8 3 -14 -13 -11 18 -3 z" fill={fill(0.18)} />
      {/* 落地镜（自我观照） */}
      <Shadow fill={fill} x={820} y={336} rx={80} ry={10} />
      <rect x="750" y="110" width="140" height="220" rx="12" fill={fill(0.07)} stroke={fill(0.32)} strokeWidth="4" />
      <rect x="758" y="118" width="124" height="204" rx="8" fill={fill(0.05)} />
      {/* 镜中倒影 */}
      <circle cx="820" cy="190" r="22" fill={fill(0.18)} />
      <rect x="800" y="212" width="40" height="56" rx="14" fill={fill(0.14)} />
      <rect x="804" y="268" width="13" height="40" rx="6" fill={fill(0.12)} />
      <rect x="823" y="268" width="13" height="40" rx="6" fill={fill(0.12)} />
      <line x1="820" y1="212" x2="820" y2="280" stroke={fill(0.3)} strokeWidth="2" strokeDasharray="6 6" />
      {/* 脚印路径 */}
      <ellipse cx="480" cy="366" rx="13" ry="6" fill={fill(0.22)} transform="rotate(-15 480 366)" />
      <ellipse cx="520" cy="352" rx="13" ry="6" fill={fill(0.2)} transform="rotate(-5 520 352)" />
      <ellipse cx="558" cy="340" rx="13" ry="6" fill={fill(0.18)} transform="rotate(8 558 340)" />
      <ellipse cx="596" cy="332" rx="13" ry="6" fill={fill(0.16)} transform="rotate(18 596 332)" />
    </g>
  );
}

// ==================== 科技：工作台 ====================
function TechnologyScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={340} />
      {/* 大屏幕 */}
      <Shadow fill={fill} x={480} y={332} rx={230} ry={12} />
      <rect x="300" y="70" width="360" height="200" rx="14" fill={fill(0.08)} stroke={fill(0.35)} strokeWidth="4" />
      <rect x="314" y="84" width="332" height="168" rx="8" fill={fill(0.05)} />
      {/* 代码行 */}
      <rect x="334" y="106" width="150" height="10" rx="4" fill={fill(0.3)} />
      <rect x="334" y="128" width="110" height="10" rx="4" fill={fill(0.24)} />
      <rect x="356" y="150" width="120" height="10" rx="4" fill={fill(0.26)} />
      <rect x="356" y="172" width="90" height="10" rx="4" fill={fill(0.22)} />
      <rect x="334" y="194" width="170" height="10" rx="4" fill={fill(0.28)} />
      <rect x="334" y="216" width="60" height="10" rx="4" fill={fill(0.2)} />
      {/* 窗口 */}
      <rect x="560" y="96" width="64" height="46" rx="4" fill={fill(0.18)} />
      <rect x="566" y="104" width="30" height="18" rx="3" fill={fill(0.3)} />
      <rect x="566" y="128" width="44" height="6" rx="3" fill={fill(0.24)} />
      <rect x="586" y="240" width="50" height="10" rx="4" fill={fill(0.22)} />
      {/* 底座 + 键盘 */}
      <rect x="380" y="270" width="200" height="12" rx="5" fill={fill(0.16)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="330" y="282" width="300" height="10" rx="4" fill={fill(0.14)} />
      {/* 笔记本 */}
      <rect x="620" y="280" width="120" height="10" rx="4" fill={fill(0.16)} stroke={fill(0.3)} strokeWidth="2.5" />
      <path d="M624 282 l50 -38 l50 38 z" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="2.5" />
      <path d="M636 276 l38 -30 l38 30 z" fill={fill(0.24)} />
      {/* 手机 */}
      <rect x="150" y="230" width="34" height="60" rx="8" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="2.5" />
      <rect x="155" y="238" width="24" height="40" rx="4" fill={fill(0.24)} />
      {/* 悬浮小窗 */}
      <rect x="760" y="80" width="90" height="60" rx="8" fill={fill(0.1)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="770" y="92" width="40" height="14" rx="3" fill={fill(0.26)} />
      <rect x="770" y="114" width="60" height="8" rx="3" fill={fill(0.2)} />
      <rect x="120" y="60" width="80" height="54" rx="8" fill={fill(0.08)} stroke={fill(0.28)} strokeWidth="3" />
      <rect x="130" y="72" width="50" height="10" rx="3" fill={fill(0.24)} />
      <rect x="130" y="90" width="30" height="8" rx="3" fill={fill(0.18)} />
      {/* 电路走线 */}
      <path d="M60 366 h90 l26 -34 h70 l30 34 h110" fill="none" stroke={fill(0.32)} strokeWidth="4" />
      <circle cx="60" cy="366" r="9" fill={fill(0.3)} />
      <circle cx="386" cy="366" r="9" fill={fill(0.3)} />
      <rect x="210" y="350" width="30" height="30" rx="5" fill={fill(0.14)} stroke={fill(0.32)} strokeWidth="2.5" transform="rotate(45 225 365)" />
      <path d="M520 366 h90 l24 -30 h60" fill="none" stroke={fill(0.28)} strokeWidth="4" />
      <circle cx="694" cy="336" r="8" fill={fill(0.26)} />
      <path d="M730 366 h60 l20 -20 h50" fill="none" stroke={fill(0.26)} strokeWidth="4" />
      <circle cx="860" cy="346" r="7" fill={fill(0.24)} />
      {/* 齿轮 */}
      <circle cx="880" cy="100" r="22" fill={fill(0.1)} stroke={fill(0.32)} strokeWidth="3" />
      <circle cx="880" cy="100" r="9" fill={fill(0.05)} stroke={fill(0.32)} strokeWidth="2.5" />
      <path d="M880 66 v14 M880 120 v14 M846 100 h14 M900 100 h14 M856 76 l10 10 M904 124 l-10 -10 M904 76 l-10 10 M856 124 l10 -10" stroke={fill(0.32)} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

// ==================== 爱情：月夜约会 ====================
function LoveScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={340} />
      {/* 月牙 */}
      <circle cx="860" cy="70" r="26" fill={fill(0.18)} />
      <circle cx="872" cy="62" r="22" fill={fill(0)} />
      {/* 拱门花架 */}
      <path d="M150 340 q-40 -160 120 -180 q160 -20 200 180 z" fill="none" stroke={fill(0.32)} strokeWidth="5" strokeLinecap="round" />
      <path d="M190 340 q-30 -130 80 -150 q130 -18 160 150" fill="none" stroke={fill(0.22)} strokeWidth="3" strokeLinecap="round" />
      {/* 灯串 */}
      <path d="M170 210 q60 -40 120 0 q60 40 120 0" fill="none" stroke={fill(0.28)} strokeWidth="2" />
      <circle cx="190" cy="196" r="6" fill={fill(0.4)} className="animate-twinkle" />
      <circle cx="230" cy="182" r="6" fill={fill(0.32)} className="animate-twinkle" />
      <circle cx="270" cy="176" r="6" fill={fill(0.4)} className="animate-twinkle" />
      <circle cx="310" cy="180" r="6" fill={fill(0.32)} className="animate-twinkle" />
      <circle cx="350" cy="192" r="6" fill={fill(0.4)} className="animate-twinkle" />
      <circle cx="390" cy="210" r="6" fill={fill(0.32)} className="animate-twinkle" />
      {/* 长椅（右侧） */}
      <Shadow fill={fill} x={760} y={332} rx={90} ry={10} />
      <rect x="690" y="296" width="140" height="10" rx="4" fill={fill(0.16)} stroke={fill(0.32)} strokeWidth="2.5" />
      <rect x="700" y="306" width="9" height="26" rx="4" fill={fill(0.12)} />
      <rect x="812" y="306" width="9" height="26" rx="4" fill={fill(0.12)} />
      <rect x="698" y="282" width="124" height="16" rx="6" fill={fill(0.13)} stroke={fill(0.3)} strokeWidth="2.5" />
      {/* 大爱心（中心） */}
      <path d="M500 150 c-34 -52 -124 -22 -108 46 c14 58 108 110 108 110 c0 0 94 -52 108 -110 c16 -68 -74 -98 -108 -46 z" fill={fill(0.15)} stroke={fill(0.4)} strokeWidth="3" />
      <path d="M452 178 q-26 -8 -34 10 q-6 14 12 20 q26 -2 22 -30 z" fill={fill(0.3)} />
      {/* 路灯（左） */}
      <line x1="70" y1="120" x2="70" y2="340" stroke={fill(0.32)} strokeWidth="5" strokeLinecap="round" />
      <path d="M32 128 q38 -26 76 0" fill="none" stroke={fill(0.32)} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="70" cy="132" rx="40" ry="10" fill={fill(0.2)} />
      <ellipse cx="70" cy="342" rx="26" ry="6" fill={fill(0.18)} />
      {/* 飘落花瓣 */}
      <ellipse cx="240" cy="90" rx="9" ry="5" fill={fill(0.32)} transform="rotate(-20 240 90)" />
      <ellipse cx="640" cy="70" rx="9" ry="5" fill={fill(0.28)} transform="rotate(15 640 70)" />
      <ellipse cx="420" cy="60" rx="7" ry="4" fill={fill(0.24)} transform="rotate(40 420 60)" />
      <ellipse cx="330" cy="300" rx="8" ry="4.5" fill={fill(0.3)} transform="rotate(-10 330 300)" />
      <ellipse cx="560" cy="320" rx="8" ry="4.5" fill={fill(0.26)} transform="rotate(25 560 320)" />
    </g>
  );
}

// ==================== 金融：金库与投资 ====================
function FinanceScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={340} />
      {/* 银行立柱 */}
      <rect x="40" y="60" width="56" height="280" rx="6" fill={fill(0.1)} stroke={fill(0.28)} strokeWidth="3" />
      <rect x="32" y="48" width="72" height="20" rx="6" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="32" y="316" width="72" height="20" rx="6" fill={fill(0.14)} stroke={fill(0.3)} strokeWidth="3" />
      {/* 金库门 */}
      <Shadow fill={fill} x={800} y={332} rx={110} ry={12} />
      <rect x="720" y="120" width="160" height="220" rx="12" fill={fill(0.1)} stroke={fill(0.34)} strokeWidth="4" />
      <rect x="738" y="138" width="124" height="184" rx="8" fill={fill(0.05)} />
      <circle cx="800" cy="230" r="40" fill="none" stroke={fill(0.32)} strokeWidth="6" />
      <line x1="800" y1="230" x2="800" y2="198" stroke={fill(0.36)} strokeWidth="5" strokeLinecap="round" />
      <line x1="800" y1="230" x2="826" y2="250" stroke={fill(0.32)} strokeWidth="4" strokeLinecap="round" />
      <circle cx="800" cy="230" r="8" fill={fill(0.4)} />
      {[[748, 150], [868, 150], [748, 310], [868, 310]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill={fill(0.28)} />
      ))}
      {/* 金币堆 */}
      <Shadow fill={fill} x={250} y={338} rx={90} ry={10} />
      {[0, 1, 2].map(i => (
        <ellipse key={i} cx={250 + i * 10} cy={330 - i * 16} rx={62} ry={15} fill={fill(0.13 + i * 0.05)} stroke={fill(0.34)} strokeWidth="3" />
      ))}
      <ellipse cx="250" cy="318" rx="50" ry="12" fill={fill(0.22)} stroke={fill(0.4)} strokeWidth="2.5" />
      <ellipse cx="250" cy="302" rx="38" ry="9" fill={fill(0.26)} stroke={fill(0.42)} strokeWidth="2.5" />
      {/* 上升折线 */}
      <path d="M560 330 L610 290 L650 310 L710 240 L750 262" fill="none" stroke={fill(0.45)} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="710" cy="240" r="8" fill={fill(0.5)} />
      <path d="M742 232 l8 26 l-20 -4 z" fill={fill(0.5)} />
      {/* 计算器 */}
      <rect x="420" y="250" width="60" height="80" rx="8" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="428" y="258" width="44" height="16" rx="4" fill={fill(0.24)} />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <rect key={i} x={430 + (i % 3) * 15} y={282 + Math.floor(i / 3) * 14} width="11" height="9" rx="2" fill={fill(0.18)} />
      ))}
      {/* 账本 */}
      <rect x="470" y="300" width="70" height="52" rx="6" fill={fill(0.1)} stroke={fill(0.28)} strokeWidth="2.5" transform="rotate(4 505 326)" />
      <line x1="482" y1="312" x2="528" y2="312" stroke={fill(0.28)} strokeWidth="2.5" transform="rotate(4 505 326)" />
      <line x1="482" y1="324" x2="518" y2="324" stroke={fill(0.28)} strokeWidth="2.5" transform="rotate(4 505 326)" />
    </g>
  );
}

// ==================== 爱好：创作房间 ====================
function HobbyScene({ fill }: { fill: Fill }) {
  return (
    <g>
      <Floor fill={fill} y={340} />
      {/* 画架 + 画布 */}
      <Shadow fill={fill} x={200} y={332} rx={110} ry={10} />
      <line x1="160" y1="330" x2="145" y2="180" stroke={fill(0.34)} strokeWidth="5" strokeLinecap="round" />
      <line x1="250" y1="330" x2="265" y2="180" stroke={fill(0.34)} strokeWidth="5" strokeLinecap="round" />
      <line x1="140" y1="190" x2="270" y2="190" stroke={fill(0.3)} strokeWidth="4" strokeLinecap="round" />
      <rect x="148" y="120" width="114" height="78" rx="4" fill={fill(0.08)} stroke={fill(0.32)} strokeWidth="3" />
      {/* 画布风景 */}
      <rect x="156" y="128" width="98" height="62" rx="2" fill={fill(0.05)} />
      <path d="M156 170 q25 -20 50 0 q25 18 48 -4 l0 24 l-98 0 z" fill={fill(0.22)} />
      <circle cx="228" cy="140" r="10" fill={fill(0.32)} />
      {/* 调色板 */}
      <ellipse cx="330" cy="322" rx="46" ry="26" fill={fill(0.14)} stroke={fill(0.32)} strokeWidth="3" />
      <circle cx="310" cy="314" r="6" fill={fill(0.3)} />
      <circle cx="336" cy="308" r="6" fill={fill(0.22)} />
      <circle cx="352" cy="324" r="6" fill={fill(0.26)} />
      <circle cx="322" cy="334" r="6" fill={fill(0.2)} />
      <circle cx="320" cy="326" r="10" fill={fill(0.04)} />
      {/* 画笔 */}
      <line x1="350" y1="330" x2="430" y2="190" stroke={fill(0.36)} strokeWidth="5" strokeLinecap="round" />
      <path d="M430 190 l-20 -7 l7 22 z" fill={fill(0.4)} />
      {/* 吉他 + 音箱 */}
      <Shadow fill={fill} x={620} y={334} rx={90} ry={10} />
      <ellipse cx="600" cy="290" rx="46" ry="68" fill={fill(0.12)} stroke={fill(0.32)} strokeWidth="3" transform="rotate(-10 600 290)" />
      <circle cx="600" cy="268" r="17" fill={fill(0.06)} stroke={fill(0.32)} strokeWidth="3" />
      <line x1="600" y1="222" x2="600" y2="150" stroke={fill(0.32)} strokeWidth="4" />
      <rect x="588" y="138" width="24" height="14" rx="6" fill={fill(0.2)} />
      <line x1="588" y1="145" x2="612" y2="145" stroke={fill(0.34)} strokeWidth="2" />
      <line x1="590" y1="150" x2="610" y2="150" stroke={fill(0.34)} strokeWidth="2" />
      {/* 音箱 */}
      <rect x="680" y="260" width="54" height="76" rx="6" fill={fill(0.1)} stroke={fill(0.28)} strokeWidth="3" />
      <circle cx="707" cy="290" r="20" fill={fill(0.06)} stroke={fill(0.3)} strokeWidth="3" />
      <circle cx="707" cy="290" r="8" fill={fill(0.18)} />
      {/* 音符 */}
      <path d="M740 150 l0 -40 l24 6 l0 38" fill="none" stroke={fill(0.4)} strokeWidth="4" strokeLinecap="round" />
      <circle cx="736" cy="156" r="8" fill={fill(0.36)} />
      <circle cx="760" cy="162" r="8" fill={fill(0.36)} />
      <path d="M820 130 l0 -30 l18 4 l0 28" fill="none" stroke={fill(0.34)} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="817" cy="135" r="6.5" fill={fill(0.3)} />
      {/* 相机 */}
      <Shadow fill={fill} x={850} y={334} rx={46} ry={8} />
      <rect x="806" y="300" width="90" height="34" rx="8" fill={fill(0.12)} stroke={fill(0.3)} strokeWidth="3" />
      <rect x="830" y="290" width="34" height="16" rx="4" fill={fill(0.16)} stroke={fill(0.3)} strokeWidth="2.5" />
      <circle cx="851" cy="317" r="12" fill={fill(0.06)} stroke={fill(0.32)} strokeWidth="3" />
      <circle cx="851" cy="317" r="5" fill={fill(0.2)} />
      {/* 画筒 */}
      <rect x="480" y="296" width="16" height="42" rx="5" fill={fill(0.16)} />
      <rect x="500" y="302" width="16" height="38" rx="5" fill={fill(0.12)} />
      <rect x="520" y="298" width="16" height="42" rx="5" fill={fill(0.14)} />
    </g>
  );
}

// ==================== 运动：体育场 ====================
function SportsScene({ fill }: { fill: Fill }) {
  return (
    <g>
      {/* 跑道 */}
      <path d="M60 350 h840" stroke={fill(0.3)} strokeWidth="4" />
      <path d="M60 370 h840" stroke={fill(0.22)} strokeWidth="4" />
      <path d="M60 350 q-40 10 -40 20 q0 10 40 20" fill="none" stroke={fill(0.3)} strokeWidth="4" />
      <path d="M900 350 q40 10 40 20 q0 10 -40 20" fill="none" stroke={fill(0.3)} strokeWidth="4" />
      {/* 记分牌 */}
      <rect x="380" y="50" width="200" height="80" rx="8" fill={fill(0.08)} stroke={fill(0.32)} strokeWidth="3" />
      <rect x="400" y="68" width="52" height="40" rx="4" fill={fill(0.14)} />
      <rect x="508" y="68" width="52" height="40" rx="4" fill={fill(0.14)} />
      <rect x="408" y="78" width="16" height="8" rx="2" fill={fill(0.32)} />
      <rect x="428" y="78" width="16" height="8" rx="2" fill={fill(0.28)} />
      <rect x="448" y="92" width="16" height="8" rx="2" fill={fill(0.24)} />
      <rect x="516" y="92" width="16" height="8" rx="2" fill={fill(0.32)} />
      <rect x="536" y="78" width="16" height="8" rx="2" fill={fill(0.28)} />
      <line x1="480" y1="60" x2="480" y2="130" stroke={fill(0.28)} strokeWidth="3" />
      {/* 篮球架 */}
      <line x1="830" y1="80" x2="830" y2="350" stroke={fill(0.32)} strokeWidth="5" />
      <rect x="830" y="80" width="120" height="14" rx="6" fill={fill(0.16)} stroke={fill(0.34)} strokeWidth="3" />
      <path d="M842 94 l64 36 l12 -20 z" fill={fill(0.08)} stroke={fill(0.34)} strokeWidth="3" />
      <ellipse cx="918" cy="110" rx="36" ry="9" fill="none" stroke={fill(0.34)} strokeWidth="3" />
      {/* 足球 */}
      <Shadow fill={fill} x={260} y={332} rx={52} ry={8} />
      <circle cx="260" cy="300" r="30" fill={fill(0.12)} stroke={fill(0.36)} strokeWidth="3" />
      <path d="M260 270 l14 10 l-5 17 l-18 0 l-5 -17 z" fill="none" stroke={fill(0.3)} strokeWidth="2.5" />
      <path d="M260 270 l-12 16 l18 0" fill="none" stroke={fill(0.28)} strokeWidth="2.5" />
      <path d="M260 300 l-16 10 l6 14" fill="none" stroke={fill(0.28)} strokeWidth="2.5" />
      <path d="M260 300 l16 10 l-6 14" fill="none" stroke={fill(0.28)} strokeWidth="2.5" />
      {/* 杠铃 */}
      <line x1="380" y1="330" x2="520" y2="330" stroke={fill(0.34)} strokeWidth="6" strokeLinecap="round" />
      <rect x="368" y="318" width="18" height="24" rx="4" fill={fill(0.22)} />
      <rect x="514" y="318" width="18" height="24" rx="4" fill={fill(0.22)} />
      <rect x="392" y="322" width="14" height="16" rx="3" fill={fill(0.16)} />
      <rect x="494" y="322" width="14" height="16" rx="3" fill={fill(0.16)} />
      {/* 奖杯 */}
      <Shadow fill={fill} x={680} y={334} rx={40} ry={7} />
      <path d="M650 330 l6 -56 q24 -18 48 0 l6 56 z" fill={fill(0.12)} stroke={fill(0.32)} strokeWidth="3" />
      <rect x="654" y="330" width="52" height="8" rx="3" fill={fill(0.18)} />
      <rect x="668" y="338" width="24" height="16" rx="4" fill={fill(0.14)} />
      <path d="M660 292 q-14 -16 4 -24 q-2 14 12 14" fill="none" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
      <path d="M700 292 q14 -16 -4 -24 q2 14 -12 14" fill="none" stroke={fill(0.3)} strokeWidth="3" strokeLinecap="round" />
      {/* 加油彩带 */}
      <path d="M140 60 q20 -16 40 0 q20 16 40 0" fill="none" stroke={fill(0.3)} strokeWidth="3" />
      <path d="M160 80 q16 -12 32 0 q16 12 32 0" fill="none" stroke={fill(0.24)} strokeWidth="3" />
      <path d="M780 180 q16 -12 32 0 q16 12 32 0" fill="none" stroke={fill(0.26)} strokeWidth="3" />
    </g>
  );
}
