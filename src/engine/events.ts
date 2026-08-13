import type { LifeEvent, PaceMode } from '../types';

/**
 * 全部人生事件（运行时异步加载，见 loadEvents）。
 * 数据由 script/convert-events.mjs 从 script/chiled.json 生成到 public/events.json，
 * 请勿手改；修改事件请编辑 script/chiled.json 后运行 npm run build:events。
 *
 * 拆分运行时的原因：752 个事件约 678KB，内联进单文件 bundle 会拖慢首屏解析；
 * public/ 独立文件由 SW precache 保障离线可用，且数据与代码可独立缓存。
 *
 * 播放机制：
 * - 线性按数组顺序推进，conditions 不满足的事件跳过
 * - 年龄由事件自身 age 驱动（同一岁的多个事件连续触发）
 */
// named export 是 live binding：loadEvents/setEvents 赋值后 import 方可见新值
export let EVENTS: LifeEvent[] = [];

/** 测试/脚本注入事件数据（node 环境无 fetch，直接读 public/events.json 注入） */
export function setEvents(list: LifeEvent[]): void {
  EVENTS = list;
}

/**
 * 运行时加载事件数据（应用入口 await 后才 render）。
 * 幂等：已加载/已注入时直接返回。
 */
export async function loadEvents(): Promise<LifeEvent[]> {
  if (EVENTS.length === 0) {
    const res = await fetch('events.json');
    if (!res.ok) {
      throw new Error(`Failed to load events.json: HTTP ${res.status}`);
    }
    setEvents(await res.json() as LifeEvent[]);
  }
  return EVENTS;
}

/** mulberry32 伪随机数生成器：同一种子产生相同洗牌结果（存档恢复用） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 修正同岁组内 flag 依赖：把消费 flag 的事件移到产出者之后。
 * 洗牌会打乱组内顺序，若不修正，has_flags 事件可能排在产出者前成为死事件。
 *
 * @param group 同岁事件组（原地重排）
 */
function fixFlagOrder(group: LifeEvent[]): LifeEvent[] {
  // 组内 flag → 产出事件 映射
  const producerMap = new Map<string, LifeEvent[]>();
  for (const e of group) {
    const flags = e.choices.flatMap(c => c.outcomes?.flags ?? []);
    for (const f of flags) {
      const list = producerMap.get(f) ?? [];
      list.push(e);
      producerMap.set(f, list);
    }
  }
  const result = [...group];
  for (const e of group) {
    const needs = e.conditions?.hasFlags ?? [];
    if (needs.length === 0) {
      continue;
    }
    const current = result.indexOf(e);
    // 找出需要排在它前面的最近产出者位置
    let lastProducer = -1;
    for (const f of needs) {
      for (const p of producerMap.get(f) ?? []) {
        if (p !== e) {
          lastProducer = Math.max(lastProducer, result.indexOf(p));
        }
      }
    }
    if (lastProducer > current) {
      result.splice(current, 1);
      result.splice(lastProducer, 0, e);
    }
  }
  return result;
}

/**
 * 同岁组内洗牌 + flag 依赖修正。
 * 同一局内顺序保持稳定（线性播放），换种子（重开一局）顺序不同，提升重玩性。
 *
 * @param events 全量事件数组
 * @param seed 洗牌种子（存档恢复时传回原种子还原顺序）
 * @returns 洗牌后的新数组
 */
export function shuffleEvents(events: LifeEvent[], seed: number): LifeEvent[] {
  const rng = mulberry32(seed);
  const byAge = new Map<number, LifeEvent[]>();
  for (const e of events) {
    const list = byAge.get(e.age) ?? [];
    list.push(e);
    byAge.set(e.age, list);
  }
  const out: LifeEvent[] = [];
  for (const age of [...byAge.keys()].sort((a, b) => a - b)) {
    const group = [...byAge.get(age)!];
    // Fisher-Yates 洗牌
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    out.push(...fixFlagOrder(group));
  }
  return out;
}

/** 主线事件：2 位数字后缀 id（如 child_01），模拟事件为 4 位（如 child_0017） */
export function isMainlineEvent(id: string): boolean {
  return /_\d{2}$/.test(id);
}

/**
 * 精简模式每岁目标密度：0-2 岁全保留；3-12 岁 2 个；13 岁以上 1 个。
 */
function liteTarget(age: number): number {
  if (age <= 2) {
    return Infinity;
  }
  if (age <= 12) {
    return 2;
  }
  return 1;
}

/**
 * 从数组中按种子抽取 k 个（保持原顺序），k <= 0 或空数组返回空。
 */
function pickShuffled<T>(arr: T[], k: number, rng: () => number): T[] {
  const n = Math.min(k, arr.length);
  if (n <= 0) {
    return [];
  }
  const idx = new Set<number>();
  while (idx.size < n) {
    idx.add(Math.floor(rng() * arr.length));
  }
  return [...idx].sort((a, b) => a - b).map(i => arr[i]);
}

/**
 * 从种子 flag 沿「事件消费 → 事件生产」正向展开，得到该人生路线涉及的全部 flag。
 * 用于精简档保留路线事件：这些 flag 的消费/生产事件必须全部保留，否则选定路线会「隐身」。
 */
function expandRouteFlags(events: LifeEvent[], seeds: string[]): Set<string> {
  const flags = new Set(seeds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of events) {
      const consume = e.conditions?.hasFlags ?? [];
      if (!consume.some(f => flags.has(f))) {
        continue;
      }
      for (const f of e.choices.flatMap(c => c.outcomes?.flags ?? [])) {
        if (!flags.has(f)) {
          flags.add(f);
          changed = true;
        }
      }
    }
  }
  return flags;
}

