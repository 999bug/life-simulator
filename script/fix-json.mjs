import { readFileSync, writeFileSync } from 'fs';

let raw = readFileSync('模拟', 'utf8');

// 移除之前手动加的修复
raw = raw.replace(']\n]', ']');

// 修复1: 补全缺失左引号的属性名 (如 curiosity": → "curiosity":)
// 模式: 逗号/换行+空格+字母下划线+引号+冒号
raw = raw.replace(/([,{\[]\s*\n\s*)([a-z_]+)(")/g, '$1"$2$3');

// 修复2: 完全没有引号的属性名 (如 confidence: → "confidence":)
// 在 effects/conditions 对象内部，匹配: 空白 + 字母 + 冒号(且前面不是引号)
raw = raw.replace(/(\n\s+)([a-z_]+)(\s*):/g, (match, indent, key, space) => {
  if (indent.includes('"')) return match; // 已经有引号
  // 排除 text/effects/flags_add/id/title 等已知的带引号 key
  return indent + '"' + key + '":';
});

// 修复3: 缺失逗号 - 两对象/数组之间
// }\n{ → },\n{
raw = raw.replace(/}(\s*\n\s*){/g, '},\n{');
// ]\n[ → ],\n[
raw = raw.replace(/](\s*\n\s*)\[/g, '],\n[');
// }\n[ → },\n[
raw = raw.replace(/}(\s*\n\s*)\[/g, '},\n[');
// ]\n{ → ],\n{
raw = raw.replace(/](\s*\n\s*){/g, '],\n{');

// 修复4: 双逗号
raw = raw.replace(/,,/g, ',');

// 修复5: 尾部逗号（数组/对象最后一项后不应有逗号）
raw = raw.replace(/,(\s*\n\s*)}/g, '$1}');
raw = raw.replace(/,(\s*\n\s*)\]/g, '$1]');

writeFileSync('模拟', raw, 'utf8');

// 验证
try {
  const d = JSON.parse(raw);
  console.log('✅ JSON合法! 事件数:', d.length);
  const cats = {};
  d.forEach(e => { cats[e.category] = (cats[e.category] || 0) + 1 });
  console.log('分类:', cats);
} catch(e) {
  console.log('仍有错误:', e.message.substring(0, 300));
  // 输出错误位置
  const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
  console.log('错误位置上下文:');
  console.log(raw.substring(Math.max(0, pos - 80), pos + 80));
}
