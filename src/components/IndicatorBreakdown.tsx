import { useEffect, useState } from "react";
import type { IndicatorResult } from "@/lib/indicators.server";

type NewsItem = { title?: string; publisher?: string };

type LayerSpec = {
  tag: string;
  title: string;
  blurb: string;
  categories: IndicatorResult["category"][];
  confirms: string;
};

const LAYERS: LayerSpec[] = [
  { tag: "Layer 1", title: "Expert Opinion", blurb: "Price action & chart structure the senior trader reads first.", categories: ["chart", "candlestick"], confirms: "the discretionary trader's read on structure, levels, and reversal signals" },
  { tag: "Layer 2", title: "Pattern Confirmation", blurb: "Trend & momentum indicators the quant cross-checks.", categories: ["trend", "momentum"], confirms: "the quant's trend-vs-momentum confirmation of the expert thesis" },
  { tag: "Layer 3", title: "Dynamics & Liquidity", blurb: "Volatility & volume the microstructure analyst watches.", categories: ["volatility", "volume"], confirms: "the microstructure analyst's view on liquidity, regime, and crowding" },
];

function parseParams(name: string): { base: string; params?: string } {
  const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { base: m[1].trim(), params: m[2] };
  return { base: name };
}

const PARAM_HINTS: Record<string, string> = {
  "MACD": "12 / 26 / 9",
  "Parabolic SAR": "step 0.02, max 0.2",
  "Ichimoku Cloud": "9 / 26 / 52",
  "VWAP": "session",
  "Supertrend": "ATR 14 × 3",
  "Linear Regression": "20-period",
  "Stochastic": "14 / 3",
  "Stoch RSI": "14 / 14 / 3 / 3",
  "Williams %R": "14",
  "TRIX": "18",
  "Awesome Osc": "5 / 34",
  "Bollinger Bands": "20, 2σ",
  "Keltner Channel": "20 EMA, 10 ATR × 2",
  "OBV": "cumulative",
  "Acc/Dist Line": "cumulative",
  "Chaikin Money Flow": "20",
  "Volume Profile POC": "100-bar, 20 bins",
  "Force Index": "13",
  "Ease of Movement": "14",
  "Chaikin Vol": "EMA 10, ROC 10",
};

const DESCRIPTIONS: Record<string, string> = {
  "SMA": "Simple Moving Average — average closing price over the window. Acts as dynamic support/resistance.",
  "EMA": "Exponential Moving Average — weighted toward recent prices, reacts faster than SMA.",
  "MACD": "Moving Average Convergence Divergence — momentum + trend via the spread between fast and slow EMAs.",
  "ADX": "Average Directional Index — trend strength regardless of direction; +DI vs −DI sets bias.",
  "Parabolic SAR": "Trailing stop-and-reverse dots flipping above/below price as the trend changes.",
  "Ichimoku Cloud": "Multi-line system; price vs cloud shows trend regime and forward support/resistance.",
  "VWAP": "Volume-Weighted Average Price — institutional fair value benchmark for the session.",
  "Supertrend": "ATR-banded trend follower; flips sides only on volatility-aware breaks.",
  "Linear Regression": "Best-fit slope of recent closes — quantifies short-term drift.",
  "RSI": "Relative Strength Index — momentum oscillator (0–100); >70 overbought, <30 oversold.",
  "Stochastic": "Compares close to recent range; %K/%D crossovers flag turn risk.",
  "Stoch RSI": "Stochastic of RSI — sharper, faster oscillator for inflection points.",
  "Williams %R": "Inverted stochastic (−100 to 0); >−20 overbought, <−80 oversold.",
  "CCI": "Commodity Channel Index — distance from typical price mean; >+100 strong up, <−100 strong down.",
  "ROC": "Rate of Change — pure % momentum vs n bars ago.",
  "MFI": "Money Flow Index — volume-weighted RSI; institutional pressure proxy.",
  "TRIX": "Triple-smoothed EMA momentum; filters noise, signals regime shifts.",
  "Awesome Osc": "Histogram of fast minus slow median-price SMAs; momentum thrust.",
  "Bollinger Bands": "20-period SMA ± 2σ — volatility envelope; %B locates price within it.",
  "Keltner Channel": "EMA ± multiple of ATR — smoother volatility envelope than Bollinger.",
  "Donchian": "High/low channel of last n bars — classic breakout system.",
  "ATR": "Average True Range — average per-bar range; the volatility unit for sizing/stops.",
  "Std Dev": "Rolling standard deviation of price — raw volatility number.",
  "Chaikin Vol": "Rate of change of the high–low range EMA — expansion vs contraction.",
  "OBV": "On-Balance Volume — cumulative volume signed by close direction; tracks accumulation.",
  "Acc/Dist Line": "Accumulation/Distribution — close location within range × volume.",
  "Chaikin Money Flow": "20-bar money flow ratio; >0 buying pressure, <0 selling pressure.",
  "Volume Profile POC": "Point of Control — price with the most traded volume; magnet & fair value.",
  "Force Index": "Price change × volume — conviction behind the move.",
  "Ease of Movement": "How easily price moves on a given volume; high = effortless trend.",
  "Doji": "Open ≈ close — indecision, often near reversals.",
  "Hammer": "Small body, long lower wick — bullish reversal at support.",
  "Shooting Star": "Small body, long upper wick — bearish reversal at resistance.",
  "Bullish Engulfing": "Up bar fully engulfs prior down bar — bullish reversal.",
  "Bearish Engulfing": "Down bar fully engulfs prior up bar — bearish reversal.",
  "Morning Star": "3-bar bullish reversal at lows.",
  "Evening Star": "3-bar bearish reversal at highs.",
  "Three White Soldiers": "Three strong up bars — sustained bullish momentum.",
  "Three Black Crows": "Three strong down bars — sustained bearish momentum.",
  "Bullish Harami": "Small up bar inside prior down bar — early bullish turn.",
  "Bearish Harami": "Small down bar inside prior up bar — early bearish turn.",
  "Piercing Line": "Down bar then up bar closing above midpoint — bullish reversal.",
  "Dark Cloud Cover": "Up bar then down bar closing below midpoint — bearish reversal.",
  "Recent Bias (candles)": "Aggregate read of the last few candles' direction.",
  "Support / Resistance": "Recent swing low / swing high acting as price magnets and breakout pivots.",
  "Fibonacci Retr.": "Retracement levels (0.382 / 0.618) of the recent range — common reaction zones.",
};

