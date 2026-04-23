// scripts/seed-languages.ts
// Upserts the 11 Indian languages with native names into the Language table.
// Run with: npx tsx scripts/seed-languages.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LANGUAGES = [
  { code: "hi", name: "Hindi",     nativeName: "हिन्दी"    },
  { code: "bn", name: "Bengali",   nativeName: "বাংলা"     },
  { code: "ta", name: "Tamil",     nativeName: "தமிழ்"     },
  { code: "te", name: "Telugu",    nativeName: "తెలుగు"    },
  { code: "mr", name: "Marathi",   nativeName: "मराठी"     },
  { code: "gu", name: "Gujarati",  nativeName: "ગુજરાતી"  },
  { code: "kn", name: "Kannada",   nativeName: "ಕನ್ನಡ"    },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം"   },
  { code: "pa", name: "Punjabi",   nativeName: "ਪੰਜਾਬੀ"   },
  { code: "or", name: "Odia",      nativeName: "ଓଡ଼ିଆ"    },
  { code: "ur", name: "Urdu",      nativeName: "اردو"      },
];

async function main() {
  console.log("Seeding languages...\n");

  for (const lang of LANGUAGES) {
    const existing = await prisma.language.findFirst({
      where: { OR: [{ code: lang.code }, { name: lang.name }] },
    });

    if (existing) {
      await prisma.language.update({
        where: { id: existing.id },
        data: { code: lang.code, name: lang.name, nativeName: lang.nativeName, enabled: true },
      });
      console.log(`  ✓ Updated  ${lang.code}  ${lang.nativeName} (${lang.name})`);
    } else {
      await prisma.language.create({
        data: { code: lang.code, name: lang.name, nativeName: lang.nativeName, enabled: true },
      });
      console.log(`  + Created  ${lang.code}  ${lang.nativeName} (${lang.name})`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
