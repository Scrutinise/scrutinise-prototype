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

/** ⚠ Spread into a where that must see EVERY row, archived included: `{ ideaId, ...INCLUDING_ARCHIVED }`. It works because the key is
 *  present (so `liveOnly` steps aside) and its value is undefined (so Prisma ignores it). Every number writer uses it, which is how a
 *  removed policy's number stays taken. */
export const INCLUDING_ARCHIVED = { archivedAt: undefined } as const

/** 26-AA item 1 — the five models whose removal became an archive: PolicyOption, IdeaNote, CoherentActionSection, EvidenceItem, IdeaGroup.
 *  ⚠ Writes by id (`update`, `delete`) and `findUnique` are not filtered: an id names exactly one row, and archiving is itself an `update`. */
type LiveQuery = { args: { where?: unknown }; query: (args: never) => unknown }
const live = ({ args, query }: LiveQuery) => query(liveOnly(args) as never) as never
const HIDE_ARCHIVED = {
  findMany: live, findFirst: live, findFirstOrThrow: live, count: live, aggregate: live, groupBy: live, updateMany: live,
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
      // 26-S2 190 - a RETIRED HEADING is archived, not deleted; direct reads leave it out unless the query names `archivedAt`.
      actionHeading: {
        findMany: ({ args, query }) => query(liveOnly(args)),
        findFirst: ({ args, query }) => query(liveOnly(args)),
        count: ({ args, query }) => query(liveOnly(args)),
      },
      // 26-AA item 1 (183/196) - the last hard deletes of user content are ARCHIVES. Same rule as causes, and `updateMany` too: a bulk write
      // ("rule out every other policy", "supersede this source's proposed findings") must not reach an archived row, or a restore would not
      // return it as it was. Restore names `archivedAt` in its own where, so it gets through.
      policyOption: HIDE_ARCHIVED,
      ideaNote: HIDE_ARCHIVED,
      coherentActionSection: HIDE_ARCHIVED,
      evidenceItem: HIDE_ARCHIVED,
      ideaGroup: HIDE_ARCHIVED,
    },
  }) as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
