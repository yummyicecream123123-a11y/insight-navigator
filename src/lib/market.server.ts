import type { AssetType, Candle, MarketInput, NewsInput, Range } from "./market.schema";

export type NewsItem = { title: string; publisher?: string; link?: string; published?: number; summary?: string };

const RANGE_MAP: Record<Range, { range: string; interval: string }> = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1h" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "5Y": { range: "5y", interval: "1wk" },
  MAX: { range: "max", interval: "1mo" },
};

function normalizeSymbol(symbol: string, asset: AssetType): string {
  const s = symbol.trim().toUpperCase();
  if (asset === "crypto" && !s.includes("-")) return `${s}-USD`;
  if (asset === "forex" && !s.includes("=")) return `${s}=X`;
  return s;
}

export async function fetchOhlcvData(data: MarketInput) {
  const sym = normalizeSymbol(data.symbol, data.assetType);
  const { range, interval } = RANGE_MAP[data.range];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableAnalyzer/1.0" } });
  if (!res.ok) throw new Error(`Market data fetch failed (${res.status})`);
  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for symbol "${sym}". Check the symbol.`);
  const ts: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const candles: Candle[] = ts.map((t, i) => ({
    t: t * 1000,
    o: q.open?.[i],
    h: q.high?.[i],
    l: q.low?.[i],
    c: q.close?.[i],
    v: q.volume?.[i] ?? 0,
  })).filter((c) => c.o != null && c.c != null && c.h != null && c.l != null);
  if (!candles.length) throw new Error("No candle data returned");
  const meta = result.meta || {};
  return { symbol: sym, currency: meta.currency as string | undefined, exchange: meta.fullExchangeName as string | undefined, candles };
}

export async function fetchNewsData(data: NewsInput): Promise<NewsItem[]> {
  const sym = normalizeSymbol(data.symbol, data.assetType);
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=12&quotesCount=0`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableAnalyzer/1.0" } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const news: any[] = Array.isArray(json?.news) ? json.news : [];
    return news.slice(0, 10).map((n) => ({
      title: String(n.title ?? ""),
      publisher: n.publisher,
      link: n.link,
      published: typeof n.providerPublishTime === "number" ? n.providerPublishTime * 1000 : undefined,
      summary: n.summary,
    })).filter((n) => n.title);
  } catch (e) {
    console.error("fetchNews failed:", e);
    return [];
  }
}
