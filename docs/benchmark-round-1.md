# Benchmark Round 1 — NameChart vs 头部竞品

日期：2026-08-05 ｜ 执行：project-lead ｜ 对象：Nameberry（体验截图见调研）、BabyCenter、Behind the Name

## 逐项对照（证据：2026-08-05 实测截图/页面）

| 能力项 | Nameberry | NameChart（现状） | 差距级别 |
|---|---|---|---|
| 名字流行度历史曲线 | 有（1880-今）但完整趋势/预测锁 $19.99/年 付费墙 | ✅ 全免费 146 年双性别曲线（SVG SSR） | 领先 |
| 年度排名（US Top 1000） | 有 | ✅ /top /year 全年份 1880-2025 | 持平 |
| 州级排名 | 无州级页 | ✅ /state/xx 51 个州/区 | 领先 |
| 年代榜/字母浏览 | 有列表页 | ✅ /decade /letter | 持平 |
| 名字对比 | 无独立对比页 | ✅ /compare/a-vs-b 可分享 URL | 领先 |
| 升/降趋势榜 | 趋势预测锁付费 | ✅ /trending 免费（5 年 rank 变动） | 领先 |
| 名字含义/词源 | ✅ 编辑内容（Origin/Meaning/About） | ❌ 无 | **P1 差距** |
| 昵称/变体 | ✅ Variations & nicknames | ❌ 无（仅前缀相似名） | P2 差距 |
| 名人/流行文化 | ✅ Famous bearers / Pop culture | ❌ 无 | P2 差距 |
| 世界排名（多国） | ✅ World rankings | ❌ 仅美国（数据源限制，声明即可） | P2 差距 |
| 收藏/清单（账号） | ✅ Save to list（需注册） | ❌ 无（免费攒流量期，暂缓） | P2 差距 |
| 移动端适配 | 一般（内容密集） | ✅ Tailwind 响应式 | 持平/领先 |
| 无广告/无付费墙 | ❌ 广告+订阅 | ✅ | 领先 |
| 页面速度 | 中等（大量 JS） | ✅ SSR + 边缘缓存，首字节快 | 领先 |

## 本轮修复（P0/P1）

1. ~~P1：name 页显示 top-1000 以外的噪音排名（如 Olivia「#8,067 for boys」）~~ → 已修复并上线（只显示 ≤1000 名次）。
2. P1：名字含义/词源缺失 → 本轮先补 top 名字的含义骨架（后续轮扩量），页面结构预留 About 区块。
3. 其余 P0/P1 以四道把关（QA/UX/交叉测试/合规安全）报告为准，修复后并入本轮上线。

## 自评

- 数据类能力（曲线/排行/州/对比/趋势）已达到并部分超越 Nameberry 同期免费能力；内容类能力（含义/昵称/名人）仍落后，列为 Round 2 重点。
- 分发面：sitemap 10.6 万 URL + IndexNow 已提交 5,194 条（HTTP 200）。
