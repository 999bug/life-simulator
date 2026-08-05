# 12 项优化并行开发 — 实现计划

> **For agentic workers:** 本计划由 8 个并行 agent 执行，每个 agent 只领取本组任务书（下文 A/B/C 组）。主会话负责派发、收尾统一验证与提交。步骤用 checkbox（`- [ ]`）语法跟踪。

**Goal:** 完成产品盘点出的 12 项优化：高龄/开局/支线/晚年事件内容扩充、局中重开、自定义目标、每日挑战、周目扩展、分类合并、PWA、UI 测试基建、事件看板。

**Architecture:** 按文件所有权划分 8 个 agent 三组并行（内容组 4 / 玩法组 1 / 工程组 3），组间零文件交集，主会话最后统一 merge + build + 全量测试回归。设计文档见 `docs/superpowers/specs/2026-08-05-optimization-suite-design.md`。

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind；数据管线 `script/`（node ESM，chiled.json snake_case）；测试 node:test（`script/*.test.mjs`）+ `node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts`；新增 vitest + @testing-library/react。

## Global Constraints（所有 agent 必须遵守）

1. **数据事实源**：只写 `script/fragments/*.json`（本组指定文件），不手改 `src/engine/events.json`、不改 `script/chiled.json`（仅工程-1 可改）、不改 2 位 id 原始事件
2. **事件格式**（chiled 风格 snake_case）：`id / age_range / category / title / text / choices[{text, effects, flags_add}] / conditions{has_flags, not_flags, min_attrs, max_attrs}`；text 第二人称 50-150 字；effects 每项 1-3 键、值 ±3~±20；键**必须**存在于 `script/convert-events.mjs` 的 ATTR_MAP（107 键，高频键：learning/knowledge/curiosity/creativity/memory/experience/adaptability/maturity/planning/ambition（→intelligence）；empathy/responsibility/patience/willpower/gratitude/loyalty（→morality）；social/friendship/relationship/family_relation/teamwork/communication/leadership/trust（→social）；happiness/stability/emotion/entertainment/family_need/freedom/security/motivation/fun（→happiness）；health/sports/safety/mental/resilience（→health）；money/financial/saving/business（→wealth）；appearance/confidence/charisma/courage/competition/art/music（→appearance）；luck/risk/future_opportunity（→luck））
3. **flag 成对**：`flags_add` 产出的 flag 必须有消费者（`has_flags`），反之亦然；`not_flags` 不算悬空
4. **分类只用目标分类**（工程-1 合并后）：`family / career / health / friend / education / personality / technology / love / finance / hobby / sports`（11 个）
5. **事件 id**：本组指定前缀 + 4 位数字（模拟事件），不与现有 id 冲突
6. **代码规范**：注释中文、日志英文；`if/for/while` 必须大括号；无魔法值（命名常量）；不引入未要求的依赖；TypeScript 严格模式通过
7. **提交规范**：中文 subject + 前缀（[NF] 新功能/[IM] 改进/[CU] 清理）；body `- ` 列表；禁止 AI 署名尾注
8. **测试**：引擎改动配测试（现有 47 个引擎测试 + 新增）；数据改动跑 `node --test "script/*.test.mjs"`
9. **验证命令**：`npm run build`（tsc 严格）、`node --test "script/*.test.mjs"`、`node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts`

---

# 组 A：内容组（4 个 agent 并行）

公共创作流程（每个内容任务通用）：
- [ ] 创建本组 fragments 文件（JSON 数组）
- [ ] `node script/merge-fragments.mjs` 验证通过（含密度/flag 三重校验）
- [ ] `npm run build:events` 成功
- [ ] `node --test "script/*.test.mjs"` 全过
- [ ] 提交（[NF]: 前缀，中文）

## 任务 A1：T1 世纪回望（fragments/century.json）

**Files:** Create `script/fragments/century.json`

**Id:** `elder_0116` ~ `elder_0121`（现有最大 elder_0115）

**事件表**（97-103 岁各 1 个，age_range 单岁）：

