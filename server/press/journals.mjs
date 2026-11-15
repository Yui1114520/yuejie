// 报刊板块的权威度与兴趣配置。
// 期刊只登记名称：ISSN 在首次采集时经 OpenAlex sources 精确同名解析并落库，
// 解析不到的刊自动跳过，避免把猜错的 ISSN 写进链路。

export const AUTHORITATIVE = [
  // tier 1：综合顶刊与顶刊子刊
  { name: "Nature", tier: 1, field: "general" },
  { name: "Science", tier: 1, field: "general" },
  { name: "Cell", tier: 1, field: "life" },
  { name: "The Lancet", tier: 1, field: "medicine" },
  { name: "New England Journal of Medicine", tier: 1, field: "medicine" },
  { name: "JAMA", tier: 1, field: "medicine" },
  { name: "The BMJ", tier: 1, field: "medicine" },
  { name: "Proceedings of the National Academy of Sciences", tier: 1, field: "general" },
  { name: "Nature Communications", tier: 1, field: "general" },
  { name: "Science Bulletin", tier: 1, field: "general" },

  // tier 2：各学科旗舰刊
  { name: "Physical Review Letters", tier: 2, field: "physics" },
  { name: "Reviews of Modern Physics", tier: 2, field: "physics" },
  { name: "Nature Physics", tier: 2, field: "physics" },
  { name: "The Astrophysical Journal", tier: 2, field: "physics" },
  { name: "Astronomy & Astrophysics", tier: 2, field: "physics" },
  { name: "Artificial Intelligence", tier: 2, field: "computing" },
  { name: "IEEE Transactions on Pattern Analysis and Machine Intelligence", tier: 2, field: "computing" },
  { name: "Journal of Machine Learning", tier: 2, field: "computing" },
  { name: "Nature Machine Intelligence", tier: 2, field: "computing" },
  { name: "ACM Computing Surveys", tier: 2, field: "computing" },
  { name: "Nature Medicine", tier: 2, field: "medicine" },
  { name: "Nature Biotechnology", tier: 2, field: "life" },
  { name: "Nature Genetics", tier: 2, field: "life" },
  { name: "eLife", tier: 2, field: "life" },
  { name: "Geophysical Research Letters", tier: 2, field: "earth" },
  { name: "Nature Geoscience", tier: 2, field: "earth" },
  { name: "Environmental Science & Technology", tier: 2, field: "earth" },
  { name: "Atmospheric Chemistry and Physics", tier: 2, field: "earth" },
  { name: "The Cryosphere", tier: 2, field: "earth" },
  { name: "American Economic Review", tier: 2, field: "economics" },
  { name: "Econometrica", tier: 2, field: "economics" },
  { name: "The Quarterly Journal of Economics", tier: 2, field: "economics" },
  { name: "Journal of Political Economy", tier: 2, field: "economics" },
  { name: "Review of Economic Studies", tier: 2, field: "economics" },
  { name: "World Development", tier: 2, field: "economics" },
  { name: "China Economic Review", tier: 2, field: "economics" },
  { name: "American Sociological Review", tier: 2, field: "social" },
  { name: "American Political Science Review", tier: 2, field: "social" },
  { name: "The China Quarterly", tier: 2, field: "social" },
  { name: "Journal of Peasant Studies", tier: 2, field: "social" },
  { name: "Demography", tier: 2, field: "social" },
  { name: "Population and Development Review", tier: 2, field: "social" },
  { name: "Advanced Materials", tier: 2, field: "materials" },
  { name: "Nature Materials", tier: 2, field: "materials" },
  { name: "Nature Energy", tier: 2, field: "materials" },
  { name: "Energy & Environmental Science", tier: 2, field: "materials" },
  { name: "Joule", tier: 2, field: "materials" },

  // tier 2：社会学 / 政治学（社科主干，走 Crossref 逐刊取新稿）
  { name: "American Journal of Sociology", tier: 2, field: "social" },
  { name: "Social Forces", tier: 2, field: "social" },
  { name: "British Journal of Sociology", tier: 2, field: "social" },
  { name: "Annual Review of Sociology", tier: 2, field: "social" },
  { name: "Social Science & Medicine", tier: 2, field: "social" },
  { name: "Gender & Society", tier: 2, field: "social" },
  { name: "Ethnic and Racial Studies", tier: 2, field: "social" },
  { name: "Work and Occupations", tier: 2, field: "social" },
  { name: "Urban Studies", tier: 2, field: "social" },
  { name: "International Organization", tier: 2, field: "social" },
  { name: "World Politics", tier: 2, field: "social" },
  { name: "Comparative Political Studies", tier: 2, field: "social" },
  { name: "American Journal of Political Science", tier: 2, field: "social" },
  { name: "The Journal of Politics", tier: 2, field: "social" },
  { name: "Journal of Conflict Resolution", tier: 2, field: "social" },
  { name: "Journal of Peace Research", tier: 2, field: "social" },
  { name: "International Security", tier: 2, field: "social" },
  { name: "Third World Quarterly", tier: 2, field: "social" },
  { name: "Journal of Contemporary China", tier: 2, field: "social" },
  { name: "New Media & Society", tier: 2, field: "social" },
  { name: "Journal of Communication", tier: 2, field: "social" },
  { name: "Political Communication", tier: 2, field: "social" },
  { name: "Big Data & Society", tier: 2, field: "social" },

  // tier 2：法学与治理
  { name: "Law & Society Review", tier: 2, field: "law" },
  { name: "Modern Law Review", tier: 2, field: "law" },
  { name: "American Journal of Comparative Law", tier: 2, field: "law" },
  { name: "International Journal of Constitutional Law", tier: 2, field: "law" },
  { name: "Human Rights Quarterly", tier: 2, field: "law" },
  { name: "Journal of Law and Economics", tier: 2, field: "law" },

  // tier 2：心理与教育
  { name: "Psychological Science", tier: 2, field: "mind" },
  { name: "Annual Review of Psychology", tier: 2, field: "mind" },
  { name: "Perspectives on Psychological Science", tier: 2, field: "mind" },
  { name: "Child Development", tier: 2, field: "mind" },
  { name: "American Educational Research Journal", tier: 2, field: "mind" },
  { name: "Review of Educational Research", tier: 2, field: "mind" },
  { name: "Educational Researcher", tier: 2, field: "mind" },

  // tier 2：历史与人类学
  { name: "American Historical Review", tier: 2, field: "humanity" },
  { name: "Past & Present", tier: 2, field: "humanity" },
  { name: "American Anthropologist", tier: 2, field: "humanity" },
  { name: "Current Anthropology", tier: 2, field: "humanity" },
  { name: "Cultural Anthropology", tier: 2, field: "humanity" },
  { name: "Antipode", tier: 2, field: "humanity" },

  // tier 3：只在检索结果里命中时加权，不额外发起 ISSN 逐刊请求
  { name: "Social Problems", tier: 3, field: "social" },
  { name: "Socio-Economic Review", tier: 3, field: "social" },
  { name: "European Journal of Political Research", tier: 3, field: "social" },
  { name: "British Journal of Political Science", tier: 3, field: "social" },
  { name: "Governance", tier: 3, field: "social" },
  { name: "Public Administration Review", tier: 3, field: "social" },
  { name: "West European Politics", tier: 3, field: "social" },
  { name: "Review of African Political Economy", tier: 3, field: "social" },
  { name: "Environment and Urbanization", tier: 3, field: "social" },
  { name: "Information Communication & Society", tier: 3, field: "social" },
  { name: "The China Journal", tier: 3, field: "social" },
  { name: "Journal of Rural Studies", tier: 3, field: "social" },
  { name: "Regulation & Governance", tier: 3, field: "law" },
  { name: "Legal Studies", tier: 3, field: "law" },
  { name: "Asian Journal of Law and Society", tier: 3, field: "law" },
  { name: "Human Rights Review", tier: 3, field: "law" },
  { name: "Developmental Psychology", tier: 3, field: "mind" },
  { name: "Journal of Child Psychology and Psychiatry", tier: 3, field: "mind" },
  { name: "Journal of Educational Psychology", tier: 3, field: "mind" },
  { name: "Learning and Instruction", tier: 3, field: "mind" },
  { name: "Frontiers in Psychology", tier: 3, field: "mind" },
  { name: "Journal of the Royal Anthropological Institute", tier: 3, field: "humanity" },
  { name: "Ethnography", tier: 3, field: "humanity" },
  { name: "Journal of Modern History", tier: 3, field: "humanity" },
  { name: "International Review of Social History", tier: 3, field: "humanity" },
  { name: "Historical Materialism", tier: 3, field: "humanity" },

  // tier 3：开放获取大刊与中文刊（中文刊多在知网，OA 侧只能捞到一部分）
  { name: "PLOS ONE", tier: 3, field: "general" },
  { name: "Scientific Reports", tier: 3, field: "general" },
  { name: "Frontiers in Public Health", tier: 3, field: "medicine" },
  { name: "Chinese Journal of Physics", tier: 3, field: "physics" },
  { name: "Science China Materials", tier: 3, field: "materials" },
  { name: "Science China Information Sciences", tier: 3, field: "computing" },
  { name: "Chinese Physics Letters", tier: 3, field: "physics" },
];

