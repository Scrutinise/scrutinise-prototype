import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { computeCanonicalState } from '@/lib/lex/state'
import { fieldDef } from '@/lib/lex/page1-config'
import { buildLexSystemPrompt, runLexTurn } from '@/lib/lex/lex-client'
import { setProposal, storeExtracted, addCause, listCauses, setRootCause } from '@/lib/lex/field-machine'
import { validateProposal } from '@/lib/lex/proposal-schema'
import { isContinueIntent, isPlainAssent, performStageAdvance, isCorpusSearchRequest, researchQueryFrom } from '@/lib/lex/stage'
import { runLexCorpusSearch } from '@/lib/lex/chat-corpus-search'
import { availableActionsBlock } from '@/lib/lex/available-actions'
import { requestedDraftField, draftRequestBlock, draftFiledSentence, fileLexDraft } from '@/lib/lex/lex-draft'
import { countProblemPresses } from '@/lib/lex/orchestrator'
import { acceptedSummary as buildAcceptedSummary, sourceValuesFor } from '@/lib/lex/accepted-context'
import { matchCause, AMBIGUOUS } from '@/lib/lex/match-cause'
import { PROBLEM_FIELD_KEY, looksLikeAQuestion } from '@/lib/lex/method'
import { runLexTools } from '@/lib/lex/tools/tool-runner'
import { readStageSearches, displayStageFor, type ResearchRecord } from '@/lib/lex/stage-search'
import {
  fileUrlsFromChat, filePastedTextFromChat, materialFiledBlock, statesPurpose, MIN_PASTE_CHARS, CHAT_MESSAGE_LIMIT,
  comparisonReportFrom, type ComparisonReport,
} from '@/lib/lex/chat-material'
import { pendingMaterialSince, runUpdatePass } from '@/lib/lex/update-pass'
import { MAX_TEXT_CHARS } from '@/lib/lex/user-material'
import {
  buildConsolidationOffer, pendingOffer, fileConsolidationOffer, offerFiledBlock, type FeedbackOffer,
} from '@/lib/lex/stage-relevance'
import { fileChatPolicyFeedback, policyFeedbackFiledBlock, guidingPolicyChatRules, isGuidingPolicyContext } from '@/lib/lex/policy-feedback-chat'
import { applyPolicyOp } from '@/lib/lex/guiding-policy-state'
import { buildFactsBlock } from '@/lib/lex/facts'
import { LIVE_IDEA } from '@/lib/lex/idea-visibility'
import { productFactsBlock } from '@/lib/lex/product-facts'
import {
  resolvePolicyTarget, looksLikeAReplacement, offerQuestion, AMBIGUOUS_TARGET,
  EDITABLE_TEXT_FIELDS, type EditOffer,
} from '@/lib/lex/field-edit'

type Params = { params: Promise<{ id: string }> }

/** The route's `maxDuration` is 120s (vercel.json). Past this much elapsed, a comparison is not started. */
const COMPARISON_DEADLINE_MS = 60_000

const BodySchema = z.object({
  // ⚠ 26-M follow-up — THE CEILING IS THE DOCUMENT CEILING, NOT THE CHAT ONE. A pasted article was
  // cut off at 4,000 characters, which is the failure Charlie named. The schema now admits up to
  // what a stored document may be (`MAX_TEXT_CHARS`); the route below holds an ordinary message to
  // `CHAT_MESSAGE_LIMIT` and lets a longer one through ONLY if it is filed as pasted material.
  message: z.string().trim().min(1).max(MAX_TEXT_CHARS),
  /**
   * ⚠ 25-Q §3a — 'ASK' is the first stage's chat: it answers and changes nothing. The
   * elicitation owns the state machine there, and two conductors on one page would disagree
   * about which question is live.
   */
  mode: z.enum(['FLOW', 'ASK']).optional(),
})

type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string; field?: string; offer?: FeedbackOffer }

