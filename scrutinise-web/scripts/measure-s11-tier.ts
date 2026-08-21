/**
 * measure-s11-tier.ts — SEARCH S11 §1/§2. WHAT THE RE-TIER DOES TO RECALL, BEFORE IT IS BUILT.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * THE MEASUREMENT IS AVAILABLE WITHOUT THE REBUILD, AND THAT IS NOT AN APPROXIMATION.
 *
 * Moving a collection between tiers is a WRITE — the tier is baked into every row at index-build
 * time (corpus-map.ts, stream-scopes.ts) — so the obvious reading is that its effect cannot be
 * known until the index is rebuilt, i.e. that a heavy job has to run on a guess.
 *
 * It can be known. What a stream's main leg retrieves is `tier = X`, and the service accepts a
 * `corpora` prefilter over the same table. Crucially, **a prefilter SELECTS rows; it does not
 * rescore them** — BM25 term statistics are global to the table, so the score a document receives
 * is identical whether it was reached through `tier='guidance'` or through a corpus list naming its
 * collection (stream-scopes.ts states this property in the `debates` note, where it is the reason
 * an extra leg loses a merge). So:
 *
 *     ARM A (today)     corpora = every collection whose INDEXED tier is `guidance`
 *     ARM B (proposed)  corpora = the same list PLUS the re-tiered collections
 *
 * is an exact simulation of the guidance stream's main leg before and after the rebuild, taken
 * against the live index. Not a model of it — the same service, the same scores, the same ordering.
 *
 * ⚠ WHAT IT IS NOT. It measures the MAIN LEG only. It does not model the round-robin interleave
 * across streams (S10 measured that separately, and it costs six questions of 44), so these are
 * IN-STREAM recall numbers and are comparable with S10's in-stream column, not with its merged
 * 34%. Stating which is which is the whole reason S10's single recall number was split.
 *
 * ⚠ AND IT IS DENSE-OFF, deliberately. Mixing a scope change with a fusion change makes neither
 * readable — S10's guidance measurement made the same choice for the same reason.
 *
 * ── WHY THIS MATTERS TO THE DECISION ────────────────────────────────────────────────────────────
 *
 * BRIEF_SEARCH_S11 §1 warns "do not put everything in `guidance` to make the number go up", citing
 * S10: admitting `cps-guidance` cost consultations two answers, because `mergeLegs` divides a fixed
 * budget. ⚠ That measurement is of the EXTRA-LEG mechanism, and the tier move is a different one —
 * in the main leg there is no second list and no budget to divide, which is exactly why
 * stream-scopes.ts calls the tier move the fix that "trades nothing".
 *
 * "Trades nothing" is itself a claim, and this is the instrument that tests it: 45,295 more
 * sections competing in one ranking can still displace documents that were being returned. The
 * difference from the extra-leg case is that displacement here has to be EARNED on score rather
 * than taken from a quota. Whether it happens is measured below, per collection, with n.
 *
 * Usage:  npx tsx --env-file=.env scripts/measure-s11-tier.ts [--top=20]
 */
import fs from 'node:fs'
import path from 'node:path'
import { SCOREABLE } from './gold/s10-gold-set'

export {}

const FTS = process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production-4cea.up.railway.app'
const TOP = (() => {
  const a = process.argv.find((x) => x.startsWith('--top='))
  return a ? parseInt(a.split('=')[1], 10) : 20
})()

/** The 20 collections the live index has under tier `guidance` — read from the matrix this sprint
 *  regenerated, not typed from memory. */
const TIER_GUIDANCE_TODAY = [
  'building-regs', 'college-of-policing', 'consultations', 'fca-handbook', 'govuk-core-docs',
  'hmrc-ancillary', 'hmrc-codes-guidance', 'hmrc-manuals', 'hmrc-tiins', 'ico', 'inquiry-reports',
  'lawcom', 'nao-reports', 'nilawcom', 'oecd', 'ots-reports', 'planning-policy', 'quangos-govuk',
  'scotlawcom', 'sentencing-council',
]

/** The seven the S11 mapping proposes to move into `guidance`. `erskine-may` is deliberately NOT
 *  here: it is already reachable through the guidance stream's extra leg and its tier is a separate
 *  decision (see the report — parliamentary procedure is not regulator guidance). */
const PROPOSED_INTO_GUIDANCE = [
  'cma-cases', 'ofgem', 'ofcom', 'independent-reviews', 'cps-guidance', 'inquiry-evidence', 'lgsco',
]

interface Hit { id: string; corpus: string; tier: string; sectionTitle: string | null; score: number }

