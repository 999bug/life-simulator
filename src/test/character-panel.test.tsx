import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import CharacterPanel from '../components/CharacterPanel';
import { setEvents } from '../engine/events';
import { EMPTY_PERSONA, type PersonaState } from '../engine/personality';

/** 构造画像：空画像基础上叠加指定端次数 */
function personaOf(overrides: Partial<PersonaState>): PersonaState {
  return { ...EMPTY_PERSONA, ...overrides };
}

beforeEach(() => {
  // 注入真实事件数据：专属际遇阈值来自 EVENTS 的 minPersonality 条件（6 个 pers_ 事件，阈值 6）
  setEvents(JSON.parse(readFileSync('public/events.json', 'utf-8')));
});

describe('CharacterPanel', () => {
  it('渲染 3 维 6 端标签（全零画像条为中性色；左端 icon+名、右端 名+icon）', () => {
    render(<CharacterPanel persona={personaOf({})} />);
    expect(screen.getByText('🧠 理性')).toBeTruthy();
    expect(screen.getByText('感性 😊')).toBeTruthy();
    expect(screen.getByText('⚡ 冒险')).toBeTruthy();
    expect(screen.getByText('安稳 🏠')).toBeTruthy();
    expect(screen.getByText('💰 利己')).toBeTruthy();
    expect(screen.getByText('利他 🤝')).toBeTruthy();
  });

  it('条形 title 展示两端累积次数', () => {
    render(<CharacterPanel persona={personaOf({ rational: 2, emotional: 1 })} />);
    // title 挂在维度行外层 div 上，文本所在 span 需向上取最近带 title 的元素
    expect(screen.getByText('🧠 理性').closest('[title]')?.getAttribute('title')).toBe('理性 2 次 · 感性 1 次');
  });

  it('当前值低于阈值时显示距专属际遇还差 N 次', () => {
    render(<CharacterPanel persona={personaOf({ adventurous: 3 })} />);
    expect(screen.getByText('⚡ 冒险 · 距专属际遇还差 3 次')).toBeTruthy();
    expect(screen.getByText('🧠 理性 · 距专属际遇还差 6 次')).toBeTruthy();
    expect(screen.getByText('🏠 安稳 · 距专属际遇还差 6 次')).toBeTruthy();
  });

  it('达标时显示专属际遇已解锁', () => {
    render(<CharacterPanel persona={personaOf({ adventurous: 6, emotional: 8 })} />);
    expect(screen.getByText('⚡ 冒险 · 专属际遇已解锁 ✨')).toBeTruthy();
    expect(screen.getByText('😊 感性 · 专属际遇已解锁 ✨')).toBeTruthy();
  });

  it('无 minPersonality 事件时不显示专属际遇区块', () => {
    setEvents([]);
    render(<CharacterPanel persona={personaOf({})} />);
    expect(screen.queryByText('专属际遇')).toBeNull();
  });
});
