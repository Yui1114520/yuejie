import { FlameIcon } from "../../components/Icons";
import { timeAgo } from "../../lib/format";
import type { NewsItem } from "../../types";
import { REGION_LABELS } from "./regions";

interface Props {
  items: NewsItem[];
  startRank: number;
  now: number;
  onOpen: (item: NewsItem) => void;
}

export function HeatList({ items, startRank, now, onOpen }: Props) {
  if (!items.length) return null;

  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2 className="section-title">热度榜</h2>
          <p className="section-sub">跨源覆盖 · 时效衰减 · 蓝海加权综合排序</p>
        </div>
        <span className="section-index">LIVE</span>
      </header>
      <ol className="heat-list">
        {items.map((item, index) => (
          <li key={item.id}>
            <button type="button" className="heat-row" onClick={() => onOpen(item)}>
              <span className={`heat-rank ${index === 0 ? "is-top" : ""}`}>
                {String(startRank + index).padStart(2, "0")}
              </span>
              <span className="heat-main">
                <span className="heat-title">{item.title}</span>
                <span className="heat-meta">
                  <span className="heat-region">{REGION_LABELS[item.region]}</span>
                  <span>{item.sources[0]?.shortName}</span>
                  <span className="meta-dot" />
                  <span>{timeAgo(item.publishedAt, now)}</span>
                  {item.sourceCount > 1 ? <span className="heat-coverage">{item.sourceCount} 源</span> : null}
                  {item.isBlueOcean ? <span className="mini-flag">蓝海</span> : null}
                </span>
              </span>
              <span className="heat-score">
                <FlameIcon width={12} height={12} />
                <span>{item.heat}</span>
                <i style={{ width: `${Math.max(8, Math.min(100, item.heat))}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
