import type { GameState } from '../types';
import { calcScore } from './state';
import { derivePersona, type PersonaTrait } from './personality';

/** 路线专属称号（识别度高、最有传播力的结局直接给专属头衔） */
const ROUTE_TITLES: Record<string, string> = {
  startup_success: '创业弄潮儿',
  world_traveler: '永远在路上的旅人',
  grad_school: '学术卷王',
  top_university: '别人家的孩子',
  retake: '逆风翻盘者',
  doctor: '白衣天使',
  military_flag: '铁血硬汉',
  athlete_pro: '赛场传奇',
  artist: '灵魂画手',
  tech_career: '代码魔法师',
  escaped: '亡命之徒',
  gang_boss: '地下教父',
  jailed: '铁窗浪子',
  civil_servant: '体制内体面人',
  skilled_worker: '大国工匠',
  went_to_college: '知识改变命运',
};

/** 性格 Top 端 → 称号（画像成形、某端 ≥ 10 才命中） */
const PERSONA_TITLES: Record<PersonaTrait, string> = {
  rational: '人间清醒',
  emotional: '感性之人',
  adventurous: '说走就走的冒险家',
  cautious: '稳如老狗',
  selfish: '精致的利己主义者',
  altruistic: '人间暖阳',
};

function scoreTitle(score: number): string {
  if (score >= 75) return '人生赢家';
  if (score >= 60) return '小有成就';
  if (score >= 45) return '平凡英雄';
  if (score >= 30) return '摸爬滚打';
  return '艰难求生';
}

/**
 * 结算称号（确定性，无随机）：路线专属 > 财富 > 性格 > 评分档。
 * 用于结算页/分享卡，是「再来一局」与传播的社交货币。
 */
export function deriveTitle(game: GameState, endingKey: string): string {
  const routeTitle = ROUTE_TITLES[endingKey];
  if (routeTitle) {
    return routeTitle;
  }
  if (game.attributes.wealth >= 88) {
    return '隐形富豪';
  }
  const persona = derivePersona(game.history);
  const top = (Object.keys(PERSONA_TITLES) as PersonaTrait[])
    .filter(t => persona[t] >= 10)
    .sort((a, b) => persona[b] - persona[a])[0];
  if (top) {
    return PERSONA_TITLES[top];
  }
  return scoreTitle(calcScore(game.attributes));
}
