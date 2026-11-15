import { SOURCE_MAP } from "./sources.mjs";

const OPINION_URL =
  /\/(?:opinion|opinions|comment|comments|editorial|editorials|analysis|views|columns?|blogs?)(?:\/|$)/i;
const SOFT_URL =
  /\/(?:entertainment|celebrities|celebrity|sports?|lifestyle|travel|food|fashion|music|movies?|film|tv|arts|culture|books|games|relationships|podcasts?|audio|radio)(?:\/|$)/i;
const LIVE_URL = /\/(?:live|liveblog|live-news|live-updates)(?:\/|$)/i;
const LIVE_TITLE =
  /\blive\s+(?:blog|updates?|coverage|news)\b|\ben vivo\b|\bdirecto\b|(?:—|–|-)\s*[^-]{0,40}\blive\s*$|直播/i;

const OPINION_TITLE =
  /^(?:why\b|how\b|what\b[^.]*\bmeans\b|the case for\b|we (?:must|need|should)\b|in defense of\b|the real reason\b|opinion\b|commentary\b|editorial\b|analysis\b|interview\b|exclusive interview\b)|(?:评论|观点|专栏|社论|锐评|观察|解析|解读|为什么|如何看|我们该|专访|访谈|问答|手记|随笔|怒批|痛批|驳斥|没有任何前途|引发共鸣|正告|喊话)/i;

const SOFT_TERMS = [
  "明星", "艺人", "娱乐", "综艺", "真人秀", "电影", "影片", "电视剧", "剧集",
  "音乐", "演唱会", "专辑", "时尚", "穿搭", "美食", "食谱", "旅游", "景点",
  "体育", "足球", "篮球", "奥运", "世界杯", "球员", "联赛", "网红", "博主",
  "游戏", "动漫", "漫画", "婚礼", "恋情", "选美", "票房", "拍卖", "照片",
  "晕倒", "仪仗队", "庆祝活动", "节日", "排灯节", "劫案", "抢劫", "盗窃",
  "牛粪", "写真", "红毯", "首映",
  "早报", "晨报", "午报", "晚报", "周报", "简讯", "盘点", "榜单", "排行",
  "测评", "导购", "攻略", "种草", "直播预告", "节目单", "周年", "纪念日",
  "celebrity", "actor", "actress", "singer", "rapper", "movie", "film",
  "tv series", "box office", "music", "album", "concert", "fashion",
  "recipe", "restaurant", "travel", "tourism", "sport", "football",
  "soccer", "basketball", "olympic", "world cup", "player", "league",
  "influencer", "video game", "anime", "manga", "wedding", "dating",
  "auction", "red carpet", "premiere",
  "robbery", "jewelry", "jewellery", "heist", "burglar", "motorbike", "faint",
  "guard of honor", "guards collapse", "guard collapses", "pass out",
  "photographer", "cow dung", "diwali",
  "morning briefing", "daily briefing", "newsletter", "roundup",
  "weekly wrap", "what to know", "things to know", "best of", "review roundup",
  "anniversary", "commemorat", "celebrates",
];

const SERIOUS_TERMS = [
  "政府", "总统", "总理", "首相", "议会", "国会", "选举", "外交", "外长",
  "防长", "国防", "军队", "军事", "战争", "冲突", "停火", "和谈", "谈判",
  "制裁", "关税", "贸易", "预算", "法案", "法院", "判决", "起诉", "逮捕",
  "抗议", "镇压", "政变", "叛乱", "袭击", "空袭", "导弹", "无人机", "核",
  "难民", "边境", "主权", "条约", "峰会", "联合国", "北约", "欧盟", "央行",
  "利率", "通胀", "经济", "能源", "石油", "危机", "政策", "救援", "援助",
  "气候", "粮食", "农业", "干旱", "水危机",
  "government", "president", "prime minister", "parliament", "congress",
  "election", "diplomat", "foreign minister", "defense", "military", "war",
  "conflict", "ceasefire", "talks", "sanction", "tariff", "trade", "budget",
  "bill", "court", "ruling", "verdict", "prosecutor", "arrest", "protest",
  "crackdown", "coup", "insurgency", "attack", "airstrike", "missile",
  "drone", "nuclear", "refugee", "border", "sovereignty", "treaty", "summit",
  "united nations", "nato", "european union", "central bank", "interest rate",
  "inflation", "economy", "energy", "oil", "crisis", "policy", "aid",
];

