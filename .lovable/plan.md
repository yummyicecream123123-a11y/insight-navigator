
# Stock & Chart Analyzer

A 3-layer AI-driven analysis tool for stocks, ETFs, crypto, forex, and commodities. Combines live OHLCV data with 40+ technical indicators/patterns and optional chart-image vision analysis, all gated behind sign-in with saved history.

## Stack & integrations

- Lovable Cloud (auth + Postgres + storage for uploaded chart images)
- Lovable AI Gateway — `google/gemini-3-flash-preview` (multimodal text+vision)
- `yahoo-finance2` (npm) for OHLCV across all asset classes via symbol conventions (e.g. `AAPL`, `BTC-USD`, `EURUSD=X`, `GC=F`)
- Recharts for the price/indicator visualization

## Core flow

1. User signs in (email/password + Google).
2. On `/analyze`: pick **asset type**, enter **symbol**, choose **time range**, optionally **upload a chart image**, click Analyze.
3. Server function fetches OHLCV, computes 40+ indicators/patterns locally, then runs the **3-layer AI pipeline**.
4. Results are streamed back, rendered, and persisted to history.

### Inputs

- **Asset types**: Stock, ETF, Crypto, Forex, Commodity (drives symbol formatting hints + Yahoo suffix mapping).
- **Time range**: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y, MAX (maps to Yahoo `period`/`interval`).
- **Chart image upload** (optional, ≤5MB, PNG/JPG/WebP) stored in `chart-uploads` bucket (private, signed URL passed to AI).

### 40+ indicators & patterns computed server-side

Trend: SMA(20/50/200), EMA(9/21/50), MACD, ADX, Ichimoku Cloud, Parabolic SAR, Supertrend, VWAP, Linear Regression channel.
Momentum: RSI(14), Stochastic, Stoch RSI, Williams %R, CCI, ROC, MFI, TSI, Awesome Oscillator.
Volatility: Bollinger Bands, Keltner Channels, Donchian Channels, ATR, Standard Deviation, Chaikin Volatility.
Volume: OBV, Accumulation/Distribution, Chaikin Money Flow, Volume Profile (POC/VAH/VAL), Force Index, Ease of Movement.
Candlestick patterns: Doji, Hammer, Shooting Star, Engulfing (bull/bear), Morning/Evening Star, Three White Soldiers, Three Black Crows, Harami, Piercing Line, Dark Cloud Cover.
Chart patterns (heuristic detection): Head & Shoulders, Double Top/Bottom, Triangles (asc/desc/sym), Flags, Wedges, Cup & Handle, Support/Resistance levels, Trendline breaks, Fibonacci retracements.

Implemented with `technicalindicators` (npm) + custom pattern detectors. Each indicator emits a normalized `{ name, signal: 'bullish'|'bearish'|'neutral', strength: 0-1, value, note }`.

### 3-layer confirmation pipeline

All three layers call the AI gateway through `createServerFn`. Each layer's output feeds the next.

**Layer 1 — Expert Opinion**
Input: symbol, asset type, range, latest OHLCV summary, recent price action, optional uploaded chart image (vision).
Prompt persona: senior discretionary trader. Returns thesis, bias (bull/bear/neutral), conviction, key levels, risks.

**Layer 2 — Pattern Confirmation**
Input: Layer-1 output + the full 40+ indicator/pattern signal table.
Prompt persona: quantitative technician. Cross-checks the expert thesis against the indicator table, lists confirming vs contradicting signals, recomputes bias and conviction, flags divergences.

**Layer 3 — Market Dynamics & Liquidity Confirmation**
Input: Layers 1+2 + volume profile, VWAP behavior, ATR/volatility regime, average spread proxy (high-low), liquidity proxy (avg dollar volume), session/seasonality notes.
Prompt persona: market microstructure analyst. Issues final verdict: **Strong Buy / Buy / Hold / Sell / Strong Sell** with entry zone, stop, targets, position-sizing note, and an explicit "agreement score" across the 3 layers.

Output rendered as 3 stacked cards + a final verdict banner with traffic-light color and confidence bar.

## Pages & routes

```
/                       Landing (hero + CTA)
/login                  Email/password + Google
/_authenticated/
  analyze               Main analyzer (form + results)
  history               List of past analyses
  history/$id           Saved analysis detail
```

## Database (Lovable Cloud)

```text
profiles(id uuid pk -> auth.users, display_name, created_at)
analyses(
  id uuid pk, user_id uuid, symbol text, asset_type text,
  time_range text, image_path text null,
  indicators jsonb, layer1 jsonb, layer2 jsonb, layer3 jsonb,
  final_verdict text, confidence numeric, created_at timestamptz
)
```
RLS: users can read/write only their own rows. Storage bucket `chart-uploads` private with per-user folder policy.

## Server functions (`src/lib/`)

- `market.functions.ts` — `fetchOhlcv({ symbol, assetType, range })` via yahoo-finance2.
- `indicators.server.ts` — pure functions computing all 40+ signals.
- `analyze.functions.ts` — orchestrates fetch → indicators → 3 AI layers → DB insert. Auth-protected with `requireSupabaseAuth`.
- `history.functions.ts` — list/get user analyses.

## UI components

- `AnalyzerForm` (asset type select, symbol input with examples per type, range tabs, image dropzone)
- `PriceChart` (Recharts line + SMA overlays + volume bars)
- `IndicatorTable` (sortable, color-coded bull/bear/neutral)
- `LayerCard` (collapsible, persona icon, bias chip, key bullets)
- `FinalVerdict` (traffic-light banner, entry/stop/target, agreement meter)
- `HistoryList` & `AnalysisDetail`

## Design direction

Editorial finance terminal aesthetic: deep navy/charcoal background, restrained typography (Space Grotesk display + Inter body), cyan/magenta accent for bull/bear, monospaced numerics, generous whitespace around key verdicts. Dark theme primary, light theme available.

## Out of scope (v1)

- Real-time streaming quotes (snapshot per analyze click only)
- Portfolio tracking / alerts
- Backtesting
- Options chain analysis

