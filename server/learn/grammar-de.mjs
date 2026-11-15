// 语法大纲白名单：讲解范围封顶在大学德语四级，超出的一律标「拓展」，不占主线进度。
// explainZh 与 contrast 是人工撰写的教学内容；例句证据只能来自当日阅读文本，
// 由 reading.mjs 计算 evidenceSpan，禁止只给规则不给文中锚点。

export const GRAMMAR_POINTS = [
  {
    id: "praesens",
    titleZh: "现在时（Präsens）",
    outline: "四级",
    explainZh:
      "德语现在时既表当下，也表习惯与普遍事实；动词按人称变位，第三人称单数一般加 -t。句子语序为陈述句动词第二位、一般疑问句动词第一位。",
    contrast: { wrong: "Er geht zu Hause.", right: "Er geht nach Hause.", note: "去某地（回家）用 nach，到某物/某人处才用 zu。" },
  },
  {
    id: "perfekt",
    titleZh: "现在完成时（Perfekt）",
    outline: "四级",
    explainZh:
      "由 haben 或 sein 的现在时加第二分词构成，口语叙述过去事件的首选时态。表位移或状态变化、以及 sein/haben/werden 等少数动词用 sein 作助动词，其余用 haben。",
    contrast: { wrong: "Ich habe nach Berlin gefahren.", right: "Ich bin nach Berlin gefahren.", note: "fahren 是位移动词，助动词必须是 sein。" },
  },
  {
    id: "plusquamperfekt",
    titleZh: "过去完成时（Plusquamperfekt）",
    outline: "四级",
    explainZh: "hadte 的过去式（hatte/war）加第二分词，表示比叙述主线更早的「过去的过去」。",
    contrast: { wrong: "Als ich ankam, hatte der Film begonnen.", right: "Als ich ankam, hatte der Film schon begonnen.", note: "从句本身已是过去时，主句要用 Plusquamperfekt 才能表达先后。" },
  },
  {
    id: "futur1",
    titleZh: "第一将来时（Futur I）",
    outline: "四级",
    explainZh: "werden 的现在时加动词不定式，表将来或推测；实际使用中常用现在时加时间状语代替。",
    contrast: { wrong: "Ich werde morgen zur Arbeit gehe.", right: "Ich werde morgen zur Arbeit gehen.", note: "werden 之后必须是动词原形（不定式），不能再变位。" },
  },
  {
    id: "prateritum",
    titleZh: "过去时（Präteritum）",
    outline: "四级",
    explainZh: "书面叙事时态；情态动词、sein、haben 及强变化动词在书面上优先用过去时而非完成时。",
    contrast: { wrong: "Gestern bin ich müde gewesen.", right: "Gestern war ich müde.", note: "sein 的过去时叙述优先用 war，而不是 sein 的完成时。" },
  },
  {
    id: "modal-verbs",
    titleZh: "情态动词与句末不定式",
    outline: "四级",
    explainZh:
      "können/müssen/dürfen/sollen/wollen/mögen 变位为现在时第二位，实义动词以原形置于句末，构成框型结构；单数第一人称无词尾变化。",
    contrast: { wrong: "Er kann Deutsch sprechen gut.", right: "Er kann gut Deutsch sprechen.", note: "被框住的动词原形必须位于句末，其他成分放在框内。" },
  },
  {
    id: "trennbare-verben",
    titleZh: "可分动词",
    outline: "四级",
    explainZh: "ab/an/auf/aus/mit/vor/zu 等前缀在现在时和过去时主句中拆出并置句末；带可分前缀的过去分词加 ge- 在前缀与词干之间。",
    contrast: { wrong: "Ich fernsehe abends.", right: "Ich sehe abends fern.", note: "主句中 fern- 必须与 sehen 分离并移到句末。" },
  },
  {
    id: "wechsel-praepositionen",
    titleZh: "双向介词（Wechselpräpositionen）",
    outline: "四级",
    explainZh: "in/an/auf/über/unter/vor/hinter/neben/zwischen 表方向支配第四格，表位置支配第三格。",
    contrast: { wrong: "Das Buch liegt auf dem Tisch.", right: "Das Buch legt sich auf den Tisch.", note: "「放上去」是方向，用第四格；「摆在上面」是位置才用第三格。" },
  },
  {
    id: "dativ-praepositionen",
    titleZh: "支配第三格的介词",
    outline: "四级",
    explainZh: "aus, bei, mit, nach, seit, von, zu 恒定支配第三格；名词复数第三格词尾要加 -n。",
    contrast: { wrong: "Ich fahre mit dem Auto zu der Freundin.", right: "Ich fahre mit dem Auto zur Freundin.", note: "zu + dem 缩合为 zur；mit 后必须是第三格 dem。" },
  },
  {
    id: "akkusativ-praepositionen",
    titleZh: "支配第四格的介词",
    outline: "四级",
    explainZh: "für, um, durch, gegen, ohne, wider 恒定支配第四格，且都在框型结构之内。",
    contrast: { wrong: "Das Geschenk ist für dir.", right: "Das Geschenk ist für dich.", note: "für 支配第四格，人称代词第二格形式错误。" },
  },
  {
    id: "adjektivdeklination",
    titleZh: "形容词词尾变化",
    outline: "四级",
    explainZh: "形容词在冠词后按弱变化（-e/-en），在无冠词后按强变化（复现格位标志），在 ein 类不定冠词后词尾补足缺失的性别信息。",
    contrast: { wrong: "Ich trinke einen heiß Wasser.", right: "Ich trinke ein heißes Wasser.", note: "Wasser 是中性，ein 不显示中性标志，形容词必须补上 -es。" },
  },
  {
    id: "n-deklination",
    titleZh: "弱变化名词（n-Deklination）",
    outline: "四级",
    explainZh: "以 -e 结尾的阳性名词及外来词，除第一格单数外所有格位都加 -n。",
    contrast: { wrong: "Ich helfe dem Student.", right: "Ich helfe dem Studenten.", note: "Student 属弱变化名词，第三格必须为 dem Studenten。" },
  },
  {
    id: "plural-formen",
    titleZh: "名词复数形式",
    outline: "四级",
    explainZh: "复数词尾有 -e, -en, -er, -s 及带变音的 -¨e 等类别，需与冠词、格位一起记忆。",
    contrast: { wrong: "die Kinders", right: "die Kinder", note: "Kind 的复数是 Kinder，不再叠加 -s。" },
  },
  {
    id: "reflexivpronomen",
    titleZh: "反身代词",
    outline: "四级",
    explainZh: "第三人称单复数反身代词均为 sich；第一、二人称借用第三格人称代词 mir/dir/uns/euch。",
    contrast: { wrong: "Ich wasche mich.", right: "Ich wasche mich. / 但：Ich putze mir die Zähne.", note: "带与格所属的反身结构要用 mir/dir，不能全用 mich。" },
  },
  {
    id: "prozess-passiv",
    titleZh: "被动态：过程被动（Vorgangspassiv）",
    outline: "四级",
    explainZh: "werden 的相应时态加第二分词，强调动作本身；主动句的第一格宾语升为主语，主体由 von+第三格或 durch+第四格引出。",
    contrast: { wrong: "Der Brief wird geschrieben hat.", right: "Der Brief wird geschrieben.", note: "过程被动只保留 werden 的变位，第二分词在句末，不额外加助动词。" },
  },
  {
    id: "zustand-passiv",
    titleZh: "被动态：状态被动（Zustandspassiv）",
    outline: "四级",
    explainZh: "sein 的现在时/过去时加第二分词，只描述动作完成后的结果状态，没有被动动作进行义。",
    contrast: { wrong: "Das Fenster ist geöffnet worden.", right: "Das Fenster ist geöffnet.", note: "只要结果状态就不必加 worden，加了变回完成时的过程被动。" },
  },
  {
    id: "passiv-mit-modal",
    titleZh: "被动态：带情态动词",
    outline: "四级",
    explainZh: "情态动词变位居第二位，句末为「第二分词 + werden」；表必须/能够/不允许被做。",
    contrast: { wrong: "Die Aufgabe muss erfüllt werden.", right: "Die Aufgabe muss erfüllt werden.（正） / 误写：Die Aufgabe muss werden erfüllt.", note: "werden 不定式必须紧跟第二分词位于句末，不能插在中间。" },
  },
  {
    id: "konjunktiv2",
    titleZh: "虚拟式第二式（Konjunktiv II）",
    outline: "四级",
    explainZh:
      "表非真实条件、愿望与委婉请求。优先用动词自身的第二虚拟式形式（wäre/hätte/könnte/müsste/dürfte），该形式与现在时同形时改用 würde+不定式。",
    contrast: { wrong: "Wenn ich reich bin, kaufe ich ein Haus.", right: "Wenn ich reich wäre, würde ich ein Haus kaufen.", note: "与现在事实相反的条件句必须用第二虚拟式。" },
  },
  {
    id: "konjunktiv1",
    titleZh: "虚拟式第一式与间接引语（Konjunktiv I）",
    outline: "拓展",
    explainZh: "新闻报道转述他人话语时使用，形式多为 sei/habe/wisse；与直陈式同形时回退到第二虚拟式。四级大纲不作掌握要求。",
    contrast: { wrong: "Er sagte, er hat keine Zeit.", right: "Er sagte, er habe keine Zeit.", note: "间接引语用第一虚拟式 habe，而非直陈式 hat。" },
  },
  {
    id: "partizip-attribut",
    titleZh: "分词作定语",
    outline: "四级",
    explainZh: "第一分词（-end）表主动进行，第二分词表被动完成，置于冠词与名词之间并按形容词词尾变化。",
    contrast: { wrong: "das spielende Kind", right: "das spielende Kind（正） / das gespielte Lied（正） / 误写：das spielen Kind", note: "分词作定语必须名词化并带形容词词尾。" },
  },
  {
    id: "erweiterte-partizipialfuegung",
    titleZh: "扩展分词作定语",
    outline: "四级",
    explainZh: "分词连同其支配成分一起前置于名词，框住整个名词短语，冠词在框前、名词在框后，相当于一个关系从句的压缩形式。",
    contrast: {
      wrong: "die von den Studenten gelöste Aufgabe ist schwer.",
      right: "die von den Studenten gelöste Aufgabe ist schwer.（正） / 误写：die gelöste von den Studenten Aufgabe",
      note: "扩展成分必须整体放在分词与名词之间，不能后置到名词之后。",
    },
  },
  {
    id: "infinitiv-mit-zu",
    titleZh: "不定式结构（zu + Infinitiv）",
    outline: "四级",
    explainZh: "haben/versuchen/beginnen/lernen/freuen 等之后用 zu+不定式；可分动词的 zu 插在前缀与词干之间；不定式短语本身可带扩展成分。",
    contrast: { wrong: "Ich versuche, zu helfen das Problem.", right: "Ich versuche, das Problem zu helfen.", note: "zu+不定式置于扩展成分之后、句末。" },
  },
  {
    id: "um-zu",
    titleZh: "目的从句式不定式（um … zu）",
    outline: "四级",
    explainZh: "主语一致时用 um…zu 表目的，代替 damit 从句，中间夹被扩展的成分。",
    contrast: { wrong: "Ich lerne Deutsch, um besser Jobs zu bekommen.", right: "Ich lerne Deutsch, um bessere Jobchancen zu haben.（正） / 误写：Ich lerne Deutsch um, bessere Jobs zu bekommen.", note: "um 与 zu 构成框，逗号在 um 之前而非之间。" },
  },
  {
    id: "ohne-zu-statt-zu",
    titleZh: "ohne … zu / statt … zu",
    outline: "四级",
    explainZh: "分别表「without doing」与「instead of doing」，同样要求主从句主语一致。",
    contrast: { wrong: "Er ging, ohne ein Wort sagen.", right: "Er ging, ohne ein Wort zu sagen.", note: "漏掉 zu 或把 zu 放在动词后都是错的。" },
  },
  {
    id: "konjunktion-und-aber",
    titleZh: "并列连词与语序",
    outline: "四级",
    explainZh: "und, aber, denn, sondern, oder 不占句位，其后主句仍为「主语—动词」；sondern 只用于否定句之后的更正。",
    contrast: { wrong: "Er ist müde, aber er geht weiter.", right: "Er ist müde, aber er geht trotzdem weiter.（正） / 误写：Er ist müde, aber geht er weiter.", note: "denn/aber 之后不得倒装，只有从句连词才引发尾语序。" },
  },
  {
    id: "subjunktion-weil-dass",
    titleZh: "从属连词与动词尾置",
    outline: "四级",
    explainZh: "weil, dass, wenn, ob, obwohl, damit, während, bevor, nachdem 等把变位动词推到从句末；主句若前置从句则紧随从句倒装。",
    contrast: { wrong: "Ich bleibe zu Hause, weil ich bin krank.", right: "Ich bleibe zu Hause, weil ich krank bin.", note: "从属连词引导的从句动词必须在末尾。" },
  },
  {
    id: "relativsatz",
    titleZh: "关系从句",
    outline: "四级",
    explainZh: "关系代词的性数随先行词、格随从句内的功能；从句动词尾置，介词可前置于关系代词。",
    contrast: { wrong: "Der Mann, den ich gestern getroffen habe, ist Arzt.（正） / 误写：Der Mann, welcher ich gestern getroffen habe, ist Arzt.", right: "Der Mann, den ich gestern getroffen habe, ist Arzt.", note: "第四格宾语的关系代词用 den，不用 der/welcher 的主格形式。" },
  },
  {
    id: "konditional-als-wenn",
    titleZh: "als 与 wenn 的时间/条件区分",
    outline: "四级",
    explainZh: "一次性过去事件用 als，重复性过去事件与条件句用 wenn。",
    contrast: { wrong: "Wenn ich Kind war, spielte ich viel.（重复义可用） / 误用：Als ich einmal in Berlin war, habe ich ihn kennengelernt.", right: "Als ich ein Kind war, spielte ich oft draußen.", note: "「从前有一次」只能 als，不能 wenn。" },
  },
  {
    id: "negation",
    titleZh: "否定 nicht 与 kein",
    outline: "四级",
    explainZh: "kein 否定不定或无冠词的名词；nicht 否定动词、形容词或特定成分，位置在被否定成分之前。",
    contrast: { wrong: "Ich habe nicht Zeit.", right: "Ich habe keine Zeit.", note: "无冠词名词的否定用 kein，而不是 nicht。" },
  },
  {
    id: "formales-subjekt-es",
    titleZh: "形式主语 es",
    outline: "四级",
    explainZh: "es 在句首占第一位时后可接 sein/bleiben 等；当前置其他成分时 es 被省略。",
    contrast: { wrong: "Heute ist es kalt.", right: "Heute ist kalt.（口语可省） / Es ist heute kalt.（正）", note: "es 在倒装句中通常消失。" },
  },
];

export const GRAMMAR_BY_ID = new Map(GRAMMAR_POINTS.map((point) => [point.id, point]));

// 四级大纲是主线，标「拓展」的点只登记状态，不计入掌握进度
export const MAINLINE_POINTS = GRAMMAR_POINTS.filter((point) => point.outline === "四级");
