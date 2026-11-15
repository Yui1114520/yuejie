export interface Inflection {
  form: string;
  tags: string[];
}

export interface Collocation {
  phrase: string;
  count: number;
}

export interface WordCard {
  id: string;
  lemma: string;
  pos: string;
  zhFullAnnotation: string;
  exampleSentence: string;
  sampleSentences: string[];
  exampleSource: string;
  exampleLicense: string;
  inflections: Inflection[];
  fixedCollocations: Collocation[];
  morphologyNote: string;
  historyNote: string;
  ipa: string;
  ipaSource: string;
  audioUrl: string;
  audioName: string;
  audioSource: string;
  audioLicense: string;
  cefrLevel: string;
  sourceEntryId: string;
  freqRank: number;
  seq?: number;
  reviewed?: boolean;
  markedLater?: boolean;
}

export interface Flow {
  dateKey: string;
  vocabulary: { total: number; reviewed: number; completed: boolean };
  reading: { unlocked: boolean; reachedBottom: boolean; grammarConfirmed: boolean; completed: boolean };
  listening: { unlocked: boolean; played: boolean; completed: boolean };
  stats: { newCardsSeen: number; minutesSpent: number; streaks: number };
  mixedMode: boolean;
  target: number;
  dayComplete: boolean;
  updatedAt: string;
}

export interface Gate {
  ok: boolean;
  redirect?: string;
  reason?: string;
}

export interface Gates {
  reading: Gate;
  listening: Gate;
}

/** 状态变更接口的统一返回：flow 与最新的守卫判定必须一起用，否则前端会拿着旧 gates 反复重定向 */
export interface FlowUpdate {
  ok: boolean;
  flow: Flow;
  gates?: Gates;
}

export interface LearnState extends Flow {
  pool: { size: number; seen: number; target: number };
  settings: { dailyTarget: number; intensityConfirmed: boolean };
  gates: { reading: Gate; listening: Gate };
  readingReady: boolean;
  passage: { id: string; wordCount: number; degraded: boolean; audioUrl: string } | null;
}

export interface GrammarPoint {
  grammarId: string;
  titleZh: string;
  outline: "四级" | "拓展";
  explainZh: string;
  contrast: { wrong: string; right: string; note: string };
  evidenceSentence: string;
  evidenceSpan: [number, number];
  extraEvidence: { evidenceSentence: string; evidenceSpan: [number, number] }[];
}

export interface Passage {
  dateKey: string;
  textDe: string;
  tokenized: { word: string; start: number; end: number; cardId?: string; isHighlight: boolean }[];
  highlightedCardIds: string[];
  fullTranslationZh: string;
  grammarPoints: GrammarPoint[];
  audioUrl: string;
  verified: boolean;
  degraded: boolean;
  wordCount: number;
}

export interface GrammarEntry {
  id: string;
  titleZh: string;
  outline: "四级" | "拓展";
  explainZh: string;
  contrast: { wrong: string; right: string; note: string };
  today: boolean;
  status: "untouched" | "touched" | "confirmed";
}

export interface StatsPayload {
  dateKey: string;
  ring: { target: number; reviewed: number; readingCompleted: boolean; listeningCompleted: boolean };
  week: { dateKey: string; newCards: number; readingDone: boolean; listeningDone: boolean; minutes: number }[];
  coverage: { seen: number; pool: number };
  grammar: { id: string; titleZh: string; outline: "四级" | "拓展"; status: "untouched" | "touched" | "confirmed" }[];
  errorPool: (WordCard & { marks: number; lastDay: string; weight: number })[];
  streak: number;
  minutes: number;
}
