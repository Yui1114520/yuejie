import { useEffect, useRef, useState } from "react";
import { fetchListening, LockedError, postPlayed } from "./api";
import type { Flow, FlowUpdate } from "./types";

export function ListeningView({ onFlow }: { onFlow: (update: FlowUpdate) => void }) {
  const [data, setData] = useState<{ audioUrl: string; audioAvailable: boolean; textDe: string; hintZh: string; flow: Flow } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [played, setPlayed] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchListening()
      .then((payload) => {
        setData(payload);
        setPlayed(payload.flow.listening.played);
      })
      .catch((err) => {
        if (err instanceof LockedError) setReason(err.gate.reason ?? "尚未解锁听力");
        else setError(String((err as Error).message ?? err));
      });
  }, []);

  const toggle = () => {
    if (!audio.current) return;
    if (playing) {
      audio.current.pause();
      setPlaying(false);
    } else {
      void audio.current.play();
      setPlaying(true);
    }
  };

  const finish = async () => {
    try {
      const result = await postPlayed();
      setPlayed(true);
      setPlaying(false);
      onFlow(result);
      // 原文是「听完才下发」的，标记完成后要重新取一次才能立刻显示
      const refreshed = await fetchListening();
      setData(refreshed);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    }
  };

  if (reason) {
    return (
      <div className="learn-empty">
        <p>{reason}</p>
        <p className="learn-dim">阅读滑到底部、并确认至少一个语法点后，听力才解锁。</p>
      </div>
    );
  }
  if (error) return <div className="learn-empty">{error}</div>;
  if (!data) return <div className="learn-loading">准备听力…</div>;

  return (
    <div className="listening">
      <div className="ls-hint">{data.hintZh}</div>

      {data.audioAvailable ? (
        <div className="ls-player">
          <audio
            ref={audio}
            src={data.audioUrl}
            onTimeUpdate={(event) => {
              const el = event.currentTarget;
              setProgress(el.duration ? el.currentTime / el.duration : 0);
            }}
            onEnded={() => void finish()}
          />
          <button type="button" className="ls-play" onClick={toggle}>
            {playing ? "暂停" : "播放"}
          </button>
          <div className="ls-progress">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <div className="ls-degraded">
          <strong>本日听力暂不可用</strong>
          <p>
            本机没有可用的离线语音合成（piper 无 Windows 轮子、系统无德语语音包），Wikimedia
            音频直连也不可达，因此当日文章音频未能预生成。
          </p>
          <p className="learn-dim">这不影响进入次日：听力页降级处理，阅读完成状态已经保留。</p>
        </div>
      )}

      {!played ? (
        <button type="button" className="learn-btn is-primary" onClick={() => void finish()}>
          {data.audioAvailable ? "已听完一遍" : "本日无音频，标记为已听"}
        </button>
      ) : (
        <div className="ls-done">今日听力已完成。</div>
      )}

      <section className={`ls-text ${played ? "is-open" : ""}`}>
        <h3>原文</h3>
        {played ? (
          <p>{data.textDe || "原文需要重新加载，切到听力页或刷新即可显示。"}</p>
        ) : (
          <p className="learn-dim">听完一遍后显示原文，避免边听边读。</p>
        )}
      </section>
    </div>
  );
}
