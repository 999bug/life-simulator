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
  elder: { label: '晚年', range: [65, 90] },
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
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

/** 应用选项结果，返回新属性 */
export function applyOutcomes(
  attrs: Attributes,
  out: { attr: Partial<Attributes> },
): Attributes {
  const next = { ...attrs };
  for (const [k, v] of Object.entries(out.attr)) {
    next[k as AttributeKey] = Math.round(clamp(next[k as AttributeKey] + v, 0, 100));
  }
  return next;
}

/** 老年健康衰减 */
export function applyElderDecay(attrs: Attributes): Attributes {
  return {
    ...attrs,
    health: Math.round(clamp(attrs.health - 3 + attrs.luck / 60, 0, 100)),
  };
}

/** 根据年龄推断阶段 */
export function getStageForAge(age: number): LifeStage {
  for (const stage of STAGE_ORDER) {
    const [lo, hi] = STAGE_META[stage].range;
    if (age >= lo && age <= hi) return stage;
  }
  return 'elder';
}

/** 检查是否死亡 */
export function checkDeath(age: number, health: number): boolean {
  return health <= 0 || age >= 90;
}

/** 计算综合评分 */
export function calcScore(attrs: Attributes): number {
  const vals = Object.values(attrs);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
