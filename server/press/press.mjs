import { hashKey } from "../text.mjs";
import { translateBatch } from "../translate.mjs";
import { INTERESTS } from "./journals.mjs";
import {
  harvestArxiv,
  harvestChinaXiv,
  harvestCrossrefJournals,
  harvestCrossrefSearch,
  harvestDoaj,
  harvestEuropePmc,
  harvestHalShs,
  harvestOpenAlex,
  harvestOsfPreprints,
} from "./collectors.mjs";
import {
  classifyChannelUrl,
  discoverFeed,
  fetchChannelItems,
  peekWechatArticle,
} from "./channels.mjs";
import {
  buildProfile,
  matchesInterest,
  rankArticles,
  rankRising,
  rankWorks,
} from "./rank.mjs";
import {
  deleteChannel,
  getChannel,
  getMeta,
  listChannels,
  listUntranslated,
  listWorks,
  markSignal,
  pruneOld,
  setMeta,
  setTranslation,
  touchChannel,
  upsertChannel,
  upsertWorks,
  workStats,
} from "./store.mjs";

const HARVEST_TTL_MS = 30 * 60 * 1000;
const PAYLOAD_TTL_MS = 8 * 60 * 1000;
const TRANSLATE_BUDGET_MS = 18000;
const PAPER_ROWS = 1600;
const ARTICLE_ROWS = 400;
const VISIBLE_PAPERS = 28;
const VISIBLE_ARTICLES = 16;
const WARM_TITLES = 100;
const WARM_COOLDOWN_MS = 4 * 60 * 1000;

// 采集器整体抛错时也要能报出是哪一路挂了
const COLLECTOR_IDS = new Map([
  [harvestCrossrefJournals, { id: "crossref", label: "Crossref 权威刊" }],
  [harvestOpenAlex, { id: "openalex", label: "OpenAlex" }],
  [harvestCrossrefSearch, { id: "crossref-search", label: "Crossref 主题检索" }],
  [harvestEuropePmc, { id: "epmc", label: "Europe PMC 开放获取" }],
  [harvestDoaj, { id: "doaj", label: "DOAJ 开放获取" }],
  [harvestArxiv, { id: "arxiv", label: "arXiv 预印本" }],
  [harvestChinaXiv, { id: "chinaxiv", label: "ChinaXiv 预印本" }],
  [harvestOsfPreprints, { id: "osf", label: "OSF 社科预印本" }],
  [harvestHalShs, { id: "hal", label: "HAL 社科人文库" }],
]);

const state = {
  harvestedAt: 0,
  harvestMs: 0,
  statuses: [],
  lastError: null,
  restored: false,
  payloads: new Map(),
  pending: new Map(),
  harvestTask: null,
  warming: false,
  warmAt: 0,
};

// 重启不该立刻重新打一遍所有索引：采集时间与状态落在库里
function restoreState() {
  if (state.restored) return;
  state.restored = true;
  state.harvestedAt = Number(getMeta("harvested_at")) || 0;
  state.harvestMs = Number(getMeta("harvest_ms")) || 0;
  try {
    const stored = JSON.parse(getMeta("harvest_statuses") ?? "[]");
    if (Array.isArray(stored)) state.statuses = stored;
  } catch {
    state.statuses = [];
  }
}

function normalizeArticle(item, channel) {
  const title = String(item.title ?? "").trim();
  if (!title) return null;
  return {
    key: item.key ?? `ch:${hashKey(item.url ?? title)}`,
    kind: "article",
    source: `channel:${channel.id}`,
    url: item.url ?? channel.url,
    doi: null,
    title,
    abstract: item.digest ?? "",
    journal: "",
    account: item.account ?? channel.label,
    tier: 0,
    field: null,
    interest: null,
    lang: item.lang ?? "zh",
    oa: false,
    authors: [],
    published: item.published ?? "",
    cited: 0,
  };
}

async function runChannels() {
  const channels = listChannels();
  let collected = 0;
  for (const channel of channels) {
    try {
      const items = await fetchChannelItems(channel);
      const works = items.map((item) => normalizeArticle(item, channel)).filter(Boolean);
      upsertWorks(works);
      collected += works.length;
      touchChannel(channel.id, { ok: true, note: works.length ? `取到 ${works.length} 篇` : "暂无新文章", items: works.length });
    } catch (error) {
      touchChannel(channel.id, {
        ok: false,
        note: String(error?.message ?? error).slice(0, 120),
        items: 0,
      });
    }
  }
  return { channels: channels.length, collected };
}