function describe(name: string): string {
  const { base } = parseParams(name);
  if (DESCRIPTIONS[base]) return DESCRIPTIONS[base];
  if (DESCRIPTIONS[name]) return DESCRIPTIONS[name];
  return "Technical signal contributing to the layer's overall read.";
}

function interpret(ind: IndicatorResult): string {
  const { base } = parseParams(ind.name);
  const sig = ind.signal;
  const v = ind.value ?? "";
  switch (base) {
    case "RSI": return sig === "bullish" ? `RSI at ${v} shows momentum favoring buyers${ind.note ? ` (${ind.note.toLowerCase()})` : ""}.` : `RSI at ${v} shows momentum tilting toward sellers${ind.note ? ` (${ind.note.toLowerCase()})` : ""}.`;
    case "MACD": return `MACD histogram is ${v} — ${sig === "bullish" ? "fast EMA above signal, momentum building up" : "fast EMA below signal, momentum fading"}.`;
    case "ADX": return `ADX ${v} — ${ind.note ?? (sig === "neutral" ? "no trend strength" : `trending ${sig}`)}.`;
    case "Bollinger Bands": return `Price sits inside ${v}; ${ind.note ?? ""}. ${sig === "bullish" ? "Lower-band tag suggests mean reversion up." : sig === "bearish" ? "Upper-band tag suggests mean reversion down." : "Mid-range — no edge."}`;
    case "Stochastic": return `%K/%D at ${v} — ${sig === "bullish" ? "buyers in control or bouncing from oversold" : "sellers in control or fading from overbought"}.`;
    case "MFI": return `Money Flow ${v} — volume-weighted ${sig} pressure.`;
    case "OBV": return `On-Balance Volume is ${sig === "bullish" ? "rising" : "falling"} — accumulation ${sig === "bullish" ? "underway" : "weakening"}.`;
    case "VWAP": return `Price is ${sig === "bullish" ? "above" : "below"} VWAP (${v}) — institutions are ${sig === "bullish" ? "in profit and likely defending" : "underwater and likely supplying"}.`;
    case "Supertrend": return `Supertrend bands ${v}; flipped ${sig}.`;
    case "Parabolic SAR": return `SAR dot at ${v} — trail is ${sig === "bullish" ? "below price (long bias)" : "above price (short bias)"}.`;
    case "Ichimoku Cloud": return `Cloud span ${v}; price ${sig === "bullish" ? "above the cloud" : sig === "bearish" ? "below the cloud" : "inside the cloud"} — ${sig === "neutral" ? "regime undefined" : `${sig} regime`}.`;
    case "ATR": return `ATR ${v} (${ind.note ?? ""}) — sets the stop-loss & sizing unit, not directional.`;
    case "Volume Profile POC": return `POC at ${v} — price ${sig === "bullish" ? "above" : "below"} the high-volume node; ${sig === "bullish" ? "value-area support holding" : "value-area resistance capping"}.`;
    case "Support / Resistance": return `${ind.value ?? ""} — ${ind.note ?? ""}. ${sig === "bullish" ? "Hugging support — bounce setup." : sig === "bearish" ? "Hugging resistance — rejection risk." : "Mid-range."}`;
    case "Fibonacci Retr.": return `Retracement zone ${v}; price action says ${sig}.`;
    case "SMA": case "EMA": return `Price is ${sig === "bullish" ? "above" : "below"} ${ind.name} (${v}) — ${sig} bias on this MA.`;
    default:
      if (ind.category === "candlestick") return ind.value === "detected" ? `${base} pattern fired in the recent window — classic ${sig} signal.` : `${base} pattern not active.`;
      return `Current reading: ${v || "n/a"}${ind.note ? ` (${ind.note})` : ""}. Signal: ${sig}.`;
  }
}

