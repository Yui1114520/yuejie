import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildNews } from "./trending.mjs";
import { MODULE_IDS } from "./modules.mjs";
import { IMAGE_HOSTS, PAYLOAD_TTL_MS, SOURCES } from "./sources.mjs";
import { fetchRelay, relayConfigured } from "./net.mjs";
import { getMemory, setMemory } from "./cache.mjs";
import { translate, translationStats } from "./translate.mjs";
import { COOLDOWN_HOURS, commitPushes, pushStats } from "./pushLedger.mjs";
import { getMarkets, getMovers } from "./markets.mjs";
import { addChannel, buildPress, pressHealth, removeChannel, signal } from "./press/press.mjs";
import { mountLearn } from "./learn/routes.mjs";

const app = express();
const PORT = Number(process.env.PORT || 8787);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "32kb" }));

// APK 壳里的 WebView 把自己算作 http://localhost 源，接口却在局域网另一台机器上，属于跨源；
// 只放行本机来源，不给任意网站开放这套接口
function shellOrigin(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" ? raw : null;
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const allowed = shellOrigin(req.headers.origin);
  if (allowed) {
    res.set("access-control-allow-origin", allowed);
    res.set("access-control-allow-headers", "content-type");
    res.set("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    res.set("access-control-max-age", "600");
    res.set("vary", "origin");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

const state = {
  modules: {},
  generatedAt: 0,
  building: null,
  lastError: null,
  lastBuildMs: 0,
  pushCandidates: [],
};

async function getNews(moduleId = "world", { force = false } = {}) {
  const fresh = state.modules[moduleId] && Date.now() - state.generatedAt < PAYLOAD_TTL_MS;
  if (!force && fresh) return state.modules[moduleId];
  if (state.building) {
    await state.building;
    return state.modules[moduleId] ?? null;
  }
  if (state.modules[moduleId] && !force) {
    buildNewsInBackground();
    return state.modules[moduleId];
  }
  await buildNewsInBackground();
  return state.modules[moduleId] ?? null;
}

function buildNewsInBackground() {
  if (state.building) return state.building;
  const started = Date.now();
  state.building = buildNews()
    .then((result) => {
      // 整机断网时整轮 134 个源会全挂，不能因此把已经抓到的内容覆盖成空列表
      const kept = [];
      for (const [id, payload] of Object.entries(result.modules)) {
        const previous = state.modules[id];
        if (!payload.all.length && previous?.all.length) {
          result.modules[id] = previous;
          kept.push(`${payload.moduleLabel ?? id} ${previous.all.length} 组`);
        }
      }
      state.modules = result.modules;
      state.pushCandidates = result.pushCandidates?.length
        ? result.pushCandidates
        : state.pushCandidates;
      state.generatedAt = Date.now();
      state.lastError = null;
      state.lastBuildMs = Date.now() - started;
      const relay = result.relay;
      const relayNote = relay?.configured
        ? "中转已启用"
        : `中转未配置 · ${relay?.pending?.length ?? 0} 个海外源待接入`;
      const world = result.modules.world;
      const counts = Object.values(result.modules)
        .map((payload) => `${payload.moduleLabel} ${payload.all.length}`)
        .join(" / ");
      console.log(
        `[news] 构建完成 ${state.lastBuildMs}ms · ${counts} 组 · ${world.meta.onlineSources}/${world.meta.totalSources} 源在线 · 过滤 ${world.meta.filtered.total} 条（观点 ${world.meta.filtered.opinion} / 软 ${world.meta.filtered.soft} / 治安 ${world.meta.filtered.crime} / 其他 ${world.meta.filtered.other}）· 推送候选 ${world.meta.push.candidates} 条 · ${relayNote}`,
      );
      if (kept.length) console.warn(`[news] 本轮零稿件，沿用上一轮：${kept.join(" / ")}`);
      return result;
    })
    .catch((error) => {
      state.lastError = String(error?.message ?? error);
      console.error("[news] 构建失败", error);
      return null;
    })
    .finally(() => {
      state.building = null;
    });
  return state.building;
}

app.get("/api/news", async (req, res) => {
  try {
    const moduleId = String(req.query.module ?? "world");
    if (!MODULE_IDS.includes(moduleId)) {
      res.status(404).json({ error: `未知模块: ${moduleId}` });
      return;
    }
    const force = req.query.refresh === "1";
    const payload = await getNews(moduleId, { force });
    if (!payload) {
      res.status(503).json({ error: "新闻数据正在生成，请稍后重试", detail: state.lastError });
      return;
    }
    res.set("cache-control", "no-store");
    const { pushCandidates: _pushCandidates, ...publicPayload } = payload;
    res.json({
      ...publicPayload,
      meta: {
        ...payload.meta,
        buildMs: state.lastBuildMs,
        building: Boolean(state.building),
        translation: translationStats(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: String(error?.message ?? error) });
  }
});

app.get("/api/translate", async (req, res) => {
  const text = String(req.query.text ?? "").trim().slice(0, 500);
  if (!text) {
    res.status(400).json({ error: "缺少 text 参数" });
    return;
  }
  const from = String(req.query.from ?? "auto").toLowerCase();
  if (from === "zh" || (from === "auto" && /^[\p{Script=Han}]+$/u.test(text))) {
    res.json({ text, provider: "native", cached: true });
    return;
  }
  try {
    const result = await translate(text, { from });
    if (!result) {
      res.status(502).json({ error: "翻译服务暂时不可用" });
      return;
    }
    res.set("cache-control", "public, max-age=86400");
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error?.message ?? error) });
  }
});

app.get("/api/push", async (_req, res) => {
  try {
    const payload = await getNews("world");
    if (!payload) {
      res.status(503).json({ error: "新闻数据正在生成，请稍后重试" });
      return;
    }
    res.set("cache-control", "no-store");
    res.json({
      generatedAt: payload.generatedAt,
      cooldownHours: COOLDOWN_HOURS,
      candidates: state.pushCandidates,
      ledger: pushStats(),
    });
  } catch (error) {
    res.status(500).json({ error: String(error?.message ?? error) });
  }
});

app.post("/api/push/commit", async (req, res) => {
  try {
    const payload = await getNews("world");
    if (!payload) {
      res.status(503).json({ error: "新闻数据正在生成，请稍后重试" });
      return;
    }
    const requested = Array.isArray(req.body?.eventKeys)
      ? new Set(req.body.eventKeys.map((key) => String(key)))
      : null;
    const candidates = state.pushCandidates.filter(
      (candidate) => !requested || requested.has(candidate.eventKey),
    );
    const committed = commitPushes(candidates);
    const freshIds = new Set(candidates.map((candidate) => candidate.articleId));
    state.pushCandidates = state.pushCandidates.filter(
      (candidate) => !freshIds.has(candidate.articleId),
    );
    for (const article of payload.all) {
      if (freshIds.has(article.id)) article.pushCandidate = false;
    }
    payload.meta.push = {
      candidates: state.pushCandidates.length,
      suppressed: payload.meta.push.suppressed + committed,
    };
    res.json({ committed, ledger: pushStats() });
  } catch (error) {
    res.status(500).json({ error: String(error?.message ?? error) });
  }
});

app.get("/api/markets", async (_req, res) => {
  try {
    const payload = await getMarkets();
    res.set("cache-control", "no-store");
    res.json(payload);
  } catch (error) {
    res.status(502).json({ ok: false, indices: [], error: String(error?.message ?? error) });
  }
});

app.get("/api/markets/:id", async (req, res) => {
  try {
    const payload = await getMovers(String(req.params.id ?? ""));
    if (!payload) {
      res.status(404).json({ ok: false, gainers: [], losers: [], stocks: [], error: "未知指数" });
      return;
    }
    res.set("cache-control", "no-store");
    res.json(payload);
  } catch (error) {
    res.status(502).json({ ok: false, gainers: [], losers: [], stocks: [], error: String(error?.message ?? error) });
  }
});

// 报刊板块：论文来自公开索引的增量入库，科普来自用户粘贴的通道
app.get("/api/press", async (req, res) => {
  try {
    const interest = String(req.query.interest ?? "").slice(0, 24) || null;
    const payload = await buildPress({ interest, force: req.query.refresh === "1" });
    res.set("cache-control", "no-store");
    res.json(payload);
  } catch (error) {
    res.status(502).json({ error: String(error?.message ?? error), ...pressHealth() });
  }
});

app.post("/api/press/channel", async (req, res) => {
  const url = String(req.body?.url ?? "").trim().slice(0, 500);
  const label = String(req.body?.label ?? "").trim().slice(0, 60);
  if (!url) {
    res.status(400).json({ ok: false, error: "缺少 url 参数" });
    return;
  }
  try {
    const result = await addChannel(url, label);
    res.status(result.error ? 422 : 200).json(result);
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message ?? error) });
  }
});

