/**
 * _stale-vector-diag-tmp.ts — THROWAWAY. Diagnose the "(metadata unavailable —
 * section may have been removed since indexing)" hits in VECTOR_DOSSIER.md.
 * For a sample of ids: check (a) does corpus_sections (Neon, current keyword DB)
 * have this id, (b) does corpus_chunks (Lance, the vector pipeline's own body
 * manifest) still have the text, (c) does corpus_fts (Lance) have it.
 * Read-only, no writes, no spend.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { CHUNKS_TABLE } from './vector-common'

const IDS = [
  'scottish-parliament-or:arch-10199:48',
  'scottish-parliament-or:15771:30',
  'scottish-parliament-or:arch-9750:195',
  'scottish-parliament-or:arch-10134:54',
  'scottish-parliament-or:arch-10085:66',
  'scottish-parliament-or:11004:242',
  'scottish-parliament-or:arch-10036:19',
  'scottish-parliament-or:arch-10105:25',
  'scottish-parliament-or:arch-390:180',
  'scottish-parliament-or:arch-386:1088',
  'scottish-parliament-or:arch-358:56',
  'scottish-parliament-or:arch-5564:4',
  'scottish-parliament-or:arch-3878:56',
  'scottish-parliament-or:arch-238:135',
  'scottish-parliament-or:15741:63',
  'scottish-parliament-or:arch-259:95',
  'cps-guidance:prosecution-guidance/theft-act-offences:1',
]

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })

  // 0. corpus_sections schema sanity (does it have timestamp columns?)
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'corpus_sections' ORDER BY ordinal_position`)
  console.log('corpus_sections columns:', cols.rows.map((r: any) => r.column_name).join(', '))
  console.log('')

  // 1. corpus_sections (Neon, current keyword source of truth)
  const esc = (s: string) => s.replace(/'/g, "''")
  const inList = IDS.map((i) => `'${esc(i)}'`).join(',')
  const secRows = await pool.query(`SELECT id FROM corpus_sections WHERE id IN (${inList})`)
  const foundInSections = new Set(secRows.rows.map((r: any) => r.id))
  console.log(`corpus_sections (Neon): ${foundInSections.size}/${IDS.length} ids found`)
  for (const id of IDS) console.log(`  [${foundInSections.has(id) ? 'FOUND' : 'MISSING'}] ${id}`)
  console.log('')

  // how many total scottish-parliament-or rows currently, and id shape sample
  const spCount = await pool.query(`SELECT count(*)::int AS n FROM corpus_sections WHERE corpus = 'scottish-parliament-or'`)
  console.log(`corpus_sections: scottish-parliament-or total rows = ${spCount.rows[0].n}`)
  const spSample = await pool.query(`SELECT id FROM corpus_sections WHERE corpus = 'scottish-parliament-or' ORDER BY id LIMIT 5`)
  console.log('sample ids (ascending):', spSample.rows.map((r: any) => r.id))
  const spSampleDesc = await pool.query(`SELECT id FROM corpus_sections WHERE corpus = 'scottish-parliament-or' ORDER BY id DESC LIMIT 5`)
  console.log('sample ids (descending):', spSampleDesc.rows.map((r: any) => r.id))
  console.log('')

  await pool.end()

  // 2. corpus_chunks (Lance — the vector pipeline's own body manifest, built from
  //    corpus_sections at whatever time the chunk build ran)
  const conn = await connectLance()
  const chunksTbl = await conn.openTable(CHUNKS_TABLE)
  const chunkInList = IDS.map((i) => `'${esc(i)}'`).join(',')
  const chunkRows = await chunksTbl.query().where(`sectionId IN (${chunkInList})`).select(['sectionId', 'chunkId', 'sectionTitle', 'body']).toArray() as any[]
  const chunksBySection = new Map<string, any[]>()
  for (const r of chunkRows) {
    if (!chunksBySection.has(r.sectionId)) chunksBySection.set(r.sectionId, [])
    chunksBySection.get(r.sectionId)!.push(r)
  }
  console.log(`corpus_chunks (Lance): ${chunksBySection.size}/${IDS.length} sectionIds found`)
  for (const id of IDS) {
    const chunks = chunksBySection.get(id)
    if (chunks) {
      console.log(`  [FOUND, ${chunks.length} chunk(s)] ${id}`)
      console.log(`    title: ${chunks[0].sectionTitle ?? '(none)'}`)
      console.log(`    body: ${(chunks[0].body ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)}`)
    } else {
      console.log(`  [MISSING] ${id}`)
    }
  }
  console.log('')

  // 3. corpus_fts (Lance — the freshly rebuilt keyword table the dossier script queries)
  const ftsTbl = await conn.openTable(FTS_TABLE)
  const ftsInList = IDS.map((i) => `'${esc(i)}'`).join(',')
  const ftsRows = await ftsTbl.query().where(`id IN (${ftsInList})`).select(['id']).toArray() as any[]
  const foundInFts = new Set(ftsRows.map((r: any) => r.id))
  console.log(`corpus_fts (Lance): ${foundInFts.size}/${IDS.length} ids found`)
  for (const id of IDS) console.log(`  [${foundInFts.has(id) ? 'FOUND' : 'MISSING'}] ${id}`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
