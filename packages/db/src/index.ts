import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

export * from "../generated/prisma/client.ts";

// 개발 중 핫 리로드마다 커넥션이 새로 생기지 않도록 전역에 하나만 둔다
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // `npm run db:dev`(prisma dev, PGlite 기반)는 동시 연결에 약하므로 DATABASE_POOL_MAX=1 로 제한한다
  const max = Number(process.env["DATABASE_POOL_MAX"]) || undefined;
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"], max });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = db;
