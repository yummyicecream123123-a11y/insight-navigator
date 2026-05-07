// 40+ technical indicator & pattern computations
// Pure functions — server-only helpers.
import {
  SMA, EMA, MACD, RSI, BollingerBands, ADX, ATR, Stochastic, StochasticRSI,
  WilliamsR, CCI, ROC, MFI, TRIX, OBV, ForceIndex, VWAP, KeltnerChannels,
  PSAR, AwesomeOscillator, IchimokuCloud, ADL,
  bullish, bearish,
  bullishengulfingpattern, bearishengulfingpattern, doji, hammerpattern,
  shootingstar, morningstar, eveningstar, threewhitesoldiers, threeblackcrows,
  bullishharami, bearishharami, piercingline, darkcloudcover,
} from "technicalindicators";
import type { Candle } from "./market.functions";

export type Signal = "bullish" | "bearish" | "neutral";
export type IndicatorResult = {
  name: string;
  category: "trend" | "momentum" | "volatility" | "volume" | "candlestick" | "chart";
  signal: Signal;
  strength: number; // 0..1
  value?: string;
  note?: string;
};

const last = <T,>(arr: T[]): T | undefined => arr[arr.length - 1];
const prev = <T,>(arr: T[], n = 2): T | undefined => arr[arr.length - n];

function clamp(n: number, min = 0, max = 1) { return Math.max(min, Math.min(max, n)); }

