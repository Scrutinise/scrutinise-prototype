// ─────────────────────────────────────────────────────────────────────────────
// 26-M ADDENDUM — COHERENT-ACTION IDEAS FROM CONSOLIDATION.
//
// A consolidation draft is mostly a principle, but parts of it describe things to DO. Charlie:
// *"Collect and test against the final policy, rather than click-to-add or dump."*
//
//   1. EXTRACT  each draft's action ideas, and HOLD them. ⚠ NOTHING IS ADDED TO THE KERNEL.
//   2. TEST     every held idea, once the final guiding policy is accepted, against that policy:
//               fits / does not fit / conflicts, one line why. Duplicates are merged.
//   3. SHOW     the results at the top of Coherent Actions as suggestions, each with Accept and
//               Dismiss, saying which draft(s) it came from.
//   4. ⚠⚠ THE ACTIONS PARKED WITH THE REPLACED POLICY ARE RE-TESTED IN THE SAME STEP, not dropped.
//
// ⚠ ONLY `acceptActionIdea` CREATES A `LexCoherentAction`. Everything else in this file moves a
// row between HELD / TESTED / DISMISSED, which is the same rule 26-K's update pass keeps: propose,
// never overwrite, until the user says.
//
// ⚠ NOTHING THE MODEL SAYS IS TRUSTED FOR PROVENANCE. An extracted idea must carry a quote that is
// really in the draft it names, or it is dropped (and counted); the test cannot name a member that
// was not sent; an item the test left out is kept as NOT_TESTED rather than vanishing. A guard that
// can silently lose a user's action is the failure this feature exists to prevent.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { addAction, removeAction } from './field-machine'

export type Verdict = 'FITS' | 'DOES_NOT_FIT' | 'CONFLICTS' | 'NOT_TESTED'
const VERDICTS: Verdict[] = ['FITS', 'DOES_NOT_FIT', 'CONFLICTS']

export type IdeaSource =
  | { kind: 'DRAFT'; model: string; draftId: string; consolidationId: string }
  | { kind: 'PARKED'; policyOptionId: string; number: number | null; parkedWithNumber: number | null }
  /** The user's own comment — the general one (model null) or the box on one draft. */
  | { kind: 'COMMENT'; consolidationId: string; model: string | null }

/** Words a reader sees for a source — the draft's model, or the policy an action was parked with. */
export function describeSource(s: IdeaSource): string {
  if (s.kind === 'COMMENT') return s.model ? `your comment on the ${s.model} draft` : 'your general comment on the drafts'
  return s.kind === 'DRAFT'
    ? `${s.model} draft`
    : `parked with policy ${s.parkedWithNumber ?? '?'}${s.number != null ? ` (item ${s.number})` : ''}`
}

const oneLine = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()

// ── 1. EXTRACT ───────────────────────────────────────────────────────────────

interface ExtractOut { ideas?: Array<{ draftIndex?: unknown; text?: unknown; quote?: unknown }> }

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { draftIndex: { type: 'integer' }, text: { type: 'string' }, quote: { type: 'string' } },
        required: ['draftIndex', 'text', 'quote'],
      },
    },
  },
  required: ['ideas'],
}

const EXTRACT_SYSTEM = [
  'You read draft guiding policies and lift out the parts that describe THINGS TO DO.',
  '',
  'A guiding policy is a PRINCIPLE: the approach that deals with the obstacle. A coherent action is a',
  'concrete step that carries it out — something an organisation or a person would do, change, create,',
  'publish, require or stop. Extract only the second kind. Leave the principle itself, the reasons for',
  'it, and what it rules out.',
  '',
  '⚠ EVERY IDEA MUST QUOTE ITS DRAFT. `quote` is a verbatim span (at least a few words) from the draft',
  'you name in `draftIndex`. An idea you cannot quote is one you invented — leave it out.',
  '⚠ `text` is the step as ONE plain sentence in the draft\'s own sense. Do not strengthen it, add detail',
  'the draft does not have, or merge two steps into one.',
  '⚠ FEWER IS BETTER, AND NONE IS A LEGITIMATE ANSWER. A draft that is all principle yields an empty list.',
  'Never manufacture an action to give a draft something.',
].join('\n')

