import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase() || "";
  const level = Number(url.searchParams.get("level") || 1);

  // temporary mock data
  const sample = [
    { id: 1, name: "India", level: 1 },
    { id: 2, name: "Odisha", level: 2 },
    { id: 3, name: "Khordha", level: 3 },
    { id: 4, name: "Ward 1", level: 5 },
  ];

  const filtered = sample.filter(
    (x) => x.level === level && x.name.toLowerCase().includes(q)
  );
  return NextResponse.json(filtered);
}
