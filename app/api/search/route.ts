// app/api/search/route.ts (dev/test only)
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase().trim();

  const sample = [
    { id: "u1", type: "person", name: "Anil Kumar", subtitle: "Engineer • Assam", avatarUrl: null },
    { id: "u2", type: "person", name: "Amrita Singh", subtitle: "Designer • Kolkata", avatarUrl: null },
    { id: "p1", type: "page", name: "Kolkata Farmers", subtitle: "Community", avatarUrl: null },
    { id: "p2", type: "page", name: "Charaivati Official", subtitle: "Project", avatarUrl: null },
  ];

  const results = q ? sample.filter((r) => (r.name || "").toLowerCase().includes(q)) : [];

  return NextResponse.json({ ok: true, results });
}
