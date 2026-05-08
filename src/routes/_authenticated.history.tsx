import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAnalyses, deleteAnalysis } from "@/lib/analyze.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const fn = useServerFn(listAnalyses);
  const delFn = useServerFn(deleteAnalysis);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["analyses"], queryFn: () => fn() });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["analyses"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="font-display text-3xl font-semibold">History</h1>
        <Link to="/analyze" className="text-sm rounded-md bg-primary px-3 py-1.5 text-primary-foreground">+ New analysis</Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-20 rounded-lg border border-border bg-card animate-pulse" />)}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-bear/40 bg-bear/5 p-4 text-sm">
          <div className="text-bear font-semibold">Failed to load history</div>
          <button onClick={() => refetch()} className="mt-2 text-xs underline">Retry</button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <div className="font-display text-lg">No analyses yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Run your first 4-layer consensus analysis.</p>
          <Link to="/analyze" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Start analyzing</Link>
        </div>
      )}

      <div className="space-y-2">
        {data?.map((a) => {
          const v = a.final_verdict ?? "—";
          const tone = v.includes("Buy") ? "text-bull" : v.includes("Sell") ? "text-bear" : "text-foreground";
          return (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Link to="/history/$id" params={{ id: a.id }} className="flex-1 min-w-0">
                  <div className="font-display font-semibold">{a.symbol}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {a.asset_type} · {a.time_range} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </Link>
                <div className="text-right">
                  <div className={`font-mono text-sm ${tone}`}>{v}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    conf {a.confidence != null ? `${(Number(a.confidence) * 100).toFixed(0)}%` : "—"}
                    {a.risk_score != null ? ` · risk ${(Number(a.risk_score) * 100).toFixed(0)}%` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => navigate({ to: "/analyze", search: { symbol: a.symbol, assetType: a.asset_type, range: a.time_range } as any })}
                    className="text-[11px] rounded border border-border px-2 py-1 hover:bg-accent font-mono">
                    Re-run
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete analysis for ${a.symbol}?`)) del.mutate(a.id); }}
                    className="text-[11px] rounded border border-border px-2 py-1 hover:bg-bear/10 hover:text-bear font-mono">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
