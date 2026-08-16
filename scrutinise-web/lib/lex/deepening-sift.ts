// ─────────────────────────────────────────────────────────────────────────────
// THE SIFT (§19-E Task 3) — between retrieval and the gather.
//
// Charlie, on the precedents a Deepening pass returned: "The precedents Lex provides
// aren't really precedents — they're a random search, quite a lot of it irrelevant…
// Instead of ranking the top 20 for relevance, which Lex can't seem to do very well, it
// should take the top 100 and pick out intelligently the ones that really are relevant
// and useful."
//
// // Ranking answers "what is most similar"; sifting answers "what actually bears on
// // this". They are different questions and the background budget lets us ask the second.
//
// THREE THINGS THIS DOES THAT RANKING CANNOT:
//
//   1. It reads a much LARGER candidate set (~100 rather than ~14) and throws most of
//      it away. The interactive path cannot afford that; a background pass with a
//      minutes-long budget can.
//   2. Every kept candidate carries a ONE-LINE REASON — what it bears on and how. A
//      keep with no reason is a rank in disguise.
//   3. It applies the PRECEDENT TEST separately from relevance: a comparable measure
//      was TRIED, and we can say what it was for, what was predicted, or what happened.
//      A topically-related document is not a precedent, and calling it one is how a
//      proposal walks into a committee citing something that never happened.
//
// AND THE COUNT IS REPORTED, NOT HIDDEN. "Reviewed 104 sources, 12 bore on this" is
// honest about how little of a search helps, and it is a quality signal we can watch.
// When the sift cannot run, `skipped` is TRUE and the caller says so — a fallback run
// and a sifted run must not look identical from outside (CLAUDE.md §18 corollary).
//
// Written to the §18 rules like every other model call here: finishReason checked
// BEFORE parsing, thinking off, a generous budget, failure returns a marked result
// rather than silently degrading.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'
import { geminiFinishProblem } from './gemini-finish'

/** One candidate the sift kept, with the judgement attached. */
export interface SiftKeep {
  /** The candidate's id, copied from the supplied list. Anything else is dropped. */
  id: string
  /** One line: what this bears on, and how. Never "it is relevant". */
  reason: string
  /**
   * Does this satisfy the PRECEDENT TEST? Distinct from `keep`: a source can bear on
   * the proposal without being a precedent, and most do.
   */
  isPrecedent: boolean
}

export interface SiftResult {
  kept: SearchResult[]
  /** Keyed by result id — the reason and the precedent verdict for each kept source. */
  judgements: Map<string, SiftKeep>
  reviewed: number
  /** TRUE when the sift could not run and `kept` is the ranked set unchanged. */
  skipped: boolean
  /** Why it was skipped, when it was. Present only when `skipped`. */
  skipReason?: string
}

const MAX_TOKENS = parseInt(process.env.LEX_SIFT_MAX_TOKENS ?? '8000', 10)
const TIMEOUT_MS = parseInt(process.env.LEX_SIFT_TIMEOUT_MS ?? '60000', 10)

/**
 * How many candidates a sift is shown. The brief says "target ~100, honouring whatever
 * the gateway will return" — so this is a target and never a promise: the caller
 * reports what it actually reviewed, not what it asked for.
 */
export const SIFT_CANDIDATE_TARGET = parseInt(process.env.LEX_SIFT_CANDIDATES ?? '100', 10)

/**
 * A floor below which sifting is pointless. With a dozen candidates the sift costs a
 * model call to tell us what the gather would work out anyway, and — more to the point
 * — a "reviewed 11, kept 3" line invites the user to think the corpus was searched
 * thoroughly when it was not. Below the floor the pass reports the honest thing: the
 * candidate set was too small to sift.
 */
export const SIFT_FLOOR = 12

const SCHEMA = {
  type: 'object',
  properties: {
    keep: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
          isPrecedent: { type: 'boolean' },
        },
        required: ['id', 'reason', 'isPrecedent'],
      },
    },
  },
  required: ['keep'],
}

const SYSTEM = [
  'You are sifting search results for a UK policy proposal. Retrieval has already ranked them by',
  'similarity. Your job is the DIFFERENT question: does this source ACTUALLY BEAR ON THIS',
  "PROPOSAL'S PROBLEM, and how?",
  '',
  'BE RUTHLESS. Most of what you are shown will not bear on it. A search that returns a hundred',
  'documents about the general subject area has not found a hundred relevant documents, and keeping',
  'the merely topical ones is worse than keeping none: it buries the two that matter. Keeping 8 of',
  '100 is a good outcome. Keeping 60 means you have not sifted.',
  '',
  'FOR EACH SOURCE YOU KEEP:',
  '  · `id` — copied EXACTLY from the list. An id not in the list is discarded.',
  '  · `reason` — ONE LINE saying what it bears on and how, specific to this proposal.',
  '    "Relevant to the topic" is not a reason and will be treated as a discard.',
  '    "Sets the statutory duty the proposal would have to amend" is a reason.',
  '  · `isPrecedent` — THE PRECEDENT TEST, and it is stricter than relevance:',
  '      TRUE only if a COMPARABLE MEASURE WAS ACTUALLY TRIED, and this source tells us at least',
  '      one of: what it was FOR, what it was PREDICTED to do, or what ACTUALLY HAPPENED.',
  '      A document that merely discusses the same subject is NOT a precedent. Neither is a',
  '      proposal that was never enacted, unless the source says what happened to it.',
  '      When in doubt, FALSE. A false precedent is worse than a missing one: the user takes it',
  '      into a committee room and is asked what happened, and nothing did.',
  '',
  'Return ONLY the sources you keep. Everything you omit is discarded, and the count of discards is',
  'reported to the user, so omitting is normal and expected — it is not a failure to find something.',
].join('\n')

