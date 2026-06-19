/**
 * railway-legsection-retire.ts — Task B (V26 §6 prep): retire the RAILWAY
 * LegislationSection copy REVERSIBLY, after confirming the live search/panel
 * path hits Neon's GIN index and nothing reads Railway post-cutover.
 *
 * Modes:
 *   (default / --check)  READ-ONLY. EXPLAIN the panel query on Neon (GIN vs Seq
 *                        Scan), count LegislationSection/Item on BOTH DBs (parity
 *                        + does-anything-live-only-on-Railway), identify hosts.
 *   --rename             ALTER TABLE "LegislationSection" RENAME TO
 *                        "LegislationSection_DEPRECATED_2026-06-19" on RAILWAY ONLY.
 *                        Reversible. NOT a DROP. Guarded so it can never hit Neon.
 *   --rename-back        Reverse the rename in seconds (rollback the canary).
 *
 * Railway = DATABASE_URL (local .env still points at Railway — FTS_BUILD_S1b §0.3).
 * Neon    = NEON_DATABASE_URL.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const DEPRECATED_NAME = 'LegislationSection_DEPRECATED_2026-06-19'
const PANEL_QUERY = `data protection` // representative; matches the live panel SQL

function hostOf(url: string | undefined): string {
  if (!url) return '(unset)'
  try { return new URL(url).host } catch { return '(unparseable)' }
}
function looksNeon(url: string | undefined): boolean { return !!url && /neon\.tech|neon\./i.test(url) }
function looksRailway(url: string | undefined): boolean { return !!url && /(railway|rlwy)/i.test(url) }

function pool(url: string | undefined): Pool {
  if (!url) throw new Error('connection string unset')
  return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3, query_timeout: 60000, statement_timeout: 60000 })
}

async function tableExists(p: Pool, name: string): Promise<boolean> {
  const r = await p.query(`SELECT to_regclass($1) AS reg`, [`public."${name}"`])
  return r.rows[0].reg !== null
}
async function safeCount(p: Pool, name: string): Promise<number | null> {
  if (!(await tableExists(p, name))) return null
  const r = await p.query(`SELECT count(*)::bigint AS n FROM "${name}"`)
  return Number(r.rows[0].n)
}

async function check() {
  const railwayUrl = process.env.DATABASE_URL
  const neonUrl = process.env.NEON_DATABASE_URL
  console.log('=== HOSTS ===')
  console.log(`DATABASE_URL      → ${hostOf(railwayUrl)}  ${looksRailway(railwayUrl) ? '[railway]' : looksNeon(railwayUrl) ? '[NEON!]' : '[?]'}`)
  console.log(`NEON_DATABASE_URL → ${hostOf(neonUrl)}  ${looksNeon(neonUrl) ? '[neon]' : '[?]'}`)

  // EXPLAIN the panel query on Neon
  console.log('\n=== S1a EXPLAIN — panel query on NEON (expect GIN, not Seq Scan) ===')
  const neon = pool(neonUrl)
  try {
    const plan = await neon.query(`EXPLAIN
      SELECT ls.id FROM "LegislationSection" ls JOIN "LegislationItem" li ON ls."legislationItemId"=li.id
      WHERE ls."ftsVector" @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(ls."ftsVector", plainto_tsquery('english', $1)) DESC, ls."amendmentCount" ASC LIMIT 5`, [PANEL_QUERY])
    const txt = plan.rows.map((r: any) => r['QUERY PLAN']).join('\n')
    console.log(txt)
    const usesGin = /Bitmap Index Scan|Index Scan/i.test(txt) && /fts|gin|ftsVector/i.test(txt)
    const seqScan = /Seq Scan on "?LegislationSection/i.test(txt)
    console.log(`\nVERDICT: ${usesGin && !seqScan ? '✓ GIN index served (no Seq Scan)' : seqScan ? '✗ SEQ SCAN — NOT index-served' : '? inspect plan above'}`)
  } finally { await neon.end() }

  // Parity on both DBs
  console.log('\n=== PARITY — LegislationSection / LegislationItem on both DBs ===')
  for (const [label, url] of [['RAILWAY (DATABASE_URL)', railwayUrl], ['NEON', neonUrl]] as const) {
    const p = pool(url)
    try {
      const ls = await safeCount(p, 'LegislationSection')
      const li = await safeCount(p, 'LegislationItem')
      const dep = await tableExists(p, DEPRECATED_NAME)
      console.log(`${label} [${hostOf(url)}]: LegislationSection=${ls ?? 'ABSENT'} LegislationItem=${li ?? 'ABSENT'}${dep ? ` (+ ${DEPRECATED_NAME} present)` : ''}`)
    } catch (e) { console.log(`${label} [${hostOf(url)}]: ERROR ${(e as Error).message}`) }
    finally { await p.end() }
  }
  console.log('\n(Parity = nothing lives ONLY on Railway if Neon counts ≥ Railway counts for these tables.)')
}

async function doRename(back: boolean) {
  const railwayUrl = process.env.DATABASE_URL
  // HARD GUARD: never rename on a Neon endpoint.
  if (looksNeon(railwayUrl) || !looksRailway(railwayUrl)) {
    throw new Error(`REFUSING: DATABASE_URL host=${hostOf(railwayUrl)} does not look like Railway. The rename must target the Railway copy only. Set DATABASE_URL to the Railway endpoint and retry.`)
  }
  const from = back ? DEPRECATED_NAME : 'LegislationSection'
  const to = back ? 'LegislationSection' : DEPRECATED_NAME
  const p = pool(railwayUrl)
  try {
    if (!(await tableExists(p, from))) throw new Error(`source table "${from}" not present on Railway [${hostOf(railwayUrl)}]`)
    if (await tableExists(p, to)) throw new Error(`target table "${to}" already exists on Railway — aborting`)
    await p.query(`ALTER TABLE "${from}" RENAME TO "${to}"`)
    console.log(`✓ RAILWAY [${hostOf(railwayUrl)}]: renamed "${from}" → "${to}". Reversible with the opposite mode.`)
  } finally { await p.end() }
}

async function main() {
  const arg = process.argv.slice(2)
  if (arg.includes('--rename')) return doRename(false)
  if (arg.includes('--rename-back')) return doRename(true)
  return check()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
