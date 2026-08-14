import type { LifeStage } from '../types';
import { useMemo } from 'react';

interface Props {
  stage: LifeStage;
}

/** 生成随机 ID，避免多场景 SVG 渐变冲突 */
let _id = 0;
function uid() { return `g${++_id}`; }

export default function SceneDecor({ stage }: Props) {
  const svg = useMemo(() => renderScene(stage), [stage]);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg viewBox="0 0 960 400" preserveAspectRatio="xMidYMax slice"
        className="w-full h-full">
        {svg}
      </svg>
    </div>
  );
}

function renderScene(stage: LifeStage) {
  switch (stage) {
    case 'infant': return InfantScene();
    case 'childhood': return ChildhoodScene();
    case 'teen': return TeenScene();
    case 'young_adult': return YoungAdultScene();
    case 'adult': return AdultScene();
    case 'middle_age': return MiddleAgeScene();
    case 'elder': return ElderScene();
  }
}

// ==================== 婴儿期：温暖育婴室 ====================
function InfantScene() {
  const g = uid();
  return (
    <g>
      {/* 柔光背景 */}
      <defs>
        <radialGradient id={`${g}-glow`}>
          <stop offset="0%" stopColor="rgba(255,240,210,0.35)" />
          <stop offset="100%" stopColor="rgba(200,160,100,0)" />
        </radialGradient>
        <linearGradient id={`${g}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5e6d0" />
          <stop offset="100%" stopColor="#e8d5b8" />
        </linearGradient>
      </defs>

      {/* 墙面 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-wall)`} />

      {/* 柔光 */}
      <circle cx="480" cy="200" r="300" fill={`url(#${g}-glow)`} />

      {/* 窗户 */}
      <rect x="350" y="20" width="260" height="160" rx="8" fill="#fff8e8" stroke="#d4b896" strokeWidth="4" />
      <line x1="480" y1="20" x2="480" y2="180" stroke="#d4b896" strokeWidth="3" />
      <line x1="350" y1="100" x2="610" y2="100" stroke="#d4b896" strokeWidth="3" />
      {/* 窗外树枝 */}
      <path d="M620,120 Q580,80 550,100" stroke="#8a9a6a" strokeWidth="3" fill="none" />
      <path d="M620,120 Q590,100 570,130" stroke="#8a9a6a" strokeWidth="2" fill="none" />

      {/* 地毯 + 婴儿床阴影 */}
      <ellipse cx="480" cy="352" rx="280" ry="36" fill="rgba(255,245,225,0.14)" />
      <Shadow x={480} y={350} rx={125} ry={12} opacity={0.13} />

      {/* 婴儿床 */}
      <rect x="380" y="260" width="200" height="90" rx="6" fill="#f0dcc0" stroke="#c4a882" strokeWidth="3" />
      <rect x="390" y="270" width="180" height="70" rx="4" fill="#fff8f0" />
      {/* 床栏 */}
      {[390, 430, 470, 510, 550].map((x, i) => (
        <rect key={i} x={x} y="255" width="4" height="15" rx="2" fill="#c4a882" />
      ))}

      {/* 挂饰——旋转星星 */}
      <g className="animate-infant-mobile">
        <line x1="480" y1="180" x2="480" y2="240" stroke="#d4b896" strokeWidth="1.5" />
        <animateTransform attributeName="transform" type="rotate" from="0 480 180" to="360 480 180"
          dur="12s" repeatCount="indefinite" />
        <circle cx="450" cy="235" r="8" fill="rgba(255,200,100,0.5)" className="animate-twinkle" />
        <circle cx="510" cy="235" r="8" fill="rgba(255,200,100,0.5)" className="animate-twinkle" />
        <circle cx="480" cy="220" r="7" fill="rgba(255,200,150,0.6)" className="animate-twinkle" />
        <circle cx="465" cy="248" r="6" fill="rgba(255,180,120,0.4)" className="animate-twinkle" />
        <circle cx="495" cy="248" r="6" fill="rgba(255,180,120,0.4)" className="animate-twinkle" />
      </g>

      {/* 飘浮云朵 */}
      <Cloud x={120} y={60} scale={1} speed={18} opacity={0.35} />
      <Cloud x={680} y={40} scale={0.7} speed={22} opacity={0.25} />
      <Cloud x={50} y={120} scale={0.5} speed={25} opacity={0.2} />

      {/* 地上玩具 */}
      <circle cx="300" cy="355" r="12" fill="rgba(255,180,150,0.5)" />
      <circle cx="650" cy="360" r="10" fill="rgba(180,200,255,0.5)" />
      <rect x="280" y="348" width="40" height="6" rx="3" fill="rgba(200,180,160,0.6)" />
    </g>
  );
}

