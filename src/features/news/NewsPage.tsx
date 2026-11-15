import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRightIcon, RefreshIcon } from "../../components/Icons";
import { fetchNews } from "../../lib/api";
import { formatClock, formatDateLabel } from "../../lib/format";
import type { ModuleId, NewsItem, NewsPayload, Person, RegionId } from "../../types";
import { ArticleSheet } from "./ArticleSheet";
import { DomesticBoard } from "./DomesticBoard";
import { FrontReports } from "./FrontReports";
import { HeatList } from "./HeatList";
import { HeroCard } from "./HeroCard";
import { MarketBoard } from "./MarketBoard";
import { MovementBoard } from "./MovementBoard";
import { NewsSkeleton } from "./NewsSkeleton";
import { PeopleRail } from "./PeopleRail";
import { PersonSheet } from "./PersonSheet";
import { RegionFeed } from "./RegionFeed";
import { ScienceBoard } from "./ScienceBoard";
import { SpotlightRail } from "./SpotlightRail";
import { WarMap } from "./WarMap";

const MODULES: { id: ModuleId; label: string }[] = [
  { id: "world", label: "国际" },
  { id: "domestic", label: "国内" },
  { id: "economy", label: "经贸" },
  { id: "science", label: "科研" },
  { id: "military", label: "军事" },
];

