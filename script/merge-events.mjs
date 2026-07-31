import { readFileSync, writeFileSync } from 'fs';

/**
 * 合并 模拟（童年/小学 291 个事件）到 chiled.json（全生命周期 66 个事件）。
 * 合并后按 age_range 升序排列，同年龄段保持原有相对顺序。
 */

/**
 * 校验单个事件结构是否合法。
 *
 * @param e 事件对象
 * @param source 来源文件名（用于报错定位）
 * @returns 错误信息数组，空数组表示合法
 */
function validate(e, source) {
  const errors = [];
  if (typeof e.id !== 'string' || !e.id) {
    errors.push(`${source}: 事件缺少 id`);
  }
  if (!Array.isArray(e.age_range) || e.age_range.length !== 2
      || e.age_range.some(n => typeof n !== 'number') || e.age_range[0] > e.age_range[1]) {
    errors.push(`${source} ${e.id}: age_range 非法 ${JSON.stringify(e.age_range)}`);
  }
  if (typeof e.category !== 'string' || !e.category) {
    errors.push(`${source} ${e.id}: 缺少 category`);
  }
  if (typeof e.title !== 'string' || !e.title) {
    errors.push(`${source} ${e.id}: 缺少 title`);
  }
  if (typeof e.text !== 'string' || !e.text) {
    errors.push(`${source} ${e.id}: 缺少 text`);
  }
  if (!Array.isArray(e.choices) || e.choices.length === 0) {
    errors.push(`${source} ${e.id}: choices 为空`);
  } else {
    e.choices.forEach((c, i) => {
      if (typeof c.text !== 'string' || !c.text) {
        errors.push(`${source} ${e.id}: choices[${i}] 缺少 text`);
      }
      if (typeof c.effects !== 'object' || c.effects === null || Array.isArray(c.effects)) {
        errors.push(`${source} ${e.id}: choices[${i}] effects 非法`);
      }
    });
  }
  return errors;
}

const moni = JSON.parse(readFileSync('模拟', 'utf8'));
const chiled = JSON.parse(readFileSync('chiled.json', 'utf8'));

const errors = [...moni.flatMap(e => validate(e, '模拟')), ...chiled.flatMap(e => validate(e, 'chiled.json'))];
if (errors.length > 0) {
  console.error(`校验失败，共 ${errors.length} 个问题：`);
  errors.slice(0, 20).forEach(e => console.error(' -', e));
  process.exit(1);
}

// chiled 在前：同年龄段时原有主线事件排前面
const merged = [...chiled, ...moni];
const seen = new Set();
const dupIds = merged.filter(e => seen.has(e.id) || !seen.add(e.id)).map(e => e.id);
if (dupIds.length > 0) {
  console.error(`ID 冲突：${dupIds.join(', ')}`);
  process.exit(1);
}

merged.sort((a, b) => a.age_range[0] - b.age_range[0] || a.age_range[1] - b.age_range[1]);

writeFileSync('chiled.json', JSON.stringify(merged, null, 2), 'utf8');
console.log(`✅ 合并完成：${chiled.length} + ${moni.length} = ${merged.length} 个事件`);
