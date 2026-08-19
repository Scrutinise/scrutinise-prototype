// ─────────────────────────────────────────────────────────────────────────────
// chat-retrieval.ts — BRIEF_SEARCH_S5 §2. Two context channels for the Lex conversation.
//
// ════════════════════════════════════════════════════════════════════════════════════════════
// THE PROBLEM S4 MEASURED AND WAS FORBIDDEN FROM FIXING
// ════════════════════════════════════════════════════════════════════════════════════════════
// When a user talks to Lex about their idea, the search behind that conversation looked ONLY at
// legislation. Ask what select committees have said about sewage and it returned seven Acts and
// four SIs while the corpus held the actual committee report and could not show it. Between 36
// and 146 relevant non-legislation documents per question existed and were unreachable.
//
// ⚠⚠ THERE ARE THREE GATES AND ALL THREE HAVE TO MOVE. S4's most useful finding:
//   1. the tier filter          — the caller passed `tier: 'legislation'`
//   2. the type filter          — applied AFTER it, keeping 3 display types, dropping 24 of 36
//   3. THE RESPONSE CONTRACT    — `LegacySearchResult` has `actId`, `actTitle`, `sectionNumber`
//                                 and NOWHERE TO PUT A COMMITTEE TRANSCRIPT
//
// Widening 1 alone measures as no change, because 2 discards whatever 1 admits. Widening 1 and 2
// WITHOUT 3 is worse than doing nothing: a committee transcript would reach Lex through a field
// called `actTitle` and be shown to the user as a section of an Act. That is the never-claim rule
// broken in the most damaging place available.
//
// So this module is gate 3. It returns TWO shapes, not one widened shape.
//
// ⚠ `gateway-legacy.ts` IS NOT TOUCHED. `searchLegislationViaGateway` and `searchPanelViaGateway`
// keep their tier and their type filter, because S4 measured the legislation panel's scope and
// found it right — widening it would be a regression dressed as a fix. Both arms therefore remain
// callable side by side, which is what lets `measure-s5-lex-scope.ts` be a permanent comparison
// rather than a before-and-after that stops being runnable the moment this ships.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { runSearch, type SearchIntent } from './search-gateway'
import { repealPromptNote } from './repeal-status'
import type { SearchResult, SearchResultType } from './page1-config'
import type { LegacySearchResult } from './gateway-legacy'
import { gidFromId, refFromId, sectionNumberFromRef, displayTitle, plainSnippet } from './gateway-legacy'
import { attributionLine, ATTRIBUTION_ABSENCE_NOTE, type Attribution } from './attribution'

/** The three display types that are operative law and belong in the legislation channel. */
const LEGISLATION_TYPES: ReadonlySet<string> = new Set([
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION',
])

/**
 * ⚠ WHAT EACH NON-LEGISLATION TYPE IS, IN THE WORDS SHOWN TO LEX AND TO THE USER.
 *
 * S5 §2: "A user must never be unable to tell which is which, and neither must Lex." These labels
 * are the mechanism. They are deliberately verbs and roles rather than collection names — "what
 * a witness told a committee" tells a reader what weight to give it; "committees-evidence" does
 * not, and invites it to be cited as though it were settled.
 *
 * ⚠ BILL IS HERE, NOT IN THE LEGISLATION CHANNEL. A Bill is a proposal, not law. Putting it in
 * the legislation channel would let Lex cite a clause of a Bill as though it were in force, which
 * is the same class of error as citing a repealed section — and this platform's whole claim is
 * knowing exactly what the corpus says.
 */
export const EVIDENCE_KINDS: Record<string, { label: string; whatItIs: string }> = {
  COMMITTEE:         { label: 'Committee evidence',   whatItIs: 'what a witness told a select committee, or what that committee reported' },
  DEBATE:            { label: 'Parliamentary debate', whatItIs: 'what was said in the Commons or the Lords, on the record' },
  DIVISION:          { label: 'Division',             whatItIs: 'how members actually voted — a roll-call, not an argument' },
  CASE_LAW:          { label: 'Case law',             whatItIs: 'what a court decided' },
  GUIDANCE:          { label: 'Regulator guidance',   whatItIs: "a regulator's own guidance — soft law, not statute" },
  EXPLANATORY_NOTE:  { label: 'Explanatory note',     whatItIs: 'the department\'s statement of what a provision was FOR — not the provision itself' },
  IMPACT_ASSESSMENT: { label: 'Impact assessment',    whatItIs: 'what the government PREDICTED an instrument would do, before it did it' },
  CONSULTATION:      { label: 'Consultation',         whatItIs: 'what the government asked, and what respondents said' },
  BILL:              { label: 'Bill (not yet law)',   whatItIs: '⚠ a PROPOSAL before Parliament — it is not in force and may never be' },
  TREATY:            { label: 'Treaty',               whatItIs: 'an international agreement the UK is party to' },
}

