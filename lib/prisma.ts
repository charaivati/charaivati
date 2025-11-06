// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // allow hot-reload in dev by storing Prisma Client on global
  // (prevents exhausting DB connections during HMR)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var prisma: PrismaClient | undefined;
}

// Named export
export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

// Default export for older code that imports `import prisma from "@/lib/prisma"`
export default prisma;
