import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../cache.mjs";
import { GRAMMAR_BY_ID } from "./grammar-de.mjs";
import { listCards, loadPassage, savePassage, deletePassage } from "./store.mjs";

const PASSAGE_DIR = path.join(DATA_DIR, "learn", "passages");
const TARGET_MIN = 800;
const TARGET_MAX = 1200;
const MAX_ATTEMPTS = 3;

const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu;

export function tokenize(textDe) {
  const out = [];
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(textDe))) {
    out.push({ start: match.index, end: match.index + match[0].length, word: match[0] });
  }
  return out;
}

// 高亮只认「当日批次里、且确实出现在文中」的词形；两者互为子集，杜绝悬空高亮
function attachHighlights(textDe, batchByLemma) {
  const highlighted = new Set();
  const tokens = tokenize(textDe).map((token) => {
    const card = batchByLemma.get(token.word.toLowerCase());
    const base = { word: token.word, start: token.start, end: token.end };
    if (!card) return { ...base, isHighlight: false };
    highlighted.add(card.id);
    return { ...base, cardId: card.id, isHighlight: true };
  });
  return { tokens, highlightedCardIds: [...highlighted] };
}

function sentencesOf(textDe) {
  const out = [];
  const re = /[^.!?]+[.!?]*/g;
  let match;
  while ((match = re.exec(textDe))) {
    const raw = match[0];
    if (!raw.trim()) continue;
    const lead = raw.length - raw.trimStart().length;
    out.push({ start: match.index + lead, end: match.index + raw.trimEnd().length, text: raw.trim() });
  }
  return out;
}

const SEIN = new Set(["bin", "bist", "ist", "sind", "seid", "war", "waren", "wäre", "wären"]);
const HABEN = new Set(["habe", "hast", "hat", "haben", "habt", "hatte", "hatten"]);
const PASSIV_AUX = new Set(["wird", "werden", "wurde", "wurden", "werde"]);
const MODAL = new Set(["kann", "kannst", "können", "muss", "musst", "müssen", "will", "willst", "wollen", "soll", "sollst", "sollen", "darf", "dürfen", "möchte", "möchten", "mag"]);
const KONJ2 = new Set(["wäre", "wären", "hätte", "hätten", "könnte", "könnten", "müsste", "müssten", "dürfte", "dürften", "würde", "würden", "sollte", "sollten"]);
const SUBJUNKTION = new Set(["weil", "dass", "obwohl", "damit", "wenn", "ob", "während", "bevor", "nachdem", "seitdem", "falls", "indem", "sobald"]);
const NEGATION = new Set(["nicht", "kein", "keine", "keinen", "keinem", "keiner", "keines"]);
const DATIV_PREP = new Set(["mit", "nach", "aus", "bei", "von", "zu", "seit", "gegenüber"]);
const AKK_PREP = new Set(["für", "um", "durch", "gegen", "ohne", "wider"]);
const WECHSEL_PREP = new Set(["in", "an", "auf", "über", "unter", "vor", "hinter", "neben", "zwischen"]);
const DATIV_ARTICLE = new Set(["dem", "der", "den", "einem", "einer", "diesem", "dieser", "mir", "dir", "ihm", "uns", "euch", "ihnen"]);
const AKK_ARTICLE = new Set(["den", "die", "das", "einen", "eine", "ein", "mich", "dich", "ihn", "sie", "es", "diesen", "diese", "dieses"]);
const PARTAUX = ["gegangen", "gekommen", "gefahren", "geworden", "geblieben", "passiert", "gelaufen", "geflogen", "geritten", "geschehen"];

const PARTICIPLE = /^ge[a-zäöüß]{2,}(?:t|en)$/i;
// 不可分动词的第二分词与不定式同形，只能靠白名单认
const INSEP_PARTIZIP = new Set(["verstanden", "bekommen", "vergessen", "entschieden", "erzählt", "verloren", "erklärt", "erlaubt", "verboten", "verglichen", "entwickelt", "benutzt", "besucht"]);

function isParticiple(word) {
  const lower = word.toLowerCase();
  return PARTICIPLE.test(lower) || INSEP_PARTIZIP.has(lower);
}

