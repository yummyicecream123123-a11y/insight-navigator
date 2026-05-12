import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AssetSchema, RangeSchema, type Candle, type NewsItem } from "./market.schema";
import { fetchOhlcvData, fetchNewsData } from "./market.server";
import { computeAll, summarize, evaluateRisk } from "./indicators.server";

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(opts: {
  system: string;
  user: string;
  imageDataUrl?: string;
  schema: { name: string; description: string; parameters: any };
}) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const userContent: any[] = [{ type: "text", text: opts.user }];
  if (opts.imageDataUrl) userContent.push({ type: "image_url", image_url: { url: opts.imageDataUrl } });
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: userContent },
    ],
    tools: [{ type: "function", function: opts.schema }],
    tool_choice: { type: "function", function: { name: opts.schema.name } },
  };
  const r = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
  if (r.status === 402) throw new Error("AI credits exhausted. Add credits in Lovable workspace settings.");
  if (!r.ok) throw new Error(`AI gateway error: ${r.status} ${await r.text()}`);
  const j: any = await r.json();
  const tc = j.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("AI returned no structured output");
  try { return JSON.parse(tc.function.arguments); } catch { throw new Error("AI returned invalid JSON"); }
}

const authorProps = {
  author_name: { type: "string", description: "Realistic full name of the analyst persona writing this opinion." },
  author_credentials: { type: "string", description: "Short credentials line (firm, role, years of experience). E.g. 'Chief Strategist, Morgan Stanley · 22y equities'." },
};

const layer1Schema = {
  name: "expert_opinion",
  description: "Senior discretionary trader's read on the chart and price action.",
  parameters: {
    type: "object",
    properties: {
      ...authorProps,
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      recommendation: { type: "string", enum: ["Buy", "Sell", "Hold"] },
      thesis: { type: "string" },
      key_levels: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
    },
    required: ["author_name", "author_credentials", "bias", "conviction", "recommendation", "thesis", "key_levels", "risks"],
  },
};

const layer2Schema = {
  name: "pattern_confirmation",
  description: "Quantitative technician cross-checking the expert thesis vs the indicator table.",
  parameters: {
    type: "object",
    properties: {
      ...authorProps,
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      recommendation: { type: "string", enum: ["Buy", "Sell", "Hold"] },
      detected_patterns: { type: "array", items: { type: "string" } },
      confirming: { type: "array", items: { type: "string" } },
      contradicting: { type: "array", items: { type: "string" } },
      divergences: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: ["author_name", "author_credentials", "bias", "conviction", "recommendation", "detected_patterns", "confirming", "contradicting", "divergences", "summary"],
  },
};

const layer3Schema = {
  name: "dynamics_liquidity",
  description: "Microstructure analyst on liquidity, volatility, and market dynamics.",
  parameters: {
    type: "object",
    properties: {
      ...authorProps,
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      recommendation: { type: "string", enum: ["Buy", "Sell", "Hold"] },
      liquidity_note: { type: "string" },
      volatility_note: { type: "string" },
      market_dynamics: { type: "string" },
      key_risks: { type: "array", items: { type: "string" } },
    },
    required: ["author_name", "author_credentials", "bias", "conviction", "recommendation", "liquidity_note", "volatility_note", "market_dynamics", "key_risks"],
  },
};

const layer4Schema = {
  name: "news_sentiment",
  description: "News & political/macro analyst evaluating recent headlines and drama affecting the asset.",
  parameters: {
    type: "object",
    properties: {
      ...authorProps,
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      recommendation: { type: "string", enum: ["Buy", "Sell", "Hold"] },
      sentiment_score: { type: "number", minimum: -1, maximum: 1 },
      key_headlines: { type: "array", items: { type: "string" } },
      political_drama: { type: "string" },
      catalysts: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: ["author_name", "author_credentials", "bias", "conviction", "recommendation", "sentiment_score", "key_headlines", "political_drama", "catalysts", "summary"],
  },
};

const finalSchema = {
  name: "final_consensus",
  description: "Final consensus verdict combining all 4 layers + risk + indicators.",
  parameters: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      agreement_score: { type: "number", minimum: 0, maximum: 1 },
      consensus_bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      time_horizon: { type: "string", enum: ["intraday", "swing", "position", "long-term"] },
      forecast_window: { type: "string", description: "Concrete forecast window (5x the input range, e.g. '5 days', '5 months'). Aligns recommendation to that window." },
      entry_zone: { type: "string" },
      stop_loss: { type: "string" },
      targets: { type: "array", items: { type: "string" } },
      position_sizing: { type: "string" },
      risk_reward: { type: "string" },
      rationale: { type: "string" },
      conflicts: { type: "array", items: { type: "string" } },
    },
    required: ["verdict", "confidence", "agreement_score", "consensus_bias", "time_horizon", "forecast_window", "entry_zone", "stop_loss", "targets", "position_sizing", "risk_reward", "rationale", "conflicts"],
  },
};

