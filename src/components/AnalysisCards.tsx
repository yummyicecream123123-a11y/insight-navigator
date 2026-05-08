type Bias = "bullish" | "bearish" | "neutral";
type Verdict = "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";

const biasColor = (b: Bias) => b === "bullish" ? "bg-bull/15 text-bull" : b === "bearish" ? "bg-bear/15 text-bear" : "bg-muted text-muted-foreground";

export function LayerCard({ tag, title, persona, bias, conviction, children }: {
  tag: string; title: string; persona: string;
  bias?: Bias; conviction?: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-primary">{tag}</div>
          <h3 className="font-display text-lg font-semibold mt-0.5">{title}</h3>
          <div className="text-xs text-muted-foreground">{persona}</div>
        </div>
        {bias && (
          <div className="flex items-center gap-2">
            <span className={`text-[11px] uppercase font-mono px-2 py-1 rounded ${biasColor(bias)}`}>{bias}</span>
            {conviction != null && <span className="font-mono text-xs text-muted-foreground">{(conviction * 100).toFixed(0)}%</span>}
          </div>
        )}
      </div>
      <div className="mt-4 text-sm space-y-3">{children}</div>
    </div>
  );
}

const verdictColor = (v: Verdict) => {
  if (v === "Strong Buy") return "from-bull/40 text-bull border-bull/40";
  if (v === "Buy") return "from-bull/20 text-bull border-bull/20";
  if (v === "Hold") return "from-muted/30 text-foreground border-border";
  if (v === "Sell") return "from-bear/20 text-bear border-bear/20";
  return "from-bear/40 text-bear border-bear/40";
};

export function FinalVerdictCard({ data }: { data: any }) {
  const v = data.verdict as Verdict;
  return (
    <div className={`rounded-xl border bg-gradient-to-br to-card p-6 ${verdictColor(v)}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest opacity-70">Final Verdict</div>
          <div className="font-display text-4xl font-semibold mt-1">{v}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Confidence</div>
          <div className="font-mono text-2xl">{(data.confidence * 100).toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">Agreement {(data.agreement_score * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="mt-5 grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border/60 bg-background/30 p-3">
          <div className="text-xs text-muted-foreground">Entry zone</div>
          <div className="font-mono mt-1">{data.entry_zone}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/30 p-3">
          <div className="text-xs text-muted-foreground">Stop loss</div>
          <div className="font-mono mt-1">{data.stop_loss}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/30 p-3">
          <div className="text-xs text-muted-foreground">Targets</div>
          <div className="font-mono mt-1">{(Array.isArray(data.targets) ? data.targets : []).join(" · ") || "—"}</div>
        </div>
      </div>
      <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
        <div><span className="text-xs text-muted-foreground">Position sizing:</span> {data.position_sizing}</div>
        <div><span className="text-xs text-muted-foreground">Liquidity:</span> {data.liquidity_note}</div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{data.rationale}</p>
    </div>
  );
}
