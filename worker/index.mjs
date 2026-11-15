import { IMAGE_HOSTS, SOURCES } from "../server/sources.mjs";

const ALLOWED_HOSTS = new Set([
  ...SOURCES.filter((source) => source.via === "relay").map((source) => new URL(source.url).hostname),
  ...IMAGE_HOSTS,
  "translate.googleapis.com",
  "clients5.google.com",
]);

const MAX_BYTES = 4 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function allowedHosts(env) {
  const hosts = new Set(ALLOWED_HOSTS);
  for (const host of String(env?.EXTRA_HOSTS ?? "").split(",")) {
    const trimmed = host.trim();
    if (trimmed) hosts.add(trimmed);
  }
  return hosts;
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function authorized(request, env) {
  const token = String(env?.RELAY_TOKEN ?? "");
  const header = request.headers.get("authorization") ?? "";
  if (!token || !header.startsWith("Bearer ")) return false;
  const [given, expected] = await Promise.all([digest(header.slice(7)), digest(token)]);
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= given[i] ^ expected[i];
  return diff === 0;
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, hosts: [...allowedHosts(env)] });
    }
    if (request.method !== "POST" || url.pathname !== "/fetch") {
      return json({ error: "not found" }, 404);
    }
    if (!(await authorized(request, env))) {
      return json({ error: "unauthorized" }, 401);
    }

    let target;
    try {
      const body = await request.json();
      target = new URL(String(body?.url ?? ""));
    } catch {
      return json({ error: "invalid url" }, 400);
    }
    if (!/^https?:$/.test(target.protocol) || !allowedHosts(env).has(target.hostname)) {
      return json({ error: "host not allowed" }, 403);
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
      if (!allowedHosts(env).has(finalHost)) {
        return json({ error: `redirect host not allowed: ${finalHost}` }, 403);
      }
      const buffer = await upstream.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        return json({ error: "response too large" }, 413);
      }
      return json({
        status: upstream.status,
        contentType: upstream.headers.get("content-type") ?? "",
        bytes: buffer.byteLength,
        body: toBase64(buffer),
      });
    } catch (error) {
      const aborted = error?.name === "AbortError";
      return json({ error: aborted ? "upstream timeout" : String(error?.message ?? error) }, 502);
    } finally {
      clearTimeout(timer);
    }
  },
};
