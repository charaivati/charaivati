// lib/kiteContext.ts — builds the grounded per-stock context packet.
// Shared by GET /api/kite/context (display) and POST /api/market/analyse (AI),
// so the AI is grounded on the exact same server-computed figures the user sees.
import { kiteGet } from "@/lib/kite";
import { symbolToToken } from "@/lib/kiteInstruments";
import { computeMetrics, Candle, Metrics } from "@/lib/marketMetrics";

export type StockContext = {
  symbol: string;
  instrument_token: number;
  quote: {
    ltp: number;
    day_open?: number;
    day_high?: number;
    day_low?: number;
    prev_close?: number;
    volume?: number;
    lower_circuit?: number;
    upper_circuit?: number;
  };
  metrics: Metrics;
  holding: Record<string, number> | null;
};

export class SymbolNotFound extends Error {}

export async function buildContext(symbol: string, token: string): Promise<StockContext> {
  const sym = symbol.toUpperCase().trim();
  const instrumentToken = await symbolToToken(sym, token);
  if (!instrumentToken) throw new SymbolNotFound(`Unknown NSE symbol: ${sym}`);

  const to = new Date();
  const from = new Date(to.getTime() - 370 * 86_400_000); // ~250 trading days
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [quoteData, hist] = await Promise.all([
    kiteGet(`/quote?i=${encodeURIComponent(`NSE:${sym}`)}`, token),
    kiteGet(`/instruments/historical/${instrumentToken}/day?from=${fmt(from)}&to=${fmt(to)}`, token),
  ]);

  const quote = quoteData?.[`NSE:${sym}`];
  if (!quote) throw new Error("No quote returned.");

  const ltp: number = quote.last_price;
  const candles: Candle[] = hist?.candles ?? [];

  let holding: Record<string, number> | null = null;
  try {
    const holdings = await kiteGet("/portfolio/holdings", token);
    const h = (holdings ?? []).find((x: any) => x.tradingsymbol === sym);
    if (h) {
      holding = {
        quantity: h.quantity,
        average_price: h.average_price,
        last_price: h.last_price,
        unrealized_pnl: h.pnl,
        invested: h.average_price * h.quantity,
        current_value: h.last_price * h.quantity,
      };
    }
  } catch {
    /* holdings optional — context still valid for non-held symbols */
  }

  return {
    symbol: sym,
    instrument_token: instrumentToken,
    quote: {
      ltp,
      day_open: quote.ohlc?.open,
      day_high: quote.ohlc?.high,
      day_low: quote.ohlc?.low,
      prev_close: quote.ohlc?.close,
      volume: quote.volume,
      lower_circuit: quote.lower_circuit_limit,
      upper_circuit: quote.upper_circuit_limit,
    },
    metrics: computeMetrics(candles, ltp),
    holding,
  };
}
