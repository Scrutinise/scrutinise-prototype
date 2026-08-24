/**
 * b3-partial-census.ts — C3 Lane B3. HOW MANY SECTIONS ARE PARTIALLY REPEALED?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT A USER WOULD SEE, AND WHY IT IS WORSE THAN THE B2 CASE
 *
 * A partially repealed section is LIVE LAW with holes in it — subsections have been removed and the
 * publisher marks them with a dot leader. Lex will quote it as the law, correctly, and can quote a
 * neighbouring subsection that no longer exists, with nothing to say so. The B2 case (a whole-body
 * dot leader) is obviously empty when you read it; this one reads exactly like current law, because
 * most of it IS current law.
 *
 * ⚠ NOBODY HAS EVER COUNTED THIS POPULATION. `section_repeals` holds 249,256 rows and every one
 * carries `evidence = 'dot-leader-placeholder'` — the whole-body case. C2 Lane 2 surfaced
 * "~35,895 partially-repealed sections" as an estimate and said plainly that nobody had counted
 * them. This is the count.
 *
 * ── WHY A SAMPLE, STATED BEFORE THE NUMBER ──────────────────────────────────────────────────────
 * The bodies are in R2 and in the Lance `corpus_fts` table, not in Postgres. An exact count needs
 * every legislation body scanned: a `body LIKE '%. . .%'` predicate over the 6 legislation
 * collections in `corpus_fts` was tried first and **did not return within 120 seconds**, and reading
 * ~1.6M bodies out of R2 is hours of object reads for a number that a sample settles.
 *
 * So this is a RANDOM STRATIFIED SAMPLE and the output says so in the same breath as the estimate.
 * The ids are drawn in Postgres (`ORDER BY random()`, per collection) and the bodies fetched from
 * `corpus_fts` by id — so the sample is random with respect to the corpus, not with respect to
 * storage order. Taking the first N rows of a Lance scan would have sampled the alphabetically
 * earliest instruments, which is not the same population.
 *
 * ⚠ ROWS ALREADY IN `section_repeals` ARE EXCLUDED FROM THE DENOMINATOR, because they are the other
 * population by definition and including them would inflate the partial rate with rows the B2 rule
 * already removes.
 *
 * ⚠ WRITES INCREMENTALLY — one JSON per collection as it completes, so a failure on collection six
 * does not lose the first five.
 *
 * Usage:
 *   tsx c2/b3-partial-census.ts                 # the census (default n=2000 per collection)
 *   tsx c2/b3-partial-census.ts --n=500
 *   tsx c2/b3-partial-census.ts --read=12       # print 12 real partial bodies, for the guard
 */
import fs from 'fs'
import path from 'path'
import { pool, OUT } from './db'
import { connectLance, FTS_TABLE } from '../search/lance'
import { isPartiallyRepealed, isRepealedPlaceholder } from '../shared/compile'

const arg = (k: string) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? '').split('=')[1] || null
const N = parseInt(arg('n') ?? '2000', 10)
const READ = arg('read') ? parseInt(arg('read')!, 10) : 0
const LEG = ['primary-acts-pre-2000', 'primary-acts-2000plus', 'si-pre-2010', 'si-2010plus', 'regional', 'retained-eu']
const OUTFILE = path.join(OUT, 'C3_b3_partial_census.json')
const n = (x: number) => x.toLocaleString('en-GB')
const esc = (s: string) => s.replace(/'/g, "''")

function batched<T>(a: T[], k: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < a.length; i += k) out.push(a.slice(i, i + k))
  return out
}

/** Wilson score interval — honest at the small proportions this measures, where the normal
 *  approximation gives a lower bound below zero and reads as precision it does not have. */
function wilson(k: number, total: number): [number, number] {
  if (total === 0) return [0, 0]
  const z = 1.96, p = k / total
  const d = 1 + (z * z) / total
  const c = p + (z * z) / (2 * total)
  const s = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)]
}

