import { XMLParser } from "fast-xml-parser";
import { decodeEntities, hashKey, stripHtml, truncate } from "../text.mjs";
import { decodeFeed } from "../fetchFeeds.mjs";
import { fetchRelay, relayConfigured } from "../net.mjs";

// 科普通道：用户粘一个链接就能持续更新，全部走免登录通道，不接任何付费服务。
// kind=wechat-album 公众号合集页 | wechat-article 单篇文章 | rss 自动发现的订阅源 | html 版面页
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processorInstructions: [(node) => (typeof node === "string" ? decodeEntities(node) : node)] });
const FEED_CANDIDATES = ["/rss.xml", "/feed", "/feed.xml", "/index.xml", "/rss", "/feeds/rss.xml", "/api/rss", "/rss/index.xml"];

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { html: decodeFeed(buffer, res.headers.get("content-type") ?? ""), finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlOrRelay(url) {
  try {
    return await fetchHtml(url);
  } catch (error) {
    // 本机访问不通时走已自建的 Cloudflare 中转，同样是免费通道
    if (!relayConfigured) throw error;
    const { buffer, contentType } = await fetchRelay(url, { timeoutMs: 25000 });
    return { html: decodeFeed(buffer, contentType), finalUrl: url };
  }
}

function text(html, selectorRe) {
  const match = selectorRe.exec(html);
  if (!match) return "";
  return stripHtml(match[1]).replace(/\s+/g, " ").trim();
}

function metaContent(html, property) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)\\s*=\\s*["']${property}["'][^>]+content\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+(?:property|name)\\s*=\\s*["']${property}["']`,
    "i",
  );
  return decodeEntities((re.exec(html) ?? alt.exec(html))?.[1] ?? "").trim();
}

// 微信文章页是服务端渲染的，标题/公众号名/时间都能在 HTML 里直接取到
export function parseWechatArticle(html, url) {
  if (!/id="js_content"/i.test(html)) {
    const blocked = /当前环境异常|完成验证后即可继续访问|参数错误|该内容已被发布者删除/i.test(html);
    return { error: blocked ? "微信返回验证页，稍后重试" : "页面缺少正文容器，可能已被删除" };
  }
  const title =
    text(html, /<h1[^>]+id="activity-name"[^>]*>([\s\S]*?)<\/h1>/i) ||
    metaContent(html, "og:title") ||
    text(html, /<meta[^>]+property="og:title"[^>]*content="([^"]+)"/i);
  const account =
    text(html, /<a[^>]+id="js_name"[^>]*>([\s\S]*?)<\/a>/i) ||
    text(html, /<span[^>]+class="[^"]*profile_nickname[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
    metaContent(html, "og:site_name") ||
    "微信公众号";
  const digest = metaContent(html, "og:description") || metaContent(html, "description");
  const publishRaw =
    text(html, /<em[^>]+id="publish_time"[^>]*>([\s\S]*?)<\/em>/i) ||
    /var\s+(?:oriCreateTime|ct)\s*=\s*"?(\d{9,13})"?/i.exec(html)?.[1] ||
    "";
  const published = publishFromWechat(publishRaw);
  if (!title) return { error: "未能解析标题" };
  return {
    title,
    account,
    digest: truncate(digest.replace(/^来自公众号[\s:：]?/i, ""), 260),
    published,
    url,
    key: `wx:${hashKey(url)}`,
    kind: "article",
    source: "wechat",
    lang: "zh",
  };
}

function publishFromWechat(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^\d{9,13}$/.test(value)) {
    const ms = value.length === 13 ? Number(value) : Number(value) * 1000;
    const date = new Date(ms + 8 * 3600e3);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  const cn = /(\d{4})[年\-/.](\d{1,2})[月\-/.](\d{1,2})?/.exec(value);
  if (cn) {
    return `${cn[1]}-${String(Number(cn[2])).padStart(2, "0")}-${String(Number(cn[3] ?? 1)).padStart(2, "0")}`;
  }
  return "";
}

