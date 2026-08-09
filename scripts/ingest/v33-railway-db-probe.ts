/**
 * v33-railway-db-probe.ts — READ-ONLY. Does the old Railway `scrutinise-db` still hold the
 * pre-V26 app data, and is anything still connected to it? (V33 §4.)
 *
 * ⚠ `RAILWAY_DATABASE_URL_LEGACY` is DEAD for schema work (docs/CLAUDE.md §16). This script
 * only SELECTs from the catalogue and from pg_stat_activity. It writes nothing and alters
 * nothing — the archive-and-clear decision is made from what it reports, not by it.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'
export {}
const gb = (b: number) => (b / 1024 ** 3).toFixed(3)
;(async () => {
  const url = process.env.RAILWAY_DATABASE_URL_LEGACY
  if (!url) throw new Error('RAILWAY_DATABASE_URL_LEGACY not set')
  console.log(`host ${url.replace(/^.*@/, '').replace(/\/.*$/, '')}`)
  const p = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 20000, statement_timeout: 120000 })
  const { rows: [d] } = await p.query(`SELECT current_database() AS db, pg_database_size(current_database())::bigint AS b, version() AS v`)
  console.log(`database ${d.db}  size ${gb(Number(d.b))} GB`)
  console.log(`${String(d.v).split(',')[0]}`)

  const { rows: act } = await p.query(
    `SELECT application_name, client_addr::text AS addr, state, count(*)::int AS n,
            max(now() - backend_start)::text AS oldest
       FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1,2,3 ORDER BY 4 DESC`)
  console.log(`\nconnections (this probe included):`)
  for (const a of act) console.log(`  n=${a.n} app=${a.application_name || '(none)'} addr=${a.addr ?? '(local)'} state=${a.state} oldest=${a.oldest}`)

  const { rows: t } = await p.query(
    `SELECT c.relname, pg_total_relation_size(c.oid)::bigint AS total, s.n_live_tup::bigint AS rows
       FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
       LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
      WHERE ns.nspname='public' AND c.relkind='r'
      ORDER BY pg_total_relation_size(c.oid) DESC`)
  console.log(`\n${t.length} tables:`)
  let tot = 0
  for (const r of t) { tot += Number(r.total)
    if (Number(r.total) > 1024 * 1024 || Number(r.rows ?? 0) > 0)
      console.log(`  ${String(r.relname).padEnd(38)} ${gb(Number(r.total)).padStart(8)}GB  rows≈${Number(r.rows ?? 0).toLocaleString('en-GB')}`) }
  console.log(`  (total across all tables ${gb(tot)} GB)`)

  // exact counts for the user-data tables the V26 cutover moved
  for (const tbl of ['User', 'Idea', 'IdeaLegislation', 'Comment', 'ActivityLog', 'LegislationItem', 'LegislationSection', 'corpus_sections', 'ingest_queue']) {
    try {
      const { rows: [c] } = await p.query(`SELECT count(*)::bigint AS n FROM "${tbl}"`)
      console.log(`  exact count "${tbl}": ${Number(c.n).toLocaleString('en-GB')}`)
    } catch { console.log(`  exact count "${tbl}": (table absent)`) }
  }
  await p.end()
})()
