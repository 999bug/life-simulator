# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

人生模拟器：React 18 + TypeScript + Vite + Tailwind 的文字人生模拟游戏。纯前端、无后端，游戏内容由 JSON 事件数据驱动。事件数据源 `script/chiled.json`（633 个事件：523 原始 + 片段合入，其中 4 位模拟事件经 keep-list 精选 260 个）经转换器生成引擎格式 `public/events.json`（共 633 个事件，运行时 fetch 加载 + SW precache 离线可用），运行时同岁组内按种子洗牌后线性播放。PWA 可安装离线。

## 常用命令

```bash
npm run dev            # vite dev server（端口 5173）
npm run build          # tsc && vite build（生产构建）
npm run preview        # 本地预览构建产物；dist/ 须经 HTTP 访问（preview 或部署上线），直接双击 index.html（file:// 协议）会被浏览器禁止 fetch events.json，报「事件数据加载失败」
npm run build:events   # 重新生成 public/events.json（数据改动后必须跑）
node --test "script/*.test.mjs"   # 数据工具测试（31 个，glob 必须带引号，裸目录形式在本机报错）
node --experimental-strip-types --test script/engine-state.test.ts script/pace-mode.test.ts script/goals.test.ts script/save.test.ts script/use-game.test.ts script/gameplay.test.ts script/verdict.test.ts script/family.test.ts script/talents.test.ts script/life-systems.test.ts script/weekly.test.ts script/achievements.test.ts script/undo.test.ts script/companion.test.ts script/personality.test.ts   # 引擎/档位/目标/存档/玩法/族谱/天赋/系统推导/周挑战/成就/回退/伴侣/性格测试（186 个，Node 22 直接跑 TS；npm test 已含全部）
npm run test:ui   # UI 组件测试（vitest + Testing Library，46 个）
node script/stats.mjs   # 事件数据看板（密度/分类/flag 配对/空缺报告）
node --experimental-strip-types script/sim-balance.ts 500   # 全属性平衡审计（500 局随机模拟：归零率/享年/结局分布，忠实复刻 MAKE_CHOICE 流程）
```

## 架构

### 数据管道（script/）— 纯数据工程，不改引擎

```
script/chiled.json ──convert-events.mjs──▶ public/events.json
        ▲
        └──prune-events.mjs（精选过滤）/ merge-fragments.mjs（片段合并+三重校验）
```

