import { fetchAllSources } from "./fetchFeeds.mjs";
import { translateBatch } from "./translate.mjs";
import { containment, hashKey, jaccard, tokenize } from "./text.mjs";
import { SOURCE_MAP } from "./sources.mjs";
import { analyzeStory, hardNewsReason } from "./editorial.mjs";
import { extractPeople } from "./people.mjs";
import { filterPushCandidates } from "./pushLedger.mjs";
import { MODULES, assignModule, isMovementStory } from "./modules.mjs";
import { ZONES, PROVINCES, PROVINCE_ORDER, classifyScience, detectProvince, detectZone, isPolicyDocument } from "./taxonomy.mjs";

const BRIDGE_ENTITIES = [
  ["United States", "美国"], ["U.S.", "美国"], ["US", "美国"], ["America", "美国"],
  ["Trump", "特朗普"], ["Biden", "拜登"], ["Harris", "哈里斯"], ["Pentagon", "五角大楼"],
  ["White House", "白宫"], ["Washington", "华盛顿"], ["New York", "纽约"],
  ["Putin", "普京"], ["Zelensky", "泽连斯基"], ["Kremlin", "克里姆林宫"],
  ["Ukraine", "乌克兰"], ["Russia", "俄罗斯"], ["Moscow", "莫斯科"], ["Kyiv", "基辅"],
  ["Gaza", "加沙"], ["Israel", "以色列"], ["Hamas", "哈马斯"], ["Hezbollah", "真主党"],
  ["Lebanon", "黎巴嫩"], ["Beirut", "贝鲁特"], ["Iran", "伊朗"], ["Tehran", "德黑兰"],
  ["Syria", "叙利亚"], ["Iraq", "伊拉克"], ["Yemen", "也门"], ["Houthi", "胡塞"],
  ["Saudi", "沙特"], ["Qatar", "卡塔尔"], ["Egypt", "埃及"], ["Turkey", "土耳其"],
  ["Palestinian", "巴勒斯坦"], ["West Bank", "约旦河西岸"], ["Jerusalem", "耶路撒冷"],
  ["Middle East", "中东"], ["Afghanistan", "阿富汗"], ["Pakistan", "巴基斯坦"],
  ["China", "中国"], ["Beijing", "北京"], ["Xi Jinping", "习近平"], ["Taiwan", "台湾"],
  ["Hong Kong", "香港"], ["Japan", "日本"], ["Tokyo", "东京"], ["South Korea", "韩国"],
  ["North Korea", "朝鲜"], ["Seoul", "首尔"], ["Pyongyang", "平壤"],
  ["India", "印度"], ["New Delhi", "新德里"], ["Philippines", "菲律宾"], ["Manila", "马尼拉"],
  ["Vietnam", "越南"], ["Thailand", "泰国"], ["Indonesia", "印度尼西亚"],
  ["Malaysia", "马来西亚"], ["Singapore", "新加坡"], ["Myanmar", "缅甸"],
  ["Europe", "欧洲"], ["European Union", "欧盟"], ["EU", "欧盟"], ["NATO", "北约"],
  ["Germany", "德国"], ["France", "法国"], ["Macron", "马克龙"], ["Britain", "英国"],
  ["UK", "英国"], ["United Kingdom", "英国"], ["London", "伦敦"], ["Paris", "巴黎"],
  ["Italy", "意大利"], ["Spain", "西班牙"], ["Poland", "波兰"], ["Hungary", "匈牙利"],
  ["Greece", "希腊"], ["Brussels", "布鲁塞尔"], ["Switzerland", "瑞士"],
  ["Canada", "加拿大"], ["Mexico", "墨西哥"], ["Brazil", "巴西"], ["Argentina", "阿根廷"],
  ["Venezuela", "委内瑞拉"], ["Colombia", "哥伦比亚"], ["Haiti", "海地"],
  ["Chile", "智利"], ["Peru", "秘鲁"], ["Cuba", "古巴"], ["Latin America", "拉美"],
  ["Sudan", "苏丹"], ["Ethiopia", "埃塞俄比亚"], ["Nigeria", "尼日利亚"],
  ["South Africa", "南非"], ["Congo", "刚果"], ["Somalia", "索马里"], ["Kenya", "肯尼亚"],
  ["Africa", "非洲"], ["Uganda", "乌干达"], ["Mali", "马里"], ["Libya", "利比亚"],
  ["United Nations", "联合国"], ["UN", "联合国"], ["Security Council", "安理会"],
  ["COP31", "气候大会"], ["COP30", "气候大会"], ["G20", "二十国集团"],
  ["ceasefire", "停火"], ["peace talks", "和谈"], ["sanctions", "制裁"],
  ["tariff", "关税"], ["tariffs", "关税"], ["inflation", "通胀"],
  ["election", "选举"], ["nuclear", "核"], ["missile", "导弹"],
  ["refugee", "难民"], ["refugees", "难民"], ["earthquake", "地震"],
  ["flood", "洪水"], ["protest", "抗议"], ["protesters", "抗议"],
  ["climate", "气候"], ["summit", "峰会"], ["oil", "石油"], ["energy", "能源"],
  ["AI", "人工智能"], ["chip", "芯片"], ["chips", "芯片"],
  ["Ucrania", "乌克兰"], ["Rusia", "俄罗斯"], ["Brasil", "巴西"],
  ["Francia", "法国"], ["Alemania", "德国"], ["Corea", "韩国"],
  ["Filipinas", "菲律宾"], ["Siria", "叙利亚"], ["Irak", "伊拉克"],
  ["Egipto", "埃及"], ["Estados Unidos", "美国"], ["América Latina", "拉美"],
  ["Russie", "俄罗斯"], ["Chine", "中国"], ["Japon", "日本"],
];

