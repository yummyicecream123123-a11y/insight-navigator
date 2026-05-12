import { z } from "zod";

export const RangeSchema = z.enum(["1m", "5m", "10m", "1h", "3h", "1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "MAX"]);
export const AssetSchema = z.enum(["stock", "etf", "crypto", "forex", "commodity"]);

export type Range = z.infer<typeof RangeSchema>;
export type AssetType = z.infer<typeof AssetSchema>;
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type MarketInput = { symbol: string; assetType: AssetType; range: Range };
export type NewsInput = { symbol: string; assetType: AssetType };
export type NewsItem = { title: string; publisher?: string; link?: string; published?: number; summary?: string };