const FORECAST_MAP: Record<string, string> = {
  "1m": "5 minutes", "5m": "25 minutes", "10m": "50 minutes", "1h": "5 hours", "3h": "15 hours",
  "1D": "5 trading days", "5D": "25 trading days", "1M": "5 months", "3M": "15 months",
  "6M": "30 months", "1Y": "5 years", "5Y": "25 years", "MAX": "extended (5x history)",
};

const InputSchema = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9.\-=^]+$/i, "Invalid symbol format"),
  assetType: AssetSchema,
  range: RangeSchema,
  imageBase64: z.string().optional(),
  imageMime: z.string().optional(),
  imagePath: z.string().optional(),
});
type AnalysisInput = z.infer<typeof InputSchema>;

function asArr(v: any): any[] { return Array.isArray(v) ? v : []; }

function buildBoxes(opts: {
  layer1: any; layer2: any; layer3: any; layer4: any; final: any;
  risk: ReturnType<typeof evaluateRisk>; sum: ReturnType<typeof summarize>;
  detectedPatterns: string[]; news: NewsItem[];
}) {
  const { layer1, layer2, layer3, layer4, final, risk, sum, detectedPatterns, news } = opts;
  const recos = [layer1?.recommendation, layer2?.recommendation, layer3?.recommendation, layer4?.recommendation].filter(Boolean);
  const buyCount = recos.filter((r: string) => r === "Buy").length;
  const sellCount = recos.filter((r: string) => r === "Sell").length;
  const holdCount = recos.filter((r: string) => r === "Hold").length;
  const trendBias = sum.bullish > sum.bearish ? "Bullish" : sum.bearish > sum.bullish ? "Bearish" : "Neutral";
  return {
    result: { label: "Result", value: final?.verdict ?? "Hold", tone: (final?.verdict ?? "").includes("Buy") ? "bull" : (final?.verdict ?? "").includes("Sell") ? "bear" : "neutral" },
    trend: { label: "Trend", value: trendBias, tone: trendBias === "Bullish" ? "bull" : trendBias === "Bearish" ? "bear" : "neutral" },
    expert: { label: "Expert Review", value: layer1?.recommendation ?? "Hold", tone: layer1?.recommendation === "Buy" ? "bull" : layer1?.recommendation === "Sell" ? "bear" : "neutral" },
    patterns: { label: "Detected Patterns", value: detectedPatterns.length ? `${detectedPatterns.length} active` : "None significant", tone: "neutral", details: detectedPatterns.slice(0, 6) },
    risk: { label: "Risk", value: risk.level, tone: risk.level === "Low" ? "bull" : risk.level === "Extreme" ? "bear" : "neutral", score: risk.score },
    sentiment: { label: "News Sentiment", value: layer4 ? `${(layer4.sentiment_score * 100).toFixed(0)}` : "—", tone: (layer4?.sentiment_score ?? 0) > 0.1 ? "bull" : (layer4?.sentiment_score ?? 0) < -0.1 ? "bear" : "neutral", count: news.length },
    consensus: { label: "Consensus", value: `${buyCount}B / ${holdCount}H / ${sellCount}S`, tone: buyCount > sellCount ? "bull" : sellCount > buyCount ? "bear" : "neutral" },
    confidence: { label: "Confidence", value: `${Math.round((final?.confidence ?? 0) * 100)}%`, tone: (final?.confidence ?? 0) > 0.65 ? "bull" : (final?.confidence ?? 0) < 0.4 ? "bear" : "neutral" },
    horizon: { label: "Forecast Window", value: final?.forecast_window ?? final?.time_horizon ?? "—", tone: "neutral" },
    rr: { label: "Risk / Reward", value: final?.risk_reward ?? "—", tone: "neutral" },
  };
}

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown): AnalysisInput => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const t0 = Date.now();
    const timeline: { step: string; ms: number }[] = [];
    const step = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
      const s = Date.now();
      const r = await fn();
      timeline.push({ step: label, ms: Date.now() - s });
      return r;
    };

    const ohlcv = await step("Fetch OHLCV (live market)", () =>
      fetchOhlcvData({ symbol: data.symbol, assetType: data.assetType, range: data.range })
    );
    const indicators = await step("Compute 60+ indicators & patterns", async () => computeAll(ohlcv.candles));
    const sum = summarize(indicators);
    const risk = evaluateRisk(ohlcv.candles, indicators);
    const last = ohlcv.candles[ohlcv.candles.length - 1];
    const first = ohlcv.candles[0];
    const change = ((last.c - first.c) / first.c) * 100;

    const news = await step("Fetch news headlines", () =>
      fetchNewsData({ symbol: ohlcv.symbol, assetType: data.assetType }).catch(() => [] as NewsItem[])
    );

    const forecastWindow = FORECAST_MAP[data.range] ?? data.range;
    const priceCtx = `Symbol: ${ohlcv.symbol} (${data.assetType}). Range observed: ${data.range}. Forecast window: ${forecastWindow} (5x the input range).
Current price: ${last.c.toFixed(4)} ${ohlcv.currency ?? ""}. Period change: ${change.toFixed(2)}%.
Period high: ${Math.max(...ohlcv.candles.map((c: Candle) => c.h)).toFixed(4)}, low: ${Math.min(...ohlcv.candles.map((c: Candle) => c.l)).toFixed(4)}.
Average volume: ${(ohlcv.candles.reduce((a: number, c: Candle) => a + c.v, 0) / ohlcv.candles.length).toFixed(0)}.`;

    const imageDataUrl = data.imageBase64 && data.imageMime
      ? `data:${data.imageMime};base64,${data.imageBase64}`
      : undefined;

    // Layer 1 — Expert Opinion
    const layer1 = await step("Layer 1 · Senior trader expert opinion", () => callAI({
      system: `You are a senior discretionary trader with 20+ years of experience. Be specific, cite numbers, avoid hedging. Always commit to a Buy/Sell/Hold recommendation calibrated to a forecast window of ${forecastWindow}. Always invent a realistic, plausible analyst persona (full name + firm + role + years) and put it in author_name and author_credentials.`,
      user: `${priceCtx}\n\n${imageDataUrl ? "Analyze the attached chart image AND the price context above." : "Analyze the price context above."} Give your opinion on direction over the next ${forecastWindow} and key levels.`,
      imageDataUrl,
      schema: layer1Schema,
    }));

    // Layer 2 — Pattern Confirmation
    const indicatorList = indicators.map((i) => `- ${i.name} [${i.category}]: ${i.signal} (str ${i.strength.toFixed(2)}) ${i.value ?? ""} ${i.note ? `— ${i.note}` : ""}`).join("\n");
    const layer2 = await step("Layer 2 · Quant pattern confirmation", () => callAI({
      system: `You are a quantitative technician. Cross-check the expert thesis against the full indicator table over a ${forecastWindow} forecast window. Identify confirming, contradicting, divergent signals, and list ALL detected chart/candlestick patterns with strength > 0.5. Invent a realistic analyst persona (name + firm + quant role) for author_name/author_credentials.`,
      user: `EXPERT THESIS:\n${JSON.stringify(layer1)}\n\nINDICATOR TABLE (${indicators.length} signals — ${sum.bullish} bullish / ${sum.bearish} bearish / ${sum.neutral} neutral, net score ${sum.score.toFixed(2)}):\n${indicatorList}`,
      schema: layer2Schema,
    }));

    // Layer 3 — Dynamics & Liquidity
    const avgRange = ohlcv.candles.reduce((a: number, c: Candle) => a + (c.h - c.l), 0) / ohlcv.candles.length;
    const avgDollarVol = ohlcv.candles.reduce((a: number, c: Candle) => a + c.v * c.c, 0) / ohlcv.candles.length;
    const volatilityPct = (avgRange / last.c) * 100;
    const recentVol = ohlcv.candles.slice(-5).reduce((a: number, c: Candle) => a + c.v, 0) / 5;
    const baseVol = ohlcv.candles.reduce((a: number, c: Candle) => a + c.v, 0) / ohlcv.candles.length;
    const volSurge = baseVol > 0 ? recentVol / baseVol : 1;
    const dynamicsCtx = `Liquidity (avg dollar volume): ${avgDollarVol.toExponential(2)}.
Volatility (avg HL range): ${volatilityPct.toFixed(2)}% of price.
Recent vs baseline volume ratio: ${volSurge.toFixed(2)}x.
Risk score: ${risk.score.toFixed(2)} (${risk.level}). Risk factors: ${risk.factors.join("; ")}.
Asset class: ${data.assetType}. Time range: ${data.range}. Forecast window: ${forecastWindow}.`;

    const layer3 = await step("Layer 3 · Microstructure dynamics & liquidity", () => callAI({
      system: `You are a market microstructure analyst at a top-tier institution. Evaluate liquidity, volatility, and dynamics over a ${forecastWindow} window. Commit to Buy/Sell/Hold. Invent a realistic persona for author_name/author_credentials.`,
      user: `LAYER 1: ${JSON.stringify(layer1)}\n\nLAYER 2: ${JSON.stringify(layer2)}\n\nMARKET DYNAMICS & LIQUIDITY:\n${dynamicsCtx}\n\nCurrent price: ${last.c.toFixed(4)}.`,
      schema: layer3Schema,
    }));

    // Layer 4 — News & Political/Macro
    const newsBlock = news.length
      ? news.map((n, i) => `${i + 1}. [${n.publisher ?? "src"}] ${n.title}${n.summary ? ` — ${n.summary.slice(0, 200)}` : ""}`).join("\n")
      : "No recent headlines available.";
    const layer4 = await step("Layer 4 · Macro / news / political analyst", () => callAI({
      system: `You are a macro & political analyst at a major bank. Evaluate recent news, political drama, regulatory actions, and macro catalysts impacting the asset over ${forecastWindow}. Be concrete about which headlines matter and why. Commit to Buy/Sell/Hold based on news flow. Invent a realistic persona for author_name/author_credentials.`,
      user: `Asset: ${ohlcv.symbol} (${data.assetType}). Current price: ${last.c.toFixed(4)}.\n\nRECENT NEWS (${news.length} headlines):\n${newsBlock}\n\nLAYER 1 (expert): ${JSON.stringify(layer1)}\nLAYER 2 (patterns): ${JSON.stringify(layer2)}\nLAYER 3 (dynamics): ${JSON.stringify(layer3)}`,
      schema: layer4Schema,
    }));

    // Final consensus across all 4
    const final = await step("Final · Chief Investment Officer verdict", () => callAI({
      system: `You are the chief investment officer issuing the final verdict. The recommendation MUST apply to a forecast window of exactly ${forecastWindow} (5x the input range of ${data.range}). Weigh all four layers, the indicator score, the risk profile, and any conflicts. Be decisive. Give explicit entry/stop/targets and risk/reward sized for ${forecastWindow}. Set forecast_window to "${forecastWindow}". Flag any conflicts.`,
      user: `LAYER 1 (Expert): ${JSON.stringify(layer1)}\nLAYER 2 (Patterns): ${JSON.stringify(layer2)}\nLAYER 3 (Dynamics): ${JSON.stringify(layer3)}\nLAYER 4 (News): ${JSON.stringify(layer4)}\n\nINDICATOR SUMMARY: ${JSON.stringify(sum)}\nRISK: ${JSON.stringify(risk)}\n\nCurrent price: ${last.c.toFixed(4)} ${ohlcv.currency ?? ""}. Issue final consensus verdict for the ${forecastWindow} window.`,
      schema: finalSchema,
    }));

    const detectedPatterns: string[] = Array.from(new Set([
      ...asArr(layer2.detected_patterns),
      ...indicators.filter((i) => (i.category === "chart" || i.category === "candlestick") && i.signal !== "neutral" && i.strength > 0.5).map((i) => i.name),
    ]));

    const boxes = buildBoxes({ layer1, layer2, layer3, layer4, final, risk, sum, detectedPatterns, news });
    const totalMs = Date.now() - t0;

    // Persist
    const { data: row, error } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        symbol: ohlcv.symbol,
        asset_type: data.assetType,
        time_range: data.range,
        image_path: data.imagePath ?? null,
        indicators: indicators as any,
        layer1: layer1 as any,
        layer2: layer2 as any,
        layer3: { ...layer3, ...final, timeline, totalMs, forecast_window: forecastWindow } as any,
        layer4: layer4 as any,
        final_verdict: final.verdict,
        confidence: final.confidence,
        risk_score: risk.score,
        boxes: boxes as any,
        news: news as any,
      })
      .select()
      .single();
    if (error) console.error("Analysis insert error:", error);

    return {
      id: row?.id,
      symbol: ohlcv.symbol,
      currency: ohlcv.currency,
      exchange: ohlcv.exchange,
      candles: ohlcv.candles,
      indicators,
      summary: sum,
      risk,
      news,
      detectedPatterns,
      boxes,
      layer1, layer2, layer3, layer4,
      final: { ...final, forecast_window: forecastWindow },
      forecastWindow,
      timeline,
      totalMs,
    };
  });

