// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-K — THE UPDATE PASS.
//
// ⚠⚠ THIS IS THE DEEPENING'S ENGINE, NOT A SEPARATE FEATURE (the brief's own framing). It
// reuses the Deepening's data models — `EvidenceItem` (a proposed finding, judged by the
// user) and `DeepeningPass` (status/timing per run) — because they already are almost
// exactly "propose, never overwrite, until the user judges it." It does NOT flow through
// the generic `runPass()`/`PASSES` engine in lib/lex/deepening-config.ts: that engine's own
// header says a pass is an intent set, a set of issue templates with fire/silent probes,
// and a method block — this pass compares new material against the LIVE KERNEL and sorts
// into five categories, which is a different shape of work `check-deepening.ts` never
// anticipated (it hard-asserts "exactly five passes" and that every pass has issue
// templates that fire on some run-shape and not others). Forcing this in would mean either
// breaking that guard or inventing issue-template busywork this pass doesn't need.
// `deepening-config.ts`'s own comment gives the honest alternative: "if a future pass
// cannot be expressed here, the mechanism has not been built, and the honest response is
// to say so" — so this is its own module, `passKey = 'MATERIAL_UPDATE'` (a plain string;
// `EvidenceItem.passKey`/`DeepeningPass.passKey` are unconstrained columns, not tied to the
// closed `PassKey` TS union used by the generic engine).
//
// ⚠ THE SEPARATE-EVIDENCE-LAYER RULE IS KEPT VOLUNTARILY. Nothing here writes a canonical
// `IdeaFieldState` value. A "new cause" or "new policy option" category writes to its own
// child-entity table (DiagnosisCause / PolicyOption) ONLY ON ACCEPT — the same rule
// `applyPolicyOp`'s own `acceptCause` op already follows for an implied cause.
//
// §1: new material is a proposed amendment. It only touches what the material touches, and
// nothing changes until the user accepts it — resolving 25-X §4's cumulative-rebuild risk
// (a rebuild can entrench an earlier build's mistakes; a proposal cannot, because it never
// overwrites).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { runSearch } from './search-gateway'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { addCause } from './field-machine'
import { applyPolicyOp, rejectPolicyOption } from './guiding-policy-state'
import type { SearchResult } from './page1-config'

export const UPDATE_PASS_KEY = 'MATERIAL_UPDATE'

export interface ProposedChangeView {
  id: string
  kind: string
  title: string
  body: string
  fieldRef: string | null
  citation: string | null
  url: string | null
  status: string
  note: string | null
  createdAt: string
}

/**
 * §4a — "the working area's list shows 'N proposed changes from [source]'." Everything
 * still PROPOSED under this pass, most recent run first. §2's "changes nothing" and the
 * already-live NEW_POLICY_OPTION rows are excluded — the first was never a proposal, the
 * second has nothing left to judge here (see `dismissNewPolicyOption` for its own path).
 */
