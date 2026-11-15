import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { formatClock } from "../../lib/format";
import type { ZoneSituation } from "../../types";
import { WORLD_MASK } from "./worldMask";

interface Props {
  zones: ZoneSituation[];
  active: string | null;
  updatedAt: string;
  onSelect: (zoneId: string | null) => void;
}

const LABEL_OFFSET: Record<string, { x: number; y: number }> = {
  gaza: { x: 10, y: -12 },
  iran: { x: 12, y: 8 },
  syria: { x: -48, y: -10 },
  redsea: { x: 10, y: 12 },
  ukraine: { x: -54, y: -10 },
  sudan: { x: -46, y: 10 },
  sahel: { x: -50, y: 10 },
  congo: { x: 10, y: 12 },
  latam: { x: 10, y: 12 },
  myanmar: { x: -52, y: 8 },
  scs: { x: 10, y: 10 },
  afghan: { x: 10, y: -12 },
  caucasus: { x: 10, y: -12 },
  korea: { x: 10, y: -12 },
  southeast: { x: 10, y: 8 },
  kashmir: { x: -44, y: -12 },
  ethiopia: { x: -48, y: 8 },
  somalia: { x: 10, y: 10 },
  mexico: { x: -46, y: -10 },
};

function project(lat: number, lon: number) {
  const span = WORLD_MASK.top - WORLD_MASK.bottom;
  return {
    left: `${((lon + 180) / 360) * 100}%`,
    top: `${((WORLD_MASK.top - lat) / span) * 100}%`,
  };
}

export function WarMap({ zones, active, updatedAt, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeZones = zones.filter((zone) => zone.count > 0);
  const peak = Math.max(0, ...activeZones.map((zone) => zone.intensity));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 720;
    const height = 288;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cellW = width / WORLD_MASK.cols;
    const cellH = height / WORLD_MASK.rows;

    WORLD_MASK.data.forEach((row, r) => {
      for (let c = 0; c < row.length; c += 1) {
        if (row[c] !== "1") continue;
        const x = (c + 0.5) * cellW;
        const y = (r + 0.5) * cellH;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.9, cellW * 0.26), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(240, 234, 220, 0.26)";
        ctx.fill();
      }
    });

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let lat = 60; lat >= -30; lat -= 30) {
      const { top } = project(lat, 0);
      const y = (Number.parseFloat(top) / 100) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let lon = -120; lon <= 120; lon += 60) {
      const { left } = project(0, lon);
      const x = (Number.parseFloat(left) / 100) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, []);

  return (
    <section className="section warmap-section">
      <header className="section-head">
        <div>
          <h2 className="section-title">全球战争局势</h2>
          <p className="section-sub">72 小时军事报道聚合 · 热点强度＝报道量 × 时效</p>
        </div>
        <span className="section-index">LIVE {formatClock(updatedAt)}</span>
      </header>

      <div className="warmap">
        <canvas ref={canvasRef} className="warmap-canvas" aria-hidden="true" />
        {activeZones.map((zone) => {
          const offset = LABEL_OFFSET[zone.id] ?? { x: 10, y: -12 };
          const size = Math.round(9 + (zone.intensity / 100) * 9);
          const showLabel = zone.intensity >= 40 || active === zone.id;
          const style: CSSProperties & Record<"--pin-size" | "--label-x" | "--label-y", string> = {
            ...project(zone.lat, zone.lon),
            "--pin-size": `${size}px`,
            "--label-x": `${offset.x}px`,
            "--label-y": `${offset.y}px`,
          };
          return (
            <button
              key={zone.id}
              type="button"
              className={`zone-pin tone-${zone.tone} ${active === zone.id ? "is-active" : ""}`}
              style={style}
              onClick={() => onSelect(active === zone.id ? null : zone.id)}
              aria-label={`${zone.label}：${zone.count} 条战报`}
              aria-pressed={active === zone.id}
            >
              <span className="pin-pulse" aria-hidden="true" />
              <span className="pin-core" aria-hidden="true" />
              {showLabel ? (
                <span className="pin-label">
                  {zone.label}
                  <i>{zone.count}</i>
                </span>
              ) : null}
            </button>
          );
        })}
        <div className="warmap-legend">
          <span><i className="legend-dot tone-hot" />激战</span>
          <span><i className="legend-dot tone-warm" />升温</span>
          <span><i className="legend-dot tone-watch" />关注</span>
        </div>
        <div className="warmap-scale" aria-hidden="true">
          强度
          <i style={{ width: `${peak}%` }} />
        </div>
      </div>

      <div className="zone-strip" role="tablist" aria-label="战区筛选">
        <button
          type="button"
          role="tab"
          aria-selected={active === null}
          className={`zone-card ${active === null ? "is-active" : ""}`}
          onClick={() => onSelect(null)}
        >
          <span className="zone-card-name">全部战区</span>
          <span className="zone-card-meta">{activeZones.length} 个活跃</span>
        </button>
        {[...activeZones]
          .sort((a, b) => b.intensity - a.intensity)
          .map((zone) => (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={active === zone.id}
              className={`zone-card ${active === zone.id ? "is-active" : ""}`}
              onClick={() => onSelect(active === zone.id ? null : zone.id)}
            >
              <span className={`zone-dot tone-${zone.tone}`} />
              <span className="zone-card-name">{zone.label}</span>
              <span className="zone-card-meta">{zone.count} 条</span>
              <span className="zone-bar">
                <i className={`tone-${zone.tone}`} style={{ width: `${zone.intensity}%` }} />
              </span>
            </button>
          ))}
      </div>
    </section>
  );
}
