import { timeAgo } from "../../lib/format";
import type { NewsItem, ZoneSituation } from "../../types";

interface Props {
  zones: ZoneSituation[];
  active: string | null;
  reportsTotal: number;
  now: number;
  onOpen: (item: NewsItem) => void;
}

export function FrontReports({ zones, active, reportsTotal, now, onOpen }: Props) {
  const activeZone = zones.find((zone) => zone.id === active) ?? null;
  const reports = activeZone
    ? activeZone.reports
    : zones
        .flatMap((zone) => zone.reports.map((report) => ({ report, zone })))
        .sort((a, b) => Date.parse(b.report.publishedAt) - Date.parse(a.report.publishedAt))
        .slice(0, 8)
        .map((entry) => entry.report);

  if (!reports.length) return null;

  return (
    <section className="section front-reports">
      <header className="section-head">
        <div>
          <h2 className="section-title">战线战报</h2>
          <p className="section-sub">
            {activeZone
              ? `${activeZone.label} · 最新战况，与焦点和热度榜不重复`
              : "各战区最新战况 · 点击上方战区聚焦"}
          </p>
        </div>
        <span className="section-index">
          {activeZone ? `${activeZone.count} 条` : `${reportsTotal} 条`}
        </span>
      </header>

      <ul className="feed-list report-list">
        {reports.map((item) => (
          <li key={item.id}>
            <button type="button" className="feed-row" onClick={() => onOpen(item)}>
              <span className="report-rail" aria-hidden="true" />
              <span className="feed-main">
                <span className="feed-title">{item.title}</span>
                <span className="feed-meta">
                  <span className={`zone-tag tone-${zoneTone(zones, item.zone)}`}>
                    {item.zoneLabel ?? "战线"}
                  </span>
                  <span>{item.sources[0]?.shortName}</span>
                  {item.sourceCount > 1 ? <span className="heat-coverage">{item.sourceCount} 源</span> : null}
                  <span className="meta-dot" />
                  <span>{timeAgo(item.publishedAt, now)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {activeZone && activeZone.count > activeZone.reports.length ? (
        <p className="feed-more">
          {activeZone.label} 共 {activeZone.count} 条战报 · 当前显示最新 {activeZone.reports.length} 条
        </p>
      ) : null}
    </section>
  );
}

function zoneTone(zones: ZoneSituation[], zoneId: string | null | undefined) {
  return zones.find((zone) => zone.id === zoneId)?.tone ?? "watch";
}
