import { FeedImage } from "../../components/FeedImage";
import { timeAgo } from "../../lib/format";
import type { NewsItem } from "../../types";

interface Props {
  items: NewsItem[];
  now: number;
  onOpen: (item: NewsItem) => void;
}

export function SpotlightRail({ items, now, onOpen }: Props) {
  if (!items.length) return null;

  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2 className="section-title">焦点</h2>
          <p className="section-sub">跨源覆盖 × 时效，正在被多家媒体跟进</p>
        </div>
        <span className="section-index">02 — 06</span>
      </header>
      <div className="rail">
        {items.map((item, index) => (
          <article
            key={item.id}
            className="rail-card"
            onClick={() => onOpen(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(item);
              }
            }}
          >
            <div className="rail-media-wrap">
              <FeedImage
                className="rail-media"
                src={item.image}
                accent={item.sources[0]?.accent}
                fallbackLabel={item.sources[0]?.shortName}
              />
              <span className="rail-rank">#{index + 2}</span>
            </div>
            <h3 className="rail-title">{item.title}</h3>
            <div className="rail-meta">
              <span>{item.sources[0]?.shortName}</span>
              <span className="meta-dot" />
              <span>{timeAgo(item.publishedAt, now)}</span>
              {item.sourceCount > 1 ? <span className="rail-coverage">+{item.sourceCount - 1}</span> : null}
              {item.isBlueOcean ? <span className="mini-flag">蓝海</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
