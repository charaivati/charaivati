// app/api/business/documents/pdf/route.ts
// POST { ideaId, type } — render + upload PDF for an owned document.
// Returns { pdfUrl } on success. Stores pdfUrl on BusinessDocument.
// Auth: same session-OR-biz-guest ownership guard.
// PDF is uploaded as Cloudinary type:"upload" (public URL) under biz-docs/{docId}.
// Callers serve the PDF via /api/business/documents/pdf/download rather than
// using the raw Cloudinary URL directly.

import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { uploadDocumentPdf } from "@/lib/business/uploadDocumentPdf";
import {
  SWOTPdf,
  BMCPdf,
  FinancialsPdf,
  type SWOTContent,
  type BMCContent,
  type FinancialsContent,
} from "@/lib/business/BusinessDocumentPdf";

const GUEST_COOKIE = "biz-guest";

async function resolveOwnership(req: NextRequest, ideaId: string) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const idea = await (db as any).businessIdea.findUnique({
    where: { id: ideaId },
    select: { id: true, userId: true, guestSessionId: true },
  });
  if (!idea) return { allowed: false, idea: null };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned, idea };
}

async function renderDocPdf(type: string, title: string, content: any): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");

  if (type === "SWOT") {
    return renderToBuffer(
      createElement(SWOTPdf, { title, content: content as SWOTContent })
    );
  }
  if (type === "BMC") {
    return renderToBuffer(
      createElement(BMCPdf, { title, content: content as BMCContent })
    );
  }
  if (type === "FINANCIALS") {
    return renderToBuffer(
      createElement(FinancialsPdf, { title, content: content as FinancialsContent })
    );
  }
  throw new Error(`PDF generation not supported for type: ${type}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId, type } = body;

    if (!ideaId || !type) {
      return NextResponse.json({ error: "ideaId and type are required" }, { status: 400 });
    }

    const RENDERABLE = ["SWOT", "BMC", "FINANCIALS"];
    if (!RENDERABLE.includes(type)) {
      return NextResponse.json(
        { error: `PDF not available for type: ${type}` },
        { status: 400 }
      );
    }

    const { allowed } = await resolveOwnership(req, ideaId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await (db as any).businessDocument.findUnique({
      where: { ideaId_type: { ideaId, type } },
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found. Save the document first." },
        { status: 404 }
      );
    }

    // Return cached URL if content hasn't changed (pdfUrl is nulled on every save)
    if (doc.pdfUrl) {
      return NextResponse.json({ pdfUrl: doc.pdfUrl, cached: true });
    }

    // Render PDF
    let buffer: Buffer;
    try {
      buffer = await renderDocPdf(type, doc.title || ideaId, doc.content);
    } catch (pdfErr) {
      console.error("[biz-pdf] render failed:", pdfErr);
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }

    // Upload to Cloudinary
    let pdfUrl: string;
    try {
      pdfUrl = await uploadDocumentPdf(buffer, doc.id);
    } catch (uploadErr) {
      console.error("[biz-pdf] upload failed:", uploadErr);
      return NextResponse.json({ error: "PDF upload failed" }, { status: 500 });
    }

    // Store pdfUrl on the document
    await (db as any).businessDocument.update({
      where: { id: doc.id },
      data: { pdfUrl },
    });

    return NextResponse.json({ pdfUrl, cached: false });
  } catch (err) {
    console.error("POST /api/business/documents/pdf", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
