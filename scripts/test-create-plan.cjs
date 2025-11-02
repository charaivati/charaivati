// scripts/test-create-plan.cjs
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const plan = await prisma.businessPlan.create({
      data: {
        title: "Script test",
        retrievalToken: "test-" + Date.now(),
        dataJson: { quick: true },
      },
    });
    console.log("created", plan);
  } catch (e) {
    console.error("PRISMA ERR", e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
