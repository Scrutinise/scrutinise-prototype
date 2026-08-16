// ─────────────────────────────────────────────────────────────────────────────
// The conductor (§13 + §7). Called after EVERY field write. It owns the "what next"
// decision (per §3.4 — server, not Lex, not frontend) and makes Lex speak the next
// step, so no path leaves the flow idle. Save-before-advance holds throughout: it
// only ever speaks for a freshly-EMPTY field and never advances an AWAITING one.
//
// By field kind of the active page's current field:
//   - narrative box (Page 1)               → Lex acks + asks the box's question.
//   - proposed scalar (title/keywords/       → Lex proposes the value (inline confirm
//     challenge/pivotalObstacle/summary)       in chat); deterministic fallback if Lex fails.
//   - structured panel box (whoAffected/     → seed a proposal (carry-forward / empty)
//     legalLandscape)                          → AWAITING; Lex introduces it in chat.
//   - loop (causes)                          → seed corpus candidates (CAUSE_SEEDING)
//                                              → AWAITING; Lex invites curation.
//   - reference (rootCause)                  → Lex asks which cause is the driver.
//
// keywords accept → handled in the fields route (search + pointer). Page advance →
// handled in the page route, which then calls this to seed the new page's first field.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { flagEnabled } from '@/lib/env-flags'
import { computeCanonicalState } from './state'
import { fieldDef, type CanonicalState, type FieldDef } from './page1-config'
import {
  buildLexSystemPrompt, runLexTurn, generateCauseCandidates, generatePolicyOptions,
  generateCoherenceReview, formatCoherenceReview, generateAnticipatedResponses,
} from './lex-client'
import {
  setProposal, storeExtracted, createCauses, buildWhoAffectedSeed,
  createPolicyOptions, listPolicyOptions, computeCostSummary, listActions,
} from './field-machine'
import { validateProposal } from './proposal-schema'
import { runSearch } from './search-gateway'
import { buildFactsBlock, type TurnFacts } from './facts'
import { readStageSearches, displayStageFor, type StageSearchRecord } from './stage-search'
import { PROBLEM_FIELD_KEY, looksLikeASolution } from './method'
import { acceptedSummary, sourceValuesFor } from './accepted-context'

export { acceptedSummary } from './accepted-context'

// `field` (§19-D Task 1b) tags a Lex bubble with the field it was said ABOUT, so the
// problem gate can count its own presses without a schema change. Absent on every
// message written before this sprint, which reads as "no presses yet" — the safe
// direction: an existing idea gets its full two presses rather than none.
type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string; field?: string }

function historyOf(raw: unknown): { role: string; content: string }[] {
  return (Array.isArray(raw) ? (raw as ChatMsg[]) : [])
    .filter((m) => m.role === 'user' || m.role === 'lex')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))
}

async function chatHistory(ideaId: string) {
  return historyOf((await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } }))?.aiChatHistory)
}

/** Append Lex bubbles to the stored transcript, each tagged with the stage it was
 *  said in (§19-B Task 3 — so the chat's stage dividers survive a page reload). */
async function pushLex(ideaId: string, content: string | string[], stage?: string, field?: string) {
  const contents = (Array.isArray(content) ? content : [content]).filter((c) => c.trim())
  if (!contents.length) return
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  const now = new Date().toISOString()
  const updated: ChatMsg[] = [
    ...(Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as ChatMsg[]) : []),
    ...contents.map((c) => ({ role: 'lex', content: c, timestamp: now, stage, field })),
  ].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}

/** §19-D Task 1b — how many times Lex has already pressed on the problem statement.
 *  Counted from the transcript (no schema change): every bubble Lex writes while the
 *  problem field is current is tagged with it. */
export function countProblemPresses(history: unknown): number {
  return (Array.isArray(history) ? (history as ChatMsg[]) : [])
    .filter((m) => m.role === 'lex' && m.field === PROBLEM_FIELD_KEY).length
}

// ── canonical helpers (span all pages, not just Page 1) ──────────────────────
function allFields(state: CanonicalState) {
  return state.pages.flatMap((p) => p.fields)
}
function findField(state: CanonicalState, key: string) {
  return allFields(state).find((f) => f.key === key) ?? null
}
function acceptedValue(state: CanonicalState, key: string): unknown {
  const f = findField(state, key)
  return f && f.status === 'ACCEPTED' ? f.value : null
}
// §19-E Task 1 — `acceptedSummary` used to live here as `value.slice(0, 80)`, and that
// slice is what put three mid-word clauses into Charlie's guiding-policy summary. It
// now lives in ONE place (accepted-context.ts) alongside the source-values block that
// gives a composed field the whole of what it is composing from. Re-exported so this
// module's own callers are unchanged.

/** The facts of this conductor turn (§19-C Task 1b) — including the stage's stored
 *  search, so a conductor message can only describe results that actually exist. */
