import { describe, expect, it } from 'vitest';
import { buildBiographyMarkdown } from '../utils/biography';
import type { GameState } from '../types';

/** 最小游戏状态 fixture：0 岁出生 + 3 岁幼儿园（带里程碑 flag） */
function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    gender: 'male',
    name: '张三',
    age: 5,
    stage: 'childhood',
    stageIdx: 1,
    attributes: {
      health: 70,
      intelligence: 60,
      wealth: 50,
      happiness: 80,
      social: 60,
      appearance: 55,
      luck: 65,
      morality: 70,
    },
    flags: ['married'],
    history: [
      { age: 0, stage: 'infant', eventId: 'birth_01', choiceIndex: 0, text: '……' },
      { age: 3, stage: 'childhood', eventId: 'child_01', choiceIndex: 0, text: '跑向积木区，大声问「谁要一起搭城堡？」', flags: ['married'] },
    ],
    phase: 'summary',
    deathCause: 'lifespan',
    goal: null,
    ...overrides,
  };
}

describe('buildBiographyMarkdown', () => {
  it('包含标题行、人生大事记、最终属性表与尾声', () => {
    const md = buildBiographyMarkdown(makeGame(), '安享晚年', 88);
    expect(md).toContain('# 张三的一生');
    expect(md).toContain('♂ 张三 · 享年 5 岁 · 结局：安享晚年 · 综合评分：88');
    expect(md).toContain('## 📖 人生大事记');
    expect(md).toContain('## 📊 最终属性');
    expect(md).toContain('## 🕯️ 尾声');
  });

  it('大事记按年龄分组并用事件标题渲染', () => {
    // 无 flag 的记录（不带 ⭐，由专属用例覆盖）
    const game = makeGame({
      history: [
        { age: 0, stage: 'infant', eventId: 'birth_01', choiceIndex: 0, text: '……' },
        { age: 3, stage: 'childhood', eventId: 'child_01', choiceIndex: 0, text: '跑向积木区，大声问「谁要一起搭城堡？」' },
      ],
    });
    const md = buildBiographyMarkdown(game, '安享晚年', 88);
    const zeroIdx = md.indexOf('### 0 岁');
    const threeIdx = md.indexOf('### 3 岁');
    expect(zeroIdx).toBeGreaterThan(-1);
    expect(threeIdx).toBeGreaterThan(zeroIdx);
    expect(md).toContain('**出生**：……');
    expect(md).toContain('**第一天上幼儿园**：跑向积木区，大声问「谁要一起搭城堡？」');
    expect(md).not.toContain('**⭐ 第一天上幼儿园**');
  });

  it('里程碑 flag 记录带 ⭐ 标记', () => {
    const md = buildBiographyMarkdown(makeGame(), '安享晚年', 88);
    expect(md).toContain('**⭐ 第一天上幼儿园**');
    // 无 flag 的记录不带星标
    expect(md).not.toContain('**⭐ 出生**');
  });

  it('属性表包含八大属性图标与终值', () => {
    const md = buildBiographyMarkdown(makeGame(), '安享晚年', 88);
    expect(md).toContain('| 💪 健康 | 70 |');
    expect(md).toContain('| 🧠 智力 | 60 |');
    expect(md).toContain('| 💰 财富 | 50 |');
  });

  it('死因决定尾声叙事文案', () => {
    const health = buildBiographyMarkdown(makeGame({ deathCause: 'health' }), '安享晚年', 88);
    expect(health).toContain('身体终于支撑不住，这一生落幕了。');
    const lifespan = buildBiographyMarkdown(makeGame(), '安享晚年', 88);
    expect(lifespan).toContain('在睡梦中安静地走完了这一生。');
  });
});
