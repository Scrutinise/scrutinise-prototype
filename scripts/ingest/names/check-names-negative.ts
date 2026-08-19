/**
 * check-names-negative.ts — WATCH THE LIVE CHECKS FAIL. BRIEF_INGEST_NAMES §3.
 *
 * The unit half of `check-names.ts` carries its own negative controls: each one feeds broken input
 * and asserts the refusal, and mutating the source code makes them go red (done, three times,
 * during the sprint). The LIVE half cannot do that — it reads real rows, and real rows are correct.
 *
 * So this harness BREAKS THE DATABASE ON PURPOSE, inside a transaction that is ALWAYS rolled back,
 * and asserts that each live guard turns red. A guard that stays green with the corruption sitting
 * in front of it is not a guard, and that is exactly the class `docs/CLAUDE.md` records as
 * "a check that cannot fail".
 *
 * ⚠ NOTHING IS COMMITTED. Every mutation runs inside `BEGIN … ROLLBACK` on a dedicated connection,
 * and the script re-reads the affected counts AFTER the rollback and prints them, so the rollback
 * is demonstrated rather than asserted.
 */
import { namesPool, endNamesPool } from './names-pool'

interface Probe {
  name: string
  /** SQL that introduces exactly the defect the guard exists to catch. */
  corrupt: string
  /** The guard, as a count that must be 0 when healthy and non-0 once corrupted. */
  guard: string
}

const PROBES: Probe[] = [
  {
    name: 'a case-law row titled with its own citation',
    corrupt: `UPDATE corpus_sections SET "sectionTitle" = split_part(id, ':', 2)
               WHERE id = (SELECT id FROM corpus_sections WHERE corpus='tna-caselaw' ORDER BY id LIMIT 1)`,
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='tna-caselaw' AND "sectionTitle" IS NOT NULL
               AND btrim("sectionTitle") = btrim(split_part(id, ':', 2))`,
  },
  {
    name: 'a titled case-law row with no route recorded',
    corrupt: `UPDATE corpus_sections SET notes = NULL
               WHERE id = (SELECT id FROM corpus_sections WHERE corpus='tna-caselaw' AND "sectionTitle" IS NOT NULL ORDER BY id LIMIT 1)`,
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='tna-caselaw' AND "sectionTitle" IS NOT NULL
               AND (notes IS NULL OR notes NOT LIKE 'title-route:%')`,
  },
  {
    name: '⚠⚠ a GOVERNMENT RESPONSE wearing the committee\'s name',
    corrupt: `UPDATE corpus_sections SET attribution = notes::json->>'committeeName'
               WHERE id = (SELECT id FROM corpus_sections
                            WHERE corpus='committees-reports' AND notes LIKE '{%'
                              AND (notes::json->>'publicationType') = 'Government Response'
                            ORDER BY id LIMIT 1)`,
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='committees-reports' AND attribution IS NOT NULL
               AND notes IS NOT NULL AND notes LIKE '{%'
               AND (notes::json->>'publicationType') = 'Government Response'`,
  },
  {
    name: '⚠⚠ an oral-evidence transcript attributed to a single speaker',
    corrupt: `UPDATE corpus_sections SET speaker = 'Some Witness'
               WHERE id = (SELECT id FROM corpus_sections
                            WHERE corpus='committees-evidence' AND "parentDocId" LIKE 'oralevidence:%'
                            ORDER BY id LIMIT 1)`,
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus='committees-evidence' AND "parentDocId" LIKE 'oralevidence:%' AND speaker IS NOT NULL`,
  },
  {
    name: 'a miss stored as a blank string instead of NULL',
    corrupt: `UPDATE corpus_sections SET attribution = '   '
               WHERE id = (SELECT id FROM corpus_sections WHERE corpus='committees-evidence' ORDER BY id LIMIT 1)`,
    guard: `SELECT COUNT(*)::int n FROM corpus_sections
             WHERE corpus IN ('committees-evidence','committees-reports','tna-caselaw')
               AND (btrim(COALESCE(attribution,'x')) = ''
                 OR btrim(COALESCE(speaker,'x')) = ''
                 OR btrim(COALESCE("sectionTitle",'x')) = '')`,
  },
]

;(async () => {
  const pool = namesPool()
  const c = await pool.connect()
  let fired = 0
  try {
    for (const p of PROBES) {
      await c.query('BEGIN')
      try {
        const before = (await c.query(p.guard)).rows[0].n as number
        await c.query(p.corrupt)
        const after = (await c.query(p.guard)).rows[0].n as number
        const ok = before === 0 && after > before
        if (ok) fired++
        console.log(`  ${ok ? '✓ FIRED' : '✗ DID NOT FIRE'}  ${p.name}`)
        console.log(`             guard count before corruption ${before} → after ${after}`)
      } finally {
        await c.query('ROLLBACK')
      }
    }

    // ⚠ Demonstrate the rollback rather than assert it: re-read every guard on a FRESH statement
    // and show each is back to 0.
    console.log('\n  after rollback, every guard re-read:')
    for (const p of PROBES) {
      const n = (await c.query(p.guard)).rows[0].n
      console.log(`    ${n === 0 ? '✓' : '✗ STILL DIRTY'}  ${n}  ${p.name}`)
      if (n !== 0) process.exitCode = 1
    }
  } finally {
    c.release()
    await endNamesPool()
  }
  console.log(`\ncheck:names negative controls ${fired}/${PROBES.length} fired`)
  if (fired !== PROBES.length) process.exit(1)
})().catch(e => { console.error(e); process.exit(1) })
