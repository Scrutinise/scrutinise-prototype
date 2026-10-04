// ─────────────────────────────────────────────────────────────────────────────
// 26-N §8 — "CHECK FOR GAPS" IN COHERENT ACTIONS.
//
//   1. FREE, NO MODEL: any cause with no action against it; any of legislative / organisational / financial
//      with nothing in it. ⚠ HEURISTIC, AND SAYS SO: `LexCoherentAction` has no link to a cause, so "against it"
//      is keyword overlap between the action's words and the cause's, and the categories are read from
//      `mechanismType` plus keywords. It finds candidates for a human to look at, not proofs.
//   2. FOUR MODELS (the Consolidate panel), each given the problem, the causes, the ACCEPTED guiding policy and
//      the current actions, asked for actions WITHOUT WHICH the policy cannot be delivered, a cause stays
//      unaddressed, or the problem stays unsolved.
//      ⚠ EVERY SUGGESTION STATES WHAT FAILS WITHOUT IT. One that cannot is DROPPED, and the drop is counted.
//   3. COMBINED: near-duplicates across the four are merged deterministically, then ONE call tests every
//      suggestion against the guiding policy (fits / does not fit / conflicts, one line) and merges the
//      semantic duplicates the word match cannot see. Which models raised each is kept.
//   4. HELD AS SUGGESTIONS in `ActionIdea` (status SUGGESTED). ⚠⚠ NOTHING ENTERS THE ACTIONS LIST UNTIL THE USER
//      PRESSES ACCEPT: `acceptGapSuggestion` is the only place in this file that creates a `LexCoherentAction`.
//      Accepted ones take the distinct status ACCEPTED_GAP, so the "Added from the consolidation" panel (which
//      reads WRITTEN) does not claim them as the consolidation's.
//   5. THE COST IS REPORTED: every call is summed and returned, and stored on each suggestion.
//
// ⚠ ONE RUN AT A TIME PER IDEA. A marker row (status GAP_CHECK_RUNNING) is created BEFORE any model is
// called; a second press while one is in flight is refused, and a marker older than the route's own limit is an
// orphan and is swept — the same discipline as the Consolidate route.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { addAction } from './field-machine'
import { placeGroups, type Verdict } from './action-ideas'
import { PREMIUM_DRAFT_MODELS } from './guiding-policy-consolidate'

export type GapCategory = 'legislative' | 'organisational' | 'financial'
export const GAP_CATEGORIES: GapCategory[] = ['legislative', 'organisational', 'financial']

export interface GapSource {
  kind: 'GAP_CHECK'
  models: string[]
  whatFails: string
  category: GapCategory
  addressesCauseNumber: number | null
  checkId: string
  checkCostPence: number | null
}

const RUNNING = 'GAP_CHECK_RUNNING'
/** Longer than the route's `maxDuration` (300s): a marker this old can only be an orphan from a dead request. */
const IN_FLIGHT_MS = 6 * 60_000
const MODEL_TIMEOUT_MS: Record<string, number> = { 'grok-4.7': 150_000 }
const DEFAULT_TIMEOUT_MS = 120_000
const MIN_WHAT_FAILS_CHARS = 30
const MIN_WHAT_FAILS_WORDS = 5

const oneLine = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)

// ── 1. THE FREE PART (pure) ──────────────────────────────────────────────────

export interface ActionLike {
  practicalStep: string
  mechanismType?: string | null
  wording?: string | null
  targetOrganisation?: string | null
  /** 26-Q — the RECORDED link: the numbers of the causes this action is recorded as attacking. Where present it beats a keyword guess. */
  causeNumbers?: number[]
  /** 26-Q — the recorded avenue (LEGISLATIVE / ORGANISATIONAL / FINANCIAL), if the user or an accepted proposal set one. */
  recordedAvenue?: string | null
}
export interface CauseLike { number: number; cause: string }

export interface FreeGaps {
  /** ⚠ Always true: the cause-to-action match is keyword overlap, not a recorded link. Shown to the user. */
  heuristic: true
  causesWithoutAction: Array<{ number: number; cause: string; reason: string }>
  emptyCategories: Array<{ category: GapCategory; reason: string }>
}

