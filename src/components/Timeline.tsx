export type TimelineStep = { step: string; ms: number };

export function Timeline({ steps, totalMs }: { steps: TimelineStep[] | null | undefined; totalMs?: number }) {
  const list = Array.isArray(steps) ? steps : [];
  if (!list.length) return null;
  const total = totalMs ?? list.reduce((a, s) => a + s.ms, 0);
  const max = Math.max(...list.map((s) => s.ms), 1);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-primary">Process timeline</div>
          <h3 className="font-display text-lg font-semibold mt-0.5">Analysis pipeline</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total runtime</div>
          <div className="font-mono text-xl">{(total / 1000).toFixed(2)}s</div>
        </div>
      </div>
      <ul className="space-y-2">
        {list.map((s, i) => (
          <li key={i} className="grid grid-cols-[1.25rem_1fr_4.5rem] items-center gap-3 text-sm">
            <div className="h-5 w-5 rounded-full border border-primary/40 bg-primary/10 grid place-items-center text-[10px] font-mono text-primary">{i + 1}</div>
            <div>
              <div className="text-foreground">{s.step}</div>
              <div className="mt-1 h-1 rounded bg-background/60 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary/80 to-primary" style={{ width: `${Math.max(4, Math.round((s.ms / max) * 100))}%` }} />
              </div>
            </div>
            <div className="font-mono text-xs text-muted-foreground text-right tabular-nums">{s.ms < 1000 ? `${s.ms}ms` : `${(s.ms / 1000).toFixed(2)}s`}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
