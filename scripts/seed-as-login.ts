// scripts/seed-as-login.ts — Assamese (অসমীয়া) login page translations
// Assamese uses the Bengali script but has distinct vocabulary.
// Run with: npx tsx scripts/seed-as-login.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const AS: [string, string][] = [
  ["auth-welcome-title",     "স্বাগতম"],
  ["auth-welcome-subtitle",  "আগবাঢ়িবলৈ ছাইন ইন কৰক বা একাউণ্ট বনাওক"],
  ["auth-welcome-back",      "পুনৰ স্বাগতম!"],
  ["auth-create-title",      "আপোনাৰ একাউণ্ট বনাওক"],
  ["auth-email-label",       "ইমেইল ঠিকনা"],
  ["auth-email-placeholder", "aap@example.com"],
  ["auth-email-hint",        "আপোনাৰ একাউণ্ট আছে নে নাই চাম, নহ'লে নতুন বনাবলৈ সহায় কৰিম"],
  ["auth-continue-btn",      "আগবাঢ়ক"],
  ["auth-checking",          "পৰীক্ষা কৰা হৈছে..."],
  ["auth-password-label",    "পাছৱৰ্ড"],
  ["auth-password-placeholder", "পাছৱৰ্ড দিয়ক"],
  ["auth-login-btn",         "লগ ইন কৰক"],
  ["auth-logging-in",        "লগ ইন হৈ আছে..."],
  ["auth-diff-email",        "আন ইমেইল ব্যৱহাৰ কৰক"],
  ["auth-name-label",        "সম্পূৰ্ণ নাম"],
  ["auth-name-placeholder",  "ৰাম শৰ্মা"],
  ["auth-email-label-2",     "ইমেইল"],
  ["auth-password-hint",     "কমেও ৮টা আখৰ হ'ব লাগিব"],
  ["auth-create-btn",        "একাউণ্ট বনাওক"],
  ["auth-creating",          "একাউণ্ট বনাই আছে..."],
  ["auth-guest-btn",         "এতিয়াৰ বাবে এৰি যাওক (অতিথি হিচাপে আগবাঢ়ক)"],
  ["auth-guest-hint",        "অতিথি মোড কেৱল পঢ়িবৰ বাবে — লগ ইন নোকৰালৈ"],
  ["auth-terms-prefix",      "আগবাঢ়িলে আপুনি আমাৰ"],
  ["auth-terms-link",        "সেৱাৰ চৰ্তাৱলী"],
  ["auth-too-many-attempts", "অতিপাত চেষ্টা হ'ল। অনুগ্ৰহ কৰি অপেক্ষা কৰক"],
];

async function main() {
  console.log("Seeding Assamese login translations...\n");
  const slugs = AS.map(([s]) => s);
  const tabs = await prisma.tab.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(tabs.map(t => [t.slug, t.id]));
  let done = 0;
  for (const [slug, title] of AS) {
    const tabId = bySlug.get(slug);
    if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug}`); continue; }
    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId, locale: "as" } },
      create: { tabId, locale: "as", title, autoTranslated: false, status: "published" },
      update: { title, autoTranslated: false, status: "published" },
    });
    console.log(`  ✓  ${slug.padEnd(28)} →  ${title}`);
    done++;
  }
  console.log(`\nDone: ${done} upserted`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