async function factsFor(ideaId: string, state: CanonicalState, extra: Partial<TurnFacts> = {}): Promise<string> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { stageSearches: true } })
  const store = readStageSearches(idea?.stageSearches)
  const stageRecord: StageSearchRecord | undefined = store.byStage[displayStageFor(state.stage)]
  return buildFactsBlock({ state, search: extra.search ?? stageRecord ?? null, ...extra })
}

async function buildPrompt(
  ideaId: string, userId: string, state: CanonicalState, def: FieldDef,
  opts: { factsBlock?: string } = {},
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredName: true, firstName: true, aiPreferredStyle: true },
  })
  const ideaCount = await prisma.idea.count({ where: { creatorId: userId } })
  return buildLexSystemPrompt({
    preferredName: user?.preferredName ?? user?.firstName ?? 'there',
    lexMode: user?.aiPreferredStyle?.toUpperCase() ?? 'COLLABORATIVE',
    experienceLevel: state.userProfile.experienceLevel,
    ideaTitle: (acceptedValue(state, 'title') as string | null) ?? null,
    isFirstIdea: ideaCount <= 1,
    currentField: def,
    // The conductor only ever speaks for a freshly-EMPTY field (it returns early on
    // AWAITING_CONFIRMATION), so it is never in the awaiting-refine state.
    awaiting: false,
    activePage: state.stage,
    factsBlock: opts.factsBlock ?? (await factsFor(ideaId, state)),
    acceptedSummary: acceptedSummary(state),
    // §19-E Task 1 — a composed field gets the COMPLETE text of its sources, so it
    // never has to compose from the abridged ledger.
    sourceValuesBlock: sourceValuesFor(def.key, state),
  })
}

// ── Deterministic fallbacks (never stall) ────────────────────────────────────
const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'they', 'their', 'them', 'about',
  'would', 'should', 'could', 'because', 'which', 'what', 'when', 'where', 'there', 'here',
  'into', 'over', 'under', 'more', 'most', 'some', 'such', 'than', 'then', 'will', 'been',
  'being', 'were', 'your', 'ours', 'also', 'just', 'very', 'much', 'many', 'need', 'want',
])

