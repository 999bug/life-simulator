import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// 每个用例后卸载组件树，避免 DOM 残留
afterEach(() => {
  cleanup();
  // 恢复真实定时器，防止 fake timers 泄漏到其他用例
  vi.useRealTimers();
});
