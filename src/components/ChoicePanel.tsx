import type { AttributeKey, Attributes, Choice } from '../types';
import { ATTR_META, effectiveDelta } from '../engine/state';
import { sfx } from '../utils/sound';

interface Props {
  choices: Choice[];
  onSelect: (choice: Choice) => void;
  visible: boolean;
  attributes: Attributes;
  age: number;
  /** 真实模式：选项只显示属性倾向箭头（↑/↓，|v|≥8 双箭头），隐藏精确数值 */
  realMode: boolean;
}

export default function ChoicePanel({ choices, onSelect, visible, attributes, age, realMode }: Props) {
  if (!visible || choices.length === 0) return null;

  return (
    <div className="px-7 pb-5 flex flex-col gap-2 max-w-[860px] mx-auto">
      {choices.map((ch, idx) => (
        <button
          key={idx}
          onClick={() => { sfx.select(); onSelect(ch); }}
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
              {colorEffects(effectsText(ch, attributes, age, realMode))}
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
 * 真实模式：只显示倾向箭头（单箭头 |v|<8，双箭头 |v|≥8），实际生效为 0 的属性不显示。
 */
function effectsText(ch: Choice, attrs: Attributes, age: number, realMode: boolean): string {
  const attr = ch.outcomes.attr;
  return (Object.keys(attr) as AttributeKey[])
    .filter(k => attr[k] !== 0)
    .map(k => {
      const v = effectiveDelta(k, attr[k]!, attrs, age);
      if (realMode) {
        if (v === 0) {
          return '';
        }
        return `${ATTR_META[k].icon}${v > 0 ? (v >= 8 ? '↑↑' : '↑') : (v <= -8 ? '↓↓' : '↓')}`;
      }
      return `${ATTR_META[k].icon}${formatDelta(v)}`;
    })
    .filter(t => t !== '')
    .join(' ');
}

function formatDelta(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

function colorEffects(effects: string) {
  return effects.split(' ').map((t, i) => {
    const key = `${t}-${i}`;
    if (t.includes('↑')) return <span key={key} className="text-[#4ac9a0]">{t} </span>;
    if (t.includes('↓')) return <span key={key} className="text-[#e85d75]">{t} </span>;
    if (t.startsWith('+')) return <span key={key} className="text-[#4ac9a0]">{t} </span>;
    if (t.startsWith('-')) return <span key={key} className="text-[#e85d75]">{t} </span>;
    return <span key={key}>{t} </span>;
  });
}