// POST /api/ideas/[id]/lex — one Lex turn. Lex returns content only; the
// platform validates any proposal and sets state. State never half-advances (§4).
export async function POST(req: Request, { params }: Params) {
  const turnStartedAt = Date.now()
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea) // cost dashboard: attribute this request's spend
  const { user, idea } = authz

  if (!checkRateLimit(`ai:${user.id}`, 50, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 50 messages per hour.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  let { message } = parsed.data
  const askOnly = parsed.data.mode === 'ASK'

  // ══ 26-M FOLLOW-UP — PASTED TEXT IS FILED FIRST, AND THE MODEL NEVER SEES IT ═════════════════
  //
  // ⚠ BEFORE EVERYTHING ELSE IN THE TURN. The stage-advance and research detectors below match
  // single words anywhere in a message ("continue", "look up"); an article pasted in full contains
  // both, and would move the user to the next stage or start a corpus search.
  //
  // ⚠ AND THE MODEL, AND THE HISTORY, GET A STUB. user-material.ts's rule 2: a document is never
  // injected wholesale into a prompt — it is read once into findings. A 100,000-character paste in
  // the transcript would be sent to the model on each of the next 20 turns. So `message` becomes a
  // one-line description of what the platform did, from here on.
  const pastedResults = message.length >= MIN_PASTE_CHARS ? await filePastedTextFromChat(id, user.id, message) : []
  if (message.length > CHAT_MESSAGE_LIMIT && !pastedResults.length) {
    return NextResponse.json({
      error: `That message is ${message.length.toLocaleString('en-GB')} characters, and a chat message is limited to ${CHAT_MESSAGE_LIMIT.toLocaleString('en-GB')}. To give me a long document, use the "Add a file or link" button above the box.`,
    }, { status: 422 })
  }
  if (pastedResults.length) {
    message = `[Text pasted into the chat — ${message.length.toLocaleString('en-GB')} characters. The platform has filed it as material; it is not reproduced here.]`
  }

  // Current field is whatever the platform says — never the model's choice.
  let pre = await computeCanonicalState(id)
  if (!pre) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── §19-B Task 1: chat-expressed intent to continue advances the STAGE, via the
  // same server-side path as the panel CTA — the platform moves first, then Lex
  // speaks for the new page. Lex is never left conducting a page the state machine
  // has not entered. // Invariant: chat page == state page, always. If they can
  // diverge, the bug will recur somewhere else.
  if (!askOnly && !pre.currentField && pre.nextPage && isContinueIntent(message)) {
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
  //
  // ══ 26-M — LEX SEARCHES THE CORPUS FROM THE CHAT, THROUGH `runGeneralCorpusChat` ═════════════
  // Before this the detector demanded a verb AND a noun from a short list, so "search for what the private
  // sector does" matched nothing and Lex — told it could not search — sent the user to a full re-run and a
  // Deepening pass that could not even be reached. The search is the platform's; Lex reports it, and the
  // sources are appended below whatever Lex says. See lib/lex/chat-corpus-search.ts.
  let research: ResearchRecord | null = null
  let corpusSearch: Awaited<ReturnType<typeof runLexCorpusSearch>> | null = null
  if (isCorpusSearchRequest(message)) {
    const query = researchQueryFrom(message) || message
    corpusSearch = await runLexCorpusSearch({
      ideaId: id, userId: user.id, query, ideaTitle: idea.title ?? null,
      history: (Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
    })
    research = corpusSearch.record
    console.log('[lex-diag] corpus search from chat', { query: query.slice(0, 80), ok: corpusSearch.ok, sources: corpusSearch.sourceCount, failure: corpusSearch.failure })
  }

  // ══ DECISION 92 — A URL IN THE MESSAGE IS FILED BEFORE LEX EVER SPEAKS ══════════════
  //
  // Deterministic, not a model tool call: see lib/lex/chat-material.ts's own header for
  // why. Runs through the identical pipeline an upload uses, including its cap and its
  // rejection logging — a link filed from chat is not a lesser or different kind of
  // material.
  //
  // 26-M item 1 — long text pasted after a link was refused is filed the same way, so the route
  // out that Lex offers is one the chat actually honours.
  const materialResults = [
    ...(await fileUrlsFromChat(id, user.id, message)),
    ...pastedResults,
  ]
  if (materialResults.length) {
    console.log('[lex-diag] chat-filed material', {
      urls: materialResults.map((r) => ({ url: r.url, outcome: r.outcome, kind: r.kind ?? null, pasted: !!r.pasted })),
    })
  }

  // ══ 26-M ITEM 3 — A STATED PURPOSE RUNS THE COMPARISON; A PASSIVE UPLOAD STILL ONLY OFFERS ══
  //
  // 26-K §4c's "offer, do not run" stands for material dropped in with nothing said about it.
  // Where the message itself says what the material is for, the platform runs the one comparison
  // (~2p) over everything pending, before Lex speaks, and Lex reports it. ⚠ Only when something
  // was actually filed with findings: a refusal has nothing to compare.
  let comparison: ComparisonReport | null = null
  let consolidationOffer: Awaited<ReturnType<typeof buildConsolidationOffer>> = null
  // ⚠ NOT A PASTE: its message is the platform's stub, so there are no words of the user's to read a purpose from.
  const newlyRead = materialResults.filter((r) => r.outcome === 'filed' && r.materialId && !r.pasted && (r.findingCount ?? 0) > 0)
  if (newlyRead.length && statesPurpose(message) && Date.now() - turnStartedAt > COMPARISON_DEADLINE_MS) {
    // ⚠ Not started: the links took most of the route's 120s and the comparison alone can need 90.
    // Said as what it is, and the offer in the working area is still there.
    comparison = {
      ok: false, error: 'the links took most of the time this reply is allowed, so there was not time left to compare them — it can be run from the working area',
      materialCount: newlyRead.length,
      counts: { SUPPORTS: 0, CONTRADICTS: 0, NEW_CAUSE: 0, NEW_POLICY_OPTION: 0, NOTHING: 0 }, contradictions: [], costPence: null,
    }
  } else if (newlyRead.length && statesPurpose(message)) {
    try {
      const pending = await pendingMaterialSince(id)
      const ids = Array.from(new Set([...pending.materialIds, ...newlyRead.map((r) => r.materialId!)]))
      const result = await runUpdatePass(id, user.id, { materialIds: ids })
      comparison = comparisonReportFrom(result, ids.length)
      // 26-M item 4 — with Consolidate open, what bears on it is offered for the final-version feedback.
      if (result.ok) consolidationOffer = await buildConsolidationOffer(id, result.proposedChanges)
      console.log('[lex-diag] purposeful comparison', {
        ok: result.ok, materials: ids.length, counts: result.counts, costPence: result.costPence,
        offered: !!consolidationOffer,
      })
    } catch (err) {
      console.error('[lex-diag] purposeful comparison THREW', err)
      comparison = {
        ok: false, error: err instanceof Error ? err.message : String(err), materialCount: newlyRead.length,
        counts: { SUPPORTS: 0, CONTRADICTS: 0, NEW_CAUSE: 0, NEW_POLICY_OPTION: 0, NOTHING: 0 }, contradictions: [], costPence: null,
      }
    }
  }

  // ══ 26-M ITEM 4 — THE USER'S "YES" TO LEX'S OFFER IS FILED BY THE PLATFORM, THEN CONFIRMED ════
  const outstandingOffer = pendingOffer((Array.isArray(idea.aiChatHistory) ? idea.aiChatHistory : []) as ChatMsg[])
  let offerFilingBlock: string | null = null
  if (outstandingOffer && isPlainAssent(message)) {
    const filed = await fileConsolidationOffer(id, outstandingOffer)
    offerFilingBlock = offerFiledBlock(filed)
    console.log('[lex-diag] consolidation feedback offer agreed', { outcome: filed.outcome, consolidationId: outstandingOffer.consolidationId })
  }

  // ══ 26-I ADDENDUM A1/A2 — GUIDING-POLICY FEEDBACK, FILED ON THE SAME PATTERN ══════
  //
  // Deterministic and scoped to the Guiding Policy page (see isGuidingPolicyContext) —
  // never fires on an unrelated page's chat, and never asks Lex to decide what happened.
  // ⚠ NOT ON A "yes" THAT WAS ANSWERING AN OFFER: that word is consent, not feedback, and filing
  // it as a comment on the guiding policy would put "yes please" in front of the final draft.
  const policyFeedbackResult: Awaited<ReturnType<typeof fileChatPolicyFeedback>> = offerFilingBlock
    ? { outcome: 'not-guiding-policy' }
    : await fileChatPolicyFeedback(id, pre.currentField?.key, message)
  if (policyFeedbackResult.outcome !== 'not-guiding-policy') {
    console.log('[lex-diag] chat-filed policy feedback', policyFeedbackResult)
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
  // 26-N 6a - did the user ask for a draft of a NAMED field? (deterministic; Ask mode changes nothing)
  const draftReq = askOnly ? null : requestedDraftField(message, pre.pages)
  const questionTurn = looksLikeAQuestion(message)
  const sourcesInHand = !!stageRecord?.ok && (stageRecord.results?.length ?? 0) > 0
  console.log('[lex-diag] turn shape', {
    questionTurn, sourcesInHand, sources: stageRecord?.results?.length ?? 0,
    currentField: current?.key ?? null, sample: message.slice(0, 60),
  })

  // ══ 25-Q §1 — THE NUMBERED CANDIDATES, READ ONCE, USED TWICE ═════════════════════
  //
  // Once to tell Lex what the numbers ARE (it is instructed to cite one, and an instruction to
  // cite something the model cannot see is how confident wrong ids happen), and once to resolve
  // whatever it cites back to a row that still exists.
  //
  // ⚠ LIVE ONLY, in the 25-P sense: a rejected or merged-away policy keeps its number and must
  // not be quietly edited back into the proposal by a chat turn.
  //
  // ══════════ 25-R §3a — THE GATE WAS THE REASON NO CARD EVER APPEARED ══════════
  //
  // ⚠⚠ THIS READ USED TO BE CONDITIONAL ON `currentField === 'policyOptions'`, and that single
  // condition disabled the whole of 25-Q §1 in practice. Charlie asked Lex to combine two
  // candidates; `currentField` was `actions`, because the build had carried the idea on to
  // Coherent Actions. So `livePolicies` was empty, Lex was never shown the numbers it is
  // instructed to cite, `resolvePolicyTarget` could only return null, and no offer could be
  // built no matter what Lex produced.
  //
  // ⚠ 25-Q's OWN DIAGNOSIS IS WHAT MISLED IT. It measured `currentField = policyOptions` on 30
  // August and built the gate around that reading — a measurement of one moment treated as a
  // property of the idea. The field moves; the candidates do not stop existing when it does.
  //
  // ⚠ SO THE CONDITION IS NOW "does this idea have candidates", which is what the feature
  // actually depends on. It costs one indexed read per turn on ideas that have any.
  const policyRows = await prisma.policyOption.findMany({
    where: { ideaId: id },
    orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, number: true, approach: true, status: true, mergedIntoId: true, kind: true,
      sortedAt: true, disposition: true, phase: true,
    },
  })
  const livePolicies = policyRows.filter(
    (r) => r.status !== 'RULED_OUT' && !r.mergedIntoId && r.kind === 'GUIDING_POLICY' && r.number != null,
  )
  // ⚠⚠ 26-L §4c — "LEX SEES THE MIDDLE PANEL." Before this, only wording and number. On the
  // Guiding Policy page specifically, disposition/sort/phase are added — the same facts the
  // screen itself shows — so a claim about the state of the list can be checked against
  // something Lex was actually given, not invented. Report (26-L): elsewhere in the kernel,
  // `acceptedSummary`/`factsBlock` below already carry a broad summary of accepted fields; a
  // full structural snapshot of every stage's state on every turn is sized, not built, here.
  const guidingPolicyPage = isGuidingPolicyContext(pre.currentField?.key)
  const numberedOptionsBlock = livePolicies.length
    ? ['THE CANDIDATE APPROACHES ON SCREEN, WITH THE NUMBERS THE USER CAN SEE',
      ...livePolicies.map((r) => guidingPolicyPage
        ? `[${r.number}] ${r.approach} (sorted: ${r.sortedAt ? 'yes' : 'no'}; disposition: ${r.disposition}${r.phase ? `; phase: ${r.phase}` : ''})`
        : `[${r.number}] ${r.approach}`),
      'Use these numbers when the user refers to one, and when you return a rewrite.',
    ].join('\n')
    : null

  const ideaCount = await prisma.idea.count({ where: { creatorId: idea.creatorId , ...LIVE_IDEA } })
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
    numberedOptionsBlock,
    // 25-Q §6 — the same array "How this works" renders. See lib/lex/product-facts.ts.
    productFactsBlock: productFactsBlock(),
    askOnly,
    // 26-M — the search the platform ran this turn, and what may be suggested on THIS screen right now.
    corpusSearchBlock: corpusSearch?.block ?? null,
    draftRequestBlock: draftReq ? draftRequestBlock(draftReq) : null,
    availableActionsBlock: availableActionsBlock({
      state: pre,
      pendingNewMaterial: (await pendingMaterialSince(id)).count,
    }),
    // Decision 92 — what the platform just filed on this idea, before this turn.
    materialFiledBlock: materialFiledBlock(materialResults, comparison),
    // 26-I addendum A1-A4 — what was filed this turn, plus the standing Guiding Policy
    // page rules (A3/A4), combined into one block; null off that page.
    // 26-M item 4 — plus what bears on the open consolidation, or the confirmation of an agreed offer.
    policyFeedbackBlock: [
      offerFilingBlock,
      consolidationOffer?.block ?? null,
      policyFeedbackFiledBlock(policyFeedbackResult),
      await guidingPolicyChatRules(id, pre.currentField?.key),
    ].filter(Boolean).join('\n\n') || null,
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

  // 26-M — THE SOURCES ARE THE PLATFORM'S, appended whatever Lex wrote: the user is shown what the answer rests on.
  if (corpusSearch?.footer) lex.chatText = `${lex.chatText.trim()}${corpusSearch.footer}`

  // Proposal handling (§4 + §13): act only on a proposal for the CURRENT field
  // (narrative box or Title/Keywords) and only when valid. Otherwise discard —
  // chatText is still shown, state never half-advances. On a valid box proposal
  // the field goes AWAITING_CONFIRMATION and the box renders the tidied text.
  let proposalApplied = false

  // ⚠⚠ 25-Q §3a — IN ASK MODE NOTHING IS APPLIED AND NOTHING IS OFFERED. The prompt says so and
  // this makes it true regardless: a model that proposed anyway must not be able to move the
  // elicitation, because the elicitation is what owns the page the user is looking at.
  if (askOnly) lex.proposal = null

  // §19-D Task 9g — a chat-named cause joins the loop instead of the user being asked
  // to re-type it into the panel. It is the ONE loop that takes a chat proposal, and it
  // lands as source USER because they are the user's own words, tidied — the panel's
  // "from past debates" badge belongs only to corpus-seeded rows. The user still
  // classifies, nests, edits or removes each one; adding it is not accepting it.
  // §19-E Task 2a — ON A QUESTION TURN, A PROPOSAL IS DISCARDED. The prompt tells Lex
  // not to emit one; this makes it true regardless, because the platform owns state and
  // "I've drafted a summary" is not an answer to "is a Charter the right instrument?".
  // Nothing is lost: the field stays current, unchanged, and the next turn picks it up.
  if (questionTurn && lex.proposal && !draftReq) {
    console.log('[lex-diag] proposal discarded — question turn', {
      currentField: current?.key ?? null, proposedFor: lex.proposal.fieldKey,
    })
    lex.proposal = null
  }

  // ══ 26-N section 6a - A DRAFT OF A NAMED FIELD IS FILED WHETHER OR NOT ITS STAGE IS OPEN ═════════
  // Asked to fill "What it rules out" while it was waiting on Chosen approach, Lex refused. The gate controls
  // ACCEPTANCE, not drafting: the draft is filed as a pending proposal (beside the user's words if they have
  // any), and the platform says where it is. See lib/lex/lex-draft.ts.
  let draftSentence: string | null = null
  if (draftReq && lex.proposal) {
    if (await fileLexDraft(id, draftReq, lex.proposal)) {
      draftSentence = draftFiledSentence(draftReq)
      lex.proposal = null
      console.log('[lex-diag] 26n draft filed into a field that is not current', { field: draftReq.key, gated: draftReq.gated })
    }
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
  // ══════════════ 25-Q §1b — LEX PROPOSES, THE USER ACCEPTS, THEN THE PANEL CHANGES ══════════
  //
  // Charlie: *"I tried to get Lex to edit this and the result was helpful but no interaction with
  // the Middle Panel."* §1a found why, and it was not one thing: `validateProposal` has no schema
  // for `policyOptions`, so a rewrite of a candidate guiding policy returned null and was dropped
  // silently; and even a successful `setProposal` writes `IdeaFieldState.proposal`, which a loop
  // field does not render — it renders its child rows. Two independent reasons, either enough.
  //
  // ⚠⚠ THE OFFER IS COMPUTED HERE AND WRITTEN NOWHERE. It goes back in the response as a card;
  // `POST /field-edit` does the write, and only a click reaches it. That split is what makes
  // "never a silent write" a property of the system rather than a promise about a prompt.
  //
  // ⚠ AND IT IS BUILT FROM THE PROPOSAL THAT WAS ALREADY BEING DISCARDED. Nothing that used to
  // be written stops being written; this is the branch where the answer previously went in the
  // bin with a console warning.
  let editOffer: EditOffer | null = null

  if (!proposalApplied && lex.proposal?.valueText?.trim()) {
    const text = lex.proposal.valueText.trim()
    const key = lex.proposal.fieldKey

    if (key === 'policyOptions' && looksLikeAReplacement(text)) {
      const resolved = resolvePolicyTarget(
        lex.proposal.targetNumber,
        livePolicies.map((r) => ({ number: r.number, live: true })),
      )
      // ⚠ AMBIGUITY IS REFUSED, NOT GUESSED — the same discipline as `matchCause`. Writing the
      // rewrite into whichever policy is nearest would be the product choosing which of the
      // user's candidates to overwrite, which is the most consequential thing on that screen.
      if (resolved && resolved !== AMBIGUOUS_TARGET) {
        const row = livePolicies.find((r) => r.number === resolved.number)
        if (row && row.approach.trim() !== text) {
          editOffer = {
            target: { kind: 'POLICY_OPTION', fieldKey: 'policyOptions', number: resolved.number },
            text,
            question: offerQuestion('policyOptions', resolved.number),
            currentText: row.approach,
          }
        }
      }
      console.log('[lex-diag] 25q policy rewrite offer', {
        named: lex.proposal.targetNumber ?? null,
        resolved: resolved === AMBIGUOUS_TARGET ? 'AMBIGUOUS' : resolved?.number ?? null,
        offered: !!editOffer,
      })
    } else if (
      // A rewrite of a text field the user is NOT currently on. This is the same complaint one
      // step out: Lex writes a better version of the diagnosis summary while the user is on the
      // guiding policy, and the only way to use it is to retype it.
      key !== current?.key && EDITABLE_TEXT_FIELDS.has(key) && looksLikeAReplacement(text)
    ) {
      const existing = allAcceptedFields.find((f) => f.key === key)
      const currentText = typeof existing?.value === 'string' ? existing.value : null
      if (currentText?.trim() !== text) {
        editOffer = {
          target: { kind: 'TEXT_FIELD', fieldKey: key, number: null },
          text,
          question: offerQuestion(key, null),
          currentText,
        }
      }
    } else if (key === 'policyOptions' && isGuidingPolicyContext(pre.currentField?.key)) {
      // ══════════ ⚠⚠ 26-L §4 — THIS IS 26-I's A3, BUILT STRUCTURALLY THIS TIME ══════════════
      //
      // Verbatim, Charlie's session: *"I've drafted a new candidate approach… You should see it
      // added to the list of candidate approaches in the middle panel now."* Then, asked which
      // number: *"No new candidate was actually added to the list."*
      //
      // ⚠⚠ THE PROMPT (guidingPolicyChatRules) TOLD LEX TO SAY EXACTLY THAT, WITH NOTHING BEHIND
      // IT: *"say so in chatText and name it as a new numbered candidate for the sort"* — a
      // sentence for the model to say, backed by no tool call. §4a: Lex acts only through tools.
      // This branch IS that tool — the same `applyPolicyOp('add', …)` the screen's own "Add a
      // guiding policy" button calls — run synchronously, in this turn, before `chatText` is
      // shown. §4b: the reply may claim the add only because `addedNumber` below is the tool's
      // own confirmed result, not a guess.
      const result = await applyPolicyOp({ ideaId: id, op: 'add', text })
      const addedNumber = 'addedNumber' in result ? result.addedNumber : undefined
      if (addedNumber != null) {
        console.log('[lex-diag] 26L chat-added guiding-policy candidate', { ideaId: id, addedNumber })
        // ⚠ THE CLAIM IS REWRITTEN TO NAME THE CONFIRMED NUMBER, never left to the model's own
        // (unconfirmed) phrasing of what it did. If the model already claimed to have added it,
        // this replaces that claim with one a tool result actually backs; if it did not, this
        // still tells the user the truth about what just happened.
        lex.chatText = `${lex.chatText.trim()}\n\nAdded as candidate #${addedNumber} on the Guiding Policy screen.`
      }
      lex.proposal = null
    }
  }

  // Diagnostic (Sprint 1.3 Task 1 — log/inspect, bytes before hypotheses). The
  // platform NEVER advances currentField on a /lex turn and only ever sets a
  // proposal for the current field; this records any turn where Lex tried to
  // propose for a different field (so the symptom is visible if it recurs).
  // ⚠ 25-Q — "discarded" now means "discarded AND not offered"; an offered rewrite is not lost.
  if (lex.proposal && lex.proposal.fieldKey !== current?.key && !editOffer) {
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
  // 26-N 6a - the platform's own sentence about where the draft is, after whatever Lex wrote.
  if (draftSentence) lex.chatText = `${lex.chatText.trim()}\n\n${draftSentence}`
  const now = new Date().toISOString()
  const updatedHistory: ChatMsg[] = [
    ...(Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []),
    { role: 'user', content: message, timestamp: now, stage: pre.stage },
    // Tagged with the field it was said about — this is what the problem gate counts.
    // 26-M item 4 — the offer rides on the message that makes it, so a later "yes" can be matched to it.
    { role: 'lex', content: lex.chatText, timestamp: now, stage: pre.stage, field: current?.key,
      ...(consolidationOffer ? { offer: consolidationOffer.offer } : {}) },
  ].slice(-60)
  await prisma.idea.update({ where: { id }, data: { aiChatHistory: updatedHistory } })

  const state = await computeCanonicalState(id)
  return NextResponse.json({ chatText: lex.chatText, messages: [], state, editOffer })
}
