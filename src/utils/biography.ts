import type { GameState } from '../types';
import { ATTR_META } from '../engine/state';
import { EVENTS } from '../engine/events';
import { derivePersona, personaSummary, PERSONA_META, type PersonaTrait } from '../engine/personality';

/** 里程碑 flag（与结算页时间线一致） */
const MILESTONE_FLAGS = ['went_to_college', 'grad_school', 'top_university', 'married', 'has_child', 'doctor', 'startup_success', 'civil_servant', 'world_traveler', 'athlete_pro', 'military_flag', 'skilled_worker', 'tech_career', 'retired'];

/**
 * 生成一局人生的叙事 markdown 传记。
 *
 * @param game 结算状态
 * @param verdictTitle 结局标题（SummaryScreen 的 getVerdict 结果）
 * @param score 综合评分
 * @returns markdown 文本
 */
export function buildBiographyMarkdown(game: GameState, verdictTitle: string, score: number): string {
  const lines: string[] = [];
  const genderIcon = game.gender === 'male' ? '♂' : '♀';

  lines.push(`# ${game.name}的一生`);
  lines.push('');
  lines.push(`> ${genderIcon} ${game.name} · 享年 ${game.age} 岁 · 结局：${verdictTitle} · 综合评分：${score}`);
  // 性格注脚：画像成形（总分 ≥ 2）才写入开场白，与结算页展示规则一致
  const persona = derivePersona(game.history);
  const personaTotal = Object.values(persona).reduce((s, n) => s + n, 0);
  if (personaTotal >= 2) {
    lines.push(`> 这一生，${personaSummary(persona)}。`);
  }
  lines.push('');

  // 人生大事记：按年龄分组（年份 → 事件列表）
  lines.push('## 📖 人生大事记');
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
      const milestone = (r.flags ?? []).some(f => MILESTONE_FLAGS.includes(f));
      const head = milestone ? '⭐ ' : '';
      if (title) {
        lines.push(`**${head}${title}**：${r.text}`);
      } else {
        lines.push(`${head}${r.text}`);
      }
      lines.push('');
    }
  }

  // 性格画像（推导自本局全部选择：概括句 + 命中的性格端与次数；persona 已在开场白处计算）
  lines.push('## 🧭 性格画像');
  lines.push('');
  lines.push(`> ${personaSummary(persona)}`);
  lines.push('');
  const activeTraits = (Object.keys(PERSONA_META) as PersonaTrait[]).filter(t => persona[t] > 0);
  if (activeTraits.length > 0) {
    lines.push(activeTraits.map(t => `${PERSONA_META[t].icon} ${PERSONA_META[t].name} ${persona[t]}`).join(' · '));
    lines.push('');
  }

  // 最终属性表
  lines.push('## 📊 最终属性');
  lines.push('');
  lines.push('| 属性 | 值 |');
  lines.push('| --- | --- |');
  for (const [k, v] of Object.entries(game.attributes)) {
    const meta = ATTR_META[k as keyof typeof game.attributes];
    lines.push(`| ${meta.icon} ${meta.name} | ${v} |`);
  }
  lines.push('');

  // 死亡叙事
  lines.push('## 🕯️ 尾声');
  lines.push('');
  lines.push(game.deathCause === 'health' ? '身体终于支撑不住，这一生落幕了。' : '在睡梦中安静地走完了这一生。');
  lines.push('');
  lines.push('*由人生模拟器生成*');

  return lines.join('\n');
}

/**
 * 触发浏览器下载文本文件。
 *
 * @param filename 文件名（含扩展名）
 * @param content 文件内容
 */
export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
