#!/usr/bin/env node
/**
 * sim-advanced.ts：扩展平衡审计（一次性工具，跑完即弃）。
 *
 * 在 sim-balance.ts 骨架（忠实复刻 useGame 的 MAKE_CHOICE 主流程）之上加入
 * 今日新增系统，跑 500 局双模式对比：
 *
 * 模式 A（活跃玩家）：每岁随机做 0-2 个主动行为（ACTIVITIES 26 个活动池，
 *   minAge/requires/requiresNot/requiresPersona 条件过滤，与 MAKE_ACTION 一致；
 *   犯罪走 rollCrime 专用分支，效果经 applyOutcomes）。
 * 模式 B（纯事件）：与 sim-balance 完全一致，作基准。
 *
 * 另跑家族底蕴 5 代连续家族模拟（每代终局属性 → 下一代表 deriveLegacy/applyLegacy），
 * 检查第 1 代 vs 第 5 代开局属性差异是否失控（设计封顶：最多 3 项各 +2 = +6）。
 *
 * 输出：属性健康度/享年/结局分布 A vs B 对照、犯罪活动统计、底蕴代际漂移。
 * 运行：node --experimental-strip-types script/sim-advanced.ts [局数]
 */
import { readFileSync } from 'node:fs';
import { EVENTS, setEvents, shuffleEvents, filterEvents } from '../src/engine/events.ts';
import { applyOutcomes, applyElderDecay, calcMaxAge, checkDeath, createInitialState, calcScore } from '../src/engine/state.ts';
import { verdictKey } from '../src/engine/verdict.ts';
import { derivePersona, meetsPersonality } from '../src/engine/personality.ts';
import { ACTIVITIES, CRIME_ACTIVITY_ID, rollCrime } from '../src/engine/activities.ts';
import { deriveLegacy, applyLegacy, legacyBonuses } from '../src/engine/legacy.ts';
import { personaBonds } from '../src/engine/personas.ts';
import type { Attributes, FamilyMember } from '../src/types/index.ts';

// 事件数据运行时拆分后，node 环境无 fetch，直接读 public/events.json 注入
setEvents(JSON.parse(readFileSync(new URL('../public/events.json', import.meta.url), 'utf8')));

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

/** checkConditions 的就地复刻（与 useGame.ts 一致：hasFlags/notFlags/minAttrs/maxAttrs/minPersonality） */
function checkConditions(e: any, flags: string[], attrs: Record<string, number>, history: any[]): boolean {
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
  if (c.minPersonality && !meetsPersonality(derivePersona(history), c.minPersonality)) {
    return false;
  }
  return true;
}

const ATTR_KEYS = ['health', 'intelligence', 'wealth', 'happiness', 'social', 'appearance', 'luck', 'morality'];
const ATTR_NAMES: Record<string, string> = {
  health: '健康', intelligence: '智力', wealth: '财富', happiness: '幸福',
  social: '社交', appearance: '魅力', luck: '运气', morality: '道德',
};
const N = Number(process.argv[2] ?? 500);

interface GameResult {
  age: number;
  cause: 'health' | 'lifespan';
  verdict: string;
  endAttrs: Record<string, number>;
  minAttrs: Record<string, number>;
}

/** 犯罪活动统计（模式 A 累计；结果池位置约定：前 3 个成功变体、末 2 个被抓/逃跑） */
const crimeStats = { attempts: 0, success: 0, caught: 0, fled: 0 };
/** 犯罪成功变体数量（与 activities.ts 的 CRIME_SUCCESS_VARIANTS 同步） */
const CRIME_SUCCESS_VARIANTS = 3;

/**
 * 模拟一局人生。
 *
 * @param seed 洗牌种子
 * @param active 是否活跃玩家模式（每岁做 0-2 个主动行为）
 * @param startAttrs 自定义开局属性（家族底蕴模拟用；缺省取引擎初始属性）
 */
