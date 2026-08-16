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
