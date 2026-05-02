// scripts/seed-mr.ts — Complete Marathi (मराठी) translation seed
// Covers: nav, canvas, auth, UI, and dynamic auth message slugs.
// Run with: npx tsx scripts/seed-mr.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const LOCALE = "mr";
const LANG_NAME = "Marathi";

const TRANSLATIONS: [string, string][] = [
  // ── Nav / layer labels ────────────────────────────────────────────────────
  ["layer-self",              "मी"],
  ["layer-society-home",      "समाज"],
  ["layer-nation-birth",      "राष्ट्र"],
  ["layer-earth",             "पृथ्वी"],
  ["layer-universe",          "विश्व"],

  // ── Self tabs ─────────────────────────────────────────────────────────────
  ["self-personal",           "वैयक्तिक"],
  ["self-social",             "सामाजिक"],
  ["self-learn",              "शिकणे"],
  ["self-earn",               "कमाई"],

  // ── Society tabs ──────────────────────────────────────────────────────────
  ["soc-panchayat",           "पंचायत / वार्ड"],
  ["soc-legislative",         "विधानसभा मतदारसंघ"],
  ["soc-parliamentary",       "लोकसभा मतदारसंघ"],
  ["soc-state",               "राज्य"],

  // ── Nation tabs ───────────────────────────────────────────────────────────
  ["nat-legislature",         "विधिमंडळ"],
  ["nat-executive",           "कार्यकारी"],
  ["nat-judiciary",           "न्यायपालिका"],
  ["nat-media",               "माध्यमे"],

  // ── Earth tabs ────────────────────────────────────────────────────────────
  ["earth-worldview",         "जागतिक दृष्टिकोन"],
  ["earth-humanstories",      "माणसाच्या कहाण्या"],
  ["earth-collab",            "सहकार्य / कृती"],
  ["earth-knowledge",         "ज्ञान / साधने"],

  // ── Universe tabs ─────────────────────────────────────────────────────────
  ["uni-spirit",              "अध्यात्म"],
  ["uni-science",             "विज्ञान"],
  ["uni-ideas",               "कल्पना"],
  ["uni-other",               "इतर"],

  // ── Canvas block labels ───────────────────────────────────────────────────
  ["canvas-health",           "आरोग्य"],
  ["canvas-goals",            "ध्येय"],
  ["canvas-skills",           "कौशल्ये"],
  ["canvas-energy",           "ऊर्जा"],
  ["canvas-environment",      "परिसर"],
  ["canvas-time",             "वेळ"],
  ["canvas-funds",            "साधनसंपत्ती"],
  ["canvas-network",          "जाळे"],

  // ── Section headers ───────────────────────────────────────────────────────
  ["section-execution-plan",    "कार्य योजना"],
  ["section-daily-tasks",       "दैनंदिन कार्ये"],
  ["section-project-timelines", "प्रकल्प वेळापत्रक"],
  ["section-funds",             "साधनसंपत्ती व स्वातंत्र्य"],

  // ── Goal archetype tabs ───────────────────────────────────────────────────
  ["archetype-learn",         "शिकणे"],
  ["archetype-build",         "निर्माण"],
  ["archetype-execute",       "कृती"],
  ["archetype-connect",       "जोडणे"],

  // ── Status / empty-state strings ──────────────────────────────────────────
  ["status-no-goals",         "अद्याप कोणतेही ध्येय नाही"],
  ["status-not-set-up",       "सेट केलेले नाही"],
  ["status-none-yet",         "अद्याप काहीही नाही"],
  ["status-no-tasks",         "अद्याप कोणतेही कार्य नाही"],
  ["status-tap-to-view",      "पाहा"],
  ["status-no-direction",     "कोणतीही दिशा नाही"],

  // ── Action buttons ────────────────────────────────────────────────────────
  ["action-add-goal",         "ध्येय जोडा"],
  ["action-sign-in",          "लॉग इन करा"],
  ["action-edit-health",      "आरोग्य डेटा संपादित करा"],
  ["action-regenerate",       "पुन्हा बनवा"],

  // ── Energy labels ─────────────────────────────────────────────────────────
  ["energy-high",             "उच्च ऊर्जा"],
  ["energy-moderate",         "मध्यम"],
  ["energy-low",              "कमी ऊर्जा"],

  // ── Drive strings ─────────────────────────────────────────────────────────
  ["drive-keep-moving",       "चरैवेति"],
  ["drive-no-direction",      "कोणतीही दिशा नाही"],
  ["drive-sign-in-guest",     "अतिथी मोड — समन्वयासाठी लॉग इन करा."],

  // ── Health block ──────────────────────────────────────────────────────────
  ["health-no-data",          "अद्याप आरोग्य डेटा नाही. सुरू करण्यासाठी तुमची माहिती जोडा."],
  ["health-not-set",          "सेट केलेले नाही"],

  // ── Skills block ──────────────────────────────────────────────────────────
  ["skills-no-skills",        "अद्याप कोणतेही कौशल्य जोडलेले नाही."],
  ["skills-add",              "कौशल्य जोडा"],
  ["skills-suggesting",       "सुचवत आहोत..."],
  ["skills-suggest",          "सुचवा"],

  // ── Time block ────────────────────────────────────────────────────────────
  ["time-no-tasks",           "या दिवसासाठी कोणतेही कार्य नाही."],

  // ── Day abbreviations ─────────────────────────────────────────────────────
  ["day-mon",                 "सोम"],
  ["day-tue",                 "मंगळ"],
  ["day-wed",                 "बुध"],
  ["day-thu",                 "गुरु"],
  ["day-fri",                 "शुक्र"],
  ["day-sat",                 "शनि"],
  ["day-sun",                 "रवि"],

  // ── Execution plan strings ────────────────────────────────────────────────
  ["exec-loading",            "ध्येये लोड होत आहेत..."],
  ["exec-error",              "कार्य योजना लोड होऊ शकली नाही."],
  ["exec-no-goals",           "अद्याप कोणतेही सक्रिय ध्येय नाही — येथे योजना पाहण्यासाठी एक बनवा."],
  ["exec-generating",         "कार्य योजना तयार होत आहे..."],

  // ── AI / shared UI ────────────────────────────────────────────────────────
  ["ai-unavailable",          "AI सूचना सध्या उपलब्ध नाहीत — लवकरच परत येऊ. तोपर्यंत स्वतः जोडा."],
  ["ai-badge",                "AI"],

  // ── Sahayak UI strings ────────────────────────────────────────────────────
  ["ui-video-tutorials",      "व्हिडिओ ट्युटोरियल"],
  ["ui-official-links",       "अधिकृत दुवे"],
  ["ui-loading-videos",       "व्हिडिओ लोड होत आहेत..."],
  ["ui-no-videos",            "कोणतेही व्हिडिओ उपलब्ध नाहीत"],
  ["ui-loading-links",        "दुवे लोड होत आहेत..."],
  ["ui-no-links",             "कोणतेही अधिकृत दुवे कॉन्फिगर केलेले नाहीत"],
  ["ui-choose-language",      "भाषा निवडा"],

  // ── Auth / login page (static labels) ────────────────────────────────────
  ["auth-welcome-title",      "स्वागत आहे"],
  ["auth-welcome-subtitle",   "पुढे जाण्यासाठी लॉग इन करा किंवा खाते बनवा"],
  ["auth-welcome-back",       "परत स्वागत आहे!"],
  ["auth-create-title",       "तुमचे खाते बनवा"],
  ["auth-email-label",        "ईमेल पत्ता"],
  ["auth-email-placeholder",  "aap@example.com"],
  ["auth-email-hint",         "तुमचे खाते आहे की नाही ते पाहू, नाहीतर नवीन बनवण्यास मदत करू"],
  ["auth-continue-btn",       "पुढे जा"],
  ["auth-checking",           "तपासत आहोत..."],
  ["auth-password-label",     "पासवर्ड"],
  ["auth-password-placeholder","पासवर्ड टाका"],
  ["auth-login-btn",          "लॉग इन करा"],
  ["auth-logging-in",         "लॉग इन होत आहे..."],
  ["auth-diff-email",         "वेगळा ईमेल वापरा"],
  ["auth-name-label",         "पूर्ण नाव"],
  ["auth-name-placeholder",   "राम शर्मा"],
  ["auth-email-label-2",      "ईमेल"],
  ["auth-password-hint",      "किमान 8 अक्षरे असणे आवश्यक आहे"],
  ["auth-create-btn",         "खाते बनवा"],
  ["auth-creating",           "खाते बनत आहे..."],
  ["auth-guest-btn",          "आत्तासाठी सोडा (अतिथी म्हणून सुरू ठेवा)"],
  ["auth-guest-hint",         "लॉग इन करेपर्यंत अतिथी मोड फक्त वाचण्यासाठी आहे."],
  ["auth-terms-prefix",       "पुढे जाऊन तुम्ही आमच्या"],
  ["auth-terms-link",         "सेवा अटी"],
  ["auth-too-many-attempts",  "खूप जास्त प्रयत्न झाले. कृपया प्रतीक्षा करा"],

  // ── Auth / login page (dynamic status messages) ───────────────────────────
  ["auth-msg-logging-in",        "लॉग इन होत आहे..."],
  ["auth-msg-login-ok",          "लॉग इन यशस्वी! रीडायरेक्ट होत आहे..."],
  ["auth-msg-login-fail",        "लॉग इन अयशस्वी"],
  ["auth-msg-network-error",     "नेटवर्क त्रुटी. कृपया पुन्हा प्रयत्न करा."],
  ["auth-msg-creating-account",  "खाते बनत आहे..."],
  ["auth-msg-account-ok",        "खाते बनले! सुरू करूया..."],
  ["auth-msg-reg-fail",          "नोंदणी अयशस्वी"],
  ["auth-msg-creating-guest",    "अतिथी सत्र बनत आहे..."],
  ["auth-msg-guest-ok",          "अतिथी सत्र तयार! रीडायरेक्ट होत आहे..."],
  ["auth-msg-guest-fail",        "अतिथी सत्र सुरू होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा."],
  ["auth-msg-email-required",    "कृपया तुमचा ईमेल प्रविष्ट करा"],
  ["auth-msg-email-error",       "ईमेल तपासणीत त्रुटी. कृपया पुन्हा प्रयत्न करा."],
];

async function main() {
  // Confirm language exists
  const lang = await prisma.language.findFirst({ where: { code: LOCALE } });
  if (!lang) {
    console.error(`Language '${LOCALE}' not found in DB. Run seed-languages.ts first.`);
    process.exit(1);
  }
  console.log(`Language: ${lang.code} ${lang.nativeName} ✓\n`);

  // Fetch all tab IDs by slug
  const slugs = TRANSLATIONS.map(([s]) => s);
  const tabs  = await prisma.tab.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(tabs.map(t => [t.slug, t.id]));

  console.log(`Seeding ${TRANSLATIONS.length} Marathi translations...\n`);
  let done = 0, missing = 0;

  for (const [slug, title] of TRANSLATIONS) {
    const tabId = bySlug.get(slug);
    if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug}`); missing++; continue; }
    await prisma.tabTranslation.upsert({
      where:  { tabId_locale: { tabId, locale: LOCALE } },
      create: { tabId, locale: LOCALE, title, autoTranslated: false, status: "published" },
      update: { title, autoTranslated: false, status: "published" },
    });
    console.log(`  ✓  ${slug.padEnd(32)} →  ${title}`);
    done++;
  }

  console.log(`\n✅  Done: ${done} upserted, ${missing} slugs not found in DB`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