const STOP = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'have', 'which', 'their', 'there', 'where', 'when', 'what', 'been', 'being',
  'into', 'than', 'then', 'them', 'they', 'were', 'will', 'would', 'could', 'should', 'about', 'other', 'those', 'these', 'because', 'while',
  'also', 'each', 'every', 'such', 'only', 'more', 'most', 'some', 'does', 'make', 'made', 'them', 'public', 'civil', 'service'])

/** Stems at five letters, so "accountable" / "accountability" meet. Pure. */
export function stems(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9£ ]+/g, ' ').split(/\s+/)
      .filter((w) => w.length >= 5 && !STOP.has(w)).map((w) => w.slice(0, 5)),
  )
}

const actionText = (a: ActionLike) => [a.practicalStep, a.wording, a.targetOrganisation].filter(Boolean).join(' ')

const LEGIS_RE = /\b(statut|statute|act\b|bill\b|legislat|primary legislation|secondary legislation|regulation|amend|enact|legal duty|offence|law\b)/i
const ORG_RE = /\b(department|agency|board|appoint|organis|office\b|unit\b|regulator|commission|secretariat|workforce|staff|train|recruit|governance|inspector|panel)/i
const FIN_RE = /(£|\b(fund|budget|cost|pay\b|payment|salary|bonus|financ|spend|grant|incentive|penalty|fine\b|levy|tax))/i

/** Which of the three categories an action falls in — `mechanismType` first, then words. Pure. */
export function categoriesOf(a: ActionLike): Set<GapCategory> {
  const out = new Set<GapCategory>()
  const m = (a.mechanismType ?? '').toLowerCase()
  if (m === 'rules') out.add('legislative')
  if (m === 'institutional') out.add('organisational')
  if (m === 'incentives' || m === 'market-design') out.add('financial')
  const t = actionText(a)
  if (LEGIS_RE.test(t)) out.add('legislative')
  if (ORG_RE.test(t)) out.add('organisational')
  if (FIN_RE.test(t)) out.add('financial')
  return out
}

/** Pure, no model. ⚠ HEURISTIC — see the file header. */
export function detectFreeGaps(causes: CauseLike[], actions: ActionLike[]): FreeGaps {
  const actionStems = actions.map((a) => stems(actionText(a)))
  const causesWithoutAction = causes.flatMap((c) => {
    const cs = stems(c.cause)
    const need = cs.size >= 4 ? 2 : 1
    const recorded = actions.some((a) => a.causeNumbers?.includes(c.number)) // 26-Q — a recorded link is a fact; the words are only a guess
    const matched = recorded || actionStems.some((as) => [...cs].filter((s) => as.has(s)).length >= need)
    return matched ? [] : [{
      number: c.number, cause: c.cause,
      reason: `No current action shares its key words with cause ${c.number} (a keyword match, not a recorded link — it may be covered in other words).`,
    }]
  })
  const have = new Set<GapCategory>()
  for (const a of actions) {
    for (const c of categoriesOf(a)) have.add(c)
    const r = a.recordedAvenue?.toLowerCase() as GapCategory | undefined
    if (r && GAP_CATEGORIES.includes(r)) have.add(r)
  }
  const emptyCategories = GAP_CATEGORIES.filter((c) => !have.has(c)).map((category) => ({
    category,
    reason: `Nothing in the list reads as ${category} (read from each action's mechanism type and its words).`,
  }))
  return { heuristic: true, causesWithoutAction, emptyCategories }
}

// ── 2. VALIDATE (pure): EVERY SUGGESTION STATES WHAT FAILS WITHOUT IT ─────────────────────────────

export interface RawSuggestion {
  text?: unknown; category?: unknown; whatFails?: unknown; addressesCauseNumber?: unknown
}
export interface Suggestion {
  text: string; category: GapCategory; whatFails: string; addressesCauseNumber: number | null
}

const VAGUE_RE = /^(?:it|this|that)\s+(?:is|would be|will be|could be)\s+(?:important|better|good|helpful|useful|beneficial|nice|valuable)\b/i

