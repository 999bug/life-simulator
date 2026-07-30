import type { GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';

interface Props {
  game: GameState;
  onRestart: () => void;
}

export default function SummaryScreen({ game, onRestart }: Props) {
  const score = calcScore(game.attributes);

  let title: string, desc: string;
  if (score >= 75) {
    title = '辉煌的一生';
    desc = '回望来路，满目星辰。你活出了大多数人只敢梦想的人生，每一个重要选择都踩在了对的位置上。此生无憾。';
  } else if (score >= 60) {
    title = '充实的一生';
    desc = '没有惊天动地，但每一步都走得踏实。有爱、有事做、有所期待——也许这就是最好的生活。';
  } else if (score >= 45) {
    title = '平凡的一生';
    desc = '有得有失，有笑有泪。你的人生像大多数人的一样，不够完美，但足够真实。';
  } else if (score >= 30) {
    title = '坎坷的一生';
    desc = '命运对你并不慷慨，你做过错误的选择，也承受过不该承受的苦。但这一路走来，你已经尽力了。';
  } else {
    title = '艰难的一生';
    desc = '这一生写满了挣扎。如果真的有来世，愿你能被温柔以待。';
  }

  return (
    <div className="w-full h-full bg-gradient-to-b from-[#0a0a14] via-[#1a1a2e] to-[#0a0a14]
      flex flex-col items-center px-10 py-10 gap-4 overflow-y-auto">
      <p className="text-sm text-white/40 tracking-[4px]">
        {game.gender === 'male' ? '♂' : '♀'} {game.name} · 享年 {game.age} 岁
      </p>
      <h2 className="text-[34px] font-extralight tracking-[10px] text-[#c9a96e] animate-[fadeInDown_0.8s_ease]">
        {title}
      </h2>
      <p className="text-sm text-white/40 text-center max-w-[400px] leading-relaxed animate-[fadeIn_1.2s_ease]">
        {desc}
      </p>

      {/* 综合评分 */}
      <div className="w-[80px] h-[80px] rounded-full border-2 border-[#c9a96e]
        flex items-center justify-center text-3xl text-[#c9a96e] font-extralight
        animate-[fadeIn_1.5s_ease] relative
        before:absolute before:inset-[-6px] before:rounded-full before:border before:border-[#c9a96e]/20">
        {score}
      </div>
      <p className="text-[11px] text-white/40 tracking-[3px]">综合评分</p>

      {/* 属性展示 */}
      <div className="grid grid-cols-4 gap-3 w-full max-w-[580px] animate-[fadeInUp_1s_ease]">
        {Object.entries(game.attributes).map(([k, v]) => {
          const meta = ATTR_META[k as keyof typeof game.attributes];
          return (
            <div key={k} className="text-center p-3.5 bg-[#1a1a2e] rounded-lg border border-white/[0.04]
              hover:border-white/15 hover:-translate-y-0.5 transition-all duration-300">
              <div className="text-2xl font-light" style={{ color: meta.color }}>{v}</div>
              <div className="text-[10px] text-white/40 mt-1">{meta.icon} {meta.name}</div>
            </div>
          );
        })}
      </div>

      {/* 时间线 */}
      <div className="w-full max-w-[580px] animate-[fadeInUp_1.3s_ease]">
        <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">📋 重要选择回顾</h3>
        {game.history.slice(-10).map((h, i) => (
          <div key={i} className="flex gap-3 py-1.5 text-xs border-b border-white/[0.02]">
            <span className="text-[#c9a96e] min-w-[32px]">{h.age}岁</span>
            <span className="text-white/40">{h.text}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onRestart}
        className="px-9 py-3 border border-white/20 rounded-2xl bg-transparent
          text-sm text-white/40 tracking-[4px] font-sans
          hover:border-[#c9a96e] hover:text-[#c9a96e] hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        重新开始
      </button>
    </div>
  );
}