app.delete("/api/press/channel/:id", (req, res) => {
  const removed = removeChannel(String(req.params.id ?? ""));
  res.json({ removed, channels: pressHealth().channels });
});

app.post("/api/press/signal", (req, res) => {
  const key = String(req.body?.key ?? "").slice(0, 80);
  const action = String(req.body?.action ?? "");
  if (!key || !["open", "save", "unsave", "hide", "unhide"].includes(action)) {
    res.status(400).json({ ok: false, error: "key 或 action 不合法" });
    return;
  }
  res.json({ ok: true, ...signal(key, action) });
});

// 学习栏：持久化层带前置校验，越级访问直接 423 + 回退原因
mountLearn(app);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasPayload: Object.keys(state.modules).length > 0,
    generatedAt: state.modules.world?.generatedAt ?? null,
    building: Boolean(state.building),
    lastError: state.lastError,
    translation: translationStats(),
    modules: MODULE_IDS.map((id) => ({
      id,
      hasPayload: Boolean(state.modules[id]),
      articles: state.modules[id]?.all.length ?? 0,
      generatedAt: state.modules[id]?.generatedAt ?? null,
    })),
    relay: state.modules.world?.meta?.relay ?? null,
  });
});

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateAddress(address) {
  if (!net.isIP(address)) return true;
  if (net.isIPv4(address)) return isPrivateIPv4(address);
  const lower = address.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (
    lower.startsWith("fe80:") ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("::ffff:")
  ) {
    return true;
  }
  return false;
}

