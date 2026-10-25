/**
 * _stale-vector-diag2-tmp.ts — THROWAWAY. Follow-up: confirm the MECHANISM behind
 * corpus_fts missing rows that exist in corpus_sections + corpus_chunks. Hypothesis:
 * build-fts-index.ts resumes via `WHERE id > lastId` (lexicographic string cursor);
 * if scottish-parliament-or's pre-2016 "arch-" rows or the cps-guidance corpus were
 * inserted into corpus_sections AFTER the last completed (non-reset) fts build run,
 * a lexicographic-id resume would silently skip them forever (their ids sort BEFORE
 * lastId even though they are logically new content).
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE, CHECKPOINT_KEY } from './lance'
import { r2Get } from '../shared/r2-client'

async function main() {
  // 1. the fts checkpoint itself
  const raw = await r2Get(CHECKPOINT_KEY)
  console.log('corpus_fts checkpoint (_search/corpus_fts.checkpoint.json):')
  console.log(raw ?? '(none found)')
  console.log('')

  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })

  // 2. corpus_sections: createdAt range for scottish-parliament-or split arch- vs plain, and cps-guidance
  const q1 = await pool.query(`
    SELECT
      (id LIKE 'scottish-parliament-or:arch-%') AS is_arch,
      count(*)::int AS n, min("createdAt") AS min_created, max("createdAt") AS max_created,
      min(id) AS min_id, max(id) AS max_id
    FROM corpus_sections WHERE corpus = 'scottish-parliament-or' GROUP BY 1
  `)
  console.log('scottish-parliament-or createdAt/id range, split by arch- prefix:')
  for (const r of q1.rows) console.log(' ', r)
  console.log('')

  const q2 = await pool.query(`
    SELECT count(*)::int AS n, min("createdAt") AS min_created, max("createdAt") AS max_created,
      min(id) AS min_id, max(id) AS max_id
    FROM corpus_sections WHERE corpus = 'cps-guidance'
  `)
  console.log('cps-guidance createdAt/id range:')
  console.log(' ', q2.rows[0])
  console.log('')

  await pool.end()

  // 3. corpus_fts: does scottish-parliament-or or cps-guidance appear AT ALL, and if so how much
  const conn = await connectLance()
  const ftsTbl = await conn.openTable(FTS_TABLE)
  const spCount = await ftsTbl.query().where(`corpus = 'scottish-parliament-or'`).select(['id']).toArray() as any[]
  console.log(`corpus_fts: scottish-parliament-or row count = ${spCount.length}`)
  if (spCount.length) {
    const ids = spCount.map((r: any) => r.id as string).sort()
    console.log(`  min id in fts: ${ids[0]}`)
    console.log(`  max id in fts: ${ids[ids.length - 1]}`)
    const archInFts = ids.filter((i) => i.includes(':arch-')).length
    console.log(`  of which arch- prefixed: ${archInFts}`)
  }
  const cpsCount = await ftsTbl.query().where(`corpus = 'cps-guidance'`).select(['id']).toArray() as any[]
  console.log(`corpus_fts: cps-guidance row count = ${cpsCount.length}`)

  const totalFts = await ftsTbl.countRows()
  console.log(`corpus_fts: total row count = ${totalFts}`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