// 语法点检测：每个 detector 只认高置信度的表层标记，宁可少认也不误标
const DETECTORS = [
  {
    id: "perfekt",
    match(words) {
      for (let i = 0; i < words.length; i += 1) {
        const aux = words[i].toLowerCase();
        if (!SEIN.has(aux) && !HABEN.has(aux)) continue;
        for (let j = i + 1; j < Math.min(words.length, i + 6); j += 1) {
          if (isParticiple(words[j])) return { from: i, to: j };
        }
      }
      return null;
    },
  },
  {
    id: "prozess-passiv",
    match(words) {
      for (let i = 0; i < words.length; i += 1) {
        if (!PASSIV_AUX.has(words[i].toLowerCase())) continue;
        for (let j = i + 1; j < Math.min(words.length, i + 7); j += 1) {
          if (isParticiple(words[j])) return { from: i, to: j };
        }
      }
      return null;
    },
  },
  {
    id: "zustand-passiv",
    match(words) {
      for (let i = 0; i < words.length; i += 1) {
        if (!SEIN.has(words[i].toLowerCase())) continue;
        const candidate = words.slice(i + 1, i + 7).map((word) => word.toLowerCase());
        const at = candidate.findIndex((word) => isParticiple(word));
        if (at < 0) continue;
        if (candidate.includes("worden")) continue;
        if (PARTAUX.includes(candidate[at])) continue;
        return { from: i, to: i + 1 + at };
      }
      return null;
    },
  },
  {
    id: "plusquamperfekt",
    match(words) {
      for (let i = 0; i < words.length; i += 1) {
        const aux = words[i].toLowerCase();
        if (!["hatte", "hatten", "war", "waren"].includes(aux)) continue;
        for (let j = i + 1; j < Math.min(words.length, i + 6); j += 1) {
          if (isParticiple(words[j])) return { from: i, to: j };
        }
      }
      return null;
    },
  },
  {
    id: "futur1",
    match(words) {
      for (let i = 0; i < words.length; i += 1) {
        if (!["werde", "wirst", "wird", "werden", "werdet"].includes(words[i].toLowerCase())) continue;
        const last = words[words.length - 1].toLowerCase();
        if (i < words.length - 1 && /(?:en|ern|eln)$/.test(last)) return { from: i, to: words.length - 1 };
      }
      return null;
    },
  },
  {
    id: "konjunktiv2",
    match(words) {
      const at = words.findIndex((word) => KONJ2.has(word.toLowerCase()));
      if (at < 0) return null;
      return { from: at, to: at };
    },
  },
  {
    id: "modal-verbs",
    match(words) {
      for (let i = 0; i < words.length; i += 1) {
        if (!MODAL.has(words[i].toLowerCase())) continue;
        if (/^(?:en|ern|eln)$/i.test(words[words.length - 1])) return { from: i, to: words.length - 1 };
        if (words.length > i + 2) return { from: i, to: Math.min(words.length - 1, i + 3) };
      }
      return null;
    },
  },
  {
    id: "subjunktion-weil-dass",
    match(words) {
      const at = words.findIndex((word) => SUBJUNKTION.has(word.toLowerCase()));
      if (at < 0) return null;
      return { from: at, to: words.length - 1 };
    },
  },
  {
    id: "dativ-praepositionen",
    match(words) {
      for (let i = 0; i < words.length - 1; i += 1) {
        if (!DATIV_PREP.has(words[i].toLowerCase())) continue;
        if (DATIV_ARTICLE.has(words[i + 1].toLowerCase())) return { from: i, to: i + 1 };
      }
      return null;
    },
  },
  {
    id: "akkusativ-praepositionen",
    match(words) {
      for (let i = 0; i < words.length - 1; i += 1) {
        if (!AKK_PREP.has(words[i].toLowerCase())) continue;
        if (AKK_ARTICLE.has(words[i + 1].toLowerCase())) return { from: i, to: i + 1 };
      }
      return null;
    },
  },
  {
    id: "wechsel-praepositionen",
    match(words) {
      for (let i = 0; i < words.length - 1; i += 1) {
        if (!WECHSEL_PREP.has(words[i].toLowerCase())) continue;
        const next = words[i + 1].toLowerCase();
        if (DATIV_ARTICLE.has(next) || AKK_ARTICLE.has(next)) return { from: i, to: i + 1 };
      }
      return null;
    },
  },
  {
    id: "negation",
    match(words) {
      const at = words.findIndex((word) => NEGATION.has(word.toLowerCase()));
      return at < 0 ? null : { from: at, to: at };
    },
  },
  {
    id: "formales-subjekt-es",
    match(words) {
      return words[0]?.toLowerCase() === "es" ? { from: 0, to: 0 } : null;
    },
  },
  {
    id: "relativsatz",
    match(words, text) {
      const re = /,\s*(der|die|das|den|dem|dessen|deren|welche|welcher|welches)\s/i;
      const hit = re.exec(text);
      if (!hit) return null;
      const at = words.findIndex((word) => word.toLowerCase() === hit[1].toLowerCase());
      return at < 0 ? null : { from: at, to: words.length - 1 };
    },
  },
  {
    id: "um-zu",
    match(words) {
      const um = words.findIndex((word) => word.toLowerCase() === "um");
      const zu = words.findIndex((word) => word.toLowerCase() === "zu");
      if (um < 0 || zu < um + 1) return null;
      return { from: um, to: Math.min(words.length - 1, zu + 1) };
    },
  },
  {
    id: "infinitiv-mit-zu",
    match(words) {
      for (let i = 0; i < words.length - 1; i += 1) {
        if (words[i].toLowerCase() !== "zu") continue;
        const next = words[i + 1];
        if (/^[a-zäöüß].*(?:en|ern|eln)$/.test(next)) return { from: i, to: i + 1 };
      }
      return null;
    },
  },
  {
    id: "konjunktion-und-aber",
    match(words) {
      for (let i = 1; i < words.length - 1; i += 1) {
        if (!["und", "aber", "denn", "sondern", "oder"].includes(words[i].toLowerCase())) continue;
        if (/^(?:der|die|das|den|dem|ein|eine|ich|du|er|sie|es|wir|ihr|man|nicht)$/i.test(words[i + 1])) return { from: i, to: i + 1 };
      }
      return null;
    },
  },
  {
    id: "adjektivdeklination",
    match(words) {
      for (let i = 0; i < words.length - 2; i += 1) {
        if (!["der", "die", "das", "den", "dem", "ein", "eine", "einem", "einen"].includes(words[i].toLowerCase())) continue;
        const adj = words[i + 1];
        const noun = words[i + 2];
        if (!/^[A-ZÄÖÜ]/.test(noun)) continue;
        if (!/^[a-zäöüß]{3,}(?:e|en|em|er|es)$/.test(adj)) continue;
        return { from: i, to: i + 2 };
      }
      return null;
    },
  },
  {
    id: "prateritum",
    match(words) {
      const at = words.findIndex((word) => ["war", "hatte", "konnte", "musste", "wollte", "sollte", "durfte", "mochte", "ging", "kam", "sah", "gab"].includes(word.toLowerCase()));
      return at < 0 ? null : { from: at, to: at };
    },
  },
];

