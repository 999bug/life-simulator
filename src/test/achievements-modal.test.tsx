import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AchievementsModal from '../components/AchievementsModal';
import { ACHIEVEMENTS } from '../engine/achievements';
import type { AchievementId } from '../types';

describe('AchievementsModal', () => {
  const unlocked: AchievementId[] = ['first_life', 'rich'];

  it('渲染成就计数标题（已解锁/总数）', () => {
    render(<AchievementsModal unlocked={[...unlocked]} onClose={vi.fn()} />);
    expect(screen.getByText(`成就 · ${unlocked.length}/${ACHIEVEMENTS.length}`)).toBeTruthy();
  });

  it('渲染完整成就列表：已解锁显示图标，未解锁显示锁', () => {
    render(<AchievementsModal unlocked={[...unlocked]} onClose={vi.fn()} />);
    // 已解锁与可见成就名渲染；未解锁的隐藏成就只露问号
    let hiddenUnlockedCount = 0;
    for (const a of ACHIEVEMENTS) {
      if (a.hidden && !unlocked.includes(a.id)) {
        hiddenUnlockedCount += 1;
        expect(screen.queryByText(a.name)).toBeNull();
      } else {
        expect(screen.getByText(a.name)).toBeTruthy();
      }
    }
    expect(screen.getAllByText('？？？').length).toBe(hiddenUnlockedCount);
    // 解锁的显示成就图标（first_life 为 👶、rich 为 💎）
    expect(screen.getByText('👶')).toBeTruthy();
    expect(screen.getByText('💎')).toBeTruthy();
    // 其余可见成就显示 🔒；隐藏成就显示 ❓
    const hiddenCount = ACHIEVEMENTS.filter(a => a.hidden).length;
    expect(screen.getAllByText('🔒').length).toBe(ACHIEVEMENTS.length - unlocked.length - hiddenCount);
    expect(screen.getAllByText('❓').length).toBe(hiddenCount);
  });

  it('隐藏成就解锁后显示真实名称', () => {
    render(<AchievementsModal unlocked={[...unlocked, 'gaokao_top' as const]} onClose={vi.fn()} />);
    expect(screen.getByText('金榜题名')).toBeTruthy();
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
