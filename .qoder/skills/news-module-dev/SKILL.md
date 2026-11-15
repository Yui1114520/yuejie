---
name: news-module-dev
description: 为「阅界」国际新闻 App 新增或改造新闻模块（国内/经贸/科研/军事等），以及报刊板块（开放索引论文推送 + 公众号/RSS 科普通道）。覆盖模块词表与亲和度打分、跨模块唯一分配（同一事件只进一个模块，杜绝重复冲突）、每模块 payload 组装与缓存、`/api/news?module=` 接口、国内板块 34 省筛选与政策文件专栏、新浪实时行情与指数成分股涨跌榜、科研「理论研究/应用前沿」二级分类、军事全球战区态势图与战线战报、社会运动/左翼与第三世界专栏、装备演习焦点优先、翻译链路与 Google 中转兜底、前端模块切换、人物栏仅国际显示、专用 RSS 源，以及报刊侧 Crossref/OpenAlex/DOAJ/EPMC/arXiv/ChinaXiv/OSF/HAL 采集、社科兴趣栏（法学与治理、心理与教育、历史与人类学）与权威期刊名录、SQLite 入库、`discoverFeed` 订阅源自动发现、微信 `appmsgalbum` 合集解析、可解释打分、非阻塞采集调度（`/api/press` 刷新不等整轮采集）与分层翻译预算，以及手机端 APK 打包（Capacitor 壳 + 局域网后端：JDK 21/SDK 35 工具链、`androidScheme: http`、接口基址三层解析与 CORS、release 自签名与 aapt2/apksigner 自检、`dist/yuejie.apk` 经后端下载分发），以及公网静态快照站（`npm run site:publish` 把模块/报刊/行情导出成 `site/data/*.json`、`VITE_SITE_DATA` 静态模式、图片下载压缩进站内、发布前脱敏扫描、整轮源失败不得覆盖已有稿件、Cloudflare Pages 部署与 `_redirects` 深链）。当任务涉及新增新闻频道/模块、模块间新闻重复、模块打分不准、国内时政或省级动态、政策文件栏、行情或成分股面板、科研分类层级、战争地图与战区覆盖、左翼/社会运动报道、标题未翻译成中文、模块栏位或人物栏规则，论文推荐不准、报刊刷新点了没反应、社科栏混入化工/材料期刊、科普通道抓不到、articles 恒为 0、切换兴趣卡顿，手机装包打不开、APK 构建失败、壳里接口连不上或跨域被拦，以及手机在外面打不开、不想让电脑一直开着、快照站空白或图片全丢时使用。
---

# 阅界新闻模块开发

## 概述

「阅界」只有一条抓取 + 聚类流水线，模块是聚类结果的**唯一归属标签**，不是每个模块各自抓取。新增模块只做三件事：定义词表、算亲和度、按唯一规则分流；其余（抓取、过滤、聚类、翻译、热度）全部复用。

核心不变量：

1. **互斥**：每个聚类恰好分配一个模块，模块之间不可能出现同一条新闻。
2. **国际兜底**：国际（world）是默认模块，任何没有明确专业归属的硬新闻留在国际。
3. **人物栏只属于国际**：其他模块 `people` 恒为空数组，前端也不渲染 `PeopleRail`。
4. **编辑红线不放松**：模块化不得绕过 `server/editorial.mjs` 的硬新闻过滤（观点/软新闻/治安犯罪一律先剔除）。

## 模块契约

模块 id 固定为 `world | domestic | economy | science | military`，对应中文标签 `国际 | 国内 | 经贸 | 科研 | 军事`。唯一事实来源是 `server/modules.mjs` 的 `MODULES`，后端、前端、日志都从它派生，禁止在多处硬编码 id 列表。

每个模块 payload 形状与 `src/types.ts` 的 `NewsPayload` 一致，并额外带 `moduleLabel`：

```js
{
  module: "economy",
  moduleLabel: "经贸",
  generatedAt: "2026-11-13T...",
  meta: { onlineSources, totalSources, totalArticles, clusters, totalClusters,
          filtered, relay, sources, push? },
  hero, spotlight, ranking, latest, people: [], regions, all,
  topics?,                // 仅 science：科研子领域计数
  situation?,             // 仅 military：全球战区态势
  movements?,             // 仅 military：社会运动/左翼/议会斗争
  provinces?, documents?  // 仅 domestic：34 省动态 + 政策文件
}
```

`meta.totalArticles` 是**本模块**的原始报道数（各聚类成员数之和），不是全站数；全站过滤统计 `meta.filtered` 允许各模块共用。

## 步骤 1：定义词表

在 `server/modules.mjs` 的 `VOCAB` 中为模块增加 `zh` / `latin` / `multi` 三段：

- `zh`：中文概念词，走子串匹配。
- `latin`：英文概念，必须是带 `\b` 边界的正则，带 `gi`。
- `multi`：法/西/葡等重音词，走忽略大小写的子串匹配。

写词的硬性要求：

1. **只收本模块的判别词**，不收通用政治词。`president`、`summit`、`sanctions` 归国际，不要放进经贸。
2. **一词一概念**。用 `research(?:ers?)?` 而不是同时写 `research` 和 `researchers`，否则同一句话被计两次。
3. **避免歧义词**。`general`（general election）、`science`（political science）、`study`（单独出现）都不要；改用 `military commanders`、`scientific`、`study finds`。
4. 与 `editorial.mjs` 的 `CATEGORY` 保持互补：crime/soft 词不要出现在模块词表里，模块只负责分流已通过硬新闻过滤的内容。科研类硬新闻由 `CATEGORY.research` 放行（研究/论文/星系/基因/疫苗等），新增科研词表时同步补齐该分类，否则源站科学稿会因「零信号」被判为无关丢弃。

参考基线：

| 模块 | 判别概念 |
| --- | --- |
| 经贸 | 关税、贸易协定、出口管制、供应链、通胀、利率、央行、GDP、衰退、失业、财政赤字、并购、破产、大宗商品、稀土出口、世贸/IMF/世行/经合组织 |
| 科研 | 科研人员、论文/同行评审、实验、突破、太空/卫星/火箭/探测器、量子、人工智能、算法、半导体、基因编辑、临床试验、核聚变、超导、天文、诺奖、专利 |
| 军事 | 国防预算、军售/军购、导弹/防空、军舰/潜艇/航母、战机、无人机、兵力部署、征兵、军演、军事基地、核武库、军控、军工企业、五角大楼/国防部、军事援助、雇佣兵；社会运动/罢工/游行/游击/反帝反殖民/议会斗争 |
| 国内 | 中央/国务院/省委/市委、部委、发改委、基层治理、乡村振兴、共同富裕、高质量发展、新质生产力、统一大市场、京津冀/长三角/粤港澳/成渝、自贸区、雄安、城市更新、保障房、地方债、营商环境、民营经济、招商引资、安全生产、巡视、纪检监察、调研/部署/出台/试点 |

## 步骤 2：算亲和度并唯一分配

