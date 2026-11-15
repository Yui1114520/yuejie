import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCards, postLater, postReview } from "./api";
import { createAudioPlayer } from "./audioPlayer";
import type { FlowUpdate, LearnState, WordCard } from "./types";

const WINDOW = 20;

export function VocabularyView({
  state,
  onFlow,
  onDone,
}: {
  state: LearnState;
  onFlow: (update: FlowUpdate) => void;
  onDone: () => void;
}) {
  const total = state.vocabulary.total;
  const [index, setIndex] = useState(() => Math.min(state.vocabulary.reviewed, Math.max(total - 1, 0)));
  const [cache, setCache] = useState<Map<number, WordCard>>(new Map());
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audioNote, setAudioNote] = useState("");
  const player = useRef(createAudioPlayer((url) => new Audio(url)));

  const load = useCallback(
    async (from: number) => {
      const start = Math.floor(from / WINDOW) * WINDOW;
      if (cache.has(start) && cache.has(Math.min(start + WINDOW - 1, total - 1))) return;
      const result = await fetchCards(start, Math.min(start + WINDOW - 1, total - 1));
      setCache((prev) => {
        const next = new Map(prev);
        result.cards.forEach((card, offset) => next.set(start + offset, card));
        return next;
      });
    },
    [cache, total],
  );

  useEffect(() => {
    void load(index);
  }, [index, load]);

  const card = cache.get(index);
  const finished = total > 0 && state.vocabulary.reviewed >= total;

  const stopAudio = useCallback(() => player.current.stop(), []);

  const play = useCallback(
    (url: string) => {
      setAudioNote("");
      player.current.replay(url);
    },
    [],
  );

  useEffect(() => () => player.current.stop(), []);

  const flip = () => {
    if (!card) return;
    const next = !flipped;
    setFlipped(next);
    if (next) {
      if (!player.current.flip(card.audioUrl)) setAudioNote("音频暂不可用");
    }
  };

  const advance = async (mode: "review" | "later") => {
    if (!card || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = mode === "later" ? await postLater(card.seq ?? index) : await postReview(card.seq ?? index);
      onFlow(result);
      const nextIndex = index + 1;
      if (nextIndex >= total) {
        setFlipped(false);
        stopAudio();
        onDone();
        return;
      }
      stopAudio();
      setFlipped(false);
      setIndex(nextIndex);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  if (!total) {
    return (
      <div className="learn-empty">
        <p>今日批次还没生成。词库为空时请先运行导入脚本：</p>
        <code>node scripts/import-learn-de.mjs</code>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="learn-empty">
        <p>今日 {total} 张已完成，阅读已解锁。</p>
        <button type="button" className="learn-btn is-primary" onClick={onDone}>
          去阅读
        </button>
      </div>
    );
  }

  return (
    <div className="vocab">
      <div className="vocab-meta">
        <span>
          第 {index + 1} / {total} 张
        </span>
        <span className="learn-dim">已复习 {state.vocabulary.reviewed}</span>
      </div>

      {!card ? (
        <div className="learn-loading">取卡片…</div>
      ) : (
        <div className={`flashcard ${flipped ? "is-flipped" : ""}`} onClick={flip} role="button" tabIndex={0}
          onKeyDown={(event) => (event.key === "Enter" || event.key === " " ? flip() : null)}>
          {!flipped ? (
            <div className="flash-face flash-front">
              <span className="flash-tag">
                {card.pos} · {card.cefrLevel}
              </span>
              <strong className="flash-lemma">{card.lemma}</strong>
              {card.morphologyNote ? <span className="flash-sub">{card.morphologyNote}</span> : null}
              <span className="flash-hint">点卡片看释义与词形</span>
            </div>
          ) : (
            <div className="flash-face flash-back">
              <div className="flash-scroll">
                <section>
                  <h4>中文全注释</h4>
                  <p className="flash-zh">{card.zhFullAnnotation}</p>
                </section>
                <section>
                  <h4>例句</h4>
                  {card.exampleSentence ? (
                    <>
                      <p className="flash-example">{card.exampleSentence}</p>
                      <span className="flash-source">
                        {card.exampleSource} · {card.exampleLicense}
                      </span>
                    </>
                  ) : (
                    <p className="learn-dim">本词暂无可核验例句</p>
                  )}
                </section>
                <section>
                  <h4>词形变化</h4>
                  {card.inflections.length ? (
                    <ul className="flash-inflections">
                      {card.inflections.map((item) => (
                        <li key={`${item.form}-${item.tags[0]}`}>
                          <span>{item.form}</span>
                          <em>{item.tags.join(" / ")}</em>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="learn-dim">词库未收录该词性的变化表</p>
                  )}
                </section>
                <section>
                  <h4>固定搭配</h4>
                  {card.fixedCollocations.length ? (
                    <ul className="flash-colloc">
                      {card.fixedCollocations.map((item) => (
                        <li key={item.phrase}>
                          {item.phrase}
                          <em>语料 {item.count} 次</em>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="learn-dim">暂无可核验搭配</p>
                  )}
                </section>
                {card.morphologyNote ? (
                  <section>
                    <h4>词根词缀</h4>
                    <p>{card.morphologyNote}</p>
                  </section>
                ) : null}
                {card.historyNote ? (
                  <section>
                    <h4>历史文化</h4>
                    <p>{card.historyNote}</p>
                  </section>
                ) : null}
              </div>
              <button
                type="button"
                className="flash-replay"
                onClick={(event) => {
                  event.stopPropagation();
                  if (card.audioUrl) play(card.audioUrl);
                  else setAudioNote("音频暂不可用");
                }}
              >
                {card.audioUrl ? `重播 ${card.lemma}` : "音频暂不可用"}
              </button>
              {audioNote ? <span className="flash-audio-note">{audioNote}</span> : null}
            </div>
          )}
        </div>
      )}

      {error ? <p className="learn-error">{error}</p> : null}

      <div className="vocab-actions">
        <button type="button" className="learn-btn" disabled={busy || !card} onClick={() => void advance("later")}>
          稍后复习
        </button>
        <button
          type="button"
          className="learn-btn is-primary"
          disabled={busy || !card}
          onClick={() => void advance("review")}
        >
          {busy ? "记录中…" : flipped ? "记住了，下一张" : "先翻面"}
        </button>
      </div>
      <p className="learn-dim vocab-tip">
        「稍后复习」也计入今日已复习数，只是同时进入错词池；记录写入成功才会跳下一张。
      </p>
    </div>
  );
}
