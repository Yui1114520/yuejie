import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon, CloseIcon, RefreshIcon } from "../../components/Icons";
import { addPressChannel, fetchPress, isStaticSite, postPressSignal, removePressChannel } from "../../lib/api";
import type { PressChannelResult } from "../../lib/api";
import { formatClock, timeAgo } from "../../lib/format";
import type { PressPayload, PressWork } from "../../types";

const TIER_LABELS: Record<number, string> = {
  1: "顶刊",
  2: "学科旗舰",
  3: "稳定收录",
};

const KIND_LABELS: Record<string, string> = {
  rss: "网页订阅源",
  "wechat-album": "公众号合集",
  "wechat-article": "公众号文章",
};

function pickTitle(work: PressWork) {
  return work.titleZh || work.title;
}

function WorkRow({
  work,
  now,
  onOpen,
  onSave,
  onHide,
}: {
  work: PressWork;
  now: number;
  onOpen: (work: PressWork) => void;
  onSave: (work: PressWork) => void;
  onHide: (work: PressWork) => void;
}) {
  const origin = work.journal || work.account || "";
  return (
    <li className="press-item">
      <button type="button" className="feed-row" onClick={() => onOpen(work)}>
        <span className="feed-main">
          <span className="press-badges">
            {work.tier > 0 ? (
              <span className={`topic-tag tier-${work.tier}`}>{TIER_LABELS[work.tier]}</span>
            ) : (
              <span className="topic-tag tier-0">{work.kind === "paper" ? "论文" : "科普"}</span>
            )}
            {origin ? <span className="press-origin">{origin}</span> : null}
          </span>
          <span className="feed-title">{pickTitle(work)}</span>
          {work.titleZh ? <span className="press-original">{work.title}</span> : null}
          <span className="feed-meta">
            {work.reasons.slice(0, 2).map((reason) => (
              <span key={reason} className="press-reason">
                {reason}
              </span>
            ))}
            <span className="meta-dot" />
            <span>{timeAgo(work.published, now)}</span>
            {work.cited > 0 ? <span>· 已被引 {work.cited}</span> : null}
            {work.oa ? <span>· 开放获取</span> : null}
          </span>
        </span>
      </button>
      <div className="press-actions">
        <button
          type="button"
          className={`press-action ${work.saved ? "is-on" : ""}`}
          onClick={() => onSave(work)}
          aria-label={work.saved ? "取消收藏" : "收藏"}
        >
          {work.saved ? "已收藏" : "收藏"}
        </button>
        <button
          type="button"
          className="press-action"
          onClick={() => onHide(work)}
          aria-label="不感兴趣"
        >
          不感兴趣
        </button>
      </div>
    </li>
  );
}