```js
export function moduleScores(rep, otherTitles = [], context = {}) {
  const text = [rep.title, rep.titleOriginal, rep.summary, ...otherTitles]
    .filter(Boolean).join(" ");
  const base = classifyNews(rep).scores ?? {};
  const headline = [rep.title, rep.titleOriginal].filter(Boolean).join(" ");
  const zone = detectZone(text, headline);
  const promo = FINANCE_PROMO.test(text);
  const movement = isMovementStory(headline, text);
  const chinese = (rep.origin ?? "en") === "zh";
  const world = (base.politics ?? 0) * 0.8 + (base.security ?? 0) * 0.7 +
    (base.actors ?? 0) * 0.5 + (base.frontier ?? 0) * 0.3 +
    (base.climate ?? 0) * 0.3 + (base.health ?? 0) * 0.25;
  const economy = conceptCount(text, VOCAB.economy);
  const science = conceptCount(text, VOCAB.science);
  // 国内只收中文稿，且涉外标题一律否决，避免变成第二国际版
  const domestic = chinese && !DOMESTIC_FOREIGN.test(headline)
    ? conceptCount(text, VOCAB.domestic) + (detectProvince(headline, text) ? 3 : 0)
      + (isPolicyDocument(rep.title, rep.summary) ? 5.5 : 0)
      + (context.domesticSource ? 2.5 : 0)
    : 0;
  return {
    world,
    economy: economy + (promo ? 3 : 0),
    science: promo ? Math.max(0, science - 3) : science,
    military: conceptCount(text, VOCAB.military) + (zone ? zone.score * 1.5 : 0)
      + (movement ? 3 : 0),
    domestic,
  };
}

export function assignModule(rep, otherTitles = [], context = {}) {
  const scores = moduleScores(rep, otherTitles, context);
  const top = SPECIALIZED.map((id) => ({ id, score: scores[id] }))
    .sort((a, b) => b.score - a.score)[0];
  if (top.score >= 2 && top.score >= scores.world * 0.6) return { id: top.id, scores };
  return { id: "world", scores };
}
```

规则解释（改阈值前先想清楚代价）：

- **阈值 2**：至少命中两个不同概念才进专业模块，避免单词误伤。
- **`>= scores.world * 0.6`**：专业信号达到政治/安全基线的六成即优先归属。战争、外交、选举的 world 分远高于专业分，仍留在国际；军购、科研、经贸只要信号成规模就会被分走。若改成 `>= scores.world`，军事/科研模块会被战争与峰会稿长期压制，几乎分不到稿。
- **国际权重低于专业模块**是有意为之：北约军购这类稿子政治分高但军事信号更具体，应进军事。
- 不要在聚类前分配：必须用聚类代表 + 其余成员标题一起打分，单条标题容易波动。

分配在 `server/trending.mjs` 的 `scoreCluster` 之后一次性完成，结果写进聚类对象（`cluster.module`），后续所有模块从同一份已分配列表切分——这是互斥的唯一保证。

## 步骤 3：组装各模块 payload

一次抓取、一次聚类、一次翻译预算，然后按模块切片：

```js
const visibleByModule = new Map(
  MODULES.map((mod) => [
    mod.id,
    scored.filter((c) => c.module === mod.id).slice(0, mod.visible),
  ]),
);
```

规则：

1. **先分配再切片**，禁止每个模块各自过滤全量聚类。
2. 模块 `visible`：国际 32，国内 36，经贸/科研 24，军事 40（战报单独成栏，需要更多常规稿填满热度榜与动态）。样本少时宁可少而准。
3. `hero/spotlight/ranking/latest` 分段：`[0]`、`[1,5)`、`[5,12)`、剩余按时间取 24；`latest` 要排除 hero/spotlight/ranking 已展示的 id。
4. **国内 headline 例外**：优先 `习近平|李强`，其次 `中共中央|国务院|政治局|全国人大|全国政协`，都没有才取最高分稿，防止城市宣传稿占据时政头条位。
5. `people`：`mod.people ? extractPeople(articles) : []`，且只有 `world` 的 `people` 为 `true`。
6. 推送候选与 `pushCandidates` 只从国际模块计算，其他模块不写推送池，避免账本语义混乱。
7. 翻译预算：国际标题全译 + 前 5 条摘要；专业模块标题全译 + 前 3 条摘要。新增模块时同步检查 `translateBatch` 总量，别把免费额度打爆。

## 步骤 4：接口与缓存

`server/index.mjs` 用**按模块**的 payload 映射，而不是单例：

```js
const state = { modules: {}, generatedAt: 0, building: null, pushCandidates: [] };
```

- `buildNews()` 返回 `{ generatedAt, modules: { world, domestic, economy, science, military }, pushCandidates, relay }`。
- `buildNewsInBackground()` 一次构建全部模块，整体 TTL 仍为 `PAYLOAD_TTL_MS`。
- `GET /api/news?module=economy`：校验 id 属于 `MODULE_IDS`，未知模块返回 404，缺省 `world`。
- `GET /api/push` 与 `/api/push/commit` 固定读 `world`。
- 响应里剥离 `pushCandidates`，不要把内部推送池暴露给前端。

## 步骤 5：前端

- `src/types.ts`：`ModuleId` 联合类型；`NewsPayload.module: ModuleId`，新增 `moduleLabel: string`。
- `src/lib/api.ts`：`fetchNews({ module, refresh })` 用 `URLSearchParams` 拼 `?module=&refresh=1`。
- `NewsPage`：模块 chip 来自本地 `MODULES`（id 必须与后端一致）；`payloads: Partial<Record<ModuleId, NewsPayload>>` 按模块缓存；切换未加载模块时拉取并显示骨架屏。
- **只有 `moduleId === "world"` 且 `people.length > 0` 时渲染 `<PeopleRail />`**，其他模块不显示「今日人物」。
- 专用面板按模块挂载：`economy → MarketBoard`、`science → ScienceBoard`、`military → WarMap + FrontReports + MovementBoard`、`domestic → DomesticBoard`；专用面板的数据来自 payload 的 `situation/movements/provinces/documents`，不要在前端重新按标题猜分类。
- 顶部胶囊文案、空态文案用 `moduleLabel`，不要写死「国际」。
- 手动刷新后清空其他模块缓存，保证所有模块来自同一次构建；自动刷新可只更新当前模块。

## 步骤 6：模块专用 RSS 源（可选）

优先选**已在中转白名单内 hostname** 的栏目源，这样无需重新部署 Cloudflare Worker：

