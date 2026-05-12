import type { AssetType, Candle, MarketInput, NewsInput, NewsItem, Range } from "./market.schema";

const RANGE_MAP: Record<Range, { range: string; interval: string }> = {
  "1m": { range: "1d", interval: "1m" },
  "5m": { range: "5d", interval: "2m" },
  "10m": { range: "5d", interval: "5m" },
  "1h": { range: "5d", interval: "15m" },
  "3h": { range: "1mo", interval: "30m" },
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

// Simple in-memory TTL cache (per worker instance)
type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<any>>();
const TTL_OHLCV = 60_000; // 60s
const TTL_NEWS = 5 * 60_000; // 5min
const TTL_SEARCH = 10 * 60_000; // 10min

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expires) { cache.delete(key); return undefined; }
  return hit.value as T;
}
function cacheSet<T>(key: string, value: T, ttl: number) {
  cache.set(key, { value, expires: Date.now() + ttl });
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

export type OhlcvResult = { symbol: string; currency?: string; exchange?: string; candles: Candle[] };

export async function fetchOhlcvData(data: MarketInput): Promise<OhlcvResult> {
  const sym = normalizeSymbol(data.symbol, data.assetType);
  const key = `ohlcv:${sym}:${data.range}`;
  const cached = cacheGet<OhlcvResult>(key);
  if (cached) return cached;

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
  const out = { symbol: sym, currency: meta.currency as string | undefined, exchange: meta.fullExchangeName as string | undefined, candles };
  cacheSet(key, out, TTL_OHLCV);
  return out;
}

export async function fetchNewsData(data: NewsInput): Promise<NewsItem[]> {
  const sym = normalizeSymbol(data.symbol, data.assetType);
  const key = `news:${sym}`;
  const cached = cacheGet<NewsItem[]>(key);
  if (cached) return cached;
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=12&quotesCount=0`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableAnalyzer/1.0" } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const news: any[] = Array.isArray(json?.news) ? json.news : [];
    const out = news.slice(0, 10).map((n) => ({
      title: String(n.title ?? ""),
      publisher: n.publisher,
      link: n.link,
      published: typeof n.providerPublishTime === "number" ? n.providerPublishTime * 1000 : undefined,
      summary: n.summary,
    })).filter((n) => n.title);
    cacheSet(key, out, TTL_NEWS);
    return out;
  } catch (e) {
    console.error("fetchNews failed:", e);
    return [];
  }
}

export type SymbolSuggestion = {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
};

export async function searchSymbolsData(q: string): Promise<SymbolSuggestion[]> {
  const query = q.trim();
  if (query.length < 1) return [];
  const key = `search:${query.toLowerCase()}`;
  const cached = cacheGet<SymbolSuggestion[]>(key);
  if (cached) return cached;
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 LovableAnalyzer/1.0" } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const quotes: any[] = Array.isArray(json?.quotes) ? json.quotes : [];
    const out = quotes
      .filter((q) => q.symbol && (q.shortname || q.longname))
      .slice(0, 8)
      .map((q) => ({
        symbol: String(q.symbol),
        name: String(q.shortname || q.longname || q.symbol),
        exchange: q.exchDisp,
        type: q.quoteType,
      }));
    cacheSet(key, out, TTL_SEARCH);
    return out;
  } catch (e) {
    console.error("searchSymbols failed:", e);
    return [];
  }
}
