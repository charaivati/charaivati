// app/api/business/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const questions = await prisma.ideaQuestion.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("GET /api/business/questions", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}