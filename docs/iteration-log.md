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

## Round 11（2026-08-06，版本 4a989c20）
**发现**
- ④竞品反推：Nameberry「Names That Mean X」是其订阅墙内的高流量列表族；NameChart 有 2,864 条词源数据但未做含义检索（P1，pSEO 新页面族+差异化：我们免费）。

**修复（全部上线）**
- 新增 /meaning/:word 页面族（16 个高频含义词：moon/light/star/love/strong/fire/peace/king/flower/sea/beautiful/brave/joy/grace/warrior/night），词边界正则过滤误匹配（sea 不吃 season），带词源摘录+CC BY-SA 标注；接入 browse、static sitemap、beacon 白名单。

**回归证据**
- 16 个 /meaning/ 全部 200（自定义域+workers.dev），无效词 404；/meaning/sea 无 season 误匹配；sitemap 含 16 个 meaning URL。

## Round 12（2026-08-06，版本 88c33346）
**发现**
- ①QA/SEO：新 /list 与 /meaning 页面族缺结构化数据（名字页已有 Dataset/FAQ/Breadcrumb，列表页无 ItemList，P1）。

**修复（全部上线）**
- /list/* 与 /meaning/* 全部输出 schema.org ItemList JSON-LD（含每项 name+url）。

**回归证据**
- 线上 JSON-LD 解析通过（ItemList + itemListElement）；375px 移动端 /meaning/moon、/list/timeless-girl-names、/name/james 水平溢出 0。

## Round 13（2026-08-06，版本 4f3f8db2）
**发现**
- ③性能：静态资产（styles.css 19KB、app.js 4.4KB）响应 max-age=0 must-revalidate，每次访问都回源验证（P1 性能）；HTML TTFB 0.15–0.26s 良好；/top/girls HTML 原始 324KB（压缩后 ~33KB，可接受）。

**修复（全部上线）**
- 新增 public/_headers：styles.css 与 /js/* 一年 immutable、/img/* 7 天；HTML 引用改带 ?v=ASSET_VER 版本参数用于失效。

**回归证据**
- /styles.css?v=2 响应 cache-control: public, max-age=31536000, immutable；页面 HTML 引用 styles.css?v=2 / app.js?v=2。

## Round 14（2026-08-06，版本 052bf6a4 + CACHE_VER 20）
**发现**
- ③视觉走查（截图）：/meaning 卡片名字与词源文字挤在一起——gap-x-4/gap-y-1 类未编入已构建 CSS（新页面上线时未重建 Tailwind，P1）。
- ⑤数据质量：词源文本含 Wiktionary 模板残渣——&lrm; 267 行、")API" 等 147 行、[Term?] 6 行、"Lua error…" 6 行（P1 内容质量）。

**修复（全部上线）**
- 重建 Tailwind CSS 并把资产版本升到 v=3；建立规则=新增页面类名必须重建 CSS。
- D1 全量清洗四类残渣（joseph/patricia 等实测恢复干净文本）；fetch-meanings.mjs 同步加清洗规则防复发。

**回归证据**
- 复查截图 /meaning/moon 卡片间距正常、无 &lrm;/API 残渣；D1 残渣计数全部归零；computed columnGap=16px。

## Round 15（2026-08-06，版本 d058e856）
**发现**
- ①QA 全量回归（10 次部署后的巩固轮）：21 条路由全部 200；安全头（HSTS/CSP/XCTO/XFO/Referrer/Permissions）齐全；XSS 路径 404、搜索反射 0；http→301；beacon 同源 204；8 页移动端 375px 溢出 0。
- 唯一控制台报错=zone 级 Cloudflare Insights 注入被我们 CSP 拦截（预期行为，关闭权归老板待办）。

**修复**
- 无新缺陷，本轮为回归巩固轮。

**回归证据**
- 见上（21 路由/安全头/XSS/重定向/移动端全绿）。

## Round 16（2026-08-06，版本 d13ac4ed）
**发现**
- ⑤内容覆盖：meanings 仅覆盖 Top 6,500 候选（2,864 行），长尾名字页缺含义区块。

**修复（全部上线）**
- fetch-meanings.mjs 扩到 Top 12,000 候选并带上轮清洗规则重跑：meanings 2,864 → 3,289 行，已导入 D1 并 bump 缓存。

**回归证据**
- D1 COUNT(meanings)=3289；新覆盖长尾名（radha/hyacinth/algernon）名字页出现 Meaning & origin 区块。

## Round 17（2026-08-06，版本更新至 CACHE_VER 22）
**发现**
- ⑤内容覆盖：famous（名人同名）只覆盖 1,552 个名字，长尾名字页缺该区块。

**修复（全部上线）**
- fetch-famous.mjs 扩到 Top 5,000 候选重跑（Wikidata CC0）：famous 1,552 → 2,574 行，导入 D1。

**回归证据**
- D1 COUNT(famous)=2574；抽查长尾名字页出现 Famous 区块。

## Round 18（2026-08-06，版本 93f99238）
**发现**
- ②UX/内链：名字页含义区块与 /meaning/* 页族无双向内链（用户无法从名字跳到同含义列表，SEO 内链弱）。

**修复（全部上线）**
- 名字页 Meaning & origin 区块自动检测词源命中的含义词，输出「Names that mean X」胶囊链接（词边界匹配）。

**回归证据**
- /name/luna → 「Names that mean moon」、/name/grace → 「Names that mean grace」链接实测出现。

## Round 19（2026-08-06）
**发现**
- ⑤数据分析：日 PV 42→55 仍以内部测试为主；searches 表仅 2 条=本轮安全探针残留（已清）；订阅意向 5 条持平；自然流量未起量（收录期）。

**修复/动作（已执行）**
- IndexNow 第三批 3,216 URL 提交成功（200），本批含 16 个 /meaning/* 新页族 + 名字页第 5,000–8,000 段。
- indexnow-submit.mjs 纳入 meaning URL；清理 2 条测试搜索词。

**回归证据**
- IndexNow API 返回 batch 0: 200 / submitted 3216 urls；searches 表清零。

## Round 20（2026-08-06，版本 c1ad6877）
**发现**
- ④分享面：/list 与 /meaning 页族的 og:image 仍是通用默认图，分享点击率弱于名字页的动态卡片。

**修复（全部上线）**
- 新增 ogList 分享卡（标题+名字胶囊+品牌），路由 /og/list/<slug>.png 与 /og/meaning/<word>.png，对应页面 og:image 已切换；beacon 白名单同步。

**回归证据**
- /og/list/vintage-girl-names.png 与 /og/meaning/moon.png 均 200 image/png（~230KB）；渲染截图检查通过；/meaning/moon og:image 指向动态图。

## Round 21（2026-08-06，版本 81177873）
**发现**
- ④竞品反推（BabyCenter 名字页）：其「Popularity in real life」以“1 in N babies”给直观频率感，我们只有绝对数与排名（P1 内容差距）。

**修复（全部上线）**
- 从 seed 数据聚合全国每年出生数生成 year_totals 表（1880–2025，含 F/M 分列，数据来源仍为 SSA 公有领域，无伪造）；名字页首段自动输出「In 2025, about 1 in N girls/boys was named X」。

**回归证据**
- /name/luna →「1 in 265 girls」、/name/liam →「1 in 82 boys」（与 SSA 2025 总量 160.7万F/170.8万M 交叉验证一致）；无当年出生的名字不显示该句。

## Round 22（2026-08-06，版本 81ea6552）
**发现**
- ④竞品反推（BabyCenter）：其「Baby Name Generator」是高流量互动工具（"baby name generator" 为大搜索词），我们没有互动生成器（P1）。

**修复（全部上线）**
- 新增 /generator：按性别（任意/女/男）× 风格（当下流行/百年前 Vintage/较少见）× 首字母生成 12 个真实名字（year_ranks 索引查询 + Fisher-Yates 洗牌，无伪造），SSR、无 JS 依赖、radio 胶囊用 Tailwind has-checked；入口在 /browse，进 sitemap 与 beacon 白名单。

**回归证据**
- /generator 各参数组合 200 且返回 12 张名字卡；桌面/375px 截图无溢出；洗牌每次结果不同。

## Round 23（2026-08-06，版本 e6cb910e）
**发现**
- ②UX：生成器只从 /browse 可达，首页（最大流量入口）无入口（P1 可发现性）。

**修复（全部上线）**
- 首页 Curated lists 区块新增高亮「Baby name generator →」入口。

**回归证据**
- 真实线上全流程走查通过：首页入口可见 → 生成器选 Girl → 生成 12 卡 → 点进 /name/genevieve → 页面正常（该名无含义词命中，链路符合预期）。

## Round 24（2026-08-06）
**发现**
- ①QA：对新生成器做参数模糊测试（script/属性注入/__proto__/超长/引号）与无障碍审计。

**修复**
- 无缺陷：所有恶意参数被白名单校验拦截（200 且零反射）；letter=z+vintage 空结果正确显示「No matches」提示；axe-core 无违规。canonical 恒为 /generator，query 组合不产生重复索引面。

**回归证据**
- 5 组注入 payload 均 0 反射；axe clean。

## Round 25（2026-08-06）
**发现**
- ⑤数据：日 PV 65（仍以内部测试为主）；搜索词表空（无自然搜索）；收录期持续铺分发。

**修复/动作（已执行）**
- IndexNow 第四批 3,216 URL 提交成功（200，名字页第 8,000–11,000 段 + 全部工具/榜单/含义页）。

**回归证据**
- IndexNow API batch 0: 200 / submitted 3216 urls。

## Round 26（2026-08-06，版本 7b98ddac）
**发现**
- ②内容纵深：名字页无州维度信息，state_ranks 数据（51 州×Top100）未被名字页利用（P1）。

**修复（全部上线）**
- 名字页新增「Where X ranks highest (2025)」区块：按州排名列前 10 州胶囊（链接到 /state/*），仅进入州 Top100 的名字显示。

**回归证据**
- /name/liam 出现该区块（California #… 等），非 Top100 名字不显示；查询走 10,200 行小表，无性能风险。

## Round 27（2026-08-06，版本 36af0987）
**发现**
- ④pSEO 覆盖：meanings 扩容至 3,289 行后，可支撑更多「Names That Mean X」页（原仅 16 词）。

**修复（全部上线）**
- MEANING_WORDS 16→34 词（新增 bright/water/ruler/victory/noble/life/earth/heaven/rose/white/wolf/lion/queen/holy/river/stone/bear/honor）；数据抽查后剔除样本过薄的 rain(2)/angel(4)，保证每页 ≥5 个真实词源命中；IndexNow 词表同步。

**回归证据**
- 新词全部 200 且词边界过滤后条数：bright 14 / queen 16 / river 26 / stone 17 等；被剔除的 rain 已 404。

## Round 28（2026-08-06）
**发现**
- ③视觉/无障碍：对含新区块（1-in-N 频率句、州排名胶囊）的名字页做 375px 移动端走查 + axe 审计。

**修复**
- 无缺陷：移动端零溢出、频率句换行自然、州胶囊 flex-wrap 正常；axe-core 无违规。

**回归证据**
- /name/liam 375px 截图正常（overflow 0）；axe clean。

## Round 29（2026-08-06）
**发现**
- ①QA：轮 21–28 密集改动后做全量回归（28 条路由 + 安全）。

**修复**
- 无缺陷：28 条代表性路由全部 200（/search?q=liam 302→/name/liam 为预期精确命中重定向）；XSS 探针 404；HSTS/CSP/X-Frame/X-Content-Type 4 项安全头齐全；http→https 301。

**回归证据**
- 全量路由清单及状态码见本轮命令输出（含 3 类 OG 图、生成器、34 词含义页样本）。

## Round 30（2026-08-06）
**发现**
- ⑤数据：日 PV 66；/generator 上线当天即进当日 Top4 路径（5 次，多为内部走查）；搜索词表仍空（自然流量未起）。

**修复/动作（已执行）**
- IndexNow 第五批 3,234 URL（名字页第 11,000–14,000 段 + 34 词含义页全量 + 静态页）提交成功。

**回归证据**
- IndexNow batch 0: 200 / submitted 3234 urls；当日路径 Top8 见第一方 hits 表。

## Round 31（2026-08-06，版本 4eb80946）
**发现**
- ④/②：竞品有「每日/每周精选名」类回访钩子，我们首页无时效性内容（P1 回访与分享钩子缺失）。

**修复（全部上线）**
- 首页新增「Name of the day」卡片：按日期哈希从全时段 Top2000 确定性选名（全站当天一致，不伪造），展示总数/起始年/峰值年并链到名字页。

**回归证据**
- 首页出现「Name of the day · 2026-08-06 · Danny」卡片，多次请求同日结果一致。

## Round 32（2026-08-06，版本 2b24e989）
**发现**
- ④竞品（Nameberry 列表矩阵）：短名/长名是高频列表主题（"short girl names" 等大搜索词），我们榜单页族只有 6 个（P1 pSEO 覆盖）。

**修复（全部上线）**
- 新增 4 个榜单页：/list/short-girl-names、short-boy-names（≤4 字母）、long-girl-names、long-boy-names（≥9 字母），按全时段出生数排序（纯 SQL，数据真实）；自动进 sitemap/OG 卡/互链；IndexNow 词表同步并提交。

**回归证据**
- 4 页均 200 且各 40 张名字卡；/og/list/short-girl-names.png 200 image/png；IndexNow batch 200。

## Round 33（2026-08-06，版本 45378484）
**发现**
- ③视觉/无障碍：axe 在首页报 serious 对比度违规——根因是轮 31 新卡片用了 bg-indigo-700/渐变类但 CSS 未重建，样式未生效（白字落在浅背景上）。

**修复（全部上线）**
- 重建 Tailwind CSS（补 bg-indigo-700 等新类），ASSET_VER 4→5；卡片渐变改纯色 bg-indigo-700 保证可计算对比度。

**回归证据**
- 首页与 /list/short-girl-names axe 全 clean；375px 零溢出；截图确认卡片深底白字正常渲染。

## Round 34（2026-08-06）
**发现**
- ①QA：验证轮 32 新表面：4 个新榜单 OG 卡、ItemList 结构化数据、/generator 计数路径与 beacon 同源防护。

**修复**
- 无缺陷：3 个新榜单 OG 图 200 image/png；长名榜单含 ItemList JSON-LD；同源 beacon 计数正常，跨域 Origin 静默丢弃（204 不落库，符合设计）。

**回归证据**
- 命令输出见本轮记录；hits 表无伪造路径写入。

## Round 35（2026-08-06）
**发现**
- ⑤数据：日 PV 73（较昨日 42 上升，仍以内部为主）；订阅意向 5 条；自然搜索词仍为零。
- ①sitemap 抽查：static.xml 已含 10 个榜单 + 34 词含义页 + /generator（45 条特色 URL），全站分片 23 个正常。

**修复**
- 无缺陷；分发面（sitemap/IndexNow/OG/内链）本周期已全部就绪，等待搜索引擎收录生效。

**回归证据**
- static.xml 含 short-girl-names 与 /generator；hits/subscribers/searches 查询见本轮输出。

## Round 36（2026-08-06，版本 acb4df8e）
**发现**
- ④分享面：/compare/*（如 luna-vs-aurora）是天然可分享的对比页，但仍用默认 OG 图（P1）。

**修复（全部上线）**
- 新增 /og/compare/<a>-vs-<b>.png：双名双色柱状趋势对比卡（Satori-safe flexbox），compare 页 og:image 已切换；beacon 白名单同步；首版 &nbsp; 实体与 ■ 字形缺失问题已改为纯 div 色块修复。

**回归证据**
- /og/compare/mia-vs-zoe.png 渲染截图正常（双色图例+双行趋势）；页面 og:image 指向新端点；luna-vs-luna 等非法组合 404。

## Round 37（2026-08-06，版本 22f119f3）
**发现**
- ①SEO/QA：/compare/a-vs-b 与 b-vs-a 内容相同但 canonical 各自独立，会作为重复内容分别被收录（P1）。

**修复（全部上线）**
- compare 路由按字母序 301 规范化（olivia-vs-emma → emma-vs-olivia）；首页入口链接同步改为规范序，避免二跳。

**回归证据**
- /compare/olivia-vs-emma 返回 301 → /compare/emma-vs-olivia；规范序请求 200。

## Round 38（2026-08-06）
**发现**
- ②UX：对比/收藏/清单核心流程线上走查（含轮 37 规范化后的表单跳转）。

**修复**
- 无缺陷：compare 表单 Luna+Ivy 自动落到规范序 /compare/ivy-vs-luna；名字页收藏按钮点击即变「On your shortlist」；/favorites 正确显示已收藏名字。

**回归证据**
- Playwright 真实浏览器走查输出见本轮记录。

## Round 39（2026-08-06）
**发现**
- ③性能审计：抽测 5 类关键页面 TTFB/传输体积 + 真实浏览器 LCP。

**修复**
- 无缺陷：TTFB 75–197ms（边缘缓存生效）；压缩后 HTML 3–21KB；/name/liam 实测 LCP 92ms。无需优化动作。

**回归证据**
- curl 计时与 PerformanceObserver LCP 输出见本轮记录。

## Round 40（2026-08-06）
**发现**
- ⑤数据：日 PV 78；生成器/对比/榜单路径均有记录（多为内部走查）；自然搜索词仍为零（收录爬坡期）。

**修复/动作（已执行）**
- IndexNow 第六批 3,238 URL（名字页第 14,000–17,000 段 + 全部特色页）提交成功。

**回归证据**
- IndexNow 200 / submitted 3238 urls；hits 路径分布见本轮输出。

## Round 41（2026-08-06，版本 6619ab31）
**发现**
- ④pSEO：compare 页族无任何站内入链（仅表单可达），搜索引擎无法发现（P1）。

**修复（全部上线）**
- 名字页「similar vibe」区块下新增 4 个规范序对比链接（如 luna → ivy-vs-luna / luna-vs-mila），10 万名字页 × 4 = 大规模 compare 页内链发现面；CSS 重建（bg-amber-50）+ ASSET_VER 6。

**回归证据**
- /name/luna 出现 adeline-vs-luna / ivy-vs-luna / luna-vs-mila / luna-vs-quinn 四个规范序链接。

## Round 42（2026-08-06）
**发现**
- ④竞品深度对照（Nameberry /b/girl-baby-name-luna 实测抓取）：其名字页区块 = About / Popularity / World rankings / Famous / Variations(语言变体) / Community。逐项对照：About(含义词源)✔ Popularity(我们免费全曲线反超)✔ Famous✔ 拼写变体✔；差距项：World rankings（跨国排名）与语言变体（Lune/French 等）需非美国数据源。

**修复/结论**
- 两项差距均超出本产品「美国 SSA 数据」定位，且无免费可编程权威数据源（不伪造数据红线），列 P2 backlog（候选源：Wiktionary 跨语言表，需评估质量）；本轮无代码变更。

**回归证据**
- 竞品页区块抓取输出见本轮记录；我方对应区块线上均在（/name/luna）。

## Round 43（2026-08-06）
**发现**
- ③视觉/无障碍：轮 41 新增对比链接胶囊（amber 配色）后复查名字页。

**修复**
- 无缺陷：/name/luna axe 全 clean（amber-50/amber-800 对比度达标）；375px 零溢出；长尾名字页对比链接同样渲染。

**回归证据**
- axe 输出与移动端溢出检测见本轮记录。

## Round 44（2026-08-06）
**发现**
- ①QA：撇号/连字符 slug 与 OG compare 端点边界测试（d'angelo、mary-kate、路径穿越、注入文件名）。

**修复**
- 无缺陷：库内 slug 实际全为纯 a-z（d'angelo 存储为 dangelo），非法/不存在组合全部 404 或规范重定向；OG compare 对 ../ 与注入文件名均 404。

**回归证据**
- 7 组边界请求状态码 + D1 slug 抽查见本轮记录。

## Round 45（2026-08-06）
**发现**
- ⑤数据：本日 PV 与路径多样性继续来自内部走查；订阅意向 5 条不变；自然搜索词零——所有分发基建（sitemap 全量 + IndexNow 六批 ~1.9 万 URL + OG 四类分享卡 + 站内互链）已就绪，进入等待收录阶段。

**修复/结论**
- 本轮无新缺陷；确认下一阶段重心从「铺基建」转向「内容纵深与收录观察」，避免重复提交无增量动作。

**回归证据**
- hits/subscribers/searches 查询输出见本轮记录。

## Round 46（2026-08-06，版本 87139a72）
**发现**
- ②内容纵深：146 个年份页只有静态 Top100 表，缺少年度叙事点（P2 内容差距）。

**修复（全部上线）**
- /year/:y 新增「New to the top 100 in {y}」区块：对比上一年 Top100 计算新晋名字（如 2000 年 Trinity——黑客帝国效应，数据自证不作编造叙述），胶囊链接到名字页。

**回归证据**
- /year/2000 显示 Trinity/Zoe/Jada 等新晋名；/year/1880 无上一年数据时正确不显示。

## Round 47（2026-08-06，版本 feca761f）
**发现**
- ②内容纵深：26 个字母页开头只有一句「Top 200 by all-time popularity」，页面信息薄（P2）。

**修复（全部上线）**
- 字母页新增数据驱动导语：该字母名字总数、女/男分布、历史最受欢迎的女名/男名（带内链），全部实时来自 D1 统计（索引友好 range scan）。

**回归证据**
- /letter/q：「561 recorded U.S. names begin with Q — 268 girls / 293 boys」；/letter/m 导语链接 Mary 与 Michael。

## Round 48（2026-08-06）
**发现**
- ①QA 全量回归：25 条路由（含轮 46/47 新区块页面）、XSS、安全头。

**修复**
- 无缺陷：24 路由 200、/search?q=aud 302 精确命中重定向（预期行为）、XSS payload 404、CSP/HSTS 在位。

**回归证据**
- 状态码清单与响应头见本轮记录。

## Round 49（2026-08-06，版本 ab868f23）
**发现**
- ③无障碍：axe 报字母页导语内链 link-in-text-block（链接与正文颜色对比 1.17:1，缺非颜色区分）。

**修复（全部上线）**
- 导语内链改为常驻 underline（颜色之外的可见区分）。

**回归证据**
- /year/2000 与 /letter/m axe 复测全 clean。

## Round 50（2026-08-06）
**发现**
- ⑤数据：PV 与路径多样性仍以内部走查为主；订阅意向 5 条；自然搜索词零（收录爬坡期，基建已全就绪）。

**修复/结论**
- 本轮无新缺陷。50 轮阶段小结：产品面（页面族 12 类、内容纵深、4 类 OG 卡、生成器）、分发面（sitemap 全量、IndexNow ~1.9 万 URL、全站内链网）、质量面（axe 全绿、安全头/XSS 防护、TTFB<200ms）均达标，后续轮次以收录观察 + 增量内容为主。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 51（2026-08-06，版本 28ce408e）
**发现**
- ②内容纵深：51 个州页只有排名表，缺州特色内容（P2）。

**修复（全部上线）**
- 州页新增：导语（该州年度最爱女/男名带内链）+「Local favorites」区块（州 Top100 有、全国 Top100 无的本地特色名，最多 12 个胶囊）。

**回归证据**
- /state/tx 显示导语与 Local favorites；/state/ut 亦有本地特色区块。

## Round 52（2026-08-06，版本 ec88b0e4）
**发现**
- ②内容纵深：15 个年代页只有排名表，缺年代叙事（P2）。

**修复（全部上线）**
- 年代页新增「Names that peaked in the {d}s」区块：按 peak_year 落在该年代、peak_count 排序取前 12（如 1990s：Jacob/Tyler/Brandon/Taylor），胶囊链接名字页。

**回归证据**
- /decade/1990s 显示区块与真实数据胶囊。

## Round 53（2026-08-06）
**发现**
- ③无障碍/移动端：轮 51/52 新区块复查。首次扫描报 color-contrast，重放确认为边缘缓存中的旧版 HTML（部署前渲染），新版页面无违规。

**修复**
- 无代码变更（等待边缘缓存 1h 过期或 CACHE_VER 已隔离 Worker 缓存）；复测 /state/tx 与 /decade/1990s axe 全 clean、375px 零溢出。

**回归证据**
- axe 复测输出见本轮记录。

## Round 54（2026-08-06）
**发现**
- ①QA：新区块边界用例（DC/WY 小样本州、1880s/2020s 首尾年代、1881/2025 首尾年份）。

**修复**
- 无缺陷：全部 200 且区块按数据正确出现（DC 有 Local favorites、2020s 有 peaked 区块、1881 有新晋区块、1880 正确无）。

**回归证据**
- 6 组边界请求输出见本轮记录。

## Round 55（2026-08-06）
**发现**
- ⑤数据：PV/路径多样性平稳（内部走查为主）；订阅意向 5 条；自然搜索词零（收录爬坡持续）。

**修复/结论**
- 本轮无新缺陷；内容纵深阶段完成（名字/年份/年代/州/字母五类页面均有数据驱动增值区块），下一批轮次转向生成器体验增强与竞品跟踪。

**回归证据**
- hits/subscribers/searches 查询输出见本轮记录。

## Round 56（2026-08-06，版本 6b171cd2）
**发现**
- ②生成器增强：无「按含义」维度（竞品生成器的常见筛选）；首版实现与排名池求交后 moon 只剩 1 个结果（体验差）。

**修复（全部上线）**
- 生成器新增 Meaning 下拉（34 个白名单含义词）；含义模式改为直接从 meanings×names 全表抽取（词边界匹配 + 性别/首字母过滤 + 洗牌），不再受 Top 排名池限制。

**回归证据**
- mean=moon 12 个结果、moon+girl 10、wolf+boy 6、light+letter=e 1（数据真实稀疏，非缺陷）。

## Round 57（2026-08-06）
**发现**
- ②UX 走查：真实浏览器操作生成器（Girl + Meaning=Star → Generate）。

**修复**
- 无缺陷：表单键盘/鼠标可达（radio 胶囊经 label 点击）、URL 反映全部参数（可分享）、返回 8 个真实结果；axe clean、375px 零溢出。

**回归证据**
- Playwright 走查输出见本轮记录。

## Round 58（2026-08-06）
**发现**
- ①QA：生成器 mean 参数注入/大小写/非法值 fuzz（6 组）。

**修复**
- 无缺陷：非白名单值全部按未选处理，无回显、无 SQL 拼接面（白名单+参数绑定），页面 200 无脚本注入。

**回归证据**
- 6 组 fuzz 输出见本轮记录。

## Round 59（2026-08-06）
**发现**
- ④竞品：BabyCenter 名字生成器维度对照——其筛选含 Letter/Origin/Meaning/Last name 搭配/Sibling names。我方已覆盖 gender/style/letter/meaning；差距项：姓氏搭配建议与兄弟姐妹名推荐。

**修复/结论**
- 姓氏搭配（音节/头韵启发式）列 P2 backlog：可用纯规则实现（避免头韵与尾韵冲突），但需谨慎避免伪科学表述；兄弟姐妹名可复用现有 similar-vibe 算法，列入下批候选。本轮无代码变更。

**回归证据**
- 竞品特征抓取输出见本轮记录。

## Round 60（2026-08-06）
**发现**
- ⑤数据：PV/路径多样性平稳；订阅 5；自然搜索词零（收录爬坡）。

**修复/结论**
- 本轮无新缺陷；生成器增强批次收尾。下批候选：兄弟姐妹名推荐（复用 similar-vibe）、收录观察。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 61（2026-08-06，版本 003812f2）
**发现**
- ④竞品差距（轮 59 backlog）：缺兄弟姐妹名推荐。

**修复（全部上线）**
- 名字页新增「Sibling name ideas」区块：同年代（peak±8）+ 同热度带名字，男女分列（Sisters/Brothers 各 4），按经典建议剔除同首字母与押韵（尾 2 字母相同）候选，纯数据驱动。

**回归证据**
- /name/luna 与 /name/liam 均渲染 Sisters/Brothers 胶囊（如 Luna → Quinn 等）。

## Round 62（2026-08-06）
**发现**
- ③无障碍/视觉：兄弟姐妹名区块上线后名字页复查（含长尾名）。

**修复**
- 无缺陷：/name/luna、/name/liam、/name/aloysius axe 全 clean（pink-700/blue-700 on white 对比达标）；375px 零溢出。

**回归证据**
- axe 输出见本轮记录。

## Round 63（2026-08-06）
**发现**
- ①QA：兄弟姐妹名区块边界（超热门 Mary/John、超冷门 Zzyzx、不存在 slug）。

**修复**
- 无缺陷：热门/冷门名均返回同热度带推荐；不存在 slug 正确 404；无空区块或异常。

**回归证据**
- 7 组请求状态与区块计数见本轮记录。

## Round 64（2026-08-06）
**发现**
- ⑤分发：名字页第 17,000–20,000 段尚未提交 IndexNow。

**修复/动作（已执行）**
- IndexNow 第七批 3,238 URL 提交成功（200），名字页累计已提交约 2 万段。

**回归证据**
- submitted 3238 urls / HTTP 200。

## Round 65（2026-08-06）
**发现**
- ⑤数据：PV/路径平稳（内部为主）；订阅 5；自然搜索词零。

**修复/结论**
- 本轮无新缺陷；竞品差距清单（轮 42/59）中可数据驱动实现的项目已全部落地（兄弟姐妹名、含义筛选、对比 OG），剩余项（跨国排名、姓氏搭配）保持 P2。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 66（2026-08-06，版本 d2f940ee）
**发现**
- ④分享面：年份/年代页（161 页）仍用默认 OG 图（P1 分享点击率）。

**修复（全部上线）**
- 新增 /og/year/{y|d s}.png 动态分享卡（男女 Top6 名字胶囊，复用 ogList），年份页与年代页 og:image 已切换；非法年份 404。

**回归证据**
- /og/year/1995.png 与 /og/year/1990s.png 均 200 image/png（截图验证渲染正确）；1875 → 404；页面 og:image 指向新端点。

## Round 67（2026-08-06，版本 87fc49cb）
**发现**
- ④分享面：51 个州页仍用默认 OG 图。

**修复（全部上线）**
- 新增 /og/state/{st}.png 动态分享卡（州名 + 男女 Top6 胶囊），州页 og:image 已切换；非法州码 404。

**回归证据**
- /og/state/tx.png 200 image/png；zz → 404；页面 og:image 指向新端点。全站 4 大页面族（name/list+meaning/compare/year+decade+state）分享卡齐备。

## Round 68（2026-08-06）
**发现**
- ①QA：全部 7 类 OG 端点正/负用例扫描。

**修复**
- 无缺陷：7 个合法端点全部 200 image/png（约 200–235KB）；5 个非法（不存在名/越界年份/非法州码/非白名单含义词）全部 404。

**回归证据**
- 12 组请求输出见本轮记录。

## Round 69（2026-08-06）
**发现**
- ②UX/分享：5 类页面社交 meta 完整性走查。

**修复**
- 无缺陷：og:type/og:title/og:image/twitter:card=summary_large_image 全部就位且指向各自动态卡。

**回归证据**
- meta 抓取输出见本轮记录。

## Round 70（2026-08-06）
**发现**
- ⑤数据：PV/路径平稳；订阅 5；自然搜索词零（收录爬坡）。

**修复/结论**
- 本轮无新缺陷；分享面批次收尾——全站所有可分享页面族均有动态 OG 卡。下批候选：浏览/发现面（browse 页增强）、周更数据管道演练。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 71（2026-08-06，版本 5937d844）
**发现**
- ②发现面：/browse 枢纽页缺 Top/Trending/Unisex 高频入口（P2）。

**修复（全部上线）**
- browse 顶部新增「Quick picks」区块（Top girls/boys、Trending、Unisex 四入口）。

**回归证据**
- /browse 渲染 Quick picks 与四链接。

## Round 72（2026-08-06）
**发现**
- ①QA：24 路由全量回归 + 安全抽查（周更冒烟清单演练）。

**修复**
- 无缺陷：23 路由 200，/search?q=emma 302→/name/emma（预期精确命中直达），XSS slug 经规范化 301 后 404，HSTS/CSP 在位。

**回归证据**
- 24 组请求输出见本轮记录。

## Round 73（2026-08-06）
**发现**
- ③视觉/无障碍：browse Quick picks 与生成器新表单复查。

**修复**
- 无缺陷：axe 全 clean（indigo-700 on indigo-50 对比达标）、375px 零溢出。

**回归证据**
- axe 输出见本轮记录。

## Round 74（2026-08-06）
**发现**
- ④竞品：Behind the Name 名字页栏目对照（Meaning & History/Popularity/Related Names/Namesakes/Ratings/Name Days/Categories）。

**修复/结论**
- 我方已覆盖：含义与词源、流行度（更强：146 年曲线+州分布+频率句）、相关名（similar/siblings/variants）、名人同名。差距项均为社区型功能（用户评分/评论/投稿）与名字日（宗教历法数据），不符合本站无账号定位或缺可靠免费数据源，维持 P2 不做。本轮无代码变更。

**回归证据**
- 竞品页面栏目抓取输出见本轮记录。

## Round 75（2026-08-06）
**发现**
- ⑤数据：PV 平稳（内部为主）；订阅 5；自然搜索词零（收录爬坡）。

**修复/结论**
- 本轮无新缺陷。产品面（内容/分享/发现/生成器）本批全部收尾；下批以回归守护 + 收录观察 + 小改进为主。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 76（2026-08-06，版本 8a177ecd）
**发现**
- ②UX：名字 404 页只有回首页链接，无纠错建议（P2 死胡同）。

**修复（全部上线）**
- 名字未找到页复用模糊纠错，展示「Did you mean」候选（最多 6 个，编辑距离≤2）。

**回归证据**
- /name/lyviah 404 页显示 Lydia/Livia/Lylah 等候选链接。

## Round 77（2026-08-06）
**发现**
- ③性能：内容扩容后 6 关键页复审。

**修复/结论**
- 达标无需修复：TTFB 78–204ms（未缓存动态渲染），HTML 23–78KB（排名表页最大，gzip 后远小）；无阻塞资源变化。

**回归证据**
- curl 计时输出见本轮记录。

## Round 78（2026-08-06）
**发现**
- ⑤分发：名字页第 20,000–23,000 段尚未提交 IndexNow；sitemap 索引与 static 分片抽查。

**修复/动作（已执行）**
- IndexNow 第八批 3,238 URL 提交成功（200），累计约 2.3 万段；sitemap 索引 24 分片正常、static 分片 292 URL 在位（含 list/meaning/year/decade/state 页族）。

**回归证据**
- submitted 3238 urls；sitemap 抓取输出见本轮记录。

## Round 79（2026-08-06）
**发现**
- ②UX：真实浏览器走查收藏与订阅表单。

**修复**
- 无缺陷：收藏按钮为幂等开关（再点即移除，首次走查误判为丢失，实为 toggle 预期行为）；/favorites 渲染带链接卡片+移除按钮；订阅表单非法邮箱被客户端校验拦截（不发请求）。

**回归证据**
- localStorage 前后状态与页面渲染输出见本轮记录。

## Round 80（2026-08-06）
**发现**
- ⑤数据：PV/路径平稳（内部为主）；订阅 5；自然搜索词零。

**修复/结论**
- 本轮无新缺陷；80 轮小结：产品面已达对标线以上，剩余批次以回归守护、收录观察与微改进为主。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 81（2026-08-06，版本 7e0b2c52）
**发现**
- ④SEO：年份/年代/州页（212 页）缺 ItemList 结构化数据（榜单/含义页已有）。

**修复（全部上线）**
- 三类页面加 ItemList JSON-LD（男女 Top10 各含名字+URL）。

**回归证据**
- /year/1995、/decade/1990s、/state/tx 均输出 "@type":"ItemList"。

## Round 82（2026-08-06）
**发现**
- ①QA：全站 7 类页面 JSON-LD 语法与类型校验。

**修复**
- 无缺陷：全部可解析（WebSite / Dataset+BreadcrumbList+FAQPage / ItemList），无注入或转义问题。

**回归证据**
- 解析输出见本轮记录。

## Round 83（2026-08-06，版本 858fb46b）
**发现**
- ③无障碍：axe 扫 6 页面族，/top/girls 报 1 处 color-contrast（排名表计数 slate-500，处于 4.5:1 临界）。

**修复（全部上线）**
- rankTable 排名与计数文字 slate-500 → slate-600（全站排名表统一受益）。

**回归证据**
- /top/girls、/top/boys、/year/1995 axe 复测全 clean。

## Round 84（2026-08-06）
**发现**
- ④竞品/数据时效：Nameberry popular-names 仍以 2025 SSA 数据为最新（与我方一致，无数据代差）；SSA 官网直连 403（有反爬，遵守不绕开，数据更新走年度公开数据包渠道）。

**修复/结论**
- 无需变更；下一次数据大更新窗口为 2027 年 5 月 SSA 发布 2026 年数据。

**回归证据**
- 竞品页抓取输出见本轮记录。

## Round 85（2026-08-06）
**发现**
- ⑤数据：PV/路径平稳（内部为主）；订阅 5；自然搜索词零（收录爬坡）。

**修复/结论**
- 本轮无新缺陷。85 轮累计：结构化数据全覆盖、对比线（Nameberry/BabyCenter/Behind the Name/SSA）数据与功能无代差。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 86（2026-08-06，版本 3f068ded）
**发现**
- ④分享面：26 个字母页仍用默认 OG 图（最后一个无卡页面族）。

**修复（全部上线）**
- 新增 /og/letter/{a-z}.png 动态分享卡（该字母 Top12 名字），字母页 og:image 已切换；非法参数 404。至此全部可分享页面族分享卡覆盖完成。

**回归证据**
- /og/letter/m.png 200 image/png（首测 404 为边缘旧缓存，加穿透参数验证为新版）；/og/letter/mm.png 404。

## Round 87（2026-08-06）
**发现**
- ⑤分发：名字页第 23,000–26,000 段尚未提交 IndexNow。

**修复/动作（已执行）**
- IndexNow 第九批 3,238 URL 提交成功（200），累计约 2.6 万段。

**回归证据**
- submitted 3238 urls。

## Round 88（2026-08-06）
**发现**
- ②UX：375px 移动端完整旅程走查（首页→搜索→名字页→对比页）。

**修复**
- 无缺陷：移动导航 4 链接可见可点、首页搜索直达 /name/olivia、对比胶囊跳 /compare/olivia-vs-sophia、全程零横向溢出。

**回归证据**
- Playwright 走查输出见本轮记录。

## Round 89（2026-08-06）
**发现**
- ①安全回归：同源防护/安全头/HTTPS 重定向复审。

**修复**
- 无缺陷：/api/subscribe 跨源 403；/api/beacon 跨源静默 204 不落库（设计如此，防探测）；6 项安全头齐全；http→https 301。

**回归证据**
- 请求输出与源码校验见本轮记录。

## Round 90（2026-08-06）
**发现**
- ⑤数据：PV/路径平稳（内部为主）；订阅 5；自然搜索词零（收录爬坡）。

**修复/结论**
- 本轮无新缺陷；90 轮达成。剩余 10 轮以回归守护、收录观察与收尾审计为主。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 91（2026-08-06，版本 6d3837ed）
**发现**
- ②发现面：生成器是核心工具页但主导航无入口（仅首页/浏览页内链）。

**修复（全部上线）**
- 主导航新增 Generator 链接（≥sm 显示，移动端保持 4 链接不拥挤）。

**回归证据**
- 首页导航渲染 Generator 链接。

## Round 92（2026-08-06）
**发现**
- ⑤分发：名字页第 26,000–29,000 段尚未提交 IndexNow。

**修复/动作（已执行）**
- IndexNow 第十批 3,238 URL 提交成功（200），累计约 2.9 万段。

**回归证据**
- submitted 3238 urls。

## Round 93（2026-08-06）
**发现**
- ③无障碍/视觉：导航变更后首页复查。

**修复**
- 无缺陷：axe clean；移动端 Generator 链接按设计隐藏、零溢出。

**回归证据**
- axe 与视口检查输出见本轮记录。

## Round 94（2026-08-06）
**发现**
- ①QA：sitemap static 分片覆盖审计。

**修复**
- 无缺口：letter 26 / year 146 / decade 15 / state 51 / list 10 / meaning 34 / generator+browse 等特色页全部在位（共 292 URL），与线上路由一一对应。

**回归证据**
- 分片计数输出见本轮记录。

## Round 95（2026-08-06）
**发现**
- ⑤数据：PV/路径平稳（内部为主）；订阅 5；自然搜索词零（收录爬坡）。

**修复/结论**
- 本轮无新缺陷；进入最后 5 轮收尾审计（安全/数据/无障碍/性能/文档）。

**回归证据**
- hits/subscribers 查询输出见本轮记录。

## Round 96（2026-08-06）
**发现**
- ①收尾安全审计：6 类 XSS 注入面 + CSP 覆盖。搜索页 grep 命中 onerror 字样，逐行核验为 HTML 实体转义（&lt;img …&gt;）后的文本，非可执行反射。

**修复**
- 无缺陷：注入 payload 或 404、或安全转义；三类路由 CSP 均在位；搜索页 noindex。

**回归证据**
- payload 响应与转义后源码行见本轮记录。

## Round 97（2026-08-06）
**发现**
- ①收尾数据审计：完整性与一致性抽查。

**修复**
- 无异常：names 105,954 条，无空名、无重复 slug；2025 Top3（女 Olivia/Charlotte/Emma、男 Liam/Noah/Oliver）与 SSA 官方一致；Top1000 女 1,182,238 占全年女总量 1,607,267 的 73.6%（符合长尾分布预期）。

**回归证据**
- D1 查询输出见本轮记录。

## Round 98（2026-08-06，版本 156d4f47）
**发现**
- ③收尾无障碍审计：axe 全站 18 页面族扫描，/favorites、/about、/terms 各报 link-in-text-block（段落内链接无非颜色区分）。

**修复（全部上线）**
- 三处段落内链接 hover:underline → 常驻 underline。

**回归证据**
- 三页 axe 复测全 clean；其余 15 页首扫即 clean。

## Round 99（2026-08-06）
**发现**
- ①收尾全量回归：31 条代表性路由（含全部页面族+OG 端点+sitemap/robots）。

**修复**
- 无缺陷：31/31 全部 200；名字页未缓存 TTFB 220ms。

**回归证据**
- 路由回归输出见本轮记录。

## Round 100（2026-08-06）
**发现/结论**
- ⑤数据与 100 轮总结。100 轮累计：P0 1 个（XSS，第 1 轮前把关期修复）、P1 全清、P2 持续消化；数据 105,954 名 × 146 年，meanings 3,289、famous 2,574；页面族 12+，OG 卡 8 类全覆盖，结构化数据全覆盖；IndexNow 十批约 2.9 万 URL；axe 全站 clean；安全头/同源防护/限流全绿；TTFB 78–220ms。与 Nameberry/BabyCenter/Behind the Name 数据类功能无代差，免费+无广告+隐私（无账号收藏）为差异化优势。
- 自然流量仍为零（上线约 1 周，收录爬坡期），为当前唯一核心待观察项；分发基建已全部就绪。

**下一步**
- 转入低强度运营（docs/ops-weekly.md：周报/IndexNow 补量/数据周更/冒烟），被唤醒即执行；数据大更新窗口 2027-05（SSA 2026 数据）。

## Round 101（2026-08-06，版本 eeb52fb8）——新专项启动：多竞品调研+优点整合复刻
**发现**
- 老板新指令：产品不再标注「免费」，改「Beta 免费试用」口径并展示付费方案（不实际收费）。

**修复（全部上线）**
- 新增 /pricing 页：Basic $0 / Plus $4/mo / Pro $9/mo 三档，全部标注「Included in the Beta trial」，明示 Beta 期不收款、收费前会明确公告。
- 全站文案改口径：首页 hero/描述、页脚（去 free forever）、About、Terms（Beta 试用条款）；导航 logo 加 Beta 徽章；页脚加 Pricing 链接。
- /pricing 入 sitemap static 与 beacon 白名单；Tailwind CSS 重建（ASSET_VER 7）。

**回归证据**
- /pricing 200、三档卡渲染、axe clean、375px 零溢出；sitemap 含 /pricing。

## Round 102（2026-08-06）
**发现**
- ④多竞品普查：10 家竞品真实浏览器深访+技术反推（Nameberry/The Bump/Behind the Name/MomJunction 可达；names.org、thinkbabynames、forebears、babynames.com、namerology 反爬墙或不可达，遵守不绕开；nymbler 已死）。

**产出**
- docs/competitor-survey.md：接入矩阵、技术栈反推（Next.js/Astro/WordPress，HTML 180–400KB vs 我方 3–78KB）、功能全集清单、差距清单（P1×3 / P2×4 / 明确不做×4）。

**回归证据**
- 调研文档入库。

## Round 103（2026-08-06，版本 5d8a55d9）
**发现**
- ④差距清单 P1-a/P1-b（取 The Bump/MomJunction 之长）：名字页缺「同比排名变化」与「同含义名字」区块。

**修复（全部上线）**
- Rank 卡新增 vs 上一年变化（▲/▼/=，双性别独立计算，超 1000 名不显示）。
- 新增「Names with the same meaning」区块，链到对应 /meaning/* 页族（词边界匹配，仅有词源证据时显示）。
- 技术栈评估结论（差距清单同文档）：竞品 Next.js/Astro/WP HTML 180–400KB，我方 Workers+Hono+D1 3–78KB、TTFB 78–220ms，为该内容形态下 Cloudflare 约束内最优，不迁移框架。

**回归证据**
- /name/luna 显示同含义区块与 vs 2024 变化；/name/liam 显示 (= vs 2024)。

## Round 104（2026-08-06，版本 a3c7643d）
**发现**
- ③设计对标 P1-c（取 Nameberry 之长）：竞品用大号衬线展示标题（DM Serif Display 100px）建立品牌感，我方全站无衬线略平。

**修复（全部上线）**
- 新增 font-display 主题字体（Iowan Old Style/Palatino/Georgia 系统衬线栈，CSP 内零外部字体请求）。
- 全站 21 处 H1 升级为衬线展示字体并放大（首页 60px、名字页 48px、内容页 36px+）。

**回归证据**
- 三页 computed font 确认衬线生效；axe 全 clean；375px 零溢出；截图存档。

## Round 105（2026-08-07）
**发现**
- ①⑤新专项首批收口：全量回归 + 数据检查。

**修复/结论**
- 无缺陷：18 关键路由 200；定价/文案/排版/新区块全部在线；数据平稳（订阅 5，自然搜索仍在爬坡）。

**回归证据**
- 回归输出见本轮记录。

## Round 106（2026-08-07）
**发现**
- ⑤内容扩容（竞品对照：MomJunction 发音/词源覆盖广）：词源候选面从 Top-6k 扩到 Top-20k。

**修复（全部上线，数据层无需部署）**
- meanings 3,289→3,723（+434），IPA 发音 1,878→2,023。
- 修复重导入使旧模板残渣回流的问题：DB 清理 417 行（Lua error 截断 6、&lrm;/[Term?] 272、)API 139），fetch-meanings.mjs clean() 补齐同等清洗规则防复发。

**回归证据**
- 残渣查询 0 行；/name/bindi 等新覆盖名字页正常显示含义/IPA。

## Round 107（2026-08-07，版本 27f13d73）
**发现**
- ①口径审计：轮 101 后仍残留 5 处旧「免费」定位（名字页 meta、Top 页 meta、生成器 meta、3 处 OG 卡片脚注）。

**修复（全部上线）**
- 元描述去「free」定位（保留事实性 Beta 试用表述）；OG 卡脚注改为域名署名。

**回归证据**
- /name/luna、/generator 线上文案已更新；OG 卡 200 正常渲染。

## Round 108（2026-08-07）
**发现**
- 分发：定价页/口径/新含义数据上线后需通知搜索引擎。

**修复**
- IndexNow 第 11 批 3,238 URL（200；特色页全量 + 名字页第 29,001–32,000 段）。

**回归证据**
- 提交响应 200。

## Round 109（2026-08-07）
**发现**
- ②③排版升级+新区块后全站复查。

**结论**
- 无缺陷：6 页面族 axe 全 clean；375px 移动端 pricing/名字页零溢出。

## Round 110（2026-08-07）
**发现**
- ⑤数据例行复盘 + 昵称（P2-a）数据可行性结论。

**结论**
- meanings 3,723 / famous 2,574 / 订阅 5；自然搜索仍在收录爬坡。
- 昵称复刻决定：Wiktionary 结构化 diminutive 关系仅约 104 条（12 条模板参数 + 92 条词源正文），数据面过薄，不足以支撑全站「Nicknames」区块；词源正文已自然呈现该信息。维持 P2，待更好数据源。

## Round 111（2026-08-07，版本 c9dfbd0b）
**发现**
- ④复刻 Nameberry「Luna on lists」：名字页缺到榜单页族的反向内链。

**修复（全部上线）**
- 名字页新增「Explore related lists」区块：按名字自身属性匹配 short/long/modern/vintage 榜单（谓词与榜单定义一致，vintage 需当前 rank≤500，无匹配不显示）。

**回归证据**
- /name/mia→Short girl names、/name/alexandria→Long girl names、/name/mildred 正确无匹配（当前排名不在 500 内）。

## Round 112（2026-08-07，版本 c4d4730b）
**发现**
- ①CTA 改造补强：pricing 仅页脚可达，主导航与首页 hero 无入口。

**修复（全部上线）**
- 主导航（sm+）加 Pricing；首页 hero 加「see plans」内链。

**回归证据**
- 首页 3 处 /pricing 链接（导航/hero/页脚）线上确认。

## Round 113（2026-08-07）
**发现**
- 安全回归（新 pricing 面）。

**结论**
- 全绿：6 安全头齐、XSS 探针 404/转义、跨源 beacon 无副作用、http→301。

## Round 114（2026-08-07，版本 29b3ab23）
**发现**
- ②移动端走查：Beta 徽章使 375px 导航「Browse」被截断（P1 视觉）。

**修复（全部上线）**
- 徽章改 sm+ 显示；复测 375px 导航完整（navRight 344 < 375）。

## Round 115（2026-08-07）
**发现**
- ⑤数据例行复盘。

**结论**
- 数据平稳（PV 以内部测试为主，自然搜索收录爬坡）；本批 5 轮无 P0。

## Round 116（2026-08-07）
**发现**
- ①专项批次收口 QA。

**结论**
- 24 关键路由全通过（/search 精确命中 302 属设计行为）；JSON-LD 抽查解析有效；competitor-survey.md 差距清单状态更新（P1 全部完成，P2 结论落库）。