| age | 标题主题 | 叙事要点 |
|---|---|---|
| 97 | 跨过百年 | 时代变迁回望：煤油灯到智能手机 |
| 99 | 旧友的最后告别 | 讣告/代收的信，平静的悲伤 |
| 100 | 百岁宴 | 重孙绕膝、记者采访 |
| 101 | 老手艺传人 | 把手艺传给年轻人 |
| 102 | 给后辈留话 | 给重孙写一封信 |
| 103 | 世纪的回信 | 终局事件：把一生回望写成回信 |

**约束：** effects 温和正向（happiness/social/morality +1~+3，可含 luck +1）；不给死亡压力（不做 health 负向）；分类 personality/family/hobby 皆可；103 岁事件为数据流终点（播完自然寿终，不写 flags 链）。

**验收：** 6 个事件全在 97-103 岁；merge + build:events 通过。

## 任务 A2：T2 家庭底色（fragments/infant.json + 密度规则）

**Files:** Create `script/fragments/infant.json`；Modify `script/merge-fragments.mjs`（0-2 岁密度常量 1-3 → 3-5，注释同步更新）

**Id:** `infant_0001` 起

**事件表**（新增约 6 个）：

| age_range | 主题 | 效果倾向 |
|---|---|---|
| [0,0] | 产房清晨 / 大雪夜的出生 / 满月酒 | wealth/happiness 小幅分化 |
| [1,1] | 发高烧的夜（父母守候）/ 学步 | health/happiness |
| [2,2] | 邻居串门 / 第一句「不」/ 启蒙玩具 | social/intelligence |

**约束：** 先跑一次 `node script/merge-fragments.mjs` 确认现有 0-2 岁密度计数口径（现有 2 岁 4 个已接近上限），再调常量；目标每岁 3-5 个；效果 ±3~±20 用低值段。

**验收：** 0 岁事件数 3-4、1-2 岁 4-5；merge 校验通过且无「0-2 岁超出」violation；密度规则注释同步。

## 任务 A3：T4 三条支线（saga-pet / saga-venture / saga-music）

**Files:** Create `script/fragments/saga-pet.json`、`script/fragments/saga-venture.json`、`script/fragments/saga-music.json`（3 个文件）

**Id:** `pet_0001` / `venture_0001` / `music_0001` 起

**支线 1 养宠一生**（5 段，分类 animal×3 + family + health）：

| age | 事件 | flag |
|---|---|---|
| 6 | 街角的小狗（捡回家） | flags_add: pet_dog |
| 14 | 狗老了（走不动） | has_flags: pet_dog |
| 22 | 送别（最后一晚） | has_flags: pet_dog；flags_add: pet_memory |
| 40 | 路遇流浪猫 | has_flags: pet_memory |
| 60 | 想起它 | has_flags: pet_memory |

**支线 2 创业沉浮**（5 段，分类 career + finance）：

| age | 事件 | flag |
|---|---|---|
| 24 | 辞职创业 | flags_add: venture |
| 28 | 融资失败 | has_flags: venture |
| 33 | 公司活了 / 关了 | has_flags: venture；flags_add: venture_out |
| 45 | 行业寒冬 | has_flags: venture_out |
| 60 | 回望创业路 | has_flags: venture_out |

**支线 3 音乐人生**（5 段，分类 creativity×2 + personality + emotion×2）：

| age | 事件 | flag |
|---|---|---|
| 8 | 第一次摸琴 | flags_add: music_piano |
| 16 | 校园乐队 | has_flags: music_piano |
| 21 | 放弃还是坚持 | has_flags: music_piano；flags_add: music_stick |
| 35 | 深夜的钢琴房 | has_flags: music_stick |
| 70 | 琴声里的前半生 | has_flags: music_stick |

**约束：** 33 岁「成/败」选项可用不同 effects 刻画两条路（flags_add 相同）；21 岁「放弃」选项不给 music_stick（放弃后后续两段不触发，符合逻辑）；flag 只在第一条 flags_add，消费事件仅 has_flags。

**验收：** 15 个事件；每个新 flag（pet_dog/pet_memory/venture/venture_out/music_piano/music_stick）恰好 1 个产出者且 ≥1 个消费者；merge 校验通过。

## 任务 A4：T10 晚年温情（fragments/elder-warmth.json）

**Files:** Create `script/fragments/elder-warmth.json`

**Id:** `elderwarm_0001` 起

