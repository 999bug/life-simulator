import type { Attributes, AttributeKey, AttributeMeta, GameState, LifeStage, StageMeta } from '../types';

/** 属性元数据 */
export const ATTR_META: Record<AttributeKey, AttributeMeta> = {
  health: { name: '健康', icon: '💪', color: '#e85d75' },
  intelligence: { name: '智力', icon: '🧠', color: '#5d9ce8' },
  wealth: { name: '财富', icon: '💰', color: '#e8c95d' },
  happiness: { name: '幸福', icon: '😊', color: '#5de8a0' },
  social: { name: '社交', icon: '👥', color: '#c95de8' },
  appearance: { name: '魅力', icon: '🎨', color: '#e85dbe' },
  luck: { name: '运气', icon: '🍀', color: '#5de8d4' },
  morality: { name: '道德', icon: '⚖️', color: '#e8e8e8' },
};

/** 阶段顺序 */
export const STAGE_ORDER: LifeStage[] = [
  'infant', 'childhood', 'teen', 'young_adult', 'adult', 'middle_age', 'elder',
];

/** 阶段元数据 */
export const STAGE_META: Record<LifeStage, StageMeta> = {
  infant: { label: '婴儿期', range: [0, 2] },
  childhood: { label: '童年', range: [3, 11] },
  teen: { label: '少年', range: [12, 17] },
  young_adult: { label: '青年', range: [18, 29] },
  adult: { label: '中年', range: [30, 49] },
  middle_age: { label: '中老年', range: [50, 64] },
  elder: { label: '晚年', range: [65, 95] },
};

/** 初始属性 */
const INITIAL_ATTRS: Attributes = {
  health: 80,
  intelligence: 30,
  wealth: 20,
  happiness: 70,
  social: 20,
  appearance: 50,
  luck: 50,
  morality: 50,
};

/** 确保所有属性为整数 */
function ensureInt(attrs: Attributes): Attributes {
  const out = { ...attrs };
  for (const k of Object.keys(out) as AttributeKey[]) {
    out[k] = Math.round(out[k]);
  }
  return out;
}

/** 创建初始状态 */
export function createInitialState(gender: 'male' | 'female', name: string): GameState {
  return {
    gender,
    name,
    age: 0,
    stage: 'infant',
    stageIdx: 0,
    attributes: { ...INITIAL_ATTRS },
    flags: [],
    history: [],
    phase: 'playing',
  };
}

/** 应用选项结果，返回新属性。保证整数。 */
export function applyOutcomes(
  attrs: Attributes,
  out: { attr: Partial<Attributes> },
): Attributes {
  const next = { ...attrs };
  for (const [k, v] of Object.entries(out.attr)) {
    next[k as AttributeKey] = Math.round(
      Math.max(0, Math.min(100, next[k as AttributeKey] + v)),
    );
  }
  return next;
}

/**
 * 计算剩余寿命上限。
 *
 * 基础寿命 70 岁。
 * 终生平均健康每 5 点 +1 岁 → 健康 100 可活到 90，健康 30 只能到 76。
 */
export function calcMaxAge(attrs: Attributes): number {
  const avgHealth = Object.values(attrs).reduce((a, b) => a + b, 0) / Object.keys(attrs).length;
  // 基础 68 + 健康红利（最多 +22 = 90）
  return Math.round(68 + (avgHealth / 100) * 22);
}

/**
 * 晚年健康衰减。
 *
 * 基础每事件 -3。
 * 运气每 20 点减免 1 点衰减。
 * 保证结果为整数。
 */
export function applyElderDecay(attrs: Attributes): Attributes {
  const decay = Math.round(3 - attrs.luck / 20);
  const nextHealth = Math.round(
    Math.max(0, Math.min(100, attrs.health - decay)),
  );
  return { ...attrs, health: nextHealth };
}

/** 根据年龄推断阶段 */
export function getStageForAge(age: number): LifeStage {
  for (const stage of STAGE_ORDER) {
    const [lo, hi] = STAGE_META[stage].range;
    if (age >= lo && age <= hi) return stage;
  }
  return 'elder';
}

/**
 * 检查是否死亡。
 *
 * 健康归零 → 死亡。
 * 超过个人最大寿命 → 死亡。
 */
export function checkDeath(age: number, health: number, maxAge: number): boolean {
  return health <= 0 || age >= maxAge;
}

/** 计算综合评分 */
export function calcScore(attrs: Attributes): number {
  const vals = Object.values(attrs);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** 给属性做最终整数保护 */
export { ensureInt };
