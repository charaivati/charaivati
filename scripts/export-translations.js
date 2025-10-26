// scripts/export-translations.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const fs = require("fs");
const path = require("path");

(async () => {
  try {
    const rows = [];
    // get tabs and their translations
    const tabs = await prisma.tab.findMany({
      include: { translations: true, level: true },
      orderBy: { position: "asc" }
    });

    for (const t of tabs) {
      // ensure at least English row exists
      if (!t.translations || t.translations.length === 0) {
        rows.push({
          tabId: t.id,
          slug: t.slug,
          levelKey: t.level?.key ?? "",
          locale: "en",
          title: t.title,
          description: t.description ?? "",
          status: "published",
          slug_local: t.slug,
          autoTranslated: "false"
        });
      } else {
        for (const tr of t.translations) {
          rows.push({
            tabId: t.id,
            slug: t.slug,
            levelKey: t.level?.key ?? "",
            locale: tr.locale,
            title: tr.title,
            description: tr.description ?? "",
            status: tr.status ?? "",
            slug_local: tr.slug ?? "",
            autoTranslated: tr.autoTranslated ? "true" : "false"
          });
        }
      }
    }

    const header = [
      "tabId","slug","levelKey","locale","title","description","status","slug_local","autoTranslated"
    ].join(",");

    const lines = rows.map(r => {
      // basic CSV escaping
      const esc = (v) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      return [
        esc(r.tabId), esc(r.slug), esc(r.levelKey), esc(r.locale),
        esc(r.title), esc(r.description), esc(r.status), esc(r.slug_local), esc(r.autoTranslated)
      ].join(",");
    });

    const outPath = path.join(__dirname, "..", "prisma", "data", "tab-translations-export.csv");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, [header, ...lines].join("\n"), "utf8");
    console.log("Exported", rows.length, "rows to", outPath);

  } catch (e) {
    console.error("Export failed:", e);
  } finally {
    await prisma.$disconnect();
  }
})();
