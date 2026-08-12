/**
 * v36-dotrot-check.ts — how much of what the recovery writes is dot-leaders?
 *
 * legislation.gov.uk renders a REPEALED provision in the revised CLML as literal
 * ". . . . . . . ." — so uksi/1999/303 ingested as 137 sections / 4,521 "words",
 * every one of them dots. The pipeline is faithful; the corpus is not improved. A
 * chunk of dots is embedded at full price and retrievable as a document that says
 * nothing, which is the same shape as the placeholder-that-looked-like-data.
 *
 * Measures the whole legislation corpus, not just the instrument that surfaced it,
 * so the decision rests on the size of the class.
 *
 * The signature: a dot-leader section is a run of single-character "words", so
 * `wordCount` is high relative to a tiny compiled body. Nothing in the DB holds the
 * text, so the R2 object is read for the candidates.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu']

/** True when the compiled body is punctuation and digits only — no word carries two
 *  or more letters. Deliberately strict: "1 . . . ." must match, "1 This Order may"
 *  must not. */
function isDotLeader(text: string): boolean {
  const stripped = text.replace(/[\s.·…,;:()\[\]0-9-]/g, '')
  return stripped.length === 0
}

async function main() {
  const pool = getNeonPool()

  // corpus is carried through so the per-instrument lookup below can use a
  // PREFIX-anchored LIKE (`si-pre-2010:uksi/1999/303:%`) and ride the primary key.
  // A leading-wildcard `%:gid:%` forces a full scan of a 15M-row table and times out
  // — which it did, on the first version of this script.
  const { rows: written } = await pool.query(`
    SELECT split_part(id, ':', 2) AS gid, min(corpus) AS corpus, count(*)::int AS sections,
           sum("wordCount")::int AS words
    FROM corpus_sections
    WHERE corpus = ANY($1::text[]) AND status = 'compiled'
      AND "compiledAt" > NOW() - INTERVAL '4 hours'
    GROUP BY 1 ORDER BY 2 DESC`, [LEG_CORPORA])
  console.log(`\ninstruments written by the V36 pilots in the last 4 hours: ${written.length}`)

  let dotSections = 0, realSections = 0, dotInstruments = 0
  for (const w of written) {
    const { rows: secs } = await pool.query(
      `SELECT id, "r2Key", "wordCount" FROM corpus_sections
       WHERE id LIKE $1 AND status='compiled'
       ORDER BY id LIMIT 40`, [`${w.corpus}:${w.gid}:%`])
    let d = 0, r = 0
    for (const s of secs) {
      if (!s.r2Key) continue
      const body = await r2Get(s.r2Key)
      const text = body ?? ''
      if (isDotLeader(text)) d++; else r++
    }
    dotSections += d; realSections += r
    if (d > 0 && r === 0) dotInstruments++
    console.log(`  ${String(w.gid).padEnd(18)} ${String(w.sections).padStart(4)} sections  sampled ${(d + r).toString().padStart(3)}: ` +
      `${String(d).padStart(3)} dot-leader · ${String(r).padStart(3)} real${d > 0 && r === 0 ? '   ← ENTIRELY dots' : ''}`)
  }

  const total = dotSections + realSections
  console.log(`\n[dotrot] sampled ${total} sections across ${written.length} instruments: ` +
    `${dotSections} dot-leader (${total ? ((100 * dotSections) / total).toFixed(1) : 0}%), ${realSections} real`)
  console.log(`[dotrot] instruments that are ENTIRELY dot-leaders: ${dotInstruments}/${written.length}`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