/**
 * The second channel's shape. ⚠ Note what it does NOT have: `actId`, `actTitle`, `sectionNumber`.
 * There is no field here that could make a committee transcript render as a section of an Act,
 * which is gate 3 done structurally rather than by convention.
 */
export interface EvidenceResult {
  id: string
  /** The display type, e.g. COMMITTEE. */
  kind: SearchResultType
  /** The plain-English label a user and Lex both see. */
  kindLabel: string
  /** One line saying what this kind of document IS — carried so the prompt can state it. */
  whatItIs: string
  title: string
  /**
   * WHO SAID IT — S8 §2 closed the gap S5 named here. Built by `attributionFor()` from the two
   * structured columns and from nothing else.
   *
   * ⚠⚠ NULL IS NOT ANONYMOUS. It means the collection does not hold attribution as a field.
   * That is the case for committee evidence — the very collection this was wanted for — where
   * the witness's name lives inside the document body and in no metadata we store. The audit is
   * in `docs/S8_ATTRIBUTION_AUDIT.txt`; `ATTRIBUTION_ABSENCE_NOTE` is what stops the prompt
   * reading the absence as anonymity.
   */
  attribution: Attribution | null
  date: string | null
  url: string | null
  snippet: string
  score: number
}

export interface ChatRetrieval {
  legislation: LegacySearchResult[]
  evidence: EvidenceResult[]
  /** ⚠ Types that came back and belong to NEITHER channel. Should be empty; see below. */
  unhandled: string[]
  failed: boolean
  failureReason?: string
  /** Which streams the router chose — logged so "found nothing" and "never looked" differ. */
  routedStreams?: string[]
  /** ⚠ Kinds the user's question plainly wanted that came back empty. Drives the honest gap line. */
  askedForButEmpty: string[]
  totalBeforeSplit: number
}

/**
 * ⚠ WHAT THE QUESTION IS PLAINLY ASKING FOR.
 *
 * S5 §4's never-claim rule needs to know the difference between "we searched and found nothing"
 * and "we cannot reach that". A question naming committees that returns no committee material is
 * the case where Lex must say so specifically rather than answer from general knowledge.
 *
 * ⚠ This is deliberately a keyword rule and not a model call. It runs on every chat turn, it must
 * cost nothing, and a wrong guess here only ever changes ONE line of the prompt — never a result.
 * Exported so it can be tested without a database.
 */
export function kindsPlainlyAskedFor(question: string): SearchResultType[] {
  const q = question.toLowerCase()
  const want: SearchResultType[] = []
  // ⚠ THE TRAILING \b IS GONE, AND THE CHECK IS WHAT CAUGHT IT. `/\bcommittee\b/` does NOT match
  // "committees" — the plural, which is how anybody actually asks ("what have select committeeS
  // said about…"). That is the very first non-legislation probe in the S4/S5 question set, so the
  // gap note would have stayed silent on the exact case §4 exists for. Anchor at the word START
  // only; the suffix is the whole point.
  if (/\b(committee|select committee|witness|gave evidence|inquir)/.test(q)) want.push('COMMITTEE')
  if (/\b(debate|hansard|mps? (said|argued)|in the commons|in the lords|parliament said)/.test(q)) want.push('DEBATE')
  if (/\b(court|judgment|judgement|case law|tribunal|ruled|held that)/.test(q)) want.push('CASE_LAW')
  if (/\b(guidance|regulator|ico|fca|ofgem|ofcom|hmrc)\b/.test(q)) want.push('GUIDANCE')
  if (/\b(voted|vote|division|roll.?call)/.test(q)) want.push('DIVISION')
  if (/\b(impact assessment|predicted|cost.benefit)/.test(q)) want.push('IMPACT_ASSESSMENT')
  if (/\b(consultation|consulted|respondent)/.test(q)) want.push('CONSULTATION')
  return want
}

