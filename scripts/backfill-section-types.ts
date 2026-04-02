import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.$executeRawUnsafe(
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    `UPDATE "Section" SET "type" = 'grid' WHERE "type" IS NULL OR "type" = ''`
=======
    `UPDATE "StoreSection" SET "type" = 'grid' WHERE "type" IS NULL OR "type" = ''`
>>>>>>> theirs
=======
    `UPDATE "StoreSection" SET "type" = 'grid' WHERE "type" IS NULL OR "type" = ''`
>>>>>>> theirs
=======
    `UPDATE "StoreSection" SET "type" = 'grid' WHERE "type" IS NULL OR "type" = ''`
>>>>>>> theirs
  );

  console.log(`[backfill-section-types] updated ${updated} section rows to type=grid`);
}

main()
  .catch((error) => {
    console.error("[backfill-section-types] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
