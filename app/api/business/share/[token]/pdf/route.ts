// app/api/business/share/[token]/pdf/route.ts
// GET — public, no auth. Token is the access grant.
// Generates the PDF if not cached, uploads, then proxies it as an attachment.
// The recipient on the share page uses this to download the PDF.

import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadDocumentPdf } from "@/lib/business/uploadDocumentPdf";
import {
  SWOTPdf,
  BMCPdf,
  FinancialsPdf,
  type SWOTContent,
  type BMCContent,
  type FinancialsContent,
} from "@/lib/business/BusinessDocumentPdf";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const RENDERABLE = ["SWOT", "BMC", "FINANCIALS"];

  const doc = await (db as any).businessDocument.findFirst({
    where: { shareToken: token },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!RENDERABLE.includes(doc.type)) {
    return NextResponse.json(
      { error: "PDF not available for this document type" },
      { status: 400 }
    );
  }

  let pdfUrl: string = doc.pdfUrl;

  if (!pdfUrl) {
    try {
      const buffer = await renderDocPdf(doc.type, doc.title || doc.id, doc.content);
      pdfUrl = await uploadDocumentPdf(buffer, doc.id);
      await (db as any).businessDocument.update({
        where: { id: doc.id },
        data: { pdfUrl },
      });
    } catch (err) {
      console.error("[share-pdf] generate failed:", err);
      return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
    }
  }

  const cloudRes = await fetch(pdfUrl);
  if (!cloudRes.ok) {
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }

  const buffer = await cloudRes.arrayBuffer();
  const filename = `${doc.type.toLowerCase()}-plan.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
