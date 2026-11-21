// 公网静态版的学习栏状态层：和 server/learn/store.mjs 同一套流程锁语义，
// 只是把 sqlite 换成 localStorage。单词池和阅读文本来自 site/data/learn.json。
import type { Flow, FlowUpdate, Gates, LearnState, Passage, StatsPayload, WordCard } from "./types";

const KEY = "yuejie.learn.v1";
const DEFAULT_TARGET = 1000;

export interface LearnBundle {
  generatedAt: string;
  poolSize: number;
  pool: WordCard[];
  passages: {
    id: string;
    titleZh: string;
    textDe: string;
    translationZh: string;
    grammarPoints: Passage["grammarPoints"];
  }[];
}

interface DayBatchItem {
  wordId: string;
  wasNew: boolean;
  reviewed: boolean;
  later: boolean;
}

interface DayRecord {
  batch: DayBatchItem[];
  mixed: boolean;
  target: number;
  reachedBottom: boolean;
  grammarConfirmed: boolean;
  confirmedIds: string[];
  touchedIds: string[];
  readingCompleted: boolean;
  played: boolean;
  dayComplete: boolean;
  newCards: number;
  minutes: number;
}

interface Persist {
  seen: string[];
  settings: { target: number; confirmed: boolean };
  days: Record<string, DayRecord>;
}

let bundlePromise: Promise<LearnBundle> | null = null;

export function loadBundle(): Promise<LearnBundle> {
  if (!bundlePromise) {
    // 静态站把词库放在同源的 data/learn.json，不需要经过 apiUrl 的映射
    bundlePromise = fetch(new URL("data/learn.json", document.baseURI).href)
      .then((res) => {
        if (!res.ok) throw new Error(`学习数据加载失败 (${res.status})`);
        return res.json() as Promise<LearnBundle>;
      })
      .catch((error) => {
        bundlePromise = null;
        throw error;
      });
  }
  return bundlePromise;
}

export function bundleReady() {
  return bundlePromise;
}

function read(): Persist {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Persist | null;
    if (raw?.days && Array.isArray(raw.seen)) {
      return { seen: raw.seen, settings: raw.settings ?? { target: DEFAULT_TARGET, confirmed: false }, days: raw.days };
    }
  } catch {
    /* 坏数据直接重建 */
  }
  return { seen: [], settings: { target: DEFAULT_TARGET, confirmed: false }, days: {} };
}