- 已有 host：`feeds.bbci.co.uk`、`rss.nytimes.com`、`www.theguardian.com`。
- 当前模块源：BBC Business/Science/Technology、NYT Business/Science/Technology/Economy、Guardian Business/Science/Technology、Guardian Defence（`/politics/defence/rss`）。
- 军事专用源稀缺：`/world/defence-and-security/rss`、`/uk/defence/rss` 均为 404，只有 `/politics/defence/rss` 可用；新增防务源前先用 `fetchRelay` 实测。
- 新 host 先加进 `server/sources.mjs`，中转白名单由 `worker/index.mjs` 从 `SOURCES.filter(via === "relay")` + `IMAGE_HOSTS` 自动派生。**`.env` 的 `RELAY_URL` 指向 Cloudflare Pages（`yuejie-relay.pages.dev`）**，只 `wrangler deploy` 不会更新线上；必须执行 `npx wrangler pages deploy pages --project-name yuejie-relay --commit-dirty=true`，再用 `/health` 确认 host 数已增加，否则新源仍是 403。
- 直连可用的专业源（无需中转）：科技/创投 TechCrunch、Inc、钛媒体；科研 新华科技、极客公园、量子位；防务与冲突 Crisis Group、Long War Journal、TWZ、英国国防部 Atom、DVIDS、Ukrinform、Myanmar Now、Rappler、OC Media、JAMnews、Al-Monitor、InSight Crime、La Nación、Africanews。新增前先实测 XML 与条目数，RSS 返回 HTML 的源（36Kr/ITHome/CNBeta 等）不要加。
- 新增源后观察 `/api/news?module=` 的 `meta.sources`：持续 403/超时的源直接删除，不要留在面板里凑数。
- RSS 1.0（`rdf:RDF`）源已被 `extractItems` 支持；Science/AAAS 的 `dc:date` 是占位符 `TZ`，会按 6 小时前估算。若某源显示「源返回空内容」但直连正常，先检查是不是走了 relay 被源站拦截，可改为直连。

## 扩展一：实时行情（经贸）

- `server/markets.mjs` 直接请求 `https://hq.sinajs.cn/list=...`，必须带 `Referer: https://finance.sina.com.cn/`，响应按 GBK 解码（`TextDecoder("gbk")`）。
- 代码前缀决定字段：`s_*`（名称/现价/涨跌/幅度）、`rt_hk*`（现价 index 6、涨跌 7、幅度 8、时间 17+18）、`gb_*`（现价 1、幅度 2、时间 3、涨跌 4）。
- `GET /api/markets` 独立于新闻构建，TTL 60 秒，失败返回 `{ ok: false, indices: [] }`；前端 `MarketBoard` 每 60 秒轮询，无数据时整块隐藏。
- 指数卡片可点击：`BASKETS` 为 8 个指数各配 10 只代表性龙头股，`getMovers(indexId)` 复用 `fetchRaw(codes)` 批量取价（单次请求覆盖整篮），按 60 秒分指数缓存。
- `GET /api/markets/:id` 返回 `{ ok, index, updatedAt, gainers(前5), losers(后5), stocks }`，未知 id 返回 404；A 股个股用 `sh/sz` 全码（昨收 index 2、现价 3、时间 30+31），港股 `rt_hk` 与指数同构，美股 `gb_*`（现价 1、幅度 2、涨跌 4）。
- 中国配色：涨红 `#b3261e`、跌绿 `#2d6f6b`；卡片和涨跌榜都用这套，别换成欧美红跌绿涨。
- 行情与成分股只挂在经贸模块，不进 `NewsPayload`，避免污染新闻构建与推送。

## 扩展二：科研「理论研究 / 应用前沿」二级分类

- `server/taxonomy.mjs` 的 `SCIENCE_TOPICS`（物理/化学/生物/计算机）与 `APPLIED_FIELDS`（工业/能源/航天/电子/医疗）各自维护词表，`classifyScience(text)` 取命中最多的一类；应用类 ≥ 研究类时归「应用前沿」并写 `subtopic/subtopicLabel`，否则取研究主题，零命中归「综合」。
- `composeModule` 为科研 payload 附加 `topics`（计数），但前端 `ScienceBoard` **不再依赖它**：一级 tab 为「理论研究 / 应用前沿 / 综合研究」，二级 chip 为各子领域，计数直接从 `items` 聚合，子领域下再按物理/化学/生物/计算机或工业/能源/航天/电子/医疗分小节。
- 应用类条目必须靠 `item.subtopic` 归组，不能按标题关键词二次猜测；`subtopic` 缺失的历史缓存条目会掉出应用分栏，重建 payload 即可修复。
- 基金/ETF/融资稿会因「芯片、航天」等题材词误入科研，`FINANCE_PROMO` 对科研分 −3、经贸分 +3，把这类稿子赶回经贸。

## 扩展三：军事态势图与战报

- `ZONES` 是唯一战区事实源（id/中文名/经纬度/词表），覆盖中东、乌克兰、非洲萨赫勒/刚果/苏丹/埃塞俄比亚/索马里、拉美（含墨西哥）、缅甸、东南亚、克什米尔、高加索、朝鲜半岛、南海等；`detectZone(text, headline)` 只在**标题**命中战区时才打标，并用 `ZONE_NOISE` 排除只是顺带提及战区的气候、房产、签证、司法、疫情、融资稿。
- 战报加权：`military` 分数额外加 `zone.score * 1.5`，让战线报道稳定进入军事；无战区的军购/装备稿仍靠词表进入。冲突词表要覆盖政变/军政府/叛乱/民兵/游击队/内战/戒严/分离主义/起义/清剿/伏击，以及 coup/junta/insurgents/rebels/militants/militias/separatists/civil war/martial law/ambush，否则社会运动与低烈度冲突会被漏掉。
- **社会运动专栏**：`isMovementStory(headline)` 用中文运动词表与英文“群体 + 动作”正则识别罢工/游行/土地斗争/民族解放/议会斗争；命中的聚类军事分 +3，并给军事板块保留最多 4 个可见席位（`pickVisible`），否则热度永远排不过乌克兰/加沙战况。`composeModule` 输出 `movements`（最多 6 条、排除已有战区的条目），由 `MovementBoard` 单独成栏；这些条目不再进 hero/spotlight/ranking，避免同页重复。
- 左翼/第三世界源：Workers World、The Elephant 直连可用；Jacobin、teleSUR 走中转。Peoples Dispatch 在 72 小时窗口内常无新稿，African Agenda 长期陈旧，Al Mayadeen 中转仍 403，均不要留。
- **焦点优先级**：`composeModule` 对军事非战区稿按 `focusRank` 排序——标题/摘要命中装备、武器、演习、试射、国防部/军方发布等 `DEFENSE_FOCUS` 词时加 8 分，再叠加原聚类分，让装备与国防部宣传稿优先占据 hero/spotlight/ranking。
- `buildSituation(articles)` 输出 `{ zones: [{ id, label, count, intensity, tone, reports, lat, lon }], reportsTotal, updatedAt }`；强度 = Σ 报道覆盖 × `exp(-age/36h)` 归一化到 0–100，`tone` 分 hot/warm/watch/idle。
- 战区战报在 `composeModule` 中从 `hero/spotlight/ranking/latest` 排除，单独由 `FrontReports` 成栏，避免同页重复。
- `WarMap` 用生成的 `src/features/news/worldMask.ts` 点阵底图（Natural Earth 110m），等距圆柱投影 `lon -180..180 / lat 84..-60`；新增战区必须同时补 `LABEL_OFFSET`（当前已含 southeast/kashmir/ethiopia/somalia/mexico），否则标签会压在地图边缘或互相重叠。
- 地图是 Canvas + DOM pin 叠加，无外部瓦片依赖，离线可用；`npm run build` 必须能过 tsc 的 CSS 变量类型（用 `CSSProperties & Record<"--pin-size" | "--label-x" | "--label-y", string>`）。