const FRONTIER_TERMS = [
  "人工智能治理", "人工智能", "AI 治理", "半导体", "芯片", "稀土", "关键矿产",
  "海底电缆", "卫星", "太空", "北极", "量子", "生物安全", "大流行", "网络安全",
  "虚假信息", "干预选举", "水安全", "粮食安全", "人口结构", "老龄化",
  "移民协议", "深度伪造", "无人机战争", "自主武器", "绿氢", "电网", "核聚变",
  "去美元化", "规避制裁", "影子舰队",
  "critical minerals", "rare earth", "semiconductor", "chip", "undersea cable",
  "subsea cable", "satellite", "space", "arctic", "quantum", "biosecurity",
  "pandemic", "cyberattack", "ransomware", "hackers", "data breach",
  "disinformation", "election interference",
  "water security", "food security", "demographics", "aging", "deepfake",
  "autonomous weapons", "green hydrogen", "power grid", "nuclear fusion",
  "de-dollarization", "sanctions evasion", "shadow fleet", "AI governance",
  "artificial intelligence", "AI",
];

const OFFICIAL_ACTOR =
  /(总统|总理|首相|外长|防长|部长|议会|国会|白宫|克里姆林宫|国务院|外交部|国防部|联合国|安理会|欧盟委员会|北约|法院|央行|president|prime minister|foreign minister|defense minister|White House|Kremlin|State Department|Pentagon|United Nations|Security Council|European Commission|NATO|central bank|court)/i;

const HARD_EVENT =
  /(袭击|空袭|爆炸|死亡|遇难|受伤|停火|签署|通过|否决|判决|制裁|逮捕|辞职|下台|当选|宣战|入侵|撤离|谈判|协议|attack|airstrike|explosion|killed|dead|ceasefire|signed|approved|rejected|ruled|sanction|arrest|resign|elected|invasion|withdraw|talks|deal)/i;

