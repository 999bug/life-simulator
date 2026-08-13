import type { Attributes, GameState } from '../types';
import { calcScore } from './state';
import { verdictKey } from './verdict';

/** 好友人生档案导出格式（纯前端好友间互发对比，不涉及后端） */
export interface LifeExport {
  app: 'life-simulator';
  version: 1;
  name: string;
  gender: 'male' | 'female';
  age: number;
  score: number;
  endingKey: string;
  endingTitle: string;
  attributes: Attributes;
  /** 本局洗牌种子（好友可输入该种子挑战同一事件序列） */
  seed?: number;
  /** 完成日期 YYYYMMDD */
  date: string;
}

const ATTR_KEYS: Array<keyof Attributes> = [
  'health', 'intelligence', 'wealth', 'happiness', 'social', 'appearance', 'luck', 'morality',
];

/** 从本局终局状态构建可导出的人生档案 */
export function buildLifeExport(game: GameState, verdictTitle: string, seed: number | undefined, date: string): LifeExport {
  return {
    app: 'life-simulator',
    version: 1,
    name: game.name,
    gender: game.gender,
    age: game.age,
    score: calcScore(game.attributes),
    endingKey: verdictKey(game),
    endingTitle: verdictTitle,
    attributes: { ...game.attributes },
    seed,
    date,
  };
}

/** 解析并校验导入的人生档案 JSON；非法/损坏返回 null */
export function parseLifeExport(raw: string): LifeExport | null {
  try {
    const data = JSON.parse(raw) as LifeExport;
    if (!data || data.app !== 'life-simulator' || data.version !== 1) {
      return null;
    }
    if (typeof data.name !== 'string' || typeof data.age !== 'number' || typeof data.score !== 'number') {
      return null;
    }
    if (typeof data.endingTitle !== 'string' || typeof data.endingKey !== 'string') {
      return null;
    }
    if (typeof data.attributes !== 'object' || data.attributes === null || Array.isArray(data.attributes)) {
      return null;
    }
    for (const k of ATTR_KEYS) {
      if (typeof data.attributes[k] !== 'number') {
        return null;
      }
    }
    if (data.seed != null && (!Number.isSafeInteger(data.seed) || data.seed < 0 || data.seed >= 2 ** 31)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
