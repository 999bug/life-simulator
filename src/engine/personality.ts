import type { Attributes, ChoiceRecord } from '../types';
import { EVENTS } from './events.ts';

/** 性格端（3 维 6 端：思维模式 / 风险偏好 / 价值取向） */
export type PersonaTrait = 'rational' | 'emotional' | 'adventurous' | 'cautious' | 'selfish' | 'altruistic';

/** 性格画像：各端累积次数（每次命中选择 +1，纯推导） */
export type PersonaState = Record<PersonaTrait, number>;

/** 性格端元数据（展示用） */
export interface PersonaMeta {
  /** 中文名 */
  name: string;
  /** 展示图标 */
  icon: string;
  /** 主题色 */
  color: string;
  /** 所属维度 */
  dimension: 'mind' | 'risk' | 'value';
  /** 对立端 */
  opposite: PersonaTrait;
}

/** 性格端元数据表 */
export const PERSONA_META: Record<PersonaTrait, PersonaMeta> = {
  rational: { name: '理性', icon: '🧠', color: '#5b8def', dimension: 'mind', opposite: 'emotional' },
  emotional: { name: '感性', icon: '😊', color: '#f0a35e', dimension: 'mind', opposite: 'rational' },
  adventurous: { name: '冒险', icon: '⚡', color: '#a78bfa', dimension: 'risk', opposite: 'cautious' },
  cautious: { name: '安稳', icon: '🏠', color: '#4ecdc4', dimension: 'risk', opposite: 'adventurous' },
  selfish: { name: '利己', icon: '💰', color: '#e8c66e', dimension: 'value', opposite: 'altruistic' },
  altruistic: { name: '利他', icon: '🤝', color: '#4ac9a0', dimension: 'value', opposite: 'selfish' },
};

/** 空画像（全部 0） */
export const EMPTY_PERSONA: PersonaState = {
  rational: 0,
  emotional: 0,
  adventurous: 0,
  cautious: 0,
  selfish: 0,
  altruistic: 0,
};

/** 正项强信号阈值：单项效果 ≥ 该值视为「明确表达」 */
const POS_SIGNAL = 6;

/** 冒险判定阈值：负向总额与正向总额绝对值均 ≥ 该值（付出代价换回报） */
const RISK_SIGNAL = 8;

/** 利己判定财富阈值（配道德 ≤ 0） */
const SELFISH_WEALTH = 8;

/**
 * flag → 性格端补充规则。
 * 叙事信号：flag 名即人生走向，效果结构难以表达（如「休学一年」效果可能平淡但选择很冒险）。
 * 内容层文案重写时持续扩充；仅收录叙事信号明确者，避免噪音。
 */
const PERSONA_FLAG_RULES: Record<string, PersonaTrait> = {
  // 冒险：闯荡/下注性质的人生选择
  adventurous: 'adventurous',
  gap_year: 'adventurous',
  venture_out: 'adventurous',
  venture: 'adventurous',
  explorer: 'adventurous',
  // 利他：为他人付出
  volunteer: 'altruistic',
  kind_heart: 'altruistic',
  caring_person: 'altruistic',
  empathetic: 'altruistic',
  loving_sibling: 'altruistic',
  good_parent: 'altruistic',
  // 理性：用头脑克制情感
  self_discipline: 'rational',
  investor_sharp: 'rational',
  // 感性：追随情感
  first_love: 'emotional',
  college_romance: 'emotional',
  artist_life: 'emotional',
  // 安稳：求稳的路径选择
  civil_servant: 'cautious',
  normal_university: 'cautious',
  will_written: 'cautious',
};

/**
 * 选项效果 → 命中的性格端（0-2 个）。
 *
 * 手工标注优先（内容层文案重写时标注，标注即最终信号，不做自动推导叠加）；
 * 无标注走强信号规则：效果结构（求和后判定）+ flag 补充表；无信号不标注。
 * 阈值口径：原始效果值（数据声明即设计意图，不做年龄收益折算）。
 *
 * @param attr 选项效果（属性键 → 声明值）
 * @param flags 选项产出的 flag
 * @param manual 手工性格标注（白名单过滤，非法值忽略）
 * @returns 命中的性格端数组（去重，最多 2 个）
 */
