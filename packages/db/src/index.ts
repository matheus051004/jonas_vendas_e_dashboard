import { PrismaClient } from "@prisma/client";

// ponytail: singleton simples via global; troque por injeção de dependência se precisar de múltiplos bancos/tenants.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Named re-exports only: Turbopack can't resolve `export *` from external CJS `@prisma/client`
// ("exports only available at runtime").
export {
  Prisma,
  PrismaClient,
  SaleStage,
  MessageRole,
  MessageKind,
} from "@prisma/client";

export type {
  Client,
  Settings,
  Plan,
  Area,
  Origin,
  Contract,
  Message,
  AreaPlan,
} from "@prisma/client";
