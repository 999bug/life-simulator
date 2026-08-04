# 体验强化实现计划（第四弹）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8 项体验优化：生涯年表、86-90 岁内容、id 规则校验、反馈收益解释、音效、移动端适配、成就扩展（12→20）、本地生涯统计。

**Architecture:** 数据侧（id 校验 + 5 事件）走管线；反馈解释在 useGame 反馈构建处；音效在 sound.ts 合成；成就/统计扩展存储结构（endings/stats 均向后兼容）；生涯年表靠 ChoiceRecord.flags 记录 + 结算页时间线重写；移动端靠 App 层 transform 缩放。

**Tech Stack:** TypeScript、React 18、Web Audio、Canvas（沿用）、Node 22 test runner。

## Global Constraints

- 所有注释中文、日志英文
- 不改 `src/engine/events.json` 生成文件（数据改动走 chiled.json + build:events）
- **效果键必须取自 ATTR_MAP**；效果值 ±3~±20（±2 可容忍）
- 新事件无 flag；id 2 位主线 / 4 位模拟
- 存档兼容：ChoiceRecord.flags 可选、AchievementStore.endings 兜底 []、stats 新 key 不存在即空
- 提交信息：中文 subject + 前缀（[NF]/[BF]/[CU]/[IM]），body `- ` 列表，无 AI 署名
- 类型检查：`npx tsc --noEmit`；测试：`node --experimental-strip-types --test script/*.test.ts` + `node --test "script/*.test.mjs"`

---

### Task 1: 数据工具 id 规则校验

**Files:**
- Modify: `script/convert-events.mjs`
- Modify: `script/data-tools.test.mjs`（追加测试）

- [ ] **Step 1: convert-events.mjs 加校验**

在 convertAll 的 fail-fast 循环内（id 读取后）加：

```js
// 事件 id 规则：2 位数字后缀 = 主线（永远保留），4 位数字后缀 = 模拟（可精选删除），其余非法
if (!/_\d{2}$/.test(id) && !/_\d{4}$/.test(id)) {
  throw new Error(`非法事件 id（需 2 位主线或 4 位模拟后缀）: ${id}`);
}
```

（先查看 convertAll 循环现有结构，把校验插在合适位置；若 convertAll 未导出供测试调用，按现有测试模式处理——data-tools.test.mjs 已有 `ev()` 辅助与工具函数直接调用先例）

- [ ] **Step 2: 追加测试（script/data-tools.test.mjs）**

按既有测试风格追加：

```js
test('事件 id 规则校验：2 位主线与 4 位模拟通过，其他抛错', () => {
  assert.strictEqual(isValidEventId('child_01'), true);
  assert.strictEqual(isValidEventId('child_0017'), true);
  assert.strictEqual(isValidEventId('adult_100'), false);  // 3 位非法
  assert.strictEqual(isValidEventId('no_number'), false);
});
```

（若校验实现为内联 throw 而非导出函数，则改为：构造含 3 位 id 的事件数组调用转换入口，断言 throws——按 convert-events.mjs 实际结构选择可测形态，并在报告说明）

- [ ] **Step 3: 验证**

Run: `node --test "script/*.test.mjs"` → 全过
Run: `npm run build:events` → 成功（现有 508 个事件全合规）

- [ ] **Step 4: 提交**

```bash
git add script/convert-events.mjs script/data-tools.test.mjs
git commit -m "[IM]: 数据工具：事件 id 规则校验（仅允许 2 位主线/4 位模拟）"
```

---

### Task 2: 86-90 岁内容补强（5 个事件）

**Files:**
- Modify: `script/chiled.json`（追加 5 个事件）
- Regenerate: `src/engine/events.json`

- [ ] **Step 1: 追加事件（数组末尾，逐字）**