async function runHarvest() {
  const started = Date.now();
  // 科普通道与索引采集互不依赖，先把它们发出去
  const channelTask = runChannels();
  // 每个索引站内部各自限速，站与站之间并行；一次打一遍全部索引太慢，双批串行
  const batches = [
    [harvestCrossrefJournals, harvestOpenAlex, harvestDoaj],
    [harvestCrossrefSearch, harvestEuropePmc, harvestArxiv, harvestChinaXiv],
    [harvestOsfPreprints, harvestHalShs],
  ];
  const results = [];
  const statuses = [];
  for (const batch of batches) {
    const settled = await Promise.allSettled(batch.map((run) => run()));
    for (const [index, entry] of settled.entries()) {
      if (entry.status === "fulfilled") {
        results.push(entry.value);
        statuses.push(entry.value.status);
      } else {
        const meta = COLLECTOR_IDS.get(batch[index]) ?? { id: "unknown", label: "未知索引" };
        statuses.push({
          id: meta.id,
          label: meta.label,
          ok: false,
          note: String(entry.reason?.message ?? entry.reason).slice(0, 80),
          count: 0,
        });
      }
    }
  }
  const works = results.flatMap((entry) => entry.works);
  // 同一 DOI 可能被多个索引命中，入库前按 key 合并，保留信息最全的一条
  const merged = new Map();
  for (const work of works) {
    const previous = merged.get(work.key);
    if (!previous) merged.set(work.key, work);
    else {
      merged.set(work.key, {
        ...work,
        abstract: work.abstract.length > previous.abstract.length ? work.abstract : previous.abstract,
        tier: Math.max(work.tier, previous.tier),
        cited: Math.max(work.cited, previous.cited),
      });
    }
  }
  const stored = upsertWorks([...merged.values()]);
  const channelRun = await channelTask;
  const pruned = pruneOld();

  state.harvestedAt = Date.now();
  state.harvestMs = Date.now() - started;
  state.statuses = statuses;
  state.lastError = null;
  setMeta("harvested_at", state.harvestedAt);
  setMeta("harvest_ms", state.harvestMs);
  setMeta("harvest_statuses", JSON.stringify(statuses));
  return { stored, pruned, channels: channelRun, ms: state.harvestMs };
}

// 采集是全链路最慢的一段，绝不能挂在请求上：同一时刻只跑一轮，跑完让下一请求重建 payload
function scheduleHarvest({ force = false } = {}) {
  restoreState();
  if (state.harvestTask) return state.harvestTask;
  const fresh = Date.now() - state.harvestedAt < HARVEST_TTL_MS;
  if (fresh && !force) return null;
  const task = runHarvest()
    .then((result) => {
      // 新入库的稿子要立刻体现在下一次请求里
      state.payloads.clear();
      return result;
    })
    .catch((error) => {
      state.lastError = String(error?.message ?? error);
      return { stored: 0, pruned: 0, failed: true };
    })
    .finally(() => {
      state.harvestTask = null;
    });
  state.harvestTask = task;
  return task;
}

