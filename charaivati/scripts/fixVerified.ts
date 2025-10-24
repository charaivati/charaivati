// scripts/fixVerified.ts
import { prisma } from "../lib/prisma";

async function main() {
  const toFix = await prisma.user.findMany({
    where: { emailVerified: true, verified: false },
    select: { id: true, email: true },
  });
  console.log("Users to update:", toFix.length);
  for (const u of toFix) {
    await prisma.user.update({
      where: { id: u.id },
      data: { verified: true },
    });
    console.log("Updated:", u.email, u.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
