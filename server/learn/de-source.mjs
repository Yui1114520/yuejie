import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../cache.mjs";

export const RAW_DIR = path.join(DATA_DIR, "learn", "raw");
export const GLOSS_FILE = path.join(DATA_DIR, "learn", "gloss-zh.json");

// 只收词目：变位/变格形式属于词目的 inflections，不单独成卡
export const SKIP_POS = new Set([
  "Konjugierte Form",
  "Deklinierte Form",
  "Partizip II",
  "Partizip I",
  "Kontraktion",
  "Abkürzung",
  "Toponym",
  "Eigenname",
  "Grußformel",
  "Buchstabe",
]);

const POS_ZH = {
  Substantiv: "名词",
  Verb: "动词",
  Hilfsverb: "助动词",
  Adjektiv: "形容词",
  Adverb: "副词",
  Lokaladverb: "地点副词",
  Temporaladverb: "时间副词",
  Modaladverb: "情态副词",
  Konjunktionaladverb: "连接副词",
  Pronominaladverb: "代词副词",
  Präposition: "介词",
  Subjunktion: "连词（从句）",
  Konjunktion: "连词（并列）",
  Interjektion: "感叹词",
  Numerale: "数词",
  Zahlklassifikator: "数量词",
  Wiederholungszahlwort: "反复数词",
  Indefinitpronomen: "不定代词",
  Demonstrativpronomen: "指示代词",
  Personalpronomen: "人称代词",
  Possessivpronomen: "物主代词",
  Reflexivpronomen: "反身代词",
  Interrogativpronomen: "疑问代词",
  Reziprokpronomen: "相互代词",
  Pronomen: "代词",
  Artikel: "冠词",
  Negationspartikel: "否定词",
  Antwortpartikel: "应答词",
  Gradpartikel: "程度小品词",
  Fokuspartikel: "焦点小品词",
  Partikel: "小品词",
};

const GENDER_ZH = { m: "阳性 der", f: "阴性 die", n: "中性 das" };

// 只在这些前缀上断言可分/不可分：über/um/unter 两可，不写进结论
const SEPARABLE = ["ab", "an", "auf", "aus", "bei", "ein", "mit", "nach", "vor", "zu", "zusammen", "zurück", "her", "hin", "los", "weg", "fest", "heim", "klar"];
const INSEPARABLE = ["be", "ver", "zer", "ent", "er", "miss", "emp", "wider"];

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// 最小 RFC4180 解析：字段可带引号、引号内可含逗号与换行
export function readCsv(file) {
  const text = stripBom(fs.readFileSync(file, "utf8"));
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.filter((item) => item.some((cell) => cell !== "")).map((item) => {
    const record = {};
    header.forEach((name, index) => {
      record[name] = item[index] ?? "";
    });
    return record;
  });
}

export function posZh(wortart) {
  return POS_ZH[wortart] ?? wortart;
}

export function loadRaw() {
  const words = readCsv(path.join(RAW_DIR, "dew-top-words.csv"));
  const nouns = readCsv(path.join(RAW_DIR, "dew-top-nouns-detailed.csv"));
  const verbs = readCsv(path.join(RAW_DIR, "dew-top-verbs-detailed.csv"));
  const byLemma = (rows, key) => {
    const map = new Map();
    for (const row of rows) {
      const lemma = String(row[key] ?? "").trim().toLowerCase();
      if (lemma && !map.has(lemma)) map.set(lemma, row);
    }
    return map;
  };
  return { words, nouns: byLemma(nouns, "Nominativ"), verbs: byLemma(verbs, "Infinitiv") };
}

export function selectCandidates(words, limit) {
  const picked = [];
  const seen = new Set();
  for (const row of words) {
    if (picked.length >= limit) break;
    const lemma = String(row.Wort ?? "").trim();
    const gloss = String(row.Übersetzung ?? "").trim();
    if (!lemma || !gloss || lemma.includes(" ") || lemma.length < 2) continue;
    if (SKIP_POS.has(row.Wortart)) continue;
    const key = lemma.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ lemma, key, gloss, wortart: row.Wortart, rank: Number(row.rank) || 0, freq: Number(row.freq) || 0, audio: String(row.Hörbeispiele ?? "").trim() });
  }
  return picked;
}

// 动词：CSV 给了完整的现在时/过去时/分词/虚拟式/命令式范式
function verbInflections(row) {
  const add = [];
  const push = (form, tag) => {
    const value = String(form ?? "").trim();
    if (value) add.push({ form: value, tags: [tag] });
  };
  push(row.Präsens_ich, "现在时·第一人称单数");
  push(row.Präsens_du, "现在时·第二人称单数");
  push(row["Präsens_er, sie, es"], "现在时·第三人称单数");
  push(row.Präteritum_ich, "过去时·第一人称单数");
  push(row["Partizip II"], "第二分词");
  push(row["Konjunktiv II_ich"], "第二虚拟式·第一人称单数");
  push(row["Imperativ Singular"], "命令式·单数");
  push(row["Imperativ Plural"], "命令式·复数");
  const helper = String(row.Hilfsverb ?? "").trim();
  if (helper) add.push({ form: helper, tags: ["完成时助动词"] });
  return add;
}

