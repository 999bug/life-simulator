# 人生模拟器排行榜 / 云存档后端

本目录是独立部署在 Cloudflare Workers + KV 的轻量后端。前端仍部署在 GitHub Pages，未配置后端地址时完全静默降级。

## 目录

- `src/index.js`：Worker 入口，包含昵称排行榜、云存档预留接口、CORS、参数校验与基础限流。
- `wrangler.toml`：Worker 配置和 `LEADERBOARD` KV 绑定。
- `.env.example`：本地环境变量示例（当前没有必须的服务端密钥）。

## 一、首次准备

要求 Node.js 20+（本仓库已在 Node 22 上验证）并注册 Cloudflare 账号。

```powershell
cd F:\ai\life-simulator\server
npm install
npx wrangler login
```

## 二、创建 KV namespace

```powershell
npx wrangler kv namespace create LEADERBOARD
```

输出类似：

```text
{ binding = "LEADERBOARD", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

把输出的 `id` 替换到 `wrangler.toml` 的：

```toml
kv_namespaces = [
  { binding = "LEADERBOARD", id = "REPLACE_WITH_KV_NAMESPACE_ID" }
]
```

`account_id` 不需要写进 `wrangler.toml`：`wrangler login` 后 CLI 会自动读取当前账号。如果你有多个账号，可用 `npx wrangler whoami` 确认后，再在部署命令中临时指定 `CLOUDFLARE_ACCOUNT_ID`。

## 三、配置 CORS

`wrangler.toml` 中默认：

```toml
[vars]
CORS_ORIGINS = "https://999bug.github.io,http://localhost:5173"
```

只允许正式 GitHub Pages 域名和本地 Vite 调试地址。多个来源用英文逗号分隔，不要带末尾斜杠。修改后重新 `npm run deploy`。

## 四、本地调试

先把 KV id 替换好，然后：

```powershell
npm run dev
```

默认监听 `http://localhost:8787`。本地 Worker 使用 KV 本地模拟，不会写线上数据。

如果要本地读取 Cloudflare 密钥，可复制示例文件并填写：

```powershell
Copy-Item .env.example .dev.vars
```

`.dev.vars` 已被根目录 `.gitignore` 忽略，不会提交。

## 五、部署

```powershell
npm run deploy
```

部署成功后 CLI 会给出 `https://life-simulator.<你的子域>.workers.dev`。

前端构建时配置：

```powershell
$env:VITE_API_BASE="https://life-simulator.<你的子域>.workers.dev"
npm run build
```

GitHub Pages 的自动构建可以在仓库 Secrets/Variables 里设置 `VITE_API_BASE`，再在 `.github/workflows` 中构建前注入。当前代码默认 `API_BASE` 为空，因此不配置也能正常游玩。

## 六、是否需要密钥

当前排行榜和云存档接口都不需要服务端密钥：

- 排行榜公开只读；
- 成绩上报靠匿名 `deviceId` 去重和限流；榜单展示的 `name` 是玩家自填昵称，不要求实名。
- 云存档按 `deviceId` 读写，`deviceId` 是前端 `crypto.randomUUID()` 生成并保存在本地的匿名标识，不包含个人信息。

如果以后增加管理接口，不要把 token 写进代码。用法：

```powershell
npx wrangler secret put ADMIN_TOKEN
```

Worker 中用 `env.ADMIN_TOKEN` 读取。本地调试时放在 `server/.dev.vars`：

```text
ADMIN_TOKEN=replace-me
```

## 七、接口说明

### 1. POST `/api/score`

请求体：

```json
{
  "mode": "daily",
  "key": "20260814",
  "deviceId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "小明",
  "score": 82,
  "age": 91,
  "endingKey": "doctor"
}
```

- `mode`：`daily` / `weekly` / `seed`。
- `key`：每日 `YYYYMMDD`、每周 `YYYY-Www`、种子数字字符串。
- `name`：展示昵称，会被去除控制字符、合并空白并截断到 24 个字符；缺省或为空时显示「无名玩家」。
- `score` 钳位到 `[0,100]`，`age` 钳位到 `[0,103]`，`endingKey` 使用前端 16 条路线 + 5 个分数档白名单。
- `summary`（可选）：精简结算数据，包含 `gender`、`attributes`、`snapshots`、`deathCause`，用于点击榜单查看该局结果。
- 同一 `deviceId` 在同一 `mode+key` 下只保留最高分；更低或相同成绩不会覆盖，但每次上报都会刷新该条目的展示昵称。

成功响应：

```json
{
  "accepted": true,
  "myRank": 12,
  "myPercentile": 12,
  "total": 100
}
```

未进入 top 100 时 `myRank` / `myPercentile` 为 `null`。

### 2. GET `/api/leaderboard?mode=daily&key=20260814&deviceId=...`

`deviceId` 可省略，省略时只返回榜单。响应：

```json
{
  "mode": "daily",
  "key": "20260814",
  "entries": [
    { "deviceId": "...", "name": "小明", "score": 92, "age": 88, "endingKey": "top_university", "ts": 1757000000000 }
  ],
  "myRank": 12,
  "myPercentile": 12,
  "total": 100
}
```

### 3. GET / PUT `/api/save?deviceId=...`

云存档接口预留。GET 返回：

```json
{ "exists": true, "data": { "updatedAt": 1757000000000, "data": { } } }
```

PUT 请求体必须是 JSON 对象，上限 64KB：

```json
{ "saves": "..." }
```

前端目前尚未接入云存档。

## 八、数据模型

KV key 形如：

```text
lb:daily:20260814
lb:weekly:2026-W33
lb:seed:123456
```

value 为按 `score` 降序、最多 100 条的 JSON 数组：

```json
[
  { "deviceId": "...", "name": "小明", "score": 92, "age": 88, "endingKey": "top_university", "ts": 1757000000000 }
]
```

另有：

- `rl:<deviceId>:<分钟时间戳>`：基础限流计数，自动过期。
- `save:<deviceId>`：云存档。

## 九、免费额度与限制

以 Cloudflare 官方定价页为准，常见免费档约：

- Workers：每天 10 万次请求；
- KV：每天 10 万次读、1000 次写，存储 1GB。

本项目单局只在结算时写一次榜单，标题页读一次每日/每周榜，规模远低于免费额度。KV 是最终一致存储，极限并发下可能出现极小概率的写入竞争；对休闲排行榜是可接受的取舍。

## 十、安全取舍

- 不收集邮箱、手机号等身份信息；`name` 只是玩家自填展示昵称，匿名 `deviceId` 仍用于去重和限流。
- 参数类型、长度、格式、白名单全部校验，非法请求返回 `400`。
- 每 `deviceId` 每分钟最多 20 次写请求；KV 计数不是严格原子操作，但足以挡住简单脚本。
- 云存档按公开 `deviceId` 定位，不做鉴权；请把 `deviceId` 视为本地 UUID，而不是登录凭证。
- 不建议把前端 `deviceId` 或云存档内容当作不可篡改的高价值数据。