// 合集页（appmsgalbum）免登录可访问，能直接拿到合集内近期文章列表
export function parseWechatAlbum(html, baseUrl) {
  const items = [];
  const isoDate = (value) => {
    const hit = /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/.exec(String(value ?? ""));
    return hit
      ? `${hit[1]}-${String(Number(hit[2])).padStart(2, "0")}-${String(Number(hit[3])).padStart(2, "0")}`
      : "";
  };
  const push = (href, rawTitle, published = "") => {
    const title = stripHtml(String(rawTitle ?? "")).replace(/\s+/g, " ").trim();
    if (title.length < 8 || title.length > 90) return;
    if (/^(查看更多|继续加载|已显示全部|合集|返回)$/.test(title)) return;
    if (!href) return;
    let link;
    try {
      link = new URL(decodeEntities(href).replace(/&amp;/g, "&"), baseUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(link)) return;
    items.push({
      title,
      url: link,
      published,
      key: `wx:${hashKey(link)}`,
      kind: "article",
      source: "wechat-album",
      lang: "zh",
    });
  };

  const epochDate = (value) => {
    const hit = /(?:data-)?create_?time\s*=\s*["']?(\d{10})/.exec(value);
    if (!hit) return "";
    const date = new Date(Number(hit[1]) * 1000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };
  // 合集列表把地址放在 data-link：按它切段，段内第一个长文本是标题，第一个日期是发布时间
  for (const piece of html.split(/data-link\s*=\s*["']/i).slice(1)) {
    const href = /^([^"']+)/.exec(piece)?.[1] ?? "";
    const body = piece.slice(href.length).slice(0, 400);
    const title = /(?:^|>)\s*([^<>{}"']{8,120}?)\s*(?:<|$)/.exec(body)?.[1] ?? "";
    push(href, title, isoDate(body) || epochDate(body));
  }
  for (const [, href, label] of html.matchAll(
    /<a\b[^>]+href\s*=\s*["'](https?:\/\/mp\.weixin\.qq\.com\/[sS][^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi,
  )) {
    push(href, label, "");
  }
  const seen = new Set();
  return items.filter((item) => (seen.has(item.url) ? false : (seen.add(item.url), true)));
}

// 给一个站点首页，找出它真正可用的订阅源。
// 站点自己 <link rel=alternate> 声明的源可能是残缺的历史 feed（Quanta 的 /quanta/feed/ 只有一条 2013 年的），
// 所以声明与标准路径一起探，按真实条数和新鲜度择优。
export async function discoverFeed(url) {
  const { html, finalUrl } = await fetchHtmlOrRelay(url);
  const declared = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/rel\s*=\s*["']?alternate/i.test(tag)) continue;
    if (!/application\/(?:rss|atom)\+xml/i.test(tag)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (href) declared.push(new URL(decodeEntities(href), finalUrl).toString());
  }
  const origin = new URL(finalUrl).origin;
  const candidates = [...new Set([...declared, ...FEED_CANDIDATES.map((path) => new URL(path, origin).toString())])];
  let best = null;
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const { html: body } = await fetchHtmlOrRelay(candidate);
      const { feedTitle, items } = parseRssFeed(body, 12);
      if (!items.length) continue;
      const newest = items.map((item) => item.published).filter(Boolean).sort().at(-1) ?? "";
      const age = newest ? (Date.now() - Date.parse(newest)) / 86400e3 : 9999;
      const score = items.length + (age <= 30 ? 20 : age <= 120 ? 10 : 0);
      if (!best || score > best.score) best = { feedUrl: candidate, siteTitle: feedTitle, score };
    } catch {
      /* 继续试下一个候选 */
    }
  }
  if (!best) return null;
  return { feedUrl: best.feedUrl, siteTitle: best.siteTitle || new URL(finalUrl).hostname };
}

export function parseRssFeed(xml, limit = 24) {
  if (!/<(rss|feed|rdf)[\s>]/i.test(xml.slice(0, 1500))) return { feedTitle: "", items: [] };
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.RDF?.item ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  const feedTitle = stripHtml(String(doc?.rss?.channel?.title ?? doc?.feed?.title ?? "")).trim();
  const items = list.slice(0, limit).map((entry) => {
    const link = typeof entry.link === "object" ? (entry.link["@_href"] ?? entry.link["#text"]) : entry.link;
    const iso = entry.pubDate ?? entry.updated ?? entry.published ?? entry["dc:date"] ?? "";
    // RSS 的日期既有 ISO 也有 RFC-822（Mon, 10 Nov 2026 ...），后者正则吃不下，交给 Date 解析
    const matched = /(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    const parsed = matched ? null : new Date(String(iso));
    const fallback = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
    const published = matched
      ? `${matched[1]}-${matched[2]}-${matched[3]}`
      : /^\d{4}-\d{2}-\d{2}/.test(String(iso))
        ? String(iso).slice(0, 10)
        : fallback;
    const title = stripHtml(String(entry.title ?? "")).trim();
    const summary = truncate(stripHtml(String(entry.summary ?? entry.description ?? entry["content:encoded"] ?? "")), 240);
    return {
      title,
      url: String(link ?? "").trim(),
      published,
      digest: summary,
      key: `rss:${hashKey(String(link ?? title))}`,
      kind: "article",
      source: "rss",
      lang: /[\p{Script=Han}]/u.test(title) ? "zh" : "en",
    };
  });
  return { feedTitle, items };
}

export async function fetchRssItems(url, limit = 24) {
  const { html } = await fetchHtmlOrRelay(url);
  return parseRssFeed(html, limit).items;
}

export async function peekWechatArticle(url) {
  try {
    const { html } = await fetchHtmlOrRelay(url);
    return parseWechatArticle(html, url);
  } catch (error) {
    return { error: `抓取失败 ${String(error?.message ?? error).slice(0, 60)}` };
  }
}

export async function fetchChannelItems(channel, limit = 24) {
  const config = typeof channel.config === "string" ? JSON.parse(channel.config) : (channel.config ?? {});
  if (channel.kind === "rss") return fetchRssItems(channel.url, limit);
  if (channel.kind === "wechat-album") {
    const { html, finalUrl } = await fetchHtmlOrRelay(channel.url);
    const items = parseWechatAlbum(html, finalUrl).slice(0, limit);
    return items.map((item) => ({ ...item, account: config.account ?? channel.label }));
  }
  if (channel.kind === "wechat-article") {
    const { html } = await fetchHtmlOrRelay(channel.url);
    const article = parseWechatArticle(html, channel.url);
    if (article.error) throw new Error(article.error);
    return [{ ...article, digest: article.digest, account: article.account }];
  }
  return [];
}

export function classifyChannelUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return { error: "链接格式不正确，请粘贴完整地址" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { error: "只支持 http/https 链接" };
  const host = url.hostname.toLowerCase();
  if (host.endsWith("weixin.qq.com") || host === "mp.weixin.qq.com") {
    if (/appmsgalbum|action=getalbum/i.test(url.search) || /album/i.test(url.pathname)) {
      return { kind: "wechat-album", url: url.toString() };
    }
    if (/^\/s/.test(url.pathname) || url.searchParams.has("srcid") || url.searchParams.has("sn")) {
      return { kind: "wechat-article", url: url.toString() };
    }
    return { error: "只接受公众号文章链接或合集页链接（公众号内长按/右键复制链接）" };
  }
  if (/\.(xml|rss|atom)$/i.test(url.pathname) || /feed|rss/i.test(url.pathname)) {
    return { kind: "rss", url: url.toString() };
  }
  return { kind: "discover", url: url.toString() };
}
