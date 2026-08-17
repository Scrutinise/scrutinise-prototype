/**
 * setup-llm-spend.ts — apply prisma/llm_spend.sql to Neon, and prove which database it went to.
 *
 * docs/CLAUDE.md §16 makes the whichdb check mandatory before any schema-altering SQL, and the host
 * guard lives INSIDE this script because a check you have to remember to run is a check that will be
 * skipped. Two migrations were once applied to the wrong database and both reported success.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/setup-llm-spend.ts --dry-run
 *   npx tsx --env-file=.env scripts/setup-llm-spend.ts
 *   npx tsx --env-file=.env scripts/setup-llm-spend.ts --verify
 */
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const VERIFY = argv.includes('--verify')

async function main() {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL / DATABASE_URL not set')
  const host = /@([^/:?]+)/.exec(url)?.[1] ?? '(could not parse)'

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const { rows: [who] } = await client.query<{ db: string; usr: string }>(
      'SELECT current_database() AS db, current_user AS usr')
    console.log('════ WHICH DATABASE ════')
    console.log(`  host              ${host}`)
    console.log(`  current_database  ${who.db}`)
    console.log(`  current_user      ${who.usr}`)
    if (!/ep-old-dust-aboxi69a/.test(host)) {
      console.error('\n  ❌ not the Neon production host recorded in docs/CLAUDE.md §16 (ep-old-dust-aboxi69a). Refusing.')
      process.exit(1)
    }
    console.log('  ✓ Neon production, as recorded in docs/CLAUDE.md §16')

    const sql = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'llm_spend.sql'), 'utf8')
    if (/\bDROP\s+(TABLE|INDEX|VIEW|DATABASE|SCHEMA)\b/i.test(sql)) {
      console.error('❌ llm_spend.sql contains a DROP — refusing to run it')
      process.exit(1)
    }

    if (VERIFY) {
      const { rows: [t] } = await client.query<{ e: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='LlmSpend') AS e`)
      console.log(`\n  table LlmSpend       ${t.e ? 'present' : 'MISSING'}`)
      if (t.e) {
        const { rows: [c] } = await client.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM "LlmSpend"')
        console.log(`  rows                 ${Number(c.n).toLocaleString('en-GB')}`)
      }
      const { rows: [v] } = await client.query<{ e: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='LlmSpendDaily') AS e`)
      console.log(`  view  LlmSpendDaily  ${v.e ? 'present' : 'MISSING'}`)
      return
    }

    if (DRY) {
      console.log('\n════ DDL (not applied) ════')
      console.log(sql.split('\n').filter((l) => /^(CREATE|ALTER)/i.test(l.trim())).join('\n'))
      console.log('\n--dry-run: nothing applied.')
      return
    }

    console.log('\n════ APPLYING ════')
    const stripped = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
    for (const st of stripped.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean)) {
      const label = st.replace(/\s+/g, ' ').slice(0, 76)
      try { await client.query(st); console.log(`  ✓ ${label}`) }
      catch (e) { console.error(`  ✗ ${label}\n      ${(e as Error).message}`); throw e }
    }
    const { rows: [c] } = await client.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM "LlmSpend"')
    console.log(`\n  applied. LlmSpend holds ${c.n} rows (0 expected on a first run).`)
  } finally {
    await client.end()
  }
}
main().catch((e) => { console.error('[setup-llm-spend] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
