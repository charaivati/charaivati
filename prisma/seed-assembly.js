// prisma/seed-assembly.js
// Real Assembly + Parliamentary constituency data for the civic Unit table —
// fills the "Assembly: Not mapped" gap left by seed-civic.js (which only
// seeded one demo chain, Assam/Guwahati East). Source: India's official
// Local Government Directory (lgdirectory.gov.in), via the public mirror
// https://github.com/ramSeraph/opendata (lgd-latest-extra1 release,
// assembly_constituencies CSV, snapshot 20 Jul 2026). CSV committed at
// prisma/data/assembly_constituencies.csv — no network dependency at seed time.
//
// Requires seed-states.js to have run first (states must already exist).
// Wards/panchayats are still NOT seeded here — that layer stays
// public-driven per CIVIC-1 doctrine (too large/volatile to hardcode).
//
// Idempotent (stable ids, upserts). Run standalone:  node prisma/seed-assembly.js

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

const CSV_PATH = path.join(__dirname, "data", "assembly_constituencies.csv");

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// The CSV's "The Dadra And Nagar Haveli And Daman And Diu" is the only state
// name that doesn't slug-match seed-states.js's list (a leading article) —
// stripping it makes every other name match by slug alone, casing included.
function stateSlug(name) {
  return slug(name.replace(/^the\s+/i, ""));
}

function parseRows() {
  const lines = fs.readFileSync(CSV_PATH, "utf8").split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    // Skip blank lines and the trailing "Jul 20, 2026, 12:52 PM" export-timestamp footer row.
    if (cols.length < 7 || !cols[2] || !/^\d+$/.test(cols[0])) continue;
    rows.push({
      stateName: cols[2].trim(),
      pcCode: cols[3].trim(),
      pcName: cols[4].trim(),
      acCode: cols[5].trim(),
      acName: cols[6].trim(),
    });
  }
  return rows;
}

async function main() {
  const rows = parseRows();
  console.log(`Parsed ${rows.length} assembly constituency rows.`);

  const stateUnitIdCache = new Map(); // stateSlug -> Unit.id | null
  const pcUnitIdCache = new Map(); // "stateSlug:pcCode" -> Unit.id

  let pcCount = 0;
  let acCount = 0;
  let skippedNoState = 0;

  for (const row of rows) {
    const sSlug = stateSlug(row.stateName);

    if (!stateUnitIdCache.has(sSlug)) {
      const state = await prisma.unit.findUnique({ where: { id: `civic-state-${sSlug}` } });
      stateUnitIdCache.set(sSlug, state ? state.id : null);
    }
    const stateUnitId = stateUnitIdCache.get(sSlug);
    if (!stateUnitId) {
      skippedNoState++;
      continue;
    }

    const pcKey = `${sSlug}:${row.pcCode}`;
    let pcUnitId = pcUnitIdCache.get(pcKey);
    if (!pcUnitId) {
      pcUnitId = `civic-pc-${sSlug}-${row.pcCode}`;
      await prisma.unit.upsert({
        where: { id: pcUnitId },
        update: { name: row.pcName, type: "parliamentary", parentId: stateUnitId },
        create: { id: pcUnitId, name: row.pcName, type: "parliamentary", parentId: stateUnitId },
      });
      pcUnitIdCache.set(pcKey, pcUnitId);
      pcCount++;
    }

    const acUnitId = `civic-ac-${sSlug}-${row.acCode}`;
    await prisma.unit.upsert({
      where: { id: acUnitId },
      update: { name: row.acName, type: "assembly", parentId: pcUnitId },
      create: { id: acUnitId, name: row.acName, type: "assembly", parentId: pcUnitId },
    });
    acCount++;
  }

  console.log(`Seeded ${pcCount} parliamentary constituencies, ${acCount} assembly constituencies.`);
  if (skippedNoState > 0) {
    console.log(`Skipped ${skippedNoState} rows — state not found (run seed-states.js first).`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
