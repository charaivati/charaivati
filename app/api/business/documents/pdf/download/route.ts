// app/api/business/documents/pdf/download/route.ts
// GET ?ideaId=&type= — owner downloads their document PDF.
// If pdfUrl is null (content changed since last gen), triggers generation inline.
// Auth: session-OR-biz-guest ownership guard. Proxies Cloudinary URL server-side.

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
  if (!idea) return { allowed: false };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned };
}

async function renderDocPdf(type: string, title: string, content: any): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  if (type === "SWOT")
    return renderToBuffer(createElement(SWOTPdf, { title, content: content as SWOTContent }));
  if (type === "BMC")
    return renderToBuffer(createElement(BMCPdf, { title, content: content as BMCContent }));
  if (type === "FINANCIALS")
    return renderToBuffer(
      createElement(FinancialsPdf, { title, content: content as FinancialsContent })
    );
  throw new Error(`PDF not supported for type: ${type}`);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ideaId = searchParams.get("ideaId");
  const type = searchParams.get("type");

  if (!ideaId || !type) {
    return NextResponse.json({ error: "ideaId and type required" }, { status: 400 });
  }

  const { allowed } = await resolveOwnership(req, ideaId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let doc = await (db as any).businessDocument.findUnique({
    where: { ideaId_type: { ideaId, type } },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // If cached pdfUrl exists, proxy it directly
  let pdfUrl: string = doc.pdfUrl;

  if (!pdfUrl) {
    // Generate on demand
    try {
      const buffer = await renderDocPdf(type, doc.title || ideaId, doc.content);
      pdfUrl = await uploadDocumentPdf(buffer, doc.id);
      await (db as any).businessDocument.update({
        where: { id: doc.id },
        data: { pdfUrl },
      });
    } catch (err) {
      console.error("[biz-pdf-download] generate failed:", err);
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }
  }

  // Proxy the Cloudinary URL
  const cloudRes = await fetch(pdfUrl);
  if (!cloudRes.ok) {
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }

  const buffer = await cloudRes.arrayBuffer();
  const filename = `${type.toLowerCase()}-plan.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
