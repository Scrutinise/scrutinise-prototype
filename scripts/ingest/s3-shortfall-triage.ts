/**
 * s3-shortfall-triage.ts — are the DROP's 5,106 "shortfalls" real losses, or dot leaders?
 *
 * `s3-drop-readiness.ts` finds 5,106 instruments where `corpus_sections` holds fewer
 * rows than `LegislationSection`, ~37,154 sections behind. Read naively that blocks the
 * drop. But V36 DELIBERATELY retracted dot-leader placeholders — `1 . . . . . . .` is how
 * the source renders a REPEALED provision, 11.44% of the corpus by the completed census —
 * so for any instrument with repealed provisions the corpus SHOULD hold fewer rows than
 * a legacy table that counted the placeholders as sections.
 *
 * A raw row-count comparison cannot tell "we lost text" from "we correctly stopped
 * storing nothing". This reads the actual legacy rows that have no corpus counterpart
 * and asks what they CONTAIN.
 *
 *   dot-leader / empty   → the corpus is RIGHT to be short. Not a blocker.
 *   real text            → a genuine loss. Blocks the drop.
 *
 * Read-only.
 *
 * Usage: tsx s3-shortfall-triage.ts [--instruments 40]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const N_INST = (() => { const i = process.argv.indexOf('--instruments'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 40 })()
const n = (v: any) => Number(v).toLocaleString('en-GB')

// The census's own test: a section whose text is dot leaders and punctuation only.
const isDotLeader = (s: string | null) => {
  if (!s) return true
  const stripped = s.replace(/[\s.·…]/g, '')
  return stripped.length < 12
}

async function main() {
  const pool = getNeonPool()

  // Instruments where legacy has more rows than the corpus (direct id only — the
  // twin-rescued ones are handled by the readiness script; here we want a sample whose
  // legacy rows we can read).
  const { rows: shorts } = await pool.query(`
    WITH legacy AS (
      SELECT li."legislationGovUkId" AS gid, li.id AS item_id, count(*)::int AS legacy_sections
        FROM "LegislationSection" ls
        JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
       GROUP BY 1, 2
    ), corpus AS (
      SELECT split_part(id, ':', 2) AS gid, count(*)::int AS corpus_sections
        FROM corpus_sections GROUP BY 1
    )
    SELECT l.gid, l.item_id, l.legacy_sections, COALESCE(c.corpus_sections, 0) AS corpus_sections
      FROM legacy l JOIN corpus c ON c.gid = l.gid
     WHERE c.corpus_sections < l.legacy_sections
     ORDER BY (l.legacy_sections - c.corpus_sections) DESC
     LIMIT $1`, [N_INST])

  console.log(`sampling ${shorts.length} of the worst shortfall instruments\n`)

  let totalOrphan = 0, totalDot = 0, totalReal = 0
  const realExamples: string[] = []

  for (const s of shorts) {
    // Legacy section numbers for this instrument, and the corpus's section refs.
    const { rows: legacyRows } = await pool.query(
      `SELECT "sectionNumber", "originalText" FROM "LegislationSection" WHERE "legislationItemId" = $1`, [s.item_id])
    const { rows: corpusRows } = await pool.query(
      `SELECT id FROM corpus_sections WHERE split_part(id, ':', 2) = $1`, [s.gid])

    // corpus id tail: `…:section-12` / `…:regulation-3` → pull the trailing number.
    const corpusNums = new Set<string>()
    for (const c of corpusRows) {
      const tail = String(c.id).split(':').pop() ?? ''
      const m = tail.match(/([0-9]+[A-Za-z]*)$/)
      if (m) corpusNums.add(m[1].toLowerCase())
    }

    const orphans = legacyRows.filter((l: any) => !corpusNums.has(String(l.sectionNumber).toLowerCase()))
    const dot = orphans.filter((l: any) => isDotLeader(l.originalText))
    const real = orphans.filter((l: any) => !isDotLeader(l.originalText))
    totalOrphan += orphans.length; totalDot += dot.length; totalReal += real.length

    if (real.length && realExamples.length < 12) {
      const ex = real[0]
      realExamples.push(`${s.gid} s.${ex.sectionNumber}: "${String(ex.originalText).replace(/\s+/g, ' ').slice(0, 90)}"`)
    }
    console.log(`  ${String(s.gid).padEnd(24)} legacy ${String(s.legacy_sections).padStart(5)} corpus ${String(s.corpus_sections).padStart(5)} · orphans ${String(orphans.length).padStart(4)} = dot ${String(dot.length).padStart(4)} + REAL ${real.length}`)
  }

  const pctDot = totalOrphan ? (totalDot / totalOrphan) * 100 : 0
  console.log(`\n════ WHAT THE SHORTFALL ACTUALLY IS ════`)
  console.log(`  legacy rows with no corpus counterpart : ${n(totalOrphan)}`)
  console.log(`  of which dot-leader / empty            : ${n(totalDot)} (${pctDot.toFixed(1)}%)  ← corpus is RIGHT to be short`)
  console.log(`  of which REAL TEXT                     : ${n(totalReal)} (${(100 - pctDot).toFixed(1)}%)  ← genuine loss, blocks the drop`)
  if (realExamples.length) {
    console.log(`\n  examples of real text present in legacy and absent from the corpus:`)
    for (const e of realExamples) console.log(`    ${e}`)
  }

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
