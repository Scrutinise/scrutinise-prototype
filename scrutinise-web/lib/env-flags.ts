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
