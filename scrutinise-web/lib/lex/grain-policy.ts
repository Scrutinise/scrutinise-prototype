// grain-policy.ts — SEARCH S19 §3. THE PER-COLLECTION GRAIN SETTING, AND THE LENGTH FLOOR.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// WHAT §2 MEASURED, WHICH IS THE ONLY REASON THIS FILE EXISTS
// ════════════════════════════════════════════════════════════════════════════════════════════════
// Charlie's validated questions, BM25 scoped to the key's own collection, depth 500, recall@20
// (`docs/census/s19-grain.json`, 2026-09-09):
//
//   collection            n   section   document(collapse)
//   committees           10      0/10          3/10
//   caselaw               6       3/6           3/6     ⚠ one document IS one section here
//   guidance             10      8/10          8/10     ⚠ same
//   impact-assessments    9       0/9           6/9
//   consultations         9       8/9           8/9     ⚠ same
//   debates              11      2/11          7/11
//   legislation          10      2/10          6/10
//   ─────────────────────────────────────────────────
//   ALL                  65     23/65         41/65
//
// So the unit is worth **eighteen questions of sixty-five**, and it is worth them in FOUR
// collections and worth exactly nothing in three — which is why this is a per-collection setting
// and not a switch. A single global grain would be wrong for three collections by construction.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ THE DEFAULT IS TODAY'S BEHAVIOUR AND THE MODULE IS A NO-OP UNTIL A GRAIN IS SET
// ════════════════════════════════════════════════════════════════════════════════════════════════
// The brief's own requirement: "defaulting to today's behaviour so the change is a no-op until a
// grain is set — nothing widened before it is measured". With `LEX_SEARCH_GRAIN` unset,
// `applyGrain` returns the array it was given, by reference. `check:s19-grain` asserts that by
// comparing rankings, not by reading this sentence.
//
// ⚠ THE FLAG IS READ THROUGH `flagEnabled()`, never a bare `=== 'true'` — CLAUDE.md §18's own
// example is two capabilities that were off for weeks because Vercel held `TRUE`.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ AND THE THING THE DOCUMENT-GRAIN NUMBER DOES NOT SAY
// ════════════════════════════════════════════════════════════════════════════════════════════════
// "The right document came back" is not "the user is shown the right passage". A debates document
// is a 318-speech sitting day; `historic-hansard`'s is a 1,153-section VOLUME. §2 therefore
// measured a fourth number — the key's rank in a list of the top documents each rendered as its
// own best-scoring section, which is exactly what this module returns — and THAT is the number
// this setting should be judged on. It is reported per collection in `docs/SEARCH_S19_REPORT.md`
// and it is lower than the document number. Retrieving at document grain and displaying the
// document is not a thing this file will do.

import type { SearchResult } from './page1-config'
import { flagEnabled } from '@/lib/env-flags'
import { documentKeyOf, type Grain } from './grain'

/** `LEX_SEARCH_GRAIN=impact-assessments:document,debates:document`. Unset = every collection keeps
 *  `section`, i.e. today. Parsed on every call rather than cached: a cached parse is how a flag
 *  flip in Vercel takes effect on some instances and not others, and the parse is a string split. */
export function grainMap(): Record<string, Grain> {
  if (!flagEnabled('LEX_SEARCH_GRAIN')) return {}
  const raw = process.env.LEX_SEARCH_GRAIN_MAP ?? ''
  const out: Record<string, Grain> = {}
  for (const pair of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [corpus, grain] = pair.split(':').map((s) => s.trim())
    // ⚠ An unrecognised grain is REFUSED and named, not silently treated as `section`. That is the
    // §18 rule: "I set the flag and nothing happened" is the failure being designed against.
    if (!corpus) continue
    if (grain === 'document' || grain === 'section' || grain === 'chunk') out[corpus] = grain
    else console.warn(`[grain-policy] LEX_SEARCH_GRAIN_MAP has ${JSON.stringify(pair)} — ${JSON.stringify(grain)} is not one of section|document|chunk; this collection keeps section`)
  }
  return out
}

/** The retrieval-side minimum length, in words. 0 = off, which is today.
 *
 *  ⚠ AT RETRIEVAL, NOT AT DISPLAY, and the brief is explicit about why: "a fragment that wins a
 *  slot has already displaced a real passage; hiding it afterwards does not give the slot back."
 *
 *  ⚠⚠ AND §2 MEASURED THAT THIS IS NOT A SPARSE-ARM PROBLEM. Over the BM25 arm's top 20, the
 *  median returned debates section is 549 words and 0% are under 30 — the opposite of ARGUMENT
 *  1A's dense-arm finding (48.8% under 30 words, median 32). BM25 rewards term frequency, so it
 *  prefers LONG sections. The floor is therefore built and left OFF, and the report says the arm
 *  it would act on is the dense one. */
