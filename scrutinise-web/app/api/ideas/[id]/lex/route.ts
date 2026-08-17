import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { fieldDef } from '@/lib/lex/page1-config'
import { buildLexSystemPrompt, runLexTurn } from '@/lib/lex/lex-client'
import { setProposal, storeExtracted, addCause, listCauses, setRootCause } from '@/lib/lex/field-machine'
import { validateProposal } from '@/lib/lex/proposal-schema'
import { isContinueIntent, performStageAdvance, isResearchRequest, researchQueryFrom } from '@/lib/lex/stage'
import { countProblemPresses } from '@/lib/lex/orchestrator'
import { acceptedSummary as buildAcceptedSummary, sourceValuesFor } from '@/lib/lex/accepted-context'
import { matchCause, AMBIGUOUS } from '@/lib/lex/match-cause'
import { PROBLEM_FIELD_KEY, looksLikeAQuestion } from '@/lib/lex/method'
import { runLexTools } from '@/lib/lex/tools/tool-runner'
import { runAdHocResearch, readStageSearches, displayStageFor, type ResearchRecord } from '@/lib/lex/stage-search'
import { buildFactsBlock } from '@/lib/lex/facts'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({ message: z.string().trim().min(1).max(4000) })

type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string; field?: string }

// POST /api/ideas/[id]/lex — one Lex turn. Lex returns content only; the
// platform validates any proposal and sets state. State never half-advances (§4).
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz

  if (!checkRateLimit(`ai:${user.id}`, 50, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 50 messages per hour.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const { message } = parsed.data

  // Current field is whatever the platform says — never the model's choice.
  let pre = await computeCanonicalState(id)
  if (!pre) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── §19-B Task 1: chat-expressed intent to continue advances the STAGE, via the
  // same server-side path as the panel CTA — the platform moves first, then Lex
  // speaks for the new page. Lex is never left conducting a page the state machine
  // has not entered. // Invariant: chat page == state page, always. If they can
  // diverge, the bug will recur somewhere else.
  if (!pre.currentField && pre.nextPage && isContinueIntent(message)) {
    const now = new Date().toISOString()
    const historyWithUser: ChatMsg[] = [
      ...(Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
      { role: 'user', content: message, timestamp: now, stage: pre.stage },
    ].slice(-60)
    await prisma.idea.update({ where: { id }, data: { aiChatHistory: historyWithUser } })

    const { advanced, messages } = await performStageAdvance(id, idea.creatorId, 'chat-assent')
    const state = await computeCanonicalState(id)
    console.log('[lex-diag] lex turn → stage advance', {
      via: 'chat-assent', advanced, currentField: state?.currentField?.key ?? null,
    })
    if (advanced) return NextResponse.json({ chatText: null, messages, state })
    // Advance refused (page not actually complete) — fall through to a normal turn
    // against freshly-read state.
    pre = (await computeCanonicalState(id)) ?? pre
  }

  // ── §19-C Task 1c: an explicit request to search the corpus is HANDLED, not
  // improvised. The platform runs the search, stores the references in the panel,
  // and Lex describes only what came back (the facts block enforces that).
  let research: ResearchRecord | null = null
  if (isResearchRequest(message)) {
    const query = researchQueryFrom(message) || message
    research = await runAdHocResearch(id, query)
    console.log('[lex-diag] ad-hoc research from chat', { query: query.slice(0, 80), ok: research.ok, results: research.results.length })
  }

  const current = pre.currentField ? fieldDef(pre.currentField.key) ?? null : null
  // While the current box already holds an unsaved proposal, Lex refines THAT box
  // only and points the user to Save — it must not advance (§13 / Sprint 1.3).
  const awaiting = pre.currentField?.status === 'AWAITING_CONFIRMATION'

  const allAcceptedFields = pre.pages.flatMap((p) => p.fields)
  // §19-E Task 1 — ONE copy, shared with the conductor. This was a second `.slice(0, 80)`
  // living here, and it is the one Charlie's chat turns actually went through.
  const acceptedSummary = buildAcceptedSummary(pre)

  const history = (Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : [])
    .filter((m) => m.role === 'user' || m.role === 'lex')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))

  // Tool call (STATS_PHASE_A_BRIEF §7). A separate tools-enabled model call decides
  // whether this turn needs real figures; the platform executes the lookup and hands
  // the observations to the turn below as grounded context. Lex never fetches, and
  // never states a number that isn't in that block. Resilient: any failure → no block,
  // and the turn proceeds exactly as it does today.
  const tools = await runLexTools(message, history)

  // §19-C Task 1b — the facts of THIS turn. If a research search just ran, its actual
  // results are the facts; otherwise the active stage's stored search is, so Lex can
  // describe the panel truthfully and can never point at content it hasn't seen.
  const stageStore = readStageSearches(
    (await prisma.idea.findUnique({ where: { id }, select: { stageSearches: true } }))?.stageSearches,
  )
  const stageRecord = research ?? stageStore.byStage[displayStageFor(pre.stage)] ?? null
  const factsBlock = buildFactsBlock({ state: pre, search: stageRecord })

  // §19-D Task 1b — the problem gate. Presses are counted from the transcript (every
  // bubble Lex writes while the problem field is current carries its key), so the gate
  // spends itself after two and the user is never nagged a third time.
  const problemPresses = current?.key === PROBLEM_FIELD_KEY ? countProblemPresses(idea.aiChatHistory) : 0

  // §19-E Task 2 — is this turn a QUESTION, and are there sources in hand to press the
  // user to read? Both are logged, so "the answer-first block never fired" and "it fired
  // and Lex still dodged" are distinguishable from outside — the §18 corollary.
  const questionTurn = looksLikeAQuestion(message)
  const sourcesInHand = !!stageRecord?.ok && (stageRecord.results?.length ?? 0) > 0
  console.log('[lex-diag] turn shape', {
    questionTurn, sourcesInHand, sources: stageRecord?.results?.length ?? 0,
    currentField: current?.key ?? null, sample: message.slice(0, 60),
  })

  const ideaCount = await prisma.idea.count({ where: { creatorId: idea.creatorId } })
  const systemPrompt = buildLexSystemPrompt({
    preferredName: user.preferredName ?? user.firstName,
    lexMode: user.aiPreferredStyle?.toUpperCase() ?? 'COLLABORATIVE',
    experienceLevel: pre.userProfile.experienceLevel,
    ideaTitle: (allAcceptedFields.find((f) => f.key === 'title')?.value as string | null) ?? idea.title,
    isFirstIdea: ideaCount <= 1,
    currentField: current,
    awaiting,
    // The method block and the transition guard both key off the STATE MACHINE's page.
    activePage: pre.stage,
    nextPageLabel: !current ? pre.nextPage?.label ?? null : null,
    statsBlock: tools.block ?? null,
    factsBlock,
    acceptedSummary,
    sourceValuesBlock: sourceValuesFor(current?.key ?? null, pre),
    problemPresses,
    questionTurn,
    sourcesInHand,
  })

  let lex
  try {
    // BRIEF_SEARCH_S6 §3 addendum — attribution passed in, so this turn lands in the ledger
    // against a user and an idea rather than as an unattributed row.
    lex = await runLexTurn(systemPrompt, message, history, { userId: user.id, ideaId: id })
  } catch (err) {
    // Per-attempt status/body already logged in runLexTurn; this is the summary.
    const e = err as { kind?: string; status?: number; message?: string }
    console.error('[lex] turn failed (after retries)', { kind: e.kind ?? null, status: e.status ?? null, message: e.message })
    return NextResponse.json({ error: 'Lex unavailable', errorType: e.kind ?? 'api_error' }, { status: 502 })
  }

  // Proposal handling (§4 + §13): act only on a proposal for the CURRENT field
  // (narrative box or Title/Keywords) and only when valid. Otherwise discard —
  // chatText is still shown, state never half-advances. On a valid box proposal
  // the field goes AWAITING_CONFIRMATION and the box renders the tidied text.
  let proposalApplied = false

  // §19-D Task 9g — a chat-named cause joins the loop instead of the user being asked
  // to re-type it into the panel. It is the ONE loop that takes a chat proposal, and it
  // lands as source USER because they are the user's own words, tidied — the panel's
  // "from past debates" badge belongs only to corpus-seeded rows. The user still
  // classifies, nests, edits or removes each one; adding it is not accepting it.
  // §19-E Task 2a — ON A QUESTION TURN, A PROPOSAL IS DISCARDED. The prompt tells Lex
  // not to emit one; this makes it true regardless, because the platform owns state and
  // "I've drafted a summary" is not an answer to "is a Charter the right instrument?".
  // Nothing is lost: the field stays current, unchanged, and the next turn picks it up.
  if (questionTurn && lex.proposal) {
    console.log('[lex-diag] proposal discarded — question turn', {
      currentField: current?.key ?? null, proposedFor: lex.proposal.fieldKey,
    })
    lex.proposal = null
  }

  // §19-E Task 7 — A CHAT ANSWER SELECTS THE ROOT CAUSE.
  //
  // Diagnosis was the stage where the interaction silently changed from "answer in chat
  // OR the panel" to panel-only, and this step is why: the root cause is a SELECTION
  // from the causes list, so there was nowhere for a chat answer to go and Lex said
  // "over to you". Lex now proposes the cause TEXT and the platform resolves it to a
  // row — the same shape as the causes loop, which is the one loop that already took a
  // chat answer.
  //
  // Resolution is deliberately forgiving (exact → prefix → containment → word overlap)
  // because the user will say "the incentives one", not recite the sentence. It is also
  // deliberately REFUSED WHEN AMBIGUOUS: two candidates matching equally well means we
  // do not know which they meant, and picking one would be the platform inventing the
  // most consequential choice on the page.
  if (current?.key === 'rootCause' && lex.proposal?.fieldKey === 'rootCause' && lex.proposal.valueText?.trim()) {
    const causes = await listCauses(id)
    const match = matchCause(lex.proposal.valueText, causes.map((c) => ({ id: c.id, cause: c.cause })))
    const resolved = match && match !== AMBIGUOUS ? match : null
    console.log('[lex-diag] root cause named in chat', {
      said: lex.proposal.valueText.slice(0, 60), candidates: causes.length,
      matched: resolved?.id ?? null, ambiguous: match === AMBIGUOUS,
    })
    if (resolved) proposalApplied = await setRootCause(id, resolved.id)
    // No match, or ambiguous: nothing is set, Lex's chatText still shows, and the field
    // stays current with the panel selector available. Silence here is correct — the
    // alternative is choosing the root cause on the user's behalf.
  } else if (current?.key === 'causes' && lex.proposal?.fieldKey === 'causes' && lex.proposal.valueList?.length) {
    const named = lex.proposal.valueList.map((c) => c.trim()).filter((c) => c.length >= 8).slice(0, 5)
    const existing = (await listCauses(id)).map((c) => c.cause.trim().toLowerCase())
    const fresh = named.filter((c) => !existing.includes(c.toLowerCase()))
    for (const cause of fresh) await addCause(id, { cause, source: 'USER' })
    proposalApplied = fresh.length > 0
    console.log('[lex-diag] causes proposed in chat', { named: named.length, added: fresh.length })
  } else if (current && lex.proposal && lex.proposal.fieldKey === current.key) {
    // A1: structured fields carry a valueObject (multi-slot); keywords a list; the rest text.
    const rawValue =
      current.type === 'structured' ? lex.proposal.valueObject
        : current.key === 'keywords' ? lex.proposal.valueList
          : lex.proposal.valueText
    const valid = validateProposal({ fieldKey: current.key, value: rawValue, rationale: lex.proposal.rationale })
    if (valid) {
      await setProposal(id, current.key, { value: valid.value, rationale: valid.rationale })
      proposalApplied = true
    }
  }
  // Diagnostic (Sprint 1.3 Task 1 — log/inspect, bytes before hypotheses). The
  // platform NEVER advances currentField on a /lex turn and only ever sets a
  // proposal for the current field; this records any turn where Lex tried to
  // propose for a different field (so the symptom is visible if it recurs).
  if (lex.proposal && lex.proposal.fieldKey !== current?.key) {
    console.warn('[lex-diag] off-field proposal discarded', {
      currentField: current?.key ?? null,
      currentStatus: pre.currentField?.status ?? null,
      proposedFor: lex.proposal.fieldKey,
    })
  }
  console.log('[lex-diag] lex turn', {
    currentField: current?.key ?? null,
    status: pre.currentField?.status ?? null,
    awaiting,
    proposalApplied,
    ...(current?.key === PROBLEM_FIELD_KEY ? { problemPresses, gateSpent: problemPresses >= 2 } : {}),
  })

  // Extracted slots are stored, never carded (§4 extracted).
  if (Object.keys(lex.extracted).length) {
    await storeExtracted(id, idea.creatorId, lex.extracted).catch((e) =>
      console.error('[lex] storeExtracted failed:', e),
    )
  }

  // Persist chat history, each message tagged with the stage it was said in (§19-B
  // Task 3 — the chat's stage dividers must survive a reload).
  const now = new Date().toISOString()
  const updatedHistory: ChatMsg[] = [
    ...(Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
    { role: 'user', content: message, timestamp: now, stage: pre.stage },
    // Tagged with the field it was said about — this is what the problem gate counts.
    { role: 'lex', content: lex.chatText, timestamp: now, stage: pre.stage, field: current?.key },
  ].slice(-60)
  await prisma.idea.update({ where: { id }, data: { aiChatHistory: updatedHistory } })

  const state = await computeCanonicalState(id)
  return NextResponse.json({ chatText: lex.chatText, messages: [], state })
}
