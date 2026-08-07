import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChoicePanel from '../components/ChoicePanel';
import type { Attributes, Choice } from '../types';

/** 构造选项（含效果数值） */
function choice(text: string, attr: Record<string, number>): Choice {
  return { text, effects: '', outcomes: { attr } };
}

const attrs: Attributes = { health: 50, intelligence: 50, wealth: 50, happiness: 50, social: 50, appearance: 50, luck: 50, morality: 50 };

describe('ChoicePanel', () => {
  it('普通模式：不显示选项右侧数值（选择完反馈页才显示）', () => {
    render(
      <ChoicePanel
        choices={[choice('去散步', { happiness: 4, wealth: -2 })]}
        onSelect={vi.fn()}
        visible
        attributes={attrs}
        age={30}
        realMode={false}
      />,
    );
    expect(screen.getByText('去散步')).toBeTruthy();
    // 数值/图标不应出现
    expect(screen.queryByText('😊+4')).toBeNull();
    expect(screen.queryByText('💰-2')).toBeNull();
    // 箭头也不应出现（普通模式无任何提示）
    expect(screen.queryByText('↑')).toBeNull();
    expect(screen.queryByText('↓')).toBeNull();
  });

  it('真实模式：只显示倾向箭头（|v|≥8 双箭头），不显示数值', () => {
    render(
      <ChoicePanel
        choices={[choice('重注一把', { wealth: 10, luck: -4 })]}
        onSelect={vi.fn()}
        visible
        attributes={attrs}
        age={30}
        realMode
      />,
    );
    expect(screen.getByText('💰↑↑')).toBeTruthy();
    expect(screen.getByText('🍀↓')).toBeTruthy();
    expect(screen.queryByText('💰+10')).toBeNull();
  });

  it('隐藏时返回 null', () => {
    const { container } = render(
      <ChoicePanel choices={[choice('x', {})]} onSelect={vi.fn()} visible={false} attributes={attrs} age={30} realMode={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('点击选项触发 onSelect', () => {
    const onSelect = vi.fn();
    const ch = choice('去散步', { happiness: 4 });
    render(<ChoicePanel choices={[ch]} onSelect={onSelect} visible attributes={attrs} age={30} realMode={false} />);
    fireEvent.click(screen.getByText('去散步'));
    expect(onSelect).toHaveBeenCalledWith(ch);
  });
});
