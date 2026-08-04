import type { GameState } from '../types';

/** 单槽存档数据（与旧版 SaveData 结构一致） */
export interface SaveData {
  game: GameState;
  currentEventId: string | null;
  feedback: string | null;
  eventIndex: number;
  shuffleSeed: number;
  paceMode?: 'full' | 'lite';
  typeSpeed?: 'slow' | 'normal' | 'fast';
}

/** v2 存档：active 槽 + 3 槽位 */
export interface SavesV2 {
  active: number;
  slots: (SaveData | null)[];
}

/** 存档槽位数 */
export const SLOT_COUNT = 3;

/** 空存档结构 */
export function emptySaves(): SavesV2 {
  return { active: 0, slots: [null, null, null] };
}

/**
 * 旧版单槽存档（life-sim-save-v1）迁移到 v2 结构。
 *
 * @param raw v1 存档 JSON 字符串
 * @returns 迁入槽 0 的 v2 结构
 * @throws 非法 JSON 时抛出
 */
export function migrateLegacySave(raw: string): SavesV2 {
  const data = JSON.parse(raw) as SaveData;
  return { active: 0, slots: [data, null, null] };
}
