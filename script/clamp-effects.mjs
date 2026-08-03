/**
 * 效果值钳位工具：4 位模拟事件的效果按转换后属性值压缩到 ±20 内。
 *
 * 仅处理 4 位后缀模拟事件（2 位主线一字不改）。
 * 多键映射求和超范围时，对该属性所有来源键等比例压缩。
 * 幂等：重复运行不会产生新变化。
 *
 * 用法：node script/clamp-effects.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { ATTR_MAP, INVERSE } from './convert-events.mjs';

/** 效果值上限（与 CLAUDE.md 声明范围 ±3~±20 一致） */
const MAX_EFFECT = 20;

/** 模拟事件 ID 特征：4 位数字后缀 */
const GENERATED_ID = /_\d{4}$/;

/** 计算选项的转换后属性值（与 convert-events.mjs mapEffects 同逻辑） */
function mapAttr(effects) {
  const attr = {};
  for (const [key, value] of Object.entries(effects)) {
    const target = ATTR_MAP[key];
    attr[target] = (attr[target] ?? 0) + (INVERSE.has(key) ? -value : value);
  }
  return attr;
}

/**
 * 钳位单个选项：转换后 |attr| 超上限时，按比例压缩该属性的所有来源键。
 *
 * @param choice 选项（原地修改 effects）
 * @param eventId 事件 id（报错上下文）
 */
function clampChoice(choice, eventId) {
  const effects = choice.effects ?? {};
  const attr = mapAttr(effects);
  for (const [target, total] of Object.entries(attr)) {
    if (Math.abs(total) <= MAX_EFFECT) {
      continue;
    }
    // 该属性转换后超上限 → 来源键等比例压缩
    const scale = MAX_EFFECT / Math.abs(total);
    for (const [key, value] of Object.entries(effects)) {
      if (ATTR_MAP[key] === target) {
        effects[key] = Math.sign(value) * Math.max(1, Math.round(Math.abs(value) * scale));
      }
    }
  }
}

function main() {
  const path = new URL('./chiled.json', import.meta.url);
  const events = JSON.parse(readFileSync(path, 'utf8'));
  let adjusted = 0;
  let touched = 0;
  for (const e of events) {
    if (!GENERATED_ID.test(e.id)) {
      continue;
    }
    for (const c of e.choices) {
      const before = JSON.stringify(c.effects ?? {});
      clampChoice(c, e.id);
      if (JSON.stringify(c.effects ?? {}) !== before) {
        adjusted++;
        touched++;
      }
    }
  }
  writeFileSync(path, JSON.stringify(events, null, 2), 'utf8');
  console.log(`✅ 钳位完成：调整 ${adjusted} 个选项（涉及 ${touched} 个事件）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