const ENTITY_PATTERNS = BRIDGE_ENTITIES.flatMap(([en, zh]) => {
  const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = /^[A-Za-z]/.test(en) ? `\\b${escaped}\\b` : escaped;
  return [{ regex: new RegExp(boundary, "i"), en: en.toLowerCase(), zh }];
});

const EN_TO_ZH = new Map(BRIDGE_ENTITIES.map(([en, zh]) => [en.toLowerCase(), zh]));
const ZH_NAMES = [...new Set(BRIDGE_ENTITIES.map(([, zh]) => zh))].sort((a, b) => b.length - a.length);

function bridgeTokens(text) {
  const bridges = new Set();
  for (const { regex, en, zh } of ENTITY_PATTERNS) {
    if (regex.test(text)) {
      bridges.add(`b:${zh}`);
      bridges.add(`b:${en}`);
    }
  }
  for (const zh of ZH_NAMES) {
    if (text.includes(zh)) {
      bridges.add(`b:${zh}`);
      const en = [...EN_TO_ZH.entries()].find(([, value]) => value === zh)?.[0];
      if (en) bridges.add(`b:${en}`);
    }
  }
  return bridges;
}

const HOT_ZH = [
  "死亡", "遇难", "袭击", "爆炸", "冲突", "战争", "停火", "和谈", "选举", "总统",
  "总理", "制裁", "关税", "通胀", "经济", "危机", "峰会", "气候", "地震", "洪水",
  "罢工", "抗议", "逮捕", "判刑", "辞职", "坠机", "火灾", "疫情", "谈判", "协议",
  "核", "军演", "导弹", "无人机", "难民", "援助", "预算", "法案", "裁决", "禁令",
];

const HOT_EN = [
  "killed", "dead", "death", "attack", "strike", "explosion", "blast", "war",
  "ceasefire", "talks", "election", "president", "minister", "sanctions", "tariff",
  "inflation", "crisis", "summit", "climate", "earthquake", "flood", "protest",
  "arrest", "sentenced", "resign", "crash", "fire", "outbreak", "nuclear",
  "missile", "drone", "refugee", "aid", "deal", "agreement", "court", "ruling",
  "ban", "warning", "surge", "collapse",
];