- **chiled.json**：事件数据源（snake_case 原始格式：`age_range`/`flags_add`/`has_flags`/`min_attrs`）。**所有事件改动都改这里，不手改 events.json**
- **convert-events.mjs**：唯一转换器。`ATTR_MAP`（107 键）把 chiled 属性名映射到 8 大引擎属性；`INVERSE` 集合内的键是负向维度（取反求和，如 `pressure:+8` → happiness:-8）；未映射键 fail-fast 抛错；**事件 id 校验**（2 位主线/4 位模拟，其他抛错）；**选项 `personality` 手工性格标注透传**（白名单 6 端校验 fail-fast，透传到 `outcomes.personality`，引擎 traitForOutcome 优先采用——内容层文案重写时标注）。`ATTR_ORDER`/`STAGE_RANGES` 需与 `src/engine/state.ts` 的 `ATTR_META`/`STAGE_META` 手动同步。**产物为 `public/events.json`**（无缩进压缩输出）：运行时 fetch 加载（避免 586KB 数据内联进单文件 bundle，首屏 HTML 584KB→302KB），SW precache 保离线
- **apply-rewrites.mjs**：文案重写补丁工具（`script/rewrites/*.json`，按 id 精确替换 title/text/choices 文案与 personality 标注，**效果值/flags/conditions 一律保留原值**——防重写误伤平衡与事件链；补丁选项数不匹配即抛错）。分批重写已覆盖全部 681 个事件（batch1-a~d 童年 81 个、batch2 青年 144 个、batch3 中年 234 个、batch4 老年 216 个；手工标注 1681 个，徽章覆盖率 0-2 岁 62% / 3-12 岁 76% / 13-30 岁 92% / 31-60 岁 94% / 61+ 岁 93%）。后续文案优化续用
- **prune-events.mjs**：精选工具。事件 id 规则：**2 位数字后缀 = 原始主线事件（如 child_01），一字不改、永远保留；4 位数字后缀 = 模拟事件（如 child_0017），只能被精选删除、不能改内容**。`keep-list.json` 记录保留清单（审计用，当前 260 条 = 全部保留的模拟事件；新增模拟事件后需同步追加，否则 prune 会被过滤）。运行方式：`node script/prune-events.mjs script/keep-list.json`（写回 chiled.json，含 gap_year 补丁）
- **merge-fragments.mjs**：合并 chiled.json + `script/fragments/` 片段，跑三重校验：convertAll fail-fast + 每岁密度（0-2 岁 3-5 个、3-12 岁 5-13 个、13-75 岁 3-8 个）+ flag 生产/消费配对（has_flags 引用的 flag 必须有产出者，not_flags 不算悬空）。**幂等**：片段中已合并的 id 自动跳过，片段文件保留在 fragments/ 目录可重复运行
- **clamp-effects.mjs**：效果值钳位工具。4 位模拟事件的效果按转换后属性值等比例压缩到 ±3~±20 声明范围内（多键求和超范围时压缩该属性所有来源键）；2 位主线一字不改。幂等，效果值调整后用它 + build:events
- **rebalance-effects.mjs**：抉择质量改造（2026-08 P0-1）。声明式 REBALANCE 表给 3-12 岁 21 个全正模拟事件的高收益选项加代价维度（压力/金钱/社交/幸福，与叙事匹配），「设置为目标值」语义幂等。2 位主线不动。运行后接 build:events
- **stats.mjs**：事件数据看板——每岁密度（0-103）/分类分布/flag 生产-消费配对与悬空引用/效果值范围/2 位 vs 4 位 id 统计/96+ 岁空缺报告，统计逻辑纯函数可测试。**悬空口径**：含合法项（被结局 verdictKey/成就/目标消费的 flag、parent_ 前缀注入 flag），审计「真死 flag」需额外排除 src/engine 的引用
- **gen-icons.mjs**：PWA 图标生成（Node 内置 zlib 手写 PNG 编码器，192/512 主色图标到 public/）

事件/效果改动一律走 chiled.json + convert/prune/merge/clamp 管线，不手改 events.json（见「约定」章节）

### 引擎（src/engine/）— 纯函数，无副作用

