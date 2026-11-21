import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "../cache.mjs";

const DB_FILE = "learn.sqlite3";
const DEFAULT_TARGET = 1000;
// 学习终点定义：覆盖大学德语六级大纲词量，语法讲解范围不超出四级大纲
export const POOL_TARGET = 2400;

let database = null;

function getDb() {
  if (database) return database;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  database = new DatabaseSync(path.join(DATA_DIR, DB_FILE));
  database.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      lemma TEXT NOT NULL,
      pos TEXT NOT NULL,
      zh_full TEXT NOT NULL,
      example TEXT NOT NULL DEFAULT '',
      samples TEXT NOT NULL DEFAULT '[]',
      example_source TEXT NOT NULL DEFAULT '',
      example_license TEXT NOT NULL DEFAULT '',
      inflections TEXT NOT NULL DEFAULT '[]',
      collocations TEXT NOT NULL DEFAULT '[]',
      morphology_note TEXT NOT NULL DEFAULT '',
      history_note TEXT NOT NULL DEFAULT '',
      ipa TEXT NOT NULL DEFAULT '',
      ipa_source TEXT NOT NULL DEFAULT '',
      audio_url TEXT NOT NULL DEFAULT '',
      audio_name TEXT NOT NULL DEFAULT '',
      audio_source TEXT NOT NULL DEFAULT '',
      audio_license TEXT NOT NULL DEFAULT '',
      cefr TEXT NOT NULL DEFAULT 'A2',
      source_entry_id TEXT NOT NULL DEFAULT '',
      freq_rank INTEGER NOT NULL DEFAULT 0,
      freq INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS words_rank ON words (freq_rank);
    CREATE TABLE IF NOT EXISTS seen (
      word_id TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS flow (
      date_key TEXT PRIMARY KEY,
      target INTEGER NOT NULL,
      total INTEGER NOT NULL,
      reviewed INTEGER NOT NULL DEFAULT 0,
      new_cards INTEGER NOT NULL DEFAULT 0,
      mixed_mode INTEGER NOT NULL DEFAULT 0,
      reading_unlocked INTEGER NOT NULL DEFAULT 0,
      reached_bottom INTEGER NOT NULL DEFAULT 0,
      grammar_confirmed INTEGER NOT NULL DEFAULT 0,
      reading_completed INTEGER NOT NULL DEFAULT 0,
      listening_unlocked INTEGER NOT NULL DEFAULT 0,
      played INTEGER NOT NULL DEFAULT 0,
      listening_completed INTEGER NOT NULL DEFAULT 0,
      day_complete INTEGER NOT NULL DEFAULT 0,
      minutes INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS batch (
      date_key TEXT NOT NULL,
      seq INTEGER NOT NULL,
      word_id TEXT NOT NULL,
      was_new INTEGER NOT NULL DEFAULT 0,
      reviewed_at TEXT,
      marked_later INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date_key, seq)
    );
    CREATE INDEX IF NOT EXISTS batch_word ON batch (word_id);
    CREATE TABLE IF NOT EXISTS passages (
      date_key TEXT PRIMARY KEY,
      text_de TEXT NOT NULL,
      tokens TEXT NOT NULL,
      highlight_ids TEXT NOT NULL,
      translation_zh TEXT NOT NULL DEFAULT '',
      grammar TEXT NOT NULL DEFAULT '[]',
      audio_url TEXT NOT NULL DEFAULT '',
      verified INTEGER NOT NULL DEFAULT 0,
      degraded INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS grammar_marks (
      grammar_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (grammar_id, date_key)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return database;
}

function now() {
  return new Date().toISOString();
}

export function todayKey(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function shiftDateKey(dateKey, delta) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return todayKey(new Date(year, month - 1, day + delta, 12));
}

export function getSetting(key, fallback = "") {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, String(value));
  return String(value);
}

export function dailyTarget() {
  const raw = Number(getSetting("daily_target", String(DEFAULT_TARGET)));
  if (!Number.isFinite(raw) || raw < 10 || raw > 5000) return DEFAULT_TARGET;
  return Math.round(raw);
}

export function poolSize() {
  return Number(getDb().prepare("SELECT COUNT(*) AS n FROM words").get().n);
}

export function seenCount() {
  return Number(getDb().prepare("SELECT COUNT(*) AS n FROM seen").get().n);
}

function rowToFlow(row) {
  if (!row) return null;
  return {
    dateKey: row.date_key,
    vocabulary: { total: row.total, reviewed: row.reviewed, completed: row.total > 0 && row.reviewed >= row.total },
    reading: {
      unlocked: Boolean(row.reading_unlocked),
      reachedBottom: Boolean(row.reached_bottom),
      grammarConfirmed: Boolean(row.grammar_confirmed),
      completed: Boolean(row.reading_completed),
    },
    listening: {
      unlocked: Boolean(row.listening_unlocked),
      played: Boolean(row.played),
      completed: Boolean(row.listening_completed),
    },
    stats: { newCardsSeen: row.new_cards, minutesSpent: row.minutes, streaks: 0 },
    mixedMode: Boolean(row.mixed_mode),
    target: row.target,
    dayComplete: Boolean(row.day_complete),
    updatedAt: row.updated_at,
  };
}

export function loadFlow(dateKey = todayKey()) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM flow WHERE date_key = ?").get(dateKey);
  if (row) return rowToFlow(row);
  return {
    dateKey,
    vocabulary: { total: 0, reviewed: 0, completed: false },
    reading: { unlocked: false, reachedBottom: false, grammarConfirmed: false, completed: false },
    listening: { unlocked: false, played: false, completed: false },
    stats: { newCardsSeen: 0, minutesSpent: 0, streaks: 0 },
    mixedMode: false,
    target: dailyTarget(),
    dayComplete: false,
    updatedAt: "",
  };
}

function persistFlow(flow) {
  getDb()
    .prepare(
      `INSERT INTO flow (date_key, target, total, reviewed, new_cards, mixed_mode, reading_unlocked,
        reached_bottom, grammar_confirmed, reading_completed, listening_unlocked, played,
        listening_completed, day_complete, minutes, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(date_key) DO UPDATE SET
         target=excluded.target, total=excluded.total, reviewed=excluded.reviewed,
         new_cards=excluded.new_cards, mixed_mode=excluded.mixed_mode,
         reading_unlocked=excluded.reading_unlocked, reached_bottom=excluded.reached_bottom,
         grammar_confirmed=excluded.grammar_confirmed, reading_completed=excluded.reading_completed,
         listening_unlocked=excluded.listening_unlocked, played=excluded.played,
         listening_completed=excluded.listening_completed, day_complete=excluded.day_complete,
         minutes=excluded.minutes, updated_at=excluded.updated_at`,
    )
    .run(
      flow.dateKey,
      flow.target,
      flow.vocabulary.total,
      flow.vocabulary.reviewed,
      flow.stats.newCardsSeen,
      flow.mixedMode ? 1 : 0,
      flow.reading.unlocked ? 1 : 0,
      flow.reading.reachedBottom ? 1 : 0,
      flow.reading.grammarConfirmed ? 1 : 0,
      flow.reading.completed ? 1 : 0,
      flow.listening.unlocked ? 1 : 0,
      flow.listening.played ? 1 : 0,
      flow.listening.completed ? 1 : 0,
      flow.dayComplete ? 1 : 0,
      flow.stats.minutesSpent,
      now(),
    );
  flow.updatedAt = now();
  return flow;
}

// 当日批次：优先未接触过的词条，按词频从低到高；不足目标数时循环复习已学词补足（混合模式）
export function ensureBatch(dateKey = todayKey()) {
  const db = getDb();
  const existing = db.prepare("SELECT COUNT(*) AS n FROM batch WHERE date_key = ?").get(dateKey).n;
  const flow = loadFlow(dateKey);
  if (existing > 0 && flow.vocabulary.total > 0) return flow;

  const target = dailyTarget();
  const fresh = db
    .prepare(
      `SELECT w.id, w.freq_rank FROM words w
         LEFT JOIN seen s ON s.word_id = w.id
        WHERE s.word_id IS NULL
        ORDER BY w.freq_rank ASC LIMIT ?`,
    )
    .all(target);

  let picked = fresh.map((row) => ({ wordId: row.id, wasNew: 1 }));
  const mixed = picked.length < target;
  if (mixed) {
    // 已学词补足：从最近接触的一轮里取，保证「今日新词不足」时流程仍然走得完
    const need = target - picked.length;
    const pool = db
      .prepare(
        `SELECT word_id FROM seen ORDER BY first_seen ASC LIMIT ?`,
      )
      .all(need * 3)
      .map((row) => row.word_id);
    const reuse = [];
    for (let i = 0; i < need; i += 1) reuse.push({ wordId: pool[i % Math.max(pool.length, 1)], wasNew: 0 });
    picked = [...picked, ...reuse.filter((item) => item.wordId)];
  }

  db.exec("BEGIN");
  try {
    const insert = db.prepare("INSERT INTO batch (date_key, seq, word_id, was_new) VALUES (?,?,?,?)");
    picked.forEach((item, index) => insert.run(dateKey, index, item.wordId, item.wasNew));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  flow.target = target;
  flow.vocabulary.total = picked.length;
  flow.mixedMode = mixed;
  return persistFlow(flow);
}

export function cardAt(index, dateKey = todayKey()) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT b.seq, b.was_new, b.reviewed_at, b.marked_later, w.* FROM batch b
         JOIN words w ON w.id = b.word_id
        WHERE b.date_key = ? AND b.seq = ?`,
    )
    .get(dateKey, index);
  if (!row) return null;
  return { ...shapeCard(row), seq: row.seq, reviewed: Boolean(row.reviewed_at), markedLater: Boolean(row.marked_later) };
}

function shapeCard(row) {
  return {
    id: row.id,
    lemma: row.lemma,
    pos: row.pos,
    zhFullAnnotation: row.zh_full,
    exampleSentence: row.example,
    sampleSentences: JSON.parse(row.samples || "[]"),
    exampleSource: row.example_source,
    exampleLicense: row.example_license,
    inflections: JSON.parse(row.inflections || "[]"),
    fixedCollocations: JSON.parse(row.collocations || "[]"),
    morphologyNote: row.morphology_note,
    historyNote: row.history_note,
    ipa: row.ipa,
    ipaSource: row.ipa_source,
    audioUrl: row.audio_url,
    audioName: row.audio_name,
    audioSource: row.audio_source,
    audioLicense: row.audio_license,
    cefrLevel: row.cefr,
    sourceEntryId: row.source_entry_id,
    freqRank: row.freq_rank,
  };
}

export function listCards(dateKey = todayKey(), from = 0, to = -1) {
  const db = getDb();
  const rows = to < 0
    ? db.prepare("SELECT seq FROM batch WHERE date_key = ? ORDER BY seq").all(dateKey)
    : db.prepare("SELECT seq FROM batch WHERE date_key = ? AND seq >= ? AND seq <= ? ORDER BY seq").all(dateKey, from, to);
  return rows.map((row) => cardAt(row.seq, dateKey)).filter(Boolean);
}

// 流程锁的服务层判定：不满足前置条件就拒绝，返回可直接展示的原因
function gate(flow, stage) {
  if (stage === "reading" && !flow.reading.unlocked) {
    const left = Math.max(flow.vocabulary.total - flow.vocabulary.reviewed, 0);
    return { ok: false, redirect: "vocabulary", reason: left > 0 ? `还差 ${left} 张卡片解锁阅读` : "当日卡片尚未开始" };
  }
  if ((stage === "listening" || stage === "grammar") && !flow.listening.unlocked) {
    if (!flow.reading.unlocked) return { ok: false, redirect: "vocabulary", reason: "先完成当日卡片才能进入阅读" };
    if (!flow.reading.reachedBottom) return { ok: false, redirect: "reading", reason: "阅读尚未滑动到底部" };
    if (!flow.reading.grammarConfirmed) return { ok: false, redirect: "reading", reason: "语法点尚未确认" };
    return { ok: false, redirect: "reading", reason: "听力尚未解锁" };
  }
  return { ok: true };
}

export function flowGate(stage, dateKey = todayKey()) {
  return gate(loadFlow(dateKey), stage);
}

export function reviewCard(seq, dateKey = todayKey()) {
  const db = getDb();
  const flow = loadFlow(dateKey);
  const row = db
    .prepare("SELECT word_id, was_new, reviewed_at FROM batch WHERE date_key = ? AND seq = ?")
    .get(dateKey, seq);
  if (!row) return { ok: false, error: "该卡片不在当日批次内", flow };

  if (!row.reviewed_at) {
    db.prepare("UPDATE batch SET reviewed_at = ? WHERE date_key = ? AND seq = ?").run(now(), dateKey, seq);
    flow.vocabulary.reviewed += 1;
    // 新词计数只认「首次接触」，混合模式里的复习位不计入新词
    if (row.was_new && !db.prepare("SELECT word_id FROM seen WHERE word_id = ?").get(row.word_id)) {
      db.prepare("INSERT INTO seen (word_id, first_seen) VALUES (?, ?)").run(row.word_id, now());
      flow.stats.newCardsSeen += 1;
    }
  }
  // 解锁只由持久化后的计数决定，不在 React state 里推
  if (flow.vocabulary.total > 0 && flow.vocabulary.reviewed >= flow.vocabulary.total) {
    flow.reading.unlocked = true;
  }
  return { ok: true, seq, wordId: row.word_id, flow: persistFlow(flow), left: Math.max(flow.vocabulary.total - flow.vocabulary.reviewed, 0) };
}

export function markLater(seq, dateKey = todayKey()) {
  const db = getDb();
  db.prepare("UPDATE batch SET marked_later = 1 WHERE date_key = ? AND seq = ?").run(dateKey, seq);
  // 「稍后复习」仍计入当日已复习数，不延迟流程锁
  return reviewCard(seq, dateKey);
}

export function markBottom(dateKey = todayKey()) {
  const flow = loadFlow(dateKey);
  const blocked = gate(flow, "reading");
  if (!blocked.ok) return blocked;
  flow.reading.reachedBottom = true;
  return { ok: true, flow: persistFlow(flow) };
}

export function confirmGrammar(grammarId, dateKey = todayKey()) {
  const db = getDb();
  const flow = loadFlow(dateKey);
  const blocked = gate(flow, "reading");
  if (!blocked.ok) return blocked;
  db
    .prepare(
      `INSERT INTO grammar_marks (grammar_id, date_key, status, updated_at) VALUES (?,?,'confirmed',?)
       ON CONFLICT(grammar_id, date_key) DO UPDATE SET status = 'confirmed', updated_at = excluded.updated_at`,
    )
    .run(grammarId, dateKey, now());
  flow.reading.grammarConfirmed = true;
  flow.reading.completed = true;
  // 到底 + 语法确认，才解锁听力
  flow.listening.unlocked = true;
  return { ok: true, flow: persistFlow(flow) };
}

export function touchGrammar(grammarId, dateKey = todayKey()) {
  getDb()
    .prepare(
      `INSERT INTO grammar_marks (grammar_id, date_key, status, updated_at) VALUES (?,?,'touched',?)
       ON CONFLICT(grammar_id, date_key) DO UPDATE SET updated_at = excluded.updated_at`,
    )
    .run(grammarId, dateKey, now());
  return { ok: true };
}

export function markPlayed(dateKey = todayKey()) {
  const flow = loadFlow(dateKey);
  const blocked = gate(flow, "listening");
  if (!blocked.ok) return blocked;
  flow.listening.played = true;
  flow.listening.completed = true;
  flow.dayComplete = true;
  return { ok: true, flow: persistFlow(flow) };
}

export function addMinutes(minutes, dateKey = todayKey()) {
  const flow = loadFlow(dateKey);
  flow.stats.minutesSpent += Math.max(0, Math.round(Number(minutes) || 0));
  return persistFlow(flow);
}

export function savePassage(passage) {
  const db = getDb();
  db.prepare(
    `INSERT INTO passages (date_key, text_de, tokens, highlight_ids, translation_zh, grammar, audio_url, verified, degraded, word_count, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(date_key) DO UPDATE SET text_de=excluded.text_de, tokens=excluded.tokens, highlight_ids=excluded.highlight_ids,
       translation_zh=excluded.translation_zh, grammar=excluded.grammar, audio_url=excluded.audio_url,
       verified=excluded.verified, degraded=excluded.degraded, word_count=excluded.word_count, created_at=excluded.created_at`,
  ).run(
    passage.dateKey,
    passage.textDe,
    JSON.stringify(passage.tokenized ?? []),
    JSON.stringify(passage.highlightedCardIds ?? []),
    passage.fullTranslationZh ?? "",
    JSON.stringify(passage.grammarPoints ?? []),
    passage.audioUrl ?? "",
    passage.verified ? 1 : 0,
    passage.degraded ? 1 : 0,
    passage.wordCount ?? 0,
    now(),
  );
  return { ok: true };
}

export function deletePassage(dateKey = todayKey()) {
  getDb().prepare("DELETE FROM passages WHERE date_key = ?").run(dateKey);
}

export function loadPassage(dateKey = todayKey()) {
  const row = getDb().prepare("SELECT * FROM passages WHERE date_key = ?").get(dateKey);
  if (!row) return null;
  return {
    id: row.date_key,
    dateKey: row.date_key,
    textDe: row.text_de,
    tokenized: JSON.parse(row.tokens || "[]"),
    highlightedCardIds: JSON.parse(row.highlight_ids || "[]"),
    fullTranslationZh: row.translation_zh,
    grammarPoints: JSON.parse(row.grammar || "[]"),
    audioUrl: row.audio_url,
    verified: Boolean(row.verified),
    degraded: Boolean(row.degraded),
    wordCount: row.word_count,
  };
}

export function upsertWord(card) {
  getDb()
    .prepare(
      `INSERT INTO words (id, lemma, pos, zh_full, example, samples, example_source, example_license, inflections,
        collocations, morphology_note, history_note, ipa, ipa_source, audio_url, audio_name, audio_source,
        audio_license, cefr, source_entry_id, freq_rank, freq)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET lemma=excluded.lemma, pos=excluded.pos, zh_full=excluded.zh_full,
         example=excluded.example, samples=excluded.samples,
         example_source=excluded.example_source, example_license=excluded.example_license,
         inflections=excluded.inflections, collocations=excluded.collocations, morphology_note=excluded.morphology_note,
         history_note=excluded.history_note, ipa=excluded.ipa, ipa_source=excluded.ipa_source,
         audio_url=excluded.audio_url, audio_name=excluded.audio_name, audio_source=excluded.audio_source,
         audio_license=excluded.audio_license, cefr=excluded.cefr,
         source_entry_id=excluded.source_entry_id, freq_rank=excluded.freq_rank, freq=excluded.freq`,
    )
    .run(
      card.id,
      card.lemma,
      card.pos,
      card.zhFullAnnotation,
      card.exampleSentence ?? "",
      JSON.stringify(card.sampleSentences ?? []),
      card.exampleSource ?? "",
      card.exampleLicense ?? "",
      JSON.stringify(card.inflections ?? []),
      JSON.stringify(card.fixedCollocations ?? []),
      card.morphologyNote ?? "",
      card.historyNote ?? "",
      card.ipa ?? "",
      card.ipaSource ?? "",
      card.audioUrl ?? "",
      card.audioName ?? "",
      card.audioSource ?? "",
      card.audioLicense ?? "",
      card.cefrLevel ?? "A2",
      card.sourceEntryId ?? "",
      card.freqRank ?? 0,
      card.freq ?? 0,
    );
}

// 全量词库导出用（公网静态版把词库打进 site/data，进度仍留在浏览器本地）
export function listPool() {
  return getDb()
    .prepare("SELECT * FROM words ORDER BY freq_rank ASC")
    .all()
    .map((row) => shapeCard(row));
}

export function getWord(id) {
  const row = getDb().prepare("SELECT * FROM words WHERE id = ?").get(id);
  return row ? shapeCard(row) : null;
}

// 错词池：被标记「稍后复习」的次数越多、离今天越近，权重越高
export function errorPool(dateKey = todayKey(), limit = 60) {
  const rows = getDb()
    .prepare(
      `SELECT b.word_id,
              SUM(CASE WHEN b.marked_later = 1 THEN 1 ELSE 0 END) AS marks,
              MAX(b.date_key) AS last_day
         FROM batch b
        GROUP BY b.word_id
       HAVING marks > 0
        ORDER BY marks DESC, last_day DESC
        LIMIT ?`,
    )
    .all(limit);
  return rows.map((row) => ({
    ...getWord(row.word_id),
    marks: row.marks,
    lastDay: row.last_day,
    weight: row.marks + (row.last_day >= shiftDateKey(dateKey, -6) ? 1 : 0),
  }));
}

export function dailySeries(days = 7) {
  const db = getDb();
  const rows = db
    .prepare("SELECT date_key, new_cards, reading_completed, listening_completed, minutes FROM flow ORDER BY date_key DESC LIMIT ?")
    .all(days);
  return rows
    .reverse()
    .map((row) => ({
      dateKey: row.date_key,
      newCards: row.new_cards,
      readingDone: Boolean(row.reading_completed),
      listeningDone: Boolean(row.listening_completed),
      minutes: row.minutes,
    }));
}

export function grammarCatalog(dateKey = todayKey()) {
  const db = getDb();
  const marks = db
    .prepare("SELECT grammar_id, status FROM grammar_marks WHERE date_key = ?")
    .all(dateKey);
  const status = new Map(marks.map((row) => [row.grammar_id, row.status]));
  const passage = loadPassage(dateKey);
  return (passage?.grammarPoints ?? []).map((point) => ({
    grammarId: point.grammarId,
    titleZh: point.titleZh,
    outline: point.outline ?? "拓展",
    status: status.get(point.grammarId) ?? "untouched",
  }));
}

export function grammarLedger() {
  const rows = getDb().prepare("SELECT grammar_id, status FROM grammar_marks").all();
  const map = new Map();
  for (const row of rows) {
    const current = map.get(row.grammar_id);
    if (row.status === "confirmed") map.set(row.grammar_id, "confirmed");
    else if (!current) map.set(row.grammar_id, "touched");
  }
  return Object.fromEntries(map);
}

// 连续天数从今天的上一天回退计数，今天尚未打完不折断已有连续
export function streakDays() {
  const done = new Set(getDb().prepare("SELECT date_key FROM flow WHERE day_complete = 1").all().map((row) => row.date_key));
  const today = todayKey();
  let cursor = done.has(today) ? today : shiftDateKey(today, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function snapshot(dateKey = todayKey()) {
  const flow = ensureBatch(dateKey);
  const passage = loadPassage(dateKey);
  return {
    ...flow,
    stats: { ...flow.stats, streaks: streakDays() },
    pool: { size: poolSize(), seen: seenCount(), target: POOL_TARGET },
    readingReady: Boolean(passage?.verified || passage?.degraded),
    passage: passage ? { id: passage.id, wordCount: passage.wordCount, degraded: passage.degraded, audioUrl: passage.audioUrl } : null,
  };
}

export function resetForTest(dateKey) {
  const db = getDb();
  db.prepare("DELETE FROM flow WHERE date_key = ?").run(dateKey);
  db.prepare("DELETE FROM batch WHERE date_key = ?").run(dateKey);
  db.prepare("DELETE FROM grammar_marks WHERE date_key = ?").run(dateKey);
}
