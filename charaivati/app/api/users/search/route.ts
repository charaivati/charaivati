// app/api/users/search/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // adjust path if your alias differs

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? url.searchParams.get("query") ?? "").trim();

    if (!q) {
      return NextResponse.json({ ok: true, users: [] });
    }

    // limit / pagination
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const take = limit || 50;

    // perform case-insensitive search over useful fields
    const users = await db.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { id: { contains: q } }, // id is often cuid; we don't use mode here
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatarUrl: true,
      },
      take,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, users });
  } catch (err: any) {
    console.error("users/search error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
