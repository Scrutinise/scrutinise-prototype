// ─────────────────────────────────────────────────────────────────────────────
// 25-P §1 — THE GUIDING POLICY'S STATE AND ITS NON-MODEL OPERATIONS.
//
// ⚠⚠ THIS IS HERE SO THE CHECKS CAN RUN THE CODE THE ROUTE RUNS. §1.12 asks for assertions
// over RENDERED DATA — "a merge renders carrying both parents' content", "a moved action
// renders in coherent actions and no longer in the policy list" — and the only honest way to
// assert that is to perform the operation and then read the state the screen reads.
//
// The alternative was a check that re-implemented `acceptMove` and asserted its own copy. This
// repository has already been bitten by exactly that: a check re-implemented `admits()`, missed
// `extraCorpora`, and published UNREACHABLE=4 when the true figure was 0. A re-implementation
// asserts that two pieces of code AGREE, which they do right up to the moment one is fixed.
//
// So the route keeps auth, validation and the two model calls; everything else lives here and
// has exactly one implementation.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { setLoopProposal } from '@/lib/lex/field-machine'
import {
  pairPolicies, nextNumber, universalCauses, nearDuplicatePairs,
  type Pairing, type DuplicatePair,
} from '@/lib/lex/guiding-policy'
import { testIsCompound, type CompoundTest } from '@/lib/lex/rumelt-tests'

/** Every operation on this screen that does not call a model. */
export type PolicyOp =
  | 'acceptMove' | 'declineMove'
  | 'acceptCause' | 'declineCause'
  | 'settle' | 'phase' | 'reject' | 'restore' | 'proceedUnresolved' | 'countRound'
  /** 25-S §1.3 — put back where the sort moved it from. See `applyPolicyOp`. */
  | 'undoSort'
  /**
   * 25-T §2b — the merge, accepted. ⚠ The JUDGEMENT is the POST's and calls a model; this is the
   * WRITE, and calls nothing. They were one operation until 25-T: asking "can 4 and 8 merge?"
   * silently performed the merge, so the user found out what the answer was by discovering their
   * list had already changed.
   */
  | 'acceptMerge'
  /** 26-I §1 — the user's own candidate. Their words, verbatim and attributed (source USER),
   *  numbered like any other. See `applyPolicyOp`'s `add` case for the compound test run on it
   *  immediately (§1c: "tested like them"). */
  | 'add'
  /** 26-I §2 — the two dispositions with no existing home. `markSaysSameAs` takes `duplicateOfNumber`
   *  in the input; `markPartOfSolution` takes none beyond `policyId`. */
  | 'markPartOfSolution' | 'markSaysSameAs'
  /** 26-I §2 — "really an action — the automatic sort exists; the user may also assert it." Unlike
   *  `acceptMove` (consenting to Lex's OFFER), this is the user's own initiative — no separate
   *  consent step, because asserting it themselves already is the consent. */
  | 'assertAction'
  /** 26-I §2 — undo of `markPartOfSolution`/`markSaysSameAs`, back to UNDISPOSITIONED. Symmetry with
   *  every other move on this screen being reversible (25-S §1.3's own rule, extended). */
  | 'clearDisposition'
  /**
   * 26-L §2 — the write "one contains the other" never had. See `writeEnhance`: the containing
   * row is edited in place (with its prior wording kept as a `FieldRevision`, exactly like a
   * chat-accepted rewrite) and the subordinate row is archived — never a new row, unlike
   * `acceptMerge`.
   */
  | 'acceptEnhance'
  /**
   * 26-L §3b — every candidate card carries the same editable fields regardless of how it
   * arrived: the statement, what it rules out, what it fixes, how likely it is to happen. The
   * prior wording of an edited statement is kept via `FieldRevision`, same mechanism as
   * `acceptEnhance` and the chat rewrite path (`field-edit-write.ts`) — one history, three
   * writers.
   */
  | 'edit'
  /**
   * 26-L addendum 2 §6 — "The chosen guiding policy can be un-chosen and changed." The button
   * that used to set it directly (`settle`, from the card) was removed in the previous
   * addendum, which correctly stopped a card from bypassing Consolidate — and left anything
   * ALREADY chosen with no way back, since `settle` itself was never a toggle. This is that
   * way back: demotes whichever row is CHOSEN to CANDIDATE and clears `chosenApproach`, so a
   * new one can be chosen (through Consolidate → Accept, or — where nothing needs
   * consolidating — a direct `settle`, which the backend still supports; only the
   * bypass-Consolidate BUTTON was retired).
   */
  | 'unchoose'
  /**
   * 26-L addendum 2 §5 — "A Save button on feedback text." The feedback box on a card had no
   * save of its own: `reason` only ever travelled bundled with another op (reject/phase/…),
   * so typing feedback with no other action in mind had nothing to press. This op does nothing
   * beyond what already runs for EVERY op at the top of `applyPolicyOp` — filing `reason` as
   * `PolicyFeedback` when present — so feedback alone can be saved without also, say, rejecting
   * the candidate to get the reason box to fire.
   */
  | 'fileFeedback'

export const POLICY_OPS: PolicyOp[] = [
  'acceptMove', 'declineMove', 'acceptCause', 'declineCause',
  'settle', 'phase', 'reject', 'restore', 'proceedUnresolved', 'countRound',
  'undoSort', 'acceptMerge',
  'add', 'markPartOfSolution', 'markSaysSameAs', 'assertAction', 'clearDisposition',
  'acceptEnhance', 'edit', 'unchoose', 'fileFeedback',
]

/**
 * 26-I §2 — THE FIVE DISPOSITIONS, READ AS ONE UNIFIED CHOICE.
 *
 * Three already had a home before 26-I (`status`, `phase`, `kind`); two are new
 * (`disposition`/`duplicateOfNumber`). This is the one place that reads all five as a
 * single value, so the sort UI and the "every candidate carries a disposition" gate
 * (§2/A5) never have to re-derive the priority order themselves.
 *
 * Priority matters: a row can be RULED_OUT and still carry a stale `disposition` from
 * before it was ruled out (nothing clears it, deliberately — see `rejectPolicyOption`,
 * which never touches `disposition`), so the legacy fields are read FIRST.
 */
export type EffectiveDisposition =
  | 'RULE_OUT' | 'LATER_PHASE' | 'REALLY_ACTION' | 'PART_OF_SOLUTION' | 'SAYS_SAME_AS' | 'UNDISPOSITIONED'

