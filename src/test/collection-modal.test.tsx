import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollectionModal from '../components/CollectionModal';
import { VERDICT_ROUTES } from '../engine/verdict';

describe('CollectionModal', () => {
  const endings = { startup_success: 1, doctor: 2 };

  it('渲染 16 条路线计数标题（已收集/总数）', () => {
    render(<CollectionModal endings={{ ...endings }} onClose={vi.fn()} />);
    expect(screen.getByText(`人生图鉴 · 2/${VERDICT_ROUTES.length}`)).toBeTruthy();
    expect(VERDICT_ROUTES.length).toBe(16);
    // 16 条路线全部渲染（含未收集的锁图标与已收集的已收集角标）
    expect(screen.getAllByText('🔒').length).toBe(VERDICT_ROUTES.length - 2);
    expect(screen.getAllByText('已收集').length).toBe(2);
  });

  it('已收集路线显示标题与完整 clue，未收集显示？？？与 hint 且不泄露 clue', () => {
    render(<CollectionModal endings={{ ...endings }} onClose={vi.fn()} />);
    for (const r of VERDICT_ROUTES) {
      const got = r.key === 'startup_success' || r.key === 'doctor';
      if (got) {
        expect(screen.getByText(r.title)).toBeTruthy();
        expect(screen.getByText(r.clue)).toBeTruthy();
      } else {
        // 未收集：标题隐藏为？？？、hint 可见、clue 不出现
        expect(screen.queryByText(r.title)).toBeNull();
        expect(screen.queryByText(r.clue)).toBeNull();
        expect(screen.getByText(r.hint)).toBeTruthy();
      }
    }
    expect(screen.getAllByText('？？？').length).toBe(VERDICT_ROUTES.length - 2);
    expect(screen.getAllByText('解锁后可见达成之路').length).toBe(VERDICT_ROUTES.length - 2);
    // 已收集路线的达成次数文案
    expect(screen.getByText('已达成 1 次')).toBeTruthy();
    expect(screen.getByText('已达成 2 次')).toBeTruthy();
  });

  it('全部收集后所有 clue 可见且无解锁提示', () => {
    const all = Object.fromEntries(VERDICT_ROUTES.map(r => [r.key, 1]));
    render(<CollectionModal endings={all} onClose={vi.fn()} />);
    expect(screen.queryByText('解锁后可见达成之路')).toBeNull();
    expect(screen.getAllByText('已收集').length).toBe(VERDICT_ROUTES.length);
    for (const r of VERDICT_ROUTES) {
      expect(screen.getByText(r.clue)).toBeTruthy();
    }
  });

  it('点击关闭按钮与遮罩层触发 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<CollectionModal endings={{}} onClose={onClose} />);
    fireEvent.click(screen.getByText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.firstElementChild as Element);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