```json
{
  "id": "elder_0116",
  "age_range": [86, 87],
  "category": "social",
  "title": "老友的告别",
  "text": "一起晨练的老李走了。送别那天，你站在人群里，看着他的照片，想起他说过「明年咱们还一起爬山」。回到家，你坐在沙发上发了很久的呆，然后翻出老照片，一张一张慢慢看。",
  "choices": [
    { "text": "珍惜眼前人，给老伙计们挨个打了电话", "effects": { "social": 8, "happiness": 3 } },
    { "text": "沉默了很久，一个人坐到了天黑", "effects": { "happiness": -5, "comfort": 2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0117",
  "age_range": [87, 88],
  "category": "family",
  "title": "孙辈的毕业典礼",
  "text": "孙辈大学毕业，你受邀去参加典礼。礼堂里坐满了人，你穿着压箱底的正式衣裳，看着台上那个曾经在你怀里打滚的孩子穿着学士服鞠躬。掌声响起时，你悄悄抹了抹眼角。",
  "choices": [
    { "text": "把压箱底的传家之物送给了孙辈", "effects": { "family_relation": 8, "happiness": 5 } },
    { "text": "只说了句「好好干」，心里却无比骄傲", "effects": { "family_relation": 4, "comfort": 2 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0118",
  "age_range": [88, 89],
  "category": "health",
  "title": "散步的习惯",
  "text": "医生说多走动有好处，你便把每天的散步当成了功课。清晨沿着河边走，傍晚在小区里绕圈。日子久了，哪条路有台阶、哪棵树春天开花，你都一清二楚。",
  "choices": [
    { "text": "坚持了三年，身体比同龄人硬朗不少", "effects": { "health": 10, "discipline": 5 } },
    { "text": "走了几天就嫌累，又窝回了沙发", "effects": { "health": -4, "comfort": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0119",
  "age_range": [89, 90],
  "category": "family",
  "title": "修缮老屋",
  "text": "老屋的屋顶漏了雨，孩子们张罗着给你修。你坚持要用老手艺的瓦片，说「这房子住了几十年，不能亏待它」。修好后，你摸着崭新的屋檐，像摸着一个老朋友的脸。",
  "choices": [
    { "text": "在老屋里又住了一年，说「这里最安心」", "effects": { "comfort": 7, "happiness": 4 } },
    { "text": "修好后还是搬去了孩子家，老屋留作念想", "effects": { "family_relation": 4, "security": 3 } }
  ],
  "conditions": {}
},
{
  "id": "elder_0120",
  "age_range": [90, 91],
  "category": "family",
  "title": "九十大寿",
  "text": "九十岁生日，全家老小都回来了。饭店里摆了四桌，最小的重孙刚学会走路，摇摇晃晃地走到你面前喊「太爷爷」。你抱着他，看着满堂儿孙，忽然觉得这辈子活得值了。",
  "choices": [
    { "text": "吹蜡烛时，许了一个「儿孙平安」的愿望", "effects": { "happiness": 10, "family_relation": 6 } },
    { "text": "笑着说「活够了」，心里却还想多看看这个世界", "effects": { "happiness": 4, "comfort": 3 } }
  ],
  "conditions": {}
}
```

- [ ] **Step 2: 管线**

Run: `node script/clamp-effects.mjs` → `npm run build:events` → `node --test "script/*.test.mjs"`（19 全过）→ 引擎回归（45 全过）

- [ ] **Step 3: 提交**

```bash
git add script/chiled.json src/engine/events.json
git commit -m "[NF]: 老年内容补强：86-90 岁新增 5 个事件（总数 513）"
```

---

### Task 3: 反馈页收益解释

**Files:**
- Modify: `src/hooks/useGame.ts`（MAKE_CHOICE 反馈构建）

- [ ] **Step 1: 衰减注记**

`MAKE_CHOICE` 的反馈构建处（changedKeys.map）改为：

