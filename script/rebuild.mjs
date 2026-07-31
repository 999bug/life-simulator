import { readFileSync, writeFileSync } from 'fs';

let raw = readFileSync('模拟', 'utf8');

// 去掉末尾我补的 ]]]
raw = raw.replace(/\n\]\n\]\n\]$/, '');

// 找到所有事件的起始位置：行首有空格的 "id":
const lines = raw.split('\n');
const eventStarts = [];
for (let i = 0; i < lines.length; i++) {
  if (/^\s+"id":\s*"/.test(lines[i])) {
    eventStarts.push(i);
  }
}
console.log(`找到 ${eventStarts.length} 个事件起始行`);

// 从每个起始行往前找 {，往后找匹配的 }
const events = [];
let extracted = 0, failed = 0;

for (const startLine of eventStarts) {
  // 往前找到这个事件对象的 {
  let objStart = startLine;
  while (objStart >= 0 && !lines[objStart].trim().startsWith('{')) {
    objStart--;
  }
  if (objStart < 0) { failed++; continue; }

  // 从 { 开始，往后找匹配的 }
  let depth = 0, inStr = false, esc = false;
  let endLine = -1;
  for (let i = objStart; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      const ch = lines[i][j];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) { endLine = i; break; }
      }
    }
    if (endLine >= 0) break;
  }

  if (endLine < 0) { failed++; continue; }

  const eventText = lines.slice(objStart, endLine + 1).join('\n');

  // 去掉尾部逗号
  const cleanEvent = eventText.replace(/,\s*$/, '');

  try {
    const evt = JSON.parse(cleanEvent);
    events.push(evt);
    extracted++;
  } catch (e) {
    // 尝试修复常见问题后重试
    let fixed = cleanEvent;
    // 补缺失引号的属性名
    fixed = fixed.replace(/(\n\s+)([a-z_]+)(")/g, '$1"$2$3');
    fixed = fixed.replace(/(\n\s+)([a-z_]+)(\s*):/g, (m, indent, key, sp) => {
      if (indent.includes('"')) return m;
      return indent + '"' + key + '":';
    });
    // 补缺失的逗号
    fixed = fixed.replace(/}(\s*\n\s*){/g, '},\n{');
    fixed = fixed.replace(/](\s*\n\s*)\[/g, '],\n[');
    fixed = fixed.replace(/}(\s*\n\s*)\[/g, '},\n[');
    fixed = fixed.replace(/](\s*\n\s*){/g, '],\n{');
    // 尾逗号
    fixed = fixed.replace(/,(\s*\n\s*)}/g, '$1}');
    fixed = fixed.replace(/,(\s*\n\s*)\]/g, '$1]');

    try {
      const evt = JSON.parse(fixed);
      events.push(evt);
      extracted++;
    } catch (e2) {
      failed++;
    }
  }
}

console.log(`提取: ${extracted} 成功, ${failed} 失败, 共 ${events.length} 事件`);

// 写入
writeFileSync('模拟', JSON.stringify(events, null, 2), 'utf8');
console.log('✅ 已写入模拟 (clean)');

// 统计
const stages = {};
events.forEach(e => {
  const r = e.age_range;
  const key = r[0] < 3 ? '婴儿' : r[0] < 12 ? '童年' : r[0] < 18 ? '少年'
    : r[0] < 30 ? '青年' : r[0] < 50 ? '中年' : r[0] < 65 ? '中老年' : '晚年';
  stages[key] = (stages[key] || 0) + 1;
});
console.log('阶段:', stages);
