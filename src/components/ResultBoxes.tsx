type Tone = "bull" | "bear" | "neutral";
type Box = { label: string; value: string | number; tone?: Tone; details?: string[]; score?: number; count?: number };

const toneClass = (t?: Tone) =>
  t === "bull" ? "border-bull/40 bg-bull/5 text-bull"
  : t === "bear" ? "border-bear/40 bg-bear/5 text-bear"
  : "border-border bg-card text-foreground";

export function ResultBoxes({ boxes }: { boxes: Record<string, Box> | null | undefined }) {
  if (!boxes) return null;
  const order = ["result", "trend", "expert", "patterns", "risk", "sentiment", "consensus", "confidence", "horizon", "rr"];
  const list = order.map((k) => boxes[k]).filter(Boolean);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {list.map((b, i) => (
        <div key={i} className={`rounded-xl border p-4 ${toneClass(b.tone)}`}>
          <div className="text-[10px] uppercase tracking-widest opacity-70 font-mono">{b.label}</div>
          <div className="mt-1.5 font-display text-xl font-semibold leading-tight break-words">{b.value}</div>
          {b.details && b.details.length > 0 && (
            <ul className="mt-2 text-[11px] opacity-80 space-y-0.5 line-clamp-6">
              {b.details.map((d, j) => <li key={j}>· {d}</li>)}
            </ul>
          )}
          {b.score != null && (
            <div className="mt-2 h-1 rounded bg-background/40 overflow-hidden">
              <div className="h-full bg-current" style={{ width: `${Math.round(b.score * 100)}%` }} />
            </div>
          )}
          {b.count != null && <div className="mt-1 text-[10px] opacity-60 font-mono">{b.count} headlines</div>}
        </div>
      ))}
    </div>
  );
}
