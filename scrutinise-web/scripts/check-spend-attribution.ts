// check:spend-attribution — of the ledger rows written SINCE attribution was fixed, how many that a person
// caused (build, deepening, chat, search) carry a user? Reads production; changes nothing.
//
//   npx tsx --env-file=.env scripts/check-spend-attribution.ts [--since 2026-09-29T10:00:00Z]
//
// ⚠ §23.2: zero rows since the cutoff is NOT CHECKED, never a pass — the fix cannot be proven by an empty
// window. Measurement/platform passes (benchmarks, probes, ingest) have no user by nature and are counted
// separately, not as failures. The build/chat/search paths only produce rows when someone uses them, so this
// reports what it saw and how many of each pass it saw.
import { prisma } from '../lib/prisma'
import { spendOriginOf } from '../lib/lex/spend-origin'

const i = process.argv.indexOf('--since')
const since = new Date(i > 0 ? process.argv[i + 1] : '2026-09-29T10:00:00Z')

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT stream, pass, count(*)::int n, count("userId")::int with_user, count("buildId")::int with_build
       FROM "LlmSpend" WHERE "createdAt" >= $1 GROUP BY 1,2 ORDER BY n DESC`, since,
  ) as Array<{ stream: string; pass: string; n: number; with_user: number; with_build: number }>
  let personRows = 0, personMissing = 0
  for (const r of rows) {
    const origin = spendOriginOf(r.stream, r.pass)
    const tag = origin === 'user-facing' ? (r.with_user === r.n ? '✓' : '✗') : '·'
    console.log(`${tag} ${r.stream.padEnd(11)} ${r.pass.padEnd(34)} ${String(r.n).padStart(5)} rows  ${r.with_user} with user  ${r.with_build} with build  [${origin}]`)
    if (origin === 'user-facing') { personRows += r.n; personMissing += r.n - r.with_user }
  }
  console.log(`\nsince ${since.toISOString()}: ${rows.reduce((s, r) => s + r.n, 0)} rows; person-caused ${personRows}, missing a user ${personMissing}`)
  if (personRows === 0) { console.log('NOT CHECKED — no person-caused rows since the cutoff, so nothing has exercised the fix yet.'); return }
  console.log(personMissing === 0 ? 'PASS — every person-caused row since the cutoff carries a user.' : `FAIL — ${personMissing} person-caused rows have no user.`)
  if (personMissing) process.exitCode = 1
}
main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1) })
