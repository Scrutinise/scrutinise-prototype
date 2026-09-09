/**
 * l2-et-unretire.ts — put back the `et-decisions` target row that l2-purge wrongly retired.
 *
 * WHY: the purge target `et-decisions-landing` removes only
 *   `corpus = 'et-decisions' AND format = 'html'` (the 131,650 GOV.UK landing pages),
 * but the retire step keys off `t.corpus`, so it retired and blocked the WHOLE
 * `et-decisions` collection — including the 161,749 judgment PDFs that were kept
 * deliberately.
 *
 * Read-only unless --execute. Prints the row before and after, from a fresh read.
 */
import { pool } from './db'

const EXECUTE = process.argv.includes('--execute')
const KEY = 'et-decisions'

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows

  const who = await q(`select current_database() db, version() v`)
  console.log(`DB: ${who[0].db}  ${String(who[0].v).slice(0, 30)}`)

  const cols = await q(
    `select column_name from information_schema.columns
      where table_name = 'corpus_targets' order by ordinal_position`)
  console.log(`corpus_targets columns: ${cols.map((c: any) => c.column_name).join(', ')}`)
  console.log('')

  const before = await q(`select * from corpus_targets where corpus_key = $1`, [KEY])
  if (before.length !== 1) {
    console.log(`⚠ expected exactly 1 row for corpus_key='${KEY}', found ${before.length}. Stopping.`)
    await p.end(); process.exit(1)
  }
  console.log('BEFORE:', JSON.stringify(before[0], null, 2))

  // what the collection actually holds, so the un-retirement is justified in the same breath
  const shape = await q(
    `select format, count(*)::int n from corpus_sections where corpus = $1 group by format order by n desc`, [KEY])
  console.log('\ncorpus_sections still held under this corpus:')
  for (const r of shape) console.log(`   format=${r.format ?? 'null'}: ${r.n.toLocaleString()}`)

  if (!EXECUTE) {
    console.log('\nDRY RUN — pass --execute to set retired=false, blocked=false.')
    await p.end(); return
  }

  const upd = await p.query(
    `UPDATE corpus_targets SET retired = false, blocked = false WHERE corpus_key = $1`, [KEY])
  console.log(`\nUPDATE touched ${upd.rowCount} row(s).`)

  // re-read, and report the re-read — not the intent
  const after = await q(`select * from corpus_targets where corpus_key = $1`, [KEY])
  console.log('AFTER (fresh read):', JSON.stringify(after[0], null, 2))
  const ok = after[0].retired === false && after[0].blocked === false
  console.log(ok
    ? `\n✓ CONFIRMED from the re-read: retired=${after[0].retired}, blocked=${after[0].blocked}`
    : `\n⚠ NOT CONFIRMED: retired=${after[0].retired}, blocked=${after[0].blocked}`)
  await p.end()
  if (!ok) process.exit(1)
}

main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
