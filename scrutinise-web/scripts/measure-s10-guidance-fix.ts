/**
 * measure-s10-guidance-fix.ts — S10 §1. THE BEFORE-AND-AFTER FOR THE `cps-guidance` SCOPE CHANGE.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY A SCOPE CHANGE SHIPS WITH A MEASUREMENT AND NOT AS A CONFIG LINE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `stream-scopes.ts` sets the precedent in its own comments: adding `scottish-parliament-or` to the
 * debates stream "changes what the debates stream returns for every query", so it "shipped WITH a
 * before-and-after, not as a config line". Adding `cps-guidance` to the guidance stream is the same
 * kind of act on a smaller collection, and gets the same treatment.
 *
 * THE BEFORE ARM IS NOT RE-RUN. It is read from `s10-legs.json` — the ranked lists the live
 * gateway produced during the one retrieval pass, before this entry existed. Re-running it now
 * would be impossible anyway: the scope is a module constant and the entry is in it. Comparing a
 * fresh AFTER against a recorded BEFORE is the only honest shape available, and the risk it carries
 * is index drift between the two runs — stated here rather than left implicit, and small over the
 * minutes involved.
 *
 * ⚠ IT MEASURES BOTH COLLECTIONS THE STREAM SERVES, NOT JUST THE ONE BEING FIXED. Q41–Q49
 * (consultations) also come through the guidance stream and were scoring 8/9. An extra leg merges
 * into the same ranking, so the question that matters is not only "does CPS guidance arrive" but
 * "does it push consultations out". A change that fixed one collection by breaking another would
 * look like a win in any table that only reported the collection being fixed.
 *
 * Usage:  FTS_SEARCH_URL=… npx tsx --env-file=.env scripts/measure-s10-guidance-fix.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { streams } from '../lib/lex/query-router'
import { SCOREABLE } from './gold/s10-gold-set'

export {}

const DIR = path.join(__dirname, 'gold')
const LEGS = path.join(DIR, 's10-legs.json')
const ROUTES = path.join(DIR, 's10-routes.json')

interface StoredLeg { stream: string; bm25: string[]; vector: string[]; weight: number }
interface StoredQuestion { n: number; code: string; collection: string; legs: StoredLeg[]; routedStreams: string[] }

async function main() {
  const legs = JSON.parse(fs.readFileSync(LEGS, 'utf8')) as { questions: StoredQuestion[] }
  const routes = JSON.parse(fs.readFileSync(ROUTES, 'utf8')) as Record<string, Record<string, string>>

  const guidance = streams().find((s) => s.name === 'guidance')!
  console.log('═'.repeat(100))
  console.log('S10 — BEFORE/AFTER: adding `cps-guidance` to the guidance stream\'s extraCorpora')
  console.log('═'.repeat(100))
  console.log(`  scope now: tier=${guidance.tier} extraCorpora=${JSON.stringify(guidance.extraCorpora)}`)
  console.log('  BEFORE = the ranked lists the live gateway produced during the retrieval pass, when the')
  console.log('           scope was extraCorpora=["erskine-may"]. AFTER = a fresh call, same cached query.')
  console.log('  ⚠ dense OFF for this comparison, so the only thing that differs between the arms is the')
  console.log('    extra BM25 leg. Mixing a scope change with a fusion change would make neither readable.')
  process.env.LEX_VECTOR_STREAMS = ''

  // Both collections the guidance stream serves.
  const subjects = SCOREABLE.filter((q) => q.collection === 'guidance' || q.collection === 'consultations')

  let beforeHit = 0, afterHit = 0
  const rows: string[] = []
  for (const q of subjects) {
    const stored = legs.questions.find((s) => s.n === q.n)!
    const query = routes[String(q.n)]?.guidance
    if (!query) {
      rows.push(`  Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} ${q.collection.padEnd(14)} guidance stream was NOT routed for this question — excluded from both arms`)
      continue
    }
    const beforeIds = stored.legs.find((l) => l.stream === 'guidance')?.bm25 ?? []
    const after = await guidance.search(query, 20)
    const afterIds = after.map((r) => r.id)

    const rank = (ids: string[]) => {
      const rs = q.keys.map((k) => { const i = ids.indexOf(k); return i < 0 ? Infinity : i })
      return Math.min(...rs)
    }
    const b = rank(beforeIds)
    const a = rank(afterIds)
    if (b < 20) beforeHit++
    if (a < 20) afterHit++
    const fmt = (x: number) => (x === Infinity ? '  —' : String(x).padStart(3))
    const verdict = a < 20 && b >= 20 ? ' ✓ RECOVERED' : b < 20 && a >= 20 ? ' ✗ LOST' : ''
    rows.push(`  Q${String(q.n).padStart(2)} ${q.code.padEnd(4)} ${q.collection.padEnd(14)} in-stream rank  before=${fmt(b)}  after=${fmt(a)}   (${beforeIds.length}→${afterIds.length} results)${verdict}`)
  }
  for (const r of rows) console.log(r)

  console.log('\n  ── per collection ──')
  for (const c of ['guidance', 'consultations']) {
    const qs = subjects.filter((q) => q.collection === c)
    let b = 0, a = 0
    for (const q of qs) {
      const stored = legs.questions.find((s) => s.n === q.n)!
      const query = routes[String(q.n)]?.guidance
      if (!query) continue
      const beforeIds = stored.legs.find((l) => l.stream === 'guidance')?.bm25 ?? []
      const after = await guidance.search(query, 20)
      const rank = (ids: string[]) => Math.min(...q.keys.map((k) => { const i = ids.indexOf(k); return i < 0 ? Infinity : i }))
      if (rank(beforeIds) < 20) b++
      if (rank(after.map((r) => r.id)) < 20) a++
    }
    console.log(`  ${c.padEnd(16)} in-stream recall@20  before ${b}/${qs.length}  →  after ${a}/${qs.length}`)
  }
  console.log(`\n  TOTAL across both collections: before ${beforeHit} → after ${afterHit}`)
  console.log('\n  ⚠ THE CONSULTATIONS ROW IS THE ONE THAT DECIDES THIS. If it fell, the change bought one')
  console.log('    collection at another\'s expense and should be reverted rather than reported as a gain.')
}

main().catch((e) => { console.error(e); process.exit(1) })
