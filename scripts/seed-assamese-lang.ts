// Add Assamese to Language table
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const existing = await p.language.findFirst({ where: { OR: [{ code: "as" }, { name: "Assamese" }] } });
  if (existing) {
    const updated = await p.language.update({ where: { id: existing.id }, data: { code: "as", name: "Assamese", nativeName: "অসমীয়া", enabled: true } });
    console.log("Updated:", updated.code, updated.nativeName);
  } else {
    const created = await p.language.create({ data: { code: "as", name: "Assamese", nativeName: "অসমীয়া", enabled: true } });
    console.log("Created:", created.code, created.nativeName);
  }
}
main().catch(console.error).finally(() => p.$disconnect());