async function localise(works) {
  // 翻译是整条链路最慢的一环：首屏只等标题，摘要在后台补
  const foreign = works.filter((work) => work.lang !== "zh");
  const titleWorks = foreign.filter((work) => !work.titleZh).slice(0, 24);
  const abstractWorks = foreign
    .filter((work) => !work.abstractZh && work.abstract.length > 60)
    .slice(0, 8);

  if (!titleWorks.length && !abstractWorks.length) {
    return { translated: 0, abstracts: 0, pending: false };
  }

  // HAL 这类通道会带来法语稿，非英语的一律交给翻译层自己判语种，别按英语翻
  const fromOf = (work) => (work.lang && work.lang !== "en" ? "auto" : "en");

  const run = (targets, field, pick) => {
    const groups = new Map();
    for (const work of targets) {
      const list = groups.get(fromOf(work)) ?? [];
      list.push(pick(work));
      groups.set(fromOf(work), list);
    }
    return Promise.all(
      [...groups].map(([from, texts]) => translateBatch(texts, { concurrency: 3, from })),
    ).then((maps) => {
      const merged = new Map();
      for (const map of maps) {
        for (const [text, value] of map) merged.set(text, value);
      }
      let count = 0;
      for (const work of targets) {
        const text = merged.get(pick(work))?.text;
        if (!text) continue;
        work[field] = text;
        setTranslation(work.key, { [field]: text });
        count += 1;
      }
      return count;
    });
  };

  const titleRun = run(titleWorks, "titleZh", (work) => work.title);
  const abstractRun = run(abstractWorks, "abstractZh", (work) => work.abstract.slice(0, 400));

  const done = await Promise.race([titleRun, wait(TRANSLATE_BUDGET_MS).then(() => null)]);
  // 补译落库后作废已下发的载荷，下一次请求即拿到中文摘要
  Promise.all([titleRun, abstractRun])
    .then(() => state.payloads.clear())
    .catch((error) => {
      state.lastError = String(error?.message ?? error);
    });

  if (done === null) {
    return {
      translated: 0,
      abstracts: 0,
      pending: true,
      queued: titleWorks.length + abstractWorks.length,
    };
  }
  return { translated: done, abstracts: 0, pending: abstractWorks.length > 0 };
}

