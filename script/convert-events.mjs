import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

/**
 * 107 条 chiled.json 属性名 → 8 大引擎属性映射（数据实际使用 106 键，luck 为冗余映射）。
 * INVERSE 中的键为负向维度，映射后数值取反（pressure: +8 → happiness: -8）。
 */
export const ATTR_MAP = {
  // intelligence 智力（38 个）
  learning: 'intelligence', knowledge: 'intelligence', intelligence: 'intelligence',
  curiosity: 'intelligence', thinking: 'intelligence', critical_thinking: 'intelligence',
  logic: 'intelligence', observation: 'intelligence', memory: 'intelligence',
  problem_solving: 'intelligence', research: 'intelligence', science: 'intelligence',
  math: 'intelligence', language: 'intelligence', technology: 'intelligence',
  engineering: 'intelligence', creativity: 'intelligence', imagination: 'intelligence',
  innovation: 'intelligence', independence: 'intelligence', self_reliance: 'intelligence',
  experience: 'intelligence', maturity: 'intelligence', adaptability: 'intelligence',
  skill: 'intelligence', talent: 'intelligence', growth: 'intelligence',
  planning: 'intelligence', strategy: 'intelligence', judgement: 'intelligence',
  caution: 'intelligence', focus: 'intelligence', ambition: 'intelligence',
  vision: 'intelligence', self_awareness: 'intelligence', efficiency: 'intelligence',
  specialization: 'intelligence', special_skill: 'intelligence',
  // morality 道德（10 个）
  empathy: 'morality', responsibility: 'morality', discipline: 'morality',
  willpower: 'morality', patience: 'morality', persistence: 'morality',
  self_control: 'morality', emotion_control: 'morality', gratitude: 'morality',
  loyalty: 'morality',
  // social 社交（9 个）
  social: 'social', friendship: 'social', relationship: 'social',
  family_relation: 'social', teacher_relation: 'social', teamwork: 'social',
  communication: 'social', leadership: 'social', trust: 'social',
  // happiness 幸福（16 个）
  happiness: 'happiness', stability: 'happiness', pride: 'happiness',
  emotion: 'happiness', entertainment: 'happiness', family_need: 'happiness',
  freedom: 'happiness', security_need: 'happiness', security: 'happiness',
  motivation: 'happiness', comfort: 'happiness', fun: 'happiness',
  balance: 'happiness', interest: 'happiness', interest_change: 'happiness',
  gaming: 'happiness',
  // health 健康（6 个）
  health: 'health', sports: 'health', safety: 'health',
  safety_awareness: 'health', mental: 'health', resilience: 'health',
  // wealth 财富（6 个）
  money: 'wealth', financial: 'wealth', saving: 'wealth',
  business: 'wealth', money_management: 'wealth', money_awareness: 'wealth',
  // appearance 魅力（10 个）
  appearance: 'appearance', confidence: 'appearance', charisma: 'appearance',
  courage: 'appearance', action: 'appearance', competition: 'appearance',
  art: 'appearance', music: 'appearance', ego: 'appearance', power: 'appearance',
  // luck 运气（3 个）
  luck: 'luck', risk: 'luck', future_opportunity: 'luck',
  // 取反键（9 个）
  dependence: 'intelligence', avoidance: 'morality', procrastination: 'morality',
  impulse: 'morality', introversion: 'social', pressure: 'happiness',
  anger: 'happiness', anxiety: 'happiness', conflict: 'happiness',
};

/** 负向维度键：映射后数值取反 */
export const INVERSE = new Set([
  'dependence', 'avoidance', 'procrastination', 'impulse', 'introversion',
  'pressure', 'anger', 'anxiety', 'conflict',
]);

/** 八大属性展示顺序与图标（与 src/engine/state.ts 的 ATTR_META 一致，需手动同步） */
const ATTR_ORDER = ['health', 'intelligence', 'wealth', 'happiness', 'social', 'appearance', 'luck', 'morality'];
const ATTR_ICON = {
  health: '💪', intelligence: '🧠', wealth: '💰', happiness: '😊',
  social: '👥', appearance: '🎨', luck: '🍀', morality: '⚖️',
};

/** 阶段年龄区间（与 src/engine/state.ts 的 STAGE_META 一致，需手动同步） */
const STAGE_RANGES = [
  ['infant', 0, 2],
  ['childhood', 3, 11],
  ['teen', 12, 17],
  ['young_adult', 18, 29],
  ['adult', 30, 49],
  ['middle_age', 50, 64],
  ['elder', 65, 95],
];

/** 按年龄推导人生阶段 */
function stageForAge(age) {
  for (const [stage, lo, hi] of STAGE_RANGES) {
    if (age >= lo && age <= hi) {
      return stage;
    }
  }
  return 'elder';
}

/**
 * 转换 effects 对象为引擎 outcomes.attr：映射 + 取反 + 同属性求和合并。
 * 遇到未映射键直接抛错（fail fast，不静默丢失）。
 */
