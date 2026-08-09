/**
 * v33-probe-refs.ts — READ-ONLY. What do the ids of the truncated legislation rows look like?
 *
 * A re-sectioning pass changes ids (`…:1` → `…:1-0001`). `gateway-legacy.ts`
 * (`refFromId` / `sectionNumberFromRef`) parses the ref into the user-facing "s.21" and the
 * legislation.gov.uk deep link, so a suffix on a real provision reference is a visible
 * regression while a suffix on a whole-document ref (`:1`, `:full`) is not. This establishes
 * which rows are which before anything is written.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'
export {}

const LEG = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus',
  'regional', 'retained-eu', 'eur-lex', 'explanatory-notes', 'explanatory-memoranda']
const UK = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu']
const n = (v: number | string) => Number(v).toLocaleString('en-GB')

async function main() {
  const p = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 1_800_000 })

  console.log('=== ref shape of the truncated rows, by corpus ===')
  const { rows } = await p.query(
    `SELECT corpus,
            CASE
              WHEN split_part(id, ':', 3) = '' THEN '(2-part id)'
              WHEN id ~ ':(full|full-doc-html)$' THEN 'full'
              WHEN id ~ ':[0-9]+$' THEN 'bare-number'
              WHEN id ~ ':(section|regulation|article|rule|paragraph)-[0-9]+[A-Za-z]*$' THEN 'provision-ref'
              ELSE 'other'
            END AS shape,
            count(*)::int AS rows, coalesce(sum("wordCount"),0)::bigint AS words
       FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled' AND "wordCount" > 3666
      GROUP BY 1,2 ORDER BY 1, 3 DESC`, [LEG])
  for (const r of rows) console.log(`  ${String(r.corpus).padEnd(24)} ${String(r.shape).padEnd(14)} rows=${n(r.rows).padStart(6)} words=${n(r.words)}`)

  console.log('\n=== sample ids from the UK CLML corpora (the 385 out-of-scope candidates) ===')
  const { rows: s } = await p.query(
    `SELECT id, corpus, "wordCount" FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled' AND "wordCount" > 3666
      ORDER BY "wordCount" DESC LIMIT 25`, [UK])
  for (const r of s) console.log(`  ${n(r.wordCount).padStart(8)}w  ${r.id}`)

  console.log('\n=== id samples for the three in-scope corpora ===')
  for (const c of ['eur-lex', 'explanatory-notes', 'explanatory-memoranda']) {
    const { rows: x } = await p.query(
      `SELECT id, "wordCount", "parentDocId" FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND "wordCount" > 3666 ORDER BY md5(id) LIMIT 5`, [c])
    for (const r of x) console.log(`  ${String(c).padEnd(22)} ${String(r.id).padEnd(46)} ${n(r.wordCount).padStart(8)}w parent=${r.parentDocId ?? 'NULL'}`)
  }

  console.log('\n=== any id in the whole legislation tier already carrying a -NNNN suffix? ===')
  const { rows: dup } = await p.query(
    `SELECT corpus, count(*)::int AS rows FROM corpus_sections
      WHERE corpus = ANY($1) AND id ~ '-[0-9]{4}$' GROUP BY 1`, [LEG])
  console.log(dup.length ? dup.map(r => `  ${r.corpus}: ${n(r.rows)}`).join('\n') : '  none — the -NNNN suffix is free to use as the re-section marker')

  await p.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
