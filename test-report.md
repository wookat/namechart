# NameChart 生产站回归测试报告 — 名字页 Nameberry 基准打磨（最新）

- 版本：38aa617e（CACHE_VER 76 / ASSET_VER 15，工作树 delta：事实胶囊行、数据署名行、On this page 锚点目录、Recent years 区块、scroll-margin/smooth-scroll CSS）
- 目标：https://namechart.zalize.com （纯生产站）
- 日期：2026-08-08 · 桌面录屏走查 + 375px mobile emulation + axe-core + reduced-motion 仿真
- 录屏：rec-66cefa8d（含结构化 annotation）

## 结论
8 组用例全部通过，无阻断缺陷。一点与任务描述不一致的观察：任务参考值 "Luna 2025 births 6,076" 与生产数据不符——生产表显示 **6,085**（1 in 265 一致）；2023 #10、2024 #13、2025 #27 均与任务一致。另注意：浏览器旧缓存（disk cache）可能仍展示旧版页面，需强制刷新；边缘缓存已由 CACHE_VER 76 正确失效（curl 均返回新版）。

## 用例结果

| # | 用例 | 结果 |
|---|------|------|
| N1 | /name/luna 事实胶囊行：Origin **Latin** / Meaning **"moon"**（链到 /meaning/moon，点击落地正确）/ Say it **/ˈluːnə/** / **2025 rank #27 · Top 100**（深靛蓝底白字）| ✅ |
| N2 | 数据署名行 "Data: official U.S. Social Security records, 1880–2025 · sources & methodology"（链 /about）位于导语下方 | ✅ |
| N3 | On this page 锚点目录：Luna 8 项全出（Meaning/Popularity/Recent years/By state/Famous/Similar names/Siblings/FAQ）；点击 Recent years、FAQ、Meaning 三个锚点，均正确跳转且标题不被 sticky header 遮挡（实测 headerBottom=57px < sectionTop=71.5px；scroll-margin-top=72px=4.5rem）| ✅ |
| N4 | Recent years 表（id=recent）：12 行（2014–2025），Luna 仅 Girls rank 列；2025 #27 / 6,085 / 1 in 265；2024 #13；2023 #10 / 7,862 / 1 in 204 | ✅（births 6,085 非任务所述 6,076，见观察）|
| N5 | 条件渲染：/name/agnes（冷门）无 rank 胶囊、目录省略 Recent years/By state、无 #recent 区块；/name/theodore（男名）#4 · Top 100 深靛蓝胶囊、Recent years 仅 Boys rank 列；/name/mabel（#201）浅底靛蓝字 "· Top 1000" 胶囊变体 | ✅ |
| N6 | 375px（mobile emulation）/name/luna：scrollWidth=375=innerWidth 无横向溢出；胶囊行自动换行可读；表格容器 overflow-x:auto | ✅ |
| N7 | axe-core：/name/luna 0 violations（含 serious/critical；新胶囊两种配色均未触发 color-contrast）| ✅ |
| N8 | reduced-motion：html scroll-behavior=auto（正常时=smooth）；console：录屏走查+headless 全程零错误 | ✅ |

## 与任务描述不一致的观察（非阻断）
1. 任务参考值 Luna 2025 births "6,076（1 in ~265）" 与生产不符：生产表为 **6,085**、1 in 265。行为与数据库一致，疑为任务预期值笔误/过期。

## 关键证据
- Luna 胶囊行 + 署名 + 目录：https://app.devin.ai/attachments/a4fd07ae-d954-40a1-87fe-dfc62dda38c9/ss_zoom_f2df3642.png
- 锚点跳 #recent 落位（不被 header 遮挡）+ Recent years 表：https://app.devin.ai/attachments/956d4b7c-152f-4afa-89ff-ce354ea54276/ss_6849a887.png
- Agnes 条件渲染（无 rank 胶囊、目录缩减）：https://app.devin.ai/attachments/c1724419-dba5-4572-ab64-4f5b38577a88/ss_zoom_a603857a.png
- Theodore #4 · Top 100：https://app.devin.ai/attachments/fa12cab8-fe49-43a7-983a-0171e27ae1d1/ss_zoom_6907b111.png
- Mabel #201 · Top 1000 浅底变体：https://app.devin.ai/attachments/3ec3d2cf-dba3-4235-af8b-bc67f6c44cbe/ss_zoom_d10aa049.png
- 375px 顶部 / Recent years 表：https://app.devin.ai/attachments/d025cc4b-100a-4431-8ede-045b200d5713/m375-luna-top.png · https://app.devin.ai/attachments/dbf5630e-d66a-4265-9894-b487b37a96c3/m375-luna-recent2.png

## 自动化输出摘录
```text
mobile375 /name/luna scrollW,innerW = [ 375, 375 ] OK
recent table container scrollW,clientW,overflowX = [ 341, 341, 'auto' ]
axe /name/luna violations: 0
console entries: 0 severe
reduced-motion scroll-behavior = auto
normal scroll-behavior = smooth
normal scroll-margin-top #recent = 72px
after #recent click: { headerBottom: 57, sectionTop: 71.5 } NOT COVERED
```

---

# 历史：设计系统深度升级（cd04e930）

- 版本：cd04e930（CACHE_VER 74 / ASSET_VER 13，工作树未提交改动：Fraunces 字体、组件态、宽屏容器、hero 特效、统计卡人话解释）
- 目标：https://namechart.zalize.com （纯生产站）
- 日期：2026-08-08 · 桌面录屏走查（1600px）+ 375/768/1024/1440 四档 headless 检查 + axe-core + reduced-motion 仿真
- 录屏：rec-5d65815c（含结构化 annotation）

## 结论
9 组用例全部通过，无阻断缺陷。两点与任务描述不一致的观察（见下）：nav 链接点击区高约 40px（<44px 目标）；Luna 现为 girls #27（非 #12），Rank 解释按规则正确显示 "Popular but not everywhere"。

## 用例结果

| # | 用例 | 结果 |
|---|------|------|
| D1 | 字体：/fonts/fraunces-latin.woff2 200 (font/woff2, immutable)；HTML 含 preload + styles.css?v=13；`document.fonts.check('700 1em Fraunces')`=true；hero h1 computed font-family 以 Fraunces 开头，视觉为衬线；无 FOIT（swap，首屏文字即可见）| ✅ |
| D2 | Hero 特效："See it in one chart." 渐变文字（.text-gradient）；.hero-glow 双色光斑可见、animation-name=glow-drift、pointer-events:none 不挡点击；副标题 fade-up-2 交错入场 | ✅ |
| D3 | 组件态：nav hover 下划线动画可见；Tab 后 Search 按钮出现 2px 靛蓝 focus-visible 外框；按住按钮时 computed transform=matrix(0.97,…) | ✅（但 .nav-link 高度 40px，未达任务所述 ≥44px，见观察） |
| D4 | /name/luna 六统计卡人话解释全部正确渲染（Total/Peak/Rank "Popular but not everywhere"/First recorded/Trend "On its way up…"/Gender split）；/name/agnes Rank 显示 "Rare — a truly distinctive pick"；无破损标记/XSS | ✅ |
| D5 | 宽屏：1600px 真实浏览器与 1440px headless 下 header/main/footer 容器均 1152px（max-w-6xl），布局不破 | ✅ |
| D6 | 四档视口 375(mobile emulation)/768/1024/1440：/ 与 /name/luna 均 scrollWidth ≤ innerWidth，无横向溢出 | ✅ |
| D7 | axe-core：/ 与 /name/luna 均 0 violations（含 serious/critical）| ✅ |
| D8 | reduced-motion 仿真：glow/fade-up/fade-up-2/nav 下划线/active scale 全部 animation:none、transition:0s，内容完整可见（opacity 1）| ✅ |
| D9 | console：全程走查零错误；字体请求命中缓存正常 | ✅ |

## 与任务描述不一致的观察（非阻断）
1. `.nav-link` 实测点击区高度 40px（padding 0.625rem×2 + text-sm 行高），未达任务所述 ≥44px 触控目标；如需达标可将纵向 padding 提至 ~0.75rem。
2. 任务中 "Luna girls #12 应显示 Very popular" 与生产数据不符：Luna 2025 实为 girls #27，按代码规则（bestRank≤25 → Very popular；≤200 → Popular but not everywhere）正确显示 "Popular but not everywhere"。行为与代码一致，仅任务预期值过期。

## 关键证据
- Hero（Fraunces + 渐变 + 光斑）：https://app.devin.ai/attachments/510044c0-8674-46b5-a4c0-46c6ac6e5218/ss_zoom_d7b1e113.png
- nav hover 下划线：https://app.devin.ai/attachments/74107422-22d7-4ac0-81f9-5d4e0241fcd8/ss_zoom_6e91c023.png
- focus-visible 外框：https://app.devin.ai/attachments/aded1006-db06-4a8f-8315-bd6458fc2ad7/ss_zoom_b14d347c.png
- Luna 六统计卡解释：https://app.devin.ai/attachments/dbcb7b94-d1f6-4221-b324-8f7bd0efcf59/ss_zoom_861bda21.png
- Agnes "Rare" 解释：https://app.devin.ai/attachments/edc86025-94ca-4191-a31c-222597c23edb/ss_c31edab1.png
- 1440px 宽屏首页：https://app.devin.ai/attachments/abed8b41-b59f-4056-8512-6fe8ddd627b7/vp1440-.png
- 375px 首页 / 名字页：https://app.devin.ai/attachments/82583131-d1b3-47ca-acec-81e4389f5ca2/m375-.png · https://app.devin.ai/attachments/1b6eac40-d1aa-46ae-94ee-025f63b8ea21/m375-name-luna.png
- reduced-motion 首页：https://app.devin.ai/attachments/712e6ea0-23cd-4a53-a130-3ed46f99f57e/reduced-motion-designsys.png

## 自动化输出摘录
```text
viewport 768/1024/1440 (/, /name/luna): scrollW == innerW, OK; 1440 mainW=1152
mobile375 / scrollW,innerW = [375, 375] OK
mobile375 /name/luna scrollW,innerW = [375, 375] OK
axe / total violations: 0 serious/critical: []
axe /name/luna total violations: 0 serious/critical: []
reduced-motion: {"prm":true,"glowBefore":"none","glowAfter":"none","h1Anim":"none","subAnim":"none","h1Opacity":"1","subOpacity":"1","navAfterTransition":"0s"}
active transform: matrix(0.97, 0, 0, 0.97, 0, 0) isActive: true
```

红线遵守：未提交 /api/subscribe，无 API 高频请求。

---

# （历史）NameChart 生产站回归测试报告 — Onboarding/用户引导

- 版本：fe0a96a4（`d3ed575 Add onboarding: 3-step hero strip, empty-state CTAs, one-time new-feature badge and shortlist tip`）
- 目标：https://namechart.zalize.com （纯生产站）
- 日期：2026-08-08 · 新用户视角（localStorage 全清空后开始）· 桌面录屏走查 + 375px 仿真 + axe-core
- 录屏：rec-d8c71e5d（含结构化 annotation）

## 结论
全部 8 组用例通过，未发现阻断或功能性缺陷。axe 在 /（新区块）与 /name/luna（tip 可见态）均 0 violations；375px 两页面 scrollWidth=375 无横向溢出；无弹窗、无动画依赖；禁 JS 时 tip 与 New 徽标保持 SSR hidden。

## 用例结果

| # | 用例 | 结果 |
|---|------|------|
| O1 | 新用户首页：hero 下三步条（1 Search / 2 Read / 3 Shortlist & match，步骤含内链）+ Generator/Matcher 双工具卡（Matcher 卡 "New" 徽章）+ 主导航 Matcher "New" 徽标 | ✅ |
| O2 | 导航 New 徽标一次性：点击 Matcher → 后续任意页徽标消失（nc-seen-matcher=1）且不再出现 | ✅ |
| O3 | /matcher 空态 3 个 "See it in action" 示例（Try Luna & Leo / Try Olivia / Try Theodore & Eleanor）；点 "Try Luna & Leo" 直达 ?names=luna&names=leo 结果态；结果态下示例胶囊消失 | ✅ |
| O4 | 名字页 tip：/name/luna 首访粉底提示条出现在 action 按钮下方；点 ♡ 后立即消失；刷新与 /name/leo 均不再出现（nc-tip-fav=1）；单独验证 × 关闭路径同样持久 | ✅ |
| O5 | 空态 CTA：/search?q=zzzqqq 显示两个 CTA，"Get ideas from the generator →" → /generator，"Browse by letter, year or state" → /browse；/generator 无参 4 个示例胶囊，点 "Vintage girl names" → ?sex=girl&style=vintage 结果网格 | ✅ |
| O6 | 375px（mobile emulation）：/（新区块）与 /name/luna（tip 可见态）scrollWidth=375=innerWidth，无横向溢出 | ✅ |
| O7 | axe-core：/（新区块，清空 localStorage 态）与 /name/luna（tip 可见态）均 0 violations（含 serious/critical） | ✅ |
| O8 | 克制性 & 冒烟：全程无弹窗；reduced-motion 仿真下三步条/工具卡仍可见；禁 JS 时 nc-tip 与 nc-new-dot 保持 hidden；/search?q=luna 精确命中 301 → /name/luna（代码设计如此，src/index.js L441）；console 无错误 | ✅ |

非阻断观察：/generator?sex=girl&style=vintage 结果网格中出现标注为 boy 的 Bennie 与 unisex 的 Cleo（历史上作为女孩名使用），产品上可再确认 sex=girl 过滤口径；非本次上线改动引入。

## 关键证据

### 新用户首页 & Matcher 示例
| 首页三步条+工具卡+New 徽标 | Matcher 空态示例胶囊 |
|---|---|
| ![home](https://app.devin.ai/attachments/fc4620cf-31cd-497c-9aff-af6f970189f7/ss_zoom_c0d44ae1.png) | ![matcher-empty](https://app.devin.ai/attachments/6752cf19-c422-4639-a02d-3d4aa4ac9fa2/ss_2784e10f.png) |

| Try Luna & Leo 结果态 | 名字页 tip 可见态 |
|---|---|
| ![luna-leo](https://app.devin.ai/attachments/7a94281a-e066-47c3-82b1-d093ad33b9f6/ss_fd95b290.png) | ![tip](https://app.devin.ai/attachments/44528963-f6c7-4f9d-bab5-57cf5b7cfc3f/ss_616986e2.png) |

| 点 ♡ 后 tip 消失 | × 关闭路径（tip 可见对照） |
|---|---|
| ![tip-gone](https://app.devin.ai/attachments/75f61361-7cd3-4fc3-b911-65c6bbd46208/ss_0f7ca1af.png) | ![tip-x](https://app.devin.ai/attachments/de885fce-6665-44c8-8b03-64f3ab7d0104/ss_ec6d098e.png) |

### 空态 CTA
| /search?q=zzzqqq 两个 CTA | 生成器示例胶囊 → 结果 |
|---|---|
| ![search-empty](https://app.devin.ai/attachments/19e3067e-aad0-4682-989f-ba440f88e291/ss_68fc3d00.png) | ![gen-result](https://app.devin.ai/attachments/4000b0a7-99f0-4948-8e80-8e00f3ae418d/ss_d0639091.png) |

### 375px
| 首页（新区块） | /name/luna（tip 可见） |
|---|---|
| ![m-home](https://app.devin.ai/attachments/e5d7c0ef-5e2f-463d-bf92-8723b1acb047/mobile-home.png) | ![m-tip](https://app.devin.ai/attachments/c36af3c0-b799-4334-a317-50e5a1930c9f/mobile-luna-tip.png) |

### 自动化输出（selenium headless + @axe-core/webdriverjs）
```
mobile / scrollWidth,innerWidth = [ 375, 375 ]
mobile /name/luna tipVisible = true scrollWidth,innerWidth = [ 375, 375 ]
axe / total violations: 0 serious/critical: []
axe /name/luna (tip visible = true ) total violations: 0 serious/critical: []
reduced-motion visibility: {"howItWorks":true,"tools":true}
no-JS: nc-tip has hidden attr: true
no-JS: nc-new-dot has hidden attr: true
```

红线遵守：未提交 /api/subscribe，任何 API 均为正常 UI 浏览量级。

---

# （历史）NameChart 生产站回归测试报告 — Matcher & 收藏分享短链

- 版本：d60dc217（生产分支，`0fa0bb9 Add sibling & middle name matcher and shareable shortlist links`）
- 目标：https://namechart.zalize.com （纯生产站，无本地服务器）
- 日期：2026-08-08 · 测试代理全量 UI 回归（桌面走查 + 375px + axe-core）
- 录屏：rec-50041157（含结构化 annotation）

## 结论
全部 9 组用例通过，未发现阻断或功能性缺陷。axe-core 在 3 个页面均 0 violations；375px 三页面无横向溢出；冒烟页面 console 无错误。

## 用例结果

| # | 用例 | 结果 |
|---|------|------|
| T1 | /matcher 空态（主导航入口、3 输入框、3 张原理卡） | ✅ |
| T2 | 单名 Luna：Sisters/Brothers 卡组、规则正确（无 L 开头/-na 结尾）、Middle name 胶囊、卡片可点进 /name/quinn | ✅ |
| T3 | 双名 Luna+Leo：标题 "Sibling names for Luna & Leo"，middle names 仅取第一个名字 | ✅ |
| T4 | 未知名 Zzzqqqx：显示 "Not in the data: zzzqqqx — check the spelling…"，无结果区 | ✅ |
| T5 | 分享全流程：收藏 Luna/Leo/Ivy → Share → /s/hmm8sey1 链接卡（Copy→"✓ Copied"）→ 新标签打开短链 200 SSR 三名卡片 → Delete link → 刷新短链 404 | ✅ |
| T6 | 375px 移动端（Chrome 设备仿真）：/matcher、/favorites（含分享卡）、/s/xxx scrollWidth=375，无横向溢出 | ✅ |
| T7 | axe-core 4.12：/matcher（结果态）、/favorites（分享卡态）、/s/xxx 均 0 violations（含 serious/critical） | ✅ |
| T8 | 入口：主导航 "Matcher"（md+ 显示）可达；/browse 的 "Sibling & middle name matcher →" 按钮可达 | ✅ |
| T9 | 冒烟（回归）：/、/name/luna、/top/girls、/generator、/pricing 正常渲染，console 无错误 | ✅ |

## 关键证据

### Matcher
| 空态 | Luna 结果 |
|---|---|
| ![empty](https://app.devin.ai/attachments/c16388e8-6caf-4de6-ab82-3b9e6ede98d4/ss_9f82e473.png) | ![luna](https://app.devin.ai/attachments/74223f22-eb39-40b4-bdc5-f17e4c4ce0f9/ss_edc19c20.png) |

| Luna+Leo | 未知名提示 |
|---|---|
| ![lunaleo](https://app.devin.ai/attachments/1db68056-405f-4246-9bdf-7615c72c3502/ss_5386507c.png) | ![notfound](https://app.devin.ai/attachments/cc4f0e61-374b-4854-ac3a-2c7e9c9d4f26/ss_245254b6.png) |

### 分享短链
| /favorites 分享卡（✓ Copied） | 短链 SSR 页 |
|---|---|
| ![sharecard](https://app.devin.ai/attachments/4c97de14-92e4-4ee9-a7a7-2acc0f5f2b65/ss_a227402c.png) | ![shortlink](https://app.devin.ai/attachments/4f2feea4-f6cd-49e0-bdab-eb7668eed55d/ss_e06f38d8.png) |

| 🟢 Delete 后刷新短链 → 404 |
|---|
| ![404](https://app.devin.ai/attachments/f93aa46f-7a4b-42de-bcea-3add865995bb/ss_1787d1f4.png) |

### 375px 移动端
| /matcher | /favorites（分享卡） | /s/xxx |
|---|---|---|
| ![m-matcher](https://app.devin.ai/attachments/6eaf90d5-5a4a-4f25-9983-090c30a28e1e/mobile-matcher.png) | ![m-fav](https://app.devin.ai/attachments/83cee4f1-72c2-45db-95c4-9efacc7e2e44/mobile-favorites.png) | ![m-share](https://app.devin.ai/attachments/46fa29ac-68f9-4476-899f-bde5b0af91dd/mobile-share.png) |

### axe-core / 375px 命令输出
```
axe-core 4.12.1 (chrome-headless)
/matcher?names=Luna  → 0 violations found!
/s/hmm8sey1          → 0 violations found!
/favorites(分享卡态, selenium 注入 localStorage) → total violations: none; serious/critical: 0
375px: matcher/share/favorites 均 scrollWidth=375, NO-OVERFLOW
```

## 备注 / 非阻断观察
1. 页面 CSP（`script-src 'self'; connect-src 'self'`）阻止浏览器内注入 CDN 版 axe，改用 @axe-core/cli + selenium 无头方案（安全上是好事）。
2. "Middle names for Luna" 胶囊同时含男性经典名（Luna Robert 等）——与代码设计一致（girls+boys 各 6 个），但产品上可考虑按性别过滤。
3. Chrome 桌面窗口最小宽约 500px，375px 验证通过 Chrome mobile emulation（headless）完成并截图佐证。
4. 红线遵守：未提交 /api/subscribe，API 调用仅正常 UI 流量。
