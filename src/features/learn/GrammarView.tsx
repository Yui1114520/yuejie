import { useEffect, useState } from "react";
import { fetchGrammarIndex } from "./api";
import type { GrammarEntry, GrammarPoint } from "./types";

const STATUS: Record<string, string> = { untouched: "未接触", touched: "已接触", confirmed: "已确认" };

export function GrammarView() {
  const [data, setData] = useState<{ today: GrammarPoint[]; catalog: GrammarEntry[]; mainline: number; mastered: number } | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState("");

  useEffect(() => {
    fetchGrammarIndex()
      .then(setData)
      .catch((err) => setError(String((err as Error).message ?? err)));
  }, []);

  if (error) return <div className="learn-empty">{error}</div>;
  if (!data) return <div className="learn-loading">读取语法大纲…</div>;

  const groups = ["untouched", "touched", "confirmed"] as const;

  return (
    <div className="grammar">
      <div className="gr-summary">
        <div>
          <strong>{data.mastered}</strong>
          <span>已确认 / {data.mainline} 个四级点</span>
        </div>
        <div>
          <strong>{data.today.length}</strong>
          <span>今日文章锚定</span>
        </div>
      </div>

      <h3>今日文章里的语法点</h3>
      {data.today.length ? (
        data.today.map((point) => (
          <article key={point.grammarId} className="gr-card">
            <header>
              <strong>{point.titleZh}</strong>
              <span className={`rd-outline ${point.outline === "拓展" ? "is-extra" : ""}`}>{point.outline}</span>
            </header>
            <blockquote>{point.evidenceSentence}</blockquote>
          </article>
        ))
      ) : (
        <p className="learn-dim">今天还没有阅读文本，先完成卡片并进入阅读。</p>
      )}

      <h3>四级大纲全表</h3>
      <p className="learn-dim">「拓展」是四级大纲以外的点，只登记接触状态，不占主线进度。</p>
      {groups.map((status) => {
        const list = data.catalog.filter((item) => item.status === status);
        if (!list.length) return null;
        return (
          <section key={status} className="gr-group">
            <h4>
              {STATUS[status]} <span>{list.length}</span>
            </h4>
            <div className="gr-grid">
              {list.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`gr-chip is-${status} ${item.outline === "拓展" ? "is-extra" : ""} ${open === item.id ? "is-open" : ""}`}
                  onClick={() => setOpen(open === item.id ? "" : item.id)}
                >
                  {item.titleZh}
                  {item.today ? <em>今日</em> : null}
                </button>
              ))}
            </div>
            {open && list.some((item) => item.id === open) ? (
              (() => {
                const item = list.find((entry) => entry.id === open) as GrammarEntry;
                return (
                  <div className="gr-detail">
                    <p>{item.explainZh}</p>
                    <div className="rd-contrast">
                      <span className="is-wrong">✗ {item.contrast.wrong}</span>
                      <span className="is-right">✓ {item.contrast.right}</span>
                      <em>{item.contrast.note}</em>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
