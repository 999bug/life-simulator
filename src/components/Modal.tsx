import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  /** 指向弹窗标题的 id，供 aria-labelledby 使用 */
  labelledBy?: string;
  /** 弹窗面板样式，替代默认内边距与尺寸 */
  contentClassName?: string;
}

/**
 * 基础可访问弹窗：背景点击关闭、Escape 关闭、焦点锁定与恢复。
 * 调用方负责提供 dialog 内的标题、内容和操作按钮。
 */
export default function Modal({ children, onClose, labelledBy, contentClassName }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const content = contentRef.current;
    const focusables = content
      ? Array.from(content.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        ))
      : [];

    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      content?.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`max-w-[92vw] rounded-2xl border border-white/15 bg-[#10101f] shadow-2xl shadow-black/70 p-6 ${contentClassName ?? ''}`}
      >
        {children}
      </div>
    </div>
  );
}
