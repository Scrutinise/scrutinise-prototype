/**
 * v33-probe-pathological.ts — READ-ONLY. What exactly are the legislation-tier rows that hold a
 * whole document, and what internal structure do their bodies have?
 *
 * §1 of the V33 brief says "re-section each into its natural sub-units — eur-lex by
 * article/recital, explanatory notes by their own document structure". Before writing a splitter
 * this has to establish, from the real bytes and not from the format name:
 *   (a) how many rows are in scope, and how they distribute by corpus and size,
 *   (b) whether a document is genuinely one row (sections-per-parent = 1),
 *   (c) what the bodies actually look like — the structure signal a splitter can key on.
 *
 * Nothing is written. Usage: tsx v33-probe-pathological.ts [--samples N]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { Pool } from 'pg'
import { r2Get } from './shared/r2-client'

export {}

const SAMPLES = (() => { const i = process.argv.indexOf('--samples'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 8 })()
const LEG = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus',
  'regional', 'retained-eu', 'eur-lex', 'explanatory-notes', 'explanatory-memoranda']

const n = (v: number | string) => Number(v).toLocaleString('en-GB')

function pool(): Pool {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set')
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 1_800_000 })
}

async function main() {
  const p = pool()

  console.log('=== A. legislation tier: rows, words, sections-per-parent ===')
  const { rows: a } = await p.query(
    `SELECT corpus,
            count(*)::int                                   AS rows,
            coalesce(sum("wordCount"),0)::bigint            AS words,
            count(DISTINCT "parentDocId")::int              AS parents,
            percentile_disc(0.5) WITHIN GROUP (ORDER BY "wordCount")::int AS median_wc,
            max("wordCount")::int                           AS max_wc,
            count(*) FILTER (WHERE "wordCount" > 3666)::int AS over_cap
       FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled'
      GROUP BY corpus ORDER BY 3 DESC`, [LEG])
  for (const r of a) {
    console.log(`  ${String(r.corpus).padEnd(24)} rows=${n(r.rows).padStart(9)} words=${n(r.words).padStart(12)} parents=${n(r.parents).padStart(8)} medianWC=${n(r.median_wc).padStart(7)} maxWC=${n(r.max_wc).padStart(9)} >cap=${n(r.over_cap).padStart(7)}`)
  }

  console.log('\n=== B. "whole document in one row": parents with exactly ONE section ===')
  const { rows: b } = await p.query(
    `WITH per AS (
       SELECT corpus, "parentDocId", count(*)::int AS secs, sum("wordCount")::bigint AS words
         FROM corpus_sections WHERE corpus = ANY($1) AND status='compiled' AND "parentDocId" IS NOT NULL
        GROUP BY 1,2)
     SELECT corpus,
            count(*) FILTER (WHERE secs = 1)::int                              AS single_parents,
            count(*) FILTER (WHERE secs = 1 AND words > 3666)::int             AS single_over_cap,
            coalesce(sum(words) FILTER (WHERE secs = 1 AND words > 3666),0)::bigint AS single_over_cap_words,
            max(words) FILTER (WHERE secs = 1)::bigint                         AS max_single_words
       FROM per GROUP BY 1 ORDER BY 3 DESC`, [LEG])
  for (const r of b) {
    console.log(`  ${String(r.corpus).padEnd(24)} 1-section parents=${n(r.single_parents).padStart(8)}  of which >cap=${n(r.single_over_cap).padStart(7)}  words=${n(r.single_over_cap_words ?? 0).padStart(12)}  maxWords=${n(r.max_single_words ?? 0).padStart(9)}`)
  }

  console.log('\n=== C. the candidate set: legislation-tier rows over the ~3,666-word cap ===')
  const { rows: c } = await p.query(
    `SELECT corpus, count(*)::int AS rows, coalesce(sum("wordCount"),0)::bigint AS words,
            percentile_disc(0.5) WITHIN GROUP (ORDER BY "wordCount")::int AS median_wc
       FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled' AND "wordCount" > 3666
      GROUP BY 1 ORDER BY 2 DESC`, [LEG])
  let tot = 0, totW = 0
  for (const r of c) { tot += r.rows; totW += Number(r.words)
    console.log(`  ${String(r.corpus).padEnd(24)} rows=${n(r.rows).padStart(7)} words=${n(r.words).padStart(12)} medianWC=${n(r.median_wc)}`)
  }
  console.log(`  ${'TOTAL'.padEnd(24)} rows=${n(tot).padStart(7)} words=${n(totW).padStart(12)}`)

  console.log('\n=== D. format / sourceUrl shape of the candidate set ===')
  const { rows: d } = await p.query(
    `SELECT corpus, coalesce(format,'(null)') AS format, count(*)::int AS rows
       FROM corpus_sections WHERE corpus = ANY($1) AND status='compiled' AND "wordCount" > 3666
      GROUP BY 1,2 ORDER BY 1,3 DESC`, [LEG])
  for (const r of d) console.log(`  ${String(r.corpus).padEnd(24)} format=${String(r.format).padEnd(8)} rows=${n(r.rows)}`)

  console.log('\n=== E. worst rows, with ids and sourceUrls ===')
  const { rows: e } = await p.query(
    `SELECT id, corpus, "wordCount", "sectionTitle", "sourceUrl", "r2Key", format
       FROM corpus_sections WHERE corpus = ANY($1) AND status='compiled'
      ORDER BY "wordCount" DESC NULLS LAST LIMIT 20`, [LEG])
  for (const r of e) console.log(`  ${n(r.wordCount).padStart(9)}w  ${String(r.id).padEnd(46)} ${String(r.sectionTitle ?? '').slice(0, 40).padEnd(40)} ${r.sourceUrl ?? ''}`)

  console.log(`\n=== F. body samples (${SAMPLES} per corpus) — the structure signal ===`)
  for (const corpus of ['eur-lex', 'explanatory-notes', 'explanatory-memoranda']) {
    const { rows: s } = await p.query(
      `SELECT id, "r2Key", "wordCount" FROM corpus_sections
        WHERE corpus=$1 AND status='compiled' AND "wordCount" > 3666 AND "r2Key" IS NOT NULL
        ORDER BY md5(id) LIMIT $2`, [corpus, SAMPLES])
    console.log(`\n──── ${corpus} ────`)
    for (const r of s) {
      const body = await r2Get(r.r2Key)
      if (!body) { console.log(`  ${r.id}: NO BODY`); continue }
      const lines = body.split('\n')
      const blanks = lines.filter(l => !l.trim()).length
      // candidate structure markers
      const marks = {
        Article: (body.match(/(^|\n)\s*Article\s+\d+/g) ?? []).length,
        ArticleInline: (body.match(/\bArticle\s+\d+\b/g) ?? []).length,
        Recital: (body.match(/(^|\n)\s*\(\d{1,3}\)\s/g) ?? []).length,
        NumHeadLine: (body.match(/(^|\n)\s*\d{1,3}\.\s+[A-Z]/g) ?? []).length,
        CHAPTER: (body.match(/(^|\n)\s*(CHAPTER|TITLE|SECTION|ANNEX|PART)\b/g) ?? []).length,
        Para: (body.match(/(^|\n)\s*\d{1,3}\.\s/g) ?? []).length,
      }
      console.log(`  ${r.id}  ${n(r.wordCount)}w  chars=${n(body.length)}  lines=${n(lines.length)} blank=${n(blanks)} avgLine=${(body.length / Math.max(lines.length,1)).toFixed(0)}`)
      console.log(`      markers: ${Object.entries(marks).map(([k, v]) => `${k}=${v}`).join('  ')}`)
      console.log(`      head: ${JSON.stringify(body.slice(0, 260))}`)
    }
  }

  await p.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