async function isSafeImageUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) return false;
  if (net.isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}

// 源站自身域名也在中转白名单内，站点自托管图片同样可以走中转
const IMAGE_RELAY_HOSTS = new Set([
  ...IMAGE_HOSTS,
  ...SOURCES.filter((source) => source.via === "relay").map((source) => new URL(source.url).hostname),
]);
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_CONCURRENCY = 3;
const IMAGE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

let activeImageFetches = 0;
const imageWaiters = [];

async function withImageSlot(task) {
  if (activeImageFetches >= IMAGE_CONCURRENCY) {
    await new Promise((resolve) => imageWaiters.push(resolve));
  }
  activeImageFetches += 1;
  try {
    return await task();
  } finally {
    activeImageFetches -= 1;
    imageWaiters.shift()?.();
  }
}

// NPR 图床原始尺寸可达 4MB+，中转上行扛不住；URL 自带 resize 指令，直接降到 1600px
const RESIZE_PATH = /(\/resize\/)(\d+)x(\d+)(!?)/;

function shrinkImageUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (!url.hostname.endsWith("brightspotcdn.com")) return raw;
  const match = RESIZE_PATH.exec(url.pathname);
  if (!match || Number(match[2]) <= 1600) return raw;
  const height = Math.round((1600 * Number(match[3])) / Number(match[2]));
  url.pathname = url.pathname.replace(
    RESIZE_PATH,
    (_, prefix, _width, _h, bang) => `${prefix}1600x${height}${bang}`,
  );
  return url.toString();
}

function usableImage(type, buffer) {
  return type.startsWith("image/") && buffer.length <= IMAGE_MAX_BYTES ? { type, buffer } : null;
}

async function fetchImageDirect(raw) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const upstream = await fetch(raw, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": IMAGE_UA,
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        referer: `${new URL(raw).origin}/`,
      },
    }).finally(() => clearTimeout(timer));
    if (!upstream.ok) return null;
    if (!(await isSafeImageUrl(upstream.url))) return null;
    return usableImage(
      upstream.headers.get("content-type") ?? "",
      Buffer.from(await upstream.arrayBuffer()),
    );
  } catch {
    return null;
  }
}

async function fetchImage(raw) {
  const target = shrinkImageUrl(raw);
  // 图床域名在本机普遍不可达，优先走中转，失败再回退直连
  if (relayConfigured && IMAGE_RELAY_HOSTS.has(new URL(target).hostname.toLowerCase())) {
    try {
      const { buffer, contentType } = await fetchRelay(target, { timeoutMs: 20000 });
      const image = usableImage(contentType, buffer);
      if (image) return image;
    } catch {
      // 回退直连
    }
  }
  return fetchImageDirect(target);
}

app.get("/api/img", async (req, res) => {
  const raw = String(req.query.u ?? "");
  if (!raw) {
    res.status(400).end();
    return;
  }
  const cached = getMemory(`img:${raw}`);
  if (cached) {
    res.set("content-type", cached.type);
    res.set("cache-control", "public, max-age=86400");
    res.end(cached.buffer);
    return;
  }
  if (!(await isSafeImageUrl(raw))) {
    res.status(403).end();
    return;
  }
  const image = await withImageSlot(() => fetchImage(raw));
  if (!image) {
    res.status(502).end();
    return;
  }
  setMemory(`img:${raw}`, image, 30 * 60 * 1000);
  res.set("content-type", image.type);
  res.set("cache-control", "public, max-age=86400");
  res.end(image.buffer);
});

const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

// 手机要连的是局域网地址，回环地址在手机上只会指向手机自己
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}

app.listen(PORT, () => {
  console.log(`[server] 本机访问 http://127.0.0.1:${PORT}`);
  for (const address of lanAddresses()) {
    console.log(`[server] 手机访问 http://${address}:${PORT}`);
  }
  buildNewsInBackground();
});
