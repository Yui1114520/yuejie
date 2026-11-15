import { classifyNews, latinHits, termHits } from "./editorial.mjs";
import { detectProvince, detectZone, isPolicyDocument } from "./taxonomy.mjs";

export const MODULES = [
  { id: "world", label: "国际", chip: "国际", people: true, visible: 32 },
  { id: "domestic", label: "国内", chip: "国内", people: false, visible: 80, provinceMin: 4 },
  { id: "economy", label: "经贸", chip: "经贸", people: false, visible: 24 },
  { id: "science", label: "科研", chip: "科研", people: false, visible: 24 },
  { id: "military", label: "军事", chip: "军事", people: false, visible: 40 },
];

export const MODULE_IDS = MODULES.map((module) => module.id);
export const MODULE_MAP = new Map(MODULES.map((module) => [module.id, module]));

// 专业模块只收「本模块独有」的概念词；通用政治/外交/战争词留在国际
const VOCAB = {
  economy: {
    zh: [
      "经济", "贸易", "贸易战", "关税", "出口", "进口", "供应链", "通胀", "通货膨胀",
      "利率", "加息", "降息", "央行", "美联储", "欧洲央行", "日本央行", "货币",
      "汇率", "贬值", "债务", "国债", "赤字", "财政", "预算", "经济增速", "经济增长",
      "国内生产总值", "经济衰退", "衰退", "失业率", "就业", "制造业", "工业产出",
      "零售", "消费", "投资", "外资", "并购", "破产", "能源价格", "油价", "天然气",
      "液化天然气", "大宗商品", "粮食价格", "稀土出口", "出口管制", "产业政策",
      "补贴", "反倾销", "世贸组织", "国际货币基金组织", "世界银行", "经合组织",
      "产能过剩", "贸易协定", "自由贸易", "保护主义", "股市", "债券",
      "房贷利率", "住房市场", "房价", "家庭债务", "消费支出", "工资", "裁员",
      "招聘", "劳动力市场", "失业救济", "工厂订单", "工业生产", "贸易逆差",
      "贸易顺差", "经常账户", "外国直接投资", "刺激计划", "救助", "私有化",
      "国有化", "价格上限", "欧佩克", "上市", "估值", "初创企业", "营收",
      "利润", "芯片制造商", "汽车制造商", "零售商", "出口商", "制造商", "运费",
      // 公司内部运营与资本市场
      "首席执行官", "CEO", "高管", "董事会", "股东大会", "财报", "季报", "年报",
      "业绩", "净利润", "亏损", "毛利率", "市场份额", "重组", "收购", "并购",
      "合资", "子公司", "分红", "回购", "增持", "减持", "运营", "产能", "订单",
      "交付", "供应链中断", "召回", "停产", "复工", "裁员计划", "降本",
    ],
    latin:
      /\b(econom(?:y|ic|ies)|trade wars?|trade deals?|trade agreements?|tariffs?|exports?|imports?|supply chains?|inflation|deflation|interest rates?|rate (?:hikes?|cuts?)|central banks?|federal reserve|ecb|boj|imf|world bank|oecd|wto|gdp|recessions?|unemployment|jobs report|manufactur(?:ing|ers?)|industrial output|industrial production|retail sales|consumer prices?|producer prices?|purchasing managers|debt|deficits?|fiscal|budget talks?|currenc(?:y|ies)|exchange rates?|devaluation|bonds?|stock markets?|equities|investment|foreign investment|mergers?|acquisitions?|bankrupt(?:cy|cies)|commodit(?:y|ies)|oil prices?|gas prices?|lng|rare earth (?:exports?|quotas?)|export controls?|subsid(?:y|ies)|anti-dumping|protectionism|free trade|industrial policy|mortgage rates?|housing market|home sales|property prices?|household debt|consumer spending|layoffs?|jobless claims|labor market|trade deficits?|trade surpluses?|current account|stimulus|bailouts?|privatization|nationalization|valuation|startups?|revenues?|profits?|opec|ipo|chipmakers?|automakers?|retailers?|exporters?|manufacturers?|shipping costs?|chief executives?|executives?|board of directors|shareholders?|quarterly (?:results|earnings)|annual report|net (?:profit|loss)|profit margin|market share|restructuring|takeover|joint venture|subsidiar(?:y|ies)|dividend|share buybacks?|production capacity|order book|deliveries|recall|factory shutdown|plant closure|cost cuts?)\b/gi,
    multi: [
      "économie", "commerce", "tarifs douaniers", "droits de douane", "inflation",
      "taux d'intérêt", "banque centrale", "dette", "déficit", "budget",
      "exportations", "importations", "croissance", "récession", "chômage",
      "bourse", "entreprises", "faillite", "PIB", "FMI",
      "economía", "comercio", "aranceles", "aduanas", "inflación",
      "tasas de interés", "banco central", "deuda", "déficit", "presupuesto",
      "exportaciones", "importaciones", "crecimiento", "recesión", "desempleo",
      "bolsa", "empresas", "quiebra", "PIB", "FMI",
      "economia", "comércio", "tarifas", "alfândega", "inflação",
      "taxas de juros", "banco central", "dívida", "déficit", "orçamento",
      "exportações", "importações", "crescimento", "recessão", "desemprego",
      "bolsa", "empresas", "falência", "PIB", "FMI",
    ],
  },
  domestic: {
    zh: [
      "中央", "国务院", "中央办公厅", "国务院办公厅", "中办", "国办", "政治局",
      "省委", "省政府", "市委", "市政府", "县委", "县政府", "自治区",
      "人大常委会", "政协", "两会", "全会", "政府工作报告", "十五五", "十四五",
      "发展改革委", "发改委", "财政部", "教育部", "工信部", "公安部", "民政部",
      "人社部", "自然资源部", "生态环境部", "住建部", "交通运输部", "水利部",
      "农业农村部", "商务部", "文旅部", "卫健委", "应急管理部", "国资委",
      "市场监管总局", "统计局", "医保局", "税务总局", "海关总署",
      "基层治理", "乡村振兴", "共同富裕", "高质量发展", "新质生产力",
      "统一大市场", "区域协调", "京津冀", "长三角", "粤港澳", "成渝",
      "东北振兴", "西部大开发", "中部崛起", "自贸区", "自贸港", "雄安新区",
      "城市更新", "老旧小区", "保障房", "地方债", "转移支付", "营商环境",
      "民营经济", "招商引资", "重大项目", "安全生产", "防汛", "抗旱", "救灾",
      "应急响应", "巡视", "纪检监察", "反腐", "落马", "处分", "双开",
      "调研", "考察", "座谈", "会议", "部署", "出台", "政策", "改革", "试点",
      "省委书记", "省长", "市委书记", "市长", "县委书记", "区长",
    ],
    latin: /\b(chinese (?:government|communist party)|state council|politburo|national people's congress|ndrc|ministry of (?:finance|education|foreign affairs|commerce|agriculture)|provincial government|party secretary|governor)\b/gi,
    multi: [],
  },
  science: {
    zh: [
      "科研", "研究", "研究人员", "科学家", "科学研究", "实验", "论文", "学术期刊",
      "突破", "发现", "太空", "航天", "卫星", "火箭", "探测器", "月球", "火星",
      "空间站", "载人航天", "量子", "量子计算", "人工智能", "大模型", "算法",
      "半导体", "芯片", "生物技术", "基因", "基因编辑", "临床试验", "新药",
      "核聚变", "超导", "纳米", "机器人", "深海", "北极科考", "考古", "天文",
      "望远镜", "粒子", "物理学", "化学", "诺贝尔奖", "专利", "暗物质",
      "系外行星", "引力波", "星系", "宇宙", "黑洞", "小行星", "彗星", "轨道",
      "宇航员", "原子", "分子", "蛋白质", "酶", "细胞", "免疫", "抗体", "细菌",
      "微生物", "基因组", "进化", "化石", "物种", "生态", "生物多样性",
      "神经科学", "大脑", "心理学", "考古", "人类学", "恐龙", "火山", "冰川",
      "珊瑚", "鲸鱼", "蜜蜂", "疫苗", "药物", "胰岛素", "抗生素", "肥胖",
      "癌症", "阿尔茨海默", "疟疾", "艾滋病", "患者",
    ],
    latin:
      /\b(research(?:ers?)?|scientists?|scientific|studies|study finds|peer-reviewed|journals?|breakthroughs?|discover(?:y|ies|ed)|nasa|esa|spacex|cnsa|space missions?|satellites?|rockets?|spacecraft|space probes?|lunar|moon mission|mars mission|space stations?|quantum|artificial intelligence|machine learning|algorithms?|semiconductors?|chips?|biotech(?:nology)?|gene(?:s|tic|tics)?|crispr|clinical trials?|drug trials?|vaccine research|nuclear fusion|fusion reactor|supercomputers?|superconductors?|nanotech(?:nology)?|robotics?|telescopes?|astronom(?:y|ers?)|particle physics|physics|chemists?|chemistry|nobel prize|patents?|dark matter|exoplanets?|gravitational waves?|galaxies|galaxy|cosmos|cosmic|universe|black holes?|observator(?:y|ies)|asteroids?|comets?|orbit(?:er|ers)?|astronauts?|rovers?|particles?|atoms?|molecules?|proteins?|enzymes?|cells?|immune|antibod(?:y|ies)|bacteri(?:a|um)|microbes?|genome|genetic|dna|rna|evolution|fossils?|species|ecosystems?|biodiversity|neuroscience|psychology|archaeolog(?:y|ists?)|anthropolog(?:y|ists?)|dinosaurs?|volcano(?:es)?|glaciers?|coral|whales?|bees?|vaccines?|medication|pharmaceuticals?|pharma|insulin|antibiotics?|obesity|alzheimer'?s?|malaria|hiv|patients?|public health)\b/gi,
    multi: [
      "recherche", "chercheurs", "scientifiques", "découverte", "essai clinique",
      "vaccin", "espace", "satellite", "fusée", "intelligence artificielle",
      "algorithme", "semi-conducteurs", "génome", "fusion nucléaire", "prix nobel",
      "investigación", "científicos", "descubrimiento", "ensayo clínico",
      "vacuna", "espacio", "satélite", "cohete", "inteligencia artificial",
      "algoritmo", "semiconductores", "genoma", "fusión nuclear", "premio nobel",
      "pesquisa", "cientistas", "descoberta", "ensaio clínico", "vacina",
      "espaço", "satélite", "foguete", "inteligência artificial", "algoritmo",
      "semicondutores", "genoma", "fusão nuclear", "prêmio nobel",
    ],
  },
  military: {
    zh: [
      "国防预算", "军费", "军购", "军售", "武器", "军备", "导弹", "弹道导弹",
      "高超音速", "防空", "军舰", "驱逐舰", "护卫舰", "航母", "航空母舰",
      "潜艇", "战斗机", "战机", "轰炸机", "无人机", "坦克", "装甲车", "军队",
      "部队", "士兵", "兵力", "征兵", "军演", "军事演习", "军事基地",
      "军事同盟", "北约扩军", "核武库", "核弹头", "核试验", "军控", "裁军",
      "军工", "国防工业", "防务", "五角大楼", "国防部", "参谋长", "上将",
      "战区", "军事援助", "军事情报", "雇佣兵", "准军事", "民兵", "武装力量",
      "武器交易", "空军", "海军", "陆军", "武装部队", "国防部长", "实弹",
      "侦察", "特种部队", "洲际弹道导弹", "雷达", "直升机", "武装直升机",
      "火炮", "迫击炮", "国防出口", "武器出口", "军火", "弹药", "炮弹",
      "巡航导弹", "无人艇", "电子战", "网络战", "军工订单", "装备采购",
      "列装", "试射", "部署", "舰队", "编队", "实弹演习", "联合演习",
      "国防部发布", "军方声明", "作战能力", "武器系统",
      // 社会运动 / 革命游击 / 议会斗争（第三世界与左翼运动的常见叙事）
      "社会运动", "群众运动", "抗议运动", "示威", "示威者", "罢工", "总罢工",
      "工会", "劳工运动", "农民运动", "学生运动", "左翼", "进步运动", "反战",
      "革命", "游击战", "游击队", "武装斗争", "人民战争", "反帝", "反殖民",
      "民族解放", "解放运动", "抵抗运动", "起义", "暴动", "镇压", "戒严",
      "议会斗争", "议会选举", "反对党", "执政联盟", "联合政府", "不信任案",
      "弹劾", "宪法危机", "政变", "军政府", "独裁", "人权", "政治犯",
      "原住民", "土地争端", "土地改革", "资源国有化", "国有化",
      "革命卫队", "人民解放军", "民族解放军", "武装组织",
    ],
    latin:
      /\b(defen[cs]e (?:budget|spending|ministry|contractor|contractors|industry|forces?|officials?|exports?|procurement|contracts?)|military (?:budget|spending|aid|assistance|bases?|drills?|exercises?|alliance|contracts?|technology|tech|commanders?|officials?|sales|procurement|deployment)|arms (?:deals?|sales?|race|control|embargo|shipments?|exports?|procurement)|weapons? (?:deals?|sales?|programs?|shipments?|systems?|exports?)|missiles?|ballistic|hypersonic|icbm|air defen[cs]e|warships?|destroyers?|frigates?|aircraft carriers?|submarines?|fighter jets?|warplanes?|bombers?|drones?|tanks?|armou?red vehicles?|troops|soldiers|deployments?|deployed|conscription|military draft|war games|military drills?|joint exercises?|nuclear arsenal|warheads?|nuclear tests?|disarmament|lockheed|raytheon|northrop|bae systems|pentagon|joint chiefs|four-star general|mercenar(?:y|ies)|paramilitary|militias?|air force|navy|armed forces|battalions?|brigades?|regiments?|live-fire|reconnaissance|special forces|radar|helicopters?|gunships?|artillery|mortars?|test-fir(?:e|ed|ing)|entered service|combat readiness|munition(?:s)?|rounds of ammunition|social movements?|mass protests?|protest movements?|general strikes?|labou?r movements?|trade unions?|student movements?|peasant movements?|left-wing|leftist|progressive movements?|anti-war|revolution(?:ary|aries)?|guerrilla(?:s)?|armed struggle|people'?s war|anti-imperialist|anti-colonial|national liberation|liberation movements?|resistance movements?|uprising|insurrection|repression|crackdown|martial law|parliamentary struggle|no-confidence (?:vote|motion)|opposition part(?:y|ies)|ruling coalition|coalition government|impeach(?:ment)?|constitutional crisis|coup|junta|dictatorship|political prisoners?|human rights|indigenous (?:rights|peoples?|communities)|land rights|land reform|nationalization|nationalisation|rebel(?:s|lion)?|insurgent(?:s|cy)?|liberation army|armed groups?|resistance committee)\b/gi,
    multi: [
      "budget militaire", "dépenses militaires", "armée", "troupes", "soldats",
      "missiles", "sous-marin", "porte-avions", "chasseurs", "drones",
      "manœuvres militaires", "arsenal nucléaire", "désarmement",
      "industrie de défense", "pentagone",
      "presupuesto militar", "gasto militar", "ejército", "tropas", "soldados",
      "misiles", "submarino", "portaaviones", "cazas", "drones",
      "maniobras militares", "arsenal nuclear", "desarme",
      "industria de defensa", "pentágono",
      "orçamento militar", "gastos militares", "exército", "tropas", "soldados",
      "mísseis", "submarino", "porta-aviões", "caças", "drones",
      "manobras militares", "arsenal nuclear", "desarmamento",
      "indústria de defesa", "pentágono",
    ],
  },
};

const SPECIALIZED = ["military", "science", "economy", "domestic"];
const MIN_CONCEPTS = 2;

// 涉外/外交题材即使发自国内源也留在国际，避免国内板块变成第二国际版
const DOMESTIC_FOREIGN =
  /美国|美方|欧洲|欧盟|日本|韩国|朝鲜|俄罗斯|乌克兰|中东|以色列|伊朗|加沙|联合国|北约|白宫|特朗普|普京|泽连斯基|外交|外长|大使|领事|出访|国事访问|国际社会|全球市场|海外|境外|中美|中日|中欧|中俄|中英|中法|中德|中印|中韩|中澳|中加|中菲|中越/;

// 社会运动/左翼/议会斗争：第三世界的罢工、游行、土地斗争等也归入军事板块
const MOVEMENT_LATIN =
  /\b(?:(?:workers?|students?|unions?|labou?r(?:ers)?|campesinos?|farmers?|peasants?|tenants?|activists?|demonstrators?|protesters?|grad(?:uate)? students?|academics?|teachers?|nurses?|miners?|dockers?|indigenous|tribal|ethnic minorities?)[^.]{0,40}\b(?:protest|strike|strikes|striking|march|marches|marching|rally|rallies|demonstrat\w*|walkouts?|pickets?|boycotts?|occup\w*|sit-ins?|struggle|fight|resist\w*|uprising|revolt\w*|blockade\w*|demand\w*)\b)|\b(?:general strike|mass strike|labou?r unrest|social unrest|anti-austerity|anti-privatization|land occupation|land reform|land rights|national liberation|anti-imperialist|anti-colonial|left-wing|leftist|progressive movement|student movement|people'?s movement|grassroots movement)\b/;
const MOVEMENT_ZH =
  /社会运动|群众运动|抗议|示威|游行|集会|静坐|罢课|罢工|工会|劳工|农民工|农民运动|学生运动|土地改革|土地争端|左翼|进步运动|反战|反帝|反殖民|民族解放|解放运动|抵抗运动|游击|武装斗争|人民战争|议会斗争|反对党|执政联盟|联合政府|不信任案|弹劾|政变|军政府|独裁|政治犯|原住民|资源国有化|国有化/;

export function isMovementStory(headline, text = headline) {
  const hay = String(headline ?? "");
  if (!hay) return false;
  return MOVEMENT_ZH.test(hay) || MOVEMENT_LATIN.test(hay);
}

// 基金/ETF/融资稿属于经贸题材，不因芯片、航天等题材词被算进科研
const FINANCE_PROMO =
  /ETF|基金|标的指数|投顾|红盘|涨近|A轮|融资|定增|可转债|股价|股票|IPO|估值|财报|营收|净利润|增持|回购|\b(etf|ipo|share price|stock price|valuation|earnings|net profit|revenue)\b/i;

function conceptCount(text, spec) {
  return (
    termHits(text, spec.zh).size +
    latinHits(text, spec.latin).size +
    termHits(text, spec.multi).size
  );
}

export function moduleScores(rep, otherTitles = [], context = {}) {
  const text = [rep?.title, rep?.titleOriginal, rep?.summary, ...otherTitles]
    .filter(Boolean)
    .join(" ");
  const base = classifyNews(rep)?.scores ?? {};
  const headline = [rep?.title, rep?.titleOriginal].filter(Boolean).join(" ");
  const zone = text ? detectZone(text, headline) : null;
  const promo = FINANCE_PROMO.test(text);
  const domesticSource = Boolean(context.domesticSource);
  // 省级媒体的源级省名权威：标题常省略省名（“市委常委会召开会议”）
  const province = context.province
    ? { id: context.province, score: 3 }
    : text
      ? detectProvince(headline, text)
      : null;
  const policyDoc = isPolicyDocument(rep?.title, rep?.summary);
  const chinese = (rep?.origin ?? "en") === "zh";
  const movement = headline ? isMovementStory(headline, text) : false;
  const world =
    (base.politics ?? 0) * 0.8 +
    (base.security ?? 0) * 0.7 +
    (base.actors ?? 0) * 0.5 +
    (base.frontier ?? 0) * 0.3 +
    (base.climate ?? 0) * 0.3 +
    (base.health ?? 0) * 0.25;
  const economy = text ? conceptCount(text, VOCAB.economy) : 0;
  const science = text ? conceptCount(text, VOCAB.science) : 0;
  const domestic =
    chinese && !DOMESTIC_FOREIGN.test(headline)
      ? (text ? conceptCount(text, VOCAB.domestic) : 0) +
        (province ? 3 : 0) +
        (policyDoc ? 5.5 : 0) +
        (domesticSource ? 2.5 : 0) +
        // 省级媒体首页的本地稿默认归国内，避免被经贸/科研分走导致省份空栏
        (context.province ? 4 : 0)
      : 0;
  return {
    world,
    economy: economy + (promo ? 3 : 0),
    science: promo ? Math.max(0, science - 3) : science,
    // 战线报道靠战区 + 冲突词加权进入军事，避免只收军购/装备稿
    military:
      (text ? conceptCount(text, VOCAB.military) : 0) +
      (zone ? zone.score * 1.5 : 0) +
      (movement ? 3 : 0),
    domestic,
  };
}

// 唯一分配：专业模块必须命中足够多的独立概念，且压过国际基线
export function assignModule(rep, otherTitles = [], context = {}) {
  const scores = moduleScores(rep, otherTitles, context);
  const top = SPECIALIZED.map((id) => ({ id, score: scores[id] })).sort(
    (a, b) => b.score - a.score,
  )[0];
  if (top.score >= MIN_CONCEPTS && top.score >= scores.world * 0.6) {
    return { id: top.id, scores };
  }
  return { id: "world", scores };
}
