// prisma/seed-languages.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const langs = [
    { code: "en", name: "English" },
    { code: "hi", name: "हिन्दी" },
    { code: "bn", name: "বাংলা" },
    { code: "ta", name: "தமிழ்" },
    { code: "te", name: "తెలుగు" },
    { code: "ml", name: "മലയാളം" },
    { code: "kn", name: "ಕನ್ನಡ" },
    { code: "mr", name: "मराठी" },
    { code: "gu", name: "ગુજરાતી" },
    { code: "pa", name: "ਪੰਜਾਬੀ" },
    { code: "or", name: "ଓଡ଼ିଆ" },
    { code: "as", name: "অসমীয়া" },
    { code: "ur", name: "اردو" },
    { code: "ks", name: "کٲشُر" },
    { code: "ne", name: "नेपाली" },
    { code: "sd", name: "سنڌي" },
  ];

  for (const l of langs) {
    await prisma.language.upsert({
      where: { code: l.code },
      update: {},
      create: { code: l.code, name: l.name, enabled: true },
    });
  }

  console.log("Seeded languages ✅");
}

main().finally(() => prisma.$disconnect());
