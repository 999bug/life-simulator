/// <reference lib="webworker" />
/**
 * 离线 Service Worker（injectManifest 手写实现）。
 *
 * 背景：vite-plugin-pwa 的 generateSW 模式在本项目（singlefile 单文件构建）下
 * precache 从不生效（workbox 模块 importScripts 失败，SW 成为空壳——线上实测
 * 「已可离线游玩」提示为假）。改为手写 SW：逻辑完全可控可调试。
 *
 * 策略：
 * - install：precache 清单（构建时 __WB_MANIFEST 注入）全量入缓存
 * - activate：清理旧版本缓存 + 立即接管控制
 * - fetch：同源请求 cache-first；导航请求回退 index.html；其余走网络
 */
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

/** 当前 SW 版本缓存名（升级时换名即清旧缓存） */
const CACHE_NAME = 'life-sim-cache-v1';

/**
 * precache 清单：构建时由 vite-plugin-pwa 注入（dist 产物文件名）。
 * 注入清单可能含重复 URL（glob 扫描 + manifest/icons 自动附加），
 * Cache.addAll 对重复请求抛 InvalidStateError 导致 install 失败——此处 Set 去重。
 */
const MANIFEST: string[] = [...new Set((self.__WB_MANIFEST || []).map(e => e.url))];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(MANIFEST);
    await self.skipWaiting();
  })());
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
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) {
      return cached;
    }
    // 导航请求（离线刷新页面）：回退到缓存的 index.html（singlefile 单文件，全部应用代码在其中）
    if (event.request.mode === 'navigate') {
      const index = await cache.match('index.html');
      if (index) {
        return index;
      }
    }
    return fetch(event.request);
  })());
});
