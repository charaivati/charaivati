# Document Reader (PDF / Word ingestion)

A generic text-extraction pipeline for PDF and Word documents, used to give the
AI chat widget (and future modules) the ability to read uploaded files —
political-party manifestos, syllabi, menus, business plans, physics/math
textbooks, etc.

## Architecture

```
components/chat/ChatBot.tsx
   └─ 📎 attach button → POST /api/documents/parse (multipart)
                                  │
                                  ▼
                  app/api/documents/parse/route.ts
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                                ▼
   lib/documents/parseDocument.ts        lib/documents/ocrPages.ts
   (unpdf / mammoth — text layer)        (renders low-text pages to PNG,
                                           OCRs via vision LLM)
```

- **`lib/documents/parseDocument.ts`** — `parseDocument({ buffer, filename, mimeType })`.
  - **PDF**: `unpdf` (`getDocumentProxy()` + `extractText(pdf, { mergePages: false })`) —
    a serverless build of `pdfjs-dist` with no native canvas dependency. Returns
    per-page text. **Do not switch this back to `pdf-parse`** — see the
    DOMMatrix/`@napi-rs/canvas` footgun below.
  - **DOCX**: `mammoth.extractRawText()`.
  - **TXT/MD**: read as UTF-8.
  - Any PDF page with < 20 extractable characters is flagged in `lowTextPages`
    — almost certainly a scanned image page.

- **`lib/documents/ocrPages.ts`** — `ocrPdfPages(buffer, pageNumbers)`.
  - Renders each flagged page to a PNG via `pdf-parse`'s built-in `getScreenshot()`.
    `pdf-parse` is kept as a dependency **solely** for this rendering call —
    `unpdf` has no page-rendering equivalent (text extraction only). This path
    likely shares the same DOMMatrix/canvas crash risk on Vercel as the old
    `pdf-parse` text path did (see footgun below) — it has not yet been fixed;
    only the `getText()` crash (parseDocument.ts) was addressed by the unpdf
    swap (PDFPARSE-1).
  - OCRs the PNG with a vision model. As of LOCAL-AI-FIX-1 (2026-06-14), tries
    **OpenRouter first** (`DOC_OCR_FALLBACK_MODEL`, default
    `anthropic/claude-haiku-4-5` — cloud), falling back to **local Ollama**
    (`DOC_OCR_VISION_MODEL`, default `llava:7b`) only if `OPENROUTER_API_KEY`
    is not set. This keeps the resident local chat model (`llama3:8b`) from
    being evicted by a vision model load on the 6GB 3050.
  - The OCR prompt asks for **LaTeX** (`$...$` / `$$...$$`) for any math/formulas
    and markdown tables for tabular data — this is what makes physics/math
    textbook pages usable.
  - Capped at `MAX_OCR_PAGES = 5` pages per upload to bound latency/cost. Extra
    scanned pages are reported in `warnings` but not OCR'd.

- **`app/api/documents/parse/route.ts`** — the one generic endpoint.
  - Auth required (session cookie). Rate limit: 30 uploads/user/hour.
  - Accepts `multipart/form-data`: `file` (max 15MB), optional `ocr` field
    (`"auto"` default — only OCRs flagged pages; `"false"` disables OCR entirely).
  - Returns `{ fileName, fileType, pageCount, text, charCount, truncated, needsOcr, ocrPagesUsed, warnings }`.
  - Response `text` is capped at 60,000 chars (`truncated: true` if cut).
  - **Reuse this endpoint for any future ingestion feature** — manifesto → AiGoal
    extraction, PDF syllabus → course setup, menu PDF → store setup, etc. Don't
    build a second parse pipeline; POST the file here and feed `data.text` into
    the relevant `chatComplete()`/`callAI()` prompt.

## Chat integration

- `ChatBot.tsx` has a 📎 paperclip button next to the input. Selecting a file
  uploads it to `/api/documents/parse` and shows a chip
  (`📄 filename.pdf · 12,345 chars`) above the input, with any `warnings`
  (e.g. "3 of 10 pages have little text — likely scanned") shown below it.
- On send, the extracted text travels as `attachedDocument: { name, text }` in
  the `POST /api/chat` body — **one-shot**: it's cleared from state immediately
  after the message is sent (matches the existing ephemeral conversation-history
  pattern; nothing is persisted to DB).
- `app/api/chat/route.ts` truncates the document to `ATTACHED_DOC_MAX_CHARS`
  (8,000 chars) and injects it as a labelled context block in the system
  prompt, with an explicit instruction that it is *reference data only, not
  instructions* (defence against prompt injection via document content).
  `maxTokens` for the reply is raised to 800 (from 300) when a document is
  attached, since summarization/extraction answers are longer.