function playOne(seed: number, active: boolean, startAttrs?: Attributes): GameResult {
  const game = createInitialState('male', '模拟');
  let attrs = startAttrs ? { ...startAttrs } : game.attributes;
  let flags: string[] = [];
  // 选择历史（性格条件推导用；只记录反查所需的 eventId/choiceIndex）
  const history: Array<{ eventId: string; choiceIndex: number }> = [];
  const events = shuffleEvents(filterEvents(EVENTS, 'full', seed), seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const minAttrs: Record<string, number> = { ...attrs };

  // 犯罪活动（结果池定位用）
  const crime = ACTIVITIES.find(a => a.id === CRIME_ACTIVITY_ID)!;

  /** 每岁 0-2 个主动行为（与 MAKE_ACTION 的条件过滤一致，不推进事件流、不写 history） */
  const doActivities = (age: number): void => {
    const n = Math.floor(rng() * 3);
    if (n === 0) {
      return;
    }
    const pool = [...ACTIVITIES];
    for (let k = 0; k < n && pool.length > 0; k++) {
      const idx = Math.floor(rng() * pool.length);
      const act = pool.splice(idx, 1)[0];
      if (age < act.minAge) {
        continue;
      }
      if (act.requires && !act.requires.some(f => flags.includes(f))) {
        continue;
      }
      if (act.requiresNot && act.requiresNot.some(f => flags.includes(f))) {
        continue;
      }
      // requiresPersona：任一人物已出场（好感 ≠ 50）即可用
      if (act.requiresPersona && act.requiresPersona.length > 0) {
        const bonds = personaBonds(history as any);
        if (!act.requiresPersona.some(p => (bonds as Record<string, number>)[p] !== 50)) {
          continue;
        }
      }
      // 犯罪走 rollCrime 专用分支（成功率判定），其余结果池随机（种子化，等价 pickActivityResult 分布）
      const result = act.id === CRIME_ACTIVITY_ID
        ? rollCrime(attrs.luck, attrs.intelligence, rng)
        : act.results[Math.floor(rng() * act.results.length)];
      if (act.id === CRIME_ACTIVITY_ID) {
        crimeStats.attempts++;
        const ri = crime.results.indexOf(result);
        if (ri >= 0 && ri < CRIME_SUCCESS_VARIANTS) {
          crimeStats.success++;
        } else if (result.flags?.includes('jailed')) {
          crimeStats.caught++;
        } else {
          crimeStats.fled++;
        }
      }
      // 属性应用（年龄决定成长上限；活动收益不享受天赋/传承等额外加成）
      attrs = applyOutcomes(attrs, result, age);
      // flags 追加（去重；活动级 flags 与结果变体 flags 同机制——被抓产 jailed、爆款产 viral）
      for (const fs of [act.flags, result.flags]) {
        if (fs) {
          for (const f of fs) {
            if (!flags.includes(f)) {
              flags.push(f);
            }
          }
        }
      }
    }
  };

  let idx = -1;
  let age = 0;
  // 首事件
  let next = null;
  for (let i = 0; i < events.length; i++) {
    if (checkConditions(events[i], flags, attrs, history)) {
      next = events[i];
      idx = i;
      break;
    }
  }
  let cause: 'health' | 'lifespan' = 'lifespan';
  let lastActivityAge = -1;

  while (next !== null) {
    const cur = next;
    age = cur.age;
    // 进入新岁时做一次活动机会（同一岁内不重复做）
    if (active && age !== lastActivityAge) {
      lastActivityAge = age;
      doActivities(age);
    }
    const choice = cur.choices[Math.floor(rng() * cur.choices.length)];
    history.push({ eventId: cur.id, choiceIndex: cur.choices.indexOf(choice) });
    attrs = applyOutcomes(attrs, choice.outcomes, age);
    for (const f of choice.outcomes.flags ?? []) {
      if (!flags.includes(f)) {
        flags.push(f);
      }
    }
    // 找下一事件
    let nxt = null;
    for (let i = idx + 1; i < events.length; i++) {
      if (checkConditions(events[i], flags, attrs, history)) {
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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// 模式 B（纯事件基准）先跑，再跑模式 A（活跃玩家），保证犯罪统计只累计 A 局
const resultsB: GameResult[] = [];
for (let i = 0; i < N; i++) {
  resultsB.push(playOne(i + 1, false));
}
const resultsA: GameResult[] = [];
for (let i = 0; i < N; i++) {
  resultsA.push(playOne(i + 1, true));
}

console.log(`\n🎲 扩展平衡审计 ${N} 局 × 2 模式（A=活跃玩家[每岁 0-2 个活动] / B=纯事件基准）\n`);

// 1. 属性健康度
console.log('📊 属性健康度（曾触 0 率 / 终局为 0 率 / 终局中位数）—— A vs B');
const medianA: Record<string, number> = {};
const medianB: Record<string, number> = {};
for (const k of ATTR_KEYS) {
  const ever0A = resultsA.filter(r => r.minAttrs[k] <= 0).length;
  const ever0B = resultsB.filter(r => r.minAttrs[k] <= 0).length;
  const end0A = resultsA.filter(r => r.endAttrs[k] <= 0).length;
  const end0B = resultsB.filter(r => r.endAttrs[k] <= 0).length;
  const mA = median(resultsA.map(r => r.endAttrs[k]));
  const mB = median(resultsB.map(r => r.endAttrs[k]));
  medianA[k] = mA;
  medianB[k] = mB;
  const d = mA - mB;
  console.log(`  ${ATTR_NAMES[k].padEnd(4)}(${k.padEnd(13)}) 曾触0 A ${(ever0A / N * 100).toFixed(1).padStart(5)}% / B ${(ever0B / N * 100).toFixed(1).padStart(5)}%   终局0 A ${(end0A / N * 100).toFixed(1).padStart(5)}% / B ${(end0B / N * 100).toFixed(1).padStart(5)}%   中位 A ${String(mA).padStart(3)} / B ${String(mB).padStart(3)}（Δ ${d >= 0 ? '+' : ''}${d}）`);
}

// 2. 享年与死因
console.log('\n⚰️ 享年与死因—— A vs B');
const agesA = resultsA.map(r => r.age);
const agesB = resultsB.map(r => r.age);
const avgA = agesA.reduce((a, b) => a + b, 0) / N;
const avgB = agesB.reduce((a, b) => a + b, 0) / N;
const healthA = resultsA.filter(r => r.cause === 'health');
const healthB = resultsB.filter(r => r.cause === 'health');
console.log(`  平均享年 A ${avgA.toFixed(1)} / B ${avgB.toFixed(1)}（Δ ${(avgA - avgB >= 0 ? '+' : '')}${(avgA - avgB).toFixed(1)}）`);
console.log(`  中位享年 A ${median(agesA)} / B ${median(agesB)}    最大 A ${Math.max(...agesA)} / B ${Math.max(...agesB)}`);
console.log(`  健康归零早死 A ${healthA.length} 局（${(healthA.length / N * 100).toFixed(1)}%）/ B ${healthB.length} 局（${(healthB.length / N * 100).toFixed(1)}%）`);
console.log(`    <40 岁：A ${healthA.filter(r => r.age < 40).length} / B ${healthB.filter(r => r.age < 40).length}   <60 岁：A ${healthA.filter(r => r.age < 60).length} / B ${healthB.filter(r => r.age < 60).length}`);
const buckets = [[0, 18], [19, 40], [41, 60], [61, 68], [69, 80], [81, 95], [96, 103]];
console.log('  享年分布：' + buckets.map(([lo, hi]) => `${lo}-${hi}:A${resultsA.filter(r => r.age >= lo && r.age <= hi).length}/B${resultsB.filter(r => r.age >= lo && r.age <= hi).length}`).join('  '));

// 3. 结局路线分布
console.log('\n🏁 结局路线分布—— A vs B');
const verdictsA = new Map<string, number>();
const verdictsB = new Map<string, number>();
for (const r of resultsA) {
  verdictsA.set(r.verdict, (verdictsA.get(r.verdict) ?? 0) + 1);
}
for (const r of resultsB) {
  verdictsB.set(r.verdict, (verdictsB.get(r.verdict) ?? 0) + 1);
}
const allKeys = [...new Set([...verdictsA.keys(), ...verdictsB.keys()])].sort((x, y) => (verdictsA.get(y) ?? 0) - (verdictsA.get(x) ?? 0));
for (const k of allKeys) {
  const vA = verdictsA.get(k) ?? 0;
  const vB = verdictsB.get(k) ?? 0;
  const dpp = (vA - vB) / N * 100;
  console.log(`  ${k.padEnd(16)} A ${String(vA).padStart(4)}（${(vA / N * 100).toFixed(1).padStart(5)}%） / B ${String(vB).padStart(4)}（${(vB / N * 100).toFixed(1).padStart(5)}%） Δ ${dpp >= 0 ? '+' : ''}${dpp.toFixed(1)}pp`);
}

// 4. 犯罪活动统计
console.log('\n⚖️ 犯罪活动（模式 A，随机流下）');
if (crimeStats.attempts > 0) {
  console.log(`  尝试 ${crimeStats.attempts} 次（约 ${(crimeStats.attempts / N).toFixed(1)} 次/局）`);
  console.log(`  成功 ${crimeStats.success}（${(crimeStats.success / crimeStats.attempts * 100).toFixed(1)}%） / 被抓 ${crimeStats.caught}（${(crimeStats.caught / crimeStats.attempts * 100).toFixed(1)}%） / 逃跑 ${crimeStats.fled}（${(crimeStats.fled / crimeStats.attempts * 100).toFixed(1)}%）`);
  console.log(`  理论成功率区间：基础 60% + luck×0.5% + int×0.3%（钳位 0-90%）`);
} else {
  console.log('  本批无犯罪尝试');
}
const jailedCountA = resultsA.filter(r => r.verdict === 'jailed' || r.verdict === 'escaped' || r.verdict === 'gang_boss').length;
const jailedCountB = resultsB.filter(r => r.verdict === 'jailed' || r.verdict === 'escaped' || r.verdict === 'gang_boss').length;
console.log(`  灰色路线结局（jailed/escaped/gang_boss）：A ${jailedCountA} 局 / B ${jailedCountB} 局`);

// 5. 家族底蕴 5 代模拟（纯事件模式隔离机制，固定种子可复现）
console.log('\n🌳 家族底蕴 5 代连续模拟（纯事件模式，每代终局属性 → 下一代 deriveLegacy/applyLegacy）');
const family: FamilyMember[] = [];
const genStarts: Record<string, number>[] = [];
const bonusLog: string[] = [];
const genSeeds = [920001, 920002, 920003, 920004, 920005];
for (let g = 0; g < 5; g++) {
  const legacy = deriveLegacy(family);
  const base = createInitialState('male', '模拟').attributes;
  const start = applyLegacy(base, legacy);
  genStarts.push({ ...start });
  bonusLog.push(JSON.stringify(legacyBonuses(legacy)));
  const r = playOne(genSeeds[g], false, start);
  family.push({
    name: `模拟${g + 1}代`,
    gender: 'male',
    generation: g + 1,
    age: r.age,
    score: calcScore(r.endAttrs as Attributes),
    verdict: r.verdict,
    attrs: r.endAttrs as Attributes,
    date: '20260807',
    auto: false,
  });
  console.log(`  gen${g + 1}: 开局 ${ATTR_KEYS.map(k => `${k}:${start[k]}`).join(' ')}  →  终局 ${ATTR_KEYS.map(k => `${k}:${r.endAttrs[k]}`).join(' ')}`);
  console.log(`          享年 ${r.age}（${r.cause}） 结局 ${r.verdict}  底蕴加成 ${bonusLog[g]}`);
}
console.log('\n  gen1 vs gen5 开局属性差异（底蕴加成随代漂移）：');
let totalDiff = 0;
for (const k of ATTR_KEYS) {
  const d = genStarts[4][k] - genStarts[0][k];
  totalDiff += d;
  console.log(`    ${ATTR_NAMES[k].padEnd(4)}(${k.padEnd(13)}) gen1 ${String(genStarts[0][k]).padStart(3)} → gen5 ${String(genStarts[4][k]).padStart(3)}  Δ ${d >= 0 ? '+' : ''}${d}`);
}
console.log(`    总差 ${totalDiff >= 0 ? '+' : ''}${totalDiff}（设计封顶：最多 3 项各 +2 = 每代 +6；期望收敛而非指数增长）`);

// 6. 异常项检查
console.log('\n🔍 异常项检查（阈值：属性中位差 ≥6 点 / 平均享年差 ≥3 岁 / 结局 Δ ≥4pp / 底蕴单属性 Δ ≥8 或总差 ≥15）');
let anomalyCount = 0;
for (const k of ATTR_KEYS) {
  const d = medianA[k] - medianB[k];
  if (Math.abs(d) >= 6) {
    anomalyCount++;
    console.log(`  ⚠️ ${ATTR_NAMES[k]}（${k}）中位差 ${d >= 0 ? '+' : ''}${d} 点——活动使该属性系统性偏高${d > 0 ? '（刷高嫌疑）' : '（受损）'}`);
  }
}
const ageDelta = avgA - avgB;
if (Math.abs(ageDelta) >= 3) {
  anomalyCount++;
  console.log(`  ⚠️ 平均享年差 ${ageDelta >= 0 ? '+' : ''}${ageDelta.toFixed(1)} 岁——活动${ageDelta > 0 ? '显著延长寿命（活动 health 收益偏强嫌疑）' : '显著缩短寿命'}`);
}
for (const k of allKeys) {
  const dpp = ((verdictsA.get(k) ?? 0) - (verdictsB.get(k) ?? 0)) / N * 100;
  if (Math.abs(dpp) >= 4) {
    anomalyCount++;
    console.log(`  ⚠️ 结局路线 ${k} 占比偏移 ${dpp >= 0 ? '+' : ''}${dpp.toFixed(1)}pp——活动改变了结局分布`);
  }
}
for (const k of ATTR_KEYS) {
  const d = genStarts[4][k] - genStarts[0][k];
  if (d >= 8) {
    anomalyCount++;
    console.log(`  ⚠️ 底蕴 ${ATTR_NAMES[k]}（${k}）gen1→gen5 涨 ${d} 点——超出单代 +2 的线性预期，检查是否失控`);
  }
}
if (totalDiff >= 15) {
  anomalyCount++;
  console.log(`  ⚠️ 底蕴 5 代总差 +${totalDiff} 点——明显超出 +6 封顶 × 5 代的预期漂移，可能失控`);
}
if (anomalyCount === 0) {
  console.log('  ✅ 未见异常（所有指标均在阈值内）');
}
