#!/usr/bin/env node
/**
 * sim-balance.ts：全属性平衡审计（一次性工具，跑完即弃）。
 *
 * 忠实复刻 useGame 的 MAKE_CHOICE 主流程（引擎函数直接 import，条件判断就地复刻）：
 * 开局 INITIAL_ATTRS → 洗牌 → 线性播放（随机选项）→ 应用效果（含年龄上限折算）
 * → 65 岁起 elder decay → checkDeath（健康归零/超寿命）→ 结局判定。
 *
 * 输出：8 属性归零率（曾触 0 / 终局为 0）/中位数、享年分布与早死率、结局路线分布。
 * 运行：node --experimental-strip-types script/sim-balance.ts [局数]
 */
import EVENTS, { shuffleEvents, filterEvents } from '../src/engine/events.ts';
import { applyOutcomes, applyElderDecay, calcMaxAge, checkDeath, createInitialState } from '../src/engine/state.ts';
import { verdictKey } from '../src/engine/verdict.ts';

/** mulberry32（与引擎同算法）：选项随机与洗牌随机分离，互不干扰 */
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

/** checkConditions 的就地复刻（与 useGame.ts 一致：hasFlags/notFlags/minAttrs/maxAttrs） */
function checkConditions(e: any, flags: string[], attrs: Record<string, number>): boolean {
  const c = e.conditions;
  if (!c) {
    return true;
  }
  for (const f of c.hasFlags ?? []) {
    if (!flags.includes(f)) {
      return false;
    }
  }
  for (const f of c.notFlags ?? []) {
    if (flags.includes(f)) {
      return false;
    }
  }
  for (const [k, v] of Object.entries(c.minAttrs ?? {})) {
    if ((attrs[k] ?? 0) < (v as number)) {
      return false;
    }
  }
  for (const [k, v] of Object.entries(c.maxAttrs ?? {})) {
    if ((attrs[k] ?? 0) > (v as number)) {
      return false;
    }
  }
  return true;
}

const ATTR_KEYS = ['health', 'intelligence', 'wealth', 'happiness', 'social', 'appearance', 'luck', 'morality'];
const N = Number(process.argv[2] ?? 500);

interface GameResult {
  age: number;
  cause: 'health' | 'lifespan';
  verdict: string;
  endAttrs: Record<string, number>;
  minAttrs: Record<string, number>;
}

function playOne(seed: number): GameResult {
  const game = createInitialState('male', '模拟');
  let attrs = game.attributes;
  let flags: string[] = [];
  const events = shuffleEvents(filterEvents(EVENTS, 'full', seed), seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const minAttrs: Record<string, number> = { ...attrs };

  let idx = -1;
  let age = 0;
  // 首事件
  let next = null;
  for (let i = 0; i < events.length; i++) {
    if (checkConditions(events[i], flags, attrs)) {
      next = events[i];
      idx = i;
      break;
    }
  }
  let cause: 'health' | 'lifespan' = 'lifespan';

  while (next !== null) {
    const cur = next;
    age = cur.age;
    const choice = cur.choices[Math.floor(rng() * cur.choices.length)];
    attrs = applyOutcomes(attrs, choice.outcomes, age);
    for (const f of choice.outcomes.flags ?? []) {
      if (!flags.includes(f)) {
        flags.push(f);
      }
    }
    // 找下一事件
    let nxt = null;
    for (let i = idx + 1; i < events.length; i++) {
      if (checkConditions(events[i], flags, attrs)) {
        nxt = events[i];
        idx = i;
        break;
      }
    }
    const nextAge = nxt ? nxt.age : age;
    if (nextAge >= 65) {
      attrs = applyElderDecay(attrs);
    }
    for (const k of ATTR_KEYS) {
      minAttrs[k] = Math.min(minAttrs[k], attrs[k as keyof typeof attrs]);
    }
    const maxAge = calcMaxAge(attrs);
    const isDead = nxt !== null && checkDeath(nextAge, attrs.health, maxAge);
    if (isDead) {
      age = Math.min(nextAge, maxAge);
      cause = attrs.health <= 0 ? 'health' : 'lifespan';
      break;
    }
    if (nxt === null) {
      age = nextAge;
      cause = 'lifespan';
      break;
    }
    age = nextAge;
    next = nxt;
  }

  const verdict = verdictKey({ flags, attributes: attrs } as any);
  return { age, cause, verdict, endAttrs: { ...attrs }, minAttrs };
}

const results: GameResult[] = [];
for (let i = 0; i < N; i++) {
  results.push(playOne(i + 1));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

console.log(`\n🎲 ${N} 局随机模拟（沉浸档全量事件）\n`);

console.log('📊 属性健康度（曾触 0 率 / 终局为 0 率 / 终局中位数）');
for (const k of ATTR_KEYS) {
  const everZero = results.filter(r => r.minAttrs[k] <= 0).length;
  const endZero = results.filter(r => r.endAttrs[k] <= 0).length;
  const med = median(results.map(r => r.endAttrs[k]));
  console.log(`  ${k.padEnd(13)} 曾触0 ${(everZero / N * 100).toFixed(1).padStart(5)}%   终局0 ${(endZero / N * 100).toFixed(1).padStart(5)}%   中位 ${med}`);
}

console.log('\n⚰️ 享年与死因');
const ages = results.map(r => r.age);
const healthDeaths = results.filter(r => r.cause === 'health');
console.log(`  平均享年 ${(ages.reduce((a, b) => a + b, 0) / N).toFixed(1)} / 中位 ${median(ages)} / 最小 ${Math.min(...ages)} / 最大 ${Math.max(...ages)}`);
console.log(`  健康归零早死 ${healthDeaths.length} 局（${(healthDeaths.length / N * 100).toFixed(1)}%），其中 <40 岁 ${healthDeaths.filter(r => r.age < 40).length} 局、<60 岁 ${healthDeaths.filter(r => r.age < 60).length} 局`);
const buckets = [[0, 18], [19, 40], [41, 60], [61, 68], [69, 80], [81, 95], [96, 103]];
console.log('  享年分布：' + buckets.map(([lo, hi]) => `${lo}-${hi}:${results.filter(r => r.age >= lo && r.age <= hi).length}`).join('  '));

console.log('\n🏁 结局路线分布');
const verdicts = new Map<string, number>();
for (const r of results) {
  verdicts.set(r.verdict, (verdicts.get(r.verdict) ?? 0) + 1);
}
for (const [k, v] of [...verdicts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${String(v).padStart(4)}（${(v / N * 100).toFixed(1)}%）`);
}
