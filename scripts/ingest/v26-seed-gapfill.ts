/**
 * v26-seed-gapfill.ts — Migration A.2. Seeds the genuine coverage-gap items
 * (v26_nonmatch category='gap') into the tna-legislation queue so they arrive as
 * first-class R2-backed corpus_sections rows. Additive (ON CONFLICT DO NOTHING),
 * per UNIFICATION_PLAN §2.1.1 / brief §2.2.
 *
 *   (default)  dry-run — report counts, corpus mapping, pre-existing queue rows.
 *   --seed     bulk-insert the pending rows.
 *
 * Corpus map (UNIFICATION_PLAN §2.2 / WORKER_CORPORA):
 *   UKSI  <2010 → si-pre-2010,        ≥2010 → si-2010plus
 *   UKPGA <2000 → primary-acts-pre-2000, ≥2000 → primary-acts-2000plus
 *   EUR         → retained-eu
 *   ASP         → regional
 *
 * tna-legislation is the always-live core sourceType (no skip-race). Priority 5
 * keeps gap-fill behind the in-flight V25 drains (bills/senedd) — polite, online.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { bulkInsertQueueRows } from './shared/queue-client'

const GAP_PRIORITY = 5

function mapCorpus(t: string, year: number): string | null {
  switch (t) {
    case 'UKSI':  return year < 2010 ? 'si-pre-2010' : 'si-2010plus'
    case 'UKPGA': return year < 2000 ? 'primary-acts-pre-2000' : 'primary-acts-2000plus'
    case 'EUR':   return 'retained-eu'
    case 'ASP':   return 'regional'
    default:      return null
  }
}

async function main() {
  const seed = process.argv.includes('--seed')
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    statement_timeout: 120_000, query_timeout: 120_000, idleTimeoutMillis: 8_000, connectionTimeoutMillis: 15_000 })

  const gaps = (await pool.query(`SELECT gid, t, year FROM v26_nonmatch WHERE category='gap'`)).rows as
    { gid: string; t: string; year: number }[]

  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  const byCorpus: Record<string, number> = {}
  let unmapped = 0
  for (const g of gaps) {
    const corpus = mapCorpus(g.t, g.year)
    if (!corpus) { unmapped++; continue }
    rows.push({ id: `${corpus}:${g.gid}`, corpus, docId: g.gid, sourceType: 'tna-legislation', priority: GAP_PRIORITY })
    byCorpus[corpus] = (byCorpus[corpus] ?? 0) + 1
  }
  console.log(`gap items: ${gaps.length} | mapped: ${rows.length} | unmapped: ${unmapped}`)
  console.table(Object.entries(byCorpus).map(([corpus, n]) => ({ corpus, n })))

  // pre-existing queue rows for these ids (DO NOTHING would skip these)
  const ids = rows.map(r => r.id)
  const existing = await pool.query(
    `SELECT status, count(*)::int n FROM ingest_queue WHERE id = ANY($1) GROUP BY status ORDER BY n DESC`, [ids])
  console.log('\n=== pre-existing ingest_queue rows for these ids (by status) ===')
  console.table(existing.rows)

  if (!seed) { console.log('\n(dry-run — pass --seed to insert)'); await pool.end(); return }

  const { affected } = await bulkInsertQueueRows(rows)
  console.log(`\n[seed] inserted ${affected} new pending rows (of ${rows.length}; existing ids skipped via DO NOTHING)`)
  await pool.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
