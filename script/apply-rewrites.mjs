/**
 * 文案重写补丁应用工具：按 id 精确替换事件的标题/文本/选项文案与性格标注。
 *
 * 只覆盖文案字段，效果值（effects）、flag（flags_add）、条件（conditions）一律保留原值——
 * 避免重写文案时误伤已调好的平衡与事件链。
 *
 * 补丁格式（script/rewrites/*.json）：
 * [
 *   {
 *     "id": "child_0023",
 *     "title": "可选，缺省保留",
 *     "text": "可选，缺省保留",
 *     "choices": [
 *       { "text": "新选项文案", "personality": ["rational"] },   // personality 可选；null = 显式删除
 *       { "personality": null }                                   // text 缺省 = 保留原文
 *     ]
 *   }
 * ]
 *
 * 用法：node script/apply-rewrites.mjs script/rewrites/batch1-a.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const chiledPath = new URL('./chiled.json', import.meta.url);
const patchPath = new URL(process.argv[2], import.meta.url);
const chiled = JSON.parse(readFileSync(chiledPath, 'utf8'));
const patches = JSON.parse(readFileSync(patchPath, 'utf8'));

const byId = new Map(chiled.map(e => [e.id, e]));
let applied = 0;

for (const p of patches) {
  const ev = byId.get(p.id);
  if (!ev) {
    throw new Error(`补丁 id 不存在: ${p.id}`);
  }
  if (p.title !== undefined) {
    ev.title = p.title;
  }
  if (p.text !== undefined) {
    ev.text = p.text;
  }
  if (p.choices) {
    if (p.choices.length !== ev.choices.length) {
      throw new Error(`${p.id}: 补丁选项数 ${p.choices.length} ≠ 原选项数 ${ev.choices.length}`);
    }
    for (let i = 0; i < p.choices.length; i++) {
      const pc = p.choices[i];
      if (pc.text !== undefined) {
        if (typeof pc.text !== 'string' || pc.text.length === 0) {
          throw new Error(`${p.id} 选项 ${i}: text 为空`);
        }
        ev.choices[i].text = pc.text;
      }
      if (pc.personality !== undefined) {
        if (pc.personality === null) {
          delete ev.choices[i].personality;
        } else {
          ev.choices[i].personality = pc.personality;
        }
      }
    }
  }
  applied++;
}

writeFileSync(chiledPath, `${JSON.stringify(chiled, null, 2)}\n`);
console.log(`✅ 已应用 ${applied} 个事件补丁（${patches.length - applied > 0 ? `${patches.length - applied} 个未命中` : ''}）`);
