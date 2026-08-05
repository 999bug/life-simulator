import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AchievementsModal from '../components/AchievementsModal';
import { ACHIEVEMENTS } from '../engine/achievements';

describe('AchievementsModal', () => {
  const unlocked = ['first_life', 'rich'] as const;

  it('渲染成就计数标题（已解锁/总数）', () => {
    render(<AchievementsModal unlocked={[...unlocked]} onClose={vi.fn()} />);
    expect(screen.getByText(`成就 · ${unlocked.length}/${ACHIEVEMENTS.length}`)).toBeTruthy();
  });

  it('渲染完整成就列表：已解锁显示图标，未解锁显示锁', () => {
    render(<AchievementsModal unlocked={[...unlocked]} onClose={vi.fn()} />);
    // 全部成就名都渲染
    for (const a of ACHIEVEMENTS) {
      expect(screen.getByText(a.name)).toBeTruthy();
    }
    // 解锁的显示成就图标（first_life 为 👶、rich 为 💎）
    expect(screen.getByText('👶')).toBeTruthy();
    expect(screen.getByText('💎')).toBeTruthy();
    // 其余显示 🔒
    expect(screen.getAllByText('🔒').length).toBe(ACHIEVEMENTS.length - unlocked.length);
  });

  it('点击关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    render(<AchievementsModal unlocked={[]} onClose={onClose} />);
    fireEvent.click(screen.getByText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩层触发 onClose，点击面板内部不触发', () => {
    const onClose = vi.fn();
    const { container } = render(<AchievementsModal unlocked={[]} onClose={onClose} />);
    fireEvent.click(container.firstElementChild as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText(`成就 · 0/${ACHIEVEMENTS.length}`));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
