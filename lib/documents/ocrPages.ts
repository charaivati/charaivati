// lib/documents/ocrPages.ts
// OCR fallback for scanned/image-only PDF pages.
//
// Pipeline: render the flagged page to a PNG via pdf-parse's built-in
// getScreenshot() (pdfjs-dist + @napi-rs/canvas, already bundled with
// pdf-parse — no extra native deps), then send the image to a vision model:
//   1. OpenRouter vision model (DOC_OCR_FALLBACK_MODEL, default
//      "anthropic/claude-haiku-4-5") — primary, cloud (LOCAL-AI-FIX-1: local
//      vision is off the 6GB 3050 — loading llava:7b would evict the
//      resident text chat model and force a ~20s reload).
//   2. Local Ollama (DOC_OCR_VISION_MODEL, default "llava:7b") — fallback
//      only if OPENROUTER_API_KEY is not configured.
//
// The prompt asks for plain text plus LaTeX for any mathematical notation,
// so physics/math textbook pages come back with formulas in $...$ form.

import { PDFParse } from "pdf-parse";

const OCR_PROMPT = `Transcribe all text visible in this image exactly as written.
Preserve paragraph breaks, headings, and lists.
If the image contains mathematical formulas or equations, transcribe them as LaTeX wrapped in $...$ (inline) or $$...$$ (display).
If the image contains a table, render it as a markdown table.
Return only the transcribed content — no commentary, no preamble.`;

const OLLAMA_TIMEOUT_MS = 120_000;
const OPENROUTER_TIMEOUT_MS = 60_000;

/** Hard cap on how many pages get OCR'd per request — keeps latency/cost bounded. */
export const MAX_OCR_PAGES = 5;

async function renderPageToPng(buffer: Buffer, pageNum: number): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const shot = await parser.getScreenshot({ first: pageNum, last: pageNum, scale: 2 });
    const page = shot.pages[0];
    if (!page?.data) throw new Error(`Could not render page ${pageNum}`);
    return Buffer.from(page.data).toString("base64");
  } finally {
    await parser.destroy();
  }
}

async function ocrViaOllama(base64Png: string): Promise<string | null> {
  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  // LOCAL-AI-FIX-1: only used when OpenRouter is unavailable — see ocrPdfPages.
  if (process.env.LOCAL_AI_ENABLED !== "true") return null;

  try {
    const res = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DOC_OCR_VISION_MODEL ?? "llava:7b",
        messages: [{ role: "user", content: OCR_PROMPT, images: [base64Png] }],
        stream: false,
        keep_alive: "10m",
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const content = data?.message?.content?.trim();
    return content || null;
  } catch (err) {
    console.warn("[ocrPages] Ollama OCR failed:", err);
    return null;
  }
}

async function ocrViaOpenRouter(base64Png: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://charaivati.com",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Charaivati",
      },
      body: JSON.stringify({
        model: process.env.DOC_OCR_FALLBACK_MODEL ?? "anthropic/claude-haiku-4-5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              { type: "image_url", image_url: { url: `data:image/png;base64,${base64Png}` } },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("[ocrPages] OpenRouter OCR failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (err) {
    console.warn("[ocrPages] OpenRouter OCR failed:", err);
    return null;
  }
}

/**
 * Runs OCR on the given (1-indexed) PDF page numbers, capped to MAX_OCR_PAGES.
 * Returns a map of page number -> transcribed text. Pages that fail OCR
 * entirely are omitted from the result (caller keeps the original — empty —
 * extracted text for those pages).
 */
export async function ocrPdfPages(
  buffer: Buffer,
  pageNumbers: number[]
): Promise<{ results: Record<number, string>; ocrPagesUsed: number; skipped: number }> {
  const pagesToProcess = pageNumbers.slice(0, MAX_OCR_PAGES);
  const skipped = Math.max(0, pageNumbers.length - pagesToProcess.length);
  const results: Record<number, string> = {};

  for (const pageNum of pagesToProcess) {
    let png: string;
    try {
      png = await renderPageToPng(buffer, pageNum);
    } catch (err) {
      console.warn(`[ocrPages] Failed to render page ${pageNum}:`, err);
      continue;
    }

    const text = (await ocrViaOpenRouter(png)) ?? (await ocrViaOllama(png));
    if (text) results[pageNum] = text;
  }

  return { results, ocrPagesUsed: Object.keys(results).length, skipped };
}
