// scripts/seed-bn-login.ts — Bengali (বাংলা) login page translations
// Run with: npx tsx scripts/seed-bn-login.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BN: [string, string][] = [
  ["auth-welcome-title",     "স্বাগতম"],
  ["auth-welcome-subtitle",  "চালিয়ে যেতে সাইন ইন করুন বা অ্যাকাউন্ট তৈরি করুন"],
  ["auth-welcome-back",      "আবার স্বাগতম!"],
  ["auth-create-title",      "আপনার অ্যাকাউন্ট তৈরি করুন"],
  ["auth-email-label",       "ইমেইল ঠিকানা"],
  ["auth-email-placeholder", "aap@example.com"],
  ["auth-email-hint",        "আপনার অ্যাকাউন্ট আছে কিনা দেখব, না হলে নতুন তৈরিতে সাহায্য করব"],
  ["auth-continue-btn",      "এগিয়ে যান"],
  ["auth-checking",          "যাচাই করা হচ্ছে..."],
  ["auth-password-label",    "পাসওয়ার্ড"],
  ["auth-password-placeholder", "পাসওয়ার্ড লিখুন"],
  ["auth-login-btn",         "লগ ইন করুন"],
  ["auth-logging-in",        "লগ ইন হচ্ছে..."],
  ["auth-diff-email",        "অন্য ইমেইল ব্যবহার করুন"],
  ["auth-name-label",        "পুরো নাম"],
  ["auth-name-placeholder",  "রাম শর্মা"],
  ["auth-email-label-2",     "ইমেইল"],
  ["auth-password-hint",     "কমপক্ষে ৮ অক্ষর হতে হবে"],
  ["auth-create-btn",        "অ্যাকাউন্ট তৈরি করুন"],
  ["auth-creating",          "অ্যাকাউন্ট তৈরি হচ্ছে..."],
  ["auth-guest-btn",         "এখনকে মতো এড়িয়ে যান (অতিথি হিসেবে চালিয়ে যান)"],
  ["auth-guest-hint",        "অতিথি মোড শুধুমাত্র পড়ার জন্য — লগ ইন না করা পর্যন্ত"],
  ["auth-terms-prefix",      "চালিয়ে গেলে আপনি আমাদের"],
  ["auth-terms-link",        "পরিষেবার শর্তাবলী"],
  ["auth-too-many-attempts", "অনেক বেশি চেষ্টা হয়েছে। দয়া করে অপেক্ষা করুন"],
];

async function main() {
  console.log("Seeding Bengali login translations...\n");
  const slugs = BN.map(([s]) => s);
  const tabs = await prisma.tab.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(tabs.map(t => [t.slug, t.id]));
  let done = 0;
  for (const [slug, title] of BN) {
    const tabId = bySlug.get(slug);
    if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug}`); continue; }
    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId, locale: "bn" } },
      create: { tabId, locale: "bn", title, autoTranslated: false, status: "published" },
      update: { title, autoTranslated: false, status: "published" },
    });
    console.log(`  ✓  ${slug.padEnd(28)} →  ${title}`);
    done++;
  }
  console.log(`\nDone: ${done} upserted`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
