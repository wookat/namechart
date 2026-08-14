# NameChart 近 30 天聚合漏斗导出（2026-07-14 → 2026-08-14）

来源：D1 第一方聚合统计（`hits(day,path,count)`、`searches(day,q,results,count)`、`shares(created)`）。
隐私口径：无 cookie、无用户标识符、无 IP 存储 —— 仅按天×路径/查询词聚合，无任何 PII。

## 1. 按天 PV

| 日期 | PV |
|---|---|
| 2026-08-05 | 42 |
| 2026-08-06 | 145 |
| 2026-08-07 | 49 |
| 2026-08-08 | 110 |
| 2026-08-09 | 160 |
| 2026-08-10 | 1 |
| 2026-08-11 | 1 |
| 2026-08-13 | 42 |
| 2026-08-14 | 12 |

30 天合计 562 PV（2026-07-14 至 08-04 无记录行；hits 表自 8-05 起有数据）。

## 2. 漏斗各层（按页面族 PV，30 天）

| 漏斗层 | 页面族 | PV |
|---|---|---|
| 首访/浏览 | home | 99 |
| | name pages | 140 |
| | lists (top/trending/unisex) | 54 |
| | pSEO lists/meanings | 53 |
| | other（state/year/letter/about 等） | 69 |
| 工具使用 | compare | 45 |
| | generator | 40 |
| | search（页面） | 15 |
| | matcher | 14 |
| 收藏/分享 | favorites | 28 |
| | shared shortlists（/s/xxx 打开） | 5 |
| | 分享短链创建（shares 表新增行） | 2 |

## 3. 搜索行为（searches 表，30 天）

- 独立查询词 12 个，总查询 27 次，其中 0 结果 19 次。
- Top 查询：zzzyx(6, 0 结果)、zzzqqq(4, 0 结果)、imgsrcxonerroralert(3, 0 结果)、emma(3)、scriptalertscript(3, 0 结果)、ann(2)、ma(2)。

## 4. 如实声明（重要）

1. **QA 噪声占主导**：上表查询词几乎全部是本线与验收官会话的回归测试/安全探针（zzzyx、XSS 字符串、emma/ann 为脚本用例）；PV 峰值日期与迭代/验收轮次日期吻合。按红线「QA 数据不计入业务成果」，本导出反映的是**测试流量为主的基线**，不能当作真实用户漏斗解读。
2. **回访/留存不可测（by design）**：站点 cookie-free、无用户标识符，D1 只有天×路径聚合，无法区分「同一访客回访」与「新访客」。要拿真实回访数据只有两条合规路径：① 老板侧开通 GSC/Bing Webmaster 拿搜索点击与回访查询数据；② 若未来接受轻量匿名标识（如 30 天轮换的 first-party 匿名 ID），需老板明确批准后再实现。
3. 收藏发生在 localStorage（无服务器写入），服务器可见的只有 /favorites 页面 PV 与分享短链创建数——「收藏层」以此为代理指标。
4. 自然搜索仍在收录爬坡（Bing 收录 ~69k 为 8 线最高，但点击尚未形成规模）；最大杠杆仍是 GSC 验证+首发分享。