export async function listProposedChanges(ideaId: string): Promise<ProposedChangeView[]> {
  const rows = await prisma.evidenceItem.findMany({
    where: { ideaId, passKey: UPDATE_PASS_KEY, status: 'PROPOSED' },
    orderBy: [{ runVersion: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map((r) => ({
    id: r.id, kind: r.kind, title: r.title, body: r.body, fieldRef: r.fieldRef,
    citation: r.citation, url: r.url, status: r.status, note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** The new policy-option candidates the most recent run(s) already added live to the sort
 *  (§4a: "no separate path" — there is nothing to judge here, only to point at). */
export async function recentNewPolicyOptions(ideaId: string): Promise<Array<{ number: number | null; title: string }>> {
  const rows = await prisma.evidenceItem.findMany({
    where: { ideaId, passKey: UPDATE_PASS_KEY, kind: 'NEW_POLICY_OPTION', status: 'ACCEPTED' },
    orderBy: { createdAt: 'desc' }, take: 10,
    select: { title: true, fieldRef: true },
  })
  return rows.map((r) => ({
    number: r.fieldRef?.startsWith('policyOptions:') ? Number(r.fieldRef.split(':')[1]) : null,
    title: r.title,
  }))
}

// ── how many new items are waiting for a comparison (§4c, the accumulating offer) ──

export async function pendingMaterialSince(ideaId: string): Promise<{
  count: number
  materialIds: string[]
  lastRunAt: string | null
}> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { lastUpdatePassAt: true } })
  const since = idea?.lastUpdatePassAt ?? new Date(0)
  const rows = await prisma.ideaUserMaterial.findMany({
    where: { ideaId, archivedAt: null, status: 'READY', createdAt: { gt: since } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  return { count: rows.length, materialIds: rows.map((r) => r.id), lastRunAt: idea?.lastUpdatePassAt?.toISOString() ?? null }
}

// ── the evidence pool a comparison classifies ────────────────────────────────

interface EvidenceCandidate {
  /** Index into this array — the ONLY way the model refers to one, so citation/url/
   *  sourceId are always looked up from what we supplied, never invented (the same rule
   *  `deepening.ts`'s own engine follows: "a finding cannot be persisted without a source
   *  from this run's retrieval"). */
  index: number
  title: string
  body: string
  sourceType: 'USER_DOCUMENT' | 'CORPUS'
  sourceId: string | null
  citation: string | null
  url: string | null
}

async function materialFindingsAsCandidates(materialIds: string[]): Promise<EvidenceCandidate[]> {
  if (!materialIds.length) return []
  const rows = await prisma.evidenceItem.findMany({
    where: { sourceId: { in: materialIds }, sourceType: 'USER_DOCUMENT', status: 'PROPOSED' },
    select: { title: true, body: true, sourceId: true, citation: true, url: true },
  })
  return rows.map((r, i) => ({
    index: i, title: r.title, body: r.body, sourceType: 'USER_DOCUMENT' as const,
    sourceId: r.sourceId, citation: r.citation, url: r.url,
  }))
}

function searchResultsAsCandidates(results: SearchResult[], startIndex: number): EvidenceCandidate[] {
  return results.map((r, i) => ({
    index: startIndex + i, title: r.title, body: r.snippet, sourceType: 'CORPUS' as const,
    sourceId: r.id, citation: r.citation, url: r.url ?? null,
  }))
}

/** Vocabulary for the corpus search — §2's "the new material's vocabulary only." Same
 *  mechanical term-split `runAdHocResearch` already uses for a chat-typed query. */
function vocabularyOf(candidates: EvidenceCandidate[]): string[] {
  const text = candidates.map((c) => `${c.title} ${c.body}`).join(' ')
  const words = text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []
  const stop = new Set(['this', 'that', 'with', 'from', 'have', 'would', 'their', 'there', 'about', 'which'])
  const seen = new Map<string, number>()
  for (const w of words) { if (!stop.has(w)) seen.set(w, (seen.get(w) ?? 0) + 1) }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([w]) => w)
}

// ── the kernel a comparison reads ────────────────────────────────────────────

export interface KernelSnapshot {
  problem: string
  pivotalObstacle: string
  causes: Array<{ number: number; cause: string }>
  policies: Array<{ number: number; approach: string }>
  actions: Array<{ id: string; practicalStep: string }>
}

async function readKernel(ideaId: string): Promise<KernelSnapshot> {
  const [idea, causes, policies, actions] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { challenge: true, summaryDescription: true, pivotalObstacle: true } }),
    prisma.diagnosisCause.findMany({ where: { ideaId }, select: { number: true, cause: true }, orderBy: { number: 'asc' } }),
    prisma.policyOption.findMany({
      where: { ideaId, status: { not: 'RULED_OUT' }, mergedIntoId: null, kind: 'GUIDING_POLICY' },
      select: { number: true, approach: true }, orderBy: { number: 'asc' },
    }),
    prisma.lexCoherentAction.findMany({ where: { ideaId }, select: { id: true, practicalStep: true } }),
  ])
  return {
    problem: idea?.challenge?.trim() || idea?.summaryDescription?.trim() || '(no problem statement recorded)',
    pivotalObstacle: idea?.pivotalObstacle?.trim() || '(not yet diagnosed)',
    causes: causes.filter((c) => c.number != null).map((c) => ({ number: c.number!, cause: c.cause })),
    policies: policies.filter((p) => p.number != null).map((p) => ({ number: p.number!, approach: p.approach })),
    actions: actions.map((a) => ({ id: a.id, practicalStep: a.practicalStep })),
  }
}

// ── the comparison itself — one model call, five categories ──────────────────

const CATEGORIES = ['SUPPORTS', 'CONTRADICTS', 'NEW_CAUSE', 'NEW_POLICY_OPTION', 'NOTHING'] as const
export type UpdateCategory = (typeof CATEGORIES)[number]

interface Classification {
  evidenceIndex: number
  category: UpdateCategory
  /** SUPPORTS/CONTRADICTS only — 'pivotalObstacle' | 'challenge' | `causes:<number>` |
   *  `policyOptions:<number>` | `actions:<id>`. Null for NEW_CAUSE/NEW_POLICY_OPTION/NOTHING. */
  targetRef: string | null
  title: string
  explanation: string
  /** NEW_CAUSE/NEW_POLICY_OPTION only — the proposed text, in the finding's own words. */
  proposedText: string | null
}

const COMPARE_SCHEMA = {
  type: 'object',
  properties: {
    classifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          evidenceIndex: { type: 'integer' },
          category: { type: 'string', enum: [...CATEGORIES] },
          targetRef: { type: 'string' },
          title: { type: 'string' },
          explanation: { type: 'string' },
          proposedText: { type: 'string' },
        },
        required: ['evidenceIndex', 'category', 'title', 'explanation'],
      },
    },
  },
  required: ['classifications'],
} as const

