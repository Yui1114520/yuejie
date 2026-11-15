import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { fetchReading, fetchWord, LockedError, postBottom, postGrammarConfirm, postGrammarTouch } from "./api";
import type { FlowUpdate, Passage, WordCard } from "./types";

function Paragraphs({
  passage,
  onWord,
}: {
  passage: Passage;
  onWord: (id: string) => void;
}) {
  const blocks = useMemo(() => {
    const out: { start: number; end: number; text: string }[] = [];
    let cursor = 0;
    for (const raw of passage.textDe.split(/\n{2,}/)) {
      const start = passage.textDe.indexOf(raw, cursor);
      out.push({ start, end: start + raw.length, text: raw });
      cursor = start + raw.length;
    }
    return out;
  }, [passage]);

  return (
    <>
      {blocks.map((block) => {
        const tokens = passage.tokenized.filter((token) => token.start >= block.start && token.end <= block.end);
        const parts: ReactNode[] = [];
        let cursor = block.start;
        for (const token of tokens) {
          if (token.start > cursor) parts.push(passage.textDe.slice(cursor, token.start));
          if (token.isHighlight && token.cardId) {
            parts.push(
              <button
                key={`${token.start}`}
                type="button"
                className="rd-word"
                onClick={() => onWord(token.cardId as string)}
              >
                {token.word}
              </button>,
            );
          } else {
            parts.push(token.word);
          }
          cursor = token.end;
        }
        if (cursor < block.end) parts.push(passage.textDe.slice(cursor, block.end));
        return (
          <p key={block.start} className="rd-para">
            {parts}
          </p>
        );
      })}
    </>
  );
}

function CompactCard({ id, onClose }: { id: string; onClose: () => void }) {
  const [card, setCard] = useState<WordCard | null>(null);
  useEffect(() => {
    let alive = true;
    fetchWord(id)
      .then((data) => alive && setCard(data))
      .catch(() => alive && setCard(null));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="rd-sheet-mask" onClick={onClose}>
      <div className="rd-sheet" onClick={(event) => event.stopPropagation()}>
        {!card ? (
          <span className="learn-dim">加载词条…</span>
        ) : (
          <>
            <div className="rd-sheet-head">
              <strong>{card.lemma}</strong>
              <span className="learn-dim">
                {card.pos} · {card.cefrLevel}
              </span>
            </div>
            <p className="flash-zh">{card.zhFullAnnotation}</p>
            {card.exampleSentence ? (
              <p className="flash-example">
                {card.exampleSentence}
                <span className="flash-source"> — {card.exampleSource}</span>
              </p>
            ) : null}
            <span className="learn-dim">{card.audioUrl ? "可播放" : "音频暂不可用"}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function ReadingView({
  onFlow,
  onGoListening,
}: {
  onFlow: (update: FlowUpdate) => void;
  onGoListening: () => void;
}) {
  const [passage, setPassage] = useState<Passage | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [bottom, setBottom] = useState(false);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [showZh, setShowZh] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchReading()
      .then((data) => {
        setPassage(data.passage);
        setBottom(data.flow.reading.reachedBottom);
        setConfirmed(data.flow.reading.grammarConfirmed ? ["*"] : []);
      })
      .catch((err) => {
        if (err instanceof LockedError) setReason(err.gate.reason ?? "尚未解锁阅读");
        else setError(String((err as Error).message ?? err));
      });
  }, []);

  // 底部检测：哨兵进入视口才算读到末尾，真实距离由 IntersectionObserver 给
  useEffect(() => {
    if (!passage || bottom || !sentinel.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        postBottom()
          .then(() => setBottom(true))
          .catch(() => setError("阅读进度记录失败，请重试"));
      },
      { threshold: 0.6 },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [passage, bottom]);

  const confirm = useCallback(
    async (grammarId: string) => {
      try {
        await postGrammarTouch(grammarId);
        const result = await postGrammarConfirm(grammarId);
        setConfirmed((prev) => [...prev, grammarId]);
        onFlow(result);
      } catch (err) {
        setError(String((err as Error).message ?? err));
      }
    },
    [onFlow],
  );

  if (reason) {
    return (
      <div className="learn-empty">
        <p>{reason}</p>
        <p className="learn-dim">回到「背单词」把今天的卡片过完，阅读会自动解锁。</p>
      </div>
    );
  }
  if (error) return <div className="learn-empty">{error}</div>;
  if (!passage) return <div className="learn-loading">正在装配今日阅读…</div>;

  const unlocked = bottom && confirmed.length > 0;

  return (
    <div className="reading">
      <div className="rd-meta">
        <span>{passage.wordCount} 词</span>
        <span>{passage.highlightedCardIds.length} 个今日词</span>
        {passage.degraded ? <span className="rd-degraded">拼装稿</span> : <span>作者稿</span>}
      </div>

      <article className="rd-text">
        <Paragraphs passage={passage} onWord={setSheetId} />
        <div ref={sentinel} className="rd-sentinel" />
      </article>

      <div className="rd-toolbar">
        <button type="button" className={`learn-btn ${showZh ? "is-primary" : ""}`} onClick={() => setShowZh((value) => !value)}>
          {showZh ? "收起译文" : "通篇翻译"}
        </button>
        <span className="learn-dim">{bottom ? "已读到末尾" : "滑到底部解锁下一步"}</span>
      </div>

      {showZh ? (
        <section className="rd-translation">
          {passage.fullTranslationZh
            .split(/\n{2,}/)
            .map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
        </section>
      ) : null}

      <section className="rd-grammar">
        <h3>今日语法点</h3>
        <p className="learn-dim">语法不在单独章节里学，全部锚定在这篇文章上。每个点都要先看文中证据，再点「已理解」。</p>
        {passage.grammarPoints.map((point) => {
          const done = confirmed.includes(point.grammarId) || confirmed.includes("*");
          return (
            <article key={point.grammarId} className={`rd-gp ${done ? "is-done" : ""}`}>
              <header>
                <strong>{point.titleZh}</strong>
                <span className={`rd-outline ${point.outline === "拓展" ? "is-extra" : ""}`}>{point.outline}</span>
              </header>
              <p>{point.explainZh}</p>
              <blockquote>
                {point.evidenceSentence}
                <em>文中证据 · 第 {point.evidenceSpan[0]}–{point.evidenceSpan[1]} 字符</em>
              </blockquote>
              {point.extraEvidence.map((item, index) => (
                <blockquote key={index} className="is-extra-evidence">
                  {item.evidenceSentence}
                  <em>补充证据</em>
                </blockquote>
              ))}
              <div className="rd-contrast">
                <span className="is-wrong">✗ {point.contrast.wrong}</span>
                <span className="is-right">✓ {point.contrast.right}</span>
                <em>{point.contrast.note}</em>
              </div>
              <button type="button" className="learn-btn" disabled={done} onClick={() => void confirm(point.grammarId)}>
                {done ? "已确认" : "已理解，确认"}
              </button>
            </article>
          );
        })}
      </section>

      <div className="rd-next">
        {unlocked ? (
          <button type="button" className="learn-btn is-primary" onClick={onGoListening}>
            去听力
          </button>
        ) : (
          <p className="learn-dim">
            {bottom ? "" : "先滑到文章末尾；"}至少确认一个语法点后解锁听力。
          </p>
        )}
      </div>

      {sheetId ? <CompactCard id={sheetId} onClose={() => setSheetId("")} /> : null}
    </div>
  );
}
