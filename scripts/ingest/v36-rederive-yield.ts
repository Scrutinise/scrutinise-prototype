/**
 * v36-rederive-yield.ts — the pilot's yield, recomputed AFTER the dot-leader
 * retraction, from the database rather than from arithmetic on the earlier report.
 *
 * The 1987+ pilot reported 12/12 recovered and a mean of 16.9 sections. Both figures
 * were inflated by uksi/1999/303, which contributed 137 of the 203 sections and every
 * one of them was a repealed provision's dot leaders. With those rows retracted the
 * instrument holds nothing, so it is no longer a recovery at all — and the mean it
 * was carrying has to go with it.
 *
 * This is the number `v36-seed-recovery.ts` must predict from. Reading it back out of
 * corpus_sections is the point: the earlier figure came from a counter, and a counter
 * cannot know that what it counted was dots.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu']

async function main() {
  const pool = getNeonPool()
  const { rows } = await pool.query(`
    SELECT split_part(id, ':', 2) AS gid,
           count(*) FILTER (WHERE status='compiled')::int AS real_sections,
           count(*) FILTER (WHERE availability_status='revoked')::int AS retracted,
           count(*) FILTER (WHERE status='unavailable' AND availability_status <> 'revoked')::int AS other_unavailable,
           sum("wordCount") FILTER (WHERE status='compiled')::int AS words
    FROM corpus_sections
    WHERE corpus = ANY($1::text[])
      AND ("compiledAt" > NOW() - INTERVAL '6 hours' OR "createdAt" > NOW() - INTERVAL '6 hours')
    GROUP BY 1 ORDER BY 2 DESC, 1`, [LEG_CORPORA])

  console.log(`\ninstruments touched by the V36 pilots: ${rows.length}\n`)
  console.log('gid                       real  retracted  other-unavail   words')
  for (const r of rows) {
    console.log(`${String(r.gid).padEnd(24)} ${String(r.real_sections).padStart(5)}  ` +
      `${String(r.retracted).padStart(9)}  ${String(r.other_unavailable).padStart(13)}  ${String(r.words ?? 0).padStart(6)}`)
  }

  const withText = rows.filter(r => r.real_sections > 0)
  const totalReal = rows.reduce((a, r) => a + r.real_sections, 0)
  const totalRetracted = rows.reduce((a, r) => a + r.retracted, 0)

  console.log(`\n[yield] instruments touched      : ${rows.length}`)
  console.log(`[yield] instruments WITH real text: ${withText.length}`)
  console.log(`[yield] real sections            : ${totalReal.toLocaleString()}`)
  console.log(`[yield] retracted as dot leaders : ${totalRetracted.toLocaleString()}`)
  console.log(`[yield] mean real sections per instrument with text: ${(totalReal / Math.max(1, withText.length)).toFixed(1)}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
