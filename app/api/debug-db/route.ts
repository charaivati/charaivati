import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // or: import prisma from "@/lib/prisma";

export async function GET() {
  const url = process.env.DATABASE_URL;
  let dbInfo: unknown = {};

  try {
    // $queryRaw returns rows; leave as-is — you'll get an array or row object depending on DB
    dbInfo = await prisma.$queryRaw`SELECT current_database() as db, current_schema() as schema, now() as time;`;
  } catch (e: unknown) {
    // Safely extract message from unknown
    let message: string;
    if (e instanceof Error) {
      message = e.message;
    } else {
      try {
        message = JSON.stringify(e);
      } catch {
        message = String(e);
      }
    }
    dbInfo = { error: message };
  }

  return NextResponse.json({ url, dbInfo });
}
