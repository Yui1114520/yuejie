// AC-1 至 AC-5 验收自测。跑法：node scripts/learn-acceptance.mjs
// 用 1999 年的测试日期键，跑完清掉测试批次与 seen 增量，不影响当天真实进度。
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "../server/cache.mjs";
import {
  confirmGrammar,
  ensureBatch,
  flowGate,
  listCards,
  loadFlow,
  markBottom,
  reviewCard,
  todayKey,
} from "../server/learn/store.mjs";
import { ensurePassage, validatePassage } from "../server/learn/reading.mjs";

const DB_FILE = path.join(DATA_DIR, "learn.sqlite3");
const DAY_A = "1999-01-01";
const DAY_B = "1999-01-02";

const db = new DatabaseSync(DB_FILE);
const sql = (text, ...params) => db.prepare(text).run(...params);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

function cleanup(dateKey) {
  sql("DELETE FROM flow WHERE date_key = ?", dateKey);
  sql("DELETE FROM batch WHERE date_key = ?", dateKey);
  sql("DELETE FROM passages WHERE date_key = ?", dateKey);
  sql("DELETE FROM grammar_marks WHERE date_key = ?", dateKey);
}

const seenBefore = new Set(db.prepare("SELECT word_id FROM seen").all().map((row) => row.word_id));

try {
  for (const dateKey of [DAY_A, DAY_B]) {
    cleanup(dateKey);
  }

  // ---- AC-1：1000 张里差 1 张时，阅读必须仍然锁着，且给出准确原因 ----
  const flowA = ensureBatch(DAY_A);
  check("AC-1 批次总数", flowA.vocabulary.total === 1000, `total=${flowA.vocabulary.total}`);

  for (let seq = 0; seq < 999; seq += 1) reviewCard(seq, DAY_A);
  const at999 = loadFlow(DAY_A);
  const gate999 = flowGate("reading", DAY_A);
  check("AC-1 999 张时未解锁", at999.reading.unlocked === false);
  check("AC-1 99% 不解锁阅读", gate999.ok === false && gate999.redirect === "vocabulary");
  check("AC-1 提示文案", gate999.reason === "还差 1 张卡片解锁阅读", gate999.reason ?? "");
  check("AC-1 已复习计数", at999.vocabulary.reviewed === 999, `reviewed=${at999.vocabulary.reviewed}`);

  reviewCard(999, DAY_A);
  const at1000 = loadFlow(DAY_A);
  check("AC-1 第 1000 张后解锁", at1000.reading.unlocked === true);
  check("AC-1 解锁后守卫放行", flowGate("reading", DAY_A).ok === true);
  check("AC-1 新词计数只算首次", at1000.stats.newCardsSeen === 1000, `new=${at1000.stats.newCardsSeen}`);

  // 重复复习同一张不能重复计数（AC-4 的切卡前提）
  reviewCard(999, DAY_A);
  check("AC-1 重复复习不重复计数", loadFlow(DAY_A).vocabulary.reviewed === 1000);

  // ---- AC-2：高亮完整性——高亮必属当日批次，且文中必须有对应词形 ----
  const cardsA = listCards(DAY_A);
  const passageA = ensurePassage(DAY_A, cardsA);
  const batchIds = new Set(cardsA.map((card) => card.id));
  const problems = validatePassage(passageA, [...batchIds]);
  check("AC-2 阅读通过校验", problems.length === 0, problems.slice(0, 2).join("; "));
  check(
    "AC-2 高亮全部来自当日批次",
    passageA.highlightedCardIds.every((id) => batchIds.has(id)),
    `${passageA.highlightedCardIds.length} 个高亮`,
  );
  const dangling = passageA.tokenized.filter((token) => token.isHighlight && !token.cardId);
  check("AC-2 无悬空高亮", dangling.length === 0);
  const highlightedTokens = new Set(passageA.tokenized.filter((token) => token.cardId).map((token) => token.cardId));
  check(
    "AC-2 每个高亮都有文中词形",
    passageA.highlightedCardIds.every((id) => highlightedTokens.has(id)),
  );

  // ---- AC-3：读到末尾但没确认语法，听力仍然锁着 ----
  markBottom(DAY_A);
  const afterBottom = loadFlow(DAY_A);
  const listeningGate = flowGate("listening", DAY_A);
  check("AC-3 到底后 reading.reachedBottom", afterBottom.reading.reachedBottom === true);
  check("AC-3 仅到底不解锁听力", afterBottom.listening.unlocked === false);
  check("AC-3 守卫要求先确认语法", listeningGate.ok === false && listeningGate.reason === "语法点尚未确认");

  const firstPoint = passageA.grammarPoints[0];
  confirmGrammar(firstPoint.grammarId, DAY_A);
  const afterGrammar = loadFlow(DAY_A);
  check("AC-3 确认语法后解锁听力", afterGrammar.listening.unlocked === true && afterGrammar.reading.completed === true);

  // ---- AC-4：翻面播一次 / 点词条重播 / 切卡停止 ----
  const { createAudioPlayer } = await import("../src/features/learn/audioPlayer.ts");
  const made = [];
  const player = createAudioPlayer((url) => {
    const record = { url, plays: 0, pauses: 0, play() { this.plays += 1; }, pause() { this.pauses += 1; } };
    made.push(record);
    return record;
  });
  player.flip("a.ogg");
  check("AC-4 翻面播放一次", made.length === 1 && made[0].plays === 1);
  check("AC-4 翻面后处于播放态", player.isPlaying() === true);
  player.replay("a.ogg");
  check("AC-4 点词条重播", made.length === 2 && made[1].plays === 1 && made[0].pauses === 1);
  player.flip("b.ogg");
  check("AC-4 切卡先停上一条", made[1].pauses === 1 && made[2].plays === 1);
  player.flip(null);
  check("AC-4 无音频时停止且静默", made.length === 3 && player.isPlaying() === false);
  player.flip("c.ogg");
  player.stop();
  check("AC-4 stop 后不再播放", made[3].pauses === 1 && player.isPlaying() === false);

  // ---- AC-5：复习 100 张后关掉重开，进度还在且没有越级 ----
  cleanup(DAY_B);
  ensureBatch(DAY_B);
  for (let seq = 0; seq < 100; seq += 1) reviewCard(seq, DAY_B);
  const before = loadFlow(DAY_B);
  const childCode = `
    const store = await import('./server/learn/store.mjs');
    process.stdout.write(JSON.stringify(store.loadFlow('${DAY_B}')));
  `;
  const raw = execFileSync(process.execPath, ["--input-type=module", "-e", childCode], {
    cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), ".."),
    encoding: "utf8",
  });
  const reopened = JSON.parse(raw);
  check("AC-5 重开后已复习仍为 100", reopened.vocabulary.reviewed === 100, `reviewed=${reopened.vocabulary.reviewed}`);
  check("AC-5 重开后阅读仍锁着", reopened.reading.unlocked === false);
  check("AC-5 重开后听力仍锁着", reopened.listening.unlocked === false);
  check("AC-5 重开后新词计数一致", reopened.stats.newCardsSeen === before.stats.newCardsSeen);
  check("AC-5 未跳步记到底部", reopened.reading.reachedBottom === false);
} finally {
  for (const dateKey of [DAY_A, DAY_B]) {
    cleanup(dateKey);
  }
  for (const row of db.prepare("SELECT word_id FROM seen").all()) {
    if (!seenBefore.has(row.word_id)) sql("DELETE FROM seen WHERE word_id = ?", row.word_id);
  }
  db.close();
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过（今日真实批次 ${todayKey()} 未受影响）`);
if (failed.length) process.exitCode = 1;
