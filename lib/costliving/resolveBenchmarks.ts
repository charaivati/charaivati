import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis";

const CACHE_TTL = 60 * 60 * 24; // 24h

// USD exchange rates — good enough for display; update annually
const USD_RATES: Record<string, number> = {
  INR: 83.5, CNY: 7.25, JPY: 155, EUR: 0.92, GBP: 0.79, CAD: 1.37,
  AUD: 1.54, BRL: 5.1, RUB: 90, MXN: 17.5, IDR: 16000, ZAR: 18.5,
  NGN: 1550, KES: 130, GHS: 15, BDT: 110, PKR: 278, LKR: 300, NPR: 133,
  THB: 35, VND: 25000, MYR: 4.7, SGD: 1.34, PHP: 56,
};

export type Benchmarks = {
  rent1br?: number;
  foodMonthly?: number;
  transportPass?: number;
  utilities?: number;
  mealCheap?: number;
  internetMo?: number;
  avgSalary?: number;
  currency: string;
  source: "city" | "country" | "none";
  label: string;
};

type CountryRow = {
  localCurrency: string | null;
  rent1brOutUSD: number | null;
  mealCheapUSD: number | null;
  transportUSD: number | null;
  utilitiesUSD: number | null;
  internetUSD: number | null;
  salaryUSD: number | null;
};

function usdTo(usd: number | null, currency: string): number | undefined {
  if (usd == null) return undefined;
  const rate = USD_RATES[currency] ?? 1;
  return Math.round(usd * rate);
}

function countryRowToBenchmarks(row: CountryRow, label: string): Benchmarks {
  const currency = row.localCurrency ?? "USD";
  // Estimate food monthly from meal price × 60 (2 cheap meals/day)
  const foodMonthly = row.mealCheapUSD ? usdTo(row.mealCheapUSD * 60, currency) : undefined;
  return {
    rent1br:       usdTo(row.rent1brOutUSD, currency),
    foodMonthly,
    transportPass: usdTo(row.transportUSD, currency),
    utilities:     usdTo(row.utilitiesUSD, currency),
    mealCheap:     usdTo(row.mealCheapUSD, currency),
    internetMo:    usdTo(row.internetUSD, currency),
    avgSalary:     usdTo(row.salaryUSD, currency),
    currency,
    source: "country",
    label,
  };
}

export async function resolveBenchmarks(
  city: string, country: string, _state?: string, bypassCache = false
): Promise<Benchmarks> {
  const { client, kind } = await getRedisClient();
  const cacheKey = `col:${city.toLowerCase()}:${country.toLowerCase()}`;

  // Redis hit (skip on explicit bust)
  if (!bypassCache && client && kind !== "none") {
    try {
      const cached = kind === "upstash"
        ? await (client as import("@upstash/redis").Redis).get<Benchmarks>(cacheKey)
        : JSON.parse((await (client as import("ioredis").Redis).get(cacheKey)) ?? "null");
      if (cached) return cached;
    } catch { /* fall through */ }
  }

  let result: Benchmarks = { currency: "USD", source: "none", label: city };

  // Tier 1: exact city match in CityLivingCost (future city-level CSV)
  try {
    const rows = await db.$queryRaw<Array<{city:string;currency:string;rent1br:number|null;foodMonthly:number|null;transportPass:number|null;utilities:number|null;mealCheap:number|null;internetMo:number|null}>>`
      SELECT city, currency, rent1br, "foodMonthly", "transportPass", utilities, "mealCheap", "internetMo"
      FROM "CityLivingCost"
      WHERE LOWER(city) = LOWER(${city}) AND LOWER(country) = LOWER(${country})
      LIMIT 1
    `;
    if (rows[0]) {
      const r = rows[0];
      result = {
        rent1br: r.rent1br ?? undefined,
        foodMonthly: r.foodMonthly ?? undefined,
        transportPass: r.transportPass ?? undefined,
        utilities: r.utilities ?? undefined,
        mealCheap: r.mealCheap ?? undefined,
        internetMo: r.internetMo ?? undefined,
        currency: r.currency ?? "INR",
        source: "city",
        label: r.city,
      };
    }
  } catch { /* table not yet created */ }

  // Tier 2: country-level from CountryLivingCost (seeded from Numbeo CSV)
  if (result.source === "none") {
    try {
      const rows = await db.$queryRaw<CountryRow[]>`
        SELECT "localCurrency", "rent1brOutUSD", "mealCheapUSD",
               "transportUSD", "utilitiesUSD", "internetUSD", "salaryUSD"
        FROM "CountryLivingCost"
        WHERE LOWER(country) = LOWER(${country})
        LIMIT 1
      `;
      if (rows[0]) {
        result = countryRowToBenchmarks(rows[0], `${country} avg`);
      }
    } catch { /* table not yet created */ }
  }

  // Cache result
  if (client && kind !== "none") {
    try {
      if (kind === "upstash") {
        await (client as import("@upstash/redis").Redis).set(cacheKey, result, { ex: CACHE_TTL });
      } else {
        await (client as import("ioredis").Redis).set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
      }
    } catch { /* non-critical */ }
  }

  return result;
}