function compareSystemPrompt(): string {
  return [
    'You are comparing NEW EVIDENCE against an existing policy kernel (a diagnosis, its causes,',
    'a guiding policy with candidate approaches, and coherent actions) for Scrutinise.',
    '',
    'For EACH numbered piece of evidence, decide exactly ONE category:',
    '- SUPPORTS: it reinforces an existing cause, policy option or action. Set targetRef.',
    '- CONTRADICTS: it conflicts with, undermines or casts doubt on something already there.',
    '  ⚠ This is the most valuable category. Do not soften a genuine contradiction into',
    '  "supports with caveats" — if the evidence says the kernel may be wrong, say so.',
    '- NEW_CAUSE: it points to a cause of the problem not already in the diagnosis. Set',
    '  proposedText to the cause, in one sentence.',
    '- NEW_POLICY_OPTION: it suggests an approach not already among the candidates. Set',
    '  proposedText to the approach, in one sentence — ONE approach, not a list ("and" joining',
    '  two mechanisms is two policies, not one).',
    '- NOTHING: it has no bearing on this kernel. Still list it, so nothing is silently dropped.',
    '',
    'targetRef, when set, must be exactly one of: "pivotalObstacle", "challenge",',
    '"causes:<number>", "policyOptions:<number>", or "actions:<id>", using only the numbers/ids',
    'given below. Never invent a number that was not given to you.',
    '',
    'No evaluative preamble. Classify every evidence index given to you exactly once.',
  ].join('\n')
}

function compareUserPrompt(kernel: KernelSnapshot, candidates: EvidenceCandidate[]): string {
  return [
    `THE PROBLEM: ${kernel.problem}`,
    `THE PIVOTAL OBSTACLE: ${kernel.pivotalObstacle}`,
    '',
    'THE DIAGNOSED CAUSES:',
    kernel.causes.map((c) => `[${c.number}] ${c.cause}`).join('\n') || '(none recorded)',
    '',
    'THE CANDIDATE POLICY OPTIONS:',
    kernel.policies.map((p) => `[${p.number}] ${p.approach}`).join('\n') || '(none recorded)',
    '',
    'THE COHERENT ACTIONS:',
    kernel.actions.map((a) => `[${a.id}] ${a.practicalStep}`).join('\n') || '(none recorded)',
    '',
    'THE NEW EVIDENCE, numbered — classify every one:',
    candidates.map((c) => `--- ${c.index} (${c.sourceType}) ---\n${c.title}\n${c.body}`).join('\n\n'),
  ].join('\n')
}

