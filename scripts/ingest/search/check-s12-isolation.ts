/**
 * check-s12-isolation.ts — DID A REPLACE TOUCH ANYTHING IT SHOULD NOT HAVE? SEARCH S12 §1/§6.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE POINT, IN THE BRIEF'S OWN WORDS: *"a boundary shift is invisible in the collection you touched
 * and visible only in the ones you did not."* So the interesting assertion is never about the
 * collection being replaced — it is about the other 73.
 *
 * ⚠⚠ AND IT IS ASSERTED OVER THE WHOLE POPULATION, NOT A SAMPLE — S12 §6. Three sprints running
 * produced a check that could not fail because a harness looked only at the top N while the
 * counter-examples sat below the cut. A sample of "some documents from other collections" has the
 * same defect in a different costume: the collections most at risk are the ones that sort AFTER the
 * replaced one, and a random sample would mostly miss them (they are 0.31% of the table). So this
 * counts EVERY chunk and EVERY vector in EVERY collection, and prints the population it covered.
 *
 * It also names the collections that sort after the replaced one and checks them individually,
 * because those are the ones the ordinal-shift theory predicts would break — a check that only
 * reported a total could pass while two small collections were destroyed and one large one grew.
 *
 * Usage:
 *   npx tsx search/check-s12-isolation.ts --snapshot before.json
 *   npx tsx search/check-s12-isolation.ts --compare before.json --except tna-caselaw
 */
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { connectLance } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'