## 扩展四：翻译链路（标题必须中文）

- 顺序固定为 **Google（中转）→ MyMemory → 有道**；Google 直连在本地网络不可达，必须经 Cloudflare Worker 中转（`server/net.mjs` 的 `fetchRelay`）。
- Google 的 `client=gtx` 对云厂商出口 IP 常返回 429；改用 `client=dict-chrome-ex`，并按 `clients5.google.com/translate_a/t` → `translate.googleapis.com/translate_a/single` 顺序尝试。响应有两种形状：扁平字符串数组，或 `[[[译文, 原文, …]]]`，解析函数要同时兼容。
- 中转白名单在 `worker/index.mjs` 的 `ALLOWED_HOSTS`，新增 Google host 后必须重新部署；用 `/health` 确认 hosts 列表已生效，否则表现为 403。
- 全局限速：Google 每次请求间隔 ≥300ms，有道 ≥1300ms（有道并发或短间隔会返回 `errorCode 411 请求频率过快`，串行排队后再试）。两者都失败才进入 60 秒冷却，不要一次失败就冷却 5 分钟。
- `translateBatch` 首轮并发后对仍缺失的文本串行补一轮（最多 40 条，间隔 400ms）；译文里出现 `<s:1>` 这类 HTML 残留或与原文相同都判为失败，不能写入缓存。
- MyMemory 有每日额度，额度耗尽会返回 `quotaFinished`；不要把它当作唯一兜底，否则标题会整批保留英文。

## 扩展五：国内板块（时政 + 政策文件 + 34 省）

- **只收中文稿**：`moduleScores` 里 `domestic` 以 `rep.origin === "zh"` 为前提；`DOMESTIC_FOREIGN`（美国/欧盟/中美/中日/中欧/中俄/外长/出访…）命中标题即国内分归零，让外交稿留在国际。
- **省份识别**：`server/taxonomy.mjs` 的 `PROVINCES` 维护 34 个省级行政区（含港澳台）及省会/主要城市词；`detectProvince(headline, text)` 先标题后正文取命中最多者。payload 里 `provinces` 永远返回完整 34 项，没有报道的省份 `count: 0`、`items: []`，前端筛选栏才不会被“缺省”破坏。
- **政策文件**：`isPolicyDocument(title, summary)` = 发文机关 + 发文动作，或中文标题直接以 条例/规定/办法/决定/规划/纲要/方案/通知/意见/批复 结尾。政策稿常因没有事件信号被 `hardNewsReason` 判成 `other`，`buildNews` 必须对 `other + isPolicyDocument` 放行；国内分额外 +5.5，压过经贸的基金/融资加权。政策文件从 hero/spotlight/ranking/latest 剔除，只进 `documents`（前端 `DomesticBoard` 的「政策文件」栏，最多 12 条）。
- **省级动态**：`DomesticBoard` 按 华北/东北/华东/华中/华南/西南/西北/港澳台 分组渲染 34 个 chip + 「全国」；列表数据来自 `all` 中非政策文件条目，切换省份后按 `province` 过滤，空省份显示空态文案。
- **省级源（34 省全覆盖的基础）**：省级媒体没有可用 RSS，`sources.mjs` 的 `PROVINCIAL_MEDIA` 给每个省级行政区配 1 个要闻页 + 1 个兜底源，源对象固定 `kind: "html"`、`province: <id>`、`strictLocal: true`（澳门等本地稿不写省名的设 `false`），id 自动为 `prov-<province>` / `prov-<province>-2`。
- **HTML 适配器（`fetchFeeds.mjs`）**：① 按 `encoding|charset` 嗅探 GBK/GB2312 再用 `TextDecoder` 解码；② 只取锚文本 8–50 字、链接含数字且非图片/脚本的条目；③ 标题必须点名本省（`strictLocal`）——地方站首页混排全国稿，没省名的一律丢弃；④ `HTML_NAV`/`HTML_JUNK`/`HTML_NATIONAL`/`HTML_SERVICE`/`HTML_SNIPPET` 过滤导航、副刊、活动推广、中央宣传稿与服务入口；⑤ `dateFromHref` 从 URL 解析日期，解析不到用合成近时时间；⑥ `fetchAllSources` 用 `mapLimit(12)` 限并发，省级站慢且易风控。
- **归省与互斥**：`assignModule` 收到 `{ domesticSource, province }`，国内分对省级源额外 +4；`resolveProvince` 源级省优先、标题点名他省则以标题为准、`CENTRAL_DOC`（国务院/中共中央/部委开头）返回 `null` 记作全国。`clusterItems` 里跨省成员不合并，且“有省源 vs 无省源”的相似度门槛提到 0.6，避免地方稿被全国模板稿吸走。
- **省级稿过编审**：省级党报大量本地时政稿没有通用事件词，`hardNewsReason` 会判 `other`；`buildNews` 对 `other + 省级源 + 未命中 LOCAL_NOISE` 放行。`LOCAL_NOISE` 要覆盖文体/服务/招商/副刊/赛事/活动推广（含 半决赛/图册/会签/城市会客厅 之类），否则 34 省里会混进大量宣传稿。
- **政策文件聚类坑**：政策标题高度模板化（“XX人民政府办公厅关于印发《…》的通知”），按 token 相似度会把不同文件吸成一条，导致该省只剩一条甚至被裁掉；`isPolicyDocument` 命中的条目只有标题完全一致才允许合并。省级发文机关也要写进 `POLICY_ISSUER`，否则省级文件不会被识别成政策稿。
- **数字报头版（每省多条的主力）**：`sources.mjs` 的 `EPAPER_MEDIA` 配 `kind: "epaper"`，url 是带占位符的版面地址 `{YYYY}` `{YYYY-MM}` `{YYYYMM}` `{YYYYMMDD}` `{DD}`（注意占位符含连字符，替换正则是 `/\{[A-Z-]+\}/g`）。`fetchFeeds.mjs` 的 `fetchEpaper` 按北京时间生成今天→前两天三个地址依次取，前几天 404 只是休刊，最后一天仍失败才判源失败；拿到第一批稿件即返回。方正模板两代：新式 `{base}/pc/layout/{YYYYMM}/{DD}/node_01.html`，旧式 `{base}/html/{YYYY-MM}/{DD}/node_1.htm`；移动端地址（北京日报）把链接放在 `data-href`，锚文本正则要同时认 `href|data-href`。epaper 源固定 `strictLocal: false`（头版标题按报纸惯例不写省名，归属全靠源级 province）、`htmlLimit: 16`。
- **版面导航不是稿**：`HTML_NODE_LINK = /\/node_?\d+\.html?$/i` 要同时认 `node_01.html` 与 `node01.html`，否则“第07版：绿色低碳导刊”会当成新闻进列表。
- **编码坑**：数字报页面常把 UTF-8 错标成 GBK（北京日报），`decodeFeed` 必须先 `new TextDecoder("utf-8", { fatal: true })`，抛错再按站点声明回退 GBK；否则标题整批变成「绾康」式乱码。
- **跨省同题稿归全国**：各报头版都转载同一篇新华社稿，`clusterItems` 的跨省禁并规则对“标题逐字相同”放行（本地会议标题不会跨省全等），并在 scored 阶段用 `new Set(cluster.items.map(i => i.province)).size > 1` 判定 multiProvince → `province = null` 进全国栏，避免同一条新闻在 34 个省里各出现一次。
- **34 省配额（不可回退的约束）**：`modules.mjs` 的 domestic 配 `visible: 80, provinceMin: 4`；`pickVisible` 先取 top，再对每省按分数补到 `provinceMin` 条，补进来的名额从得分最低的非配额稿里扣。`composeModule` 里必须 `const list = clusters;`，**不能再 `clusters.slice(0, mod.visible)`**，否则刚补进来的低分稿会被二次截断，表现为“调试日志里 34 省都有稿，payload 却有一半省份 count 0”。配额取不到 4 条通常是该省可用簇不足：先用 `assignModule` 按条目统计供给，再决定加源还是放宽过编审。
- **中文去重坑**：标题去重 key 不能用 `/\W+/`，它会把汉字全部删掉导致所有中文标题变成同一个空 key；必须用 `title.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "")`。