- **state.ts**：属性/阶段元数据（ATTR_META、STAGE_META）与状态纯函数（ageCap 年龄锚点上限、effectiveDelta 收益折算、applyOutcomes 属性钳位 0-100、calcMaxAge 动态寿命、applyElderDecay 65 岁起衰减、checkDeath、calcScore）。**年龄锚点成长上限 `CAP_ANCHORS`**（如智力 7:55→18:85→30:92，锚点间线性插值）：正向收益距当前年龄上限 15 点内线性递减且不越过上限，负向全额；老年衰减下限 1（运气再好每事件也掉 1 点）。初始属性刻意偏低（健康 65/智力 25）。选项展示用 effectiveDelta 实时计算，与引擎一致。**动态寿命**：基础 68 + 平均属性/100×35（封顶 103，均衡属性 ≥77 可达 95 岁——91-95 岁事件设计为高玩可达内容）
- **goals.ts / achievements.ts / verdict.ts**：人生目标判定（6 预设 checkGoal）、成就判定（34 个 checkAchievements，铜/银/金三档 tier 仅展示分组，4 个 hidden 隐藏成就解锁前只露问号；applyAchievementBonus 每解锁 10 成就开局全属性 +2 封顶 +6）、结局 key 纯函数（verdictKey，13 路线 flag + 5 档分数兜底；VERDICT_ROUTES 图鉴元数据表，SummaryScreen 结局标题同表查取）
- **talents.ts**：天赋系统（20 个 4 级稀有度黑/蓝/紫/橙、互斥对、属性+点数效果；drawTalents 权重抽 10 选 3、applyTalents/applyAllocation 开局应用、talentConflict 互斥校验、loadInheritTalent/saveInheritTalent 跨世传承 localStorage）。**天赋效果只用属性不给 flag**（flag 会被结局判定消费破坏分布）
- **undo/companion/retirement**：后悔回退（RuntimeState.undoStack ≤5 步快照：game/eventIndex/feedback/skippedCount/companionNextAge/currentEventId；UNDO 回退一步、UNDO_TO_AGE 回退到某岁，restoreUndo 重建当前事件——companion 事件不在事件数组需按互动年龄重建）；伴侣互动（companion.ts 题库 8 个 love 事件，married 后每 4 岁一次 25-61 岁插入播放流，**插入时 eventIndex 保持插入点、选择完成后才推进互动年龄**——双重推进/跳过正常事件是踩过的坑）；退休（retirement.ts：女性 55/男性 60 按性别推导，retired flag 优先）；称呼替换（utils/naming.ts：渲染层「你」→ 玩家名字，跳过 你们/你自己——纯展示不改数据）
- **推导系统（纯函数，零存档字段）**：jobs.ts（flag→职业映射 + jobLevel 从业每 3 年 1 级）、npcs.ts（history 中 family/love/friend 分类事件正负选择 → 家人/伴侣/朋友关系值 0-100）、gaokao.ts（学业 flag → 高考结果回顾；事件链已完整，本函数只做展示）、assets.ts（投资链 flag 递进 + 财富档 → 资产组合）、weekly.ts（ISO 周号 weekOf/weekSeed → 每周挑战目标 pickWeeklyGoal + checkWeeklyGoal 终局判定）、personality.ts（**性格画像**：3 维 6 端——理性/感性/冒险/安稳/利己/利他；traitForOutcome 强信号规则从选项效果映射（智力≥6 且幸福≤0 → 理性、幸福≥6 且智力≤0 → 感性、负向与正向总额均≥8 → 冒险、财富≥8 且道德为负 → 利己、道德≥6 → 利他）+ PERSONA_FLAG_RULES 叙事 flag 补充表（gap_year/volunteer/civil_servant 等 19 个，内容层重写时扩充）；derivePersona 从 history 反查事件表逐条累积、缺失事件跳过；personaSummary 一句话概括（Top1 形容词 + 跨维 Top2 人设名词）。**这些系统全部从 GameState 推导，旧存档与回看自动兼容**
- **events.ts**：事件注册表——`EVENTS` 为 live binding（named export），`loadEvents()` 运行时 fetch `public/events.json`（main.tsx 入口 await 后才挂载 React，失败有静态兜底 DOM）；node 测试用 `setEvents(readFileSync('public/events.json'))` 注入。含 filterEvents 精简模式抽样 + shuffleEvents 同岁组洗牌（共用种子确定性重建）
- **public/events.json**：生成物（camelCase 引擎格式：`age`/`category`/`outcomes.attr`/`outcomes.flags`/`conditions.hasFlags`），**勿手改**

### 运行时（src/hooks/useGame.ts）

