/**
 * env-flags.ts — the one place a boolean environment variable is turned into a boolean.
 *
 * WHY THIS EXISTS. On 2026-08-08 `LEX_QUERY_ROUTER` and `LEX_QUERY_EXPANSION` were set in Vercel
 * to `TRUE`. Every read site compared with `=== 'true'`, so both capabilities were off — silently,
 * with no error and no log line, for as long as the values had been capitalised. The router's
 * measured gold-set gains (+15.3pp on B, +10.0pp on A) had never reached a user, and the only way
 * anyone found out was by counting requests arriving at the search services from outside.
 *
 * Eight flags shared the fragility and nothing in the codebase normalised env booleans. This
 * module removes the class rather than the two instances:
 *
 *   1. `parseBool` trims and lower-cases, and accepts the forms people actually type.
 *   2. A value that is SET but unrecognised warns once, loudly, instead of quietly meaning false.
 *      "I set the flag and nothing happened" is the failure we are designing against.
 *   3. `capabilityLine()` renders the resolved state of every flag so "is X live?" is answered by
 *      reading a log line, not by inferring from downstream request counters.
 *
 * `scripts/check-flags.ts` asserts both the parsing AND that no read site has gone back to a bare
 * comparison — the invariant, not just the behaviour.
 */

const TRUTHY = new Set(['true', '1', 'yes', 'on'])
const FALSY = new Set(['false', '0', 'no', 'off', ''])

/** Warn once per variable per process — a per-request warning would flood the log. */
const warned = new Set<string>()

/**
 * Interpret an environment variable as a boolean.
 *
 * Unset → false, silently: "not configured" is the normal state for an off-by-default flag.
 * Set but unrecognised → false, with a ONE-TIME warning naming the value. This is the case that
 * cost us: `TRUE`, `Yes`, `enabled` and a stray space all used to mean false with no signal.
 */
export function parseBool(raw: string | undefined, name?: string): boolean {
  if (raw === undefined || raw === null) return false
  const v = String(raw).trim().toLowerCase()
  if (TRUTHY.has(v)) return true
  if (FALSY.has(v)) return false
  if (name && !warned.has(name)) {
    warned.add(name)
    console.warn(
      `[env-flags] ${name} is set to ${JSON.stringify(raw)}, which is not a recognised boolean — ` +
      `treating it as FALSE. Use one of: ${[...TRUTHY].join(', ')} (or ${[...FALSY].filter(Boolean).join(', ')}).`,
    )
  }
  return false
}

