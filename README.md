# 人生模拟器 Life Simulator

纯前端文字人生模拟游戏：从 0 岁到晚年，在 468 个事件中做出选择，走完属于你的一生。技术栈：React 18 + TypeScript + Vite + Tailwind CSS。

## 快速开始

需要 Node.js 20+（项目使用 ESM 与 node:test）。

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器（端口 5173）
```

浏览器打开 **http://localhost:5173** 即可游玩。

## 游戏玩法

1. **开局**：输入名字（可留空）、选择性别，点「开始人生」
2. **人生事件**：每个事件是一段人生叙事（如「第一次语文考试」），下方给出 2-4 个选项，点击选择后生效
   - 选项会改变 8 大属性（💪健康 🧠智力 💰财富 😊幸福 👥社交 🎨魅力 🍀运气 ⚖️道德）并可能解锁后续事件的触发条件（flag）
   - 纯叙事事件（无选项）点击「▼ 点击继续」推进
3. **人生走向**：
   - 初中/高中/高考是人生的关键分水岭——认真备考才能考进重点高中、重点大学，决定后续是高薪技术线还是普通工作线
   - 属性会随选择变化；65 岁起健康随年龄衰减，健康归零或超过最大寿命即去世
4. **结算页**：享年、综合评分、属性面板与人生路线评价（创业者/技术精英/学霸/匠心/平凡等），点「重新开始」再来一局

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发服务器（Vite，热更新） |
| `npm run build` | 生产构建（TypeScript 检查 + 打包到 dist/） |
| `npm run preview` | 预览生产构建产物 |
| `npm run build:events` | 从 `script/chiled.json` 重新生成 `src/engine/events.json` |
| `node --test "script/*.test.mjs"` | 运行数据工具测试（19 个用例） |

## 游戏数据

事件数据源在 `script/chiled.json`（468 个事件，snake_case 原始格式），修改后运行 `npm run build:events` 生成引擎使用的 `src/engine/events.json`（**请勿手改生成文件**）。

- 事件 id 规则：2 位数字后缀为原始主线事件，4 位数字后缀为模拟事件
- effects 属性键需在 `script/convert-events.mjs` 的 ATTR_MAP 内（未映射键会转换报错）
- 事件触发条件（conditions）不满足时整事件跳过，同一岁多个事件按数组顺序连续触发

## 项目结构

```
src/
  engine/     # 状态逻辑纯函数（属性/阶段/寿命/评分）与事件数据
  components/ # 界面（开局/游戏/对话框/选项/结算）
  hooks/      # useGame：游戏循环（线性播放 + 条件跳过）
  types/      # 类型定义
script/       # 数据工具（转换器/精选/合并/测试）
```

更多开发细节见 `CLAUDE.md`。