// ==================== 童年：明亮游乐场 ====================
function ChildhoodScene() {
  const g = uid();
  return (
    <g>
      <defs>
        <linearGradient id={`${g}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a90d9" />
          <stop offset="60%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#b8e6b8" />
        </linearGradient>
        <radialGradient id={`${g}-sun`}>
          <stop offset="0%" stopColor="rgba(255,255,200,0.9)" />
          <stop offset="60%" stopColor="rgba(255,240,180,0.3)" />
          <stop offset="100%" stopColor="rgba(255,220,150,0)" />
        </radialGradient>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-sky)`} />

      {/* 太阳 */}
      <circle cx="780" cy="70" r="60" fill={`url(#${g}-sun)`} />
      <circle cx="780" cy="70" r="28" fill="rgba(255,255,220,0.9)" />

      {/* 云 */}
      <Cloud x={100} y={40} scale={1.2} speed={20} opacity={0.6} />
      <Cloud x={350} y={70} scale={0.8} speed={16} opacity={0.5} />
      <Cloud x={600} y={30} scale={1} speed={22} opacity={0.55} />

      {/* 远山 */}
      <path d="M0,300 Q100,200 200,260 Q300,190 400,250 Q500,210 600,240 Q700,180 800,230 Q880,200 960,250 L960,400 L0,400Z"
        fill="#6aaa50" opacity="0.5" />
      <path d="M0,320 Q200,260 400,300 Q600,270 800,290 Q900,280 960,300 L960,400 L0,400Z"
        fill="#5a9a40" opacity="0.6" />

      {/* 树 */}
      <Tree x={80} y={210} size={1} />
      <Tree x={720} y={220} size={0.9} />
      <Tree x={820} y={230} size={0.7} />

      {/* 地面 */}
      <rect x="0" y="300" width="960" height="100" fill="#7CB342" />
      <rect x="0" y="300" width="960" height="8" fill="#8BC34A" />

      {/* 落地影（树/滑梯/秋千） */}
      <Shadow x={95} y={304} rx={42} ry={6} opacity={0.14} />
      <Shadow x={742} y={312} rx={40} ry={6} opacity={0.13} />
      <Shadow x={838} y={318} rx={34} ry={5} opacity={0.12} />
      <Shadow x={330} y={304} rx={46} ry={6} opacity={0.14} />
      <Shadow x={585} y={324} rx={46} ry={6} opacity={0.14} />

      {/* 滑梯 */}
      <g transform="translate(300, 230)">
        <rect x="0" y="20" width="6" height="60" fill="#e8a040" rx="2" />
        <line x1="3" y1="20" x2="55" y2="80" stroke="#e8a040" strokeWidth="5" strokeLinecap="round" />
        <rect x="50" y="70" width="40" height="8" fill="#f0b050" rx="4" />
      </g>

      {/* 秋千 */}
      <g transform="translate(550, 240)">
        <rect x="20" y="0" width="5" height="70" fill="#8B4513" />
        <rect x="55" y="0" width="5" height="70" fill="#8B4513" />
        <rect x="15" y="0" width="50" height="5" fill="#8B4513" rx="2" />
        <line x1="20" y1="65" x2="20" y2="80" stroke="#666" strokeWidth="1.5" />
        <line x1="60" y1="65" x2="60" y2="80" stroke="#666" strokeWidth="1.5" />
        <rect x="10" y="78" width="60" height="5" fill="#a0522d" rx="2" />
      </g>

      {/* 飞舞蝴蝶 */}
      <Butterfly x={200} y={150} delay={0} />
      <Butterfly x={650} y={120} delay={3} />

      {/* 小鸟 */}
      <Bird x={400} y={80} delay={0} />
      <Bird x={500} y={55} delay={4} />
      <Bird x={300} y={65} delay={2} />

      {/* 小花 */}
      <Flower x={150} y={310} />
      <Flower x={250} y={325} />
      <Flower x={680} y={315} />
      <Flower x={780} y={330} />
      <Flower x={880} y={320} />
    </g>
  );
}

