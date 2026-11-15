import { timeAgo } from "../../lib/format";
import type { NewsItem } from "../../types";

interface Props {
  items: NewsItem[];
  now: number;
  onOpen: (item: NewsItem) => void;
}

export function MovementBoard({ items, now, onOpen }: Props) {
  if (!items.length) return null;

  return (
    <section className="section movement-board">
      <header className="section-head">
        <div>
          <h2 className="section-title">社会运动</h2>
          <p className="section-sub">罢工 · 游行 · 土地与民族解放 · 议会斗争</p>
        </div>
        <span className="section-index">{items.length} 条</span>
      </header>
      <ul className="feed-list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="feed-row" onClick={() => onOpen(item)}>
              <span className="movement-rail" aria-hidden="true" />
              <span className="feed-main">
                <span className="feed-title">{item.title}</span>
                <span className="feed-meta">
                  <span className="movement-tag">左翼 / 社会运动</span>
                  <span>{item.sources[0]?.shortName}</span>
                  {item.sourceCount > 1 ? (
                    <span className="heat-coverage">{item.sourceCount} 源</span>
                  ) : null}
                  <span className="meta-dot" />
                  <span>{timeAgo(item.publishedAt, now)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
