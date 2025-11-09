// app/api/admin/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// Verify admin via JWT
async function verifyAdmin(request: NextRequest) {
  const adminEmail = process.env.EMAIL_USER;
  if (!adminEmail) return false;

  const user = await getCurrentUser(request);
  return user?.email === adminEmail;
}

// GET - Fetch all questions (public)
export async function GET(request: NextRequest) {
  try {
    const questions = await prisma.ideaQuestion.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Fetch questions error:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

// POST - Create new question
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      order,
      text,
      type,
      category,
      scoringDim,
      options,
      helpText,
      examples,
      randomizeOptions,
    } = body;

    if (!text || !type || !scoringDim) {
      return NextResponse.json({ error: "text, type, and scoringDim required" }, { status: 400 });
    }

    // Find next order if not provided
    const maxOrder = await prisma.ideaQuestion.aggregate({
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;

    // IMPORTANT: pass options as JSON (object/array) or undefined, not a JSON string
    const payloadOptions = options ?? undefined;

    const created = await prisma.ideaQuestion.create({
      data: {
        order: order ?? nextOrder,
        text,
        type,
        category: category ?? "general",
        scoringDim,
        options: payloadOptions,
        helpText,
        examples,
        randomizeOptions: randomizeOptions ?? true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

// PUT - Update question
export async function PUT(request: NextRequest) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      order,
      text,
      type,
      category,
      scoringDim,
      options,
      helpText,
      examples,
      randomizeOptions,
    } = body;

    if (!id || !text) {
      return NextResponse.json({ error: "id and text required" }, { status: 400 });
    }

    const payloadOptions = options ?? undefined;

    const updated = await prisma.ideaQuestion.update({
      where: { id },
      data: {
        order,
        text,
        type,
        category,
        scoringDim,
        options: payloadOptions,
        helpText,
        examples,
        randomizeOptions: randomizeOptions ?? true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update question error:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

// DELETE - Delete question
export async function DELETE(request: NextRequest) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await prisma.ideaQuestion.delete({ where: { id } });

    return NextResponse.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Delete question error:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