/** ⚠ A suggestion that cannot say what fails without it is dropped, and counted. */
export function validateSuggestions(raw: unknown): { kept: Suggestion[]; dropped: number } {
  const kept: Suggestion[] = []
  let dropped = 0
  for (const r of Array.isArray(raw) ? (raw as RawSuggestion[]) : []) {
    const text = typeof r?.text === 'string' ? oneLine(r.text, 400) : ''
    const whatFails = typeof r?.whatFails === 'string' ? oneLine(r.whatFails, 400) : ''
    const category = GAP_CATEGORIES.find((c) => c === r?.category)
    const words = whatFails.split(/\s+/).filter(Boolean).length
    if (!text || !category || whatFails.length < MIN_WHAT_FAILS_CHARS || words < MIN_WHAT_FAILS_WORDS || VAGUE_RE.test(whatFails)) { dropped++; continue }
    const n = typeof r.addressesCauseNumber === 'number' && Number.isInteger(r.addressesCauseNumber) && r.addressesCauseNumber > 0 ? r.addressesCauseNumber : null
    kept.push({ text, category, whatFails, addressesCauseNumber: n })
  }
  return { kept, dropped }
}

// ── 3. COMBINE (pure): near-duplicates merged, WHICH MODELS RAISED EACH kept ─────────────────────

const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0
  let i = 0
  for (const x of a) if (b.has(x)) i++
  return i / (a.size + b.size - i)
}

export interface Combined extends Suggestion { models: string[] }
const DUP_THRESHOLD = 0.6

export function combineSuggestions(perModel: Array<{ model: string; suggestions: Suggestion[] }>): { combined: Combined[]; merged: number } {
  const combined: Array<Combined & { s: Set<string> }> = []
  let merged = 0
  for (const { model, suggestions } of perModel) {
    for (const sg of suggestions) {
      const s = stems(sg.text)
      const hit = combined.find((c) => jaccard(c.s, s) >= DUP_THRESHOLD)
      if (hit) {
        merged++
        if (!hit.models.includes(model)) hit.models.push(model)
        // keep the longer "what fails": it is the better-argued of the two
        if (sg.whatFails.length > hit.whatFails.length) hit.whatFails = sg.whatFails
        if (hit.addressesCauseNumber == null) hit.addressesCauseNumber = sg.addressesCauseNumber
      } else {
        combined.push({ ...sg, models: [model], s })
      }
    }
  }
  return { combined: combined.map(({ s: _s, ...rest }) => rest), merged }
}

/** Suggestions that say what the list already says are not suggestions. Pure. */
export function dropAlreadyThere(items: Combined[], existingTexts: string[]): { kept: Combined[]; alreadyThere: number } {
  const ex = existingTexts.map(stems)
  const kept = items.filter((c) => { const s = stems(c.text); return !ex.some((e) => jaccard(e, s) >= 0.7) })
  return { kept, alreadyThere: items.length - kept.length }
}

export function describeGapSource(s: GapSource): string {
  return `raised by ${s.models.join(', ')}`
}

// ── the model calls ──────────────────────────────────────────────────────────

const SUGGEST_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          category: { type: 'string', enum: GAP_CATEGORIES },
          whatFails: { type: 'string' },
          addressesCauseNumber: { type: 'integer' },
        },
        required: ['text', 'category', 'whatFails'],
      },
    },
  },
  required: ['suggestions'],
}

const SUGGEST_SYSTEM = [
  'You are checking a set of coherent actions for GAPS. A coherent action is a concrete step that carries out a guiding',
  'policy — something an organisation or a person would do, change, create, publish, require or stop.',
  '',
  'You are given the problem, its diagnosed causes, the ACCEPTED guiding policy, and the actions already listed. Suggest',
  'only actions WITHOUT WHICH one of these is true:',
  '  (a) the guiding policy cannot be delivered;',
  '  (b) a diagnosed cause stays unaddressed;',
  '  (c) the problem stays unsolved.',
  '',
  'Not "would also be nice", not a restatement of an action already listed, not a principle.',
  '',
  '⚠ EVERY SUGGESTION MUST STATE WHAT FAILS WITHOUT IT, in `whatFails`: one or two plain sentences naming the specific',
  'thing that breaks (which part of the policy, which cause, what stays unsolved). A suggestion that cannot do that is',
  'not needed — leave it out. `category` is legislative (a law or regulation), organisational (who does it, how, with what',
  'structure and skills) or financial (money, incentives, costs). `addressesCauseNumber` is the cause it addresses, if one.',
  'Aim for completeness across the three categories and across the causes, covering behaviour, incentives and the ways the',
  'system could be gamed. FEWER IS BETTER: an empty list is a legitimate answer.',
].join('\n')

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          members: { type: 'array', items: { type: 'integer' } },
          text: { type: 'string' },
          verdict: { type: 'string', enum: ['FITS', 'DOES_NOT_FIT', 'CONFLICTS'] },
          reason: { type: 'string' },
        },
        required: ['members', 'text', 'verdict', 'reason'],
      },
    },
  },
  required: ['groups'],
}

