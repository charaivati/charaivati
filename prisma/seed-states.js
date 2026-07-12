// prisma/seed-states.js
// Public-driven unit coverage needs a fixed scaffold to attach proposals to:
// India + its 28 states and 8 union territories (public reference data —
// wards/panchayats themselves are NOT seeded; users propose those via the
// picker and they verify at UNIT_VERIFY_RESIDENTS residents).
// Idempotent (stable ids, upserts). Run standalone:  node prisma/seed-states.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const COUNTRY = { id: "civic-country-india", type: "country", name: "India", parentId: null };

const STATES = [
  // 28 states
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  // 8 union territories
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  await prisma.unit.upsert({
    where: { id: COUNTRY.id },
    update: { name: COUNTRY.name, type: COUNTRY.type, parentId: COUNTRY.parentId },
    create: COUNTRY,
  });

  for (const name of STATES) {
    const id = `civic-state-${slug(name)}`;
    await prisma.unit.upsert({
      where: { id },
      update: { name, type: "state", parentId: COUNTRY.id },
      create: { id, name, type: "state", parentId: COUNTRY.id },
    });
  }

  console.log(`Seeded India + ${STATES.length} states/UTs.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