function linkToLayer(ind: IndicatorResult, spec: LayerSpec): string {
  const dir = ind.signal === "bullish" ? "supports a bullish read" : ind.signal === "bearish" ? "supports a bearish read" : "adds context but no direction";
  return `Feeds ${spec.confirms}; this signal ${dir} for ${spec.title.toLowerCase()}.`;
}

function toneClass(sig: IndicatorResult["signal"]) {
  return sig === "bullish" ? "bg-bull/15 text-bull border-bull/30"
       : sig === "bearish" ? "bg-bear/15 text-bear border-bear/30"
       : "bg-muted text-muted-foreground border-border";
}

function ContribRow({ ind, spec }: { ind: IndicatorResult; spec: LayerSpec }) {
  const [open, setOpen] = useState(false);
  const { base, params } = parseParams(ind.name);
  const paramText = params ?? PARAM_HINTS[base];
  const pct = Math.round(ind.strength * 100);
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2 text-left hover:bg-accent/40 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-sm font-medium truncate">{base}</div>
            {paramText && <div className="text-[10px] font-mono text-muted-foreground">[{paramText}]</div>}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${ind.signal === "bullish" ? "bg-bull" : ind.signal === "bearish" ? "bg-bear" : "bg-muted-foreground"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
            {ind.value && <span className="text-[10px] font-mono text-muted-foreground truncate">· {ind.value}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${toneClass(ind.signal)}`}>{ind.signal}</span>
          <svg className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-background/40">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">What it is</div>
            <div className="text-xs mt-0.5 text-foreground/90">{describe(ind.name)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Current reading</div>
            <div className="text-xs mt-0.5 text-foreground/90">{interpret(ind)}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Why it matters here</div>
            <div className="text-xs mt-0.5 text-foreground/90">{linkToLayer(ind, spec)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function LayerColumn({
  spec, contributors, extra,
}: { spec: LayerSpec; contributors: IndicatorResult[]; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-background/40">
        <div className="text-[10px] font-mono uppercase tracking-widest text-primary">{spec.tag}</div>
        <div className="font-display text-base font-semibold mt-0.5">{spec.title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{spec.blurb}</div>
      </div>
      {contributors.length === 0 ? (
        <div className="px-3 py-6 text-xs text-muted-foreground text-center">No significant contributors.</div>
      ) : (
        <div>{contributors.map((c) => <ContribRow key={c.name} ind={c} spec={spec} />)}</div>
      )}
      {extra}
    </div>
  );
}

const TOP_N_OPTIONS = [3, 5, 6, 8, 10] as const;
const TOP_N_KEY = "tritone:breakdown:topN";

export function IndicatorBreakdown({
  indicators, news,
}: { indicators: IndicatorResult[]; news?: NewsItem[] }) {
  const [topN, setTopN] = useState<number>(6);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOP_N_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (TOP_N_OPTIONS.includes(n as any)) setTopN(n);
    } catch {}
  }, []);
  const updateTopN = (n: number) => {
    setTopN(n);
    try { localStorage.setItem(TOP_N_KEY, String(n)); } catch {}
  };

  const inds = Array.isArray(indicators) ? indicators : [];
  const topPerLayer = LAYERS.map((spec) => {
    const contribs = inds
      .filter((i) => spec.categories.includes(i.category) && i.signal !== "neutral")
      .sort((a, b) => b.strength - a.strength)
      .slice(0, topN);
    return { spec, contribs };
  });

  const topHeadlines = (news ?? []).slice(0, Math.min(topN, 8));
  const newsLayer: LayerSpec = {
    tag: "Layer 4", title: "News & Sentiment",
    blurb: "Top headlines feeding the macro / political read.",
    categories: [],
    confirms: "the macro/political analyst's news-flow read",
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Indicator breakdown</h2>
          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            Tap any row for the “Why this indicator” explainer.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Top per layer</span>
          <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
            {TOP_N_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateTopN(n)}
                className={`px-2.5 py-1 text-xs font-mono transition-colors ${topN === n ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                aria-pressed={topN === n}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {topPerLayer.map(({ spec, contribs }) => (
          <LayerColumn key={spec.tag} spec={spec} contributors={contribs} />
        ))}
        <LayerColumn
          spec={newsLayer}
          contributors={[]}
          extra={
            topHeadlines.length === 0 ? (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">No recent headlines.</div>
            ) : (
              <div>
                {topHeadlines.map((h, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border/60 last:border-b-0">
                    <div className="text-sm leading-snug line-clamp-2">{h.title ?? "—"}</div>
                    {h.publisher && <div className="mt-0.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{h.publisher}</div>}
                  </div>
                ))}
              </div>
            )
          }
        />
      </div>
    </div>
  );
}
