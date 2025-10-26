// app/api/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // <-- we'll set up this helper

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.email?.trim() && !body.phone?.trim()) {
      return NextResponse.json({ error: "Either email or phone is required" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        language: body.language || null,
        familyHome: body.familyHome || null,
        currentLocation: body.currentLocation || null,
        state: body.state || null,
        nationality: body.nationality || null,
      },
    });

    return NextResponse.json({ ok: true, id: user.id, name: user.name });
  } catch (err: any) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
