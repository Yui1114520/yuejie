// 德语词目 → 中文直译，写 data/learn/word-zh.json。
// 比翻英文释义准（释义本身是 English gloss，多义项容易串味），失败就留空让导入脚本降级。
import fs from "node:fs";
import path from "node:path";
import { loadRaw, selectCandidates, RAW_DIR } from "../server/learn/de-source.mjs";
import { translate } from "../server/translate.mjs";

const OUT = path.join(RAW_DIR, "..", "word-zh.json");
const limit = Number(process.argv[2] ?? 2400);
const chunk = Number(process.argv[3] ?? 80);

const raw = loadRaw();
const candidates = selectCandidates(raw.words, limit);
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const waiting = candidates.map((item) => item.lemma).filter((lemma) => !store[lemma]);
console.log(`候选 ${candidates.length}，已有 ${Object.keys(store).length}，待译 ${waiting.length}`);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let start = 0; start < waiting.length; start += chunk) {
  const slice = waiting.slice(start, start + chunk);
  let filled = 0;
  for (const lemma of slice) {
    let result = null;
    for (let attempt = 0; attempt < 3 && !result; attempt += 1) {
      if (attempt) await wait(5000);
      try {
        result = await translate(lemma, { from: "de" });
      } catch {
        result = null;
      }
    }
    if (result?.text) {
      store[lemma] = { text: result.text, provider: result.provider };
      filled += 1;
    } else {
      store[lemma] = { text: "", provider: "" };
    }
    await wait(1600);
  }
  fs.writeFileSync(OUT, `${JSON.stringify(store, null, 0)}\n`, "utf8");
  console.log(`${Math.min(start + chunk, waiting.length)}/${waiting.length} 成功 ${filled}/${slice.length}`);
}
const done = Object.values(store).filter((item) => item.text).length;
console.log(`完成：word-zh.json 有效 ${done}/${candidates.length}`);
