// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // allow global var across hot reloads in dev
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a single Prisma client instance globally
export const prisma =
  global.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"], // only log errors in production
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
