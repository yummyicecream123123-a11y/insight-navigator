import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchOhlcv, AssetSchema, RangeSchema } from "./market.functions";
import { computeAll, summarize, type IndicatorResult } from "./indicators.server";

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

const layer1Schema = {
  name: "expert_opinion",
  description: "Senior discretionary trader's read on the chart and price action.",
  parameters: {
    type: "object",
    properties: {
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      thesis: { type: "string" },
      key_levels: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
    },
    required: ["bias", "conviction", "thesis", "key_levels", "risks"],
  },
};

const layer2Schema = {
  name: "pattern_confirmation",
  description: "Quantitative technician cross-checking the expert thesis vs the indicator table.",
  parameters: {
    type: "object",
    properties: {
      bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
      conviction: { type: "number", minimum: 0, maximum: 1 },
      confirming: { type: "array", items: { type: "string" } },
      contradicting: { type: "array", items: { type: "string" } },
      divergences: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
    required: ["bias", "conviction", "confirming", "contradicting", "divergences", "summary"],
  },
};

const layer3Schema = {
  name: "final_verdict",
  description: "Market microstructure analyst final verdict including liquidity & dynamics.",
  parameters: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      agreement_score: { type: "number", minimum: 0, maximum: 1 },
      entry_zone: { type: "string" },
      stop_loss: { type: "string" },
      targets: { type: "array", items: { type: "string" } },
      position_sizing: { type: "string" },
      liquidity_note: { type: "string" },
      market_dynamics: { type: "string" },
      rationale: { type: "string" },
    },
    required: ["verdict", "confidence", "agreement_score", "entry_zone", "stop_loss", "targets", "position_sizing", "liquidity_note", "market_dynamics", "rationale"],
  },
};

const InputSchema = z.object({
  symbol: z.string().min(1).max(20),
  assetType: AssetSchema,
  range: RangeSchema,
  imageBase64: z.string().optional(),
  imageMime: z.string().optional(),
  imagePath: z.string().optional(),
});

export const runAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ohlcv = await fetchOhlcv({ data: { symbol: data.symbol, assetType: data.assetType, range: data.range } });
    const indicators = computeAll(ohlcv.candles);
    const sum = summarize(indicators);
    const last = ohlcv.candles[ohlcv.candles.length - 1];
    const first = ohlcv.candles[0];
    const change = ((last.c - first.c) / first.c) * 100;

    const priceCtx = `Symbol: ${ohlcv.symbol} (${data.assetType}). Range: ${data.range}.
Current price: ${last.c.toFixed(4)} ${ohlcv.currency ?? ""}. Period change: ${change.toFixed(2)}%.
Period high: ${Math.max(...ohlcv.candles.map((c) => c.h)).toFixed(4)}, low: ${Math.min(...ohlcv.candles.map((c) => c.l)).toFixed(4)}.
Average volume: ${(ohlcv.candles.reduce((a, c) => a + c.v, 0) / ohlcv.candles.length).toFixed(0)}.`;

    const imageDataUrl = data.imageBase64 && data.imageMime
      ? `data:${data.imageMime};base64,${data.imageBase64}`
      : undefined;

    // Layer 1
    const layer1 = await callAI({
      system: "You are a senior discretionary trader with 25 years of experience reading price action and charts. Be specific, cite numbers, avoid hedging.",
      user: `${priceCtx}\n\n${imageDataUrl ? "Analyze the attached chart image AND the price context above." : "Analyze the price context above."} Give your opinion on direction and key levels.`,
      imageDataUrl,
      schema: layer1Schema,
    });

    // Layer 2
    const indicatorList = indicators.map((i) => `- ${i.name} [${i.category}]: ${i.signal} (str ${i.strength.toFixed(2)}) ${i.value ?? ""} ${i.note ? `— ${i.note}` : ""}`).join("\n");
    const layer2 = await callAI({
      system: "You are a quantitative technician. Cross-check the expert thesis against the full indicator table. Identify confirming, contradicting, and divergent signals. Be ruthless.",
      user: `EXPERT THESIS:\n${JSON.stringify(layer1, null, 2)}\n\nINDICATOR TABLE (${indicators.length} signals — ${sum.bullish} bullish / ${sum.bearish} bearish / ${sum.neutral} neutral, net score ${sum.score.toFixed(2)}):\n${indicatorList}`,
      schema: layer2Schema,
    });

    // Liquidity / dynamics context
    const avgRange = ohlcv.candles.reduce((a, c) => a + (c.h - c.l), 0) / ohlcv.candles.length;
    const avgDollarVol = ohlcv.candles.reduce((a, c) => a + c.v * c.c, 0) / ohlcv.candles.length;
    const volatilityPct = (avgRange / last.c) * 100;
    const recentVol = ohlcv.candles.slice(-5).reduce((a, c) => a + c.v, 0) / 5;
    const baseVol = ohlcv.candles.reduce((a, c) => a + c.v, 0) / ohlcv.candles.length;
    const volSurge = baseVol > 0 ? recentVol / baseVol : 1;

    const dynamicsCtx = `Liquidity (avg dollar volume): ${avgDollarVol.toExponential(2)}.
Volatility (avg HL range): ${volatilityPct.toFixed(2)}% of price.
Recent vs baseline volume ratio: ${volSurge.toFixed(2)}x.
Asset class: ${data.assetType}. Time range: ${data.range}.`;

    // Layer 3
    const layer3 = await callAI({
      system: "You are a market microstructure analyst. Combine the expert opinion (Layer 1), pattern confirmation (Layer 2), and the liquidity/volatility context to issue a final verdict with explicit entry, stop, targets, and position sizing.",
      user: `LAYER 1 EXPERT OPINION:\n${JSON.stringify(layer1, null, 2)}\n\nLAYER 2 PATTERN CONFIRMATION:\n${JSON.stringify(layer2, null, 2)}\n\nMARKET DYNAMICS & LIQUIDITY:\n${dynamicsCtx}\n\nCurrent price: ${last.c.toFixed(4)}. Issue final verdict.`,
      schema: layer3Schema,
    });

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
        layer3: layer3 as any,
        final_verdict: layer3.verdict,
        confidence: layer3.confidence,
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
      layer1, layer2, layer3,
    };
  });

export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("analyses")
      .select("id, symbol, asset_type, time_range, final_verdict, confidence, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
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
