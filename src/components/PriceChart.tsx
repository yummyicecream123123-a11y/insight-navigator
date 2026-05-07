import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Bar, ComposedChart } from "recharts";
import type { Candle } from "@/lib/market.functions";

export function PriceChart({ candles }: { candles: Candle[] }) {
  const data = candles.map((c) => ({
    t: new Date(c.t).toLocaleDateString(),
    close: c.c,
    volume: c.v,
  }));
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="oklch(0.28 0.02 250)" strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: "oklch(0.68 0.03 250)" }} minTickGap={40} />
            <YAxis yAxisId="p" domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "oklch(0.68 0.03 250)" }} width={50} />
            <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 10, fill: "oklch(0.68 0.03 250)" }} width={50} />
            <Tooltip
              contentStyle={{ background: "oklch(0.18 0.025 250)", border: "1px solid oklch(0.28 0.025 250)", fontSize: 12, borderRadius: 6 }}
              labelStyle={{ color: "oklch(0.96 0.01 250)" }}
            />
            <Bar yAxisId="v" dataKey="volume" fill="oklch(0.30 0.04 250)" opacity={0.5} />
            <Line yAxisId="p" type="monotone" dataKey="close" stroke="oklch(0.78 0.16 195)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
