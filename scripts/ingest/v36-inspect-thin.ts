/**
 * v36-inspect-thin.ts — the two detectors disagreed; read the bytes.
 *
 * `v36-dotrot-check.ts` counted 2 of 3 sections in ukpga/Vict/1-2/118 as
 * content-free. `isRepealedPlaceholder` matched neither. One of them is wrong about
 * something, and a discrepancy between two of my own measurements is not a rounding
 * difference to wave through — it is the shape of the V36 defects all over again.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'
import { isRepealedPlaceholder } from './shared/compile'

const PREFIXES = ['primary-acts-pre-2000:ukpga/Vict/1-2/118:', 'si-pre-2010:uksi/1998/141:']

async function main() {
  const pool = getNeonPool()
  for (const p of PREFIXES) {
    const { rows } = await pool.query(
      `SELECT id, "r2Key", "wordCount", status, availability_status FROM corpus_sections
       WHERE id LIKE $1 ORDER BY id LIMIT 25`, [`${p}%`])
    console.log(`\n${p}  (${rows.length} rows)`)
    for (const r of rows) {
      const body = r.r2Key ? await r2Get(r.r2Key as string) : null
      const raw = body ?? ''
      console.log(`  ${r.id.split(':').pop()!.padEnd(12)} status=${String(r.status).padEnd(11)} avail=${String(r.availability_status).padEnd(9)} ` +
        `words=${String(r.wordCount).padStart(4)} placeholder=${String(isRepealedPlaceholder(raw)).padEnd(5)} ` +
        `bytes=${raw.length}  "${raw.replace(/\s+/g, ' ').trim().slice(0, 70)}"`)
    }
  }
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exitCode = 1 })