// 从文本里抽语法点：每个点至少两条文中证据，主证据走 evidenceSentence/evidenceSpan
function detectGrammar(textDe, sentences, tokens) {
  const points = [];
  for (const detector of DETECTORS) {
    const definition = GRAMMAR_BY_ID.get(detector.id);
    if (!definition || definition.outline !== "四级") continue;
    const evidence = [];
    for (const sentence of sentences) {
      if (evidence.length >= 3) break;
      const words = sentence.text.match(WORD_RE) ?? [];
      if (words.length < 3) continue;
      const hit = detector.match(words, sentence.text);
      if (!hit) continue;
      const start = sentence.start;
      evidence.push({
        evidenceSentence: sentence.text,
        evidenceSpan: [start, sentence.end],
      });
    }
    if (evidence.length < 2) continue;
    points.push({
      grammarId: definition.id,
      titleZh: definition.titleZh,
      outline: definition.outline,
      explainZh: definition.explainZh,
      contrast: definition.contrast,
      evidenceSentence: evidence[0].evidenceSentence,
      evidenceSpan: evidence[0].evidenceSpan,
      extraEvidence: evidence.slice(1),
    });
  }
  return points.slice(0, 5);
}

export function validatePassage(passage, batchIds, { strictLength = true } = {}) {
  const problems = [];
  const batch = new Set(batchIds);
  const highlighted = new Set(passage.highlightedCardIds ?? []);

  for (const id of highlighted) {
    if (!batch.has(id)) problems.push(`高亮词 ${id} 不在当日批次内`);
  }
  const tokenIds = new Set((passage.tokenized ?? []).filter((token) => token.cardId).map((token) => token.cardId));
  for (const id of tokenIds) {
    if (!highlighted.has(id)) problems.push(`文中出现的 ${id} 未登记为高亮`);
  }
  for (const id of highlighted) {
    if (!tokenIds.has(id)) problems.push(`高亮 ${id} 在文中找不到对应词形`);
  }
  for (const token of passage.tokenized ?? []) {
    if (token.isHighlight && !token.cardId) problems.push(`悬空高亮：${token.word}`);
  }

  const points = passage.grammarPoints ?? [];
  if (!points.length) problems.push("没有任何语法点");
  for (const point of points) {
    const total = 1 + (point.extraEvidence?.length ?? 0);
    if (total < 2) problems.push(`语法点 ${point.grammarId} 只有 ${total} 条证据`);
    for (const item of [{ evidenceSentence: point.evidenceSentence, evidenceSpan: point.evidenceSpan }, ...(point.extraEvidence ?? [])]) {
      const [start, end] = item.evidenceSpan ?? [];
      if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
        problems.push(`语法点 ${point.grammarId} 的证据区间不合法`);
        continue;
      }
      const slice = passage.textDe.slice(start, end);
      if (!slice) problems.push(`语法点 ${point.grammarId} 的证据区间取不到文本`);
      else if (!slice.includes(item.evidenceSentence.slice(0, 12))) {
        problems.push(`语法点 ${point.grammarId} 的证据句与区间文本不一致`);
      }
    }
  }

  if (strictLength && (passage.wordCount < TARGET_MIN || passage.wordCount > TARGET_MAX)) {
    problems.push(`篇幅 ${passage.wordCount} 词，不在 ${TARGET_MIN}-${TARGET_MAX} 区间`);
  }
  return problems;
}

