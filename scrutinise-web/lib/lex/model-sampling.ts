// ─────────────────────────────────────────────────────────────────────────────
// 25-D §1b — SAMPLING PARAMETERS ARE A PROPERTY OF THE MODEL, NOT OF THE CALLER.
//
// ⚠⚠ THE FINDING THIS EXISTS FOR. `claude-sonnet-5` answers a reachability ping perfectly and
// then rejects a real call with **HTTP 400 — "`temperature` is deprecated for this model."**
// Every structured call through it would have failed, on a model the registry listed as
// available and a check had certified. That is the second time the same shape has bitten:
// `gemini-2.5-pro` was unreachable through every client we had because one line sent it
// `thinkingBudget: 0`, which it refuses.
//
// Both are the same defect: A CALL PARAMETER WRITTEN AS A CONSTANT, ON A MODEL THAT REFUSES IT.
// `model-thinking.ts` fixed it for thinking. This is the same fix for sampling, and it is
// deliberately built as a general parameter decision rather than as a second one-off, because
// the next vendor to deprecate a knob will not deprecate `temperature`.
//
// ⚠ THE RULE THE BRIEF STATES, AND IT IS THE POINT: **a model that refuses a parameter must
// still be USABLE, not quietly unusable.** So an unsupported parameter is OMITTED — never sent
// and never allowed to fail the call. Determinism is worth something; a working call is worth
// more.
//
// ⚠ AND IT IS AN ALLOW-LIST, NOT A VERSION RULE. "Anything below 5 accepts it" would have been
// tidy and wrong — `claude-opus-4-8` and `claude-opus-4-7` reject `temperature` while
// `claude-haiku-4-5` accepts it. Every entry below was probed live, per id, on 2026-08-20.
//
// ⚠ WHY THIS IS ITS OWN FILE, beside `model-thinking.ts` rather than inside it or inside
// `model-registry.ts` — the same reasoning `model-thinking.ts` records: the registry is shared
// with other threads and folding two per-model parameter tables into it mid-flight would ship
// their unfinished work with ours. ▶ STANDING FOLLOW-UP, unchanged and now covering two files:
// `REQUIRES_THINKING` and `REJECTS_TEMPERATURE` both belong in `model-registry.ts`, with every
// remaining hardcoded Gemini caller reading them.
// ─────────────────────────────────────────────────────────────────────────────

/** The sampling knobs a caller may ask for. One name per concept, across all vendors. */
export interface SamplingRequest {
  temperature?: number
}

/**
 * Model ids PROVEN to reject `temperature` with a hard 400.
 *
 * ⚠ MEASURED, NOT INFERRED. Probed live against every id in `REACHABLE.anthropic` on
 * 2026-08-20 (25-C `verify:model-vendors`). An id is added here only after a real call has
 * returned 400 naming the parameter — never on the strength of a release note, and never by
 * extrapolating from a sibling model, which is exactly the guess this list disproves.
 */
export const REJECTS_TEMPERATURE: ReadonlySet<string> = new Set([
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-fable-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
])

export function acceptsTemperature(model: string): boolean {
  return !REJECTS_TEMPERATURE.has(model)
}

/**
 * The sampling parameters a request may actually carry, for this model.
 *
 * Returns an object to spread into a request body. A parameter this model refuses is simply
 * absent — the caller does not branch, and cannot forget to.
 *
 * ⚠ `undefined` IN, NOTHING OUT. A caller that passes no temperature must not have one invented
 * for it here; the vendor's own default is a deliberate choice by the people who trained the
 * model, and substituting ours silently changes behaviour on every call that never asked.
 */
export function samplingFor(model: string, want: SamplingRequest): SamplingRequest {
  const out: SamplingRequest = {}
  if (want.temperature != null && acceptsTemperature(model)) out.temperature = want.temperature
  return out
}

/**
 * What was dropped, and why — for a log line or a check's report.
 *
 * ⚠ CLAUDE.md §18: a degradation must announce itself with its cause attached. A parameter
 * silently omitted is a behaviour change nobody can see; naming it means the day a model starts
 * answering differently, the reason is one grep away.
 */
export function samplingOmissions(model: string, want: SamplingRequest): string[] {
  const dropped: string[] = []
  if (want.temperature != null && !acceptsTemperature(model)) {
    dropped.push(`temperature (this model rejects it with a hard 400)`)
  }
  return dropped
}
