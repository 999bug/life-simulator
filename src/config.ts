/**
 * 后端 API 基础地址。
 *
 * 默认留空，表示「未配置后端」——前端会静默跳过所有 API，可完全离线游玩。
 * 部署时通过环境变量注入自己的 Worker 地址，避免 fork、测试环境或恶意站点误写生产数据：
 *   VITE_API_BASE=https://life-simulator.<你的子域>.workers.dev npm run build
 */
const rawApiBase = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE = (rawApiBase ?? '').trim().replace(/\/+$/, '');
