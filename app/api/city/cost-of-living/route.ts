import { NextResponse } from "next/server";
import { resolveBenchmarks } from "@/lib/costliving/resolveBenchmarks";
import { getMacroForCountry } from "@/lib/costliving/worldBankMacro";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city    = (searchParams.get("city")    ?? "").trim();
  const country = (searchParams.get("country") ?? "").trim();
  const state   = (searchParams.get("state")   ?? "").trim() || undefined;

  if (!city || !country) {
    return NextResponse.json({ error: "city and country are required" }, { status: 400 });
  }

  const bust = searchParams.get("bust") === "1";

  const [b, macro] = await Promise.all([
    resolveBenchmarks(city, country, state, bust),
    getMacroForCountry(country),
  ]);

  const { source, label, currency, ...numericFields } = b;
  return NextResponse.json({ source, label, currency, benchmarks: numericFields, macro });
}
