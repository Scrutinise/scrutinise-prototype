/**
 * _dropscope-gap-check-tmp.ts — THROWAWAY. CC follow-up #3 (DROP-audit thread, 29 Jul).
 * Quick/cheap sizing of the corpus_fts staleness gap: how much of corpus_sections
 * post-dates the 2026-06-20 corpus_fts checkpoint, broken down by corpus, and how
 * much of that is actually missing from corpus_fts (extends _stale-vector-diag2-tmp.ts's
 * spot-check to a full per-corpus sweep instead of just scottish-parliament-or/cps-guidance).
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'

const CUTOFF = '2026-06-20 17:34:13+00' // corpus_fts checkpoint updatedAt, from handoff_summary.md

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })

  const totalQ = await pool.query(`SELECT count(*)::int AS n FROM corpus_sections`)
  const postCutoffQ = await pool.query(`SELECT count(*)::int AS n FROM corpus_sections WHERE "createdAt" > $1`, [CUTOFF])
  console.log(`corpus_sections total: ${totalQ.rows[0].n}`)
  console.log(`corpus_sections created after checkpoint (${CUTOFF}): ${postCutoffQ.rows[0].n}`)
  console.log('')

  const byCorpusQ = await pool.query(`
    SELECT corpus, count(*)::int AS post_cutoff_n
    FROM corpus_sections
    WHERE "createdAt" > $1
    GROUP BY corpus
    ORDER BY post_cutoff_n DESC
  `, [CUTOFF])
  console.log('Post-cutoff rows by corpus:')
  for (const r of byCorpusQ.rows) console.log(`  ${r.corpus}: ${r.post_cutoff_n}`)
  console.log('')

  // Full per-corpus totals in corpus_sections, for the corpora that have any post-cutoff rows.
  const corpora = byCorpusQ.rows.map((r) => r.corpus as string)
  const totalsByCorpus = new Map<string, number>()
  if (corpora.length) {
    const totQ = await pool.query(
      `SELECT corpus, count(*)::int AS n FROM corpus_sections WHERE corpus = ANY($1) GROUP BY corpus`,
      [corpora]
    )
    for (const r of totQ.rows) totalsByCorpus.set(r.corpus, r.n)
  }
  await pool.end()

  const conn = await connectLance()
  const ftsTbl = await conn.openTable(FTS_TABLE)
  const ftsTotal = await ftsTbl.countRows()
  console.log(`corpus_fts total: ${ftsTotal}`)
  console.log('')

  console.log('Per-corpus: corpus_sections total vs corpus_fts total vs post-cutoff count:')
  let totalGapEstimate = 0
  for (const r of byCorpusQ.rows) {
    const corpus = r.corpus as string
    const csTotal = totalsByCorpus.get(corpus) ?? 0
    const ftsRows = await ftsTbl.query().where(`corpus = '${corpus.replace(/'/g, "''")}'`).select(['id']).toArray() as any[]
    const ftsCount = ftsRows.length
    const gap = csTotal - ftsCount
    totalGapEstimate += Math.max(0, gap)
    console.log(`  ${corpus}: corpus_sections=${csTotal} corpus_fts=${ftsCount} gap=${gap} post_cutoff_created=${r.post_cutoff_n}`)
  }
  console.log('')
  console.log(`Sum of (corpus_sections - corpus_fts) across affected corpora: ${totalGapEstimate}`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