async function fts(query: string, corpora: string[]): Promise<Hit[]> {
  const res = await fetch(`${FTS.replace(/\/$/, '')}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit: TOP, corpora }),
  })
  if (!res.ok) throw new Error(`fts ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return ((await res.json()) as { results?: Hit[] }).results ?? []
}

async function main() {
  const routes = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'gold', 's10-routes.json'), 'utf8'),
  ) as Record<string, Record<string, string>>

  // Only the questions this stream can answer at all. Scoring a legislation question against the
  // guidance leg would measure the routing, not the tier.
  const subjects = SCOREABLE.filter(
    (q) => (q.collection === 'guidance' || q.collection === 'consultations') && q.scoring !== 'negative-control')

  console.log('═'.repeat(112))
  console.log('SEARCH S11 — IN-STREAM RECALL@' + TOP + ' FOR THE `guidance` MAIN LEG, BEFORE AND AFTER THE RE-TIER')
  console.log('═'.repeat(112))
  console.log(`  service : ${FTS}`)
  console.log(`  ARM A   : ${TIER_GUIDANCE_TODAY.length} collections (tier \`guidance\` as built today)`)
  console.log(`  ARM B   : + ${PROPOSED_INTO_GUIDANCE.join(', ')}`)
  console.log(`  n       : ${subjects.length} validated questions (${subjects.filter((q) => q.collection === 'guidance').length} guidance, ${subjects.filter((q) => q.collection === 'consultations').length} consultations)`)
  console.log('  dense OFF; main leg only; BM25 scores are global so the two arms differ ONLY in which')
  console.log('  rows are eligible.\n')

  const armB = [...TIER_GUIDANCE_TODAY, ...PROPOSED_INTO_GUIDANCE]
  const per = new Map<string, { a: number; b: number; n: number }>()
  const rows: string[] = []
  let aHit = 0, bHit = 0

  for (const q of subjects) {
    // The guidance stream's own rewritten query, as the live router produced it during S10's
    // retrieval pass. Using the raw question instead would measure a query nobody issues.
    const query = routes[String(q.n)]?.guidance
    if (!query) { console.log(`  Q${q.n} skipped — no guidance leg in the stored route`); continue }

    const [a, b] = await Promise.all([fts(query, TIER_GUIDANCE_TODAY), fts(query, armB)])
    const rank = (hits: Hit[]) => {
      const i = hits.findIndex((h) => q.keys.some((k) => h.id === k || h.id.startsWith(k)))
      return i
    }
    const ra = rank(a), rb = rank(b)
    const hitA = ra >= 0, hitB = rb >= 0
    if (hitA) aHit++
    if (hitB) bHit++
    const p = per.get(q.collection) ?? { a: 0, b: 0, n: 0 }
    p.n++; if (hitA) p.a++; if (hitB) p.b++
    per.set(q.collection, p)

    // How much of the new material actually arrived — the other half of the story. A question can
    // stay a hit while its list fills with the new collections, which is what displacement looks
    // like one question before it costs an answer.
    const newRows = b.filter((h) => PROPOSED_INTO_GUIDANCE.includes(h.corpus)).length
    const move = hitA === hitB ? (ra === rb ? '' : `rank ${ra}→${rb}`) : hitB ? '  ✅ RECOVERED' : '  ⚠⚠ LOST'
    rows.push(`  Q${String(q.n).padEnd(3)} ${q.collection.padEnd(14)} A=${hitA ? `hit@${ra}` : 'miss'.padEnd(6)}  B=${hitB ? `hit@${rb}` : 'miss'.padEnd(6)}  new-in-top${TOP}=${String(newRows).padStart(2)}${move}`)
    console.log(rows[rows.length - 1])
  }

  console.log('\n' + '─'.repeat(112))
  console.log(`  OVERALL in-stream recall@${TOP}:  ARM A ${aHit}/${subjects.length}  →  ARM B ${bHit}/${subjects.length}` +
    `  (${bHit > aHit ? '+' : ''}${bHit - aHit})`)
  console.log('\n  per collection:')
  for (const [c, p] of per) {
    const delta = p.b - p.a
    console.log(`    ${c.padEnd(16)} ${p.a}/${p.n} → ${p.b}/${p.n}   ${delta > 0 ? `+${delta} ✅` : delta < 0 ? `${delta} ⚠⚠ REGRESSION` : '0 (unchanged)'}`)
  }
  console.log('─'.repeat(112))
  console.log('  ⚠ In-stream. The merged number a user sees is lower — the round-robin interleave across')
  console.log('    streams costs six questions of 44 on its own (S10), and that is unchanged by this.')
}

main().catch((e) => { console.error(e); process.exit(1) })
