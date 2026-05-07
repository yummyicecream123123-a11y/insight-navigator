import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAnalysis } from "@/lib/analyze.functions";
import { IndicatorTable } from "@/components/IndicatorTable";
import { LayerCard, FinalVerdictCard } from "@/components/AnalysisCards";

export const Route = createFileRoute("/_authenticated/history/$id")({ component: DetailPage });

function DetailPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getAnalysis);
  const { data, isLoading } = useQuery({ queryKey: ["analysis", id], queryFn: () => fn({ data: { id } }) });

  if (isLoading || !data) return <main className="p-6 text-sm text-muted-foreground">Loading…</main>;
  const l1: any = data.layer1, l2: any = data.layer2, l3: any = data.layer3;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Link to="/history" className="text-xs text-muted-foreground hover:text-foreground">← History</Link>
          <h1 className="font-display text-3xl font-semibold mt-1">{data.symbol}</h1>
          <div className="text-xs text-muted-foreground font-mono">{data.asset_type} · {data.time_range} · {new Date(data.created_at).toLocaleString()}</div>
        </div>
      </div>
      {l3 && <FinalVerdictCard data={l3} />}
      <div className="grid md:grid-cols-3 gap-4">
        {l1 && <LayerCard tag="Layer 1" title="Expert Opinion" persona="Senior trader" bias={l1.bias} conviction={l1.conviction}>
          <p>{l1.thesis}</p>
        </LayerCard>}
        {l2 && <LayerCard tag="Layer 2" title="Pattern Confirmation" persona="Quant technician" bias={l2.bias} conviction={l2.conviction}>
          <p>{l2.summary}</p>
        </LayerCard>}
        {l3 && <LayerCard tag="Layer 3" title="Dynamics & Liquidity" persona="Microstructure analyst">
          <p>{l3.rationale}</p>
        </LayerCard>}
      </div>
      <IndicatorTable items={(data.indicators as any) ?? []} />
    </main>
  );
}