```ts
        // 反馈展示实际生效值（含年龄上限收益递减）；正向收益距上限 15 点内标注余量
        fb += '\n\n' + changedKeys.map(k => {
          const v = effectiveDelta(k, attrChanges[k]!, state.game.attributes, state.game.age);
          const raw = attrChanges[k]!;
          const room = ageCap(k, state.game.age) - state.game.attributes[k];
          const decayNote = raw > 0 && room < 15 ? `（距上限${Math.max(0, Math.floor(room))}点）` : '';
          return `${v > 0 ? '+' : ''}${v}${decayNote}`;
        }).join('  ');
```

import 加 `ageCap`（从 `../engine/state`）。

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit` → 零报错；引擎测试回归全过

- [ ] **Step 3: 提交**

```bash
git add src/hooks/useGame.ts
git commit -m "[NF]: 反馈页标注收益衰减（距年龄上限余量提示）"
```

---

### Task 4: 音效丰富（成就 + 阶段切换）

**Files:**
- Modify: `src/utils/sound.ts`
- Modify: `src/components/GameScreen.tsx`
- Modify: `src/components/SummaryScreen.tsx` 或 `src/App.tsx`

- [ ] **Step 1: sound.ts 新增两个合成音**

参照现有 `sfx.select` 等实现（Web Audio 振荡器），追加：

```ts
/** 成就解锁：上扬琶音 */
achievement(): void {
  ... // 三音上行（如 523/659/784 Hz 依次短促），增益包络渐弱
}

/** 阶段切换：低沉过渡 */
stage(): void {
  ... // 低音下滑（如 220→165 Hz），柔和包络
}
```

（实现风格与现有音效一致——查看 sound.ts 现有函数的振荡器/增益写法照抄；浏览器不可用时静默降级已有兜底）

- [ ] **Step 2: 播放时机**

- `App.tsx`：结算页进入且新成就非空时播成就音：

```tsx
  // 结算页新成就解锁音
  useEffect(() => {
    if (game.phase === 'summary' && newAchievements.length > 0) {
      sfx.achievement();
    }
  }, [game.phase, newAchievements.length]);
```

- `GameScreen.tsx`：阶段切换音（跳过首次渲染）：

```tsx
  const firstStageRef = useRef(true);
  useEffect(() => {
    if (firstStageRef.current) {
      firstStageRef.current = false;
      return;
    }
    sfx.stage();
  }, [game.stage]);
```

（App.tsx 需要 `newAchievements` 已在解构中——Task 第二弹已返回；若 effect 位置与现有 `sfx.death()` effect 相邻则放一起）

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit` → 零报错

- [ ] **Step 4: 提交**

```bash
git add src/utils/sound.ts src/App.tsx src/components/GameScreen.tsx
git commit -m "[NF]: 音效：成就解锁上扬音 + 阶段切换过渡音"
```

---

### Task 5: 成就扩展（12 → 20）

**Files:**
- Modify: `src/engine/achievements.ts`
- Modify: `src/hooks/useGame.ts`（AchievementStore.endings + 结算并入）
- Modify: `script/goals.test.ts`（扩展测试）

**Interfaces:**
- Produces: `ACHIEVEMENTS` 20 个；`AchievementCheckInput` 加 `endingsCount: number`；`AchievementStore` 加 `endings: string[]`

- [ ] **Step 1: achievements.ts 扩展**

`ACHIEVEMENTS` 末尾追加 8 个：

```ts
  { id: 'top_score', icon: '🏆', name: '名垂青史', desc: '综合评分达到 85' },
  { id: 'genius', icon: '🧠', name: '天才大脑', desc: '智力达到 95' },
  { id: 'iron_body', icon: '💪', name: '铁打的身体', desc: '健康达到 90' },
  { id: 'rich_king', icon: '👑', name: '富可敌国', desc: '财富达到 95' },
  { id: 'big_family', icon: '👨‍👩‍👧‍👦', name: '儿孙满堂', desc: '已婚有娃且幸福达到 80' },
  { id: 'ultra_life', icon: '🌅', name: '期颐之年', desc: '享年达到 95 岁' },
  { id: 'five_endings', icon: '📚', name: '阅尽千帆', desc: '累计达成 5 种不同结局' },
  { id: 'ten_lives', icon: '♾️', name: '十世轮回', desc: '累计完成 10 局人生' },
```

