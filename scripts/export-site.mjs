// 把本机后端的成品数据导出成一份可直接发布的静态快照：site/data/*.json + site/img/*
// 用法：node scripts/export-site.mjs [--personal]
// 默认剥掉只属于本机使用者的痕迹（订阅列表、已读/收藏、行为画像），因为静态文件一旦上线就是公开可下载的。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (
  process.env.EXPORT_BASE ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`
).replace(/\/+$/, "");
const OUT_DIR = path.resolve("site");
const DATA_DIR = path.join(OUT_DIR, "data");
const IMG_DIR = path.join(OUT_DIR, "img");
const RAW_DIR = path.join(OUT_DIR, "img-raw");
const MAX_RAW_KEEP = 300_000;
const keepPersonal = process.argv.includes("--personal");
const RETRY_MS = 15_000;
const RETRIES = 8;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(search) {
  let lastError = "";
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetch(`${BASE}${search}`, { signal: AbortSignal.timeout(180_000) });
      if (res.status === 503) {
        lastError = "后端正在生成数据";
        await sleep(RETRY_MS);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      lastError = String(error?.message ?? error);
      await sleep(RETRY_MS);
    }
  }
  throw new Error(`${search} 取不到：${lastError}`);
}

// 行情这类接口把上游失败包在 200 里返回，快照必须只收成功的那份
async function fetchOk(search) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const body = await fetchJson(search);
    if (body.ok !== false) return body;
    console.log(`  ! ${search} 第 ${attempt} 轮失败：${body.error}`);
    await sleep(5_000);
  }
  return null;
}

function scrubWork(work) {
  return { ...work, saved: false, viewed: false };
}

function scrubPress(payload) {
  if (keepPersonal) return payload;
  return {
    ...payload,
    papers: payload.papers.map(scrubWork),
    rising: payload.rising.map(scrubWork),
    articles: payload.articles.map(scrubWork),
    channels: [],
    meta: {
      ...payload.meta,
      counts: { ...payload.meta.counts, saved: 0, viewed: 0 },
      profile: { signals: 0, samples: 0, topTerms: [] },
      // 快照里没有正在跑的补译任务，别让页面挂著「稍后自动更新」的提示去轮询
      translation: payload.meta.translation
        ? { ...payload.meta.translation, pending: false, queued: 0 }
        : undefined,
      lastError: null,
    },
  };
}

function newsScrub(payload) {
  if (keepPersonal) return payload;
  return { ...payload, meta: { ...payload.meta, translation: undefined } };
}

const IMAGE_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function isImageUrl(value) {
  return /^https?:\/\//i.test(value) && /\.(jpe?g|png|webp|gif|avif)([?#]|$)/i.test(value);
}

function collectImages(node, sink) {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && (key === "image" || key === "imageUrl" || isImageUrl(value))) {
      if (/^https?:\/\//i.test(value)) sink.add(value);
    } else if (value && typeof value === "object") {
      collectImages(value, sink);
    }
  }
}

function applyImages(node, map) {
  if (!node || typeof node !== "object") return node;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && map.has(value)) node[key] = map.get(value) ?? value;
    else if (value && typeof value === "object") applyImages(value, map);
  }
  return node;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

// 图片在快照里必须变成站内文件：否则访客的网络取不到外媒 CDN，页面就成一片灰

// 图片目录跨轮次复用后要限个上限，避免无限膨胀
async function pruneImages(dir, limit) {
  const names = await readdir(dir);
  if (names.length <= limit) return;
  const stats = [];
  for (const name of names) {
    stats.push({ name, at: statSync(path.join(dir, name)).mtimeMs });
  }
  stats.sort((a, b) => a.at - b.at);
  for (const item of stats.slice(0, names.length - limit)) {
    await rm(path.join(dir, item.name), { force: true });
  }
}

async function localizeImages(urls) {
  const list = [...urls];
  const map = new Map();
  if (!list.length) return map;
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(IMG_DIR, { recursive: true });

  const hashOf = (url) => createHash("sha1").update(url).digest("hex").slice(0, 16);
  // 已在本站的图片直接复用：以前每轮都把 img/ 删掉重下，几百张图能拖十几分钟，CI 上也最容易在这里翻车
  const have = new Map();
  for (const name of await readdir(IMG_DIR)) {
    const dot = name.lastIndexOf(".");
    if (dot > 0) have.set(name.slice(0, dot), name);
  }
  const todo = [];
  for (const url of list) {
    const name = have.get(hashOf(url));
    if (name) map.set(url, `/img/${name}`);
    else todo.push(url);
  }
  const reused = map.size;
  if (!todo.length) {
    console.log(`[site] 图片：${list.length} 张已全部在站内，跳过下载`);
    return map;
  }

  const fetched = (
    await mapLimit(todo, 4, async (url) => {
      const hash = hashOf(url);
      try {
        const res = await fetch(`${BASE}/api/img?u=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) return null;
        const type = String(res.headers.get("content-type") ?? "");
        const buffer = Buffer.from(await res.arrayBuffer());
        if (!buffer.length || !type.startsWith("image/")) return null;
        const file = `${hash}.${IMAGE_EXT[type] ?? "jpg"}`;
        await writeFile(path.join(RAW_DIR, file), buffer);
        return { url, hash, file };
      } catch {
        return null;
      }
    })
  ).filter(Boolean);

  const shrink = spawnSync(
    "python",
    [fileURLToPath(new URL("shrink-images.py", import.meta.url)), RAW_DIR, IMG_DIR, "720", "70"],
    { encoding: "utf8" },
  );
  if (shrink.status === 0) {
    for (const item of fetched) {
      if (existsSync(path.join(IMG_DIR, `${item.hash}.webp`))) {
        map.set(item.url, `/img/${item.hash}.webp`);
      }
    }
  } else {
    console.warn(
      `[site] 图片压缩不可用（${String(shrink.stderr || shrink.stdout).trim().slice(0, 60)}），改存原图`,
    );
  }

  // 压不动的：小图留原样，大图保留外链，免得快照胀到手机上打不开
  for (const item of fetched) {
    if (map.has(item.url)) continue;
    const size = statSync(path.join(RAW_DIR, item.file)).size;
    if (size > MAX_RAW_KEEP) continue;
    await copyFile(path.join(RAW_DIR, item.file), path.join(IMG_DIR, item.file));
    map.set(item.url, `/img/${item.file}`);
  }
  for (const url of list) if (!map.has(url)) map.set(url, null);

  if (reused) console.log(`[site] 图片：复用 ${reused} 张，新下载 ${fetched.length} 张`);
  const kept = await readdir(IMG_DIR);
  const total = kept.reduce((sum, name) => sum + statSync(path.join(IMG_DIR, name)).size, 0);
  await rm(RAW_DIR, { recursive: true, force: true });
  await pruneImages(IMG_DIR, 4000);
  const local = [...map.values()].filter(Boolean).length;
  console.log(
    `[site] 图片：${local}/${list.length} 张原链已换成本站文件（${kept.length} 个 · ${(total / 1048576).toFixed(1)} MB）` +
      (list.length - local ? ` · ${list.length - local} 张取不到，保留原链` : ""),
  );
  return map;
}

