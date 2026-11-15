import { tokenize } from "../text.mjs";
import { CN_JOURNALS, INTERESTS, tierLabel } from "./journals.mjs";
import { behaviourPool } from "./store.mjs";

const AUTHORITY_POINTS = { 1: 12, 2: 8.5, 3: 5.5 };
const TERM_CAP = 4;
const interestTermCache = new Map();

function ageDays(published) {
  const ms = Date.parse(String(published ?? ""));
  if (Number.isNaN(ms)) return 999;
  return Math.max(0, (Date.now() - ms) / 86400e3);
}

function textOf(row) {
  return `${row.title ?? ""} ${row.abstract ?? ""} ${row.journal ?? ""}`;
}

// 一次构建里同一行会被评分多轮（速递/高关注/画像），分词结果按行对象复用
const tokenCache = new WeakMap();

function tokensOf(row) {
  let tokens = tokenCache.get(row);
  if (!tokens) {
    tokens = tokenize(textOf(row));
    tokenCache.set(row, tokens);
  }
  return tokens;
}

// 画像完全来自本地行为：读过/收藏过什么、屏蔽过什么，不上传、不依赖任何外部服务
export function buildProfile() {
  const { positive, negative, signalCount } = behaviourPool();
  const terms = new Map();
  const fields = new Map();
  const accumulate = (row, weight) => {
    for (const token of tokenize(textOf(row))) {
      terms.set(token, (terms.get(token) ?? 0) + weight);
    }
    if (row.interest) fields.set(row.interest, (fields.get(row.interest) ?? 0) + weight * 3);
    if (row.field) fields.set(row.field, (fields.get(row.field) ?? 0) + weight * 3);
  };
  for (const row of positive) accumulate(row, row.saved ? 1.6 : 1);
  for (const row of negative) accumulate(row, -1.5);

  const topTerms = [...terms.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, weight]) => ({ term, weight: Number(weight.toFixed(1)) }));

  return { terms, fields, topTerms, signalCount, samples: positive.length + negative.length };
}

function profileScore(row, profile) {
  if (!profile.signalCount && !profile.terms.size) return 0;
  let hit = 0;
  let count = 0;
  for (const token of tokensOf(row)) {
    count += 1;
    const weight = profile.terms.get(token);
    if (weight) hit += Math.sign(weight) * Math.min(Math.abs(weight), TERM_CAP);
  }
  if (!count) return 0;
  return Math.max(-6, Math.min(9, (hit / Math.sqrt(count)) * 1.9));
}

function interestTerms(interest) {
  const cached = interestTermCache.get(interest.id);
  if (cached) return cached;
  const phrases = [];
  const words = new Set();
  for (const term of interest.terms) {
    const tokens = [...tokenize(term)];
    // 多词术语只认整短语相邻命中：单个 human、law 谁都能沾边，法学栏会被化工刊挤进去
    if (tokens.length > 1) phrases.push(tokens.join(" "));
    else for (const token of tokens) words.add(token);
  }
  const entry = { phrases, words };
  interestTermCache.set(interest.id, entry);
  return entry;
}

const flatCache = new WeakMap();

function flatText(row) {
  let text = flatCache.get(row);
  if (!text) {
    text = String(textOf(row))
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff\s]+/g, " ")
      .replace(/\s+/g, " ");
    flatCache.set(row, text);
  }
  return text;
}

function termOverlap(row, interest) {
  const { phrases, words } = interestTerms(interest);
  const text = flatText(row);
  const tokens = tokensOf(row);
  let shared = 0;
  for (const phrase of phrases) if (text.includes(phrase)) shared += 1;
  for (const word of words) if (tokens.has(word)) shared += 1;
  return shared;
}

// 显式筛选：先认学科归属，归属缺失的靠词表重叠兜底
export function matchesInterest(row, interest) {
  if (!interest) return true;
  if (row.interest === interest.id || row.field === interest.id) return true;
  return termOverlap(row, interest) >= 2;
}

export function scoreWork(row, { profile, interest, profileInterest }) {
  const days = ageDays(row.published);
  const tier = Number(row.tier ?? 0);
  const reasons = [];
  let score = 0;

  if (tier > 0) {
    score += AUTHORITY_POINTS[tier] ?? 2;
    reasons.push(`${row.journal} · ${tierLabel(tier)}`);
  } else if (String(row.journal ?? "").startsWith("arXiv")) {
    score += 1.5;
    reasons.push(`预印本 ${String(row.journal).replace("arXiv:", "")}`);
  } else {
    score += 2;
  }

  const cnHit = CN_JOURNALS.find((term) => String(row.journal ?? "").includes(term));
  if (cnHit) {
    score += 4;
    reasons.push(`中文核心 · ${cnHit}`);
  }

  // 新鲜度：一周内最强，两周后基本让位给热度信号
  const freshness = Math.exp(-days / 7) * 10;
  score += freshness;
  if (days <= 3) reasons.push("近 3 天新发");
  else if (days <= 10) reasons.push("近两周新发");

  // 引用速度：按天归一，避免老年份论文靠绝对引用数霸榜
  const cited = Number(row.cited ?? 0);
  const velocity = cited / Math.max(days, 3);
  if (cited > 0) {
    score += Math.log1p(velocity) * 5 + Math.log1p(cited) * 1.6;
    if (velocity >= 3) reasons.push(`引用加速 ${velocity.toFixed(1)}/天`);
    else if (cited >= 30) reasons.push(`已被引 ${cited}`);
  }

  if (row.oa) {
    score += 1.2;
    reasons.push("开放获取");
  }
  if (String(row.abstract ?? "").length >= 120) score += 2;
  if (String(row.authors ?? "").length > 3) score += 0.6;

  // 兴趣筛选：显式选择优先，其次看采集时的学科归属
  if (interest && (row.interest === interest.id || row.field === interest.id)) {
    score += 5;
    reasons.push(`匹配「${interest.label}」`);
  } else if (interest) {
    const overlap = termOverlap(row, interest);
    if (overlap >= 2) {
      score += Math.min(4, overlap * 0.9);
      reasons.push(`与「${interest.label}」相关`);
    }
  }
  if (profileInterest && row.interest === profileInterest) {
    score += 1.5;
  }

  const personal = profileScore(row, profile);
  score += personal;
  if (personal >= 2.5) reasons.push("贴合你的阅读记录");
  else if (personal <= -2) reasons.push("你屏蔽过类似主题");

  if (row.saved) score += 3;
  return { score: Number(score.toFixed(2)), reasons: reasons.slice(0, 3), days, velocity: Number(velocity.toFixed(2)) };
}

