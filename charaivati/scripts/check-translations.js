// scripts/check-translations.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const tabs = await prisma.tab.count();
    const translations = await prisma.tabTranslation.count();
    const enCount = await prisma.tabTranslation.count({ where: { locale: "en" }});
    console.log("Total tabs:", tabs);
    console.log("Total TabTranslation rows:", translations);
    console.log("English translations (locale='en'):", enCount);

    const sampleTabs = await prisma.tab.findMany({
      take: 10,
      orderBy: { createdAt: "asc" },
      include: { translations: { take: 5 } }
    });
    console.log("Sample tabs with translations (first 10):");
    console.dir(sampleTabs, { depth: 3 });

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
