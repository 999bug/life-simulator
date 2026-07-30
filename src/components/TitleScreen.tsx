import { useState } from 'react';

interface Props {
  onStart: (gender: 'male' | 'female', name: string) => void;
}

export default function TitleScreen({ onStart }: Props) {
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [name, setName] = useState('');

  const handleStart = () => {
    if (!gender) return;
    const finalName = name.trim() || (gender === 'male' ? '小明' : '小美');
    onStart(gender, finalName);
  };

  return (
    <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,#1a1a30_0%,#0a0a14_70%)]
      flex flex-col items-center justify-center gap-6 relative overflow-hidden">

      {/* 光晕动画 */}
      <div className="absolute w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(201,169,110,0.06)_0%,transparent_60%)]
        top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />

      {/* 粒子 */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1.5 + Math.random() * 2.5}px`,
              height: `${1.5 + Math.random() * 2.5}px`,
              left: `${Math.random() * 100}%`,
              bottom: `-${Math.random() * 10}px`,
              background: `rgba(201,169,110,${0.1 + Math.random() * 0.25})`,
              animation: `float ${8 + Math.random() * 12}s linear ${Math.random() * 8}s infinite`,
            }}
          />
        ))}
      </div>

      {/* 标题 */}
      <h1 className="text-[52px] font-extralight tracking-[14px] text-[#c9a96e]
        [text-shadow:0_0_50px_rgba(201,169,110,0.3)] z-10 animate-[fadeInDown_1.4s_ease]">
        人生模拟器
      </h1>
      <p className="text-sm text-white/40 tracking-[8px] z-10 animate-[fadeInUp_1.4s_ease]">
        L I F E  ·  S I M U L A T O R
      </p>

      {/* 名字输入 */}
      <div className="z-10 flex flex-col items-center gap-2 animate-[fadeIn_1.8s_ease]">
        <label className="text-xs text-white/40 tracking-[3px]">你的名字</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
          placeholder="输入名字或留空"
          maxLength={8}
          className="w-[200px] px-4 py-2.5 bg-white/5 border border-white/15 rounded-lg
            text-white text-center text-base tracking-[3px] outline-none
            focus:border-[#c9a96e] focus:shadow-[0_0_20px_rgba(201,169,110,0.3)]
            transition-all duration-300 font-sans"
        />
      </div>

      {/* 性别选择 */}
      <div className="flex gap-5 z-10 animate-[fadeIn_2s_ease]">
        <button
          onClick={() => { setGender('male'); if (!name) setName('小明'); }}
          className={`w-[120px] h-[140px] border rounded-2xl flex flex-col items-center justify-center gap-2.5
            text-base tracking-[2px] transition-all duration-300
            ${gender === 'male'
              ? 'border-[#4a90d9] shadow-[0_0_35px_rgba(74,144,217,0.35)] bg-[#4a90d9]/10 text-[#4a90d9]'
              : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-[#4a90d9] hover:shadow-[0_12px_30px_rgba(74,144,217,0.2)] hover:text-[#4a90d9] hover:-translate-y-1.5'
            }`}
        >
          <span className="text-[40px] transition-transform duration-300 group-hover:scale-110">👦</span>
          <span>男 生</span>
        </button>
        <button
          onClick={() => { setGender('female'); if (!name) setName('小美'); }}
          className={`w-[120px] h-[140px] border rounded-2xl flex flex-col items-center justify-center gap-2.5
            text-base tracking-[2px] transition-all duration-300
            ${gender === 'female'
              ? 'border-[#d96b8a] shadow-[0_0_35px_rgba(217,107,138,0.35)] bg-[#d96b8a]/10 text-[#d96b8a]'
              : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-[#d96b8a] hover:shadow-[0_12px_30px_rgba(217,107,138,0.2)] hover:text-[#d96b8a] hover:-translate-y-1.5'
            }`}
        >
          <span className="text-[40px] transition-transform duration-300 group-hover:scale-110">👧</span>
          <span>女 生</span>
        </button>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={handleStart}
        disabled={!gender}
        className={`px-14 py-3.5 rounded-[30px] text-[17px] tracking-[6px] z-10 transition-all duration-400 border font-sans
          ${gender
            ? 'bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent shadow-[0_8px_32px_rgba(201,169,110,0.3)] hover:scale-105 cursor-pointer'
            : 'bg-white/[0.06] text-white/30 border-white/[0.08] cursor-not-allowed'
          }`}
      >
        开 始 人 生
      </button>
    </div>
  );
}
