import { latinHits, termHits } from "./editorial.mjs";

// 科研子领域：物理/化学/生物/计算机为前沿研究，应用前沿按工业/能源/航天/电子/医疗细分
export const SCIENCE_TOPICS = [
  {
    id: "physics",
    label: "物理",
    zh: [
      "物理", "量子", "粒子", "原子", "引力波", "暗物质", "暗能量", "超导", "核聚变",
      "等离子体", "激光", "光学", "凝聚态", "相对论", "希格斯", "中微子", "量子力学",
      "量子纠缠", "量子计算", "量子比特", "弦理论", "天体物理", "干涉测量", "光谱", "加速器", "反物质", "核物理", "物理学家",
      "星系", "宇宙", "暗宇宙", "望远镜", "天文", "宇宙学", "天体",
    ],
    latin: /\b(physicists?|physics|quantum|particle physics|subatomic|gravitational waves?|dark matter|dark energy|superconduct\w*|nuclear fusion|plasma|lasers?|optics|interferometry|spectroscopy|particle accelerators?|antimatter|condensed matter|relativity|higgs|neutrinos?|quantum computing|qubits?|string theory|astrophysics|astronomy|galaxies|galaxy|cosmos|cosmic|universe|telescopes?|observator(?:y|ies))\b/gi,
    multi: ["physique", "physiciens", "física", "físicos", "physik"],
  },
  {
    id: "chemistry",
    label: "化学",
    zh: [
      "化学", "催化", "催化剂", "化合物", "电解质", "石墨烯", "聚合物", "有机化学",
      "无机化学", "电化学", "化学键", "配位", "纳米材料", "新材料", "材料科学",
      "分子结构", "化学反应", "溶剂", "晶体", "电极", "化学工程", "电池材料", "锂", "配体",
    ],
    latin: /\b(chemists?|chemistry|cat(?:alyst|alysts|alysis)|compounds?|electrolytes?|graphene|polymers?|nanomaterials?|materials science|organic chemistry|electrochemistry|chemical reactions?|chemical engineering|electrodes?|lithium|molecules?|crystals?|compounds?)\b/gi,
    multi: ["chimie", "chimistes", "química", "químicos"],
  },
  {
    id: "biology",
    label: "生物",
    zh: [
      "生物", "基因", "基因组", "细胞", "蛋白质", "酶", "免疫", "病毒", "细菌",
      "微生物", "神经科学", "大脑", "进化", "物种", "生态", "疫苗", "抗体",
      "临床试验", "基因编辑", "干细胞", "癌细胞", "阿尔茨海默", "艾滋病", "疟疾",
      "脱氧核糖核酸", "核糖核酸", "生物多样性", "化石", "古生物", "微生物组", "农作物", "害虫", "农业", "减肥药", "口服药",
    ],
    latin: /\b(biologists?|biology|genes?|genetic|genetics|genome|crispr|cells?|proteins?|enzymes?|immune|virus(?:es)?|bacteri(?:a|um)|microbes?|neuroscience|evolution|species|ecosystems?|vaccines?|antibod(?:y|ies)|clinical trials?|stem cells?|cancer cells?|alzheimer'?s?|malaria|hiv|dna|rna|biodiversity|fossils?|microbiome|agricultural|crops?|pests?|glp-1|weight-loss drugs?|obesity drugs?|brains?|cognitive|animal cognition|crows?|birds?)\b/gi,
    multi: ["biologie", "biologistes", "gène", "cellules", "biología", "biólogos", "células"],
  },
  {
    id: "computing",
    label: "计算机",
    zh: [
      "人工智能", "大模型", "机器学习", "深度学习", "算法", "计算机", "大数据",
      "数据中心", "神经网络", "软件", "开源", "区块链", "超级计算机", "云计算",
      "数据安全", "编程", "芯片设计", "算力", "推理模型", "生成式", "数据集", "模型训练", "聊天机器人", "智能体",
    ],
    latin: /\b(artificial intelligence|machine learning|deep learning|large language models?|llms?|algorithms?|computer science|computing|big data|data centers?|neural networks?|software|open source|blockchain|supercomputers?|cloud computing|cybersecurity|semiconductor design|gpu|generative ai|ai models?|\bai\b|chatbots?|datasets?|model training|ai agents?)\b/gi,
    multi: ["intelligence artificielle", "apprentissage automatique", "inteligencia artificial", "aprendizaje automático", "inteligência artificial"],
  },
];

export const APPLIED_FIELDS = [
  {
    id: "industry",
    label: "工业",
    zh: ["工业", "智能制造", "机器人", "自动化", "3D打印", "增材制造", "工厂", "生产线", "工业互联网"],
    latin: /\b(industrial|manufacturing|robots?|robotic|robotics|automation|3d printing|additive manufacturing|smart factor(?:y|ies)|assembly lines?)\b/gi,
  },
  {
    id: "energy",
    label: "能源",
    zh: ["可再生能源", "光伏", "太阳能", "风电", "储能", "核电站", "核反应堆", "氢能", "电网", "充电", "燃料电池", "清洁能源"],
    latin: /\b(renewable energy|solar power|solar cells?|photovoltaic|wind (?:power|farm)|energy storage|nuclear (?:plant|plants|reactor|reactors|power)|hydrogen (?:fuel|power|energy)|power grids?|fuel cells?|clean energy|battery technology|solid-state batter(?:y|ies))\b/gi,
  },
  {
    id: "space",
    label: "航天",
    zh: ["航天", "卫星", "火箭", "探测器", "空间站", "月球", "火星", "载人航天", "星链", "太空望远镜", "发射任务", "轨道"],
    latin: /\b(spacex|rocket launch(?:es)?|satellites?|spacecraft|space stations?|lunar|mars mission|astronauts?|orbit(?:al)?|starlink|launch vehicles?|space telescopes?|space missions?|blue origin|ariane)\b/gi,
  },
  {
    id: "electronics",
    label: "电子",
    zh: ["芯片", "半导体", "光刻", "晶圆", "集成电路", "晶体管", "传感器", "显示器", "5G", "6G", "通信", "光子"],
    latin: /\b(semiconductors?|chips?|chipmakers?|lithography|wafers?|integrated circuits?|transistors?|electronics|sensors?|displays?|5g|6g|telecom|photonics)\b/gi,
  },
  {
    id: "medical",
    label: "医疗",
    zh: ["医疗", "医院", "诊断", "疗法", "手术", "医疗器械", "基因治疗", "胰岛素", "抗生素", "患者", "公共卫生", "医保", "远程医疗", "药物获批", "制药", "药企", "获批", "疗效", "礼来", "诺和诺德"],
    latin: /\b(medical|hospitals?|diagnostics?|therap(?:y|ies)|surgery|medical devices?|gene therapy|insulin|antibiotics?|patients?|public health|fda approval|drug approvals?|telehealth|health care|pharmaceuticals?|pharma|lilly|novo nordisk|obesity drug|weight-loss drug|obesity|bmi)\b/gi,
  },
];

function hits(text, spec) {
  let count = 0;
  if (spec.zh) count += termHits(text, spec.zh).size;
  if (spec.latin) count += latinHits(text, spec.latin).size;
  if (spec.multi) count += termHits(text, spec.multi).size;
  return count;
}

export function classifyScience(text) {
  if (!text) return { topic: "general", label: "综合", subtopic: null, subtopicLabel: null };
  const research = SCIENCE_TOPICS.map((topic) => ({ topic, score: hits(text, topic) }));
  const applied = APPLIED_FIELDS.map((field) => ({ field, score: hits(text, field) }));
  const bestResearch = research.sort((a, b) => b.score - a.score)[0];
  const bestApplied = applied.sort((a, b) => b.score - a.score)[0];

  if (bestApplied.score >= 1 && bestApplied.score >= bestResearch.score) {
    return {
      topic: "applied",
      label: "应用前沿",
      subtopic: bestApplied.field.id,
      subtopicLabel: bestApplied.field.label,
    };
  }
  if (bestResearch.score >= 1) {
    return {
      topic: bestResearch.topic.id,
      label: bestResearch.topic.label,
      subtopic: null,
      subtopicLabel: null,
    };
  }
  return { topic: "general", label: "综合", subtopic: null, subtopicLabel: null };
}

// 战区：坐标用于态势图热点，词表用于给军事报道分区
export const ZONES = [
  {
    id: "ukraine",
    label: "乌克兰",
    lat: 49.0,
    lon: 32.0,
    zh: ["乌克兰", "俄罗斯", "基辅", "莫斯科", "泽连斯基", "普京", "顿涅茨克", "哈尔科夫", "库尔斯克", "扎波罗热", "赫尔松", "俄军", "乌军", "顿巴斯"],
    latin: /\b(ukrain(?:e|ian|ians)|russia(?:n|ns)?|kyiv|kiev|moscow|zelensk\w*|putin|donetsk|kharkiv|kursk|zaporizhzhia|kherson|donbas)\b/gi,
  },
  {
    id: "gaza",
    label: "加沙",
    lat: 31.4,
    lon: 34.5,
    zh: ["加沙", "以色列", "哈马斯", "真主党", "黎巴嫩", "贝鲁特", "内塔尼亚胡", "约旦河西岸", "以军", "巴勒斯坦"],
    latin: /\b(gaza|israel(?:i|is)?|hamas|hezbollah|lebanon|beirut|netanyahu|west bank|idf|palestinian(?:s)?)\b/gi,
  },
  {
    id: "iran",
    label: "伊朗",
    lat: 32.4,
    lon: 53.6,
    zh: ["伊朗", "德黑兰", "革命卫队", "霍尔木兹"],
    latin: /\b(iran(?:ian)?|tehran|irgc|hormuz)\b/gi,
  },
  {
    id: "redsea",
    label: "红海",
    lat: 15.0,
    lon: 42.5,
    zh: ["胡塞", "也门", "红海", "曼德海峡"],
    latin: /\b(houthis?|yemen(?:i)?|red sea|bab el-mandeb)\b/gi,
  },
  {
    id: "syria",
    label: "叙利亚",
    lat: 34.8,
    lon: 38.6,
    zh: ["叙利亚", "大马士革", "阿萨德"],
    latin: /\b(syria(?:n)?|damascus|assad)\b/gi,
  },
  {
    id: "sudan",
    label: "苏丹",
    lat: 15.6,
    lon: 30.2,
    zh: ["苏丹", "喀土穆", "达尔富尔", "快速支援部队"],
    latin: /\b(sudan(?:ese)?|khartoum|darfur|rsf)\b/gi,
  },
  {
    id: "sahel",
    label: "萨赫勒",
    lat: 14.5,
    lon: -1.5,
    zh: ["马里", "布基纳法索", "尼日尔", "萨赫勒", "博科圣地"],
    latin: /\b(mali|burkina faso|niger|sahel|jnim|boko haram)\b/gi,
  },
  {
    id: "congo",
    label: "刚果（金）",
    lat: -1.7,
    lon: 29.2,
    zh: ["刚果", "戈马", "基伍", "M23"],
    latin: /\b(drc|congo|m23|goma|kivu)\b/gi,
  },
  {
    id: "latam",
    label: "拉美",
    lat: 4.0,
    lon: -73.0,
    zh: ["哥伦比亚", "委内瑞拉", "厄瓜多尔", "海地", "卡塔通博"],
    latin: /\b(colombia(?:n)?|venezuela(?:n)?|ecuador|haiti|catatumbo|eln|farc)\b/gi,
  },
  {
    id: "myanmar",
    label: "缅甸",
    lat: 21.5,
    lon: 96.2,
    zh: ["缅甸", "军政府", "若开", "民族团结政府"],
    latin: /\b(myanmar|burma|junta|rakhine|pdf)\b/gi,
  },
  {
    id: "southeast",
    label: "东南亚",
    lat: 8.0,
    lon: 108.0,
    zh: ["泰国", "柬埔寨", "印度尼西亚", "马来西亚", "越南", "老挝", "雅加达", "曼谷", "金边", "吉隆坡"],
    latin: /\b(thai(?:land)?|cambodia(?:n)?|indonesia(?:n)?|malaysia(?:n)?|vietnam(?:ese)?|laos|jakarta|bangkok|phnom penh|kuala lumpur)\b/gi,
  },
  {
    id: "kashmir",
    label: "克什米尔",
    lat: 34.0,
    lon: 77.0,
    zh: ["克什米尔", "印控克什米尔", "斯利那加", "印巴"],
    latin: /\b(kashmir(?:i)?|srinagar|india-pakistan|line of control)\b/gi,
  },
  {
    id: "ethiopia",
    label: "埃塞俄比亚",
    lat: 9.0,
    lon: 40.0,
    zh: ["埃塞俄比亚", "提格雷", "厄立特里亚", "亚的斯亚贝巴", "非洲之角"],
    latin: /\b(ethiopia(?:n)?|tigray|eritrea(?:n)?|addis ababa|horn of africa)\b/gi,
  },
  {
    id: "somalia",
    label: "索马里",
    lat: 5.0,
    lon: 46.0,
    zh: ["索马里", "摩加迪沙", "青年党", "邦特兰"],
    latin: /\b(somalia(?:n)?|mogadishu|al-shabaab|shabaab|puntland)\b/gi,
  },
  {
    id: "mexico",
    label: "墨西哥",
    lat: 23.6,
    lon: -102.5,
    zh: ["墨西哥", "锡那罗亚", "米却肯", "哈利斯科", "贩毒集团"],
    latin: /\b(mexico|mexican|sinaloa|michoacan|jalisco|cartel(?:s)?)\b/gi,
  },
  {
    id: "scs",
    label: "南海",
    lat: 12.0,
    lon: 114.0,
    zh: ["南海", "台海", "台湾海峡", "南沙", "黄岩岛", "菲律宾"],
    latin: /\b(south china sea|taiwan strait|spratly|scarborough|philippines)\b/gi,
  },
  {
    id: "afghan",
    label: "阿富汗",
    lat: 34.5,
    lon: 69.2,
    zh: ["阿富汗", "塔利班", "巴基斯坦"],
    latin: /\b(afghanistan|taliban|ttp|pakistan(?:i)?)\b/gi,
  },
  {
    id: "caucasus",
    label: "高加索",
    lat: 40.1,
    lon: 47.0,
    zh: ["亚美尼亚", "阿塞拜疆", "纳卡"],
    latin: /\b(armenia(?:n)?|azerbaijan(?:i)?|nagorno|karabakh)\b/gi,
  },
  {
    id: "korea",
    label: "朝鲜半岛",
    lat: 38.3,
    lon: 127.5,
    zh: ["朝鲜", "平壤", "非军事区", "金正恩"],
    latin: /\b(north korea|pyongyang|dmz|kim jong)\b/gi,
  },
];

const CONFLICT = {
  zh: ["袭击", "空袭", "轰炸", "导弹", "无人机", "炮击", "交火", "战斗", "攻势", "前线", "停火", "伤亡", "阵亡", "撤离", "占领", "反攻", "军事行动", "战报", "战线", "冲突", "政变", "军政府", "叛乱", "叛军", "武装分子", "民兵", "游击队", "内战", "戒严", "分离主义", "起义", "清剿", "伏击"],
  latin: /\b(strikes?|attacks?|offensives?|shelling|ceasefire|front line|battles?|drones?|missiles?|air raids?|assault|casualties|killed|wounded|retreat|capture|troops|clashes?|coup|junta|insurgen(?:t|ts|cy)|rebels?|militants?|militias?|separatists?|uprising|civil war|martial law|armed groups?|ambush(?:es)?)\b/gi,
};

// 只是顺带提到战区、实为气候/房产/签证/司法/卫生的稿件不进战报
const ZONE_NOISE =
  /碳排放|碳排|carbon emissions?|climate|房地产|房产|real estate|property fair|签证|visa|引渡|extradit|嫌疑人|suspect|遇害|谋杀|murder|被判|判刑|jailed|法院|法庭|court|埃博拉|ebola|疫情|outbreak|融资|股价|ETF|基金|indicted|convicted|indictment|sentenced|被判|定罪|起诉/i;

export function detectZone(text, headline = text) {
  if (!text) return null;
  const title = headline || text;
  if (ZONE_NOISE.test(title)) return null;
  let best = null;
  for (const zone of ZONES) {
    const score = hits(title, zone);
    if (score > 0 && (!best || score > best.score)) best = { zone, score };
  }
  if (!best) return null;
  const conflict = hits(text, CONFLICT);
  const weight = best.score + conflict * 0.5;
  if (weight < 1.5) return null;
  return { id: best.zone.id, label: best.zone.label, score: weight };
}

export const ZONE_ORDER = ZONES.map((zone) => zone.id);

// 34 个省级行政区：省名 + 省会/主要城市，用于给国内报道归省（源级 province 优先）
export const PROVINCES = [
  { id: "beijing", label: "北京", zh: ["北京", "北京市"] },
  { id: "tianjin", label: "天津", zh: ["天津", "天津市"] },
  { id: "hebei", label: "河北", zh: ["河北", "石家庄", "雄安", "唐山", "保定"] },
  { id: "shanxi", label: "山西", zh: ["山西", "太原", "大同"] },
  { id: "inner-mongolia", label: "内蒙古", zh: ["内蒙古", "呼和浩特", "包头", "鄂尔多斯"] },
  { id: "liaoning", label: "辽宁", zh: ["辽宁", "沈阳", "大连", "鞍山"] },
  { id: "jilin", label: "吉林", zh: ["吉林", "长春", "延边"] },
  { id: "heilongjiang", label: "黑龙江", zh: ["黑龙江", "哈尔滨", "齐齐哈尔", "大庆"] },
  { id: "shanghai", label: "上海", zh: ["上海", "上海市", "浦东"] },
  { id: "jiangsu", label: "江苏", zh: ["江苏", "南京", "苏州", "无锡", "南通"] },
  { id: "zhejiang", label: "浙江", zh: ["浙江", "杭州", "宁波", "温州", "义乌"] },
  { id: "anhui", label: "安徽", zh: ["安徽", "合肥", "芜湖"] },
  { id: "fujian", label: "福建", zh: ["福建", "福州", "厦门", "泉州"] },
  { id: "jiangxi", label: "江西", zh: ["江西", "南昌", "赣州"] },
  { id: "shandong", label: "山东", zh: ["山东", "济南", "青岛", "烟台", "潍坊"] },
  { id: "henan", label: "河南", zh: ["河南", "郑州", "洛阳", "开封"] },
  { id: "hubei", label: "湖北", zh: ["湖北", "武汉", "宜昌", "襄阳"] },
  { id: "hunan", label: "湖南", zh: ["湖南", "长沙", "株洲", "湘潭"] },
  { id: "guangdong", label: "广东", zh: ["广东", "广州", "深圳", "珠海", "东莞", "佛山"] },
  { id: "guangxi", label: "广西", zh: ["广西", "南宁", "桂林", "柳州"] },
  { id: "hainan", label: "海南", zh: ["海南", "海口", "三亚", "儋州"] },
  { id: "chongqing", label: "重庆", zh: ["重庆", "重庆市"] },
  { id: "sichuan", label: "四川", zh: ["四川", "成都", "绵阳", "宜宾"] },
  { id: "guizhou", label: "贵州", zh: ["贵州", "贵阳", "遵义"] },
  { id: "yunnan", label: "云南", zh: ["云南", "昆明", "大理", "丽江"] },
  { id: "tibet", label: "西藏", zh: ["西藏", "拉萨", "日喀则"] },
  { id: "shaanxi", label: "陕西", zh: ["陕西", "西安", "宝鸡", "延安"] },
  { id: "gansu", label: "甘肃", zh: ["甘肃", "兰州", "敦煌"] },
  { id: "qinghai", label: "青海", zh: ["青海", "西宁"] },
  { id: "ningxia", label: "宁夏", zh: ["宁夏", "银川"] },
  { id: "xinjiang", label: "新疆", zh: ["新疆", "乌鲁木齐", "喀什", "伊犁"] },
  { id: "hongkong", label: "香港", zh: ["香港", "香港特区", "港府", "李家超"] },
  { id: "macau", label: "澳门", zh: ["澳门", "澳门特区", "澳門", "澳府", "岑浩辉"] },
  {
    id: "taiwan",
    label: "台湾",
    zh: ["台湾", "台灣", "台北", "高雄", "台中", "两岸", "台海", "台胞", "国台办"],
  },
];

export const PROVINCE_ORDER = PROVINCES.map((province) => province.id);

export function detectProvince(headline, text = headline) {
  for (const scope of [headline, text]) {
    if (!scope) continue;
    let best = null;
    for (const province of PROVINCES) {
      const score = termHits(scope, province.zh).size;
      if (score > 0 && (!best || score > best.score)) best = { province, score };
    }
    if (best) return { id: best.province.id, label: best.province.label, score: best.score };
  }
  return null;
}

// 政策文件专栏：中央/国办发文、规划纲要、会议决定等，标题级识别
const POLICY_ISSUER =
  /中共中央|国务院|中央办公厅|国务院办公厅|中办|国办|政治局|全国人大|全国政协|中央经济工作会议|中央农村工作会议|最高人民法院|最高人民检察院|财政部|教育部|工信部|公安部|民政部|人社部|自然资源部|生态环境部|住建部|交通运输部|水利部|农业农村部|商务部|文旅部|卫健委|应急管理部|国资委|市场监管总局|统计局|医保局|税务总局|海关总署|省委|省政府|省人民政府|自治区党委|自治区人民政府|市人民政府|政府办公厅|人民政府办公厅/;
const POLICY_ACTION =
  /印发|发布|公布|出台|审议通过|表决通过|施行|实施|修订|通知|意见|条例|规定|办法|规划|纲要|决定|白皮书|方案|批复/;

export function isPolicyDocument(title) {
  const headline = String(title ?? "");
  if (!headline) return false;
  if (/^[\u4e00-\u9fa5（）()·、\s]{2,30}(?:条例|规定|办法|决定|规划|纲要|方案|通知|意见|批复)$/.test(headline)) {
    return true;
  }
  if (!POLICY_ACTION.test(headline)) return false;
  return POLICY_ISSUER.test(headline) || /《[^》]+》/.test(headline);
}
