import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const url = process.env.DATABASE_URL;
  let dbInfo = {};
  try {
    dbInfo = await prisma.$queryRaw`SELECT current_database() as db, current_schema() as schema, now() as time;`;
  } catch (e) {
    dbInfo = { error: e.message };
  }
  return NextResponse.json({ url, dbInfo });
}
