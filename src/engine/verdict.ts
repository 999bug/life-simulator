import type { GameState } from '../types';
import { calcScore } from './state.ts';

/**
 * 结局判定 key：路线 flag 优先，无则按分数档。
 * 与 SummaryScreen.getVerdict 的判定顺序一致（仅取 key，不含文案）。
 */
export function verdictKey(game: GameState): string {
  const { flags, attributes } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const order: Array<[string, string[]]> = [
    ['startup_success', ['startup_success']],
    ['world_traveler', ['world_traveler']],
    ['grad_school', ['grad_school']],
    ['top_university', ['top_university']],
    ['retake', ['retake']],
    ['doctor', ['doctor']],
    ['military_flag', ['military_flag']],
    ['athlete_pro', ['athlete_pro']],
    ['artist', ['artist_pro', 'artist_life']],
    ['tech_career', ['tech_career']],
    ['went_to_college', ['went_to_college']],
    ['skilled_worker', ['skilled_worker']],
    ['civil_servant', ['civil_servant']],
  ];
  for (const [key, fs] of order) {
    if (has(...fs)) {
      return key;
    }
  }
  const score = calcScore(attributes);
  return score >= 75 ? 'score:75+' : score >= 60 ? 'score:60+' : score >= 45 ? 'score:45+' : score >= 30 ? 'score:30+' : 'score:low';
}
