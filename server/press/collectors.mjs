import { XMLParser } from "fast-xml-parser";
import { decodeEntities, hashKey } from "../text.mjs";
import { AUTHORITATIVE, INTERESTS, lookupJournal } from "./journals.mjs";
import { cachedIssn, rememberIssn } from "./store.mjs";

// 全部为免密钥、免登录、免费的公开接口；不使用任何付费服务
const UA = "yuejie-press/0.1 (https://github.com/local/yuejie; mailto:press@yuejie.local)";
// ChinaXiv 对非浏览器 UA 直接 403
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const WINDOW_DAYS = 21;
const OPENALEX_KEY = String(process.env.OPENALEX_API_KEY ?? "").trim();
const CROSSREF_JOURNAL_ROWS = 10;
const ISSN_RESOLVE_PER_RUN = 20;
// 这台主机到 api.crossref.org 单请求实测 10~36 秒，20 秒超时会把成功请求误判成失败
const CROSSREF_OPTS = { timeoutMs: 45000 };
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function sinceDate(days = WINDOW_DAYS) {
  const now = new Date(Date.now() - days * 86400e3 + 8 * 3600e3);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function request(url, { timeoutMs = 20000, accept = "application/json", ua = UA } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": ua, accept },
      redirect: "follow",
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, options) {
  const res = await request(url, options);
  return JSON.parse(await readText(res));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// request 的定时器只罩到响应头；索引偶尔连着不发正文，不加这一层整轮采集会无限期挂住
async function readText(res, timeoutMs = 15000) {
  try {
    return await Promise.race([
      res.text(),
      wait(timeoutMs).then(() => {
        throw new Error("读取超时");
      }),
    ]);
  } finally {
    res.body?.cancel().catch(() => {});
  }
}

async function pool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results.flat();
}

function workKey(doi, title) {
  if (doi) return `doi:${String(doi).toLowerCase()}`;
  return `t:${hashKey(String(title ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""))}`;
}

// Crossref 的时间是 [[2026,11,13]]，OpenAlex/EPMC 是标量数组，两种都要吃
function dateFromParts(parts) {
  if (!Array.isArray(parts)) return "";
  const inner = Array.isArray(parts[0]) ? parts[0] : parts;
  const [year, month = 1, day = 1] = inner;
  if (!Number.isInteger(Number(year))) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTH_CODES = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function monthName(index) {
  return MONTH_NAMES[((Number(index) % 12) + 12) % 12];
}

// DOAJ 只给年份 + 英文月名，缺月时按月初估，晚于今天的日期一律夹到当天
function dateFromYearMonth(year, month) {
  const digits = String(year ?? "").slice(0, 4);
  if (!/^\d{4}$/.test(digits)) return "";
  const code = MONTH_CODES[String(month ?? "").toLowerCase().slice(0, 3)] ?? null;
  const today = sinceDate(0);
  const iso = code ? `${digits}-${code}-01` : `${digits}-01-01`;
  return iso > today ? today : iso;
}

function cleanTitle(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stripJats(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// OpenAlex 摘要是倒排索引，需要还原成正文
function abstractFromInverted(inverted) {
  if (!inverted || typeof inverted !== "object") return "";
  const slots = [];
  for (const [term, positions] of Object.entries(inverted)) {
    for (const position of positions) slots[position] = term;
  }
  return slots.filter(Boolean).join(" ").slice(0, 900);
}

function classify(journalName, fallbackField) {
  const hit = lookupJournal(journalName);
  if (hit) return { tier: hit.tier, field: hit.field ?? fallbackField, matched: hit.name };
  return { tier: 0, field: fallbackField ?? null, matched: null };
}

function baseWork(input) {
  const journal = cleanTitle(input.journal);
  const cls = classify(journal, input.field);
  const title = cleanTitle(input.title);
  const today = sinceDate(0);
  // 索引里常出现「先在线、后正式见刊」的未来日期，一律夹到当天，否则新鲜度分虚高
  const published = String(input.published ?? "");
  return {
    key: workKey(input.doi, title),
    kind: "paper",
    source: input.source,
    url: input.url,
    doi: input.doi ? String(input.doi).toLowerCase() : null,
    title,
    abstract: stripJats(input.abstract ?? "").slice(0, 900),
    journal,
    tier: input.tier ?? cls.tier,
    field: input.field ?? cls.field,
    interest: input.interest ?? null,
    lang: input.lang ?? (/[\p{Script=Han}]/u.test(title) ? "zh" : "en"),
    oa: Boolean(input.oa),
    authors: Array.isArray(input.authors) ? input.authors.filter(Boolean).slice(0, 8) : [],
    published: published > today ? today : published,
    cited: Number(input.cited ?? 0),
  };
}

function usable(work) {
  if (work.title.length < 12) return false;
  if (/^(untitled|editor letter|contents|table of contents|new issue)$/i.test(work.title)) return false;
  if (/\b(corrigendum|erratum|retraction note|editorial)\b/i.test(work.title)) return false;
  if (!work.published) return false;
  if (work.published < sinceDate(WINDOW_DAYS + 45)) return false;
  return true;
}

// —— 刊名 → ISSN：先用 Crossref 刊名录（不限量、免密钥），再退到 OpenAlex sources
// 解析成功或明确查无此刊才落缓存，网络失败不缓存，避免一次抖动把某刊永久拉黑
const ISSN_RE = /^\d{4}-\d{3}[\dXx]$/;

function sameName(candidate, target) {
  const normalized = normalizeText(candidate);
  return normalized === normalizeText(target);
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function issnFromCrossref(journalName) {
  const url = `https://api.crossref.org/journals?query=${encodeURIComponent(journalName)}&rows=5`;
  const data = await getJson(url, CROSSREF_OPTS);
  for (const item of data.message?.items ?? []) {
    const issns = (item.ISSN ?? []).filter((value) => ISSN_RE.test(value));
    const named = sameName(item["indexed-name"], journalName) || sameName(item.title, journalName);
    if (named && issns.length) return issns[0];
  }
  return null;
}

async function issnFromOpenAlex(journalName) {
  const url = `https://api.openalex.org/sources?search=${encodeURIComponent(journalName)}&per-page=10&select=id,display_name,issn,type`;
  const data = await getJson(url);
  const hit = (data.results ?? []).find(
    (row) => sameName(row.display_name, journalName) && (row.issn ?? []).some((value) => ISSN_RE.test(value)),
  );
  return hit ? hit.issn.find((value) => ISSN_RE.test(value)) : null;
}

export async function resolveIssn(journalName) {
  const cached = cachedIssn(journalName);
  if (cached) return cached.issn;
  let issn = null;
  let note = "";
  let definitive = false;
  try {
    issn = await issnFromCrossref(journalName);
    note = "crossref";
    definitive = true;
  } catch {
    note = "crossref 请求失败";
  }
  if (!issn) {
    try {
      issn = await issnFromOpenAlex(journalName);
      note = "openalex";
      definitive = true;
    } catch (error) {
      note = `解析失败 ${String(error?.message ?? error).slice(0, 40)}`;
    }
  }
  // 拿到 ISSN、或名录里确认查无此刊才落缓存；网络抖动不缓存，下次还会重试
  if (issn || definitive) rememberIssn(journalName, issn, note);
  return issn;
}

// —— Crossref：按 ISSN 逐刊取近期新稿，是「权威论文」的主干
export async function harvestCrossrefJournals({ days = WINDOW_DAYS } = {}) {
  const since = sinceDate(days);
  const journals = AUTHORITATIVE.filter((entry) => entry.tier <= 2);
  const status = { id: "crossref", label: "Crossref 权威刊", ok: false, note: "", count: 0 };
  const works = [];
  let failed = 0;

  // 新刊的 ISSN 解析一次只补一小批：名录扩充不该把这一轮刷新拖成几分钟，剩下的下轮接着补
  const uncached = journals.filter((entry) => !cachedIssn(entry.name));
  await pool(uncached.slice(0, ISSN_RESOLVE_PER_RUN), 4, (entry) => resolveIssn(entry.name));
  const ready = journals.filter((entry) => cachedIssn(entry.name)?.issn);
  const deferred = Math.max(0, uncached.length - ISSN_RESOLVE_PER_RUN);

  await pool(
    ready,
    4,
    async (entry) => {
      const issn = cachedIssn(entry.name).issn;
      const select = "DOI,title,container-title,created,issued,is-referenced-by-count,abstract,author,type,ISSN,link";
      const url =
        `https://api.crossref.org/journals/${issn}/works?filter=from-created-date:${since}` +
        `&rows=${CROSSREF_JOURNAL_ROWS}&sort=created&order=desc&select=${select}`;
      try {
        const data = await getJson(url, CROSSREF_OPTS);
        for (const item of data.message?.items ?? []) {
          works.push(
            baseWork({
              source: "crossref",
              url: item.URL ?? `https://doi.org/${item.DOI}`,
              doi: item.DOI,
              title: (item.title ?? [])[0],
              abstract: item.abstract ?? "",
              journal: (item["container-title"] ?? [])[0] ?? entry.name,
              field: entry.field,
              published: dateFromParts(item.created?.["date-parts"] ?? item.issued?.["date-parts"]),
              cited: item["is-referenced-by-count"] ?? 0,
              authors: (item.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(" ")),
              oa: Boolean(item.link?.[0]?.URL) || Boolean(item.license?.[0]?.URL),
            }),
          );
        }
        status.ok = true;
      } catch {
        failed += 1;
      }
      return null;
    },
  );

  status.count = works.length;
  status.note =
    `${ready.length}/${journals.length} 刊已解析 ISSN` +
    `${deferred ? ` · ${deferred} 本下轮补` : ""}` +
    `${failed ? ` · ${failed} 次请求失败` : ""}`;
  return { works: works.filter(usable), status };
}

// 索引的关键词匹配很松：顺带提到「human rights」的工程稿也会被捞回来，盖兴趣章前先在正文里验一遍
function mentionsTerm(text, term) {
  const flat = (value) =>
    String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const needle = flat(term);
  return needle.length > 2 && flat(text).includes(needle);
}

// —— Crossref 关键词检索：补足兴趣方向上新出现在顶刊之外的论文
export async function harvestCrossrefSearch({ interestIds } = {}) {
  const since = sinceDate(WINDOW_DAYS);
  const targets = INTERESTS.filter((entry) => !interestIds || interestIds.includes(entry.id));
  const works = [];
  let requests = 0;

  for (const interest of targets) {
    for (const term of interest.terms.slice(0, 2)) {
      const url =
        `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(term)}` +
        `&filter=from-created-date:${since},type:journal-article&rows=20&sort=created&order=desc` +
        `&select=DOI,title,container-title,created,is-referenced-by-count,abstract,author`;
      try {
        const data = await getJson(url, CROSSREF_OPTS);
        requests += 1;
        for (const item of data.message?.items ?? []) {
          const work = baseWork({
            source: "crossref-search",
            url: `https://doi.org/${item.DOI}`,
            doi: item.DOI,
            title: (item.title ?? [])[0],
            abstract: item.abstract ?? "",
            journal: (item["container-title"] ?? [])[0],
            published: dateFromParts(item.created?.["date-parts"]),
            cited: item["is-referenced-by-count"] ?? 0,
            authors: (item.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(" ")),
          });
          // 刊名在名录里时以名录归属为准，查不到归属才由检索词补一个兴趣
          if (mentionsTerm(`${work.title} ${work.abstract}`, term)) {
            work.interest = interest.id;
            work.field ??= interest.id;
          }
          // 关键词检索噪音大，只保留命中权威刊或自带摘要的结果
          if (usable(work) && (work.tier > 0 || work.abstract.length > 80)) works.push(work);
        }
      } catch {
        /* 限流即跳过，不阻塞其他通道 */
      }
      await wait(260);
    }
  }
  return { works, status: { id: "crossref-search", label: "Crossref 主题检索", ok: requests > 0, note: `${requests} 次查询`, count: works.length } };
}

// —— OpenAlex：补足摘要与开放获取标记（无 key 时按 IP 共享额度，请求数刻意压低）
export async function harvestOpenAlex({ interestIds } = {}) {
  const since = sinceDate(WINDOW_DAYS);
  const targets = INTERESTS.filter((entry) => !interestIds || interestIds.includes(entry.id));
  const works = [];
  let requests = 0;
  const select =
    "id,doi,title,display_name,publication_date,cited_by_count,language,open_access,primary_location,authorships,abstract_inverted_index,is_retracted";

  async function query(url, interestId) {
    try {
      const data = await getJson(url);
      requests += 1;
      for (const row of data.results ?? []) {
        if (row.is_retracted) continue;
        const work = baseWork({
          source: "openalex",
          interest: interestId ?? null,
          url: row.doi ?? row.id,
          doi: row.doi ? String(row.doi).replace(/^https:\/\/doi\.org\//, "") : null,
          title: row.title ?? row.display_name,
          abstract: abstractFromInverted(row.abstract_inverted_index),
          journal: row.primary_location?.source?.display_name,
          published: row.publication_date ?? "",
          cited: row.cited_by_count ?? 0,
          lang: row.language ?? "en",
          oa: Boolean(row.open_access?.is_oa),
          authors: (row.authorships ?? []).map((a) => a.author?.display_name),
        });
        if (usable(work) && (work.abstract.length > 60 || work.tier > 0)) works.push(work);
      }
    } catch {
      /* 额度耗尽时静默降级，Crossref 主干不受影响 */
    }
  }

  for (const interest of targets) {
    const term = interest.terms[0];
    await query(
      `https://api.openalex.org/works?search=${encodeURIComponent(term)}` +
        `&filter=from_publication_date:${since},type:article&sort=publication_date:desc` +
        `&per-page=40&select=${select}${OPENALEX_KEY ? `&api_key=${OPENALEX_KEY}` : ""}`,
      interest.id,
    );
    await wait(160);
  }
  await query(
    `https://api.openalex.org/works?filter=language:zh,type:article,from_publication_date:${since}` +
      `&sort=cited_by_count:desc&per-page=40&select=${select}${OPENALEX_KEY ? `&api_key=${OPENALEX_KEY}` : ""}`,
    null,
  );

  return {
    works,
    status: {
      id: "openalex",
      label: "OpenAlex",
      ok: requests > 0,
      note: `${requests} 次查询${OPENALEX_KEY ? " · 独立额度" : " · 共享额度"}`,
      count: works.length,
    },
  };
}

// —— Europe PMC：生医开放获取全文题录，摘要齐全
export async function harvestEuropePmc() {
  const works = [];
  const targets = INTERESTS.filter((entry) => entry.epmc);
  let ok = false;
  for (const interest of targets) {
    const url =
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
        `(${interest.epmc}) AND OPEN_ACCESS:Y`,
      )}&format=json&pageSize=25&resultType=core&sort=P_PDATE_D desc`;
    try {
      const data = await getJson(url);
      for (const row of data.resultList?.result ?? []) {
        const work = baseWork({
          source: "epmc",
          interest: interest.id,
          url: row.doi ? `https://doi.org/${row.doi}` : `https://europepmc.org/article/${row.source}/${row.id}`,
          doi: row.doi ?? null,
          title: row.title,
          abstract: row.abstractText ?? "",
          journal: row.journalInfo?.title,
          published: row.pubDate ?? String(row.pubYear ?? ""),
          cited: row.citedByCount ?? 0,
          oa: true,
          lang: row.language === "chi" ? "zh" : "en",
          authors: (row.authorList?.author ?? []).map((a) => a.fullName ?? a.name),
        });
        if (usable(work)) works.push(work);
      }
      ok = true;
    } catch {
      /* 单个主题失败不影响其余 */
    }
    await wait(140);
  }
  return {
    works,
    status: {
      id: "epmc",
      label: "Europe PMC 开放获取",
      ok,
      note: `${targets.length} 个医学主题`,
      count: works.length,
    },
  };
}

