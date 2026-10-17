import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * 26-S2 §11a (decision 175) — A REMOVED CAUSE IS ARCHIVED, NOT DELETED, SO ITS NUMBER IS NEVER REUSED.
 *
 * `DiagnosisCause.archivedAt` marks it. About thirty readers across the product read causes with `findMany` / `findFirst` / `count`, none of
 * which knew about archiving; rather than touch each (and miss the next), every DIRECT read of this one model adds `archivedAt: null`
 * unless the query itself names `archivedAt` — which is how a caller asks for the archived ones (`where: { archivedAt: { not: null } }`).
 * ⚠ It does NOT reach a nested read (`idea.findUnique({ select: { diagnosisCauses: … } })`): those carry `where: { archivedAt: null }` themselves.
 * ⚠ It does not change writes, `findUnique` (an id names exactly one row), or the cause-number trigger, which counts every row on purpose.
 */
const liveOnly = <A extends { where?: unknown }>(args: A): A => {
  const where = args.where as Record<string, unknown> | undefined
  if (where && Object.prototype.hasOwnProperty.call(where, 'archivedAt')) return args
  return { ...args, where: { ...(where ?? {}), archivedAt: null } }
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const base = new PrismaClient({ adapter })
  // Cast back to PrismaClient: the extension changes behaviour, not the shape callers (and their `PrismaClient`-typed parameters) rely on.
  return base.$extends({
    name: 'live-causes',
    query: {
      diagnosisCause: {
        findMany: ({ args, query }) => query(liveOnly(args)),
        findFirst: ({ args, query }) => query(liveOnly(args)),
        findFirstOrThrow: ({ args, query }) => query(liveOnly(args)),
        count: ({ args, query }) => query(liveOnly(args)),
        aggregate: ({ args, query }) => query(liveOnly(args)),
        groupBy: ({ args, query }) => query(liveOnly(args) as never),
      },
    },
  }) as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
