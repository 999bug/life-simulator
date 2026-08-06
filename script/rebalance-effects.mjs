#!/usr/bin/env node
/**
 * rebalance-effects.mjs：抉择质量改造（P0-1）——全正事件得失交织化。
 *
 * 背景：引擎层 48.5% 事件所有选项净收益为正（怎么选都赚，抉择无意义）。
 * 本脚本对 3-12 岁全正模拟事件（4 位 id）约一半加代价维度，代价与叙事匹配：
 * 高收益选项带刺（压力/金钱/社交/幸福），低收益选项保持干净，形成真正权衡。
 * 2 位主线事件一字不改（铁律）。
 *
 * 幂等：REBALANCE 表为「设置为目标值」语义，重复运行结果相同。
 * 运行：node script/rebalance-effects.mjs，然后 npm run build:events。
 */
import { readFileSync, writeFileSync } from 'fs';

/**
 * 改造表：{ 事件id: { 选项索引(0起): { 代价键: 目标值 } } }
 * 代价键为 chiled 原始键：pressure/anxiety 为 INVERSE 取反键；money/friendship/social/happiness 为负值正向键。
 */
const REBALANCE = {
  child_0018: { 0: { money: -4 } },        // 养宠物：零花钱买口粮
  child_0026: { 0: { happiness: -4 } },    // 新成员：关注被分走的委屈
  child_0082: { 0: { pressure: 5 } },      // 考试成绩：被期待的压力
  child_0084: { 0: { money: -4 } },        // 学音乐：买乐器花钱
  child_0019: { 0: { social: -3 } },       // 爱上阅读：看书少了玩伴
  primary_0006: { 0: { pressure: 4 } },    // 竞选班干部：管同学的压力
  primary_0013: { 0: { pressure: 5 } },    // 排名前列：保位压力
  primary_0021: { 2: { happiness: -4 } },  // 零花钱全存：忍住不买零食
  primary_0044: { 0: { pressure: 5 } },    // 竞赛训练：训练辛苦
  primary_0045: { 0: { friendship: -4 } }, // 超过对手：较劲生隔阂
  primary_0052: { 0: { happiness: -4 } },  // 存钱目标：延迟满足
  primary_0056: { 0: { anxiety: 3 } },     // 秘密基地：瞒着大人的忐忑
  primary_0079: { 0: { social: -3 } },     // 专业训练：集训没朋友
  primary_0085: { 0: { social: -3 } },     // 投入特长：练琴拒了玩伴
  primary_0104: { 0: { happiness: -3 } },  // 冷静沟通：先低头的委屈
  primary_0116: { 0: { pressure: 5 } },    // 大量训练：备战辛苦
  primary_0149: { 0: { happiness: -5 } },  // 坚持兴趣：咬牙放弃玩乐
  primary_0173: { 1: { friendship: -4 } }, // 公平竞争：好友间隔阂
  primary_0186: { 0: { happiness: -4 } },  // 异地友情：维系辛苦
  primary_0190: { 0: { happiness: -4 } },  // 压抑心动：把喜欢压心底
  primary_0196: { 0: { pressure: 4 } },    // 进重点初中：新环境全是高手
  // 18-60 岁财务线白赚事件（2026-08 扩展）：最高收益选项带刺，形成真实权衡
  wealth_0026: { 1: { anxiety: 4 } },      // 试水基金定投：行情波动睡不好
  wealth_0032: { 1: { risk: 3 } },         // 跳槽拿高薪：新环境未知风险
  wealth_0036: { 1: { anxiety: 4 } },      // 继续持有等更大回报：贪心焦虑
  wealth_0041: { 0: { pressure: 4 } },     // 立即执行财务规划：自律约束的压力
  wealth_0047: { 1: { risk: 3 } },         // 卖掉换核心地段：置换踏空的未知
};

const events = JSON.parse(readFileSync(new URL('./chiled.json', import.meta.url), 'utf8'));

let touched = 0;
const missing = [];
for (const e of events) {
  const plan = REBALANCE[e.id];
  if (!plan) {
    continue;
  }
  for (const [idxStr, patch] of Object.entries(plan)) {
    const choice = e.choices[Number(idxStr)];
    if (!choice) {
      missing.push(`${e.id} 选项${Number(idxStr) + 1} 不存在`);
      continue;
    }
    choice.effects = { ...(choice.effects ?? {}), ...patch };
    touched++;
  }
}

// 改造表中的 id 必须全部存在，防止笔误静默失效
for (const id of Object.keys(REBALANCE)) {
  if (!events.some(e => e.id === id)) {
    missing.push(`${id} 事件不存在`);
  }
}

if (missing.length > 0) {
  console.error('❌ 改造表存在无效目标：');
  missing.forEach(m => console.error('  - ' + m));
  process.exit(1);
}

writeFileSync(new URL('./chiled.json', import.meta.url), JSON.stringify(events, null, 2), 'utf8');
console.log(`✅ 已改造 ${Object.keys(REBALANCE).length} 个事件（${touched} 个选项加代价维度），写回 chiled.json`);
