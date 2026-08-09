/**
 * v33-dump-body.ts — READ-ONLY. Dump one corpus_sections body from R2 to the scratchpad so the
 * real bytes can be inspected before a splitter is written (docs/CLAUDE.md §13: look at the
 * bytes before forming a hypothesis).
 *
 * Usage: tsx v33-dump-body.ts <sectionId> <outFile>
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

import fs from 'fs'
import { Pool } from 'pg'
import { r2Get } from './shared/r2-client'

export {}

async function main() {
  const [id, out] = process.argv.slice(2)
  if (!id || !out) throw new Error('usage: v33-dump-body.ts <sectionId> <outFile>')
  const p = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 })
  const { rows } = await p.query<{ r2Key: string; wordCount: number }>(
    `SELECT "r2Key", "wordCount" FROM corpus_sections WHERE id=$1`, [id])
  if (!rows.length) throw new Error(`no row: ${id}`)
  const body = await r2Get(rows[0].r2Key)
  if (!body) throw new Error(`no R2 body at ${rows[0].r2Key}`)
  fs.writeFileSync(out, body, 'utf8')
  console.log(`${id}: ${body.length} chars, ${rows[0].wordCount} words → ${out}`)
  await p.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