`useReducer` 驱动游戏循环，核心机制：
- **线性播放**：`findNextEvent` 从当前 index+1 线性扫描第一个 conditions 满足的事件，**同时收集条件不满足的跳过事件**（`skippedEvents`，结算页「本可发生而未触发」展示）；**年龄由事件自身驱动**（同一岁的多个事件连续触发）
- **同岁组洗牌（重玩性）**：开局随机种子对同岁事件洗牌（`shuffleEvents`，含 flag 依赖修正——消费事件排在产出者之后），同种子可复现；种子随存档保存
- **节奏档位**：密度（沉浸全量 / 精简每岁 1-2 个，`filterEvents` 主线优先抽样 + flag 闭包，`liteTarget`：0-2 岁全保留、3-12 岁 2 个、13+ 岁 1 个）开局选定；打字速度（慢/中/快）游戏内实时切换（DialogBox speedRef，不重启打字机）；点击跳过打字
- **存档 v2**：`life-sim-saves-v2` = 3 槽位 + active（`src/engine/save.ts`：SavesV2/migrateLegacySave 旧版自动迁移/isValidSaveData 内容校验）；标题页 3 卡片点击继续、开始新局覆盖确认；**快速模拟不写槽**（autoPlay guard）；RESET 保留槽位（回标题不丢档）
- **目标/成就/统计**：`goal` 入 GameState（预设 key 或自定义 `CustomGoal {attrs}`——GoalModal 勾选属性+滑杆设目标值，结算逐项达标即达成）；成就存 `life-sim-achievements`（unlocked/completedLives/endings）；统计存 `life-sim-stats`（totalLives/bestScore/totalAge/endings 分布 + lastEndAttrs 终局属性，传承加成用，旧存档缺失无加成）；每日挑战存 `life-sim-daily`（date/bestScore/bestAge，仅当日更新最佳）；结算时经 `achievementPending` 标志一次性持久化（读档恢复不重复计数）
- **本地埋点**：`life-sim-analytics-events`（原始事件流，截断 300 条）+ `life-sim-analytics-daily`（按日聚合，无限累积）；采集开局/结算/放弃/阶段/功能使用 5 类事件，标题页「📊 数据」面板查看 + 导出 JSON，不收集个人信息
- **家族族谱**：`life-sim-family` = FamilyMember[]（`src/engine/family.ts`：loadFamily/saveFamily/appendFamilyMember 纯函数，容量 100 裁最老）。**每一生结算都入谱**（世代 = 族谱长度 + 1，记录享年/评分/结局 key/终局属性/日期；快速模拟局标 `auto: true` ⚡、每日挑战局标 `daily: true` 📅）；标题页 FamilyModal 展示（最新在上、越早越淡）；GoalModal 开局提示「你将作为第 N+1 代出生」。**结算回看**：新代携带 `detail`（history/snapshots/flags/goal/deathCause/skippedTitles≤20），仅最近 15 代保留（`FAMILY_DETAIL_MAX`，约 1MB，更老代裁为摘要行）；`recapGame(member)` 重建只读 GameState，StatsModal「每一世」列表与 FamilyModal 行点击打开 SummaryScreen 只读回看（z-60 覆盖层，分享卡片/传记导出可用）；**跨代继承**：开局按上一代结局路线注入 `parent_<verdictKey>` flag（`parentFlag`——**跳过 auto 代向上取最近手玩局**，分数档结局不注入），fragments/lineage.json 16 个继承事件消费（6-17 岁：童年 10 个 + 少年段 6 个，覆盖全 13 条结局路线含学历向 top_university/went_to_college/retake）；`parent_` 前缀 flag 无事件产出者，merge 配对校验与 lite 闭包测试均豁免
- conditions 不满足的事件静默跳过；flags 累积在 `game.flags`（不重复）；历史 `history` 含 `flags?` 字段（生涯年表里程碑标记，旧存档兼容）
- 死亡判定：健康归零或超过 `calcMaxAge`；死因记录在 `game.deathCause`（health 耗尽 / lifespan 寿终），结算页展示临终叙事
- `MAKE_CHOICE` 预载下一事件（gameOver 时判定成就/统计），`CONTINUE` 只清反馈；反馈页正向收益距年龄上限 15 点内标注「（距上限 X 点）」
- **音效/BGM**：`src/utils/sound.ts` 用 Web Audio 合成轻量 UI 音效（点击/选择/打字/推进/落幕/成就琶音/阶段过渡），无外部资源，浏览器不可用时静默降级；`setMuted` 供快速模拟模式静音高频交互音。**阶段 BGM**：`startBgm(stage)`/`stopBgm()`——7 阶段各一组五声音阶慢速琶音循环（BGM_PATTERNS，慢起音 pad 包络，音量低于交互音效；婴儿八音盒→晚年宁静），GameScreen 随 stage 切换、卸载停止
- **成长曲线**：`GameState.snapshots`（可选，`AttrSnapshot[]`）每岁属性快照——`appendSnapshot`（state.ts）进入新岁或终局记录、同岁内不重复、同岁终局替换该岁条目；开局记首事件年龄，旧存档无字段从读档岁重建；结算页 GrowthChart canvas 绘制（x 0→享年、y 0-100、末端圆点 + HTML 图例带终值）
- **快速模拟**：标题页「⚡ 快速模拟」以随机性别/名字开局（`START_AUTO_GAME`），**用精简档抽样（每岁 1-2 个，一局约 30 秒）**；自动模式每 220ms 随机选择推进、跳过打字机（DialogBox `instant`）与选择面板，直到结算；重新开始或读档自动退出自动模式
- **每日挑战**：标题页「📅 每日挑战」以日期确定性种子（`dateToSeed`，YYYYMMDD → number）开局，同一天全局同一局；手动播放、无目标/无挑战、不写存档槽（saveState guard 含 isDaily）；入口旁展示「今日最佳 评分/享年」（`life-sim-daily`）
- **每周挑战**：标题页「🗓️ 每周挑战」以周确定性种子（`weekSeed`，ISO 周号 → number）开局，同一周同一局 + 一个周目标（`pickWeeklyGoal` 从 5 个目标池按周种子抽取：活到 80/财富/学业/医生/家庭），终局 `checkWeeklyGoal` 判定通关（`life-sim-weekly` 记录当周最佳与通关标记）；不写存档槽（isWeekly）、不开天赋构筑（公平固定开局）
- **开局构筑**：普通手动开局（非每日/每周/种子挑战）点开始后先弹 **BuildModal**（天赋抽卡 10 选 3 + 12 点属性分配，天赋可能增减点数）再进 GoalModal；`START_GAME` 传 talents/alloc，`startNewGame` 按序应用：初始 → 天赋 → 分配点 → 成就加成 → 传承 → 挑战；RESTART/REINCARNATE 保留出生配置（GameState.talents/allocated 存档兼容，旧存档无字段）；结算页可把本局天赋设为传承（下一世抽卡置顶 🧬）
- **种子挑战**：标题页「🔑 种子」输入好友的种子码开局（SeedModal 纯数字校验，< 2^31）——同种子同事件序列（shuffleSeed 确定性洗牌），纯前端好友比分。`RuntimeState.seedChallenge` 标记，局中重开保持该种子（与每日挑战同规则）；种子锁定一次性（回标题后需重新输入）；分享卡片底部展示种子码「🔑 种子 N · 输入同一数字，挑战我走过的这一生」
- **局中重开**：GameScreen ✕ 确认弹窗第三选项「🔄 重新开始本局」（`RESTART` action 复用 startNewGame，同设置新随机种子；每日挑战局重开保持固定种子）；快速模拟不显示
- **周目解锁**：按 `stats.totalLives + 1` 计算周目——第 2 周目起标题页解锁「⚔️ 挑战开局」（`GameState.challenge`，开局属性 `applyChallenge` 整体 -10，结算评分 ≥70 解锁「破局者」成就）与「🎭 真实模式」（`GameState.realMode`，ChoicePanel 选项只显示属性倾向箭头 ↑/↓（\|v\|≥8 双箭头、effectiveDelta 为 0 不显示），隐藏精确数值，反馈页仍显示精确变化作事后学习）；第 3 周目起抽取**命运事件**（`pickFateEvent(seed)` 从 `RARE_EVENT_IDS` 15 个精选事件按种子抽 1，确定性可存档还原），该事件触发时效果 ×1.5（`scaleOutcomes`）、游戏内显示「⚡ 命运事件」角标；第 4 周目起解锁**传承加成**（结算把终局属性写入 `stats.lastEndAttrs`，开局 `applyInheritance` 取最高 2 项 ≥50 的属性各 +8、上限 100，与挑战 -10 独立叠加，结算页标注「🧬 传承」）；第 5 周目起**双命运事件**（`pickFateEvents(seed, count)` 抽 2 个，`RuntimeState.fateEventIds` 数组，单抽与双抽同种子同源）
- **传记导出**：结算页「📜 导出人生传记」——`src/utils/biography.ts` 的 `buildBiographyMarkdown` 生成叙事 markdown（大事记按岁分组 + 事件标题 + 里程碑 ⭐ + **性格画像章节（概括句 + 各端次数）** + 最终属性表），`downloadText` 触发下载

