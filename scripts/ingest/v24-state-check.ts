/**
 * v24-state-check.ts — read-only sprint-open diagnostic for V24.
 * Establishes which corpora have drained (gates §1 rebaseline), breaker state,
 * parked/blocked rows (gates §2 breaker fix), and devolved/inquiry corpus state.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const REBASE = [
  'retained-eu', 'si-2010plus', 'committees-reports', 'committees-evidence',
  'explanatory-notes', 'explanatory-memoranda', 'ni-judgments',
  'historic-hansard', 'quangos-govuk',
]

async function main() {
  const pool = getNeonPool()

  console.log('=== source_status (breakers) ===')
  const breakers = await pool.query(`SELECT * FROM source_status ORDER BY source_key`)
  for (const r of breakers.rows) console.log(JSON.stringify(r))

  console.log('\n=== queue totals by status ===')
  const tot = await pool.query(`SELECT status, COUNT(*)::int n FROM ingest_queue GROUP BY status ORDER BY status`)
  for (const r of tot.rows) console.log(`${r.status}\t${r.n}`)

  console.log('\n=== rebaseline candidates: open queue rows (pending/claimed/blocked/failed) ===')
  for (const corpus of REBASE) {
    const open = await pool.query(`
      SELECT status, COUNT(*)::int n FROM ingest_queue
      WHERE corpus=$1 AND status IN ('pending','claimed','blocked','failed')
      GROUP BY status`, [corpus])
    const sec = await pool.query(`SELECT COUNT(*)::int n FROM corpus_sections WHERE corpus=$1`, [corpus])
    const brk = open.rows.map((r: any) => `${r.status} ${r.n}`).join(', ') || 'NONE — drained'
    console.log(`${corpus}: open[${brk}] sections=${sec.rows[0].n}`)
  }

  console.log('\n=== blocked rows by corpus×sourceType (parked by breaker) ===')
  const blk = await pool.query(`
    SELECT corpus, "sourceType", COUNT(*)::int n, MIN("lastError") sample
    FROM ingest_queue WHERE status='blocked'
    GROUP BY corpus, "sourceType" ORDER BY n DESC`)
  for (const r of blk.rows) console.log(`${r.corpus}\t${r.sourceType}\t${r.n}\t${(r.sample ?? '').slice(0,80)}`)

  console.log('\n=== failed rows by corpus×sourceType ===')
  const fl = await pool.query(`
    SELECT corpus, "sourceType", COUNT(*)::int n, MIN("lastError") sample
    FROM ingest_queue WHERE status='failed'
    GROUP BY corpus, "sourceType" ORDER BY n DESC LIMIT 30`)
  for (const r of fl.rows) console.log(`${r.corpus}\t${r.sourceType}\t${r.n}\t${(r.sample ?? '').slice(0,80)}`)

  console.log('\n=== corpus_targets (all non-retired) ===')
  const ct = await pool.query(`
    SELECT corpus_key, est_sections, est_is_confirmed, blocked, retired
    FROM corpus_targets ORDER BY corpus_key`)
  for (const r of ct.rows) console.log(`${r.corpus_key}\test=${r.est_sections}\tconf=${r.est_is_confirmed}\tblk=${r.blocked}\tret=${r.retired}`)

  console.log('\n=== total compiled sections + words ===')
  const grand = await pool.query(`
    SELECT COUNT(*)::bigint sections, COALESCE(SUM("wordCount"),0)::bigint words
    FROM corpus_sections WHERE status='compiled'`)
  console.log(JSON.stringify(grand.rows[0]))

  console.log('\n=== ingest service heartbeat ===')
  const hb = await pool.query(`SELECT * FROM ingest_service_state`)
  for (const r of hb.rows) console.log(JSON.stringify(r))

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
