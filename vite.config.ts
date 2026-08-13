import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

const buildVersion = Date.now().toString(36);

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    viteSingleFile(),
    VitePWA({
      // prompt 模式：新版本就绪由 ReloadPrompt 弹条让玩家自选刷新时机（autoUpdate 会在游戏进行中无感刷新导致丢局）
      registerType: 'prompt',
      // injectManifest 手写 SW（generateSW 在本项目 singlefile 构建下 precache 失效，见 src/service-worker.ts 头部说明）
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      // 事件数据（public/events.json）纳入 precache，保障离线首启可用
      injectManifest: {
        globPatterns: ['**/*.{html,json,png,webmanifest}'],
      },
      manifest: {
        name: '人生模拟器',
        short_name: '人生模拟',
        display: 'standalone',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      }
    })
  ],
  base: './',
  server: {
    port: 5173,
    open: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    // 只收 UI 测试；script/ 下 node:test 风格的引擎测试由 npm run test 负责
    include: ['src/test/**/*.test.{ts,tsx}']
  }
});