/**
 * ⚠ THE PROVENANCE CHECK, PURE SO IT CAN BE TESTED WITHOUT A MODEL. An idea survives only if it names a
 * draft that was sent, has text, and carries a quote that is really in THAT draft (normalised, at least 12
 * characters — a short phrase appears everywhere). Exact repeats within one draft collapse.
 */
export function validateExtraction(
  ideas: ExtractOut['ideas'],
  drafts: Array<{ statement: string; chainLink: string | null; likelihood: string | null }>,
): { accepted: Array<{ text: string; draftIndex: number }>; dropped: number } {
  const seen = new Set<string>()
  const accepted: Array<{ text: string; draftIndex: number }> = []
  let dropped = 0
  for (const it of Array.isArray(ideas) ? ideas : []) {
    const idx = typeof it.draftIndex === 'number' ? it.draftIndex : -1
    const d = drafts[idx]
    const text = typeof it.text === 'string' ? oneLine(it.text, 400) : ''
    const quote = typeof it.quote === 'string' ? norm(it.quote) : ''
    if (!d || !text) { dropped++; continue }
    const haystack = norm([d.statement, d.chainLink, d.likelihood].filter(Boolean).join(' '))
    if (quote.length < 12 || !haystack.includes(quote)) { dropped++; continue }
    const key = `${idx}:${norm(text)}`
    if (seen.has(key)) continue
    seen.add(key)
    accepted.push({ text, draftIndex: idx })
  }
  return { accepted, dropped }
}

/**
 * Lift the action ideas out of every draft of one consolidation that has not been read yet, and
 * HOLD them. Idempotent: a draft already read is not read again. Never throws, and a failed call
 * leaves the drafts un-stamped so the next attempt (the accept step runs one) picks them up.
 */
