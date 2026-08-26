/**
 * harness-preflight.ts — S3 §7.2. A retrieval harness must refuse to run under a
 * degraded configuration, and must print the configuration it actually resolved
 * alongside whatever number it produces.
 *
 * WHY THIS EXISTS, from the incident that produced the requirement. On 2026-08-16 the
 * V36 acceptance run was executed on a machine whose `.env` carries `VECTOR_SEARCH_URL`
 * and nothing else. The result — ABSENT 7, ROUTING 16/30 against a baseline of 0,
 * IN_TOP_K down 13 → 7 — looked exactly like the ingest having broken routing. It had
 * not. Three flags were absent and each degrades SILENTLY:
 *
 *   FTS_SEARCH_URL       absent → the FTS leg throws; keyword retrieval contributes nothing
 *   LEX_VECTOR_STREAMS   absent → dense retrieval is simply OFF, with no error anywhere
 *   LEX_QUERY_ROUTER     absent → routeQuery returns null; every query fails open
 *
 * Each one makes a HEALTHY corpus look broken, and none of them announces itself in the
 * number. A harness that degrades quietly does not produce a weaker measurement; it
 * produces a confident wrong one, which is worse, because it gets acted on.
 *
 * The rule: assert at start-up, fail loudly, and print the resolved state next to the
 * result so a number can never be read without the configuration that produced it.
 *
 * Usage:
 *   import { assertRetrievalConfig, resolvedConfigLine } from '@/lib/lex/harness-preflight'
 *   assertRetrievalConfig('diagnose-recall')          // throws unless fully configured
 *   …
 *   console.log(resolvedConfigLine())                 // print WITH the number, every time
 */
import { flagEnabled } from '../env-flags'

export type RetrievalFlagState = {
  ftsUrl: string | null
  vectorUrl: string | null
  vectorStreams: string
  routerOn: boolean
  degraded: string[]
}

export function retrievalFlagState(): RetrievalFlagState {
  const ftsUrl = process.env.FTS_SEARCH_URL ?? null
  const vectorUrl = process.env.VECTOR_SEARCH_URL ?? null
  const vectorStreams = (process.env.LEX_VECTOR_STREAMS ?? '').trim()
  const routerOn = flagEnabled('LEX_QUERY_ROUTER')

  const degraded: string[] = []
  if (!ftsUrl) degraded.push('FTS_SEARCH_URL unset — the FTS leg throws; keyword retrieval contributes NOTHING')
  if (!vectorUrl) degraded.push('VECTOR_SEARCH_URL unset — dense retrieval cannot be reached')
  if (!vectorStreams) degraded.push('LEX_VECTOR_STREAMS empty — dense retrieval is OFF on every stream, silently')
  if (!routerOn) degraded.push('LEX_QUERY_ROUTER off — every query fails open; per-stream scoping AND dense fusion are skipped')

  return { ftsUrl, vectorUrl, vectorStreams, routerOn, degraded }
}

/** One line, safe to print next to a result. URLs are reduced to their host so a log
 *  can be pasted into a report without carrying a full service endpoint around. */
export function resolvedConfigLine(): string {
  const s = retrievalFlagState()
  const host = (u: string | null) => { if (!u) return 'UNSET'; try { return new URL(u).host } catch { return 'malformed' } }
  return (
    `[config] fts=${host(s.ftsUrl)} vector=${host(s.vectorUrl)} ` +
    `streams=${s.vectorStreams || 'NONE'} router=${s.routerOn ? 'ON' : 'OFF'}` +
    `${s.degraded.length ? ` DEGRADED(${s.degraded.length})` : ' fully-configured'}`
  )
}

/**
 * Throws unless every retrieval capability is configured.
 *
 * `allowDegraded` exists for harnesses that deliberately measure ONE leg (a BM25-only
 * control, for instance). It still prints the full degradation list — the escape hatch
 * is for the assertion, never for the disclosure.
 */