/**
 * 按档位过滤事件（纯函数，确定性）。
 * full 返回原数组；lite 每岁主线优先 + seed 抽模拟补足目标密度，
 * 再跨岁迭代补齐 flag 闭包（消费事件的产出者必须在子集内）。
 * routeFlags 为开局人生路线涉及的 flag（精简档下这些事件不参与抽样，全部保留）。
 *
 * @param events 全量事件数组
 * @param mode 节奏档位
 * @param seed 抽样种子（与 shuffleEvents 共用，保证读档可重建）
 * @param routeFlags 人生路线 seed flag（可选）
 * @returns 过滤后的新数组
 */
export function filterEvents(events: LifeEvent[], mode: PaceMode, seed: number, routeFlags: string[] = []): LifeEvent[] {
  if (mode === 'full') {
    return events;
  }
  const rng = mulberry32(seed);
  const byAge = new Map<number, LifeEvent[]>();
  for (const e of events) {
    const list = byAge.get(e.age) ?? [];
    list.push(e);
    byAge.set(e.age, list);
  }

  // 1. 每岁：性格事件优先保留（条件触发彩蛋，不满足条件即跳过，不占播放密度）
  //    + 主线优先 + 模拟事件按种子抽样补足目标密度
  const selected = new Set<LifeEvent>();
  for (const age of [...byAge.keys()].sort((a, b) => a - b)) {
    const group = byAge.get(age)!;
    const target = liteTarget(age);
    const personality = group.filter(e => e.conditions?.minPersonality);
    const mainline = group.filter(e => isMainlineEvent(e.id));
    const sims = group.filter(e => !isMainlineEvent(e.id) && !e.conditions?.minPersonality);
    const keptMain = mainline.length <= target ? mainline : pickShuffled(mainline, target, rng);
    const keptSim = pickShuffled(sims, target - keptMain.length, rng);
    for (const e of [...personality, ...keptMain, ...keptSim]) {
      selected.add(e);
    }
  }

  // 1.5 路线事件全保留（不占密度）：消费/生产路线 flag 的事件必须都在，保证选定人生路线在精简档也能体验
  if (routeFlags.length > 0) {
    const routeSet = expandRouteFlags(events, routeFlags);
    for (const e of events) {
      const consume = e.conditions?.hasFlags ?? [];
      const produce = e.choices.flatMap(c => c.outcomes?.flags ?? []);
      if (consume.some(f => routeSet.has(f)) || produce.some(f => routeSet.has(f))) {
        selected.add(e);
      }
    }
  }

  // 2. flag 闭包：消费事件的产出者必须也在子集内（跨岁回溯，产出者列表按岁升序）
  const producers = new Map<string, LifeEvent[]>();
  for (const e of events) {
    const flags = e.choices.flatMap(c => c.outcomes?.flags ?? []);
    for (const f of flags) {
      const list = producers.get(f) ?? [];
      list.push(e);
      producers.set(f, list);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of [...selected]) {
      for (const f of e.conditions?.hasFlags ?? []) {
        const candidates = (producers.get(f) ?? []).filter(p => p !== e);
        if (candidates.length > 0 && !candidates.some(p => selected.has(p))) {
          selected.add(candidates[0]);
          changed = true;
        }
      }
    }
  }

  return events.filter(e => selected.has(e));
}

/**
 * 命运事件池（第 3 周目解锁）：从全库精选的「命运级」大事件，
 * 每局按种子抽 1 个作为本局命运事件（效果 ×1.5）。
 */
export const RARE_EVENT_IDS = [
  'birth_01', 'child_02', 'teen_34', 'teen_36',
  'young_02', 'young_65', 'young_72', 'young_29',
  'young_11', 'young_13', 'young_17', 'young_58',
  'adult_57', 'adult_80', 'elder_09',
];

/** 命运事件池：从全量事件库解析（池内事件缺失时跳过） */
function fatePool(): LifeEvent[] {
  return RARE_EVENT_IDS
    .map(id => EVENTS.find(e => e.id === id))
    .filter((e): e is LifeEvent => e !== undefined);
}

/**
 * 按种子从命运事件池抽 1 个（确定性，存档可还原）。
 *
 * @param seed 洗牌种子（与 shuffleEvents 共用，保证读档可重建）
 * @returns 抽中的命运事件；池内事件不在全量事件库时返回 null
 */
export function pickFateEvent(seed: number): LifeEvent | null {
  const pool = fatePool();
  if (pool.length === 0) {
    return null;
  }
  const rng = mulberry32(seed);
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * 按种子从命运事件池抽 count 个不重复（确定性，存档可还原）。
 * 第一个抽取与 pickFateEvent 同源（同一 rng 序列），旧种子行为不变。
 *
 * @param seed 洗牌种子（与 shuffleEvents 共用，保证读档可重建）
 * @param count 抽取数量（超过池大小时取满池）
 * @returns 抽中的命运事件数组；池内事件不在全量事件库时返回空数组
 */
export function pickFateEvents(seed: number, count: number): LifeEvent[] {
  const pool = fatePool();
  if (pool.length === 0) {
    return [];
  }
  const rng = mulberry32(seed);
  const picked: LifeEvent[] = [];
  const used = new Set<LifeEvent>();
  // 去重抽取，循环上限防极端情况死循环
  while (picked.length < count && used.size < pool.length) {
    const e = pool[Math.floor(rng() * pool.length)];
    if (!used.has(e)) {
      used.add(e);
      picked.push(e);
    }
  }
  return picked;
}
