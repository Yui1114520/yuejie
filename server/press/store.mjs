import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "../cache.mjs";

const DB_FILE = "press.sqlite3";

let database = null;

function getDb() {
  if (database) return database;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  database = new DatabaseSync(path.join(DATA_DIR, DB_FILE));
  database.exec(`
    CREATE TABLE IF NOT EXISTS works (
      key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      url TEXT NOT NULL,
      doi TEXT,
      title TEXT NOT NULL,
      title_zh TEXT,
      abstract TEXT,
      abstract_zh TEXT,
      journal TEXT,
      account TEXT,
      tier INTEGER NOT NULL DEFAULT 0,
      field TEXT,
      interest TEXT,
      lang TEXT,
      oa INTEGER NOT NULL DEFAULT 0,
      authors TEXT,
      published TEXT,
      cited INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      viewed INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS works_kind ON works (kind, published);
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      config TEXT,
      added_at TEXT NOT NULL,
      last_run TEXT,
      ok INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      items INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY,
      work_key TEXT NOT NULL,
      action TEXT NOT NULL,
      created TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_ids (
      journal TEXT PRIMARY KEY,
      issn TEXT,
      resolved_at TEXT NOT NULL,
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return database;
}

export function getMeta(key) {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row?.value ?? null;
}

export function setMeta(key, value) {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, String(value));
}

const UPSERT = `
  INSERT INTO works (
    key, kind, source, url, doi, title, abstract, journal, account, tier, field, interest,
    lang, oa, authors, published, cited, first_seen, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET
    abstract = CASE WHEN excluded.abstract <> '' THEN excluded.abstract ELSE works.abstract END,
    title = CASE WHEN length(excluded.title) > length(works.title) THEN excluded.title ELSE works.title END,
    journal = CASE WHEN excluded.journal <> '' THEN excluded.journal ELSE works.journal END,
    account = CASE WHEN excluded.account <> '' THEN excluded.account ELSE works.account END,
    tier = MAX(works.tier, excluded.tier),
    cited = MAX(works.cited, excluded.cited),
    field = COALESCE(works.field, excluded.field),
    interest = COALESCE(works.interest, excluded.interest),
    published = CASE WHEN excluded.published <> '' THEN excluded.published ELSE works.published END,
    updated_at = excluded.updated_at
`;

function toRow(work, now) {
  return [
    work.key,
    work.kind,
    work.source,
    work.url,
    work.doi ?? null,
    work.title,
    work.abstract ?? "",
    work.journal ?? "",
    work.account ?? "",
    Number(work.tier ?? 0),
    work.field ?? null,
    work.interest ?? null,
    work.lang ?? "en",
    work.oa ? 1 : 0,
    (work.authors ?? []).slice(0, 6).join("、"),
    work.published ?? "",
    Number(work.cited ?? 0),
    now,
    now,
  ];
}

export function upsertWorks(works) {
  if (!works.length) return 0;
  const db = getDb();
  const statement = db.prepare(UPSERT);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const work of works) statement.run(...toRow(work, now));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return works.length;
}

export function listWorks({ kind, limit = 400, interest } = {}) {
  const db = getDb();
  const clauses = ["hidden = 0"];
  const params = [];
  if (kind) {
    clauses.push("kind = ?");
    params.push(kind);
  }
  if (interest) {
    clauses.push("(interest = ? OR field = ?)");
    params.push(interest, interest);
  }
  params.push(limit);
  return db
    .prepare(
      `SELECT * FROM works WHERE ${clauses.join(" AND ")}
       ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(...params);
}

// 后台补译队列：先补最可能上首屏的（权威档最高、被引最多、发表最新）
export function listUntranslated(limit = 120) {
  return getDb()
    .prepare(
      `SELECT * FROM works
       WHERE hidden = 0 AND lang <> 'zh' AND (title_zh IS NULL OR title_zh = '')
       ORDER BY CASE tier WHEN 0 THEN 9 ELSE tier END, cited DESC, published DESC
       LIMIT ?`,
    )
    .all(limit);
}

export function workStats() {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
         SUM(kind = 'paper') AS papers,
         SUM(kind = 'article') AS articles,
         SUM(saved = 1) AS saved,
         SUM(viewed = 1) AS viewed,
         MIN(published) AS oldest,
         MAX(published) AS newest
       FROM works`,
    )
    .get();
  return {
    papers: Number(row?.papers ?? 0),
    articles: Number(row?.articles ?? 0),
    saved: Number(row?.saved ?? 0),
    viewed: Number(row?.viewed ?? 0),
    oldest: row?.oldest ?? null,
    newest: row?.newest ?? null,
  };
}

export function markSignal(workKey, action) {
  const db = getDb();
  const now = new Date().toISOString();
  const column = action === "save" ? "saved" : action === "open" ? "viewed" : null;
  if (column) {
    db.prepare(`UPDATE works SET ${column} = 1 WHERE key = ?`).run(workKey);
  } else if (action === "hide") {
    db.prepare("UPDATE works SET hidden = 1 WHERE key = ?").run(workKey);
  } else if (action === "unhide") {
    db.prepare("UPDATE works SET hidden = 0 WHERE key = ?").run(workKey);
  }
  db.prepare("INSERT INTO signals (work_key, action, created) VALUES (?, ?, ?)").run(
    workKey,
    action,
    now,
  );
  return { workKey, action };
}

// 画像只看行为过的工作：读/藏/不感兴趣，各按不同权重参与匹配
export function behaviourPool() {
  const db = getDb();
  return {
    positive: db
      .prepare("SELECT * FROM works WHERE (viewed = 1 OR saved = 1) AND hidden = 0 ORDER BY updated_at DESC LIMIT 120")
      .all(),
    negative: db
      .prepare("SELECT * FROM works WHERE hidden = 1 ORDER BY updated_at DESC LIMIT 60")
      .all(),
    signalCount: Number(
      db.prepare("SELECT COUNT(*) AS n FROM signals").get().n ?? 0,
    ),
  };
}

export function setTranslation(key, { titleZh, abstractZh }) {
  const db = getDb();
  db.prepare("UPDATE works SET title_zh = COALESCE(?, title_zh), abstract_zh = COALESCE(?, abstract_zh) WHERE key = ?").run(
    titleZh ?? null,
    abstractZh ?? null,
    key,
  );
}

export function getChannel(id) {
  return getDb().prepare("SELECT * FROM channels WHERE id = ?").get(id) ?? null;
}

export function listChannels() {
  return getDb().prepare("SELECT * FROM channels ORDER BY added_at DESC").all();
}

export function upsertChannel(channel) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO channels (id, kind, label, url, config, added_at, last_run, ok, note, items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind, label = excluded.label, url = excluded.url,
      config = excluded.config, last_run = excluded.last_run, ok = excluded.ok,
      note = excluded.note, items = excluded.items
  `).run(
    channel.id,
    channel.kind,
    channel.label,
    channel.url,
    JSON.stringify(channel.config ?? {}),
    channel.addedAt ?? now,
    channel.lastRun ?? null,
    channel.ok ? 1 : 0,
    channel.note ?? "",
    Number(channel.items ?? 0),
  );
  return channel.id;
}

export function touchChannel(id, { ok, note, items }) {
  getDb()
    .prepare("UPDATE channels SET last_run = ?, ok = ?, note = ?, items = ? WHERE id = ?")
    .run(new Date().toISOString(), ok ? 1 : 0, note ?? "", Number(items ?? 0), id);
}

export function deleteChannel(id) {
  return getDb().prepare("DELETE FROM channels WHERE id = ?").run(id).changes > 0;
}

export function cachedIssn(journal) {
  const row = getDb().prepare("SELECT issn, note FROM journal_ids WHERE journal = ?").get(journal);
  if (!row) return null;
  return { issn: row.issn ?? null, note: row.note ?? "" };
}

export function rememberIssn(journal, issn, note = "") {
  getDb()
    .prepare(
      `INSERT INTO journal_ids (journal, issn, resolved_at, note) VALUES (?, ?, ?, ?)
       ON CONFLICT(journal) DO UPDATE SET issn = excluded.issn, resolved_at = excluded.resolved_at, note = excluded.note`,
    )
    .run(journal, issn ?? null, new Date().toISOString(), note);
}

export function pruneOld(days = 150) {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86400e3).toISOString();
  // 无日期的条目（部分 RSS/合集页不给时间）空串会小于任何 ISO 串，必须排除
  const result = db
    .prepare("DELETE FROM works WHERE published <> '' AND published < ? AND viewed = 0 AND saved = 0")
    .run(cutoff);
  return result.changes;
}

export { DB_FILE };