## 扩展六：报刊板块（论文推送 + 科普通道，全免费）

与新闻模块完全不同的链路：`server/press/*`（`press.mjs` 编排 / `collectors.mjs` 索引采集 / `store.mjs` SQLite / `rank.mjs` 打分 / `channels.mjs` 科普通道），落 `data/press.sqlite3`，接口 `GET /api/press?interest=&refresh=1`，前端 `src/features/press/PressPage.tsx` 占 `tab === "papers"`（原 `PapersPage` 占位页要删干净，`noUnusedLocals` 会连未使用的图标 import 一起报错）。

- **只走索引，不爬站点**：Crossref / OpenAlex / DOAJ / Europe PMC / arXiv / ChinaXiv / OSF 预印本 / HAL 八个开放索引全部免登录免 key，这是「不接任何付费服务」的前提。知网既不开放也无个性化接口，只作为原文链接跳板，不抓取。社科补充源实测供给：OSF 五平台 94 条/轮（SocArXiv·PsyArXiv·EduArXiv·MediaXiv·MetaArXiv，要跳过 `date_withdrawn` 与 `is_latest_version===false`）、HAL 六个法语主题 59 条/轮（`api.archives-ouvertes.fr`，Solr 语法 `q=text:<词>&fq=docType_s:ART AND producedDate_tdate:[起 TO NOW]`，必须显式 `fl=`，猜的 `halDomain_s`/`domain_s` 一律 `numFound:0`）。中文核心社科刊拿不到：Crossref 不载，《政治学研究》《新闻与传播研究》在 OpenAlex 只到 2020 年，只能做「知网跳转」。
- **礼貌额度写进代码**：Crossref UA 必须带 `mailto:`；arXiv 每次请求间隔 ≥2.2s；OpenAlex 每轮构建 ≤8 次查询、超了就静默跳过（`note: "8 次查询 · 共享额度"`）。采集器**跨 host 并行、单 host 自限速**——分三批 `Promise.allSettled`（Crossref刊/OpenAlex/DOAJ → 主题检索/EPMC/arXiv/ChinaXiv → OSF/HAL），同 host 串行放一起会被限流。
- **请求路径绝不等采集**：一轮全量采集在这台机器上实测 320–340s（名录 89 本 tier≤2 逐刊取稿），挂在 `GET /api/press?refresh=1` 上就是「点了刷新五分钟没反应」。改成 `scheduleHarvest()`：`state.harvestTask` 全局单飞（多兴趣并发只跑一轮），库里有存量时 `compose` 直接读库返回、`meta.harvest.updating: true`，采集结束后 `state.payloads.clear()` 让下一次轮询自然拿到新数据；只有空库才 `await` 第一轮。刷新因此从 >300s 降到 0.3–18s。
- **新刊 ISSN 分批补**：名录扩充后未解析的刊名一次最多补 20 本（`ISSN_RESOLVE_PER_RUN`）并用 `pool(…, 4)` 并行；串行逐本解析会让那一轮刷新多花好几分钟，剩下的下轮自动接上（`note: "81/89 刊已解析 ISSN · 8 本下轮补"`）。
- **超时要罩住正文**：`AbortController` 在 `fetch()` 返回时就 clear 掉等于只限响应头，索引「连着但拖着不发完」会把整轮采集钉死。`readText(res, 15000)` 用 `Promise.race` + `res.body.cancel()` 兜住；另外 Crossref 单请求在这台主机实测 10–36s，默认 20s 超时会把成功请求误判成失败（失败数从 2 跳到 11），Crossref 调用统一传 `{ timeoutMs: 45000 }`。
- **采集状态必须落库**：`works` 之外建 `meta(key,value)` 表存 `harvested_at`/`harvest_ms`/`harvest_statuses`，`scheduleHarvest()` 先 `restoreState()`。否则每次重启都重打一遍全量索引，前端表现为一重启就转圈半分钟。
- **裁剪 SQL 的空日期坑**：`DELETE FROM works WHERE published < ?` 里 `published=''` 比任何 ISO 串都小，会把没给日期的 RSS/合集稿全删掉——症状是「通道日志明明取到 10 篇，payload `articles` 恒为 0」。必须 `WHERE published <> '' AND published < ?`。
- **RSS 自动发现别只信声明**：站点 `<link rel=alternate>` 可能是残缺历史源（Quanta 声明的 `/quanta/feed/` 只有 1 条 2013 年稿）。`discoverFeed` 把声明地址与 `FEED_CANDIDATES` 标准路径一起探，按 `条数 + 新鲜度加权` 择优；RSS 的 `pubDate` 是 RFC-822，正则抓 ISO 失败要回退 `new Date()` 再 `toISOString().slice(0,10)`。
- **微信公众号**：单篇 `/s/` 文章免登录可解析（标题、`js_name` 号名、`publish_time`、`digest`）；账号级文章列表被加密 `ticket` 挡住，抓不到。可持续更新的只有 `appmsgalbum` 合集页。合集解析**按 `data-link` 切段**（`html.split(/data-link\s*=\s*["']/i).slice(1)`，段内第一个长文本是标题、第一个日期是发布时间），不要用 `[\s\S]{0,400}?</(?:div|a|li)>`——非贪婪会停在第一个 `</div>`，标题拿得到但 `publish_time` 落在窗口外，日期全空。
- **版权红线**：库里只存标题、摘要、原文链接（`works` 无正文字段），卡片脚注固定写「阅界只保存标题与摘要，全文回到原刊阅读」。
- **兴趣筛选是硬过滤不是加分**：`matchesInterest(row, interest)` 先看 `interest`/`field` 归属，归属缺失才用词表兜底，只做 +5 加分的结果是「人工智能」标签下全是量子物理论文。兜底必须**按整短语相邻命中**（`termOverlap`：多词术语归一化后 `includes(phrase)`，单词术语才比 token 集合），阈值 ≥2；按单个词计数（旧 ≥3）会让化学生期刊因为摘要里有 `human`、`law` 就挤进「法学与治理」，实测 517 条检索稿里 411 条是误标。
- **索引给的兴趣标签不能盲信**：`harvestCrossrefSearch` 的 `query.bibliographic` 是模糊匹配，过去无条件把查询所用的 `interest.id` 盖在结果上（`field: interest.id` 还会越过名录的 `cls.field`）。改为结果先按刊名归类，再用 `mentionsTerm(title+abstract, term)` 复核命中才盖章；DOAJ/HAL/OSF 的分类标签来自学科字段，可保留。
- **`UPSERT` 的 `ON CONFLICT` 要列出会变的分类列**：原来只更新 abstract/title/journal/tier/cited/published，`field`/`interest` 一旦写错就永远改不掉——修复采集器后重抓也不生效。补 `field = COALESCE(works.field, excluded.field)`、`interest = COALESCE(works.interest, excluded.interest)`；历史误标要单独跑一次清理 `UPDATE works SET field=NULL, interest=NULL WHERE source='crossref-search' …`，否则验收看到的还是旧标签。
- **可解释性**：每条 `reasons` 由权威档（`AUTHORITY_POINTS {1:12, 2:8.5, 3:5.5}`）、新鲜度 `exp(-age/7)*10`、被引速度、OA、兴趣词、本地行为画像（保存 1.6 / 阅读 1 / 屏蔽 −1.5，走 `tokenize`）拼成中文短语直接渲染；`title` 的 token 用 `WeakMap` 记忆化，1600 行 × 10 兴趣不记忆化会明显卡。
- **稀疏时要有兜底级联**：`rankRising` 按 `cited≥8→3→1`、`days≤120` 逐级降门槛，选了兴趣仍 `<6` 条就回落到不带兴趣的全池；`rankArticles` 匹配数不足 `min(6,limit)` 时同样回落。科普栏每源上限按**在场源数**分配：`perJournal = Math.max(3, Math.ceil(limit / sources))`——固定 `Math.max(5, limit/2)` 时行为画像会把读过的两三家顶满 16 条，新加的杂志一条都进不来；固定 4 又会让整栏凑不满配额。
- **翻译分三层，别让请求等摘要**：① 首屏只 `await` 标题批次（`TRANSLATE_BUDGET_MS` 超时先出英文原标题）；② 摘要批次纯后台，落库后 `state.payloads.clear()`；③ `warmTranslations()` 按 `CASE tier WHEN 0 THEN 9 ELSE tier END, cited DESC, published DESC` 每次预译 100 条、4 分钟冷却。没有 ③ 的话，切一个新兴趣就要现译 24 条标题，实测卡满 18s 预算且首屏仍全英文（免费链路约 2.4s/条）。
- **payload 缓存按兴趣分 key**：`state.payloads` 是 `Map<interest, {payload, at}>`（8 分钟），同 key 的并发构建用 `state.pending` 去重；写信号、加退订通道都要 `state.payloads.clear()`。后台补译的 `clear()` 可能早于本次 `compose` 写缓存，导致这一份带旧译文——靠 `meta.translation.pending` 时前端 45s 自动刷新兜住，不是 bug 但别去掉那个自动刷新。

