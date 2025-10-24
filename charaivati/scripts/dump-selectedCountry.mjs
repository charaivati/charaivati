// scripts/dump-selectedCountry.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    where: { selectedCountry: { not: null } },
    select: { id: true, email: true, name: true, selectedCountry: true },
  });
  console.log("Users with selectedCountry:", users.length);
  console.table(users);
  await prisma.$disconnect();
}
run().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
