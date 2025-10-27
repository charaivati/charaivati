// app/api/languages/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log("[GET /api/languages] Fetching languages...");
    
    const langs = await prisma.language.findMany({
      where: { enabled: true },
      orderBy: { id: "asc" },
      select: { 
        id: true, 
        code: true, 
        name: true 
      },
    });

    console.log("[GET /api/languages] Found:", langs.length, "languages");
    return NextResponse.json({ ok: true, data: langs });
  } catch (error: any) {
    console.error("[GET /api/languages] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch languages" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, code } = body;
    
    console.log("[POST /api/languages] Attempting to create:", { name, code });
    
    if (!name || !code) {
      return NextResponse.json(
        { ok: false, error: "Both name and code are required" },
        { status: 400 }
      );
    }

    // Check if language already exists
    const existing = await prisma.language.findFirst({
      where: {
        OR: [
          { name: name },
          { code: code },
        ],
      },
    });
    
    if (existing) {
      console.log("[POST /api/languages] Language already exists:", existing);
      return NextResponse.json(
        { ok: false, error: "Language with this name or code already exists" },
        { status: 409 }
      );
    }

    const lang = await prisma.language.create({
      data: {
        name,
        code,
        enabled: true,
      },
    });

    console.log("[POST /api/languages] Created successfully:", lang);
    return NextResponse.json({ ok: true, data: lang });
  } catch (err: any) {
    console.error("[POST /api/languages] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to create language" },
      { status: 500 }
    );
  }
}