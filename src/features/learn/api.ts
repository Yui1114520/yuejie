import { apiUrl, isStaticSite } from "../../lib/api";
import * as local from "./localStore";
import type { Flow, FlowUpdate, Gate, GrammarEntry, GrammarPoint, LearnState, Passage, StatsPayload, WordCard } from "./types";

export class LockedError extends Error {
  gate: Gate;
  constructor(gate: Gate) {
    super(gate.reason ?? "尚未解锁");
    this.gate = gate;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(`/api/learn${path}`), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (res.status === 423) throw new LockedError(body as Gate);
  if (!res.ok) throw new Error((body as { error?: string })?.error ?? `请求失败 (${res.status})`);
  return body as T;
}

// 静态版把「未解锁」也从 localStore 抛出来，这里统一转成 LockedError，视图不用分两套
async function locked<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const gate = (error as { gate?: Gate }).gate;
    if (gate) throw new LockedError(gate);
    throw error;
  }
}

export function fetchState(date?: string) {
  if (isStaticSite) return local.localState(date);
  return request<LearnState>(`/state${date ? `?date=${date}` : ""}`);
}

export function fetchCards(from: number, to: number) {
  if (isStaticSite) return local.localCards(from, to);
  return request<{ cards: WordCard[] }>(`/cards?from=${from}&to=${to}`);
}

export function fetchWord(id: string) {
  if (isStaticSite) return local.localWord(id);
  return request<WordCard>(`/word/${encodeURIComponent(id)}`);
}

export function postReview(seq: number) {
  if (isStaticSite) return local.localAction("review", seq);
  return request<FlowUpdate & { left: number }>("/review", { method: "POST", body: JSON.stringify({ seq }) });
}

export function postLater(seq: number) {
  if (isStaticSite) return local.localAction("later", seq);
  return request<FlowUpdate & { left: number }>("/later", { method: "POST", body: JSON.stringify({ seq }) });
}

export function postExit(minutes: number) {
  if (isStaticSite) return local.localExit(minutes);
  return request<FlowUpdate & { note: string }>("/exit", { method: "POST", body: JSON.stringify({ minutes }) });
}

export function fetchReading() {
  if (isStaticSite) return locked(() => local.localReading());
  return request<{ passage: Passage; flow: Flow }>("/reading");
}

export function postBottom() {
  if (isStaticSite) return local.localBottom();
  return request<FlowUpdate>("/reading/bottom", { method: "POST", body: "{}" });
}

export function postGrammarTouch(grammarId: string) {
  // 静态版没有后端账本，接触状态在打开阅读时记入 localStorage
  if (isStaticSite) return Promise.resolve({ ok: true });
  return request<{ ok: boolean }>("/grammar/touch", { method: "POST", body: JSON.stringify({ grammarId }) });
}

export function postGrammarConfirm(grammarId: string) {
  if (isStaticSite) return local.localConfirmGrammar(grammarId);
  return request<FlowUpdate>("/grammar/confirm", { method: "POST", body: JSON.stringify({ grammarId }) });
}

export function fetchGrammarIndex() {
  if (isStaticSite) return local.localGrammarIndex();
  return request<{ today: GrammarPoint[]; catalog: GrammarEntry[]; mainline: number; mastered: number }>("/grammar");
}

export function fetchListening() {
  if (isStaticSite) return locked(() => local.localListening());
  return request<{ audioUrl: string; audioAvailable: boolean; textDe: string; hintZh: string; flow: Flow }>("/listening");
}

export function postPlayed() {
  if (isStaticSite) return local.localPlayed();
  return request<FlowUpdate>("/listening/played", { method: "POST", body: "{}" });
}

export function fetchStats() {
  if (isStaticSite) return local.localStats();
  return request<StatsPayload>("/stats");
}

export function postSettings(payload: { target?: number; intensityConfirmed?: boolean }) {
  if (isStaticSite) return local.localSettings(payload);
  return request<{ ok: boolean; dailyTarget: number; intensityConfirmed: boolean }>("/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