function toWork(row, scored) {
  return {
    key: row.key,
    kind: row.kind,
    title: row.title,
    titleZh: row.title_zh || null,
    abstract: row.abstract || "",
    abstractZh: row.abstract_zh || null,
    journal: row.journal || row.account || "",
    account: row.account || null,
    url: row.url,
    doi: row.doi,
    authors: row.authors || "",
    published: row.published,
    cited: Number(row.cited ?? 0),
    tier: Number(row.tier ?? 0),
    field: row.field,
    interest: row.interest,
    lang: row.lang,
    oa: Boolean(row.oa),
    saved: Boolean(row.saved),
    viewed: Boolean(row.viewed),
    source: row.source,
    score: scored.score,
    velocity: scored.velocity,
    reasons: scored.reasons,
  };
}

// 每刊最多 3 条、预印本最多 8 条、同一采集源不超过一半，避免单一渠道刷屏
export function diversify(list, { perJournal = 3, preprintCap = 8 } = {}) {
  const journalCount = new Map();
  const out = [];
  let preprints = 0;
  for (const item of list) {
    const isPreprint = String(item.journal ?? "").startsWith("arXiv") || item.journal === "ChinaXiv 预印本";
    if (isPreprint && preprints >= preprintCap) continue;
    const key = (item.journal ?? item.account ?? "").toLowerCase();
    const used = journalCount.get(key) ?? 0;
    if (used >= perJournal) continue;
    journalCount.set(key, used + 1);
    if (isPreprint) preprints += 1;
    out.push(item);
  }
  return out;
}

export function rankWorks(rows, { profile, interestId, limit = 60 } = {}) {
  const interest = INTERESTS.find((entry) => entry.id === interestId) ?? null;
  const pool = interest ? rows.filter((row) => matchesInterest(row, interest)) : rows;
  const scored = pool
    .map((row) => ({ row, scored: scoreWork(row, { profile, interest }) }))
    .filter((entry) => entry.scored.score > 0)
    .sort((a, b) => b.scored.score - a.scored.score);
  const works = scored.map((entry) => toWork(entry.row, entry.scored));
  const diverse = diversify(works);
  // 多样化后不足配额时回填，保证「论文速递」不为空
  const result = diverse.length >= Math.min(limit, 18) ? diverse : works;
  return result.slice(0, limit);
}

// 速递窗口只有三周，绝对引用数天然很低，所以门槛随供给放宽
export function rankRising(rows, { profile, interestId, limit = 10 } = {}) {
  const interest = INTERESTS.find((entry) => entry.id === interestId) ?? null;
  const pool = interest ? rows.filter((row) => matchesInterest(row, interest)) : rows;
  const pick = (minCited, maxDays) =>
    pool
      .map((row) => ({ row, scored: scoreWork(row, { profile }) }))
      .filter(
        (entry) =>
          entry.row.cited >= minCited &&
          entry.scored.days <= maxDays &&
          (entry.row.tier > 0 || entry.scored.velocity >= 1),
      )
      .sort((a, b) => b.scored.velocity - a.scored.velocity || b.scored.score - a.scored.score)
      .slice(0, limit);

  let selected = pick(8, 120);
  if (selected.length < 6) selected = pick(3, 120);
  if (selected.length < 6) selected = pick(1, 120);
  // 该兴趣下近期引用数据太薄，退回全库，高关注栏宁可宽不可空
  if (selected.length < 6 && interest) return rankRising(rows, { profile, limit });
  return selected.map((entry) => {
    const work = toWork(entry.row, entry.scored);
    work.reasons = [`${tierLabel(work.tier)} · 已被引 ${work.cited}`, ...work.reasons].slice(0, 3);
    return work;
  });
}

export function rankArticles(rows, { profile, interestId, limit = 40 } = {}) {
  const interest = INTERESTS.find((entry) => entry.id === interestId) ?? null;
  const matched = interest ? rows.filter((row) => matchesInterest(row, interest)) : rows;
  // 科普源本身不带学科标签，命中太少时保持全量，避免筛选后整栏空掉
  const pool = matched.length >= Math.min(6, limit) ? matched : rows;
  const scored = pool
    .map((row) => ({ row, scored: scoreWork(row, { profile, interest }) }))
    .sort((a, b) => b.scored.score - a.scored.score);
  const out = scored.map((entry) => toWork(entry.row, entry.scored));
  // 科普源就那么几家：名额按源数分，否则读过的两三家会占满整栏，新加的杂志永远进不来
  const sources = new Set(out.map((work) => String(work.journal ?? work.account ?? "").toLowerCase()).filter(Boolean));
  const perSource = Math.max(3, Math.ceil(limit / Math.max(1, sources.size)));
  return diversify(out, { perJournal: perSource, preprintCap: 99 }).slice(0, limit);
}