export function effectiveDisposition(row: {
  status: string; kind: string; phase: string | null
  disposition: string; duplicateOfNumber: number | null
}): EffectiveDisposition {
  if (row.status === 'RULED_OUT') return 'RULE_OUT'
  if (row.kind === 'COHERENT_ACTION') return 'REALLY_ACTION'
  if (row.phase === 'LATER') return 'LATER_PHASE'
  if (row.disposition === 'SAYS_SAME_AS' && row.duplicateOfNumber != null) return 'SAYS_SAME_AS'
  if (row.disposition === 'PART_OF_SOLUTION') return 'PART_OF_SOLUTION'
  return 'UNDISPOSITIONED'
}

export type PolicyState = Awaited<ReturnType<typeof readPolicyState>>

/** §1.9 — after this many rounds Lex stops asking and offers to proceed unresolved. */
const MAX_ROUNDS = 2

/**
 * ⚠⚠ THE ONLY WRITER OF THE `policyOptions` FIELD. See the header.
 *
 * Re-derived from EVERY live row, so no operation can produce a field thinner than the rows.
 * ⚠ It lists live candidates only — a rejected or superseded policy keeps its row and its
 * number but is not part of the proposal's own statement of its options.
 */
export async function syncPolicyField(ideaId: string): Promise<void> {
  const rows = await prisma.policyOption.findMany({
    where: { ideaId, status: { not: 'RULED_OUT' }, mergedIntoId: null, kind: 'GUIDING_POLICY' },
    orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
    select: { number: true, approach: true },
  })
  if (!rows.length) return
  // ⚠ THE STABLE NUMBER IS IN THE TEXT, not the position. `setLoopProposal` numbers its rows
  // `1..n` by position, which would renumber the list in the one artefact the document reads —
  // exactly the collision §1.1 exists to prevent. So the number is carried inside the line.
  await setLoopProposal(
    ideaId, 'policyOptions',
    rows.map((r) => `[${r.number ?? '?'}] ${r.approach}`),
    `${rows.length} candidate guiding ${rows.length === 1 ? 'policy' : 'policies'}, numbered. `
      + 'The numbers are stable: a rejected one leaves a gap and nothing renumbers.',
  )
}

/**
 * ══ BRIEF_26E §2b — THE ONE WRITER FOR "RULE OUT A POLICY" ══════════════════════════════
 *
 * §2b: *"Recommend a number never being reused... confirm this uses [the 25-P mechanism]
 * rather than a second one."* It did not: `PolicyOptionsField`'s own "Rule out" button (the
 * candidate-editing list, before a policy is sorted) posted to `/api/ideas/[id]/policy-options`,
 * which called a second, thinner implementation — `ruleOutPolicyOption` in field-machine.ts —
 * that wrote the same two columns but skipped the cascade below: an action parked with a
 * policy ruled out from THAT list stayed in the kernel implementing something thrown away,
 * while the identical rule-out from this screen correctly took it with it.
 *
 * This is now the only implementation. `applyPolicyOp('reject', …)` and the policy-options
 * route both call it; there is nowhere left for the two to diverge.
 */
export async function rejectPolicyOption(ideaId: string, policyId: string, reason: string): Promise<boolean> {
  const row = await prisma.policyOption.findFirst({ where: { id: policyId, ideaId } })
  if (!row) return false
  await prisma.policyOption.update({
    where: { id: row.id },
    data: { status: 'RULED_OUT', ruleOutReason: reason || 'No reason recorded.' },
  })
  // ⚠ §1.3 — AN ACTION PARKED WITH A REJECTED POLICY GOES WITH IT. That is the whole point of
  // parking: it must not turn up in the kernel implementing something thrown away.
  await prisma.policyOption.updateMany({
    where: { ideaId, parkedWithId: row.id, movedToActionId: null },
    data: {
      status: 'RULED_OUT',
      ruleOutReason: `The policy it implements (${row.number}) was rejected: ${reason || 'no reason recorded'}`,
    },
  })
  await syncPolicyField(ideaId)
  return true
}

/**
 * ══ §1.4 — ACCEPTING A CAUSE MARKS THE CAUSES SECTION CHANGED ══════════════════════
 *
 * §6's acceptance criterion is two things, not one: *"accepting adds it and marks the causes
 * section changed"*. Creating the `DiagnosisCause` row is the first half. This is the second.
 *
 * ⚠⚠ AND THE SECOND HALF IS NOT DECORATION. The causes field sits at ACCEPTED once the user has
 * agreed to the diagnosis. A cause added underneath it afterwards leaves the field claiming
 * agreement to a list that no longer exists — the user approved four causes and is now looking at
 * five, with nothing anywhere saying so. `setLoopProposal` puts the field back to
 * AWAITING_CONFIRMATION with the new list in it, which is this product's own vocabulary for
 * "Lex has changed this and nobody has agreed to it yet".
 *
 * ⚠ RE-DERIVED FROM EVERY ROW, exactly like `syncPolicyField`, and in the same shape the build
 * writes (`(material) …` / `(contributory) …`). A proposal assembled from anything but the rows
 * is a proposal that can be thinner than them.
 */