export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analyses")
      .select("id, symbol, asset_type, time_range, final_verdict, confidence, risk_score, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("analyses").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("analyses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AnalysisResult = Awaited<ReturnType<typeof runAnalysis>>;

// ============================================================
// Walk-forward backtest — blind: AI never sees the future slice
// ============================================================

const HOLDOUT_BARS = 5; // forecast window = 5x → score over next 5 candles
const BACKTEST_MODEL = "google/gemini-2.5-pro"; // stronger model for accuracy

const blindSchema = {
  name: "blind_prediction",
  description: "Direction call from price action + indicators only. No future data, no news.",
  parameters: {
    type: "object",
    properties: {
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      momentum_score: { type: "number", minimum: -1, maximum: 1, description: "Net directional read combining trend, momentum, and mean-reversion math." },
      regime: { type: "string", enum: ["trending-up", "trending-down", "range", "breakout-up", "breakdown", "exhaustion"] },
      thesis: { type: "string" },
    },
    required: ["bias", "conviction", "momentum_score", "regime", "thesis"],
  },
};

const BacktestInput = z.object({
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9.\-=^]+$/i),
  assetType: AssetSchema,
  range: RangeSchema,
  strongModel: z.boolean().optional(),
});

// Linear regression slope on closes, normalized as %/bar
function trendSlopePct(closes: number[]): number {
  const n = closes.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = closes.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { const dx = i - xMean; num += dx * (closes[i] - yMean); den += dx * dx; }
  const slope = den === 0 ? 0 : num / den;
  return (slope / yMean) * 100;
}