async function main() {
  const p = pool()
  const q = async (s: string, a: any[] = []) => (await p.query(s, a)).rows
  const db = await connectLance()
  const tbl = await db.openTable(FTS_TABLE)

  const results: any[] = []
  const examples: Array<{ id: string; corpus: string; body: string }> = []

  for (const corpus of LEG) {
    const live = (await q(
      `SELECT count(*)::int n FROM corpus_sections s WHERE s.corpus=$1 AND s.status='compiled'
         AND NOT EXISTS (SELECT 1 FROM section_repeals r WHERE r.section_id = s.id)`, [corpus]))[0].n
    const flagged = (await q(`SELECT count(*)::int n FROM section_repeals WHERE corpus=$1`, [corpus]))[0].n
    const ids: string[] = (await q(
      `SELECT s.id FROM corpus_sections s WHERE s.corpus=$1 AND s.status='compiled'
         AND NOT EXISTS (SELECT 1 FROM section_repeals r WHERE r.section_id = s.id)
       ORDER BY random() LIMIT $2`, [corpus, N])).map((r: any) => r.id)

    let partial = 0, hollow = 0, read = 0
    for (const b of batched(ids, 2000)) {
      const rows = await tbl.query()
        .where(`id IN (${b.map((i) => `'${esc(i)}'`).join(',')})`)
        .select(['id', 'corpus', 'body']).toArray() as any[]
      for (const r of rows) {
        const body = String(r.body ?? '')
        read++
        if (isRepealedPlaceholder(body)) { hollow++; continue }
        if (isPartiallyRepealed(body)) {
          partial++
          if (examples.length < 400) examples.push({ id: r.id, corpus: r.corpus, body })
        }
      }
    }
    const [lo, hi] = wilson(partial, read)
    const row = {
      corpus, liveUnflagged: live, alreadyFlaggedB2: flagged,
      sampled: ids.length, bodiesRead: read,
      partial, hollowFoundInUnflagged: hollow,
      rate: read ? partial / read : 0, ci95: [lo, hi],
      projected: Math.round((read ? partial / read : 0) * live),
      projected95: [Math.round(lo * live), Math.round(hi * live)],
    }
    results.push(row)
    console.log(`── ${corpus}`)
    console.log(`   unflagged live rows       ${n(live)}   (${n(flagged)} already flagged by B2)`)
    console.log(`   sampled / bodies read     ${n(ids.length)} / ${n(read)}${read < ids.length ? `   ⚠ ${n(ids.length - read)} ids not in corpus_fts — the index lags` : ''}`)
    console.log(`   partially repealed        ${n(partial)}  = ${(100 * row.rate).toFixed(2)}%  [95% CI ${(100 * lo).toFixed(2)}–${(100 * hi).toFixed(2)}%]`)
    if (hollow) console.log(`   ⚠ whole-body dot leaders found among rows B2 has NOT flagged: ${n(hollow)}`)
    console.log(`   → projected               ${n(row.projected)}   [${n(row.projected95[0])}–${n(row.projected95[1])}]\n`)
    // written after every collection, not at the end
    fs.writeFileSync(OUTFILE, JSON.stringify({ generated: new Date().toISOString(), sampleSize: N, results }, null, 2))
  }

  const totProj = results.reduce((s, r) => s + r.projected, 0)
  const totLo = results.reduce((s, r) => s + r.projected95[0], 0)
  const totHi = results.reduce((s, r) => s + r.projected95[1], 0)
  const totRead = results.reduce((s, r) => s + r.bodiesRead, 0)
  const totPart = results.reduce((s, r) => s + r.partial, 0)
  const totHollow = results.reduce((s, r) => s + r.hollowFoundInUnflagged, 0)
  console.log('─'.repeat(78))
  console.log(`PARTIALLY REPEALED, projected across the six legislation collections:`)
  console.log(`  ${n(totProj)}   [95% CI ${n(totLo)}–${n(totHi)}]   from ${n(totPart)} found in ${n(totRead)} bodies read`)
  console.log(`  C2 Lane 2's uncounted estimate was ~35,895.`)
  if (totHollow) {
    console.log(`\n⚠ ${n(totHollow)} of the bodies read are WHOLE-BODY dot leaders that section_repeals does NOT hold.`)
    console.log(`  B2's 249,256 is therefore a floor, not a total — projected miss:`)
    for (const r of results.filter((x) => x.hollowFoundInUnflagged > 0))
      console.log(`     ${r.corpus.padEnd(24)} ${n(Math.round((r.hollowFoundInUnflagged / r.bodiesRead) * r.liveUnflagged))}`)
  }
  fs.writeFileSync(OUTFILE, JSON.stringify({
    generated: new Date().toISOString(), sampleSize: N, results,
    totals: { projected: totProj, ci95: [totLo, totHi], found: totPart, bodiesRead: totRead, hollowMissedByB2: totHollow },
    examples: examples.slice(0, 60),
  }, null, 2))
  console.log(`\n${path.relative(process.cwd(), OUTFILE)}`)

  if (READ) {
    console.log(`\n=== ${Math.min(READ, examples.length)} REAL PARTIALLY-REPEALED BODIES ===`)
    for (const e of examples.slice(0, READ)) {
      console.log(`\n── ${e.id}`)
      console.log(`   ${e.body.replace(/\s+/g, ' ').slice(0, 300)}`)
    }
  }
  await p.end()
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
