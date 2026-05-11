import type { IndicatorResult } from "@/lib/indicators.server";

type NewsItem = { title?: string; publisher?: string };

type LayerSpec = {
  tag: string;
  title: string;
  blurb: string;
  categories: IndicatorResult["category"][];
};

const LAYERS: LayerSpec[] = [
  { tag: "Layer 1", title: "Expert Opinion", blurb: "Price action & chart structure the senior trader reads first.", categories: ["chart", "candlestick"] },
  { tag: "Layer 2", title: "Pattern Confirmation", blurb: "Trend & momentum indicators the quant cross-checks.", categories: ["trend", "momentum"] },
  { tag: "Layer 3", title: "Dynamics & Liquidity", blurb: "Volatility & volume the microstructure analyst watches.", categories: ["volatility", "volume"] },
];

// Parse "Name(14)" → { base: "Name", params: "14" }
function parseParams(name: string): { base: string; params?: string } {
  const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { base: m[1].trim(), params: m[2] };
  return { base: name };
}

// Default parameter hints for indicators that don't carry them in their name
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

function toneClass(sig: IndicatorResult["signal"]) {
  return sig === "bullish" ? "bg-bull/15 text-bull border-bull/30"
       : sig === "bearish" ? "bg-bear/15 text-bear border-bear/30"
       : "bg-muted text-muted-foreground border-border";
}

function ContribRow({ ind }: { ind: IndicatorResult }) {
  const { base, params } = parseParams(ind.name);
  const paramText = params ?? PARAM_HINTS[base];
  const pct = Math.round(ind.strength * 100);
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2 border-b border-border/60 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-sm font-medium truncate">{base}</div>
          {paramText && <div className="text-[10px] font-mono text-muted-foreground">[{paramText}]</div>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full ${ind.signal === "bullish" ? "bg-bull" : ind.signal === "bearish" ? "bg-bear" : "bg-muted-foreground"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
          {ind.value && <span className="text-[10px] font-mono text-muted-foreground truncate">· {ind.value}</span>}
        </div>
        {ind.note && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{ind.note}</div>}
      </div>
      <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${toneClass(ind.signal)}`}>
        {ind.signal}
      </span>
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
        <div>{contributors.map((c) => <ContribRow key={c.name} ind={c} />)}</div>
      )}
      {extra}
    </div>
  );
}

export function IndicatorBreakdown({
  indicators, news,
}: { indicators: IndicatorResult[]; news?: NewsItem[] }) {
  const inds = Array.isArray(indicators) ? indicators : [];
  const topPerLayer = LAYERS.map((spec) => {
    const contribs = inds
      .filter((i) => spec.categories.includes(i.category) && i.signal !== "neutral")
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 6);
    return { spec, contribs };
  });

  const topHeadlines = (news ?? []).slice(0, 5);
  const newsLayer: LayerSpec = {
    tag: "Layer 4", title: "News & Sentiment",
    blurb: "Top headlines feeding the macro / political read.",
    categories: [],
  };

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-xl font-semibold">Indicator breakdown</h2>
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          Top contributors · parameters · signal strength
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
