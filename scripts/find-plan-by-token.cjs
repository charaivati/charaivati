// scripts/find-plan-by-token.cjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const token = process.argv[2];

async function main(){
  if(!token){
    console.log('usage: node scripts/find-plan-by-token.cjs <token>');
    process.exit(1);
  }
  try {
    const plan = await prisma.businessPlan.findFirst({ where: { retrievalToken: token }});
    console.log("plan found:", plan);
  } catch(e){
    console.error("ERROR (prisma):", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
