import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

/** 模拟数据事件 ID 特征：4 位数字后缀（child_0017 / primary_0044）；原始主线为 2 位 */
const GENERATED_ID = /_\d{4}$/;

/**
 * 精选过滤：原始事件（2 位 id）全部保留；模拟事件（4 位 id）只保留清单内的。
 *
 * @param events 全量事件数组
 * @param keepIds 保留的模拟事件 id 数组
 * @returns 过滤后的新数组
 */
export function prune(events, keepIds) {
  const keep = new Set(keepIds);
  return events.filter(e => !GENERATED_ID.test(e.id) || keep.has(e.id));
}

/**
 * gap_year 死条件补丁：给产出 gap_year_done 的选项补上 gap_year flag。
 * young_05 的 has_flags: ['gap_year'] 因此可达。幂等，重复运行返回 0。
 *
 * @param events 全量事件数组（原地修改）
 * @returns 打补丁的选项数
 */
export function fixGapYear(events) {
  let patched = 0;
  for (const e of events) {
    for (const c of e.choices) {
      if (Array.isArray(c.flags_add) && c.flags_add.includes('gap_year_done') && !c.flags_add.includes('gap_year')) {
        c.flags_add.push('gap_year');
        patched++;
      }
    }
  }
  return patched;
}

function main() {
  const keepListPath = process.argv[2];
  if (!keepListPath) {
    console.error('用法: node script/prune-events.mjs <keep-list.json>');
    process.exit(1);
  }
  const events = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));
  const keepIds = JSON.parse(readFileSync(keepListPath, 'utf8'));
  const kept = prune(events, keepIds);
  const patched = fixGapYear(kept);
  writeFileSync(new URL('./chiled.json', import.meta.url), JSON.stringify(kept, null, 2), 'utf8');
  console.log(`✅ 精选完成：${events.length} → ${kept.length}（保留模拟事件 ${keepIds.length} 个），gap_year 补丁 ${patched} 处`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
