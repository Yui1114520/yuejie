import { XMLParser } from "fast-xml-parser";
import { SOURCES, MAX_ITEM_AGE_HOURS } from "./sources.mjs";
import { PROVINCES } from "./taxonomy.mjs";
import { getMemory, setMemory } from "./cache.mjs";
import { fetchRelay, relayConfigured } from "./net.mjs";
import {
  decodeEntities,
  firstImageFromHtml,
  stripHtml,
  truncate,
} from "./text.mjs";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: { enabled: true, maxTotalExpansions: 50000 },
  htmlEntities: true,
});

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const MAX_ITEMS_PER_SOURCE = 25;
const FUTURE_TOLERANCE_MS = 6 * 60 * 60 * 1000;
const UNDATED_AGE_MS = 6 * 60 * 60 * 1000;

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (Array.isArray(node)) {
    for (const entry of node) {
      const text = textOf(entry);
      if (text) return text;
    }
    return "";
  }
  if (typeof node === "object") {
    return textOf(node.__cdata ?? node["#text"] ?? node.__text ?? node["#cdata"]);
  }
  return "";
}

function attr(node, name) {
  if (!node || typeof node !== "object") return "";
  const value = node[`@_${name}`];
  return typeof value === "string" ? value : "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value ?? "").trim());
}

function resolveLink(item) {
  const link = item.link;
  if (typeof link === "string" && isHttpUrl(link)) return link.trim();
  const links = asArray(link).filter((l) => l && typeof l === "object");
  const alternate = links.find((l) => {
    const rel = attr(l, "rel");
    return !rel || rel === "alternate";
  });
  const chosen = alternate ?? links[0];
  const href = chosen ? attr(chosen, "href") : "";
  if (isHttpUrl(href)) return href.trim();
  const guid = item.guid;
  if (isHttpUrl(guid)) return String(guid).trim();
  if (guid && typeof guid === "object") {
    const permalink = attr(guid, "isPermaLink");
    const value = textOf(guid);
    if (isHttpUrl(value) && permalink !== "false") return value.trim();
  }
  return "";
}

