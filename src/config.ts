/**
 * 后端 API 基础地址。
 *
 * 已部署后默认指向当前 Worker；如以后换域名，可在构建时用环境变量覆盖：
 *   VITE_API_BASE=https://life-simulator.其他域名.workers.dev npm run build
 */
const DEFAULT_API_BASE = 'https://life-simulator.example.workers.dev';
const rawApiBase = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE = (rawApiBase || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
