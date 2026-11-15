import { useEffect, useRef, useState } from "react";
import { FeedImage } from "../../components/FeedImage";
import { ArrowUpRightIcon, CloseIcon, FlameIcon } from "../../components/Icons";
import { translateSnippet } from "../../lib/api";
import { sourceSummary, timeAgo } from "../../lib/format";
import type { NewsItem } from "../../types";
import { REGION_LABELS } from "./regions";

interface Props {
  item: NewsItem;
  onClose: () => void;
}

export function ArticleSheet({ item, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [summary, setSummary] = useState(item.summary);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    setSummary(item.summary);
    const needsTranslation = item.sourceLang
      ? item.sourceLang !== "zh"
      : !/[\p{Script=Han}]/u.test(item.summary);
    if (!item.summary || !needsTranslation) {
      setTranslating(false);
      return;
    }
    const controller = new AbortController();
    setTranslating(true);
    const lang = item.sourceLang || "auto";
    translateSnippet(item.summary.slice(0, 460), lang, controller.signal)
      .then((data) => {
        if (data?.text) setSummary(data.text);
      })
      .catch(() => {})
      .finally(() => setTranslating(false));
    return () => controller.abort();
  }, [item]);

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

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <article
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="关闭">
          <CloseIcon width={18} height={18} />
        </button>

        <div className="sheet-scroll">
          <div className="sheet-media-wrap">
            <FeedImage
              className="sheet-media"
              src={item.image}
              accent={item.sources[0]?.accent}
              fallbackLabel={item.sources[0]?.shortName}
            />
            <div className="sheet-media-tags">
              <span className="tag tag-solid">{REGION_LABELS[item.region]}</span>
              <span className="tag tag-glass">
                <FlameIcon width={12} height={12} /> 热度 {item.heat}
              </span>
              {item.isBlueOcean ? <span className="tag tag-blue">蓝海</span> : null}
            </div>
          </div>

          <div className="sheet-body">
            <h2 className="sheet-title">{item.title}</h2>
            {item.titleOriginal ? (
              <div className="sheet-original">
                <span className="trans-badge">机器翻译</span>
                <p>{item.titleOriginal}</p>
              </div>
            ) : null}

            <div className="sheet-meta">
              <span className="sheet-sources">
                {item.sources.map((source) => (
                  <span key={source.id} className="source-pill">
                    <i style={{ background: source.accent }} />
                    {source.shortName}
                  </span>
                ))}
              </span>
              <span>{timeAgo(item.publishedAt)}</span>
            </div>

            {summary ? (
              <div className="sheet-summary-wrap">
                <p className="sheet-summary">{summary}</p>
                {translating ? <span className="summary-status">摘要翻译中…</span> : null}
              </div>
            ) : null}

            {item.related.length ? (
              <section className="sheet-related">
                <h3>跟进报道</h3>
                <ul>
                  {item.related.map((related) => (
                    <li key={related.link}>
                      <a href={related.link} target="_blank" rel="noreferrer noopener">
                        <span className="related-source">{related.sourceName}</span>
                        <span className="related-title">{related.title}</span>
                        <span className="related-time">{timeAgo(related.publishedAt)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="sheet-foot">
              <p className="sheet-foot-note">
                由 {sourceSummary(item.sources, 3)} 等 {item.sourceCount} 家媒体聚合 · 阅界仅做标题翻译与摘要
              </p>
              <a className="read-original" href={item.link} target="_blank" rel="noreferrer noopener">
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
