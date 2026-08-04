# 条件可见性 + 分享卡片 + 老年内容 实现计划（第三弹）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 三模块：结算页展示「本可发生而未触发的事件」（条件可见性）；canvas 生成人生总结分享卡片；76-95 岁补 15 个老年事件。

**Architecture:** `findNextEvent` 改为返回 `{ event, skipped }` 收集条件不满足的事件，累积到 `RuntimeState.skippedEvents`，结算页渲染；分享卡片为纯 canvas 组件（`ShareCardModal`）；老年事件走 chiled.json 数据管线。

**Tech Stack:** TypeScript、React 18、Canvas 2D、Node 22 test runner。

## Global Constraints

- 所有注释中文、日志英文
- 不改 `src/engine/events.json` 生成文件（数据改动走 chiled.json + build:events）
- **效果键必须取自 ATTR_MAP 107 键**（上弹教训：morality 是引擎属性名，原始键是 empathy/discipline；常见合法键：health/money/happiness/social/appearance/luck/empathy/discipline/memory/learning/confidence/security/comfort/freedom/stability/resilience/fun/family_relation/relationship）
- 效果值 ±3~±20（原版 ±2 先例可容忍，尽量 ≥3）
- 新事件不用 flag（conditions 空对象），避免 flag 配对校验
- skippedEvents 不进存档
- 提交信息：中文 subject + 前缀（[NF]/[BF]/[CU]/[IM]），body `- ` 列表，无 AI 署名
- 类型检查：`npx tsc --noEmit`；引擎测试：`node --experimental-strip-types --test script/*.test.ts`（展开文件名）；数据工具：`node --test "script/*.test.mjs"`

---

### Task 1: 条件可见性（findNextEvent 收集 + 结算页展示）

**Files:**
- Modify: `src/hooks/useGame.ts`
- Modify: `src/components/SummaryScreen.tsx`

**Interfaces:**
- Produces: `RuntimeState.skippedEvents: LifeEvent[]`；useGame 返回 `skippedEvents`

- [ ] **Step 1: findNextEvent 改造（useGame.ts）**

```ts
/** 从 fromIndex 之后线性扫描：返回第一个满足条件的事件与扫描中跳过的所有事件（条件不满足） */
function findNextEvent(game: GameState, fromIndex: number, events: LifeEvent[]): { event: LifeEvent | null; skipped: LifeEvent[] } {
  const skipped: LifeEvent[] = [];
  for (let i = fromIndex + 1; i < events.length; i++) {
    if (checkConditions(events[i], game)) {
      return { event: events[i], skipped };
    }
    skipped.push(events[i]);
  }
  return { event: null, skipped };
}
```

调用处全部适配：
- `START_GAME`/`START_AUTO_GAME` 分支：

```ts
      const firstScan = findNextEvent(game, -1, shuffledEvents);
      const first = firstScan.event;
      if (first) {
        game.age = first.age;
        game.stage = getStageForAge(first.age);
        game.stageIdx = STAGE_ORDER.indexOf(game.stage);
      }
      // 返回值加：skippedEvents: firstScan.skipped,
```

（原代码 `shuffledEvents.find(e => checkConditions(e, game))` 改为 findNextEvent(game, -1, ...)——fromIndex -1 使循环从 0 开始，语义一致）

- `MAKE_CHOICE` 分支：

```ts
      const nextScan = findNextEvent({ ...state.game, attributes: attrs, flags }, state.eventIndex, state.shuffledEvents);
      const next = nextScan.event;
      // 返回值加：skippedEvents: [...state.skippedEvents, ...nextScan.skipped],
```

- `CONTINUE_GAME` 分支：`skippedEvents: []`（读档后从头记录）

`RuntimeState` 接口加 `skippedEvents: LifeEvent[];`；`createInitialRuntime` 加 `skippedEvents: [],`。

- [ ] **Step 2: 结算页展示区块（SummaryScreen.tsx）**

Props 加 `skippedEvents: LifeEvent[]`。时间线之后、回到标题按钮之前加：

