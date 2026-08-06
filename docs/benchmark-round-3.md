# Benchmark Round 3 — 分发与内容纵深（2026-08-06）

老板批准的三项改进（作为低强度运营首轮),全部上线并线上验证（版本 baaa7106）。

## 本轮改进与证据

| # | 改进 | 实现 | 线上证据 |
|---|------|------|----------|
| 1 | 每名字动态 OG 分享图 | `/og/name/<slug>.png`（workers-og/Satori，1200×630，名字+统计+146 年趋势条形图，按主性别配色），name 页 `og:image` 指向动态图 | `curl https://namechart.zalize.com/og/name/olivia.png` → 200 image/png；`/name/olivia` head 含 `og:image content=".../og/name/olivia.png"`；边缘缓存 7 天 |
| 2 | 名人同名（Famous people named X） | Wikidata SPARQL（P735 given name，限首名序位，sitelinks≥25，每名最多 4 人），1,284 个热门名入 D1 `famous` 表；页面标注 Wikidata CC0 来源 | `/name/mary` 含 "Famous people named Mary"（Mary Shelley、Mary Wollstonecraft 等）+ Wikidata CC0 归属；无数据名字优雅省略 |
| 3 | 搜索无结果模糊纠错 | 编辑距离 ≤2（长度 ±2 的高频候选集内），"Did you mean…" 卡片 | `/search?q=lyviah` → "Did you mean…" Lydia/Livia/Lylah |

## 对标影响
- **OG 图**：Nameberry 分享卡片为静态品牌图；NameChart 现每名字带数据图卡片，社交分享信息量反超（分发抓手）。
- **名人同名**：补上 Nameberry"namesakes"栏目对应能力（数据驱动、可复跑 `scripts/fetch-famous.mjs`）。
- **模糊纠错**：Round 1 UX P1"拼错即死胡同"的最终闭环（补全+纠错双保险）。

## 回归
- XSS payload 仍 404；CSP 不变（script-src 'self'）；/name/mary Origin 逗号空格已修；/terms 已补 Wiktionary CC BY-SA share-alike 条款；/favorites 卡片新增 × 移除按钮；图表读数 mouseleave 复位。

## 剩余差距（下一轮候选，低优先）
- 昵称/变体聚类、风格清单（editorial 向）、多国排行（定位外）。