const TEST_SYSTEM = [
  'You test candidate coherent actions against a FINAL guiding policy, and merge duplicates.',
  '',
  'For each group of one or more numbered items give a verdict — FITS (carrying it out is consistent with the policy and',
  'helps deliver it), DOES_NOT_FIT (not wrong in itself, but does not serve THIS policy) or CONFLICTS (doing it would work',
  'against the policy or what it rules out; say which) — and a ONE-LINE reason.',
  '',
  '⚠ MERGE ONLY TRUE DUPLICATES: the same step in different words. `members` lists the numbers merged; `text` is the',
  'clearest single wording (one member\'s own words — add no detail none of them has).',
  '⚠ EVERY NUMBERED ITEM MUST APPEAR IN EXACTLY ONE GROUP. A weak item gets DOES_NOT_FIT with a reason, not omission.',
].join('\n')

export interface GapCheckResult {
  ok: boolean
  error?: string
  checkId: string | null
  free: FreeGaps
  /** Suggestions written this run. */
  written: number
  /** ⚠ Reported, not hidden: how many were dropped for not saying what fails, merged, or already in the list. */
  droppedNoWhatFails: number
  mergedDuplicates: number
  alreadyInList: number
  models: Array<{ model: string; ok: boolean; raised: number; error?: string }>
  costPence: number
  /** Model calls made (the free part is not one). */
  calls: number
  unpriced: boolean
}

const emptyFree = (): FreeGaps => ({ heuristic: true, causesWithoutAction: [], emptyCategories: [] })
const fail = (error: string, free = emptyFree()): GapCheckResult => ({
  ok: false, error, checkId: null, free, written: 0, droppedNoWhatFails: 0, mergedDuplicates: 0, alreadyInList: 0,
  models: [], costPence: 0, calls: 0, unpriced: false,
})

