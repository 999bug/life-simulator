import type { Attributes, AttributeKey, AttributeMeta, GameState, LifeStage, StageMeta } from '../types/index.ts';

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

/**
 * 属性成长上限：属性达到上限后正向收益不再生效，防止数值通胀到满值。
 * 各属性上限不同（魅力/运气受先天与偶然性限制，财富最可积累）。
 */
export const ATTR_CAP: Record<AttributeKey, number> = {
  health: 90,
  intelligence: 92,
  wealth: 95,
  happiness: 90,
  social: 88,
  appearance: 80,
  luck: 75,
  morality: 88,
};

/** 距成长上限的过渡带：此距离内的正向收益线性递减 */
const CAP_TAPER = 15;

/**
 * 计算属性增量的实际生效值。
 *
 * 正向收益按距离成长上限的余量线性递减（过渡带内逐渐归零），
 * 且单次增量不超过剩余空间，属性永不越过上限。
 * 负向惩罚全额生效。过渡带内的正向收益至少生效 1 点。
 *
 * @param key 属性键
 * @param delta 数据表增量
 * @param attrs 当前属性表
 * @returns 实际生效增量
 */
export function effectiveDelta(key: AttributeKey, delta: number, attrs: Attributes): number {
  if (delta <= 0) {
    return delta;
  }
  const room = ATTR_CAP[key] - (attrs[key] ?? 0);
  if (room <= 0) {
    return 0;
  }
  const tapered = Math.round(delta * Math.min(1, room / CAP_TAPER));
  return Math.max(1, Math.min(room, tapered));
}

/** 应用选项结果，返回新属性。保证整数。 */
export function applyOutcomes(
  attrs: Attributes,
  out: { attr: Partial<Attributes> },
): Attributes {
  const next = { ...attrs };
  for (const [k, v] of Object.entries(out.attr)) {
    const key = k as AttributeKey;
    // 收益递减：按当前值折算实际增量
    const delta = effectiveDelta(key, v, attrs);
    next[key] = Math.round(
      Math.max(0, Math.min(100, next[key] + delta)),
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
  // 运气减免下限 0：运气足够好时老年不掉血，但不会反向回血
  const decay = Math.max(0, Math.round(3 - attrs.luck / 20));
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
