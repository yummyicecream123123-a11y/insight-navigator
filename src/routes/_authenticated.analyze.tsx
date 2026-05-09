import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { runAnalysis } from "@/lib/analyze.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { PriceChart } from "@/components/PriceChart";
import { IndicatorTable } from "@/components/IndicatorTable";
import { LayerCard, FinalVerdictCard } from "@/components/AnalysisCards";
import { ResultBoxes } from "@/components/ResultBoxes";
import { NewsList } from "@/components/NewsList";

type SearchParams = { symbol?: string; assetType?: string; range?: string };
export const Route = createFileRoute("/_authenticated/analyze")({
  component: AnalyzePage,
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    symbol: typeof s.symbol === "string" ? s.symbol : undefined,
    assetType: typeof s.assetType === "string" ? s.assetType : undefined,
    range: typeof s.range === "string" ? s.range : undefined,
  }),
});

const ASSET_OPTIONS = [
  { value: "stock", label: "Stock", example: "AAPL" },
  { value: "etf", label: "ETF", example: "SPY" },
  { value: "crypto", label: "Crypto", example: "BTC" },
  { value: "forex", label: "Forex", example: "EURUSD" },
  { value: "commodity", label: "Commodity", example: "GC=F" },
] as const;
const RANGES = ["1D","5D","1M","3M","6M","1Y","5Y","MAX"] as const;

const asArr = <T,>(v: any): T[] => Array.isArray(v) ? v : [];

