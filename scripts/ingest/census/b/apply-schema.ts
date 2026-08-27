/**
 * apply-schema.ts — create `corpus_census`, then PROVE its constraints reject what they exist to
 * reject before anything is allowed to trust them.
 *
 * CLAUDE.md §16: the whichdb block prints first and the run aborts if the host is not Neon.
 * The brief says `prisma db execute --file` against the direct URL; this does the same thing
 * through `pg` on the same non-pooled URL, in one process, so the self-test runs against the
 * schema it just created rather than against a second connection's idea of it.
 *
 * Usage:
 *   tsx census/b/apply-schema.ts               # whichdb, DDL, self-test
 *   tsx census/b/apply-schema.ts --self-test   # self-test only (table must already exist)
 */
import fs from 'fs'
import path from 'path'
import { pool } from '../../c2/db'

const SELF_TEST_ONLY = process.argv.includes('--self-test')

/** Each case is a row the table MUST refuse. A constraint nobody has watched refuse is decoration. */
const MUST_REJECT: { why: string; row: Record<string, any> }[] = [
  {
    why: 'MEASURED with no denominator — the exact defect this table replaces',
    row: { corpus_key: '__selftest_a', state: 'MEASURED', unit: 'x', method: 'x', held_units: 10 },
  },
  {
    why: 'MEASURED with a denominator but no walk artefact — a number with no provenance',
    row: { corpus_key: '__selftest_b', state: 'MEASURED', unit: 'x', method: 'x', held_units: 10, published_units: 20, walked_at: new Date() },
  },
  {
    why: 'DECLARED with no denominator — DECLARED still prints a percentage',
    row: { corpus_key: '__selftest_c', state: 'DECLARED', unit: 'x', method: 'x', held_units: 10 },
  },
  {
    why: 'a state nobody defined',
    row: { corpus_key: '__selftest_d', state: 'COMPLETE', unit: 'x', method: 'x' },
  },
  {
    why: 'published == held with nothing said about it — the self-referential signature',
    row: { corpus_key: '__selftest_e', state: 'MEASURED', unit: 'x', method: 'x', held_units: 500, published_units: 500,
           walked_at: new Date(), walk_artifact_path: 'docs/census/x.json' },
  },
  {
    // ⚠ THE CASE THE FIRST VERSION OF THIS CONSTRAINT LET THROUGH. Every walker writes notes, so
    // "notes IS NOT NULL" was satisfied by default and six exact matches passed unremarked.
    why: 'published == held with ordinary prose in notes but no deliberate EXACT: assertion',
    row: { corpus_key: '__selftest_e2', state: 'MEASURED', unit: 'x', method: 'x', held_units: 500, published_units: 500,
           walked_at: new Date(), walk_artifact_path: 'docs/census/x.json',
           notes: 'walked the directory index and reduced files to days' },
  },
  {
    why: 'more hollow units than units held',
    row: { corpus_key: '__selftest_f', state: 'UNMEASURED', unit: 'x', method: 'x', held_units: 5, hollow_units: 9 },
  },
]

/** And one the table MUST accept, so the self-test cannot pass by rejecting everything. */
const MUST_ACCEPT = {
  why: 'a complete MEASURED row',
  row: { corpus_key: '__selftest_ok', state: 'MEASURED', unit: 'instrument', method: 'entry walk of example',
         walked_at: new Date(), published_units: 100, held_units: 60, hollow_units: 0,
         walk_artifact_path: 'docs/census/__selftest.json' },
}

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  const url = process.env.NEON_DATABASE_URL_NO_POOLED || process.env.NEON_DATABASE_URL || ''
  const host = url.replace(/^[^@]*@/, '').split('/')[0]
  const db = (await q(`SELECT current_database() d, current_user u`))[0]
  console.log('── §16 whichdb ────────────────────────────────────────────────')
  console.log(`host     : ${host}`)
  console.log(`database : ${db.d}   user: ${db.u}`)
  if (!host.includes('ep-old-dust-aboxi69a')) {
    console.error('⛔ NOT the production Neon host. Refusing to run DDL.')
    process.exit(2)
  }
  const compiled = (await q(`SELECT count(*)::bigint n FROM corpus_sections WHERE status='compiled'`))[0].n
  console.log(`corpus_sections compiled : ${Number(compiled).toLocaleString()}`)
  console.log('')

  if (!SELF_TEST_ONLY) {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    await p.query(sql)
    console.log('✓ schema.sql applied')
  }

  const cols = (await q(
    `SELECT column_name FROM information_schema.columns WHERE table_name='corpus_census' ORDER BY 1`))
    .map((x: any) => x.column_name)
  if (cols.length === 0) { console.error('⛔ corpus_census does not exist after apply'); process.exit(3) }
  console.log(`  columns: ${cols.join(', ')}`)
  console.log('')

  // ── the self-test. Every case runs inside its own aborted transaction, so a PASS writes nothing.
  console.log('── constraints, watched refusing ──────────────────────────────')
  let failures = 0
  for (const c of [...MUST_REJECT.map(x => ({ ...x, expect: 'reject' as const })),
                   { ...MUST_ACCEPT, expect: 'accept' as const }]) {
    const keys = Object.keys(c.row)
    const sql = `INSERT INTO corpus_census (${keys.map(k => `"${k}"`).join(',')})
                 VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`
    const client = await p.connect()
    let rejected = false; let msg = ''
    try {
      await client.query('BEGIN')
      await client.query(sql, keys.map(k => (c.row as any)[k]))
    } catch (e: any) { rejected = true; msg = (e.message || '').split('\n')[0] }
    finally { await client.query('ROLLBACK').catch(() => {}); client.release() }

    const ok = c.expect === 'reject' ? rejected : !rejected
    if (!ok) failures++
    const mark = ok ? '✓' : '✗'
    const what = c.expect === 'reject'
      ? (rejected ? `refused — ${msg.replace(/^.*violates /, '')}` : 'ACCEPTED IT — the constraint is not doing its job')
      : (rejected ? `REFUSED A VALID ROW — ${msg}` : 'accepted')
    console.log(`  ${mark} ${c.why}`)
    console.log(`      ${what}`)
  }
  console.log('')
  if (failures) { console.error(`⛔ ${failures} constraint case(s) behaved wrongly. The table is not trustworthy.`); process.exit(4) }
  console.log(`✓ ${MUST_REJECT.length} refusals and 1 acceptance, all as specified.`)
  await p.end()
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
