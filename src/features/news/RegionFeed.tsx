import { FeedImage } from "../../components/FeedImage";
import { timeAgo } from "../../lib/format";
import type { NewsItem, RegionId } from "../../types";
import { REGION_LABELS } from "./regions";

interface Props {
  items: NewsItem[];
  regions: { id: RegionId; label: string; count: number }[];
  activeRegion: RegionId;
  round: number;
  onRegionChange: (region: RegionId) => void;
  now: number;
  onOpen: (item: NewsItem) => void;
}

export function RegionFeed({
  items,
  regions,
  activeRegion,
  round,
  onRegionChange,
  now,
  onOpen,
}: Props) {
  const tabs = regions.filter((region) => region.id !== "global" && region.count > 0);
  const total = items.length;

  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2 className="section-title">实时动态</h2>
          <p className="section-sub">按发布时间排列 · 与热度榜不重复</p>
        </div>
        <span className="section-index">{total} 条</span>
      </header>

      <div className="region-tabs" role="tablist" aria-label="地区筛选">
        <button
          type="button"
          role="tab"
          aria-selected={activeRegion === "global"}
          className={`region-chip ${activeRegion === "global" ? "is-active" : ""}`}
          onClick={() => onRegionChange("global")}
        >
          全部
        </button>
        {tabs.map((region) => (
          <button
            key={region.id}
            type="button"
            role="tab"
            aria-selected={activeRegion === region.id}
            className={`region-chip ${activeRegion === region.id ? "is-active" : ""}`}
            onClick={() => onRegionChange(region.id)}
          >
            {region.label}
            <span className="region-count">{region.count}</span>
          </button>
        ))}
      </div>

      <ul className="feed-list">
        {items.slice(0, 14).map((item) => (
          <li key={item.id}>
            <button type="button" className="feed-row" onClick={() => onOpen(item)}>
              <span className="feed-main">
                <span className="feed-title">{item.title}</span>
                <span className="feed-meta">
                  <span className="feed-region">{REGION_LABELS[item.region]}</span>
                  <span>{item.sources[0]?.shortName}</span>
                  <span className="meta-dot" />
                  <span>{timeAgo(item.publishedAt, now)}</span>
                  {item.isBlueOcean ? <span className="mini-flag">蓝海</span> : null}
                </span>
              </span>
              <FeedImage
                className="feed-thumb"
                src={item.image}
                accent={item.sources[0]?.accent}
                fallbackLabel={item.sources[0]?.shortName}
              />
            </button>
          </li>
        ))}
      </ul>
      {items.length ? (
        <p className="feed-more">
          第 {round + 1} 批 · 共 {items.length} 条 · 点击右上角刷新重置动态
        </p>
      ) : (
        <p className="feed-more">该地区暂时没有未上榜的动态，试试切换地区</p>
      )}
    </section>
  );
}
