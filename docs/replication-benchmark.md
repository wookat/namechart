# 一比一复刻基准对照表 — 标杆：Nameberry（2026-08-08）

方法：真实抓取公开可访问页面（首页、名字页 /b/girl-baby-name-luna、搜索、列表族）+ 既往 R42/R101/R131 深访记录。注册墙/订阅墙内容（World rankings 明细、论坛发帖、收藏账号体系）不绕开，仅以可公开面评估。合规：只复刻信息架构/交互/体验规律，自研实现，不拷贝其代码/图片/字体/文案原文。

评分 = 我方对标杆该项体验的还原度（100% = 等效或更好）。

## 1. 名字页（核心流程，Nameberry /b/girl-baby-name-luna vs 我方 /name/luna）

| # | 标杆项 | 标杆做法 | 我方现状 | 还原度 | 差距/处理 |
|---|---|---|---|---|---|
| 1 | H1 + 事实面板 | 名字大标题 + Origin/Meaning/Gender 事实块 + US Rank #27 徽章置顶 | h1+性别徽章+导语句；origin/meaning 在下方区块 | 70% | **P1-a：h1 下加 Origin/Meaning/Rank 事实胶囊行**（数据已有，上移） |
| 2 | 页内导航 | "On this page" 跳转目录（Popularity/About/Similar/Famous…） | 无 | 0% | **P1-b：加 "On this page" 锚点目录**（长页显著提升可用性） |
| 3 | About 导语 | 编辑撰写 About 段 | 数据驱动导语句（总数/峰值/1 in N） | 100% | 等效（数据自证 vs 编辑文案） |
| 4 | 信任署名 | "By Brynn McKeon · Aug 2026" 作者+日期 | 无日期署名 | 40% | **P1-c：加 "Data: SSA release through 2025 · reviewed Aug 2026" 数据版署名行** |
| 5 | 近年排名明细表 | 2014–2025 逐年：Rank + 实际出生数 + 每百万率 | 仅 25 年里程碑表 | 50% | **P1-d：新增 Recent years 逐年表（rank/births/1-in-N）** |
| 6 | 百年排名史 | 折线（rank 轴） | 146 年出生数双性别曲线 + 25 年里程碑 rank 表 | 100% | 等效偏超（我们双线+更长跨度） |
| 7 | 性别切换 | "Also a boy's name → Show me as a boy" 跳转另一页 | 同页双线（girls/boys 同图） | 100% | 超越（无需切页） |
| 8 | World rankings | 多国+🐕🐈 趣味榜（大部分订阅墙内） | 无（无官方公开数据源） | 0% | P2 维持 backlog（不伪造数据） |
| 9 | Similar names | 用户投票 20 名 | 算法 similar-vibe + 对比链接 | 90% | 等效（机制不同；无用户投票体系=无账号定位） |
| 10 | Famous / Pop culture | 名人+影视角色编辑内容 | Wikidata 名人（CC0） | 80% | pop culture 编辑内容维持 P2 |
| 11 | Variations & nicknames | 变体+昵称（法语 Lune 等） | Spellings & variants（数据驱动 1 字距） | 70% | 跨语言变体/昵称缺公开数据源，P2 |
| 12 | 相关博文/榜单内链 | blog posts + more lists | Explore related lists + meaning 页内链 | 90% | 等效 |
| 13 | Save 收藏 | Save + Save to list（需账号） | ♡ 无账号收藏+分享短链 | 100% | 超越（零门槛+可分享可撤销） |
| 14 | 州/地区维度 | 无 | Where X ranks highest + /state/* 页族 | — | 我方独有 |

## 2. 首页

| # | 标杆项 | 标杆做法 | 我方现状 | 还原度 | 差距/处理 |
|---|---|---|---|---|---|
| 1 | Hero 搜索即用 | "Find their name" + 搜索框 | hero+搜索+统计行+三步条 | 100% | 等效偏超（多 onboarding） |
| 2 | 分类入口海 | 20+ 编辑榜单区块（Irish/Created by Authors…） | Top/Trending/榜单/含义页入口 + 工具卡 | 85% | 编辑型主题（文化/文学）属编辑内容，数据自证类已覆盖 18 榜单+54 含义 |
| 3 | 社区区块 | 论坛/专家咨询 | 无（无账号定位） | — | 战略性不做 |

## 3. 搜索/生成器/列表页

| # | 标杆项 | 还原度 | 说明 |
|---|---|---|---|
| 1 | 搜索（JS 应用+高级筛选：音节/起始/含义/流行度） | 80% | 我方 SSR 搜索+模糊纠错+生成器筛选（性别/风格/字母/含义）；音节筛选无公开可靠数据，P2 |
| 2 | 列表页（编辑榜单+名字卡） | 90% | 我方 18 数据榜单+OG+结构化数据；编辑型榜单 P2 |
| 3 | 生成器 | 100% | 标杆生成器 404/墙内；我方 SSR 生成器公开可用 |

## 修复清单（本批执行）
- P1-a 名字页事实胶囊行（Origin/Meaning/IPA/Rank 上移置顶）✅
- P1-b "On this page" 锚点目录 ✅
- P1-c 数据版署名行（信任信号）✅
- P1-d Recent years 逐年表（rank + births + 1 in N）✅

## 超越项（我方 > 标杆）
1. 146 年双性别同图曲线（标杆 rank 单线+切页）；2. 全功能免费无广告（标杆订阅墙：World rankings/部分数据）；3. 州维度排名+页族；4. 无账号收藏+可撤销分享短链（标杆需注册）；5. Sibling & Middle Name Matcher 工具（标杆无）；6. "1 in N babies" 频率句 + 统计卡人话解释；7. 页面性能（HTML 3–78KB vs 183–386KB，无广告脚本）；8. 头对头对比页族+OG 卡；9. 免费开放 meaning 页族（标杆同类在订阅墙内）。

## 基于复刻洞察的深度优化（本批）
- 洞察 1（标杆把 rank 徽章做成第一眼信息）→ 事实胶囊行 + Top-100/Top-1000 徽章分级。
- 洞察 2（标杆逐年表带实际出生率）→ Recent years 表加 "1 in N" 列，把比率翻译成人话。

## 4. 页面覆盖率盘点（R161，全页面清单）

来源：nameberry.com robots.txt + sitemap-site（10 万 URL，99,999 为 /b/ 名字页）+ 首页/各枢纽页导航与 footer 逐层爬查（curl 黑盒，未绕反爬）。

| # | 标杆页面类型 | 标杆 URL 例 | 我方对应 | 覆盖状态 |
|---|---|---|---|---|
| 1 | 首页 | / | / | ✅ 已对照（§2） |
| 2 | 名字页 | /b/girl-baby-name-luna | /name/luna | ✅ 已对照（§1） |
| 3 | 女孩名索引 | /girls-names | /top/girls | ✅ |
| 4 | 男孩名索引 | /boys-names | /top/boys | ✅ |
| 5 | 中性名索引 | /unisex-names | /unisex | ✅ |
| 6 | 字母浏览 | /search/baby-names-starting-with/a | /letter/a | ✅ |
| 7 | 高级搜索 | /search/advanced（性别/起始/结尾/包含/音节/起源/含义/流行度） | /generator + /search | ✅ 本批补齐 Ends with + Contains（音节/起源无公开可靠数据，P2） |
| 8 | 热门排行枢纽 | /popular-names/us（+ /us/boys /us/girls） | /rankings /year/:y /decade/:d | ✅ |
| 9 | 州排行 | /popular-names/us/state | /state/:st（51 页） | ✅ 我方反超（标杆需 JS 应用单页） |
| 10 | 未来预测 | /popular-names/future | 无 | deliberate-n/a：预测非官方数据，与「不伪造数据」红线冲突 |
| 11 | 榜单枢纽 | /baby-name-lists | /browse + /list 入口 | ✅ |
| 12 | 榜单分类页 | /lists/category/classic-names | /browse 分组 | ✅（编辑型分类 P2） |
| 13 | 单个榜单 | /list/26/roman-names | /list/:slug（18 个数据自证榜单） | ✅（编辑型榜单 P2） |
| 14 | 博客 | /blog（+ author/article） | 无 | deliberate-n/a：编辑内容线，非数据产品定位 |
| 15 | 游戏 | /games（namecandy/notd） | 首页 Name of the day | 部分等效；游戏化属娱乐编辑线，deliberate-n/a |
| 16 | 订阅/定价 | /subscribe | /pricing | ✅ |
| 17 | About/联系 | /about /contact /support | /about /press | ✅（联系方式在 about/press） |
| 18 | 隐私/条款 | /privacy | /privacy /terms | ✅ |
| 19 | 账号/登录 | /auth/signin /account | 无 | deliberate-n/a：无账号定位（收藏本地化+匿名分享链） |
| 20 | 论坛社区 | forum.nameberry.com | 无 | deliberate-n/a：社区需运营团队，无账号定位 |

**覆盖率结论：20 类页面中 15 类已覆盖并对照（75%）；5 类为 deliberate-n/a（预测数据红线 1、编辑内容线 2、账号/社区定位 2）。非 n/a 页面覆盖率 15/15 = 100%，无遗漏页面类型。**

## 5. 技术标准反推审计（R162，黑盒观测 + 公开源码分析）

实测方式：curl 头/体分析 + headless Chrome 性能采样（同机同网，2026-08-08）。

| # | 技术项 | 标杆（Nameberry） | 我方（NameChart） | 达标判定 |
|---|---|---|---|---|
| 1 | 渲染方式 | Next.js SSR + React 水合（Vercel），正文在 HTML 中 | Workers 纯 SSR，无水合 | ✅ 等效达标（同为 SSR 可索引） |
| 2 | 框架/构建 | Next.js（24 个 JS chunk，共 529KB gz） | Hono SSR + 3KB 原生 JS | ✅ 反超（JS 负载 1/170） |
| 3 | 字体管线 | Google Fonts CDN（DM Sans/Crimson，woff2，swap，第三方域） | 自托管 Fraunces woff2 子集 67KB，swap+preload+immutable | ✅ 反超（无第三方域名往返） |
| 4 | 图片管线 | PNG logo，无 lazy-loading，无 srcset | SVG logo/图表 + 动态 OG PNG | ✅ 反超 |
| 5 | 缓存策略 | ETag + max-age=0 must-revalidate + Vercel CDN HIT | 之前无 ETag → **本批补齐 ETag+If-None-Match 304** + 边缘缓存 s-maxage | ✅ 本批修复后达标 |
| 6 | 结构化数据 | Organization + WebSite/SearchAction（名字页无专属 JSON-LD） | WebSite/SearchAction + Dataset/FAQPage/BreadcrumbList/ItemList 全页族 | ✅ 反超 |
| 7 | 性能基线（名字页实测） | TTFB 45ms（CDN 热）/ LCP 536ms / CLS 0.099 / 传输 1,386KB / 216 请求 | TTFB 48ms / LCP 140ms / CLS 0 / 传输 87KB / 6 请求 | ✅ 反超（LCP 1/3.8，体积 1/16） |
| 8 | 性能基线（首页实测） | LCP 268ms / CLS 0.100 / 1,540KB / 199 请求 | LCP 224ms / CLS 0 / 84KB / 6 请求 | ✅ 反超 |
| 9 | 无障碍 | 未公开审计；CLS 0.1 临界 | axe 全页族 0 violations（历批回归） | ✅ 反超 |
| 10 | 安全头 | 仅 HSTS（无 CSP/XFO/XCTO/Referrer/Permissions） | CSP+XFO+XCTO+Referrer-Policy+Permissions-Policy+HSTS 六头 | ✅ 反超 |

**技术结论：10 项技术标准 10/10 达标，其中 8 项反超；1 项（ETag 条件请求）为本批发现缺口并已修复上线。**