async function dump(name, value) {
  const file = path.join(DATA_DIR, name);
  const text = JSON.stringify(value);
  await writeFile(file, text);
  console.log(`  ${name.padEnd(28)} ${(text.length / 1024).toFixed(0)} KB`);
}

console.log(`[site] 从 ${BASE} 导出快照${keepPersonal ? "（保留个人痕迹）" : "（已脱敏）"}`);
await rm(DATA_DIR, { recursive: true, force: true });
await rm(RAW_DIR, { recursive: true, force: true });
await mkdir(DATA_DIR, { recursive: true });

const outputs = new Map();
const imageUrls = new Set();

// 冷启动时 /api/health 会立刻返回，但此时还没有任何 payload；
// 直接按空列表导出会把整站新闻清空（2026-11-16 线上就是这么空掉的）
let health = await fetchJson("/api/health");
if (!health.modules.some((m) => m.hasPayload)) {
  console.log("[site] 后端还没有成品数据，先触发一轮构建并等它完成");
  await fetchJson("/api/news?module=world");
  health = await fetchJson("/api/health");
}
const moduleIds = health.modules.filter((m) => m.hasPayload).map((m) => m.id);
if (!moduleIds.length) throw new Error("后端一轮构建后仍无任何模块，拒绝导出空快照");
console.log(`[site] 模块：${moduleIds.join(", ")}`);

