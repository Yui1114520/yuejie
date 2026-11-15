import { Capacitor } from "@capacitor/core";
import type {
  MarketSnapshot,
  ModuleId,
  MoversSnapshot,
  NewsPayload,
  PressPayload,
} from "../types";

const BASE_KEY = "yuejie.apiBase";

// 静态快照版：整站只有 site/data/*.json，没有任何后端可以打
export const isStaticSite = import.meta.env.VITE_SITE_DATA === "1";
const STATIC_NOTE = "这是每天生成的静态快照，改动请回到电脑端的本地版本";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

// 接口路径 -> 快照文件名；查询参数只用来选文件，不会拼进 URL
function staticPath(path: string): string {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  if (base === "/api/health") return "/data/meta.json";
  if (base === "/api/news") return `/data/news-${params.get("module") ?? "world"}.json`;
  if (base === "/api/press") {
    const interest = params.get("interest");
    return interest ? `/data/press-${interest}.json` : "/data/press.json";
  }
  if (base === "/api/markets") return "/data/markets.json";
  const movers = /^\/api\/markets\/([^/]+)$/.exec(base);
  if (movers) return `/data/movers-${movers[1]}.json`;
  throw new Error(STATIC_NOTE);
}

// APK 壳里页面从 http://localhost 加载，数据却在电脑那台后端上，接口只能走绝对地址；
// 浏览器里保持空串同源，vite 代理和直连 8787 都不用额外配置
export function apiBase(): string {
  const saved = localStorage.getItem(BASE_KEY)?.trim();
  // 预填地址只给 APK 壳用：浏览器复用同一份 dist 时不该去打一个可能过期的内网 IP
  const preset = inAppShell ? import.meta.env.VITE_API_BASE ?? "" : "";
  return trimSlash(saved || preset || "");
}

export function setApiBase(value: string) {
  const clean = trimSlash(value.trim());
  if (clean) localStorage.setItem(BASE_KEY, clean);
  else localStorage.removeItem(BASE_KEY);
  return clean;
}

export function apiUrl(path: string) {
  if (isStaticSite) return staticPath(path);
  return `${apiBase()}${path}`;
}

// 快照版每次重新拉文件，让新部署的数据立刻可见；同源后端本来带 no-store，不需要这个
function cacheBust(url: string, refresh?: boolean) {
  if (!isStaticSite || !refresh) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
}

export const inAppShell = Capacitor.isNativePlatform();

export async function probeApi(base: string): Promise<{ ok: boolean; detail: string }> {
  if (!base.trim()) return { ok: false, detail: "地址还没填" };
  try {
    const res = await fetch(`${trimSlash(base.trim())}/api/health`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, detail: `服务返回 ${res.status}` };
    const body = (await res.json().catch(() => null)) as { modules?: unknown[] } | null;
    return { ok: true, detail: `已连接 · 后端缓存 ${body?.modules?.length ?? 0} 个模块` };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, detail: "8 秒内没有响应，确认后端正在运行" };
    }
    return { ok: false, detail: "连不上：检查手机与电脑是否同一 WiFi、IP 与端口是否填对" };
  }
}

export async function fetchNews(
  options: { refresh?: boolean; module?: ModuleId; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams();
  if (options.module) params.set("module", options.module);
  if (options.refresh) params.set("refresh", "1");
  const query = params.toString();
  const res = await fetch(cacheBust(apiUrl(`/api/news${query ? `?${query}` : ""}`), options.refresh), {
    signal: options.signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `请求失败 (${res.status})`);
  }
  return (await res.json()) as NewsPayload;
}

export async function fetchPress(
  options: { interest?: string | null; refresh?: boolean; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams();
  if (options.interest) params.set("interest", options.interest);
  if (options.refresh) params.set("refresh", "1");
  const query = params.toString();
  const res = await fetch(
    cacheBust(apiUrl(`/api/press${query ? `?${query}` : ""}`), options.refresh),
    { signal: options.signal },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `报刊数据请求失败 (${res.status})`);
  }
  return (await res.json()) as PressPayload;
}

export interface PressChannelResult {
  ok?: boolean;
  id?: string;
  error?: string;
  note?: string;
  feedUrl?: string;
  items?: number;
}

export async function addPressChannel(url: string, label = ""): Promise<PressChannelResult> {
  const res = await fetch(apiUrl("/api/press/channel"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, label }),
  });
  const body = (await res.json().catch(() => null)) as PressChannelResult | null;
  if (!res.ok && !body?.error) throw new Error(`订阅失败 (${res.status})`);
  return body ?? { error: "订阅失败" };
}

export async function removePressChannel(id: string) {
  const res = await fetch(apiUrl(`/api/press/channel/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`取消订阅失败 (${res.status})`);
  return (await res.json()) as { removed: boolean };
}

export type PressSignalAction = "open" | "save" | "unsave" | "hide" | "unhide";

export async function postPressSignal(key: string, action: PressSignalAction) {
  const res = await fetch(apiUrl("/api/press/signal"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, action }),
  });
  if (!res.ok) throw new Error(`行为记录失败 (${res.status})`);
  return (await res.json()) as { ok: boolean };
}

export async function fetchMarkets(signal?: AbortSignal) {
  const res = await fetch(apiUrl("/api/markets"), { signal });
  if (!res.ok) throw new Error(`行情请求失败 (${res.status})`);
  return (await res.json()) as MarketSnapshot;
}

export async function fetchMovers(indexId: string, signal?: AbortSignal) {
  const res = await fetch(apiUrl(`/api/markets/${encodeURIComponent(indexId)}`), { signal });
  if (!res.ok) throw new Error(`成分股请求失败 (${res.status})`);
  return (await res.json()) as MoversSnapshot;
}

export async function translateSnippet(text: string, from: string, signal?: AbortSignal) {
  // 快照版没有翻译接口，标题和摘要在导出时已经是中文，这里直接回原文
  if (isStaticSite) return { text };
  const res = await fetch(apiUrl(`/api/translate?text=${encodeURIComponent(text)}&from=${from}`), {
    signal,
  });
  if (!res.ok) throw new Error("翻译服务暂时不可用");
  return (await res.json()) as { text: string };
}

export function imageUrl(source: string | null | undefined) {
  if (!source) return null;
  if (source.startsWith("/")) return source;
  // 静态站上没人帮忙代理图片，直接交给访问者的网络去取
  if (isStaticSite) return source;
  return apiUrl(`/api/img?u=${encodeURIComponent(source)}`);
}
