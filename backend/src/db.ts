import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient | null = null;

export function getPrisma() {
  if (prisma) {
    return prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required when using the Prisma repositories");
  }

  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });

  return prisma;
}