export async function extractActionIdeas(
  ideaId: string, consolidationId: string, userId: string | null, dryRun = false,
): Promise<{ ok: boolean; held: number; dropped: number; error?: string; virtual?: Array<{ text: string; sources: IdeaSource[] }> }> {
  try {
    const drafts = await prisma.guidingPolicyDraft.findMany({
      where: { consolidationId, actionsExtractedAt: null }, orderBy: { createdAt: 'asc' },
    })
    if (!drafts.length) return { ok: true, held: 0, dropped: 0 }

    const user = drafts.map((d, i) =>
      [`[${i}] DRAFT (${d.model})`, `Policy: ${d.statement}`, d.chainLink ? `If only part is delivered: ${d.chainLink}` : '',
        d.likelihood ? `How it would be carried out: ${d.likelihood}` : ''].filter(Boolean).join('\n'),
    ).join('\n\n')

    const result = await callModelJson<ExtractOut>({
      model: 'gemini-2.5-flash', system: EXTRACT_SYSTEM, user, schema: EXTRACT_SCHEMA,
      maxOutputTokens: 4096, timeoutMs: 45_000, temperature: 0.1,
      label: 'guiding-policy-action-ideas', stream: 'lex', pass: 'guiding-policy.actions-extract',
      ideaId, userId,
    })
    if (!result.ok) {
      await (result.usage.recorded ?? recordUsage(result.usage, { stream: 'lex', pass: 'guiding-policy.actions-extract', ideaId, userId, failed: true }))
      const fail = result as { reason: string; detail: string }
      console.error('[action-ideas] extraction failed', { consolidationId, reason: fail.reason })
      return { ok: false, held: 0, dropped: 0, error: `${fail.reason}: ${fail.detail}` }
    }
    await (result.usage.recorded ?? recordUsage(result.usage, { stream: 'lex', pass: 'guiding-policy.actions-extract', ideaId, userId }))

    const { accepted, dropped } = validateExtraction(result.value.ideas, drafts)
    const rows = accepted.map((a) => ({
      text: a.text,
      source: { kind: 'DRAFT', model: drafts[a.draftIndex].model, draftId: drafts[a.draftIndex].id, consolidationId } as IdeaSource,
    }))
    if (dropped) console.warn('[action-ideas] ideas dropped — the quote is not in the draft', { consolidationId, dropped })

    if (dryRun) return { ok: true, held: rows.length, dropped, virtual: rows.map((r) => ({ text: r.text, sources: [r.source] })) }
    await prisma.$transaction([
      ...(rows.length ? [prisma.actionIdea.createMany({
        data: rows.map((r) => ({ ideaId, consolidationId, status: 'HELD', text: r.text, sources: [r.source] as never })),
      })] : []),
      prisma.guidingPolicyDraft.updateMany({ where: { id: { in: drafts.map((d) => d.id) } }, data: { actionsExtractedAt: new Date() } }),
    ])
    console.log('[action-ideas] held', { consolidationId, drafts: drafts.length, held: rows.length, dropped })
    return { ok: true, held: rows.length, dropped }
  } catch (err) {
    console.error('[action-ideas] extraction THREW', { consolidationId, error: err instanceof Error ? err.message : err })
    return { ok: false, held: 0, dropped: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── 1b. EXTRACT FROM THE USER'S OWN COMMENTS ─────────────────────────────────

const COMMENT_SYSTEM = [
  'A user has read draft guiding policies and written comments on them. Some of those comments say that an',
  'element of a draft — a winning one or a losing one — is really a COHERENT ACTION: a concrete thing to do',
  '(a step an organisation or a person would take, change, create, publish, require or stop) rather than the',
  'guiding principle.',
  '',
  'Extract ONLY the things the user says, or clearly means, should be actions. Each source below is one',
  'comment, with the draft it is about where there is one.',
  '',
  '⚠ EVERY IDEA MUST QUOTE. `quote` is a verbatim span from the COMMENT or from the DRAFT that comment is',
  'about — whichever the action comes from. If you cannot quote it you have invented it: leave it out.',
  '⚠ `text` is ONE plain sentence for the step. Use the user\'s own sense; do not add detail they did not give.',
  '⚠ NONE IS A LEGITIMATE ANSWER. A comment that only praises, criticises or reworks the principle yields nothing.',
  '⚠ NOT EVERYTHING A USER SAYS IS A STEP. Do not extract (a) a remark about how the actions should be organised or',
  'that something "should be a coherent action" without saying what the step is, (b) a general principle, method or',
  'belief ("any system should use root-cause thinking"), or (c) an opinion about the guiding policy itself. Extract a',
  'step only where a reader could say who would do what.',
].join('\n')

/**
 * Lift the action ideas out of what the user WROTE about a consolidation (the general comment and each
 * draft's own box), and hold them. Deduplicated against what is already held or written, so running it twice
 * adds nothing. Never throws.
 */
export async function extractFromComments(
  ideaId: string, consolidationId: string, userId: string | null, dryRun = false,
): Promise<{ ok: boolean; held: number; ideas: string[]; error?: string; virtual?: Array<{ text: string; sources: IdeaSource[] }> }> {
  try {
    const c = await prisma.guidingPolicyConsolidation.findFirst({
      where: { id: consolidationId, ideaId }, include: { drafts: { orderBy: { createdAt: 'asc' } } },
    })
    if (!c) return { ok: false, held: 0, ideas: [], error: 'That consolidation is not on this idea.' }

    // ⚠ READ ONCE PER CONSOLIDATION. The settle event can fire more than once for an idea (a policy is
    // chosen, un-chosen, chosen again), and the merged text that was written no longer matches the raw
    // comment idea, so de-duplicating on text alone would write every comment idea again each time. A row
    // that carries a COMMENT source for this consolidation — held, written or dismissed — means its
    // comments have been read.
    const already = await prisma.actionIdea.findMany({ where: { ideaId }, select: { sources: true } })
    if (already.some((r) => (r.sources as unknown as IdeaSource[]).some((s) => s.kind === 'COMMENT' && s.consolidationId === consolidationId))) {
      return { ok: true, held: 0, ideas: [] }
    }

    type Src = { text: string; draftText: string | null; model: string | null }
    const sources: Src[] = []
    if (c.userFeedback?.trim()) sources.push({ text: c.userFeedback.trim(), draftText: null, model: null })
    for (const d of c.drafts) if (d.userFeedback?.trim()) sources.push({ text: d.userFeedback.trim(), draftText: d.statement, model: d.model })
    if (!sources.length) return { ok: true, held: 0, ideas: [] }

    const user = sources.map((s, i) =>
      `[${i}] ${s.model ? `COMMENT ON THE ${s.model} DRAFT` : 'GENERAL COMMENT (across all drafts)'}\nComment: ${s.text}${s.draftText ? `\nThe draft it is about: ${s.draftText}` : ''}`,
    ).join('\n\n')

    const result = await callModelJson<ExtractOut>({
      model: 'gemini-2.5-flash', system: COMMENT_SYSTEM, user, schema: EXTRACT_SCHEMA,
      maxOutputTokens: 4096, timeoutMs: 45_000, temperature: 0.1,
      label: 'guiding-policy-action-ideas-comments', stream: 'lex', pass: 'guiding-policy.actions-extract',
      ideaId, userId,
    })
    await (result.usage.recorded ?? recordUsage(result.usage, { stream: 'lex', pass: 'guiding-policy.actions-extract', ideaId, userId, failed: !result.ok }))
    if (!result.ok) {
      const fail = result as { reason: string; detail: string }
      console.error('[action-ideas] comment extraction failed', { consolidationId, reason: fail.reason })
      return { ok: false, held: 0, ideas: [], error: `${fail.reason}: ${fail.detail}` }
    }

    // The quote may be in the comment OR the draft it is about — both are things the user was looking at.
    const { accepted, dropped } = validateExtraction(
      result.value.ideas,
      sources.map((s) => ({ statement: s.text, chainLink: s.draftText, likelihood: null })),
    )
    const existing = new Set((await prisma.actionIdea.findMany({
      where: { ideaId, status: { in: ['HELD', 'WRITTEN'] } }, select: { text: true },
    })).map((r) => norm(r.text)))
    const fresh = accepted.filter((a) => !existing.has(norm(a.text)))
    if (dropped) console.warn('[action-ideas] comment ideas dropped — the quote is in neither comment nor draft', { consolidationId, dropped })

    if (!dryRun && fresh.length) {
      await prisma.actionIdea.createMany({
        data: fresh.map((a) => ({
          ideaId, consolidationId, status: 'HELD', text: a.text,
          sources: [{ kind: 'COMMENT', consolidationId, model: sources[a.draftIndex].model } satisfies IdeaSource] as never,
        })),
      })
    }
    console.log('[action-ideas] from comments', { consolidationId, dryRun, held: fresh.length, dropped })
    return {
      ok: true, held: fresh.length, ideas: fresh.map((a) => a.text),
      virtual: dryRun ? fresh.map((a) => ({ text: a.text, sources: [{ kind: 'COMMENT', consolidationId, model: sources[a.draftIndex].model } as IdeaSource] })) : undefined,
    }
  } catch (err) {
    console.error('[action-ideas] comment extraction THREW', { consolidationId, error: err instanceof Error ? err.message : err })
    return { ok: false, held: 0, ideas: [], error: err instanceof Error ? err.message : String(err) }
  }
}

// ── 2. TEST ──────────────────────────────────────────────────────────────────

interface TestOut {
  groups?: Array<{ members?: unknown; text?: unknown; verdict?: unknown; reason?: unknown }>
}

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
          verdict: { type: 'string', enum: VERDICTS },
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
  'For each group of one or more numbered items, give:',
  '  verdict FITS          — carrying out this step is consistent with the policy and helps deliver it.',
  '  verdict DOES_NOT_FIT  — it is not wrong in itself, but it does not serve THIS policy (it belongs to a',
  '                          different approach, or does nothing for the obstacle the policy deals with).',
  '  verdict CONFLICTS     — doing it would work against the policy, or against something the policy',
  '                          rules out. Say which.',
  '  reason                — ONE line, plain English, saying why. No hedging.',
  '',
  '⚠ MERGE ONLY TRUE DUPLICATES: items that are the same step in different words. Two steps that merely',
  'sit in the same area are two steps. `members` lists the numbers merged; `text` is the clearest single',
  'wording of the step (use one member\'s own words — do not add detail none of them has).',
  '⚠ EVERY NUMBERED ITEM MUST APPEAR IN EXACTLY ONE GROUP. Do not drop an item because it is weak: a',
  'DOES_NOT_FIT with a reason is the answer, and the user decides.',
].join('\n')

/**
 * ⚠ THE NO-LOSS RULE, PURE. A member must be an item that was sent, and belongs to the FIRST group that
 * claims it; an unknown verdict becomes NOT_TESTED; and an item the model left out is kept as its own
 * NOT_TESTED group saying so. The returned groups cover every item exactly once.
 */
export function placeGroups(
  raw: TestOut['groups'], itemTexts: string[],
): Array<{ members: number[]; text: string; verdict: Verdict; reason: string }> {
  const claimed = new Set<number>()
  const groups: Array<{ members: number[]; text: string; verdict: Verdict; reason: string }> = []
  for (const g of Array.isArray(raw) ? raw : []) {
    const members = (Array.isArray(g.members) ? g.members : [])
      .filter((m): m is number => typeof m === 'number' && Number.isInteger(m) && m >= 0 && m < itemTexts.length && !claimed.has(m))
    if (!members.length) continue
    members.forEach((m) => claimed.add(m))
    const verdict = VERDICTS.includes(g.verdict as Verdict) ? (g.verdict as Verdict) : 'NOT_TESTED'
    const text = typeof g.text === 'string' && g.text.trim() ? oneLine(g.text, 400) : itemTexts[members[0]]
    groups.push({ members, text, verdict, reason: typeof g.reason === 'string' ? oneLine(g.reason, 240) : '' })
  }
  itemTexts.forEach((t, i) => {
    if (!claimed.has(i)) groups.push({ members: [i], text: t, verdict: 'NOT_TESTED', reason: 'The test did not return a result for this one — it is kept so it is not lost.' })
  })
  return groups
}

export interface TestSummary {
  ok: boolean
  error?: string
  /** Actions written into the Coherent Actions candidate list (after merging duplicates). */
  written: number
  merged: number
  counts: Record<Verdict, number>
  /** Parked actions carried into the step — the ones that used to wait with a policy that is no longer the one. */
  parkedRetested: number
  /** Ideas taken from the user's own comments on the drafts. */
  fromComments: number
}

const ZERO_COUNTS = (): Record<Verdict, number> => ({ FITS: 0, DOES_NOT_FIT: 0, CONFLICTS: 0, NOT_TESTED: 0 })

/**
 * ══ THE STEP THAT RUNS WHEN THE FINAL GUIDING POLICY IS ACCEPTED ═════════════════════════════
 *
 * Gathers every held idea (from the drafts AND from the user's comments), plus every live un-moved parked
 * action whose policy is no longer the settled one; tests them against `finalPolicyId`; merges duplicates;
 * and WRITES each result into the Coherent Actions candidate list.
 *
 * ⚠⚠ WRITTEN AS CANDIDATES, NOT CONFIRMED. Charlie: *"they don't jump to 'accepted coherent actions' — just
 * added to the candidate list in the coherent action stage."* So each becomes a `LexCoherentAction` row
 * (source LEX) in the list the user is already reviewing, and the field's own "These are my actions"
 * confirmation is not touched. The verdict and the one-line reason are kept on the `ActionIdea` row and
 * shown above the list; a conflicting idea is written like any other, labelled, and the user removes it.
 *
 * ⚠ A FAILED CALL CHANGES NOTHING: held ideas stay held, parked actions stay parked, and the panel offers
 * the same step again.
 *
 * `dryRun` runs the models and returns what WOULD be written, writing nothing to the kernel or the held
 * ideas — used to look at a real run before it counts.
 */
export async function testHeldActions(
  ideaId: string, finalPolicyId: string, userId: string | null,
  opts: { consolidationId?: string; dryRun?: boolean } = {},
): Promise<TestSummary & { preview?: Array<{ text: string; verdict: Verdict; reason: string; from: string[] }> }> {
  const counts = ZERO_COUNTS()
  const none = (extra: Partial<TestSummary> = {}): TestSummary => ({ ok: true, written: 0, merged: 0, counts, parkedRetested: 0, fromComments: 0, ...extra })
  try {
    const finalPolicy = await prisma.policyOption.findFirst({ where: { id: finalPolicyId, ideaId } })
    if (!finalPolicy) return none({ ok: false, error: 'The final guiding policy is not on this idea.' })

    // Anything in the drafts not yet read (the extraction at Consolidate time is best-effort).
    const consolidations = await prisma.guidingPolicyConsolidation.findMany({
      where: { ideaId, drafts: { some: { actionsExtractedAt: null } } }, select: { id: true },
    })
    // In a dry run nothing is stored, so what WOULD have been held is carried here and tested like the rest.
    const virtual: Array<{ text: string; sources: IdeaSource[] }> = []
    for (const c of consolidations) {
      const r = await extractActionIdeas(ideaId, c.id, userId, opts.dryRun)
      virtual.push(...(r.virtual ?? []))
    }

    // ⚠ THE USER'S OWN COMMENTS, read NOW, not when the drafts arrived: they are written after reading the
    // drafts, so an extraction made at Consolidate time could never have seen them.
    const fromComments = opts.consolidationId
      ? await extractFromComments(ideaId, opts.consolidationId, userId, opts.dryRun)
      : { ok: true, held: 0, ideas: [] as string[], virtual: undefined as Array<{ text: string; sources: IdeaSource[] }> | undefined }
    virtual.push(...(fromComments.virtual ?? []))

    const held = await prisma.actionIdea.findMany({ where: { ideaId, status: 'HELD' }, orderBy: { createdAt: 'asc' } })
    // ⚠⚠ THE PARKED ACTIONS. They were parked with a policy that is no longer the settled one, and `settle`
    // only releases actions parked with the policy it settles. Without this they wait for ever — and are
    // RULED_OUT with the old policy the day it is rejected.
    const parkedRaw = await prisma.policyOption.findMany({
      where: { ideaId, kind: 'COHERENT_ACTION', status: { not: 'RULED_OUT' }, movedToActionId: null, parkedWithId: { not: null } },
      orderBy: { number: 'asc' },
    })
    const parked = parkedRaw.filter((p) => p.parkedWithId !== finalPolicyId)
    const parentNumber = new Map(
      (await prisma.policyOption.findMany({
        where: { id: { in: Array.from(new Set(parked.map((p) => p.parkedWithId!))) } }, select: { id: true, number: true },
      })).map((p) => [p.id, p.number]),
    )

    type Item = { text: string; label: string; heldRow?: (typeof held)[number]; parkedRow?: (typeof parked)[number]; virtualSources?: IdeaSource[] }
    const items: Item[] = [
      ...virtual.map((v) => ({ text: v.text, virtualSources: v.sources, label: v.sources.map(describeSource).join('; ') })),
      ...held.map((h) => ({
        text: h.text, heldRow: h,
        label: (h.sources as unknown as IdeaSource[]).map(describeSource).join('; ') || 'a consolidation draft',
      })),
      ...parked.map((p) => ({
        text: p.approach, parkedRow: p,
        label: `parked with policy ${parentNumber.get(p.parkedWithId!) ?? '?'}, which is no longer the settled policy`,
      })),
    ]
    if (!items.length) return none({ fromComments: fromComments.held })

    const user = [
      'THE FINAL GUIDING POLICY',
      `Policy: ${finalPolicy.approach}`,
      finalPolicy.rulesOut ? `What it rules out: ${finalPolicy.rulesOut}` : '',
      finalPolicy.chainLink ? `If only part is delivered: ${finalPolicy.chainLink}` : '',
      '',
      'THE CANDIDATE ACTIONS',
      ...items.map((it, i) => `[${i}] (${it.label}) ${it.text}`),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')

    const result = await callModelJson<TestOut>({
      model: 'gemini-2.5-pro', system: TEST_SYSTEM, user, schema: TEST_SCHEMA,
      maxOutputTokens: 8192, timeoutMs: 90_000, temperature: 0.1, reasoningEffort: 'medium',
      label: 'guiding-policy-action-test', stream: 'lex', pass: 'guiding-policy.actions-test',
      ideaId, userId,
    })
    const priced = result.usage.recorded ?? await recordUsage(result.usage, {
      stream: 'lex', pass: 'guiding-policy.actions-test', ideaId, userId, failed: !result.ok,
    })
    if (!result.ok) {
      const fail = result as { reason: string; detail: string }
      console.error('[action-ideas] test failed', { ideaId, reason: fail.reason })
      return none({ ok: false, error: `${fail.reason}: ${fail.detail}`, fromComments: fromComments.held })
    }

    const groups = placeGroups(result.value.groups, items.map((it) => it.text))

    const sourcesOf = (it: Item): IdeaSource[] => it.virtualSources ? it.virtualSources : it.heldRow
      ? (it.heldRow.sources as unknown as IdeaSource[])
      : [{ kind: 'PARKED', policyOptionId: it.parkedRow!.id, number: it.parkedRow!.number, parkedWithNumber: parentNumber.get(it.parkedRow!.parkedWithId!) ?? null }]

    let merged = 0
    let parkedRetested = 0
    const preview: Array<{ text: string; verdict: Verdict; reason: string; from: string[] }> = []
    for (const g of groups) {
      const members = g.members.map((m) => items[m])
      const sources = members.flatMap(sourcesOf)
      const heldMembers = members.filter((m) => m.heldRow).map((m) => m.heldRow!)
      const parkedMembers = members.filter((m) => m.parkedRow).map((m) => m.parkedRow!)
      counts[g.verdict]++
      merged += members.length - 1
      parkedRetested += parkedMembers.length
      preview.push({ text: g.text, verdict: g.verdict, reason: g.reason, from: Array.from(new Set(sources.map(describeSource))) })
      if (opts.dryRun) continue

      // ⚠ ONE CANDIDATE ACTION PER GROUP, in the list the user is already reviewing. Not confirmed: the
      // field's "These are my actions" is a separate act and is not touched here.
      const action = await addAction(ideaId, { practicalStep: g.text, source: 'LEX' })
      const data = {
        text: g.text, verdict: g.verdict, reason: g.reason || null, sources: sources as never,
        status: 'WRITTEN', testedAgainstId: finalPolicyId, acceptedActionId: action.id,
      }
      await prisma.$transaction([
        heldMembers.length
          ? prisma.actionIdea.update({ where: { id: heldMembers[0].id }, data })
          : prisma.actionIdea.create({ data: { ideaId, consolidationId: null, ...data } }),
        ...heldMembers.slice(1).map((h) => prisma.actionIdea.delete({ where: { id: h.id } })),
        // ⚠ RE-PARENTED AND MARKED MOVED, NOT DISCARDED: the parked action is now in Coherent Actions (the same
        // "✓ Moved" the sort screen already shows), parked with the policy that IS settled, so rejecting the
        // old policy can no longer take it with it.
        ...(parkedMembers.length ? [prisma.policyOption.updateMany({
          where: { id: { in: parkedMembers.map((p) => p.id) } },
          data: { parkedWithId: finalPolicyId, moveStatus: 'ACCEPTED', movedToActionId: action.id },
        })] : []),
      ])
    }
    console.log('[action-ideas] written', { ideaId, dryRun: !!opts.dryRun, items: items.length, groups: groups.length, merged, counts, parkedRetested, fromComments: fromComments.held, costPence: priced.pence })
    return { ok: true, written: opts.dryRun ? 0 : groups.length, merged, counts, parkedRetested, fromComments: fromComments.held, ...(opts.dryRun ? { preview } : {}) }
  } catch (err) {
    console.error('[action-ideas] test THREW', { ideaId, error: err instanceof Error ? err.message : err })
    return none({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}

/**
 * ══ THE EVENT: A GUIDING POLICY BECAME THE SETTLED ONE ═════════════════════════════════════════
 *
 * Called from every place that settles Chosen approach (`applyPolicyOp('settle')` — which the consolidation's
 * Accept, edited or not, and the screen's own Settle both go through — and `choosePolicyApproach`). The
 * comments read are those of the idea's most recent consolidation.
 *
 * ⚠ IT WAS A BUTTON'S STEP BEFORE: the call sat in the consolidation route, so a policy settled any other way
 * would never have run it. Never throws; a failure is returned in the summary and the panel offers a retry.
 */
export async function onChosenApproachSettled(ideaId: string, policyId: string, userId: string | null) {
  try {
    const latest = await prisma.guidingPolicyConsolidation.findFirst({
      where: { ideaId }, orderBy: { createdAt: 'desc' }, select: { id: true },
    })
    return await testHeldActions(ideaId, policyId, userId, { consolidationId: latest?.id })
  } catch (err) {
    console.error('[action-ideas] settle hook THREW', { ideaId, error: err instanceof Error ? err.message : err })
    return { ok: false as const, error: err instanceof Error ? err.message : String(err), written: 0, merged: 0, counts: ZERO_COUNTS(), parkedRetested: 0, fromComments: 0 }
  }
}

// ── 3. SHOW ──────────────────────────────────────────────────────────────────

export interface AddedActionView {
  /** The `ActionIdea` id — what Remove is called with. */
  id: string
  actionId: string
  text: string
  verdict: Verdict
  reason: string | null
  /** Which draft(s), comments and parked actions it came from, in words. */
  from: string[]
}

const VERDICT_ORDER: Record<string, number> = { CONFLICTS: 0, DOES_NOT_FIT: 1, NOT_TESTED: 2, FITS: 3 }

/**
 * What the consolidation added to the candidate list, for the panel above it. Only rows whose action
 * still exists: one the user has deleted or removed from the list itself is not shown as present.
 */
export async function listAddedActions(ideaId: string): Promise<{
  added: AddedActionView[]
  /** Ideas still held — the step did not run, or failed — and the settled policy to run it against. */
  held: number
  settledPolicyId: string | null
}> {
  const [rows, settled, heldCount] = await Promise.all([
    prisma.actionIdea.findMany({ where: { ideaId, status: 'WRITTEN', acceptedActionId: { not: null } }, orderBy: { createdAt: 'asc' } }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' }, select: { id: true } }),
    prisma.actionIdea.count({ where: { ideaId, status: 'HELD' } }),
  ])
  const live = new Map((await prisma.lexCoherentAction.findMany({
    where: { id: { in: rows.map((r) => r.acceptedActionId!) } }, select: { id: true, practicalStep: true },
  })).map((a) => [a.id, a.practicalStep]))
  const added = rows
    .filter((r) => live.has(r.acceptedActionId!))
    .map((r) => ({
      id: r.id, actionId: r.acceptedActionId!, text: live.get(r.acceptedActionId!)!,
      verdict: (r.verdict as Verdict) ?? 'NOT_TESTED', reason: r.reason,
      from: Array.from(new Set((r.sources as unknown as IdeaSource[]).map(describeSource))),
    }))
    .sort((a, b) => (VERDICT_ORDER[a.verdict] ?? 9) - (VERDICT_ORDER[b.verdict] ?? 9))
  return { added, held: heldCount, settledPolicyId: settled?.id ?? null }
}

// ── 4. REMOVE ────────────────────────────────────────────────────────────────

/**
 * Take an added action back out of the candidate list. The user's own decision — and the only thing that
 * may end a parked action here, which it then records.
 */
export async function removeAddedAction(ideaId: string, id: string): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.actionIdea.findFirst({ where: { id, ideaId, status: 'WRITTEN' } })
  if (!row) return { ok: false, error: 'That action was not added from the consolidation on this idea.' }
  if (row.acceptedActionId) await removeAction(ideaId, row.acceptedActionId)
  const parkedIds = (row.sources as unknown as IdeaSource[]).filter((s) => s.kind === 'PARKED').map((s) => (s as { policyOptionId: string }).policyOptionId)
  await prisma.$transaction([
    prisma.actionIdea.update({ where: { id: row.id }, data: { status: 'DISMISSED' } }),
    ...(parkedIds.length ? [prisma.policyOption.updateMany({
      where: { id: { in: parkedIds }, ideaId },
      data: { status: 'RULED_OUT', ruleOutReason: `Removed from Coherent Actions after the consolidation${row.reason ? `: ${row.reason}` : '.'}` },
    })] : []),
  ])
  return { ok: true }
}
