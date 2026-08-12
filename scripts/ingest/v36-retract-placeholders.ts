/**
 * v36-retract-placeholders.ts — flip already-stored dot-leader sections from
 * `compiled` to a recorded `revoked` marker.
 *
 * The fix in process-row.ts stops NEW ingests storing a repealed provision's dot
 * leaders as text. It cannot repair what is already stored, because
 * `processTnaLegislation` short-circuits on `r2Exists(compiledKey)` before it reaches
 * the check — a re-run skips the instrument entirely. So the retro-fix is its own
 * pass, and this is it.
 *
 * It reads the R2 object for each candidate rather than trusting `wordCount`: a
 * dot-leader section and a terse real one look identical in the column.
 *
 * Rows are NOT deleted. They become `status='unavailable'`,
 * `availability_status='revoked'` with a note — out of the chunker, the FTS build and
 * the embed, but still a record that the provision exists and was repealed. Known
 * unknowns beat silent absences.
 *
 * Usage:
 *   tsx v36-retract-placeholders.ts --since 6h          # report only
 *   tsx v36-retract-placeholders.ts --since 6h --apply
 *   tsx v36-retract-placeholders.ts --gid uksi/1999/303 --apply
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'
import { isRepealedPlaceholder } from './shared/compile'

const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu']

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const APPLY = process.argv.includes('--apply')
const SINCE = arg('since')
const GID = arg('gid')
const SAMPLE = arg('sample')

const NOTE = 'legislation.gov.uk publishes this provision as repealed — the revised text is a dot-leader placeholder, not words.'

async function main() {
  if (!SINCE && !GID && !SAMPLE) throw new Error('pass --since <interval>, --gid <gid> or --sample <n>')
  const pool = getNeonPool()

  // --sample: how much of the corpus ALREADY indexed is dot leaders? These rows
  // predate the fix, are chunked, embedded and retrievable, and nothing has ever
  // looked at their content. Report-only by construction — a random sample is an
  // estimate, and flipping rows off an estimate would be the opposite of the
  // discipline this sprint is about.
  if (SAMPLE) {
    await pool.query(`SELECT setseed(0.5)`)
    const { rows: sample } = await pool.query(
      `SELECT id, corpus, "r2Key", "wordCount" FROM corpus_sections
       WHERE status='compiled' AND "r2Key" IS NOT NULL AND corpus = ANY($1::text[])
       ORDER BY random() LIMIT $2`, [LEG_CORPORA, Number(SAMPLE)])
    let hits = 0, read = 0
    const byCorpus = new Map<string, { n: number; d: number }>()
    for (const s of sample) {
      const body = await r2Get(s.r2Key as string)
      if (body === null) continue
      read++
      const isPh = isRepealedPlaceholder(body)
      if (isPh) hits++
      const e = byCorpus.get(s.corpus) ?? { n: 0, d: 0 }
      e.n++; if (isPh) e.d++
      byCorpus.set(s.corpus, e)
    }
    console.log(`\n[sample] ${read} random compiled legislation sections read from R2`)
    for (const [c, e] of [...byCorpus.entries()].sort((a, b) => b[1].n - a[1].n)) {
      console.log(`  ${c.padEnd(24)} ${String(e.d).padStart(4)}/${String(e.n).padEnd(5)} ${((100 * e.d) / e.n).toFixed(1)}%`)
    }
    const pct = read ? (100 * hits) / read : 0
    console.log(`[sample] ${hits}/${read} are dot-leader placeholders = ${pct.toFixed(2)}%`)
    console.log(`[sample] extrapolated over 1,760,981 compiled legislation sections: ~${Math.round((pct / 100) * 1_760_981).toLocaleString()}`)
    console.log(`[sample] REPORT ONLY — an estimate is not grounds for flipping rows.`)
    await endNeonPool()
    return
  }

  const { rows: candidates } = GID
    ? await pool.query(
        `SELECT id, corpus, "r2Key" FROM corpus_sections
         WHERE status='compiled' AND "r2Key" IS NOT NULL AND corpus = ANY($1::text[])
           AND (id LIKE 'si-pre-2010:' || $2 || ':%' OR id LIKE 'si-2010plus:' || $2 || ':%'
             OR id LIKE 'primary-acts-pre-2000:' || $2 || ':%' OR id LIKE 'primary-acts-2000plus:' || $2 || ':%'
             OR id LIKE 'regional:' || $2 || ':%' OR id LIKE 'retained-eu:' || $2 || ':%')
         ORDER BY id`, [LEG_CORPORA, GID])
    : await pool.query(
        `SELECT id, corpus, "r2Key" FROM corpus_sections
         WHERE status='compiled' AND "r2Key" IS NOT NULL AND corpus = ANY($1::text[])
           AND "compiledAt" > NOW() - $2::interval
         ORDER BY id`, [LEG_CORPORA, SINCE])

  console.log(`[retract] ${candidates.length.toLocaleString()} compiled sections to inspect`)

  const hits: { id: string; corpus: string }[] = []
  let read = 0
  for (const c of candidates) {
    const body = await r2Get(c.r2Key as string)
    read++
    if (body !== null && isRepealedPlaceholder(body)) hits.push({ id: c.id, corpus: c.corpus })
    if (read % 200 === 0) console.log(`[retract] …${read}/${candidates.length} read, ${hits.length} placeholders`)
  }

  console.log(`\n[retract] ${hits.length} of ${read} sections are dot-leader placeholders (${read ? ((100 * hits.length) / read).toFixed(1) : 0}%)`)
  const byInstrument = new Map<string, number>()
  for (const h of hits) {
    const gid = h.id.split(':')[1]
    byInstrument.set(gid, (byInstrument.get(gid) ?? 0) + 1)
  }
  for (const [gid, n] of [...byInstrument.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${gid.padEnd(24)} ${n}`)
  }

  if (!APPLY) { console.log('\n[retract] REPORT ONLY — re-run with --apply to flip these rows.'); await endNeonPool(); return }
  if (!hits.length) { console.log('\n[retract] nothing to do.'); await endNeonPool(); return }

  const res = await pool.query(
    `UPDATE corpus_sections
     SET status = 'unavailable', format = 'unavailable',
         availability_status = 'revoked', availability_note = $2,
         "errorMsg" = 'repealed placeholder (dot-leader text in revised CLML)',
         "wordCount" = 0
     WHERE id = ANY($1::text[])`, [hits.map(h => h.id), NOTE])
  console.log(`\n[retract] flipped ${res.rowCount} rows to unavailable/revoked`)

  // Read back: an UPDATE's rowCount says the statement ran, not that the table now
  // says what we think it says.
  const { rows: [after] } = await pool.query(
    `SELECT count(*) FILTER (WHERE status='compiled')::int AS still_compiled,
            count(*) FILTER (WHERE availability_status='revoked')::int AS revoked
     FROM corpus_sections WHERE id = ANY($1::text[])`, [hits.map(h => h.id)])
  console.log(`[retract] verified: ${after.revoked} now revoked, ${after.still_compiled} still compiled`)
  if (after.still_compiled > 0) process.exitCode = 1
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
