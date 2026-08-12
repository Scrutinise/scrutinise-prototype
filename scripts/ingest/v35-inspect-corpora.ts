/**
 * v35-inspect-corpora.ts — read-only look at the four V34 corpora before typing them.
 *
 * The typing decision (BRIEF_SEARCH_S2C6 §1) has to be taken against what the rows ACTUALLY
 * say, not against what the corpus key implies. In particular §1's correctness requirement —
 * "a user must be able to tell an impact assessment from the law it assesses, and a roll-call
 * from a debate" — is a question about the RENDERED TITLE, which is `sectionTitle`. So print
 * real titles, real word counts, and a real body head for each.
 *
 * Usage: tsx v35-inspect-corpora.ts
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import { Pool } from 'pg'
import { r2Get } from './shared/r2-client'

export {}

const CORPORA = ['commons-divisions-votes', 'lords-divisions-votes', 'impact-assessments', 'consultations']
const n = (v: number) => Number(v).toLocaleString('en-GB')

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4, statement_timeout: 600_000 })

  for (const corpus of CORPORA) {
    const { rows: agg } = await pool.query(
      `SELECT status, count(*)::int AS n, sum("wordCount")::bigint AS words,
              min("wordCount")::int AS minw, max("wordCount")::int AS maxw,
              round(avg("wordCount"))::int AS avgw,
              count(*) FILTER (WHERE "sectionTitle" IS NULL)::int AS untitled,
              count(*) FILTER (WHERE "r2Key" IS NULL)::int AS nokey,
              min("itemDate")::text AS mind, max("itemDate")::text AS maxd
         FROM corpus_sections WHERE corpus=$1 GROUP BY status ORDER BY status`, [corpus])
    console.log(`\n══════ ${corpus} ══════`)
    for (const a of agg) {
      console.log(`  status=${a.status}  rows=${n(a.n)}  words=${n(Number(a.words ?? 0))}  wordCount min/avg/max=${a.minw}/${a.avgw}/${a.maxw}`)
      console.log(`    untitled=${a.untitled}  no r2Key=${a.nokey}  itemDate ${a.mind} → ${a.maxd}`)
    }
    const { rows: ex } = await pool.query(
      `SELECT id, "sectionTitle", "wordCount", "sourceUrl", "itemDate"::text AS d, "r2Key"
         FROM corpus_sections WHERE corpus=$1 AND status='compiled' ORDER BY md5(id) LIMIT 6`, [corpus])
    console.log('  ── sample rows ──')
    for (const r of ex) {
      console.log(`    id          ${r.id}`)
      console.log(`    title       ${JSON.stringify(r.sectionTitle)}`)
      console.log(`    words ${r.wordCount}  date ${r.d}`)
      console.log(`    sourceUrl   ${r.sourceUrl}`)
    }
    // one real body, so the decision is taken against the text a retriever would return
    if (ex[0]?.r2Key) {
      const body = await r2Get(ex[0].r2Key)
      console.log(`  ── body head of ${ex[0].id} (${body?.length ?? 0} chars) ──`)
      console.log((body ?? '(missing)').slice(0, 1200).split('\n').map((l) => `    | ${l}`).join('\n'))
    }
  }

  // Sanity: what other corpora exist and how big, so the new ones can be sized against them.
  const { rows: all } = await pool.query(
    `SELECT corpus, count(*)::int AS n FROM corpus_sections WHERE status='compiled'
      GROUP BY corpus ORDER BY n DESC`)
  console.log(`\n══════ all compiled corpora (${all.length}) ══════`)
  for (const r of all) console.log(`  ${r.corpus.padEnd(30)} ${n(r.n).padStart(10)}`)

  await pool.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
