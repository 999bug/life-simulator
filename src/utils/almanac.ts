import type { AttributeKey, GameState } from '../types';
import { ATTR_META } from '../engine/state';
import { EVENTS } from '../engine/events';
import type { JobStatus } from '../engine/jobs';
import type { NpcBonds } from '../engine/npcs';
import type { GaokaoResult } from '../engine/gaokao';
import type { AssetItem } from '../engine/assets';
import { verdictKey } from '../engine/verdict';
import { deriveTitle } from '../engine/titles';
import { deathOneLiner } from '../engine/deaths';

/**
 * 生成一局人生的「人生年鉴」markdown（年度回顾式终局报告）。
 * 相比传记（逐岁叙事），年鉴是数据汇总：结局/评分/属性/成长/职业资产/家人/大事记速览。
 *
 * @param game 结算状态
 * @param verdictTitle 结局标题
 * @param verdictDesc 结局描述
 * @param score 综合评分
 * @param meta 职业/家人/高考/资产（由引擎推导，结算页已算好）
 * @returns markdown 文本
 */
export function buildAlmanacMarkdown(
  game: GameState,
  verdictTitle: string,
  verdictDesc: string,
  score: number,
  meta: { job: JobStatus | null; bonds: NpcBonds; gaokao: GaokaoResult | null; assets: AssetItem[] },
): string {
  const lines: string[] = [];
  const genderIcon = game.gender === 'male' ? '♂' : '♀';

  lines.push(`# ${game.name}的人生年鉴`);
  lines.push('');
  lines.push(`> ${genderIcon} 享年 ${game.age} 岁 · 综合评分 ${score}`);
  lines.push('');
  lines.push('## 🏆 结局');
  lines.push('');
  lines.push(`**${verdictTitle}**`);
  lines.push('');
  lines.push(`> 🏅 称号：${deriveTitle(game, verdictKey(game))}`);
  lines.push('');
  lines.push(verdictDesc);
  lines.push('');

  // 成长数据表（快照；无快照的旧局省略）
  if (game.snapshots && game.snapshots.length > 0) {
    lines.push('## 📈 成长曲线数据');
    lines.push('');
    const attrs = Object.keys(game.snapshots[0].attrs) as AttributeKey[];
    lines.push(`| 岁 | ${attrs.map(k => ATTR_META[k].name).join(' | ')} |`);
    lines.push(`| --- | ${attrs.map(() => '---').join(' | ')} |`);
    for (const s of game.snapshots) {
      lines.push(`| ${s.age} | ${attrs.map(k => s.attrs[k]).join(' | ')} |`);
    }
    lines.push('');
  }

  // 职业与资产
  lines.push('## 💼 职业与资产');
  lines.push('');
  if (meta.job) {
    lines.push(`- 职业：${meta.job.icon} ${meta.job.title}（从业 ${meta.job.years} 年）`);
  } else {
    lines.push('- 职业：无固定职业');
  }
  if (meta.gaokao) {
    lines.push(`- 学业：${meta.gaokao.icon} ${meta.gaokao.label}`);
  }
  if (meta.assets.length > 0) {
    lines.push(`- 资产：${meta.assets.map(a => `${a.icon} ${a.label}`).join('、')}`);
  } else {
    lines.push('- 资产：无');
  }
  lines.push('');

  // 与身边人
  lines.push('## 🤝 与身边人');
  lines.push('');
  lines.push(`- 家人：${meta.bonds.family}`);
  lines.push(`- 伴侣：${meta.bonds.partner}`);
  lines.push(`- 朋友：${meta.bonds.friends}`);
  lines.push('');

  // 最终属性
  lines.push('## 📊 最终属性');
  lines.push('');
  lines.push('| 属性 | 值 |');
  lines.push('| --- | --- |');
  for (const [k, v] of Object.entries(game.attributes)) {
    const metaInfo = ATTR_META[k as keyof typeof game.attributes];
    lines.push(`| ${metaInfo.icon} ${metaInfo.name} | ${v} |`);
  }
  lines.push('');

  // 大事记速览（全部选择记录）
  lines.push('## 📖 大事记');
  lines.push('');
  const byAge = new Map<number, GameState['history']>();
  for (const h of game.history) {
    const list = byAge.get(h.age) ?? [];
    list.push(h);
    byAge.set(h.age, list);
  }
  for (const [age, records] of [...byAge.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`### ${age} 岁`);
    lines.push('');
    for (const r of records) {
      const title = EVENTS.find(e => e.id === r.eventId)?.title;
      lines.push(title ? `**${title}**：${r.text}` : r.text);
      lines.push('');
    }
  }

  lines.push('## 🕯️ 尾声');
  lines.push('');
  lines.push(deathOneLiner(game.deathCause, game.age));
  lines.push('');
  lines.push('*由人生模拟器生成的人生年鉴*');
  return lines.join('\n');
}
