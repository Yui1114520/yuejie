// 德语词库导入：Wiktionary 派生 CSV（词形/词频/音频名）+ Tatoeba 语料（例句/搭配）+ 批量中文释义。
// 语料里没有的字段（历史词源、经校验的 IPA）一律留空，不编造。
import fs from "node:fs";
import path from "node:path";
import {
  RAW_DIR,
  GLOSS_FILE,
  loadRaw,
  loadSentences,
  buildIndex,
  chooseExample,
  sampleSentences,
  collocationsFor,
  inflectionsFor,
  morphologyFor,
  selectCandidates,
  cefrBand,
  posZh,
} from "../server/learn/de-source.mjs";
import { upsertWord, POOL_TARGET } from "../server/learn/store.mjs";

const limit = Number(process.argv[2] ?? POOL_TARGET);
const raw = loadRaw();
const candidates = selectCandidates(raw.words, limit);

const sentenceFile = path.join(RAW_DIR, "deu_sentences.tsv");
const hasSentences = fs.existsSync(sentenceFile);
const sentences = hasSentences ? loadSentences(sentenceFile) : [];
const lemmaSet = new Set(candidates.map((item) => item.key));
const index = sentences.length ? buildIndex(sentences, lemmaSet) : new Map();

const gloss = fs.existsSync(GLOSS_FILE) ? JSON.parse(fs.readFileSync(GLOSS_FILE, "utf8")) : {};
const wordZhFile = path.join(RAW_DIR, "..", "word-zh.json");
const wordZh = fs.existsSync(wordZhFile) ? JSON.parse(fs.readFileSync(wordZhFile, "utf8")) : {};

// 优先词目直译（de→zh），其次英文释义的译文，最后原样保留英文并标明未翻译
function annotation(candidate) {
  const direct = wordZh[candidate.lemma]?.text?.trim();
  if (direct) return direct;

  const hit = gloss[candidate.gloss]?.text;
  // 两个机器翻译源都用尽额度时，至少把英文释义原样摆出来，不假装有中文
  if (!hit) return `英文释义：${candidate.gloss}`;
  const senses = hit
    .split(/[,，;；、\|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, position, list) => list.indexOf(item) === position)
    .slice(0, 6);
  if (!senses.length) return hit;
  return senses.length === 1 ? hit : senses.map((item, i) => `${"①②③④⑤⑥"[i]} ${item}`).join("  ");
}

const stats = { total: 0, example: 0, inflected: 0, colloc: 0, untranslated: 0, compound: 0 };
const cards = [];

for (const [position, candidate] of candidates.entries()) {
  const { inflections, gender } = inflectionsFor(candidate, raw);
  const entry = { ...candidate, inflections };
  const morphology = morphologyFor(entry, gender, lemmaSet);
  const example = sentences.length ? chooseExample(index, candidate.key, sentences, candidate.wortart) : null;
  const samples = sentences.length ? sampleSentences(index, candidate.key, sentences, 4) : [];
  const collocations = sentences.length ? collocationsFor(index, candidate.key, 3) : [];

  stats.total += 1;
  if (example) stats.example += 1;
  if (inflections.length) stats.inflected += 1;
  if (collocations.length) stats.colloc += 1;
  if (!wordZh[candidate.lemma]?.text && !gloss[candidate.gloss]) stats.untranslated += 1;
  if (morphology.includes("复合词")) stats.compound += 1;

  const card = {
    id: `de:${candidate.key}`,
    lemma: candidate.lemma,
    pos: posZh(candidate.wortart),
    zhFullAnnotation: annotation(candidate),
    exampleSentence: example?.text ?? "",
    sampleSentences: samples,
    exampleSource: example ? `Tatoeba 德语语料 #${example.id}` : "",
    exampleLicense: example ? "CC-BY 2.0 FR" : "",
    inflections,
    fixedCollocations: collocations,
    morphologyNote: morphology,
    historyNote: "",
    ipa: "",
    ipaSource: "",
    audioUrl: "",
    audioName: candidate.audio,
    audioSource: candidate.audio ? "wikimedia-commons-hoerbeispiele" : "",
    audioLicense: "",
    cefrLevel: cefrBand(position),
    sourceEntryId: `dewikt:${candidate.lemma}:${candidate.rank}`,
    freqRank: candidate.rank,
    freq: candidate.freq,
  };
  cards.push(card);
  upsertWord(card);
}

const report = [
  `词库写入 ${cards.length} 条（目标 ${POOL_TARGET}）`,
  `例句覆盖 ${stats.example}/${stats.total}（${((stats.example / stats.total) * 100).toFixed(1)}%）`,
  `词形变化覆盖 ${stats.inflected}/${stats.total}`,
  `固定搭配覆盖 ${stats.colloc}/${stats.total}`,
  `复合词拆分覆盖 ${stats.compound}/${stats.total}`,
  `释义未翻译 ${stats.untranslated}/${stats.total}`,
  `语料句数 ${sentences.length}，命中词形 ${index.size}`,
  `音频：audioName 有 ${cards.filter((c) => c.audioName).length} 条，audioUrl 全部为空（Commons 本机不可达）`,
].join("\n");
fs.writeFileSync(path.join(RAW_DIR, "import-report.txt"), report, "utf8");
console.log(report);
