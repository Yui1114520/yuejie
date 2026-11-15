import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

const memory = new Map();
let writeQueue = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadJson(name, fallback) {
  const key = `file:${name}`;
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, name), "utf8");
    const parsed = JSON.parse(raw);
    memory.set(key, parsed);
    return parsed;
  } catch {
    memory.set(key, fallback);
    return fallback;
  }
}

export function saveJson(name, value) {
  memory.set(`file:${name}`, value);
  const snapshot = JSON.stringify(value);
  writeQueue = writeQueue
    .then(async () => {
      await ensureDir();
      const target = path.join(DATA_DIR, name);
      const tmp = `${target}.${process.pid}.tmp`;
      await fs.writeFile(tmp, snapshot, "utf8");
      await fs.rename(tmp, target);
    })
    .catch(() => {});
  return writeQueue;
}

export function getMemory(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export function setMemory(key, value, ttlMs) {
  memory.set(key, { value, expiresAt: ttlMs ? Date.now() + ttlMs : 0 });
  return value;
}

export { DATA_DIR };