function firstSentence(text: string, cap = 160): string {
  const s = (text ?? '').split(/[.!?\n]/)[0].trim()
  return s.slice(0, cap)
}
function fallbackTitle(ideaNarrative: string): string {
  const words = firstSentence(ideaNarrative).split(/\s+/).slice(0, 9).join(' ')
  return (words || 'Untitled idea').slice(0, 80)
}
function fallbackKeywords(texts: string[]): string[] {
  const freq = new Map<string, number>()
  for (const w of texts.join(' ').toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (STOPWORDS.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w)
}

/** A deterministic proposal value for any proposed scalar, so the confirm always appears. */
function fallbackValue(defKey: string, state: CanonicalState): unknown {
  const ideaNarrative = (acceptedValue(state, 'ideaNarrative') as string) ?? ''
  const youAndIdea = (acceptedValue(state, 'youAndIdeaNarrative') as string) ?? ''
  switch (defKey) {
    case 'keywords':
      return fallbackKeywords([ideaNarrative, youAndIdea])
    case 'title':
      return fallbackTitle(ideaNarrative)
    case 'challenge':
      return firstSentence(ideaNarrative) || 'The problem, in a sentence — please put this in your own words.'
    case 'pivotalObstacle':
      return 'The main thing blocking a workable solution here — please refine this.'
    case 'summaryDiagnosis': {
      const rc = acceptedValue(state, 'rootCause') as string | null
      const po = acceptedValue(state, 'pivotalObstacle') as string | null
      const parts = [rc ? `The root cause is ${rc}` : '', po ? `the pivotal obstacle is ${po}` : ''].filter(Boolean)
      return parts.length ? parts.join('; ') + '.' : 'Diagnosis summary — please refine this.'
    }
    default:
      return 'Please refine this.'
  }
}

function fallbackChat(defKey: string): string {
  switch (defKey) {
    case 'keywords':
      return 'Here are some keywords to search on — edit them if you like, then confirm.'
    case 'title':
      return 'Here’s a working title — change it if you’d prefer, then confirm.'
    case 'challenge':
      return 'Here’s the problem in a sentence — accept it or tell me how to sharpen it.'
    case 'pivotalObstacle':
      return 'Here’s what looks like the pivotal obstacle — accept it or refine it.'
    case 'summaryDiagnosis':
      return 'Here’s the diagnosis, naming the root cause and the pivotal obstacle — accept it or tell me what to adjust.'
    default:
      return 'Here’s a draft — accept it or tell me how to change it.'
  }
}

// ── Steps ────────────────────────────────────────────────────────────────────

/** The effective question for a field given current state (A5: a single-cause root
 *  step must not ask "which is the main driver" — there's nothing to choose between). */
function questionFor(def: FieldDef, state: CanonicalState): string {
  if (def.key === 'rootCause') {
    const material = state.diagnosisCauses.filter((c) => c.classification === 'MATERIAL')
    const candidates = material.length ? material : state.diagnosisCauses
    if (candidates.length === 1) {
      return `There's a single cause on the table — I'll set it as the root cause; just confirm it in the panel on the right.`
    }
  }
  return def.question ?? 'What would you like to add next?'
}

/** Ask the current box/panel field's question (narrative, structured, loop, reference). */
async function askQuestion(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const question = questionFor(def, state)
  const fallback = question
  try {
    const prompt = await buildPrompt(ideaId, userId, state, def)
    const directive = `[The user just completed the previous step. In ONE short sentence acknowledge it, then ask this in your own words: "${question}". Do not propose anything, and do not repeat a question you have already asked.]`
    const lex = await runLexTurn(prompt, directive, await chatHistory(ideaId))
    if (lex.extracted && Object.keys(lex.extracted).length) {
      await storeExtracted(ideaId, userId, lex.extracted).catch(() => {})
    }
    return lex.chatText || fallback
  } catch {
    return fallback
  }
}

/**
 * Fields whose deterministic fallback is genuinely DERIVED FROM THE USER'S OWN WORDS
 * (a title cut from their narrative, keywords by frequency, the challenge as their
 * first sentence). For these a fallback is a real, if rough, draft.
 *
 * §19-C Tasks 4/5 — every OTHER proposed field used to fall back to the literal string
 * "Please refine this.", written into the field as though it were a draft. That is how
 * `coherenceCheck` came to hold "this is missing save for now. Please refine this." in
 * the 2 Aug run: two Lex attempts failed, the fallback fired, and the failure was
 * indistinguishable from a successful generation. A failed draft is now REPORTED, not
 * papered over — same principle as the stub removal in Task 1a.
 */
const DERIVABLE_FALLBACK_KEYS = new Set(['title', 'keywords', 'challenge'])

/** A proposed scalar (title/keywords/challenge/pivotalObstacle/summaryDiagnosis…). */
async function proposeScalar(
  ideaId: string, userId: string, def: FieldDef, state: CanonicalState,
  opts: { directive?: string; presetValue?: unknown } = {},
): Promise<string> {
  let chatText = ''
  let applied = false

  // Some fields are COMPOSED by the platform, not guessed by the model.
  if (opts.presetValue !== undefined) {
    await setProposal(ideaId, def.key, { value: opts.presetValue })
    applied = true
  } else {
    try {
      const prompt = await buildPrompt(ideaId, userId, state, def)
      const directive = opts.directive ??
        `[Propose a ${def.label} now from what the user has told you, and say one short sentence about it in chatText.]`
      const lex = await runLexTurn(prompt, directive, await chatHistory(ideaId))
      chatText = lex.chatText
      if (lex.proposal && lex.proposal.fieldKey === def.key) {
        const rawValue = def.key === 'keywords' ? lex.proposal.valueList : lex.proposal.valueText
        const valid = validateProposal({ fieldKey: def.key, value: rawValue, rationale: lex.proposal.rationale })
        if (valid) {
          await setProposal(ideaId, def.key, { value: valid.value, rationale: valid.rationale })
          applied = true
        }
      }
      if (lex.extracted && Object.keys(lex.extracted).length) {
        await storeExtracted(ideaId, userId, lex.extracted).catch(() => {})
      }
    } catch (err) {
      console.warn('[lex-diag] generation threw', { field: def.key, error: err instanceof Error ? err.message : err })
    }
  }

  if (applied) return chatText

  if (DERIVABLE_FALLBACK_KEYS.has(def.key)) {
    // A rough draft built from the user's own words — honest enough to offer.
    await setProposal(ideaId, def.key, { value: fallbackValue(def.key, state) })
    return chatText || fallbackChat(def.key)
  }

  // Generation failed and there is nothing truthful to put in the box. Leave the field
  // EMPTY (so the panel still offers Save/Skip and the conductor can retry on the next
  // write) and SAY SO.
  console.warn('[lex-diag] generation failed — reporting, not substituting', { field: def.key })
  const honest = await honestFailureMessage(ideaId, userId, state, def)
  return honest
}

/**
 * §19-D Task 1b — the problem field, with the gate applied on the first pass.
 *
 * The source material is whatever the user wrote on Page 1. Where that is a SOLUTION,
 * Lex must not silently manufacture a problem to sit under it: it proposes the most
 * likely reading (so agreeing is one click) and says openly that it is a guess, asking
 * what is actually going wrong. Where it already reads as a problem this behaves
 * exactly as it did.
 */
async function proposeProblem(
  ideaId: string, userId: string, def: FieldDef, state: CanonicalState,
): Promise<string> {
  const source = [
    (acceptedValue(state, 'ideaNarrative') as string) ?? '',
    (acceptedValue(state, 'youAndIdeaNarrative') as string) ?? '',
  ].join(' ').trim()
  const solutionShaped = looksLikeASolution(source)
  console.log('[lex-diag] problem gate', {
    press: 1, solutionShaped, sourceLen: source.length, sample: source.slice(0, 80),
  })

  const directive = solutionShaped
    ? `[The user has described what they want DONE, not what is going WRONG. Their words: "${source.slice(0, 400)}". ` +
      `Apply the problem gate. In chatText: acknowledge the remedy they have in mind in half a sentence, then ask ` +
      `what is going wrong that it would fix — offering two or three concrete readings of the problem so they can ` +
      `just pick one. ALSO return a proposal for "${def.key}" with your best reading stated as a problem (what is ` +
      `wrong, for whom, why it matters), and say in chatText that it is your reading and to correct it if it is not ` +
      `theirs. Do not lecture, do not use the words "solution" or "problem statement" as jargon, and do not refuse ` +
      `to proceed.]`
    : `[Propose THE PROBLEM in one sentence — what is wrong, for whom, and why it matters — drawn from the user's ` +
      `own words. No remedy in it. proposal.fieldKey "${def.key}", proposal.valueText. One short sentence in chatText.]`

  return proposeScalar(ideaId, userId, def, state, { directive })
}

/** Tell the user a draft failed, in Lex's voice, grounded in the facts of the turn. */
async function honestFailureMessage(
  ideaId: string, userId: string, state: CanonicalState, def: FieldDef,
): Promise<string> {
  const fallback =
    `I wasn't able to draft the ${def.label.toLowerCase()} just then — that's on me, not you. ` +
    `Say the word and I'll try again, or write it yourself in the panel and Save.`
  try {
    const facts = await factsFor(ideaId, state, { generationFailed: def.label })
    const prompt = await buildPrompt(ideaId, userId, state, def, { factsBlock: facts })
    const lex = await runLexTurn(
      prompt,
      `[Your attempt to draft the ${def.label} failed. In ONE or TWO sentences tell the user plainly that you couldn't draft it, and offer to try again or let them write it themselves. Do not produce the draft. Emit no proposal.]`,
      await chatHistory(ideaId),
    )
    return lex.chatText || fallback
  } catch {
    return fallback
  }
}

/**
 * A structured panel box (whoAffectedImpactCost / legalLandscape / anticipatedResponses).
 *
 * §19-D Task 2a — THE SEED IS NOT ALWAYS A PROPOSAL. It used to be: every structured
 * field was pushed to AWAITING_CONFIRMATION with `{slot: ''}` for each slot, and the
 * panel renders "proposed by Lex" off the status alone. That is how the legal-landscape
 * box came to carry a "Proposed by Lex" badge over five empty inputs on the 10 Aug
 * walk-through — Lex proposed nothing and the UI said it had. A field with no content
 * to offer now stays EMPTY, which is what it is.
 *
 * §19-D Task 2c — anticipatedResponses is the field the user is LEAST able to fill from
 * a blank box and Lex is best placed to draft, so it is generated rather than blanked.
 */
async function seedStructured(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  if (def.key === 'anticipatedResponses') return seedAnticipatedResponses(ideaId, userId, def, state)

  const seed =
    def.key === 'whoAffectedImpactCost'
      ? await buildWhoAffectedSeed(ideaId)
      : Object.fromEntries((def.slots ?? []).map((k) => [k, '']))

  // Only claim a proposal when at least one slot actually carries something.
  const hasContent = Object.values(seed).some((v) => typeof v === 'string' && v.trim())
  if (hasContent) await setProposal(ideaId, def.key, { value: seed })
  else console.log('[lex-diag] structured field left EMPTY — nothing to propose', { field: def.key })

  return askQuestion(ideaId, userId, def, state)
}

/** §19-D Task 2c — draft the five anticipated responses so the user sharpens rather
 *  than invents. A failed draft is REPORTED; it never becomes five empty boxes with a
 *  "proposed by Lex" badge over them. */
async function seedAnticipatedResponses(
  ideaId: string, userId: string, def: FieldDef, state: CanonicalState,
): Promise<string> {
  const drafted = await generateAnticipatedResponses({
    chosenApproach: (acceptedValue(state, 'chosenApproach') as string) ?? '',
    pivotalObstacle: (acceptedValue(state, 'pivotalObstacle') as string) ?? '',
    challenge: (acceptedValue(state, 'challenge') as string) ?? '',
    leverage: (acceptedValue(state, 'leverage') as string) ?? undefined,
  })
  const filled = drafted ? Object.values(drafted).filter((v) => v.trim()).length : 0
  console.log('[lex-diag] anticipated responses seeded', { filled, of: def.slots?.length ?? 5 })

  if (!drafted) return honestFailureMessage(ideaId, userId, state, def)

  await setProposal(ideaId, def.key, { value: drafted })
  return (
    `I've had a go at the five responses this approach would provoke — avoidance, gaming, ` +
    `enforcement burden, legal challenge and the political attack line. They're in the panel as ` +
    `drafts: sharpen them, cut what's wrong, add what I've missed.`
  )
}

/** The causes loop: pre-seed candidates from the corpus (CAUSE_SEEDING), then invite
 *  curation. Set AWAITING so the field stays current AND the candidates aren't re-seeded. */
async function seedCauses(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  // A4: instrument every stage so the [lex-diag] log reveals WHERE seeding stopped
  // (search fired? results? snippets? generator empty/error?). Bytes before hypotheses.
  const diag: Record<string, unknown> = { challengeLen: 0, keywordCount: 0, results: 0, snippets: 0, generated: 0, created: 0, fallbackUsed: false }
  try {
    const challenge = (acceptedValue(state, 'challenge') as string) ?? ''
    const keywords = (acceptedValue(state, 'keywords') as string[] | null) ?? []
    const context = [challenge, acceptedValue(state, 'ideaNarrative')].filter(Boolean).join(' ').slice(0, 500)
    const searchTerms = keywords.length ? keywords : challenge.split(/\s+/).filter(Boolean).slice(0, 8)
    diag.challengeLen = challenge.length
    diag.keywordCount = searchTerms.length

    const { results } = await runSearch({ keywords: searchTerms, intent: 'CAUSE_SEEDING', ideaContext: context, limit: 10 })
    diag.results = results.length
    // `results` is stream-INTERLEAVED on the routed path (query-router.ts::runRoutedSearch), so
    // this prefix samples every routed stream. Before that fix it was a flat concatenation and
    // these 8 snippets came off the front of the legislation block — cause seeding was reading
    // Acts and calling it "what Parliament examined". Do not slice a flat concatenation here.
    const relevant = results.filter((r) => r.type === 'DEBATE' || r.type === 'COMMITTEE' || r.type === 'PRIMARY_LEGISLATION')
    const snippets = relevant.map((r) => `${r.citation}: ${r.snippet}`).slice(0, 8)
    diag.snippets = snippets.length

    // Generate — with ONE retry. The retry is DELIBERATELY DIFFERENT (fewer, shorter,
    // no nesting): a second identical call against a deterministic budget wall just
    // hits the same wall, which is CLAUDE.md §13's "retry is not appropriate for parse
    // failures" in another costume. That is what happened on 10 Aug.
    let candidates = await generateCauseCandidates({ challenge, context, snippets })
    if (!candidates.length) candidates = await generateCauseCandidates({ challenge, context, snippets, terse: true })
    diag.generated = candidates.length

    // §19-D Task 8 — THE FALLBACK IS GONE, on purpose.
    //
    // It used to mint one candidate per corpus hit reading "A factor examined in
    // <document title>", so that the acceptance "candidates seeded from the corpus"
    // always held. It held by making the sentence true and the content false: those
    // rows fail BOTH of Charlie's tests — they are not expressed as causes, and they
    // have no stated causal relationship to the problem. The 10 Aug walk-through
    // received exactly two of them, and it is the only thing that reached the panel
    // because the generator was returning nothing (see the budget fix in lex-client).
    //
    // // A corpus hit that fails the causal test is a RELATED DOCUMENT, not a cause.
    // The documents are not lost: they are already in the right-hand panel, which is
    // where a document belongs. What the user gets here is either causes or candour.
    if (!candidates.length) {
      diag.fallbackUsed = false
      diag.relevantDocsAvailable = relevant.length
    }

    if (candidates.length) {
      await createCauses(ideaId, candidates, 'LEX_CORPUS')
      diag.created = candidates.length
    }
  } catch (err) {
    diag.error = err instanceof Error ? err.message : String(err)
  }
  console.log('[lex-diag] cause seeding', diag)
  // Mark the loop AWAITING so it stays current while the user curates (and isn't re-seeded).
  await setProposal(ideaId, def.key, { value: '' })

  // §19-C Task 3 / §19-D Task 2 — say what actually happened. The field's configured
  // question promises seeding ("I'll seed a few that others have identified"), so when
  // nothing was seeded it must not be the thing the user reads.
  if (!diag.created) {
    return (
      `I couldn't turn what the corpus holds on this into causes I'd stand behind — the material ` +
      `is there in the panel on the right, but none of it says plainly what is CAUSING your problem, ` +
      `and I'm not going to dress a document title up as a cause. Let's do it the other way round: ` +
      `what do you think is causing this, and why has each one persisted? I'll press on each as we go.`
    )
  }
  return askQuestion(ideaId, userId, def, state)
}

/** Page 3 policy-options loop: seed candidate approaches per material cause (with a
 *  genuine case for and against), then invite evaluation. AWAITING so it stays current. */
async function seedPolicyOptions(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const pivotalObstacle = (acceptedValue(state, 'pivotalObstacle') as string) ?? ''
  const rootCause = (acceptedValue(state, 'rootCause') as string) ?? ''
  const materialCauses = state.diagnosisCauses.filter((c) => c.classification === 'MATERIAL').map((c) => c.cause)
  // If nothing was marked material, fall back to all causes so seeding still runs.
  const causes = materialCauses.length ? materialCauses : state.diagnosisCauses.map((c) => c.cause)

  let created = 0
  try {
    const context = [acceptedValue(state, 'challenge'), acceptedValue(state, 'summaryDiagnosis')].filter(Boolean).join(' ').slice(0, 600)
    let candidates = await generatePolicyOptions({ pivotalObstacle, materialCauses: causes, context })
    // §19-D Task 2b — one retry, as cause seeding has. On 10 Aug this generator
    // returned nothing (0 LEX-sourced options are in the database for that idea) and
    // there was no second attempt, so a single transient 429 cost the whole stage.
    if (!candidates.length) candidates = await generatePolicyOptions({ pivotalObstacle, materialCauses: causes.slice(0, 3), context })
    if (candidates.length) {
      await createPolicyOptions(ideaId, candidates.map((c) => ({ ...c, source: 'LEX' as const })), 'LEX')
      created = candidates.length
    }
  } catch (err) {
    console.warn('[orchestrator] policy seeding failed (user can add their own):', err instanceof Error ? err.message : err)
  }
  await setProposal(ideaId, def.key, { value: '' })

  // §19-C Task 3 — Lex speaks only AFTER the rows exist, and the count it sees is the
  // count that persisted (the 2 Aug "I've pulled some options" was said with zero rows
  // in the table). The facts block is rebuilt from fresh state for exactly this reason.
  const fresh = (await computeCanonicalState(ideaId)) ?? state
  console.log('[lex-diag] policy options seeded', { created, nowInDb: fresh.policyOptions.length })

  // §19-C Task 3 — the orientation must be about THIS idea: name the user's own
  // material causes and obstacle, not the method in the abstract.
  const specifics = [
    rootCause ? `their root cause: "${rootCause}"` : '',
    pivotalObstacle ? `their pivotal obstacle: "${pivotalObstacle}"` : '',
    causes.length ? `the causes they identified: ${causes.slice(0, 4).map((c) => `"${c}"`).join(', ')}` : '',
  ].filter(Boolean).join('; ')

  const directive =
    `[The user has just entered Guiding Policy. ${fresh.policyOptions.length
      ? `${fresh.policyOptions.length} candidate approach(es) are now showing in the panel.`
      : 'NO candidate approaches were generated — do not say any are there.'} ` +
    `In 2–4 sentences, orient them: a guiding policy is an APPROACH to the obstacle, designed not picked, ` +
    `and choosing one rules the others out — but say it in terms of ${specifics || 'their own diagnosis'}. ` +
    `Name their actual obstacle and causes in your own words rather than talking about method in the abstract. ` +
    `Then invite them to weigh, edit and add options in the panel. Emit no proposal.]`

  try {
    const prompt = await buildPrompt(ideaId, userId, fresh, def)
    const lex = await runLexTurn(prompt, directive, await chatHistory(ideaId))
    if (lex.chatText) return lex.chatText
  } catch { /* fall through */ }

  // §19-D Task 2b — THE FALLBACK MUST NOT PROMISE WHAT DID NOT HAPPEN. This used to
  // return the field's configured question, which reads "I'll seed a few candidates per
  // material cause with the case for and against each" — said, on the 10 Aug run, over
  // an empty options list. The fallback now reports the actual count.
  return fresh.policyOptions.length
    ? `There ${fresh.policyOptions.length === 1 ? 'is 1 candidate approach' : `are ${fresh.policyOptions.length} candidate approaches`} in the panel to weigh — argue them, edit them, add your own. A guiding policy is an approach to the obstacle, and choosing one rules the others out.`
    : `I wasn't able to draft any candidate approaches just then — nothing has been put in the panel. Add the approaches you're weighing and I'll argue each side with you, or say the word and I'll try again.`
}

/** Page 4 actions loop: no corpus seeding — the user authors actions and Lex helps in
 *  chat + on the costing. Set AWAITING so the loop stays current while they build it. */
async function seedActions(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  await setProposal(ideaId, def.key, { value: '' })
  return askQuestion(ideaId, userId, def, state)
}

/** Proposed scalars whose value is COMPUTED by the platform, not guessed by Lex:
 *  whatItRulesOut (composed from the RULED_OUT options) and costSummary (aggregated
 *  §18.2 costs vs the Page 2 problem cost). Seed the computed proposal → inline accept. */
async function seedComputedProposed(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  if (def.key === 'costSummary') {
    const { summary } = await computeCostSummary(ideaId)
    await setProposal(ideaId, def.key, { value: summary })
    return 'I’ve totted up the plan’s costs against what the problem costs — it’s in the chat to accept. Every figure is a range; challenge any of them.'
  }
  // whatItRulesOut — the RULED_OUT records are the raw material, but the composition
  // should read like an argument, not a list join (§19-C Task 4: the mechanical
  // "Choosing this approach rules out: We could legislate." was the 2 Aug output).
  const options = await listPolicyOptions(ideaId)
  const ruledOut = options.filter((o) => o.status === 'RULED_OUT')
  const chosen = options.find((o) => o.status === 'CHOSEN')
  if (!ruledOut.length) {
    await setProposal(ideaId, def.key, {
      value:
        'Choosing this approach means committing to it over the alternatives considered, and accepting ' +
        'the trade-offs that come with it.',
    })
    return 'Here’s what this choice commits you to — accept it or sharpen it.'
  }
  const material = ruledOut
    .map((o) => `- ${o.approach}${o.caseFor ? ` (its case was: ${o.caseFor})` : ''}${o.ruleOutReason ? ` — set aside because: ${o.ruleOutReason}` : ''}`)
    .join('\n')
  return proposeScalar(ideaId, userId, def, state, {
    directive:
      `[Compose WHAT THIS POLICY RULES OUT. The user chose: "${chosen?.approach ?? '(the chosen approach)'}". ` +
      `They set these aside:\n${material}\n` +
      'Write 2–4 sentences naming what is now off the table and what is given up by not doing it — the ' +
      'residue of choosing. Ground it strictly in the options above; do not invent alternatives. ' +
      'proposal.fieldKey "whatItRulesOut", proposal.valueText. One short sentence in chatText.]',
  })
}

/**
 * §19-C Task 5 — the coherence check, to spec. A structured review generated from the
 * actual actions and the actual diagnosis, then rendered into the field for the user
 * to accept. Corpus grounding (committee post-mortems and similar) is flag-gated:
 * LEX_COHERENCE_CORPUS=true routes it through the gateway; off, the structured review
 * stands alone. A failed review is reported, never replaced with placeholder text.
 */
async function seedCoherenceCheck(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const actions = await listActions(ideaId)
  if (!actions.length) {
    return proposeScalar(ideaId, userId, def, state, {
      presetValue: 'No actions have been recorded yet, so there is nothing to review for coherence.',
    })
  }

  let corpusNotes: string[] | undefined
  if (flagEnabled('LEX_COHERENCE_CORPUS')) {
    try {
      const { results } = await runSearch({
        keywords: [
          ...(acceptedValue(state, 'keywords') as string[] | null ?? []),
          'implementation', 'lessons learned', 'post-implementation review',
        ].filter(Boolean),
        intent: 'CAUSE_SEEDING',
        ideaContext: (acceptedValue(state, 'summaryDiagnosis') as string) ?? '',
        limit: 8,
      })
      // Same note as seedCauses: the prefix is safe because `results` is interleaved, not
      // concatenated. See lib/lex/interleave.ts.
      corpusNotes = results
        .filter((r) => r.type === 'COMMITTEE' || r.type === 'DEBATE')
        .slice(0, 5)
        .map((r) => `${r.citation}: ${r.snippet.slice(0, 200)}`)
    } catch { /* the review stands alone */ }
  }

  const review = await generateCoherenceReview({
    actions: actions.map((a) => ({
      practicalStep: a.practicalStep, whoImplements: a.whoImplements, mechanismType: a.mechanismType,
    })),
    chosenApproach: (acceptedValue(state, 'chosenApproach') as string) ?? '',
    rootCause: (acceptedValue(state, 'rootCause') as string) ?? '',
    pivotalObstacle: (acceptedValue(state, 'pivotalObstacle') as string) ?? '',
    causes: state.diagnosisCauses.map((c) => c.cause),
    corpusNotes,
  })

  if (!review) {
    console.warn('[lex-diag] coherence review generation failed — reporting honestly')
    return honestFailureMessage(ideaId, userId, state, def)
  }

  const unnamed = actions.filter((a) => !a.whoImplements?.trim()).length
  console.log('[lex-diag] coherence review', {
    actions: actions.length, gaps: review.gaps.length, flaws: review.flaws.length,
    missingImplementers: review.missingImplementers.length, sequence: review.sequence.length, unnamed,
  })
  await setProposal(ideaId, def.key, { value: formatCoherenceReview(review) })
  return (
    `I've read the plan back as a reviewer would — gaps, how it could go wrong, ` +
    `${unnamed ? `${unnamed} action${unnamed === 1 ? '' : 's'} still without a named implementer, ` : ''}` +
    `a suggested order, and whether this actually defeats the diagnosis. It's in the panel to accept or argue with.`
  )
}

// ── End-of-page wrap-up (§19-B Task 2) ───────────────────────────────────────
// A completed page must never dead-end in chat: the conductor says what has just
// been achieved, what the briefing is FOR, and what the next three sections do —
// and the client renders an inline "Continue to …" action alongside it (the same
// surface the AcceptCard uses). VERBATIM copy, per the brief.

const ORIENTATION_WRAP_BRIEFING =
  "That completes the first section — the bare bones of your idea are down. I've also put together an " +
  'initial background briefing in the legislation panel on the right. It’s preliminary research: a first ' +
  'look at what’s already out there — the law, what Parliament has said, and a few threads worth pulling — ' +
  'to spark ideas for further investigation. We’ll refine and deepen it as we go.'

const ORIENTATION_WRAP_NO_BRIEFING =
  'That completes the first section — the bare bones of your idea are down.'

const ORIENTATION_WRAP_ONWARD =
  'From here the real work starts. Over the next three sections we’ll establish what’s actually causing ' +
  'the problem, find the points of leverage for solving it, weigh the alternatives and choose the ' +
  'strongest solution, and build a robust, defensible case for the one you propose. Ready to start the ' +
  'diagnosis?'

/** The two bubbles that close a completed page and offer the transition. */
function wrapUpBubbles(state: CanonicalState): string[] {
  const nextLabel = state.nextPage?.label ?? 'the next section'
  if (state.stage === 'ORIENTATION') {
    return [
      state.initialBackground?.status === 'ready' ? ORIENTATION_WRAP_BRIEFING : ORIENTATION_WRAP_NO_BRIEFING,
      ORIENTATION_WRAP_ONWARD,
    ]
  }
  const doneLabel = state.pages.find((p) => p.key === state.stage)?.label ?? 'this section'
  return [
    `That completes ${doneLabel} — it’s all captured in the panel, and you can reopen anything in it later.`,
    `Next comes ${nextLabel}, which builds directly on what you’ve just settled. Ready to start ${nextLabel}?`,
  ]
}

/** Post the wrap-up once. Returns the bubbles for the client (empty if already said). */
async function conductPageWrapUp(ideaId: string, state: CanonicalState): Promise<{ messages: string[] }> {
  const bubbles = wrapUpBubbles(state)
  const recent = (await chatHistory(ideaId)).slice(-8).map((m) => m.content.trim())
  if (recent.includes(bubbles[bubbles.length - 1].trim())) {
    console.log('[lex-diag] wrap-up already said', { page: state.stage })
    return { messages: [] }
  }
  console.log('[lex-diag] page wrap-up', { page: state.stage, nextPage: state.nextPage?.key ?? null })
  await pushLex(ideaId, bubbles, state.stage)
  return { messages: bubbles }
}

/** The conductor. Returns any new Lex chat bubbles for the client to append. */
export async function orchestrateAfterWrite(ideaId: string, userId: string): Promise<{ messages: string[] }> {
  const state = await computeCanonicalState(ideaId)
  if (!state) return { messages: [] }
  if (!state.currentField) {
    // The page is finished. If there's a next page, close this one properly and
    // offer the transition (§19-B Task 2) — never leave the chat with nothing to do.
    return state.nextPage ? conductPageWrapUp(ideaId, state) : { messages: [] }
  }
  const def = fieldDef(state.currentField.key)
  if (!def) return { messages: [] }
  // Only speak when the current field is freshly EMPTY (needs a prompt). If it is
  // AWAITING_CONFIRMATION the user is mid-decision — don't talk over them, and do NOT
  // advance (the field stays current until Saved/Skipped — §13 / Sprint 1.3 / §3a).
  if (state.currentField.status !== 'EMPTY') {
    console.log('[lex-diag] orchestrator holding (current field not yet saved)', {
      currentField: state.currentField.key,
      status: state.currentField.status,
    })
    return { messages: [] }
  }
  console.log('[lex-diag] orchestrator advancing', { currentField: def.key, type: def.type, page: state.stage })

  let text: string
  if (def.key === PROBLEM_FIELD_KEY) {
    // §19-D Task 1b — the FIRST press. The problem field is proposed from the user's
    // own Page-1 words, and on 10 Aug those words were a solution ("I want to change
    // the amount charged for plastic bags in shops"). Lex quietly turned it into a
    // problem-shaped sentence of its own invention and moved on, which is how a
    // strategy comes to rest on a diagnosis nobody made. It now ASKS.
    text = await proposeProblem(ideaId, userId, def, state)
  } else if (def.key === 'coherenceCheck') {
    // §19-C Task 5 — the structured reviewer pass, not a generic proposal.
    text = await seedCoherenceCheck(ideaId, userId, def, state)
  } else if (def.key === 'whatItRulesOut' || def.key === 'costSummary') {
    // Proposed scalars whose value the platform COMPUTES (not Lex).
    text = await seedComputedProposed(ideaId, userId, def, state)
  } else if (def.origin === 'proposed') {
    text = await proposeScalar(ideaId, userId, def, state)
  } else if (def.type === 'structured') {
    text = await seedStructured(ideaId, userId, def, state)
  } else if (def.type === 'loop') {
    // Dispatch the loop by which child entity it drives.
    text =
      def.key === 'policyOptions' ? await seedPolicyOptions(ideaId, userId, def, state)
        : def.key === 'actions' ? await seedActions(ideaId, userId, def, state)
          : await seedCauses(ideaId, userId, def, state)
  } else {
    // narrative box and reference (rootCause / chosenApproach): just ask the question.
    text = await askQuestion(ideaId, userId, def, state)
  }

  // A5: dedupe — if this bubble is identical to the last thing Lex said, don't repeat it.
  const history = await chatHistory(ideaId)
  const last = history.length ? history[history.length - 1] : null
  if (last && last.role === 'lex' && last.content.trim() === text.trim()) {
    console.log('[lex-diag] orchestrator suppressed duplicate bubble', { field: def.key })
    return { messages: [] }
  }

  // Tag the bubble with the field it was said about, so the problem gate can count its
  // own presses (§19-D Task 1b) without a schema change.
  await pushLex(ideaId, text, state.stage, def.key)
  return { messages: [text] }
}
