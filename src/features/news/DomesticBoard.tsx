import { useMemo, useState } from "react";
import { timeAgo } from "../../lib/format";
import type { NewsItem, NewsPayload } from "../../types";

interface Props {
  documents: NewsItem[];
  provinces: NonNullable<NewsPayload["provinces"]>;
  items: NewsItem[];
  now: number;
  onOpen: (item: NewsItem) => void;
}

type ProvinceEntry = NonNullable<NewsPayload["provinces"]>[number];

const PROVINCE_GROUPS: { label: string; ids: string[] }[] = [
  { label: "华北", ids: ["beijing", "tianjin", "hebei", "shanxi", "inner-mongolia"] },
  { label: "东北", ids: ["liaoning", "jilin", "heilongjiang"] },
  { label: "华东", ids: ["shanghai", "jiangsu", "zhejiang", "anhui", "fujian", "jiangxi", "shandong"] },
  { label: "华中", ids: ["henan", "hubei", "hunan"] },
  { label: "华南", ids: ["guangdong", "guangxi", "hainan"] },
  { label: "西南", ids: ["chongqing", "sichuan", "guizhou", "yunnan", "tibet"] },
  { label: "西北", ids: ["shaanxi", "gansu", "qinghai", "ningxia", "xinjiang"] },
  { label: "港澳台", ids: ["hongkong", "macau", "taiwan"] },
];

export function DomesticBoard({ documents, provinces, items, now, onOpen }: Props) {
  const [provinceId, setProvinceId] = useState<string>("all");
  const byId = useMemo(
    () => new Map(provinces.map((province) => [province.id, province])),
    [provinces],
  );
  const active: ProvinceEntry | null = provinceId === "all" ? null : byId.get(provinceId) ?? null;

  const list = useMemo(() => {
    if (!active) return items.filter((item) => !item.document).slice(0, 24);
    return items.filter((item) => item.province === active.id && !item.document);
  }, [active, items]);

  const totalCount = provinces.reduce((sum, province) => sum + province.count, 0);

  return (
    <>
      {documents.length ? (
        <section className="section doc-section">
          <header className="section-head">
            <div>
              <h2 className="section-title">政策文件</h2>
              <p className="section-sub">中央与部委最新文件、规划与会议决定</p>
            </div>
            <span className="section-index">POLICY</span>
          </header>
          <div className="doc-grid">
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className="doc-card"
                onClick={() => onOpen(doc)}
              >
                <span className="doc-badge">{doc.provinceLabel ?? "全国"}</span>
                <span className="doc-title">{doc.title}</span>
                <span className="doc-meta">
                  <span>{doc.sources[0]?.shortName}</span>
                  <span className="meta-dot" />
                  <span>{timeAgo(doc.publishedAt, now)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section province-section">
        <header className="section-head">
          <div>
            <h2 className="section-title">省级动态</h2>
            <p className="section-sub">34 个省级行政区 · 按省筛选当地时政动态</p>
          </div>
          <span className="section-index">{totalCount} LOCAL</span>
        </header>

        <div className="province-groups">
          <button
            type="button"
            className={`province-chip is-all ${provinceId === "all" ? "is-active" : ""}`}
            onClick={() => setProvinceId("all")}
          >
            全国
            <span className="chip-count">{items.filter((item) => !item.document).length}</span>
          </button>
          {PROVINCE_GROUPS.map((group) => (
            <div key={group.label} className="province-group">
              <span className="province-group-label">{group.label}</span>
              <div className="province-chips">
                {group.ids.map((id) => {
                  const province = byId.get(id);
                  if (!province) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`province-chip ${provinceId === id ? "is-active" : ""} ${
                        province.count ? "" : "is-empty"
                      }`}
                      onClick={() => setProvinceId(id)}
                    >
                      {province.label}
                      <span className="chip-count">{province.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="province-list">
          {list.map((item) => (
            <button
              key={item.id}
              type="button"
              className="province-row"
              onClick={() => onOpen(item)}
            >
              <span className="province-row-main">
                <span className="province-row-title">{item.title}</span>
                <span className="province-row-meta">
                  {item.provinceLabel ? <span className="province-tag">{item.provinceLabel}</span> : null}
                  <span>{item.sources[0]?.shortName}</span>
                  <span className="meta-dot" />
                  <span>{timeAgo(item.publishedAt, now)}</span>
                  {item.sourceCount > 1 ? <span>{item.sourceCount} 源</span> : null}
                </span>
              </span>
              <span className="province-row-heat">{item.heat}</span>
            </button>
          ))}
          {!list.length ? (
            <p className="province-empty">
              {active
                ? `${active.label}当前没有通过编辑筛选的时政动态，稍后刷新或切换到其他省份。`
                : "当前没有可展示的国内时政动态。"}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