/** Run one check. Never throws. */
export async function runGapCheck(ideaId: string, userId: string | null): Promise<GapCheckResult> {
  // ── one at a time: marker first, then look for a rival (create-then-check, so two presses cannot both pass) ──
  const staleBefore = new Date(Date.now() - IN_FLIGHT_MS)
  await prisma.actionIdea.deleteMany({ where: { ideaId, status: RUNNING, createdAt: { lt: staleBefore } } })
  const marker = await prisma.actionIdea.create({ data: { ideaId, status: RUNNING, text: 'Check for gaps is running', sources: [] as never } })
  const release = () => prisma.actionIdea.delete({ where: { id: marker.id } }).catch(() => {})
  try {
    const rival = await prisma.actionIdea.findFirst({
      where: { ideaId, status: RUNNING, id: { not: marker.id }, createdAt: { gte: staleBefore } }, orderBy: { createdAt: 'asc' },
    })
    if (rival && (rival.createdAt < marker.createdAt || (rival.createdAt.getTime() === marker.createdAt.getTime() && rival.id < marker.id))) {
      await release()
      return fail(`A check for gaps is already running on this idea (started ${rival.createdAt.toISOString().slice(11, 16)} UTC). Wait for it — it can take a few minutes — then reload.`)
    }

    const [idea, causes, actions, policy] = await Promise.all([
      prisma.idea.findUnique({ where: { id: ideaId }, select: { challenge: true, summaryDescription: true, pivotalObstacle: true } }),
      prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: { number: 'asc' }, select: { id: true, number: true, cause: true } }),
      prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { practicalStep: true, mechanismType: true, wording: true, targetOrganisation: true, targetCauseIds: true, avenue: true } }),
      prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' } }),
    ])
    const causeList = causes.filter((c): c is { id: string; number: number; cause: string } => c.number != null)
    const numById = new Map(causes.map((c) => [c.id, c.number]))
    const free = detectFreeGaps(causeList, actions.map((a) => ({ ...a, causeNumbers: a.targetCauseIds.map((id) => numById.get(id)).filter((n): n is number => n != null), recordedAvenue: a.avenue })))
    if (!policy) { await release(); return fail('Settle a guiding policy first — the check tests what is missing against it.', free) }

    const checkId = marker.id
    const problem = idea?.challenge?.trim() || idea?.summaryDescription?.trim() || '(no problem statement recorded)'
    const user = [
      `THE PROBLEM: ${problem}`,
      idea?.pivotalObstacle ? `THE PIVOTAL OBSTACLE: ${idea.pivotalObstacle.trim()}` : '',
      '',
      'THE DIAGNOSED CAUSES:',
      causeList.map((c) => `[${c.number}] ${c.cause}`).join('\n') || '(none recorded)',
      '',
      `THE ACCEPTED GUIDING POLICY (#${policy.number}): ${policy.approach}`,
      policy.rulesOut ? `What it rules out: ${policy.rulesOut}` : '',
      policy.chainLink ? `If only part is delivered: ${policy.chainLink}` : '',
      '',
      'THE ACTIONS ALREADY LISTED:',
      actions.map((a, i) => `${i + 1}. ${a.practicalStep}`).join('\n') || '(none yet)',
      ...(free.causesWithoutAction.length || free.emptyCategories.length ? [
        '',
        'POSSIBLE GAPS FOUND WITHOUT A MODEL (a keyword match — it may be wrong):',
        ...free.causesWithoutAction.map((g) => `- cause [${g.number}] looks unaddressed`),
        ...free.emptyCategories.map((g) => `- nothing reads as ${g.category}`),
      ] : []),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')

    let costPence = 0
    let unpriced = false
    let calls = 0
    const add = (p: { pence: number | null; unpriced: boolean }) => { calls++; costPence += p.pence ?? 0; if (p.unpriced || p.pence == null) unpriced = true }

    // ── the four models, in parallel; a failure is reported, never silent ──
    const raw = await Promise.all(PREMIUM_DRAFT_MODELS.map(async (model) => {
      const result = await callModelJson<{ suggestions?: unknown }>({
        model, system: SUGGEST_SYSTEM, user, schema: SUGGEST_SCHEMA,
        maxOutputTokens: 4096, timeoutMs: MODEL_TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS, reasoningEffort: 'medium',
        label: `guiding-policy-gaps:${model}`, stream: 'lex', pass: 'guiding-policy.gaps-check', ideaId, userId,
      })
      const priced = result.usage.recorded ?? await recordUsage(result.usage, {
        stream: 'lex', pass: 'guiding-policy.gaps-check', ideaId, userId, failed: !result.ok,
      })
      add(priced)
      if (!result.ok) {
        const f = result as { reason: string; detail: string }
        return { model, ok: false as const, error: `${f.reason}: ${f.detail}`, suggestions: [] as Suggestion[], dropped: 0 }
      }
      const { kept, dropped } = validateSuggestions((result.value as { suggestions?: unknown }).suggestions)
      return { model, ok: true as const, suggestions: kept, dropped, error: undefined }
    }))

    const droppedNoWhatFails = raw.reduce((n, r) => n + r.dropped, 0)
    const modelReport = raw.map((r) => ({ model: r.model, ok: r.ok, raised: r.suggestions.length, error: r.error }))
    if (!raw.some((r) => r.ok)) {
      await release()
      return { ...fail(`None of the four models answered: ${raw.map((r) => `${r.model} (${r.error})`).join('; ')}`, free), models: modelReport, costPence, calls, unpriced }
    }

    // ── combine, drop what the list already says, and what a previous check already suggested ──
    const { combined, merged } = combineSuggestions(raw.map((r) => ({ model: r.model, suggestions: r.suggestions })))
    const previous = await prisma.actionIdea.findMany({
      where: { ideaId, status: { in: ['SUGGESTED', 'ACCEPTED_GAP'] } }, select: { text: true },
    })
    const { kept, alreadyThere } = dropAlreadyThere(combined, [...actions.map((a) => a.practicalStep), ...previous.map((p) => p.text)])

    let written = 0
    let mergedSemantic = 0
    if (kept.length) {
      // ── one call: test each against the guiding policy, and merge the duplicates the word match cannot see ──
      const testUser = [
        'THE FINAL GUIDING POLICY',
        `Policy: ${policy.approach}`,
        policy.rulesOut ? `What it rules out: ${policy.rulesOut}` : '',
        policy.chainLink ? `If only part is delivered: ${policy.chainLink}` : '',
        '',
        'THE CANDIDATE ACTIONS',
        ...kept.map((k, i) => `[${i}] (${k.category}; fails without it: ${k.whatFails}) ${k.text}`),
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
      const tested = await callModelJson<{ groups?: Parameters<typeof placeGroups>[0] }>({
        model: 'gemini-2.5-pro', system: TEST_SYSTEM, user: testUser, schema: TEST_SCHEMA,
        maxOutputTokens: 8192, timeoutMs: 90_000, temperature: 0.1, reasoningEffort: 'medium',
        label: 'guiding-policy-gaps-test', stream: 'lex', pass: 'guiding-policy.gaps-test', ideaId, userId,
      })
      add(tested.usage.recorded ?? await recordUsage(tested.usage, { stream: 'lex', pass: 'guiding-policy.gaps-test', ideaId, userId, failed: !tested.ok }))
      // ⚠ A failed test does not lose the suggestions: each is kept, verdict NOT_TESTED, and says so.
      const groups = tested.ok
        ? placeGroups((tested.value as { groups?: Parameters<typeof placeGroups>[0] }).groups, kept.map((k) => k.text))
        : kept.map((k, i) => ({ members: [i], text: k.text, verdict: 'NOT_TESTED' as Verdict, reason: 'The test against your guiding policy did not complete — this is untested.' }))

      const rows = groups.map((g) => {
        const members = g.members.map((m) => kept[m])
        mergedSemantic += members.length - 1
        const models = Array.from(new Set(members.flatMap((m) => m.models)))
        const lead = members.reduce((a, b) => (b.whatFails.length > a.whatFails.length ? b : a))
        const source: GapSource = {
          kind: 'GAP_CHECK', models, whatFails: lead.whatFails, category: lead.category,
          addressesCauseNumber: members.find((m) => m.addressesCauseNumber != null)?.addressesCauseNumber ?? null,
          checkId, checkCostPence: null,
        }
        return { text: g.text, verdict: g.verdict, reason: g.reason || null, source }
      })
      // The cost is known only now; every suggestion of this check carries the whole check's figure.
      const total = Math.round(costPence * 1000) / 1000
      await prisma.actionIdea.createMany({
        data: rows.map((r) => ({
          ideaId, status: 'SUGGESTED', text: r.text, verdict: r.verdict, reason: r.reason,
          sources: [{ ...r.source, checkCostPence: total }] as never, testedAgainstId: policy.id,
        })),
      })
      written = rows.length
    }

    console.log('[gap-check] done', { ideaId, written, droppedNoWhatFails, merged: merged + mergedSemantic, alreadyThere, calls, costPence, models: modelReport.map((m) => `${m.model}:${m.ok ? m.raised : 'FAILED'}`) })
    await release()
    return {
      ok: true, checkId, free, written, droppedNoWhatFails, mergedDuplicates: merged + mergedSemantic, alreadyInList: alreadyThere,
      models: modelReport, costPence: Math.round(costPence * 1000) / 1000, calls, unpriced,
    }
  } catch (err) {
    await release()
    console.error('[gap-check] THREW', { ideaId, error: err instanceof Error ? err.message : err })
    return fail(err instanceof Error ? err.message : String(err))
  }
}

