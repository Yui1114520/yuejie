import { setMemory } from "./cache.mjs";

const ENDPOINT = "https://hq.sinajs.cn/list=";
const TTL_MS = 60 * 1000;
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// 新浪行情代码：s_ 为国内指数简版，rt_hk 为港股，gb_ 为美股
const INDICES = [
  { id: "sh", name: "上证指数", code: "s_sh000001", market: "cn" },
  { id: "sz", name: "深证成指", code: "s_sz399001", market: "cn" },
  { id: "cyb", name: "创业板指", code: "s_sz399006", market: "cn" },
  { id: "csi300", name: "沪深300", code: "s_sh000300", market: "cn" },
  { id: "hsi", name: "恒生指数", code: "rt_hkHSI", market: "hk" },
  { id: "dji", name: "道琼斯", code: "gb_dji", market: "us" },
  { id: "ixic", name: "纳斯达克", code: "gb_ixic", market: "us" },
  { id: "inx", name: "标普500", code: "gb_inx", market: "us" },
];

// 每个指数对应的代表性成分股，点击指数时查看当日涨跌榜
const BASKETS = {
  sh: [
    ["sh600519", "贵州茅台"], ["sh601318", "中国平安"], ["sh600036", "招商银行"],
    ["sh601899", "紫金矿业"], ["sh600030", "中信证券"], ["sh601012", "隆基绿能"],
    ["sh600900", "长江电力"], ["sh688981", "中芯国际"], ["sh601088", "中国神华"],
    ["sh600276", "恒瑞医药"],
  ],
  sz: [
    ["sz000858", "五粮液"], ["sz000333", "美的集团"], ["sz002594", "比亚迪"],
    ["sz000001", "平安银行"], ["sz002415", "海康威视"], ["sz000651", "格力电器"],
    ["sz002475", "立讯精密"], ["sz000725", "京东方A"], ["sz002304", "洋河股份"],
    ["sz002230", "科大讯飞"],
  ],
  cyb: [
    ["sz300750", "宁德时代"], ["sz300059", "东方财富"], ["sz300760", "迈瑞医疗"],
    ["sz300124", "汇川技术"], ["sz300308", "中际旭创"], ["sz300502", "新易盛"],
    ["sz300274", "阳光电源"], ["sz300015", "爱尔眼科"], ["sz300014", "亿纬锂能"],
    ["sz300433", "蓝思科技"],
  ],
  csi300: [
    ["sh600519", "贵州茅台"], ["sh601318", "中国平安"], ["sh600036", "招商银行"],
    ["sz000858", "五粮液"], ["sz300750", "宁德时代"], ["sh601899", "紫金矿业"],
    ["sh600030", "中信证券"], ["sz000333", "美的集团"], ["sh600900", "长江电力"],
    ["sz002594", "比亚迪"],
  ],
  hsi: [
    ["rt_hk00700", "腾讯控股"], ["rt_hk09988", "阿里巴巴"], ["rt_hk03690", "美团"],
    ["rt_hk01810", "小米集团"], ["rt_hk00941", "中国移动"], ["rt_hk01299", "友邦保险"],
    ["rt_hk00005", "汇丰控股"], ["rt_hk02318", "中国平安"], ["rt_hk09618", "京东集团"],
    ["rt_hk01024", "快手"],
  ],
  dji: [
    ["gb_aapl", "苹果"], ["gb_msft", "微软"], ["gb_ko", "可口可乐"],
    ["gb_jpm", "摩根大通"], ["gb_v", "Visa"], ["gb_wmt", "沃尔玛"],
    ["gb_dis", "迪士尼"], ["gb_ibm", "IBM"], ["gb_cat", "卡特彼勒"], ["gb_gs", "高盛"],
  ],
  ixic: [
    ["gb_aapl", "苹果"], ["gb_msft", "微软"], ["gb_nvda", "英伟达"],
    ["gb_amzn", "亚马逊"], ["gb_googl", "谷歌"], ["gb_meta", "Meta"],
    ["gb_tsla", "特斯拉"], ["gb_avgo", "博通"], ["gb_nflx", "奈飞"], ["gb_amd", "AMD"],
  ],
  inx: [
    ["gb_aapl", "苹果"], ["gb_msft", "微软"], ["gb_nvda", "英伟达"],
    ["gb_amzn", "亚马逊"], ["gb_googl", "谷歌"], ["gb_meta", "Meta"],
    ["gb_jpm", "摩根大通"], ["gb_xom", "埃克森美孚"], ["gb_unh", "联合健康"], ["gb_v", "Visa"],
  ],
};

let cache = null;
let lastPayload = null;
let inflight = null;
const moverCache = new Map();

function round(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(digits));
}

