// scripts/seed-chatbot-strings.ts
// Seeds Tab records (category "ui-chatbot") for new ChatBot.tsx UI strings
// introduced by the document-reader (CHAT-DOCS-1 era) and chat->profile
// sync (proposal card) features. Follows the same pattern as
// seed-app-strings.ts: Tab.title holds the English source string, and
// scripts/seed-translations.ts auto-translates title/description into
// TabTranslation rows for every enabled Language.
//
// Run with: npx tsx scripts/seed-chatbot-strings.ts
// Then:     npx tsx scripts/seed-translations.ts
//
// Note: the three "warning" strings are server-generated with interpolated
// numbers (page counts, MAX_OCR_PAGES). They are seeded as templates using
// {count}/{total}/{max} placeholders — the app does not currently substitute
// translated templates at runtime; this seed documents the intended source
// strings so a future i18n pass for app/api/documents/parse/route.ts has
// translated templates ready to wire up.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STRINGS = [
  // ─── Document attach button ──────────────────────────────────────────────
  { slug: "chat-attach-aria-label",   title: "Attach a document",                description: "ChatBot attach button — aria-label" },
  { slug: "chat-attach-title",        title: "Attach a PDF or Word document",    description: "ChatBot attach button — title/tooltip" },
  { slug: "chat-attach-reading",      title: "Reading document…",                description: "ChatBot — shown while the file uploads/parses" },
  { slug: "chat-attach-remove-aria",  title: "Remove attachment",                description: "ChatBot attached-document chip — remove button aria-label" },

  // ─── Document upload errors ──────────────────────────────────────────────
  { slug: "chat-doc-error-default",      title: "Could not read this file.",                                  description: "ChatBot — fallback error when /api/documents/parse returns no message" },
  { slug: "chat-doc-error-upload-failed", title: "Upload failed. Please try again.",                          description: "ChatBot — network/fetch error on document upload" },
  { slug: "chat-doc-error-too-large",    title: "File too large (max 15MB)",                                  description: "POST /api/documents/parse — 413 when file exceeds MAX_FILE_BYTES" },
  { slug: "chat-doc-error-unsupported",  title: "Could not read this file. Supported types: PDF, DOCX, TXT.", description: "POST /api/documents/parse — 422 when parseDocument() throws" },
  { slug: "chat-doc-error-rate-limit",   title: "Too many uploads. Try again later.",                         description: "POST /api/documents/parse — 429 when the 30/hr rate limit is exceeded" },

  // ─── Document parse warnings (templates — see note above) ────────────────
  { slug: "chat-doc-warn-low-text",   title: "{count} of {total} page(s) have little or no extractable text — likely scanned images.", description: "parseDocument warning — template, {count}/{total} are page numbers" },
  { slug: "chat-doc-warn-ocr-unavailable", title: "OCR was attempted but unavailable — scanned pages may be missing text.",            description: "documents/parse warning — OCR fallback chain returned nothing" },
  { slug: "chat-doc-warn-ocr-skipped", title: "{count} additional scanned page(s) were not OCR'd (limit: {max} per upload).",          description: "documents/parse warning — template, {count}/{max} are page counts" },

  // ─── Send-with-attachment fallback message ───────────────────────────────
  { slug: "chat-doc-send-fallback",   title: "Take a look at this document: {name}",  description: "ChatBot — sent as the user message when a document is attached with no typed text; {name} is the file name" },

  // ─── Profile-sync proposal card ──────────────────────────────────────────
  { slug: "chat-proposal-yes",        title: "Yes, add it",                      description: "Profile-sync proposal card — accept button" },
  { slug: "chat-proposal-no",         title: "No thanks",                        description: "Profile-sync proposal card — dismiss button" },
  { slug: "chat-proposal-accepted",   title: "✓ Added to your Self profile.",    description: "Profile-sync proposal card — shown after accepting" },
  { slug: "chat-proposal-dismissed",  title: "Okay, not now.",                   description: "Profile-sync proposal card — shown after dismissing" },
];

async function main() {
  console.log(`Seeding ${STRINGS.length} Tab records (category: ui-chatbot)...\n`);
  let created = 0, updated = 0;
  for (const s of STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({ where: { id: existing.id }, data: { title: s.title, description: s.description, category: "ui-chatbot" } });
      updated++;
    } else {
      await prisma.tab.create({ data: { slug: s.slug, title: s.title, description: s.description, category: "ui-chatbot", is_default: false, is_custom: false } });
      console.log(`  + ${s.slug}`);
      created++;
    }
  }
  console.log(`\nDone: ${created} created, ${updated} updated`);
  console.log("Run seed-translations.ts to auto-translate into all enabled languages (hi, bn, ta, te, mr, gu, kn, ml, pa, or, ur, ...).");
}

main().catch(console.error).finally(() => prisma.$disconnect());