// ==================== 少年：城市落日 ====================
function TeenScene() {
  const g = uid();
  return (
    <g>
      <defs>
        <linearGradient id={`${g}-ts`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a3e" />
          <stop offset="40%" stopColor="#2d2050" />
          <stop offset="70%" stopColor="#8b3a62" />
          <stop offset="100%" stopColor="#e8954a" />
        </linearGradient>
        <radialGradient id={`${g}-sunset`}>
          <stop offset="0%" stopColor="rgba(255,140,40,0.7)" />
          <stop offset="50%" stopColor="rgba(255,100,30,0.3)" />
          <stop offset="100%" stopColor="rgba(255,80,20,0)" />
        </radialGradient>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-ts)`} />

      {/* 落日 */}
      <circle cx="700" cy="220" r="80" fill={`url(#${g}-sunset)`} />
      <circle cx="700" cy="220" r="32" fill="rgba(255,180,60,0.8)" />

      {/* 星星 */}
      {Array.from({ length: 25 }).map((_, i) => (
        <circle key={i}
          cx={Math.random() * 500} cy={Math.random() * 120}
          r={0.5 + Math.random() * 1.5}
          fill="rgba(255,255,255,0.6)"
          className="animate-twinkle"
          style={{ animationDelay: `${Math.random() * 3}s` }} />
      ))}

      {/* 远山 */}
      <path d="M0,280 Q80,240 160,260 Q240,220 320,250 Q400,230 480,260 Q560,240 640,255 Q720,235 800,250 Q880,240 960,260 L960,400 L0,400Z"
        fill="#1a1a2e" opacity="0.6" />

      {/* 城市剪影 */}
      <rect x="0" y="240" width="100%" height="160" fill="#0d0d1a" opacity="0.7" />
      {/* 建筑群 */}
      <rect x="30" y="180" width="35" height="120" fill="#111128" rx="1" />
      <rect x="40" y="195" width="6" height="4" fill="rgba(255,200,100,0.3)" />
      <rect x="55" y="185" width="6" height="4" fill="rgba(255,200,100,0.4)" />
      <rect x="70" y="210" width="6" height="4" fill="rgba(255,200,100,0.2)" />

      <rect x="80" y="140" width="50" height="160" fill="#141430" rx="1" />
      <rect x="90" y="155" width="5" height="4" fill="rgba(255,200,100,0.4)" />
      <rect x="100" y="170" width="5" height="4" fill="rgba(255,200,100,0.3)" />
      <rect x="110" y="150" width="5" height="4" fill="rgba(255,200,100,0.5)" />

      <rect x="145" y="200" width="40" height="100" fill="#0f0f25" rx="1" />

      <rect x="200" y="160" width="60" height="140" fill="#181835" rx="2" />
      <rect x="212" y="175" width="6" height="4" fill="rgba(255,200,100,0.35)" />
      <rect x="225" y="165" width="6" height="4" fill="rgba(255,200,100,0.3)" />
      <rect x="240" y="190" width="6" height="4" fill="rgba(255,200,100,0.25)" />

      <rect x="660" y="150" width="45" height="150" fill="#131330" rx="2" />
      <rect x="670" y="165" width="5" height="4" fill="rgba(255,200,100,0.35)" />
      <rect x="685" y="180" width="5" height="4" fill="rgba(255,200,100,0.3)" />

      <rect x="720" y="170" width="55" height="130" fill="#101028" rx="1" />
      <rect x="730" y="185" width="6" height="4" fill="rgba(255,200,100,0.4)" />
      <rect x="745" y="200" width="6" height="4" fill="rgba(255,200,100,0.25)" />

      <rect x="790" y="190" width="40" height="110" fill="#111130" rx="1" />
      <rect x="845" y="155" width="50" height="145" fill="#151535" rx="2" />
      <rect x="855" y="170" width="6" height="4" fill="rgba(255,200,100,0.3)" />
      <rect x="868" y="185" width="6" height="4" fill="rgba(255,200,100,0.4)" />

      {/* 地面 */}
      <rect x="0" y="300" width="960" height="100" fill="#0a0a16" />

      {/* 路灯暖光池 */}
      <GlowPool x={220} y={304} rx={60} ry={9} opacity={0.07} />
      <GlowPool x={600} y={308} rx={60} ry={9} opacity={0.07} />

      {/* 街灯 */}
      <StreetLamp x={220} y={240} />
      <StreetLamp x={600} y={250} />

      {/* 落叶 */}
      <FallingLeaf x={100} y={160} delay={0} size={1} />
      <FallingLeaf x={350} y={100} delay={2.5} size={0.8} />
      <FallingLeaf x={550} y={130} delay={5} size={1.1} />
    </g>
  );
}

// ==================== 青年：都市夜景 ====================
function YoungAdultScene() {
  const g = uid();
  return (
    <g>
      <defs>
        <linearGradient id={`${g}-ns`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050510" />
          <stop offset="50%" stopColor="#0a0a25" />
          <stop offset="100%" stopColor="#151535" />
        </linearGradient>
      </defs>

      {/* 夜空 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-ns)`} />

      {/* 星星密集 */}
      {Array.from({ length: 50 }).map((_, i) => (
        <circle key={i}
          cx={Math.random() * 960} cy={Math.random() * 180}
          r={0.3 + Math.random() * 2}
          fill="rgba(255,255,255,0.7)"
          className="animate-twinkle"
          style={{ animationDelay: `${Math.random() * 4}s` }} />
      ))}

      {/* 月亮 */}
      <circle cx="150" cy="60" r="30" fill="rgba(255,255,240,0.15)" />
      <circle cx="150" cy="60" r="25" fill="rgba(255,255,240,0.2)" />
      <circle cx="155" cy="55" r="22" fill="#050510" />

      {/* 远景建筑群 */}
      <g opacity="0.5">
        {[20, 80, 150, 210, 280, 340, 410, 470, 540, 600, 670, 730, 800, 860].map((x, i) => {
          const h = 80 + Math.sin(i * 1.7) * 60;
          return (
            <g key={i}>
              <rect x={x} y={320 - h} width={28 + Math.random() * 20} height={h} fill="#0f0f25" rx="1" />
              {/* 随机亮窗 */}
              {Array.from({ length: Math.floor(h / 18) }).map((_, j) => (
                <rect key={j}
                  x={x + 4 + Math.random() * 16}
                  y={320 - h + 6 + j * 18}
                  width="4" height="3"
                  fill={Math.random() > 0.4 ? 'rgba(255,220,150,0.4)' : 'rgba(255,200,100,0.15)'} />
              ))}
            </g>
          );
        })}
      </g>

      {/* 中景高楼 */}
      <g>
        <rect x="200" y="110" width="55" height="210" fill="#121230" rx="2" />
        {Array.from({ length: 10 }).map((_, j) => (
          <rect key={j} x={208 + Math.random() * 35} y={120 + j * 17}
            width="4" height="3" fill="rgba(255,220,150,0.5)" />
        ))}

        <rect x="270" y="160" width="40" height="160" fill="#0e0e28" rx="2" />
        {Array.from({ length: 7 }).map((_, j) => (
          <rect key={j} x={276 + Math.random() * 25} y={170 + j * 18}
            width="3" height="3" fill="rgba(255,200,150,0.4)" />
        ))}

        <rect x="560" y="140" width="65" height="180" fill="#141438" rx="3" />
        {Array.from({ length: 12 }).map((_, j) => (
          <rect key={j} x={568 + Math.random() * 45} y={152 + j * 14}
            width="4" height="3" fill="rgba(255,220,150,0.45)" />
        ))}

        <rect x="640" y="170" width="35" height="150" fill="#10102a" rx="2" />
        <rect x="690" y="130" width="50" height="190" fill="#161640" rx="3" />
        {Array.from({ length: 10 }).map((_, j) => (
          <rect key={j} x={698 + Math.random() * 30} y={142 + j * 16}
            width="4" height="3" fill="rgba(255,200,150,0.5)" />
        ))}
      </g>

      {/* 地面 + 道路 */}
      <rect x="0" y="320" width="960" height="80" fill="#080816" />
      <rect x="0" y="340" width="960" height="3" fill="rgba(255,200,100,0.15)" />

      {/* 霓虹招牌地面光晕 */}
      <GlowPool x={540} y={334} rx={70} ry={12} rgb="255,120,170" opacity={0.08} />

      {/* 车灯轨迹 */}
      <CarLight x={100} y={345} delay={0} />
      <CarLight x={400} y={345} delay={3} />
      <CarLight x={700} y={345} delay={6} />

      {/* 招牌光 */}
      <rect x="500" y="280" width="80" height="18" rx="3" fill="rgba(255,100,150,0.25)" className="animate-neon" />
      <rect x="500" y="280" width="80" height="18" rx="3" fill="none" stroke="rgba(255,100,150,0.5)" strokeWidth="1" />
    </g>
  );
}

// ==================== 中年：郊区家园 ====================
function AdultScene() {
  const g = uid();
  return (
    <g>
      <defs>
        <linearGradient id={`${g}-as`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8899aa" />
          <stop offset="60%" stopColor="#bcc8d4" />
          <stop offset="100%" stopColor="#d4dce4" />
        </linearGradient>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-as)`} />

      {/* 云 */}
      <Cloud x={120} y={40} scale={1} speed={25} opacity={0.5} />
      <Cloud x={500} y={25} scale={0.8} speed={20} opacity={0.4} />
      <Cloud x={750} y={50} scale={1.1} speed={28} opacity={0.45} />

      {/* 远山/远景 */}
      <path d="M0,250 Q100,210 200,240 Q300,220 400,235 Q500,215 600,230 Q700,210 800,225 Q900,215 960,230 L960,400 L0,400Z"
        fill="#7a8a75" opacity="0.5" />

      {/* 邻家房屋 */}
      <House x={60} y={180} scale={0.6} windowLit={true} />
      <House x={700} y={190} scale={0.55} windowLit={false} />

      {/* 树 */}
      <Tree x={30} y={210} size={0.8} />
      <Tree x={200} y={215} size={0.9} />
      <Tree x={850} y={220} size={0.85} />

      {/* 自家房屋 */}
      <House x={350} y={160} scale={0.85} windowLit={true} />
      {/* 车库/车 */}
      <rect x="490" y="265" width="55" height="30" rx="8" fill="#3a5a8a" />
      <rect x="495" y="258" width="45" height="12" rx="6" fill="#4a6a9a" />
      <circle cx="505" cy="298" r="7" fill="#1a1a1a" />
      <circle cx="535" cy="298" r="7" fill="#1a1a1a" />

      {/* 花园 */}
      <rect x="320" y="290" width="120" height="10" fill="#6a8a4a" />
      <Flower x={340} y={295} />
      <Flower x={370} y={300} />
      <Flower x={400} y={293} />
      <Flower x={430} y={297} />

      {/* 邮箱 */}
      <rect x="610" y="265" width="16" height="28" rx="3" fill="#4a4a8a" />
      <rect x="608" y="260" width="20" height="8" rx="2" fill="#5a5a9a" />

      {/* 地面 */}
      <rect x="0" y="300" width="960" height="100" fill="#6d9a4a" />
      <rect x="0" y="300" width="960" height="6" fill="#7aad50" />

      {/* 落地影（房屋/树/车/邮箱） */}
      <Shadow x={95} y={252} rx={56} ry={8} opacity={0.12} />
      <Shadow x={730} y={238} rx={52} ry={7} opacity={0.11} />
      <Shadow x={395} y={234} rx={72} ry={9} opacity={0.14} />
      <Shadow x={44} y={286} rx={40} ry={6} opacity={0.12} />
      <Shadow x={214} y={298} rx={44} ry={6} opacity={0.12} />
      <Shadow x={864} y={299} rx={40} ry={6} opacity={0.12} />
      <Shadow x={517} y={302} rx={46} ry={6} opacity={0.15} />
      <Shadow x={618} y={296} rx={17} ry={4} opacity={0.12} />

      {/* 小鸟 */}
      <Bird x={550} y={70} delay={1} />
      <Bird x={650} y={50} delay={5} />
    </g>
  );
}

// ==================== 中老年：花园夕阳 ====================
function MiddleAgeScene() {
  const g = uid();
  return (
    <g>
      <defs>
        <linearGradient id={`${g}-ms`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c05621" />
          <stop offset="40%" stopColor="#dd6b20" />
          <stop offset="75%" stopColor="#ecc94b" />
          <stop offset="100%" stopColor="#f7fafc" />
        </linearGradient>
        <radialGradient id={`${g}-msun`}>
          <stop offset="0%" stopColor="rgba(255,200,100,0.7)" />
          <stop offset="100%" stopColor="rgba(255,150,50,0)" />
        </radialGradient>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-ms)`} />

      {/* 夕阳 */}
      <circle cx="720" cy="200" r="100" fill={`url(#${g}-msun)`} />
      <circle cx="720" cy="200" r="35" fill="rgba(255,200,120,0.7)" />

      {/* 远山 */}
      <path d="M0,260 Q150,200 300,240 Q450,210 600,235 Q750,215 960,245 L960,400 L0,400Z"
        fill="#6a4a3a" opacity="0.4" />

      {/* 花园 */}
      <rect x="0" y="280" width="960" height="120" fill="#5a7a3a" />
      <rect x="0" y="280" width="960" height="4" fill="#6a8a4a" />

      {/* 落地影（长椅/树） */}
      <Shadow x={430} y={304} rx={68} ry={8} opacity={0.14} />
      <Shadow x={114} y={286} rx={42} ry={6} opacity={0.13} />
      <Shadow x={664} y={286} rx={38} ry={6} opacity={0.12} />
      <Shadow x={764} y={288} rx={34} ry={5} opacity={0.11} />

      {/* 长椅 */}
      <g transform="translate(380, 290)">
        <rect x="0" y="10" width="100" height="8" rx="3" fill="#5a3a2a" />
        <rect x="-2" y="5" width="4" height="20" fill="#4a2a1a" />
        <rect x="98" y="5" width="4" height="20" fill="#4a2a1a" />
        <rect x="5" y="0" width="90" height="6" rx="2" fill="#6b4a3a" />
      </g>

      {/* 树 */}
      <Tree x={100} y={210} size={0.8} />
      <Tree x={650} y={215} size={0.75} />
      <Tree x={750} y={220} size={0.7} />

      {/* 落叶 */}
      <FallingLeaf x={120} y={180} delay={0} size={1} />
      <FallingLeaf x={300} y={140} delay={1.5} size={0.8} />
      <FallingLeaf x={500} y={170} delay={3} size={1.1} />
      <FallingLeaf x={680} y={150} delay={4.5} size={0.9} />
      <FallingLeaf x={800} y={160} delay={2} size={0.7} />

      {/* 花朵 */}
      <Flower x={200} y={295} />
      <Flower x={230} y={305} />
      <Flower x={550} y={300} />
      <Flower x={580} y={292} />
    </g>
  );
}

// ==================== 晚年：秋叶公园 ====================
function ElderScene() {
  const g = uid();
  return (
    <g>
      <defs>
        <linearGradient id={`${g}-es`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6ad55" />
          <stop offset="30%" stopColor="#fbd38d" />
          <stop offset="60%" stopColor="#fefcbf" />
          <stop offset="100%" stopColor="#e8e4d8" />
        </linearGradient>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="960" height="400" fill={`url(#${g}-es)`} />

      {/* 夕阳 */}
      <circle cx="500" cy="180" r="70" fill="rgba(255,200,120,0.3)" />
      <circle cx="500" cy="180" r="30" fill="rgba(255,220,150,0.5)" />

      {/* 云 */}
      <Cloud x={150} y={50} scale={1} speed={18} opacity={0.35} />
      <Cloud x={680} y={70} scale={0.7} speed={22} opacity={0.3} />

      {/* 远景秋林 */}
      <path d="M0,250 Q80,200 160,230 Q240,190 320,220 Q400,195 480,225 Q560,200 640,215 Q720,190 800,220 Q880,200 960,225 L960,400 L0,400Z"
        fill="#c07840" opacity="0.4" />

      {/* 秋树 */}
      <g transform="translate(120, 210)">
        <rect x="10" y="30" width="14" height="60" fill="#5a3a2a" rx="3" />
        <circle cx="17" cy="20" r="35" fill="#d08040" opacity="0.7" />
        <circle cx="0" cy="30" r="25" fill="#c07030" opacity="0.6" />
        <circle cx="35" cy="28" r="28" fill="#e09050" opacity="0.65" />
      </g>
      <g transform="translate(680, 215)">
        <rect x="10" y="35" width="12" height="50" fill="#5a3a2a" rx="3" />
        <circle cx="16" cy="25" r="30" fill="#d08040" opacity="0.6" />
        <circle cx="0" cy="32" r="22" fill="#c07030" opacity="0.55" />
        <circle cx="33" cy="30" r="25" fill="#e09050" opacity="0.6" />
      </g>
      <g transform="translate(800, 220)">
        <rect x="8" y="30" width="10" height="45" fill="#5a3a2a" rx="3" />
        <circle cx="13" cy="20" r="28" fill="#d08040" opacity="0.6" />
        <circle cx="-5" cy="28" r="20" fill="#c07030" opacity="0.5" />
      </g>

      {/* 长椅 */}
      <g transform="translate(420, 295)">
        <rect x="0" y="10" width="110" height="9" rx="4" fill="#4a3020" />
        <rect x="-3" y="5" width="5" height="22" fill="#3a2010" />
        <rect x="108" y="5" width="5" height="22" fill="#3a2010" />
        <rect x="5" y="0" width="100" height="7" rx="3" fill="#5a4030" />
      </g>

      {/* 地面 */}
      <rect x="0" y="310" width="960" height="90" fill="#8a7a50" />
      <rect x="0" y="310" width="960" height="5" fill="#9a8a60" />

      {/* 落地影（长椅/秋树） */}
      <Shadow x={475} y={314} rx={72} ry={8} opacity={0.13} />
      <Shadow x={137} y={306} rx={42} ry={6} opacity={0.14} />
      <Shadow x={697} y={308} rx={38} ry={6} opacity={0.13} />
      <Shadow x={813} y={302} rx={34} ry={5} opacity={0.12} />

      {/* 满地落叶 */}
      {[100, 200, 300, 350, 450, 520, 600, 700, 750, 830].map((x, i) => (
        <ellipse key={i} cx={x} cy={315 + Math.sin(i) * 8} rx={4 + Math.random() * 3} ry={2}
          fill={`rgba(${180 + Math.random() * 60},${80 + Math.random() * 40},${30 + Math.random() * 20},0.5)`}
          transform={`rotate(${Math.random() * 60 - 30},${x},${315})`} />
      ))}

      {/* 飘落秋叶 */}
      <FallingLeaf x={150} y={120} delay={0} size={1.3} color="#d08040" />
      <FallingLeaf x={350} y={100} delay={2} size={1} color="#c07030" />
      <FallingLeaf x={550} y={130} delay={4} size={1.2} color="#e09050" />
      <FallingLeaf x={700} y={110} delay={1.5} size={0.9} color="#d08040" />
      <FallingLeaf x={850} y={125} delay={3.5} size={1.1} color="#c07030" />

      {/* 飞鸟（南飞） */}
      <Bird x={200} y={60} delay={0} />
      <Bird x={350} y={45} delay={2} />
      <Bird x={500} y={55} delay={4} />
    </g>
  );
}

// ==================== 可复用元素 ====================

/** 飘浮云朵 */
function Cloud({ x, y, scale, speed, opacity }: { x: number; y: number; scale: number; speed: number; opacity: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <animateTransform attributeName="transform" type="translate"
        from={`${x - 40} ${y}`} to={`${x + 120} ${y}`}
        dur={`${speed}s`} repeatCount="indefinite" additive="sum" />
      <circle cx="0" cy="0" r="20" fill="white" />
      <circle cx="22" cy="-8" r="28" fill="white" />
      <circle cx="45" cy="-2" r="22" fill="white" />
      <circle cx="18" cy="5" r="18" fill="white" />
    </g>
  );
}

/** 树 */
function Tree({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${size})`}>
      <rect x="12" y="40" width="14" height="50" fill="#6b4c3b" rx="3" />
      <circle cx="19" cy="25" r="38" fill="#5a8a3c" />
      <circle cx="0" cy="35" r="28" fill="#4a7a2c" />
      <circle cx="38" cy="32" r="30" fill="#6a9a4c" />
    </g>
  );
}

/** 小鸟 */
function Bird({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <animateTransform attributeName="transform" type="translate"
        from={`${x} ${y}`} to={`${x - 200} ${y - 40}`}
        dur="8s" repeatCount="indefinite" begin={`${delay}s`} />
      <path d="M0,0 Q6,-8 12,-2" stroke="rgba(40,40,60,0.5)" strokeWidth="2" fill="none" />
      <path d="M12,-2 Q18,-8 24,0" stroke="rgba(40,40,60,0.5)" strokeWidth="2" fill="none" />
    </g>
  );
}

/** 蝴蝶 */
function Butterfly({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <animateTransform attributeName="transform" type="translate"
        values={`${x},${y}; ${x + 30},${y - 20}; ${x + 60},${y}; ${x + 30},${y + 20}; ${x},${y}`}
        dur="6s" repeatCount="indefinite" begin={`${delay}s`} />
      <ellipse cx="-4" cy="0" rx="5" ry="3" fill="rgba(255,180,100,0.5)" transform="rotate(-20)" />
      <ellipse cx="4" cy="0" rx="5" ry="3" fill="rgba(255,180,100,0.5)" transform="rotate(20)" />
      <circle cx="0" cy="0" r="1.5" fill="rgba(100,60,20,0.6)" />
    </g>
  );
}

/** 小花 */
function Flower({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="0" x2="0" y2="8" stroke="#5a8a3a" strokeWidth="1.5" />
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <ellipse key={i} cx="0" cy="-3" rx="2" ry="4" fill="#ffb0c0"
          transform={`rotate(${angle})`} opacity="0.8" />
      ))}
      <circle cx="0" cy="0" r="2" fill="#ffe060" />
    </g>
  );
}

/** 街灯 */
function StreetLamp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="3" y="0" width="4" height="60" fill="#444" />
      <rect x="-3" y="55" width="16" height="4" fill="#555" rx="2" />
      <circle cx="5" cy="55" r="6" fill="rgba(255,220,150,0.3)" className="animate-glow" />
      <circle cx="5" cy="55" r="3" fill="rgba(255,240,200,0.6)" />
    </g>
  );
}

/** 飘落叶子 */
function FallingLeaf({ x, y, delay, size, color }: { x: number; y: number; delay: number; size: number; color?: string }) {
  const c = color || '#c07840';
  return (
    <g transform={`translate(${x},${y})`}>
      <animateTransform attributeName="transform" type="translate"
        values={`${x},${y}; ${x + 60},${y + 80}; ${x + 30},${y + 140}; ${x + 80},${y + 200}`}
        dur={`${5 + delay * 0.7}s`} repeatCount="indefinite" begin={`${delay}s`} />
      <ellipse cx="0" cy="0" rx={5 * size} ry={2.5 * size} fill={c} opacity="0.6"
        transform={`rotate(${delay * 40})`} />
    </g>
  );
}

/** 车灯光轨 */
function CarLight({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="4" fill="rgba(255,220,150,0.5)">
        <animate attributeName="cx" from={x} to={x + 200} dur="3s" repeatCount="indefinite" begin={`${delay}s`} />
        <animate attributeName="opacity" values="0.8;0.8;0" dur="3s" repeatCount="indefinite" begin={`${delay}s`} />
      </circle>
      <circle cx={x + 30} cy={y} r="4" fill="rgba(255,100,100,0.35)">
        <animate attributeName="cx" from={x + 30} to={x + 230} dur="3s" repeatCount="indefinite" begin={`${delay + 0.2}s`} />
        <animate attributeName="opacity" values="0.6;0.6;0" dur="3s" repeatCount="indefinite" begin={`${delay + 0.2}s`} />
      </circle>
    </g>
  );
}

/** 房屋 */
function House({ x, y, scale, windowLit }: { x: number; y: number; scale: number; windowLit: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x="0" y="30" width="100" height="80" fill="#e8dcc8" />
      <polygon points="-10,30 50,0 110,30" fill="#8b4513" />
      <rect x="30" y="60" width="16" height="20" fill={windowLit ? 'rgba(255,220,120,0.5)' : '#889'} />
      <rect x="60" y="60" width="16" height="20" fill={windowLit ? 'rgba(255,220,120,0.3)' : '#889'} />
      <rect x="42" y="85" width="20" height="25" fill="#6b4c3b" />
      <circle cx="57" cy="98" r="2" fill="#c9a96e" />
    </g>
  );
}

/** 柔和落地影（增强物体与地面的贴合感） */
function Shadow({ x, y, rx, ry = 5, opacity = 0.16 }: { x: number; y: number; rx: number; ry?: number; opacity?: number }) {
  const g = uid();
  return (
    <g>
      <defs>
        <radialGradient id={`${g}-sh`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={`rgba(25,20,15,${opacity})`} />
          <stop offset="100%" stopColor="rgba(25,20,15,0)" />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${g}-sh)`} />
    </g>
  );
}

/** 暖色光池（路灯 / 霓虹灯在地面的光晕） */
function GlowPool({ x, y, rx, ry = 10, rgb = '255,200,120', opacity = 0.07 }: { x: number; y: number; rx: number; ry?: number; rgb?: string; opacity?: number }) {
  const g = uid();
  return (
    <g>
      <defs>
        <radialGradient id={`${g}-gp`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={`rgba(${rgb},${opacity})`} />
          <stop offset="100%" stopColor={`rgba(${rgb},0)`} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#${g}-gp)`} />
    </g>
  );
}
