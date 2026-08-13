import { sfx } from '../utils/sound';
import { useId } from 'react';
import Modal from './Modal';

interface Props {
  title: string;
  desc: string;
  /** 第三选项（如局中重开）；不传则不显示 */
  extra?: { label: string; onExtra: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

/** 轻量确认模态（覆盖存档/中途退出共用） */
export default function ConfirmModal({ title, desc, extra, onConfirm, onCancel }: Props) {
  const titleId = useId();
  return (
    <Modal onClose={onCancel} labelledBy={titleId} contentClassName="w-[380px] flex flex-col gap-4 items-center">
        <h3 id={titleId} className="text-[16px] tracking-[4px] text-[#c9a96e]">{title}</h3>
        <p className="text-[12px] text-white/75 leading-relaxed text-center">{desc}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-1">
          <button
            onClick={() => { sfx.select(); onCancel(); }}
            className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            取消
          </button>
          {extra && (
            <button
              onClick={() => { sfx.select(); extra.onExtra(); }}
              className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
                border-[#c9a96e]/50 text-[#c9a96e] hover:bg-[#c9a96e]/10"
            >
              {extra.label}
            </button>
          )}
          <button
            onClick={() => { sfx.select(); onConfirm(); }}
            className="px-6 py-2 rounded-[30px] text-[12px] tracking-[3px] border font-sans
              border-[#e85d75]/60 text-[#e85d75] bg-[#e85d75]/10 hover:bg-[#e85d75]/20"
          >
            确定
          </button>
        </div>
    </Modal>
  );
}
