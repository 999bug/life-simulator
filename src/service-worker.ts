/// <reference lib="webworker" />
/**
 * 离线 Service Worker（injectManifest 手写实现）。
 *
 * 背景：vite-plugin-pwa 的 generateSW 模式在本项目（singlefile 单文件构建）下
 * precache 从不生效（workbox 模块 importScripts 失败，SW 成为空壳——线上实测
 * 「已可离线游玩」提示为假）。改为手写 SW：逻辑完全可控可调试。
 *
 * 策略：
 * - install：precache 清单（构建时 __WB_MANIFEST 注入）全量入版本化缓存
 * - message：收到 ReloadPrompt 的 SKIP_WAITING 后再接管，避免游戏进行中被强制刷新
 * - activate：清理旧版本缓存 + 立即接管控制
 * - fetch：导航请求 network-first 回退 index.html；其余同源 GET cache-first
 */
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
declare const __BUILD_VERSION__: string;

/**
 * precache 清单：构建时由 vite-plugin-pwa 注入（dist 产物文件名）。
 * 注入清单可能含重复 URL（glob 扫描 + manifest/icons 自动附加），
 * Cache.addAll 对重复请求抛 InvalidStateError 导致 install 失败——此处 Set 去重。
 */
const PRECACHE_ENTRIES = [
  ...new Map((self.__WB_MANIFEST || []).map(entry => [entry.url, entry])).values(),
];

/**
 * 构建期注入稳定版本号，避免 Service Worker 被休眠后重启时顶层代码重新执行
 * 导致缓存名变化。旧 SW 继续读旧缓存，新 SW
 * 安装完成后接管并清理旧缓存，避免新旧入口文件在同一缓存中互相覆盖。
 */
const CACHE_NAME = `life-sim-cache-${__BUILD_VERSION__}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_ENTRIES.map(entry => entry.url));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 清理旧版本缓存（缓存名变更即旧版）
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // 仅拦截同源请求（跨域资源不缓存）
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith((async () => {
    // 导航请求优先访问网络，保证大版本部署后普通刷新即可拿到新 index.html；
    // 离线时回退到缓存的单文件入口。
    if (event.request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          await cache.put('index.html', response.clone());
        }
        return response;
      } catch {
        const index = await cache.match('index.html');
        return index ?? Response.error();
      }
    }

    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) {
      return cached;
    }

    const response = await fetch(event.request);
    if (event.request.method === 'GET' && response.ok) {
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
