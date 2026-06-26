// lib/marketMetrics.ts — pure server-side technicals from daily candles.
// All arithmetic lives here (never the AI). Tested by scripts/test-market-metrics.ts.
export type Candle = [string | number, number, number, number, number, number]; // [ts,o,h,l,c,v]

export type Metrics = {
  dma50: number | null;
  dma200: number | null;
  high52w: number | null;
  low52w: number | null;
  pctFrom52wHigh: number | null;
  pctFrom52wLow: number | null;
  returns: Record<"1W" | "1M" | "3M" | "6M" | "1Y", number | null>;
  rsi14: number | null;
  realizedVol20: number | null; // annualized %, 20-day
};

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

function sma(closes: number[], n: number): number | null {
  return closes.length >= n ? mean(closes.slice(-n)) : null;
}

function ret(closes: number[], ltp: number, daysAgo: number): number | null {
  if (closes.length <= daysAgo) return null;
  const past = closes[closes.length - 1 - daysAgo];
  return past ? (ltp / past - 1) * 100 : null;
}

// ponytail: simple 14-period RSI over the last 14 changes, not Wilder-smoothed
// across the full series. Fine for a glance; swap to Wilder if precision matters.
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + gain / period / avgLoss);
}

function realizedVol(closes: number[], period = 20): number | null {
  if (closes.length < period + 1) return null;
  const rets: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const m = mean(rets);
  const variance = mean(rets.map((r) => (r - m) ** 2));
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// NaN guard: a wrong field name / missing data yields undefined → NaN, which
// won't throw. Coerce to null so the AI sees an honest gap, never garbage.
const nz = (x: number | null): number | null => (x !== null && Number.isFinite(x) ? x : null);

export function computeMetrics(candles: Candle[], ltp: number): Metrics {
  // drop rows where any OHLC field isn't a finite number (bad/partial candles)
  const valid = candles.filter((c) => [c[1], c[2], c[3], c[4]].every(Number.isFinite));
  const closes = valid.map((c) => c[4]);
  const highs = valid.map((c) => c[2]);
  const lows = valid.map((c) => c[3]);
  const high52w = highs.length ? Math.max(...highs) : null;
  const low52w = lows.length ? Math.min(...lows) : null;
  const okLtp = Number.isFinite(ltp);
  return {
    dma50: nz(sma(closes, 50)),
    dma200: nz(sma(closes, 200)),
    high52w,
    low52w,
    pctFrom52wHigh: okLtp && high52w ? nz((ltp / high52w - 1) * 100) : null,
    pctFrom52wLow: okLtp && low52w ? nz((ltp / low52w - 1) * 100) : null,
    returns: {
      "1W": okLtp ? nz(ret(closes, ltp, 5)) : null,
      "1M": okLtp ? nz(ret(closes, ltp, 21)) : null,
      "3M": okLtp ? nz(ret(closes, ltp, 63)) : null,
      "6M": okLtp ? nz(ret(closes, ltp, 126)) : null,
      "1Y": okLtp ? nz(ret(closes, ltp, 250)) : null,
    },
    rsi14: nz(rsi(closes, 14)),
    realizedVol20: nz(realizedVol(closes, 20)),
  };
}
