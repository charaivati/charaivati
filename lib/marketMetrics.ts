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

export function computeMetrics(candles: Candle[], ltp: number): Metrics {
  const closes = candles.map((c) => c[4]);
  const highs = candles.map((c) => c[2]);
  const lows = candles.map((c) => c[3]);
  const high52w = highs.length ? Math.max(...highs) : null;
  const low52w = lows.length ? Math.min(...lows) : null;
  return {
    dma50: sma(closes, 50),
    dma200: sma(closes, 200),
    high52w,
    low52w,
    pctFrom52wHigh: high52w ? (ltp / high52w - 1) * 100 : null,
    pctFrom52wLow: low52w ? (ltp / low52w - 1) * 100 : null,
    returns: {
      "1W": ret(closes, ltp, 5),
      "1M": ret(closes, ltp, 21),
      "3M": ret(closes, ltp, 63),
      "6M": ret(closes, ltp, 126),
      "1Y": ret(closes, ltp, 250),
    },
    rsi14: rsi(closes, 14),
    realizedVol20: realizedVol(closes, 20),
  };
}
