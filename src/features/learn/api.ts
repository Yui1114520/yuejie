import { apiUrl } from "../../lib/api";
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

export function fetchState(date?: string) {
  return request<LearnState>(`/state${date ? `?date=${date}` : ""}`);
}

export function fetchCards(from: number, to: number) {
  return request<{ cards: WordCard[] }>(`/cards?from=${from}&to=${to}`);
}

export function fetchWord(id: string) {
  return request<WordCard>(`/word/${encodeURIComponent(id)}`);
}

export function postReview(seq: number) {
  return request<FlowUpdate & { left: number }>("/review", { method: "POST", body: JSON.stringify({ seq }) });
}

export function postLater(seq: number) {
  return request<FlowUpdate & { left: number }>("/later", { method: "POST", body: JSON.stringify({ seq }) });
}

export function postExit(minutes: number) {
  return request<FlowUpdate & { note: string }>("/exit", { method: "POST", body: JSON.stringify({ minutes }) });
}

export function fetchReading() {
  return request<{ passage: Passage; flow: Flow }>("/reading");
}

export function postBottom() {
  return request<FlowUpdate>("/reading/bottom", { method: "POST", body: "{}" });
}

export function postGrammarTouch(grammarId: string) {
  return request<{ ok: boolean }>("/grammar/touch", { method: "POST", body: JSON.stringify({ grammarId }) });
}

export function postGrammarConfirm(grammarId: string) {
  return request<FlowUpdate>("/grammar/confirm", { method: "POST", body: JSON.stringify({ grammarId }) });
}

export function fetchGrammarIndex() {
  return request<{ today: GrammarPoint[]; catalog: GrammarEntry[]; mainline: number; mastered: number }>("/grammar");
}

export function fetchListening() {
  return request<{ audioUrl: string; audioAvailable: boolean; textDe: string; hintZh: string; flow: Flow }>("/listening");
}

export function postPlayed() {
  return request<FlowUpdate>("/listening/played", { method: "POST", body: "{}" });
}

export function fetchStats() {
  return request<StatsPayload>("/stats");
}

export function postSettings(payload: { target?: number; intensityConfirmed?: boolean }) {
  return request<{ ok: boolean; dailyTarget: number; intensityConfirmed: boolean }>("/settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
