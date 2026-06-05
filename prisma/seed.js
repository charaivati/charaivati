// prisma/seed.js
// Safe seeded used by Charaivati. Default behavior: SMALL auto-grid (3x4 per level).
// To intentionally create the large 15x30 grid you must set CREATE_LARGE_GRID=true in env (explicit opt-in).

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

/**
 * Utility: create a slug from a string (very simple)
 */
function makeSlug(s) {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, "") // remove weird chars
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}

/**
 * Simple CSV parser for a basic CSV format with optional quoted fields.
 * Returns array of objects keyed by header.
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const header = lines.shift().split(",").map((h) => h.trim());
  const rows = [];
  for (const line of lines) {
    const parts = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i - 1] !== "\\") {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        parts.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    const mapped = {};
    header.forEach((h, idx) => {
      let v = parts[idx] ?? "";
      v = v.trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      mapped[h] = v;
    });
    rows.push(mapped);
  }
  return rows;
}

/* ----------------------
   Core seed helpers
   ---------------------- */

async function seedLevelsAndDefaults() {
  const levelsData = [
    { key: "personal", name: "Personal", order: 1 },
    { key: "state", name: "State", order: 2 },
    { key: "national", name: "National", order: 3 },
    { key: "global", name: "Global", order: 4 },
    { key: "universal", name: "Universal", order: 5 },
  ];

  const createdLevels = {};
  for (const lvl of levelsData) {
    const row = await prisma.level.upsert({
      where: { key: lvl.key },
      update: { name: lvl.name, order: lvl.order },
      create: { key: lvl.key, name: lvl.name, order: lvl.order },
    });
    createdLevels[lvl.key] = row;
  }

  // a few small hand-picked defaults (kept for backwards compatibility)
  const smallDefaults = [
    // Personal
    { title: "Self", slug: "self", description: "Personal self", levelKey: "personal" },
    { title: "Social", slug: "social", description: "Friends & social", levelKey: "personal" },
    { title: "Learn", slug: "learn", description: "Learning", levelKey: "personal" },
    { title: "Earn", slug: "earn", description: "Work & income", levelKey: "personal" },

    // State
    { title: "Local Gov", slug: "local-gov", description: "State / Local governance", levelKey: "state" },
    { title: "Services", slug: "services", description: "Local services", levelKey: "state" },

    // National
    { title: "Economy", slug: "economy", description: "National economy", levelKey: "national" },
    { title: "Policy", slug: "policy", description: "National policy", levelKey: "national" },

    // Global
    { title: "Climate", slug: "climate", description: "Global climate", levelKey: "global" },
    { title: "Trade", slug: "trade", description: "Global trade", levelKey: "global" },

    // Universal
    { title: "Cosmos", slug: "cosmos", description: "Universe timeline", levelKey: "universal" },
    { title: "Philosophy", slug: "philosophy", description: "Big ideas", levelKey: "universal" },
  ];

  for (const t of smallDefaults) {
    const level = createdLevels[t.levelKey];
    if (!level) continue;
    await prisma.tab.upsert({
      where: { slug: t.slug },
      update: {
        title: t.title,
        description: t.description,
        levelId: level.id,
        is_default: true,
        updatedAt: new Date(),
      },
      create: {
        title: t.title,
        slug: t.slug,
        description: t.description,
        levelId: level.id,
        is_default: true,
        is_custom: false,
      },
    });
  }

  return createdLevels;
}

/**
 * Create an auto-grid per level but only if auto-grid slugs are not already present.
 * By default we create a *small* grid (ROWS x COLS). To create the large 15x30 grid,
 * set environment variable CREATE_LARGE_GRID=true (explicit opt-in).
 *
 * Safety checks:
 * - If Tab table already has more than MAX_TAB_COUNT, skip grid creation.
 * - If any auto-grid slugs exist, skip creation.
 */
