/**
 * e1-drop-ftsvector.ts — LANE E1. Drop `corpus_sections."ftsVector"`.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER WOULD HAVE SEEN — nothing. That is the point. The column has never been readable.
 *
 * MEASURED BEFORE WRITING THIS (c3-e1-audit.ts, 24 Aug 2026, Neon ep-old-dust-aboxi69a):
 *   · 1,178 MB across 683,153 of 18,521,194 rows (3.7%) — 6.2% of an 18 GB database.
 *   · **There is NO index on the column.** Postgres cannot answer `@@` from it without a
 *     sequential scan of 18.5M rows, so it was never a search path — the five indexes that do
 *     exist are all btree, on id / corpus / parentDocId / notes / availability_status.
 *   · The maintaining trigger function is a NO-OP: `BEGIN RETURN NEW; END;`. It was gutted when
 *     `compiledText` was dropped (drop-compiled-text-col.ts) and has written nothing since, which
 *     is why 96.3% of rows are null. The 683,153 non-null values are fossils of a 2026 build.
 *   · The serving path is LanceDB (`corpus_fts` on R2, 18.27M rows, an FTS index on `body`).
 *     `scrutinise-web/lib/search.ts` reads `ls."ftsVector"` and `os."ftsVector"` — those are
 *     `LegislationSection` and `OperationalSection`, DIFFERENT TABLES, and are NOT touched here.
 *
 * ⚠ THE GUARD IS THE POINT, AND IT MUST BE ABLE TO FAIL. This script re-derives all three facts
 * against the live database and REFUSES to drop if any of them has changed since the audit —
 * an index appearing on the column, or the trigger function ceasing to be a no-op, both mean
 * somebody started using it and the drop must stop. Watched failing: run with
 * `--simulate-index-exists` to see the guard reject a healthy database.
 *
 * ⚠ DROP COLUMN IN POSTGRES IS METADATA-ONLY. It does not return the 1,178 MB to the operating
 * system; the space is reused by future rows as pages are rewritten. Reported honestly at the end
 * rather than claimed as a shrink.
 *
 * Usage:
 *   tsx c2/e1-drop-ftsvector.ts                        # audit + guard only, no writes
 *   tsx c2/e1-drop-ftsvector.ts --execute              # drop trigger, function, column
 *   tsx c2/e1-drop-ftsvector.ts --simulate-index-exists  # prove the guard fires
 */
import { pool } from './db'

const EXECUTE = process.argv.includes('--execute')
const SIM_INDEX = process.argv.includes('--simulate-index-exists')

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  const url = process.env.NEON_DATABASE_URL_NO_POOLED || process.env.NEON_DATABASE_URL || ''
  console.log(`host: ${url.replace(/^[^@]*@/, '').split('/')[0]}   db: ${(await q('SELECT current_database() d'))[0].d}`)
  console.log('')

  // ── fact 1: the column still exists
  const col = await q(`SELECT data_type FROM information_schema.columns
                        WHERE table_name='corpus_sections' AND column_name='ftsVector'`)
  if (col.length === 0) { console.log('✓ already dropped — nothing to do.'); await p.end(); return }
  console.log(`fact 1  column present, type ${col[0].data_type}`)

  // ── fact 2: nothing indexes it
  const idxDefs = await q(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='corpus_sections'`)
  const onCol = idxDefs.filter((r: any) => /ftsVector/i.test(r.indexdef))
  const indexed = SIM_INDEX ? [{ indexname: '(simulated) corpus_sections_fts_gin', indexdef: 'GIN ("ftsVector")' }] : onCol
  console.log(`fact 2  indexes on the column: ${indexed.length}   (${idxDefs.length} indexes on the table in total)`)
  for (const r of indexed) console.log(`          ${r.indexname}  ${r.indexdef}`)

  // ── fact 3: the trigger function is a no-op
  const fn = (await q(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='corpus_sections_fts_update'`))[0]?.d ?? ''
  const bodyOnly = fn.replace(/\s+/g, ' ')
  const isNoop = /BEGIN RETURN NEW; END;/.test(bodyOnly)
  console.log(`fact 3  trigger function is a no-op: ${isNoop ? 'yes' : 'NO'}`)
  if (!isNoop && fn) console.log(`          ${bodyOnly.slice(0, 200)}`)

  // ── fact 4: the size this reclaims from future pages
  const s = (await q(`SELECT count(*) FILTER (WHERE "ftsVector" IS NOT NULL)::bigint nonnull, count(*)::bigint total,
                              pg_size_pretty(coalesce(sum(pg_column_size("ftsVector")),0)) sz FROM corpus_sections`))[0]
  console.log(`fact 4  ${Number(s.nonnull).toLocaleString()} of ${Number(s.total).toLocaleString()} rows carry a value, ${s.sz}`)
  console.log('')

  const blockers: string[] = []
  if (indexed.length > 0) blockers.push(`${indexed.length} index(es) exist on the column — something reads it`)
  if (!isNoop) blockers.push('the trigger function is no longer a no-op — something writes it')
  if (blockers.length) {
    console.log('⛔ REFUSING TO DROP:')
    for (const b of blockers) console.log(`   · ${b}`)
    console.log('   The audit this script was written against no longer describes the database. Stop and re-audit.')
    process.exitCode = 1
    await p.end(); return
  }
  console.log('✓ guard passes — the column is write-only, unindexed, and unmaintained.')

  if (!EXECUTE) {
    console.log('\nDRY RUN — nothing written. Would run:')
    console.log('   DROP TRIGGER corpus_sections_fts_trigger ON corpus_sections')
    console.log('   DROP FUNCTION corpus_sections_fts_update()')
    console.log('   ALTER TABLE corpus_sections DROP COLUMN "ftsVector"')
    console.log('Pass --execute to perform.')
    await p.end(); return
  }

  const before = (await q(`SELECT pg_database_size(current_database())::bigint b`))[0].b
  console.log('\n⚠ EXECUTE')
  await p.query(`DROP TRIGGER IF EXISTS corpus_sections_fts_trigger ON corpus_sections`)
  console.log('   trigger dropped')
  await p.query(`DROP FUNCTION IF EXISTS corpus_sections_fts_update()`)
  console.log('   function dropped')
  await p.query(`ALTER TABLE corpus_sections DROP COLUMN IF EXISTS "ftsVector"`)
  console.log('   column dropped')

  const gone = (await q(`SELECT 1 FROM information_schema.columns WHERE table_name='corpus_sections' AND column_name='ftsVector'`)).length === 0
  const after = (await q(`SELECT pg_database_size(current_database())::bigint b`))[0].b
  console.log(`\n   column gone: ${gone ? '✓' : '⚠ STILL PRESENT'}`)
  console.log(`   database size ${(Number(before) / 2 ** 30).toFixed(2)} GiB → ${(Number(after) / 2 ** 30).toFixed(2)} GiB`)
  console.log('   ⚠ DROP COLUMN is metadata-only: the 1,178 MB is now free space inside the table,')
  console.log('     reused as rows are rewritten. It is not returned to Neon and the billed size')
  console.log('     will not fall today. What HAS changed is that no future row can add to it.')
  await p.end()
}
main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