// 中文核心刊：这些刊基本不进 Crossref（OpenAlex 里也只有 2020 年前的存量），
// 只在检索结果命中刊名时做加权，不单独发起请求
export const CN_JOURNALS = [
  "中国科学",
  "科学通报",
  "中国社会科学",
  "经济研究",
  "管理世界",
  "社会学研究",
  "政治学研究",
  "法学研究",
  "历史研究",
  "世界历史",
  "新闻与传播研究",
  "国际政治",
  "世界经济与政治",
  "公共管理学报",
  "心理学报",
  "华东师范大学学报",
  "计算机学报",
  "软件学报",
  "自动化学报",
  "物理学报",
  "化学学报",
  "地理学报",
  "气象学报",
  "地质学报",
  "经济学报",
  "中国工业经济",
];

export const INTERESTS = [
  {
    id: "computing",
    label: "人工智能与信息",
    terms: ["machine learning", "neural network", "large language model", "computer vision"],
    arxiv: ["cs.LG", "cs.CL", "cs.CV"],
    epmc: null,
  },
  {
    id: "life",
    label: "生命科学与医学",
    terms: ["cancer immunotherapy", "genome editing", "microbiome", "neuroscience"],
    arxiv: ["q-bio.NC"],
    epmc: '"cancer immunotherapy" OR "genome editing"',
  },
  {
    id: "physics",
    label: "物理与天文",
    terms: ["quantum computing", "gravitational wave", "dark matter", "superconductivity"],
    arxiv: ["quant-ph", "gr-qc", "astro-ph.HE"],
    epmc: null,
  },
  {
    id: "earth",
    label: "地球与环境",
    terms: ["climate change", "carbon emission", "extreme weather", "biodiversity loss"],
    arxiv: ["physics.ao-ph"],
    epmc: '"climate change" AND "public health"',
  },
  {
    id: "economics",
    label: "经济与金融",
    terms: ["monetary policy", "labor market", "inequality", "trade war"],
    arxiv: ["econ.GN"],
    epmc: null,
  },
  {
    id: "social",
    label: "社会与政治",
    terms: ["democracy", "social movement", "inequality", "authoritarianism", "welfare state", "populism", "migration"],
    arxiv: [],
    epmc: null,
  },
  {
    id: "law",
    label: "法学与治理",
    terms: ["human rights", "rule of law", "constitutional court", "criminal justice", "transitional justice"],
    arxiv: [],
    epmc: null,
  },
  {
    id: "mind",
    label: "心理与教育",
    terms: ["social psychology", "educational inequality", "mental health", "child development", "misinformation"],
    arxiv: [],
    epmc: '"adolescent mental health" AND "social media"',
  },
  {
    id: "humanity",
    label: "历史与人类学",
    terms: ["colonial history", "collective memory", "ethnography", "world-systems", "labor history"],
    arxiv: [],
    epmc: null,
  },
  {
    id: "materials",
    label: "材料与能源",
    terms: ["perovskite solar cell", "battery", "hydrogen", "two-dimensional materials"],
    arxiv: ["cond-mat.mtrl-sci"],
    epmc: null,
  },
];