async function seedAutoGridIfMissing(createdLevels) {
  // Safety params
  const CREATE_LARGE = (process.env.CREATE_LARGE_GRID || "").toLowerCase() === "true";
  const SMALL_ROWS = parseInt(process.env.GRID_ROWS || "3", 10) || 3;
  const SMALL_COLS = parseInt(process.env.GRID_COLS || "4", 10) || 4;
  const LARGE_ROWS = 15;
  const LARGE_COLS = 30;
  const MAX_TAB_COUNT = parseInt(process.env.MAX_TAB_COUNT || "2000", 10); // don't create grid if many tabs exist

  // Count existing tabs
  const totalTabsRes = await prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM "Tab";`;
  const totalTabs = totalTabsRes?.[0]?.cnt ?? 0;
  console.log("Existing Tab count:", totalTabs);

  if (totalTabs > MAX_TAB_COUNT) {
    console.log(`Tab count (${totalTabs}) exceeds MAX_TAB_COUNT (${MAX_TAB_COUNT}). Skipping auto-grid creation.`);
    return;
  }

  // If any auto-grid slugs exist (pattern -r#-c#), skip
  const existingAutoRes = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS cnt
    FROM "Tab"
    WHERE slug ~ '-r[0-9]+-c[0-9]+'
  `;
  const existingAutoCount = existingAutoRes?.[0]?.cnt ?? 0;
  if (existingAutoCount > 0) {
    console.log("Auto-grid slugs already present (count=" + existingAutoCount + "). Skipping creation.");
    return;
  }

  // Choose grid size
  const ROWS = CREATE_LARGE ? LARGE_ROWS : SMALL_ROWS;
  const COLS = CREATE_LARGE ? LARGE_COLS : SMALL_COLS;
  if (CREATE_LARGE) {
    console.log("CREATE_LARGE_GRID=true -> Creating LARGE grid:", `${ROWS}x${COLS} per level (explicit opt-in).`);
  } else {
    console.log("Creating SMALL grid:", `${ROWS}x${COLS} per level (default).`);
  }

  let created = 0;
  for (const key of Object.keys(createdLevels)) {
    const lvl = createdLevels[key];
    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        const title = `${lvl.name} Tab R${r}C${c}`;
        const slug = `${key}-r${r}-c${c}`; // stable slug
        const description = `${lvl.name} default tab at row ${r} column ${c} (auto-generated)`;

        await prisma.tab.upsert({
          where: { slug },
          update: {
            title,
            description,
            levelId: lvl.id,
            is_default: true,
            updatedAt: new Date(),
          },
          create: {
            title,
            slug,
            description,
            levelId: lvl.id,
            is_default: true,
            is_custom: false,
          },
        });
        created++;
      }
    }
  }
  console.log(`Created/ensured ${created} auto-grid tabs (${ROWS}x${COLS} per level).`);
}

async function seedLanguages() {
  const en = await prisma.language.upsert({
    where: { code: "en" },
    update: { name: "English", enabled: true },
    create: { code: "en", name: "English", enabled: true },
  });
  const hi = await prisma.language.upsert({
    where: { code: "hi" },
    update: { name: "हिन्दी", enabled: true },
    create: { code: "hi", name: "हिन्दी", enabled: true },
  });
  return [en, hi];
}

