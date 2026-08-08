// ─────────────────────────────────────────────────────────────────────────────
// §6d — the orientation stage. THE ENTRY POINT.
//
// Runs BEFORE the background briefing is written, in parallel with the corpus
// search, so Lex never visibly misses something an ordinary web search would
// surface, and can name the political context circulating around an idea.
//
// SCOPE, DELIBERATELY NARROW (first version): the Page-1 initial background
// briefing ONLY — the same caller Stage-3 expansion targeted first. Not
// idea-chat, not every Lex turn. Widen after measuring, not before.
//
// THREE HTTP-LEVEL PASSES, TWO LOGICAL CALLS (§6d.1):
//   web      — Gemini grounding, Tier B. Current landscape + comparative practice
//              + the published case each way. (Internally 2 round-trips: ground,
//              then structure — Gemini refuses grounding and JSON mode together;
//              see web-orientation.ts.)
//   x-recency— Grok x_search, Tier C, bounded to the recency window.
//   x-args   — Grok x_search, Tier C, NOT time-bounded.
//
// All three run concurrently and each fails independently. A failed pass is
// RECORDED as failed and never silently becomes "nothing is happening" — the
// §19-C 1a rule, applied to a new source.
//
// WHY THIS IS NOT INSIDE search-gateway.ts, despite the flag living there:
// the gateway's contract is `query → SearchResult[]`, i.e. retrieval, and it is
// shared by nine intents. Orientation produces briefing SEGMENTS, not results,
// and this brief scopes it to exactly one caller. Putting it in the gateway
// would have run it for cause-seeding, ad-hoc research and the three legacy
// legislation surfaces too. It therefore sits beside the gateway and is called
// by the Page-1 trigger; the gateway's step-3 comment points here.
//
// Config:
//   LEX_WEB_ORIENTATION=true          the whole layer (DEFAULT OFF)
//   LEX_ORIENTATION_X=false           turn off the X/Tier-C half only
//   LEX_ORIENTATION_NOISE_FILTER=false turn off the §6d.2 extraction contract
//   ORIENTATION_RECENCY_DAYS          default 90
//   ORIENTATION_MAX_ARGUMENTS         default 10
//   ORIENTATION_TOTAL_BUDGET_MS       default 45000 — the WHOLE stage. Must stay
//                                     under vercel.json's maxDuration 60 minus
//                                     the corpus search and the writes.
// ─────────────────────────────────────────────────────────────────────────────

import { flagEnabled } from '@/lib/env-flags'
import type { ArgumentItem, CallOutcome, OrientationResult, RecencyScan } from './types'
import { emptyOrientation } from './types'
import { runWebOrientation } from './web-orientation'
import { runXArgumentMining, runXRecencyScan, xOrientationEnabled } from './x-orientation'
import { filterArguments, noiseFilterEnabled } from './noise-filter'

export * from './types'
export { renderOrientationSegments, renderOrientationChecked } from './render'
export { assertQuarantine, TIER_C_MARK, TIER_B_MARK, TIER_C_EXPLAINER } from './quarantine'
export { noiseFilterEnabled } from './noise-filter'

export function webOrientationEnabled(): boolean {
  return flagEnabled('LEX_WEB_ORIENTATION')
}

