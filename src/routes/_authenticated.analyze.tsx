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

export const Route = createFileRoute("/_authenticated/analyze")({ component: AnalyzePage });

const ASSET_OPTIONS = [
  { value: "stock", label: "Stock", example: "AAPL" },
  { value: "etf", label: "ETF", example: "SPY" },
  { value: "crypto", label: "Crypto", example: "BTC" },
  { value: "forex", label: "Forex", example: "EURUSD" },
  { value: "commodity", label: "Commodity", example: "GC=F" },
] as const;
const RANGES = ["1D","5D","1M","3M","6M","1Y","5Y","MAX"] as const;

function AnalyzePage() {
  const { user } = useAuth();
  const [assetType, setAssetType] = useState<typeof ASSET_OPTIONS[number]["value"]>("stock");
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState<typeof RANGES[number]>("3M");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const runFn = useServerFn(runAnalysis);

  const m = useMutation({
    mutationFn: async () => {
      let imageBase64: string | undefined;
      let imageMime: string | undefined;
      let imagePath: string | undefined;
      if (imageFile && user) {
        if (imageFile.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
        const buf = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        imageBase64 = btoa(bin);
        imageMime = imageFile.type;
        const path = `${user.id}/${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        const { error } = await supabase.storage.from("chart-uploads").upload(path, imageFile);
        if (!error) imagePath = path;
      }
      return runFn({ data: { symbol, assetType, range, imageBase64, imageMime, imagePath } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Analysis failed"),
  });

  const example = ASSET_OPTIONS.find((a) => a.value === assetType)?.example;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Analyze</h1>
        <p className="text-sm text-muted-foreground mt-1">Pick an asset, run the triple-confirmation pipeline.</p>
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
          {m.isPending ? "Running 3-layer analysis…" : "Run analysis"}
        </button>
      </form>

      {m.data && (
        <div className="mt-8 space-y-6">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <div className="font-display text-2xl font-semibold">{m.data.symbol}</div>
              <div className="text-xs text-muted-foreground font-mono">{m.data.exchange ?? assetType.toUpperCase()} · {range} · {m.data.indicators.length} signals analyzed</div>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              <span className="text-bull">{m.data.summary.bullish} bull</span> · <span className="text-bear">{m.data.summary.bearish} bear</span> · {m.data.summary.neutral} neutral
            </div>
          </div>

          <PriceChart candles={m.data.candles} />

          <FinalVerdictCard data={m.data.layer3} />

          <div className="grid md:grid-cols-3 gap-4">
            <LayerCard tag="Layer 1" title="Expert Opinion" persona="Senior discretionary trader" bias={m.data.layer1.bias} conviction={m.data.layer1.conviction}>
              <p>{m.data.layer1.thesis}</p>
              <div>
                <div className="text-xs text-muted-foreground">Key levels</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{m.data.layer1.key_levels.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Risks</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{m.data.layer1.risks.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
              </div>
            </LayerCard>
            <LayerCard tag="Layer 2" title="Pattern Confirmation" persona="Quantitative technician" bias={m.data.layer2.bias} conviction={m.data.layer2.conviction}>
              <p>{m.data.layer2.summary}</p>
              <div>
                <div className="text-xs text-bull">Confirming</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{m.data.layer2.confirming.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-bear">Contradicting</div>
                <ul className="list-disc pl-4 mt-1 text-xs">{m.data.layer2.contradicting.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
              </div>
              {m.data.layer2.divergences?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Divergences</div>
                  <ul className="list-disc pl-4 mt-1 text-xs">{m.data.layer2.divergences.map((k: string, i: number) => <li key={i}>{k}</li>)}</ul>
                </div>
              )}
            </LayerCard>
            <LayerCard tag="Layer 3" title="Dynamics & Liquidity" persona="Market microstructure analyst">
              <p><span className="text-xs text-muted-foreground">Market dynamics:</span> {m.data.layer3.market_dynamics}</p>
              <p><span className="text-xs text-muted-foreground">Liquidity:</span> {m.data.layer3.liquidity_note}</p>
            </LayerCard>
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold mb-3">Indicator table ({m.data.indicators.length})</h2>
            <IndicatorTable items={m.data.indicators} />
          </div>
        </div>
      )}
    </main>
  );
}