async function syncCausesField(ideaId: string): Promise<void> {
  const rows = await prisma.diagnosisCause.findMany({
    where: { ideaId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: { cause: true, classification: true },
  })
  if (!rows.length) return
  await setLoopProposal(
    ideaId, 'causes',
    rows.map((c) => `(${c.classification === 'MATERIAL' ? 'material' : 'contributory'}) ${c.cause.trim()}`),
    'A cause was added because a guiding policy answered something the diagnosis did not claim. '
      + 'The list is here in full for you to agree to again.',
  )
}

/** Assign stable numbers to any row that has none, oldest first. §1.1. */
export async function ensureNumbered(ideaId: string): Promise<void> {
  const rows = await prisma.policyOption.findMany({
    where: { ideaId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, number: true },
  })
  let next = nextNumber(rows)
  for (const r of rows) {
    if (r.number != null) continue
    await prisma.policyOption.update({ where: { id: r.id }, data: { number: next++ } })
  }
}

export async function readPolicyState(ideaId: string) {
  await ensureNumbered(ideaId)

  const [idea, rows, causes, actions, feedbackCount, feedbackByPolicyRows] = await Promise.all([
    prisma.idea.findUnique({
      where: { id: ideaId },
      select: {
        guidingPolicyRounds: true, guidingPolicyUnresolved: true,
        guidingPolicyUnresolvedWhy: true, chosenApproach: true,
      },
    }),
    prisma.policyOption.findMany({
      where: { ideaId }, orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.diagnosisCause.findMany({
      where: { ideaId }, orderBy: { createdAt: 'asc' },
      select: { id: true, cause: true, parentCauseId: true, isRootCause: true },
    }),
    prisma.lexCoherentAction.findMany({
      where: { ideaId }, select: { id: true, practicalStep: true },
    }),
    // 26-I addendum A5 — "shows what it will read: M items of feedback."
    prisma.policyFeedback.count({ where: { ideaId } }),
    // ⚠⚠ 26-L addendum, decision 103 item 2 — "a candidate with feedback on it has been
    // engaged with, and the gate accepts it." Read once, grouped by candidate, rather than
    // per-row: distinct policyOptionIds carrying at least one feedback row.
    prisma.policyFeedback.findMany({
      where: { ideaId, policyOptionId: { not: null } },
      select: { policyOptionId: true },
      distinct: ['policyOptionId'],
    }),
  ])

  // Causes get their own display numbers, in the order the panel shows them.
  const causeNumber = new Map(causes.map((c, i) => [c.id, i + 1]))
  const drivenBy = new Map<number, number | null>(
    causes.map((c) => [
      causeNumber.get(c.id)!,
      c.parentCauseId ? causeNumber.get(c.parentCauseId) ?? null : null,
    ]),
  )

  const live = rows.filter(
    (r) => r.kind === 'GUIDING_POLICY' && r.status !== 'RULED_OUT' && !r.mergedIntoId,
  )
  const liveWithCauses = live.map((r) => ({
    number: r.number ?? 0,
    causeNumbers: r.targetCauseIds.map((cid) => causeNumber.get(cid)).filter((n): n is number => !!n),
  }))
  // ⚠⚠ 26-L §9b — A CAUSE EVERY CANDIDATE ATTACKS TELLS YOU NOTHING ABOUT ANY PAIR OF THEM.
  // Computed here, from the live set, and reported alongside the pairings rather than applied
  // silently (§9d).
  const excludedCauses = universalCauses(liveWithCauses)
  const pairings: Pairing[] = pairPolicies(liveWithCauses, drivenBy, excludedCauses)
  // §9a/§9c — near-duplicates, from the sort's own judgement of wording, not cause overlap.
  // Filtered to numbers still live, so a duplicate-of-a-rejected-row never surfaces a dead pair.
  const liveNumbers = new Set(live.map((r) => r.number).filter((n): n is number => n != null))
  const nearDuplicates: DuplicatePair[] = nearDuplicatePairs(
    live.map((r) => ({
      number: r.number ?? 0,
      duplicateOfNumbers: r.duplicateOfNumbers.filter((n) => liveNumbers.has(n)),
    })),
  )

  // 26-I §2/A5 — "Consolidate is disabled until every candidate carries a disposition."
  // A candidate here means a live guiding-policy row that hasn't already been carried
  // somewhere else (ruled out, later-phased, reclassified as an action, or superseded) —
  // those already HAVE a disposition, by definition, and are excluded rather than forced
  // to also be PART_OF_SOLUTION or SAYS_SAME_AS.
  // `live` already excludes RULED_OUT/superseded/non-GUIDING_POLICY rows. CHOSEN is
  // excluded here too — that row is the concluded outcome of a consolidation (created by
  // Accept, §7), not a candidate still awaiting one.
  const dispositionable = live.filter((r) => r.status !== 'CHOSEN')
  // ⚠⚠ 26-L addendum, decision 103 item 2 — "a candidate with feedback on it has been engaged
  // with, and the gate accepts it." A row with no disposition but at least one PolicyFeedback
  // row against it no longer blocks Consolidate — restoring Charlie's own original wording,
  // "greyed out until you've commented on each option" (§10a of BRIEF_26L had this as "sorted",
  // pending confirmation; decision 103 settles it as feedback/disposition, either satisfies).
  const feedbackGiven = new Set(feedbackByPolicyRows.map((f) => f.policyOptionId).filter((x): x is string => !!x))
  const stillWaiting = dispositionable.filter(
    (r) => effectiveDisposition({ ...r, disposition: r.disposition, duplicateOfNumber: r.duplicateOfNumber }) === 'UNDISPOSITIONED'
      && !feedbackGiven.has(r.id),
  )
  const partOfSolution = dispositionable.filter(
    (r) => effectiveDisposition({ ...r, disposition: r.disposition, duplicateOfNumber: r.duplicateOfNumber }) === 'PART_OF_SOLUTION',
  )

  return {
    ideaId,
    rounds: idea?.guidingPolicyRounds ?? 0,
    maxRounds: MAX_ROUNDS,
    // ⚠ §1.9 — the OFFER appears after two rounds; it is never forced.
    offerUnresolved: (idea?.guidingPolicyRounds ?? 0) >= MAX_ROUNDS,
    unresolved: idea?.guidingPolicyUnresolved ?? false,
    unresolvedWhy: idea?.guidingPolicyUnresolvedWhy ?? null,
    settled: idea?.chosenApproach?.trim() || null,
    causes: causes.map((c) => ({
      id: c.id, number: causeNumber.get(c.id)!, cause: c.cause, isRoot: c.isRootCause,
    })),
    policies: rows.map((r) => ({
      id: r.id,
      number: r.number,
      approach: r.approach,
      caseFor: r.caseFor,
      caseAgainst: r.caseAgainst,
      status: r.status,
      // ⚠ §1.10 — RETAINED ON RESTORE, so "we rejected this once, for this reason" survives.
      ruleOutReason: r.ruleOutReason,
      kind: r.kind,
      kindReason: r.kindReason,
      sorted: !!r.sortedAt,
      moveStatus: r.moveStatus,
      parkedWithId: r.parkedWithId,
      movedToActionId: r.movedToActionId,
      mergedFrom: r.mergedFrom,
      superseded: !!r.mergedIntoId,
      importance: r.importance,
      addressability: r.addressability,
      chainLink: r.chainLink,
      phase: r.phase,
      phaseReason: r.phaseReason,
      impliedCause: r.impliedCause,
      causeNumbers: r.targetCauseIds
        .map((cid) => causeNumber.get(cid)).filter((n): n is number => !!n),
      // 26-I §2/§5c
      disposition: r.disposition,
      duplicateOfNumber: r.duplicateOfNumber,
      // 26-L §9 — the sort's own near-duplicate judgement, filtered to numbers still live.
      duplicateOfNumbers: r.duplicateOfNumbers.filter((n) => liveNumbers.has(n)),
      draftModel: r.draftModel,
      rulesOut: r.rulesOut,
      likelihood: r.likelihood,
      effectiveDisposition: effectiveDisposition({ ...r, disposition: r.disposition, duplicateOfNumber: r.duplicateOfNumber }),
    })),
    pairings,
    // 26-L §9a/§9c/§9d
    nearDuplicates,
    excludedCauseNumbers: [...excludedCauses].sort((a, b) => a - b),
    actions: actions.map((a) => ({ id: a.id, step: a.practicalStep })),
    // 26-I addendum A5 — everything the Consolidate button needs to show its own count
    // and decide whether it is enabled, without the client re-deriving the gate.
    consolidate: {
      candidateCount: partOfSolution.length,
      feedbackCount,
      enabled: dispositionable.length > 0 && stillWaiting.length === 0,
      undispositionedCount: stillWaiting.length,
      // ⚠⚠ 26-L addendum, decision 103 item 1 — "The gate names what it is waiting for."
      // A count that doesn't say which is a gap that hides itself.
      waitingOnNumbers: stillWaiting.map((r) => r.number).filter((n): n is number => n != null).sort((a, b) => a - b),
    },
  }
}

/**
 * ⚠⚠ THE ONE IMPLEMENTATION OF THE NON-MODEL OPERATIONS, AND IT RETURNS THE NEW STATE.
 *
 * Returning the state rather than void is what makes §1.12's assertions honest: a caller cannot
 * check "the row was updated" and call it rendered. It gets back exactly what the screen gets
 * back, and asserts on that.
 *
 * `notOnThisIdea` is returned rather than thrown — the route turns it into a 404 naming the
 * policy, which is the useful half of that answer.
 */
export async function applyPolicyOp(input: {
  ideaId: string
  op: PolicyOp
  policyId?: string
  reason?: string
  phase?: 'NOW' | 'LATER'
  /** 25-T §2b — `acceptMerge` only: the two numbers, and the merge the user is accepting. */
  merge?: {
    na: number
    nb: number
    merged: { approach: string; caseFor?: string | null; caseAgainst?: string | null }
    reasoning?: string
    chainLink?: string | null
  }
  /** 26-I §1 — `add` only: the user's own words, verbatim. */
  text?: string
  /** 26-I §2 — `markSaysSameAs` only: the OTHER candidate's stable §1.1 number. */
  duplicateOfNumber?: number
  /**
   * 26-L §2 — `acceptEnhance` only. `containingNumber` keeps its own id and number; the
   * subordinate is archived, never deleted. `merged` is the containing policy's restated text —
   * the same shape `acceptMerge` takes, reused rather than duplicated.
   */
  enhance?: {
    containingNumber: number
    subordinateNumber: number
    merged: { approach: string; caseFor?: string | null; caseAgainst?: string | null }
    reasoning?: string
  }
  /** 26-L §3b — `edit` only: any subset of the four fields every card now carries. */
  edit?: { approach?: string; rulesOut?: string; caseFor?: string; likelihood?: string }
  /** `acceptEnhance`/`edit` only — whose prior wording `FieldRevision` records as superseded. */
  userId?: string
}): Promise<{ state: PolicyState; addedNumber?: number; compoundTest?: CompoundTest; actionIdeas?: unknown } | { notOnThisIdea: true }> {
  const { ideaId: id, op, policyId, reason, phase, merge, text, duplicateOfNumber, enhance, edit, userId } = input

  const row = policyId
    ? await prisma.policyOption.findFirst({ where: { id: policyId, ideaId: id } })
    : null
  if (policyId && !row) return { notOnThisIdea: true }

  // 26-I addendum A6 — the per-card reason box accepts ANY feedback, not only a rule-out
  // reason. Rather than a second write path, every op that carries a `reason` files it to
  // the one feedback record (A1) here, regardless of which disposition it accompanied.
  if (row && reason?.trim()) {
    await prisma.policyFeedback.create({
      data: { ideaId: id, policyOptionId: row.id, source: 'CARD_REASON', text: reason.trim() },
    })
  }

  let addedNumber: number | undefined
  let compoundTest: CompoundTest | undefined
  /** 26-M — what the settle EVENT did with the held coherent-action ideas (see `onChosenApproachSettled`). */
  let actionIdeas: Awaited<ReturnType<typeof import('./action-ideas').onChosenApproachSettled>> | undefined

  switch (op) {
    // ══════════ 25-T §2b — THE MERGE WRITES HERE, ON ACCEPTANCE, AND NOWHERE ELSE ══════════
    //
    // §2b: *"The merge writes only on the user's acceptance, as a card showing the two parents
    // and the proposed merged policy side by side."*
    //
    // ⚠⚠ WHAT THIS REPLACES. The POST that ASKED the question also performed the merge, in the
    // same request: `judgeMerge` then `writeMerge`, unconditionally. So "merge 4 and 8" was not
    // a question with an answer — it was an instruction, and the user learned the verdict by
    // noticing that two policies had gone and a ninth had appeared. Every other consequential
    // move on this screen (a cause, a move, a rejection) asks first; this one did not.
    //
    // ⚠ THE VERDICT STILL DECIDES WHETHER THERE IS ANYTHING TO ACCEPT. `writeMerge` returns null
    // for the other three verdicts, so §2e survives untouched: a SEQUENCE or a CONTRADICTORY
    // cannot be accepted into existence by posting it here.
    case 'acceptMerge': {
      if (!merge) break
      await writeMerge({
        ideaId: id,
        na: merge.na,
        nb: merge.nb,
        answer: {
          verdict: 'MERGE',
          reasoning: merge.reasoning,
          chainLink: merge.chainLink ?? null,
          merged: merge.merged,
        },
      })
      break
    }

    // ══════════ 26-L §2 — "ONE CONTAINS THE OTHER" NOW WRITES SOMETHING ══════════════════════
    //
    // §2c measured it live: this verdict wrote NOTHING at all. #3 and #6 sat there, near-
    // identical, both live, for ever. §2a's wording — "#3 has been enhanced to include #6. #6
    // has been archived." — is what this performs: unlike `acceptMerge`, no new row, no new
    // number; the containing row keeps its own identity and the subordinate is archived into it.
    case 'acceptEnhance': {
      if (!enhance || !userId) break
      await writeEnhance({ ideaId: id, userId, ...enhance })
      break
    }

    // ══ 26-L §3b — EVERY CANDIDATE CARD CARRIES THE SAME EDITABLE FIELDS ═════════════════════
    case 'edit': {
      if (!row || !edit || !userId) break
      const approach = edit.approach?.trim()
      // ⚠ THE PRIOR STATEMENT IS KEPT, EXACTLY LIKE A CHAT-ACCEPTED REWRITE
      // (`field-edit-write.ts`) — one history for the field, however the edit arrived.
      if (approach && approach !== row.approach) {
        await prisma.$transaction([
          prisma.fieldRevision.create({
            data: {
              ideaId: id, fieldKey: 'policyOptions', targetId: row.id, targetNumber: row.number,
              previousText: row.approach, previousSource: row.source,
              newText: approach, acceptedById: userId, origin: 'GUIDING_POLICY_CARD_EDIT',
            },
          }),
          prisma.policyOption.update({ where: { id: row.id }, data: { approach } }),
        ])
      }
      const rest: Record<string, unknown> = {}
      if (edit.rulesOut !== undefined) rest.rulesOut = edit.rulesOut.trim() || null
      if (edit.caseFor !== undefined) rest.caseFor = edit.caseFor.trim() || null
      if (edit.likelihood !== undefined) rest.likelihood = edit.likelihood.trim() || null
      if (Object.keys(rest).length) {
        await prisma.policyOption.update({ where: { id: row.id }, data: rest })
      }
      break
    }

    // ══ §1.3 — AN ACTION MOVES ONLY ON CONSENT, AND ONLY IF ITS POLICY IS SETTLED ══
    case 'acceptMove': {
      if (!row) break
      const parent = row.parkedWithId
        ? await prisma.policyOption.findUnique({ where: { id: row.parkedWithId } })
        : null
      // ⚠⚠ THE SECOND HALF OF §1.3, AND IT IS THE HALF THAT MATTERS. An action belongs to a
      // POLICY, not to the kernel in general. If the policy it implements has not been settled,
      // the action is PARKED WITH IT and follows its fate — otherwise a user settles policy 3
      // and finds the coherent actions section full of steps implementing policy 8, which they
      // rejected an hour earlier.
      const parentSettled = parent ? parent.status === 'CHOSEN' : false
      if (parent && !parentSettled) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: { moveStatus: 'ACCEPTED' },
        })
        break
      }
      const action = await prisma.lexCoherentAction.create({
        data: { ideaId: id, practicalStep: row.approach, source: 'LEX' },
      })
      await prisma.policyOption.update({
        where: { id: row.id },
        data: { moveStatus: 'ACCEPTED', movedToActionId: action.id },
      })
      break
    }
    case 'declineMove':
      // ⚠ A DECLINE PUTS IT BACK AS A POLICY. The user has overruled the sort, and the item
      // must stop being offered as an action every time the screen reloads.
      if (row) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: {
            moveStatus: 'DECLINED', kind: 'GUIDING_POLICY',
            kindReason: `You kept this as a guiding policy. Lex had read it as a coherent action: `
              + `${row.kindReason ?? 'no reason recorded'}`,
          },
        })
      }
      break

    // ══ §1.4 — THE CAUSE A POLICY IMPLIES ══════════════════════════════════════
    case 'acceptCause': {
      if (!row) break
      const implied = row.impliedCause as { cause?: string; why?: string } | null
      if (!implied?.cause) break
      // ⚠ LEX DOES NOT ADD A CAUSE ON ITS OWN — this runs only on the user's acceptance, and
      // the cause is marked as coming from them so the diagnosis records who put it there.
      const created = await prisma.diagnosisCause.create({
        data: {
          ideaId: id, cause: implied.cause,
          whyPersisted: implied.why ?? null,
          source: 'USER',
        },
      })
      await prisma.policyOption.update({
        where: { id: row.id },
        data: { impliedCause: { ...implied, status: 'ACCEPTED', addedCauseId: created.id } as never },
      })
      // ⚠ THE SECOND HALF OF THE ACCEPTANCE CRITERION. See `syncCausesField`: a cause added under
      // an already-agreed diagnosis leaves the field claiming agreement to a list that has
      // changed underneath it.
      await syncCausesField(id)
      break
    }
    case 'declineCause':
      // ⚠⚠ A DECLINE IS RECORDED AGAINST THE POLICY, NOT FORGOTTEN. §1.4: it is a real weakness
      // — the policy answers something the diagnosis does not claim — and the adversarial read
      // must be able to see it.
      if (row) {
        const implied = row.impliedCause as Record<string, unknown> | null
        await prisma.policyOption.update({
          where: { id: row.id },
          data: {
            impliedCause: {
              ...(implied ?? {}), status: 'DECLINED', addedCauseId: null,
              declinedReason: reason || null,
            } as never,
          },
        })
      }
      break

    // ══ §1.10 — WHAT THE USER LEAVES WITH ══════════════════════════════════════
    case 'settle':
      if (row) {
        await prisma.$transaction([
          // One CHOSEN at a time: settling a second silently would leave two.
          prisma.policyOption.updateMany({
            where: { ideaId: id, status: 'CHOSEN' }, data: { status: 'CANDIDATE' },
          }),
          prisma.policyOption.update({ where: { id: row.id }, data: { status: 'CHOSEN', phase: 'NOW' } }),
          prisma.idea.update({
            where: { id },
            data: {
              chosenApproach: row.approach,
              guidingPolicyUnresolved: false, guidingPolicyUnresolvedWhy: null,
            },
          }),
        ])
        // ⚠ §1.3 — ACTIONS PARKED WITH THIS POLICY NOW ENTER THE KERNEL, and only now.
        const parked = await prisma.policyOption.findMany({
          where: { ideaId: id, parkedWithId: row.id, moveStatus: 'ACCEPTED', movedToActionId: null },
        })
        for (const p of parked) {
          const action = await prisma.lexCoherentAction.create({
            data: { ideaId: id, practicalStep: p.approach, source: 'LEX' },
          })
          await prisma.policyOption.update({
            where: { id: p.id }, data: { movedToActionId: action.id },
          })
        }
        // ══ 26-M — THE STEP IS ATTACHED TO THE EVENT, NOT TO A BUTTON ═══════════════════════════
        // Held coherent-action ideas (from the drafts and from the user's comments) and the actions
        // parked with the policy this replaces are tested against this one and written to the Coherent
        // Actions candidate list. HERE, because this is where a guiding policy becomes the settled one,
        // whichever screen or route got it here. It never throws and never blocks the settle.
        const { onChosenApproachSettled } = await import('./action-ideas')
        actionIdeas = await onChosenApproachSettled(id, row.id, userId ?? null)
      }
      break

    // ══ 26-L addendum 2 §6 — UN-CHOOSE, SO A CHOSEN POLICY CAN BE CHANGED ══════════════════
    //
    // ⚠ ACTS ON WHICHEVER ROW IS CHOSEN, NOT ON `policyId` — there is at most one, and the
    // control that calls this (the "Settled" banner) has no single card to name; it is
    // un-choosing the KERNEL's decision, not one candidate's.
    case 'unchoose': {
      const chosen = await prisma.policyOption.findFirst({ where: { ideaId: id, status: 'CHOSEN' } })
      if (chosen) {
        await prisma.$transaction([
          prisma.policyOption.update({ where: { id: chosen.id }, data: { status: 'CANDIDATE' } }),
          prisma.idea.update({ where: { id }, data: { chosenApproach: null } }),
        ])
      }
      break
    }

    // ══ 26-L addendum 2 §5 — FEEDBACK, SAVED ON ITS OWN ═══════════════════════════════════
    // The filing already happened above, unconditionally, for every op that carries a
    // `reason` — this case exists only so the op is a real, named thing rather than an
    // undocumented no-op a future reader has to work out from the switch having no `default`.
    case 'fileFeedback':
      break

    case 'phase':
      if (row) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: { phase: phase ?? 'LATER', phaseReason: reason || null },
        })
      }
      break

    case 'reject':
      if (row) await rejectPolicyOption(id, row.id, reason || '')
      break

    case 'restore':
      // ⚠⚠ §1.10 — THE ORIGINAL NUMBER COMES BACK WITH IT, because it never left: nothing
      // renumbers and the row keeps `number` throughout. `ruleOutReason` is RETAINED as
      // history, so "we rejected this once, for this reason, and changed our minds" survives.
      if (row) {
        // ══════ ⚠⚠ 25-T §2c — A MERGE SUPERSESSION HAS TO BE UNDONE ON BOTH COLUMNS ══════
        //
        // §2c: parents *"can be restored"*. Setting `status: 'CANDIDATE'` alone did not restore
        // one: `live` filters on `!p.superseded` as well, so the row came back to CANDIDATE and
        // still appeared nowhere — a restore that reported success and changed nothing visible.
        // Clearing `mergedIntoId` is what actually returns it to the list.
        //
        // ⚠ AND THE REASON IS CLEARED HERE AND ONLY HERE. §1.10's retention rule is right for a
        // rejection — the history of a judgement the user reversed is worth keeping. It is wrong
        // for this: "Merged into 9" is not history once the row is no longer merged into 9, it
        // is a false statement, and `historyLine()` would print it on a live policy. So the
        // clear is conditional on the row actually having been superseded, and a genuine
        // rejection still keeps its reason exactly as 25-P intended.
        const wasMerged = !!row.mergedIntoId
        await prisma.policyOption.update({
          where: { id: row.id },
          data: {
            status: 'CANDIDATE',
            ...(wasMerged ? { mergedIntoId: null, ruleOutReason: null } : {}),
          },
        })
      }
      break

    // ══════════ 25-S §1.3 — EVERY MOVE LEX MADE CAN BE UNDONE ══════════════════
    //
    // §1.3: *"25-P found the causal link was set on zero of eighteen rows, so the sort is Lex's
    // judgement, not a fact read off the chain. A judgement the user cannot overturn is an
    // imposition."*
    //
    // ⚠⚠ ONE OP FOR BOTH DIRECTIONS THE SORT CAN MOVE A CARD — demoted to a coherent action, or
    // set aside as a restatement of the goal. Two ops would be two things to keep in step, and
    // the user is doing one thing: putting it back.
    //
    // ⚠ THE NUMBER COMES BACK BECAUSE IT NEVER LEFT. 25-P §1.1's whole point: nothing renumbers,
    // so an item returning to the group returns as itself. There is no number to restore.
    //
    // ⚠ AND THE PARKING GOES WITH IT. An item demoted to an action may have been parked with the
    // policy it implements (§1.3 of 25-P); left behind, it would be a policy claiming to
    // implement another policy, which is not a state the screen can render.
    //
    // ⚠ `kindReason` RECORDS THE OVERRULE rather than being cleared. "Lex read this as an action
    // and you disagreed" is the history §1.2 wants on the card, and blanking it would leave a
    // card that had visibly moved with nothing saying why it moved back.
    case 'undoSort':
      if (row) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: {
            kind: 'GUIDING_POLICY',
            moveStatus: null,
            parkedWithId: null,
            kindReason: `You put this back as a guiding policy. Lex had read it as `
              + `${row.kind === 'COHERENT_ACTION' ? 'a coherent action' : 'the goal restated'}: `
              + `${row.kindReason ?? 'no reason recorded'}`,
          },
        })
      }
      break

    // ══ §1.9 — TWO ROUNDS, THEN LEX STOPS ASKING ═══════════════════════════════
    case 'countRound':
      await prisma.idea.update({
        where: { id }, data: { guidingPolicyRounds: { increment: 1 } },
      })
      break

    case 'proceedUnresolved':
      // ⚠ NOT A FAILURE STATE, AND THE REASON IS REQUIRED. "Unresolved, and here is what it
      // turns on" is a respectable thing for a proposal to say; "unresolved" alone tells a
      // reader there is a gap and nothing about it.
      await prisma.idea.update({
        where: { id },
        data: {
          guidingPolicyUnresolved: true,
          guidingPolicyUnresolvedWhy: reason || 'No reason was recorded for leaving this open.',
        },
      })
      break

    // ══ 26-I §1 — THE USER'S OWN CANDIDATE ══════════════════════════════════════
    //
    // §1a: their words, verbatim and attributed. §1b: enters the sort at the next stable
    // number, alongside Lex's. §1c: tested like the four consolidation drafts are (§4) —
    // the compound half of that test is mechanical, so it runs here, synchronously, and
    // the caller (the route) hands the verdict straight back rather than storing it: this
    // is the same one-off "Lex says so" a chat reply gives, not a persistent badge on the
    // card.
    case 'add': {
      const approach = (text || '').trim()
      if (!approach) break
      const all = await prisma.policyOption.findMany({ where: { ideaId: id }, select: { number: true } })
      const number = nextNumber(all)
      compoundTest = testIsCompound(approach)
      // ⚠⚠ 26-L §3c/§6a — THE FLAG SURVIVES A RELOAD, ON THE CARD, AND IT NEVER BLOCKS.
      // Before this it was returned once in the API response and shown as a banner near the
      // "Add" box — gone the moment the user did anything else, including reloading. `kindReason`
      // is unused for an unsorted row (historyLine only reads it once something has judged the
      // card — see policy-history.ts), so it is a safe, already-rendered home for the mechanical
      // flag until the real sort (or the judge, on a merge) gives its own verdict, with reasoning.
      const created = await prisma.policyOption.create({
        data: {
          ideaId: id, approach, number, kind: 'GUIDING_POLICY', source: 'USER',
          kindReason: compoundTest.isCompound
            ? `⚠ Flagged for review (mechanical check, not a verdict): ${compoundTest.why}` : null,
        },
      })
      addedNumber = created.number ?? number
      break
    }

    // ══ 26-I §2 — THE TWO NEW DISPOSITIONS ══════════════════════════════════════
    //
    // ⚠⚠ 26-L ADDENDUM, DECISION 103 ITEM 5 — THE MASKING BUG, FOUND LIVE. #5 carried
    // `disposition: SAYS_SAME_AS, duplicateOfNumber: 2` — the write succeeded — and still
    // read as LATER_PHASE, because `effectiveDisposition` checks `phase === 'LATER'` BEFORE
    // disposition, and #5 also carried a stale `phase: 'LATER'` from an earlier, unrelated
    // action. The disposition was never lost; it was masked by a fact that predated it and
    // that the user, in choosing a disposition, had implicitly superseded. Rather than
    // reorder `effectiveDisposition`'s priority (risking every existing assertion that
    // depends on it), an explicit disposition now clears `phase` — the two are exclusive
    // decisions about the same card, and the more recent, more deliberate one wins.
    case 'markPartOfSolution':
      if (row) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: { disposition: 'PART_OF_SOLUTION', duplicateOfNumber: null, phase: null },
        })
      }
      break

    case 'markSaysSameAs':
      // ⚠ REUSES 25-P's ALTERNATIVES RELATION AS THE OFFER, NOT A SECOND MECHANISM (§2)
      // — `pairPolicies` is what the screen shows the user as candidates to pick from; this
      // just persists which one they picked, as their own disposition, by stable number.
      if (row && duplicateOfNumber != null) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: { disposition: 'SAYS_SAME_AS', duplicateOfNumber, phase: null },
        })
      }
      break

    case 'clearDisposition':
      if (row) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: { disposition: 'UNDISPOSITIONED', duplicateOfNumber: null },
        })
      }
      break

    // ══ 26-I §2 — "REALLY AN ACTION", ASSERTED BY THE USER RATHER THAN OFFERED BY LEX ══
    //
    // Unlike `acceptMove` (consenting to Lex's own OFFER, `moveStatus: 'OFFERED'`), the
    // user is the one proposing this, so there is nothing further to consent to. Mirrors
    // `acceptMove`'s own "parent not yet settled → park it" rule: an action belongs to a
    // policy, not to the kernel in general (§1.3), so this is parked exactly the same way
    // when it names one, and only "moved" immediately when it doesn't.
    case 'assertAction': {
      if (!row) break
      const parent = row.parkedWithId
        ? await prisma.policyOption.findUnique({ where: { id: row.parkedWithId } })
        : null
      const parentSettled = parent ? parent.status === 'CHOSEN' : false
      if (parent && !parentSettled) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: {
            kind: 'COHERENT_ACTION', kindReason: 'Asserted by the user.',
            moveStatus: 'ACCEPTED', sortedAt: new Date(),
          },
        })
        break
      }
      const action = await prisma.lexCoherentAction.create({
        data: { ideaId: id, practicalStep: row.approach, source: 'USER' },
      })
      await prisma.policyOption.update({
        where: { id: row.id },
        data: {
          kind: 'COHERENT_ACTION', kindReason: 'Asserted by the user.',
          moveStatus: 'ACCEPTED', movedToActionId: action.id, sortedAt: new Date(),
        },
      })
      break
    }
  }

  await syncPolicyField(id)
  return { state: await readPolicyState(id), addedNumber, compoundTest, actionIdeas }
}