// —— arXiv：预印本是「最新研究」最快的一手通道
export async function harvestArxiv({ interestIds } = {}) {
  const targets = INTERESTS.filter(
    (entry) => entry.arxiv.length && (!interestIds || interestIds.includes(entry.id)),
  );
  const works = [];
  let ok = false;
  for (const interest of targets) {
    const cats = interest.arxiv.map((cat) => `cat:${cat}`).join("+OR+");
    const url =
      `https://export.arxiv.org/api/query?search_query=${cats}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=25`;
    try {
      const res = await request(url, { accept: "application/atom+xml" });
      const xml = parser.parse(await readText(res));
      const entries = [].concat(xml.feed?.entry ?? []);
      for (const entry of entries) {
        const link = typeof entry.link === "object" ? [].concat(entry.link)[0]?.["@_href"] : entry.link;
        const work = baseWork({
          source: "arxiv",
          interest: interest.id,
          url: entry.id ?? link,
          doi: entry["arxiv:doi"] ?? null,
          title: entry.title,
          abstract: entry.summary,
          journal: (entry["arxiv:primary_category"]?.["@_term"] ?? "")
            ? `arXiv:${entry["arxiv:primary_category"]["@_term"]}`
            : "arXiv",
          published: (entry.published ?? "").slice(0, 10),
          cited: 0,
          oa: true,
          authors: [].concat(entry.author ?? []).map((a) => a.name),
        });
        // 预印本权威度按 0 计，但保留学科归属，排序阶段靠新鲜度与兴趣匹配
        work.tier = 0;
        work.preprint = true;
        if (usable(work)) works.push(work);
      }
      ok = true;
    } catch {
      /* 该主题跳过 */
    }
    await wait(2200); // arXiv API 要求两次请求间隔 3 秒以上
  }
  return {
    works,
    status: { id: "arxiv", label: "arXiv 预印本", ok, note: `${targets.length} 个分类`, count: works.length },
  };
}

