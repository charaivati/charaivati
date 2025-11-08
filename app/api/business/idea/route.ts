// app/api/business/idea/route.ts
// POST: Create new idea, GET: Fetch ideas, PUT: Update idea

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, userEmail, userPhone, userId } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const shareToken = Math.random().toString(36).substring(2, 15);

    const idea = await prisma.businessIdea.create({
      data: {
        title,
        description,
        userEmail,
        userPhone,
        userId,
        shareToken,
        responses: {},
      },
    });

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    console.error("POST /api/business/idea", error);
    return NextResponse.json(
      { error: "Failed to create idea" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ideaId = searchParams.get("ideaId");
    const shareToken = searchParams.get("shareToken");

    if (!ideaId && !shareToken) {
      return NextResponse.json(
        { error: "ideaId or shareToken required" },
        { status: 400 }
      );
    }

    const idea = await prisma.businessIdea.findFirst({
      where: ideaId ? { id: ideaId } : { shareToken },
      include: {
        ideaResponses: true,
      },
    });

    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    return NextResponse.json(idea);
  } catch (error) {
    console.error("GET /api/business/idea", error);
    return NextResponse.json(
      { error: "Failed to fetch idea" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ideaId, responses, status } = body;

    if (!ideaId) {
      return NextResponse.json(
        { error: "ideaId is required" },
        { status: 400 }
      );
    }

    const updatedIdea = await prisma.businessIdea.update({
      where: { id: ideaId },
      data: {
        responses: responses || undefined,
        status: status || undefined,
        updatedAt: new Date(),
      },
      include: {
        ideaResponses: true,
      },
    });

    return NextResponse.json(updatedIdea);
  } catch (error) {
    console.error("PUT /api/business/idea", error);
    return NextResponse.json(
      { error: "Failed to update idea" },
      { status: 500 }
    );
  }
}