import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    VitePWA({
      registerType: 'autoUpdate',
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