/**
 * Retrieve for the Lex conversation: ROUTED, not tier-scoped.
 *
 * ⚠ S5 §2: "Route rather than widen. The router already picks the right streams — S4 showed it
 * choosing `committees` for a committee question and `debates` for a debate question, and the
 * caller overruling it with a constant. Stop overruling it." So no `tier` is passed. The chat
 * route becomes a routed caller like the untiered surfaces already are.
 */
export async function retrieveForChat(opts: {
  query: string
  ideaContext?: string
  limit?: number
  intent?: SearchIntent
}): Promise<ChatRetrieval> {
  const keywords = opts.query.trim().split(/\s+/).filter(Boolean)
  const limit = opts.limit ?? 10
  if (!keywords.length) {
    return { legislation: [], evidence: [], unhandled: [], failed: false, askedForButEmpty: [], totalBeforeSplit: 0 }
  }

  const out = await runSearch({
    keywords,
    intent: opts.intent ?? 'IDEA_CHAT_GROUNDING',
    ideaContext: opts.ideaContext,
    limit: Math.max(limit * 2, 20),
    // ⚠ NO `tier`. That single line is gate 1.
  })

  const legislation: LegacySearchResult[] = []
  const evidence: EvidenceResult[] = []
  const unhandled: string[] = []

  for (const r of out.results) {
    const type = String(r.type)
    if (LEGISLATION_TYPES.has(type)) {
      if (legislation.length >= limit) continue
      legislation.push(toLegacy(r))
      continue
    }
    const kind = EVIDENCE_KINDS[type]
    if (!kind) {
      // ⚠ NOT silently dropped. A display type that belongs to neither channel is a gap in this
      // map, and the previous design's whole defect was a filter that discarded quietly.
      if (!unhandled.includes(type)) unhandled.push(type)
      continue
    }
    if (evidence.length >= limit) continue
    evidence.push({
      id: r.id,
      kind: r.type,
      kindLabel: kind.label,
      whatItIs: kind.whatItIs,
      title: String(r.title || r.citation || r.id),
      // ⚠ Carried straight through from the gateway. This channel does NOT construct it — there
      // is one construction site (lib/lex/attribution.ts) and this is not it.
      attribution: r.attribution ?? null,
      date: r.date || null,
      url: r.url || null,
      snippet: plainSnippet(r.snippet),
      score: r.score,
    })
  }

  const found = new Set(evidence.map((e) => String(e.kind)))
  const askedForButEmpty = kindsPlainlyAskedFor(opts.query).filter((k) => !found.has(k))

  if (unhandled.length) {
    console.warn('[chat-retrieval] display types in NEITHER channel — add them to EVIDENCE_KINDS', { unhandled })
  }

  return {
    legislation,
    evidence,
    unhandled,
    failed: out.failed,
    failureReason: out.failureReason,
    routedStreams: out.meta?.routedStreams,
    askedForButEmpty,
    totalBeforeSplit: out.results.length,
  }
}

/**
 * ⚠ LOG WHAT LEX LOOKED FOR AND COULD NOT GET (§4).
 *
 * "V37's gap-filler expects exactly this signal: what Lex looked for and could not get is the most
 * direct evidence available about what the corpus should hold next." Every other gap signal we
 * have is inferred from sweeps and reachability matrices; this one is a real user asking a real
 * question and getting nothing.
 *
 * ⚠ THE QUESTION TEXT IS NOT STORED. A Stage-1 idea is private by design and a gap log is not a
 * reason to keep a copy of it. The keywords the retrieval layer actually searched are enough for
 * the ingest stream and not enough to reconstruct anybody's idea.
 *
 * ⚠ NEVER THROWS AND NEVER AWAITS THE CALLER. A logging failure must not cost a user their turn.
 */
