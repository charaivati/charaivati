// app/api/register/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReqBody = {
  name?: string;
  email?: string;
  phone?: string;
  language?: string;
  familyHome?: string;
  currentLocation?: string;
  state?: string;
  nationality?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.email && !body.phone) {
      return NextResponse.json(
        { error: "Either email or phone is required" },
        { status: 400 }
      );
    }

    // Build a clean data object with only known runtime values.
    const data: Record<string, any> = {
      name: String(body.name).trim(),
      email: body.email ? String(body.email).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
    };

    // Optional fields — add only if provided and non-empty
    if (body.familyHome) data.familyHome = body.familyHome;
    if (body.currentLocation) data.currentLocation = body.currentLocation;
    if (body.state) data.state = body.state;
    if (body.nationality) data.nationality = body.nationality;
    // NOTE: don't add 'language' if your Prisma schema doesn't have it.
    // If your schema has language on a different model, write a separate relation update.

    // Cast as any to satisfy Prisma's type system when schema differs.
    const user = await prisma.user.create({
      data: data as any,
    });

    return NextResponse.json({ ok: true, id: user.id, name: user.name });
  } catch (err: any) {
    console.error("register error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