const REGION_RULES = [
  {
    id: "mideast",
    label: "中东",
    words: ["中东", "加沙", "以色列", "伊朗", "黎巴嫩", "叙利亚", "伊拉克", "也门", "沙特", "哈马斯", "真主党", "巴勒斯坦", "胡塞", "约旦", "土耳其", "阿布扎比", "多哈", "Gaza", "Israel", "Iran", "Lebanon", "Syria", "Iraq", "Yemen", "Hamas", "Hezbollah", "Saudi", "Palestinian", "Middle East", "Jerusalem", "Abu Dhabi", "Doha", "Turkey", "Oriente Medio", "Líbano", "Siria", "Irak", "Turquía", "Moyen-Orient", "Liban", "Syrie", "Turquie"],
  },
  {
    id: "europe",
    label: "欧洲",
    words: ["欧洲", "欧盟", "乌克兰", "俄罗斯", "英国", "法国", "德国", "意大利", "西班牙", "波兰", "北约", "普京", "泽连斯基", "Ukraine", "Russia", "Europe", "EU", "NATO", "Britain", "France", "Germany", "Italy", "Poland", "Putin", "Zelensky", "London", "Paris", "Brussels", "Ucrania", "Rusia", "Francia", "Alemania", "Unión Europea", "OTAN", "Moscú", "Russie", "Allemagne", "Union européenne", "Moscou"],
  },
  {
    id: "asia",
    label: "亚太",
    words: ["中国", "日本", "韩国", "朝鲜", "印度", "巴基斯坦", "东南亚", "菲律宾", "越南", "泰国", "印尼", "台湾", "香港", "北京", "China", "Japan", "Korea", "India", "Pakistan", "Philippines", "Vietnam", "Thailand", "Indonesia", "Taiwan", "Beijing", "Seoul", "Tokyo", "Asia", "Japón", "Corea", "Filipinas", "Chine", "Japon", "Corée", "Philippines", "Inde"],
  },
  {
    id: "americas",
    label: "美洲",
    words: ["美国", "加拿大", "墨西哥", "巴西", "阿根廷", "委内瑞拉", "哥伦比亚", "海地", "智利", "秘鲁", "US", "United States", "America", "Canada", "Mexico", "Brazil", "Argentina", "Venezuela", "Colombia", "Haiti", "Chile", "Peru", "Trump", "Biden", "Washington", "New York", "Estados Unidos", "Brasil", "México", "América Latina", "États-Unis", "Brésil", "Mexique", "Amérique latine"],
  },
  {
    id: "africa",
    label: "非洲",
    words: ["非洲", "苏丹", "埃塞俄比亚", "尼日利亚", "南非", "刚果", "索马里", "埃及", "肯尼亚", "Africa", "Sudan", "Ethiopia", "Nigeria", "South Africa", "Congo", "Somalia", "Egypt", "Kenya"],
  },
];

const HOUR = 60 * 60 * 1000;
const GENERIC_BRIDGES = new Set(["全球", "世界", "国际", "气候", "峰会"]);

function eventKeyFor(rep) {
  const entities = [
    ...new Set(
      [...rep.bridges]
        .map((token) => token.slice(2))
        .filter((token) => /[\p{Script=Han}]/u.test(token) && !GENERIC_BRIDGES.has(token)),
    ),
  ].sort();
  const numbers = [...rep.numbers].sort();
  if (entities.length >= 2) {
    return `${entities.slice(0, 5).join("+")}|${numbers.slice(0, 3).join(",")}`;
  }
  const normalized = rep.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  return `h:${hashKey(normalized)}`;
}

function hotHits(title) {
  let hits = 0;
  for (const word of HOT_ZH) if (title.includes(word)) hits += 1;
  const lower = title.toLowerCase();
  for (const word of HOT_EN) if (lower.includes(word)) hits += 1;
  return hits;
}

const GLOBAL_SIGNAL = /COP\d{2}|气候大会|联合国|UN chief|G20|G7|全球|世界|International|World/i;

function regionWordHits(text, word) {
  if (!text) return false;
  if (/^[A-Za-z]/.test(word)) {
    return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  }
  return text.includes(word);
}

function classifyRegion(repTitle, otherTitles) {
  const repHasRegion = REGION_RULES.some((rule) =>
    rule.words.some((word) => regionWordHits(repTitle, word)),
  );
  if (!repHasRegion && GLOBAL_SIGNAL.test(repTitle)) {
    return { id: "global", label: "全球" };
  }

  let best = { id: "global", label: "全球", count: 0 };
  for (const rule of REGION_RULES) {
    let count = 0;
    for (const word of rule.words) {
      if (regionWordHits(repTitle, word)) count += 3;
      for (const title of otherTitles) if (regionWordHits(title, word)) count += 1;
    }
    if (count > best.count) best = { id: rule.id, label: rule.label, count };
  }
  return best.id === "global" ? { id: "global", label: "全球" } : { id: best.id, label: best.label };
}

function prepare(item) {
  const tokens = tokenize(item.title);
  const bridges = bridgeTokens(item.title);
  const numbers = new Set((item.title.match(/\d{2,}/g) ?? []).slice(0, 4));
  return { ...item, tokens, bridges, numbers };
}

function similarity(a, b) {
  const tokenSim = Math.max(jaccard(a.tokens, b.tokens), containment(a.tokens, b.tokens) * 0.92);
  let bridgeShared = 0;
  for (const token of a.bridges) if (b.bridges.has(token)) bridgeShared += 1;
  bridgeShared = Math.ceil(bridgeShared / 2);
  let numberShared = 0;
  for (const n of a.numbers) if (b.numbers.has(n)) numberShared += 1;
  const sameImage = Boolean(a.image && b.image && a.image === b.image);

  const merge =
    sameImage ||
    tokenSim >= 0.34 ||
    (bridgeShared >= 2 && tokenSim >= 0.1) ||
    (bridgeShared >= 1 && tokenSim >= 0.2) ||
    (numberShared >= 2 && tokenSim >= 0.24);

  return { merge, tokenSim, bridgeShared };
}

