export type RegionId = "global" | "mideast" | "europe" | "asia" | "americas" | "africa";
export type ModuleId = "world" | "domestic" | "economy" | "science" | "military";
export type ScienceTopicId = "physics" | "chemistry" | "biology" | "computing" | "applied" | "general";
export type ZoneTone = "hot" | "warm" | "watch" | "idle";

export interface SourceRef {
  id: string;
  name: string;
  shortName: string;
  accent: string;
}

export interface RelatedArticle {
  sourceName: string;
  title: string;
  link: string;
  publishedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  titleOriginal: string | null;
  translated: boolean;
  sourceLang?: string;
  summary: string;
  summaryOriginal: string | null;
  image: string | null;
  link: string;
  publishedAt: string;
  region: RegionId;
  heat: number;
  seriousness: number;
  blueOcean: number;
  isBlueOcean: boolean;
  pushCandidate: boolean;
  crime?: boolean;
  topic?: ScienceTopicId | null;
  topicLabel?: string | null;
  subtopic?: string | null;
  subtopicLabel?: string | null;
  zone?: string | null;
  zoneLabel?: string | null;
  province?: string | null;
  provinceLabel?: string | null;
  document?: boolean;
  movement?: boolean;
  sourceCount: number;
  sources: SourceRef[];
  related: RelatedArticle[];
}

export interface PersonArticleRef {
  id: string;
  title: string;
  heat: number;
}

export interface Person {
  id: string;
  name: string;
  nameEn: string;
  role: string;
  bio: string;
  accent: string;
  initial: string;
  mentions: number;
  heat: number;
  articles: PersonArticleRef[];
}

export interface SourceStatus {
  id: string;
  name: string;
  shortName: string;
  ok: boolean;
  error: string | null;
  latencyMs: number;
  fetchedAt: string;
  accent: string;
}

export interface ZoneSituation {
  id: string;
  label: string;
  lat: number;
  lon: number;
  count: number;
  intensity: number;
  tone: ZoneTone;
  reports: NewsItem[];
}

export interface MarketIndex {
  id: string;
  name: string;
  code: string;
  market: "cn" | "hk" | "us";
  price: number;
  change: number | null;
  pct: number | null;
  time: string | null;
}

export interface MarketSnapshot {
  ok: boolean;
  updatedAt: string | null;
  indices: MarketIndex[];
  stale?: boolean;
  error?: string;
}

export interface MarketStock {
  code: string;
  name: string;
  price: number;
  change: number | null;
  pct: number;
  time: string | null;
}

export interface MoversSnapshot {
  ok: boolean;
  index: { id: string; name: string; market: "cn" | "hk" | "us" } | null;
  updatedAt: string | null;
  gainers: MarketStock[];
  losers: MarketStock[];
  stocks: MarketStock[];
  stale?: boolean;
  error?: string;
}

export interface NewsPayload {
  module: ModuleId;
  moduleLabel: string;
  generatedAt: string;
  meta: {
    onlineSources: number;
    totalSources: number;
    totalArticles: number;
    clusters: number;
    totalClusters?: number;
    filtered?: {
      opinion: number;
      soft: number;
      crime?: number;
      other: number;
      total: number;
    };
    push?: {
      candidates: number;
      suppressed: number;
    };
    relay?: {
      configured: boolean;
      pending: { id: string; name: string; shortName: string; lang: string; focus?: string }[];
    };
    buildMs: number;
    building: boolean;
    sources: SourceStatus[];
    translation?: {
      cachedEntries: number;
      requests: number;
      myMemoryCooldown: boolean;
    };
  };
  hero: NewsItem | null;
  spotlight: NewsItem[];
  ranking: NewsItem[];
  latest: NewsItem[];
  people: Person[];
  regions: { id: RegionId; label: string; count: number }[];
  all: NewsItem[];
  topics?: { id: ScienceTopicId; label: string; count: number }[];
  movements?: NewsItem[];
  situation?: {
    zones: ZoneSituation[];
    reportsTotal: number;
    updatedAt: string;
  };
  provinces?: {
    id: string;
    label: string;
    count: number;
    items: NewsItem[];
  }[];
  documents?: NewsItem[];
}

export type TabId = "news" | "papers" | "learn" | "me";

export interface PressWork {
  key: string;
  kind: "paper" | "article";
  title: string;
  titleZh: string | null;
  abstract: string;
  abstractZh: string | null;
  journal: string;
  account: string | null;
  url: string;
  doi: string | null;
  authors: string;
  published: string;
  cited: number;
  tier: number;
  field: string | null;
  interest: string | null;
  lang: string;
  oa: boolean;
  saved: boolean;
  viewed: boolean;
  source: string;
  score: number;
  velocity: number;
  reasons: string[];
}

export interface PressChannel {
  id: string;
  kind: "rss" | "wechat-article" | "wechat-album";
  label: string;
  url: string;
  ok: boolean;
  note: string;
  items: number;
  lastRun: string | null;
  addedAt: string;
}

export interface PressPayload {
  generatedAt: string;
  meta: {
    harvest: {
      at: string | null;
      ms: number;
      skipped: boolean;
      stored: number;
      pruned: number;
    };
    indexers: { id: string; label: string; ok: boolean; note?: string; count?: number }[];
    counts: {
      papers: number;
      articles: number;
      saved: number;
      viewed: number;
      oldest: string | null;
      newest: string | null;
    };
    interest: { id: string; label: string } | null;
    interests: { id: string; label: string; count: number }[];
    profile: {
      signals: number;
      samples: number;
      topTerms: { term: string; weight: number }[];
    };
    translation?: { translated: number; abstracts: number; pending?: boolean; queued?: number };
    buildMs: number;
    lastError: string | null;
  };
  papers: PressWork[];
  rising: PressWork[];
  articles: PressWork[];
  channels: PressChannel[];
}