// —— DOAJ：开放获取期刊库，覆盖大量不在 Crossref 里的期刊
export async function harvestDoaj({ interestIds } = {}) {
  const now = new Date();
  const months = [
    { year: now.getUTCFullYear(), month: monthName(now.getUTCMonth()) },
    { year: now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(), month: monthName((now.getUTCMonth() + 11) % 12) },
  ];
  const targets = INTERESTS.filter((entry) => !interestIds || interestIds.includes(entry.id));
  const works = [];
  let ok = false;
  let queries = 0;
  for (const interest of targets) {
    for (const { year, month } of months) {
      // DOAJ 不支持按日期排序，只能用 bibjson.year + bibjson.month 把窗口切到当月
      const query = `"${interest.terms[0]}" AND bibjson.year:${year} AND bibjson.month:${month}`;
      const url = `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?pageSize=25`;
      try {
        const data = await getJson(url);
        ok = true;
        queries += 1;
        for (const row of data.results ?? []) {
          const bib = row.bibjson ?? {};
          const identifiers = [].concat(bib.identifier ?? []);
          const doi = identifiers.find((item) => item.type === "doi")?.id ?? null;
          const link = bib.url ?? (doi ? `https://doi.org/${doi}` : row.id);
          const work = baseWork({
            source: "doaj",
            interest: interest.id,
            url: link,
            doi,
            title: bib.title,
            abstract: bib.abstract ?? "",
            journal: bib.journal?.title,
            published: dateFromYearMonth(bib.year, bib.month),
            cited: 0,
            oa: true,
            lang: (bib.journal?.language ?? []).includes("ZH") || /[\p{Script=Han}]/u.test(bib.title ?? "") ? "zh" : "en",
            authors: [].concat(bib.author ?? []).map((a) => a.fullname ?? a.name),
          });
          if (usable(work)) works.push(work);
        }
      } catch {
        /* 跳过该主题 */
      }
      await wait(160);
    }
  }
  return {
    works,
    status: { id: "doaj", label: "DOAJ 开放获取", ok, note: `${queries} 次当月检索`, count: works.length },
  };
}