## 扩展七：手机端 APK（Capacitor 壳，零付费自签自分发）

数据层（Express + `node:sqlite` + `.env` 里的中转 token）不可能塞进 APK，所以 APK 只是壳：页面资源打进 `assets/public`，接口走局域网。**任何需要登录/密钥的东西都留在电脑上**，包里一个字节都不能有。

- **工具链放哪**：这台机器 C 盘 99% 满（仅剩 2.2G），SDK 与 Gradle 缓存必须放 D 盘——`D:\Android\Sdk`（429M）、`D:\gradle-home`（1G）。`android/local.properties` 写 `sdk.dir=D\:\\Android\\Sdk`，构建时 `GRADLE_USER_HOME=D:/gradle-home`。
- **Capacitor 7 要 JDK 21**：用系统里的 JDK 17 会在 `:capacitor-android:compileReleaseJavaWithJavac` 报「无效源发行版：21」。`https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip` 免登录，解压即用。
- **两个 Windows 坑**：`commandlinetools-win-*.zip` 只能用 `C:/Windows/System32/tar.exe`（bsdtar）解，Git Bash 的 GNU tar 会 `This does not look like a tar archive`；`sdkmanager.bat` 经 `cmd.exe //c` 传参时包名**不能带转义引号**，`\"platform-tools\"` 会变成找不到包，直接写裸包名。
- **接口基址三层**：`localStorage.yuejie.apiBase` >（仅 `Capacitor.isNativePlatform()` 时）构建期 `VITE_API_BASE` > 空串同源。所有请求必须走 `src/lib/api.ts` 里的 `apiUrl()`，`imageUrl()` 也要——`/api/img` 漏掉的话壳里图片全 404。`.env.production.local` 存预填 IP，别写进 `.env`（那是服务端密钥文件）。
- **`androidScheme: "http"` 是硬要求**：默认的 https scheme 会把局域网 http 接口当混合内容直接拦掉，表现是「壳起来了但整页空」。
- **服务端 CORS 只认本机源**：`shellOrigin()` 放行 hostname 为 `localhost`/`127.0.0.1` 的 Origin，其余不给头；`OPTIONS` 一律 204。公网页面拿不到这套接口。
- **首启与掉线都要有落点**：`App.tsx` 在壳里且未配置基址时渲染 `ConnectionPanel` gate；已配置则挂载时 `probeApi()` 探一次，探不通（换网络、DHCP 改了 IP）也回 gate。保存成功后 `window.location.reload()`，因为各页数据是挂载时拉的。
- **签名**：`android/keystore.properties` + `android/keystore/*.keystore` 已进 `android/.gitignore`；`build.gradle` 缺这两个文件时 release **保持未签名**，绝不退回 debug key。
- **出包**：`npm run apk` = `build` → `cap sync android` → `gradlew.bat assembleRelease` → 复制成 `dist/yuejie.apk`。脚本里 `cd android` 之后必须 `cd ..` 再复制，否则路径变成 `android/android/app/build/...`。产物 3.1MB，Express 静态目录直接以 `application/vnd.android.package-archive` 提供，手机浏览器开 `http://<电脑IP>:8787/yuejie.apk` 就能下载并安装——这是零付费前提下的分发路径（上架 Google Play 要 $25，不做）。
- **包体自检**：`aapt2 dump badging`（应只有 `INTERNET` 与 androidx 自动加的 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`、`targetSdkVersion 35`、label 阅界）+ `apksigner verify --print-certs`（`Verifies` 且 DN 是自己的）。
- **仍然存在的两道边界，如实告诉用户**：① 侧载 APK 必然弹「未知来源/非商店应用」，这是系统对未上架包的固定行为；能做的只是不触发恶意特征（release 签名、targetSdk 35、无危险权限、`allowBackup=false`、`webContentsDebuggingEnabled=false`、不加载远端代码），**不做任何绕过**。② 手机能不能连上取决于 Windows 防火墙：本机 WLAN 被归为 Public 且 `node.exe` 没有任何入站放行规则，默认会拦 8787——需要用户以管理员加一条 `New-NetFirewallRule`（或把该网络改成 Private），这一步属于系统级改动，不能替他静默执行。

## 扩展八：公网静态快照（手机在外面也能看，零付费）

「一定要电脑开着」的唯一零成本解法：把已经生成的成品数据导出成静态文件发到 Cloudflare Pages（免费，`*.pages.dev` 不用备案）。电脑只负责生成，访问不经过它。

- **导出**：`node scripts/export-site.mjs` 从 `EXPORT_BASE`（默认 `http://127.0.0.1:8787`）拉 `/api/news?module=` × 5、`/api/press` + 十个兴趣各一份、`/api/markets` 与八个指数的成分股，写成 `site/data/*.json`。文件名规则必须和前端映射一致：`news-<module>` / `press` / `press-<interest>` / `markets` / `movers-<indexId>` / `meta`。
- **接口名→文件名的映射只写在 `src/lib/api.ts`**：`isStaticSite = import.meta.env.VITE_SITE_DATA === "1"`，`staticPath()` 负责改名，查询参数只用来选文件、不进 URL。写操作（`/api/translate`、`/api/push/commit`、`/api/press/channel|signal`）在 `apiUrl()` 里直接抛「快照版不支持」，各调用点本来就有 `try/catch` + toast，所以不用改 UI 逻辑；`translateSnippet()` 例外——它在 `ArticleSheet` 的 effect 里被**同步**调用，必须提前 `return { text }`，否则抛错会打断 effect。
- **图片必须搬进站内**：`/api/img` 代理只在后端存在，静态站上没这东西。导出时把每个 `image` 字段经 `/api/img` 下载→ `scripts/shrink-images.py`（Pillow，720 宽 webp q70）压完写进 `site/img/<sha1_16>.webp`，再把 JSON 里的字段改成本站路径。不压就是 71 张 15MB，手机流量直接劝退；压完 62 个文件 1.7MB。取不到的留原链（少数外媒防盗链/超时）。
- **发布**：`npm run site`（`vite build --mode site --outDir site` + 导出）→ `npm run site:publish`（内含 `npx wrangler pages deploy site --project-name yuejie-site`）。`.env.site` 只有 `VITE_SITE_DATA=1`，要提交（不是密钥）。`site/_redirects` 写 `/*  /index.html  200`，否则 `/papers` 深链 404。wrangler 装到 D 盘：`npm_config_cache=D:/npm-cache npm i -g --prefix D:/npm-global wrangler`，调用用 `node D:/npm-global/node_modules/wrangler/bin/wrangler.js …`（`.cmd` 经 Git Bash 引号会碎）；C 盘只剩 2G，别 `npx` 直接装。
- **脱敏是默认，不是选项**：静态文件一旦上线就是公开可下载的。导出剥掉 `channels`、`saved/viewed`、`meta.profile`、`meta.counts.saved/viewed`、新闻 `meta.translation`（中转配额痕迹），`meta.translation.pending` 强制 false（不然前端挂 45s 轮询）。`--personal` 才保留，仅用于自己看。
- **发布前必扫**：拿 `.env` 里的每个值、局域网 IP、账号邮箱、`mp.weixin.qq.com`、`"channels":[` 非空、`"saved":true` 去 grep 整个 `site/`，命中必须为 0。
- **两个只有这条路才会踩的坑**：① 后端整轮源失败时会把 5 个模块覆盖成空列表（2026-11-14 实际发生：`0/134 源在线`、`all.length 0`），所以 `buildNewsInBackground()` 现在对 `all.length === 0` 的新轮结果**沿用上一轮**并打 `[news] 本轮零稿件，沿用上一轮`；导出脚本同时有硬闸：模块零稿件直接抛错，不发布空快照。② 行情把上游失败包在 `HTTP 200 + ok:false` 里返回，`fetchOk()` 要重试并拒收 `ok:false`，否则快照里全是空涨跌榜。

