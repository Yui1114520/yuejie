// 导出公网静态版要用的学习数据：2400 词 + 作者稿阅读与语法点。
// 学习进度不在这里——公网版把进度存在浏览器 localStorage（见 src/features/learn/localStore.ts）。
// 产物 data/learn/bundle.json 会进仓库，CI 上直接复用，不必依赖本地 sqlite。
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../server/cache.mjs";
import { listPool, POOL_TARGET } from "../server/learn/store.mjs";
import { analyzePassage } from "../server/learn/reading.mjs";

const OUT = path.join(DATA_DIR, "learn", "bundle.json");
const PASSAGES = path.join(DATA_DIR, "learn", "passages");

const pool = listPool().map((card) => ({
  id: card.id,
  lemma: card.lemma,
  pos: card.pos,
  zhFullAnnotation: card.zhFullAnnotation,
  exampleSentence: card.exampleSentence,
  exampleSource: card.exampleSource,
  exampleLicense: card.exampleLicense,
  inflections: card.inflections,
  fixedCollocations: card.fixedCollocations,
  morphologyNote: card.morphologyNote,
  historyNote: card.historyNote,
  cefrLevel: card.cefrLevel,
  freqRank: card.freqRank,
}));

const passages = fs
  .readdirSync(PASSAGES)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => {
    const raw = JSON.parse(fs.readFileSync(path.join(PASSAGES, name), "utf8"));
    return {
      id: raw.id ?? name.replace(/\.json$/, ""),
      titleZh: raw.titleZh ?? "",
      textDe: raw.textDe,
      translationZh: raw.translationZh ?? "",
      grammarPoints: analyzePassage(raw.textDe),
    };
  });

if (pool.length < POOL_TARGET * 0.9) {
  throw new Error(`词库只有 ${pool.length} 条，低于目标 ${POOL_TARGET}，不导出`);
}
if (!passages.length) throw new Error("没有任何作者稿阅读文本，不导出");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), poolSize: pool.length, pool, passages }),
  "utf8",
);

const size = fs.statSync(OUT).size;
console.log(
  `学习 bundle：${pool.length} 词 / ${passages.length} 篇阅读 / ${(size / 1048576).toFixed(2)} MB → ${OUT}`,
);
console.log(`语法点覆盖：${passages.map((p) => `${p.id} ${p.grammarPoints.length} 个`).join("，")}`);
