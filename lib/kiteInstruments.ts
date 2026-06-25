// lib/kiteInstruments.ts — daily-cached NSE symbol→instrument_token lookup.
// historical_data() needs an instrument_token, not a symbol. Kite's
// /instruments/NSE returns a ~5MB CSV dump; we pull it once per day (memory +
// a temp file so cold starts / dev restarts within the day reuse it), never
// per request.
import fs from "fs";
import os from "os";
import path from "path";

const API_KEY = process.env.KITE_API_KEY ?? "";
const KITE_API = "https://api.kite.trade";
const CACHE_FILE = path.join(os.tmpdir(), "kite-nse-instruments.json");

let mem: { date: string; map: Map<string, number> } | null = null;

const today = () => new Date().toISOString().slice(0, 10);

function parse(csv: string): Map<string, number> {
  const map = new Map<string, number>();
  const lines = csv.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    // ponytail: front-column split — instrument_token(0) and tradingsymbol(2)
    // precede the `name` field, so a comma inside name (a later column) can't
    // shift these two indices. Add a real CSV parser only if we ever read name.
    const c = lines[i].split(",");
    const token = Number(c[0]);
    const symbol = c[2];
    if (token && symbol) map.set(symbol, token);
  }
  return map;
}

async function fetchInstruments(kiteToken: string): Promise<Map<string, number>> {
  const res = await fetch(`${KITE_API}/instruments/NSE`, {
    headers: { "X-Kite-Version": "3", Authorization: `token ${API_KEY}:${kiteToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kite instruments failed (${res.status})`);
  return parse(await res.text());
}

async function getMap(kiteToken: string): Promise<Map<string, number>> {
  const date = today();
  if (mem?.date === date) return mem.map;

  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (cached.date === date) {
      mem = { date, map: new Map(cached.entries) };
      return mem.map;
    }
  } catch {
    /* missing/stale file — fall through to fetch */
  }

  const map = await fetchInstruments(kiteToken);
  mem = { date, map };
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ date, entries: [...map] }));
  } catch {
    /* read-only fs (e.g. serverless) — memory cache still serves this instance */
  }
  return map;
}

export async function symbolToToken(symbol: string, kiteToken: string): Promise<number | null> {
  const map = await getMap(kiteToken);
  return map.get(symbol.toUpperCase()) ?? null;
}