**事件表**（10 个，76-90 岁区间，每岁至多 1 个）：
- 家人回忆 6 个：孙辈来信 / 老友重聚 / 翻相册 / 旧信重读 / 老伴的早餐 / 儿时物件
- 爱好传承 4 个：老年大学报名 / 打理花园 / 写回忆录 / 教孩子下棋

**约束：** 年龄避开已满档的岁（76-90 现每岁 4 个，每岁补 1 个后 5 个）；effects happiness/social/empathy 正向 +2~+5，可含少量 money 负向（如买花种）；分类 family/friend/hobby/personality。

**验收：** 10 个事件全在 76-90 岁；merge + build:events 通过。

---

# 组 B：玩法组（1 个 agent 顺序执行 T9→T6→T7→T5）

**Files（本组独占）：** `src/hooks/useGame.ts`、`src/components/GameScreen.tsx`、`src/components/TitleScreen.tsx`、`src/components/GoalModal.tsx`、`src/engine/goals.ts`、`src/types/index.ts`、`src/engine/save.ts`、`src/engine/events.ts`（如需）、`src/App.tsx`（如需）、对应测试

**关键现状（已核实，勿重复探索）：**
- `findNextEvent(game, fromIndex, events)` → `{event: LifeEvent|null, skipped: LifeEvent[]}`（useGame.ts:462）
- reducer action：`START_GAME / START_AUTO_GAME / MAKE_CHOICE / CONTINUE`；`START_GAME` 参数 `{gender, name, paceMode, typeSpeed, goal, challenge}`（useGame.ts:220 附近）
- `pickFateEvent(seed)` 从 `RARE_EVENT_IDS`（15 个）按种子抽 1，结果存 `RuntimeState.fateEventId: string | null`（MAKE_CHOICE 里 `state.fateEventId === eventId` 时效果 ×1.5）
- stats：`{totalLives, bestScore, totalAge, endings}`，key `life-sim-stats`；loadStats 宽松校验（`typeof data.totalLives === 'number'` 式）
- `GameState.goal: GoalKey | null`；`GOALS: GoalDef[]`（6 个预设）；`checkGoal(goal: GoalKey | null, game): GoalResult | null`（goals.ts）
- 存档 v2 `life-sim-saves-v2`（GameState 序列化）；GameState 不含 fateEventId（在 RuntimeState）
- TitleScreen 720px 高度余量约 1px——入口改动后必须回归；GameScreen 右上角 ✕ 有确认弹窗（回标题，存档保留）；autoPlay（快速模拟）模式存在
- 周目：`stats.totalLives + 1`；第 2 周目挑战开局（applyChallenge -10）、第 3 周目命运事件（`totalLives >= 2`）

## 任务 B1：T9 局中重开

- [ ] `src/types/index.ts`：Action 联合加 `{ type: 'RESTART' }`
- [ ] `useGame.ts` reducer：RESTART 分支复用 START_GAME 初始化逻辑（从当前 `state.game` 取 gender/name/goal/challenge + state.paceMode/typeSpeed），新随机种子洗牌，`autoPlay: false`
- [ ] `GameScreen.tsx` ✕ 确认弹窗加第三选项「🔄 重新开始本局」（dispatch RESTART）；autoPlay 时不显示
- [ ] 测试：reducer RESTART 后 `game.age` 回到首事件年龄、`phase: 'playing'`、新种子（与上一局 shuffledEvents 顺序可不同）
- [ ] 验证：引擎测试全过 + `npm run build`

## 任务 B2：T6 自定义目标

- [ ] `src/types/index.ts`：`export type CustomGoal = { attrs: Partial<Attributes> }`；`GameState.goal: GoalKey | CustomGoal | null`
- [ ] `goals.ts`：`checkGoal(goal: GoalKey | CustomGoal | null, game): GoalResult | null`——自定义目标逐属性 `game.attributes[k] >= v` 对比，全部达标 = achieved；`GoalResult.detail` 拼「智力 85/100」
- [ ] `GoalModal.tsx`：预设列表后加「🎯 自定义目标」→ 面板：勾选 2-3 个属性 + 滑杆（0-100）设目标值；确认后返回 `CustomGoal`
- [ ] 结算页（SummaryScreen 目标区块）：自定义目标展示「目标值/实际值」；已达标条目样式同预设达成
- [ ] 测试：checkGoal 自定义目标——全部达标/部分达标/空 attrs 三种（空 attrs = 视为达成，恒真）
- [ ] 兼容：读档旧 goal（字符串 key）照常走预设分支