async function seedGeoAndTestUser() {
  // Seed India + admin levels + a sample region and localAreas (your existing logic)
  let india = await prisma.country.findUnique({ where: { code: "IN" } });
  if (!india) {
    india = await prisma.country.create({
      data: { code: "IN", name: "India / भारत" },
    });
  }

  const adminLevels = [
    { level: 1, label: "Country" },
    { level: 2, label: "State" },
    { level: 3, label: "Legislative (Assembly)" },
    { level: 4, label: "Parliament (MP)" },
    { level: 5, label: "Local (Panchayat/Municipal)" },
  ];
  for (const lv of adminLevels) {
    await prisma.adminLevel.upsert({
      where: {
        countryId_level: {
          countryId: india.id,
          level: lv.level,
        },
      },
      update: { label: lv.label },
      create: { countryId: india.id, level: lv.level, label: lv.label },
    });
  }

  let odisha = await prisma.region.findFirst({
    where: { countryId: india.id, name: "Odisha" },
  });
  if (!odisha) {
    odisha = await prisma.region.create({
      data: {
        countryId: india.id,
        name: "Odisha",
        level: 2,
        code: "OD",
      },
    });
  }

  let khordha = await prisma.region.findFirst({
    where: { countryId: india.id, name: "Khordha", parentId: odisha.id },
  });
  if (!khordha) {
    khordha = await prisma.region.create({
      data: {
        countryId: india.id,
        parentId: odisha.id,
        name: "Khordha",
        level: 3,
        code: "KHD",
      },
    });
  }

  const localAreasData = [
    { name: "Khordha Ward 1", population: 12000 },
    { name: "Khordha Ward 2", population: 15000 },
  ];
  for (const la of localAreasData) {
    await prisma.localArea.upsert({
      where: {
        regionId_name: {
          regionId: khordha.id,
          name: la.name,
        },
      },
      update: { population: la.population },
      create: {
        regionId: khordha.id,
        name: la.name,
        population: la.population,
      },
    });
  }

  // Test user
  const firstLocal = await prisma.localArea.findFirst({
    where: { regionId: khordha.id },
  });
  const testEmail = "test@local.test";
  await prisma.user.upsert({
    where: { email: testEmail },
    update: { lastSelectedLocalAreaId: firstLocal?.id ?? null },
    create: {
      email: testEmail,
      name: "Test User",
      verified: true,
      emailVerified: true,
      lastSelectedLocalAreaId: firstLocal?.id ?? null,
    },
  });
}

/* ----------------------
   Translation helpers
   ---------------------- */

async function seedCanonicalEnglishTranslations() {
  console.log("Seeding canonical English tab translations (locale = 'en')...");

  const tabs = await prisma.tab.findMany({ select: { id: true, title: true, description: true, slug: true } });

  for (const t of tabs) {
    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId: t.id, locale: "en" } },
      update: {
        title: t.title,
        description: t.description,
        slug: t.slug,
        autoTranslated: false,
        status: "published",
        updatedAt: new Date(),
      },
      create: {
        tabId: t.id,
        locale: "en",
        title: t.title,
        description: t.description,
        slug: t.slug,
        autoTranslated: false,
        status: "published",
      },
    });
  }
  console.log(`Seeded ${tabs.length} English translations.`);
}

async function importTabTranslationsCSVIfPresent() {
  const csvPath = path.join(__dirname, "data", "tab-translations.csv"); // tall format: tabId,locale,title,description,status,slug,autoTranslated
  if (!fs.existsSync(csvPath)) {
    console.log("No CSV found at prisma/data/tab-translations.csv — skipping translations CSV import.");
    return;
  }
  console.log("Found translations CSV — importing from", csvPath);
  const content = fs.readFileSync(csvPath, "utf8");
  const rows = parseCSV(content);
  console.log("Translation CSV rows:", rows.length);

  for (const r of rows) {
    if (!r.tabId || !r.locale || !r.title) {
      console.warn("Skipping incomplete CSV row:", r);
      continue;
    }
    await prisma.tabTranslation.upsert({
      where: { tabId_locale: { tabId: r.tabId, locale: r.locale } },
      update: {
        title: r.title,
        description: r.description ?? null,
        slug: r.slug ?? null,
        autoTranslated: r.autoTranslated === "true" || r.autoTranslated === true,
        status: r.status ?? "needs_review",
        updatedAt: new Date(),
      },
      create: {
        tabId: r.tabId,
        locale: r.locale,
        title: r.title,
        description: r.description ?? null,
        slug: r.slug ?? null,
        autoTranslated: r.autoTranslated === "true" || r.autoTranslated === true,
        status: r.status ?? "needs_review",
      },
    });
  }
  console.log("CSV translation import complete.");
}

/* ----------------------
   CSV import for base tabs (optional)
   ---------------------- */