export function minWordFloor(): number {
  if (!flagEnabled('LEX_SEARCH_GRAIN')) return 0
  const n = parseInt(process.env.LEX_SEARCH_MIN_WORDS ?? '0', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** True when this module can change any ranking at all. Reporting only — a caller that logs this
 *  can tell "the grain policy is off" from "the grain policy ran and changed nothing", which
 *  CLAUDE.md §18's corollary says must never be the same object. */
export function grainPolicyActive(): boolean {
  return flagEnabled('LEX_SEARCH_GRAIN') && (Object.keys(grainMap()).length > 0 || minWordFloor() > 0)
}

export interface GrainOutcome {
  results: SearchResult[]
  /** What the policy did, for `meta` and for the log. `null` when it did nothing at all. */
  applied: null | {
    collectionsRegrouped: string[]
    before: number
    after: number
    /** Results dropped by the length floor. Counted, because a floor that silently removes the
     *  answer and a floor that removes noise look identical from the ranking. */
    droppedByFloor: number
    floor: number
  }
}

/**
 * Regroup a stream's ranked results to the configured grain, and apply the length floor.
 *
 * ⚠ ONE RESULT PER DOCUMENT, AND THAT RESULT IS THE DOCUMENT'S BEST-SCORING SECTION. This is the
 * brief's "retrieve at the grain that finds it; display the passage that matched" — the two
 * decisions stay separable because the unit that is RANKED is the document and the object that is
 * RETURNED is still a section, carrying its own snippet, url and attribution. Nothing downstream
 * has to learn a new shape.
 *
 * ⚠ ORDER IS PRESERVED FROM THE INPUT. The input is already sorted by one scorer (query-router.ts
 * guarantees a single-scorer list reaches this point — see `mergeLegs`' header), so keeping the
 * first occurrence of each document is a max-aggregation and needs no rescoring. Rescoring here
 * would mix scorers, which is the defect `score-scope.ts` exists to prevent.
 *
 * ⚠⚠ A ROW WITH NO `parentDocId` FALLS BACK TO ITS ID'S SECOND SEGMENT (`documentKeyOf`), which is
 * the literal word `publication` for every committee row. That is why the hydrate in fts-search.ts
 * and vector-search.ts now selects `parentDocId` — WITHOUT it this function would collapse all
 * 51,000 committee reports into one document and report a spectacular recall gain. The regroup is
 * therefore SKIPPED, with a warning, for any collection whose rows arrive without a parent where
 * the collection is known to have one.
 */
export function applyGrain(results: SearchResult[], opts: { label?: string } = {}): GrainOutcome {
  const map = grainMap()
  const floor = minWordFloor()
  if (!Object.keys(map).length && !floor) return { results, applied: null }

  const before = results.length
  let droppedByFloor = 0
  let kept = results
  if (floor > 0) {
    kept = results.filter((r) => {
      const w = r.wordCount
      // ⚠ UNDEFINED IS KEPT. A missing word count is "not measured", not "short", and dropping on
      // it would quietly delete every row whose hydrate missed — which is exactly the orphan class
      // §1.1 found. Three states, not two.
      if (typeof w !== 'number') return true
      if (w >= floor) return true
      droppedByFloor++
      return false
    })
  }

  const regrouped: string[] = []
  const docGrain = new Set(Object.entries(map).filter(([, g]) => g === 'document').map(([c]) => c))
  if (docGrain.size) {
    const seen = new Set<string>()
    const out: SearchResult[] = []
    for (const r of kept) {
      const corpus = r.id.split(':')[0]
      if (!docGrain.has(corpus)) { out.push(r); continue }
      if (r.parentDocId === undefined) {
        // Not hydrated — say so once per collection and leave the row alone rather than group it
        // on a fallback key that is wrong for the collections that matter most.
        if (!regrouped.includes(`${corpus}!unhydrated`)) {
          regrouped.push(`${corpus}!unhydrated`)
          console.warn(`[grain-policy] ${corpus} rows arrived without parentDocId — NOT regrouped; the fallback document key is wrong for this collection`)
        }
        out.push(r)
        continue
      }
      const k = documentKeyOf(r.id, r.parentDocId)
      if (seen.has(k)) continue
      seen.add(k)
      if (!regrouped.includes(corpus)) regrouped.push(corpus)
      out.push(r)
    }
    kept = out
  }

  const applied = { collectionsRegrouped: regrouped, before, after: kept.length, droppedByFloor, floor }
  console.log('[grain-policy] applied', { label: opts.label ?? null, ...applied })
  return { results: kept, applied }
}
