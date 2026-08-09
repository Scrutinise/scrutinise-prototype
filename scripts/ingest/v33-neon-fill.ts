/**
 * v33-neon-fill.ts — READ-ONLY. The Neon fill measurement of record, run before and after every
 * reclaim step in V33 §3 so the before/after is like-for-like (same query, same endpoint).
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { Pool } from 'pg'
export {}
const CEILING_GB = 17.5
const gb = (b: number) => (b / 1024 ** 3).toFixed(2)
;(async () => {
  const p = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 600_000 })
  // docs/CLAUDE.md §16: name the host and the last migrations BEFORE any schema-altering SQL.
  const { rows: [db] } = await p.query(`SELECT pg_database_size(current_database())::bigint AS b, current_database() AS name`)
  const host = (process.env.NEON_DATABASE_URL ?? '').replace(/^.*@/, '').replace(/\/.*$/, '')
  console.log(`host ${host}`)
  console.log(`database ${db.name}  size ${gb(Number(db.b))} GB  = ${((100 * Number(db.b)) / (CEILING_GB * 1024 ** 3)).toFixed(1)}% of the ${CEILING_GB} GB ceiling`)
  try {
    const { rows: m } = await p.query(`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 5`)
    console.log('last 5 migrations: ' + m.map((r) => `${r.migration_name}`).join(', '))
  } catch { console.log('last 5 migrations: (_prisma_migrations not readable)') }
  const { rows: t } = await p.query(`
    SELECT c.relname AS relname, pg_total_relation_size(c.oid)::bigint AS total, pg_relation_size(c.oid)::bigint AS heap,
           pg_indexes_size(c.oid)::bigint AS idx, s.n_live_tup::bigint AS rows
      FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
     WHERE ns.nspname='public' AND c.relkind='r'
     ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 12`)
  console.log('\n  table                          total      heap    indexes        rows')
  for (const r of t) console.log(`  ${String(r.relname).padEnd(28)} ${gb(Number(r.total)).padStart(7)}GB ${gb(Number(r.heap)).padStart(7)}GB ${gb(Number(r.idx)).padStart(7)}GB ${Number(r.rows ?? 0).toLocaleString('en-GB').padStart(12)}`)
  const { rows: i } = await p.query(`
    SELECT indexrelname, pg_relation_size(i.indexrelid)::bigint AS sz, idx_scan
      FROM pg_stat_user_indexes i JOIN pg_class c ON c.oid=i.indexrelid
     WHERE i.relname='corpus_sections' ORDER BY 2 DESC`)
  console.log('\n  corpus_sections indexes                        size    idx_scan')
  for (const r of i) console.log(`  ${String(r.indexrelname).padEnd(42)} ${gb(Number(r.sz)).padStart(7)}GB ${Number(r.idx_scan).toLocaleString('en-GB').padStart(11)}`)
  const { rows: [cs] } = await p.query(`SELECT count(*)::bigint AS n FROM corpus_sections`)
  console.log(`\n  corpus_sections rows: ${Number(cs.n).toLocaleString('en-GB')}`)
  await p.end()
})()
