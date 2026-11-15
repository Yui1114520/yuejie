import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./cache.mjs";

const DB_FILE = "push.sqlite3";
const COOLDOWN_HOURS = 48;
const RETENTION_DAYS = 14;

let database = null;

function getDatabase() {
  if (database) return database;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  database = new DatabaseSync(path.join(DATA_DIR, DB_FILE));
  database.exec(`
    CREATE TABLE IF NOT EXISTS pushes (
      event_key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      cluster_id TEXT,
      heat INTEGER NOT NULL DEFAULT 0,
      seriousness INTEGER NOT NULL DEFAULT 0,
      blue_ocean INTEGER NOT NULL DEFAULT 0,
      source_count INTEGER NOT NULL DEFAULT 0,
      pushed_at TEXT NOT NULL
    )
  `);
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400 * 1000).toISOString();
  database.prepare("DELETE FROM pushes WHERE pushed_at < ?").run(cutoff);
  return database;
}

export function filterPushCandidates(candidates, { cooldownHours = COOLDOWN_HOURS } = {}) {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();
  const rows = db
    .prepare(
      "SELECT event_key, heat, source_count, pushed_at FROM pushes WHERE pushed_at >= ?",
    )
    .all(cutoff);
  const recent = new Map(rows.map((row) => [row.event_key, row]));

  const fresh = [];
  const suppressed = [];
  for (const candidate of candidates) {
    const previous = recent.get(candidate.eventKey);
    if (!previous) {
      fresh.push(candidate);
      continue;
    }
    const hoursSince = (Date.now() - Date.parse(previous.pushed_at)) / 3600_000;
    const materialUpdate =
      candidate.sourceCount >= Number(previous.source_count) + 2 &&
      candidate.heat >= Number(previous.heat) + 12;
    if (materialUpdate && hoursSince >= 6) {
      fresh.push({ ...candidate, update: true });
    } else {
      suppressed.push(candidate);
    }
  }
  return { fresh, suppressed };
}

export function commitPushes(candidates) {
  if (!candidates.length) return 0;
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO pushes
      (event_key, title, cluster_id, heat, seriousness, blue_ocean, source_count, pushed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_key) DO UPDATE SET
      title = excluded.title,
      cluster_id = excluded.cluster_id,
      heat = excluded.heat,
      seriousness = excluded.seriousness,
      blue_ocean = excluded.blue_ocean,
      source_count = excluded.source_count,
      pushed_at = excluded.pushed_at
  `);
  const now = new Date().toISOString();
  for (const candidate of candidates) {
    insert.run(
      candidate.eventKey,
      candidate.title,
      candidate.articleId ?? null,
      candidate.heat ?? 0,
      candidate.seriousness ?? 0,
      candidate.blueOcean ?? 0,
      candidate.sourceCount ?? 0,
      now,
    );
  }
  return candidates.length;
}

export function pushStats() {
  const db = getDatabase();
  const total = Number(db.prepare("SELECT COUNT(*) AS n FROM pushes").get().n);
  const rows = db
    .prepare("SELECT event_key, title, pushed_at FROM pushes ORDER BY pushed_at DESC LIMIT 5")
    .all();
  return { total, latest: rows, cooldownHours: COOLDOWN_HOURS };
}

export { COOLDOWN_HOURS };
