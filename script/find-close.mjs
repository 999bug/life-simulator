import { readFileSync } from 'fs';

const raw = readFileSync('模拟', 'utf8');

// 去掉末尾补的 ]]]
const clean = raw.replace(/\n\]\n\]\n\]$/, '');

let obj = 0, arr = 0;
let inStr = false, esc = false;
const closes = [];

for (let i = 0; i < clean.length; i++) {
  const ch = clean[i];
  if (esc) { esc = false; continue; }
  if (ch === '\\') { esc = true; continue; }
  if (ch === '"') { inStr = !inStr; continue; }
  if (inStr) continue;
  if (ch === '{') obj++;
  if (ch === '}') obj--;
  if (ch === '[') arr++;
  if (ch === ']') {
    arr--;
    if (arr === 0 && obj === 0) {
      // 找到顶层数组闭合位置
      const lineNum = clean.substring(0, i).split('\n').length;
      closes.push({ pos: i, line: lineNum, context: clean.substring(Math.max(0, i - 60), i + 10) });
    }
  }
}

console.log(`找到 ${closes.length} 个顶层闭合:`);
closes.forEach(c => {
  console.log(`  位置 ${c.pos} (行 ${c.line}): ...${c.context.replace(/\n/g, '\\n')}...`);
});

// 显示这些闭合后面的内容开头
if (closes.length > 0) {
  const firstClose = closes[0].pos;
  console.log('\n第一个闭合后面是什么:');
  console.log(clean.substring(firstClose + 1, firstClose + 200));
}
