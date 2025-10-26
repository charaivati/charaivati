// scripts/create_test_user.js
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

(async () => {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: "devuser@example.test" },
      update: {},
      create: {
        email: "devuser@example.test",
        name: "Dev User",
        verified: true,
        emailVerified: true,
      },
    });

    const secret = process.env.JWT_SECRET || "dev_test_secret";
    const token = jwt.sign({ sub: user.id, userId: user.id, type: "session" }, secret, { expiresIn: "7d" });

    console.log("USER_ID:", user.id);
    console.log("TOKEN:", token);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
