import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const lang = await p.language.findFirst({ where: { name: "English" } });
  if (!lang) { console.log("English not found"); return; }
  const updated = await p.language.update({
    where: { id: lang.id },
    data: { code: "en", nativeName: "English" },
  });
  console.log("Fixed:", updated.code, updated.nativeName);
}
main().catch(console.error).finally(() => p.$disconnect());
