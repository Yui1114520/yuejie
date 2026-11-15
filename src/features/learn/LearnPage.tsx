import { useCallback, useEffect, useState } from "react";
import { isStaticSite } from "../../lib/api";
import { fetchState, postSettings } from "./api";
import { GrammarView } from "./GrammarView";
import { ListeningView } from "./ListeningView";
import { ReadingView } from "./ReadingView";
import { StatsView } from "./StatsView";
import { VocabularyView } from "./VocabularyView";
import type { FlowUpdate, LearnState } from "./types";
import "./learn.css";

const ROUTES = ["vocabulary", "reading", "listening", "grammar", "stats"] as const;
type LearnView = (typeof ROUTES)[number];

const LABELS: Record<LearnView, string> = {
  vocabulary: "背单词",
  reading: "阅读",
  listening: "听力",
  grammar: "语法",
  stats: "统计",
};

function readHash(): LearnView {
  const match = /^#\/learn\/([a-z]+)/.exec(window.location.hash);
  const view = match?.[1] as LearnView | undefined;
  return view && ROUTES.includes(view) ? view : "vocabulary";
}

export function LearnPage() {
  const [view, setView] = useState<LearnView>(readHash);
  const [state, setState] = useState<LearnState | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [target, setTarget] = useState(1000);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchState();
      setState(next);
      setTarget(next.settings.dailyTarget);
      if (!next.settings.intensityConfirmed) setDialog(true);
      setError("");
      return next;
    } catch (err) {
      setError(String((err as Error).message ?? err));
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setView(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const applyUpdate = useCallback((update: FlowUpdate) => {
    setState((prev) => (prev ? { ...prev, ...update.flow, ...(update.gates ? { gates: update.gates } : {}) } : prev));
  }, []);

  const go = useCallback((next: LearnView, reason = "") => {
    setNotice(reason);
    setView(next);
    window.location.hash = `#/learn/${next}`;
  }, []);

  // 路由守卫：服务端不满足前置条件时退回去并说明原因，本地不自行放行
  useEffect(() => {
    if (!state) return;
    if (view === "reading" && !state.gates.reading.ok) {
      go("vocabulary", state.gates.reading.reason ?? "尚未解锁阅读");
    } else if (view === "listening" && !state.gates.listening.ok) {
      const gate = state.gates.listening;
      go(gate.redirect === "vocabulary" ? "vocabulary" : "reading", gate.reason ?? "尚未解锁听力");
    }
  }, [state, view, go]);

  if (isStaticSite) {
    return (
      <div className="page learn">
        <header className="learn-head">
          <span className="learn-kicker">DEUTSCH · A2–B1</span>
          <h1>学习</h1>
        </header>
        <div className="learn-empty">
          <p>学习模块需要本地后端与本地词库（data/learn.sqlite3），静态快照站只发布新闻与报刊。</p>
          <p className="learn-dim">在电脑上启动 <code>node server/index.mjs</code> 后即可使用背单词、阅读与听力流程。</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page learn">
        <header className="learn-head">
          <span className="learn-kicker">DEUTSCH · A2–B1</span>
          <h1>学习</h1>
        </header>
        <div className="learn-empty">
          <p>连不上学习后端：{error}</p>
          <button type="button" className="learn-btn" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page learn">
        <div className="learn-loading">正在装载今日学习计划…</div>
      </div>
    );
  }

  const { vocabulary, reading, listening } = state;
  const percent = vocabulary.total ? Math.round((vocabulary.reviewed / vocabulary.total) * 100) : 0;

  return (
    <div className="page learn">
      <header className="learn-head">
        <div className="learn-head-top">
          <div>
            <span className="learn-kicker">DEUTSCH · A2–B1</span>
            <h1>学习</h1>
          </div>
          <span className="learn-day">{state.dateKey}</span>
        </div>
        <div className="learn-progress">
          <div className="learn-bar">
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="learn-progress-text">
            {vocabulary.reviewed}/{vocabulary.total} 张
            {state.mixedMode ? " · 混合模式" : ""}
          </span>
        </div>
        <nav className="learn-tabs">
          {ROUTES.map((item) => {
            const locked =
              (item === "reading" && !reading.unlocked) || (item === "listening" && !listening.unlocked);
            return (
              <button
                key={item}
                type="button"
                className={`learn-tab ${view === item ? "is-active" : ""} ${locked ? "is-locked" : ""}`}
                onClick={() => go(item, locked ? state.gates[item === "reading" ? "reading" : "listening"].reason ?? "" : "")}
              >
                {LABELS[item]}
                {locked ? <span className="learn-lock">锁</span> : null}
              </button>
            );
          })}
        </nav>
      </header>

      {notice ? (
        <div className="learn-notice">
          <strong>{notice}</strong>
          <button type="button" onClick={() => setNotice("")}>
            知道了
          </button>
        </div>
      ) : null}

      <div className="learn-body">
        {view === "vocabulary" ? <VocabularyView state={state} onFlow={applyUpdate} onDone={() => go("reading")} /> : null}
        {view === "reading" ? (
          <ReadingView onFlow={applyUpdate} onGoListening={() => go("listening")} />
        ) : null}
        {view === "listening" ? <ListeningView onFlow={applyUpdate} /> : null}
        {view === "grammar" ? <GrammarView /> : null}
        {view === "stats" ? <StatsView /> : null}
      </div>

      {dialog ? (
        <div className="learn-dialog-mask">
          <div className="learn-dialog">
            <h2>确认今日强度</h2>
            <p>
              默认每天 <strong>1000</strong> 张卡片，完成卡片才会解锁阅读，读完并确认语法后才能听听力。这个数字随时可以在设置里改，但改不改由你决定，系统不会自动降。
            </p>
            <label className="learn-dialog-field">
              <span>今日卡片数</span>
              <input
                type="number"
                min={10}
                max={5000}
                value={target}
                onChange={(event) => setTarget(Number(event.target.value))}
              />
            </label>
            <div className="learn-dialog-actions">
              <button
                type="button"
                className="learn-btn is-primary"
                onClick={async () => {
                  await postSettings({ target, intensityConfirmed: true });
                  setDialog(false);
                  await refresh();
                }}
              >
                开始今日 {target} 词
              </button>
            </div>
            <p className="learn-dim">词库 {state.pool.size} 条，覆盖到词频第 {state.pool.target} 位。</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