function clusterItems(items) {
  const prepared = items.map(prepare).sort((a, b) => b.publishedMs - a.publishedMs);
  const clusters = [];

  for (const item of prepared) {
    let target = null;
    let bestSim = 0;
    for (const cluster of clusters) {
      for (const member of cluster.items) {
        // 不同省份的同类活动（宣讲团、常委会）不是同一件事，不能并成一条
        if (item.province && member.province && item.province !== member.province) {
          // 例外：各报头版转载的同一条新华社稿标题逐字相同；本地会议标题不会跨省全等
          if (item.title.trim() !== member.title.trim()) continue;
        }
        const { merge, tokenSim } = similarity(item, member);
        // 地方稿不要被全国稿的模板标题吸走，除非两条标题几乎一致
        if (Boolean(item.province) !== Boolean(member.province) && tokenSim < 0.6) continue;
        // 政策文件标题高度模板化，只有同名文件（多站转载）才算同一件，其余各自成条
        if (
          merge &&
          isPolicyDocument(item.title) &&
          isPolicyDocument(member.title) &&
          item.title.trim() !== member.title.trim()
        ) {
          continue;
        }
        if (merge && tokenSim >= bestSim - 0.02) {
          target = cluster;
          bestSim = Math.max(bestSim, tokenSim);
          break;
        }
      }
      if (target) break;
    }
    if (target) {
      target.items.push(item);
      target.sources.add(item.sourceId);
    } else {
      clusters.push({ id: `c${clusters.length + 1}`, items: [item], sources: new Set([item.sourceId]) });
    }
  }

  return clusters;
}

