import type { AttributeKey, Attributes } from '../types';
import { ATTR_META, ageCap } from '../engine/state';

interface Props {
  attributes: Attributes;
  age: number;
}

export default function StatusBar({ attributes, age }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-0.5 px-5 py-2.5 bg-black/95 backdrop-blur-md border-b border-white/5">
      {Object.entries(attributes).map(([key, val]) => {
        const meta = ATTR_META[key as AttributeKey];
        // 进度条按当前年龄上限填充：达到上限即满，数值转金色
        const cap = ageCap(age, key as AttributeKey);
        const ratio = Math.min(100, Math.round((val / cap) * 100));
        const capped = val >= cap;
        return (
          <div key={key} className="flex items-center gap-1.5 text-[11px] py-1">
            <span className="text-[13px] w-[18px] text-center shrink-0">{meta.icon}</span>
            <span className="text-white/40 w-[22px] shrink-0 text-[10px]">{meta.name}</span>
            <div className="flex-1 h-[5px] bg-white/8 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-700 ease-out"
                style={{ width: `${ratio}%`, backgroundColor: capped ? '#c9a96e' : meta.color }}
              />
            </div>
            <span className={`w-[24px] text-right shrink-0 text-[10px] font-semibold ${capped ? 'text-[#c9a96e]' : 'text-white/40'}`}>
              {val}
            </span>
          </div>
        );
      })}
    </div>
  );
}