/**
 * ══ §1.7 — THE MERGE WRITE. THE JUDGEMENT IS THE ROUTE'S; THIS IS ONLY THE CONSEQUENCE. ══
 *
 * ⚠⚠ SEPARATED SO §1.12 CAN ASSERT A MERGE WITHOUT CALLING A MODEL. "A merge renders carrying
 * both parents' content" is a claim about what this function writes and `readPolicyState`
 * returns; putting a live model call inside that assertion would make the check slow, costly,
 * and — worse — occasionally red for a reason that has nothing to do with the code.
 *
 * ⚠ ONLY A `MERGE` VERDICT WRITES. The other three verdicts are ADVICE: they tell the user what
 * the relationship is and leave the act to them. Returns the new policy's number, or null.
 */
export async function writeMerge(input: {
  ideaId: string
  na: number
  nb: number
  answer: { verdict: string; reasoning?: string; chainLink?: string | null
            merged?: { approach: string; caseFor?: string | null; caseAgainst?: string | null } | null }
}): Promise<number | null> {
  const { ideaId: id, na, nb, answer } = input
  if (answer.verdict !== 'MERGE' || !answer.merged) return null

  const rows = await prisma.policyOption.findMany({ where: { ideaId: id, number: { in: [na, nb] } } })
  const A = rows.find((r) => r.number === na)
  const B = rows.find((r) => r.number === nb)
  if (!A || !B) return null

  const all = await prisma.policyOption.findMany({ where: { ideaId: id }, select: { number: true } })
  const createdNumber = nextNumber(all)
  const created = await prisma.policyOption.create({
    data: {
      ideaId: id,
      approach: answer.merged.approach,
      caseFor: answer.merged.caseFor || null,
      caseAgainst: answer.merged.caseAgainst || null,
      number: createdNumber,
      kind: 'GUIDING_POLICY',
      kindReason: `Merged from ${na} and ${nb}. ${answer.reasoning ?? ''}`.trim(),
      sortedAt: new Date(),
      mergedFrom: [na, nb],
      chainLink: answer.chainLink || null,
      // The merged policy inherits both parents' causes — it is the whole chain now.
      targetCauseIds: [...new Set([...(A.targetCauseIds ?? []), ...(B.targetCauseIds ?? [])])],
      source: 'LEX',
    },
  })
  // ══════════ ⚠ THE PARENTS ARE SUPERSEDED, NOT DELETED ══════════════════════════════════
  // The user must be able to see what a merged policy was made of, and their numbers must stay
  // taken.
  //
  // ⚠⚠ AND UNTIL 25-T §2c THEY WERE SUPERSEDED INTO NOTHING — INVISIBLE ON EVERY LIST.
  // `mergedIntoId` alone put them in no list at all: `live` excludes them for being superseded
  // (`!p.superseded`), and the ruled-out block filters on `status === 'RULED_OUT'`, which this
  // write never set — so they stayed CANDIDATE and rendered nowhere. Meanwhile the screen told
  // the user, in so many words, *"Both originals keep their numbers and are shown below as
  // superseded."* Nothing below showed them. A sentence on the page asserting a thing the page
  // does not do is the exact defect class §3 was written for, and it shipped in 25-P.
  //
  // ⚠ SO THE STATUS IS SET TOO, and the reason names the number it went into — §2c's *"appear
  // in the rejected list with the reason 'merged into 9'"*, literally. This needs no new list
  // and no new filter: the ruled-out block, its reason line and its Restore button all already
  // exist and now simply find these rows.
  await prisma.policyOption.updateMany({
    where: { id: { in: [A.id, B.id] } },
    data: {
      mergedIntoId: created.id,
      status: 'RULED_OUT',
      ruleOutReason: `Merged into ${createdNumber}.`,
    },
  })
  await syncPolicyField(id)
  return createdNumber
}

