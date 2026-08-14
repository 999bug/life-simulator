/**
 * 后端 API 基础地址。
 *
 * 默认留空 = 未接入后端：所有排行榜/云存档请求都会静默跳过，游戏照常游玩。
 * 部署后可在构建时设置环境变量，例如：
 *   VITE_API_BASE=https://life-simulator-api.<你的子域>.workers.dev npm run build
 */
const rawApiBase = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE = (rawApiBase ?? '').trim().replace(/\/+$/, '');