```tsx
      {/* 本可发生而未触发的事件（条件未满足被跳过） */}
      {skippedEvents.length > 0 && (
        <div className="w-full max-w-[580px] animate-[fadeIn_1.5s_ease]">
          <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">👻 本可发生而未触发</h3>
          <p className="text-[11px] text-white/35 mb-2">这一生有 {skippedEvents.length} 个事件因条件未满足而未曾发生：</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(skippedEvents.map(e => e.title ?? e.id))].slice(0, 10).map(t => (
              <span key={t} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/40">
                {t}
              </span>
            ))}
            {new Set(skippedEvents.map(e => e.title ?? e.id)).size > 10 && (
              <span className="px-3 py-1.5 text-[11px] text-white/25">等 {new Set(skippedEvents.map(e => e.title ?? e.id)).size - 10} 个……</span>
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 3: App.tsx 接线**

useGame 解构加 `skippedEvents`；SummaryScreen 传 `skippedEvents={skippedEvents}`。

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit` → 零报错
Run: `node --experimental-strip-types --test script/goals.test.ts script/save.test.ts script/engine-state.test.ts script/pace-mode.test.ts` → 全过

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useGame.ts src/components/SummaryScreen.tsx src/App.tsx
git commit -m "[NF]: 条件可见性：结算页展示本可发生而未触发的事件"
```

---

### Task 2: 分享卡片（canvas 生成 + 下载）

**Files:**
- Create: `src/components/ShareCardModal.tsx`
- Modify: `src/components/SummaryScreen.tsx`
- Modify: `src/App.tsx`（无需改——SummaryScreen 内部状态管理模态，props 不新增）

**Interfaces:**
- Produces: `ShareCardModal({ game, onClose })`——内部 canvas 绘制 + 下载按钮

- [ ] **Step 1: 创建 ShareCardModal.tsx**

```tsx
import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import { ATTR_META, calcScore } from '../engine/state';
import { checkGoal } from '../engine/goals';
import { GOALS } from '../engine/goals';

interface Props {
  game: GameState;
  /** 结局标题（SummaryScreen 的 getVerdict 结果，如「辉煌的一生」） */
  verdictTitle: string;
  onClose: () => void;
}

/** 卡片尺寸（960×540 横版） */
const CARD_W = 960;
const CARD_H = 540;

/** 人生总结分享卡片：canvas 绘制，支持下载 PNG */
export default function ShareCardModal({ game, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    const score = calcScore(game.attributes);
    const goalResult = checkGoal(game.goal, game);
    const goalDef = GOALS.find(g => g.key === game.goal);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, '#1a1a30');
    bg.addColorStop(1, '#0a0a14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // 顶部标题
    ctx.fillStyle = '#c9a96e';
    ctx.font = '300 44px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('人生模拟器', CARD_W / 2, 84);
    ctx.font = '300 26px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${game.gender === 'male' ? '♂' : '♀'} ${game.name} · 享年 ${game.age} 岁`, CARD_W / 2, 126);

    // 结局标题
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '300 52px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(verdictTitle, CARD_W / 2, 196);
    // 评分
    ctx.fillStyle = '#c9a96e';
    ctx.font = '600 96px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(String(score), CARD_W / 2, 300);
    ctx.font = '300 20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('综合评分', CARD_W / 2, 334);

    // 目标
    if (goalDef) {
      ctx.font = '300 22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = goalResult?.achieved ? '#5de8a0' : 'rgba(255,255,255,0.6)';
      ctx.fillText(`${goalDef.icon} 目标「${goalDef.name}」${goalResult?.achieved ? '已达成' : '未达成'}`, CARD_W / 2, 384);
    }

    // 8 属性（两行四列）
    const attrs = Object.entries(game.attributes) as Array<[keyof typeof game.attributes, number]>;
    ctx.font = '400 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    attrs.forEach(([k, v], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 120 + col * 200;
      const y = 430 + row * 44;
      const meta = ATTR_META[k];
      ctx.fillStyle = meta.color;
      ctx.textAlign = 'left';
      ctx.fillText(`${meta.icon} ${meta.name} ${v}`, x, y);
    });

    // 底部水印
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '300 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('由人生模拟器生成', CARD_W / 2, CARD_H - 22);
  }, [game]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const a = document.createElement('a');
    a.download = `${game.name}-人生总结.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className="rounded-2xl shadow-[0_0_60px_rgba(201,169,110,0.15)] max-w-[85vw] h-auto"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
          >
            关闭
          </button>
          <button
            onClick={handleDownload}
            className="px-7 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans
              bg-gradient-to-r from-[#c9a96e] to-[#a88b4e] text-[#1a1a2e] font-bold border-transparent"
          >
            保存图片
          </button>
        </div>
      </div>
    </div>
  );
}
```

