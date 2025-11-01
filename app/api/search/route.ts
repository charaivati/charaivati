// app/api/search/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";

    // If you already have a single search implementation on server/db, call that.
    // This example proxies two endpoints and merges them.
    // Adjust timeouts / error handling / auth as needed.

    const [peopleRes, pagesRes] = await Promise.allSettled([
      fetch(`${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}/api/search/people?q=${encodeURIComponent(q)}`, { credentials: "include" }),
      fetch(`${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}/api/search/pages?q=${encodeURIComponent(q)}`, { credentials: "include" }),
    ]);

    const people = (peopleRes.status === "fulfilled" && peopleRes.value.ok)
      ? await peopleRes.value.json().then((d: any) => d.results ?? [])
      : [];

    const pages = (pagesRes.status === "fulfilled" && pagesRes.value.ok)
      ? await pagesRes.value.json().then((d: any) => d.results ?? [])
      : [];

    // Basic normalization & merge:
    const normalize = (entry: any, type: "person" | "page") => ({
      id: entry.id ?? entry._id ?? String(entry._id ?? ""),
      type,
      name: entry.name ?? entry.title ?? entry.displayName ?? "",
      subtitle: entry.subtitle ?? entry.bio ?? entry.description ?? "",
      avatarUrl: entry.avatarUrl ?? entry.image ?? null,
      score: entry.score ?? entry.relevance ?? 0,
      raw: entry,
    });

    const normPeople = Array.isArray(people) ? people.map((p: any) => normalize(p, "person")) : [];
    const normPages = Array.isArray(pages) ? pages.map((p: any) => normalize(p, "page")) : [];

    // Combine and sort by score (desc) then by type (person first)
    const combined = [...normPeople, ...normPages].sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
      // fallback stable ordering
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "person" ? -1 : 1;
    });

    return NextResponse.json({ ok: true, results: combined });
  } catch (err: any) {
    console.error("Search aggregation error", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? "Search failed"), results: [] }, { status: 500 });
  }
}
