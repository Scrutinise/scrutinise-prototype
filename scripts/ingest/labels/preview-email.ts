/**
 * preview-email.ts — render the daily ingest email against the LIVE database, and do not send it.
 *
 * ⚠ WHY THIS EXISTS AT ALL. Until today the only way to see this email was to receive it. That is
 * how `[100% complete]` — printed against a denominator copied from its own numerator — survived
 * in it for two months. A report nobody can render is a report nobody reviews.
 *
 * Reads the same inputs `ops.ts` passes at 08:00 and calls `buildProgressEmail`, which is the
 * function that actually builds what gets sent. It does not construct its own copy of the body:
 * a preview that re-implements the email is a preview of something else.
 *
 * Usage: tsx labels/preview-email.ts [--out path]
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { buildProgressEmail, queryDbSize } from '../shared/progress-reporter'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

const OUT = (() => { const i = process.argv.indexOf('--out'); return i >= 0 ? process.argv[i + 1] : null })()

async function main() {
  const pool = getNeonPool()
  const { rows } = await pool.query<{ corpus: string; compiled: string; failed: string }>(`
    SELECT corpus, count(*) FILTER (WHERE status='compiled')::text compiled,
           count(*) FILTER (WHERE status='failed')::text failed
      FROM corpus_sections GROUP BY 1`)
  const corpusCounts: Record<string, { compiled: number; failed: number }> = {}
  for (const r of rows) corpusCounts[r.corpus] = { compiled: Number(r.compiled), failed: Number(r.failed) }

  const { rows: legacy } = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM "LegislationSection"`)
  const dbSize = await queryDbSize().catch(() => undefined)

  // C3 Lane B2/B4 — the usable-text subtraction. Measured, not passed as a constant, so the line
  // tracks the table rather than a number somebody typed in once.
  const { rows: hollow } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM section_repeals WHERE evidence = 'dot-leader-placeholder'`)
  const { rows: partial } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM section_repeals WHERE evidence = 'partial-dot-leader'`)

  const { subject, body } = await buildProgressEmail({
    timestamp: new Date(),
    corpusCounts,
    neonCount: Number(legacy[0].n),
    dbSize,
    hollowSections: Number(hollow[0].n),
    // ⚠ 0 until b3-backfill-partial.ts runs. Passed anyway rather than omitted, because omitting
    //   it prints nothing and a reader cannot tell "none yet" from "nobody looked".
    partiallyRepealedSections: Number(partial[0].n),
  })

  await endNeonPool()

  const text = `SUBJECT: ${subject}\n\n${body}\n`
  if (OUT) { fs.writeFileSync(OUT, text); console.log(`written → ${OUT} (${text.length} chars)`) }
  else console.log(text)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
