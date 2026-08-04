import { useState, useEffect, useRef, type ReactNode } from 'react';
import { sfx } from '../utils/sound';
import { TYPE_SPEED_RANGES } from '../engine/state';
import type { TypeSpeed } from '../types';

interface Props {
  text: string;
  name: string;
  age: number;
  stage: string;
  title?: string;
  onComplete?: () => void;
  onAutoContinue?: () => void;
  autoAdvance?: boolean;
  /** 立即显示全文（快速模拟模式跳过打字机） */
  instant?: boolean;
  /** 打字机速度档（默认 normal） */
  typeSpeed?: TypeSpeed;
}

export default function DialogBox({ text, name, age, stage, title, onComplete, onAutoContinue, autoAdvance, instant, typeSpeed = 'normal' }: Props) {
  const [segments, setSegments] = useState<ReactNode[]>([]);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  /** 完整字符单元（点击跳过打字时立即渲染用） */
  const unitsRef = useRef<Array<{ type: 'char'; value: string } | { type: 'br' }>>([]);

  useEffect(() => {
    if (instant) {
      // 快速模式：一次性渲染全文并立即完成
      setSegments(text.split('\n').flatMap((p, i) => i === 0 ? [p] : [<br key={`br-${i}`} />, p]));
      setDone(true);
      onComplete?.();
      return;
    }
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
    unitsRef.current = allUnits;

    let i = 0;
    function type() {
      if (i < allUnits.length) {
        const unit = allUnits[i];
        if (unit.type === 'br') {
          setSegments(prev => [...prev, <br key={`br-${i}`} />]);
        } else {
          setSegments(prev => [...prev, unit.value]);
          sfx.type();
        }
        i++;
        const [min, max] = TYPE_SPEED_RANGES[typeSpeed];
        timerRef.current = setTimeout(type, min + Math.random() * (max - min));
      } else {
        setDone(true);
        onComplete?.();
      }
    }

    timerRef.current = setTimeout(type, 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  const handleClick = () => {
    if (!done) {
      // 跳过打字：立即显示全文并触发完成
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setSegments(unitsRef.current.map((u, i) => u.type === 'br' ? <br key={`br-${i}`} /> : u.value));
      setDone(true);
      onComplete?.();
      return;
    }
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
          {title && <span className="text-white/60">「{title}」</span>}
        </div>

        {/* 文本 */}
        <div className="text-lg leading-relaxed tracking-wide min-h-[56px] text-white/90">
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