## 任务 B3：T7 每日挑战

- [ ] `useGame.ts`：`dateToSeed(dateStr: string): number`——确定性哈希（逐字符 `(acc * 31 + code) >>> 0`），导出便于测试
- [ ] `START_GAME` action 支持可选 `seed?: number`（缺省随机）；每日挑战用 `dateToSeed(today YYYYMMDD)`
- [ ] 持久化 `life-sim-daily`：`{date: 'YYYYMMDD', bestScore: number, bestAge: number}`；结算时仅当 `date === 今日` 才更新 best
- [ ] `TitleScreen.tsx`：按钮区加「📅 每日挑战」（720px 回归）；点击 → 随机性别/名字 + 固定种子开局（goal=null、challenge=false，手动播放、不写存档槽）
- [ ] 每日挑战入口旁显示「今日最佳 评分 X / 享年 Y」
- [ ] 测试：dateToSeed 确定性（同日期同值、不同日期不同值）；每日结算更新 best 逻辑（可测纯函数）
- [ ] 验证：720px 标题页手动回归（`npm run dev` 或截图）

## 任务 B4：T5 周目扩展（传承加成 + 双命运事件）

- [ ] `useGame.ts` stats 类型 + loadStats：新增 `lastEndAttrs?: Partial<Attributes>`（宽松校验：`typeof data.lastEndAttrs === 'object' && data.lastEndAttrs !== null` 才保留，否则 undefined——旧存档无此字段，无加成）
- [ ] 结算持久化处（achievementPending effect 附近）写入 `lastEndAttrs` = 终局 8 属性
- [ ] 开局加成：`applyInheritance(attrs, lastEndAttrs)`——取 lastEndAttrs 中值最高的 2 项属性（值 ≥ 50 才继承），新局对应属性 +8（上限 100）；挑战开局 -10 独立叠加（先传承后挑战或反之，注释说明顺序）；结算页标注「传承」
- [ ] 双命运事件：`pickFateEvent` 扩展或新增 `pickFateEvents(seed, count)`——`totalLives >= 4`（第 5 周目）抽 2 个；`RuntimeState.fateEventId` 改为 `fateEventIds: string[]`（MAKE_CHOICE 判断 `state.fateEventIds.includes(eventId)`）；存档不涉及（RuntimeState 字段，读档后不持久化——保持现有 fateEventId 同行为）
- [ ] 测试：applyInheritance 取最高 2 项/不足 2 项/值 <50 跳过；双命运事件 `totalLives >= 4` 抽 2 个且 seed 确定；挑战+传承叠加不超 100
- [ ] 兼容：旧 stats 无 lastEndAttrs 时开局无加成（测试覆盖）

**提交建议：** T9/T6/T7/T5 各自独立提交（[NF] 前缀），或一个 [NF] 大提交+分 body；不得混入数据改动。

---

# 组 C：工程组（3 个 agent 并行）

## 任务 C1：T3 分类合并（chiled.json + 存量片段）

**Files:** Modify `script/chiled.json`、`script/fragments/accidents.json`、`script/fragments/elder-life.json`、`script/fragments/flag-payoff.json`、`script/fragments/wealth-events.json`（仅 category 字段）

**映射表**（29 → 11，`category` 值替换）：

| 目标 | 来源 |
|---|---|
| personality | creativity, art, milestone, growth, future |
| health | animal, nature |
| friend | social, conflict |
| career | leadership, competition |
| hobby | interest |
| finance | money |
| education | exam, school, teacher, learning |
| love | emotion |

- [ ] node 脚本（一次性 `script/merge-categories.mjs` 或 sed 式替换）完成替换，然后**删除该脚本**（一次性工具不留在仓库；或保留在 `script/tools/` 下注明一次性）
- [ ] 校验：全部 `category` 值 ∈ 11 个目标分类（`node -e` 检查 chiled.json + 4 片段）
- [ ] `npm run build:events` + 数据测试通过
- [ ] 提交 [CU]: 分类合并

## 任务 C2：T8+T12（PWA + UI 测试基建）

