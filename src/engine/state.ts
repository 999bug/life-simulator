import type { AttrSnapshot, Attributes, AttributeKey, AttributeMeta, GameState, LifeStage, StageMeta, TypeSpeed } from '../types/index.ts';

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

/**
 * 初始属性。
 * 刻意偏低，为童年成长留出空间（健康 65 / 智力 25 起步，随事件逐渐成长）。
 */
const INITIAL_ATTRS: Attributes = {
  health: 65,
  intelligence: 25,
  wealth: 20,
  happiness: 60,
  social: 25,
  appearance: 45,
  luck: 50,
  morality: 45,
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
    deathCause: null,
    goal: null,
  };
}

/**
 * 年龄锚点成长上限表：属性在对应年龄只能成长到该值，之后正向收益失效。
 * 锚点之间线性插值，形成"童年偏低 → 中年封顶 → 老年缓降"的渐进曲线，
 * 防止事件供给过剩导致属性低龄封顶。上限为 100 的属性不受年龄限制。
 *
 * 取值依据：童年成长最快但绝对水平低，中年达到一生峰值，老年缓慢回落
 * （健康由 applyElderDecay 承担回落，此处锚点同步下调作为软约束）。
 */
const CAP_ANCHORS: Record<AttributeKey, ReadonlyArray<[number, number]>> = {
  health: [[7, 75], [12, 80], [18, 85], [30, 90], [50, 90], [65, 85]],
  intelligence: [[7, 55], [12, 72], [18, 85], [30, 92], [50, 92], [65, 88]],
  wealth: [[7, 30], [12, 45], [18, 65], [30, 85], [50, 95]],
  happiness: [[7, 75], [18, 88], [30, 90]],
  social: [[7, 55], [12, 70], [18, 80], [30, 88], [50, 88], [65, 85]],
  appearance: [[7, 60], [12, 68], [18, 75], [30, 80], [50, 80], [65, 78]],
  luck: [[0, 75]],
  morality: [[7, 55], [12, 70], [18, 80], [30, 88], [50, 88], [65, 88]],
};

/** 距成长上限的过渡带：此距离内的正向收益线性递减 */
const CAP_TAPER = 15;

/**
 * 计算属性在指定年龄的成长上限（锚点线性插值）。
 *
 * @param age 当前年龄
 * @param key 属性键
 * @returns 该年龄的成长上限
 */
export function ageCap(age: number, key: AttributeKey): number {
  const points = CAP_ANCHORS[key];
  if (age <= points[0][0]) {
    return points[0][1];
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [a1, c1] = points[i];
    const [a2, c2] = points[i + 1];
    if (age <= a2) {
      return Math.round(c1 + ((c2 - c1) * (age - a1)) / (a2 - a1));
    }
  }
  return points[points.length - 1][1];
}

/**
 * 计算属性增量的实际生效值。
 *
 * 正向收益按距离年龄成长上限的余量线性递减（过渡带内逐渐归零），
 * 且单次增量不超过剩余空间，属性永不越过上限。
 * 负向惩罚全额生效。过渡带内的正向收益至少生效 1 点。
 *
 * @param key 属性键
 * @param delta 数据表增量
 * @param attrs 当前属性表
 * @param age 当前年龄（决定成长上限）
 * @returns 实际生效增量
 */
export function effectiveDelta(key: AttributeKey, delta: number, attrs: Attributes, age: number): number {
  if (delta <= 0) {
    return delta;
  }
  const room = ageCap(age, key) - (attrs[key] ?? 0);
  if (room <= 0) {
    return 0;
  }
  const tapered = Math.round(delta * Math.min(1, room / CAP_TAPER));
  return Math.max(1, Math.min(room, tapered));
}

/**
 * 应用选项结果，返回新属性。保证整数。
 *
 * @param attrs 当前属性表
 * @param out 选项结果
 * @param age 当前年龄（决定成长上限）
 */
