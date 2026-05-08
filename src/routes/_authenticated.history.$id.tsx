import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalysis } from "@/lib/analyze.functions";
import { IndicatorTable } from "@/components/IndicatorTable";
import { LayerCard, FinalVerdictCard } from "@/components/AnalysisCards";
import { ResultBoxes } from "@/components/ResultBoxes";
import { NewsList } from "@/components/NewsList";

export const Route = createFileRoute("/_authenticated/history/$id")({ component: DetailPage });

const asArr = <T,>(v: any): T[] => Array.isArray(v) ? v : [];
const RANGES = ["1D","5D","1M","3M","6M","1Y","5Y","MAX"] as const;

function DetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fn = useServerFn(getAnalysis);
  const { data, isLoading, error } = useQuery({ queryKey: ["analysis", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading) return <main className="p-6"><div className="h-32 rounded-lg bg-card animate-pulse" /></main>;
  if (error || !data) return (
    <main className="p-6">
      <div className="rounded-lg border border-bear/40 bg-bear/5 p-4 text-sm">
        <div className="text-bear font-semibold">Couldn't load analysis</div>
        <Link to="/history" className="text-xs underline mt-2 inline-block">← Back to history</Link>
      </div>
    </main>
  );

  const l1: any = data.layer1, l2: any = data.layer2, l3: any = data.layer3, l4: any = data.layer4;
  const boxes: any = data.boxes;
  const news: any = data.news;
  const indicators: any = data.indicators;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">← History</Link>
          <h1 className="font-display text-3xl font-semibold mt-1">{data.symbol}</h1>
          <div className="text-xs text-muted-foreground font-mono">{data.asset_type} · {data.time_range} · {new Date(data.created_at).toLocaleString()}</div>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">Re-run with:</span>
          {RANGES.map((r) => (
            <button key={r}
              onClick={() => navigate({ to: "/analyze", search: { symbol: data.symbol, assetType: data.asset_type, range: r } as any })}
              className={`text-[11px] font-mono rounded border px-2 py-1 ${r === data.time_range ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {boxes && <ResultBoxes boxes={boxes} />}
      {l3 && <FinalVerdictCard data={l3} />}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {l1 && <LayerCard tag="Layer 1" title="Expert Opinion" persona="Senior trader" bias={l1.bias} conviction={l1.conviction}>
          <p>{l1.thesis}</p>
        </LayerCard>}
        {l2 && <LayerCard tag="Layer 2" title="Pattern Confirmation" persona="Quant technician" bias={l2.bias} conviction={l2.conviction}>
          <p>{l2.summary}</p>
          {asArr(l2.detected_patterns).length > 0 && (
            <ul className="list-disc pl-4 text-xs">{asArr<string>(l2.detected_patterns).map((p, i) => <li key={i}>{p}</li>)}</ul>
          )}
        </LayerCard>}
        {l3 && <LayerCard tag="Layer 3" title="Dynamics & Liquidity" persona="Microstructure analyst" bias={l3.bias} conviction={l3.conviction}>
          <p>{l3.market_dynamics}</p>
          {l3.liquidity_note && <p className="text-xs"><span className="text-muted-foreground">Liquidity:</span> {l3.liquidity_note}</p>}
        </LayerCard>}
        {l4 && <LayerCard tag="Layer 4" title="News & Sentiment" persona="Macro analyst" bias={l4.bias} conviction={l4.conviction}>
          <p>{l4.summary}</p>
          {l4.political_drama && <p className="text-xs"><span className="text-muted-foreground">Political:</span> {l4.political_drama}</p>}
        </LayerCard>}
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold mb-3">Headlines</h2>
        <NewsList items={news} />
      </div>

      <IndicatorTable items={asArr(indicators)} />
    </main>
  );
}
