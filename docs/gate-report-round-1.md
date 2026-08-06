# 四道把关结果与修复记录（Round 1）

日期：2026-08-06 ｜ 被测：https://namechart.zalize.com ｜ 修复后版本：`596afcbf`（commit `98f9603`）

## 把关结论汇总

| 把关 | 会话 | 结论 |
|------|------|------|
| QA 功能测试 | efe0077e | 47 用例 44 通过，无 P0/P1，3 个 P2 |
| UX 体验走查 | 22d15f58 | 无 P0，5 个 P1、8 个 P2；数据准确性/速度是优势，内容深度落后 Nameberry |
| 内部交叉测试 | dab94891 | 数据正确性 15/15 与 SSA 官方零差异；1 P0（反射 XSS）、4 P1、17 P2 |
| 合规与安全审计 | 24e3d941 | 1 P0（同一 XSS）、6 P1（隐私政策失实/安全头缺失/邮件合规/缺 terms/接口无限流） |

## P0（已修复，线上已验证）

- **反射型 XSS（canonical / og:url 未转义 + CSP unsafe-inline）**
  修复：`esc(canonical)`；`/name/:slug` 白名单 `^[a-z][a-z'-]{0,39}$`；404 页不再回显用户路径；内联 JS 全部外置到 `/js/app.js`，CSP `script-src 'self'`（去掉 unsafe-inline）。
  验证：线上 payload URL 返回 404 且 head 中 canonical 为 `/404`，无脚本注入；Playwright 无 dialog。

## P1（已修复）

1. 安全头补齐：HSTS 上线；zone 开启 Always Use HTTPS（http→301→https 实测通过）。
2. 隐私政策失实：改写为如实披露 Cloudflare 处理者、NEL 上报、zone 级 Web Analytics 被本站 CSP 阻断；补 controller/法律依据/保留期/GDPR+CCPA/儿童条款。
3. 邮件合规：订阅处标注同意文案+隐私链接、记录 source、退订方式（回信或 hello@zalize.com）、页脚运营主体；发信前仍需双重确认（Round 2）。
4. 新增 `/terms` + 全站页脚 SSA 非隶属声明（42 U.S.C. §1140 风险）。
5. `/api/subscribe`、`/api/beacon`：同源校验（Origin/Referer）+ 按日按 IP 哈希限流（raw IP 不落库）；审计写入的测试数据已从生产库清除。
6. 搜索 ≥50 字符 500：改为范围扫描（`slug >= ?1 AND slug < ?1||'~'`），同时消除 LIKE 全表扫描（105,966 rows_read → 索引范围扫描）。
7. sitemap.xml 去掉每请求 COUNT(*)；HTML/XML 200 响应加 Cache API 边缘缓存，重复流量不再打 D1。
8. UX：移动端导航四链接全显示；性别徽章与详情页判定统一（≥20% 才算 unisex）；相似名改为「同性别+同峰值年代+同热度」算法；搜索加 datalist 自动补全；对比入口改为自选第二个名字；首页 375px 溢出修复；图表加 hover/触摸读数。
9. 数据清理：`Unknown/Unnamed/Baby…` 等 14 个非名字条目从四张表删除（现 105,954 名），构建脚本同步排除；/about 补 Peak year 与 SSA 口径差异说明。

## 遗留（Round 2 计划）

- P1：名字含义/起源/发音内容（与 Nameberry 最大内容差距）——计划批量生成+审校后入库。
- P2：动态每名字 OG 图；localStorage 收藏清单；邮件双重确认（发信前必须）；`/search` 结果页态转 200 优化；favicon.ico；名字→州分布视图。
