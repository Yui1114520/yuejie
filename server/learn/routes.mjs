import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../cache.mjs";
import {
  POOL_TARGET,
  addMinutes,
  cardAt,
  confirmGrammar,
  dailySeries,
  dailyTarget,
  ensureBatch,
  errorPool,
  flowGate,
  getSetting,
  getWord,
  grammarLedger,
  listCards,
  loadFlow,
  loadPassage,
  markBottom,
  markLater,
  markPlayed,
  poolSize,
  reviewCard,
  seenCount,
  setSetting,
  snapshot,
  streakDays,
  todayKey,
  touchGrammar,
} from "./store.mjs";
import { GRAMMAR_POINTS } from "./grammar-de.mjs";
import { ensurePassage } from "./reading.mjs";

const AUDIO_DIR = path.join(DATA_DIR, "learn", "audio");

function blocked(res, gate) {
  res.status(423).json(gate);
}

// 每次状态变更都把最新的守卫判定一起回给前端，避免前端拿旧 gates 反复重定向
function withGates(dateKey, result) {
  return {
    ...result,
    gates: { reading: flowGate("reading", dateKey), listening: flowGate("listening", dateKey) },
  };
}

// 前置条件不满足就带着原因退回上一环，前端只负责显示 redirect 与 reason
function guard(res, stage, dateKey) {
  const gate = flowGate(stage, dateKey);
  if (!gate.ok) {
    blocked(res, gate);
    return false;
  }
  return true;
}

