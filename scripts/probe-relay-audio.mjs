import fs from "node:fs";
import path from "node:path";
import { fetchRelay, relayConfigured } from "../server/net.mjs";

const DATA = path.join("data", "learn", "audio");
fs.mkdirSync(DATA, { recursive: true });

console.log(JSON.stringify({ relayConfigured }));
if (!relayConfigured) process.exit(1);

const url = "https://commons.wikimedia.org/wiki/Special:FilePath/De-ich.ogg";
try {
  const { buffer, contentType } = await fetchRelay(url, { timeoutMs: 30000 });
  const file = path.join(DATA, "De-ich.ogg");
  fs.writeFileSync(file, buffer);
  console.log(
    JSON.stringify({
      ok: true,
      bytes: buffer.length,
      contentType,
      head: buffer.subarray(0, 4).toString("hex"),
    }),
  );
} catch (error) {
  console.log(JSON.stringify({ ok: false, error: String(error?.message ?? error).slice(0, 160) }));
}
