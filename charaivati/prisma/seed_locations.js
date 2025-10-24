// prisma/seed_locations.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding locations...");

  // 1) Country
  let india = await prisma.country.findUnique({ where: { code: "IN" } });
  if (!india) {
    india = await prisma.country.create({ data: { code: "IN", name: "India / भारत" } });
    console.log("Created country: India");
  } else {
    console.log("Country exists:", india.name);
  }

  // 2) Admin levels (idempotent)
  const levels = [
    { level: 1, label: "Country" },
    { level: 2, label: "State" },
    { level: 3, label: "Legislative (Assembly)" },
    { level: 4, label: "Parliament (MP)" },
    { level: 5, label: "Local (Panchayat/Municipal)" },
  ];
  for (const lv of levels) {
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
  console.log("Admin levels ensured.");

  // 3) Regions
  let odisha = await prisma.region.findFirst({ where: { countryId: india.id, name: "Odisha" } });
  if (!odisha) {
    odisha = await prisma.region.create({
      data: { countryId: india.id, name: "Odisha", level: 2, code: "OD" },
    });
    console.log("Created region: Odisha");
  } else console.log("Region exists:", odisha.name);

  let khordha = await prisma.region.findFirst({
    where: { countryId: india.id, name: "Khordha", parentId: odisha.id },
  });
  if (!khordha) {
    khordha = await prisma.region.create({
      data: { countryId: india.id, parentId: odisha.id, name: "Khordha", level: 3, code: "KHD" },
    });
    console.log("Created region: Khordha");
  } else console.log("Region exists:", khordha.name);

  // 4) LocalAreas
  const localAreasData = [
    { name: "Khordha Ward 1", population: 12000 },
    { name: "Khordha Ward 2", population: 15000 },
  ];

  for (const la of localAreasData) {
    await prisma.localArea.upsert({
      where: { regionId_name: { regionId: khordha.id, name: la.name } },
      update: { population: la.population },
      create: { regionId: khordha.id, name: la.name, population: la.population },
    });
  }
  console.log("LocalAreas ensured.");

  // 5) Test user
  const firstLocal = await prisma.localArea.findFirst({ where: { regionId: khordha.id } });
  const testEmail = "test@local.test";
  await prisma.user.upsert({
    where: { email: testEmail },
    update: { lastSelectedLocalAreaId: firstLocal.id, verified: true, emailVerified: true },
    create: {
      email: testEmail,
      name: "Test User",
      verified: true,
      emailVerified: true,
      lastSelectedLocalAreaId: firstLocal.id,
    },
  });
  console.log("Test user ensured:", testEmail);

  console.log("Locations seed finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
