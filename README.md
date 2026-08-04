# 人生模拟器 Life Simulator

纯前端文字人生模拟游戏：从 0 岁到晚年，在 **490 个事件**中做出选择，走完属于你的一生。技术栈：React 18 + TypeScript + Vite + Tailwind CSS，零后端、零外部依赖。

## 立即游玩

- **💾 单文件版**：从 [GitHub Releases](https://github.com/999bug/life-simulator/releases) 下载 `index.html`，**双击用浏览器打开即可玩**，无需安装任何环境，适合直接发给朋友
- **开发者模式**：需要 Node.js 20+

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器（端口 5173）
```

## 游戏玩法

1. **开局**：输入名字（可留空）、选择性别，点「开始人生」；有存档时可点「继续人生」接着玩；点「⚡ 快速模拟」自动随机走完一生看结果
2. **人生事件**：每个事件是一段人生叙事（如「第一次语文考试」），下方给出 2-4 个选项，点击选择后生效
   - 选项会改变 8 大属性（💪健康 🧠智力 💰财富 😊幸福 👥社交 🎨魅力 🍀运气 ⚖️道德）并可能解锁后续事件的触发条件（flag）
   - 选项面板显示**实际生效值**（受年龄成长上限影响），属性达到当前年龄上限时进度条转金色
   - 纯叙事事件点击「▼ 点击继续」推进
3. **成长曲线**：属性按年龄渐进成长——童年偏低、中年封顶、老年健康回落，避免低龄数值拉满
4. **人生走向**：
   - 初中/高中/高考是人生的关键分水岭——认真备考才能考进重点高中、重点大学，决定后续是高薪技术线还是普通工作线
   - 童年立下的人设（宿敌/发小/初恋/体育梦）会在青年中年以事件呼应
   - 青年中年可能遭遇意外（车祸/急病/裁员/家变）；65 岁起健康随年龄衰减，健康归零或超过最大寿命即去世
5. **结算页**：享年、死因与临终叙事、综合评分、属性面板与人生路线评价（创业者/技术精英/学霸/匠心/平凡等 13 种），点「重新开始」再来一局
6. **重玩性**：每局同岁事件顺序随机洗牌（含 flag 依赖修正），每次人生都不完全相同

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器（Vite，热更新） |
| `npm run build` | 生产构建，产出**单文件** `dist/index.html`（JS/CSS/数据全内联，可双击运行） |
| `npm run preview` | 预览生产构建产物 |
| `npm run build:events` | 从 `script/chiled.json` 重新生成 `src/engine/events.json` |
| `node --test "script/*.test.mjs"` | 运行数据工具测试（19 个用例） |
| `node --experimental-strip-types --test script/engine-state.test.ts` | 运行引擎测试（18 个用例，Node 22 直接跑 TS） |

## 游戏数据

事件数据源在 `script/chiled.json`（490 个事件，snake_case 原始格式），修改后运行 `npm run build:events` 生成引擎使用的 `src/engine/events.json`（**请勿手改生成文件**）。

- 事件 id 规则：2 位数字后缀为原始主线事件（一字不改），4 位数字后缀为模拟事件（精选删除/效果钳位）
- effects 属性键需在 `script/convert-events.mjs` 的 ATTR_MAP 内（未映射键会转换报错）
- 事件触发条件（conditions）不满足时整事件跳过；同一岁多个事件按洗牌后的顺序连续触发
- 新增事件片段放 `script/fragments/`，运行 `node script/merge-fragments.mjs` 合并（幂等，含三重校验）

## 项目结构

```
src/
  engine/     # 状态逻辑纯函数（年龄锚点上限/属性/寿命/评分/事件洗牌）与事件数据
  components/ # 界面（开局/游戏/对话框/选项/状态栏/结算）
  hooks/      # useGame：游戏循环（线性播放 + 存档 + 快速模拟）
  utils/      # 音效（Web Audio 合成，无外部资源）
  types/      # 类型定义
script/       # 数据工具（转换器/精选/合并/钳位/补写/测试）与 fragments 片段
```

更多开发细节见 `CLAUDE.md`。
