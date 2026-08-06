# NameChart 持续迭代日志（100 轮模式）

每轮：五驱动（①QA ②UX 走查 ③视觉 ④竞品 ⑤数据）→ P0/P1/P2 排序 → 修复上线 → 线上回归 → 记录。

## Round 1（2026-08-06，版本 a223d4e5）
**发现**
- ⑤数据：hits 表被伪造 beacon 污染（/spam-31276、XSS 探测路径）；上线至今真实自然流量≈0（31 PV 均为内部测试）——早期正常，pSEO 收录需时间。
- ①QA：28 项边界用例扫描，26 项符合预期；/compare/luna-vs-luna 同名对比无意义（P2）；beacon 任意路径可写入（P1，数据质量）。
- ④竞品：昵称/拼写变体是 Nameberry 每名字页标配，NameChart 缺失（P2，内容+内链）。

**修复（全部上线）**
- P1 beacon 路径白名单校验（只接受真实路由族），伪造路径静默丢弃；清理 hits 历史脏数据 4 条。
- P2 /compare/x-vs-x → 301 至 /name/x。
- P2 名字页新增「Spellings & variants」区块（编辑距离 1 的真实名字，最多 6 个，pSEO 内链+选名价值）。

**回归证据**
- /name/luna 含 Spellings & variants + Famous people 区块；spam beacon POST 204 但 DB 零写入；/compare/luna-vs-luna 302 → /name/luna；XSS payload 仍 404。

## Round 2（2026-08-06，版本 33784a26）
**发现**
- ②UX 走查（真实线上，桌面+滚动全览）：/name/luna 页面结构/视觉正常，无 P0/P1；变体区块渲染正确。
- ④竞品/SEO：竞品名字页无 FAQ 结构化数据 → 抢占 Google 富结果机会（P1，分发是本线最高权重）。
- ③视觉：名字页信息密度合理；FAQ 区块补充可见问答内容（Google 要求 FAQPage 标记须与可见内容一致）。

**修复（全部上线）**
- P1 名字页 JSON-LD 扩展为 Dataset + BreadcrumbList + FAQPage（3 问答：流行度/峰值年/性别），并新增页面可见 FAQ 区块与标记一致。

**回归证据**
- /name/luna 含 BreadcrumbList、FAQPage，JSON-LD 解析有效；7 条核心路由 200；XSS 404；CSP script-src 'self' 不变。

## Round 3（2026-08-06，版本 5a0e9afe）
**发现**
- ⑤数据/内容：含义与名人覆盖仅 Top ~6000/1500 热门名 → 内容扩容是纯增益（pSEO 页面质量）。
- ①QA：d1-import.mjs 两个健壮性 bug（ingest 完成后 poll 报 "Not currently importing"；同 etag 重跑时 poll 缺 bookmark 报 7400）。

**修复（全部上线）**
- 内容扩容：meanings 2,810→2,864 行（Wiktionary，Top 6,500 候选）；famous 1,284→1,552 行（Wikidata，Top 2,000 候选），已导入 D1 并 bump CACHE_VER=7 上线。
- d1-import.mjs 修复两处 poll 边界（视为完成/etag 命中即跳过）。
- IndexNow 提交下一批 2,194 URL（200）。

**回归证据**
- D1 计数 meanings=2864、famous=1552；/name/luna 新缓存含 Famous 区块；首页 200。

## Round 4（2026-08-06，版本 5a74ea09）
**发现**
- ②UX/③视觉：Playwright 375px 全览 6 个关键页，水平溢出全部 0px，移动端排版正常（截图存档）。
- ④竞品：编辑型名字榜单（vintage/timeless/modern）是 Nameberry 流量大项，NameChart 缺失（P1，pSEO 新页面族）。
- ①QA（开发中发现）：D1 Worker 绑定限制——无索引 name JOIN 超扫描预算、IN 绑定参数上限 100，直接 SQL 会 500。

