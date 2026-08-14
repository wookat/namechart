# International name rankings — data source justification (R205)

立项依据：竞品对比验收（2026-08），Nameberry 有 33 国排名而本线仅美国。按「先论证后实现」，本文档核定首批国家的官方开放数据源。入选标准：**官方统计机构 + 明确开放许可 + 可编程获取 + 年度更新**。不满足任一条的不做（不用第三方转载数据、不爬无许可站点）。

## 首批入选（4 国/地区）

| 国家/地区 | 机构 | 数据 | 许可 | 获取方式 | 更新频率 | 实测 |
|---|---|---|---|---|---|---|
| England & Wales | ONS（英国国家统计局） | Baby names statistics, top 100 boys/girls（2025） | [Open Government Licence v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)（要求署名） | xlsx 数据集直链（`ons.gov.uk/file?uri=...2025girlsbabynames.xlsx`），Table_1 = top 100 rank/name/count | 年度（每年 12 月前后发布上一年） | 200，Table_1 解析成功（Olivia #1 2,386） |
| France | INSEE（法国国家统计与经济研究所） | Fichier des prénoms（1900–2025，全量含 rank） | [Licence Ouverte / Etalab 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/)（要求署名） | CSV zip 直链（`prenoms-2025-nat_csv.zip`），字段 sexe;prenom;periode;valeur;rang | 年度 | 200，GABRIEL #1 4,625 |
| Ireland | CSO（爱尔兰中央统计局） | Baby names（VSA50 boys / VSA60 girls，1964–，含官方 rank 统计量） | [CC BY 4.0](https://www.cso.ie/en/copyrightpolicy/)（要求署名） | PxStat REST API，JSON-stat 2.0 | 年度 | 200，rank 维度确认 |
| Norway | SSB（挪威统计局） | Table 10467 first names of born persons（1880–2025，含出生数） | [NLOD 2.0 / CC BY 4.0](https://www.ssb.no/en/informasjon/copyright)（要求署名） | JSON-stat2 API（POST /api/v0/en/table/10467），名字代码前缀 1=girls 2=boys | 年度 | 200，按 count 计算 rank（并列同名次） |

## 口径

- 每国取**最新年份 top 100**（girls/boys 各 100），与美国 SSA 的年度排名口径一致（按当年出生登记数排名）。
- 各国对少量出生数有各自的隐私阈值（ONS ≥3、INSEE ≥3、CSO ≥3、SSB ≥4），只影响长尾，top 100 不受影响。
- 名字匹配到本站 slug 用与 SSA 相同的 slugify（去音符、小写、仅 a-z'-），如 INSEE «LÉO» → leo。匹配不上美国库的名字仍在国家页展示，但无名字页链接。
- INSEE 的 `_PRENOMS_RARES` 聚合行剔除。

## 落库与更新

- 单表扩展：`intl_ranks(country, sex, year, rank, name, slug, births)`，与既有 `state_ranks` 同构（勿增实体：复用「地区×性别×年×排名」模型）。
- `scripts/fetch-intl.mjs` 一键重建 `data/intl.sql`；年度更新时重跑 + `wrangler d1 execute --remote --file`。
- 页面署名：每处展示均标注来源机构与许可（OGL/Etalab/CC BY/NLOD 均要求署名）。

## 暂不入选（诚实声明）

- 苏格兰 NRS / 北爱 NISRA：官方 CSV 存在但站点改版后直链不稳定，第二批再核。
- 加拿大/澳大利亚：仅省/州级碎片数据，无全国口径。
- 德国：无官方全国统计（民间机构 knud bielefeld 数据无开放许可）——不用。
- 北欧其余（丹麦 DST、瑞典 SCB）：API 可用，第二批扩展。