function AnalyzePage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const [assetType, setAssetType] = useState<typeof ASSET_OPTIONS[number]["value"]>(
    (ASSET_OPTIONS.find(a => a.value === search.assetType)?.value) ?? "stock"
  );
  const [symbol, setSymbol] = useState(search.symbol ?? "AAPL");
  const [range, setRange] = useState<typeof RANGES[number]>(
    (RANGES.includes(search.range as any) ? search.range : "3M") as typeof RANGES[number]
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const runFn = useServerFn(runAnalysis);

  const m = useMutation({
    mutationFn: async () => {
      const cleanSym = symbol.trim().toUpperCase();
      if (!cleanSym) throw new Error("Enter a symbol");
      let imageBase64: string | undefined;
      let imageMime: string | undefined;
      let imagePath: string | undefined;
      if (imageFile && user) {
        if (imageFile.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
        if (!/^image\/(png|jpeg|webp)$/.test(imageFile.type)) throw new Error("Image must be PNG, JPEG, or WebP");
        try {
          const buf = await imageFile.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          imageBase64 = btoa(bin);
          imageMime = imageFile.type;
          const path = `${user.id}/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const { error } = await supabase.storage.from("chart-uploads").upload(path, imageFile);
          if (!error) imagePath = path;
        } catch (e: any) {
          console.error("Image processing failed:", e);
          toast.warning("Couldn't attach image — running text-only analysis.");
          imageBase64 = undefined; imageMime = undefined; imagePath = undefined;
        }
      }
      return runFn({ data: { symbol: cleanSym, assetType, range, imageBase64, imageMime, imagePath } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Analysis failed"),
    onSuccess: () => toast.success("Analysis complete"),
  });

  const example = ASSET_OPTIONS.find((a) => a.value === assetType)?.example;
  const d = m.data;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Analyze</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick an asset, run the 4-layer consensus pipeline.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        className="rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Asset type</label>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value as any)}
              className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm">
              {ASSET_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Symbol</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)}
              placeholder={`e.g. ${example}`}
              className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono uppercase" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Time range</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {RANGES.map((r) => (
                <button key={r} type="button" onClick={() => setRange(r)}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono ${range === r ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-accent"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Optional chart image (vision analysis)</label>
          <input type="file" accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground" />
          {imageFile && <div className="mt-1 text-xs text-muted-foreground">{imageFile.name} · {(imageFile.size/1024).toFixed(0)}KB</div>}
        </div>

        <button type="submit" disabled={m.isPending}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {m.isPending ? "Running 4-layer consensus…" : "Run analysis"}
        </button>
      </form>

      {m.isPending && (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 space-y-3">
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Working</div>
          {["Fetching OHLCV…", "Computing 60+ indicators & patterns…", "Layer 1 expert opinion…", "Layer 2 pattern check…", "Layer 3 dynamics & liquidity…", "Layer 4 news & sentiment…", "Final consensus…"].map((s) => (
            <div key={s} className="flex items-center gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      )}

      {m.error && !m.isPending && (
        <div className="mt-6 rounded-xl border border-bear/40 bg-bear/5 p-5 text-sm">
          <div className="font-semibold text-bear">Analysis failed</div>
          <div className="mt-1 text-muted-foreground">{(m.error as any)?.message ?? "Unknown error"}</div>
          <button onClick={() => m.mutate()} className="mt-3 rounded border border-border px-3 py-1.5 text-xs hover:bg-accent">Try again</button>
        </div>
      )}

      {d && !m.isPending && (
        <div className="mt-8 space-y-6">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="font-display text-2xl font-semibold">{d.symbol}</div>
              <div className="text-xs text-muted-foreground font-mono">{d.exchange ?? assetType.toUpperCase()} · {range} · {d.indicators?.length ?? 0} signals · {d.news?.length ?? 0} headlines</div>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-bull">{d.summary.bullish} bull</span> · <span className="text-bear">{d.summary.bearish} bear</span> · {d.summary.neutral} neutral
            </div>
          </div>

          <ResultBoxes boxes={d.boxes as any} />
          <PriceChart candles={d.candles} />
          <FinalVerdictCard data={{ ...d.final, agreement_score: d.final.agreement_score, market_dynamics: d.layer3?.market_dynamics, liquidity_note: d.layer3?.liquidity_note }} />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <LayerCard tag="Layer 1" title="Expert Opinion" persona="Senior trader" bias={d.layer1?.bias} conviction={d.layer1?.conviction}>
              <p>{d.layer1?.thesis}</p>
              <div>
                <div className="text-xs text-muted-foreground">Key levels</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer1?.key_levels).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risks</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer1?.risks).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
            </LayerCard>

            <LayerCard tag="Layer 2" title="Pattern Confirmation" persona="Quant technician" bias={d.layer2?.bias} conviction={d.layer2?.conviction}>
              <p>{d.layer2?.summary}</p>
              <div>
                <div className="text-xs text-bull">Confirming</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer2?.confirming).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-bear">Contradicting</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer2?.contradicting).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
              {asArr(d.layer2?.divergences).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Divergences</div>
                  <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer2?.divergences).map((k, i) => <li key={i}>{k}</li>)}</ul>
                </div>
              )}
            </LayerCard>

            <LayerCard tag="Layer 3" title="Dynamics & Liquidity" persona="Microstructure analyst" bias={d.layer3?.bias} conviction={d.layer3?.conviction}>
              <p><span className="text-xs text-muted-foreground">Dynamics:</span> {d.layer3?.market_dynamics}</p>
              <p><span className="text-xs text-muted-foreground">Liquidity:</span> {d.layer3?.liquidity_note}</p>
              <p><span className="text-xs text-muted-foreground">Volatility:</span> {d.layer3?.volatility_note}</p>
              {asArr(d.layer3?.key_risks).length > 0 && (
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer3?.key_risks).map((k, i) => <li key={i}>{k}</li>)}</ul>
              )}
            </LayerCard>

            <LayerCard tag="Layer 4" title="News & Sentiment" persona="Macro / political analyst" bias={d.layer4?.bias} conviction={d.layer4?.conviction}>
              <p>{d.layer4?.summary}</p>
              {d.layer4?.political_drama && <p className="text-xs"><span className="text-muted-foreground">Political:</span> {d.layer4.political_drama}</p>}
              <div>
                <div className="text-xs text-muted-foreground">Catalysts</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer4?.catalysts).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Key headlines</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{asArr<string>(d.layer4?.key_headlines).slice(0,4).map((k, i) => <li key={i}>{k}</li>)}</ul>
              </div>
            </LayerCard>
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold mb-3">Recent headlines</h2>
            <NewsList items={d.news} />
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold mb-3">Indicator table ({d.indicators.length})</h2>
            <IndicatorTable items={d.indicators} />
          </div>
        </div>
      )}
    </main>
  );
}