// ── SHOW ─────────────────────────────────────────────────────────────────────

export interface GapSuggestionView {
  id: string
  text: string
  verdict: Verdict
  reason: string | null
  whatFails: string
  category: GapCategory
  addressesCauseNumber: number | null
  models: string[]
  raisedBy: string
}

const VERDICT_ORDER: Record<string, number> = { CONFLICTS: 0, DOES_NOT_FIT: 1, NOT_TESTED: 2, FITS: 3 }

export async function listGapSuggestions(ideaId: string): Promise<{
  free: FreeGaps
  suggestions: GapSuggestionView[]
  lastCostPence: number | null
  running: boolean
}> {
  const [causes, actions, rows, running] = await Promise.all([
    prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: { number: 'asc' }, select: { id: true, number: true, cause: true } }),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { practicalStep: true, mechanismType: true, wording: true, targetOrganisation: true, targetCauseIds: true, avenue: true } }),
    prisma.actionIdea.findMany({ where: { ideaId, status: 'SUGGESTED' }, orderBy: { createdAt: 'asc' } }),
    prisma.actionIdea.findFirst({ where: { ideaId, status: RUNNING, createdAt: { gte: new Date(Date.now() - IN_FLIGHT_MS) } }, select: { id: true } }),
  ])
  const numById2 = new Map(causes.map((c) => [c.id, c.number]))
  const free = detectFreeGaps(causes.filter((c): c is { id: string; number: number; cause: string } => c.number != null), actions.map((a) => ({ ...a, causeNumbers: a.targetCauseIds.map((id) => numById2.get(id)).filter((n): n is number => n != null), recordedAvenue: a.avenue })))
  const suggestions = rows.flatMap((r): GapSuggestionView[] => {
    const s = (r.sources as unknown as GapSource[])?.[0]
    if (!s || s.kind !== 'GAP_CHECK') return []
    return [{
      id: r.id, text: r.text, verdict: (r.verdict as Verdict) ?? 'NOT_TESTED', reason: r.reason, whatFails: s.whatFails,
      category: s.category, addressesCauseNumber: s.addressesCauseNumber, models: s.models, raisedBy: describeGapSource(s),
    }]
  }).sort((a, b) => (VERDICT_ORDER[a.verdict] ?? 9) - (VERDICT_ORDER[b.verdict] ?? 9))
  const last = rows.map((r) => (r.sources as unknown as GapSource[])?.[0]?.checkCostPence).filter((c): c is number => typeof c === 'number').pop() ?? null
  return { free, suggestions, lastCostPence: last, running: !!running }
}

