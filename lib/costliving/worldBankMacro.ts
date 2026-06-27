import { getRedisClient } from "@/lib/redis";
import { db } from "@/lib/db";

const CACHE_TTL = 60 * 60 * 24 * 7; // 7 days

// Minimal country-name → ISO2 map for common cases
const COUNTRY_CODES: Record<string, string> = {
  india: "IN", "united states": "US", china: "CN", brazil: "BR",
  germany: "DE", "united kingdom": "GB", france: "FR", japan: "JP",
  indonesia: "ID", pakistan: "PK", bangladesh: "BD", nigeria: "NG",
  russia: "RU", ethiopia: "ET", mexico: "MX", philippines: "PH",
  egypt: "EG", "south africa": "ZA", kenya: "KE", ghana: "GH",
  thailand: "TH", vietnam: "VN", malaysia: "MY", singapore: "SG",
  nepal: "NP", "sri lanka": "LK", myanmar: "MM", cambodia: "KH",
};

export type MacroData = {
  cpiLatest: number | null;
  cpiPrev: number | null;
  inflationRate: number | null;
  gdpPerCapUSD: number | null;
};

function countryCode(country: string): string | null {
  return COUNTRY_CODES[country.toLowerCase()] ?? null;
}

async function fetchWorldBank(indicator: string, code: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.worldbank.org/v2/country/${code}/indicator/${indicator}?format=json&mrv=2`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data[1] as { value: number | null; date: string }[] | null;
    return rows?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function getMacroForCountry(country: string): Promise<MacroData | null> {
  const code = countryCode(country);
  if (!code) return null;

  const { client, kind } = await getRedisClient();
  const cacheKey = `wb:macro:${code}`;

  // Redis hit
  if (client && kind !== "none") {
    try {
      const cached = kind === "upstash"
        ? await (client as import("@upstash/redis").Redis).get<MacroData>(cacheKey)
        : JSON.parse((await (client as import("ioredis").Redis).get(cacheKey)) ?? "null");
      if (cached) return cached;
    } catch { /* fall through */ }
  }

  // Fetch from World Bank
  const [cpiLatest, cpiPrev, gdpPerCapUSD] = await Promise.all([
    fetchWorldBank("FP.CPI.TOTL", code),
    fetchWorldBank("FP.CPI.TOTL", code).then(async () => {
      // fetch previous year by getting mrv=2 and taking second row
      try {
        const res = await fetch(
          `https://api.worldbank.org/v2/country/${code}/indicator/FP.CPI.TOTL?format=json&mrv=2`,
          { signal: AbortSignal.timeout(8000) }
        );
        const data = await res.json();
        const rows = data[1] as { value: number | null }[] | null;
        return rows?.[1]?.value ?? null;
      } catch { return null; }
    }),
    fetchWorldBank("NY.GDP.PCAP.CD", code),
  ]);

  const inflationRate = cpiLatest && cpiPrev && cpiPrev > 0
    ? parseFloat(((cpiLatest - cpiPrev) / cpiPrev * 100).toFixed(1))
    : null;

  const result: MacroData = { cpiLatest, cpiPrev, inflationRate, gdpPerCapUSD };

  // Cache in Redis
  if (client && kind !== "none") {
    try {
      if (kind === "upstash") {
        await (client as import("@upstash/redis").Redis).set(cacheKey, result, { ex: CACHE_TTL });
      } else {
        await (client as import("ioredis").Redis).set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
      }
    } catch { /* non-critical */ }
  }

  // Upsert into DB for offline fallback
  try {
    await (db as any).countryLivingCost.upsert({
      where: { country },
      update: { countryCode: code, cpiLatest, cpiPrev, gdpPerCapUSD },
      create: { id: `${code}-macro`, country, countryCode: code, cpiLatest, cpiPrev, gdpPerCapUSD },
    });
  } catch { /* stale client — non-critical */ }

  return result;
}
