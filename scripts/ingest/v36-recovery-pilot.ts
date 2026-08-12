/**
 * v36-recovery-pilot.ts — V36 §1/§2: measure the recovery rate on a RANDOM sample of
 * the class (b) instruments (`No CLML/HTML/PDF found on TNA`) before predicting a
 * whole-corpus re-run.
 *
 * Six hand-picked ids all recovered, but they were picked because they were the
 * biggest — exactly the sampling that makes a pilot agree with whoever chose it.
 * This draws at random, reports the rate with its denominator, and records every
 * failure with its reason so a non-recovery is a known unknown rather than a gap.
 *
 * Read-only: it fetches and counts. It writes nothing to R2 or the database.
 *
 * Usage: tsx v36-recovery-pilot.ts [--n 40] [--seed 1] [--type uksi]
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '500'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'

const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const N = Number(arg('n') ?? 40)
const SEED = Number(arg('seed') ?? 1)
const TYPE = arg('type')
const OUT = path.join(__dirname, 'v36', `recovery-pilot-${TYPE ?? 'all'}-n${N}.json`)

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })

  // setseed makes the draw reproducible: re-running quotes the same sample, so a
  // second measurement is a re-measurement and not a fresh lottery.
  await pool.query(`SELECT setseed($1)`, [Math.min(0.999999, SEED / 100)])
  const { rows: sample } = await pool.query(`
    WITH st AS (
      SELECT split_part(id, ':', 2) AS gid,
             min(corpus) AS corpus,
             count(*) FILTER (WHERE status='compiled')::int AS compiled,
             count(*) FILTER (WHERE status='unavailable' AND "errorMsg" = 'No CLML/HTML/PDF found on TNA')::int AS classb
      FROM corpus_sections WHERE corpus = ANY($1::text[]) GROUP BY 1
    )
    SELECT st.gid, st.corpus, ca.item_section_count, COALESCE(ca.title,'(untitled)') AS title
    FROM st LEFT JOIN corpus_acts ca ON ca.gid = st.gid
    WHERE st.classb > 0 AND st.compiled = 0
      AND ($2::text IS NULL OR split_part(st.gid,'/',1) = $2)
    ORDER BY random() LIMIT $3`, [LEG_CORPORA, TYPE, N])
  await pool.end()

  console.log(`[pilot] drawn ${sample.length} class-(b) instruments at random (seed ${SEED}${TYPE ? `, type ${TYPE}` : ''})\n`)

  const { enumerateSections } = await import('./sources/tna-legislation')
  const results: Record<string, unknown>[] = []
  let recovered = 0, stillEmpty = 0, threw = 0, sections = 0

  for (const row of sample) {
    const gid = row.gid as string
    const t = Date.now()
    try {
      const secs = await enumerateSections(gid)
      const usable = secs.filter(s => s.format !== 'unavailable' && s.format !== 'effects')
      const unavailable = secs.find(s => s.format === 'unavailable')
      if (usable.length > 0) { recovered++; sections += usable.length }
      else stillEmpty++
      results.push({
        gid, corpus: row.corpus, legacy_sections: row.item_section_count,
        usable: usable.length,
        formats: [...new Set(usable.map(s => s.format))],
        outcome: usable.length > 0 ? 'RECOVERED' : 'still-empty',
        reason: usable.length > 0 ? null : `${unavailable?.errorMsg ?? 'no sections returned'}${unavailable?.classifiedAs ? ` / ${unavailable.classifiedAs}` : ''}`,
        ms: Date.now() - t,
      })
    } catch (e) {
      threw++
      results.push({ gid, corpus: row.corpus, outcome: 'THREW', reason: String(e), ms: Date.now() - t })
    }
    const r = results[results.length - 1]
    console.log(`${String(gid).padEnd(20)} ${String(r.outcome).padEnd(11)} sections=${String(r.usable ?? 0).padStart(4)}  ${r.reason ?? ''}`)
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ seed: SEED, type: TYPE, n: sample.length, recovered, stillEmpty, threw, sections, results }, null, 1))

  const denom = sample.length
  console.log(`\n[pilot] RECOVERED ${recovered}/${denom} (${((recovered / denom) * 100).toFixed(1)}%)  still-empty ${stillEmpty}  threw ${threw}`)
  console.log(`[pilot] sections that would be written: ${sections.toLocaleString()} — mean ${(sections / Math.max(1, recovered)).toFixed(1)} per recovered instrument`)
  console.log(`[pilot] written to ${OUT}`)
}

main().catch(e => { console.error(e); process.exitCode = 1 })
