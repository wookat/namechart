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