export function assertRetrievalConfig(harnessName: string, opts: { allowDegraded?: boolean } = {}): RetrievalFlagState {
  const state = retrievalFlagState()
  if (!state.degraded.length) {
    console.log(`[${harnessName}] retrieval configuration OK — ${resolvedConfigLine()}`)
    return state
  }

  const message =
    `[${harnessName}] REFUSING TO RUN — retrieval is degraded in ${state.degraded.length} way(s):\n` +
    state.degraded.map((d) => `    · ${d}`).join('\n') +
    `\n  Any recall or ordering number produced in this state is NOT comparable with one` +
    `\n  measured against a configured stack, and each of these makes a healthy corpus look` +
    `\n  broken. Set the missing values, or pass allowDegraded if a degraded leg IS the` +
    `\n  measurement — in which case say so beside the number.` +
    `\n  ${resolvedConfigLine()}`

  if (opts.allowDegraded) {
    console.warn(`${message}\n  → allowDegraded set; continuing under the state above.`)
    return state
  }
  throw new Error(message)
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// S8 §3 — READ THE CONFIGURATION POSITIVELY, OFF THE RUNNING SERVICES
// ════════════════════════════════════════════════════════════════════════════════════════════
/**
 * ⚠ EVERYTHING ABOVE READS `process.env`, WHICH IS A STATEMENT ABOUT THIS SHELL AND NOT ABOUT
 * WHAT RAN. §3 asks for the flag state "read positively — a `served`/config readback, not the
 * env", and docs/CLAUDE.md §19 says the same thing one level up: a behavioural measurement taken
 * from a reachable surface beats an unreachable config file every time.
 *
 * `served` is the counter that settles it. Read it before the run and after: if it did not move,
 * the retrieval this harness thinks it measured did not touch that service — whatever the env
 * said. That distinguishes "configured and working" from "configured and silently unreachable",
 * which is the pair CLAUDE.md §18's corollary exists for.
 *
 * ⚠ Never throws. A stats endpoint being down must not stop a measurement; it must be REPORTED
 * next to it.
 */
export interface ServiceReadback {
  name: 'fts' | 'vector'
  url: string | null
  reachable: boolean
  served: number | null
  startedAt: string | null
  /**
   * ⚠⚠ S14 §0 — QUEUE DEPTH, BECAUSE A SATURATED SERVICE IS NOT A SLOW ONE AND THE TWO NEED
   * DIFFERENT ANSWERS. `vector-serve` is 4 wide with a 64-deep queue, and a client abort does NOT
   * cancel work already queued — so a harness that times out and retries FEEDS the queue rather
   * than shedding load. Once it reaches its cap, `warm_p95` went from 7.7 s to **206 s** and every
   * dense leg after that returned nothing, silently, with the ranking falling back to BM25.
   *
   * A harness that reports a recall number taken in that state is reporting a keyword-only figure
   * under a configuration that names four dense streams. Reading this BEFORE the run is what makes
   * that visible rather than discoverable weeks later.
   */
  queued: number | null
  rejections: number | null
  detail: string
}

async function readStats(name: ServiceReadback['name'], url: string | null): Promise<ServiceReadback> {
  const dead = (detail: string): ServiceReadback =>
    ({ name, url, reachable: false, served: null, startedAt: null, queued: null, rejections: null, detail })
  if (!url) return dead('URL unset')
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const res = await fetch(`${url.replace(/\/$/, '')}/stats`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return dead(`HTTP ${res.status}`)
    const j = (await res.json()) as {
      served?: number; started_at?: string; warm_p95_ms?: number
      concurrency?: { max?: number; queued?: number; maxQueue?: number; rejections?: number }
    }
    const c = j.concurrency ?? {}
    const saturated = typeof c.queued === 'number' && typeof c.maxQueue === 'number' && c.maxQueue > 0
      && c.queued >= c.maxQueue * 0.5
    return {
      name, url, reachable: true,
      served: typeof j.served === 'number' ? j.served : null,
      startedAt: j.started_at ?? null,
      queued: typeof c.queued === 'number' ? c.queued : null,
      rejections: typeof c.rejections === 'number' ? c.rejections : null,
      detail: `served=${j.served ?? '?'} width=${c.max ?? '?'} queued=${c.queued ?? '?'}/${c.maxQueue ?? '?'}` +
        ` rejected=${c.rejections ?? '?'} p95=${j.warm_p95_ms ?? '?'}ms since=${j.started_at ?? '?'}` +
        (saturated ? '  ⚠⚠ SATURATED — a measurement taken now will silently be keyword-only' : ''),
    }
  } catch (err) {
    return dead(err instanceof Error ? err.message : String(err))
  }
}

export async function readServiceConfig(): Promise<ServiceReadback[]> {
  const s = retrievalFlagState()
  return Promise.all([readStats('fts', s.ftsUrl), readStats('vector', s.vectorUrl)])
}

/**
 * The engagement check: did the run actually reach the services?
 *
 * ⚠ A ZERO DELTA IS A FINDING, NOT A ROUNDING ERROR. `served` not moving while a harness
 * reports results means the results came from somewhere else — the stub, a cache, or an arm
 * that silently failed open. Report the delta beside every number that claims to have used them.
 */
export function servedDelta(before: ServiceReadback[], after: ServiceReadback[]): string {
  return before.map((b) => {
    const a = after.find((x) => x.name === b.name)
    if (b.served == null || a?.served == null) return `${b.name}=UNREADABLE(${b.detail})`
    const d = a.served - b.served
    // A restart resets the counter, so a negative delta is a redeploy, not a negative use.
    if (a.startedAt !== b.startedAt) return `${b.name}=RESTARTED mid-run (counter reset; delta unusable)`
    return `${b.name}+${d}${d === 0 ? ' ⚠ NOT ENGAGED' : ''}`
  }).join('  ')
}