export function computeAll(candles: Candle[]): IndicatorResult[] {
  const open = candles.map((c) => c.o);
  const high = candles.map((c) => c.h);
  const low = candles.map((c) => c.l);
  const close = candles.map((c) => c.c);
  const volume = candles.map((c) => c.v);
  const out: IndicatorResult[] = [];
  const price = last(close)!;
  const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

  // ====== TREND ======
  const sma20 = safe(() => SMA.calculate({ period: 20, values: close }), [] as number[]);
  const sma50 = safe(() => SMA.calculate({ period: 50, values: close }), [] as number[]);
  const sma200 = safe(() => SMA.calculate({ period: 200, values: close }), [] as number[]);
  for (const [n, arr] of [["SMA(20)", sma20], ["SMA(50)", sma50], ["SMA(200)", sma200]] as const) {
    const v = last(arr);
    if (v == null) continue;
    const sig: Signal = price > v ? "bullish" : price < v ? "bearish" : "neutral";
    out.push({ name: n, category: "trend", signal: sig, strength: clamp(Math.abs(price - v) / v * 10), value: v.toFixed(2), note: `Price ${sig === "bullish" ? "above" : "below"} ${n}` });
  }
  const ema9 = safe(() => EMA.calculate({ period: 9, values: close }), [] as number[]);
  const ema21 = safe(() => EMA.calculate({ period: 21, values: close }), [] as number[]);
  const ema50 = safe(() => EMA.calculate({ period: 50, values: close }), [] as number[]);
  for (const [n, arr] of [["EMA(9)", ema9], ["EMA(21)", ema21], ["EMA(50)", ema50]] as const) {
    const v = last(arr); if (v == null) continue;
    const sig: Signal = price > v ? "bullish" : "bearish";
    out.push({ name: n, category: "trend", signal: sig, strength: clamp(Math.abs(price - v) / v * 10), value: v.toFixed(2) });
  }

  // MACD
  const macd = safe(() => MACD.calculate({ values: close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }), [] as any[]);
  const m = last(macd);
  if (m && m.MACD != null && m.signal != null) {
    const hist = (m.MACD as number) - (m.signal as number);
    const sig: Signal = hist > 0 ? "bullish" : hist < 0 ? "bearish" : "neutral";
    out.push({ name: "MACD", category: "trend", signal: sig, strength: clamp(Math.abs(hist)), value: hist.toFixed(3), note: hist > 0 ? "Bullish crossover" : "Bearish crossover" });
  }

  // ADX
  const adx = safe(() => ADX.calculate({ close, high, low, period: 14 }), [] as any[]);
  const a = last(adx);
  if (a && a.adx != null) {
    const sig: Signal = a.pdi > a.mdi ? "bullish" : "bearish";
    out.push({ name: "ADX(14)", category: "trend", signal: a.adx < 20 ? "neutral" : sig, strength: clamp(a.adx / 50), value: a.adx.toFixed(1), note: a.adx > 25 ? "Strong trend" : "Weak/no trend" });
  }

  // PSAR
  const psar = safe(() => PSAR.calculate({ high, low, step: 0.02, max: 0.2 }), [] as number[]);
  const ps = last(psar);
  if (ps != null) {
    const sig: Signal = price > ps ? "bullish" : "bearish";
    out.push({ name: "Parabolic SAR", category: "trend", signal: sig, strength: 0.6, value: ps.toFixed(2) });
  }

  // Ichimoku
  const ich = safe(() => IchimokuCloud.calculate({ high, low, conversionPeriod: 9, basePeriod: 26, spanPeriod: 52, displacement: 26 }), [] as any[]);
  const i = last(ich);
  if (i) {
    const cloudTop = Math.max(i.spanA, i.spanB);
    const cloudBot = Math.min(i.spanA, i.spanB);
    const sig: Signal = price > cloudTop ? "bullish" : price < cloudBot ? "bearish" : "neutral";
    out.push({ name: "Ichimoku Cloud", category: "trend", signal: sig, strength: 0.7, value: `${cloudBot.toFixed(2)}–${cloudTop.toFixed(2)}` });
  }

  // VWAP (rolling proxy: cumulative for the window)
  const vw = safe(() => VWAP.calculate({ high, low, close, volume }), [] as number[]);
  const vwL = last(vw);
  if (vwL != null) {
    const sig: Signal = price > vwL ? "bullish" : "bearish";
    out.push({ name: "VWAP", category: "trend", signal: sig, strength: 0.6, value: vwL.toFixed(2) });
  }

  // Supertrend (custom, ATR-based)
  const atrArr = safe(() => ATR.calculate({ high, low, close, period: 14 }), [] as number[]);
  const atrL = last(atrArr);
  if (atrL != null) {
    const basis = (high[high.length - 1] + low[low.length - 1]) / 2;
    const upper = basis + 3 * atrL;
    const lower = basis - 3 * atrL;
    const sig: Signal = price > basis ? "bullish" : "bearish";
    out.push({ name: "Supertrend", category: "trend", signal: sig, strength: 0.65, value: `${lower.toFixed(2)}/${upper.toFixed(2)}` });
  }

  // Linear regression slope
  if (close.length >= 20) {
    const n = 20;
    const xs = Array.from({ length: n }, (_, i) => i);
    const ys = close.slice(-n);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0);
    const den = xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);
    const slope = num / den;
    const sig: Signal = slope > 0 ? "bullish" : slope < 0 ? "bearish" : "neutral";
    out.push({ name: "Linear Regression", category: "trend", signal: sig, strength: clamp(Math.abs(slope) / price * 100), value: slope.toFixed(4), note: "20-period slope" });
  }

  // ====== MOMENTUM ======
  const rsi = safe(() => RSI.calculate({ values: close, period: 14 }), [] as number[]);
  const r = last(rsi);
  if (r != null) {
    const sig: Signal = r > 70 ? "bearish" : r < 30 ? "bullish" : r > 50 ? "bullish" : "bearish";
    out.push({ name: "RSI(14)", category: "momentum", signal: sig, strength: clamp(Math.abs(r - 50) / 50), value: r.toFixed(1), note: r > 70 ? "Overbought" : r < 30 ? "Oversold" : undefined });
  }
  const stoch = safe(() => Stochastic.calculate({ high, low, close, period: 14, signalPeriod: 3 }), [] as any[]);
  const st = last(stoch);
  if (st && st.k != null) {
    const sig: Signal = st.k > 80 ? "bearish" : st.k < 20 ? "bullish" : st.k > st.d ? "bullish" : "bearish";
    out.push({ name: "Stochastic", category: "momentum", signal: sig, strength: clamp(Math.abs(st.k - 50) / 50), value: `${st.k.toFixed(0)}/${st.d.toFixed(0)}` });
  }
  const stochRsi = safe(() => StochasticRSI.calculate({ values: close, rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3 }), [] as any[]);
  const sr = last(stochRsi);
  if (sr && sr.k != null) {
    const sig: Signal = sr.k > 80 ? "bearish" : sr.k < 20 ? "bullish" : "neutral";
    out.push({ name: "Stoch RSI", category: "momentum", signal: sig, strength: clamp(Math.abs(sr.k - 50) / 50), value: sr.k.toFixed(0) });
  }
  const wr = safe(() => WilliamsR.calculate({ high, low, close, period: 14 }), [] as number[]);
  const wL = last(wr);
  if (wL != null) {
    const sig: Signal = wL > -20 ? "bearish" : wL < -80 ? "bullish" : "neutral";
    out.push({ name: "Williams %R", category: "momentum", signal: sig, strength: 0.55, value: wL.toFixed(1) });
  }
  const cci = safe(() => CCI.calculate({ high, low, close, period: 20 }), [] as number[]);
  const cciL = last(cci);
  if (cciL != null) {
    const sig: Signal = cciL > 100 ? "bullish" : cciL < -100 ? "bearish" : "neutral";
    out.push({ name: "CCI(20)", category: "momentum", signal: sig, strength: clamp(Math.abs(cciL) / 200), value: cciL.toFixed(0) });
  }
  const roc = safe(() => ROC.calculate({ values: close, period: 12 }), [] as number[]);
  const rocL = last(roc);
  if (rocL != null) {
    const sig: Signal = rocL > 0 ? "bullish" : "bearish";
    out.push({ name: "ROC(12)", category: "momentum", signal: sig, strength: clamp(Math.abs(rocL) / 10), value: `${rocL.toFixed(2)}%` });
  }
  const mfi = safe(() => MFI.calculate({ high, low, close, volume, period: 14 }), [] as number[]);
  const mfiL = last(mfi);
  if (mfiL != null) {
    const sig: Signal = mfiL > 80 ? "bearish" : mfiL < 20 ? "bullish" : mfiL > 50 ? "bullish" : "bearish";
    out.push({ name: "MFI(14)", category: "momentum", signal: sig, strength: clamp(Math.abs(mfiL - 50) / 50), value: mfiL.toFixed(1) });
  }
  const trix = safe(() => TRIX.calculate({ values: close, period: 18 }), [] as number[]);
  const trixL = last(trix);
  if (trixL != null) {
    const sig: Signal = trixL > 0 ? "bullish" : "bearish";
    out.push({ name: "TRIX", category: "momentum", signal: sig, strength: clamp(Math.abs(trixL) * 100), value: trixL.toFixed(4) });
  }
  const ao = safe(() => AwesomeOscillator.calculate({ high, low, fastPeriod: 5, slowPeriod: 34, format: (v) => v }), [] as number[]);
  const aoL = last(ao);
  if (aoL != null) {
    const sig: Signal = aoL > 0 ? "bullish" : "bearish";
    out.push({ name: "Awesome Osc", category: "momentum", signal: sig, strength: 0.5, value: aoL.toFixed(2) });
  }

  // ====== VOLATILITY ======
  const bb = safe(() => BollingerBands.calculate({ period: 20, stdDev: 2, values: close }), [] as any[]);
  const bbL = last(bb);
  if (bbL) {
    const pos = (price - bbL.lower) / (bbL.upper - bbL.lower);
    const sig: Signal = pos > 0.95 ? "bearish" : pos < 0.05 ? "bullish" : "neutral";
    out.push({ name: "Bollinger Bands", category: "volatility", signal: sig, strength: clamp(Math.abs(pos - 0.5) * 2), value: `${bbL.lower.toFixed(2)}–${bbL.upper.toFixed(2)}`, note: `Position ${(pos * 100).toFixed(0)}%` });
  }
  const kc = safe(() => KeltnerChannels.calculate({ high, low, close, maPeriod: 20, atrPeriod: 10, multiplier: 2, useSMA: false }), [] as any[]);
  const kcL = last(kc);
  if (kcL) {
    const sig: Signal = price > kcL.upper ? "bullish" : price < kcL.lower ? "bearish" : "neutral";
    out.push({ name: "Keltner Channel", category: "volatility", signal: sig, strength: 0.5, value: `${kcL.lower.toFixed(2)}–${kcL.upper.toFixed(2)}` });
  }
  // Donchian (custom)
  if (close.length >= 20) {
    const win = 20;
    const dHigh = Math.max(...high.slice(-win));
    const dLow = Math.min(...low.slice(-win));
    const sig: Signal = price >= dHigh * 0.99 ? "bullish" : price <= dLow * 1.01 ? "bearish" : "neutral";
    out.push({ name: "Donchian(20)", category: "volatility", signal: sig, strength: 0.55, value: `${dLow.toFixed(2)}–${dHigh.toFixed(2)}` });
  }
  if (atrL != null) {
    out.push({ name: "ATR(14)", category: "volatility", signal: "neutral", strength: clamp(atrL / price * 20), value: atrL.toFixed(2), note: `${(atrL / price * 100).toFixed(2)}% of price` });
  }
  if (close.length >= 20) {
    const win = close.slice(-20);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length);
    out.push({ name: "Std Dev(20)", category: "volatility", signal: "neutral", strength: clamp(sd / price * 20), value: sd.toFixed(2) });
  }
  // Chaikin volatility
  if (close.length >= 20) {
    const hlEma = EMA.calculate({ period: 10, values: high.map((h, i) => h - low[i]) });
    if (hlEma.length >= 11) {
      const cv = ((hlEma[hlEma.length - 1] - hlEma[hlEma.length - 11]) / hlEma[hlEma.length - 11]) * 100;
      const sig: Signal = cv > 0 ? "bullish" : "bearish";
      out.push({ name: "Chaikin Vol", category: "volatility", signal: sig, strength: clamp(Math.abs(cv) / 50), value: `${cv.toFixed(1)}%` });
    }
  }

  // ====== VOLUME ======
  const obv = safe(() => OBV.calculate({ close, volume }), [] as number[]);
  if (obv.length >= 2) {
    const sig: Signal = obv[obv.length - 1] > obv[obv.length - 2] ? "bullish" : "bearish";
    out.push({ name: "OBV", category: "volume", signal: sig, strength: 0.5, value: last(obv)!.toExponential(2) });
  }
  const adl = safe(() => ADL.calculate({ high, low, close, volume }), [] as number[]);
  if (adl.length >= 2) {
    const sig: Signal = adl[adl.length - 1] > adl[adl.length - 2] ? "bullish" : "bearish";
    out.push({ name: "Acc/Dist Line", category: "volume", signal: sig, strength: 0.5, value: last(adl)!.toExponential(2) });
  }
  // Chaikin Money Flow (manual)
  if (candles.length >= 20) {
    const win = candles.slice(-20);
    let mfvSum = 0, volSum = 0;
    for (const c of win) {
      const range = c.h - c.l || 1e-9;
      const mfm = ((c.c - c.l) - (c.h - c.c)) / range;
      mfvSum += mfm * c.v;
      volSum += c.v;
    }
    const cmfL = volSum > 0 ? mfvSum / volSum : 0;
    const sig: Signal = cmfL > 0.05 ? "bullish" : cmfL < -0.05 ? "bearish" : "neutral";
    out.push({ name: "Chaikin Money Flow", category: "volume", signal: sig, strength: clamp(Math.abs(cmfL) * 5), value: cmfL.toFixed(3) });
  }
  // Volume profile (POC/VAH/VAL) — simplified 20-bin
  if (candles.length >= 20) {
    const window = candles.slice(-Math.min(100, candles.length));
    const lo = Math.min(...window.map((c) => c.l));
    const hi = Math.max(...window.map((c) => c.h));
    const bins = 20;
    const w = (hi - lo) / bins;
    const vol = new Array(bins).fill(0);
    for (const c of window) {
      const mid = (c.h + c.l) / 2;
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((mid - lo) / w)));
      vol[idx] += c.v;
    }
    const pocIdx = vol.indexOf(Math.max(...vol));
    const poc = lo + (pocIdx + 0.5) * w;
    const sig: Signal = price > poc ? "bullish" : "bearish";
    out.push({ name: "Volume Profile POC", category: "volume", signal: sig, strength: 0.6, value: poc.toFixed(2), note: `Range ${lo.toFixed(2)}–${hi.toFixed(2)}` });
  }
  const fi = safe(() => ForceIndex.calculate({ close, volume, period: 13 }), [] as number[]);
  const fiL = last(fi);
  if (fiL != null) {
    const sig: Signal = fiL > 0 ? "bullish" : "bearish";
    out.push({ name: "Force Index", category: "volume", signal: sig, strength: 0.5, value: fiL.toExponential(2) });
  }
  // Ease of Movement (custom)
  if (candles.length >= 14) {
    const eom: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const dm = ((high[i] + low[i]) / 2) - ((high[i - 1] + low[i - 1]) / 2);
      const br = volume[i] / 100000000 / Math.max(0.0001, high[i] - low[i]);
      eom.push(dm / Math.max(br, 0.0001));
    }
    const eomAvg = eom.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const sig: Signal = eomAvg > 0 ? "bullish" : "bearish";
    out.push({ name: "Ease of Movement", category: "volume", signal: sig, strength: 0.45, value: eomAvg.toFixed(3) });
  }

  // ====== CANDLESTICK PATTERNS ======
  const lookback = Math.min(5, candles.length);
  const slice = candles.slice(-lookback);
  const input = {
    open: slice.map((c) => c.o), close: slice.map((c) => c.c),
    high: slice.map((c) => c.h), low: slice.map((c) => c.l),
  };
  const candlePatterns: { name: string; fn: (i: any) => boolean; signal: Signal }[] = [
    { name: "Doji", fn: doji, signal: "neutral" },
    { name: "Hammer", fn: hammerpattern, signal: "bullish" },
    { name: "Shooting Star", fn: shootingstar, signal: "bearish" },
    { name: "Bullish Engulfing", fn: bullishengulfingpattern, signal: "bullish" },
    { name: "Bearish Engulfing", fn: bearishengulfingpattern, signal: "bearish" },
    { name: "Morning Star", fn: morningstar, signal: "bullish" },
    { name: "Evening Star", fn: eveningstar, signal: "bearish" },
    { name: "Three White Soldiers", fn: threewhitesoldiers, signal: "bullish" },
    { name: "Three Black Crows", fn: threeblackcrows, signal: "bearish" },
    { name: "Bullish Harami", fn: bullishharami, signal: "bullish" },
    { name: "Bearish Harami", fn: bearishharami, signal: "bearish" },
    { name: "Piercing Line", fn: piercingline, signal: "bullish" },
    { name: "Dark Cloud Cover", fn: darkcloudcover, signal: "bearish" },
  ];
  for (const p of candlePatterns) {
    const detected = safe(() => p.fn(input), false);
    out.push({
      name: p.name, category: "candlestick",
      signal: detected ? p.signal : "neutral",
      strength: detected ? 0.7 : 0.1,
      value: detected ? "detected" : "—",
    });
  }
  // Aggregate bullish/bearish trend candles
  const bull = safe(() => bullish(input), false);
  const bear = safe(() => bearish(input), false);
  out.push({ name: "Recent Bias (candles)", category: "candlestick", signal: bull ? "bullish" : bear ? "bearish" : "neutral", strength: bull || bear ? 0.5 : 0.1, value: bull ? "bullish" : bear ? "bearish" : "mixed" });

  // ====== CHART PATTERNS (heuristic) ======
  // Support / Resistance from recent swings
  if (candles.length >= 30) {
    const win = candles.slice(-50);
    const sup = Math.min(...win.map((c) => c.l));
    const res = Math.max(...win.map((c) => c.h));
    const distSup = ((price - sup) / price) * 100;
    const distRes = ((res - price) / price) * 100;
    const sig: Signal = distSup < 1 ? "bullish" : distRes < 1 ? "bearish" : "neutral";
    out.push({ name: "Support / Resistance", category: "chart", signal: sig, strength: 0.6, value: `S ${sup.toFixed(2)} / R ${res.toFixed(2)}`, note: `${distSup.toFixed(1)}% from S, ${distRes.toFixed(1)}% from R` });

    // Fibonacci retracement
    const diff = res - sup;
    const fib618 = res - diff * 0.618;
    const fib382 = res - diff * 0.382;
    const sigF: Signal = price < fib618 ? "bearish" : price > fib382 ? "bullish" : "neutral";
    out.push({ name: "Fibonacci Retr.", category: "chart", signal: sigF, strength: 0.4, value: `0.382 ${fib382.toFixed(2)} / 0.618 ${fib618.toFixed(2)}` });
  }

  // Double top / bottom (rough)
  if (candles.length >= 30) {
    const win = candles.slice(-30);
    const peaks = win
      .map((c, i) => ({ i, h: c.h }))
      .sort((a, b) => b.h - a.h)
      .slice(0, 2);
    const troughs = win
      .map((c, i) => ({ i, l: c.l }))
      .sort((a, b) => a.l - b.l)
      .slice(0, 2);
    const dt = peaks.length === 2 && Math.abs(peaks[0].h - peaks[1].h) / peaks[0].h < 0.01 && Math.abs(peaks[0].i - peaks[1].i) > 5;
    const db = troughs.length === 2 && Math.abs(troughs[0].l - troughs[1].l) / troughs[0].l < 0.01 && Math.abs(troughs[0].i - troughs[1].i) > 5;
    out.push({ name: "Double Top", category: "chart", signal: dt ? "bearish" : "neutral", strength: dt ? 0.7 : 0.1, value: dt ? "detected" : "—" });
    out.push({ name: "Double Bottom", category: "chart", signal: db ? "bullish" : "neutral", strength: db ? 0.7 : 0.1, value: db ? "detected" : "—" });
  }

  // Triangle / wedge / flag heuristics via slope of highs vs lows
  if (candles.length >= 20) {
    const win = candles.slice(-20);
    const hi = win.map((c) => c.h);
    const lo = win.map((c) => c.l);
    const slope = (arr: number[]) => {
      const n = arr.length, mean = arr.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      arr.forEach((v, i) => { num += (i - n / 2) * (v - mean); den += (i - n / 2) ** 2; });
      return num / den;
    };
    const sH = slope(hi), sL = slope(lo);
    const symT = sH < 0 && sL > 0;
    const ascT = Math.abs(sH) < 0.05 && sL > 0;
    const descT = sH < 0 && Math.abs(sL) < 0.05;
    const wedgeUp = sH > 0 && sL > 0 && sL > sH;
    const wedgeDn = sH < 0 && sL < 0 && sH > sL;
    const flagUp = sH > 0 && sL > 0 && Math.abs(sH - sL) < 0.05;
    const flagDn = sH < 0 && sL < 0 && Math.abs(sH - sL) < 0.05;
    out.push({ name: "Symmetrical Triangle", category: "chart", signal: symT ? "neutral" : "neutral", strength: symT ? 0.6 : 0.1, value: symT ? "forming" : "—" });
    out.push({ name: "Ascending Triangle", category: "chart", signal: ascT ? "bullish" : "neutral", strength: ascT ? 0.7 : 0.1, value: ascT ? "forming" : "—" });
    out.push({ name: "Descending Triangle", category: "chart", signal: descT ? "bearish" : "neutral", strength: descT ? 0.7 : 0.1, value: descT ? "forming" : "—" });
    out.push({ name: "Rising Wedge", category: "chart", signal: wedgeUp ? "bearish" : "neutral", strength: wedgeUp ? 0.6 : 0.1, value: wedgeUp ? "forming" : "—" });
    out.push({ name: "Falling Wedge", category: "chart", signal: wedgeDn ? "bullish" : "neutral", strength: wedgeDn ? 0.6 : 0.1, value: wedgeDn ? "forming" : "—" });
    out.push({ name: "Bull Flag", category: "chart", signal: flagUp ? "bullish" : "neutral", strength: flagUp ? 0.55 : 0.1, value: flagUp ? "forming" : "—" });
    out.push({ name: "Bear Flag", category: "chart", signal: flagDn ? "bearish" : "neutral", strength: flagDn ? 0.55 : 0.1, value: flagDn ? "forming" : "—" });
  }

  // Head & Shoulders heuristic
  if (candles.length >= 40) {
    const win = candles.slice(-40);
    const mid = Math.floor(win.length / 2);
    const leftMax = Math.max(...win.slice(0, mid - 5).map((c) => c.h));
    const rightMax = Math.max(...win.slice(mid + 5).map((c) => c.h));
    const head = Math.max(...win.slice(mid - 5, mid + 5).map((c) => c.h));
    const hs = head > leftMax && head > rightMax && Math.abs(leftMax - rightMax) / leftMax < 0.03;
    out.push({ name: "Head & Shoulders", category: "chart", signal: hs ? "bearish" : "neutral", strength: hs ? 0.7 : 0.1, value: hs ? "detected" : "—" });
  }

  // Cup & Handle (very rough)
  if (candles.length >= 60) {
    const win = candles.slice(-60);
    const startC = win[0].c, endC = win[win.length - 1].c;
    const minC = Math.min(...win.map((c) => c.l));
    const cup = Math.abs(startC - endC) / startC < 0.05 && minC < startC * 0.9;
    out.push({ name: "Cup & Handle", category: "chart", signal: cup ? "bullish" : "neutral", strength: cup ? 0.55 : 0.1, value: cup ? "possible" : "—" });
  }

  return out;
}

export function summarize(indicators: IndicatorResult[]) {
  const score = indicators.reduce((acc, i) => acc + (i.signal === "bullish" ? i.strength : i.signal === "bearish" ? -i.strength : 0), 0);
  const total = indicators.reduce((acc, i) => acc + (i.signal !== "neutral" ? 1 : 0), 0);
  const bullish = indicators.filter((i) => i.signal === "bullish").length;
  const bearish = indicators.filter((i) => i.signal === "bearish").length;
  const neutral = indicators.filter((i) => i.signal === "neutral").length;
  return { score, total, bullish, bearish, neutral };
}