export function NewsPage() {
  const [moduleId, setModuleId] = useState<ModuleId>("world");
  const [payloads, setPayloads] = useState<Partial<Record<ModuleId, NewsPayload>>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [region, setRegion] = useState<RegionId>("global");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [feedRound, setFeedRound] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);

  const payload = payloads[moduleId] ?? null;
  const payloadRef = useRef<NewsPayload | null>(null);
  const payloadsRef = useRef<Partial<Record<ModuleId, NewsPayload>>>({});
  const moduleRef = useRef<ModuleId>("world");
  const inFlight = useRef<Set<ModuleId>>(new Set());
  const toastTimer = useRef<number | null>(null);

  payloadRef.current = payload;
  payloadsRef.current = payloads;
  moduleRef.current = moduleId;

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(
    async (mode: "initial" | "manual" | "auto", target: ModuleId) => {
      if (inFlight.current.has(target)) return;
      inFlight.current.add(target);
      if (mode === "manual") setRefreshing(true);
      if (mode === "initial") setLoading(true);
      try {
        const data = await fetchNews({ module: target, refresh: mode !== "initial" });
        setPayloads((prev) =>
          mode === "manual"
            ? ({ [target]: data } as Partial<Record<ModuleId, NewsPayload>>)
            : { ...prev, [target]: data },
        );
        setError(null);
        if (mode === "manual") {
          setFeedRound((round) => round + 1);
          setZoneId(null);
          showToast("已刷新 · 实时动态已重置");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取新闻失败";
        if (!payloadsRef.current[target]) setError(message);
        else showToast("刷新失败，已保留当前内容");
      } finally {
        inFlight.current.delete(target);
        setRefreshing(false);
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void load("initial", "world");
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const refresh = window.setInterval(
      () => void load("auto", moduleRef.current),
      10 * 60_000,
    );
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [load]);

  const selectModule = useCallback(
    (id: ModuleId) => {
      setModuleId(id);
      setRegion("global");
      setZoneId(null);
      if (!payloadsRef.current[id]) {
        setError(null);
        void load("initial", id);
      }
    },
    [load],
  );

  const feedItems = useMemo(() => {
    if (!payload) return [];
    const sorted = [...payload.latest].sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    );
    const scoped = region === "global" ? sorted : sorted.filter((item) => item.region === region);
    if (scoped.length <= 1) return scoped;
    const offset = (feedRound * 5) % scoped.length;
    return offset ? [...scoped.slice(offset), ...scoped.slice(0, offset)] : scoped;
  }, [payload, region, feedRound]);

  const openArticleById = useCallback((articleId: string) => {
    const item = payloadRef.current?.all.find((article) => article.id === articleId);
    if (!item) return;
    setPerson(null);
    setSelected(item);
  }, []);

  const dateLabel = formatDateLabel(new Date(now));
  const moduleLabel =
    payload?.moduleLabel ?? MODULES.find((module) => module.id === moduleId)?.label ?? "国际";

  if (loading && !payload) {
    return (
      <>
        <TopBar
          refreshing={false}
          label={moduleLabel}
          onRefresh={() => void load("manual", moduleId)}
        />
        <NewsSkeleton />
      </>
    );
  }

  if (error && !payload) {
    return (
      <>
        <TopBar
          refreshing={false}
          label={moduleLabel}
          onRefresh={() => void load("initial", moduleId)}
        />
        <div className="state-block">
          <span className="state-code">503</span>
          <h2>新闻源暂时不可达</h2>
          <p>{error}</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void load("initial", moduleId)}
          >
            重新加载
          </button>
        </div>
      </>
    );
  }

  if (!payload) return null;

  const hasSituation = Boolean(payload.situation?.zones.some((zone) => zone.count > 0));
  const hasDomestic = Boolean(
    payload.documents?.length || payload.provinces?.some((province) => province.count > 0),
  );

  if (!payload.hero && !hasSituation && !hasDomestic) {
    return (
      <>
        <TopBar
          refreshing={refreshing}
          label={moduleLabel}
          onRefresh={() => void load("manual", moduleId)}
        />
        <div className="state-block">
          <span className="state-code">···</span>
          <h2>暂时没有新的{moduleLabel}新闻</h2>
          <p>该模块当前没有通过编辑筛选的内容，稍后刷新或切换到其他模块。</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void load("manual", moduleId)}
          >
            重新加载
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        refreshing={refreshing}
        label={moduleLabel}
        onRefresh={() => void load("manual", moduleId)}
      />
      <div className="date-bar">
        <span>{dateLabel}</span>
        <span className="meta-dot" />
        <span>
          {payload.meta.onlineSources}/{payload.meta.totalSources} 源在线
        </span>
        <span className="meta-dot" />
        <span>更新于 {formatClock(payload.generatedAt)}</span>
      </div>

      <div className="module-chips" role="tablist" aria-label="新闻模块">
        {MODULES.map((module) => {
          const active = module.id === moduleId;
          const count = payloads[module.id]?.all.length;
          return (
            <button
              key={module.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`module-chip ${active ? "is-active" : ""}`}
              onClick={() => selectModule(module.id)}
            >
              {module.label}
              {typeof count === "number" ? <span className="chip-count">{count}</span> : null}
            </button>
          );
        })}
        <span className="module-spacer" />
        <span className="lede">
          {payload.meta.totalArticles} 条报道 · {payload.meta.clusters} 组事件
        </span>
      </div>

      <div className="news-body">
        {payload.hero ? (
          <HeroCard item={payload.hero} now={now} onOpen={setSelected} />
        ) : null}

        {moduleId === "science" ? (
          <ScienceBoard
            items={payload.all.filter((item) => item.id !== payload.hero?.id)}
            now={now}
            onOpen={setSelected}
          />
        ) : (
          <>
            {moduleId === "domestic" ? (
              <DomesticBoard
                documents={payload.documents ?? []}
                provinces={payload.provinces ?? []}
                items={payload.all}
                now={now}
                onOpen={setSelected}
              />
            ) : null}

            {moduleId === "economy" ? <MarketBoard /> : null}

            {moduleId === "military" && payload.situation && hasSituation ? (
              <>
                <WarMap
                  zones={payload.situation.zones}
                  active={zoneId}
                  updatedAt={payload.situation.updatedAt}
                  onSelect={setZoneId}
                />
                <FrontReports
                  zones={payload.situation.zones}
                  active={zoneId}
                  reportsTotal={payload.situation.reportsTotal}
                  now={now}
                  onOpen={setSelected}
                />
              </>
            ) : null}

            {moduleId === "military" ? (
              <MovementBoard items={payload.movements ?? []} now={now} onOpen={setSelected} />
            ) : null}

            <SpotlightRail items={payload.spotlight} now={now} onOpen={setSelected} />

            <HeatList
              items={payload.ranking}
              startRank={6}
              now={now}
              onOpen={setSelected}
            />

            {moduleId === "world" && payload.people.length ? (
              <PeopleRail people={payload.people} onOpen={setPerson} />
            ) : null}

            {moduleId !== "domestic" && payload.latest.length ? (
              <RegionFeed
                items={feedItems}
                regions={payload.regions}
                activeRegion={region}
                round={feedRound}
                onRegionChange={setRegion}
                now={now}
                onOpen={setSelected}
              />
            ) : null}
          </>
        )}

        <section className="section sources-panel">
          <header className="section-head">
            <div>
              <h2 className="section-title">数据来源</h2>
              <p className="section-sub">
                RSS 聚合 · 全站已过滤 {payload.meta.filtered?.total ?? 0} 条非硬新闻
              </p>
            </div>
            <span className="section-index">{payload.meta.onlineSources} ONLINE</span>
          </header>
          <ul className="source-list">
            {payload.meta.sources.map((source) => (
              <li key={source.id}>
                <span className={`status-dot ${source.ok ? "is-on" : "is-off"}`} />
                <span className="source-name">{source.name}</span>
                <span className="source-latency">
                  {source.ok ? `${source.latencyMs} ms` : source.error ?? "离线"}
                </span>
              </li>
            ))}
          </ul>
          {payload.meta.relay && !payload.meta.relay.configured && payload.meta.relay.pending.length ? (
            <p className="relay-note">
              海外源 {payload.meta.relay.pending.length} 个待接入 · 配置 VPS 中转后自动启用（
              {payload.meta.relay.pending.map((source) => source.shortName).join("、")}）
            </p>
          ) : null}
          <div className="filter-summary">
            <span>硬新闻 {payload.meta.totalArticles} 条</span>
            <span>观点 {payload.meta.filtered?.opinion ?? 0}</span>
            <span>软新闻 {payload.meta.filtered?.soft ?? 0}</span>
            <span>治安犯罪 {payload.meta.filtered?.crime ?? 0}</span>
            <span>无关 {payload.meta.filtered?.other ?? 0}</span>
            {payload.meta.push ? (
              <span>
                推送候选 {payload.meta.push.candidates} · 48h 去重 {payload.meta.push.suppressed}
              </span>
            ) : null}
          </div>
          <a
            className="source-more"
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              event.currentTarget
                .closest(".screen")
                ?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            构建耗时 {payload.meta.buildMs} ms · 回到顶部
            <ArrowUpRightIcon width={14} height={14} />
          </a>
        </section>
      </div>

      {selected ? <ArticleSheet item={selected} onClose={() => setSelected(null)} /> : null}
      {person ? (
        <PersonSheet
          person={person}
          onClose={() => setPerson(null)}
          onOpenArticle={openArticleById}
        />
      ) : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}

function TopBar({
  refreshing,
  label,
  onRefresh,
}: {
  refreshing: boolean;
  label: string;
  onRefresh: () => void;
}) {
  return (
    <header className="topbar" id="top">
      <div className="brand">
        <span className="brand-mark">阅</span>
        <div className="brand-text">
          <h1>阅界</h1>
          <p>READ THE WORLD</p>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="live-pill">
          <i />
          {label}
        </span>
        <button
          type="button"
          className={`refresh-btn ${refreshing ? "is-spinning" : ""}`}
          onClick={onRefresh}
          aria-label="刷新新闻"
          disabled={refreshing}
        >
          <RefreshIcon width={18} height={18} />
        </button>
      </div>
    </header>
  );
}
