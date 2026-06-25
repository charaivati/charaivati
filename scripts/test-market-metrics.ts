// Run: npx ts-node --project tsconfig.scripts.json scripts/test-market-metrics.ts
// Deterministic check for lib/marketMetrics.ts — closes = 100,101,...,349 (250 days).
import assert from "assert";
import { computeMetrics, Candle } from "../lib/marketMetrics";

const candles: Candle[] = Array.from({ length: 250 }, (_, i) => {
  const close = 100 + i;
  return [i, close - 0.5, close + 1, close - 1, close, 1000] as Candle;
});
const ltp = 349; // last close
const m = computeMetrics(candles, ltp);

const near = (a: number | null, b: number, tol = 0.01) =>
  a !== null && Math.abs(a - b) < tol;

assert(near(m.dma50, 324.5), `dma50 ${m.dma50}`);
assert(near(m.dma200, 249.5), `dma200 ${m.dma200}`);
assert(m.high52w === 350, `high52w ${m.high52w}`);
assert(m.low52w === 99, `low52w ${m.low52w}`);
assert(near(m.pctFrom52wHigh, (349 / 350 - 1) * 100), `pctFrom52wHigh ${m.pctFrom52wHigh}`);
assert(near(m.returns["1W"]!, (349 / 344 - 1) * 100), `1W ${m.returns["1W"]}`);
assert(m.returns["6M"] !== null, "6M present");
assert(m.returns["1Y"] === null, "1Y null with exactly 250 candles (needs >250 back)");
assert(m.rsi14 === 100, `rsi all-gains should be 100, got ${m.rsi14}`); // no down days
assert(m.realizedVol20 !== null && m.realizedVol20 > 0, `vol positive ${m.realizedVol20}`);

// short series → windows lacking data return null, not a crash
const short = computeMetrics(candles.slice(0, 10), 109);
assert(short.dma50 === null && short.dma200 === null, "short-series DMA guards");
assert(short.rsi14 === null, "rsi14 null on 10 candles (needs 15)");
assert(computeMetrics(candles.slice(0, 16), 115).rsi14 !== null, "rsi14 works on 16 candles");

console.log("✓ market-metrics: all checks passed");