function parseQuote(code, raw) {
  const fields = raw.split(",");
  if (fields.length < 4) return null;
  if (code.startsWith("s_")) {
    return {
      price: round(fields[1]),
      change: round(fields[2]),
      pct: round(fields[3]),
      time: null,
    };
  }
  if (code.startsWith("rt_hk")) {
    // 名称,开盘,昨收,最高,最低,最新,涨跌,涨跌幅,…
    return {
      price: round(fields[6]),
      change: round(fields[7]),
      pct: round(fields[8]),
      time: fields[17] && fields[18] ? `${fields[17]} ${fields[18]}` : null,
    };
  }
  // 美股：名称,最新,涨跌幅,时间,涨跌,…
  return {
    price: round(fields[1]),
    change: round(fields[4]),
    pct: round(fields[2]),
    time: fields[3] || null,
  };
}

function parseStock(code, raw) {
  const fields = raw.split(",");
  if (fields.length < 5 || !fields[0]) return null;
  if (code.startsWith("sh") || code.startsWith("sz")) {
    const prevClose = round(fields[2]);
    const price = round(fields[3]);
    if (price == null) return null;
    const change = prevClose ? round(price - prevClose) : null;
    const pct = prevClose ? round(((price - prevClose) / prevClose) * 100) : null;
    return {
      code,
      name: fields[0].replace(/\s+/g, ""),
      price,
      change,
      pct,
      time: fields[30] && fields[31] ? `${fields[30]} ${fields[31]}` : null,
    };
  }
  if (code.startsWith("rt_hk")) {
    return {
      code,
      name: fields[1] || fields[0],
      price: round(fields[6]),
      change: round(fields[7]),
      pct: round(fields[8]),
      time: fields[17] && fields[18] ? `${fields[17]} ${fields[18]}` : null,
    };
  }
  return {
    code,
    name: fields[0],
    price: round(fields[1]),
    change: round(fields[4]),
    pct: round(fields[2]),
    time: fields[3] || null,
  };
}

async function fetchRaw(codes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${ENDPOINT}${codes.join(",")}`, {
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        referer: "https://finance.sina.com.cn/",
        accept: "*/*",
      },
    });
    if (!res.ok) throw new Error(`新浪行情 HTTP ${res.status}`);
    const text = new TextDecoder("gbk").decode(Buffer.from(await res.arrayBuffer()));
    const byCode = new Map();
    for (const line of text.split("\n")) {
      const match = /hq_str_(\w+)="([^"]*)"/.exec(line);
      if (match) byCode.set(match[1], match[2]);
    }
    if (!byCode.size) throw new Error("新浪行情返回空数据");
    return byCode;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchQuotes() {
  const byCode = await fetchRaw(INDICES.map((index) => index.code));
  const indices = [];
  for (const index of INDICES) {
    const raw = byCode.get(index.code);
    const quote = raw ? parseQuote(index.code, raw) : null;
    if (!quote || quote.price == null) continue;
    indices.push({ ...index, ...quote });
  }
  if (!indices.length) throw new Error("新浪行情返回空数据");
  return indices;
}

export async function getMovers(indexId) {
  const basket = BASKETS[indexId];
  const index = INDICES.find((item) => item.id === indexId);
  if (!basket || !index) return null;
  const hit = moverCache.get(indexId);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.payload;
  try {
    const byCode = await fetchRaw(basket.map(([code]) => code));
    const stocks = [];
    for (const [code] of basket) {
      const raw = byCode.get(code);
      const quote = raw ? parseStock(code, raw) : null;
      if (!quote || quote.price == null || !Number.isFinite(quote.pct)) continue;
      stocks.push(quote);
    }
    if (!stocks.length) throw new Error("新浪个股行情返回空数据");
    stocks.sort((a, b) => b.pct - a.pct);
    const payload = {
      ok: true,
      index: { id: index.id, name: index.name, market: index.market },
      updatedAt: new Date().toISOString(),
      gainers: stocks.filter((stock) => stock.pct > 0).slice(0, 5),
      losers: stocks.filter((stock) => stock.pct < 0).slice(-5).reverse(),
      stocks,
    };
    moverCache.set(indexId, { fetchedAt: Date.now(), payload });
    return payload;
  } catch (error) {
    if (hit) return { ...hit.payload, stale: true, error: String(error?.message ?? error) };
    return {
      ok: false,
      index: { id: index.id, name: index.name, market: index.market },
      updatedAt: null,
      gainers: [],
      losers: [],
      stocks: [],
      error: String(error?.message ?? error),
    };
  }
}

export async function getMarkets() {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.payload;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const indices = await fetchQuotes();
      const payload = {
        ok: true,
        updatedAt: new Date().toISOString(),
        indices,
      };
      cache = { fetchedAt: Date.now(), payload };
      lastPayload = payload;
      setMemory("markets", payload, TTL_MS);
      return payload;
    } catch (error) {
      if (lastPayload) return { ...lastPayload, stale: true, error: String(error?.message ?? error) };
      return { ok: false, updatedAt: null, indices: [], error: String(error?.message ?? error) };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
