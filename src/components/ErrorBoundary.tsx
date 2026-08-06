import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * 全局错误边界：任何组件渲染抛错时兜底，避免白屏无出口。
 * 提供「刷新重试」与「清除本地数据重来」（存档损坏场景）两个出口。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI crashed:', error, info.componentStack);
  }

  /** 清除全部本地数据（存档/成就/统计/族谱）后刷新，用于存档损坏导致的反复崩溃 */
  private handleWipe = () => {
    localStorage.clear();
    location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center gap-6
        bg-[radial-gradient(ellipse_at_center,#1a1a30_0%,#0a0a14_70%)] text-white px-6">
        <p className="text-2xl font-extralight tracking-[6px] text-[#c9a96e]">人生打了个盹</p>
        <p className="text-sm text-white/50 tracking-[2px] text-center leading-relaxed">
          页面出了点问题。先试试刷新；如果反复出现，可能是本地存档损坏。
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => location.reload()}
            className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] font-sans
              bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold"
          >
            刷新重试
          </button>
          <button
            onClick={this.handleWipe}
            className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] font-sans
              border border-white/20 text-white/50 hover:border-[#c9a96e]/60 hover:text-[#c9a96e]"
          >
            清除数据重来
          </button>
        </div>
      </div>
    );
  }
}
