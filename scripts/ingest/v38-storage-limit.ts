/**
 * v38-storage-limit.ts — BRIEF_INGEST_V38_STORAGE §1: what does Neon ACTUALLY enforce?
 *
 * ⚠ The whole point of §1 is that "17.5 GiB" was never sourced. So this reads the enforcement
 * mechanism itself rather than any figure about it. Neon's compute carries the project storage
 * ceiling as a GUC — `neon.max_cluster_size` — and it is the thing that actually fails writes when
 * exceeded ("could not extend file ... project size exceeds limit"). A value read from the running
 * compute is a measurement; a number in a handoff is not.
 *
 * ⚠ It is NOT the console. docs/CLAUDE.md §19: a fact that cannot be read from here must be
 * labelled as unread, not inferred. There is no NEON_API_KEY in this environment, so the plan's
 * billing terms are Charlie's to confirm; what the compute enforces is readable and is read here.
 *
 * Usage (from scripts/ingest):  npx tsx v38-storage-limit.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)
const q = async (sql: string, a: any[] = []) => (await pool.query(sql, a)).rows

async function main() {
  const url = process.env.NEON_DATABASE_URL ?? ''
  console.log(`host  ${/@([^/:?]+)/.exec(url)?.[1] ?? '(unparsed)'}`)
  const [{ db, usr, v }] = await q(`SELECT current_database() AS db, current_user AS usr, version() AS v`) as any[]
  console.log(`db    ${db}   user ${usr}`)
  console.log(`pg    ${String(v).split(' on ')[0]}`)

  head('§1.1 — WHAT THE COMPUTE ENFORCES')
  // Every neon.* setting, so the ceiling is read in context rather than cherry-picked.
  const gucs = await q(
    `SELECT name, setting, unit, source, short_desc FROM pg_settings
      WHERE name LIKE 'neon%' ORDER BY name`)
  if (!gucs.length) console.log('   ⚠ no neon.* settings visible — this may not be a Neon compute')
  for (const g of gucs) {
    console.log(`   ${g.name.padEnd(34)} ${String(g.setting).padStart(12)} ${(g.unit ?? '').padEnd(4)}  [${g.source}]`)
    if (g.short_desc) console.log(`      ${g.short_desc}`)
  }

  const mcs = gucs.find((g: any) => g.name === 'neon.max_cluster_size')
  head('§1.2 — THE CEILING, IN THE UNITS THE ARGUMENT WAS CONDUCTED IN')
  if (!mcs) {
    console.log('   ⚠ neon.max_cluster_size is NOT exposed to this role.')
    console.log('     That is an unread fact, not an absent limit. Do not write down either.')
  } else {
    // The unit is normally MB. Convert explicitly rather than assuming.
    const raw = Number(mcs.setting)
    const unit = (mcs.unit ?? '').trim() || 'MB'
    const mb = unit === 'MB' ? raw : unit === 'kB' ? raw / 1024 : unit === '8kB' ? (raw * 8) / 1024 : NaN
    console.log(`   neon.max_cluster_size = ${raw} ${unit}  (source: ${mcs.source})`)
    if (Number.isNaN(mb)) console.log(`   ⚠ unrecognised unit "${unit}" — not converting rather than guessing`)
    else {
      const gib = mb / 1024
      const gb = (mb * 1024 * 1024) / 1e9
      console.log(`   = ${gib.toFixed(2)} GiB  = ${gb.toFixed(2)} GB (decimal)`)
      console.log(`   ⚠ -1 means NO LIMIT ENFORCED BY THE COMPUTE.`)
    }
  }

  head('§1.3 — CURRENT USAGE, AND WHAT IT WOULD MEAN AGAINST THAT CEILING')
  const [{ b }] = await q(`SELECT pg_database_size(current_database())::text AS b`) as any[]
  const bytes = Number(b)
  console.log(`   this database          ${(bytes / 1024 ** 3).toFixed(2)} GiB   ${(bytes / 1e9).toFixed(2)} GB (decimal)`)

  // ⚠ pg_database_size is ONE database. The Neon ceiling applies to the PROJECT — every database
  // and every branch. Reporting one as the other is the same class of error this brief is about.
  const dbs = await q(
    `SELECT datname, pg_database_size(datname) AS bytes FROM pg_database
      WHERE datistemplate = false ORDER BY 2 DESC`)
  console.log(`   all databases on this endpoint:`)
  let total = 0
  for (const d of dbs) { total += Number(d.bytes); console.log(`     ${String(d.datname).padEnd(24)} ${(Number(d.bytes) / 1024 ** 3).toFixed(2)} GiB`) }
  console.log(`   ── sum                  ${(total / 1024 ** 3).toFixed(2)} GiB`)
  console.log(`   ⚠ Neon bills and limits per PROJECT, across all branches. This endpoint is one`)
  console.log(`     branch; branch storage is NOT visible from inside Postgres. If other branches`)
  console.log(`     exist, project usage is HIGHER than this and only the console/API can say.`)

  head('§1.4 — COST AT THE RATE THE BRIEF QUOTES ($0.35 / GB-month)')
  const gbDec = bytes / 1e9
  console.log(`   ⚠ the rate is Charlie's figure from the brief, not one read from here — no`)
  console.log(`     NEON_API_KEY in this environment, so billing is unreadable and stays labelled so.`)
  for (const [label, gb] of [['now', gbDec], ['if the corpus doubles', gbDec * 2]] as const) {
    console.log(`   ${String(label).padEnd(24)} ${gb.toFixed(2)} GB  →  $${(gb * 0.35).toFixed(2)}/month  ($${(gb * 0.35 * 12).toFixed(2)}/yr)`)
  }

  head('§1.5 — WHAT 2D-2 REFUSED TO WRITE, PRICED AGAINST WHAT IS ACTUALLY ENFORCED')
  const twoD2 = 2.21 * 1024 ** 3
  console.log(`   the voted+evidence rows 2D-2 declined to materialise: 2.21 GiB`)
  console.log(`   cost to hold them at $0.35/GB-month: $${((twoD2 / 1e9) * 0.35).toFixed(2)}/month`)
  if (mcs && Number(mcs.setting) > 0) {
    const ceilBytes = Number(mcs.setting) * 1024 * 1024
    console.log(`   would have taken the database to ${((bytes + twoD2) / 1024 ** 3).toFixed(2)} GiB`)
    console.log(`   against an enforced ceiling of   ${(ceilBytes / 1024 ** 3).toFixed(2)} GiB`)
    console.log(`   → ${bytes + twoD2 > ceilBytes ? 'WOULD NOT HAVE FIT' : 'WOULD HAVE FIT'}`)
  }

  await endNeonPool()
}
main().catch((e) => { console.error('[v38-storage-limit] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