### UI（src/components/）

- **GameScreen**：全屏流式布局（脱离 960×720 舞台）。场景 h-[55%] + 底部区 max-h-[45%] 恰好互补；**数值栏锚定场景区底缘（h-[55%] 容器内 flex 到底）——与底部区结构性不重叠，改动需保持此关系**；大屏限宽居中：数值栏网格 max-w-960、对话/选项/反馈内容 max-w-860；底部区含 `pb-9` 防速度按钮遮挡；右上角 ✕ 确认弹窗三选项（取消/🔄 重新开始本局/确定回标题，存档保留；快速模拟不显示重开）；**反馈页「你的选择」徽章行**（lastTraits 从 history 最后一条反查选项推导，与 ChoicePanel 徽章同源）
- **DialogBox**：打字机效果（速度档位 + 点击跳过）+ 「▼ 点击继续」；事件标题显示为「标题」；事件文本经 useName 称呼替换（「你」→ 名字）
- **ChoicePanel**：选项按钮（`button.group` class）；**普通模式不显示效果数值**（2026-08 实测反馈：防按数值选择，选完反馈页显示精确变化），真实模式只显示 ↑/↓ 倾向箭头；选项文字 line-clamp-2 完整文本悬浮；**性格徽章**（traitForOutcome 推导，PERSONA_META 配色小标签，无信号不显示——留白也是区分；风格提示非数值，真实模式保留）
- **TitleScreen**：名字/性别 + **节奏档位（沉浸/精简）+ 打字速度 + 3 存档卡片 + 开局构筑（BuildModal 天赋抽卡 + 属性分配）+ 目标选择模态（GoalModal，含「🎯 自定义目标」勾选属性+滑杆设目标值 + 家族继承提示）+ 成就（AchievementsModal 铜/银/金分层 + 达成率进度条，隐藏成就 ❓）+ 人生图鉴（CollectionModal 13 结局路线收集，数据取自 stats.endings）/家族族谱（FamilyModal 跨世代收藏，行可点击回看）/生涯统计（StatsModal，含「每一世」回看列表）/玩法说明（GuideModal，首次进入自动弹出一次——`life-sim-guide-seen` 标记）入口 + 快捷入口行（⚡ 快速模拟/📅 每日挑战/🗓️ 每周挑战/📊 生涯/🏆 成就/📖 图鉴/🌳 家族/❓ 玩法/🔑 种子/🎨 主题，flex-wrap 窄屏换行）**。布局：不动层（光晕/粒子）+ 滚动层（内容 `my-auto` 居中——不溢出居中、溢出可滚动，杜绝 justify-center 对称裁切）；模态放滚动层外；**模态统一 `max-w-[92vw]` + `max-h-[min(520px,86vh)]` 防手机裁切**
- **SummaryScreen**：结算页（享年 + 结局 + 评分 + 属性 + 职业/高考/天赋推导信息行 + 成长曲线 + 大事记 + 目标达成度 + 与身边人（npcs 三线关系值）+ **性格画像（derivePersona 推导，3 维双端条形图 + personaSummary 一句话概括，弱画像只显示概括句）** + 资产组合 + 天赋传承面板（本局天赋设传承）+ 新解锁成就 + 本可发生而未触发 + 分享卡片 + 传记导出 + **人生年鉴（AlmanacModal：评分/曲线/职业资产/家人/大事记速览，导出 markdown）** + 每周挑战达成展示）
- **StatusBar/GameScreen**：属性网格上方职业/资产摘要行（jobStatus+assetStatus 推导 caption）；GameScreen 顶部每周挑战角标
- **SummaryScreen**：结算页（享年 + 结局 + 评分 + 属性 + **成长曲线（GrowthChart canvas 8 维随年龄折线图，图例悬停临时聚焦/点击固定聚焦单条曲线，其余淡化）+ 人生大事记完整时间线（里程碑 ⭐）+ 目标达成度 + 新解锁成就 + 本可发生而未触发 + 分享卡片（ShareCardModal canvas PNG，含迷你成长曲线 + 名字行世代数「· 第 N 代」（App 按族谱最新一代传入）+ 底部种子码 + 传播 CTA「如果重来一次，你会怎么选？」）+ 传记导出**）
- **SceneArea/SceneDecor/CategoryDecor**：场景背景 = 阶段渐变（STAGE_BG）+ 阶段 SVG 装饰（SceneDecor）+ **事件分类场景**（CategoryDecor，11 分类各一组 SVG 元素：家庭→沙发、事业→写字楼、健康→医疗十字、教育→黑板、友谊→咖啡桌、爱情→爱心、科技→屏幕电路、金融→金币折线、爱好→调色板吉他、运动→跑道篮筐、个性→对话气泡星）+ **选项属性色调响应**（GameScreen 选选项后按效果主属性叠加底部光晕，8 属性→色：health 绿/intelligence 蓝/wealth 金/happiness 橙/social 青/appearance 粉/luck 紫/morality 米白；继续后还原）
- **App**：三个阶段（标题/对局/结算）均全屏流式渲染，无舞台框无缩放；窄屏由各组件响应式适配（StatusBar grid-cols-2→sm:4、SceneArea 人物 SVG 随场景高度等比缩放上限 280px）

