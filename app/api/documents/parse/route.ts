import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { parseDocument } from "@/lib/documents/parseDocument";
import { ocrPdfPages, MAX_OCR_PAGES } from "@/lib/documents/ocrPages";

// Generic document-text-extraction endpoint. Reused by:
//  - the AI chat widget (file attachment -> context for the LLM)
//  - future modules that ingest PDFs/Word docs (manifestos -> goals,
//    syllabus/menu PDFs -> store setup, etc.) — POST the file here and
//    use the returned `text`.

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_RESPONSE_CHARS = 60_000; // truncate very long documents in the response

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`documents-parse:${payload.userId}`, 30, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 413 });
  }

  // "auto" (default): only run OCR on pages flagged as low-text. "false": never OCR.
  const ocrMode = (formData.get("ocr") as string | null) ?? "auto";

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseDocument({ buffer, filename: file.name, mimeType: file.type });
  } catch (err) {
    console.error("[documents/parse] parseDocument failed:", err);
    return NextResponse.json(
      { error: "Could not read this file. Supported types: PDF, DOCX, TXT." },
      { status: 422 }
    );
  }

  let text = parsed.text;
  let ocrPagesUsed = 0;
  const warnings = [...parsed.warnings];

  if (ocrMode !== "false" && parsed.fileType === "pdf" && parsed.lowTextPages.length > 0) {
    const { results, ocrPagesUsed: used, skipped } = await ocrPdfPages(buffer, parsed.lowTextPages);
    ocrPagesUsed = used;

    if (used > 0) {
      const byPage = new Map(parsed.pages.map((p) => [p.num, p.text]));
      for (const [pageNumStr, ocrText] of Object.entries(results)) {
        byPage.set(Number(pageNumStr), ocrText);
      }
      text = Array.from(byPage.entries())
        .sort(([a], [b]) => a - b)
        .map(([, t]) => t)
        .join("\n\n");
    }

    if (skipped > 0) {
      warnings.push(`${skipped} additional scanned page(s) were not OCR'd (limit: ${MAX_OCR_PAGES} per upload).`);
    }
    if (used === 0 && results && Object.keys(results).length === 0 && parsed.lowTextPages.length > 0) {
      warnings.push("OCR was attempted but unavailable — scanned pages may be missing text.");
    }
  }

  const truncated = text.length > MAX_RESPONSE_CHARS;
  if (truncated) text = text.slice(0, MAX_RESPONSE_CHARS);

  return NextResponse.json({
    fileName: file.name,
    fileType: parsed.fileType,
    pageCount: parsed.pageCount,
    text,
    charCount: text.length,
    truncated,
    needsOcr: parsed.lowTextPages.length > 0,
    ocrPagesUsed,
    warnings,
  });
}
