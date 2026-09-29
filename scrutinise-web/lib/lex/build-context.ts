// ─────────────────────────────────────────────────────────────────────────────
// S22 — ATTRIBUTION. "Every build started by a person writes userId and ideaId on its
// ledger rows."
//
// ⚠⚠ THE GAP, FOUND BY QUERYING PRODUCTION DIRECTLY, NOT ASSUMED. `runNextPass` has both
// `userId` and `ideaId` from the moment a build claims a pass — `nextQueuedBuild()` resolves
// `userId` from `idea.creatorId` and it is threaded as a real argument all the way in. But
// `callModelJson` (model-call.ts), the ONE entry point `reranker.ts`, `build-llm.ts`,
// `deepening-*.ts` and every other pass-calling file go through, has no `userId`/`ideaId`
// parameter at all — so every `LlmSpend` row a build's own passes write carries NULL for
// both. Confirmed live: 27 `search.reranker` rows written by real builds in the two hours
// after S20a's flag fix, every one `ideaId=null userId=null`. `docs/SEARCH_S22_REPORT.md`.
//
// ⚠ THE FIX IS DELIBERATELY NOT "THREAD userId/ideaId THROUGH EVERY FUNCTION SIGNATURE
// BETWEEN THE BUILD ENGINE AND recordSpend". `runSearch()`'s `GatewayQuery` alone is called
// from a dozen surfaces (general-chat.ts, orientation, three legacy legislation surfaces,
// the build engine), and widening it to carry attribution would touch all of them for a
// concern only ONE of them (the build) actually has. Instead: an ambient, request-scoped
// context (Node's own `AsyncLocalStorage`, the standard tool for exactly this — a value
// every function in a call chain needs without every function's signature carrying it).
// `runNextPass` enters it once, for the duration of that pass and everything it awaits;
// `recordSpend` (spend-ledger.ts) reads it as the FALLBACK when a caller did not pass
// `userId`/`ideaId` explicitly — an explicit value always wins, so a caller that already
// knows better (chat web search stamping the chatting admin, §7 amendment) is never
// overridden by ambient build context it is not even running inside.
// ─────────────────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'async_hooks'

export interface BuildContext {
  userId: string | null
  ideaId: string | null
  /** COST DASHBOARD — the build (IdeaBuild.id) and the step (pass key) being run. */
  buildId?: string | null
  step?: string | null
}

const storage = new AsyncLocalStorage<BuildContext>()

/**
 * Set the ambient attribution for the rest of THIS async call chain (everything this
 * function goes on to `await`, directly or indirectly) — until the next call to this
 * function, or the chain ends. `enterWith` rather than `run(fn)` deliberately: `runNextPass`
 * is a single long async function, not a callback boundary, and Node's `AsyncLocalStorage`
 * scopes correctly to the awaiting chain either way.
 */
export function enterBuildContext(ctx: BuildContext): void {
  storage.enterWith(ctx)
}

/**
 * Run `fn` with `ctx` as the ambient attribution, and RESTORE the previous one afterwards.
 * ⚠ Use this, not `enterBuildContext`, wherever a long-lived process calls the same function again and
 * again (the build worker's loop): `enterWith` set at the top of a function leaks to the CALLER, so build
 * 1's attribution would still be ambient for whatever the worker spends next. `run` cannot leak.
 */
export function runWithSpendContext<T>(ctx: BuildContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

/** Read the ambient attribution, or null when nothing set it (most call chains — this is
 *  a fallback source, not something every caller is expected to populate). */
export function currentBuildContext(): BuildContext | null {
  return storage.getStore() ?? null
}

/**
 * COST DASHBOARD — attribute everything the REST OF THIS REQUEST spends to the signed-in user and the
 * idea. One line, right after the route's own auth check:
 *
 *     if (authz.error) return authz.error
 *     enterSpendFor(authz.user, authz.idea)
 *
 * ⚠ IT MUST BE CALLED IN THE HANDLER'S OWN BODY, NOT INSIDE `authorizeIdea`. `enterWith` scopes to the
 * async resource that calls it; `authorizeIdea` does its own `await` before it knows the user, so a call
 * from in there would set the store on a resource the handler's continuation never runs in. (That is
 * also why `runNextPass` calls `enterBuildContext` as its FIRST statement.)
 */
export function enterSpendFor(
  user: { id: string } | null | undefined,
  idea: { id: string } | null | undefined,
  extra?: { buildId?: string | null; step?: string | null },
): void {
  if (!user && !idea) return
  storage.enterWith({ userId: user?.id ?? null, ideaId: idea?.id ?? null, buildId: extra?.buildId ?? null, step: extra?.step ?? null })
}