// 切兴趣等于换一批论文，临场翻译必然让首屏等十几秒。
// 所以后台按「权威档 → 被引 → 新鲜度」预先补译最可能上首屏的标题，落在库里跨重启复用。
function warmTranslations() {
  if (state.warming || Date.now() - state.warmAt < WARM_COOLDOWN_MS) return;
  state.warming = true;
  state.warmAt = Date.now();
  const rows = listUntranslated(WARM_TITLES);
  if (!rows.length) {
    state.warming = false;
    return;
  }
  const groups = new Map();
  for (const row of rows) {
    const from = row.lang && row.lang !== "en" ? "auto" : "en";
    const list = groups.get(from) ?? [];
    list.push(row);
    groups.set(from, list);
  }
  Promise.all(
    [...groups].map(([from, batch]) =>
      translateBatch(batch.map((row) => row.title), { concurrency: 4, from }).then((map) => [batch, map]),
    ),
  )
    .then((pairs) => {
      for (const [batch, map] of pairs) {
        for (const row of batch) {
          const text = map.get(row.title)?.text;
          if (!text) continue;
          setTranslation(row.key, { titleZh: text });
        }
      }
      state.payloads.clear();
    })
    .catch((error) => {
      state.lastError = String(error?.message ?? error);
    })
    .finally(() => {
      state.warming = false;
    });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function compose({ interest = null, force = false }) {
  const started = Date.now();
  const task = scheduleHarvest({ force });
  const counts = workStats();
  // 库里有存量就立刻出结果，采集放到后台继续跑；只有空库才必须等第一轮，否则首屏什么都没有
  const updating = Boolean(task) && counts.papers + counts.articles > 0;
  const harvestResult = task && !updating ? await task : { skipped: !task, stored: 0, pruned: 0 };
  warmTranslations();
  const profile = buildProfile();
  const paperRows = listWorks({ kind: "paper", limit: PAPER_ROWS });
  const articleRows = listWorks({ kind: "article", limit: ARTICLE_ROWS });
  const interestEntry = INTERESTS.find((entry) => entry.id === interest) ?? null;

  const papers = rankWorks(paperRows, { profile, interestId: interestEntry?.id, limit: VISIBLE_PAPERS });
  const rising = rankRising(paperRows, { profile, interestId: interestEntry?.id, limit: 10 });
  const articles = rankArticles(articleRows, { profile, interestId: interestEntry?.id, limit: VISIBLE_ARTICLES });

  const visible = new Map();
  for (const work of [...papers, ...rising, ...articles]) visible.set(work.key, work);
  const translation = await localise([...visible.values()]);

  const perInterest = INTERESTS.map((entry) => ({
    id: entry.id,
    label: entry.label,
    count: paperRows.filter((row) => matchesInterest(row, entry)).length,
  }));

  return {
    generatedAt: new Date().toISOString(),
    meta: {
      harvest: {
        at: state.harvestedAt ? new Date(state.harvestedAt).toISOString() : null,
        ms: state.harvestMs,
        skipped: Boolean(harvestResult.skipped),
        updating,
        stored: harvestResult.stored ?? 0,
        pruned: harvestResult.pruned ?? 0,
      },
      indexers: state.statuses,
      counts,
      interest: interestEntry ? { id: interestEntry.id, label: interestEntry.label } : null,
      interests: perInterest,
      profile: {
        signals: profile.signalCount,
        samples: profile.samples,
        topTerms: profile.topTerms,
      },
      translation,
      buildMs: Date.now() - started,
      lastError: state.lastError,
    },
    papers,
    rising,
    articles,
    channels: listChannels().map((channel) => ({
      id: channel.id,
      kind: channel.kind,
      label: channel.label,
      url: channel.url,
      ok: Boolean(channel.ok),
      note: channel.note,
      items: channel.items,
      lastRun: channel.last_run,
      addedAt: channel.added_at,
    })),
  };
}

export async function buildPress({ interest = null, force = false } = {}) {
  const key = interest ?? "all";
  const cached = state.payloads.get(key);
  if (!force && cached && Date.now() - cached.at < PAYLOAD_TTL_MS) return cached.payload;
  const pending = state.pending.get(key);
  if (pending) return pending;

  const task = compose({ interest, force })
    .then((payload) => {
      state.payloads.set(key, { payload, at: Date.now() });
      return payload;
    })
    .catch((error) => {
      state.lastError = String(error?.message ?? error);
      throw error;
    })
    .finally(() => {
      state.pending.delete(key);
    });
  state.pending.set(key, task);
  return task;
}

export async function addChannel(rawUrl, label) {
  state.payloads.clear();
  const classified = classifyChannelUrl(rawUrl);
  if (classified.error) return classified;
  const id = `ch-${hashKey(classified.url).slice(0, 10)}`;
  if (getChannel(id)) return { ok: true, id, note: "该链接已在订阅列表里" };

  if (classified.kind === "discover") {
    const feed = await discoverFeed(classified.url);
    if (!feed) return { error: "该站点没有发现可用的订阅源，试试直接粘贴它的 RSS 地址" };
    upsertChannel({
      id,
      kind: "rss",
      label: label || feed.siteTitle || new URL(classified.url).hostname,
      url: feed.feedUrl,
      config: { site: classified.url },
    });
    const items = await fetchChannelItems(getChannel(id));
    upsertWorks(items.map((item) => normalizeArticle(item, getChannel(id))).filter(Boolean));
    touchChannel(id, { ok: true, note: `自动发现订阅源，取到 ${items.length} 篇`, items: items.length });
    return { ok: true, id, feedUrl: feed.feedUrl };
  }

  let resolvedLabel = label ?? "";
  let note = "";
  if (classified.kind === "wechat-article") {
    const article = await peekWechatArticle(classified.url);
    if (article.error) return { error: article.error };
    note = "单篇文章：只收录这一篇，不会自动更新";
    resolvedLabel ||= article.account ?? "微信文章";
  } else if (classified.kind === "wechat-album") {
    note = "合集页：该合集每次更新都会自动进入订阅";
    resolvedLabel ||= "微信合集";
  }
  upsertChannel({
    id,
    kind: classified.kind,
    label: resolvedLabel || new URL(classified.url).hostname,
    url: classified.url,
    config: {},
    note,
  });
  const items = await fetchChannelItems(getChannel(id));
  upsertWorks(items.map((item) => normalizeArticle(item, getChannel(id))).filter(Boolean));
  touchChannel(id, { ok: true, note: note || `取到 ${items.length} 篇`, items: items.length });
  return { ok: true, id, items: items.length, note };
}

export function removeChannel(id) {
  state.payloads.clear();
  return deleteChannel(id);
}

export function signal(workKey, action) {
  // 行为信号直接改变个性化排序，缓存必须作废
  state.payloads.clear();
  return markSignal(workKey, action);
}

export function pressHealth() {
  return {
    harvestedAt: state.harvestedAt || null,
    statuses: state.statuses,
    lastError: state.lastError,
    channels: listChannels().length,
    counts: workStats(),
  };
}
