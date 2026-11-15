import crypto from "node:crypto";

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  laquo: "«",
  raquo: "»",
};

export function decodeEntities(input = "") {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function stripHtml(input = "") {
  return decodeEntities(
    String(input)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text, max) {
  if (!text) return "";
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max).join("").trim()}…`;
}

export function hashKey(text) {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 20);
}

export function firstImageFromHtml(html = "") {
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(String(html));
  if (!match) return null;
  const src = match[1].trim();
  if (!/^https?:\/\//i.test(src)) return null;
  return src;
}

const SINGLE_CJK_STOP = new Set([
  ..."的了是在和与及或而但也就都还又很更最将被把对于从到向以中共各该其此这那有一不没很等即并未所之者过个们",
]);

const CJK_STOP = new Set([
  "表示",
  "报道",
  "消息",
  "记者",
  "当地",
  "今天",
  "昨日",
  "目前",
  "已经",
  "可以",
  "我们",
  "他们",
  "以及",
  "但是",
  "因为",
  "所以",
  "这个",
  "这些",
  "那些",
  "一个",
  "进行",
  "出现",
  "发生",
  "有关",
  "相关",
  "最新",
  "视频",
  "图片",
  "独家",
  "快讯",
  "如何",
  "什么",
  "为何",
  "是否",
  "可能",
  "仍然",
  "宣布",
  "指出",
]);

const LATIN_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "has",
  "have",
  "had",
  "will",
  "would",
  "could",
  "should",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "his",
  "her",
  "their",
  "our",
  "your",
  "after",
  "before",
  "over",
  "under",
  "about",
  "into",
  "amid",
  "says",
  "said",
  "new",
  "more",
  "than",
  "top",
  "world",
]);

export function tokenize(text = "") {
  const tokens = new Set();
  const normalized = String(text)
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, " ")
    .replace(/[^\p{Script=Han}a-z0-9\s]/gu, " ");

  for (const word of normalized.match(/[a-z][a-z0-9'-]{2,}/g) ?? []) {
    if (!LATIN_STOP.has(word)) tokens.add(word);
  }

  const hanRuns = normalized.match(/[\p{Script=Han}]+/gu) ?? [];
  for (const run of hanRuns) {
    const chars = Array.from(run);
    for (const char of chars) {
      if (!SINGLE_CJK_STOP.has(char)) tokens.add(char);
    }
    for (let i = 0; i < chars.length - 1; i += 1) {
      const bigram = chars[i] + chars[i + 1];
      if (!CJK_STOP.has(bigram)) tokens.add(bigram);
    }
  }

  return tokens;
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const token of small) if (large.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function containment(a, b) {
  if (!a.size || !b.size) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const token of small) if (large.has(token)) shared += 1;
  return shared / small.size;
}