export function mountLearn(app) {
  app.get("/api/learn/state", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    const flow = snapshot(dateKey);
    res.set("cache-control", "no-store");
    res.json({
      ...flow,
      target: dailyTarget(),
      pool: { size: poolSize(), seen: seenCount(), target: POOL_TARGET },
      settings: { dailyTarget: dailyTarget(), intensityConfirmed: getSetting("intensity_confirmed", "0") === "1" },
      gates: {
        reading: flowGate("reading", dateKey),
        listening: flowGate("listening", dateKey),
      },
    });
  });

  app.get("/api/learn/cards", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    const from = Math.max(0, Number(req.query.from ?? 0));
    const to = Math.min(Number(req.query.to ?? from + 19), from + 49);
    const cards = listCards(dateKey, from, to);
    res.set("cache-control", "no-store");
    res.json({ dateKey, from, to, cards });
  });

  app.get("/api/learn/word/:id", (req, res) => {
    const word = getWord(String(req.params.id ?? ""));
    if (!word) {
      res.status(404).json({ error: "词条不存在" });
      return;
    }
    res.json(word);
  });

  app.post("/api/learn/review", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    const seq = Number(req.body?.seq);
    if (!Number.isInteger(seq) || seq < 0) {
      res.status(400).json({ ok: false, error: "seq 不合法" });
      return;
    }
    const result = reviewCard(seq, dateKey);
    res.status(result.ok ? 200 : 409).json(withGates(dateKey, result));
  });

  app.post("/api/learn/later", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    const seq = Number(req.body?.seq);
    if (!Number.isInteger(seq) || seq < 0) {
      res.status(400).json({ ok: false, error: "seq 不合法" });
      return;
    }
    const result = markLater(seq, dateKey);
    res.status(result.ok ? 200 : 409).json(withGates(dateKey, result));
  });

  app.post("/api/learn/exit", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    const minutes = Number(req.body?.minutes ?? 0);
    res.json({ ok: true, flow: addMinutes(minutes, dateKey), gates: { reading: flowGate("reading", dateKey), listening: flowGate("listening", dateKey) }, note: "今日进度已保留，明日继续" });
  });

  app.get("/api/learn/reading", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    if (!guard(res, "reading", dateKey)) return;
    const cards = listCards(dateKey);
    const passage = ensurePassage(dateKey, cards);
    res.set("cache-control", "no-store");
    res.json({ ok: true, passage, flow: loadFlow(dateKey) });
  });

  app.post("/api/learn/reading/bottom", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    const result = markBottom(dateKey);
    res.status(result.ok ? 200 : 423).json(withGates(dateKey, result));
  });

  app.post("/api/learn/grammar/touch", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    if (!guard(res, "reading", dateKey)) return;
    const grammarId = String(req.body?.grammarId ?? "").slice(0, 60);
    res.json(touchGrammar(grammarId, dateKey));
  });

  // 语法确认是解锁听力的最後一环：到底 + 至少一条语法确认
  app.post("/api/learn/grammar/confirm", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    const grammarId = String(req.body?.grammarId ?? "").slice(0, 60);
    if (!grammarId) {
      res.status(400).json({ ok: false, error: "缺少 grammarId" });
      return;
    }
    const flow = loadFlow(dateKey);
    if (flow.reading.unlocked && !flow.reading.reachedBottom) {
      blocked(res, { ok: false, redirect: "reading", reason: "先把阅读滑到底部，再确认语法点" });
      return;
    }
    const result = confirmGrammar(grammarId, dateKey);
    res.status(result.ok ? 200 : 423).json(withGates(dateKey, result));
  });

  app.get("/api/learn/grammar", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    const ledger = grammarLedger();
    const passage = loadPassage(dateKey);
    const todayIds = new Set((passage?.grammarPoints ?? []).map((point) => point.grammarId));
    res.json({
      today: passage?.grammarPoints ?? [],
      catalog: GRAMMAR_POINTS.map((point) => ({
        id: point.id,
        titleZh: point.titleZh,
        outline: point.outline,
        explainZh: point.explainZh,
        contrast: point.contrast,
        today: todayIds.has(point.id),
        status: ledger[point.id] ?? "untouched",
      })),
      mainline: GRAMMAR_POINTS.filter((point) => point.outline === "四级").length,
      mastered: Object.entries(ledger).filter(([, status]) => status === "confirmed").length,
    });
  });

  app.get("/api/learn/listening", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    if (!guard(res, "listening", dateKey)) return;
    const cards = listCards(dateKey);
    const passage = ensurePassage(dateKey, cards);
    // 原文在听完一遍之前不下发，避免边听边读
    const flow = loadFlow(dateKey);
    res.set("cache-control", "no-store");
    res.json({
      ok: true,
      audioUrl: passage.audioUrl || "",
      audioAvailable: Boolean(passage.audioUrl),
      textDe: flow.listening.played ? passage.textDe : "",
      hintZh: "先听一遍，再对原文",
      flow,
    });
  });

  app.post("/api/learn/listening/played", (req, res) => {
    const dateKey = String(req.body?.date ?? todayKey());
    const result = markPlayed(dateKey);
    res.status(result.ok ? 200 : 423).json(withGates(dateKey, result));
  });

  app.get("/api/learn/stats", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    const flow = loadFlow(dateKey);
    const ledger = grammarLedger();
    const series = dailySeries(7);
    res.json({
      dateKey,
      ring: {
        target: flow.vocabulary.total,
        reviewed: flow.vocabulary.reviewed,
        readingCompleted: flow.reading.completed,
        listeningCompleted: flow.listening.completed,
      },
      week: series,
      coverage: { seen: seenCount(), pool: POOL_TARGET },
      grammar: GRAMMAR_POINTS.map((point) => ({
        id: point.id,
        titleZh: point.titleZh,
        outline: point.outline,
        status: ledger[point.id] ?? "untouched",
      })),
      errorPool: errorPool(dateKey, 20),
      streak: streakDays(),
      minutes: flow.stats.minutesSpent,
    });
  });

  app.get("/api/learn/audio", (req, res) => {
    const name = String(req.query.name ?? "");
    // 只允许命中缓存目录里的文件，挡住路径穿越
    if (!/^[\w.\-]+\.(ogg|mp3|wav)$/i.test(name)) {
      res.status(400).json({ error: "非法音频名" });
      return;
    }
    const file = path.join(AUDIO_DIR, name);
    if (!file.startsWith(AUDIO_DIR) || !fs.existsSync(file)) {
      res.status(404).json({ error: "音频暂不可用" });
      return;
    }
    res.sendFile(file);
  });

  app.post("/api/learn/settings", (req, res) => {
    const target = req.body?.target;
    if (target !== undefined) {
      const value = Math.round(Number(target));
      if (!Number.isFinite(value) || value < 10 || value > 5000) {
        res.status(400).json({ ok: false, error: "每日目标需在 10-5000 之间" });
        return;
      }
      setSetting("daily_target", value);
    }
    if (req.body?.intensityConfirmed) setSetting("intensity_confirmed", "1");
    res.json({ ok: true, dailyTarget: dailyTarget(), intensityConfirmed: getSetting("intensity_confirmed", "0") === "1" });
  });

  app.get("/api/learn/day/:seq", (req, res) => {
    const dateKey = String(req.query.date ?? todayKey());
    const card = cardAt(Number(req.params.seq), dateKey);
    if (!card) {
      res.status(404).json({ error: "该序号不在当日批次内" });
      return;
    }
    res.json(card);
  });

  // 首日批次与阅读文本预热，避免首屏等到第一次点击才生成
  app.post("/api/learn/warm", (_req, res) => {
    const dateKey = todayKey();
    const flow = ensureBatch(dateKey);
    const passage = flow.vocabulary.total ? ensurePassage(dateKey, listCards(dateKey)) : null;
    res.json({ ok: true, total: flow.vocabulary.total, passageWords: passage?.wordCount ?? 0 });
  });
}