function nounInflections(row, gender) {
  const add = [];
  const push = (form, tag, withArticle) => {
    const value = String(form ?? "").trim();
    if (!value) return;
    const article = { m: "der ", f: "die ", n: "das " }[gender] ?? "";
    add.push({ form: withArticle ? `${article}${value}` : value, tags: [tag] });
  };
  push(row["Nominativ Singular"], "第一格·单数", true);
  push(row["Genitiv Singular"], "第二格·单数", false);
  push(row["Dativ Singular"], "第三格·单数", false);
  push(row["Akkusativ Singular"], "第四格·单数", false);
  push(row["Nominativ Plural"], "第一格·复数", true);
  push(row["Genitiv Plural"], "第二格·复数", true);
  push(row["Dativ Plural"], "第三格·复数", false);
  push(row["Akkusativ Plural"], "第四格·复数", false);
  return add;
}

export function inflectionsFor(candidate, raw) {
  if (candidate.wortart === "Substantiv") {
    const row = raw.nouns.get(candidate.key);
    if (!row) return { inflections: [], gender: "" };
    const gender = String(row.Genus ?? "").trim().slice(0, 1).toLowerCase();
    return { inflections: nounInflections(row, gender), gender };
  }
  if (candidate.wortart === "Verb" || candidate.wortart === "Hilfsverb") {
    const row = raw.verbs.get(candidate.key);
    return { inflections: row ? verbInflections(row) : [], gender: "" };
  }
  return { inflections: [], gender: "" };
}

// 词根词缀：只写能从词库内部证据得出的结论（复合词拆分、可分性），查不到就留空
export function morphologyFor(candidate, gender, lemmaSet) {
  const parts = [];
  if (gender) parts.push(`${GENDER_ZH[gender] ?? gender}`);
  const plural = candidate.inflections.find((item) => item.tags.includes("第一格·复数"))?.form;
  if (plural && plural.toLowerCase() !== candidate.lemma.toLowerCase()) {
    parts.push(`复数 ${plural.replace(/^(der|die|das) /, "")}`);
  }
  if (candidate.wortart === "Substantiv" || candidate.wortart === "Adjektiv") {
    const split = splitCompound(candidate.key, lemmaSet);
    if (split) parts.push(`复合词 ${split.join(" + ")}`);
  }
  if (candidate.wortart === "Verb" || candidate.wortart === "Hilfsverb") {
    const prefix = SEPARABLE.find((item) => candidate.key.startsWith(item) && candidate.key.length > item.length + 2);
    const inseparable = INSEPARABLE.find((item) => candidate.key.startsWith(item) && candidate.key.length > item.length + 2);
    const stem = prefix ? candidate.key.slice(prefix.length) : inseparable ? candidate.key.slice(inseparable.length) : "";
    if (prefix && lemmaSet.has(stem)) parts.push(`可分动词 ${prefix} + ${stem}`);
    else if (inseparable && lemmaSet.has(stem)) parts.push(`不可分动词 ${inseparable} + ${stem}`);
  }
  const irregular = candidate.wortart === "Verb" || candidate.wortart === "Hilfsverb" ? rawIrregular(candidate.key) : null;
  if (irregular) parts.push(irregular);
  return parts.join("；");
}

// 德语复合词的重心在最后一个成分（决定词性与基本义），只要尾部能对上词库就够；
// 尾部限长 5 以免把 -tag/-tor 这种短尾错认成复合词
function splitCompound(key, lemmaSet) {
  for (let len = key.length - 5; len >= 4; len -= 1) {
    const tail = key.slice(len);
    if (tail.length < 5 || !lemmaSet.has(tail)) continue;
    const head = key.slice(0, len);
    if (head.length < 3) continue;
    if (lemmaSet.has(head)) return [head, tail];
    const trimmed = head.replace(/s$/, "");
    return [lemmaSet.has(trimmed) ? trimmed : head, tail];
  }
  return null;
}

// 强变化动词的常见形式：只在确实命中时写，不做推测
const IRREGULAR = new Map([
  ["sein", "不规则：ist / war / gewesen"],
  ["haben", "不规则：hat / hatte / gehabt"],
  ["werden", "不规则：wird / wurde / geworden"],
  ["können", "不规则：kann / konnte / gekonnt"],
  ["müssen", "不规则：muss / musste / gemusst"],
  ["sollen", "不规则：soll / sollte / gesollt"],
  ["wollen", "不规则：will / wollte / gewollt"],
  ["dürfen", "不规则：darf / durfte / gedurft"],
  ["mögen", "不规则：mag / möchte / gemocht"],
  ["gehen", "不规则：geht / ging / gegangen"],
  ["sehen", "不规则：sieht / sah / gesehen"],
  ["fahren", "不规则：fährt / fuhr / gefahren"],
  ["sprechen", "不规则：spricht / sprach / gesprochen"],
  ["nehmen", "不规则：nimmt / nahm / genommen"],
  ["geben", "不规则：gibt / gab / gegeben"],
  ["kommen", "不规则：kommt / kam / gekommen"],
  ["finden", "不规则：findet / fand / gefunden"],
  ["trinken", "不规则：trinkt / trank / getrunken"],
]);

