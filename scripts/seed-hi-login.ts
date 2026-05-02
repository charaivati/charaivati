// scripts/seed-hi-login.ts — Hindi login page translations
// Run with: npx tsx scripts/seed-hi-login.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const HI: [string, string][] = [
  ["auth-welcome-title",     "स्वागत है"],
  ["auth-welcome-subtitle",  "आगे बढ़ने के लिए लॉग इन करें या खाता बनाएं"],
  ["auth-welcome-back",      "फिर आपका स्वागत है!"],
  ["auth-create-title",      "अपना खाता बनाएं"],
  ["auth-email-label",       "ईमेल पता"],
  ["auth-email-placeholder", "aap@example.com"],
  ["auth-email-hint",        "हम देखेंगे कि आपका खाता है या नहीं, या नया बनाने में मदद करेंगे"],
  ["auth-continue-btn",      "आगे बढ़ें"],
  ["auth-checking",          "जाँच रहे हैं..."],
  ["auth-password-label",    "पासवर्ड"],
  ["auth-password-placeholder", "पासवर्ड डालें"],
  ["auth-login-btn",         "लॉग इन करें"],
  ["auth-logging-in",        "लॉग इन हो रहा है..."],
  ["auth-diff-email",        "दूसरा ईमेल इस्तेमाल करें"],
  ["auth-name-label",        "पूरा नाम"],
  ["auth-name-placeholder",  "राम शर्मा"],
  ["auth-email-label-2",     "ईमेल"],
  ["auth-password-hint",     "कम से कम 8 अक्षर होने चाहिए"],
  ["auth-create-btn",        "खाता बनाएं"],
  ["auth-creating",          "खाता बन रहा है..."],
  ["auth-guest-btn",         "अभी के लिए छोड़ें (अतिथि के रूप में जारी रखें)"],
  ["auth-guest-hint",        "अतिथि मोड केवल पढ़ने के लिए है — लॉग इन करने तक"],
  ["auth-terms-prefix",      "जारी रखकर आप हमारी"],
  ["auth-terms-link",        "सेवा शर्तें"],
  ["auth-too-many-attempts", "बहुत अधिक प्रयास हो गए। कृपया प्रतीक्षा करें"],
];

async function main() {
  console.log("Seeding Hindi login translations...\n");
  const slugs = HI.map(([s]) => s);
  const tabs = await prisma.tab.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(tabs.map(t => [t.slug, t.id]));
  let done = 0;
  for (const [slug, title] of HI) {
    const tabId = bySlug.get(slug);
    if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug}`); continue; }
    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId, locale: "hi" } },
      create: { tabId, locale: "hi", title, autoTranslated: false, status: "published" },
      update: { title, autoTranslated: false, status: "published" },
    });
    console.log(`  ✓  ${slug.padEnd(28)} →  ${title}`);
    done++;
  }
  console.log(`\nDone: ${done} upserted`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