/**
 * ══ 26-L §2 — THE ENHANCE WRITE. "ONE CONTAINS THE OTHER", ACCEPTED. ══════════════════════
 *
 * ⚠⚠ WHAT THIS REPLACES: NOTHING. §2c measured it directly against Charlie's own idea — the
 * verdict rendered as advice ("Not a merge — one contains the other.") and no write of any kind
 * followed it, ever. #3 and #6 stayed live, near-identical, indefinitely.
 *
 * ⚠ UNLIKE `writeMerge`, NO NEW ROW. The containing policy keeps its own id and number — it is
 * not superseded, it is edited — so a card the user has already discussed, feedback'd or rated
 * does not vanish behind a new number the moment it absorbs a duplicate. The subordinate is
 * archived exactly as a merge parent is: `mergedIntoId` set (so `superseded` excludes it from
 * `live`) and `status: RULED_OUT` with a reason naming what it went into — the SAME dual write
 * `writeMerge` already uses, pointed at an existing row instead of a freshly created one.
 *
 * ⚠ THE CONTAINING ROW'S PRIOR WORDING IS KEPT AS A `FieldRevision`, in the same transaction as
 * the edit — §2b's *"its originals beneath it, both clickable"*: the containing card renders
 * `PriorVersions` (its own history) and the subordinate renders in "Ruled out" (its own
 * wording, restorable) — one mechanism each, both already built for other reasons.
 */