function mapEffects(effects, eventId) {
  const attr = {};
  for (const [key, value] of Object.entries(effects)) {
    const target = ATTR_MAP[key];
    if (!target) {
      throw new Error(`unmapped attr "${key}" in event ${eventId}`);
    }
    attr[target] = (attr[target] ?? 0) + (INVERSE.has(key) ? -value : value);
  }
  for (const key of Object.keys(attr)) {
    if (attr[key] === 0) {
      delete attr[key];
    }
  }
  return attr;
}

/** 生成 emoji 展示串，如 '💪+10 😊-5'；无变化时返回空串 */
function toEffectsString(attr) {
  return ATTR_ORDER
    .filter(k => attr[k] !== undefined)
    .map(k => `${ATTR_ICON[k]}${attr[k] > 0 ? '+' : ''}${attr[k]}`)
    .join(' ');
}

/** 转换 conditions：snake_case → camelCase，属性键走映射表；取反键出现在条件中直接抛错 */
function mapConditions(conditions, eventId) {
  if (!conditions) {
    return undefined;
  }
  const out = {};
  if (conditions.has_flags) {
    out.hasFlags = conditions.has_flags;
  }
  if (conditions.not_flags) {
    out.notFlags = conditions.not_flags;
  }
  for (const [srcKey, destKey] of [['min_attrs', 'minAttrs'], ['max_attrs', 'maxAttrs']]) {
    const src = conditions[srcKey];
    if (!src) {
      continue;
    }
    out[destKey] = {};
    for (const [key, value] of Object.entries(src)) {
      if (INVERSE.has(key)) {
        throw new Error(`inverse attr "${key}" in conditions of event ${eventId}`);
      }
      const target = ATTR_MAP[key];
      if (!target) {
        throw new Error(`unmapped attr "${key}" in conditions of event ${eventId}`);
      }
      out[destKey][target] = value;
    }
  }
  return out;
}

/** 校验原始事件结构，缺字段抛错 */
function validateRaw(raw) {
  const missing = [];
  if (typeof raw.id !== 'string' || !raw.id) {
    missing.push('id');
  }
  if (!Array.isArray(raw.age_range) || raw.age_range.length !== 2
      || raw.age_range.some(n => typeof n !== 'number') || raw.age_range[0] > raw.age_range[1]) {
    missing.push('age_range');
  }
  if (typeof raw.title !== 'string' || !raw.title) {
    missing.push('title');
  }
  if (typeof raw.text !== 'string' || !raw.text) {
    missing.push('text');
  }
  if (!Array.isArray(raw.choices) || raw.choices.length === 0) {
    missing.push('choices');
  }
  if (missing.length > 0) {
    throw new Error(`invalid event ${raw.id ?? '(no id)'}: ${missing.join(', ')}`);
  }
}

/**
 * 事件 id 规则校验：2 位数字后缀 = 主线（永远保留），4 位数字后缀 = 模拟（可精选删除），其余非法。
 *
 * @param id 事件 id
 * @return 合规返回 true，否则 false
 */
export function isValidEventId(id) {
  return /_\d{2}$/.test(id) || /_\d{4}$/.test(id);
}

/** 转换单个事件为引擎 LifeEvent 形状 */
export function convertEvent(raw) {
  validateRaw(raw);
  const event = {
    id: raw.id,
    stage: stageForAge(raw.age_range[0]),
    age: raw.age_range[0],
    title: raw.title,
    text: raw.text,
    category: raw.category,
    choices: raw.choices.map(c => {
      const attr = mapEffects(c.effects ?? {}, raw.id);
      const choice = { text: c.text, effects: toEffectsString(attr), outcomes: { attr } };
      if (Array.isArray(c.flags_add) && c.flags_add.length > 0) {
        choice.outcomes.flags = c.flags_add;
      }
      return choice;
    }),
  };
  const conditions = mapConditions(raw.conditions, raw.id);
  if (conditions) {
    event.conditions = conditions;
  }
  return event;
}

/** 全量转换入口，重复 id 或非法 id 抛错 */
export function convertAll(rawEvents) {
  const ids = new Set();
  return rawEvents.map(raw => {
    if (ids.has(raw.id)) {
      throw new Error(`duplicate id "${raw.id}"`);
    }
    // 事件 id 规则：2 位数字后缀 = 主线（永远保留），4 位数字后缀 = 模拟（可精选删除），其余非法
    if (!isValidEventId(raw.id)) {
      throw new Error(`非法事件 id（需 2 位主线或 4 位模拟后缀）: ${raw.id}`);
    }
    ids.add(raw.id);
    return convertEvent(raw);
  });
}

function main() {
  const raw = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const events = convertAll(raw);
  // 产物输出到 public/：运行时 fetch 加载（避免 586KB 数据内联进单文件 bundle），SW precache 保离线
  // 无缩进压缩输出（运行时数据无需人类可读）
  writeFileSync(new URL('../public/events.json', import.meta.url), JSON.stringify(events), 'utf8');
  const byStage = {};
  for (const e of events) {
    byStage[e.stage] = (byStage[e.stage] ?? 0) + 1;
  }
  console.log(`✅ 转换 ${events.length} 个事件 → public/events.json`);
  console.log('stage 分布:', JSON.stringify(byStage));
}

// 作为脚本直接运行时执行；被测试 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
