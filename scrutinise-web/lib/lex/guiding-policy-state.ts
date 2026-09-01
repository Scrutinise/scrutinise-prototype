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
import { pairPolicies, nextNumber, type Pairing } from '@/lib/lex/guiding-policy'

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

export const POLICY_OPS: PolicyOp[] = [
  'acceptMove', 'declineMove', 'acceptCause', 'declineCause',
  'settle', 'phase', 'reject', 'restore', 'proceedUnresolved', 'countRound',
  'undoSort', 'acceptMerge',
]

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

  const [idea, rows, causes, actions] = await Promise.all([
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
  const pairings: Pairing[] = pairPolicies(
    live.map((r) => ({
      number: r.number ?? 0,
      causeNumbers: r.targetCauseIds.map((cid) => causeNumber.get(cid)).filter((n): n is number => !!n),
    })),
    drivenBy,
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
    })),
    pairings,
    actions: actions.map((a) => ({ id: a.id, step: a.practicalStep })),
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
}): Promise<{ state: PolicyState } | { notOnThisIdea: true }> {
  const { ideaId: id, op, policyId, reason, phase, merge } = input

  const row = policyId
    ? await prisma.policyOption.findFirst({ where: { id: policyId, ideaId: id } })
    : null
  if (policyId && !row) return { notOnThisIdea: true }

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
      }
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
      if (row) {
        await prisma.policyOption.update({
          where: { id: row.id },
          data: { status: 'RULED_OUT', ruleOutReason: reason || 'No reason recorded.' },
        })
        // ⚠ §1.3 — AN ACTION PARKED WITH A REJECTED POLICY GOES WITH IT. That is the whole
        // point of parking: it must not turn up in the kernel implementing something thrown away.
        await prisma.policyOption.updateMany({
          where: { ideaId: id, parkedWithId: row.id, movedToActionId: null },
          data: {
            status: 'RULED_OUT',
            ruleOutReason: `The policy it implements (${row.number}) was rejected: ${reason || 'no reason recorded'}`,
          },
        })
      }
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
  }

  await syncPolicyField(id)
  return { state: await readPolicyState(id) }
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
  }>
}): Promise<number> {
  const { ideaId: id, state, sorted } = input
  const byNumber = new Map(state.policies.map((p) => [p.number, p]))
  const causeIdOf = new Map(state.causes.map((c) => [c.number, c.id]))
  let written = 0
  for (const s of sorted) {
    const row = byNumber.get(s.number)
    if (!row) continue
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
