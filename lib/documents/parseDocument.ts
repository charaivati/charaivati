// lib/documents/parseDocument.ts
// Unified text extraction for PDF / DOCX / TXT uploads.
// PDF text extraction uses unpdf (serverless pdfjs build, no native canvas
// deps — pdf-parse/pdfjs-dist's default build needs DOMMatrix/@napi-rs/canvas,
// which are absent on Vercel's Node serverless runtime and crash there).
// DOCX uses mammoth.
//
// Pages with very little extractable text are flagged in `lowTextPages` —
// callers (e.g. the /api/documents/parse route) can pass those page numbers
// to `ocrPdfPages()` in ocrPages.ts to run vision-model OCR as a fallback
// for scanned pages.

import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export type DocumentFileType = "pdf" | "docx" | "txt" | "unknown";

export interface ParsedPage {
  num: number;
  text: string;
  charCount: number;
}

export interface ParsedDocument {
  fileType: DocumentFileType;
  text: string;
  pageCount: number;
  pages: ParsedPage[];
  /** Page numbers (1-indexed) with suspiciously little text — likely scanned/image pages */
  lowTextPages: number[];
  warnings: string[];
}

// A page with fewer than this many characters is treated as "needs OCR"
const LOW_TEXT_CHAR_THRESHOLD = 20;

function detectFileType(filename: string, mimeType: string): DocumentFileType {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (mimeType.startsWith("text/") || ext === "txt" || ext === "md") return "txt";
  return "unknown";
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const warnings: string[] = [];
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: false });

  const pages: ParsedPage[] = result.text.map((text, i) => {
    const trimmed = (text ?? "").trim();
    return { num: i + 1, text: trimmed, charCount: trimmed.length };
  });

  const lowTextPages = pages
    .filter((p) => p.charCount < LOW_TEXT_CHAR_THRESHOLD)
    .map((p) => p.num);

  if (lowTextPages.length > 0) {
    warnings.push(
      `${lowTextPages.length} of ${pages.length} page(s) have little or no extractable text — likely scanned images.`
    );
  }

  return {
    fileType: "pdf",
    text: pages.map((p) => p.text).join("\n\n"),
    pageCount: pages.length,
    pages,
    lowTextPages,
    warnings,
  };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const warnings: string[] = [];
  const result = await mammoth.extractRawText({ buffer });
  if (result.messages?.length) {
    warnings.push(...result.messages.map((m) => m.message));
  }
  const text = result.value.trim();
  return {
    fileType: "docx",
    text,
    pageCount: 1,
    pages: [{ num: 1, text, charCount: text.length }],
    lowTextPages: [],
    warnings,
  };
}

function parseTxt(buffer: Buffer): ParsedDocument {
  const text = buffer.toString("utf-8").trim();
  return {
    fileType: "txt",
    text,
    pageCount: 1,
    pages: [{ num: 1, text, charCount: text.length }],
    lowTextPages: [],
    warnings: [],
  };
}

/**
 * Extracts text from a PDF, DOCX, or plain-text buffer.
 * Throws on unsupported file types or unparseable files.
 */
export async function parseDocument(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<ParsedDocument> {
  const fileType = detectFileType(params.filename, params.mimeType);

  switch (fileType) {
    case "pdf":
      return parsePdf(params.buffer);
    case "docx":
      return parseDocx(params.buffer);
    case "txt":
      return parseTxt(params.buffer);
    default:
      throw new Error(`Unsupported file type: ${params.filename} (${params.mimeType})`);
  }
}