function PressSheet({ work, onClose }: { work: PressWork; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const link = work.doi ? `https://doi.org/${work.doi}` : work.url;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <article
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={pickTitle(work)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="关闭">
          <CloseIcon width={18} height={18} />
        </button>

        <div className="sheet-scroll">
          <div className="sheet-body">
            <div className="press-badges">
              {work.tier > 0 ? (
                <span className={`topic-tag tier-${work.tier}`}>{TIER_LABELS[work.tier]}</span>
              ) : null}
              {work.journal ? <span className="topic-tag tier-0">{work.journal}</span> : null}
              {work.account ? <span className="topic-tag tier-0">{work.account}</span> : null}
            </div>
            <h2 className="sheet-title">{pickTitle(work)}</h2>
            {work.titleZh ? (
              <div className="sheet-original">
                <span className="trans-badge">机器翻译</span>
                <p>{work.title}</p>
              </div>
            ) : null}

            <div className="sheet-meta">
              <span>{work.published}</span>
              {work.cited > 0 ? <span>已被引 {work.cited} 次</span> : null}
              {work.oa ? <span>开放获取</span> : null}
            </div>

            {work.authors ? <p className="press-authors">{work.authors}</p> : null}

            {work.abstractZh || work.abstract ? (
              <div className="sheet-summary-wrap">
                {work.abstractZh ? <p className="sheet-summary">{work.abstractZh}</p> : null}
                {work.abstract ? (
                  <p className={`press-abstract ${work.abstractZh ? "is-second" : ""}`}>
                    {work.abstract}
                  </p>
                ) : null}
                {!work.abstractZh ? <span className="summary-status">摘要翻译中，稍后回来可见</span> : null}
              </div>
            ) : (
              <p className="press-abstract">该索引未提供摘要，点开原文可阅读全文。</p>
            )}

            {work.reasons.length ? (
              <section className="sheet-related">
                <h3>为什么推给你</h3>
                <ul className="press-reason-list">
                  {work.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="sheet-foot">
              <p className="sheet-foot-note">
                数据来自 {work.source.replace(/^channel:.*$/, "你订阅的科普通道")} · 阅界只保存标题与摘要，全文回到原刊阅读
              </p>
              <a className="read-original" href={link} target="_blank" rel="noreferrer noopener">
                阅读原文
                <ArrowUpRightIcon width={16} height={16} />
              </a>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export function PressPage() {
  const [interest, setInterest] = useState<string | null>(null);
  const [payload, setPayload] = useState<PressPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PressWork | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [channelUrl, setChannelUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(
    async (target: string | null, mode: "initial" | "manual" | "quiet") => {
      if (mode === "manual") setRefreshing(true);
      try {
        const data = await fetchPress({ interest: target, refresh: mode === "manual" });
        setPayload(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "报刊数据获取失败";
        setError(message);
      } finally {
        if (mode === "manual") {
          setRefreshing(false);
          showToast("已重新检索索引");
        }
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void load(interest, "initial");
  }, [interest, load]);

  // 后台补译会在写库后清掉服务端缓存，稍后再取一次即可拿到中文标题
  useEffect(() => {
    if (!payload?.meta.translation?.pending) return;
    const timer = window.setTimeout(() => void load(interest, "quiet"), 45_000);
    return () => window.clearTimeout(timer);
  }, [payload, interest, load]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(tick);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const signal = useCallback(
    async (work: PressWork, action: "open" | "save" | "unsave" | "hide") => {
      try {
        await postPressSignal(work.key, action);
      } catch {
        showToast("操作未同步，本地仍生效");
      }
      setPayload((prev) => {
        if (!prev) return prev;
        const patch = (item: PressWork): PressWork => {
          if (item.key !== work.key) return item;
          if (action === "save") return { ...item, saved: true };
          if (action === "unsave") return { ...item, saved: false };
          if (action === "open") return { ...item, viewed: true };
          return item;
        };
        const mapList = (list: PressWork[]) => list.map(patch);
        return action === "hide"
          ? {
              ...prev,
              papers: mapList(prev.papers).filter((item) => item.key !== work.key),
              rising: mapList(prev.rising).filter((item) => item.key !== work.key),
              articles: mapList(prev.articles).filter((item) => item.key !== work.key),
            }
          : {
              ...prev,
              papers: mapList(prev.papers),
              rising: mapList(prev.rising),
              articles: mapList(prev.articles),
            };
      });
      if (action === "hide") {
        showToast("已屏蔽，稍后的排序会更接近你的偏好");
        window.setTimeout(() => void load(interest, "quiet"), 1200);
      }
    },
    [interest, load, showToast],
  );

  const openWork = useCallback(
    (work: PressWork) => {
      setSelected(work);
      if (!work.viewed) void signal(work, "open");
    },
    [signal],
  );

  const submitChannel = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const url = channelUrl.trim();
      if (!url) return;
      setAdding(true);
      const result: PressChannelResult = await addPressChannel(url).catch((err) => ({
        error: err instanceof Error ? err.message : "订阅失败",
      }));
      setAdding(false);
      if (result.error) {
        showToast(result.error);
        return;
      }
      setChannelUrl("");
      showToast(result.feedUrl ? `已自动发现订阅源：${result.feedUrl}` : (result.note ?? "已加入订阅"));
      void load(interest, "quiet");
    },
    [channelUrl, interest, load, showToast],
  );

  const dropChannel = useCallback(
    async (id: string) => {
      await removePressChannel(id).catch(() => null);
      showToast("已取消订阅");
      void load(interest, "quiet");
    },
    [interest, load, showToast],
  );

  if (loading && !payload) {
    return (
      <div className="page press-page">
        <PressHeader refreshing={false} onRefresh={() => void load(interest, "manual")} />
        <p className="press-loading">首次检索开放索引需要几十秒，正在为你取论文…</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="page press-page">
        <PressHeader refreshing={false} onRefresh={() => void load(interest, "initial")} />
        <div className="state-block">
          <span className="state-code">502</span>
          <h2>报刊索引暂时不可达</h2>
          <p>{error}</p>
          <button type="button" className="primary-btn" onClick={() => void load(interest, "initial")}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!payload) return null;

  const meta = payload.meta;
  const online = meta.indexers.filter((entry) => entry.ok).length;

  return (
    <div className="page press-page">
      <PressHeader refreshing={refreshing} onRefresh={() => void load(interest, "manual")} />

      <div className="date-bar">
        <span>
          {meta.counts.papers} 篇论文 · {meta.counts.articles} 篇科普
        </span>
        <span className="meta-dot" />
        <span>
          {online}/{meta.indexers.length} 个索引在线
        </span>
        <span className="meta-dot" />
        <span>更新于 {formatClock(payload.generatedAt)}</span>
      </div>

      <div className="module-chips" role="tablist" aria-label="研究兴趣">
        <button
          type="button"
          role="tab"
          aria-selected={interest === null}
          className={`module-chip ${interest === null ? "is-active" : ""}`}
          onClick={() => setInterest(null)}
        >
          全部
        </button>
        {meta.interests.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={interest === entry.id}
            className={`module-chip ${interest === entry.id ? "is-active" : ""}`}
            onClick={() => setInterest(entry.id)}
          >
            {entry.label}
            <span className="chip-count">{entry.count}</span>
          </button>
        ))}
      </div>

      <div className="press-body">
        <p className="press-profile">
          {meta.profile.signals > 0
            ? `已按你 ${meta.profile.signals} 次阅读/收藏/屏蔽记录排序`
            : "排序依据：期刊权威度 · 新发时间 · 引用速度 · 开放获取；读得越多推得越准"}
          {meta.profile.topTerms.length
            ? ` · 你的高频词：${meta.profile.topTerms.slice(0, 5).map((t) => t.term).join(" ")}`
            : ""}
        </p>

        {meta.translation?.pending ? (
          <p className="press-note">部分标题正在后台翻译成中文，稍后自动补齐。</p>
        ) : null}
        {meta.lastError ? <p className="press-note is-warn">上轮采集提示：{meta.lastError}</p> : null}

      <section className="section">
        <header className="section-head">
          <div>
            <h2 className="section-title">论文速递</h2>
            <p className="section-sub">Crossref / OpenAlex / DOAJ / Europe PMC / arXiv / ChinaXiv 三周内的新论文</p>
          </div>
          <span className="section-index">{payload.papers.length} 篇</span>
        </header>
        <ul className="feed-list press-list">
          {payload.papers.map((work) => (
            <WorkRow
              key={work.key}
              work={work}
              now={now}
              onOpen={openWork}
              onSave={(item) => void signal(item, item.saved ? "unsave" : "save")}
              onHide={(item) => void signal(item, "hide")}
            />
          ))}
        </ul>
        {!payload.papers.length ? <p className="feed-more">这个兴趣方向暂时没有新论文</p> : null}
      </section>

      {payload.rising.length ? (
        <section className="section">
          <header className="section-head">
            <div>
              <h2 className="section-title">高关注</h2>
              <p className="section-sub">按每天新增引用数排序，不看绝对值</p>
            </div>
            <span className="section-index">{payload.rising.length} 篇</span>
          </header>
          <ul className="feed-list press-list">
            {payload.rising.map((work) => (
              <WorkRow
                key={work.key}
                work={work}
                now={now}
                onOpen={openWork}
                onSave={(item) => void signal(item, item.saved ? "unsave" : "save")}
                onHide={(item) => void signal(item, "hide")}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="section">
        <header className="section-head">
          <div>
            <h2 className="section-title">科普精选</h2>
            <p className="section-sub">来自你订阅的杂志通道 · 只存标题与摘要，全文回原站</p>
          </div>
          <span className="section-index">{payload.articles.length} 篇</span>
        </header>
        <ul className="feed-list press-list">
          {payload.articles.map((work) => (
            <WorkRow
              key={work.key}
              work={work}
              now={now}
              onOpen={openWork}
              onSave={(item) => void signal(item, item.saved ? "unsave" : "save")}
              onHide={(item) => void signal(item, "hide")}
            />
          ))}
        </ul>
        {!payload.articles.length ? <p className="feed-more">还没有科普通道，先在下面贴一个链接</p> : null}
      </section>

      <section className="section press-channels">
        <header className="section-head">
          <div>
            <h2 className="section-title">科普通道</h2>
            <p className="section-sub">
              贴杂志官网即可：自动发现 RSS；贴公众号文章或合集链接也能订阅，不需要任何付费接口
            </p>
          </div>
          <span className="section-index">{payload.channels.length} 个</span>
        </header>

        {isStaticSite ? (
          <p className="press-note">
            快照版不带个人订阅列表，也不在这里改订阅；科普文章本身照常每天更新。
          </p>
        ) : (
          <>
            <form className="press-channel-form" onSubmit={submitChannel}>
              <input
                value={channelUrl}
                onChange={(event) => setChannelUrl(event.target.value)}
                placeholder="https://nautil.us/ 或 公众号合集链接"
                aria-label="要订阅的站点或公众号链接"
              />
              <button type="submit" className="primary-btn" disabled={adding || !channelUrl.trim()}>
                {adding ? "识别中…" : "订阅"}
              </button>
            </form>

            <ul className="press-channel-list">
              {payload.channels.map((channel) => (
                <li key={channel.id}>
                  <span className="press-channel-main">
                    <b>{channel.label}</b>
                    <span className="feed-meta">
                      <span className="topic-tag tier-0">{KIND_LABELS[channel.kind] ?? channel.kind}</span>
                      <span>{channel.ok ? `${channel.items} 篇` : "上轮失败"}</span>
                      <span className="meta-dot" />
                      <span>{channel.note}</span>
                    </span>
                  </span>
                  <button type="button" className="press-action" onClick={() => void dropChannel(channel.id)}>
                    退订
                  </button>
                </li>
              ))}
            </ul>
            {!payload.channels.length ? <p className="feed-more">还没有通道，先贴一个链接试试</p> : null}
          </>
        )}
      </section>

      <section className="section press-indexers">
        <header className="section-head">
          <div>
            <h2 className="section-title">索引状态</h2>
            <p className="section-sub">
              全部为公开无密钥接口 · 上轮采集 {Math.round(meta.harvest.ms / 1000)} 秒
            </p>
          </div>
        </header>
        <ul className="press-index-list">
          {meta.indexers.map((entry) => (
            <li key={entry.id}>
              <span className={entry.ok ? "dot dot-ok" : "dot dot-bad"} />
              <b>{entry.label}</b>
              <span>{entry.count ?? 0} 篇</span>
              {entry.note ? <em>{entry.note}</em> : null}
            </li>
          ))}
        </ul>
      </section>
      </div>

      {selected ? <PressSheet work={selected} onClose={() => setSelected(null)} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function PressHeader({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  return (
    <header className="topbar" id="top">
      <div className="brand">
        <span className="brand-mark">报</span>
        <div className="brand-text">
          <h1>报刊</h1>
          <p>PAPERS &amp; SCIENCE WRITING</p>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="live-pill">
          <i />
          免费公开索引
        </span>
        <button
          type="button"
          className={`refresh-btn ${refreshing ? "is-spinning" : ""}`}
          onClick={onRefresh}
          aria-label="重新检索索引"
          disabled={refreshing}
        >
          <RefreshIcon width={18} height={18} />
        </button>
      </div>
    </header>
  );
}