/** Every boolean capability flag the running app reads. Adding one here puts it in the boot line. */
export const CAPABILITY_FLAGS = [
  'LEX_QUERY_EXPANSION',
  'LEX_QUERY_ROUTER',
  'LEX_WEB_ORIENTATION',
  'LEX_SEARCH_VECTOR',
  'LEX_SEARCH_RERANKER',
  'LEX_SEARCH_GRAPH',
  'LEX_COHERENCE_CORPUS',
  'LEX_SEARCH_STUB',
  // S3 §1. Tier-scoped callers (the three legacy legislation surfaces) reach the
  // matching stream's FUSED retrieval instead of bare BM25, so scoping and dense
  // retrieval stop being mutually exclusive.
  //
  // ⚠ DEFAULT OFF ON PURPOSE, per the brief's own rule — "if the routed path is worse
  // on those questions, say so and hold the flip behind a flag rather than shipping a
  // regression". Measured 2026-08-16 over 8 legislation questions: ~20 of 48 results
  // per query change, and the swaps read better on inspection (a Consumer Rights query
  // drops Companies Act 2006 and gains Consumer Rights Act 2015) — but latency goes
  // 2,295ms → 3,710ms, +62%, on the platform's main user surface, and the quality half
  // is NOT gold-validated. Better-looking results are not measured results.
  'LEX_TIER_FUSION',
  // 25-B §7. Multi-model perspectives on the build's COVERAGE passes (1 and 3), never on
  // the drafting passes. N calls with different framings, merged with the divergence
  // preserved rather than averaged away — see lib/lex/build-perspectives.ts.
  //
  // ⚠ DEFAULT OFF, and that is the brief's own instruction rather than caution: it
  // multiplies the cost of the two most expensive passes, and §7 exists so that Charlie
  // can judge whether the extra coverage is worth the money. He cannot judge that if it
  // is already on.
  'LEX_BUILD_PERSPECTIVES',
  // S8 §4. Three candidate router streams — impact assessments, consultations, explanatory
  // material. All three are already typed, indexed and RETRIEVABLE today; what they lack is a
  // slot of their own in the round-robin interleave, so they compete for a neighbouring stream's
  // positions and lose on BM25 to collections hundreds of times their size.
  //
  // ⚠ DEFAULT OFF, and the reason is cost rather than caution: five streams become eight, and a
  // stream is a retrieval call per query against a `vector-serve` concurrency cap of 4. The gain
  // is also UNMEASURABLE today — the gold set has no archetype for any of these three (the same
  // instrument problem that makes committees unevaluable), which is what §5's question set exists
  // to fix. Flipping it is Charlie's call once there is something to score it with.
  'LEX_ROUTER_STREAMS_V2',
  // S9 §4. The statistics catalogue as a routed stream. The router selects it exactly as it
  // selects legislation or caselaw; what differs is the PAYLOAD, which travels on its own
  // channel (`GatewayResult.statistics`) as a series DESCRIPTOR rather than a document —
  // because a catalogue hit that renders like a corpus document invites Lex to quote it as
  // evidence of a fact, when it is only evidence that a MEASUREMENT EXISTS.
  //
  // ⚠ DEFAULT OFF, and here the reason is that it is UNVALIDATED rather than expensive. There
  // is no gold set for statistics and one cannot be borrowed (S9 §5); the ten candidate
  // questions Q51–Q60 in GOLD_CANDIDATES_S8.md are marked UNVALIDATED and await Charlie. What
  // IS measured is behavioural — whether the router selects this stream when a numeric series
  // is plainly wanted and, more importantly, leaves it alone when the question is legal or
  // evidential. A stream that fires on everything is worse than one that fires on nothing.
  //
  // ⚠ It also costs a sixth router stream (an eighth with V2 on) against `vector-serve`'s
  // concurrency cap of 4 — but NOT a vector call: this stream has no dense leg and does not
  // touch the corpus index at all, so the cost is one Postgres read against a cached
  // in-process index, measured at SEARCH_S9_REPORT.md §B3.
  'LEX_STATS_STREAM',
  // S10 §3. THE DIAL — a per-stream fusion weight instead of one 0.5 for every collection. The
  // values live in `LEX_FUSION_STREAM_WEIGHTS` (`debates:0.2,caselaw:0.65`); this boolean gates
  // the mechanism, exactly as `LEX_SEARCH_VECTOR` gates and `LEX_VECTOR_STREAMS` configures.
  //
  // ⚠ DEFAULT OFF, and with it off `streamVectorWeight()` returns the same 0.5 constant every
  // caller already used — so the change is a no-op until a weight is deliberately set. That is
  // the brief's own requirement ("nothing widened before it is measured") and it is asserted by
  // comparing rankings in `scripts/check-s10-fusion.ts`, not by reading the code.
  //
  // ⚠ ONE BOOLEAN IS WHAT A ROLLBACK WANTS. Flipping this off restores 0.5 everywhere without
  // anyone having to remember what the weights string used to say.
  'LEX_FUSION_WEIGHTS',
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // S14 §2. THE JUDGED MERGE — stop rationing slots, judge the whole pool. `lib/lex/merge-judged.ts`.
  // ═══════════════════════════════════════════════════════════════════════════════════════════
  //
  // What it changes, in one sentence: the displayed twenty stop being an equal share of the routed
  // streams and become the twenty best candidates across all of them, so **one source may hold all
  // twenty if that is where the answer is** — which the round-robin makes arithmetically
  // impossible, since with S streams a top-20 can show at most the first floor(20/S) of each.
  //
  // It also raises the PER-STREAM retrieval budget to at least `SEARCH_MIN_PER_STREAM` (20), which
  // is Charlie's other rule: "we should never cut back the visibility when we add sources."
  //
  // ⚠ DEFAULT OFF, and with it off `runRoutedSearch` makes the same `interleaveStreams` call at
  // the same `limit` it always did. The equivalence is stronger than that and is asserted rather
  // than claimed: with a stream floor of 2, uniform confidence and no gate, the judged merge
  // returns the SAME LIST id-for-id (`npm run check:s14-merge`).
  //
  // ⚠ TWO ENV VALUES CONFIGURE IT AND NEITHER IS A BOOLEAN, so both stay out of this list:
  //     SEARCH_MIN_PER_STREAM     the per-stream retrieval floor (default 20)
  //     SEARCH_RELEVANCE_FLOOR    the absolute relevance gate, 0..1. UNSET = no gate, deliberately
  //                               — S14 declines to adopt a point value tuned to 64 questions and
  //                               reports the sweep instead.
  //
  // ⚠ IT WIDENS `results`, WHICH HAS A KNOWN VICTIM. The Deepening's sift is the one caller that
  // reads `results` unfiltered and pays a per-candidate model cost (S11 §5.1). That is why the
  // width is behind this flag rather than simply raised.
  'LEX_SEARCH_JUDGED_MERGE',
  // S14 §1(b). The router says how likely each stream is to hold the answer, and the judged merge
  // weights the streams by it. `lib/lex/query-expansion.ts::routeQueryDetailed`.
  //
  // ⚠ DEFAULT OFF because it changes the ROUTER'S PROMPT AND SCHEMA, and adding a question to a
  // choice can change the choice even when nothing else is reworded. With it off both reach the
  // model byte-identical; with it on, any change in stream SELECTION is attributable to the
  // confidence question existing, which is what makes the arm measurable.
  //
  // ⚠ A MISSING CONFIDENCE IS UNIFORM, NOT ZERO. Absent weights reduce the judged merge to exactly
  // the round-robin ordering; defaulting them to zero would delete a routed stream from the window
  // on the strength of a field the model simply omitted.
  'LEX_ROUTER_CONFIDENCE',
  //
  // ⚠⚠ `LEX_MERGE_COVERAGE` WAS HERE AND WAS RETIRED ON 2026-08-26 (S14 §2). It was S13's minimal
  // experiment — reallocate the post-floor slots by query-term coverage. Measured: **+2 of 65**
  // (23% → 26%) while moving **24 of 34 rankings**, and its two regressions took documents their
  // own stream ranked SECOND to merged ranks 117 and 149. S13 D-5 recommended leaving it off; S14
  // replaces it with a merge that uses coverage as a GATE rather than as the entire ordering,
  // which is the specific thing that made it too crude.
  //
  // It is DELETED rather than defaulted off, for the reason the brief gives: a flag that survives
  // its own replacement is how a dead branch gets re-enabled by somebody reading an old note —
  // the same reasoning that deleted `LEX_GUIDANCE_CPS` in S11. The SIGNAL survives in
  // `lib/lex/term-coverage.ts`, which has three other readers.
  // ⚠⚠ `LEX_GUIDANCE_CPS` WAS HERE AND WAS RETIRED ON 2026-08-21 (S11 §2.4). It admitted
  // `cps-guidance` to the guidance stream's EXTRA LEG as a bridge, because the collection was
  // display-typed GUIDANCE and indexed under tier `other`, so no router stream could select it.
  //
  // The bridge is gone because the thing it bridged to has been built: `cps-guidance` is now in
  // the `guidance` tier in `corpus-map.ts` and the rows carry that tier in the index. It competes
  // in the MAIN leg, needs no extra retrieval call, and — measured, not assumed — costs the
  // consultations that shared the stream nothing (4/9 → 4/9, where the extra-leg arm had cost
  // them 6/9 → 4/9). The flag is deleted rather than defaulted off: a redundant flag that still
  // gates a live code path is a trap for the next reader, and this one would have quietly
  // double-retrieved a collection already in the tier.
  //
  // ⚠ SIX MORE COLLECTIONS MOVED WITH IT and never had a flag: `cma-cases`, `ofgem`, `ofcom`,
  // `independent-reviews`, `inquiry-evidence`, `lgsco`. See `corpus-map.ts` and
  // `docs/SEARCH_S11_REPORT.md`.
] as const

