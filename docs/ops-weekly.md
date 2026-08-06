# NameChart 低强度周运营清单

会话被唤醒执行周更时按此清单操作（约每周一次）。凭据：Cloudflare org token（`CLOUDFLARE_GLOBAL_API_TOKEN`），account `ddff52d24ee44e21a021c15eaffcc86d`，D1 database `6f658ccd-7d51-4de7-8eb7-b643fc1a4e97`，Worker `namechart`，域名 https://namechart.zalize.com 。

## 1. 流量周报
- 查询 D1 `hits` 表：上周 PV 总量、Top 10 路径、按日趋势；`subscribers` 表增量。
- 写入 `docs/weekly/YYYY-MM-DD.md` 并 push。

## 2. IndexNow 提交
- 运行 `scripts/indexnow-submit.mjs`，提交下一批未提交的 sitemap 分片 URL（每次 ~5,000）。

## 3. 内容周更
- `scripts/fetch-meanings.mjs`（Wiktionary 词源，扩 +500 名）→ `scripts/d1-import.mjs data/meanings/meanings.sql`。
- `scripts/fetch-famous.mjs`（Wikidata 名人，扩 +500 名）→ `scripts/d1-import.mjs data/famous/famous.sql`。
- 生成数据目录（data/meanings、data/famous）已 gitignore，不提交。

## 4. 线上冒烟（有异常才修）
- `/` `/name/olivia` `/sitemap.xml` `/og/name/olivia.png` `/api/search?q=oliv` 应 200。
- XSS 回归：`/name/zzz%22%3E%3Cscript%3E...` 应 404，CSP 应含 `script-src 'self'`。
- 修复需部署时：`npx wrangler deploy`，先 bump `src/index.js` 的 `CACHE_VER`。

## 红线
- 不接真实支付；不发订阅邮件（双重确认流程未就绪）；不减弱 CSP/安全头；不提交 secret 或生成数据。

## 汇报
- 按 SOP-04 一条消息汇报：结论/证据/下一步/需注意。
