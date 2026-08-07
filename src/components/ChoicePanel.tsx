import type { AttributeKey, Attributes, Choice } from '../types';
import { ATTR_META, effectiveDelta } from '../engine/state';
import { PERSONA_META, traitForOutcome } from '../engine/personality';
import { sfx } from '../utils/sound';

interface Props {
  choices: Choice[];
  onSelect: (choice: Choice) => void;
  visible: boolean;
  attributes: Attributes;
  age: number;
  /** 真实模式：选项只显示属性倾向箭头（↑/↓，|v|≥8 双箭头）；普通模式不显示任何数值（选择完反馈页才显示） */
  realMode: boolean;
}

export default function ChoicePanel({ choices, onSelect, visible, attributes, age, realMode }: Props) {
  if (!visible || choices.length === 0) return null;

  return (
    <div className="px-7 pb-5 flex flex-col gap-2 max-w-[860px] mx-auto">
      {choices.map((ch, idx) => {
        // 性格徽章：效果结构强信号 + flag 补充规则（无信号不标注，留白也是区分）
        const traits = traitForOutcome(ch.outcomes.attr, ch.outcomes.flags);
        return (
          <button
            key={idx}
            onClick={() => { sfx.select(); onSelect(ch); }}
            title={ch.text}
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

            {/* 选项文字：最多两行，完整内容悬浮可见（实测反馈：文字偏长，精简展示） */}
            <span className="line-clamp-2">{ch.text}</span>

            {/* 性格徽章：风格提示不是数值，真实模式也保留（防按数值选择的原则不受影响） */}
            {traits.length > 0 && (
              <span className="ml-2 shrink-0 flex items-center gap-1">
                {traits.map(t => (
                  <span key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap leading-tight"
                    style={{ color: PERSONA_META[t].color, borderColor: `${PERSONA_META[t].color}55`, backgroundColor: `${PERSONA_META[t].color}1a` }}>
                    {PERSONA_META[t].icon} {PERSONA_META[t].name}
                  </span>
                ))}
              </span>
            )}

            {/* 真实模式保留倾向箭头；普通模式不显示数值（防按数值选择，选择完反馈页显示精确变化） */}
            {realMode && ch.outcomes.attr && Object.keys(ch.outcomes.attr).length > 0 && (
              <span className="text-[10px] text-white/40 tracking-wide whitespace-nowrap ml-3 shrink-0">
                {colorEffects(effectsText(ch, attributes, age))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 生成倾向箭头展示串（真实模式专用：按当前属性计算实际生效值，与引擎应用结果一致）。
 * 只显示箭头（单箭头 |v|<8，双箭头 |v|≥8），实际生效为 0 的属性不显示。
 */
function effectsText(ch: Choice, attrs: Attributes, age: number): string {
  const attr = ch.outcomes.attr;
  return (Object.keys(attr) as AttributeKey[])
    .filter(k => attr[k] !== 0)
    .map(k => {
      const v = effectiveDelta(k, attr[k]!, attrs, age);
      if (v === 0) {
        return '';
      }
      return `${ATTR_META[k].icon}${v > 0 ? (v >= 8 ? '↑↑' : '↑') : (v <= -8 ? '↓↓' : '↓')}`;
    })
    .filter(t => t !== '')
    .join(' ');
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