export type CapabilityFlagName = (typeof CAPABILITY_FLAGS)[number]

/** Read a capability flag. Every read site in the app goes through here. */
export function flagEnabled(name: CapabilityFlagName): boolean {
  return parseBool(process.env[name], name)
}

/** Resolved on/off for every capability flag, as the app actually believes it. */
export function capabilitySnapshot(): Record<CapabilityFlagName, boolean> {
  const out = {} as Record<CapabilityFlagName, boolean>
  for (const f of CAPABILITY_FLAGS) out[f] = flagEnabled(f)
  return out
}

/**
 * The boot line. Includes the non-boolean config that decides whether an "on" flag can actually
 * do anything — a router that is on but has no GEMINI_API_KEY, or a vector stream list with no
 * VECTOR_SEARCH_URL, both degrade silently, so the boolean alone would still mislead.
 *
 * Never prints a secret: keys are reported as set/unset only.
 */
export function capabilityLine(): string {
  const snap = capabilitySnapshot()
  const flags = CAPABILITY_FLAGS
    .map((f) => `${f.replace(/^LEX_/, '')}=${snap[f] ? 'ON' : 'off'}`)
    .join(' ')

  const raw = (name: string) => {
    const v = process.env[name]
    return v && v.trim() ? v.trim() : '(unset)'
  }
  const present = (name: string) => (process.env[name]?.trim() ? 'set' : 'UNSET')

  // The three that decide whether dense retrieval can happen at all, in the order they gate it.
  const dense = [
    `VECTOR_SEARCH_URL=${present('VECTOR_SEARCH_URL')}`,
    `LEX_VECTOR_STREAMS=${raw('LEX_VECTOR_STREAMS')}`,
    `GEMINI_API_KEY=${present('GEMINI_API_KEY')}`,
  ].join(' ')

  return `[capabilities] ${flags} | ${dense}`
}
