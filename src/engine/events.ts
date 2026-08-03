import type { LifeEvent } from '../types';
import eventsJson from './events.json' with { type: 'json' };

/**
 * 全部人生事件。
 * 由 script/convert-events.mjs 从 script/chiled.json 生成，数据请勿手改；
 * 修改事件请编辑 script/chiled.json 后运行 npm run build:events。
 *
 * 播放机制：
 * - 线性按数组顺序推进，conditions 不满足的事件跳过
 * - 年龄由事件自身 age 驱动（同一岁的多个事件连续触发）
 */
const EVENTS = eventsJson as unknown as LifeEvent[];

/** mulberry32 伪随机数生成器：同一种子产生相同洗牌结果（存档恢复用） */
function mulberry32(seed: number): () => number {
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

export default EVENTS;