## 验证清单

按顺序执行，任何一项失败都不得宣称完成：

1. `npm run build` 通过（tsc + vite）。
2. 五个模块（world/domestic/economy/science/military）都能返回 `hero`（空模块允许 hero 为 null，但要有合理空态）。
3. **互斥检查**：拉取五个 `?module=` 响应，比较 `all[].id` 与 `all[].link`，交集必须为空。
4. **人物栏检查**：`world.people.length >= 0`，`domestic/economy/science/military.people.length === 0`。
5. **红线检查**：抽查各模块标题，不得出现娱乐/生活方式/治安犯罪/观点专栏；国内额外检查无「展览/文物/逐梦/购物潮/创业故事」类宣传稿。
6. 浏览器逐个点击五个 chip：切换无重复请求风暴、骨架屏正常、控制台无报错（图片 502 可容忍，但正文不得空白）。
7. 刷新一次，确认五个模块仍互斥且 `meta.generatedAt` 一致。
8. **行情**：`GET /api/markets` 返回 `ok: true` 与 8 个指数；经贸页 60 秒后时间与数值有变化。
9. **成分股**：`GET /api/markets/sh`、`hsi`、`ixic` 均返回 `gainers/losers` 各 5 条且价格非空；前端点击卡片展开涨跌榜、再次点击收起，未知 id 返回 404。
10. **科研**：一级 tab 理论研究/应用前沿/综合研究可切换；理论研究下二级 chip 为物理/化学/生物/计算机，应用前沿下为工业/能源/航天/电子/医疗；抽查无 ETF/基金/融资稿。
11. **军事**：`situation.zones` 只含真实战区，`reportsTotal` 与战报栏条数一致；地图 pin 均有定位且标签不重叠，无战区名误标（气候/房产/签证/司法稿不得进战报）；焦点前两条优先是装备/演习/国防部发布；`movements` 非空时前端出现「社会运动」栏且不与 hero/焦点重复。
12. **国内**：`documents.length > 0` 且政策文件不出现在 hero/spotlight/ranking；`provinces.length === 34` **且 34 项 count 全部 ≥ 1、绝大多数 ≥ `provinceMin`**（达不到先看该省簇数与 assignModule 流向，别急着加源）；点开几个高数量省份（陕西/北京）确认列表过滤正常、同一条中央稿不跨省重复；页面不渲染人物栏。
13. **翻译**：五个模块 `all[].title` 中不得出现整句英文/法文/日文标题；`/api/health` 的 `translation.googleBlocked` 应为 false，`provider` 以 google 为主。
14. **源站**：`meta.sources` 中新加的财经/科研/军事/国内/左翼源 `ok: true`；连续失败的源删除，不要留在面板凑数。
15. **报刊索引**：`/api/press` 的 `meta.indexers` 九路全 `ok: true` 且 `count > 0`（含 `osf`、`hal`）；`meta.counts.papers` 上千、`articles` 非零（articles 为 0 先查裁剪 SQL 与 `discoverFeed` 选出的 feed 是否残缺）。
16. **报刊刷新不阻塞**：`GET /api/press?refresh=1` 必须在 20s 内返回且 `meta.harvest.updating: true`、`skipped: false`；等它跑完整轮采集（`meta.harvest.ms` 300s 级）是回归。重启后第一次请求允许 `stored: 0`，采集结果在下一轮请求里出现。
17. **报刊兴趣互斥**：十个 chip 逐个拉 `?interest=`，`meta.interests` 每项 `count ≥ 50`（社科新栏下限：social/law/mind/humanity），`papers[].journal` 要分别是经济学期刊、法学期刊、教育/心理期刊、人类学/历史期刊——出现 AIChE/Advanced Materials 之类串栏，就是词表又在按单词兜底。
18. **报刊翻译不阻塞**：新进程第一次切到冷门兴趣允许 `meta.translation.pending: true`、`queued` 非零且部分标题暂为英文，45s 内 `titleZh` 覆盖率应到 90% 以上；剩下的通常是印尼语/波兰语稿（索引把 `lang` 标成 `en`，翻译链路按英语走）。`/api/press` 重复请求应 <50ms。
19. **报刊个性化**：浏览器里对同主题连点 3 次收藏/屏蔽，`.press-profile` 的「高频词」随之变化、被屏蔽条目从列表消失，且刷新后状态仍在（SQLite 落库）。
20. **APK 静态自检**：`aapt2 dump badging dist/yuejie.apk` 权限只有 INTERNET（+ androidx 自带的 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`）、`targetSdkVersion 35`、`application-label:'阅界'`；`apksigner verify --print-certs` 输出 `Verifies` 且证书 DN 不是 Android debug key；解包 grep `.env` 里的每个值，命中必须为 0。
21. **壳内跨源链路（无真机时的等价验证）**：`npx vite preview --port 4173` 起另一张页面，浏览器里 `localStorage.setItem('yuejie.apiBase','http://127.0.0.1:8787')` 后刷新——新闻 `.feed-row`、报刊 `.press-item` 都要出数、`img.naturalWidth > 0`、控制台零报错；再用 `curl -H "Origin: https://evil.example"` 确认响应里没有 `access-control-allow-origin`。
22. **APK 可下载**：`curl -I http://127.0.0.1:8787/yuejie.apk` 返回 200 且 `Content-Type: application/vnd.android.package-archive`。
23. **静态模式真的没有后端**：`npx vite preview --outDir site --port 4174` 后浏览器打开，`performance.getEntriesByType('resource')` 里**不允许出现 `/api/`**，且 `data/*.json` 至少覆盖 `news-world`、`press-law`、`movers-sh`（要真的点一次兴趣 chip 和一次指数卡片）。注意 `vite preview` 会沿用 `server.proxy`，直接 `curl http://localhost:4174/api/news` 照样返 200——**不能用 curl 判模式，只能看页面实际请求**。
24. **公网快照**：`curl` 首页 `/`、`/data/news-world.json`、`/papers`（深链须 200，证明 `_redirects` 生效）、随机一张 `/img/*.webp`（`content-type: image/webp`）；浏览器里再确认一张图 `naturalWidth > 0`（懒加载，不滚动就不会请求，别把 `complete:false` 当成失败）。
25. **快照不留个人痕迹**：发布前扫描脚本输出的 `SCAN: 未发现凭据/本机标识`，且 `channels` 为空、`"saved":true` 计数为 0。
26. **宽屏边框**：窗口 ≥720px 打开时量 `getBoundingClientRect().width`——`#root` 应等于视口宽、`.app-shell` 应正好 430；再逐个 tab 确认 `shell.scrollWidth - shell.clientWidth === 0`（`.module-chips` 这类横向滚动条自身超宽是正常的）。

