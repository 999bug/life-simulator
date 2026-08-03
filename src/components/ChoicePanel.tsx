import type { AttributeKey, Attributes, Choice } from '../types';
import { ATTR_META, effectiveDelta } from '../engine/state';

interface Props {
  choices: Choice[];
  onSelect: (choice: Choice) => void;
  visible: boolean;
  attributes: Attributes;
  age: number;
}

export default function ChoicePanel({ choices, onSelect, visible, attributes, age }: Props) {
  if (!visible || choices.length === 0) return null;

  return (
    <div className="px-7 pb-5 flex flex-col gap-2">
      {choices.map((ch, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(ch)}
          className="group relative w-full px-4 py-3 text-left
            bg-white/[0.04] border border-white/[0.08] rounded-lg
            text-[15px] tracking-wide
            hover:bg-white/[0.08] hover:border-white/20
            hover:translate-x-1.5 hover:shadow-lg hover:shadow-black/30
            active:scale-[0.98]
            transition-all duration-200
            flex justify-between items-center
            overflow-hidden"
        >
          {/* 左侧装饰条 */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#c9a96e]
            scale-y-0 group-hover:scale-y-100 transition-transform duration-200 rounded-r-sm" />

          <span>{ch.text}</span>

          {ch.outcomes.attr && Object.keys(ch.outcomes.attr).length > 0 && (
            <span className="text-[10px] text-white/40 tracking-wide whitespace-nowrap ml-3 shrink-0">
              {colorEffects(effectsText(ch, attributes, age))}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * 生成实时效果展示串（按当前属性计算实际生效值，与引擎应用结果一致）。
 * 键序沿用转换器生成的 outcomes 顺序。
 */
function effectsText(ch: Choice, attrs: Attributes, age: number): string {
  const attr = ch.outcomes.attr;
  return (Object.keys(attr) as AttributeKey[])
    .filter(k => attr[k] !== 0)
    .map(k => `${ATTR_META[k].icon}${formatDelta(effectiveDelta(k, attr[k]!, attrs, age))}`)
    .join(' ');
}

function formatDelta(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

function colorEffects(effects: string) {
  return effects.split(' ').map((t, i) => {
    const key = `${t}-${i}`;
    if (t.startsWith('+')) return <span key={key} className="text-[#4ac9a0]">{t} </span>;
    if (t.startsWith('-')) return <span key={key} className="text-[#e85d75]">{t} </span>;
    return <span key={key}>{t} </span>;
  });
}
