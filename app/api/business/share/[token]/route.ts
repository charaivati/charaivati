// app/api/business/share/[token]/route.ts
// GET — public, no auth. The token IS the access grant.
// Returns the document content for the share page to render read-only.
// Leaks ONLY the one document whose shareToken matches — not other documents
// of the same idea, not the ideaId, not any ownership fields.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const doc = await (db as any).businessDocument.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      status: true,
      pdfUrl: true,
      createdAt: true,
      updatedAt: true,
      // Deliberately exclude: ideaId, shareToken (not needed by recipient)
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}