export async function writeEnhance(input: {
  ideaId: string
  userId: string
  containingNumber: number
  subordinateNumber: number
  merged: { approach: string; caseFor?: string | null; caseAgainst?: string | null }
  reasoning?: string
}): Promise<boolean> {
  const { ideaId: id, userId, containingNumber, subordinateNumber, merged, reasoning } = input
  const rows = await prisma.policyOption.findMany({
    where: { ideaId: id, number: { in: [containingNumber, subordinateNumber] } },
  })
  const keep = rows.find((r) => r.number === containingNumber)
  const drop = rows.find((r) => r.number === subordinateNumber)
  if (!keep || !drop) return false

  const approach = merged.approach.trim()
  const writes = []
  // ⚠ NO-OP TEXT IS NOT AN ERROR. The judge is explicitly allowed to say the containing policy
  // already covers everything (26-L §2 prompt change) — only write a revision where the text
  // actually changes.
  if (approach && approach !== keep.approach) {
    writes.push(
      prisma.fieldRevision.create({
        data: {
          ideaId: id, fieldKey: 'policyOptions', targetId: keep.id, targetNumber: keep.number,
          previousText: keep.approach, previousSource: keep.source,
          newText: approach, acceptedById: userId, origin: 'GUIDING_POLICY_ENHANCE',
        },
      }),
      prisma.policyOption.update({
        where: { id: keep.id },
        data: {
          approach,
          caseFor: merged.caseFor || keep.caseFor,
          caseAgainst: merged.caseAgainst || keep.caseAgainst,
          mergedFrom: [...new Set([...keep.mergedFrom, subordinateNumber])],
        },
      }),
    )
  } else {
    writes.push(
      prisma.policyOption.update({
        where: { id: keep.id },
        data: { mergedFrom: [...new Set([...keep.mergedFrom, subordinateNumber])] },
      }),
    )
  }
  writes.push(
    prisma.policyOption.update({
      where: { id: drop.id },
      data: {
        mergedIntoId: keep.id,
        status: 'RULED_OUT',
        ruleOutReason: `Archived — absorbed into ${containingNumber}.${reasoning ? ` ${reasoning}` : ''}`,
      },
    }),
  )
  await prisma.$transaction(writes)
  await syncPolicyField(id)
  return true
}