function write(state: Persist) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function todayKey() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function shiftKey(dateKey: string, delta: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(year, month - 1, day + delta, 12);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`;
}

function ensureDay(state: Persist, bundle: LearnBundle, dateKey: string): DayRecord {
  const existing = state.days[dateKey];
  if (existing) return existing;

  const target = Math.min(Math.max(state.settings.target || DEFAULT_TARGET, 10), 5000);
  const seen = new Set(state.seen);
  const fresh = bundle.pool.filter((word) => !seen.has(word.id)).slice(0, target);
  const batch: DayBatchItem[] = fresh.map((word) => ({ wordId: word.id, wasNew: true, reviewed: false, later: false }));

  let mixed = false;
  if (batch.length < target && state.seen.length) {
    mixed = true;
    const pool = state.seen.slice();
    for (let i = 0; batch.length < target; i += 1) {
      batch.push({ wordId: pool[i % pool.length], wasNew: false, reviewed: false, later: false });
    }
  }

  const record: DayRecord = {
    batch,
    mixed,
    target,
    reachedBottom: false,
    grammarConfirmed: false,
    confirmedIds: [],
    touchedIds: [],
    readingCompleted: false,
    played: false,
    dayComplete: false,
    newCards: 0,
    minutes: 0,
  };
  state.days[dateKey] = record;
  write(state);
  return record;
}

function flowOf(_state: Persist, day: DayRecord, dateKey: string): Flow {
  const reviewed = day.batch.filter((item) => item.reviewed).length;
  const total = day.batch.length;
  return {
    dateKey,
    vocabulary: { total, reviewed, completed: total > 0 && reviewed >= total },
    reading: {
      unlocked: total > 0 && reviewed >= total,
      reachedBottom: day.reachedBottom,
      grammarConfirmed: day.grammarConfirmed,
      completed: day.readingCompleted,
    },
    listening: { unlocked: day.grammarConfirmed, played: day.played, completed: day.played },
    stats: { newCardsSeen: day.newCards, minutesSpent: day.minutes, streaks: 0 },
    mixedMode: day.mixed,
    target: day.target,
    dayComplete: day.dayComplete,
    updatedAt: new Date().toISOString(),
  };
}

function gatesOf(flow: Flow): Gates {
  if (!flow.reading.unlocked) {
    const left = Math.max(flow.vocabulary.total - flow.vocabulary.reviewed, 0);
    const reason = left > 0 ? `还差 ${left} 张卡片解锁阅读` : "当日卡片尚未开始";
    return { reading: { ok: false, redirect: "vocabulary", reason }, listening: { ok: false, redirect: "vocabulary", reason: "先完成当日卡片才能进入阅读" } };
  }
  if (!flow.listening.unlocked) {
    const reason = !flow.reading.reachedBottom ? "阅读尚未滑动到底部" : "语法点尚未确认";
    return { reading: { ok: true }, listening: { ok: false, redirect: "reading", reason } };
  }
  return { reading: { ok: true }, listening: { ok: true } };
}

function wordById(bundle: LearnBundle) {
  return new Map(bundle.pool.map((word) => [word.id, word]));
}

export async function localState(dateKey = todayKey()): Promise<LearnState> {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);
  const streak = streakOf(state);
  return {
    ...flow,
    stats: { ...flow.stats, streaks: streak },
    pool: { size: bundle.pool.length, seen: state.seen.length, target: bundle.poolSize },
    settings: { dailyTarget: state.settings.target, intensityConfirmed: state.settings.confirmed },
    gates: gatesOf(flow),
    readingReady: true,
    passage: { id: dateKey, wordCount: 0, degraded: false, audioUrl: "" },
  };
}

function streakOf(state: Persist) {
  let cursor = state.days[todayKey()]?.dayComplete ? todayKey() : shiftKey(todayKey(), -1);
  let streak = 0;
  while (state.days[cursor]?.dayComplete) {
    streak += 1;
    cursor = shiftKey(cursor, -1);
  }
  return streak;
}

function cardWithSeq(bundle: LearnBundle, day: DayRecord, seq: number): WordCard | null {
  const item = day.batch[seq];
  if (!item) return null;
  const word = wordById(bundle).get(item.wordId);
  if (!word) return null;
  return { ...word, seq, reviewed: item.reviewed, markedLater: item.later };
}

export async function localCards(from: number, to: number, dateKey = todayKey()) {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const cards: WordCard[] = [];
  for (let seq = from; seq <= Math.min(to, day.batch.length - 1); seq += 1) {
    const card = cardWithSeq(bundle, day, seq);
    if (card) cards.push(card);
  }
  return { cards };
}

export async function localWord(id: string, dateKey = todayKey()) {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const seq = day.batch.findIndex((item) => item.wordId === id);
  const card = seq >= 0 ? cardWithSeq(bundle, day, seq) : bundle.pool.find((word) => word.id === id) ?? null;
  if (!card) throw new Error("词条不存在");
  return card;
}

export async function localAction(kind: "review" | "later", seq: number, dateKey = todayKey()): Promise<FlowUpdate & { left: number }> {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const item = day.batch[seq];
  if (!item) return { ok: false, flow: flowOf(state, day, dateKey), left: 0 };

  if (kind === "later") item.later = true;
  if (!item.reviewed) {
    item.reviewed = true;
    if (item.wasNew && !state.seen.includes(item.wordId)) {
      state.seen.push(item.wordId);
      day.newCards += 1;
    }
  }
  write(state);
  const flow = flowOf(state, day, dateKey);
  return { ok: true, flow, gates: gatesOf(flow), left: Math.max(flow.vocabulary.total - flow.vocabulary.reviewed, 0) };
}

export async function localBottom(dateKey = todayKey()): Promise<FlowUpdate> {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);
  if (!flow.reading.unlocked) return { ok: false, flow, gates: gatesOf(flow) };
  day.reachedBottom = true;
  write(state);
  const next = flowOf(state, day, dateKey);
  return { ok: true, flow: next, gates: gatesOf(next) };
}

export async function localConfirmGrammar(grammarId: string, dateKey = todayKey()): Promise<FlowUpdate> {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);
  if (!flow.reading.unlocked) return { ok: false, flow, gates: gatesOf(flow) };
  // 和服务端一致：先滑到底部，才允许确认语法点（否则会跳过"读完"这一步）
  if (!day.reachedBottom) {
    throw Object.assign(new Error("先把阅读滑到底部，再确认语法点"), {
      gate: { ok: false, redirect: "reading", reason: "先把阅读滑到底部，再确认语法点" },
    });
  }
  if (!day.confirmedIds.includes(grammarId)) day.confirmedIds.push(grammarId);
  day.grammarConfirmed = true;
  day.readingCompleted = true;
  write(state);
  const next = flowOf(state, day, dateKey);
  return { ok: true, flow: next, gates: gatesOf(next) };
}

export async function localPlayed(dateKey = todayKey()): Promise<FlowUpdate> {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);
  if (!flow.listening.unlocked) return { ok: false, flow, gates: gatesOf(flow) };
  day.played = true;
  day.dayComplete = true;
  write(state);
  const next = flowOf(state, day, dateKey);
  return { ok: true, flow: next, gates: gatesOf(next) };
}

export async function localExit(minutes: number, dateKey = todayKey()) {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  day.minutes += Math.max(0, Math.round(minutes || 0));
  write(state);
  const flow = flowOf(state, day, dateKey);
  return { ok: true, flow, gates: gatesOf(flow), note: "今日进度已保存在本机浏览器" };
}

export async function localSettings(payload: { target?: number; intensityConfirmed?: boolean }) {
  const state = read();
  if (payload.target !== undefined) {
    const value = Math.round(Number(payload.target));
    if (!Number.isFinite(value) || value < 10 || value > 5000) throw new Error("每日目标需在 10-5000 之间");
    state.settings.target = value;
  }
  if (payload.intensityConfirmed) state.settings.confirmed = true;
  write(state);
  return { ok: true, dailyTarget: state.settings.target, intensityConfirmed: state.settings.confirmed };
}

const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu;

export async function localReading(dateKey = todayKey()) {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);
  if (!flow.reading.unlocked) throw Object.assign(new Error("尚未解锁"), { gate: gatesOf(flow).reading });

  const source = bundle.passages[0];
  const batchIds = new Set(day.batch.map((item) => item.wordId));
  const byLemma = new Map<string, WordCard>();
  for (const word of bundle.pool) {
    if (!batchIds.has(word.id)) continue;
    const key = word.lemma.toLowerCase();
    if (!byLemma.has(key)) byLemma.set(key, word);
  }

  const highlighted = new Set<string>();
  const tokens: Passage["tokenized"] = [];
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(source.textDe))) {
    const word = match[0];
    const card = byLemma.get(word.toLowerCase());
    if (card) {
      highlighted.add(card.id);
      tokens.push({ word, start: match.index, end: match.index + word.length, cardId: card.id, isHighlight: true });
    } else {
      tokens.push({ word, start: match.index, end: match.index + word.length, isHighlight: false });
    }
  }

  // 打开阅读就算「已接触」这些语法点，统计页要用
  for (const point of source.grammarPoints) {
    if (!day.touchedIds.includes(point.grammarId)) day.touchedIds.push(point.grammarId);
  }
  write(state);

  const passage: Passage = {
    dateKey,
    textDe: source.textDe,
    tokenized: tokens,
    highlightedCardIds: [...highlighted],
    fullTranslationZh: source.translationZh,
    grammarPoints: source.grammarPoints,
    audioUrl: "",
    verified: true,
    degraded: false,
    wordCount: tokens.length,
  };
  return { passage, flow };
}

export async function localListening(dateKey = todayKey()) {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);
  if (!flow.listening.unlocked) throw Object.assign(new Error("尚未解锁"), { gate: gatesOf(flow).listening });
  const passage = bundle.passages[0];
  return {
    audioUrl: "",
    audioAvailable: false,
    textDe: day.played ? passage.textDe : "",
    hintZh: "先听一遍，再对原文",
    flow,
  };
}

export async function localGrammarIndex() {
  const bundle = await loadBundle();
  const state = read();
  const today = bundle.passages[0].grammarPoints;
  const todayIds = new Set(today.map((point) => point.grammarId));

  const confirmed = new Set<string>();
  const touched = new Set<string>();
  for (const record of Object.values(state.days)) {
    record.confirmedIds.forEach((id) => confirmed.add(id));
    record.touchedIds.forEach((id) => touched.add(id));
  }
  const seenPoints = new Map<string, { titleZh: string; outline: "四级" | "拓展"; explainZh: string; contrast: { wrong: string; right: string; note: string } }>();
  for (const record of bundle.passages) {
    for (const point of record.grammarPoints) {
      seenPoints.set(point.grammarId, {
        titleZh: point.titleZh,
        outline: point.outline,
        explainZh: point.explainZh,
        contrast: point.contrast,
      });
    }
  }

  // 静态版没有后端大纲表，只能列出文章里出现过的点
  const catalog = [...seenPoints.entries()].map(([id, meta]) => ({
    id,
    ...meta,
    today: todayIds.has(id),
    status: confirmed.has(id) ? ("confirmed" as const) : touched.has(id) ? ("touched" as const) : ("untouched" as const),
  }));

  return { today, catalog, mainline: catalog.length, mastered: confirmed.size };
}

export async function localStats(dateKey = todayKey()): Promise<StatsPayload> {
  const bundle = await loadBundle();
  const state = read();
  const day = ensureDay(state, bundle, dateKey);
  const flow = flowOf(state, day, dateKey);

  const days = Object.entries(state.days)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([key, record]) => ({
      dateKey: key,
      newCards: record.newCards,
      readingDone: record.readingCompleted,
      listeningDone: record.played,
      minutes: record.minutes,
    }));

  const laterCounts = new Map<string, number>();
  for (const record of Object.values(state.days)) {
    for (const item of record.batch) {
      if (item.later) laterCounts.set(item.wordId, (laterCounts.get(item.wordId) ?? 0) + 1);
    }
  }
  const byId = wordById(bundle);
  const errorPool = [...laterCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, marks]) => ({ ...(byId.get(id) as WordCard), marks, lastDay: dateKey, weight: marks }))
    .filter((word) => word.id);

  const confirmed = new Set<string>();
  const touched = new Set<string>();
  for (const record of Object.values(state.days)) {
    record.confirmedIds.forEach((id) => confirmed.add(id));
    record.touchedIds.forEach((id) => touched.add(id));
  }
  const grammar = bundle.passages[0].grammarPoints.map((point) => ({
    id: point.grammarId,
    titleZh: point.titleZh,
    outline: point.outline,
    status: confirmed.has(point.grammarId) ? ("confirmed" as const) : touched.has(point.grammarId) ? ("touched" as const) : ("untouched" as const),
  }));

  return {
    dateKey,
    ring: {
      target: flow.vocabulary.total,
      reviewed: flow.vocabulary.reviewed,
      readingCompleted: flow.reading.completed,
      listeningCompleted: flow.listening.completed,
    },
    week: days,
    coverage: { seen: state.seen.length, pool: bundle.poolSize },
    grammar,
    errorPool,
    streak: streakOf(state),
    minutes: day.minutes,
  };
}
