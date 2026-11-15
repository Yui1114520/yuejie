const base = String(process.env.RELAY_URL ?? "").replace(/\/+$/, "");
const token = String(process.env.RELAY_TOKEN ?? "");

export const relayConfigured = Boolean(base && token);

export async function fetchRelay(url, { timeoutMs = 25000 } = {}) {
  if (!relayConfigured) throw new Error("未配置 RELAY_URL / RELAY_TOKEN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/fetch`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`中转 HTTP ${res.status}`);
    const data = await res.json();
    if (Number(data?.status) < 200 || Number(data?.status) >= 300) {
      throw new Error(`中转上游 HTTP ${data?.status ?? "?"}`);
    }
    return {
      buffer: Buffer.from(String(data?.body ?? ""), "base64"),
      contentType: String(data?.contentType ?? ""),
    };
  } finally {
    clearTimeout(timer);
  }
}
