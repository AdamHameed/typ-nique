import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __typNiquePrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__typNiquePrisma ??
  new PrismaClient({
    log: ["warn", "error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__typNiquePrisma = prisma;
}
