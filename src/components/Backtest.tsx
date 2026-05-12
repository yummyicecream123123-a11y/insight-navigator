import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runBacktestTrial } from "@/lib/analyze.functions";
import type { Range } from "@/lib/market.schema";

// 15 diverse, liquid tickers across sectors
const TICKERS: { symbol: string; assetType: "stock" | "etf" | "crypto" | "forex" | "commodity" }[] = [
  { symbol: "AAPL",   assetType: "stock" },
  { symbol: "MSFT",   assetType: "stock" },
  { symbol: "NVDA",   assetType: "stock" },
  { symbol: "TSLA",   assetType: "stock" },
  { symbol: "AMZN",   assetType: "stock" },
  { symbol: "META",   assetType: "stock" },
  { symbol: "GOOGL",  assetType: "stock" },
  { symbol: "JPM",    assetType: "stock" },
  { symbol: "XOM",    assetType: "stock" },
  { symbol: "UNH",    assetType: "stock" },
  { symbol: "SPY",    assetType: "etf" },
  { symbol: "QQQ",    assetType: "etf" },
  { symbol: "BTC",    assetType: "crypto" },
  { symbol: "ETH",    assetType: "crypto" },
  { symbol: "GC=F",   assetType: "commodity" },
];

const RANGES: Range[] = ["1m", "5m", "10m", "1h", "3h", "1D", "5D", "1M", "3M", "6M"];

const ACCURACY_TARGET = 0.7;
const MIN_TRIALS_BEFORE_STOP = 30;

type Trial = {
  symbol: string;
  range: Range;
  predictedBias?: "bullish" | "bearish" | "neutral";
  actualBias?: "bullish" | "bearish" | "neutral";
  actualPct?: number;
  correct?: boolean;
  latencyMs?: number;
  error?: string;
  status: "pending" | "running" | "done" | "error";
};

const toneFor = (b?: string) =>
  b === "bullish" ? "text-bull" : b === "bearish" ? "text-bear" : "text-muted-foreground";

export function Backtest() {
  const trialFn = useServerFn(runBacktestTrial);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [running, setRunning] = useState(false);
  const [stoppedEarly, setStoppedEarly] = useState(false);
  const abortRef = useRef(false);

  const plan = useMemo<Trial[]>(
    () => TICKERS.flatMap((t) => RANGES.map((r) => ({ symbol: t.symbol, range: r, status: "pending" as const }))),
    []
  );

  const stats = useMemo(() => {
    const done = trials.filter((t) => t.status === "done");
    const correct = done.filter((t) => t.correct).length;
    const accuracy = done.length ? correct / done.length : 0;
    const errors = trials.filter((t) => t.status === "error").length;
    return { done: done.length, correct, accuracy, errors };
  }, [trials]);

  const start = async () => {
    abortRef.current = false;
    setStoppedEarly(false);
    setRunning(true);
    setTrials(plan);

    let done = 0;
    let correct = 0;

    for (let i = 0; i < plan.length; i++) {
      if (abortRef.current) break;
      const cur = plan[i];
      const ticker = TICKERS.find((t) => t.symbol === cur.symbol)!;

      setTrials((prev) => prev.map((t, idx) => (idx === i ? { ...t, status: "running" } : t)));
      try {
        const r: any = await trialFn({ data: { symbol: cur.symbol, assetType: ticker.assetType, range: cur.range } });
        done++;
        if (r.correct) correct++;
        setTrials((prev) =>
          prev.map((t, idx) =>
            idx === i
              ? {
                  ...t,
                  status: "done",
                  predictedBias: r.predictedBias,
                  actualBias: r.actualBias,
                  actualPct: r.actualPct,
                  correct: r.correct,
                  latencyMs: r.latencyMs,
                }
              : t
          )
        );

        const acc = done / Math.max(1, done);
        if (done >= MIN_TRIALS_BEFORE_STOP && correct / done >= ACCURACY_TARGET) {
          setStoppedEarly(true);
          break;
        }
        // Tiny delay to let UI breathe and stay below rate limits
        await new Promise((res) => setTimeout(res, 250));
        void acc;
      } catch (e: any) {
        setTrials((prev) =>
          prev.map((t, idx) => (idx === i ? { ...t, status: "error", error: e?.message ?? "failed" } : t))
        );
      }
    }
    setRunning(false);
  };

  const stop = () => {
    abortRef.current = true;
  };

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/40 p-5 shadow-xl">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-primary font-mono">Quality lab</div>
          <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">Walk-forward backtest</h2>
          <p className="text-xs text-muted-foreground mt-1">
            15 tickers × {RANGES.length} timeframes. AI sees only history, never the future slice. Stops at ≥{Math.round(ACCURACY_TARGET * 100)}% rolling accuracy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running ? (
            <button
              onClick={start}
              className="rounded-md bg-gradient-to-r from-primary to-primary/80 px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:shadow-primary/40 transition-shadow"
            >
              Run backtest →
            </button>
          ) : (
            <button onClick={stop} className="rounded-md border border-bear/40 bg-bear/5 px-4 py-2 text-xs font-semibold text-bear hover:bg-bear/10">
              Stop
            </button>
          )}
        </div>
      </div>

      {trials.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Trials" value={`${stats.done} / ${plan.length}`} />
            <Stat label="Correct" value={`${stats.correct}`} tone="bull" />
            <Stat
              label="Accuracy"
              value={`${(stats.accuracy * 100).toFixed(1)}%`}
              tone={stats.accuracy >= ACCURACY_TARGET ? "bull" : stats.done > MIN_TRIALS_BEFORE_STOP ? "bear" : undefined}
            />
            <Stat label="Errors" value={`${stats.errors}`} tone={stats.errors ? "bear" : undefined} />
          </div>

          <div className="mt-3 h-1.5 rounded bg-background/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${((stats.done + stats.errors) / plan.length) * 100}%` }}
            />
          </div>

          {stoppedEarly && (
            <div className="mt-3 rounded-md border border-bull/40 bg-bull/5 px-3 py-2 text-xs text-bull">
              Reached {Math.round(ACCURACY_TARGET * 100)}% accuracy at {stats.done} trials — stopped early.
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs font-mono">
              <thead className="bg-background/40 text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Range</th>
                  <th className="px-3 py-2">Predicted</th>
                  <th className="px-3 py-2">Actual</th>
                  <th className="px-3 py-2 text-right">Move</th>
                  <th className="px-3 py-2 text-right">Result</th>
                  <th className="px-3 py-2 text-right">Latency</th>
                </tr>
              </thead>
              <tbody>
                {trials.map((t, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5">{t.symbol}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.range}</td>
                    <td className={`px-3 py-1.5 ${toneFor(t.predictedBias)}`}>{t.predictedBias ?? (t.status === "running" ? "…" : t.status === "error" ? "—" : "·")}</td>
                    <td className={`px-3 py-1.5 ${toneFor(t.actualBias)}`}>{t.actualBias ?? "·"}</td>
                    <td className={`px-3 py-1.5 text-right ${t.actualPct == null ? "text-muted-foreground" : t.actualPct > 0 ? "text-bull" : t.actualPct < 0 ? "text-bear" : ""}`}>
                      {t.actualPct == null ? "·" : `${t.actualPct >= 0 ? "+" : ""}${t.actualPct.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {t.status === "error" ? (
                        <span className="text-bear" title={t.error}>err</span>
                      ) : t.correct == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : t.correct ? (
                        <span className="text-bull">✓ hit</span>
                      ) : (
                        <span className="text-bear">✗ miss</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{t.latencyMs ? `${t.latencyMs}ms` : "·"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  const cls = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
