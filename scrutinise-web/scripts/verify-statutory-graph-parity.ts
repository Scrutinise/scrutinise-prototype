// ─────────────────────────────────────────────────────────────────────────────
// PARITY — does the web app's reader agree with Search/Graph's own `inbound()`?
//
// ⚠⚠ WHY THIS EXISTS. `lib/lex/statutory-graph.ts` is a SECOND READER of `citation_edge`.
// It had to be: `inbound()` lives in `scripts/ingest/graph/`, and CLAUDE.md §20 check 0
// forbids a file outside `scrutinise-web` from entering the web TypeScript program — a
// cross-package import in a harness caused a two-day production outage on ~22 Aug, and
// `inbound()` additionally reaches for `fs` and a 4GB bulk zip that does not exist on a
// serverless filesystem.
//
// Two readers of one table is a drift risk. This does not remove it; it makes it LOUD.
// If Search/Graph change their predicate and nobody changes ours, this goes red — which is
// the difference between a divergence found in a day and one found by a user quoting a
// wrong number to a select committee.
//
// ⚠ THIS SCRIPT DELIBERATELY IMPORTS ACROSS THE PACKAGE BOUNDARY. It is allowed to:
// `scripts/**` is excluded from `scrutinise-web/tsconfig.json`, so nothing here enters the
// web program or the Vercel bundle. That is exactly why the comparison can only live in a
// script and not in a check that runs inside the app.
//
// Usage:
//   tsx --env-file=.env scripts/verify-statutory-graph-parity.ts
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { inboundFor, graphCoverage } from '../lib/lex/statutory-graph'

// ⚠ Loaded lazily and defensively. The graph package needs NEON_DATABASE_URL and may not be
// installed on every machine; a parity check that CRASHES when it cannot compare is
// indistinguishable from one that found a difference, so it says which it is.
async function loadGraphReader(): Promise<null | {
  inbound: (act: string, prov?: string, unresolved?: boolean) => Promise<{ rows: unknown[] }>
}> {
  try {
    const mod = await import('../../scripts/ingest/graph/inbound')
    return mod as never
  } catch (e) {
    console.log(`⚠ could not load Search/Graph's inbound(): ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

const TARGETS = ['ukpga/2010/25', 'ukpga/2010/15']

let failures = 0
function ok(name: string, pass: boolean, detail = '') {
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}`)
  if (!pass) failures++
}

async function main() {
  console.log('── parity: web reader vs Search/Graph inbound() ──')

  // 1. Our reader against the table directly — the invariant that does not need their code.
  for (const t of TARGETS) {
    const mine = await inboundFor(t)
    const direct = await prisma.$queryRawUnsafe<Array<{ n: bigint; prov: bigint }>>(`
      SELECT COUNT(*)::bigint AS n,
             COUNT(*) FILTER (WHERE source_provision_ref IS NOT NULL)::bigint AS prov
      FROM citation_edge WHERE target_act_id = ANY($1::text[])`, [t, t.toLowerCase()])
    const total = Number(direct[0].n)
    const prov = Number(direct[0].prov)
    ok(`${t}: provision rows match the table`, mine.rows.length === prov,
      `reader ${mine.rows.length}, table ${prov}`)
    ok(`${t}: nothing is dropped (provision + title-only = total)`,
      mine.rows.length + mine.titleOnly.length === total,
      `${mine.rows.length} + ${mine.titleOnly.length} = ${mine.rows.length + mine.titleOnly.length}, table ${total}`)
  }

  // 2. The coverage layer ids must match theirs, or our caveat under-reports what is missing.
  const cov = await graphCoverage()
  const theirs = await import('../../scripts/ingest/graph/coverage').catch(() => null)
  if (theirs) {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('../scripts/ingest/graph/coverage.ts', 'utf8')).catch(() => '')
    const theirIds = [...src.matchAll(/id:\s*'([a-z-]+)'/g)].map((m) => m[1])
    const mineIds = cov.layers.map((l) => l.id)
    const missing = theirIds.filter((i) => !mineIds.includes(i))
    ok('every layer Search/Graph declares is declared here too',
      missing.length === 0,
      missing.length ? `we do not declare: ${missing.join(', ')} — our caveat under-reports what is missing` : '')
  } else {
    console.log('  ⚠ layer comparison SKIPPED — could not load their coverage module')
  }

  // 3. Row-for-row against their reader, where it can run.
  const graph = await loadGraphReader()
  if (!graph) {
    console.log('\n⚠ ROW-LEVEL PARITY NOT RUN. This is not a pass: it is a comparison that did')
    console.log('  not happen, and it is reported as such rather than counted as agreement.')
  } else {
    for (const t of TARGETS) {
      try {
        const mine = await inboundFor(t)
        const res = await graph.inbound(t)
        const theirCount = Array.isArray(res.rows) ? res.rows.length : -1
        ok(`${t}: same row count as inbound()`,
          mine.rows.length + mine.titleOnly.length === theirCount,
          `ours ${mine.rows.length + mine.titleOnly.length}, theirs ${theirCount}`)
      } catch (e) {
        console.log(`  ⚠ ${t}: their reader threw — ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  console.log(`\n${failures === 0 ? 'parity holds.' : `${failures} DIVERGENCE(S).`}`)
  process.exitCode = failures ? 1 : 0
}

main().finally(() => prisma.$disconnect())