// —— ChinaXiv：中科院预印本平台，中文作者为主（站点只认浏览器 UA）
export async function harvestChinaXiv() {
  const works = [];
  let ok = false;
  try {
    const res = await request("https://www.chinaxiv.org/", { accept: "text/html", ua: BROWSER_UA });
    const html = decodeEntities(await readText(res));
    const anchors = [
      ...html.matchAll(/<a\b[^>]*?href\s*=\s*["'](\/abs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
    ];
    for (const [, href, raw] of anchors) {
      const text = raw
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const match = /^(20\d{2}-\d{2}-\d{2})\s+(?:V\d+\s+)?(?:最新\s+)?(.+?)$/.exec(text);
      if (!match) continue;
      const title = cleanTitle(match[2].replace(/\s*\[[^\]]*$/, ""));
      if (title.length < 14) continue;
      works.push(
        baseWork({
          source: "chinaxiv",
          url: `https://www.chinaxiv.org${href}`,
          title,
          journal: "ChinaXiv 预印本",
          published: match[1],
          cited: 0,
          oa: true,
          lang: /[\p{Script=Han}]/u.test(title) ? "zh" : "en",
        }),
      );
    }
    ok = true;
  } catch {
    /* 站点改版时静默跳过 */
  }
  const kept = works.filter(usable);
  return {
    works: kept,
    status: {
      id: "chinaxiv",
      label: "ChinaXiv 预印本",
      ok,
      note: ok ? `首页列表 ${works.length} 条，近 ${WINDOW_DAYS + 45} 天 ${kept.length} 条` : "站点不可达",
      count: kept.length,
    },
  };
}

// —— OSF 预印本：社会学 / 心理 / 教育 / 传播 / 方法论五个开放平台，列表里直接带摘要
const OSF_PROVIDERS = [
  { id: "socarxiv", interest: "social", journal: "SocArXiv 社会学预印本" },
  { id: "psyarxiv", interest: "mind", journal: "PsyArXiv 心理学预印本" },
  { id: "edarxiv", interest: "mind", journal: "EduArXiv 教育学预印本" },
  { id: "mediarxiv", interest: "social", journal: "MediaXiv 传播学预印本" },
  // MetaArXiv 是方法论/可复现研究，不属于任何一个兴趣栏，只在「全部」里出现
  { id: "metaarxiv", interest: null, journal: "MetaArXiv 方法论预印本" },
];

export async function harvestOsfPreprints({ rows = 20 } = {}) {
  const works = [];
  const alive = [];
  for (const provider of OSF_PROVIDERS) {
    const url =
      `https://api.osf.io/v2/preprint_providers/${provider.id}/preprints/` +
      `?sort=-date_created&page%5Bsize%5D=${rows}`;
    try {
      const data = await getJson(url);
      for (const item of data.data ?? []) {
        const attr = item.attributes ?? {};
        // 撤稿与非最新版不进推荐；预印本平台靠版本迭代，旧版会和新版同列表出现
        if (attr.date_withdrawn || attr.is_latest_version === false) continue;
        const work = baseWork({
          source: "osf",
          interest: provider.interest,
          field: provider.interest,
          url: item.links?.html ?? `https://osf.io/${item.id}`,
          doi: attr.doi,
          title: attr.title,
          abstract: attr.description ?? "",
          journal: provider.journal,
          published: String(attr.date_published ?? attr.date_created ?? "").slice(0, 10),
          cited: 0,
          oa: true,
        });
        if (usable(work)) works.push(work);
      }
      alive.push(provider.id);
    } catch {
      /* 单个平台挂了不影响其余 */
    }
    await wait(240);
  }
  return {
    works,
    status: {
      id: "osf",
      label: "OSF 社科预印本",
      ok: alive.length > 0,
      note: `${alive.length}/${OSF_PROVIDERS.length} 个平台在线`,
      count: works.length,
    },
  };
}

// —— HAL：法国社科人文开放仓库，补上非英语世界的法学 / 社会学 / 史学
const HAL_TERMS = [
  { q: "sociologie", interest: "social" },
  { q: "science politique", interest: "social" },
  { q: "droit", interest: "law" },
  { q: "migrations", interest: "social" },
  { q: "histoire coloniale", interest: "humanity" },
  { q: "anthropologie", interest: "humanity" },
];
const HAL_FIELDS = "title_s,abstract_s,producedDate_s,journalTitle_s,authFullName_s,lang_s,uri_s,doi_s";

export async function harvestHalShs({ rows = 20, days = WINDOW_DAYS } = {}) {
  const works = [];
  let queries = 0;
  for (const term of HAL_TERMS) {
    const url =
      `https://api.archives-ouvertes.fr/search/?q=${encodeURIComponent(`text:${term.q}`)}` +
      `&fq=docType_s:ART+AND+producedDate_tdate:[${sinceDate(days)}T00:00:00Z+TO+NOW]` +
      `&wt=json&rows=${rows}&sort=producedDate_tdate+desc&fl=${HAL_FIELDS}`;
    try {
      const data = await getJson(url);
      queries += 1;
      for (const row of data.response?.docs ?? []) {
        const title = Array.isArray(row.title_s) ? row.title_s[0] : row.title_s;
        const abstractRow = row.abstract_s;
        const work = baseWork({
          source: "hal",
          interest: term.interest,
          field: term.interest,
          url: row.uri_s ?? `https://hal.science/${row.docid}`,
          doi: Array.isArray(row.doi_s) ? row.doi_s[0] : row.doi_s,
          title,
          abstract: Array.isArray(abstractRow) ? abstractRow[0] : abstractRow,
          journal: Array.isArray(row.journalTitle_s) ? row.journalTitle_s[0] : row.journalTitle_s,
          published: String(row.producedDate_s ?? "").slice(0, 10),
          cited: 0,
          oa: true,
          lang: row.lang_s ?? (/[àâçéèêëîïôùûüœ«»]/i.test(String(title)) ? "fr" : "en"),
          authors: [].concat(row.authFullName_s ?? []),
        });
        if (usable(work)) works.push(work);
      }
    } catch {
      /* 单个词查不到就跳过 */
    }
    await wait(200);
  }
  return {
    works,
    status: {
      id: "hal",
      label: "HAL 社科人文库",
      ok: queries > 0,
      note: `${queries} 个法语主题检索`,
      count: works.length,
    },
  };
}

export const INDEXERS = ["crossref", "crossref-search", "openalex", "epmc", "arxiv", "doaj", "chinaxiv"];
