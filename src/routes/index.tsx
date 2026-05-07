import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Tritone — Triple-confirmation AI Stock Analyzer" },
      { name: "description", content: "Run 40+ technical indicators and 3 layers of AI confirmation across stocks, ETFs, crypto, forex, and commodities." },
    ],
  }),
});

function Landing() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.78_0.16_195/0.18),transparent)]" />
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-block rounded-full border border-border bg-card/50 px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">Triple confirmation engine</span>
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-semibold tracking-tighter">
            Three eyes on every <span className="text-primary">trade</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-lg">
            Tritone fuses 40+ classical indicators, computer-vision chart reading, and three layers of AI confirmation —
            expert opinion, pattern check, and market dynamics — into a single decisive verdict.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/analyze" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Start analyzing</Link>
            <Link to="/login" className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent">Sign in</Link>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 grid md:grid-cols-3 gap-4">
        {[
          { tag: "Layer 1", title: "Expert Opinion", body: "A senior trader persona reads price action and any uploaded chart image, calls direction and key levels.", color: "from-primary/30" },
          { tag: "Layer 2", title: "Pattern Confirmation", body: "Quant technician cross-checks the thesis against 40+ live indicators — flagging confirmation, contradiction, divergence.", color: "from-bull/30" },
          { tag: "Layer 3", title: "Dynamics & Liquidity", body: "Microstructure analyst issues the final verdict with entry, stop, targets, and position-sizing.", color: "from-bear/30" },
        ].map((c, i) => (
          <motion.div
            key={c.tag}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 * i, duration: 0.5 }}
            className={`relative overflow-hidden rounded-xl border border-border bg-card p-6`}
          >
            <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${c.color} to-transparent opacity-40`} />
            <div className="text-xs font-mono uppercase tracking-widest text-primary">{c.tag}</div>
            <div className="mt-2 font-display text-xl font-semibold">{c.title}</div>
            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
          </motion.div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight">40+ tools at every step</h2>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-muted-foreground">
          {["RSI","MACD","Stochastic","Bollinger","ADX","Ichimoku","VWAP","PSAR","Supertrend","ATR","OBV","Vol Profile","CMF","MFI","Williams %R","CCI","ROC","TRIX","Awesome","Fibonacci","S/R","H&S","Double Top","Double Bottom","Asc Triangle","Desc Triangle","Wedges","Flags","Cup&Handle","Doji","Hammer","Engulfing","Morning Star","Evening Star","3 Soldiers","3 Crows","Harami","Piercing","Dark Cloud","Donchian","Keltner"].map((n) => (
            <div key={n} className="rounded border border-border bg-card/40 px-3 py-2">{n}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