// 内容分类：把标题、原文标题、摘要拼起来，按「命中的不同概念数」判定。
// 单一关键词命中不足以决定去留，必须同类概念累计到阈值。
const CATEGORY = {
  politics: {
    zh: [
      "政府", "总统", "副总统", "总理", "首相", "议会", "国会", "参议院", "参议员",
      "众议院", "内阁", "部长", "外长", "防长", "外交部", "国务院", "联合国", "北约",
      "欧盟", "欧盟委员会", "委员会", "央行", "法院", "最高法院", "宪法", "选举",
      "中期选举", "投票", "法案", "立法", "预算", "税收", "关税", "制裁", "条约",
      "公约", "峰会", "外交", "谈判", "和谈", "停火", "协议", "政策", "改革", "辞职",
      "当选", "就任", "主权", "边境", "难民", "移民", "抗议", "罢工", "政变",
      "叛乱", "情报", "办事处", "白宫", "克里姆林宫", "新闻自由", "记者", "特使",
      "前总理", "前总统", "前首相", "前外长", "安理会", "发言人",
    ],
    latin:
      /\b(government|presidents?|vice president|prime minister|premier|parliament|congress|senate|senators?|house of representatives|mps?|cabinet|ministers?|foreign ministry|state department|united nations|nato|european union|european commission|central bank|supreme court|courts?|constitutional|elections?|midterms?|votes?|voting|bill|legislation|budget|tax|tariffs?|sanctions?|treaty|convention|summit|diplomat|diplomacy|talks|ceasefire|deal|policy|reforms?|resign(?:s|ed|ation)|elected|sovereignty|borders?|refugees?|migrants?|protests?|strikes?|coup|insurgency|intelligence|embassy|representative office|white house|kremlin|press freedom|journalists?|envoys?|ex-pm|former (?:prime minister|president|premier)|republicans?|democrats?|impeach(?:ment)?|crackdown|humanitarian|displaced|fleeing|famine|malnutrition|refugee camps?|ambassadors?|legislators?|governors?|collective security|european security|migration|visas?)\b/gi,
    multi: [
      "gouvernement", "président", "premier ministre", "ministre", "parlement",
      "élection", "sénat", "assemblée nationale", "diplomatie", "sanctions",
      "traité", "sommet", "réforme", "démission", "négociation", "accord",
      "manifestants", "ambassadeur", "journalistes", "liberté de la presse",
      "tribunal constitutionnel", "cour suprême",
      "gobierno", "presidente", "primer ministro", "ministro", "parlamento",
      "elecciones", "senado", "cumbre", "diplomacia", "sanciones", "tratado",
      "reforma", "dimisión", "negociación", "manifestantes", "embajador",
      "senador", "senadora", "periodistas", "libertad de prensa",
      "tribunal constitucional", "corte suprema", "presidencia",
      "governo", "presidente", "primeiro-ministro", "ministro", "parlamento",
      "eleições", "senado", "cúpula", "diplomacia", "sanções", "tratado",
      "renúncia", "negociação", "negociações", "acordo", "manifestantes",
      "embaixador", "senador", "jornalistas", "liberdade de imprensa",
      "presidencial", "justiça",
    ],
  },
  security: {
    zh: [
      "军方", "军队", "军事", "国防", "战争", "冲突", "空袭", "袭击", "导弹", "无人机",
      "核武器", "武器", "军火", "士兵", "武装", "恐怖", "暗杀", "刺杀", "演习",
      "入侵", "占领", "维和", "换俘", "间谍",
    ],
    latin:
      /\b(military|army|defen[cs]e|wars?|conflicts?|air ?strikes?|strikes? (?:on|kills?|hits?|targets?)|attacks?|missiles?|drones?|nuclear|arms|weapons?|soldiers?|troops|armed|terror(?:ism|ist)?|assassinations?|assassinate|plot to kill|eliminate|invasion|occupied|offensive|shelling|artillery|peacekeep(?:ers|ing)|deployments?|prisoner swap|spy(?:ing)?|espionage)\b/gi,
    multi: [
      "militaire", "armée", "guerre", "attaque", "missile", "soldats",
      "troupes", "cessez-le-feu", "militar", "ejército", "guerra", "ataque",
      "misil", "soldados", "tropas", "alto el fuego", "exército", "míssil",
      "cessar-fogo",
    ],
  },
  economy: {
    zh: [
      "经济", "贸易", "通胀", "利率", "货币", "债务", "能源", "石油", "天然气",
      "液化天然气", "出口", "进口", "供应链", "投资", "贷款", "财政",
      "房贷利率", "住房市场", "房价", "家庭债务", "消费支出", "工资", "裁员",
      "招聘", "劳动力市场", "失业救济", "工厂订单", "工业生产", "贸易逆差",
      "贸易顺差", "经常账户", "外国直接投资", "刺激计划", "救助", "私有化",
      "国有化", "价格上限", "欧佩克", "上市", "估值", "初创企业", "营收",
      "利润", "芯片制造商", "汽车制造商", "零售商", "出口商", "制造商", "运费",
    ],
    latin:
      /\b(economy|economic|trade|inflation|interest rates?|rate hikes?|producer prices|currenc(?:y|ies)|debt|energy|oil|gas|lng|exports?|imports?|supply chains?|investment|loans?|fiscal|gdp|mortgage rates?|housing market|home sales|property prices?|household debt|consumer spending|layoffs?|jobless claims|labor market|trade deficits?|trade surpluses?|current account|stimulus|bailouts?|privatization|nationalization|valuation|startups?|revenues?|profits?|opec|ipo|chipmakers?|automakers?|retailers?|exporters?|manufacturers?|shipping costs?)\b/gi,
    multi: [
      "économie", "inflation", "tarifs", "commerce", "budget", "dette",
      "exportations", "importations", "economía", "inflación", "aranceles",
      "comercio", "presupuesto", "deuda", "exportaciones", "importaciones",
      "economia", "inflação", "tarifas", "comércio", "orçamento", "dívida",
      "exportações", "importações",
    ],
  },
  research: {
    zh: [
      "研究", "研究人员", "科学家", "科研", "科学研究", "实验", "论文", "学术期刊",
      "期刊", "天文", "星系", "宇宙", "黑洞", "望远镜", "探测器", "航天", "太空",
      "卫星", "火箭", "月球", "火星", "行星", "小行星", "彗星", "轨道", "宇航员",
      "粒子", "原子", "分子", "蛋白质", "酶", "细胞", "免疫", "抗体", "细菌",
      "微生物", "基因", "基因组", "进化", "化石", "物种", "生态", "生物多样性",
      "神经科学", "大脑", "心理学", "考古", "人类学", "恐龙", "火山", "冰川",
      "海洋", "珊瑚", "蜜蜂", "鲸鱼", "疫苗", "临床试验", "药物", "胰岛素",
      "抗生素", "肥胖", "癌症", "阿尔茨海默", "疟疾", "艾滋病", "患者", "公共卫生",
    ],
    latin:
      /\b(research(?:ers?)?|scientists?|scientific|peer-reviewed|journals?|galaxies|galaxy|cosmos|cosmic|universe|black holes?|exoplanets?|telescopes?|observator(?:y|ies)|astronom(?:y|ers?)|asteroids?|comets?|orbit(?:er|ers)?|astronauts?|spacecraft|rovers?|particles?|atoms?|molecules?|proteins?|enzymes?|cells?|immune|antibod(?:y|ies)|bacteri(?:a|um)|microbes?|genome|genetic|dna|rna|evolution|fossils?|species|ecosystems?|biodiversity|neuroscience|psychology|archaeolog(?:y|ists?)|anthropolog(?:y|ists?)|dinosaurs?|volcano(?:es)?|glaciers?|coral|whales?|bees?|vaccines?|clinical trials?|medication|pharmaceuticals?|pharma|insulin|antibiotics?|obesity|alzheimer'?s?|malaria|hiv|patients?|public health)\b/gi,
    multi: [
      "recherche", "chercheurs", "scientifiques", "découverte", "essai clinique",
      "vaccin", "génome", "paléontologie", "archéologie",
      "investigación", "científicos", "descubrimiento", "ensayo clínico",
      "vacuna", "genoma", "paleontología", "arqueología",
      "pesquisa", "cientistas", "descoberta", "ensaio clínico", "vacina",
      "genoma", "paleontologia", "arqueologia",
    ],
  },
  health: {
    zh: [
      "疫情", "埃博拉", "病毒", "疫苗", "世卫", "世界卫生组织", "公共卫生", "流行病",
      "霍乱", "麻疹",
    ],
    latin:
      /\b(outbreak|ebola|virus|vaccines?|who|world health organization|pandemic|epidemic|public health|cholera|measles|disease|bird flu|avian flu|h5n1)\b/gi,
    multi: [
      "épidémie", "vaccin", "grippe aviaire", "santé publique", "ébola",
      "brote", "epidemia", "vacuna", "gripe aviar", "salud pública", "ébola",
      "surto", "vírus", "vacina", "gripe aviária", "saúde pública", "ebola",
    ],
  },
  climate: {
    zh: ["气候", "排放", "减排", "碳中和", "可再生能源", "干旱", "粮食安全", "水安全"],
    latin: /\b(climate|emissions|carbon|renewables?|cop\d+|drought|food security|water security)\b/gi,
    multi: [
      "climat", "sécheresse", "émissions", "énergies renouvelables",
      "clima", "sequía", "emisiones", "energías renovables",
      "seca", "emissões", "energias renováveis",
    ],
  },
  crime: {
    zh: [
      "枪击", "枪战", "枪案", "枪手", "枪杀", "中枪", "开枪", "枪伤", "枪响", "射杀",
      "警匪", "劫匪", "劫案", "抢劫", "持械", "入室盗窃", "盗窃", "诈骗", "谋杀",
      "凶杀", "命案", "绑架", "勒索", "贩毒", "毒品", "走私", "人口贩运", "性侵",
      "性虐待", "性骚扰", "性暴力", "猥亵", "斗殴", "醉驾", "酒驾", "肇事逃逸",
      "帮派", "黑帮", "连环杀手", "治安", "炸弹威胁", "炸弹恐吓", "假票", "黄牛",
      "劫持", "劫机", "枪决", "炸弹警报",
    ],
    latin:
      /\b(shootings?|gunshots?|gunfire|shots? fired|gunm[ae]n|shootouts?|(?:people|man|men|woman|women|boy|girl|teen|teens|child|children|students?|officers?|cops?|persons?)\s+shot|shot\s+(?:dead|and killed)|mass shooting|robber(?:y|ies)|robbers?|armed robbers?|heists?|burglars?|burglary|carjackings?|murders?|homicides?|stabbings?|kidnappings?|kidnappers?|abductions?|drug busts?|drug trafficking|smugglers?|smuggling|frauds?|scams?|rip-offs?|assaults?|gang violence|armed gangs?|mafia|arrest(?:s|ed)?|bomb (?:threats?|hoax(?:es)?|alerts?)|sexual abuse|abusos? sexual(?:es)?|abuso sexual|abus sexuels?|counterfeit tickets?|ticket scalpers?|wounded|shoots?|tiroteos?|tiroteios?|baleados?|asesinatos?|secuestros?|fusillades?|meurtres?|braquages?|enl[eè]vements?)\b/gi,
    multi: [
      "fusillade", "meurtre", "braquage", "cambriolage", "enlèvement",
      "agression", "viol", "trafic de drogue", "escroquerie", "fraude",
      "tuerie", "ravisseur", "tiroteo", "asesinato", "robo", "atraco",
      "secuestro", "violación", "tráfico de drogas", "estafa", "balacera",
      "matanza", "secuestrador", "tiroteio", "assassinato", "assalto",
      "sequestro", "estupro", "furto", "chacina", "sequestrador", "abuso",
      "ameaça de bomba", "ameaças de bomba",
    ],
  },
  soft: {
    zh: SOFT_TERMS,
    latin:
      /\b(tourists?|cuisine|chef|box office|viral|heartwarming|reunites?|reunion|spreads joy|red carpet|olympics?|youth olympics|managers?|coach|club|match|squad|championship|tournament|singles'? day|double 11|shopping (?:festival|event|spree)|black friday|cyber monday)\b/gi,
    multi: [
      "acteur", "actrice", "chanteur", "chanteuse", "musique", "concert",
      "cinéma", "mode", "célébrité", "mariage", "petite amie", "petit ami",
      "tapis rouge", "avant-première", "people", "mannequin", "série télévisée",
      "actriz", "cantante", "música", "concierto", "cine", "película", "moda",
      "celebridad", "boda", "novia", "novio", "alfombra roja", "estreno",
      "famosos", "farándula", "ator", "atriz", "cantor", "cantora", "cinema",
      "filme", "celebridade", "casamento", "namorada", "namorado",
      "tapete vermelho", "estreia", "novela", "grammy", "latin grammy",
    ],
  },
  society: {
    zh: [
      "坍塌", "倒塌", "事故", "起火", "火灾", "车祸", "坠机", "失踪", "救援", "遇难",
      "死亡人数", "受伤", "疏散", "爆炸", "洪水", "地震", "灾害", "团聚", "生还",
      "走失", "奇迹",
    ],
    latin:
      /\b(collapses?|collapsed|accidents?|crashes?|crash|fires?|missing|rescues?|rescue|victims?|injured|evacuat(?:ed|ions?)|explosions?|floods?|earthquakes?|reunited|survivors?|killed|dead|death toll|wounded|funeral)\b/gi,
    multi: [
      "effondrement", "incendie", "accident", "inondation", "séisme",
      "disparu", "disparue", "blessés", "victimes", "sauvetage", "évacués",
      "derrumbe", "colapso", "incendio", "accidente", "inundación",
      "terremoto", "desaparecido", "desaparecida", "heridos", "víctimas",
      "rescate", "evacuados", "fallecidos", "desabamento", "incêndio",
      "enchente", "desaparecido", "feridos", "vítimas", "resgate", "mortos",
      "tempestade",
    ],
  },
};

const ANALYSIS_TITLE =
  /\blessons? (?:for|from)\b|\bbetting on\b|\bwhat .{0,60} teaches\b|(?:启示|意味着什么|说明了什么|押注于)/i;

const FEATURE_TITLE =
  /^(?:watch|video|in pictures|in photos|explainer|takeaways?|what we know|everything we know)\b|(?:in pictures|in photos)\s*$|\b(?:pleased to welcome|is joined by|sat down with)\b|^(?:视频|图集|组图|图解|盘点|科普)\s*[:：]/i;

// 资讯汇编、早报与庆典稿不是硬新闻
const ROUNDUP_TITLE =
  /(?:早报|晨报|午报|晚报|周报|快讯汇总|盘点|榜单|周榜|月榜|播客|七大亮点|本周亮点|一周亮点|今日看点|\bTOP\s*\d+|\broundup\b|\bmorning briefing\b|\bdaily briefing\b|\bnewsletter\b|\bwhat to know\b|\bthings to know\b|\bpodcast\b)/i;
const CEREMONY_TITLE =
  /(?:周年|纪念日|\banniversary\b|\bmarks? \d+ (?:years|yrs)\b|\bcommemorat\w*|\bcelebrates?\b|\bpass in review\b)/i;
// 宣传化栏目稿（学习卡、图解、海报式内容）没有事件信息，按软新闻剔除
const PROPAGANDA_TITLE =
  /(?:学习卡|学习手记|天天学习|镜观[·・]?足迹|文脉华章|中南海月刊|看图学习|微纪录片|微视频|专题片|宣传片|海报|H5|手绘|漫评)/i;
// 治安案件与市井诈骗不进入硬新闻
const CRIME_TITLE =
  /(获刑|判刑|入狱|诈骗|骗了|被骗|盗窃|抢劫|抢夺|斗殴|行凶|强奸|猥亵|贩毒|吸毒|赌博|黑吃黑|涉黑|涉恶|命案|凶杀|纵火|拐卖|传销)/;
// 文娱展演与探店式栏目稿没有事件信息
const CULTURE_FEATURE =
  /(展演|小戏|小品|戏曲|话剧|音乐剧|艺术节|文旅节|京剧|打卡|手账|[Vv]log|探店|民宿|亲子游|研学|书画展|摄影展|探访|汉服|华裳|展览会|博览会|展销会|大赛|展示活动|经验交流|启幕|演出|文化节|旅游|游客|景区|露营|市集|理赔|违约金|索赔|文物|博物|美术馆|非遗|书画|购物潮|消费季|逐梦|创业答案|共话|文化之桥|文明互鉴|手稿|信札|史料|旧址|故居|纪念馆|生辰|诞辰|遗物|手迹|表情包|梗图|\bmemes?\b|讲述.{0,12}故事|从.{2,20}看.{0,16}(?:良方|密码|答案|新路)|雾凇|花海|赏花|如画|仙境|层林尽染|打卡地|初冬|深秋|冰雪游|滑雪|半决赛|决赛|联赛|球赛|球队|球员|足球|篮球|排球|出战|扩军|粤超|东北超|村超|夺冠|夺金|图册|家宴|历史人物选举|抽签结果|重磅开启|火热开启|齐聚|共谋发展|最新进展|锦绣|如此精|大叙事|启新程|新身份|抢.{0,1}鲜|需要几步|丰硕成果|矩阵扩容|凉粉草|窗口可能只剩|红星照耀中国|三军会师|陨石|流星|图鉴|野生种群|作者大会|宣讲团|引发热烈反响)/;
// 天气与交通服务信息不是时政新闻
const SERVICE_TITLE =
  /(?:午评|收评|早盘|收盘|盘面)|℃|(?:(?:大雾|暴雨|暴雪|寒潮|高温|强降雨|降温|降雨).{0,20}(?:预警|封闭|延误|停运|取消|影响|来袭|持续|出行|航班|高速|机场|市民|冷空气|外套))|(?:(?:高速公路|高速口|收费站|机场|航班|列车|火车站).{0,12}(?:封闭|关闭|延误|停运|取消|客流|出行))|(?:(?:难题|痛点).{0,6}(?:新解|破题|有解))/;

const MAINSTREAM_ENTITIES =
  /(特朗普|普京|泽连斯基|内塔尼亚胡|加沙|以色列|乌克兰|俄罗斯|中国|美国|台湾|伊朗|联合国|气候|峰会|Trump|Putin|Zelensky|Netanyahu|Gaza|Israel|Ukraine|Russia|China|United States|Taiwan|Iran|United Nations|COP\d+|G20|G7|summit|Maduro|Lula)/gi;

// 强烈软信号：命中一个就基本可以判定为娱乐/生活方式/赛事/猎奇
const STRONG_SOFT =
  /\b(tourists?|cuisine|chef|box office|viral|memes?|heartwarming|reunites?|reunion|red carpet|premiere|auction|olympics?|youth olympics|championship|tournament|coach|squad|managers?|singers?|actress|celebrity|wedding|dating|photographers?|grizzly|shark|wildlife|zoo|podcast|festival|diwali|cow dung|king charles|queen elizabeth)\b/gi;
const STRONG_SOFT_ZH = [
  "明星", "艺人", "娱乐", "综艺", "电影", "电视剧", "演唱会", "专辑", "时尚",
  "美食", "旅游", "景点", "体育", "足球", "篮球", "奥运", "世界杯", "球员",
  "联赛", "网红", "游戏", "动漫", "漫画", "婚礼", "恋情", "选美", "票房",
  "拍卖", "写真", "红毯", "首映", "晕倒", "牛粪", "节庆", "棕熊", "鲨鱼",
  "动物园", "野生动物", "播客", "表情包", "梗图", "段子", "青奥", "夺金", "夺冠",
  "高尔夫", "网球", "马拉松", "冰雪游", "滑雪", "候鸟", "影人", "博主", "品鉴",
  "康养", "旅居", "赛事", "推介会", "题词", "題詞", "寄语", "寄語",
];

// 国际机构与人权组织：大写专名不加 i，避免法语/西语的 "un" 被误判
const ACTOR_WORDS = [
  "联合国", "安理会", "欧盟", "北约", "世卫组织", "世界卫生组织", "红十字会",
  "世界银行", "国际货币基金组织", "五角大楼", "白宫", "克里姆林宫", "国务院",
  "外交部", "国防部", "最高法院", "央行", "美联储",
  "World Food Programme", "World Food Program", "Amnesty International",
  "Human Rights Watch", "International Criminal Court", "Federal Reserve",
];
const ACTOR_LATIN =
  /\b(UN|UNSC|EU|NATO|Pentagon|Kremlin|White House|State Department|Security Council|ICRC|MSF|Red Cross|World Bank|IMF|WHO|OPEC|G7|G20|ASEAN|African Union|ICC|ECB)\b/g;

function escapeTerm(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAscii(term) {
  return /^[\x00-\x7F]+$/.test(term);
}

export function termHits(text, terms) {
  const hits = new Set();
  const hay = String(text ?? "");
  if (!hay) return hits;
  const lower = hay.toLowerCase();
  for (const term of terms) {
    if (isAscii(term)) {
      if (new RegExp(`\\b${escapeTerm(term)}\\b`, "i").test(lower)) hits.add(term);
    } else if (lower.includes(term.toLowerCase())) {
      // 中文与非 ASCII 语种（法/西/葡重音词）走子串匹配，忽略大小写
      hits.add(term);
    }
  }
  return hits;
}

export function latinHits(text, pattern) {
  const matches = String(text ?? "").match(pattern) ?? [];
  return new Set(matches.map((token) => token.toLowerCase().trim()));
}

function categoryHits(text, spec) {
  let count = termHits(text, spec.zh).size + latinHits(text, spec.latin).size;
  if (spec.multi) count += termHits(text, spec.multi).size;
  return count;
}

export function classifyNews(item) {
  const link = String(item?.link ?? "");
  const title = String(item?.title ?? "").trim();
  if (!title) return { reason: "empty", scores: null };
  if (OPINION_URL.test(link)) return { reason: "opinion", scores: null };
  if (LIVE_URL.test(link) || LIVE_TITLE.test(title)) return { reason: "other", scores: null };
  if (SOFT_URL.test(link)) return { reason: "soft", scores: null };
  if (OPINION_TITLE.test(title) || /[?？]\s*$/.test(title)) return { reason: "opinion", scores: null };
  if (ANALYSIS_TITLE.test(title) || FEATURE_TITLE.test(title)) return { reason: "opinion", scores: null };
  if (ROUNDUP_TITLE.test(title) || CEREMONY_TITLE.test(title)) return { reason: "soft", scores: null };
  if (PROPAGANDA_TITLE.test(title)) return { reason: "soft", scores: null };
  if (CRIME_TITLE.test(title)) return { reason: "crime", scores: null };
  if (CULTURE_FEATURE.test(title) || SERVICE_TITLE.test(title)) {
    return { reason: "soft", scores: null };
  }
  if ((title.match(/[;；]/g) ?? []).length >= 2) return { reason: "soft", scores: null };

  const text = [title, item?.titleOriginal, item?.summary].filter(Boolean).join(" ");
  const actorSet = new Set([
    ...latinHits(text, MAINSTREAM_ENTITIES),
    ...latinHits(text, ACTOR_LATIN),
    ...termHits(text, ACTOR_WORDS),
  ]);
  const strongSoft =
    latinHits(text, STRONG_SOFT).size + termHits(text, STRONG_SOFT_ZH).size;
  const scores = {
    politics: categoryHits(text, CATEGORY.politics),
    security: categoryHits(text, CATEGORY.security),
    economy: categoryHits(text, CATEGORY.economy),
    research: categoryHits(text, CATEGORY.research),
    health: categoryHits(text, CATEGORY.health),
    climate: categoryHits(text, CATEGORY.climate),
    frontier: termHits(text, FRONTIER_TERMS).size,
    crime: categoryHits(text, CATEGORY.crime),
    soft: categoryHits(text, CATEGORY.soft),
    society: categoryHits(text, CATEGORY.society),
    actors: actorSet.size,
  };
  // 允许：政治/安全/经济/科研/公共卫生/气候/前沿议题/国际主体；禁止：治安犯罪/娱乐生活方式/社会意外
  const allowed =
    scores.politics +
    scores.security +
    scores.economy +
    scores.research +
    scores.health +
    scores.climate +
    scores.frontier +
    scores.actors;
  // 战争/军事冲突背景下的伤亡描述属于战况，不应按治安犯罪或意外事故处理
  const conflict = scores.security >= 2 || (scores.security >= 1 && scores.actors >= 2);
  const blocked =
    scores.crime + scores.soft + strongSoft + (conflict ? 0 : scores.society);

  // 全无信号：宣传稿、软文、无法判断的条目一律丢弃
  if (allowed === 0 && blocked === 0) return { reason: "other", scores };
  if (!conflict && scores.crime >= 2 && scores.crime >= allowed) {
    return { reason: "crime", scores };
  }
  if (blocked >= 2 && blocked >= allowed) {
    const reason =
      scores.crime >= scores.soft && scores.crime >= scores.society
        ? "crime"
        : scores.soft >= scores.society
          ? "soft"
          : "other";
    return { reason, scores };
  }
  if (blocked === 1 && allowed === 0) {
    return {
      reason: scores.crime ? "crime" : scores.soft ? "soft" : "other",
      scores,
    };
  }
  return { reason: null, scores };
}

export function hardNewsReason(item) {
  return classifyNews(item).reason;
}

export function isHardNews(item) {
  return hardNewsReason(item) === null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function analyzeStory(rep, items, ageHours) {
  const otherTitles = items
    .filter((item) => item !== rep)
    .slice(0, 5)
    .map((item) => item.title);
  const text = [rep.title, rep.summary, ...otherTitles].filter(Boolean).join(" ");

  const seriousHits = termHits(text, SERIOUS_TERMS).size;
  const frontierHits = termHits(text, FRONTIER_TERMS).size;
  const softHits = termHits(rep.title, SOFT_TERMS).size;
  const verdict = classifyNews(rep);
  const opinion = verdict.reason === "opinion";
  const crime = verdict.reason === "crime";

  const seriousness = Math.round(
    clamp(
      30 +
        Math.min(30, seriousHits * 7) +
        (OFFICIAL_ACTOR.test(text) ? 12 : 0) +
        (HARD_EVENT.test(text) ? 12 : 0) +
        (rep.summary ? 4 : 0) -
        softHits * 20 -
        (opinion ? 40 : 0),
      0,
      100,
    ),
  );

  const foreignSources = new Set();
  const domesticSources = new Set();
  for (const item of items) {
    const lang = SOURCE_MAP.get(item.sourceId)?.lang ?? item.lang ?? "en";
    if (lang === "zh") domesticSources.add(item.sourceId);
    else foreignSources.add(item.sourceId);
  }

  const foreignBreadth = Math.min(1, foreignSources.size / 2) * 20;
  const baseGap = domesticSources.size === 0 ? 35 : 0;
  const mainstream = new Set(
    (text.match(MAINSTREAM_ENTITIES) ?? []).map((token) => token.toLowerCase()),
  ).size;
  const mainstreamPenalty = mainstream >= 2 ? 20 : mainstream === 1 ? 10 : 0;
  const domesticGap = Math.max(0, baseGap - mainstreamPenalty);
  const frontier = Math.min(1, frontierHits / 2) * 25;
  const fresh = Math.exp(-Math.max(0, ageHours) / 30) * 10;
  const blueOcean = Math.round(clamp(foreignBreadth + domesticGap + frontier + fresh, 0, 100));
  const basePushEligible =
    seriousness >= 58 && blueOcean >= 52 && foreignSources.size > 0 && !opinion;

  return {
    seriousness,
    blueOcean,
    frontierHits,
    seriousHits,
    crime,
    foreignSources: foreignSources.size,
    domesticSources: domesticSources.size,
    isBlueOcean: blueOcean >= 52 && foreignSources.size > 0 && !crime,
    basePushEligible,
    pushEligible: basePushEligible && !crime,
  };
}