/**
 * Sift `candidates` down to those that bear on the proposal.
 *
 * NEVER RETURNS FEWER SOURCES THAN THE GATHER CAN USE BY FAILING. On any failure the
 * ranked set is returned unchanged with `skipped: true` and a reason — degrading to
 * today's behaviour, announced. A sift that silently returned nothing would empty the
 * pass, and an empty pass reports "the corpus is silent", which would be a lie.
 */
export async function siftCandidates(input: {
  passMethod: string
  mustAnswer: string[]
  idea: string
  candidates: SearchResult[]
}): Promise<SiftResult> {
  const reviewed = input.candidates.length
  const passthrough = (skipReason: string): SiftResult => ({
    kept: input.candidates, judgements: new Map(), reviewed, skipped: true, skipReason,
  })

  if (reviewed < SIFT_FLOOR) return passthrough(`only ${reviewed} candidates — below the sift floor of ${SIFT_FLOOR}`)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return passthrough('no GEMINI_API_KEY')
  const model = process.env.LEX_SIFT_MODEL ?? process.env.LEX_DEEPENING_MODEL ?? process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'

  // The snippet is SHORTER here than in the gather on purpose: the sift is a relevance
  // judgement over a hundred candidates, not a reading of any one of them, and a
  // hundred full extracts would push the input past anything useful. It is a decision
  // about whether to READ the source, made from its citation, title and opening.
  const list = input.candidates
    .map((r, i) => `[${i + 1}] id=${r.id}\n    type: ${r.type} · ${r.citation} · ${r.date}\n    title: ${r.title}\n    opening: ${(r.snippet ?? '').replace(/\s+/g, ' ').slice(0, 320)}`)
    .join('\n')

  const user = [
    `THE PASS'S METHOD — what this pass is looking for:\n${input.passMethod}`,
    '',
    `THE QUESTIONS THIS PASS MUST ANSWER:\n- ${input.mustAnswer.join('\n- ')}`,
    '',
    `THE PROPOSAL, AS THE USER HAS WRITTEN IT:\n${input.idea || '(nothing recorded yet)'}`,
    '',
    `CANDIDATES (${reviewed}). Keep only those that bear on the problem above:\n${list}`,
  ].join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      console.error('[deepening:sift] HTTP', res.status, await res.text().catch(() => ''))
      return passthrough(`sift HTTP ${res.status}`)
    }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp

    // BEFORE parsing (CLAUDE.md §18.1). A truncated sift is broken JSON, and a parse
    // error here would send the next reader after a serialiser bug.
    const cut = geminiFinishProblem(data?.candidates?.[0], MAX_TOKENS, { label: 'deepening-sift' })
    if (cut) {
      console.error(`[deepening:sift] ${cut.reason} — ${cut.detail}`)
      // ⚠ NOT a partial keep. Half a keep-list parsed out of a cut-off payload would
      // silently discard the tail while reporting a confident "kept 6 of 100".
      return passthrough(`sift ${cut.reason}`)
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return passthrough('sift returned no text')
    const obj = JSON.parse(text) as { keep?: SiftKeep[] }

    const byId = new Map(input.candidates.map((c) => [c.id, c]))
    const judgements = new Map<string, SiftKeep>()
    const kept: SearchResult[] = []
    for (const k of Array.isArray(obj.keep) ? obj.keep : []) {
      if (!k || typeof k.id !== 'string') continue
      const src = byId.get(k.id.trim())
      // A keep for an id that was not in the list is a hallucinated source. It cannot
      // become a finding, so it cannot become a keep either.
      if (!src || judgements.has(src.id)) continue
      const reason = typeof k.reason === 'string' ? k.reason.trim() : ''
      // A keep with no reason is a rank in disguise — the whole point of the sift is
      // the reason, so a keep without one is discarded rather than quietly accepted.
      if (reason.length < 12) {
        console.warn('[deepening:sift] keep discarded — no usable reason', { id: src.id, reason })
        continue
      }
      judgements.set(src.id, { id: src.id, reason, isPrecedent: k.isPrecedent === true })
      kept.push(src)
    }

    // The sift kept nothing. That is a legitimate answer — "we reviewed 100 sources and
    // none of them bore on this" is exactly what the known-unknowns machinery is for —
    // and it is NOT a skip. The distinction matters: skipped means we did not look.
    console.log('[deepening:sift]', {
      reviewed, kept: kept.length, discarded: reviewed - kept.length,
      precedents: [...judgements.values()].filter((j) => j.isPrecedent).length,
    })
    return { kept, judgements, reviewed, skipped: false }
  } catch (err) {
    console.error('[deepening:sift] failed:', err instanceof Error ? err.message : err)
    return passthrough(err instanceof Error ? err.message : 'sift threw')
  } finally {
    clearTimeout(t)
  }
}

/** "reviewed 104 sources, 12 bore on this" — the line the user reads. */
export function siftSummaryLine(reviewed: number, kept: number, skipped: boolean): string {
  if (skipped) {
    return `Reviewed ${reviewed} source${reviewed === 1 ? '' : 's'}. The sift did not run on this pass, ` +
      `so these are the highest-ranked results rather than a judged selection.`
  }
  return `Reviewed ${reviewed} source${reviewed === 1 ? '' : 's'}; ${kept} bore on this proposal.`
}
