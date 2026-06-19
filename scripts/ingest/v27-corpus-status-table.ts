/**
 * v27-corpus-status-table.ts — per-corpus sections | words | R2 bytes | Neon bytes
 * table for the Corpus Status workbook. Run POST-DRAIN of the V27 seeds
 * (scottish-courts, ico, quangos-govuk T2) — methodology identical to V24–V26
 * so the columns stay comparable across sprints.
 *
 *  - sections: corpus_sections rows (total + compiled split)
 *  - words:    SUM("wordCount") — exact, written at ingest for every compiled row
 *  - R2 bytes: words × 6.1 B/word (SEARCH_AUDIT §3 measured avg) — ESTIMATE
 *  - Neon bytes: SUM(pg_column_size(row)) per corpus — heap incl. TOAST, excl. idx
 *
 * Outputs: markdown table to stdout + scrutinise-docs/CORPUS_STATUS_V27.csv
 * (per-corpus rows only; TOTAL printed to console, NOT written).
 */
import * as fs from 'fs'
import * as path from 'path'
import { Client } from 'pg'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const R2_BYTES_PER_WORD = 6.1
const OUT_CSV = path.join(__dirname, '../../scrutinise-docs/CORPUS_STATUS_V27.csv')

async function main() {
  const client = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  console.log('[status] scanning corpus_sections (sections/words/neon-bytes; minutes-scale)…')
  const r = await client.query(`
    SELECT corpus,
           COUNT(*)::bigint                                       AS total_sections,
           COUNT(*) FILTER (WHERE status = 'compiled')::bigint    AS compiled_sections,
           COALESCE(SUM("wordCount"), 0)::bigint                  AS words,
           COALESCE(SUM(pg_column_size(corpus_sections.*)), 0)::bigint AS neon_bytes
    FROM corpus_sections
    GROUP BY corpus
    ORDER BY words DESC`)

  const lines = ['corpus,total_sections,compiled_sections,words,r2_bytes_est,neon_heap_bytes']
  console.log('\n| corpus | sections (compiled/total) | words | R2 bytes (est) | Neon heap bytes |')
  console.log('|---|---:|---:|---:|---:|')
  let tS = 0n, tC = 0n, tW = 0n, tR = 0n, tN = 0n
  const gb = (n: number | bigint) => (Number(n) / 1_073_741_824).toFixed(2) + ' GB'
  for (const row of r.rows) {
    const words = BigInt(row.words)
    const r2 = BigInt(Math.round(Number(words) * R2_BYTES_PER_WORD))
    tS += BigInt(row.total_sections); tC += BigInt(row.compiled_sections); tW += words; tR += r2; tN += BigInt(row.neon_bytes)
    lines.push(`${row.corpus},${row.total_sections},${row.compiled_sections},${row.words},${r2},${row.neon_bytes}`)
    console.log(`| ${row.corpus} | ${Number(row.compiled_sections).toLocaleString()} / ${Number(row.total_sections).toLocaleString()} | ${Number(words).toLocaleString()} | ${gb(r2)} | ${gb(row.neon_bytes)} |`)
  }
  console.log(`| **TOTAL** | **${Number(tC).toLocaleString()} / ${Number(tS).toLocaleString()}** | **${Number(tW).toLocaleString()}** | **${gb(tR)}** | **${gb(tN)}** |`)
  fs.writeFileSync(OUT_CSV, lines.join('\n') + '\n', 'utf8')
  console.log(`\n[status] CSV written: ${OUT_CSV}`)
  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
