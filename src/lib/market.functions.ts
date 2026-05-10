import { createServerFn } from "@tanstack/react-start";
import { fetchNewsData, fetchOhlcvData, searchSymbolsData, type SymbolSuggestion } from "./market.server";
import type { MarketInput, NewsInput } from "./market.schema";

export type { AssetType, Candle, MarketInput, NewsInput, Range } from "./market.schema";
export type { NewsItem } from "./market.schema";
export type { SymbolSuggestion };

export const fetchOhlcv = createServerFn({ method: "POST" })
  .inputValidator((d: MarketInput) => d)
  .handler(async ({ data }) => fetchOhlcvData(data));

export const fetchNews = createServerFn({ method: "POST" })
  .inputValidator((d: NewsInput) => d)
  .handler(async ({ data }) => fetchNewsData(data));

export const searchSymbols = createServerFn({ method: "POST" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => searchSymbolsData(data.q));