// ── ACCEPT / DISMISS ─────────────────────────────────────────────────────────

/** ⚠ THE ONLY PLACE A GAP SUGGESTION BECOMES A `LexCoherentAction`, and only on the user's click. */
export async function acceptGapSuggestion(ideaId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.actionIdea.findFirst({ where: { id, ideaId, status: 'SUGGESTED' } })
  if (!row) return { ok: false, error: 'That suggestion is not waiting on this idea.' }
  const action = await addAction(ideaId, { practicalStep: row.text, source: 'LEX' })
  // ⚠ 26-Q — THE CAUSE THIS SUGGESTION WAS RAISED AGAINST WAS BEING THROWN AWAY HERE. `GapSource.addressesCauseNumber` was
  // the only place an action's cause was ever named, and accepting the suggestion wrote `practicalStep` and nothing else, so
  // the cause link the coverage grid needs did not exist for any action. It is recorded now, with the avenue the gap check
  // already classified the suggestion under. (A user can correct both on the open action.)
  const src = (row.sources as unknown as GapSource[] | null)?.[0]
  if (src?.kind === 'GAP_CHECK') {
    const data: Record<string, unknown> = { avenue: src.category.toUpperCase() }
    if (src.addressesCauseNumber != null) {
      const causes = await prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }], select: { id: true, number: true } })
      const cause = causes.find((c, i) => (c.number ?? i + 1) === src.addressesCauseNumber)
      if (cause) data.targetCauseIds = [cause.id]
    }
    await prisma.lexCoherentAction.update({ where: { id: action.id }, data: data as never })
  }
  await prisma.actionIdea.update({ where: { id: row.id }, data: { status: 'ACCEPTED_GAP', acceptedActionId: action.id } })
  return { ok: true }
}

export async function dismissGapSuggestion(ideaId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.actionIdea.findFirst({ where: { id, ideaId, status: 'SUGGESTED' } })
  if (!row) return { ok: false, error: 'That suggestion is not waiting on this idea.' }
  await prisma.actionIdea.update({ where: { id: row.id }, data: { status: 'DISMISSED' } })
  return { ok: true }
}
