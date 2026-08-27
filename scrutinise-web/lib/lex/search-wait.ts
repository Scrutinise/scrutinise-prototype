// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE USER IS WAITING FOR — a wake, a slow search, or a failure.
//
// ⚠⚠ THREE STATES, AND COLLAPSING THEM INTO ONE SPINNER IS THE DEFECT THIS FILE EXISTS TO
// PREVENT. `fts-serve` and `vector-serve` now sleep on inactivity, so the first search after
// a quiet period waits ~13 s (measured) for a container to be scheduled and an index to be
// paged in from R2. An unexplained thirteen-second spinner reads as "this is broken"; the
// same thirteen seconds with "waking the search service" reads as "this is starting up".
//
// The distinction is not cosmetic. It changes what the user does next:
//
//   WAKING   → wait, it is coming. Nothing is wrong.
//   SLOW     → it is awake and working; the query is just heavy.
//   FAILED   → it is not coming; here is what we could not do.
//
// ⚠ AND A WAKE IS NOT A FAILURE EVEN WHEN IT IS SLOW. The old 25 s budget would have
// aborted mid-wake and reported a search failure — a true statement about the request and a
// false one about the system. The budget now covers the wake (75 s) precisely so this
// distinction can be made honestly rather than by guessing.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How long a search may take before we assume it is a wake rather than a slow query.
 *
 * ⚠ SET ABOVE A WARM QUERY AND BELOW A COLD ONE, from the same measurements that sized the
 * timeouts: a warm search answers in well under 3 s; a cold start took 12.1 s (fts) and
 * 13.5 s (vector) to first served query. Four seconds is comfortably outside normal and
 * comfortably inside a wake, so the message appears while the wake is still happening
 * rather than after it.
 */
export const ASSUME_WAKING_AFTER_MS = 4_000

export type SearchWaitState = 'idle' | 'searching' | 'waking' | 'failed'

/**
 * The sentence for each state. Exported as data so a check can assert that the three are
 * actually different — a "distinct message" that happens to read the same as the generic
 * one is the failure wearing a fix.
 */
export const WAIT_MESSAGE: Record<Exclude<SearchWaitState, 'idle'>, string> = {
  // The brief's own wording. "About half a minute" is deliberately vaguer than the measured
  // 13 s: the measurement is a restart proxy and a real wake can be slower, and a promise
  // of "about fifteen seconds" that takes thirty is worse than no promise.
  waking: 'Waking the search service — about half a minute the first time.',
  searching: 'Searching the corpus…',
  failed: 'The search service could not be reached, so this answer is drawn from what we already had.',
}

/**
 * Which state a caller is in, from the elapsed time and what it knows.
 *
 * ⚠ `couldBeCold` IS PASSED IN, NOT INFERRED HERE. Whether a service might be asleep is
 * something the caller knows (it has just fired a warm-up, or it has not searched in this
 * session); guessing it from elapsed time alone would label every slow query a wake, which
 * would make the message meaningless on the day it mattered.
 */
export function waitState(
  { elapsedMs, couldBeCold, failed }: { elapsedMs: number; couldBeCold: boolean; failed?: boolean },
): SearchWaitState {
  if (failed) return 'failed'
  if (elapsedMs <= 0) return 'idle'
  if (couldBeCold && elapsedMs >= ASSUME_WAKING_AFTER_MS) return 'waking'
  return 'searching'
}