function resolveDate(item) {
  const candidates = [
    item.pubDate,
    item["dc:date"],
    item.published,
    item.updated,
    item["a10:updated"],
    item.date,
  ];
  for (const candidate of candidates) {
    const raw = textOf(candidate);
    if (!raw) continue;
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

const TRACKING_IMAGE = /(?:tracking|tracker|pixel|spacer|blank|1x1|transparent|beacon)[/_.-]/i;

function resolveImage(item, summaryHtml) {
  const candidates = [];
  const mediaContents = [
    ...asArray(item["media:content"]),
    ...asArray(item["media:thumbnail"]),
  ];
  for (const media of mediaContents) {
    const url = attr(media, "url");
    const type = attr(media, "type").toLowerCase();
    const medium = attr(media, "medium").toLowerCase();
    if (!url) continue;
    if (type && !type.startsWith("image/")) continue;
    if (medium && medium !== "image") continue;
    const width = Number(attr(media, "width") || 0);
    candidates.push({ url: url.trim(), width });
  }
  for (const enclosure of asArray(item.enclosure)) {
    const url = attr(enclosure, "url");
    const type = attr(enclosure, "type").toLowerCase();
    if (url && (!type || type.startsWith("image/"))) candidates.push({ url: url.trim(), width: 0 });
  }
  const html = `${textOf(item["content:encoded"])} ${summaryHtml}`;
  const inHtml = firstImageFromHtml(html);
  if (inHtml) candidates.push({ url: inHtml, width: 0 });

  const best = candidates
    .filter((c) => /^https?:\/\//i.test(c.url) && !TRACKING_IMAGE.test(c.url))
    .sort((a, b) => b.width - a.width)[0];
  return best ? best.url : null;
}

function extractItems(parsed) {
  if (parsed?.rss?.channel) return asArray(parsed.rss.channel.item);
  if (parsed?.feed?.entry) return asArray(parsed.feed.entry);
  if (parsed?.["rdf:RDF"]?.item) return asArray(parsed["rdf:RDF"].item);
  if (parsed?.RDF?.item) return asArray(parsed.RDF.item);
  return [];
}

async function fetchDirect(url, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "accept-language": "en,zh-CN;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") || "",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function decodeFeed(buffer, contentType = "") {
  // 数字报页面常把 UTF-8 错标成 GBK（北京日报），先严格按 UTF-8 解，失败才认站点声明
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(buffer)
      .replace(/^\uFEFF/, "");
  } catch {
    // 非 UTF-8 字节流，继续按 charset 判断
  }
  let charset = /charset=([\w-]+)/i.exec(contentType)?.[1] ?? "";
  if (!charset) {
    const head = buffer.subarray(0, 1024).toString("latin1");
    charset = /(?:encoding|charset)\s*=\s*["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
  }
  charset = charset.toLowerCase();
  if (charset === "gb2312" || charset === "gbk") charset = "gbk";
  try {
    return new TextDecoder(charset).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  }
}

async function fetchText(source) {
  const raw =
    source.via === "relay"
      ? await fetchRelay(source.url)
      : await fetchDirect(source.url);
  return decodeFeed(raw.buffer, raw.contentType);
}

function normalizeItems(source, rawItems) {
  const now = Date.now();
  const maxAgeHours = source.maxAgeHours ?? MAX_ITEM_AGE_HOURS;
  const oldest = now - maxAgeHours * 60 * 60 * 1000;
  const seen = new Set();
  const items = [];

  for (const raw of rawItems) {
    const title = stripHtml(textOf(raw.title));
    const link = resolveLink(raw);
    if (!title || !link) continue;
    // \W 会把汉字全部消掉，中文源会被误判为重复标题；只去空白与标点/符号
    const key = title.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
    if (seen.has(key)) continue;

    // RSS 0.91 源（如 Folha）不带时间戳，按 6 小时前估算，避免整源被判为空
    const resolved = resolveDate(raw);
    const publishedMs = resolved ? Date.parse(resolved) : now - UNDATED_AGE_MS;
    if (publishedMs < oldest || publishedMs > now + FUTURE_TOLERANCE_MS) continue;

    const publishedAt = new Date(publishedMs).toISOString();

    const summaryHtml = textOf(raw.description) || textOf(raw.summary) || textOf(raw["content:encoded"]);
    const summary = truncate(stripHtml(summaryHtml), 220);
    const image = resolveImage(raw, summaryHtml);

    seen.add(key);
    items.push({
      id: `${source.id}:${link}`,
      sourceId: source.id,
      title,
      link,
      summary,
      image,
      publishedAt,
      publishedMs,
      lang: source.lang,
      origin: source.lang,
    });
  }

  items.sort((a, b) => b.publishedMs - a.publishedMs);
  return items.slice(0, MAX_ITEMS_PER_SOURCE);
}

// 省级媒体没有可用 RSS，改为抓要闻首页锚文本；站点多为 GBK，标题即新闻标题
const HTML_LIMIT = 12;
const HTML_NAV =
  /客户端|扫一扫|二维码|许可证|举报|网站地图|联系我们|广告服务|版权声明|登录|注册|English|简体|繁體|无障碍|返回顶部|上一页|下一页|查看更多|更多>|设为首页|加入收藏|下载APP|下载客户端|手机版|手机报|数字报|电子报|官方微博|官方微信|公众号|专题|新闻联播|联播/i;
// 首页固定置顶的中央宣传稿与导航专区，地方站转载后不含省名，按标题特征剔除
const HTML_NATIONAL =
  /习近平|李强|赵乐际|王沪宁|蔡奇|丁薛祥|李希|韩正|中共中央|国务院|全国人大|全国政协|中央经济工作会议|中央农村工作会议|中央军委|外交部|国防部|第一观察|拾光纪|习言道|央视快评|人民日报|新华时评|新华社|求是|学习强国|伟大复兴|八项规定|网络调查问卷|联合辟谣|辟谣平台|新时代文明|政务服务|便民热线/;
const HTML_SERVICE =
  /(?:新闻网|工作网|政府网|信息网|服务网|门户|频道|平台|数据库|热线|管理局|委员会|办公室|主办|承办|协办|有限公司|集团|银行|医院|学校|大学|学院|景区|公园|商城|招聘|招商|博览会|交易会|开发区|事务厅|储备局|统计局|公安局|财政局|税务局|教育局)$/;
const HTML_SNIPPET = /[：:]$|…$|\.{3}$|—\s*\d+\s*—$/;
// 地方站首页混排的副刊、活动推广与微博/客户端导航条目，不是时政要闻
const HTML_JUNK =
  /新浪微博|腾讯微博|关注.{0,8}(?:新闻网|日报|晚报|客户端)|副刊|温故|往事|口述|连载|采风|会客厅|还景于民|重磅开启|火热开启|盛大开幕|圆满落幕|农交会|展销会|推介会|冬日|暖冬|观鸟|海鸥|冰雪季|消费季/;
const HTML_BAD_HREF = /^(?:javascript:|#|mailto:|tel:)|\.(?:jpe?g|png|gif|webp|svg|mp4|mp3|zip|pdf)(?:[?#]|$)/i;
// 数字报的“第X版”导航也指向 node*.html，不是稿件
const HTML_NODE_LINK = /\/node_?\d+\.html?$/i;

function hanCount(text) {
  return (text.match(/[\p{Script=Han}]/gu) ?? []).length;
}

function resolveHref(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // 频道页/首页的 URL 没有文章 ID，只有正文链接带数字
    if (!/\d/.test(url.pathname) || url.pathname.length < 4) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function dateFromHref(href) {
  const match =
    /(20\d{2})[-_/]?(\d{2})[-_/]?(\d{2})/.exec(href) ??
    /t(20\d{2})(\d{2})(\d{2})/.exec(href);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 4)).getTime();
}

function parseHtmlItems(source, html, baseUrl) {
  const province = PROVINCES.find((entry) => entry.id === source.province);
  const limit = source.htmlLimit ?? HTML_LIMIT;
  const now = Date.now();
  const oldest = now - (source.maxAgeHours ?? MAX_ITEM_AGE_HOURS) * 60 * 60 * 1000;
  const items = [];
  const seenTitles = new Set();
  const seenLinks = new Set();
  // 移动端数字报（如北京日报）把稿件地址放在 data-href 里
  const anchor =
    /<a\b[^>]*?(?:data-href|href)\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = anchor.exec(html))) {
    if (items.length >= limit) break;
    const href = (match[1] ?? match[2] ?? "").trim();
    if (!href || HTML_BAD_HREF.test(href)) continue;
    const link = resolveHref(href, baseUrl);
    if (!link || HTML_NODE_LINK.test(link) || seenLinks.has(link)) continue;

    const title = stripHtml(match[3]);
    const length = Array.from(title).length;
    if (hanCount(title) < 8 || length > 50) continue;
    if (HTML_NAV.test(title) || HTML_JUNK.test(title)) continue;
    // 首页混排全国稿、导航专区与服务入口：只收标题点名本省的本地新闻
    const local = Boolean(province?.zh.some((term) => title.includes(term)));
    if (source.strictLocal !== false && !local) continue;
    if (HTML_NATIONAL.test(title)) continue;
    if (HTML_SERVICE.test(title) || HTML_SNIPPET.test(title)) continue;
    if (hanCount(title) <= 10 && /报$/.test(title)) continue;

    const key = title.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
    if (seenTitles.has(key)) continue;

    const parsed = dateFromHref(link);
    const publishedMs = parsed ?? now - items.length * 20 * 60 * 1000;
    if (publishedMs < oldest) continue;

    seenLinks.add(link);
    seenTitles.add(key);
    items.push({
      id: `${source.id}:${link}`,
      sourceId: source.id,
      title,
      link,
      summary: "",
      image: null,
      publishedAt: new Date(publishedMs).toISOString(),
      publishedMs,
      lang: source.lang,
      origin: source.lang,
      province: source.province ?? null,
    });
  }

  return items;
}

// 数字报版面地址按北京时间展开；早上日报未出，逐个回退到前两天
function epaperUrls(source) {
  const urls = [];
  for (let back = 0; back < 3; back += 1) {
    const now = new Date(Date.now() - back * 24 * 3600e3 + 8 * 3600e3);
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const parts = {
      "{YYYY}": String(year),
      "{YYYY-MM}": `${year}-${month}`,
      "{YYYYMM}": `${year}${month}`,
      "{YYYYMMDD}": `${year}${month}${day}`,
      "{DD}": day,
    };
    urls.push(source.url.replace(/\{[A-Z-]+\}/g, (key) => parts[key]));
  }
  return urls;
}

async function fetchEpaper(source) {
  const urls = epaperUrls(source);
  for (let index = 0; index < urls.length; index += 1) {
    let raw;
    try {
      raw = await fetchDirect(urls[index]);
    } catch (error) {
      // 版面按出报日期存在，前几天 404 只是休刊；最后一天仍取不到才判源失败
      if (index === urls.length - 1) throw error;
      continue;
    }
    const items = parseHtmlItems(
      source,
      decodeFeed(raw.buffer, raw.contentType),
      urls[index],
    );
    if (items.length) return items;
  }
  return [];
}

export async function fetchSource(source) {
  const cached = getMemory(`feed:${source.id}`);
  if (cached) return cached;

  const started = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const items =
        source.kind === "epaper"
          ? await fetchEpaper(source)
          : source.kind === "html"
            ? parseHtmlItems(source, await fetchText(source), source.url)
            : normalizeItems(source, extractItems(parser.parse(await fetchText(source))));
      const result = {
        ...source,
        items,
        ok: items.length > 0,
        error: items.length ? null : "源返回空内容",
        latencyMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
      };
      setMemory(`feed:${source.id}`, result, 10 * 60 * 1000);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  return {
    ...source,
    items: [],
    ok: false,
    error:
      lastError?.name === "AbortError" ? "请求超时" : String(lastError?.message ?? lastError),
    latencyMs: Date.now() - started,
    fetchedAt: new Date().toISOString(),
  };
}

async function mapLimit(list, limit, task) {
  const results = new Array(list.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(list[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchAllSources() {
  const pending = relayConfigured
    ? []
    : SOURCES.filter((source) => source.via === "relay").map(({ id, name, shortName, lang, focus }) => ({
        id,
        name,
        shortName,
        lang,
        focus,
      }));
  const active = SOURCES.filter((source) => relayConfigured || source.via !== "relay");
  // 省级站响应慢，串行排队会拖垮整体构建；限制并发避免触发源站风控
  const results = await mapLimit(active, 12, (source) => fetchSource(source));
  const items = results.flatMap((r) => r.items);
  return {
    sources: results.map(({ items: _items, ...meta }) => meta),
    items,
    relay: { configured: relayConfigured, pending },
  };
}

export function decodeForDisplay(text) {
  return decodeEntities(text);
}