`AchievementId` 类型加 8 个 id；`AchievementCheckInput` 加 `endingsCount: number`；`checkAchievements` 加判据：

```ts
  if (calcScore(attributes) >= 85) { ids.add('top_score'); }
  if (attributes.intelligence >= 95) { ids.add('genius'); }
  if (attributes.health >= 90) { ids.add('iron_body'); }
  if (attributes.wealth >= 95) { ids.add('rich_king'); }
  if (has('married', 'has_child') && attributes.happiness >= 80) { ids.add('big_family'); }
  if (age >= 95) { ids.add('ultra_life'); }
  if (input.endingsCount >= 5) { ids.add('five_endings'); }
  if (completedLives >= 10) { ids.add('ten_lives'); }
```

（`calcScore` 从 `./state` 导入）

- [ ] **Step 2: useGame AchievementStore 扩展**

`AchievementStore` 加 `endings: string[]`；`loadAchievements` 兜底 `endings: Array.isArray(data.endings) ? data.endings : []`；`saveAchievements` 原样写。

成就持久化 effect（ACHIEVEMENTS_PERSISTED 前）合并结局：

```ts
  // 结算成就持久化：并入结局集合（去重），写库后清标志
  useEffect(() => {
    if (!rt.achievementPending) {
      return;
    }
    saveAchievements({
      unlocked: [...new Set([...rt.achievements.unlocked, ...rt.pendingNewIds])],
      completedLives: rt.pendingLives,
      endings: [...new Set([...rt.achievements.endings, rt.pendingEndingKey])],
    });
    dispatch({ type: 'ACHIEVEMENTS_PERSISTED' });
  }, [rt.achievementPending]);
```

RuntimeState 加 `pendingEndingKey: string`；MAKE_CHOICE gameOver 时设置：

```ts
      const endingKey = verdictKey(game);
      // 返回值加：pendingEndingKey: endingKey,
```

`verdictKey(game): string` 新纯函数放 `src/engine/verdict.ts`（Task 6 也会用）：

```ts
/**
 * 结局判定 key：路线 flag 优先，无则按分数档。
 * 与 SummaryScreen.getVerdict 的判定顺序一致（仅取 key，不含文案）。
 */
export function verdictKey(game: GameState): string {
  const { flags, attributes } = game;
  const has = (...fs: string[]) => fs.some(f => flags.includes(f));
  const order: Array<[string, string[]]> = [
    ['startup_success', ['startup_success']],
    ['world_traveler', ['world_traveler']],
    ['grad_school', ['grad_school']],
    ['top_university', ['top_university']],
    ['retake', ['retake']],
    ['doctor', ['doctor']],
    ['military_flag', ['military_flag']],
    ['athlete_pro', ['athlete_pro']],
    ['artist', ['artist_pro', 'artist_life']],
    ['tech_career', ['tech_career']],
    ['went_to_college', ['went_to_college']],
    ['skilled_worker', ['skilled_worker']],
    ['civil_servant', ['civil_servant']],
  ];
  for (const [key, fs] of order) {
    if (has(...fs)) {
      return key;
    }
  }
  const score = calcScore(attributes);
  return score >= 75 ? 'score:75+' : score >= 60 ? 'score:60+' : score >= 45 ? 'score:45+' : score >= 30 ? 'score:30+' : 'score:low';
}
```

（`calcScore` 从 `./state` 导入。注意：SummaryScreen 的 getVerdict 里 tech_career 分支还有 `intelligence >= 60` 条件——verdictKey 简化版不含该条件，接受轻微差异；若实现时发现 SummaryScreen 需要统一，抽共用函数并让 getVerdict 调用 verdictKey 派生——按代码实际决定，报告说明）

