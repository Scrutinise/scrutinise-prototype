/**
 * _fts-gap-audit-tmp.ts — THROWAWAY. Full per-corpus reconciliation: corpus_sections
 * (Neon, status='compiled') vs corpus_fts (Lance) row counts, corpus by corpus. Finds
 * EVERY gap (not just the two already known), explains the "264k unexplained" figure,
 * and produces the exact per-corpus missing-row counts needed to scope a backfill.
 * Memory-conscious: never loads more than one corpus's ids into memory at once
 * (this machine has 16GB RAM; scottish-parliament-or at ~1M ids is the ceiling case).
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3, statement_timeout: 300_000 })
  const conn = await connectLance()
  const tbl = await conn.openTable(FTS_TABLE)

  const sectionsByCorpus = await pool.query<{ corpus: string; n: string }>(
    `SELECT corpus, count(*)::bigint AS n FROM corpus_sections WHERE status='compiled' GROUP BY corpus ORDER BY corpus`
  )
  console.log(`corpus_sections (compiled): ${sectionsByCorpus.rows.length} distinct corpora`)

  const ftsTotal = await tbl.countRows()
  const sectionsTotal = sectionsByCorpus.rows.reduce((s, r) => s + Number(r.n), 0)
  console.log(`corpus_sections total (compiled): ${sectionsTotal.toLocaleString()}`)
  console.log(`corpus_fts total:                 ${ftsTotal.toLocaleString()}`)
  console.log(`raw gap:                          ${(sectionsTotal - ftsTotal).toLocaleString()}`)
  console.log('')

  let totalGap = 0
  const gaps: { corpus: string; sections: number; fts: number; gap: number }[] = []
  for (const r of sectionsByCorpus.rows) {
    const sectionsN = Number(r.n)
    const ftsN = await tbl.countRows(`corpus = '${r.corpus.replace(/'/g, "''")}'`)
    const gap = sectionsN - ftsN
    if (gap !== 0) {
      gaps.push({ corpus: r.corpus, sections: sectionsN, fts: ftsN, gap })
      totalGap += gap
    }
  }

  console.log(`Corpora with a gap (corpus_sections compiled > corpus_fts): ${gaps.length}`)
  gaps.sort((a, b) => b.gap - a.gap)
  for (const g of gaps) {
    console.log(`  ${g.corpus}: sections=${g.sections.toLocaleString()} fts=${g.fts.toLocaleString()} gap=${g.gap.toLocaleString()}`)
  }
  console.log('')
  console.log(`TOTAL missing rows (sum of per-corpus gaps): ${totalGap.toLocaleString()}`)

  await pool.end()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
