import http from "node:http";
import { SOURCES } from "./sources.mjs";

const PORT = Number(process.env.RELAY_PORT || 8790);
const TOKEN = String(process.env.RELAY_TOKEN ?? "");
const ALLOWED_HOSTS = new Set(
  SOURCES.filter((source) => source.via === "relay").map((source) => new URL(source.url).hostname),
);
for (const host of String(process.env.RELAY_EXTRA_HOSTS ?? "").split(",")) {
  const trimmed = host.trim();
  if (trimmed) ALLOWED_HOSTS.add(trimmed);
}
const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    send(res, 200, { ok: true, hosts: [...ALLOWED_HOSTS] });
    return;
  }
  if (req.method !== "POST" || req.url !== "/fetch") {
    send(res, 404, { error: "not found" });
    return;
  }
  if (!TOKEN || req.headers.authorization !== `Bearer ${TOKEN}`) {
    send(res, 401, { error: "unauthorized" });
    return;
  }

  let target;
  try {
    const payload = JSON.parse(await readBody(req));
    target = new URL(String(payload?.url ?? ""));
  } catch {
    send(res, 400, { error: "invalid url" });
    return;
  }
  if (!/^https?:$/.test(target.protocol) || !ALLOWED_HOSTS.has(target.hostname)) {
    send(res, 403, { error: "host not allowed" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(target.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "accept-language": "en,fr,es,pt,ja,zh-CN;q=0.7",
      },
    });
    const finalHost = new URL(upstream.url).hostname;
    if (!ALLOWED_HOSTS.has(finalHost)) {
      send(res, 403, { error: "redirect host not allowed" });
      return;
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_RESPONSE_BYTES) {
      send(res, 413, { error: "response too large" });
      return;
    }
    send(res, 200, {
      status: upstream.status,
      contentType: upstream.headers.get("content-type") ?? "",
      bytes: buffer.length,
      body: buffer.toString("base64"),
    });
  } catch (error) {
    send(res, 502, {
      error: error?.name === "AbortError" ? "upstream timeout" : String(error?.message ?? error),
    });
  } finally {
    clearTimeout(timer);
  }
});

server.listen(PORT, () => {
  console.log(`[relay] listening on :${PORT} · ${ALLOWED_HOSTS.size} allowed hosts`);
  if (!TOKEN) console.warn("[relay] RELAY_TOKEN 为空，所有转发请求都会被拒绝");
});