function pickRepresentative(cluster) {
  const scored = cluster.items.map((item) => {
    let score = 0;
    if (item.image) score += 3;
    if (item.summary) score += 2;
    if (item.origin === "en") score += 0.9;
    else if (item.origin !== "zh") score += 0.4;
    score += item.publishedMs / 1e13;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].item;
}

function scoreCluster(cluster) {
  const rep = pickRepresentative(cluster);
  const latest = Math.max(...cluster.items.map((i) => i.publishedMs));
  const ageHours = Math.max(0, (Date.now() - latest) / HOUR);
  const fresh = Math.exp(-ageHours / 22);
  const coverage = Math.min(4, cluster.sources.size - 1) * 13;
  const weightAvg =
    [...cluster.sources].reduce((sum, id) => sum + (SOURCE_MAP.get(id)?.weight ?? 0.9), 0) /
    Math.max(1, cluster.sources.size);
  const weightScore = weightAvg * 7;
  const boost = Math.min(12, hotHits(rep.title) * 1.8);
  const richness = (rep.image ? 2.5 : 0) + (rep.summary ? 1.5 : 0);
  const score = 50 * fresh + coverage + weightScore + boost + richness;

  const region = classifyRegion(
    rep.title,
    cluster.items.filter((item) => item !== rep).slice(0, 5).map((item) => item.title),
  );
  const analysis = analyzeStory(rep, cluster.items, ageHours);
  return { rep, latest, score, region, ageHours, analysis, eventKey: eventKeyFor(rep) };
}

const REGION_ORDER = ["global", "mideast", "europe", "asia", "americas", "africa"];
const REGION_LABELS = {
  global: "全球",
  mideast: "中东",
  europe: "欧洲",
  asia: "亚太",
  americas: "美洲",
  africa: "非洲",
};

function collectByLang(reps, field) {
  const groups = new Map();
  for (const rep of reps) {
    if (rep.origin === "zh") continue;
    const text = rep[field];
    if (!text) continue;
    const lang = rep.origin || "en";
    if (!groups.has(lang)) groups.set(lang, new Set());
    groups.get(lang).add(text);
  }
  return groups;
}

function toArticle(cluster, sources, titleMap, summaryMap) {
  const { rep } = cluster;
  const foreign = rep.origin !== "zh";
  const titleTranslated = foreign ? titleMap.get(rep.title)?.text : rep.title;
  const summaryTranslated = foreign ? summaryMap.get(rep.summary)?.text : rep.summary;
  const sourceIds = [...cluster.sources];

  return {
    id: cluster.id,
    title: titleTranslated || rep.title,
    titleOriginal: foreign ? rep.title : null,
    translated: Boolean(titleTranslated && foreign),
    summary: summaryTranslated || rep.summary || "",
    summaryOriginal: foreign ? rep.summary : null,
    sourceLang: rep.origin || "en",
    image: rep.image,
    link: rep.link,
    publishedAt: new Date(cluster.latest).toISOString(),
    region: cluster.region.id,
    heat: Math.max(1, Math.min(100, Math.round(cluster.score))),
    seriousness: cluster.analysis.seriousness,
    blueOcean: cluster.analysis.blueOcean,
    isBlueOcean: cluster.analysis.isBlueOcean,
    crime: cluster.analysis.crime,
    topic: cluster.scienceTopic?.topic ?? null,
    topicLabel: cluster.scienceTopic?.label ?? null,
    subtopic: cluster.scienceTopic?.subtopic ?? null,
    subtopicLabel: cluster.scienceTopic?.subtopicLabel ?? null,
    zone: cluster.zone?.id ?? null,
    zoneLabel: cluster.zone?.label ?? null,
    province: cluster.province?.id ?? null,
    provinceLabel: cluster.province?.label ?? null,
    document: Boolean(cluster.policyDoc),
    movement: Boolean(cluster.movement),
    pushCandidate: false,
    sourceCount: sourceIds.length,
    sources: sourceIds.map((id) => {
      const meta = sources.find((s) => s.id === id);
      return { id, name: meta?.name ?? id, shortName: meta?.shortName ?? id, accent: meta?.accent ?? "#666" };
    }),
    related: cluster.items
      .filter((item) => item.id !== rep.id)
      .sort((a, b) => b.publishedMs - a.publishedMs)
      .slice(0, 5)
      .map((item) => ({
        sourceName: sources.find((s) => s.id === item.sourceId)?.shortName ?? item.sourceId,
        title: item.title,
        link: item.link,
        publishedAt: item.publishedAt,
      })),
  };
}

const SCIENCE_TOPIC_ORDER = ["physics", "chemistry", "biology", "computing", "applied", "general"];
const SCIENCE_TOPIC_LABELS = {
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  computing: "计算机",
  applied: "应用前沿",
  general: "综合",
};

function buildSituation(articles) {
  const grouped = new Map();
  for (const article of articles) {
    if (!article.zone) continue;
    if (!grouped.has(article.zone)) grouped.set(article.zone, []);
    grouped.get(article.zone).push(article);
  }

  const now = Date.now();
  const stats = ZONES.map((zone) => {
    const items = grouped.get(zone.id) ?? [];
    const raw = items.reduce((sum, article) => {
      const ageHours = Math.max(0, (now - Date.parse(article.publishedAt)) / HOUR);
      const coverage = 1 + Math.min(3, article.sourceCount - 1) * 0.5;
      return sum + coverage * Math.exp(-ageHours / 36);
    }, 0);
    return { zone, items, raw };
  });
  const maxRaw = Math.max(0, ...stats.map((entry) => entry.raw));

  const zones = stats.map(({ zone, items, raw }) => {
    const count = items.length;
    const intensity = count && maxRaw ? Math.max(12, Math.round((raw / maxRaw) * 100)) : 0;
    const tone = intensity >= 60 ? "hot" : intensity >= 30 ? "warm" : count ? "watch" : "idle";
    const reports = [...items]
      .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      .slice(0, 3);
    return {
      id: zone.id,
      label: zone.label,
      lat: zone.lat,
      lon: zone.lon,
      count,
      intensity,
      tone,
      reports,
    };
  });

  return {
    zones,
    reportsTotal: stats.reduce((sum, entry) => sum + entry.items.length, 0),
    updatedAt: new Date().toISOString(),
  };
}

// 军事焦点优先展示装备、演习与国防部对外发布
const DEFENSE_FOCUS =
  /装备|武器|军售|军火|弹药|导弹|无人机|无人艇|战机|战斗机|轰炸机|舰艇|航母|航空母舰|驱逐舰|护卫舰|潜艇|雷达|防空|演习|试射|列装|部署|国防部|军方|军工|军费|采购|作战能力|武器系统|defen[cs]e ministry|ministry of defen[cs]e|weapons?|missiles?|drones?|fighter jets?|warships?|aircraft carriers?|submarines?|artillery|air defen[cs]e|military exercises?|joint exercises?|test-fir\w*|procurement|arms sales?|munitions?|deployment|combat readiness/i;

const DOMESTIC_LEAD = /习近平|李强/;
const DOMESTIC_CENTRAL =
  /中共中央|国务院|政治局|全国人大|全国政协|中央经济工作会议|中央农村工作会议/;

// 省级党报要闻页的“其它”类里仍有大量本地时政稿（会议/调研/批复），只排除明确的服务与文体内容
const LOCAL_NOISE =
  /直播|马拉松|联赛|球赛|冰雪|花海|候鸟|天气|气温|降雨|降温|游客|美食|演出|音乐会|演唱会|展览|招募|报名|打卡|门票|景区|非遗|文旅|旅游|康养|招商|推介|颁奖|晚会|比赛|体育|书画|摄影|微电影|短视频|烟花爆竹|宣传月|副刊|温故|采风|会客厅|还景于民|冬日|暖冬|观鸟|海鸥|冰雪季|消费季|半决赛|决赛|联赛|球赛|球队|球员|足球|篮球|排球|出战|扩军|粤超|东北超|村超|夺冠|夺金|图册|家宴|历史人物选举|抽签结果|重磅开启|火热开启|齐聚|共谋发展|最新进展|锦绣|如此精|大叙事|启新程|新身份|抢.{0,1}鲜|需要几步|丰硕成果|矩阵扩容|凉粉草|图鉴|故事|暖人心|启未来|奋进|耕耘|谱新篇|新篇章|心结|纪实|速写|特写|群像|剪影|走笔|我在|答卷|巡礼|掠影|纪事|走访|何以/;

// 中央文件/中央部门稿被地方站转载时不能记到该省名下
const CENTRAL_DOC =
  /^(?:中国)?(?:国务院|中共中央|中办|国办|中央|国家|全国|市场监管总局|教育部|财政部|发改委|商务部|工信部|卫健委|中国人民银行|海关总署|税务总局|三部门|多部门)/;

// 源级 province 优先，但标题只点名其他省份时以标题为准（北京日报报道广东）
function resolveProvince(sourceProvince, headline, text) {
  if (CENTRAL_DOC.test(headline)) return null;
  if (!sourceProvince) return detectProvince(headline, text);
  const sourceEntry = PROVINCES.find((entry) => entry.id === sourceProvince);
  const mentionsSource = sourceEntry?.zh.some((term) => headline.includes(term)) ?? false;
  const named = detectProvince(headline);
  if (!mentionsSource && named && named.id !== sourceProvince) return named;
  return { id: sourceProvince, label: sourceEntry?.label ?? sourceProvince, score: 9 };
}

function focusRank(cluster) {
  const text = [cluster.rep.title, cluster.rep.summary].filter(Boolean).join(" ");
  return (DEFENSE_FOCUS.test(text) ? 8 : 0) + (cluster.score ?? 0);
}

function composeModule(mod, clusters, sources, titleMap, summaryMap, shared) {
  // 可见列表已在 pickVisible 里按模块配额裁剪（国内要保证 34 省各一条），不能再截断
  const list = clusters;
  const articles = list.map((cluster) => toArticle(cluster, sources, titleMap, summaryMap));
  const situation = mod.id === "military" ? buildSituation(articles) : null;
  // 政策文件与战区战报单独成栏，不重复出现在焦点/热度/动态
  const documents =
    mod.id === "domestic" ? articles.filter((article) => article.document).slice(0, 12) : [];
  const movements =
    mod.id === "military"
      ? articles.filter((article) => article.movement && !article.zone).slice(0, 6)
      : [];
  const sectionArticles =
    mod.id === "military"
      ? list
          .filter((cluster) => !cluster.zone && !cluster.movement)
          .sort((a, b) => focusRank(b) - focusRank(a))
          .map((cluster) => toArticle(cluster, sources, titleMap, summaryMap))
      : situation
        ? articles.filter((article) => !article.zone)
        : mod.id === "domestic"
          ? articles.filter((article) => !article.document)
          : articles;

  // 国内头条优先领导人/中央部署，避免城市宣传稿抢占时政要闻位
  const hero =
    mod.id === "domestic"
      ? (sectionArticles.find((article) => DOMESTIC_LEAD.test(article.title)) ??
        sectionArticles.find((article) => DOMESTIC_CENTRAL.test(article.title)) ??
        sectionArticles[0] ??
        null)
      : (sectionArticles[0] ?? null);
  const rest = sectionArticles.filter((article) => article !== hero);
  const spotlight = rest.slice(0, 4);
  const ranking = rest.slice(4, 11);
  const displayedIds = new Set(
    [hero, ...spotlight, ...ranking].filter(Boolean).map((article) => article.id),
  );
  const latest = sectionArticles
    .filter((article) => !displayedIds.has(article.id))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 24);

  const people = mod.people ? extractPeople(articles) : [];
  const regionCounts = REGION_ORDER.map((id) => ({
    id,
    label: REGION_LABELS[id],
    count:
      id === "global"
        ? latest.length
        : latest.filter((article) => article.region === id).length,
  }));

  const topics =
    mod.id === "science"
      ? SCIENCE_TOPIC_ORDER.map((id) => ({
          id,
          label: SCIENCE_TOPIC_LABELS[id],
          count: articles.filter((article) => article.topic === id).length,
        })).filter((topic) => topic.count > 0)
      : undefined;

  // 34 个省级行政区全部返回，没有报道的省份 count 为 0，前端保持完整筛选栏
  const provinces =
    mod.id === "domestic"
      ? PROVINCE_ORDER.map((id) => {
          const province = PROVINCES.find((entry) => entry.id === id);
          const items = articles.filter((article) => article.province === id);
          return {
            id,
            label: province?.label ?? id,
            count: items.length,
            items: items.slice(0, 4),
          };
        })
      : undefined;

  return {
    module: mod.id,
    moduleLabel: mod.label,
    generatedAt: shared.generatedAt,
    meta: {
      onlineSources: shared.onlineSources,
      totalSources: shared.totalSources,
      totalArticles: list.reduce((sum, cluster) => sum + cluster.items.length, 0),
      clusters: articles.length,
      totalClusters: shared.totalClusters,
      filtered: shared.filtered,
      relay: shared.relay,
      sources: shared.sources,
    },
    hero,
    spotlight,
    ranking,
    latest,
    people,
    regions: regionCounts,
    all: articles,
    ...(topics ? { topics } : {}),
    ...(situation ? { situation } : {}),
    ...(provinces ? { provinces, documents } : {}),
    ...(movements.length ? { movements } : {}),
  };
}

