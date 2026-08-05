# 产品线 #7 选品调研报告（阶段 A）

日期：2026-08-05 ｜ 执行：project-lead ｜ 决策用途：拍板第 7 条产品线方向（默认即批准）

## 结论（前置）

**拍板方向：NameChart（namechart.zalize.com）— 婴儿取名数据站：名字流行度曲线 + 年度/年代/州排行 + 数据洞察，全部免费。**

理由（对照本线最高权重「自带分发」）：
1. **搜索量极大**："baby names" 单词 224 万/月（Semrush，采集 2026-06，来源见附录 A1）；每个名字本身就是查询词（"olivia name meaning/popularity"），长尾近乎无限。
2. **pSEO 空间大 + 可编程公开数据源**：美国 SSA 出生名字数据（1880–2025，公有领域），实测下载解析成功：**105,966 个唯一名字、218 万行**；另有州级数据（1910–2025）。一名一页 + 字母页 + 年份页 + 年代页 + 州页 + 榜单页，可programmatically 铺 10 万+ 页面，完全对齐 Wikidata/Open Library 式打法。
3. **天然分享传播机制**：准父母取名是典型的「两人/全家决策」，名字曲线图、对比图、"你名字的历史"卡片天然适合分享（Nameberry 靠此模式做到 259 万月访问）。
4. **不与已占用方向重复**：紫微斗数/订阅管理/简历/剧集/餐食/书系均不涉及。

## 三捷径对照

| 捷径 | 证据 |
|---|---|
| 低分高需求 | App Store 取名类 app 普遍 3.9 分及以下，差评集中在：广告轰炸、崩溃、数据丢失、名字分类差、暗色模式不可用（justuseapp 汇总，附录 A2）。Web 端 babynames.com 全站 Cloudflare 人机验证挡门（实测截图），体验糟糕。 |
| 高付费率 | Nameberry 已验证付费意愿：$19.99/年订阅（去广告 + 趋势预测 + 榜单），趋势图/预测被放进付费墙（实测截图）→ 我们免费开放同类数据即为差异化。本线暂不收款，仅验证方向有付费潜力。 |
| 供需窗口 | 2026 年独立开发者用 pSEO 打名字站可行性已被验证：BabyNamePick 单人站 3,300 URL 一个月内取得稳定收录并增长（dev.to 案例，2026-03，附录 A3）；头部站 Nameberry 流量近 3 年 -76%（峰值 1180 万→259 万/月，sitestatsdb），存在被新站蚕食的窗口。 |

## 竞品深度体验（3 家，2026-08-05 实测）

### 1. Nameberry（nameberry.com，Next.js/Vercel）
- 月访问 259 万（Semrush 2026-06），自然搜索流量 127 万/月。
- 实测：Olivia 名字页内容深（历史、名人、变体、社区讨论）；**流行度趋势预测、Top1000 排名图表全部付费墙**（$19.99/年）；弹窗强制反广告拦截提示，体验打断。
- 注册流程走查：4 步（邮箱→用户名→密码→邮箱验证码），完成到验证码步（一次性调研邮箱无法收信，止步于此，流程/表单已截图存档）。
- 技术反推：Next.js + Vercel，SSR name 页 + 静态资源；数据来自 SSA + 自有编辑内容。
- 弱点：付费墙锁数据、广告重、流量 3 年下滑 76%。

### 2. Behind the Name（behindthename.com，PHP/Apache）
- 月独立访客约 248 万（mysite.info 估算，未验证，置信度中）。
- 实测：词源/历史内容最权威，多语言变体齐全；各国流行度小图。
- 技术反推：老式 PHP（PHPSESSID），无现代前端；页面信息密度高但视觉 2000 年代水平，移动端体验差。
- 弱点：UI 老旧、无现代交互、图表不可交互、无分享机制。

### 3. babynames.com
- 关键词 "baby names" 排第 1（224 万/月搜索量）。
- 实测：**全站 Cloudflare 盾，正常浏览器访问反复人机验证不放行**（截图存档），普通用户体验极差 → 直接机会。

### 竞品矩阵（摘要）

| 站点 | 月流量 | 免费趋势图 | 现代 UI | 移动端 | 分享机制 | 付费 |
|---|---|---|---|---|---|---|
| Nameberry | 259 万 | ❌ 付费墙 | ✅ | ✅ | 弱 | $19.99/年 |
| Behind the Name | ~248 万 | 部分 | ❌ | ❌ | ❌ | 无 |
| babynames.com | 高（被盾挡） | 部分 | 一般 | 一般 | ❌ | 无 |
| BabyNamePick（新入场） | 小 | ✅ | ✅ | ✅ | ❌ | 无 |
| **NameChart（本品）** | 0 → 目标 | **✅ 全免费交互图** | ✅ Tailwind | ✅ 硬指标 | ✅ 分享卡片/对比链接 | 暂不收款 |

## 产品定义（阶段 B 输入）

- **一句话**：查任何名字 146 年的流行度曲线、排名与数据洞察 —— 免费、无广告、秒开。
- **数据**：SSA names.zip（1880–2025 全国）+ namesbystate.zip（州级），公有领域；后续可加英格兰/威尔士 ONS。
- **pSEO 页面族**：/name/<name>（10 万+）、/letter/<a-z>×性别、/year/<1880-2025>、/decade/<1880s-2020s>、/state/<50 州>、榜单页（rising/falling/timeless/unisex）。
- **分发机制**：每页 OG 分享卡（名字曲线图）、两名对比页（可分享 URL）、"名字的一生"洞察（峰值年份、同龄人数量）。
- **技术**：Cloudflare Workers（SSR，Hono）+ D1（预聚合每名一行）+ 静态资源；Tailwind；第一方无 Cookie 统计 + 邮箱意向收集；sitemap 分片 + robots + IndexNow；与六姊妹站互链。

## 风险

- 名字「含义/词源」内容有版权（Behind the Name 等），首发只做**数据驱动**内容（曲线/排名/洞察均来自公有领域数据），含义类内容后续用开放来源（Wiktionary CC-BY-SA 注明出处）补充。
- SEO 见效周期数月，与全公司「免费攒流量」策略一致。

## 附录（来源）

- A1 babynames.com 关键词量：sem1.spyessentials.ai/website/babynames.com/overview/（采集 2026-08-05）
- A2 取名 app 差评汇总：justuseapp.com/en/app/473526598/baby-names/reviews
- A3 pSEO 案例：dev.to/yunhan_dev/the-seo-power-of-baby-name-pages-how-3300-urls-beat-big-competitors-4kdm
- A4 Nameberry 流量：semrush.com/website/nameberry.com/overview/；sitestatsdb.com/websites/nameberry.com
- A5 SSA 数据：ssa.gov/oact/babynames/limits.html（names.zip / namesbystate.zip，实测解析 105,966 名字 / 2,181,032 行）
- 实测截图：Nameberry 付费墙、注册 4 步流程、babynames.com 人机验证（会话存档）
