/**
 * v33-railway-db-readwatch.ts — is ANYTHING still reading the old Railway `scrutinise-db`?
 *
 * `pg_stat_activity` only shows connections open at the instant it is sampled, so it cannot
 * rule out an hourly scheduler tick. The cumulative counters can: `pg_stat_database` and
 * `pg_stat_user_tables` have never been reset on this instance (stats_reset IS NULL, postmaster
 * up since 2026-06-10), so a snapshot taken twice, minutes apart, answers the question that
 * matters — is the number still moving?
 *
 * Writes a snapshot to docs/v33_railway_db_readwatch.json on first run and DIFFS against it on
 * every subsequent run. Read-only against Railway.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import fs from 'fs'
import { Pool } from 'pg'
export {}
const SNAP = path.join(__dirname, '../../docs/v33_railway_db_readwatch.json')
;(async () => {
  const p = new Pool({ connectionString: process.env.RAILWAY_DATABASE_URL_LEGACY, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120000 })
  const { rows: [db] } = await p.query(`SELECT numbackends, xact_commit::bigint, xact_rollback::bigint, tup_returned::bigint, tup_fetched::bigint, tup_inserted::bigint, tup_updated::bigint, tup_deleted::bigint FROM pg_stat_database WHERE datname=current_database()`)
  const { rows: tabs } = await p.query(`SELECT relname, seq_scan::bigint, coalesce(idx_scan,0)::bigint AS idx_scan FROM pg_stat_user_tables ORDER BY relname`)
  const { rows: act } = await p.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid()`)
  const now = { at: new Date().toISOString(), db, tables: Object.fromEntries(tabs.map((t) => [t.relname, { seq: Number(t.seq_scan), idx: Number(t.idx_scan) }])), otherBackends: act[0].n }

  let prev: typeof now | null = null
  try { prev = JSON.parse(fs.readFileSync(SNAP, 'utf8')).latest } catch { /* first run */ }

  console.log(`connections other than this probe: ${now.otherBackends}`)
  if (!prev) {
    console.log('first snapshot — run again after at least one scheduler tick (Ops runs at :01 hourly and every 15 min)')
  } else {
    const dt = (Date.parse(now.at) - Date.parse(prev.at)) / 60000
    console.log(`diff over ${dt.toFixed(1)} minutes since ${prev.at}:`)
    const d = (k: keyof typeof db) => Number((now.db as any)[k]) - Number((prev!.db as any)[k])
    console.log(`  xact_commit +${d('xact_commit')}  xact_rollback +${d('xact_rollback')}  tup_fetched +${d('tup_fetched')}`)
    console.log(`  tup_inserted +${d('tup_inserted')}  tup_updated +${d('tup_updated')}  tup_deleted +${d('tup_deleted')}`)
    let moved = 0
    for (const [t, v] of Object.entries(now.tables) as Array<[string, { seq: number; idx: number }]>) {
      const p0 = prev.tables[t]; if (!p0) continue
      const ds = v.seq - p0.seq, di = v.idx - p0.idx
      if (ds || di) { moved++; console.log(`  ⚠ ${t}: seq +${ds}  idx +${di}`) }
    }
    // Every read this probe itself makes is against pg_catalog, not a user table, so any movement
    // in a user table between two runs is somebody ELSE reading.
    console.log(moved === 0
      ? `  ✅ NO user table was scanned by anyone in that window — nothing live is reading this database`
      : `  ❌ ${moved} user tables were scanned — something IS still reading this database`)
  }
  fs.writeFileSync(SNAP, JSON.stringify({ previous: prev, latest: now }, null, 2))
  console.log(`snapshot → docs/v33_railway_db_readwatch.json`)
  await p.end()
})()
