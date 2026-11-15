import { loadJson, saveJson } from "./cache.mjs";
import { fetchRelay, relayConfigured } from "./net.mjs";
import { hashKey } from "./text.mjs";

const CACHE_FILE = "translations.json";
const store = await loadJson(CACHE_FILE, { version: 1, entries: {} });
if (!store.entries) store.entries = {};

const MAX_CHARS = 460;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const state = {
  myMemoryCooldownUntil: 0,
  myMemoryFailStreak: 0,
  youdaoNextAt: 0,
  googleNextAt: 0,
  googleBlockedUntil: 0,
  requests: 0,
};

const LANG_CODES = new Set(["en", "fr", "es", "pt", "ja", "de", "ru", "ar", "zh"]);

function hasHan(text) {
  return /[\p{Script=Han}]/u.test(text);
}

function hasKana(text) {
  return /[\u3040-\u30ff]/u.test(text);
}

export function detectLang(text) {
  if (hasKana(text)) return "ja";
  if (hasHan(text)) return "zh";
  return "en";
}

function normalizeLang(from) {
  const code = String(from ?? "").toLowerCase().split("-")[0];
  return LANG_CODES.has(code) ? code : "en";
}

function looksTranslated(source, result) {
  if (!result) return false;
  const clean = result.trim();
  if (!clean) return false;
  if (clean.length > source.length * 4 + 40) return false;
  if (/QUERY LENGTH LIMIT|MYMEMORY WARNING|INVALID/i.test(clean)) return false;
  if (/<[a-z]:\d+>/i.test(clean)) return false;
  if (clean.toLowerCase() === source.trim().toLowerCase()) return false;
  return true;
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "application/json,*/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function viaMyMemory(text, from) {
  if (Date.now() < state.myMemoryCooldownUntil) return null;
  const q = encodeURIComponent(text.slice(0, MAX_CHARS));
  const pair = encodeURIComponent(`${from}|zh-CN`);
  const data = await fetchJson(
    `https://api.mymemory.translated.net/get?q=${q}&langpair=${pair}`,
  );
  const status = String(data?.responseStatus ?? "");
  const translated = data?.responseData?.translatedText;
  if (data?.quotaFinished || status !== "200" || !looksTranslated(text, translated)) {
    state.myMemoryFailStreak += 1;
    if (state.myMemoryFailStreak >= 3) {
      state.myMemoryCooldownUntil = Date.now() + 10 * 60 * 1000;
      state.myMemoryFailStreak = 0;
    }
    return null;
  }
  state.myMemoryFailStreak = 0;
  return String(translated).trim();
}

// Google 官方接口在本地网络不可达，统一经 Cloudflare 中转访问；
// gtx 客户端对云厂商出口 IP 常返回 429，dict-chrome-ex 通道可用
function googleSegments(data) {
  if (typeof data === "string") return data;
  if (Array.isArray(data) && data.every((segment) => typeof segment === "string")) {
    return data.join("");
  }
  const rows = Array.isArray(data?.[0]) ? data[0] : [];
  return rows
    .map((row) => (Array.isArray(row) ? row[0] : typeof row === "string" ? row : ""))
    .filter(Boolean)
    .join("");
}

async function googleSlot() {
  const now = Date.now();
  const at = Math.max(now, state.googleNextAt);
  state.googleNextAt = at + 650;
  if (at > now) await wait(at - now);
}

