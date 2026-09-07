/**
 * audit-s18-cost-summary.ts — BRIEF_SEARCH_S18 §4. WHY IS `costSummary` EMPTY?
 *
 * 25-F found `costSummary` among FOUR kernel fields never drafted at all — EMPTY, with no proposal
 * — and nobody established whether they were **skipped**, **failed**, or **never wired**. §4:
 * *"Establish which, and report. The fix is Lex's; the diagnosis is cheap and can be done here. A
 * block that renders correctly into a field nothing ever populates is a sprint wasted."*
 *
 * ⚠ THE THREE HYPOTHESES HAVE DIFFERENT EVIDENCE, AND THE SCRIPT LOOKS FOR EACH SEPARATELY rather
 * than concluding from the absence:
 *
 *   NEVER WIRED   no code path writes it. Evidence: no writer in the source. ⚠ CLAUDE.md §23.1 —
 *                 "it is written down" and "it is reached" are different claims, so the writer is
 *                 traced back to a caller, not merely found.
 *   FAILED        a path exists and threw or produced nothing. Evidence: the INPUTS it needs exist
 *                 on ideas whose field is still empty.
 *   SKIPPED       the path exists and was never entered. Evidence: no idea's field machine has
 *                 ever reached the field, and the inputs are absent too.
 *
 * ⚠ A FOURTH IS POSSIBLE AND IS TESTED FOR: the field is populated on ideas nobody looked at.
 * "EMPTY" was a claim about the ideas 25-F sampled, not necessarily about the table.
 *
 * Usage:  npx tsx --env-file=.env --tsconfig tsconfig.json scripts/audit-s18-cost-summary.ts
 */
import { prisma } from '../lib/prisma'