## 反模式

- 为每个模块单独抓取、单独聚类 → 必然重复，且源站压力翻倍。
- 用 `if (title.includes("经济"))` 之类单关键词分流 → 误判率高，必须用多概念计数。
- 把 crime/soft 词表复制进模块词表 → 污染专业模块。
- 专业模块也渲染人物栏或进入推送池 → 违反产品规则。
- 为了提高某模块数量而降低阈值到 1 → 国际会被掏空、模块间互相抢稿。
- 改了模块 id 只在后端改、前端不同步 → chip 请求 404。
- 改了 `server/*.mjs` 却只发 `?refresh=1` → Node 的 ESM 不热更新，进程里仍是旧 `MODULES`/`pickVisible`，表现为“配额明明调高了，payload 条数没变”。必须 `netstat -ano | grep :8787` 找 PID、`taskkill //PID <pid> //F` 后重启再验证；判断依据是 `all.length` 是否恰好等于旧 `visible` 加上旧配额补位。
- 把整轮采集 `await` 在 HTTP 请求里 → 名录一扩充（社科加到 89 本逐刊取稿）刷新就变成 5 分钟无响应。采集是写库的后台任务，读路径只读库；`meta.harvest.updating` 负责告诉前端「还在补」。
- 用索引的关键词检索结果直接当学科归属 → Crossref 模糊匹配会把「human-in-the-loop」的化工稿标成法学论文；盖兴趣章前要在标题+摘要里复核整短语。
- 扩充兴趣栏却只加刊名不分栏 → 「社会与政治」一个 chip 吞掉社会学/政治学/传播学，法学和心理根本挤不进来；`INTERESTS` 拆到十个、`FIELD_LABELS` 与 `ALIASES`（`&`↔`and`、带 `the` 的刊名变体）要同步补，否则 Crossref 刊名写法不一致时名录命中不了。
- 把 APK 当成「装到手机上的网站」用 `server.url` 指向远端页面 → 页面代码从此由远端控制，且首屏依赖网络；正确做法是资源打进包内、只有 `/api` 出网。
- 桌面边框只约束 `.app-shell` 的 `max-width`、不给 `#root` 宽度 → ≥720px 时 `body` 变 flex，`#root` 作为 flex 子项按内容收缩，而 `.screens` 里的稿件全是绝对定位（不贡献内在宽度），整站塌成一条百来像素的窄柱、标题一字一行。`#root { width: 100% }` 才是对的，且只能用实测宽度发现，控制台不会报错。
- 为「手机装上不弹警告」去做签名伪造、降级 targetSdk、隐藏权限或绕过 Play Protect → 不做。侧载一定会有「未知来源」提示，只能靠正规手段把风险特征降下来。
- 让手机去扫局域网端口找后端 → 端口扫描本身就是国产 ROM 风控的典型触发项，且需要额外权限；改成用户填地址 + 预填默认值。
- 缺 keystore 时让 release 退回 debug 签名 → 打出来的包照样能装，但签名是公开的 Android 调试密钥，等于任何人能覆盖安装，与「无风控」正好相反。
- 静态快照里塞 `/api/img` 相对路径或原图直链 → 前者必然 404，后者让外媒 CDN 决定页面能不能看；图片要下载+压缩后变成站内文件。
- 把 `site/` 当作 `dist/` 复用同一个 outDir → `vite build --emptyOutDir` 会把刚导出的 `data/img` 删掉；`site` 单独一份，顺序固定「build → export」。
- 用 `curl 静态站/api/...` 通不通来判断静态模式 → preview 的代理会替你答成功，得出「静态版还活着」的假结论。
- 快照版带着 `channels`/`saved`/`profile` 上线 → 公开文件里等于贴出个人订阅清单与阅读画像。
