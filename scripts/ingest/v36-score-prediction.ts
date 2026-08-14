/**
 * v36-score-prediction.ts — score the V36 §2 recovery against the prediction recorded
 * BEFORE the seed, per the standing predict-measure-commit rule.
 *
 * The prediction lives in `docs/CHANGE_LOG.md`, entry "INGEST V36 §2 — THE RECOVERY
 * PREDICTION, recorded before the run (2026-08-12 23:10 UTC)". It is restated here so
 * the scoring is against what was actually claimed, not against a memory of it.
 *
 * ⚠ Read-only. Writes nothing, spends nothing.
 *
 * Usage: tsx v36-score-prediction.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

// The seed landed at 22:57 UTC on 12 Aug; everything after it belongs to this run.
const SEED_AT = '2026-08-12 22:57:00Z'

const PREDICTED = {
  instruments: 41_913,
  yieldingText: 7_868,
  sections: 45_636,
  sectionsRangeLo: 27_539,
  sectionsRangeHi: 232_115,
  wallClockH: 7.0,
}

function score(label: string, predicted: number, actual: number, unit = '') {
  const ratio = predicted === 0 ? NaN : actual / predicted
  const pct = ((ratio - 1) * 100)
  const dir = pct >= 0 ? '+' : ''
  console.log(
    `  ${label.padEnd(26)} predicted ${predicted.toLocaleString().padStart(9)}${unit}` +
      `   actual ${actual.toLocaleString().padStart(9)}${unit}   ${dir}${pct.toFixed(1)}%`
  )
}

async function main() {
  const pool = getNeonPool()

  const { rows: q } = await pool.query(`
    SELECT status, count(*)::int AS n FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' GROUP BY 1 ORDER BY 2 DESC`)
  console.log('final queue state:')
  for (const r of q) console.log(`  ${String(r.status).padEnd(9)} ${Number(r.n).toLocaleString()}`)

  // Wall clock: seed → last completion.
  const { rows: t } = await pool.query(`
    SELECT min("completedAt") AS first_done, max("completedAt") AS last_done,
           round(extract(epoch FROM max("completedAt") - timestamptz '${SEED_AT}') / 3600.0, 2) AS hours
      FROM ingest_queue
     WHERE "sourceType" = 'tna-legislation' AND status = 'done'`)

  // Output. `unavailable` is a RECORDED FACT about the instrument, not a section of
  // text — counting it as yield is how a run reports success for finding nothing.
  const { rows: s } = await pool.query(`
    SELECT count(*) FILTER (WHERE format <> 'unavailable' AND format <> 'effects')::int AS real_sections,
           count(*) FILTER (WHERE format =  'unavailable')::int                          AS unavailable_markers,
           count(*) FILTER (WHERE format =  'effects')::int                              AS effects_rows,
           count(*)::int                                                                 AS all_rows
      FROM corpus_sections
     WHERE "createdAt" >= timestamptz '${SEED_AT}'`)

  // Instruments that actually yielded text.
  // ⚠ NOT `sourceUrl` — that is per SECTION, so counting it distinct returns the row
  // count and reports every section as an instrument (a first pass here scored
  // "instruments with text" at +833% off exactly that mistake). The instrument is the
  // R2 key prefix: `{legislationGovUkId}/sections/{N}.xml`.
  const { rows: y } = await pool.query(`
    SELECT count(DISTINCT split_part("r2Key", '/sections/', 1))
             FILTER (WHERE format <> 'unavailable' AND format <> 'effects')::int AS with_text,
           count(DISTINCT split_part("r2Key", '/sections/', 1))::int             AS touched
      FROM corpus_sections
     WHERE "createdAt" >= timestamptz '${SEED_AT}' AND "r2Key" IS NOT NULL`)

  const { rows: sample } = await pool.query(`
    SELECT "r2Key", "sourceUrl" FROM corpus_sections
     WHERE "createdAt" >= timestamptz '${SEED_AT}' AND "r2Key" IS NOT NULL LIMIT 2`)
  console.log('\nkey shape check (so the instrument count is auditable):')
  for (const r of sample) console.log(`  r2Key=${r.r2Key}\n    → instrument ${String(r.r2Key).split('/sections/')[0]}`)

  const { rows: fmt } = await pool.query(`
    SELECT format, count(*)::int AS n FROM corpus_sections
     WHERE "createdAt" >= timestamptz '${SEED_AT}' GROUP BY 1 ORDER BY 2 DESC`)

  console.log(`\nwall clock: ${t[0].hours} h  (seed ${SEED_AT} → last completion ${t[0].last_done?.toISOString?.() ?? t[0].last_done})`)

  console.log('\nSCORED AGAINST THE PRE-RUN PREDICTION:')
  score('instruments seeded', PREDICTED.instruments, q.reduce((a: number, r: any) => a + Number(r.n), 0))
  score('instruments with text', PREDICTED.yieldingText, Number(y[0].with_text))
  score('sections of real text', PREDICTED.sections, Number(s[0].real_sections))
  score('wall clock (h)', PREDICTED.wallClockH, Number(t[0].hours), ' h')
  console.log(
    `\n  the pre-run section RANGE was ${PREDICTED.sectionsRangeLo.toLocaleString()}–${PREDICTED.sectionsRangeHi.toLocaleString()} — ` +
      `actual ${Number(s[0].real_sections).toLocaleString()} is ` +
      `${Number(s[0].real_sections) >= PREDICTED.sectionsRangeLo && Number(s[0].real_sections) <= PREDICTED.sectionsRangeHi ? 'INSIDE it' : 'OUTSIDE it'}`
  )

  console.log(`\noutput written since the seed:`)
  console.log(`  real text sections    ${Number(s[0].real_sections).toLocaleString()}`)
  console.log(`  unavailable markers   ${Number(s[0].unavailable_markers).toLocaleString()}   (a recorded fact, NOT yield)`)
  console.log(`  effects rows          ${Number(s[0].effects_rows).toLocaleString()}`)
  console.log(`  all rows              ${Number(s[0].all_rows).toLocaleString()}`)
  console.log(`  instruments touched   ${Number(y[0].touched).toLocaleString()}   of which with text ${Number(y[0].with_text).toLocaleString()}`)

  console.log('\nby format:')
  for (const r of fmt) console.log(`  ${String(r.format).padEnd(16)} ${Number(r.n).toLocaleString()}`)

  await endNeonPool()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