## 事件数据格式

```jsonc
// chiled.json 原始格式（snake_case）
{
  "id": "young_20",
  "age_range": [18, 19],
  "category": "family|career|health|friend|education|personality|technology|love|finance",
  "title": "事件标题",
  "text": "第二人称叙事 50-150 字",
  "choices": [
    { "text": "第一人称行动或台词", "effects": { "happiness": 8, "money": -5 }, "flags_add": ["gap_year"] }
  ],
  "conditions": { "has_flags": [], "not_flags": [], "min_attrs": {}, "max_attrs": {} }
}
```

- effects 键只能取 `ATTR_MAP` 内的键（107 个）；值 ±3~±20（原版数据有 ±2 与 25 的先例）；每项 1-3 键
- 选项可选 `personality: ["rational"]` 手工性格标注（6 端白名单：rational/emotional/adventurous/cautious/selfish/altruistic；标注即最终信号，覆盖效果自动推导——用于修正「自律→利他」类误判与供给无信号端（安稳））
- flags 生产（`flags_add`）/消费（`has_flags`）必须成对；新 flag 必须登记产出者与消费者
- 合并后密度校验：0-2 岁 3-5、3-12 岁 5-13、13-75 岁 3-8 个/岁
- 测试数据工具用 node:test，见 `script/data-tools.test.mjs` 的 `ev()` 辅助函数

## 约定

- 提交信息：中文 subject + 前缀（[NF]/[BF]/[CU]/[IM]），body 用 `- ` 列表，禁止 AI 署名尾注
- 注释中文、日志英文（script 脚本的 console 输出用中文 ✅ 符号）
- 不改 `src/engine/` 已生成文件与 2 位 id 原始事件；数据改动走 chiled.json + build:events
