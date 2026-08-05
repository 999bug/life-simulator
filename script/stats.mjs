import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

/** 每岁计数上限：103 岁（与引擎 calcMaxAge 封顶一致） */
const MAX_AGE = 103;
/** 超高寿区间起点：96 岁起单独报告空缺 */
const TAIL_START = 96;
/** 欠密度阈值：每岁事件数 < 3 视为空缺 */
const SPARSE_THRESHOLD = 3;
/** 模拟数据事件 ID 特征：4 位数字后缀（child_0017）；原始主线为 2 位（child_01） */
const GENERATED_ID = /_\d{4}$/;

/** 阶段区间（与 src/engine/state.ts 的 STAGE_META 对应） */
const STAGES = [
  ['婴儿期', 0, 2],
  ['童年', 3, 11],
  ['少年', 12, 17],
  ['青年', 18, 29],
  ['壮年', 30, 49],
  ['中年', 50, 64],
  ['老年', 65, 95],
  ['超高寿', 96, 103],
];

/**
 * 每岁事件密度：按 age_range[0] 归类，返回 0-103 固定长度数组。
 *
 * @param events 事件数组
 * @returns 长度 104 的数组，index = 岁数，值为该岁事件数
 */
export function perAgeDensity(events) {
  const density = new Array(MAX_AGE + 1).fill(0);
  for (const e of events) {
    const age = e.age_range[0];
    if (age >= 0 && age <= MAX_AGE) {
      density[age]++;
    }
  }
  return density;
}

/**
 * 分类分布：每个 category 的事件数量，按数量降序。
 *
 * @param events 事件数组
 * @returns category → count 的对象
 */
export function categoryDistribution(events) {
  const counts = new Map();
  for (const e of events) {
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]));
}

/**
 * flag 生产/消费配对：返回生产者、消费者与悬空 flag。
 * 悬空 = 只生产不消费，或只消费不生产（not_flags 不算消费）。
 *
 * @param events 事件数组
 * @returns producers/consumers/dangling 均为排序后的 flag 名数组
 */
export function flagPairing(events) {
  const producers = new Set();
  const consumers = new Set();
  for (const e of events) {
    for (const c of e.choices ?? []) {
      for (const f of c.flags_add ?? []) {
        producers.add(f);
      }
    }
    for (const f of e.conditions?.has_flags ?? []) {
      consumers.add(f);
    }
  }
  const dangling = new Set();
  for (const f of producers) {
    if (!consumers.has(f)) {
      dangling.add(f);
    }
  }
  for (const f of consumers) {
    if (!producers.has(f)) {
      dangling.add(f);
    }
  }
  return {
    producers: [...producers].sort(),
    consumers: [...consumers].sort(),
    dangling: [...dangling].sort(),
  };
}

/**
 * 效果值范围：遍历所有 choice 的 effects 数值取 min/max。
 *
 * @param events 事件数组
 * @returns {min, max} 对象；无任何效果值时返回 null
 */
export function effectRange(events) {
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    for (const c of e.choices ?? []) {
      for (const v of Object.values(c.effects ?? {})) {
        if (v < min) {
          min = v;
        }
        if (v > max) {
          max = v;
        }
      }
    }
  }
  if (min === Infinity) {
    return null;
  }
  return { min, max };
}

/**
 * id 统计：2 位数字后缀 = 原始主线事件，4 位数字后缀 = 模拟事件。
 *
 * @param events 事件数组
 * @returns {mainline, generated} 计数对象
 */
export function idStats(events) {
  let mainline = 0;
  let generated = 0;
  for (const e of events) {
    if (GENERATED_ID.test(e.id)) {
      generated++;
    } else {
      mainline++;
    }
  }
  return { mainline, generated };
}

/**
 * 空缺报告：0-95 岁每岁 <3 个的岁数清单 + 96-103 岁各岁数量明细。
 *
 * @param events 事件数组
 * @returns {sparse, tail} sparse 为欠密度岁数列表，tail 为超高寿区间 8 个岁的完整明细
 */
export function gapReport(events) {
  const density = perAgeDensity(events);
  const sparse = [];
  const tail = [];
  for (let age = 0; age < TAIL_START; age++) {
    if (density[age] < SPARSE_THRESHOLD) {
      sparse.push({ age, count: density[age] });
    }
  }
  for (let age = TAIL_START; age <= MAX_AGE; age++) {
    tail.push({ age, count: density[age] });
  }
  return { sparse, tail };
}

/**
 * 把 [start, end] 区间的每岁密度格式化为每行 8 项的文本行。
 *
 * @param density 每岁密度数组
 * @param start 起始岁数
 * @param end 结束岁数
 * @returns 文本行数组
 */
function formatDensityLines(density, start, end) {
  const lines = [];
  let line = [];
  for (let age = start; age <= end; age++) {
    line.push(`${age}:${density[age]}`);
    if (line.length === 8) {
      lines.push(line.join(' '));
      line = [];
    }
  }
  if (line.length > 0) {
    lines.push(line.join(' '));
  }
  return lines;
}

function main() {
  const events = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const density = perAgeDensity(events);
  console.log('📊 事件数据看板（script/chiled.json）');
  console.log(`✅ 事件总数：${events.length}`);

  console.log('\n📅 每岁密度（age:count）');
  for (const [name, start, end] of STAGES) {
    for (const line of formatDensityLines(density, start, end)) {
      console.log(`  ${name}（${start}-${end}）: ${line}`);
    }
  }

  console.log('\n🔖 分类分布');
  for (const [cat, count] of Object.entries(categoryDistribution(events))) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log('\n🚩 flag 配对');
  const pairing = flagPairing(events);
  console.log(`  生产者 ${pairing.producers.length} 个 / 消费者 ${pairing.consumers.length} 个`);
  if (pairing.dangling.length === 0) {
    console.log('  ✅ 无悬空 flag');
  } else {
    console.log(`  ⚠️ 悬空 flag（${pairing.dangling.length} 个）：${pairing.dangling.join(', ')}`);
  }

  console.log('\n💥 效果值范围');
  const range = effectRange(events);
  if (range === null) {
    console.log('  无任何效果值');
  } else {
    console.log(`  min ${range.min} / max ${range.max}`);
  }

  console.log('\n🏷️ id 统计');
  const ids = idStats(events);
  console.log(`  主线（2 位）${ids.mainline} 个 / 模拟（4 位）${ids.generated} 个`);

  console.log('\n⚠️ 空缺报告');
  const gap = gapReport(events);
  if (gap.sparse.length === 0) {
    console.log('  ✅ 0-95 岁密度全部达标（≥3 个/岁）');
  } else {
    console.log(`  ⚠️ 欠密度岁数（0-95 岁，<3 个/岁，共 ${gap.sparse.length} 个）：`);
    for (const { age, count } of gap.sparse) {
      console.log(`    ${age} 岁：${count} 个`);
    }
  }
  console.log('  96-103 岁（超高寿区间）明细：');
  for (const { age, count } of gap.tail) {
    console.log(`    ${age} 岁：${count} 个`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
