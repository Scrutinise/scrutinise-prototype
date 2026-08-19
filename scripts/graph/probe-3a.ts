/**
 * probe-3a.ts — GRAPH 3A §1, first pass: what tables exist and what shape are they.
 *
 * Read-only. Prints table presence, row counts and column shapes for everything the brief's
 * §1.2 store list names, plus anything matching the political-source families, so the audit
 * starts from the database rather than from the brief's expectations.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const PATTERNS = [
  'division%', 'edm%', 'graph%', 'committee%', 'member%', 'interest%', 'bill%',
  'witness%', 'appearance%', 'position%', 'register%', 'party%',
]

async function main() {
  const pool = getNeonPool()
  try {
    const { rows: [who] } = await pool.query<{ db: string }>(`SELECT current_database() AS db`)
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    console.log(`host ${host}  db ${who.db}`)

    const { rows: tables } = await pool.query<{ tablename: string; kind: string }>(
      `SELECT tablename, 'table' AS kind FROM pg_tables WHERE schemaname='public'
       UNION ALL SELECT viewname, 'view' FROM pg_views WHERE schemaname='public'
       ORDER BY 1`)
    const match = tables.filter((t) => PATTERNS.some((p) => new RegExp('^' + p.replace(/%/g, '.*') + '$').test(t.tablename)))
    console.log(`\n${tables.length} relations in public; ${match.length} match the audit patterns\n`)

    for (const t of match) {
      let n = '?'
      try {
        const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${t.tablename}"`)
        n = c.n
      } catch (e) { n = 'ERR ' + (e as Error).message.slice(0, 40) }
      const { rows: cols } = await pool.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [t.tablename])
      console.log(`── ${t.kind.padEnd(5)} ${t.tablename}  (${n} rows)`)
      console.log(`     ${cols.map((c) => c.column_name).join(', ')}`)
    }

    console.log('\n════ ALL RELATIONS (names only) ════')
    console.log(tables.map((t) => `${t.kind === 'view' ? 'v:' : ''}${t.tablename}`).join('  '))
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3a] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
