// scripts/run-all-translations.ts
// Runs seed-translations for every locale in order, using local Ollama.
// Reports per-language counts and flags bad script output.
// Run with: npx tsx scripts/run-all-translations.ts
// Skip already-done locales: SKIP_LOCALES=hi,bn npx tsx scripts/run-all-translations.ts

import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Priority order: hi bn as already done → remaining
const ALL_LOCALES = ["hi", "bn", "as", "ta", "te", "mr", "gu", "kn", "ml", "pa", "es", "ru"];
const SKIP = new Set((process.env.SKIP_LOCALES ?? "").split(",").filter(Boolean));

// Expected script presence per locale (to detect wrong-language output)
const SCRIPT_REGEX: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/,
  bn: /[ঀ-৿]/, as: /[ঀ-৿]/,
  ta: /[஀-௿]/,
  te: /[ఀ-౿]/,
  gu: /[઀-૿]/,
  kn: /[ಀ-೿]/,
  ml: /[ഀ-ൿ]/,
  pa: /[਀-੿]/,
};

async function countForLocale(locale: string) {
  return prisma.tabTranslation.count({ where: { locale } });
}

async function main() {
  console.log("=== run-all-translations ===\n");

  for (const locale of ALL_LOCALES) {
    if (SKIP.has(locale)) {
      console.log(`[${locale}] Skipped (SKIP_LOCALES)\n`);
      continue;
    }

    const before = await countForLocale(locale);
    console.log(`\n━━━ [${locale}] starting (${before} rows before) ━━━`);

    let stdout = "";
    try {
      stdout = execSync(
        `npx tsx scripts/seed-translations.ts`,
        {
          env: { ...process.env, TRANSLATE_LOCALE: locale },
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
          timeout: 900_000, // 15 min per locale
        }
      ).toString();
    } catch (e: any) {
      stdout = e.stdout?.toString() ?? "";
      console.error(`  ✗ [${locale}] process exited with error:`, e.message?.split("\n")[0]);
    }

    // Parse counts from summary line
    const summary = stdout.match(/Done:\s*(\d+) translated,\s*(\d+) skipped,\s*(\d+) failed/);
    const done    = summary ? +summary[1] : "?";
    const skipped = summary ? +summary[2] : "?";
    const failed  = summary ? +summary[3] : "?";
    const after   = await countForLocale(locale);

    console.log(`  [${locale}] translated: ${done} | skipped: ${skipped} | failed: ${failed} | total rows now: ${after}`);

    // Flag bad script output for Indic locales
    const pattern = SCRIPT_REGEX[locale];
    if (pattern) {
      const lines = stdout.split("\n").filter(l => l.trim().startsWith("✓"));
      const bad: string[] = [];
      for (const line of lines) {
        const value = line.split("→")[1]?.replace(/"/g, "").trim() ?? "";
        // Skip purely numeric / emoji / Latin-only short values (e.g. "AI", "₹", day abbreviations)
        if (value.length < 3) continue;
        if (/^[\x00-\x7F\s]+$/.test(value) && !pattern.test(value)) {
          bad.push(`  ⚠ WRONG SCRIPT [${locale}]: ${line.trim()}`);
        }
      }
      if (bad.length) {
        console.log(`\n  Bad output detected (${bad.length} rows):`);
        bad.forEach(b => console.log(b));
      } else {
        console.log(`  Script check: ✓ no wrong-script output detected`);
      }
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  All locales complete.");
  const total = await prisma.tabTranslation.count();
  console.log(`  Total TabTranslation rows: ${total}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
