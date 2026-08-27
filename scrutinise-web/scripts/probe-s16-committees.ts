/**
 * probe-s16-committees.ts — S16 §3.3. COMMITTEES IS 2 OF 10 AND IT IS OUR LARGEST EVIDENCE
 * COLLECTION. WHY?
 *
 * The brief: *"It has a dense leg and real questions and still finds almost nothing. Probe five of
 * its failures individually. A collection this size performing this badly is either a retrieval
 * defect or a question-set defect, and both are worth knowing."*
 *
 * ⚠⚠ THE DECISIVE PROBE IS NOT "search again and see". It is: **can the index find the answer key
 * when we hand it the key's OWN WORDS?** That separates the two candidate causes cleanly:
 *
 *   · If searching the document's own title/text DOES return it → the document is indexed and
 *     retrievable, and the router's query simply does not match it. A RETRIEVAL/QUERY defect,
 *     and the fix is on our side.
 *   · If searching the document's own words does NOT return it → the row is in `corpus_sections`
 *     but is not findable through the serving path at all. An INDEX or SCOPE defect, and no query
 *     rewriting will ever reach it.
 *
 * ⚠ Every line states what it counted: the rank the key came back at, out of how many results,
 * for a query of stated provenance. "Not found" means absent from N returned ids, never inferred.
 *
 * Usage:
 *   tsx --env-file=.env --tsconfig tsconfig.json scripts/probe-s16-committees.ts [--collection committees] [--n 5]
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { streams } from '../lib/lex/query-router'

const AUTOPSY = path.join(__dirname, '../../docs/census/s16-autopsy.json')
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const COLLECTION = arg('collection', 'committees')
const N = parseInt(arg('n', '5'), 10)

async function main() {
  const autopsy = JSON.parse(fs.readFileSync(AUTOPSY, 'utf8'))
  const rows = (autopsy.rows as any[]).filter((r) => r.collection === COLLECTION).slice(0, N)
  console.log(`── S16 §3.3 — ${COLLECTION}, ${rows.length} failures probed individually ──`)
  console.log(`  source ${path.basename(AUTOPSY)} · config ${autopsy.sourceConfig}\n`)

  const stream = streams().find((s) => s.name === COLLECTION)
  if (!stream) { console.error(`no stream named '${COLLECTION}'`); process.exit(2) }

  for (const r of rows) {
    const meta = await prisma.$queryRaw<Array<{ id: string; sectionTitle: string | null; words: number | null; r2Key: string | null; sourceUrl: string | null }>>`
      SELECT id, "sectionTitle", "wordCount" AS words, "r2Key", "sourceUrl"
      FROM corpus_sections WHERE id = ${r.key}`
    const m = meta[0]
    console.log(`  ${r.id}  ${r.cls}${r.unitModifier ? '  ⚠ unit' : ''}`)
    console.log(`    question : ${r.question}`)
    console.log(`    key      : ${r.key}`)
    console.log(`    title    : ${JSON.stringify(m?.sectionTitle ?? null)}`)
    console.log(`    words    : ${m?.words ?? '(none)'}   r2Key ${m?.r2Key ? 'present' : 'MISSING'}`)

    // PROBE 1 — the key's OWN TITLE as the query. If the index cannot find a document by its own
    // title, no rewriting of the user's question ever will.
    const title = (m?.sectionTitle ?? '').trim()
    if (title) {
      const hits = await stream.search(title, 60).catch((e) => { console.log(`    ⚠ probe failed: ${(e as Error).message}`); return [] })
      const rank = hits.findIndex((h) => h.id === r.key)
      console.log(`    PROBE own-title  → ${rank >= 0 ? `FOUND at rank ${rank + 1}` : 'NOT FOUND'} of ${hits.length} returned`)
      console.log(`      query: ${JSON.stringify(title.slice(0, 90))}`)
    } else {
      console.log('    PROBE own-title  → ⚠ SKIPPED: the row has no sectionTitle to search by')
    }

    // PROBE 2 — the user's question verbatim, unrouted, against the same stream. Separates "the
    // router's rewrite hurt" from "this stream cannot find it however you ask".
    const hits2 = await stream.search(r.question, 60).catch(() => [])
    const rank2 = hits2.findIndex((h) => h.id === r.key)
    console.log(`    PROBE raw-question → ${rank2 >= 0 ? `FOUND at rank ${rank2 + 1}` : 'NOT FOUND'} of ${hits2.length} returned`)
    console.log('')
  }

  // ⚠ HOW BIG IS THE HAYSTACK? A collection this size failing could simply be dilution, and that
  // is a different finding from a defect. Counted, not assumed.
  const size = await prisma.$queryRaw<Array<{ corpus: string; n: bigint }>>`
    SELECT corpus, count(*) AS n FROM corpus_sections
    WHERE corpus LIKE 'committees%' GROUP BY corpus ORDER BY n DESC`
  console.log('  ── the haystack ──')
  for (const s of size) console.log(`    ${s.corpus.padEnd(28)} ${Number(s.n).toLocaleString()} sections`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
