import { FeedImage } from "../../components/FeedImage";
import { FlameIcon } from "../../components/Icons";
import { sourceSummary, timeAgo } from "../../lib/format";
import type { NewsItem } from "../../types";
import { REGION_LABELS } from "./regions";

interface Props {
  item: NewsItem;
  now: number;
  onOpen: (item: NewsItem) => void;
}

export function HeroCard({ item, now, onOpen }: Props) {
  const leadSource = item.sources[0];

  return (
    <article className="hero" onClick={() => onOpen(item)} role="button" tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      <FeedImage
        className="hero-media"
        src={item.image}
        alt=""
        accent={leadSource?.accent}
        fallbackLabel={leadSource?.shortName}
        priority
      />
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-body">
        <div className="hero-tags">
          <span className="tag tag-solid">头条</span>
          <span className="tag tag-ghost">{REGION_LABELS[item.region]}</span>
          {item.isBlueOcean ? <span className="tag tag-blue">蓝海</span> : null}
          <span className="hero-heat">
            <FlameIcon width={13} height={13} />
            {item.heat}
          </span>
        </div>
        <h2 className="hero-title">{item.title}</h2>
        {item.titleOriginal ? <p className="hero-original">{item.titleOriginal}</p> : null}
        <div className="hero-meta">
          <span className="source-stack" aria-hidden="true">
            {item.sources.slice(0, 3).map((source) => (
              <i key={source.id} style={{ background: source.accent }} />
            ))}
          </span>
          <span>{sourceSummary(item.sources, 2)}</span>
          <span className="meta-dot" />
          <span>{item.sourceCount > 1 ? `${item.sourceCount} 家媒体跟进` : "独家"}</span>
          <span className="meta-dot" />
          <span>{timeAgo(item.publishedAt, now)}</span>
        </div>
      </div>
    </article>
  );
}