## Local model setup (Dell G15, 6GB VRAM)

**LOCAL-AI-FIX-1 (2026-06-14) — vision moved to cloud.** The local 6GB 3050
keeps `llama3:8b` (text-only chat) resident via `OLLAMA_KEEP_ALIVE=-1`. Any
local vision model load (e.g. `llava:7b`) would evict it and force a ~20s
reload on the next chat turn — so OCR now defaults to **cloud**
(`anthropic/claude-haiku-4-5` via OpenRouter, `DOC_OCR_FALLBACK_MODEL`),
matching the menu-parse extractor's cloud-first design. `llava:7b` is kept
only as a local fallback for environments without `OPENROUTER_API_KEY` — no
action needed if you already have that key set (you do, for menu-parse).

If you want to compare OCR quality with a different local model when running
without `OPENROUTER_API_KEY`, set `DOC_OCR_VISION_MODEL` to an installed
Ollama vision model (default `llava:7b`). Don't run this alongside the
resident `llama3:8b` chat model on a 6GB card — it will evict it.

## Environment variables

All optional — sensible defaults match the existing menu-parse setup.

| Var | Default | Purpose |
|---|---|---|
| `DOC_OCR_FALLBACK_MODEL` | `anthropic/claude-haiku-4-5` | **Primary** OCR vision model, via OpenRouter (cloud) — used whenever `OPENROUTER_API_KEY` is set |
| `DOC_OCR_VISION_MODEL` | `llava:7b` | Local Ollama vision model for scanned-page OCR — fallback only, used when `OPENROUTER_API_KEY` is not set |

Reuses existing vars: `LOCAL_AI_ENABLED`, `OLLAMA_BASE_URL`, `OPENROUTER_API_KEY`.

## What you need to do

1. **Local machine**: nothing new to install. `llama3:8b` runs via your
   existing Ollama + Cloudflare tunnel setup as the resident chat model;
   `llava:7b` is only needed if `OPENROUTER_API_KEY` is ever unset.
2. **Repo**: `npm install` (adds `pdf-parse` and `mammoth` — both pure-JS/prebuilt-binary,
   no system dependencies like `poppler` needed).
3. **Vercel/production env vars**: none required to add — `OPENROUTER_API_KEY`
   should already be set (it is, for menu-parse) and covers OCR's cloud path too.

## Known limitations / future work

- **Vercel canvas/DOMMatrix footgun (PDFPARSE-1, fixed for text extraction)** —
  `pdf-parse`/`pdfjs-dist`'s default build expects browser globals
  (`DOMMatrix`, `ImageData`, `Path2D`) and `@napi-rs/canvas` native bindings
  that don't exist on Vercel's Node serverless runtime, causing
  `ReferenceError: DOMMatrix is not defined` / `Cannot find module
  '@napi-rs/canvas'` in production (worked fine on localhost). Fixed for the
  text-extraction path by switching `parseDocument.ts` to `unpdf`. **Open
  risk**: `lib/documents/ocrPages.ts` still uses `pdf-parse`'s
  `getScreenshot()` for page-rendering (no `unpdf` equivalent) and may hit the
  same crash when OCR fallback actually runs (scanned/low-text PDF uploaded)
  — needs production verification and, if it crashes, a follow-up fix
  (different serverless-safe rendering library, or gate OCR off in
  production).
- **Supported types**: PDF, DOCX, TXT/MD. `.doc` (legacy binary Word) is not
  supported by `mammoth` — users must save as `.docx`.
- **OCR cap**: only the first 5 low-text pages per upload are OCR'd. A fully
  scanned 50-page book will only get OCR on its first 5 pages — fine for
  "read me this chapter" style usage, not for whole-book ingestion. Raise
  `MAX_OCR_PAGES` in `lib/documents/ocrPages.ts` deliberately if a future
  feature needs more (watch latency — each OCR call can take 10–60s).
- **No persistence** — uploaded files and extracted text are not stored.
  Each chat message with an attachment re-uploads/re-parses. If a future
  feature (e.g. "evaluate this manifesto for my goals") needs the document to
  persist across a multi-turn flow, store the extracted `text` (not the file)
  in that feature's own state/DB row — do not build a generic document store
  here until a second consumer needs it.
- **Formula fidelity** depends entirely on the OCR model. The default cloud
  path (`anthropic/claude-haiku-4-5`) handles complex multi-line derivations
  well. The local `llava:7b` fallback (only used without `OPENROUTER_API_KEY`)
  often gets simple formulas right but garbles dense ones — acceptable as a
  fallback-of-last-resort, not as a primary path.