export function recencyDays(): number {
  const raw = parseInt(process.env.ORIENTATION_RECENCY_DAYS ?? '90', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 90
}

/** Merge the web (Tier B) and X (Tier C) recency scans into one segment source.
 *  Tier B leads within each list — background before circulation — and the tier
 *  travels on every item, so ordering never blurs provenance. */
function mergeRecency(web: RecencyScan | null, x: RecencyScan | null): RecencyScan {
  const w = web ?? { recentDevelopments: [], liveControversies: [], politicalRisks: [], whoIsTalking: [], salience: 0 as const, sources: [] }
  const c = x ?? { recentDevelopments: [], liveControversies: [], politicalRisks: [], whoIsTalking: [], salience: 0 as const, sources: [] }
  const salience = Math.max(w.salience, c.salience) as 0 | 1 | 2 | 3
  return {
    recentDevelopments: [...w.recentDevelopments, ...c.recentDevelopments],
    liveControversies: [...w.liveControversies, ...c.liveControversies],
    politicalRisks: [...w.politicalRisks, ...c.politicalRisks],
    whoIsTalking: [...w.whoIsTalking, ...c.whoIsTalking],
    salience,
    sources: [...w.sources, ...c.sources],
  }
}

/**
 * Run the orientation stage for one idea.
 *
 * Never throws and never rejects: every pass is independently guarded, and the
 * worst case is an OrientationResult with `failed: true` and an empty body,
 * which the renderer states plainly. The briefing must still be written when
 * orientation is unavailable.
 */
export async function runOrientation(opts: {
  /** The idea in the user's own words — keywords joined, or the title. */
  topic: string
  /** Extra context to steer the passes. Same guardrail as query expansion: it
   *  steers retrieval and never enters cited text. */
  ideaContext?: string
}): Promise<OrientationResult> {
  const days = recencyDays()
  if (!webOrientationEnabled()) {
    // Flag off: return the empty result WITHOUT the failure framing — nothing
    // was attempted, so there is nothing to report as broken.
    return { ...emptyOrientation(days), failed: false, calls: [] }
  }
  if (!opts.topic.trim()) {
    return { ...emptyOrientation(days), failed: false, calls: [] }
  }

  const filterOn = noiseFilterEnabled()
  const xOn = xOrientationEnabled()
  const context = (opts.ideaContext ?? '').slice(0, 500)
  const maxArguments = parseInt(process.env.ORIENTATION_MAX_ARGUMENTS ?? '10', 10)
  const t0 = Date.now()

  // ⚠ A STAGE BUDGET, ON TOP OF THE PER-CALL TIMEOUTS. Not belt-and-braces —
  // load-bearing. The web pass is TWO sequential HTTP calls, each with its own
  // timeout, so per-call limits alone permit 2 × ORIENTATION_WEB_TIMEOUT_MS.
  // Both routes that reach here (`/fields`, `/search`) are Vercel functions
  // capped at maxDuration 60, and a briefing that 504s mid-write is precisely
  // the §19-C failure this codebase already paid for once. The budget bounds the
  // whole stage regardless of how the per-call timeouts are configured.
  //
  // A pass that overruns is abandoned, not awaited: its in-flight fetch is left
  // to be torn down with the request. That is a deliberate trade — the caller
  // gets a briefing with an honestly-empty section instead of no briefing.
  const budgetMs = parseInt(process.env.ORIENTATION_TOTAL_BUDGET_MS ?? '45000', 10)
  const deadline = Date.now() + budgetMs

  const timed = async <T>(call: string, fn: () => Promise<T | null>): Promise<{ call: string; ms: number; value: T | null; overran: boolean }> => {
    const start = Date.now()
    let value: T | null = null
    let overran = false
    try {
      const remaining = Math.max(0, deadline - Date.now())
      let timer: NodeJS.Timeout | undefined
      const budgetGuard = new Promise<'BUDGET'>((resolve) => {
        timer = setTimeout(() => resolve('BUDGET'), remaining)
      })
      const outcome = await Promise.race([fn(), budgetGuard])
      clearTimeout(timer)
      if (outcome === 'BUDGET') {
        overran = true
        console.warn(`[orientation] ${call} exceeded the ${budgetMs}ms stage budget — abandoned`)
      } else {
        value = outcome as T | null
      }
    } catch (err) {
      // The individual passes already swallow their own failures; this exists so
      // that runOrientation's contract — it cannot reject — holds even if one
      // of them is later changed to throw.
      console.warn(`[orientation] ${call} threw:`, err instanceof Error ? err.message : err)
      value = null
    }
    return { call, ms: Date.now() - start, value, overran }
  }

  const skipped = { ms: 0, value: null, overran: false }
  const [web, xRecency, xArgs] = await Promise.all([
    timed('web', () => runWebOrientation(opts.topic, context, days)),
    xOn ? timed('x-recency', () => runXRecencyScan(opts.topic, context, days)) : Promise.resolve({ call: 'x-recency', ...skipped }),
    xOn ? timed('x-arguments', () => runXArgumentMining(opts.topic, context, filterOn)) : Promise.resolve({ call: 'x-arguments', ...skipped }),
  ])

  const calls: CallOutcome[] = []
  const attempted: string[] = ['web', ...(xOn ? ['x-recency', 'x-arguments'] : [])]
  // Two different facts, reported as two different reasons: an overrun is a
  // budget decision we made, a failure is the provider's.
  const why = (t: { overran: boolean }) => (t.overran ? `abandoned at the ${budgetMs}ms stage budget` : 'did not complete')

  calls.push({
    call: 'web', ok: web.value !== null, ms: web.ms,
    ...(web.value ? { costUsd: web.value.costUsd } : { reason: why(web) }),
  })
  if (xOn) {
    calls.push({
      call: 'x-recency', ok: xRecency.value !== null, ms: xRecency.ms,
      ...(xRecency.value ? { costUsd: xRecency.value.costUsd } : { reason: why(xRecency) }),
    })
  }

  // Arguments: Tier B (web) and Tier C (X) pooled, then filtered together so the
  // dedupe collapses a claim made in both places into one exemplar. The tier
  // stays on each surviving item; the B item is kept in preference because
  // dedupe keeps the EARLIEST-dated exemplar and, where dates tie, the first in
  // the list — which is why web is concatenated first.
  const rawArguments: ArgumentItem[] = [
    ...(web.value?.argumentsMined ?? []),
    ...(xArgs.value?.items ?? []),
  ]
  const { items: argumentsMined, counts } = filterArguments(rawArguments, { enabled: filterOn, cap: maxArguments })

  if (xOn) {
    calls.push({
      call: 'x-arguments', ok: xArgs.value !== null, ms: xArgs.ms,
      ...(xArgs.value
        ? { costUsd: xArgs.value.costUsd, kept: counts.kept, discarded: counts.discarded }
        : { reason: why(xArgs) }),
    })
  }

  const okCount = calls.filter((c) => c.ok).length
  const totalCostUsd = calls.reduce((sum, c) => sum + (c.costUsd ?? 0), 0)

  const result: OrientationResult = {
    ranAt: new Date().toISOString(),
    recencyDays: days,
    recency: mergeRecency(web.value?.recency ?? null, xRecency.value?.recency ?? null),
    comparative: web.value?.comparative ?? [],
    argumentsMined,
    calls,
    failed: okCount === 0,
    noiseFilter: filterOn,
    totalMs: Date.now() - t0,
    totalCostUsd,
  }

  console.log('[orientation] complete', {
    attempted: attempted.length,
    ok: okCount,
    ms: result.totalMs,
    costUsd: Number(totalCostUsd.toFixed(4)),
    developments: result.recency.recentDevelopments.length,
    controversies: result.recency.liveControversies.length,
    risks: result.recency.politicalRisks.length,
    comparative: result.comparative.length,
    arguments: result.argumentsMined.length,
    noiseFilter: filterOn,
    salience: result.recency.salience,
  })

  return result
}