export async function buildNews() {
  const { sources, items, relay } = await fetchAllSources();

  const filtered = { opinion: 0, soft: 0, crime: 0, other: 0, total: 0 };
  const accepted = [];
  for (const item of items) {
    const reason = hardNewsReason(item);
    // 法规条文没有事件信号，会被判为 other；政策文件仍需进入国内板块的政策栏
    const policyDoc = reason === "other" && isPolicyDocument(item.title);
    // 省级媒体发的本地稿按来源省归属国内，不因缺少通用事件词被丢弃
    const sourceMeta = SOURCE_MAP.get(item.sourceId);
    const localHard =
      Boolean(sourceMeta?.province) &&
      item.origin === "zh" &&
      !LOCAL_NOISE.test(item.title);
    if (!reason || policyDoc || (reason === "other" && localHard)) {
      accepted.push(item);
      continue;
    }
    if (reason === "opinion") filtered.opinion += 1;
    else if (reason === "soft") filtered.soft += 1;
    else if (reason === "crime") filtered.crime += 1;
    else filtered.other += 1;
    filtered.total += 1;
  }

  const clusters = clusterItems(accepted);

  // 一次聚类、一次分配：每个聚类只属于一个模块，模块之间天然互斥
  const scored = clusters
    .map((cluster) => {
      const meta = scoreCluster(cluster);
      const otherTitles = cluster.items
        .filter((item) => item !== meta.rep)
        .slice(0, 5)
        .map((item) => item.title);
      const text = [meta.rep.title, meta.rep.titleOriginal, meta.rep.summary, ...otherTitles]
        .filter(Boolean)
        .join(" ");
      const headline = [meta.rep.title, meta.rep.titleOriginal].filter(Boolean).join(" ");
      const sourceMeta = SOURCE_MAP.get(meta.rep.sourceId);
      const sourceProvince = meta.rep.province ?? sourceMeta?.province ?? null;
      // 跨省转载的同一条中央稿不再归给某一个省，进全国栏
      const multiProvince =
        new Set(cluster.items.map((item) => item.province).filter(Boolean)).size > 1;
      const domesticSource = sourceMeta?.focus === "国内";
      const assignment = assignModule(meta.rep, otherTitles, {
        domesticSource,
        province: sourceProvince,
      });
      const scienceTopic = assignment.id === "science" ? classifyScience(text) : null;
      const zone = assignment.id === "military" ? detectZone(text, headline) : null;
      const province =
        assignment.id === "domestic" && !multiProvince
          ? resolveProvince(sourceProvince, headline, text)
          : null;
      const policyDoc =
        assignment.id === "domestic" && isPolicyDocument(meta.rep.title, meta.rep.summary);
      const movement = assignment.id === "military" && isMovementStory(headline, text);
      return {
        ...cluster,
        ...meta,
        module: assignment.id,
        scienceTopic,
        zone,
        province,
        policyDoc,
        movement,
      };
    })
    .sort((a, b) => b.score - a.score);

  // 社会运动/左翼报道热度通常低于战况，为军事板块保留最多 4 个固定席位
  // 国内板块按 mod.provinceMin 给每个省保底若干条，替换掉得分最低的非配额稿
  function pickVisible(mod, ranked) {
    const top = ranked.slice(0, mod.visible);
    if (mod.id === "domestic") {
      const min = mod.provinceMin ?? 1;
      const quota = new Set();
      const perProvince = new Map();
      for (const cluster of ranked) {
        const id = cluster.province?.id;
        if (!id) continue;
        const taken = perProvince.get(id) ?? 0;
        if (taken >= min) continue;
        perProvince.set(id, taken + 1);
        quota.add(cluster);
      }
      const missing = [...quota].filter((cluster) => !top.includes(cluster));
      if (!missing.length) return top;
      const keep = new Set(missing.map((cluster) => cluster.id));
      const drop = new Set(
        top
          .filter((cluster) => !keep.has(cluster.id) && !quota.has(cluster))
          .slice(-missing.length),
      );
      return [...top.filter((cluster) => !drop.has(cluster.id)), ...missing].sort(
        (a, b) => b.score - a.score,
      );
    }
    if (mod.id !== "military") return top;
    const movements = ranked.filter((cluster) => cluster.movement);
    const missing = movements.filter((cluster) => !top.includes(cluster)).slice(0, 4);
    if (!missing.length) return top;
    const drop = new Set(top.filter((cluster) => !cluster.movement).slice(-missing.length));
    return [...top.filter((cluster) => !drop.has(cluster)), ...missing].sort(
      (a, b) => b.score - a.score,
    );
  }

  const visibleByModule = new Map(
    MODULES.map((mod) => [
      mod.id,
      pickVisible(mod, scored.filter((cluster) => cluster.module === mod.id)),
    ]),
  );

  const titleMap = new Map();
  const summaryMap = new Map();
  const jobs = [];
  const titleReps = MODULES.flatMap((mod) =>
    visibleByModule.get(mod.id).map((cluster) => cluster.rep),
  );
  for (const [lang, texts] of collectByLang(titleReps, "title")) {
    jobs.push(
      translateBatch([...texts], { concurrency: 3, from: lang }).then((result) => {
        for (const [text, value] of result) titleMap.set(text, value);
      }),
    );
  }
  const summaryReps = MODULES.flatMap((mod) =>
    visibleByModule
      .get(mod.id)
      .slice(0, mod.id === "world" ? 5 : 3)
      .map((cluster) => cluster.rep),
  );
  for (const [lang, texts] of collectByLang(summaryReps, "summary")) {
    jobs.push(
      translateBatch([...texts], { concurrency: 2, from: lang }).then((result) => {
        for (const [text, value] of result) summaryMap.set(text, value);
      }),
    );
  }
  await Promise.all(jobs);

  const generatedAt = new Date().toISOString();
  const sourceMeta = sources.map(
    ({ id, name, shortName, ok, error, latencyMs, fetchedAt, accent }) => ({
      id,
      name,
      shortName,
      ok,
      error,
      latencyMs,
      fetchedAt,
      accent,
    }),
  );
  const shared = {
    generatedAt,
    onlineSources: sources.filter((s) => s.ok).length,
    totalSources: sources.length,
    totalClusters: clusters.length,
    filtered,
    relay,
    sources: sourceMeta,
  };

  const payloads = {};
  for (const mod of MODULES) {
    payloads[mod.id] = composeModule(
      mod,
      visibleByModule.get(mod.id),
      sourceMeta,
      titleMap,
      summaryMap,
      shared,
    );
  }

  // 推送候选只从国际模块产生，其他模块不参与推送账本
  const worldClusters = visibleByModule.get("world");
  const worldPayload = payloads.world;
  const eventKeys = new Map(worldClusters.map((cluster) => [cluster.id, cluster.eventKey]));
  const eligibleIds = new Set(
    worldClusters.filter((cluster) => cluster.analysis.pushEligible).map((cluster) => cluster.id),
  );
  const pushPool = worldPayload.all
    .filter((article) => eligibleIds.has(article.id))
    .map((article) => ({
      eventKey: eventKeys.get(article.id),
      title: article.title,
      articleId: article.id,
      heat: article.heat,
      seriousness: article.seriousness,
      blueOcean: article.blueOcean,
      sourceCount: article.sourceCount,
    }))
    .sort((a, b) => b.blueOcean - a.blueOcean || b.heat - a.heat)
    .slice(0, 8);
  const { fresh: pushCandidates, suppressed } = filterPushCandidates(pushPool);
  const freshIds = new Set(pushCandidates.map((candidate) => candidate.articleId));
  for (const article of worldPayload.all) {
    article.pushCandidate = freshIds.has(article.id);
  }
  worldPayload.meta.push = {
    candidates: pushCandidates.length,
    suppressed: suppressed.length,
  };

  return {
    generatedAt,
    modules: payloads,
    pushCandidates,
    relay,
  };
}
