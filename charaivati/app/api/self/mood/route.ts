// app/api/self/mood/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromReq } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { moodRating, healthRating, notes } = await req.json();
  const mood = await prisma.mood.create({
    data: { userId: user.id, moodRating, healthRating, notes },
  });
  return NextResponse.json({ mood });
}

export async function GET(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recent = await prisma.mood.findMany({
    where: { userId: user.id },
    orderBy: { recordedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ moods: recent });
}