export const runBacktestTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BacktestInput.parse(d))
  .handler(async ({ data }) => {
    const t0 = Date.now();
    const ohlcv = await fetchOhlcvData({ symbol: data.symbol, assetType: data.assetType, range: data.range });
    const total = ohlcv.candles.length;
    if (total < HOLDOUT_BARS + 30) {
      throw new Error(`Not enough candles (${total}) for ${data.symbol} @ ${data.range}`);
    }
    const historical = ohlcv.candles.slice(0, total - HOLDOUT_BARS);
    const future = ohlcv.candles.slice(total - HOLDOUT_BARS);
    const indicators = computeAll(historical);
    const sum = summarize(indicators);
    const last = historical[historical.length - 1];
    const first = historical[0];
    const change = ((last.c - first.c) / first.c) * 100;
    const high = Math.max(...historical.map((c) => c.h));
    const low = Math.min(...historical.map((c) => c.l));
    const forecastWindow = FORECAST_MAP[data.range] ?? data.range;

    // BLIND: only historical context. No symbol disclosed (extra anti-leak), no news, no future bars.
    const indicatorList = indicators
      .filter((i) => i.signal !== "neutral" && i.strength > 0.3)
      .slice(0, 30)
      .map((i) => `- ${i.name} [${i.category}]: ${i.signal} (str ${i.strength.toFixed(2)}) ${i.value ?? ""}`).join("\n");

    const ctx = `Asset class: ${data.assetType}. Bar interval: ${data.range}. Forecast window: next ${forecastWindow}.
Bars observed: ${historical.length}. Last close: ${last.c.toFixed(4)}. Period change: ${change.toFixed(2)}%.
Period high: ${high.toFixed(4)}, low: ${low.toFixed(4)}.
Recent 8 closes: ${historical.slice(-8).map((c) => c.c.toFixed(4)).join(", ")}.
Indicator summary: ${sum.bullish} bullish / ${sum.bearish} bearish / ${sum.neutral} neutral, net ${sum.score.toFixed(2)}.

Top signals:
${indicatorList}`;

    const pred = await callAI({
      system: `You are a quantitative trader. From the price-action and indicator context, call direction over the next ${forecastWindow}. You have NO knowledge of the symbol's identity, no news, and no future data — predict purely from the chart math.`,
      user: ctx,
      schema: blindSchema,
    });

    // Score
    const startC = last.c;
    const endC = future[future.length - 1].c;
    const actualPct = ((endC - startC) / startC) * 100;
    const NEUTRAL_THRESHOLD = 0.3; // %
    const actualBias: "bullish" | "bearish" | "neutral" =
      actualPct > NEUTRAL_THRESHOLD ? "bullish" : actualPct < -NEUTRAL_THRESHOLD ? "bearish" : "neutral";

    // Correct if directional match. Neutral predictions are correct only on neutral outcomes.
    let correct = false;
    if (pred.bias === actualBias) correct = true;
    else if (pred.bias !== "neutral" && actualBias !== "neutral") correct = pred.bias === actualBias;

    return {
      symbol: ohlcv.symbol,
      range: data.range,
      predictedBias: pred.bias as "bullish" | "bearish" | "neutral",
      conviction: pred.conviction as number,
      thesis: pred.thesis as string,
      actualBias,
      actualPct,
      correct,
      latencyMs: Date.now() - t0,
      forecastWindow,
    };
  });
