// 把候选词条的英文释义批量翻成中文，写成 data/learn/gloss-zh.json。
// 分块落盘，中断可续；导入脚本只读这个文件，保证导入本身可离线重跑。
import fs from "node:fs";
import path from "node:path";
import { loadRaw, selectCandidates, GLOSS_FILE } from "../server/learn/de-source.mjs";
import { translateBatch } from "../server/translate.mjs";

const limit = Number(process.argv[2] ?? 2400);
const chunkSize = Number(process.argv[3] ?? 150);

const raw = loadRaw();
const candidates = selectCandidates(raw.words, limit);
const glosses = [...new Set(candidates.map((item) => item.gloss).filter(Boolean))];

fs.mkdirSync(path.dirname(GLOSS_FILE), { recursive: true });
const store = fs.existsSync(GLOSS_FILE) ? JSON.parse(fs.readFileSync(GLOSS_FILE, "utf8")) : {};
const missing = glosses.filter((gloss) => !store[gloss]);
console.log(`候选 ${candidates.length} 条，唯一释义 ${glosses.length} 条，待翻译 ${missing.length} 条`);

for (let start = 0; start < missing.length; start += chunkSize) {
  const chunk = missing.slice(start, start + chunkSize);
  const results = await translateBatch(chunk, { concurrency: 4, from: "en" });
  let filled = 0;
  for (const gloss of chunk) {
    const hit = results.get(gloss);
    if (hit?.text) {
      store[gloss] = { text: hit.text, provider: hit.provider };
      filled += 1;
    }
  }
  fs.writeFileSync(GLOSS_FILE, `${JSON.stringify(store, null, 0)}\n`, "utf8");
  console.log(`${Math.min(start + chunkSize, missing.length)}/${missing.length} 块内成功 ${filled}`);
}
console.log(`完成：gloss-zh.json 现有 ${Object.keys(store).length} 条`);