/**
 * ══ §1.2/§1.4/§1.5/§1.6 — THE SORT WRITE. THE JUDGEMENT IS THE ROUTE'S. ══════════════
 *
 * ⚠ EXTRACTED FOR §1.12'S SAKE, LIKE `writeMerge`. "A moved action renders in coherent actions
 * and no longer in the policy list" is a BEFORE-AND-AFTER claim: the item has to have been in
 * the list first. Only the sort puts it there and takes it out again, so a check that could not
 * run the sort's write would have to start from an item already classified as an action — and
 * would then be asserting the second half of the sentence against a list it was never in.
 *
 * Returns how many rows it wrote.
 */
export async function writeSort(input: {
  ideaId: string
  state: PolicyState
  sorted: Array<{
    number: number
    kind: string
    kindReason?: string
    implementsPolicyNumber?: number | null
    targetCauseNumbers?: number[]
    importance?: unknown
    addressability?: unknown
    impliedCause?: Record<string, unknown> | null
    /** 26-L §9 — the model's own near-duplicate reading, discarded until now. */
    duplicateOfNumbers?: number[]
  }>
}): Promise<number> {
  const { ideaId: id, state, sorted } = input
  const byNumber = new Map(state.policies.map((p) => [p.number, p]))
  const causeIdOf = new Map(state.causes.map((c) => [c.number, c.id]))
  let written = 0
  for (const s of sorted) {
    const row = byNumber.get(s.number)
    if (!row) continue
    // ⚠ 26-M addendum — AN ACTION ALREADY MOVED INTO COHERENT ACTIONS IS NOT RE-SORTED. Re-sorting wrote
    // `moveStatus: 'OFFERED'` and a fresh `parkedWithId` over it, which would offer a second copy of an
    // action that is already in the list (and, for the ones the consolidation wrote, un-protect it).
    if (row.moveStatus === 'ACCEPTED' && row.movedToActionId) continue
    const implementsRow = s.implementsPolicyNumber != null
      ? byNumber.get(s.implementsPolicyNumber) : null
    await prisma.policyOption.update({
      where: { id: row.id },
      data: {
        kind: s.kind,
        kindReason: s.kindReason,
        sortedAt: new Date(),
        // ⚠⚠ THE LINK NOTHING HAS EVER WRITTEN. Measured: `targetCauseIds` was set on ZERO of
        // 18 rows. §1.5 assumes it can be read off the chain; it cannot, so the sort assigns
        // it — and the screen labels it as Lex's judgement, not as a structural fact.
        targetCauseIds: (s.targetCauseNumbers ?? [])
          .map((n) => causeIdOf.get(n)).filter((x): x is string => !!x),
        // 26-L §9 — persisted rather than discarded. Kept as the numbers the model gave, not
        // filtered to "still live" here — `readPolicyState` filters at read time, so a later
        // rejection removes a pair from view without the sort having to re-run.
        duplicateOfNumbers: (s.duplicateOfNumbers ?? []).filter((n) => n !== s.number),
        importance: (s.importance ?? null) as never,
        addressability: (s.addressability ?? null) as never,
        impliedCause: (s.impliedCause
          ? { ...s.impliedCause, status: 'OFFERED', addedCauseId: null }
          : null) as never,
        // ⚠ §1.3 — AN ACTION IS ONLY *OFFERED* FOR MOVING. Nothing moves without consent, so
        // this sets the offer and never the move.
        ...(s.kind === 'COHERENT_ACTION'
          ? { moveStatus: 'OFFERED', parkedWithId: implementsRow?.id ?? null }
          : { moveStatus: null, parkedWithId: null }),
      },
    })
    written++
  }
  await syncPolicyField(id)
  return written
}
