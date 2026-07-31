import { readFileSync, writeFileSync } from 'fs';

let raw = readFileSync('模拟', 'utf8');

// 去掉末尾多余的 ]]
raw = raw.replace(/\n\]\]$/, '');
raw = raw.replace(/\n\]$/, '');

// 计算需要补的闭合括号
function countBrackets(s) {
  let obj = 0, arr = 0;
  let inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') obj++;
    if (ch === '}') obj--;
    if (ch === '[') arr++;
    if (ch === ']') arr--;
  }
  return { obj, arr };
}

let { obj, arr } = countBrackets(raw);
console.log('需要补: } x', obj, ', ] x', arr);

// 补闭合
let suffix = '';
for (let i = 0; i < arr; i++) suffix += '\n]';
for (let i = 0; i < obj; i++) suffix += '\n}';

raw += suffix;
writeFileSync('模拟', raw, 'utf8');

try {
  const d = JSON.parse(raw);
  console.log('✅ 合法! 事件数:', d.length);
  const stages = {};
  d.forEach(e => {
    const r = e.age_range;
    const key = r[0] < 3 ? '婴儿' : r[0] < 12 ? '童年' : r[0] < 18 ? '少年'
      : r[0] < 30 ? '青年' : r[0] < 50 ? '中年' : r[0] < 65 ? '中老年' : '晚年';
    stages[key] = (stages[key] || 0) + 1;
  });
  console.log('阶段:', stages);
  const cats = {};
  d.forEach(e => { cats[e.category] = (cats[e.category] || 0) + 1 });
  console.log('分类:', cats);
} catch (e) {
  console.log('失败:', e.message.substring(0, 300));
  const m = e.message.match(/position (\d+)/);
  if (m) {
    const pos = parseInt(m[1]);
    console.log('位置上下文:', raw.substring(Math.max(0, pos - 50), pos + 50));
  }
}
