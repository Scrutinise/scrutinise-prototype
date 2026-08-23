/** c2-state.ts — C2 baseline. READ-ONLY. Which DB, and the headline counts. */
import { pool } from './db'
;(async () => {
  const p = pool()
  const who = await p.query(`select current_database() db, inet_server_addr()::text host, version() v`)
  console.log('DB:', who.rows[0].db, who.rows[0].host, String(who.rows[0].v).slice(0, 40))
  const t = await p.query(`select count(*)::int n from corpus_sections`)
  console.log('corpus_sections:', t.rows[0].n.toLocaleString())
  const c = await p.query(`select count(distinct corpus)::int n from corpus_sections`)
  console.log('distinct corpora:', c.rows[0].n)
  await p.end()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