`ACHIEVEMENTS_PERSISTED` 分支清 `pendingEndingKey`。

- [ ] **Step 3: goals.test.ts 扩展测试**

`checkAchievements` 已有测试补新断言（构造高分/高龄/多结局输入），`ACHIEVEMENTS.length` 断言改为 20：

```ts
test('ACHIEVEMENTS：20 个定义齐全', () => {
  assert.strictEqual(ACHIEVEMENTS.length, 20);
  assert.strictEqual(new Set(ACHIEVEMENTS.map(a => a.id)).size, 20);
});

test('checkAchievements：新增 8 个成就判定', () => {
  const g = game({ age: 96, flags: ['married', 'has_child'], attributes: { health: 92, intelligence: 96, wealth: 96, happiness: 85, social: 70, appearance: 70, luck: 70, morality: 70 } });
  const got = checkAchievements({ game: g, completedLives: 10, wasLite: false, wasAuto: false, endingsCount: 5 });
  for (const id of ['top_score', 'genius', 'iron_body', 'rich_king', 'big_family', 'ultra_life', 'five_endings', 'ten_lives'] as const) {
    assert.ok(got.includes(id), `应包含 ${id}`);
  }
});
```

（`game()` 辅助函数已有——attributes 需补全 8 项使 calcScore 正常）

- [ ] **Step 4: 验证**

Run: `node --experimental-strip-types --test script/goals.test.ts script/save.test.ts script/engine-state.test.ts script/pace-mode.test.ts` → 全过
Run: `npx tsc --noEmit` → 零报错

- [ ] **Step 5: 提交**

```bash
git add src/engine/achievements.ts src/engine/verdict.ts src/hooks/useGame.ts script/goals.test.ts
git commit -m "[NF]: 成就扩展 12→20 + 结局 key 纯函数（verdictKey）"
```

---

### Task 6: 本地生涯统计

**Files:**
- Modify: `src/hooks/useGame.ts`（StatsStore 类型 + stats 存取 + 结算写入——类型直接定义在 useGame.ts 顶部，与 AchievementStore 同处，避免跨文件类型循环）
- Create: `src/components/StatsModal.tsx`
- Modify: `src/components/TitleScreen.tsx`（📊 入口）
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `StatsStore`、`loadStats()/saveStats()`（useGame 内或 stats.ts）；`StatsModal({ stats, onClose })`；useGame 返回 `stats`

- [ ] **Step 1: useGame stats 存取**

```ts
/** 生涯统计 key（跨周目） */
const STATS_KEY = 'life-sim-stats';

/** 生涯统计结构 */
interface StatsStore {
  totalLives: number;
  bestScore: number;
  totalAge: number;
  endings: Record<string, number>;
}

function loadStats(): StatsStore {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as StatsStore;
      if (data && typeof data.totalLives === 'number') {
        return data;
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { totalLives: 0, bestScore: 0, totalAge: 0, endings: {} };
}

function saveStats(stats: StatsStore): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // 存储不可用静默降级
  }
}
```

RuntimeState 加 `stats: StatsStore`（createInitialRuntime 用 `loadStats()`）；结算持久化 effect（与成就同 effect）加：

```ts
    const score = calcScore(rt.game.attributes);
    saveStats({
      totalLives: rt.stats.totalLives + 1,
      bestScore: Math.max(rt.stats.bestScore, score),
      totalAge: rt.stats.totalAge + rt.game.age,
      endings: { ...rt.stats.endings, [rt.pendingEndingKey]: (rt.stats.endings[rt.pendingEndingKey] ?? 0) + 1 },
    });
```

（effect 依赖保持 `[rt.achievementPending]`——stats 写入与成就同一时机；`calcScore` 从 `../engine/state` 导入，useGame 已导入）

useGame 返回 `stats: rt.stats`。

- [ ] **Step 2: 创建 StatsModal.tsx**