const savedMeta = [];
for (const id of moduleIds) {
  const payload = newsScrub(await fetchJson(`/api/news?module=${encodeURIComponent(id)}`));
  if (!payload.all.length) throw new Error(`模块 ${id} 本轮零稿件（源全部失败），不发布空快照`);
  collectImages(payload, imageUrls);
  outputs.set(`news-${id}.json`, payload);
  savedMeta.push({
    id,
    label: payload.moduleLabel ?? id,
    articles: payload.all.length,
    generatedAt: payload.generatedAt,
  });
}

// 中转 token 不匹配会让 43 个海外源整批 401，导出的就是半残站；
// 这种是配置错误，宁可让任务红也不发出去
const worldRelay = outputs.get("news-world.json")?.meta?.relay;
if (worldRelay?.authFailed > 0) {
  throw new Error(`中转鉴权失败 ${worldRelay.authFailed} 个源（RELAY_TOKEN 不匹配），拒绝发布半残快照`);
}

const pressAll = scrubPress(await fetchJson("/api/press"));
collectImages(pressAll, imageUrls);
outputs.set("press.json", pressAll);
for (const interest of pressAll.meta.interests ?? []) {
  if (!interest.count) continue;
  const one = scrubPress(await fetchJson(`/api/press?interest=${encodeURIComponent(interest.id)}`));
  collectImages(one, imageUrls);
  outputs.set(`press-${interest.id}.json`, one);
}

const markets = await fetchOk("/api/markets");
if (markets) {
  outputs.set("markets.json", markets);
  for (const index of markets.indices ?? []) {
    const movers = await fetchOk(`/api/markets/${encodeURIComponent(index.id)}`);
    if (movers) outputs.set(`movers-${index.id}.json`, movers);
    else console.log(`  跳过 movers-${index.id}.json（成分股取不到，前端会提示暂时不可用）`);
  }
}

const imageMap = await localizeImages(imageUrls);
for (const [name, value] of outputs) {
  applyImages(value, imageMap);
  await dump(name, value);
}

await dump(
  "meta.json",
  {
    ok: true,
    staticSite: true,
    generatedAt: health.generatedAt,
    modules: savedMeta,
    interests: pressAll.meta.interests ?? [],
    note: "静态快照版：在电脑上运行 npm run site:publish 更新；实时刷新与订阅修改不可用",
  },
);

// 学习栏静态数据：词库 + 作者稿阅读；进度留在浏览器 localStorage，不需要后端
const learnBundle = path.resolve("data/learn/bundle.json");
if (existsSync(learnBundle)) {
  await copyFile(learnBundle, path.join(DATA_DIR, "learn.json"));
  console.log(`  learn.json                   ${(statSync(learnBundle).size / 1048576).toFixed(1)} MB`);
} else {
  console.log("  ! 缺少 data/learn/bundle.json，先跑 node scripts/export-learn-bundle.mjs");
}

// Cloudflare Pages 靠这个文件把深链回落到 index.html，否则 /papers 刷新会 404
await writeFile(path.join(OUT_DIR, "_redirects"), "/*  /index.html  200\n");
console.log("[site] 完成，site/_redirects 已写入");
