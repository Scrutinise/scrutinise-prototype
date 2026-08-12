/**
 * v36-verify-writes.ts — did the recovery pilot write READABLE LAW, or rows?
 *
 * "Built inert hides write-path bugs": a section row with an r2Key proves an
 * upsert ran, not that the object exists or that it contains the instrument's text.
 * This reads the compiled object back out of R2 for the instruments the 1987+ pilot
 * recovered and prints the first line of each, so the content is seen and not
 * inferred from a row count.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const IDS = ['uksi/1999/303', 'uksi/1989/43', 'uksi/1998/141', 'uksi/1987/426', 'uksi/2002/567']

async function main() {
  const pool = getNeonPool()
  let checked = 0, empty = 0, missing = 0
  for (const gid of IDS) {
    const { rows } = await pool.query(
      `SELECT id, "r2Key", "wordCount", status FROM corpus_sections
       WHERE id LIKE $1 AND status='compiled' ORDER BY id LIMIT 3`, [`si-pre-2010:${gid}:%`])
    const { rows: [tot] } = await pool.query(
      `SELECT count(*)::int n, sum("wordCount")::int words FROM corpus_sections
       WHERE id LIKE $1 AND status='compiled'`, [`si-pre-2010:${gid}:%`])
    console.log(`\n${gid} — ${tot.n} compiled sections, ${Number(tot.words).toLocaleString()} words`)
    for (const r of rows) {
      checked++
      if (!r.r2Key) { missing++; console.log(`  ${r.id}  ⚠ NO r2Key`); continue }
      const body = await r2Get(r.r2Key)
      const text = (body ?? '').replace(/\s+/g, ' ').trim()
      if (!text) { empty++; console.log(`  ${r.id}  ⚠ R2 object EMPTY or ABSENT (${r.r2Key})`); continue }
      console.log(`  ${String(r.wordCount).padStart(5)}w  ${text.slice(0, 110)}`)
    }
  }
  console.log(`\n[verify] ${checked} objects read · ${empty} empty · ${missing} without an r2Key`)
  if (empty || missing) process.exitCode = 1
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exitCode = 1 })