```tsx
import type { StatsStore } from '../hooks/useGame';
interface Props {
  stats: StatsStore;
  onClose: () => void;
}

/** 生涯统计模态：总局数/最佳评分/平均寿命/结局分布 */
export default function StatsModal({ stats, onClose }: Props) {
  const avgAge = stats.totalLives > 0 ? Math.round(stats.totalAge / stats.totalLives) : 0;
  const endings = Object.entries(stats.endings).sort((a, b) => b[1] - a[1]);
  return (
    <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="w-[440px] max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-[#15152a] p-6 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-center text-[18px] tracking-[6px] text-[#c9a96e]">📊 生涯统计</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="text-2xl text-[#c9a96e]">{stats.totalLives}</div>
            <div className="text-[10px] text-white/40 mt-1">总局数</div>
          </div>
          <div className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="text-2xl text-[#c9a96e]">{stats.bestScore}</div>
            <div className="text-[10px] text-white/40 mt-1">最佳评分</div>
          </div>
          <div className="text-center p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="text-2xl text-[#c9a96e]">{avgAge}</div>
            <div className="text-[10px] text-white/40 mt-1">平均寿命</div>
          </div>
        </div>
        <div>
          <h4 className="text-[12px] tracking-[3px] text-white/50 mb-2">结局分布</h4>
          {endings.length === 0 ? (
            <p className="text-[11px] text-white/30">还没有完成任何一局</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {endings.map(([key, n]) => (
                <div key={key} className="flex justify-between text-[12px] py-1 border-b border-white/[0.04]">
                  <span className="text-white/50">{key}</span>
                  <span className="text-[#c9a96e]">{n} 局</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="px-8 py-2.5 rounded-[30px] text-[13px] tracking-[3px] border font-sans mx-auto border-white/15 text-white/40 hover:border-[#c9a96e]/50 hover:text-[#c9a96e]">关闭</button>
      </div>
    </div>
  );
}
```

（结局 key 显示原始 key（如 startup_success）——可接受，或后续映射中文名；按此实现）

- [ ] **Step 3: TitleScreen 入口 + App 接线**

「🏆 成就」按钮旁加「📊 生涯」按钮（同排）：`onClick={() => setShowStats(true)}` + `showStats` state + 模态渲染（`stats={stats}` prop）。App 传 `stats={stats}`。

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit` → 零报错；引擎测试全过

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useGame.ts src/components/StatsModal.tsx src/components/TitleScreen.tsx src/App.tsx
git commit -m "[NF]: 本地生涯统计：总局数/最佳评分/平均寿命/结局分布"
```

---

### Task 7: 生涯年表（人生大事记）

**Files:**
- Modify: `src/types/index.ts`（ChoiceRecord.flags?）
- Modify: `src/hooks/useGame.ts`（MAKE_CHOICE 记录 flags）
- Modify: `src/components/SummaryScreen.tsx`（时间线重写）

- [ ] **Step 1: ChoiceRecord 加 flags**

```ts
/** 选择记录 */
export interface ChoiceRecord {
  age: number;
  stage: LifeStage;
  eventId: string;
  choiceIndex: number;
  text: string;
  /** 该选择产出的 flag（生涯年表里程碑标记用；旧存档无此字段） */
  flags?: string[];
}
```

- [ ] **Step 2: MAKE_CHOICE 记录 flags**

history 构建处加：

```ts
      const history = [...state.game.history, {
        age: state.game.age,
        stage: state.game.stage,
        eventId,
        choiceIndex: state.currentEvent?.choices.indexOf(choice) ?? 0,
        text: choice.text,
        flags: out.flags ?? undefined,
      }];
```

- [ ] **Step 3: SummaryScreen 时间线重写**

「重要选择回顾」区块（`game.history.slice(-10)`）替换为完整时间线（按 age 分组，里程碑 ⭐ 高亮）：

