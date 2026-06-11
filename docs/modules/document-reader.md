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
  - OCRs the PNG with a vision model. Tries **local Ollama first**
    (`DOC_OCR_VISION_MODEL`, default `llava:7b` — same model the menu-parse
    feature already uses), falling back to **OpenRouter** (`DOC_OCR_FALLBACK_MODEL`,
    default `anthropic/claude-haiku-4-5`) if Ollama is unavailable or
    `LOCAL_AI_ENABLED` is not set.
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

You already run `llama3:8b` (chat) and `llava:7b` (vision/OCR — used by
menu-parse) via Ollama. **No new local model is required** — the document
reader reuses `llava:7b` for OCR by default.

Optional upgrade for better OCR/formula transcription (still fits 6GB, only
pull if you want to compare quality):
```bash
ollama pull minicpm-v
```
Then set `DOC_OCR_VISION_MODEL=minicpm-v` in `.env.local`. `llava:7b` is
serviceable for plain scanned text but weak on dense formulas — for
formula-heavy pages (math/physics books), the **cloud fallback
(`anthropic/claude-haiku-4-5` via OpenRouter) is meaningfully more accurate**
and is used automatically whenever Ollama is unavailable or returns nothing.
If you regularly OCR formula-heavy scans, you can force cloud-only OCR by
unsetting `LOCAL_AI_ENABLED` for that request path — not needed by default,
the fallback already triggers automatically on any Ollama failure.

A 6GB card cannot comfortably hold `llama3:8b` + `llava:7b` + a third OCR
model resident simultaneously. Stick to the two existing models; let the
OpenRouter fallback absorb anything that needs a heavier vision model.

## Environment variables

All optional — sensible defaults match the existing menu-parse setup.

| Var | Default | Purpose |
|---|---|---|
| `DOC_OCR_VISION_MODEL` | `llava:7b` | Local Ollama vision model for scanned-page OCR |
| `DOC_OCR_FALLBACK_MODEL` | `anthropic/claude-haiku-4-5` | OpenRouter vision model used when Ollama is unavailable |

Reuses existing vars: `LOCAL_AI_ENABLED`, `OLLAMA_BASE_URL`, `OPENROUTER_API_KEY`.

## What you need to do

1. **Local machine**: nothing new to install — `llama3:8b` and `llava:7b` are
   already running via your existing Ollama + Cloudflare tunnel setup.
2. **Repo**: `npm install` (adds `pdf-parse` and `mammoth` — both pure-JS/prebuilt-binary,
   no system dependencies like `poppler` needed).
3. **Vercel/production env vars**: none required to add — the two new vars
   above are optional overrides. `OPENROUTER_API_KEY` should already be set
   for the OCR cloud fallback and menu-parse validator to work.
4. Optional: `ollama pull minicpm-v` if you want to A/B test OCR quality vs `llava:7b`.

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
- **Formula fidelity** depends entirely on the OCR model. `llava:7b` will
  often get simple formulas right and garble complex multi-line derivations;
  the `anthropic/claude-haiku-4-5` cloud fallback is noticeably better. If
  formula quality matters for a specific feature (e.g. a future "explain this
  problem set" tool), consider always setting `ocr=auto` and accepting the
  cloud fallback cost rather than trying to force local-only.
