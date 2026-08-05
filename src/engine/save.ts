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
  /** 本局命运事件 id（第 3 周目解锁，读档还原；旧档无此字段） */
  fateEventId?: string | null;
  /** 本局命运事件 id 列表（第 5 周目起 2 个；旧档无此字段，读档回退单元素） */
  fateEventIds?: string[];
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
 * 校验单槽存档数据是否合法（game 存在且 eventIndex 为 number）。
 *
 * @param data 未知数据（JSON 解析结果）
 * @returns 是否为合法的 SaveData
 */
export function isValidSaveData(data: unknown): data is SaveData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const d = data as Partial<SaveData>;
  return typeof d.game === 'object' && d.game !== null && typeof d.eventIndex === 'number';
}

/**
 * 旧版单槽存档（life-sim-save-v1）迁移到 v2 结构。
 *
 * @param raw v1 存档 JSON 字符串
 * @returns 迁入槽 0 的 v2 结构
 * @throws 非法 JSON 或存档内容不合法时抛出
 */
export function migrateLegacySave(raw: string): SavesV2 {
  const data = JSON.parse(raw) as SaveData;
  if (!isValidSaveData(data)) {
    throw new Error('Invalid legacy save data');
  }
  return { active: 0, slots: [data, null, null] };
}
