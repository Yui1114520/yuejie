import { useEffect, useState } from "react";
import { fetchMarkets, fetchMovers } from "../../lib/api";
import { formatClock } from "../../lib/format";
import type { MarketIndex, MarketSnapshot, MarketStock, MoversSnapshot } from "../../types";

function formatPrice(value: number) {
  return value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MarketCard({
  index,
  active,
  onSelect,
}: {
  index: MarketIndex;
  active: boolean;
  onSelect: (index: MarketIndex) => void;
}) {
  const pct = index.pct ?? 0;
  const direction = pct > 0 ? "is-up" : pct < 0 ? "is-down" : "is-flat";
  return (
    <button
      type="button"
      className={`market-card ${direction} ${active ? "is-active" : ""}`}
      aria-pressed={active}
      onClick={() => onSelect(index)}
    >
      <span className="market-name">{index.name}</span>
      <span className="market-price">{formatPrice(index.price)}</span>
      <span className="market-change">
        <span>{pct > 0 ? "+" : ""}{pct.toFixed(2)}%</span>
        <span className="market-delta">
          {index.change != null ? `${index.change > 0 ? "+" : ""}${index.change.toFixed(2)}` : ""}
        </span>
      </span>
    </button>
  );
}

function StockRow({ stock }: { stock: MarketStock }) {
  const direction = stock.pct > 0 ? "is-up" : stock.pct < 0 ? "is-down" : "is-flat";
  return (
    <li className={`mover-row ${direction}`}>
      <span className="mover-name">{stock.name}</span>
      <span className="mover-code">{stock.code.replace(/^(sh|sz|rt_hk|gb_)/, "")}</span>
      <span className="mover-price">{formatPrice(stock.price)}</span>
      <span className="mover-pct">
        {stock.pct > 0 ? "+" : ""}
        {stock.pct.toFixed(2)}%
      </span>
    </li>
  );
}

function MoversPanel({ index, onClose }: { index: MarketIndex; onClose: () => void }) {
  const [data, setData] = useState<MoversSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;
    setData(null);
    setFailed(false);
    const load = async () => {
      try {
        const next = await fetchMovers(index.id, controller.signal);
        if (next.ok) setData(next);
        else setFailed(true);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    };
    void load();
    timer = window.setInterval(() => void load(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [index.id]);

  return (
    <div className="movers-panel">
      <header className="movers-head">
        <div>
          <h3 className="movers-title">{index.name} · 成分股涨跌</h3>
          <p className="movers-sub">
            代表性龙头股当日表现
            {data?.updatedAt ? ` · ${formatClock(data.updatedAt)}` : ""}
            {data?.stale ? " · 缓存数据" : ""}
          </p>
        </div>
        <button type="button" className="movers-close" onClick={onClose} aria-label="收起成分股">
          收起
        </button>
      </header>

      {failed && !data ? <p className="movers-empty">暂时取不到成分股行情，稍后重试</p> : null}
      {!failed && !data ? <p className="movers-empty">正在拉取最新成分股行情…</p> : null}

      {data ? (
        <div className="movers-cols">
          <div className="movers-col">
            <div className="movers-col-head">领涨</div>
            {data.gainers.length ? (
              <ul className="movers-list">
                {data.gainers.map((stock) => (
                  <StockRow key={`g-${stock.code}`} stock={stock} />
                ))}
              </ul>
            ) : (
              <p className="movers-empty">暂无上涨成分股</p>
            )}
          </div>
          <div className="movers-col">
            <div className="movers-col-head">领跌</div>
            {data.losers.length ? (
              <ul className="movers-list">
                {data.losers.map((stock) => (
                  <StockRow key={`l-${stock.code}`} stock={stock} />
                ))}
              </ul>
            ) : (
              <p className="movers-empty">暂无下跌成分股</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MarketBoard() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [selected, setSelected] = useState<MarketIndex | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;
    const load = async () => {
      try {
        const data = await fetchMarkets(controller.signal);
        if (data.indices.length) setSnapshot(data);
      } catch {
        // 保留上一次行情，等待下一轮刷新
      }
    };
    void load();
    timer = window.setInterval(() => void load(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  if (!snapshot) return null;

  const domestic = snapshot.indices.filter((index) => index.market !== "us");
  const overseas = snapshot.indices.filter((index) => index.market === "us");
  const select = (index: MarketIndex) => setSelected((prev) => (prev?.id === index.id ? null : index));

  return (
    <section className="section market-board" aria-label="实时行情">
      <header className="section-head">
        <div>
          <h2 className="section-title">实时行情</h2>
          <p className="section-sub">
            新浪财经 · 每 60 秒刷新 · 点击指数查看成分股涨跌
            {snapshot.stale ? " · 当前为缓存数据" : ""}
          </p>
        </div>
        <span className="section-index">
          LIVE {snapshot.updatedAt ? formatClock(snapshot.updatedAt) : ""}
        </span>
      </header>
      <div className="market-group-label">沪深 · 港股</div>
      <div className="market-grid">
        {domestic.map((index) => (
          <MarketCard key={index.id} index={index} active={selected?.id === index.id} onSelect={select} />
        ))}
      </div>
      <div className="market-group-label">美股</div>
      <div className="market-grid">
        {overseas.map((index) => (
          <MarketCard key={index.id} index={index} active={selected?.id === index.id} onSelect={select} />
        ))}
      </div>
      {selected ? <MoversPanel index={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