**修复（全部上线）**
- 新增 /list/* 页面族 6 个数据驱动榜单（vintage/timeless/modern × girl/boy），JS 侧用 year_ranks 索引查询+分块 slug 查询实现，加入 browse 页与 static sitemap，beacon 白名单同步。

**回归证据**
- 6 个 /list/ 全部 200 且各含 40 个名字卡；/list/not-a-list 404；timeless 页正确渲染 "top 300 in both 1925 and 2025"；连续 3 轮重测稳定 200。

## Round 5（2026-08-06，版本 25ab05fe）
**发现**
- ③视觉/无障碍：axe-core 审计 5 个关键页发现 serious 级对比度违规（text-slate-400 2.63:1、rose-600 按钮 4.32:1、indigo-200 小字 4.32:1、trending/year 表格共 300+ 节点）与 landmark-unique（双 nav 无标签）。

**修复（全部上线）**
- 全站 text-slate-400→500、rose/emerald-600→700、indigo-200→100，nav 加 aria-label（Primary/Breadcrumb），重建 Tailwind CSS。

**回归证据**
- axe-core 复测 /、/name/luna、/list/vintage-girl-names、/trending、/year/2025 全部 clean（0 violations）。

## Round 6（2026-08-06，版本 f009cc4e）
**发现**
- ④竞品：Nameberry/BehindTheName 名字页有历年排名表，NameChart 只有当年排名（P1 内容差距）。
- ①QA：year_ranks 按 name 查询无索引（全表 29 万行扫描会超 Worker 预算）。

**修复（全部上线）**
- D1 新增 idx_year_ranks_name 索引；名字页新增「Rank through the decades」区块（25 年里程碑排名表，girls/boys 分列，— 表示当年跌出 top 1000）。

**回归证据**
- /name/james 渲染 1900–2025 六个里程碑行；/name/luna 渲染 1900 #651、2025 #27；页面响应 <150ms；核心路由 200。

## Round 7（2026-08-06，版本 22e01e17）
**发现**
- ⑤用户/数据：第一方统计只有路径级 PV，搜索词不落库 → 无法做搜索词驱动的内容决策（P1，数据基建）。
- 合规联动：新增数据收集须同步隐私政策。

**修复（全部上线）**
- 新增 searches 表（day+归一化查询词+结果数聚合计数，无任何用户标识），/search 路由 waitUntil 异步写入。
- /privacy 同步披露搜索词聚合统计口径。

**回归证据**
- 线上 /search?q=testquery123 → searches 表出现 {day, q:'testquery', results:0, count:1}（测试行已清理）；/privacy 含 "search terms" 披露；搜索页 200。

## Round 8（2026-08-06，版本 7931786b）
**发现**
- ②UX：Playwright 真实流程走查（搜索补全/收藏/图表 hover 读数/收藏页/对比表单）全部通过，无回归。
- ⑤数据/②UX：首页未展示新 /list 榜单（内部链接与发现性缺口，P1）。
- ①QA：zone 边缘缓存 s-maxage=86400，部署后旧 HTML 最长存活 24h（且 token 无 purge 权限），发布一致性风险（P1）。

**修复（全部上线）**
- 首页新增 Curated lists 区块（6 个榜单入口）。
- HTML s-maxage 86400→3600，把部署后陈旧窗口收敛到 ≤1h。

**回归证据**
- 首页渲染 "Curated lists" 与 6 个 /list/ 链接；新响应头 cache-control: public, max-age=3600, s-maxage=3600；UX 流程 5 项全过。

## Round 9（2026-08-06，版本 e166af72）
**发现**
- ①QA 边界扫描：/name/JOSE、/name/María、/name/mary%20jane 等非规范 URL 返回 200 正文（canonical 虽正确，但存在重复内容 URL 面，SEO P1）；其余 17 项边界（撇号/连字符名、无效年份/州/年代、空搜索、XSS 查询）行为全部正确。

**修复（全部上线）**
- /name/:slug 对非规范 slug 301 重定向到规范 URL（/name/JOSE → /name/jose）。

**回归证据**
- workers.dev 实测 /name/María → 301 /name/mara、/name/JOSE → 301 /name/jose；规范 URL 仍 200；自定义域旧 200 为存量边缘缓存（≤24h 自然过期，新 s-maxage=3600 后窗口收敛）。

## Round 10（2026-08-06）
**发现**
- ⑤数据：第一方统计 8/5–8/6 日 PV 35–42（基本为内部测试流量），searches 表无真实用户查询，5 个邮箱意向；结论=分发仍是最大瓶颈，本轮以分发推进为主。
- indexnow-submit.mjs 只能提交 names-0 分片前 N 条，无法翻页提交后续名字页。

**修复（全部上线）**
- indexnow-submit.mjs 支持跨分片+skip 翻页；提交新一批 3,200 URL（含 6 个 /list 榜单页 + names 第 2,000–5,000 名）至 IndexNow（200）。

**回归证据**
- IndexNow API 返回 200，submitted 3200 urls；累计已提交约 10.6k URL。
