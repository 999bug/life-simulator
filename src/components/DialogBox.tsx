import { useState, useEffect, useRef } from 'react';

interface Props {
  text: string;
  name: string;
  age: number;
  stage: string;
  onComplete?: () => void;
  autoAdvance?: boolean;
}

export default function DialogBox({ text, name, age, stage, onComplete, autoAdvance }: Props) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const chars = [...text];

    function type() {
      if (i < chars.length) {
        setDisplayed(prev => prev + chars[i]);
        i++;
        timerRef.current = setTimeout(type, 25 + Math.random() * 20);
      } else {
        setDone(true);
        onComplete?.();
      }
    }

    timerRef.current = setTimeout(type, 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  return (
    <div
      className={`bg-gradient-to-b from-black/92 to-black/97 backdrop-blur-xl border-t border-white/5 ${autoAdvance && done ? 'cursor-pointer' : ''}`}
      onClick={autoAdvance && done ? onComplete : undefined}
    >
      <div className="px-7 py-4 min-h-[80px]">
        {/* 元信息 */}
        <div className="flex gap-5 mb-2 text-[10px] text-white/40 tracking-wider">
          <span className="text-[#c9a96e] font-semibold">{name}</span>
          <span>{age}岁</span>
          <span>{stage}</span>
        </div>

        {/* 文本 */}
        <div className="text-lg leading-relaxed tracking-wide whitespace-pre-line min-h-[56px]">
          {displayed}
          {!done && <span className="text-[#c9a96e] animate-blink ml-0.5">▎</span>}
        </div>

        {/* 自动推进提示 */}
        {autoAdvance && done && (
          <div className="text-center text-[11px] text-white/30 mt-3 animate-pulse">
            ▼ 点击继续
          </div>
        )}
      </div>
    </div>
  );
}
