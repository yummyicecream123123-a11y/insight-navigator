import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAnalyses } from "@/lib/analyze.functions";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const fn = useServerFn(listAnalyses);
  const { data, isLoading } = useQuery({ queryKey: ["analyses"], queryFn: () => fn() });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="font-display text-3xl font-semibold mb-6">History</h1>
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {data && data.length === 0 && <div className="text-sm text-muted-foreground">No analyses yet. <Link to="/analyze" className="text-primary">Run one</Link>.</div>}
      <div className="space-y-2">
        {data?.map((a) => (
          <Link key={a.id} to="/history/$id" params={{ id: a.id }}
            className="block rounded-lg border border-border bg-card p-4 hover:border-primary/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-semibold">{a.symbol}</div>
                <div className="text-xs text-muted-foreground font-mono">{a.asset_type} · {a.time_range} · {new Date(a.created_at).toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{a.final_verdict}</div>
                <div className="text-xs text-muted-foreground">{a.confidence != null ? `${(Number(a.confidence) * 100).toFixed(0)}%` : ""}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
