import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.featureFlag.createMany({
    data: [
      { key: "layer.self", enabled: true },
      { key: "layer.society", enabled: false },
      { key: "layer.nation", enabled: false },
      { key: "layer.earth", enabled: false },
      { key: "layer.universe", enabled: false },
    ],
    skipDuplicates: true, // safe if you rerun
  });
}

main()
  .then(() => {
    console.log("✅ Feature flags seeded successfully");
  })
  .catch((e) => {
    console.error("❌ Error seeding feature flags:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
