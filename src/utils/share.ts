import type { GameState } from '../types';
import { calcScore } from '../engine/state';

/** 深链基础地址：当前站点去掉 query/hash（GitHub Pages 与本地 preview 通用） */
export function shareBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}${window.location.pathname}`;
}

/** 种子挑战深链载荷：seed 决定同序列，from/score/age/title 承载发起人的对决信息 */
export interface ChallengeLink {
  seed: number;
  /** 发起人名字（展示「挑战 TA 的人生」） */
  from?: string;
  /** 发起人综合评分（对决目标：超过 TA 的分数） */
  score?: number;
  /** 发起人享年 */
  age?: number;
  /** 发起人结局标题 */
  title?: string;
}

/** 种子挑战深链：好友点开直接进入同一事件序列，并携带发起人对决信息 */
export function buildChallengeUrl(link: ChallengeLink, base = shareBaseUrl()): string {
  const params = new URLSearchParams();
  params.set('seed', String(link.seed));
  if (link.from) params.set('from', link.from);
  if (link.score != null) params.set('score', String(link.score));
  if (link.age != null) params.set('age', String(link.age));
  if (link.title) params.set('title', link.title);
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${params.toString()}`;
}

/**
 * 解析深链中的种子挑战载荷；缺 seed、seed 非法或超界返回 null。
 * from/title 截断长度，score/age 仅接受纯数字。
 */
export function parseChallengeLink(search: string): ChallengeLink | null {
  try {
    const params = new URLSearchParams(search);
    const seedRaw = params.get('seed');
    if (!seedRaw || !/^\d+$/.test(seedRaw)) {
      return null;
    }
    const seed = Number(seedRaw);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 2 ** 31) {
      return null;
    }
    const link: ChallengeLink = { seed };
    const from = params.get('from');
    if (from) link.from = from.slice(0, 8);
    const score = params.get('score');
    if (score && /^\d+$/.test(score)) link.score = Number(score);
    const age = params.get('age');
    if (age && /^\d+$/.test(age)) link.age = Number(age);
    const title = params.get('title');
    if (title) link.title = title.slice(0, 20);
    return link;
  } catch {
    return null;
  }
}

/** 分享文案（不含链接；链接由调用方通过 buildChallengeUrl 拼入 url 字段） */
export function buildShareText(game: GameState, verdictTitle: string, seed?: number): string {
  const score = calcScore(game.attributes);
  const head = `我在《人生模拟器》里走完了「${verdictTitle}」，享年 ${game.age} 岁，综合评分 ${score}。`;
  const tail = seed != null
    ? `🔑 种子 ${seed}：同样的牌，看谁打出更好的一生。`
    : '如果重来一次，你会怎么选？';
  return `${head}\n${tail}`;
}

export interface SharePayload {
  title?: string;
  text: string;
  url?: string;
  image?: File | null;
}

export type ShareResult = 'shared' | 'copied' | 'unsupported';

/**
 * 优先系统分享（Web Share API，移动端/支持分享的桌面端），失败或不可用回退剪贴板复制。
 * 用户主动取消（AbortError）视为已处理，不再回退复制，避免二次打扰。
 */
export async function shareViaSystem(payload: SharePayload): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function') {
    const data: ShareData = { title: payload.title, text: payload.text, url: payload.url };
    if (payload.image && typeof nav.canShare === 'function' && nav.canShare({ files: [payload.image] })) {
      data.files = [payload.image];
    }
    try {
      await nav.share(data);
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'shared';
      }
    }
  }
  const copyText = [payload.text, payload.url].filter(Boolean).join('\n');
  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(copyText);
      return 'copied';
    } catch {
      // 忽略，走 unsupported
    }
  }
  return 'unsupported';
}

/** canvas → PNG File（系统分享带图用；不支持时返回 null） */
export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], name, { type: 'image/png' }) : null);
      }, 'image/png');
    } catch {
      resolve(null);
    }
  });
}
