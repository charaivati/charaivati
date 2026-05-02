// scripts/seed-hi-canvas.ts
// Hand-crafted, philosophy-aligned Hindi translations for all canvas UI strings.
// Words chosen for cultural resonance with Charaivati's philosophy:
//   — self-awareness, purposeful action, growth, connection to the larger whole.
//
// Run with: npx tsx scripts/seed-hi-canvas.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ─── Translation table ─────────────────────────────────────────────────────────
// Each entry: [slug, Hindi title, optional Hindi description]
//
// Philosophy notes:
//   लक्ष्य  (lakshya)   = aim, target — purposeful direction
//   कौशल   (kaushal)   = skill, competence — developed capability
//   ऊर्जा   (urja)      = energy, life-force
//   परिवेश  (parivesh)  = environment, surroundings — context that shapes you
//   समय    (samay)     = time — the irreplaceable resource
//   संसाधन  (sansadhan) = resources — broader than "money", includes all assets
//   संजाल   (sanjal)    = web of connections, network
//   कार्य   (karya)     = action, work — conscious doing
//   योजना   (yojana)    = plan — structured intention
const HI_CANVAS: [string, string, string?][] = [
  // ── Partner / block labels ────────────────────────────────────────────────
  ["canvas-health",       "स्वास्थ्य",         "शरीर और मन की देखभाल"],
  ["canvas-goals",        "लक्ष्य",            "आपके उद्देश्य और दिशाएं"],
  ["canvas-skills",       "कौशल",             "आपकी विकसित क्षमताएं"],
  ["canvas-energy",       "ऊर्जा",             "आपकी जीवनशक्ति का स्तर"],
  ["canvas-environment",  "परिवेश",            "आपके आसपास का माहौल"],
  ["canvas-time",         "समय",              "आपका सबसे मूल्यवान संसाधन"],
  ["canvas-funds",        "संसाधन",            "वित्त और स्वतंत्रता"],
  ["canvas-network",      "संजाल",             "आपके संबंधों का जाल"],

  // ── Section headers ───────────────────────────────────────────────────────
  ["section-execution-plan",    "कार्य योजना",        "AI द्वारा निर्मित लक्ष्य-आधारित योजना"],
  ["section-daily-tasks",       "दैनिक कार्य",        "आज के लिए निर्धारित कार्य"],
  ["section-project-timelines", "परियोजना समयरेखा",   "चरणों में आगे बढ़ने की योजना"],
  ["section-funds",             "संसाधन और स्वतंत्रता", "आय, व्यय और स्वतंत्रता का माप"],

  // ── Goal archetype tabs ───────────────────────────────────────────────────
  ["archetype-learn",   "ज्ञान",    "सीखने और समझने के लक्ष्य"],
  ["archetype-build",   "निर्माण",  "कुछ बनाने और रचने के लक्ष्य"],
  ["archetype-execute", "क्रिया",   "आदत और अनुशासन के लक्ष्य"],
  ["archetype-connect", "जुड़ाव",   "दूसरों से जुड़ने और सेवा के लक्ष्य"],

  // ── Status / empty-state strings ──────────────────────────────────────────
  ["status-no-goals",     "अभी कोई लक्ष्य नहीं",   "कोई सक्रिय लक्ष्य नहीं है"],
  ["status-not-set-up",   "अभी नहीं बना",          "यह खंड अभी तक सेट नहीं हुआ"],
  ["status-none-yet",     "अभी कुछ नहीं",           "कुछ भी जोड़ा नहीं गया"],
  ["status-no-tasks",     "कोई कार्य नहीं",          "आज के लिए कोई काम नहीं"],
  ["status-tap-to-view",  "देखें",                  "देखने के लिए खोलें"],
  ["status-no-direction", "कोई दिशा नहीं",           "अभी कोई लक्ष्य-दिशा नहीं चुनी"],

  // ── Action buttons ────────────────────────────────────────────────────────
  ["action-add-goal",    "लक्ष्य जोड़ें"],
  ["action-sign-in",     "लॉग इन करें"],
  ["action-edit-health", "स्वास्थ्य डेटा संपादित करें"],
  ["action-regenerate",  "पुनः बनाएं"],

  // ── Energy labels ─────────────────────────────────────────────────────────
  ["energy-high",     "उच्च ऊर्जा"],
  ["energy-moderate", "मध्यम"],
  ["energy-low",      "कम ऊर्जा"],

  // ── Drive / identity ──────────────────────────────────────────────────────
  ["drive-keep-moving",   "चरैवेति",    "चरैवेति चरैवेति — बढ़ते रहो"],
  ["drive-no-direction",  "कोई दिशा नहीं"],
  ["drive-sign-in-guest", "अतिथि मोड — सहेजने के लिए लॉग इन करें"],

  // ── Health block ──────────────────────────────────────────────────────────
  ["health-no-data", "अभी कोई स्वास्थ्य डेटा नहीं। अपनी जानकारी जोड़ें।"],
  ["health-not-set", "सेट नहीं"],

  // ── Skills block ──────────────────────────────────────────────────────────
  ["skills-no-skills",  "अभी कोई कौशल नहीं जोड़ा गया।"],
  ["skills-add",        "कौशल जोड़ें"],
  ["skills-suggesting", "सुझाव दे रहे हैं…"],
  ["skills-suggest",    "सुझाव लें"],

  // ── Time block ────────────────────────────────────────────────────────────
  ["time-no-tasks", "इस दिन के लिए कोई कार्य नहीं।"],

  // ── Day abbreviations ─────────────────────────────────────────────────────
  ["day-mon", "सोम"],
  ["day-tue", "मंगल"],
  ["day-wed", "बुध"],
  ["day-thu", "गुरु"],
  ["day-fri", "शुक्र"],
  ["day-sat", "शनि"],
  ["day-sun", "रवि"],

  // ── Execution plan strings ────────────────────────────────────────────────
  ["exec-loading",    "लक्ष्य लोड हो रहे हैं…"],
  ["exec-error",      "कार्य योजना लोड नहीं हो सकी।"],
  ["exec-no-goals",   "अभी कोई सक्रिय लक्ष्य नहीं — एक बनाएं और यहां अपनी योजना देखें।"],
  ["exec-generating", "कार्य योजना बन रही है…"],

  // ── AI / shared UI ────────────────────────────────────────────────────────
  ["ai-unavailable", "अभी AI सुझाव उपलब्ध नहीं हैं — जल्द वापस आएंगे। इस बीच नीचे खुद जोड़ें।"],
  ["ai-badge",       "AI"],
];

async function main() {
  console.log(`Seeding ${HI_CANVAS.length} Hindi canvas translations...\n`);

  // Look up all tab IDs by slug in one query
  const slugs = HI_CANVAS.map(([s]) => s);
  const tabs = await prisma.tab.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(tabs.map((t) => [t.slug, t.id]));

  let done = 0, skipped = 0;

  for (const [slug, title, description] of HI_CANVAS) {
    const tabId = bySlug.get(slug);
    if (!tabId) { console.warn(`  ⚠ Tab not found: ${slug} — run seed-canvas-strings.ts first`); continue; }

    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId, locale: "hi" } },
      create: { tabId, locale: "hi", title, description: description ?? null, autoTranslated: false, status: "published" },
      update: { title, description: description ?? null, autoTranslated: false, status: "published" },
    });
    console.log(`  ✓  ${slug.padEnd(28)}→  ${title}`);
    done++;
  }

  console.log(`\nDone: ${done} upserted, ${skipped} skipped`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