const ARGS = process.argv.slice(2)
const arg = (k: string) => ARGS.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const SNAPSHOT = arg('snapshot') ?? (ARGS.includes('--snapshot') ? ARGS[ARGS.indexOf('--snapshot') + 1] : null)
const COMPARE = arg('compare') ?? (ARGS.includes('--compare') ? ARGS[ARGS.indexOf('--compare') + 1] : null)
const EXCEPT = (arg('except') ?? (ARGS.includes('--except') ? ARGS[ARGS.indexOf('--except') + 1] : '') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

const n = (v: number) => Number(v).toLocaleString('en-GB')

interface Snap { takenAt: string; chunks: Record<string, number>; vecs: Record<string, number>; totals: { chunks: number; vecs: number } }

async function tally(table: string, field = 'corpus'): Promise<Record<string, number>> {
  const db = await connectLance()
  const t = await db.openTable(table)
  const expected = await t.countRows()
  const out: Record<string, number> = {}
  let scanned = 0
  for await (const b of t.query().select([field]) as any) {
    const c = b.getChild(field)
    for (let i = 0; i < b.numRows; i++) { const k = String(c.get(i) ?? ''); out[k] = (out[k] ?? 0) + 1 }
    scanned += b.numRows
  }
  // A short scan under-counts every collection at once, which would read as "everything shrank"
  // — or, if it stopped early, as "everything matched". Refuse either.
  if (scanned !== expected) throw new Error(`${table}: countRows()=${expected} but scanned ${scanned}. Refusing to report on a partial read.`)
  console.log(`  ${table}: scanned ${n(scanned)} rows (100% of the table), ${Object.keys(out).length} collections`)
  return out
}

async function take(): Promise<Snap> {
  const chunks = await tally(CHUNKS_TABLE)
  const vecs = await tally(VEC_TABLE)
  return {
    takenAt: new Date().toISOString(), chunks, vecs,
    totals: {
      chunks: Object.values(chunks).reduce((a, b) => a + b, 0),
      vecs: Object.values(vecs).reduce((a, b) => a + b, 0),
    },
  }
}

async function main() {
  console.log('═'.repeat(100))
  console.log('S12 ISOLATION — did the replace disturb any collection it did not name?')
  console.log('═'.repeat(100))

  if (SNAPSHOT) {
    const s = await take()
    fs.writeFileSync(SNAPSHOT, JSON.stringify(s, null, 2))
    console.log(`\n  wrote ${SNAPSHOT}`)
    console.log(`  totals: ${n(s.totals.chunks)} chunks · ${n(s.totals.vecs)} vectors`)
    process.exit(0)
  }

  // ── --drift: the vector side of S12 §5 ─────────────────────────────────────────────────────
  // S11 closed the KEYWORD side (`fts-drift.ts`: database vs `corpus_fts`). The MEANING side had
  // no equivalent, and it has its own divergence: `corpus_chunks` and `corpus_vec` are written by
  // different phases and nothing asserted they agree. A collection with more chunks than vectors is
  // half-embedded; more vectors than chunks is the orphan state that makes a section retrievable
  // on a passage it no longer contains. Both are invisible in any count of either table alone.
  //
  // ⚠ Whole population, per collection — not a total. A total nets a shortfall in one collection
  // against a surplus in another and reports zero.
  if (ARGS.includes('--drift')) {
    const chunks = await tally(CHUNKS_TABLE)
    const vecs = await tally(VEC_TABLE)
    const all = [...new Set([...Object.keys(chunks), ...Object.keys(vecs)])].sort()
    const bad = all.filter((c) => (chunks[c] ?? 0) !== (vecs[c] ?? 0))
    console.log('')
    for (const c of bad) {
      const d = (vecs[c] ?? 0) - (chunks[c] ?? 0)
      console.log(`  ⚠⚠ ${c.padEnd(26)} chunks ${n(chunks[c] ?? 0)} vs vectors ${n(vecs[c] ?? 0)}  ` +
        `(${d > 0 ? `${n(d)} ORPHAN vectors — retrievable on passages that no longer exist` : `${n(-d)} UN-EMBEDDED chunks`})`)
    }
    console.log('\n' + '─'.repeat(100))
    console.log(`  collections checked: ${all.length} (every collection in either table, no sampling)`)
    console.log(`  diverged: ${bad.length === 0 ? '0  ✅ chunks and vectors agree everywhere' : `${bad.length}  ❌`}`)
    console.log('─'.repeat(100))
    process.exit(bad.length ? 1 : 0)
  }

  if (!COMPARE) { console.error('pass --snapshot <file>, --compare <file> or --drift'); process.exit(2) }

  const before = JSON.parse(fs.readFileSync(COMPARE, 'utf8')) as Snap
  const after = await take()
  console.log(`\n  before: ${before.takenAt}   after: ${after.takenAt}`)
  console.log(`  exempt (deliberately changed): ${EXCEPT.join(', ') || '(none)'}\n`)

  const all = [...new Set([...Object.keys(before.chunks), ...Object.keys(after.chunks), ...Object.keys(before.vecs), ...Object.keys(after.vecs)])].sort()
  const moved: string[] = []
  for (const c of all) {
    const bc = before.chunks[c] ?? 0, ac = after.chunks[c] ?? 0
    const bv = before.vecs[c] ?? 0, av = after.vecs[c] ?? 0
    if (bc === ac && bv === av) continue
    const exempt = EXCEPT.includes(c)
    const line = `${exempt ? '  (expected)' : '  ⚠⚠ UNEXPECTED'} ${c.padEnd(26)} chunks ${n(bc)} → ${n(ac)}   vectors ${n(bv)} → ${n(av)}`
    console.log(line)
    if (!exempt) moved.push(c)
  }

  // The collections the ordinal-shift theory predicts are at risk: those sorting AFTER the
  // replaced one. Named and checked individually so a clean total cannot hide them.
  if (EXCEPT.length) {
    const pivot = EXCEPT[0]
    const after_pivot = all.filter((c) => c > pivot && !EXCEPT.includes(c))
    console.log(`\n  collections sorting AFTER '${pivot}' (the ones an ordinal shift would hit), checked by name:`)
    for (const c of after_pivot) {
      const same = (before.chunks[c] ?? 0) === (after.chunks[c] ?? 0) && (before.vecs[c] ?? 0) === (after.vecs[c] ?? 0)
      console.log(`    ${same ? '✅' : '❌'} ${c.padEnd(26)} ${n(after.chunks[c] ?? 0)} chunks · ${n(after.vecs[c] ?? 0)} vectors`)
    }
    if (!after_pivot.length) console.log('    (none — the replaced collection sorts last)')
  }

  console.log('\n' + '─'.repeat(100))
  console.log(`  collections compared: ${all.length} (every collection in either table)`)
  console.log(`  unexpectedly changed: ${moved.length === 0 ? '0  ✅' : `${moved.length}  ❌  ${moved.join(', ')}`}`)
  console.log('─'.repeat(100))
  process.exit(moved.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