（结局标题已通过 `verdictTitle` prop 传入，无占位。）

- [ ] **Step 2: SummaryScreen 集成**

`import { useState } from 'react';`、`import ShareCardModal from './ShareCardModal';`。内部状态 `const [showShare, setShowShare] = useState(false);`。结算页「回到标题」按钮上方加分享按钮：

```tsx
      <button
        onClick={() => setShowShare(true)}
        className="px-9 py-3 border border-[#c9a96e]/50 rounded-2xl bg-transparent
          text-sm text-[#c9a96e] tracking-[4px] font-sans
          hover:bg-[#c9a96e]/10 hover:shadow-[0_4px_20px_rgba(201,169,110,0.3)]
          transition-all duration-300 mt-2"
      >
        🎴 生成分享卡片
      </button>
```

组件末尾渲染：

```tsx
      {showShare && (
        <ShareCardModal game={game} verdictTitle={title} onClose={() => setShowShare(false)} />
      )}
```

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit` → 零报错

- [ ] **Step 4: 提交**

```bash
git add src/components/ShareCardModal.tsx src/components/SummaryScreen.tsx
git commit -m "[NF]: 分享卡片：canvas 人生总结 + PNG 下载"
```

---

### Task 3: 老年内容补强（15 个新事件）

**Files:**
- Modify: `script/chiled.json`（追加 15 个事件）
- Regenerate: `src/engine/events.json`

**Interfaces:**
- Consumes: 现有管线（clamp-effects + build:events）
- Produces: 更新后的 events.json（493 → 508）

- [ ] **Step 1: 追加 15 个老年事件（chiled.json 数组末尾）**

id 用 `elder_0101` ~ `elder_0115`（避免与年龄编码 id elder_0091 等冲突）。效果键全部取自 ATTR_MAP（health/money/happiness/social/appearance/luck/empathy/discipline/memory/learning/confidence/security/comfort/freedom/stability/resilience/fun/family_relation/relationship/energy/independence/stability）。

事件清单（含完整内容，逐字追加）：

```json
{
  "id": "elder_0101",
  "age_range": [76, 77],
  "category": "health",
  "title": "体检报告",
  "text": "社区组织的年度体检出了报告。医生说各项指标还算平稳，就是血压偏高，叮嘱你少盐少油，多走动。你拿着报告看了半天，想起年轻时熬夜拼命的那些年——能走到今天，已经是赚了。",
  "choices": [
    { "text": "认真记下医嘱，从此每天清晨去公园走两圈", "effects": { "health": 10, "discipline": 4 } },
    { "text": "嘴上应着，转头就忘了，日子照旧", "effects": { "health": -5, "happiness": 2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0102",
  "age_range": [77, 78],
  "category": "family",
  "title": "孙辈的电话",
  "text": "远在另一个城市的小孙女打来电话，叽叽喳喳地讲学校里的趣事，最后甜甜地说了句「爷爷/奶奶我想你了」。挂了电话，你坐在沙发上，嘴角的笑意怎么也压不下去。",
  "choices": [
    { "text": "翻出相册，把孙辈从小到大的照片看了一遍又一遍", "effects": { "happiness": 8, "memory": 3 } },
    { "text": "惦记着孙辈，又忍不住念叨儿子儿媳工作太忙", "effects": { "happiness": 3, "family_relation": -2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0103",
  "age_range": [78, 79],
  "category": "personality",
  "title": "旧友重逢",
  "text": "老同学聚会，你见到了几十年没见的同桌。两个头发花白的人站在饭店门口，先是互相打量，然后同时笑出了声。饭桌上大家说起年轻时的事，那些苦日子如今都成了下酒菜。",
  "choices": [
    { "text": "留了联系方式，约好以后每月聚一次", "effects": { "social": 9, "happiness": 5 } },
    { "text": "热闹归热闹，散场后还是觉得一个人清静", "effects": { "social": 2, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0104",
  "age_range": [79, 80],
  "category": "technology",
  "title": "学用智能手机",
  "text": "儿子教你在手机上看视频、发语音。你戴着老花镜，一个功能一个功能地学，手指在屏幕上戳来戳去。第一次成功给老伙计发出语音消息时，你高兴得像个孩子。",
  "choices": [
    { "text": "认真学，不懂就问，很快就成了老伙伴里的「技术顾问」", "effects": { "learning": 8, "confidence": 5 } },
    { "text": "学了两天嫌麻烦，还是让子女代劳", "effects": { "learning": -3, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0105",
  "age_range": [80, 81],
  "category": "health",
  "title": "公园里的晨练",
  "text": "清晨的公园，太极拳、广场舞、快走……你每天雷打不动地出现在同一棵老槐树下。日子久了，晨练的伙伴们互相打招呼、聊家常，比亲邻还热络。",
  "choices": [
    { "text": "坚持每天报到，风雨无阻", "effects": { "health": 9, "social": 4 } },
    { "text": "天气好就去，下雨天就窝在家里", "effects": { "health": 3, "comfort": 2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0106",
  "age_range": [81, 82],
  "category": "family",
  "title": "老宅的最后一天",
  "text": "老房子要拆迁了。搬家公司来之前，你在屋里慢慢走了一圈：斑驳的墙面、踩得发亮的门槛、墙角那台老缝纫机。这里装着一家三代人的几十年。关上门的那一刻，你轻轻叹了口气。",
  "choices": [
    { "text": "拍了几张照片，把最珍贵的东西都收进箱子里", "effects": { "memory": 6, "happiness": 2 } },
    { "text": "把老物件送给街坊邻居，说「留个念想」", "effects": { "social": 6, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0107",
  "age_range": [82, 83],
  "category": "personality",
  "title": "给晚辈讲故事",
  "text": "孙辈缠着你讲过去的事。你讲起年轻时下乡、做工、闯荡的那些经历，孩子们听得眼睛发亮。讲到惊险处，你自己也恍惚了——那些事，好像就发生在昨天。",
  "choices": [
    { "text": "把一生的故事慢慢讲给他们听，一代传一代", "effects": { "memory": 7, "family_relation": 5 } },
    { "text": "讲一半就摆手说「都是老黄历了，没啥好说的」", "effects": { "memory": -2, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0108",
  "age_range": [83, 84],
  "category": "health",
  "title": "一场小感冒",
  "text": "入秋的一场感冒，来势汹汹。你躺在床上，看着天花板，第一次清楚地感觉到身体大不如前。好在子女轮流来照顾，热汤、药片、量体温，忙前忙后。",
  "choices": [
    { "text": "病好后开始更加爱惜身体，按时体检、注意保暖", "effects": { "health": 8, "discipline": 4 } },
    { "text": "嘴上说没事，心里却开始害怕生病", "effects": { "health": -2, "anxiety": -3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0109",
  "age_range": [84, 85],
  "category": "family",
  "title": "金婚纪念",
  "text": "今天是你们结婚五十周年的日子。孩子们张罗了一桌好菜，你看着身边这个陪你走了半个世纪的人，头发都白了，笑容却还是当年的样子。你端起杯子，千言万语只化作一句「辛苦了」。",
  "choices": [
    { "text": "握紧老伴的手，说「下辈子还娶/嫁你」", "effects": { "happiness": 10, "family_relation": 6 } },
    { "text": "嘴上不说，心里却全是感激", "effects": { "happiness": 5, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0110",
  "age_range": [85, 86],
  "category": "personality",
  "title": "黄昏里的合唱团",
  "text": "社区老年合唱团缺人，邻居硬拉着你去试试。你站在队伍里，跟着大家唱老歌，嗓子虽不如当年，气势却一点不输。指挥说你是「隐藏的高手」，你笑了一晚上。",
  "choices": [
    { "text": "加入了合唱团，每周排练成了最期待的事", "effects": { "social": 8, "happiness": 6 } },
    { "text": "唱了一次就觉得不好意思，还是回家听收音机", "effects": { "social": 2, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0111",
  "age_range": [91, 92],
  "category": "personality",
  "title": "写回忆录",
  "text": "孩子们劝你把一生的经历写下来。你戴上老花镜，从童年写起，一页一页，像重新活了一遍。那些记不清的细节，在笔尖下慢慢清晰起来。",
  "choices": [
    { "text": "坚持每天写一点，留给子孙们", "effects": { "memory": 8, "discipline": 5 } },
    { "text": "写了几页就搁下了，觉得往事不堪回首", "effects": { "memory": 2, "comfort": 2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0112",
  "age_range": [92, 93],
  "category": "health",
  "title": "阳光下的午后",
  "text": "午后阳光正好，你坐在院子里的藤椅上晒太阳。暖洋洋的光线落在身上，你眯着眼，听收音机里咿咿呀呀的戏曲。什么都不想，什么都不做，这一刻，时间慢得刚刚好。",
  "choices": [
    { "text": "享受这份安宁，心满意足", "effects": { "happiness": 8, "comfort": 5 } },
    { "text": "晒着晒着，竟有些害怕这样的日子不多了", "effects": { "happiness": -3, "security": -2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0113",
  "age_range": [93, 94],
  "category": "family",
  "title": "四世同堂",
  "text": "重孙满月，一家人难得聚得这么齐。你坐在主位上，看着满屋子的人——儿子、孙子、重孙，笑声此起彼伏。你忽然觉得，这一生值了。",
  "choices": [
    { "text": "抱着重孙，笑得合不拢嘴", "effects": { "happiness": 10, "family_relation": 6 } },
    { "text": "看着满堂儿孙，悄悄抹了抹眼角", "effects": { "happiness": 6, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0114",
  "age_range": [94, 95],
  "category": "personality",
  "title": "最后的嘱托",
  "text": "你开始交代身后事：存折放在哪个抽屉，老照片留给谁，还有什么心愿未了。儿女们红着眼眶听你说，你却语气平静，像在安排一次远行。",
  "choices": [
    { "text": "把每件事都交代得清清楚楚，无牵无挂", "effects": { "comfort": 8, "security": 5 } },
    { "text": "说着说着，还是舍不得这个人间", "effects": { "happiness": -3, "family_relation": 2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0115",
  "age_range": [95, 96],
  "category": "personality",
  "title": "平静的清晨",
  "text": "又是一个清晨。你醒得很早，窗外的鸟叫和很多年前一样。你慢慢起身，想起这一生走过的路——平凡，琐碎，却也有过闪光的时刻。你笑了，轻声说：「这样的一生，很好。」",
  "choices": [
    { "text": "微笑着迎接新的一天", "effects": { "happiness": 8, "stability": 4 } },
    { "text": "静静躺着，回忆这一生的光", "effects": { "memory": 5, "comfort": 3 } }
  ],
  "conditions": {}
}
```

（注意：`anxiety` 在 ATTR_MAP 中——elder_0108 选项 2 用了 `anxiety: -3`。若实现时确认 anxiety 不在 ATTR_MAP，改用 `happiness: -3`。）

- [ ] **Step 2: 管线与校验**

Run: `node script/clamp-effects.mjs`（钳位超范围效果值）
Run: `npm run build:events`
Run: `node --test "script/*.test.mjs"` → 19 个数据工具测试全过（密度/flag 配对校验——新事件无 flag，76+ 岁无密度上限约束）
Run: `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts` → 45 个全过（lite 密度/总量测试不受 76+ 影响？lite target 76+ 是 2 个/岁——新增事件后 76-90 岁变 3 个/岁？lite 抽样 target=2，新增后每岁事件更多但抽样仍取 2 个 ✓；总量测试 ≥150 仍成立 ✓）

- [ ] **Step 3: 提交**

```bash
git add script/chiled.json src/engine/events.json
git commit -m "[NF]: 老年内容补强：76-95 岁新增 15 个模拟事件"
```

---

### Task 4: 端到端验证

- [ ] **Step 1: 全部测试**

Run: `node --test "script/*.test.mjs"` + `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts`
Expected: 全过

- [ ] **Step 2: 生产构建**

Run: `npm run build` → 成功

- [ ] **Step 3: 浏览器端到端**

1. 快速模拟到结算 → 结算页出现「👻 本可发生而未触发」区块（数量 > 0）+ 标题列表
2. 结算页「🎴 生成分享卡片」→ 模态显示 canvas 卡片（含名字/享年/结局/评分/属性）→「保存图片」触发下载（页面可检查 download 事件或 a[download] 属性）
3. 手动局到 76+ 岁 → 遇到新老年事件（elder_0101 等标题出现）
4. 720px 视口标题页仍不溢出（回归）

- [ ] **Step 4: 收尾**

```bash
git status
git log --oneline -6
```