export function traitForOutcome(attr: Partial<Attributes>, flags: string[] = [], manual: string[] = []): PersonaTrait[] {
  // 手工标注优先（内容层文案重写时标注；标注即最终信号）
  if (manual.length > 0) {
    return [...new Set(manual)].filter((t): t is PersonaTrait => t in PERSONA_META);
  }

  const traits = new Set<PersonaTrait>();

  // flag 补充规则（叙事信号优先）
  for (const f of flags) {
    const t = PERSONA_FLAG_RULES[f];
    if (t) {
      traits.add(t);
    }
  }

  // 效果结构规则（求和后判定）
  const intel = attr.intelligence ?? 0;
  const happy = attr.happiness ?? 0;
  const wealth = attr.wealth ?? 0;
  const moral = attr.morality ?? 0;
  let posTotal = 0;
  let negTotal = 0;
  for (const v of Object.values(attr)) {
    if (v > 0) {
      posTotal += v;
    } else {
      negTotal += -v;
    }
  }
  // 用头脑而非情感
  if (intel >= POS_SIGNAL && happy <= 0) {
    traits.add('rational');
  }
  // 跟随内心
  if (happy >= POS_SIGNAL && intel <= 0) {
    traits.add('emotional');
  }
  // 付出代价换高回报
  if (negTotal >= RISK_SIGNAL && posTotal >= RISK_SIGNAL) {
    traits.add('adventurous');
  }
  // 以牺牲道德为代价换取财富（道德无变化不标：没提道德 ≠ 主动利己）
  if (wealth >= SELFISH_WEALTH && moral < 0) {
    traits.add('selfish');
  }
  // 为他人付出
  if (moral >= POS_SIGNAL) {
    traits.add('altruistic');
  }
  return [...traits];
}

/**
 * 从选择历史推导性格画像（纯推导，旧存档/回看/undo 自动兼容）。
 * 每条选择反查事件表取选项效果；事件已被精简删除或索引越界的记录跳过。
 *
 * @param history 选择记录（含 eventId + choiceIndex，反查事件数据）
 * @returns 性格画像（各端累积次数）
 */
export function derivePersona(history: ChoiceRecord[]): PersonaState {
  const out: PersonaState = { ...EMPTY_PERSONA };
  for (const h of history) {
    const ev = EVENTS.find(e => e.id === h.eventId);
    if (!ev) {
      continue;
    }
    const ch = ev.choices[h.choiceIndex];
    if (!ch) {
      continue;
    }
    for (const t of traitForOutcome(ch.outcomes.attr, ch.outcomes.flags, ch.outcomes.personality)) {
      out[t]++;
    }
  }
  return out;
}

/** 概括句词表：每端形容词 + 人设名词 */
const SUMMARY_WORDS: Record<PersonaTrait, { adj: string; noun: string }> = {
  rational: { adj: '理智清醒', noun: '思考者' },
  emotional: { adj: '情感丰沛', noun: '浪漫主义者' },
  adventurous: { adj: '大胆无畏', noun: '冒险家' },
  cautious: { adj: '谨慎踏实', noun: '稳行人' },
  selfish: { adj: '精明务实', noun: '现实主义者' },
  altruistic: { adj: '温暖善良', noun: '给予者' },
};

/** 画像成形最低总次数（个位数的零星选择不构成画像） */
const SUMMARY_MIN_TOTAL = 2;

/**
 * 生成一句话性格概括。
 * 总分 < 2 视为无鲜明印记；否则取 Top1 形容词 + 人设名词——
 * Top2 与 Top1 不同维度时用 Top2 名词（「一个大胆无畏的浪漫主义者」），
 * 同维度对冲或无 Top2 时用 Top1 自身名词。
 *
 * @param persona 性格画像
 * @returns 概括句（如「一个大胆无畏的冒险家」）
 */
export function personaSummary(persona: PersonaState): string {
  const entries = (Object.keys(persona) as PersonaTrait[])
    .map(t => ({ t, n: persona[t] }))
    .filter(e => e.n > 0)
    .sort((a, b) => b.n - a.n);
  const total = entries.reduce((s, e) => s + e.n, 0);
  if (entries.length === 0 || total < SUMMARY_MIN_TOTAL) {
    return '这一生没有留下鲜明的性格印记';
  }
  const [top, second] = entries;
  const secondNoun = second && PERSONA_META[second.t].dimension !== PERSONA_META[top.t].dimension
    ? SUMMARY_WORDS[second.t].noun
    : SUMMARY_WORDS[top.t].noun;
  return `一个${SUMMARY_WORDS[top.t].adj}的${secondNoun}`;
}
