import { useEffect, useState } from "react";
import { fetchStats } from "./api";
import type { StatsPayload } from "./types";

const STATUS_COLOR: Record<string, string> = {
  untouched: "var(--line-strong)",
  touched: "var(--teal)",
  confirmed: "var(--accent)",
};

function Ring({ value, total }: { value: number; total: number }) {
  const ratio = total ? Math.min(1, value / total) : 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 120 120" className="st-ring" role="img" aria-label={`完成 ${Math.round(ratio * 100)}%`}>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="58" textAnchor="middle" className="st-ring-num">
        {Math.round(ratio * 100)}%
      </text>
      <text x="60" y="76" textAnchor="middle" className="st-ring-sub">
        {value}/{total}
      </text>
    </svg>
  );
}

export function StatsView() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats()
      .then(setData)
      .catch((err) => setError(String((err as Error).message ?? err)));
  }, []);

  if (error) return <div className="learn-empty">{error}</div>;
  if (!data) return <div className="learn-loading">汇总今日数据…</div>;

  const maxCards = Math.max(1, ...data.week.map((day) => day.newCards));
  const coverage = data.coverage.pool ? Math.round((data.coverage.seen / data.coverage.pool) * 100) : 0;

  return (
    <div className="learn-stats">
      <section className="st-top">
        <Ring value={data.ring.reviewed} total={data.ring.target} />
        <div className="st-facts">
          <div>
            <strong>{data.streak}</strong>
            <span>连续天数</span>
          </div>
          <div>
            <strong>{data.minutes}</strong>
            <span>今日分钟</span>
          </div>
          <div>
            <strong>
              {data.ring.readingCompleted ? "✓" : "—"} / {data.ring.listeningCompleted ? "✓" : "—"}
            </strong>
            <span>阅读 / 听力</span>
          </div>
        </div>
      </section>

      <section className="st-block">
        <h3>近 7 天新词</h3>
        <div className="st-week">
          {data.week.length ? (
            data.week.map((day) => (
              <div key={day.dateKey} className="st-col">
                <div className="st-bar-wrap">
                  <span className="st-bar" style={{ height: `${(day.newCards / maxCards) * 100}%` }} />
                </div>
                <span className="st-col-label">{day.dateKey.slice(5)}</span>
                <span className="st-col-value">{day.newCards}</span>
              </div>
            ))
          ) : (
            <p className="learn-dim">还没有历史记录。</p>
          )}
        </div>
      </section>

      <section className="st-block">
        <h3>词库覆盖</h3>
        <div className="st-coverage">
          <div className="learn-bar">
            <span style={{ width: `${coverage}%` }} />
          </div>
          <span>
            {data.coverage.seen} / {data.coverage.pool} 条 · {coverage}%
          </span>
        </div>
      </section>

      <section className="st-block">
        <h3>语法点热力图</h3>
        <div className="st-grammar">
          {data.grammar.map((item) => (
            <span
              key={item.id}
              className={`st-cell ${item.outline === "拓展" ? "is-extra" : ""}`}
              style={{ background: STATUS_COLOR[item.status] }}
              title={`${item.titleZh}·${item.status}`}
            >
              {item.titleZh.slice(0, 4)}
            </span>
          ))}
        </div>
        <div className="st-legend">
          <span style={{ background: STATUS_COLOR.untouched }} /> 未接触
          <span style={{ background: STATUS_COLOR.touched }} /> 已接触
          <span style={{ background: STATUS_COLOR.confirmed }} /> 已确认
        </div>
      </section>

      <section className="st-block">
        <h3>错词池（按标记次数加权）</h3>
        {data.errorPool.length ? (
          <ul className="st-errors">
            {data.errorPool.map((word) => (
              <li key={word.id}>
                <strong>{word.lemma}</strong>
                <span>{word.zhFullAnnotation.slice(0, 24)}</span>
                <em>×{word.marks}</em>
              </li>
            ))}
          </ul>
        ) : (
          <p className="learn-dim">还没有标记「稍后复习」的词。</p>
        )}
      </section>
    </div>
  );
}