```tsx
      {/* 人生大事记 */}
      <div className="w-full max-w-[580px] animate-[fadeInUp_1.3s_ease]">
        <h3 className="text-[13px] tracking-[4px] text-[#c9a96e] mb-2.5 font-normal">📖 人生大事记</h3>
        {milestoneHistory.map((h, i) => (
          <div key={i} className="flex gap-3 py-1.5 text-xs border-b border-white/[0.02]">
            <span className="text-[#c9a96e] min-w-[32px]">{h.age}岁</span>
            <span className="text-white/40">{h.isMilestone ? '⭐ ' : ''}{h.text}</span>
          </div>
        ))}
      </div>
```

组件内计算：

```tsx
/** 里程碑 flag：命中则时间线高亮 */
const MILESTONE_FLAGS = ['went_to_college', 'grad_school', 'top_university', 'married', 'has_child', 'doctor', 'startup_success', 'civil_servant', 'world_traveler', 'athlete_pro', 'military_flag', 'skilled_worker', 'tech_career', 'retired'];

// 完整时间线：全部选择 + 里程碑标记（旧存档无 flags 字段 → 无标记，正常显示）
const milestoneHistory = game.history.map(h => ({
  ...h,
  isMilestone: (h.flags ?? []).some(f => MILESTONE_FLAGS.includes(f)),
}));
```

（常量与计算放组件函数体内或模块顶部——按 SummaryScreen 现有结构决定）

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit` → 零报错

- [ ] **Step 5: 提交**

```bash
git add src/types/index.ts src/hooks/useGame.ts src/components/SummaryScreen.tsx
git commit -m "[NF]: 生涯年表：完整时间线 + 里程碑 flag 高亮标记"
```

---

### Task 8: 移动端适配（视口缩放）

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 舞台缩放**

App 组件加缩放 effect（舞台逻辑尺寸 960×720 不变，外层 transform 缩放）：

```tsx
import { useEffect, useState } from 'react';

  // 移动端适配：视口小于舞台逻辑尺寸时等比缩放（960×720 逻辑尺寸不变）
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const s = Math.min(window.innerWidth / 960, window.innerHeight / 720);
      setScale(s < 1 ? s : 1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
```

舞台容器（`max-w-[960px] max-h-[720px]` div）加样式：

```tsx
      <div
        className="w-full h-full max-w-[960px] max-h-[720px] relative overflow-hidden rounded-lg shadow-[0_0_80px_rgba(0,0,0,0.6)] text-white"
        style={{ transform: `scale(${scale})` }}
      >
```

外层容器（`w-screen h-screen flex justify-center items-center`）已居中——缩放后自然居中显示。**验证**：缩放 < 1 时外层容器高度按视口（100vh），舞台缩放后仍居中（flex 居中 + transform-origin 默认 center）。

- [ ] **Step 2: 验证**

Run: `npx tsc --noEmit` → 零报错

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "[NF]: 移动端适配：视口等比缩放舞台（960×720 逻辑尺寸不变）"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 全部测试**

Run: `node --test "script/*.test.mjs"` + `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts`
Expected: 全过（19 + 45 + 新增成就测试）

- [ ] **Step 2: 生产构建**

Run: `npm run build` → 成功

- [ ] **Step 3: 浏览器端到端**

1. 快速模拟到结算：生涯年表（完整时间线 + ⭐ 里程碑）、成就解锁音、统计写入（总局数/最佳评分/平均寿命/结局分布）
2. 标题页「📊 生涯」模态展示统计
3. 手动局反馈页：正向收益衰减时显示「（距上限 X 点）」
4. 375×667 视口：舞台完整可见（缩放生效）
5. 720px 视口标题页不溢出（新增「📊 生涯」按钮后复查）
6. 成就面板 20 个（新增 8 个含锁定/解锁）
7. 数据工具测试含新 id 校验用例

- [ ] **Step 4: 收尾**

```bash
git status
git log --oneline -10
```