export function applyOutcomes(
  attrs: Attributes,
  out: { attr: Partial<Attributes> },
  age: number,
): Attributes {
  const next = { ...attrs };
  for (const [k, v] of Object.entries(out.attr)) {
    const key = k as AttributeKey;
    // 收益递减：按当前值与年龄上限折算实际增量
    const delta = effectiveDelta(key, v, attrs, age);
    next[key] = Math.round(
      Math.max(0, Math.min(100, next[key] + delta)),
    );
  }
  return next;
}

/**
 * 追加每岁属性快照（结算页成长曲线用）。
 *
 * 每岁只保留一个点：进入新岁或终局时记录当前属性；
 * 同岁内继续事件不重复记录；终局与同岁已有记录时替换该岁条目（保留最终状态）。
 *
 * @param prev 已有快照（旧存档可能为 undefined）
 * @param age 当前（新）年龄
 * @param attrs 当前属性表
 * @param gameOver 是否终局（死亡或事件播完）
 * @returns 追加/替换后的快照数组
 */
export function appendSnapshot(
  prev: AttrSnapshot[] | undefined,
  age: number,
  attrs: Attributes,
  gameOver: boolean,
): AttrSnapshot[] {
  const snapshots = prev ?? [];
  const last = snapshots[snapshots.length - 1];
  // 同岁已记录且非终局：不重复记录
  if (last && last.age === age && !gameOver) {
    return snapshots;
  }
  // 同岁终局：替换该岁条目；新岁：追加
  const base = last && last.age === age ? snapshots.slice(0, -1) : snapshots;
  return [...base, { age, attrs }];
}

/**
 * 挑战开局：属性整体下调 10 点（钳位 0-100），第 2 周目解锁。
 *
 * @param attrs 初始属性表
 * @returns 下调后的属性表
 */
export function applyChallenge(attrs: Attributes): Attributes {
  const out = { ...attrs };
  for (const k of Object.keys(out) as AttributeKey[]) {
    out[k] = Math.max(0, out[k] - 10);
  }
  return out;
}

/**
 * 命运事件效果放大：每键 × factor 后四舍五入。
 *
 * @param out 选项结果
 * @param factor 放大倍数（命运事件为 1.5）
 * @returns 放大后的新结果（不修改原对象）
 */
export function scaleOutcomes(
  out: { attr: Partial<Attributes>; flags?: string[] },
  factor: number,
): { attr: Partial<Attributes>; flags?: string[] } {
  const attr: Partial<Attributes> = {};
  for (const [k, v] of Object.entries(out.attr)) {
    attr[k as AttributeKey] = Math.round(v * factor);
  }
  return { attr, flags: out.flags };
}

/**
 * 计算剩余寿命上限。
 *
 * 基础 68 + 平均属性健康红利（红利最多 +35 = 103）；
 * 均衡属性 ≥ 77 时可活到 95 岁，为 91-95 岁事件与「ultra_life」成就打开可达空间。
 */
export function calcMaxAge(attrs: Attributes): number {
  const avgHealth = Object.values(attrs).reduce((a, b) => a + b, 0) / Object.keys(attrs).length;
  // 基础 68 + 健康红利（最多 +35 = 103，均衡属性 ≥ 77 时可达 95 岁）
  return Math.round(68 + (avgHealth / 100) * 35);
}

/**
 * 晚年健康衰减。
 *
 * 基础每事件 -3。
 * 运气每 20 点减免 1 点衰减，下限 1：运气再好老年机能也在衰退。
 * 保证结果为整数。
 */
export function applyElderDecay(attrs: Attributes): Attributes {
  // 下限 1：运气足够好时每事件只掉 1 点，但不会回血也不会不掉
  const decay = Math.max(1, Math.round(3 - attrs.luck / 20));
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

/** 打字机速度档 → 每字符间隔毫秒范围 */
export const TYPE_SPEED_RANGES: Record<TypeSpeed, [number, number]> = {
  slow: [50, 70],
  normal: [25, 45],
  fast: [8, 15],
};