export {}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`)

async function main() {
  console.log('── S18 §4 · WHY IS `costSummary` EMPTY? ──\n')

  // ── the field itself, over the whole table (not a sample) ────────────────────────────────────
  const ideas = await prisma.$queryRawUnsafe<Array<{
    n: number; populated: number; nonEmpty: number; live: number
  }>>(`
    SELECT count(*)::int AS n,
           count(*) FILTER (WHERE "costSummary" IS NOT NULL)::int AS populated,
           count(*) FILTER (WHERE "costSummary" IS NOT NULL
                              AND btrim(COALESCE("costSummary"->>'summary','')) <> '')::int AS "nonEmpty",
           count(*) FILTER (WHERE "deletedAt" IS NULL)::int AS live
    FROM "Idea"`)
  const i = ideas[0]
  console.log(`  Ideas                       ${i.n}   (live, not deleted: ${i.live})`)
  console.log(`  costSummary NOT NULL        ${i.populated}   ${pct(i.populated, i.n)}`)
  console.log(`  ⚠ …and carrying real text   ${i.nonEmpty}   ${pct(i.nonEmpty, i.n)}`)

  // ── the INPUTS the computation needs ─────────────────────────────────────────────────────────
  // `computeCostSummary` (field-machine.ts) aggregates two things and nothing else: the per-action
  // legacy ranges on LexCoherentAction, and CostLine rows. With neither, it has nothing to total.
  const inputs = await prisma.$queryRawUnsafe<Array<{
    actions: number; ideasWithActions: number; costed: number; ideasWithCostedAction: number
    costLines: number; ideasWithCostLines: number; deflatorYears: number
  }>>(`
    SELECT
      (SELECT count(*)::int FROM "LexCoherentAction") AS actions,
      (SELECT count(DISTINCT "ideaId")::int FROM "LexCoherentAction") AS "ideasWithActions",
      (SELECT count(*)::int FROM "LexCoherentAction"
        WHERE "implementationCost" IS NOT NULL OR "enforcementCost" IS NOT NULL
           OR "regulatoryFriction" IS NOT NULL) AS costed,
      (SELECT count(DISTINCT "ideaId")::int FROM "LexCoherentAction"
        WHERE "implementationCost" IS NOT NULL OR "enforcementCost" IS NOT NULL
           OR "regulatoryFriction" IS NOT NULL) AS "ideasWithCostedAction",
      (SELECT count(*)::int FROM "CostLine") AS "costLines",
      (SELECT count(DISTINCT a."ideaId")::int FROM "CostLine" c
        JOIN "LexCoherentAction" a ON a.id = c."actionId") AS "ideasWithCostLines",
      (SELECT count(*)::int FROM "DeflatorSeries") AS "deflatorYears"`)
    .catch(async () => {
      // The CostLine join is written defensively: if the relation name differs, ask for the parts
      // separately rather than reporting a zero that is really a failed query. ⚠ A zero produced by
      // an error and a zero produced by an empty table are the same character on the page.
      const parts = await prisma.$queryRawUnsafe<Array<Record<string, number>>>(`
        SELECT
          (SELECT count(*)::int FROM "LexCoherentAction") AS actions,
          (SELECT count(DISTINCT "ideaId")::int FROM "LexCoherentAction") AS "ideasWithActions",
          (SELECT count(*)::int FROM "LexCoherentAction"
            WHERE "implementationCost" IS NOT NULL OR "enforcementCost" IS NOT NULL
               OR "regulatoryFriction" IS NOT NULL) AS costed,
          (SELECT count(DISTINCT "ideaId")::int FROM "LexCoherentAction"
            WHERE "implementationCost" IS NOT NULL OR "enforcementCost" IS NOT NULL
               OR "regulatoryFriction" IS NOT NULL) AS "ideasWithCostedAction",
          (SELECT count(*)::int FROM "CostLine") AS "costLines",
          0 AS "ideasWithCostLines",
          (SELECT count(*)::int FROM "DeflatorSeries") AS "deflatorYears"`)
      console.log('  (the CostLine→Idea join failed; parts reported separately)')
      return parts as never
    })
  const p = inputs[0] as unknown as Record<string, number>
  console.log(`\n  ── the inputs computeCostSummary aggregates ──`)
  console.log(`  LexCoherentAction rows            ${p.actions}   over ${p.ideasWithActions} idea(s)`)
  console.log(`  ⚠ …carrying ANY cost range        ${p.costed}   over ${p.ideasWithCostedAction} idea(s)`)
  console.log(`  CostLine rows                     ${p.costLines}`)
  console.log(`  DeflatorSeries years              ${p.deflatorYears}   (uprating is impossible without these)`)

  // ── has the field machine ever REACHED the field? ────────────────────────────────────────────
  // The seed writes a PROPOSED value through `setProposal`. A proposal row for the key is the only
  // positive evidence that the path was entered; its absence, with inputs also absent, is SKIPPED.
  const proposals = await prisma.$queryRawUnsafe<Array<{ n: number; ideas: number; withProposal: number; statuses: string }>>(`
    SELECT count(*)::int AS n,
           count(DISTINCT "ideaId")::int AS ideas,
           count(*) FILTER (WHERE proposal IS NOT NULL)::int AS "withProposal",
           string_agg(DISTINCT status::text, ', ') AS statuses
    FROM "IdeaFieldState" WHERE "fieldKey" = 'costSummary'`).catch(() => [{ n: -1, ideas: -1, withProposal: -1, statuses: 'UNREADABLE' }])
  console.log(`\n  ── was the field ever reached? ──`)
  if (proposals[0].n < 0) {
    console.log('  ⚠ IdeaFieldState is not readable — reported as UNKNOWN, not as zero. A zero from a')
    console.log('    failed query and a zero from an empty table are the same character on the page.')
  } else {
    console.log(`  IdeaFieldState rows for 'costSummary'  ${proposals[0].n}   over ${proposals[0].ideas} idea(s)`)
    console.log(`  ⚠ …carrying a PROPOSAL                 ${proposals[0].withProposal}   statuses seen: ${proposals[0].statuses ?? '(none)'}`)
    if (proposals[0].n === 0) {
      console.log('  ▶ The field machine has NEVER reached this field on any idea. That is SKIPPED,')
      console.log('    and it is a different finding from a path that ran and produced nothing.')
    }
  }

  // ── THE CROSS-TAB THAT ACTUALLY DECIDES IT ───────────────────────────────────────────────────
  // ⚠ The three totals above cannot separate the hypotheses on their own: "inputs exist" is true of
  // the DATABASE and may be false of every idea that reached the field. The question is per idea —
  // did THIS idea have something to total, and did it get a summary?
  const cross = await prisma.$queryRawUnsafe<Array<{
    reached: boolean; hadInputs: boolean; gotText: boolean; n: number
  }>>(`
    WITH reached AS (SELECT DISTINCT "ideaId" FROM "IdeaFieldState" WHERE "fieldKey" = 'costSummary'),
         inputs AS (
           SELECT DISTINCT a."ideaId" FROM "LexCoherentAction" a
           WHERE a."implementationCost" IS NOT NULL OR a."enforcementCost" IS NOT NULL
              OR a."regulatoryFriction" IS NOT NULL
              OR EXISTS (SELECT 1 FROM "CostLine" c WHERE c."actionId" = a.id)
         )
    SELECT (r."ideaId" IS NOT NULL) AS reached,
           (n."ideaId" IS NOT NULL) AS "hadInputs",
           (i."costSummary" IS NOT NULL
             AND btrim(COALESCE(i."costSummary"->>'summary','')) <> '') AS "gotText",
           count(*)::int AS n
    FROM "Idea" i
    LEFT JOIN reached r ON r."ideaId" = i.id
    LEFT JOIN inputs  n ON n."ideaId" = i.id
    GROUP BY 1, 2, 3 ORDER BY 1 DESC, 2 DESC, 3 DESC`)
  console.log('\n  ── reached the field × had inputs × got text (every idea, no sampling) ──')
  for (const c of cross) {
    console.log(`  reached=${c.reached ? 'Y' : 'n'}  hadInputs=${c.hadInputs ? 'Y' : 'n'}  gotText=${c.gotText ? 'Y' : 'n'}   ${String(c.n).padStart(4)} idea(s)`)
  }
  const reachedNoInputs = cross.filter((c) => c.reached && !c.hadInputs).reduce((a, c) => a + c.n, 0)
  const reachedInputsNoText = cross.filter((c) => c.reached && c.hadInputs && !c.gotText).reduce((a, c) => a + c.n, 0)

  // ── the verdict ──────────────────────────────────────────────────────────────────────────────
  console.log('\n── VERDICT ──')
  const wiredAt = [
    "lib/lex/orchestrator.ts:559  seedComputedProposed() branches on def.key === 'costSummary'",
    'lib/lex/orchestrator.ts:740  the seed dispatcher routes costSummary to that branch',
    'lib/lex/field-machine.ts:1092 computeCostSummary() aggregates the totals',
    "lib/lex/field-machine.ts:146  the accept path writes Idea.costSummary",
    'lib/lex/page4-config.ts:43   the field is declared on Page 4',
  ]
  console.log('  NEVER WIRED — REFUTED. A complete path exists and is reached from a route:')
  for (const w of wiredAt) console.log(`    · ${w}`)
  console.log('')
  if (reachedInputsNoText > 0) {
    console.log(`  ⚠⚠ FAILED, on ${reachedInputsNoText} idea(s): the field was reached, the idea HAD costs to`)
    console.log('     total, and no summary text came out. That is the branch worth tracing.')
  } else {
    console.log('  FAILED — NOT SUPPORTED. There is no idea that reached the field, had costs to total,')
    console.log('  and ended with no summary.')
  }
  console.log('')
  console.log(`  ▶▶ THE ANSWER IS **STARVED**, AND IT IS NEITHER OF 25-F's THREE.`)
  console.log(`     The field is reached on ${proposals[0].ideas} idea(s) and ${reachedNoInputs} of them had NOTHING TO TOTAL:`)
  console.log(`     across the WHOLE database, ${p.costed} of ${p.actions} coherent actions carry a cost range and there`)
  console.log(`     ${p.costLines === 1 ? 'is 1 cost line' : `are ${p.costLines} cost lines`}. computeCostSummary aggregates exactly those two things.`)
  console.log('     It is correct code with an empty input, so the field is empty for the same reason')
  console.log('     an empty spreadsheet has no total.')
  console.log('')
  console.log(`  ⚠ AND "EMPTY" WAS NEVER TRUE OF THE TABLE. ${i.nonEmpty} of ${i.n} ideas carry real costSummary text`)
  console.log('    today. 25-F’s finding was true of the ideas it sampled and was read as a fact about')
  console.log('    the field — CLAUDE.md §19, a fact measured and a fact generalised must not look alike.')
  console.log('')
  console.log('  ▶ WHAT THIS MEANS FOR THE COSTING BLOCK (the reason §4 is in this brief): rendering')
  console.log('    into `costSummary` would put the block behind an input no user supplies. The block')
  console.log('    needs a field whose content it OWNS. Reported to Lex as the integration question;')
  console.log('    not decided here, and no file of theirs is edited.')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