**Files:** Modify `package.json`、`vite.config.ts`、`index.html`；Create `script/gen-icons.mjs`、`public/pwa-192x192.png`、`public/pwa-512x512.png`、`src/test/setup.ts`、`src/test/dialogbox.test.tsx`、`src/test/summary.test.tsx`、`src/test/achievements-modal.test.tsx`、`src/test/biography.test.ts`、`src/test/sound.test.ts`

**T8 PWA：**
- [ ] 安装 `vite-plugin-pwa`（devDependency）
- [ ] `script/gen-icons.mjs`：用 Node 内置 zlib 手写最小 PNG 编码器（IHDR/IDAT/CRC），生成纯色底 + 对角渐变块 192/512 PNG 到 `public/`（游戏主色 #1a1a2e 或现有主题色，先查 TitleScreen/App 的配色常量取主色）
- [ ] `vite.config.ts`：`VitePWA` 插件 + manifest（name 人生模拟器、icons 192/512、theme_color 取主色、display standalone）；SW 用默认 workbox 配置（precache app shell）；`registerType: 'autoUpdate'`
- [ ] 验证：`npm run build` 产物含 `sw.js` + manifest；`npm run dev` 无报错
- [ ] 提交 [NF]: PWA

**T12 UI 测试基建：**
- [ ] 安装 `vitest`、`@testing-library/react`、`@testing-library/user-event`、`jsdom`（devDependencies）
- [ ] `vite.config.ts` 加 `test` 字段（`environment: 'jsdom'`、`setupFiles: './src/test/setup.ts'`、globals）；或独立 `vitest.config.ts`
- [ ] `src/test/setup.ts`：清理 + 必要的 polyfill（matchMedia 等，如组件用到）
- [ ] 首批测试（**避开** TitleScreen/GameScreen/GoalModal——玩法组在改）：DialogBox 打字机渲染/跳过、SummaryScreen 静态渲染（享年/评分/属性表）、AchievementsModal 解锁列表、biography.ts buildBiographyMarkdown 输出结构、sound.ts 不可用环境静默降级
- [ ] `package.json` scripts 加 `"test:ui": "vitest run"`
- [ ] 验证：`npm run test:ui` 全过；`npm run build` 不受影响
- [ ] 提交 [IM]: UI 测试基建

**注意：** package.json / vite.config.ts 只由本 agent 改（玩法组、其他工程 agent 不碰）；安装依赖用 `npm install -D` 保留 lockfile。

## 任务 C3：T11 事件看板（script/stats.mjs）

**Files:** Create `script/stats.mjs`、`script/stats.test.mjs`

- [ ] 纯函数统计模块（导出供测试）：`perAgeDensity(events)`（0-103 每岁计数）、`categoryDistribution(events)`、`flagPairing(events)`（生产/消费配对 + 悬空引用）、`effectRange(events)`（效果值 min/max/分布）、`idStats(events)`（2 位 vs 4 位计数）、`gapReport(events)`（每岁 <3 及 96+ 空缺提示）
- [ ] 入口：`node script/stats.mjs` 打印看板（中文标签，✅ 符号风格同其他 script）
- [ ] `stats.test.mjs`：node:test 覆盖各纯函数（用小型 fixture 事件数组，参考 `script/data-tools.test.mjs` 的 `ev()` 辅助风格）
- [ ] 验证：`node --test "script/*.test.mjs"` 全过；`node script/stats.mjs` 输出与 chiled.json 实测一致（0 岁 1、96 岁 1、97-103 为 0）
- [ ] 提交 [NF]: 事件数据看板

---

# 主会话收尾（不在 agent 内）

- [ ] 汇总各 agent 产出：`node script/merge-fragments.mjs && npm run build:events`
- [ ] 全量测试：`node --test "script/*.test.mjs"`、引擎 47 个、`npm run test:ui`（如有）
- [ ] `npm run build`（tsc 严格）
- [ ] TitleScreen 720px 回归 + `npm run dev` 冒烟（快速模拟一局 → 每日挑战 → 重开弹窗 → 自定义目标）
- [ ] 更新 `CLAUDE.md`（新功能/新配置/新字段 lastEndAttrs/每日挑战/传承/新 fragment 文件）与 `docs/design.md`（如涉及玩法描述）
- [ ] 提交收尾（[CU] 文档同步）
