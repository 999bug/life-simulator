# 安全加固记录与待办

本文档记录人生模拟器排行榜/云存档后端的已做加固，以及尚未处理的安全与工程待办。

## 已完成

- 榜单响应不再下发 `deviceId`（只返回 `name/score/age/endingKey/ts/summary`）。
- 删除无鉴权的 `GET/PUT /api/save` 云存档接口。
- `POST /api/score` 增加 `Origin` 来源校验（弱防线，Origin 可伪造）。
- 后端 API 地址默认置空，由构建时的 `VITE_API_BASE` 注入，避免 fork/测试环境误写生产 KV。
- 补充 MIT `LICENSE`（版权行为 `999bug`，如需真实署名请替换）。
- 补充 `PRIVACY.md` 隐私政策，并在 `README.md` 链接。
- 升级 `nanoid` 3.3.16 → 3.3.18，消除高危依赖漏洞。
- 重写 git 历史，移除硬编码的 Worker 地址（`lishiyan999`）。
- `deploy.yml` 同时读取 `vars.VITE_API_BASE` 与 `secrets.VITE_API_BASE`（仓库级）。

## 待办（按优先级）

### 高

- [ ] **Turnstile 人机验证**：接到 `POST /api/score`，挡住脚本刷分与写配额耗尽。需要先在 Cloudflare 创建 Turnstile 站点，拿到 `site key` 与 `secret key`。
- [ ] **KV 写配额 DoS 缓解**：与 Turnstile 一起做。严格限流需 Durable Objects 或 Cloudflare Rate Limiting。

### 中

- [ ] **依赖审计门禁**：剩余 `esbuild`/`vite` 的开发服务器漏洞（仅影响本地 `npm run dev`，修复需升 vite 8，破坏性）。vite 升级后可在 CI 加 `npm audit` 门禁。

### 低 / 可选

- [ ] 移除 `getClientIp` 中的 `X-Forwarded-For` 兜底，仅信任 `CF-Connecting-IP`。
- [ ] 榜单 read-modify-write 非原子 + KV 最终一致性：极限并发可能丢更新，严格榜需 Durable Objects。
- [ ] 内容合规：`jailed` / `gang_boss` / `escaped` 等题材，进应用商店分发前评估。
- [ ] CI 事件数据新鲜度检查：`npm run build:events` 后校验 `public/events.json` 无差异，漏跑即失败。

## 已决定

- 限流计数器不再升级为 Durable Objects / 原子计数器；保留现有简单限流作为零成本第一道防线。
- `esbuild`/`vite` dev-server 漏洞暂不处理（不进生产产物，修复破坏性）。
