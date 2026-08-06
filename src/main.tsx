import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import ReloadPrompt from './components/ReloadPrompt';
import { loadEvents } from './engine/events';
import './index.css';

/** 事件数据加载失败时的静态兜底（React 尚未挂载，DOM 直建避免 innerHTML） */
function renderLoadError(root: HTMLElement) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;'
    + 'background:radial-gradient(ellipse at center,#1a1a30 0%,#0a0a14 70%);color:#fff;font-family:sans-serif;';

  const title = document.createElement('p');
  title.style.cssText = 'color:#c9a96e;font-size:20px;letter-spacing:6px;';
  title.textContent = '事件数据加载失败';

  const desc = document.createElement('p');
  desc.style.cssText = 'color:rgba(255,255,255,0.5);font-size:13px;letter-spacing:2px;';
  desc.textContent = '请检查网络连接后刷新重试';

  const btn = document.createElement('button');
  btn.style.cssText = 'padding:10px 32px;border-radius:30px;border:none;cursor:pointer;'
    + 'background:linear-gradient(to right,#c9a96e,#a88b4e);color:#1a1a2e;font-weight:bold;letter-spacing:3px;';
  btn.textContent = '刷 新';
  btn.addEventListener('click', () => location.reload());

  wrap.append(title, desc, btn);
  root.replaceChildren(wrap);
}

// 先加载事件数据（public/events.json，SW precache 离线可用），就绪后再挂载 React
loadEvents()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
          <ReloadPrompt />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  })
  .catch((err: unknown) => {
    console.error('Failed to load events:', err);
    renderLoadError(document.getElementById('root')!);
  });
