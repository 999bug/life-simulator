import { useState, useEffect, useRef, type ReactNode } from 'react';

interface Props {
  text: string;
  name: string;
  age: number;
  stage: string;
  onComplete?: () => void;
  onAutoContinue?: () => void;
  autoAdvance?: boolean;
}

export default function DialogBox({ text, name, age, stage, onComplete, onAutoContinue, autoAdvance }: Props) {
  const [segments, setSegments] = useState<ReactNode[]>([]);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setSegments([]);
    setDone(false);

    // 把文本按换行符拆成片段，换行处插入 <br>
    const parts = text.split('\n');
    const allUnits: Array<{ type: 'char'; value: string } | { type: 'br' }> = [];

    for (let p = 0; p < parts.length; p++) {
      for (const ch of parts[p]) {
        allUnits.push({ type: 'char', value: ch });
      }
      if (p < parts.length - 1) {
        allUnits.push({ type: 'br' });
      }
    }

    let i = 0;
    function type() {
      if (i < allUnits.length) {
        const unit = allUnits[i];
        if (unit.type === 'br') {
          setSegments(prev => [...prev, <br key={`br-${i}`} />]);
        } else {
          setSegments(prev => [...prev, unit.value]);
        }
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

  const handleClick = () => {
    if (!done) return;
    if (autoAdvance && onAutoContinue) {
      onAutoContinue();
    }
  };

  return (
    <div
      className={`bg-gradient-to-b from-black/92 to-black/97 backdrop-blur-xl border-t border-white/5
        ${autoAdvance && done ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="px-7 py-4 min-h-[80px]">
        {/* 元信息 */}
        <div className="flex gap-5 mb-2 text-[10px] text-white/40 tracking-wider">
          <span className="text-[#c9a96e] font-semibold">{name}</span>
          <span>{age}岁</span>
          <span>{stage}</span>
        </div>

        {/* 文本 */}
        <div className="text-lg leading-relaxed tracking-wide min-h-[56px]">
          {segments}
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