export interface ProposedChange {
  evidenceItemId: string
  category: UpdateCategory
  title: string
}

export interface UpdatePassResult {
  ok: boolean
  error?: string
  proposedChanges: ProposedChange[]
  counts: Record<UpdateCategory, number>
  costPence: number | null
  ms: number
}

const ZERO_COUNTS = (): Record<UpdateCategory, number> => ({ SUPPORTS: 0, CONTRADICTS: 0, NEW_CAUSE: 0, NEW_POLICY_OPTION: 0, NOTHING: 0 })

/** §4a: the reference a new candidate policy option gets is `policyOptions:<number>` on the
 *  row `applyPolicyOp('add', ...)` just created — "no separate path", it enters the sort
 *  exactly like any other candidate the moment it is written. */
async function writeClassification(
  ideaId: string, userId: string | null, runVersion: number, c: Classification, source: EvidenceCandidate,
): Promise<ProposedChange | null> {
  const base = {
    ideaId, passKey: UPDATE_PASS_KEY, runVersion,
    sourceType: source.sourceType, sourceId: source.sourceId, citation: source.citation, url: source.url,
  }

  if (c.category === 'NOTHING') {
    // Filed for audit, never surfaced as a proposed change — §2 step 3's fifth bucket.
    await prisma.evidenceItem.create({
      data: { ...base, kind: 'FINDING', fieldRef: null, title: c.title, body: c.explanation, status: 'ACCEPTED', note: 'No bearing on the current kernel.' },
    })
    return null
  }

  if (c.category === 'NEW_POLICY_OPTION') {
    const text = (c.proposedText || c.title).trim()
    if (!text) return null
    const added = await applyPolicyOp({ ideaId, op: 'add', text })
    const number = 'addedNumber' in added ? added.addedNumber : undefined
    const item = await prisma.evidenceItem.create({
      data: {
        ...base, kind: 'NEW_POLICY_OPTION', fieldRef: number != null ? `policyOptions:${number}` : null,
        title: c.title, body: c.explanation,
        // ⚠ ALREADY LIVE — §4a: "no separate path." The EvidenceItem here is the audit trail
        // of where it came from, not a gate the user must pass before it exists.
        status: 'ACCEPTED', note: number != null ? `Entered the sort as candidate ${number}.` : 'Could not be added.',
      },
    })
    return { evidenceItemId: item.id, category: c.category, title: c.title }
  }

  // SUPPORTS / CONTRADICTS / NEW_CAUSE — genuinely proposed, judged by the user.
  const item = await prisma.evidenceItem.create({
    data: {
      ...base, kind: c.category, fieldRef: c.category === 'NEW_CAUSE' ? null : (c.targetRef ?? null),
      title: c.title, body: c.category === 'NEW_CAUSE' ? (c.proposedText || c.explanation) : c.explanation,
      status: 'PROPOSED',
    },
  })
  return { evidenceItemId: item.id, category: c.category, title: c.title }
}

/**
 * The whole pipeline: gather (material findings, already extracted) or search (an angle),
 * corpus-search on that vocabulary, compare against the live kernel, write the five-way
 * classification. Never touches a canonical field; never re-runs anything downstream.
 */
