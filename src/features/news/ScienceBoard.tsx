import { useMemo, useState } from "react";
import { FeedImage } from "../../components/FeedImage";
import { timeAgo } from "../../lib/format";
import type { NewsItem } from "../../types";

interface Props {
  items: NewsItem[];
  now: number;
  onOpen: (item: NewsItem) => void;
}

type Scope = "research" | "applied" | "general";

const RESEARCH: { id: string; label: string; sub: string }[] = [
  { id: "physics", label: "物理", sub: "量子 · 粒子 · 天文与核物理" },
  { id: "chemistry", label: "化学", sub: "催化 · 材料 · 电化学" },
  { id: "biology", label: "生物", sub: "基因 · 细胞 · 医学基础研究" },
  { id: "computing", label: "计算机", sub: "大模型 · 算法 · 算力与数据" },
];

const APPLIED: { id: string; label: string; sub: string }[] = [
  { id: "industry", label: "工业", sub: "制造 · 机器人 · 自动化" },
  { id: "energy", label: "能源", sub: "光伏 · 储能 · 核能 · 电网" },
  { id: "space", label: "航天", sub: "火箭 · 卫星 · 深空探测" },
  { id: "electronics", label: "电子", sub: "半导体 · 芯片 · 通信" },
  { id: "medical", label: "医疗", sub: "新药 · 器械 · 临床转化" },
];

const SCOPES: { id: Scope; label: string }[] = [
  { id: "research", label: "理论研究" },
  { id: "applied", label: "应用前沿" },
  { id: "general", label: "综合研究" },
];

function ArticleRow({ item, now, onOpen }: { item: NewsItem; now: number; onOpen: (item: NewsItem) => void }) {
  const tag =
    item.topic === "applied" && item.subtopicLabel
      ? `应用 · ${item.subtopicLabel}`
      : item.topicLabel ?? "研究";
  return (
    <li>
      <button type="button" className="feed-row" onClick={() => onOpen(item)}>
        <span className="feed-main">
          <span className="feed-title">{item.title}</span>
          <span className="feed-meta">
            <span className={`topic-tag topic-${item.topic ?? "general"}`}>{tag}</span>
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
  );
}

export function ScienceBoard({ items, now, onOpen }: Props) {
  const [scope, setScope] = useState<Scope>("research");
  const [sub, setSub] = useState<string | null>(null);

  const counts = useMemo(() => {
    const research = new Map<string, number>();
    const applied = new Map<string, number>();
    let general = 0;
    for (const item of items) {
      if (item.topic === "applied") {
        if (item.subtopic) applied.set(item.subtopic, (applied.get(item.subtopic) ?? 0) + 1);
      } else if (item.topic === "general" || !item.topic) {
        general += 1;
      } else {
        research.set(item.topic, (research.get(item.topic) ?? 0) + 1);
      }
    }
    return { research, applied, general };
  }, [items]);

  const scoped = useMemo(() => {
    if (scope === "applied") return items.filter((item) => item.topic === "applied");
    if (scope === "general") return items.filter((item) => item.topic === "general" || !item.topic);
    return items.filter((item) => RESEARCH.some((field) => field.id === item.topic));
  }, [items, scope]);

  const groups = useMemo(() => {
    if (scope === "research") {
      const fields = sub ? RESEARCH.filter((field) => field.id === sub) : RESEARCH;
      return fields
        .map((field) => ({
          key: field.id,
          title: field.label,
          sub: field.sub,
          items: scoped.filter((item) => item.topic === field.id),
        }))
        .filter((group) => group.items.length > 0);
    }
    if (scope === "applied") {
      const fields = sub ? APPLIED.filter((field) => field.id === sub) : APPLIED;
      return fields
        .map((field) => ({
          key: field.id,
          title: field.label,
          sub: field.sub,
          items: scoped.filter((item) => item.subtopic === field.id),
        }))
        .filter((group) => group.items.length > 0);
    }
    return [{ key: "general", title: "尚未细分的研究进展", sub: "跨学科与其他科研动态", items: scoped }].filter(
      (group) => group.items.length > 0,
    );
  }, [scope, sub, scoped]);

  const switchScope = (next: Scope) => {
    setScope(next);
    setSub(null);
  };

  const subFields = scope === "research" ? RESEARCH : scope === "applied" ? APPLIED : [];
  const subCounts = scope === "research" ? counts.research : counts.applied;

  return (
    <section className="section science-board">
      <header className="section-head">
        <div>
          <h2 className="section-title">研究版图</h2>
          <p className="section-sub">理论研究与应用前沿分栏呈现 · 与头条不重复</p>
        </div>
        <span className="section-index">{scoped.length} 条</span>
      </header>

      <div className="topic-chips topic-chips-main" role="tablist" aria-label="研究板块">
        {SCOPES.map((entry) => {
          const total =
            entry.id === "research"
              ? [...counts.research.values()].reduce((sum, value) => sum + value, 0)
              : entry.id === "applied"
                ? [...counts.applied.values()].reduce((sum, value) => sum + value, 0)
                : counts.general;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={scope === entry.id}
              className={`topic-chip ${scope === entry.id ? "is-active" : ""}`}
              onClick={() => switchScope(entry.id)}
            >
              {entry.label}
              <span className="region-count">{total}</span>
            </button>
          );
        })}
      </div>

      {subFields.length ? (
        <div className="topic-chips topic-chips-sub" role="tablist" aria-label="研究子领域">
          <button
            type="button"
            role="tab"
            aria-selected={sub === null}
            className={`topic-chip is-sub ${sub === null ? "is-active" : ""}`}
            onClick={() => setSub(null)}
          >
            全部
            <span className="region-count">{scoped.length}</span>
          </button>
          {subFields.map((field) => (
            <button
              key={field.id}
              type="button"
              role="tab"
              aria-selected={sub === field.id}
              className={`topic-chip is-sub ${sub === field.id ? "is-active" : ""}`}
              onClick={() => setSub(field.id)}
            >
              {field.label}
              <span className="region-count">{subCounts.get(field.id) ?? 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      {groups.map((group) => (
        <div className="science-group" key={group.key}>
          <div className="science-group-head">
            <h3>{group.title}</h3>
            <span>{group.sub}</span>
          </div>
          <ul className="feed-list">
            {group.items.slice(0, 12).map((item) => (
              <ArticleRow key={item.id} item={item} now={now} onOpen={onOpen} />
            ))}
          </ul>
        </div>
      ))}

      {!groups.length ? <p className="feed-more">该方向暂时没有新的研究报道</p> : null}
    </section>
  );
}