async function viaGoogle(text, from) {
  if (!relayConfigured || Date.now() < state.googleBlockedUntil) return null;
  const q = encodeURIComponent(text.slice(0, MAX_CHARS));
  const query = `client=dict-chrome-ex&sl=${from}&tl=zh-CN&dt=t&q=${q}`;
  const endpoints = [
    `https://clients5.google.com/translate_a/t?${query}`,
    `https://translate.googleapis.com/translate_a/single?${query}`,
  ];
  let limited = 0;
  for (const url of endpoints) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await googleSlot();
      try {
        const { buffer } = await fetchRelay(url, { timeoutMs: 12000 });
        const translated = googleSegments(JSON.parse(buffer.toString("utf8")));
        if (looksTranslated(text, translated)) return String(translated).trim();
        return null;
      } catch (error) {
        if (/429|403/.test(String(error?.message ?? error))) {
          limited += 1;
          await wait(1200);
          continue;
        }
        return null;
      }
    }
  }
  if (limited >= 3) state.googleBlockedUntil = Date.now() + 30 * 1000;
  return null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 有道在并发或短间隔下会返回 411（请求频率过快），这里做串行节流
async function youdaoSlot() {
  const now = Date.now();
  const at = Math.max(now, state.youdaoNextAt);
  state.youdaoNextAt = at + 1300;
  if (at > now) await wait(at - now);
}

async function viaYoudao(text, from) {
  await youdaoSlot();
  const q = encodeURIComponent(text.slice(0, MAX_CHARS));
  const data = await fetchJson(
    `https://aidemo.youdao.com/trans?q=${q}&from=${from}&to=zh-CHS`,
  );
  const code = String(data?.errorCode ?? "0");
  if (code === "411") {
    await wait(1800);
    state.youdaoNextAt = Date.now() + 1300;
    return null;
  }
  const translated = Array.isArray(data?.translation) ? data.translation.join("") : "";
  if (code !== "0") return null;
  if (!looksTranslated(text, translated)) return null;
  return String(translated).trim();
}

async function requestTranslation(text, from) {
  state.requests += 1;
  try {
    const google = await viaGoogle(text, from);
    if (google) return { text: google, provider: "google" };
  } catch (error) {
    if (/429|403/.test(String(error?.message ?? error))) {
      state.googleBlockedUntil = Date.now() + 5 * 60 * 1000;
    }
  }
  try {
    const primary = await viaMyMemory(text, from);
    if (primary) return { text: primary, provider: "mymemory" };
  } catch {
    /* fall through */
  }
  try {
    const backup = await viaYoudao(text, from);
    if (backup) return { text: backup, provider: "youdao" };
  } catch {
    /* both failed */
  }
  return null;
}

export async function translate(text, { from = "auto" } = {}) {
  const source = String(text ?? "").trim();
  if (!source) return null;
  const lang = from === "auto" ? detectLang(source) : normalizeLang(from);
  if (lang === "zh") return { text: source, provider: "native" };

  const key = hashKey(`${lang}|${source}`);
  const hit = store.entries[key];
  if (hit?.text) return { text: hit.text, provider: hit.provider, cached: true };

  const result = await requestTranslation(source, lang);
  if (!result) return null;
  store.entries[key] = {
    text: result.text,
    provider: result.provider,
    from: lang,
    source: source.slice(0, 300),
    at: new Date().toISOString(),
  };
  return result;
}

export async function translateBatch(texts, { concurrency = 4, from = "en", retry = true } = {}) {
  const unique = [...new Set(texts.filter(Boolean))];
  const results = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      const text = unique[index];
      const result = await translate(text, { from });
      if (result) results.set(text, result);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(workers);

  // 首轮可能因限流整段失败，串行补一次
  if (retry) {
    const missing = unique
      .filter((text) => !results.has(text) && /[A-Za-z\u0400-\u04ff\u0600-\u06ff]/.test(text))
      .slice(0, 40);
    for (const [index, text] of missing.entries()) {
      if (index > 0) await wait(400);
      const result = await translate(text, { from });
      if (result) results.set(text, result);
    }
  }

  await saveJson(CACHE_FILE, store);
  return results;
}

export function translationStats() {
  return {
    cachedEntries: Object.keys(store.entries).length,
    requests: state.requests,
    myMemoryCooldown: Date.now() < state.myMemoryCooldownUntil,
    googleBlocked: Date.now() < state.googleBlockedUntil,
    relay: relayConfigured,
  };
}