export function logUnmet(r: ChatRetrieval, keywords: string[], ideaId?: string | null): void {
  if (!r.askedForButEmpty.length || r.failed) return
  const kw = keywords.join(' ').slice(0, 200)
  const streams = r.routedStreams?.join(',') ?? null
  void (async () => {
    try {
      for (const kind of r.askedForButEmpty) {
        await prisma.$executeRaw`
          INSERT INTO "LexUnmetRequest" (kind, keywords, streams, n_results, "ideaId")
          VALUES (${kind}, ${kw}, ${streams}, ${r.totalBeforeSplit}, ${ideaId ?? null})`
      }
    } catch (err) {
      console.warn('[chat-retrieval] could not log unmet request', {
        kinds: r.askedForButEmpty, error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
}

function toLegacy(result: SearchResult): LegacySearchResult {
  const gid = gidFromId(result.id)
  const ref = refFromId(result.id)
  return {
    type: gid ? gid.split('/')[0] : String(result.type).toLowerCase(),
    actId: gid ?? result.id,
    actTitle: displayTitle(result.title, result.citation, result.id, gid),
    sectionId: result.id,
    sectionNumber: sectionNumberFromRef(ref),
    title: result.citation || null,
    snippet: plainSnippet(result.snippet),
    rank: result.score,
    repeal: result.repeal,
    repealNote: result.repeal ? repealPromptNote(result.repeal) : null,
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE PROMPT BLOCKS — and the never-claim rule that has to travel with them
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠⚠ THE RULE S5 §4 IS REALLY ASKING FOR.
 *
 * "If Lex wants something and search cannot supply it, Lex says so plainly and specifically. Not
 * silence, not a vague deflection, and above all not an answer composed from general knowledge
 * presented as though it came from the corpus."
 *
 * A gap that announces itself is a feature. A gap that looks like an absence of evidence is the
 * single most damaging thing this platform can produce, because the user cannot tell the
 * difference and neither can we.
 */
export const EVIDENCE_INSTRUCTION =
  'The EVIDENCE block below is NOT legislation. Each item says what kind of document it is. '
  + 'Never describe a committee transcript, a debate, a consultation or a Bill as though it were '
  + 'law in force, and never cite one with a section number. Say what it is and who said it — '
  + '"the Health and Social Care Committee was told…", "the Bill proposes…". '
  + 'A Bill is a proposal and may never pass.'

export const GAP_INSTRUCTION =
  'If the user has asked for a kind of material that is NOT in the blocks below, say so plainly '
  + 'and specifically — name what you looked for and could not find here. For example: "I looked '
  + 'for what select committees have said about this and nothing came back from our corpus." '
  + 'NEVER answer from your own general knowledge and present it as though it came from our '
  + 'sources, and never give a vague deflection like "I don\'t have information on that" — that is '
  + 'indistinguishable from the corpus being empty, and the user cannot tell the difference.'

/**
 * Render the evidence block for the prompt. Returns null when there is nothing to render.
 *
 * ⚠ S8 §2 — the attribution line is emitted only when one exists, and the ABSENCE note is
 * emitted only when at least one item lacks it. A block where everything is attributed does not
 * need to explain what a missing attribution would have meant, and a note that appears
 * unconditionally is the kind of boilerplate a model learns to skip.
 */
export function evidenceBlock(items: EvidenceResult[]): string | null {
  if (!items.length) return null
  const lines = items.map((e) => {
    const when = e.date ? ` (${e.date.slice(0, 10)})` : ''
    const who = attributionLine(e.attribution)
    return `- [${e.kindLabel}] ${e.title}${when}\n    ${e.whatItIs}\n`
      + (who ? `    ${who}\n` : '')
      + `    "${e.snippet.slice(0, 300)}"`
  })
  const anyMissing = items.some((e) => !e.attribution)
  return `${lines.join('\n')}\n\n${EVIDENCE_INSTRUCTION}`
    + (anyMissing ? `\n${ATTRIBUTION_ABSENCE_NOTE}` : '')
}

/**
 * The honest line about what was looked for and not found.
 *
 * ⚠ Returns null when nothing was plainly asked for, because a note on every turn saying "no
 * committee evidence was found" on a question that never mentioned committees is noise, and noise
 * is how a real gap notice gets ignored.
 */
export function gapNote(r: ChatRetrieval): string | null {
  if (r.failed) {
    return 'SEARCH FAILED for this turn — the corpus was not consulted at all. Tell the user you '
      + 'could not search just now, and do not answer about what the corpus contains.'
  }
  if (!r.askedForButEmpty.length) return null
  const names = r.askedForButEmpty.map((k) => EVIDENCE_KINDS[k]?.label ?? k)
  return `⚠ The user's question appears to ask about ${names.join(' and ')}, and the search returned `
    + `NONE of that kind. Say so specifically — name what you looked for. Do not fill the gap from `
    + `general knowledge.`
}