const FIELD_LABELS = {
  general: "综合",
  life: "生命科学与医学",
  medicine: "生命科学与医学",
  computing: "人工智能与信息",
  physics: "物理与天文",
  earth: "地球与环境",
  economics: "经济与金融",
  social: "社会与政治",
  law: "法学与治理",
  mind: "心理与教育",
  humanity: "历史与人类学",
  materials: "材料与能源",
};

export function fieldToInterest(field) {
  return FIELD_LABELS[field] ?? null;
}

const TIER_LABELS = { 1: "顶刊", 2: "学科旗舰", 3: "开放获取" };

export function tierLabel(tier) {
  return TIER_LABELS[tier] ?? "专业刊";
}

// 刊名匹配：Crossref/OpenAlex 的刊名大小写、缩写、& 写法都不统一，做归一化后比
export function normalizeJournalName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOOKUP = new Map();
for (const entry of AUTHORITATIVE) {
  LOOKUP.set(normalizeJournalName(entry.name), entry);
}
// 常见别名：Crossref 里 PNAS、A&A、JAMA 的写法经常不同
const ALIASES = {
  "proceedings of the national academy of sciences of the united states of america": "proceedings of the national academy of sciences",
  "pnas": "proceedings of the national academy of sciences",
  "astronomy and astrophysics": "astronomy & astrophysics",
  "a&a": "astronomy & astrophysics",
  "journal of the american medical association": "jama",
  "british medical journal": "the bmj",
  "bmj": "the bmj",
  "the lancet": "the lancet",
  "lancet": "the lancet",
  "nejm": "new england journal of medicine",
  "new england journal of medicine": "new england journal of medicine",
  "quarterly journal of economics": "the quarterly journal of economics",
  "american journal of physics": "american journal of physics",
  "nature publishing group": "",
  // 社科刊名里 & 与 and、定冠词写法各家索引不一致，两种都认
  "gender and society": "gender & society",
  "law and society review": "law & society review",
  "big data and society": "big data & society",
  "information communication and society": "information communication & society",
  "social science and medicine": "social science & medicine",
  "energy and environmental science": "energy & environmental science",
  "past and present": "past & present",
  "journal of politics": "the journal of politics",
};

export function lookupJournal(name) {
  const key = normalizeJournalName(name);
  if (!key) return null;
  const resolved = LOOKUP.get(key) ?? LOOKUP.get(ALIASES[key] ?? "");
  if (resolved) return resolved;
  const cn = CN_JOURNALS.some((term) => String(name ?? "").includes(term));
  if (cn) return { name: String(name), tier: 2, field: "general", cn: true };
  return null;
}
