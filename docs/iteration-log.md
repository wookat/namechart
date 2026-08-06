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
