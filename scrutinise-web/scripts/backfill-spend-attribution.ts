// One-off (idempotent) backfill of LlmSpend attribution. Prints coverage before and after.
//
//   npx tsx --env-file=.env scripts/backfill-spend-attribution.ts [--write]
//
// ⚠ EVERY ROW THIS TOUCHES IS MARKED `attrSource`, SO AN INFERENCE CAN NEVER PASS FOR A FACT:
//   inferred-idea    the row already carried an idea; the user is that idea's creator (who pays for it)
//   inferred-window  the row carried nothing, but EXACTLY ONE build was running at that instant
// Zero or several candidate builds → the row is left unattributed. Amounts are never changed.
// Without --write it only reports what it WOULD do.

import { prisma } from '../lib/prisma'

const write = process.argv.includes('--write')
const q = (sql: string) => prisma.$queryRawUnsafe(sql) as Promise<Array<Record<string, unknown>>>

async function coverage(label: string) {
  const r = (await q(`
    SELECT count(*)::int rows,
           count("userId")::int with_user, count("ideaId")::int with_idea, count("buildId")::int with_build,
           round(coalesce(sum("estCostPence"),0)::numeric,2)::text pence,
           round(coalesce(sum("estCostPence") FILTER (WHERE "userId" IS NOT NULL),0)::numeric,2)::text pence_with_user
      FROM "LlmSpend"`))[0]
  console.log(`${label}: ${r.with_user}/${r.rows} rows carry a user, ${r.with_idea} an idea, ${r.with_build} a build; £${(Number(r.pence_with_user) / 100).toFixed(2)} of £${(Number(r.pence) / 100).toFixed(2)} is attributed to a user`)
}

async function main() {
  await coverage('BEFORE')

  const idea = (await q(`SELECT count(*)::int n FROM "LlmSpend" s JOIN "Idea" i ON i.id = s."ideaId" WHERE s."userId" IS NULL`))[0]
  console.log(`inferred-idea candidates (idea present, user missing): ${idea.n}`)

  const win = await q(`
    SELECT s.id, b.id build_id, b."ideaId" idea_id, i."creatorId" user_id
      FROM "LlmSpend" s
      JOIN LATERAL (
        SELECT b.id, b."ideaId" FROM "IdeaBuild" b
         WHERE b."startedAt" IS NOT NULL AND s."createdAt" >= b."startedAt"
           AND s."createdAt" <= coalesce(b."completedAt", b."startedAt" + interval '2 hours')
      ) b ON true
      JOIN "Idea" i ON i.id = b."ideaId"
     WHERE s."ideaId" IS NULL AND s."userId" IS NULL AND s.stream IN ('build','deepening','lex')
       AND (s.stream <> 'lex' OR s.pass LIKE 'search.%')
       AND (SELECT count(*) FROM "IdeaBuild" b2 WHERE b2."startedAt" IS NOT NULL AND s."createdAt" >= b2."startedAt"
             AND s."createdAt" <= coalesce(b2."completedAt", b2."startedAt" + interval '2 hours')) = 1`)
  console.log(`inferred-window candidates (exactly one build running at that instant): ${win.length}`)

  if (!write) { console.log('\n(dry run — pass --write to apply)'); return }

  const a = await prisma.$executeRawUnsafe(`UPDATE "LlmSpend" s SET "userId" = i."creatorId", "attrSource" = 'inferred-idea'
     FROM "Idea" i WHERE s."ideaId" = i.id AND s."userId" IS NULL`)
  let b = 0
  for (const r of win) {
    b += await prisma.$executeRawUnsafe(`UPDATE "LlmSpend" SET "ideaId" = $1, "userId" = $2, "buildId" = $3, "attrSource" = 'inferred-window' WHERE id = $4 AND "userId" IS NULL AND "ideaId" IS NULL`,
      r.idea_id, r.user_id, r.build_id, r.id)
  }
  console.log(`\nWROTE: inferred-idea ${a}, inferred-window ${b}`)
  await coverage('AFTER')
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