export async function runUpdatePass(
  ideaId: string,
  userId: string | null,
  input: { materialIds: string[] } | { angle: string },
): Promise<UpdatePassResult> {
  const t0 = Date.now()
  const counts = ZERO_COUNTS()

  const isAngle = 'angle' in input
  const materialCandidates = isAngle ? [] : await materialFindingsAsCandidates(input.materialIds)

  const searchTerms = isAngle
    ? input.angle.split(/\s+/).filter(Boolean).slice(0, 24)
    : vocabularyOf(materialCandidates)
  const searchContext = isAngle ? input.angle.slice(0, 300) : 'New material added to this idea'

  let searchResults: SearchResult[] = []
  let searchFailed = false
  let searchFailureReason: string | undefined
  if (searchTerms.length) {
    try {
      const out = await runSearch({ keywords: searchTerms, intent: 'AD_HOC_RESEARCH', ideaContext: searchContext, limit: 12 })
      searchResults = out.grouped
      searchFailed = out.failed
      searchFailureReason = out.failureReason
    } catch (err) {
      searchFailed = true
      searchFailureReason = err instanceof Error ? err.message : String(err)
    }
  }

  const candidates: EvidenceCandidate[] = [
    ...materialCandidates,
    ...searchResultsAsCandidates(searchResults, materialCandidates.length),
  ]

  if (!candidates.length) {
    return {
      ok: true, proposedChanges: [], counts, costPence: 0, ms: Date.now() - t0,
      error: searchFailed ? `Corpus search failed: ${searchFailureReason}` : undefined,
    }
  }

  const kernel = await readKernel(ideaId)

  const result = await callModelJson<{ classifications: Classification[] }>({
    model: 'gemini-2.5-pro',
    system: compareSystemPrompt(),
    user: compareUserPrompt(kernel, candidates),
    schema: COMPARE_SCHEMA,
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    label: 'update-pass-compare',
    stream: 'lex',
    pass: 'update-pass.compare',
  })

  const priced = await recordUsage(result.usage, {
    stream: 'lex', pass: 'update-pass.compare', ideaId, userId: userId ?? null,
  })

  if (!result.ok) {
    // ⚠ `strict: false` — TS will not narrow the boolean `ok` discriminant (established
    // idiom, see lib/lex/reranker.ts). `result.ok === false` on this line already.
    const fail = result as import('./model-call').LlmFail
    return { ok: false, error: `${fail.reason}: ${fail.detail}`, proposedChanges: [], counts, costPence: priced.pence, ms: Date.now() - t0 }
  }

  const byIndex = new Map(candidates.map((c) => [c.index, c]))
  const runVersion = (await prisma.deepeningPass.findUnique({
    where: { ideaId_passKey: { ideaId, passKey: UPDATE_PASS_KEY } }, select: { runVersion: true },
  }))?.runVersion ?? 0
  const nextRunVersion = runVersion + 1

  const proposedChanges: ProposedChange[] = []
  for (const c of result.value.classifications) {
    const source = byIndex.get(c.evidenceIndex)
    if (!source) continue // a fabricated index is dropped, never trusted
    counts[c.category] = (counts[c.category] ?? 0) + 1
    const written = await writeClassification(ideaId, userId, nextRunVersion, c, source)
    if (written) proposedChanges.push(written)
  }

  await prisma.deepeningPass.upsert({
    where: { ideaId_passKey: { ideaId, passKey: UPDATE_PASS_KEY } },
    create: {
      ideaId, passKey: UPDATE_PASS_KEY, status: 'RUN', runVersion: nextRunVersion,
      startedAt: new Date(t0), completedAt: new Date(),
      candidatesReviewed: candidates.length, candidatesKept: proposedChanges.length,
    },
    update: {
      status: 'RUN', runVersion: nextRunVersion, completedAt: new Date(),
      candidatesReviewed: candidates.length, candidatesKept: proposedChanges.length,
    },
  })

  if (!isAngle) {
    await prisma.idea.update({ where: { id: ideaId }, data: { lastUpdatePassAt: new Date() } })
  }

  return { ok: true, proposedChanges, counts, costPence: priced.pence, ms: Date.now() - t0 }
}

// ── accepting/dismissing one proposed change (§4a/§4b) ────────────────────────

export interface AcceptResult {
  ok: boolean
  error?: string
}

/**
 * §4b — accepting marks dependants stale, WITH A REASON, and re-runs nothing.
 * §4a — a new cause is created only now, on acceptance; a changed field shows current-
 * beside-proposed via the existing EditOffer/RefinementOffer mechanisms elsewhere, so this
 * function's job for SUPPORTS/CONTRADICTS is the stale-marking side-effect, not a rewrite.
 */