async function importCsvTabsIfPresent(createdLevels) {
  const csvPath = path.join(__dirname, "data", "tabs.csv");
  if (!fs.existsSync(csvPath)) {
    console.log("No CSV found at prisma/data/tabs.csv — skipping CSV import.");
    return;
  }
  console.log("CSV found — importing from", csvPath);
  const content = fs.readFileSync(csvPath, "utf8");
  const rows = parseCSV(content);
  console.log("CSV rows:", rows.length);

  for (const r of rows) {
    const levelKey = r.levelKey;
    const level = createdLevels[levelKey];
    if (!level) {
      console.warn("Skipping CSV row with unknown levelKey:", levelKey);
      continue;
    }
    const slug = r.slug || makeSlug(r.title || "");
    await prisma.tab.upsert({
      where: { slug },
      update: {
        title: r.title,
        description: r.description,
        levelId: level.id,
        is_default: true,
        updatedAt: new Date(),
      },
      create: {
        title: r.title,
        slug,
        description: r.description,
        levelId: level.id,
        is_default: true,
        is_custom: false,
      },
    });
  }
  console.log("CSV import complete.");
}

/* ----------------------
   IdeaQuestion seed
   ---------------------- */

async function seedIdeaQuestions() {
  const existing = await prisma.ideaQuestion.count();
  if (existing >= 12) {
    console.log(`IdeaQuestion already has ${existing} rows — skipping.`);
    return;
  }

  console.log("Seeding IdeaQuestion with 12 questions...");
  await prisma.ideaQuestion.deleteMany({});

  const questions = [
    { order: 1, text: "What problem are you solving? (In one sentence)", type: "text", category: "problem", scoringDim: "problemClarity", randomizeOptions: false, helpText: "Be specific. E.g., 'Students waste 2 hours daily finding affordable study materials'", examples: "Problems, not solutions" },
    { order: 2, text: "Who suffers from this problem? (Who is your customer?)", type: "text", category: "market", scoringDim: "targetAudience", randomizeOptions: false, helpText: "Age, profession, location, income level, etc.", examples: "College students in metro cities, small shopkeepers, etc." },
    { order: 3, text: "How big is this problem? (How many people have it?)", type: "select", category: "market", scoringDim: "marketNeed", randomizeOptions: true, options: [{ value: "small", label: "< 10,000 people", score: -1 }, { value: "medium", label: "10,000 - 1 lakh", score: 0 }, { value: "large", label: "1 lakh - 10 lakh", score: 1 }, { value: "xlarge", label: "> 10 lakh", score: 2 }], helpText: "Be honest about the market size", examples: "Think about: India population, but filtered to your segment" },
    { order: 4, text: "How are people currently solving this problem?", type: "text", category: "market", scoringDim: "uniqueValue", randomizeOptions: false, helpText: "Existing solutions, workarounds, or 'doing nothing'", examples: "They use Google search, hire consultants, manually track, DIY solutions" },
    { order: 5, text: "How is your solution different? (What's your unfair advantage?)", type: "select", category: "market", scoringDim: "uniqueValue", randomizeOptions: true, options: [{ value: "cheaper", label: "10x cheaper", score: 2 }, { value: "faster", label: "100x faster", score: 2 }, { value: "easier", label: "Much easier to use", score: 1 }, { value: "personal", label: "More personalized", score: 1 }, { value: "similar", label: "Similar to existing solutions", score: -1 }, { value: "unsure", label: "Not sure yet", score: -2 }], helpText: "Speed, cost, quality, access, or convenience?", examples: "Better experience, AI-powered, exclusive access, etc." },
    { order: 6, text: "Do you know anyone facing this problem? (Have you talked to them?)", type: "select", category: "market", scoringDim: "marketNeed", randomizeOptions: true, options: [{ value: "no", label: "No, not yet", score: -2 }, { value: "yes_informal", label: "Yes, informal chat", score: 1 }, { value: "yes_formal", label: "Yes, structured interviews (5+)", score: 2 }], helpText: "Real customer feedback is gold. Even 5 conversations matter more than 1000 assumptions.", examples: "Talk to friends, family, or strangers in target demographic" },
    { order: 7, text: "Can you build this? (Honestly)", type: "select", category: "feasibility", scoringDim: "feasibility", randomizeOptions: true, options: [{ value: "no_skills", label: "No, I don't have skills", score: -2 }, { value: "partially", label: "Partially, need help", score: 0 }, { value: "yes", label: "Yes, I can build it", score: 2 }, { value: "can_hire", label: "No, but can hire someone", score: 1 }], helpText: "This is about YOU right now. Not if you hire a team later.", examples: "Code, manufacture, design, write content, etc." },
    { order: 8, text: "How much will it cost to build an MVP? (First working version)", type: "select", category: "feasibility", scoringDim: "feasibility", randomizeOptions: true, options: [{ value: "free", label: "Free / ₹0-5,000", score: 2 }, { value: "low", label: "₹5,000 - ₹50,000", score: 1 }, { value: "medium", label: "₹50,000 - ₹5,00,000", score: 0 }, { value: "high", label: "> ₹5,00,000", score: -1 }], helpText: "Include your time as cost. Can you afford this?", examples: "Server, tools, materials, freelancers, your sweat equity" },
    { order: 9, text: "How will you make money? (Business model)", type: "select", category: "monetization", scoringDim: "monetization", randomizeOptions: true, options: [{ value: "subscription", label: "Subscription / Membership", score: 2 }, { value: "commission", label: "Commission / Marketplace", score: 1 }, { value: "freemium", label: "Freemium (Free + Paid)", score: 1 }, { value: "licensing", label: "Licensing / B2B", score: 1 }, { value: "ads", label: "Ads", score: 0 }, { value: "unsure", label: "Not sure yet", score: -2 }], helpText: "How do you charge customers? Be realistic.", examples: "Monthly fee, per transaction fee, % of sales, one-time purchase" },
    { order: 10, text: "Can customers actually pay for this?", type: "select", category: "monetization", scoringDim: "monetization", randomizeOptions: true, options: [{ value: "no", label: "No, it's too niche/poor market", score: -2 }, { value: "maybe", label: "Maybe, if priced right", score: 0 }, { value: "yes", label: "Yes, they're already paying competitors", score: 2 }], helpText: "Would you actually pay for this? Has someone else already validated this market?", examples: "Ask 3 people: 'Would you pay ₹X for this?' Look at competitors." },
    { order: 11, text: "What's your biggest risk right now?", type: "text", category: "feasibility", scoringDim: "feasibility", randomizeOptions: false, helpText: "Be honest: market risk, technical risk, regulatory, competition, etc.", examples: "Competition from big players, customer acquisition, regulatory hurdles, technology complexity" },
    { order: 12, text: "What's the ONE thing you need to validate this idea in the next 30 days?", type: "text", category: "market", scoringDim: "marketNeed", randomizeOptions: false, helpText: "Interview 5 customers? Build MVP? Get first paying customer? Biggest blocker?", examples: "Talk to 10 potential customers, build prototype, get first sale, get vendor quotes" },
  ];

  for (const q of questions) {
    await prisma.ideaQuestion.create({ data: q });
  }
  console.log(`IdeaQuestion seeded (12 rows).`);
}

/* ----------------------
   main
   ---------------------- */

async function main() {
  console.log("Running guarded seed...");
  const createdLevels = await seedLevelsAndDefaults();
  await importCsvTabsIfPresent(createdLevels);
  await seedAutoGridIfMissing(createdLevels);
  await seedLanguages();
  await seedGeoAndTestUser();

  // ensure we have an 'en' translation row for each existing Tab
  await seedCanonicalEnglishTranslations();

  // import other-locale translations if provided in prisma/data/tab-translations.csv
  await importTabTranslationsCSVIfPresent();

  await seedIdeaQuestions();

  console.log("Seeding complete ✅");
}

main()
  .catch((e) => {
    console.error("SEED ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
