import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { pathToFileURL } from 'url';
import { convertAll } from './convert-events.mjs';

/**
 * 合并基础数据与生成片段：跳过已在基础数据中的 id（幂等），按 age_range 升序排序。
 * 片段文件在合并后保留在 fragments/ 目录，重复运行不会产生重复事件。
 * 跨代继承 flag（parent_ 前缀）由开局按族谱注入，不经事件产出，豁免配对校验。
 *
 * @param base chiled.json 事件数组
 * @param fragments 片段数组的数组
 * @returns 合并排序后的新数组
 */
export function mergeFragments(base, fragments) {
  const all = [...base];
  const ids = new Set(all.map(e => e.id));
  for (const e of fragments.flat()) {
    if (ids.has(e.id)) {
      continue;
    }
    ids.add(e.id);
    all.push(e);
  }
  all.sort((a, b) => a.age_range[0] - b.age_range[0] || a.age_range[1] - b.age_range[1]);
  return all;
}

/**
 * 每岁密度校验：0-2 岁每岁 3-5 个；3-12 岁每岁 5-13 个；13-75 岁每岁 3-9 个。
 *
 * @returns 违规描述数组，空数组表示通过
 */
export function checkDistribution(events) {
  const perAge = new Map();
  for (const e of events) {
    const age = e.age_range[0];
    perAge.set(age, (perAge.get(age) ?? 0) + 1);
  }
  const violations = [];
  for (const [age, count] of [...perAge].sort((a, b) => a[0] - b[0])) {
    if (age <= 2 && (count < 3 || count > 5)) {
      violations.push(`${age} 岁事件 ${count} 个，超出 3-5 范围`);
    } else if (age >= 3 && age <= 12 && (count < 5 || count > 13)) {
      violations.push(`${age} 岁事件 ${count} 个，${count < 5 ? '过少' : '过多'}（要求 5-13）`);
    } else if (age >= 13 && age <= 75 && (count < 3 || count > 9)) {
      violations.push(`${age} 岁事件 ${count} 个，${count < 3 ? '过少' : '过多'}（要求 3-9）`);
    }
  }
  return violations;
}

/** 外部注入 flag 前缀：跨代继承 flag（parent_*）由开局按族谱注入，不由事件产出，豁免配对校验 */
export const EXTERNAL_FLAG_PREFIX = 'parent_';

/**
 * flag 生产/消费配对校验：has_flags 引用的 flag 必须有事件产出；not_flags 不算悬空。
 * parent_ 前缀为开局外部注入（跨代继承），豁免校验。
 *
 * @returns 悬空 flag 数组，空数组表示通过
 */
export function checkFlagPairs(events) {
  const producers = new Set();
  for (const e of events) {
    for (const c of e.choices) {
      for (const f of c.flags_add ?? []) {
        producers.add(f);
      }
    }
  }
  const orphans = new Set();
  for (const e of events) {
    for (const f of e.conditions?.has_flags ?? []) {
      if (!f.startsWith(EXTERNAL_FLAG_PREFIX) && !producers.has(f)) {
        orphans.add(f);
      }
    }
  }
  return [...orphans];
}

function main() {
  const dir = new URL('./', import.meta.url);
  const base = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const fragDir = new URL('./fragments/', import.meta.url);
  const files = readdirSync(fragDir).filter(f => f.endsWith('.json'));
  const fragments = files.map(f => JSON.parse(readFileSync(new URL(`./fragments/${f}`, import.meta.url), 'utf8')));
  const merged = mergeFragments(base, fragments);
  // 转换器全量校验（未映射键/缺字段/重复 id fail-fast）
  convertAll(merged);
  const violations = checkDistribution(merged);
  const orphans = checkFlagPairs(merged);
  if (violations.length > 0 || orphans.length > 0) {
    violations.forEach(v => console.error('密度违规:', v));
    orphans.forEach(f => console.error('悬空 flag:', f));
    process.exit(1);
  }
  writeFileSync(new URL('./chiled.json', import.meta.url), JSON.stringify(merged, null, 2), 'utf8');
  console.log(`✅ 合并完成：${base.length} + ${fragments.flat().length} = ${merged.length} 个事件（片段：${files.join(', ')}）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