function rawIrregular(key) {
  return IRREGULAR.get(key) ?? null;
}

export function cefrBand(index) {
  if (index < 900) return "A2";
  if (index < 1700) return "B1";
  return "B1+";
}

export function loadSentences(tsvFile) {
  if (!fs.existsSync(tsvFile)) return [];
  const text = fs.readFileSync(tsvFile, "utf8");
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cells = line.split("\t");
    if (cells.length < 3) continue;
    const id = cells[0].trim();
    const textDe = cells.slice(2).join(" ").trim();
    if (!textDe) continue;
    out.push({ id, text: textDe });
  }
  return out;
}

const TOKEN = /[^\p{L}\p{M}'’-]+/u;

function tokens(text) {
  return text.toLowerCase().split(TOKEN).filter(Boolean);
}

// 每个词目留几句可读的语料句，供「阅读拼装」降级模式直接使用，
// 这样运行时不必把 48MB 语料读进内存，也能保证高亮词一定在文中出现
export function sampleSentences(index, key, sentences, limit = 4) {
  const list = index.get(key);
  if (!list?.length) return [];
  const usable = list
    .map((item) => sentences[item.position])
    .filter((sentence) => sentence.text.length >= 22 && sentence.text.length <= 100)
    .filter((sentence) => {
      const count = sentence.text.split(TOKEN).filter(Boolean).length;
      return count >= 4 && count <= 16;
    });
  const seen = new Set();
  const out = [];
  const step = Math.max(1, Math.floor(usable.length / limit));
  for (let i = 0; i < usable.length && out.length < limit; i += step) {
    const sentence = usable[i];
    if (seen.has(sentence.text)) continue;
    seen.add(sentence.text);
    out.push(sentence.text);
  }
  return out;
}

// 一次遍历语料，按小写词形建索引；保留原始大小写用于搭配展示
export function buildIndex(sentences, lemmaSet) {
  const hits = new Map();
  sentences.forEach((sentence, position) => {
    const raw = sentence.text.split(TOKEN).filter(Boolean);
    const words = raw.map((word) => word.toLowerCase());
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (!lemmaSet.has(word)) continue;
      if (!hits.has(word)) hits.set(word, []);
      const list = hits.get(word);
      if (list.length < 80) list.push({ position, index: i, words, raw });
    }
  });
  return hits;
}

export function chooseExample(index, key, sentences, pos = "") {
  const list = index.get(key);
  if (!list?.length) return null;
  const isVerb = pos.includes("动词");
  let best = null;
  for (const item of list) {
    const sentence = sentences[item.position];
    const length = sentence.text.length;
    const wordCount = item.words.length;
    if (length < 14 || length > 96 || wordCount < 3 || wordCount > 14) continue;
    let score = Math.abs(wordCount - 7) + length / 60;
    // 动词优先取以该动词收尾、或紧跟 zu/情态动词的句子，避开 sein/haben 的同形误命中
    if (isVerb) {
      const tail = new RegExp(`${key}[.!?]?$`, "i");
      const afterAux = new RegExp(`(?:\\bzu|kann|kannst|können|muss|müssen|will|willst|wollen|soll|sollen|darf|dürfen|möchte|möchten|wird|werden)\\s+${key}\\b`, "i");
      const text = sentence.text.trim();
      score += tail.test(text) || afterAux.test(text) ? 0 : 4;
    }
    if (!best || score < best.score) best = { score, sentence, wordCount };
  }
  if (!best) {
    const shortest = [...list]
      .map((item) => ({ item, sentence: sentences[item.position] }))
      .sort((a, b) => a.sentence.text.length - b.sentence.text.length)[0];
    if (!shortest) return null;
    best = { sentence: shortest.sentence, wordCount: shortest.item.words.length };
  }
  return { id: best.sentence.id, text: best.sentence.text, wordCount: best.wordCount };
}

const TRAILING_AUX = / (ist|sind|war|waren|hat|habe|haben|hatte|hatten|wird|werden|wurde|wurden|kann|kannst|können|muss|müssen|will|wollen|soll|sollen|darf|dürfen)$/i;

export function collocationsFor(index, key, limit = 3) {
  const list = index.get(key);
  if (!list?.length) return [];
  const counts = new Map();
  for (const item of list) {
    const { raw, index: at } = item;
    // 只留名词性/介词性搭配：句末助动词会把「主语 + 助动词」混进来
    const spans = [
      raw.slice(Math.max(0, at - 2), at + 1).join(" "),
      raw.slice(at, at + 3).join(" "),
      raw.slice(Math.max(0, at - 1), at + 2).join(" "),
    ];
    for (const span of spans) {
      if (!span.includes(" ") || span.length > 32) continue;
      if (TRAILING_AUX.test(span)) continue;
      counts.set(span, (counts.get(span) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase, count]) => ({ phrase, count }));
}
