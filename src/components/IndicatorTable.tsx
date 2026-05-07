import type { IndicatorResult } from "@/lib/indicators.server";

export function IndicatorTable({ items }: { items: IndicatorResult[] }) {
  const cats = ["trend", "momentum", "volatility", "volume", "candlestick", "chart"] as const;
  return (
    <div className="space-y-4">
      {cats.map((cat) => {
        const list = items.filter((i) => i.category === cat);
        if (!list.length) return null;
        return (
          <div key={cat} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground border-b border-border bg-background/40 font-mono">{cat}</div>
            <div className="divide-y divide-border/60">
              {list.map((i) => (
                <div key={i.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    {i.note && <div className="text-xs text-muted-foreground">{i.note}</div>}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{i.value ?? ""}</div>
                  <span className={`text-[11px] uppercase font-mono px-2 py-0.5 rounded ${
                    i.signal === "bullish" ? "bg-bull/15 text-bull" :
                    i.signal === "bearish" ? "bg-bear/15 text-bear" :
                    "bg-muted text-muted-foreground"
                  }`}>{i.signal}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