function readAuthored() {
  if (!fs.existsSync(PASSAGE_DIR)) return [];
  return fs
    .readdirSync(PASSAGE_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      try {
        return { ...JSON.parse(fs.readFileSync(path.join(PASSAGE_DIR, name), "utf8")), slot: name };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function hashKey(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0);
}

function assembleFromSamples(cards, seed, wordBudget) {
  const shuffle = (list) => {
    const out = [...list];
    let state = seed || 1;
    for (let i = out.length - 1; i > 0; i -= 1) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const j = state % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const sentences = [];
  const seen = new Set();
  for (const card of shuffle(cards)) {
    for (const sentence of shuffle(card.sampleSentences ?? [])) {
      if (seen.has(sentence)) continue;
      const words = sentence.match(WORD_RE)?.length ?? 0;
      if (words < 4 || words > 18) continue;
      seen.add(sentence);
      sentences.push(sentence);
      if (sentences.reduce((sum, item) => sum + (item.match(WORD_RE)?.length ?? 0), 0) >= wordBudget) break;
    }
    if (sentences.reduce((sum, item) => sum + (item.match(WORD_RE)?.length ?? 0), 0) >= wordBudget) break;
  }
  // 每 6 句一段，便于排版成段落
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 6) paragraphs.push(sentences.slice(i, i + 6).join(" "));
  return paragraphs.join("\n\n");
}

// 阅读文本装配：优先作者稿（连贯），否则用语料句拼装并标记 degraded
export function ensurePassage(dateKey, cards) {
  const existing = loadPassage(dateKey);
  // 空壳或从未通过校验的存档不能复用，否则会把「读到空白页」一直带到后面
  if (existing?.tokenized?.length && existing.grammarPoints?.length) return existing;
  if (existing) deletePassage(dateKey);

  const batchByLemma = new Map();
  for (const card of cards) {
    const key = card.lemma.toLowerCase();
    if (!batchByLemma.has(key)) batchByLemma.set(key, card);
  }
  const batchIds = cards.map((card) => card.id);
  const authored = readAuthored();

  let textDe = "";
  let translationZh = "";
  let degraded = false;
  let attempts = 0;
  const seed = hashKey(dateKey);

  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts += 1) {
    if (authored.length) {
      const pick = authored[(seed + attempts - 1) % authored.length];
      textDe = pick.textDe;
      translationZh = pick.translationZh ?? "";
    } else {
      textDe = assembleFromSamples(cards, seed + attempts, TARGET_MIN + 60);
      translationZh = "（拼装模式：本文由真实语料句拼接，整篇译文暂不提供）";
      degraded = true;
    }
    const candidate = buildPassage(dateKey, textDe, batchByLemma, cards, { translationZh, degraded });
    if (!validatePassage(candidate, batchIds, { strictLength: !degraded }).length) {
      savePassage(candidate);
      return loadPassage(dateKey);
    }
  }

  // 三次都不过：降级为「已验证词条拼装」，篇幅允许不足，但高亮与语法证据仍须成立
  degraded = true;
  textDe = assembleFromSamples(cards, seed + 101, Math.round(TARGET_MIN * 0.7));
  const fallback = buildPassage(dateKey, textDe, batchByLemma, cards, {
    translationZh: "（降级模式：语料句拼装，整篇译文暂不提供）",
    degraded: true,
  });
  savePassage(fallback);
  return loadPassage(dateKey);
}

function buildPassage(dateKey, textDe, batchByLemma, cards, meta) {
  const { tokens, highlightedCardIds } = attachHighlights(textDe, batchByLemma);
  const sentences = sentencesOf(textDe);
  const grammarPoints = detectGrammar(textDe, sentences, tokens);
  return {
    dateKey,
    textDe,
    tokenized: tokens,
    highlightedCardIds,
    fullTranslationZh: meta.translationZh ?? "",
    grammarPoints,
    audioUrl: "",
    verified: !meta.degraded,
    degraded: Boolean(meta.degraded),
    wordCount: tokens.length,
  };
}
