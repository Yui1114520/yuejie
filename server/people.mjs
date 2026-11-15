const PEOPLE = [
  { id: "trump", name: "唐纳德·特朗普", en: "Donald Trump", aliases: ["特朗普", "Donald Trump"], role: "美国总统", bio: "美国第 47 任总统，共和党人，2025 年再度入主白宫。", accent: "#b3261e" },
  { id: "vance", name: "J.D. 万斯", en: "JD Vance", aliases: ["万斯", "JD Vance", "J.D. Vance"], role: "美国副总统", bio: "美国副总统，2025 年就任，此前任俄亥俄州联邦参议员。", accent: "#8a5a2b" },
  { id: "rubio", name: "马尔科·鲁比奥", en: "Marco Rubio", aliases: ["鲁比奥", "Marco Rubio"], role: "美国国务卿", bio: "美国国务卿，2025 年就任，曾任佛罗里达州联邦参议员。", accent: "#1f5c9e" },
  { id: "hegseth", name: "皮特·赫格塞思", en: "Pete Hegseth", aliases: ["赫格塞思", "Pete Hegseth"], role: "美国国防部长", bio: "美国国防部长，2025 年就任，此前从事媒体与军事评论工作。", accent: "#4a5a8a" },
  { id: "bessent", name: "斯科特·贝森特", en: "Scott Bessent", aliases: ["贝森特", "Scott Bessent"], role: "美国财政部长", bio: "美国财政部长，2025 年就任，长期从事宏观投资。", accent: "#2f6f8f" },
  { id: "witkoff", name: "史蒂夫·威特科夫", en: "Steve Witkoff", aliases: ["威特科夫", "Steve Witkoff"], role: "美国中东问题特使", bio: "美国中东问题特使，参与加沙与俄乌相关谈判。", accent: "#7a3f7a" },
  { id: "biden", name: "乔·拜登", en: "Joe Biden", aliases: ["拜登", "Joe Biden"], role: "美国前总统", bio: "美国前总统，2021 至 2025 年执政。", accent: "#3d7a5a" },
  { id: "harris", name: "卡玛拉·哈里斯", en: "Kamala Harris", aliases: ["哈里斯", "Kamala Harris"], role: "美国前副总统", bio: "美国前副总统，2024 年民主党总统候选人。", accent: "#a35a1f" },
  { id: "putin", name: "弗拉基米尔·普京", en: "Vladimir Putin", aliases: ["普京", "Vladimir Putin"], role: "俄罗斯总统", bio: "俄罗斯总统，自 2000 年起长期执政。", accent: "#1f5c9e" },
  { id: "lavrov", name: "谢尔盖·拉夫罗夫", en: "Sergey Lavrov", aliases: ["拉夫罗夫", "Sergey Lavrov", "Sergei Lavrov"], role: "俄罗斯外交部长", bio: "俄罗斯外交部长，2004 年起任职。", accent: "#4a5a8a" },
  { id: "zelensky", name: "弗拉基米尔·泽连斯基", en: "Volodymyr Zelensky", aliases: ["泽连斯基", "Zelensky", "Zelenskyy"], role: "乌克兰总统", bio: "乌克兰总统，2019 年当选，战争期间担任最高统帅。", accent: "#c9a227" },
  { id: "syrsky", name: "亚历山大·瑟尔斯基", en: "Oleksandr Syrsky", aliases: ["瑟尔斯基", "Syrsky", "Syrskyi"], role: "乌克兰武装部队总司令", bio: "乌克兰武装部队总司令，2024 年上任。", accent: "#3d7a5a" },
  { id: "lukashenko", name: "亚历山大·卢卡申科", en: "Alexander Lukashenko", aliases: ["卢卡申科", "Lukashenko"], role: "白俄罗斯总统", bio: "白俄罗斯总统，1994 年起执政。", accent: "#8a5a2b" },
  { id: "netanyahu", name: "本雅明·内塔尼亚胡", en: "Benjamin Netanyahu", aliases: ["内塔尼亚胡", "Netanyahu"], role: "以色列总理", bio: "以色列总理，长期主导以色列安全与外交政策。", accent: "#2f6f8f" },
  { id: "ben-gvir", name: "伊塔马尔·本-格维尔", en: "Itamar Ben-Gvir", aliases: ["本-格维尔", "Ben-Gvir"], role: "以色列国家安全部长", bio: "以色列国家安全部长，右翼政党犹太力量党领导人。", accent: "#7a3f7a" },
  { id: "smotrich", name: "贝扎莱尔·斯莫特里赫", en: "Bezalel Smotrich", aliases: ["斯莫特里赫", "Smotrich"], role: "以色列财政部长", bio: "以色列财政部长，宗教犹太复国主义党领导人。", accent: "#8a5a2b" },
  { id: "abbas", name: "马哈茂德·阿巴斯", en: "Mahmoud Abbas", aliases: ["阿巴斯", "Mahmoud Abbas"], role: "巴勒斯坦总统", bio: "巴勒斯坦总统，巴勒斯坦民族权力机构主席。", accent: "#3d7a5a" },
  { id: "khamenei", name: "阿里·哈梅内伊", en: "Ali Khamenei", aliases: ["哈梅内伊", "Khamenei"], role: "伊朗最高领袖", bio: "伊朗最高领袖，掌握国家最终决策权。", accent: "#2f6f8f" },
  { id: "pezeshkian", name: "马苏德·佩泽希齐扬", en: "Masoud Pezeshkian", aliases: ["佩泽希齐扬", "Pezeshkian"], role: "伊朗总统", bio: "伊朗总统，2024 年当选。", accent: "#4a5a8a" },
  { id: "araghchi", name: "阿巴斯·阿拉格齐", en: "Abbas Araghchi", aliases: ["阿拉格齐", "Araghchi"], role: "伊朗外交部长", bio: "伊朗外交部长，2024 年上任，参与核问题谈判。", accent: "#7a3f7a" },
  { id: "erdogan", name: "雷杰普·塔伊普·埃尔多安", en: "Recep Tayyip Erdoğan", aliases: ["埃尔多安", "Erdoğan", "Erdogan"], role: "土耳其总统", bio: "土耳其总统，2003 年起先后担任总理和总统。", accent: "#b3261e" },
  { id: "fidan", name: "哈坎·菲丹", en: "Hakan Fidan", aliases: ["菲丹", "Hakan Fidan"], role: "土耳其外交部长", bio: "土耳其外交部长，2023 年上任，此前长期负责情报工作。", accent: "#a35a1f" },
  { id: "mbs", name: "穆罕默德·本·萨勒曼", en: "Mohammed bin Salman", aliases: ["穆罕默德·本·萨勒曼", "Mohammed bin Salman", "MBS"], role: "沙特王储兼首相", bio: "沙特王储兼首相，实际主导沙特改革与外交议程。", accent: "#3d7a5a" },
  { id: "mbz", name: "穆罕默德·本·扎耶德", en: "Mohamed bin Zayed", aliases: ["穆罕默德·本·扎耶德", "Mohamed bin Zayed", "MBZ"], role: "阿联酋总统", bio: "阿联酋总统，阿布扎比酋长。", accent: "#2f6f8f" },
  { id: "tamim", name: "塔米姆·本·哈马德", en: "Tamim bin Hamad", aliases: ["塔米姆", "Tamim bin Hamad"], role: "卡塔尔埃米尔", bio: "卡塔尔埃米尔，2013 年继位。", accent: "#7a3f7a" },
  { id: "sharaa", name: "艾哈迈德·沙拉", en: "Ahmed al-Sharaa", aliases: ["Ahmed al-Sharaa", "al-Sharaa", "Sharaa", "朱拉尼", "al-Julani"], role: "叙利亚总统", bio: "叙利亚总统，2024 年底政局变动后掌权。", accent: "#4a5a8a" },
  { id: "aoun", name: "约瑟夫·奥恩", en: "Joseph Aoun", aliases: ["约瑟夫·奥恩", "Joseph Aoun"], role: "黎巴嫩总统", bio: "黎巴嫩总统，2025 年当选，曾任黎巴嫩军队总司令。", accent: "#8a5a2b" },
  { id: "guterres", name: "安东尼奥·古特雷斯", en: "António Guterres", aliases: ["古特雷斯", "Guterres"], role: "联合国秘书长", bio: "联合国秘书长，2017 年上任，此前任葡萄牙总理。", accent: "#3d7ea6" },
  { id: "von-der-leyen", name: "乌尔苏拉·冯德莱恩", en: "Ursula von der Leyen", aliases: ["冯德莱恩", "von der Leyen"], role: "欧盟委员会主席", bio: "欧盟委员会主席，2019 年就任，2024 年连任。", accent: "#1f5c9e" },
  { id: "costa", name: "安东尼奥·科斯塔", en: "António Costa", aliases: ["António Costa", "Antonio Costa"], role: "欧洲理事会主席", bio: "欧洲理事会主席，2024 年就任，此前任葡萄牙总理。", accent: "#2f6f8f" },
  { id: "kallas", name: "卡娅·卡拉斯", en: "Kaja Kallas", aliases: ["卡拉斯", "Kaja Kallas"], role: "欧盟外交与安全政策高级代表", bio: "欧盟外交与安全政策高级代表，2024 年就任，曾任爱沙尼亚总理。", accent: "#7a3f7a" },
  { id: "rutte", name: "马克·吕特", en: "Mark Rutte", aliases: ["吕特", "Mark Rutte"], role: "北约秘书长", bio: "北约秘书长，2024 年就任，此前任荷兰首相。", accent: "#4a5a8a" },
  { id: "macron", name: "埃马纽埃尔·马克龙", en: "Emmanuel Macron", aliases: ["马克龙", "Macron"], role: "法国总统", bio: "法国总统，2017 年起执政。", accent: "#1f5c9e" },
  { id: "merz", name: "弗里德里希·默茨", en: "Friedrich Merz", aliases: ["默茨", "Merz"], role: "德国总理", bio: "德国总理，2025 年就任，基民盟领导人。", accent: "#3d7a5a" },
  { id: "scholz", name: "奥拉夫·朔尔茨", en: "Olaf Scholz", aliases: ["朔尔茨", "Scholz"], role: "德国前总理", bio: "德国前总理，2021 至 2025 年执政。", accent: "#8a5a2b" },
  { id: "starmer", name: "基尔·斯塔默", en: "Keir Starmer", aliases: ["斯塔默", "Starmer"], role: "英国首相", bio: "英国首相，工党领袖，2024 年就任。", accent: "#b3261e" },
  { id: "meloni", name: "焦尔吉娅·梅洛尼", en: "Giorgia Meloni", aliases: ["梅洛尼", "Meloni"], role: "意大利总理", bio: "意大利总理，2022 年就任，意大利兄弟党领导人。", accent: "#2f6f8f" },
  { id: "sanchez", name: "佩德罗·桑切斯", en: "Pedro Sánchez", aliases: ["桑切斯", "Pedro Sánchez", "Pedro Sanchez"], role: "西班牙首相", bio: "西班牙首相，工人社会党领袖。", accent: "#b3261e" },
  { id: "orban", name: "维克托·欧尔班", en: "Viktor Orbán", aliases: ["欧尔班", "Orbán", "Orban"], role: "匈牙利总理", bio: "匈牙利总理，2010 年起执政，青民盟领导人。", accent: "#a35a1f" },
  { id: "tusk", name: "唐纳德·图斯克", en: "Donald Tusk", aliases: ["图斯克", "Donald Tusk"], role: "波兰总理", bio: "波兰总理，2023 年再度执政，公民联盟领导人。", accent: "#3d7ea6" },
  { id: "charles", name: "查尔斯三世", en: "King Charles III", aliases: ["查尔斯三世", "King Charles"], role: "英国国王", bio: "英国国王，2022 年继位。", accent: "#7a3f7a" },
  { id: "xi", name: "习近平", en: "Xi Jinping", aliases: ["习近平", "Xi Jinping"], role: "中国国家主席", bio: "中国国家主席，中共中央总书记。", accent: "#b3261e" },
  { id: "wang-yi", name: "王毅", en: "Wang Yi", aliases: ["王毅", "Wang Yi"], role: "中国外交部长", bio: "中国外交部长，中共中央外事工作委员会办公室主任。", accent: "#8a5a2b" },
  { id: "modi", name: "纳伦德拉·莫迪", en: "Narendra Modi", aliases: ["莫迪", "Modi"], role: "印度总理", bio: "印度总理，2014 年起执政，印度人民党领导人。", accent: "#a35a1f" },
  { id: "kim", name: "金正恩", en: "Kim Jong Un", aliases: ["金正恩", "Kim Jong Un"], role: "朝鲜国务委员长", bio: "朝鲜国务委员长，2011 年起执政。", accent: "#3d7a5a" },
  { id: "lee", name: "李在明", en: "Lee Jae-myung", aliases: ["李在明", "Lee Jae-myung"], role: "韩国总统", bio: "韩国总统，2025 年就任，共同民主党领袖。", accent: "#1f5c9e" },
  { id: "takaichi", name: "高市早苗", en: "Sanae Takaichi", aliases: ["高市早苗", "Takaichi"], role: "日本首相", bio: "日本首相，2025 年就任，自民党总裁。", accent: "#b3261e" },
  { id: "ishiba", name: "石破茂", en: "Shigeru Ishiba", aliases: ["石破茂", "Ishiba"], role: "日本前首相", bio: "日本前首相，2024 至 2025 年执政。", accent: "#4a5a8a" },
  { id: "marcos", name: "小费迪南德·马科斯", en: "Ferdinand Marcos Jr.", aliases: ["马科斯", "Marcos"], role: "菲律宾总统", bio: "菲律宾总统，2022 年就任。", accent: "#3d7ea6" },
  { id: "prabowo", name: "普拉博沃·苏比安托", en: "Prabowo Subianto", aliases: ["普拉博沃", "Prabowo"], role: "印度尼西亚总统", bio: "印度尼西亚总统，2024 年就任。", accent: "#8a5a2b" },
  { id: "anwar", name: "安瓦尔·易卜拉欣", en: "Anwar Ibrahim", aliases: ["安瓦尔", "Anwar Ibrahim"], role: "马来西亚总理", bio: "马来西亚总理，2022 年就任。", accent: "#3d7a5a" },
  { id: "yunus", name: "穆罕默德·尤努斯", en: "Muhammad Yunus", aliases: ["尤努斯", "Muhammad Yunus"], role: "孟加拉国临时政府首席顾问", bio: "孟加拉国临时政府首席顾问，2024 年上任，经济学家。", accent: "#2f6f8f" },
  { id: "shehbaz", name: "夏巴兹·谢里夫", en: "Shehbaz Sharif", aliases: ["夏巴兹", "Shehbaz Sharif"], role: "巴基斯坦总理", bio: "巴基斯坦总理，2024 年再度就任，穆斯林联盟（谢里夫派）领导人。", accent: "#3d7a5a" },
  { id: "lula", name: "路易斯·伊纳西奥·卢拉·达席尔瓦", en: "Luiz Inácio Lula da Silva", aliases: ["卢拉", "Lula"], role: "巴西总统", bio: "巴西总统，2023 年第三次出任总统。", accent: "#b3261e" },
  { id: "milei", name: "哈维尔·米莱", en: "Javier Milei", aliases: ["米莱", "Milei"], role: "阿根廷总统", bio: "阿根廷总统，2023 年就任，主张大幅削减政府开支。", accent: "#7a3f7a" },
  { id: "sheinbaum", name: "克劳迪娅·辛鲍姆", en: "Claudia Sheinbaum", aliases: ["辛鲍姆", "Sheinbaum"], role: "墨西哥总统", bio: "墨西哥总统，2024 年当选，首位女性总统。", accent: "#a35a1f" },
  { id: "petro", name: "古斯塔沃·佩特罗", en: "Gustavo Petro", aliases: ["佩特罗", "Gustavo Petro"], role: "哥伦比亚总统", bio: "哥伦比亚总统，2022 年就任。", accent: "#2f6f8f" },
  { id: "maduro", name: "尼古拉斯·马杜罗", en: "Nicolás Maduro", aliases: ["马杜罗", "Maduro"], role: "委内瑞拉总统", bio: "委内瑞拉总统，2013 年起执政。", accent: "#8a5a2b" },
  { id: "bukele", name: "纳伊布·布克莱", en: "Nayib Bukele", aliases: ["布克莱", "Bukele"], role: "萨尔瓦多总统", bio: "萨尔瓦多总统，2019 年起执政。", accent: "#4a5a8a" },
  { id: "boric", name: "加夫列尔·博里奇", en: "Gabriel Boric", aliases: ["博里奇", "Boric"], role: "智利总统", bio: "智利总统，2022 年就任。", accent: "#3d7a5a" },
  { id: "noboa", name: "丹尼尔·诺沃亚", en: "Daniel Noboa", aliases: ["诺沃亚", "Noboa"], role: "厄瓜多尔总统", bio: "厄瓜多尔总统，2023 年当选。", accent: "#a35a1f" },
  { id: "carney", name: "马克·卡尼", en: "Mark Carney", aliases: ["卡尼", "Mark Carney"], role: "加拿大总理", bio: "加拿大总理，2025 年接任自由党领袖，曾任央行行长。", accent: "#3d7ea6" },
  { id: "trudeau", name: "贾斯廷·特鲁多", en: "Justin Trudeau", aliases: ["特鲁多", "Trudeau"], role: "加拿大前总理", bio: "加拿大前总理，2015 至 2025 年执政。", accent: "#7a3f7a" },
  { id: "powell", name: "杰罗姆·鲍威尔", en: "Jerome Powell", aliases: ["鲍威尔", "Jerome Powell"], role: "美联储主席", bio: "美联储主席，2018 年起任职。", accent: "#2f6f8f" },
  { id: "lagarde", name: "克里斯蒂娜·拉加德", en: "Christine Lagarde", aliases: ["拉加德", "Lagarde"], role: "欧洲央行行长", bio: "欧洲央行行长，2019 年就任，此前任国际货币基金组织总裁。", accent: "#4a5a8a" },
  { id: "hun-manet", name: "洪玛奈", en: "Hun Manet", aliases: ["洪玛奈", "Hun Manet"], role: "柬埔寨首相", bio: "柬埔寨首相，2023 年就任。", accent: "#3d7a5a" },
  { id: "min-aung-hlaing", name: "敏昂莱", en: "Min Aung Hlaing", aliases: ["敏昂莱", "Min Aung Hlaing"], role: "缅甸国防军总司令", bio: "缅甸国防军总司令，2021 年政变后掌权。", accent: "#8a5a2b" },
  { id: "fletcher", name: "汤姆·弗莱彻", en: "Tom Fletcher", aliases: ["弗莱彻", "Tom Fletcher"], role: "联合国人道主义事务协调厅负责人", bio: "联合国人道主义事务协调厅负责人，2024 年上任，负责协调全球人道救援。", accent: "#3d7ea6" },
  { id: "newsom", name: "加文·纽瑟姆", en: "Gavin Newsom", aliases: ["纽瑟姆", "Gavin Newsom"], role: "加利福尼亚州州长", bio: "美国加利福尼亚州州长，民主党人，2019 年起任职。", accent: "#1f5c9e" },
  { id: "tshisekedi", name: "费利克斯·齐塞凯迪", en: "Félix Tshisekedi", aliases: ["齐塞凯迪", "Tshisekedi"], role: "刚果民主共和国总统", bio: "刚果民主共和国总统，2019 年就任。", accent: "#3d7a5a" },
  { id: "pellegrini", name: "彼得·佩莱格里尼", en: "Peter Pellegrini", aliases: ["佩莱格里尼", "Peter Pellegrini"], role: "斯洛伐克总统", bio: "斯洛伐克总统，2024 年就任，此前曾任总理。", accent: "#7a3f7a" },
];

function escapeTerm(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matches(alias, hay) {
  if (/^[\x00-\x7F]+$/.test(alias)) {
    return new RegExp(`\\b${escapeTerm(alias)}\\b`, "i").test(hay);
  }
  return hay.includes(alias);
}

export function extractPeople(articles, limit = 8) {
  const found = new Map();

  for (const article of articles) {
    const hay = `${article.title ?? ""} ${article.titleOriginal ?? ""}`;
    for (const person of PEOPLE) {
      if (!person.aliases.some((alias) => matches(alias, hay))) continue;
      const entry =
        found.get(person.id) ??
        {
          id: person.id,
          name: person.name,
          nameEn: person.en,
          role: person.role,
          bio: person.bio,
          accent: person.accent,
          initial: person.name.slice(0, 1),
          mentions: 0,
          heat: 0,
          articles: [],
        };
      entry.mentions += 1;
      entry.heat += article.heat ?? 0;
      if (entry.articles.length < 4) {
        entry.articles.push({ id: article.id, title: article.title, heat: article.heat });
      }
      found.set(person.id, entry);
    }
  }

  return [...found.values()]
    .sort((a, b) => b.heat + b.mentions * 15 - (a.heat + a.mentions * 15))
    .slice(0, limit);
}
