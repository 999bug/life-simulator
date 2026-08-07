import type { GameState } from '../types';

/** 退休年龄（按性别：女性 55 / 男性 60，对标中国法定退休年龄） */
export function retirementAge(gender: 'male' | 'female'): number {
  return gender === 'female' ? 55 : 60;
}

/**
 * 是否已退休：事件链产出过 retired flag（如退休事件），或年龄达到性别退休年龄。
 * 纯函数推导，不占用存档字段（retired flag 由事件产出，年龄线是兜底展示）。
 *
 * @param game 本局状态
 * @returns 是否已退休
 */
export function isRetired(game: GameState): boolean {
  return game.flags.includes('retired') || game.age >= retirementAge(game.gender);
}
