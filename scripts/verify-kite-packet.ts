// Verify the grounded packet against REAL Kite data (not docs).
// Needs your live daily access_token (from the kite.session cookie) + a running dev server.
//
// Run (token as arg, or set KITE_ACCESS_TOKEN):
//   npx ts-node --project tsconfig.scripts.json scripts/verify-kite-packet.ts <ACCESS_TOKEN> [SYMBOL ...]
// Defaults to ITC + 3IINFOLTD. BASE_URL env overrides http://localhost:3000.

const API_KEY = process.env.KITE_API_KEY ?? "";
const TOKEN = process.argv[2] || process.env.KITE_ACCESS_TOKEN || "";
const SYMBOLS = process.argv.slice(3).length ? process.argv.slice(3) : ["ITC", "3IINFOLTD"];
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const KITE_API = "https://api.kite.trade";

if (!API_KEY) { console.error("KITE_API_KEY missing from env (.env.local)."); process.exit(1); }
if (!TOKEN) { console.error("Pass the access_token as arg 1 or set KITE_ACCESS_TOKEN."); process.exit(1); }

const kiteHeaders = { "X-Kite-Version": "3", Authorization: `token ${API_KEY}:${TOKEN}` };
const cookie = { Cookie: `kite.session=${TOKEN}` };
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const line = (s: string) => console.log(`\n${"─".repeat(70)}\n${s}\n${"─".repeat(70)}`);

// Walk a JSON tree and report any number that is NaN/Infinity (the silent-garbage signal).
function scanNonFinite(obj: any, path = ""): string[] {
  const bad: string[] = [];
  if (obj && typeof obj === "object") {
    for (const k of Object.keys(obj)) bad.push(...scanNonFinite(obj[k], path ? `${path}.${k}` : k));
  } else if (typeof obj === "number" && !Number.isFinite(obj)) {
    bad.push(path);
  }
  return bad;
}

async function rawQuote(sym: string) {
  const res = await fetch(`${KITE_API}/quote?i=${encodeURIComponent(`NSE:${sym}`)}`, { headers: kiteHeaders });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, j };
}

async function rawHistorical(token: number) {
  const to = new Date();
  const from = new Date(to.getTime() - 370 * 86_400_000);
  const res = await fetch(`${KITE_API}/instruments/historical/${token}/day?from=${fmt(from)}&to=${fmt(to)}`, { headers: kiteHeaders });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, j };
}

async function main() {
  for (const sym of SYMBOLS) {
    line(`RAW KITE quote() — NSE:${sym}`);
    const q = await rawQuote(sym);
    if (!q.ok) {
      console.log(`✗ quote ${q.status}:`, JSON.stringify(q.j));
    } else {
      const data = q.j?.data?.[`NSE:${sym}`];
      if (data) delete data.depth; // huge order-book array, not relevant
      console.log(`data["NSE:${sym}"] =`, JSON.stringify(data, null, 2));
      const tok = data?.instrument_token;
      console.log(`\n→ field check: last_price=${data?.last_price}  ohlc.close=${data?.ohlc?.close}  lower_circuit_limit=${data?.lower_circuit_limit}  upper_circuit_limit=${data?.upper_circuit_limit}  volume=${data?.volume}`);

      if (tok) {
        line(`RAW KITE historical_data() — token ${tok} (first 2 + last 2 candles)`);
        const h = await rawHistorical(tok);
        const candles: any[] = h.j?.data?.candles ?? [];
        console.log(`count=${candles.length}, row shape = [ts, open, high, low, close, volume]`);
        console.log("first:", JSON.stringify(candles[0]));
        console.log("       ", JSON.stringify(candles[1]));
        console.log("last: ", JSON.stringify(candles[candles.length - 2]));
        console.log("       ", JSON.stringify(candles[candles.length - 1]));
      }
    }

    line(`ASSEMBLED PACKET — GET ${BASE}/api/kite/context?symbol=${sym}`);
    const ctxRes = await fetch(`${BASE}/api/kite/context?symbol=${sym}`, { headers: cookie });
    const ctx = await ctxRes.json().catch(() => ({}));
    console.log(`status ${ctxRes.status}:`, JSON.stringify(ctx, null, 2));
    const bad = scanNonFinite(ctx);
    console.log(bad.length ? `⚠ NON-FINITE NUMBERS at: ${bad.join(", ")}` : "✓ no NaN/Infinity in packet");

    line(`AI VERDICT — POST ${BASE}/api/market/analyse  { symbol: "${sym}" }`);
    const aRes = await fetch(`${BASE}/api/market/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookie },
      body: JSON.stringify({ symbol: sym }),
    });
    const a = await aRes.json().catch(() => ({}));
    console.log(`status ${aRes.status}:`, JSON.stringify(a, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
