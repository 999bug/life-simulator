import { ATTR_META } from '../engine/state';
import type { AttributeKey } from '../types';
import { LIFE_ROUTES } from '../engine/routes';

interface Props {
  onClose: () => void;
}

/** 属性一句话说明（ATTR_META 提供图标/名称/颜色，此处补充玩法语义） */
const ATTR_DESC: Record<AttributeKey, string> = {
  health: '归零即死亡；65 岁起每个事件自然衰减',
  intelligence: '学业与事业路线的钥匙',
  wealth: '选择的本钱，许多机会需要花钱',
  happiness: '影响评分与部分结局',
  social: '人缘、朋友与贵人线',
  appearance: '爱情与际遇线',
  luck: '稀有事件的隐形门槛',
  morality: '抉择的分量，影响结局评价',
};

/** 玩法说明模态：首次进入自动弹出，也可从标题页「❓ 玩法」随时打开 */
export default function GuideModal({ onClose }: Props) {
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] max-h-[86vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">❓ 怎么玩</h3>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">🎮 一句话</h4>
          <p className="text-[12px] text-white/55 leading-relaxed">
            从 0 岁活到寿终：每个事件读一段人生、做一次选择，选择改变八项属性；属性决定寿命长短、能触发的事件与最终的结局评价。
          </p>
        </section>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">🎭 开局选一条人生路线</h4>
          <p className="text-[12px] text-white/55 leading-relaxed mb-2">
            想体验某一种活法，开局可以直接选——每条都有专属剧情与结局；选「自由人生」则随机展开。
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LIFE_ROUTES.map(r => (
              <span key={r.key} className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-white/60">
                {r.icon} {r.name}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">📊 八项属性</h4>
          <div className="flex flex-col gap-1">
            {(Object.keys(ATTR_META) as AttributeKey[]).map(k => (
              <div key={k} className="flex items-baseline gap-2 text-[12px]">
                <span className="shrink-0 w-[62px]" style={{ color: ATTR_META[k].color }}>{ATTR_META[k].icon} {ATTR_META[k].name}</span>
                <span className="text-white/45 leading-relaxed">{ATTR_DESC[k]}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/35 leading-relaxed mt-1.5">
            数值条按当前年龄上限填充，变金 = 已达上限；接近上限时正向收益会衰减（反馈中标注「距上限 X 点」）。
          </p>
        </section>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">🎯 选项怎么读</h4>
          <p className="text-[12px] text-white/55 leading-relaxed">
            凭直觉选择就好——选项不显示数值，选完后的反馈页才告诉你这一选择带来的属性变化。有些选择还会埋下看不见的「标记」，在多年后开出回响事件。真实模式（多周目解锁）也只显示 ↑/↓ 倾向箭头。
          </p>
        </section>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">⏱️ 节奏与打字</h4>
          <p className="text-[12px] text-white/55 leading-relaxed">
           沉浸人生：全部 752 个事件，一局 1.5-3 小时；精简人生：每岁精选 1-2 个事件，约 30 分钟。打字速度在游戏内右下角随时切换，点击对话框直接显示全文。
          </p>
        </section>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">🏆 局外成长</h4>
          <ul className="text-[12px] text-white/55 leading-relaxed list-none flex flex-col gap-1">
            <li>· 开局可选人生目标，结算时判定达成</li>
            <li>· 3 个存档槽可自由切换，随时退出随时继续</li>
            <li>· 走完的每一生都写入家族族谱，下一代继承上一世的际遇</li>
            <li>· 多周目逐步解锁：挑战开局、真实模式、命运事件、传承加成</li>
            <li>· 42 个成就、16 条结局路线图鉴等你收集</li>
          </ul>
        </section>

        <section>
          <h4 className="text-[13px] tracking-[3px] text-[#c9a96e] mb-1.5">⚡ 快捷入口</h4>
          <p className="text-[12px] text-white/55 leading-relaxed">
            快速模拟：30 秒看完一生；每日挑战：同一天所有人面对同一局；种子挑战：输入好友分享的种子码挑战同一局；结算页还能一键分享人生卡、和好友比谁活得更漂亮。
          </p>
        </section>

        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto mt-1
            border-[#c9a96e]/50 text-[#c9a96e] hover:bg-[#c9a96e]/10"
        >
          开始我的人生
        </button>
      </div>
    </div>
  );
}