export async function judgeUpdateItem(
  ideaId: string, evidenceItemId: string, decision: 'ACCEPTED' | 'REJECTED', note?: string,
): Promise<AcceptResult> {
  const item = await prisma.evidenceItem.findFirst({ where: { id: evidenceItemId, ideaId, passKey: UPDATE_PASS_KEY } })
  if (!item) return { ok: false, error: 'That proposed change is not on this idea.' }
  if (item.status !== 'PROPOSED') return { ok: false, error: 'That has already been judged.' }

  await prisma.evidenceItem.update({ where: { id: item.id }, data: { status: decision, note: note ?? item.note } })

  if (decision === 'REJECTED') return { ok: true }

  if (item.kind === 'NEW_CAUSE') {
    const created = await addCause(ideaId, { cause: item.body, source: 'LEX_CORPUS' })
    await prisma.evidenceItem.update({
      where: { id: item.id }, data: { fieldRef: `causes:${created.number}`, note: `Added as cause ${created.number}.` },
    })
    return { ok: true }
  }

  if (item.kind === 'CONTRADICTS' && item.fieldRef) {
    await markStale(ideaId, item.fieldRef, `New evidence contradicts this: "${item.title}".`)
  }

  return { ok: true }
}

/** §4b — walks the same one real structural link the kernel has (`PolicyOption.targetCauseIds`)
 *  to mark dependants stale too, e.g. a contradicted cause staling every policy that targets it. */
async function markStale(ideaId: string, targetRef: string, reason: string): Promise<void> {
  const [kind, rawId] = targetRef.split(':')

  if (kind === 'causes') {
    const number = Number(rawId)
    const cause = await prisma.diagnosisCause.findFirst({ where: { ideaId, number }, select: { id: true } })
    await prisma.diagnosisCause.updateMany({ where: { ideaId, number }, data: { stale: true, staleReason: reason } })
    if (cause) {
      const dependants = await prisma.policyOption.findMany({
        where: { ideaId, targetCauseIds: { has: cause.id } }, select: { id: true, number: true },
      })
      for (const p of dependants) {
        await prisma.policyOption.update({
          where: { id: p.id },
          data: { stale: true, staleReason: `This may need revisiting because cause ${number} was amended.` },
        })
      }
    }
    return
  }

  if (kind === 'policyOptions') {
    await prisma.policyOption.updateMany({ where: { ideaId, number: Number(rawId) }, data: { stale: true, staleReason: reason } })
    return
  }

  if (kind === 'actions') {
    // LexCoherentAction has no stale column of its own in this pass — §4b's example and
    // acceptance criteria are about kernel FIELDS and their dependants (causes → policies);
    // extending staleness to actions is straightforward but genuinely out of what was asked.
    return
  }

  // A scalar canonical field ('pivotalObstacle', 'challenge', ...).
  await prisma.ideaFieldState.updateMany({ where: { ideaId, fieldKey: targetRef }, data: { stale: true, staleReason: reason } })
}

/** §8b's counterpart for the new-policy-option path: "no thanks" on an auto-added candidate
 *  rules it out, through the one existing rule-out implementation — never a second delete. */
export async function dismissNewPolicyOption(ideaId: string, evidenceItemId: string, reason: string): Promise<AcceptResult> {
  const item = await prisma.evidenceItem.findFirst({ where: { id: evidenceItemId, ideaId, passKey: UPDATE_PASS_KEY, kind: 'NEW_POLICY_OPTION' } })
  if (!item?.fieldRef?.startsWith('policyOptions:')) return { ok: false, error: 'Not found.' }
  const number = Number(item.fieldRef.split(':')[1])
  const row = await prisma.policyOption.findFirst({ where: { ideaId, number }, select: { id: true } })
  if (row) await rejectPolicyOption(ideaId, row.id, reason || 'Dismissed from the update pass.')
  await prisma.evidenceItem.update({ where: { id: item.id }, data: { note: `Ruled out (candidate ${number}).` } })
  return { ok: true }
}
