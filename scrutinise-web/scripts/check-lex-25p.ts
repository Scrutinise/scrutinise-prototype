// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25p — 25-P §1.12, AGAINST THE LIVE DATABASE AND THE REAL RENDERERS.
//
// §1.12: *"checks that assert rendered data, not source strings: a merge renders carrying both
// parents' content; a moved action renders in coherent actions and no longer in the policy list;
// a declined cause renders as a recorded weakness; a restored policy renders with its original
// number; controls that stay false on each."*
//
// ⚠⚠ WHY THIS IS A DB CHECK AND NOT A GREP. 25-N's checks asserted that `ReportAdditions`
// filtered on `e.priority` and that the button said "Add to report" — both true, both passing,
// for a feature that wrote a row and rendered nothing. A source assertion cannot see a join that
// misses. Every assertion below performs the operation through the code the route runs and then
// reads what the screen and the documents would show.
//
// ⚠⚠ AND IT RUNS THE ROUTE'S OWN FUNCTIONS, NEVER A COPY OF THEM. `applyPolicyOp`, `writeSort`
// and `writeMerge` are the same functions `route.ts` calls. A check that re-implemented them
// would assert that two pieces of code agree — which they do right up to the moment one is
// fixed. This repository has been bitten by exactly that (a re-implemented `admits()` published
// UNREACHABLE=4 when the truth was 0).
//
// ⚠⚠ THE FIXTURE IS A SCRATCH IDEA IT CREATES AND DELETES. `check:central` runs against
// production Neon and a fixture once reused one of Charlie's real rows and passed on a
// zero-point award. This one owns everything it touches: a fresh idea, marked, deleted in a
// `finally`, with any leftovers from an interrupted run swept first and REPORTED.
//
// Usage: npm run check:lex-25p     (tsx --env-file=.env scripts/check-lex-25p.ts)
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import {
  readPolicyState, applyPolicyOp, writeMerge, writeSort, syncPolicyField, POLICY_OPS,
  type PolicyState,
} from '../lib/lex/guiding-policy-state'
import { nextNumber, pairPolicies } from '../lib/lex/guiding-policy'
import {
  readCorpusDate, dateFromUrl, evidenceStanding, figuresIn, weighedAgainstLine,
  sourceDateFields, EVIDENCE_STALE_YEARS,
} from '../lib/lex/evidence-date'
import { balanceSentence } from '../lib/lex/allowance'
import { passesAddedSince, freshPassLog } from '../lib/lex/build-carry'
import { buildQuestionPanel } from '../lib/lex/question-panel'
import { buildProposalSnapshot, type ProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument, buildSummaryDocument } from '../lib/documents/build-proposal'
import type { Block, DocumentModel } from '../lib/documents/model'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/**
 * ⚠⚠ THE LAMBDA RETURNS WHETHER THE PROPERTY HOLDS, AND THE CONTROL FIRES WHEN IT DOES NOT.
 * Three of 25-N's controls were written the other way round — returning "does the broken text
 * still match" — and silently reported themselves as firing while proving nothing.
 */
const controls: Array<{ label: string; fired: boolean }> = []
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  let held: boolean
  try { held = propertyHoldsOnBrokenInput() } catch { held = false }
  controls.push({ label, fired: !held })
}

/** The file with its comments stripped — an absence assertion must not read a ⚠ note. */
function code(rel: string): string {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) return ''
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * ⚠ WHAT THE DOCUMENT SAYS, NOT HOW IT IS BUILT. §1.12 asks for rendered data, and a block list
 * is still structure; flattening to the text a reader sees is what makes "the chain-link
 * survives into both documents" a claim about the documents.
 */
function documentText(m: DocumentModel): string {
  const one = (b: Block): string => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return b.runs.map((r) => r.text).join('')
      case 'bullets': return b.items.map((i) => i.map((r) => r.text).join('')).join('\n')
      case 'note': return b.text
      case 'section': return b.title
      case 'sources': return [b.label, ...b.refs.map((r) => `${r.title} ${r.citation}`)].join('\n')
      default: return ''
    }
  }
  return m.blocks.map(one).join('\n')
}

const byNumber = (s: PolicyState, n: number) => s.policies.find((p) => p.number === n)
/** The panel's own rendered list — the projection `syncPolicyField` writes, read back. */
async function renderedPolicyList(ideaId: string): Promise<string> {
  const row = await prisma.ideaFieldState.findUnique({
    where: { ideaId_fieldKey: { ideaId, fieldKey: 'policyOptions' } },
    select: { proposal: true, value: true },
  })
  const prop = row?.proposal as { value?: unknown } | null
  return String(prop?.value ?? row?.value ?? '')
}

const MARK = '25P-CHECK'
const CHAIN_1 = 'Without the register the levy is unenforceable, so a levy passed alone raises nothing.'
const CHAIN_MERGED = 'The disclosure duty is what makes the cap checkable; a cap enacted without it is unpoliced.'
const CHAIN_5 = 'The appeal route is the only thing that makes the refusal power reviewable; take it out and the power is unaccountable.'
const IMPLIED_CAUSE = 'Regulators have no standing to see the contracts they are asked to police.'
const DECLINE_REASON = 'The diagnosis does not claim this, and we are not adding it.'

async function main() {
  console.log('\n── check:lex-25p — §1.12, rendered data ──\n')

  // ══ 0. THE FIXTURE, AND ANY WRECKAGE FROM AN INTERRUPTED RUN ═══════════════
  const swept = await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
  if (swept.count) console.log(`  · swept ${swept.count} leftover scratch idea(s) from an earlier run\n`)

  const owner = await prisma.user.findFirst({
    where: { email: 'charles@scalablefinance.com' }, select: { id: true },
  }) ?? await prisma.user.findFirst({ select: { id: true } })
  if (!owner) { console.log('No user to own the fixture.'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: `${MARK} ${randomUUID().slice(0, 8)} — scratch fixture, deleted by the check`,
      summaryDescription: 'Created and destroyed by check:lex-25p. Not a real proposal.',
      govtArea: 'Check fixture',
    },
    select: { id: true, createdAt: true },
  })
  // ⚠ IT IS FRESH, AND THE CHECK SAYS SO. A fixture that silently reused a live row is how
  // `check:central` once passed on one of Charlie's own records.
  ok('the fixture is a new row, not a reused one',
    Date.now() - idea.createdAt.getTime() < 60_000, idea.id.slice(0, 8))

  const ideaId = idea.id
  try {
    // Two causes, the second driven by the first — §1.5's chain, in miniature.
    const c1 = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'Nobody is obliged to disclose the terms.', isRootCause: true },
    })
    const c2 = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'So the cap cannot be checked.', parentCauseId: c1.id },
    })

    // Six candidates, created a second apart so `ensureNumbered`'s createdAt order is decided
    // rather than a tie. ⚠ Numbers are left NULL: §1.1's numbering is one of the things under test.
    const t0 = Date.now() - 60_000
    const approaches = [
      'Require every intermediary to publish its terms in a public register.',
      'Cap the fee an intermediary may charge.',
      'Publish the register quarterly in machine-readable form.',
      'Give the regulator standing to demand contracts.',
      'Create a refusal power with a statutory appeal route.',
      'Fund the regulator through a levy on intermediaries.',
    ]
    for (let i = 0; i < approaches.length; i++) {
      await prisma.policyOption.create({
        data: {
          ideaId, approach: approaches[i], source: 'LEX',
          createdAt: new Date(t0 + i * 1000),
          caseFor: `Case for ${i + 1}.`,
          targetCauseIds: i === 0 ? [c1.id] : i === 1 ? [c2.id] : [],
          chainLink: i === 0 ? CHAIN_1 : i === 4 ? CHAIN_5 : null,
        },
      })
    }

    // ══ §1.1 — THE STABLE NUMBER ═════════════════════════════════════════════
    console.log('§1.1 — the numbers')
    let state = await readPolicyState(ideaId)
    const numbers = state.policies.map((p) => p.number)
    ok('every candidate is numbered on first read', numbers.every((n) => n != null),
      `[${numbers.join(', ')}]`)
    ok('numbered 1..6 in the order they were created',
      JSON.stringify(numbers) === JSON.stringify([1, 2, 3, 4, 5, 6]))
    ok('the next number is max+1, so a gap is never reused',
      nextNumber([{ number: 1 }, { number: 4 }, { number: null }]) === 5)
    control('a gap must not be handed out again',
      () => nextNumber([{ number: 1 }, { number: 4 }]) === 2)

    // ⚠ THE PROJECTION IS WRITTEN BY OPERATIONS, NOT BY READS — so the "before" list has to be
    // rendered before anything is asked of it. Skipping this made three assertions and their
    // three controls compare against an empty string, which is exactly the shape of a check that
    // cannot fail: everything "is not in" a list that does not exist yet.
    await syncPolicyField(ideaId)
    const listBefore = await renderedPolicyList(ideaId)
    ok('the panel list renders all six, carrying their numbers',
      [1, 2, 3, 4, 5, 6].every((n) => listBefore.includes(`[${n}]`)),
      `${listBefore.split('\n').length} lines`)

    // ══ §1.2/§1.4 — THE SORT ═════════════════════════════════════════════════
    console.log('\n§1.2/§1.4 — the sort reclassifies, and offers a cause')
    const written = await writeSort({
      ideaId, state,
      sorted: [
        { number: 3, kind: 'COHERENT_ACTION', implementsPolicyNumber: 5,
          kindReason: 'A publication schedule is a step, not a policy.' },
        { number: 4, kind: 'GUIDING_POLICY', kindReason: 'A choice about who may see what.',
          targetCauseNumbers: [1],
          impliedCause: { cause: IMPLIED_CAUSE, why: 'The policy answers it and the diagnosis does not state it.' } },
        { number: 1, kind: 'GUIDING_POLICY', kindReason: 'A choice.', targetCauseNumbers: [1] },
        { number: 2, kind: 'GUIDING_POLICY', kindReason: 'A choice.', targetCauseNumbers: [2] },
      ],
    })
    ok('the sort wrote every row it was given', written === 4, `${written} of 4`)
    state = await readPolicyState(ideaId)
    ok('3 is now offered as an action, parked with the policy it implements',
      byNumber(state, 3)?.kind === 'COHERENT_ACTION'
        && byNumber(state, 3)?.moveStatus === 'OFFERED'
        && byNumber(state, 3)?.parkedWithId === byNumber(state, 5)?.id)
    ok('and it has left the rendered policy list already, because it is not a policy',
      !(await renderedPolicyList(ideaId)).includes('[3]'))
    control('an item still rendering in the policy list would fail this',
      () => !listBefore.includes('[3]'))

    // ══ §1.12a — A MERGE RENDERS CARRYING BOTH PARENTS' CONTENT ══════════════
    console.log('\n§1.12a — the merge')
    const MERGED = 'Require publication of terms in a register, and cap the fee against what the register shows.'
    const createdNumber = await writeMerge({
      ideaId, na: 1, nb: 2,
      answer: {
        verdict: 'MERGE', reasoning: 'One is unenforceable without the other.',
        chainLink: CHAIN_MERGED,
        merged: { approach: MERGED, caseFor: 'The cap becomes checkable.', caseAgainst: 'Two duties at once.' },
      },
    })
    ok('the merged policy takes the next free number', createdNumber === 7, `${createdNumber}`)
    state = await readPolicyState(ideaId)
    const merged = byNumber(state, 7)
    ok('it renders with the merged approach', merged?.approach === MERGED)
    ok('it renders naming both parents', JSON.stringify(merged?.mergedFrom) === JSON.stringify([1, 2]),
      `mergedFrom [${merged?.mergedFrom.join(', ')}]`)
    // ⚠⚠ THE CONTENT-CARRYING ASSERTION THAT MATTERS. A merged policy that inherited only one
    // parent's causes is a policy that has quietly dropped half of what it was made of, and the
    // approach text would still look right.
    ok("it renders carrying BOTH parents' causes",
      [1, 2].every((n) => (merged?.causeNumbers ?? []).includes(n)),
      `causes [${(merged?.causeNumbers ?? []).join(', ')}]`)
    control("a merge that inherited one parent's causes must fail",
      () => [1, 2].every((n) => [1].includes(n)))
    ok('both parents render as superseded, not deleted',
      !!byNumber(state, 1)?.superseded && !!byNumber(state, 2)?.superseded)
    const listAfterMerge = await renderedPolicyList(ideaId)
    ok('the rendered list offers the merged policy and neither parent',
      listAfterMerge.includes('[7]') && !listAfterMerge.includes('[1]') && !listAfterMerge.includes('[2]'))
    control('a list still offering a superseded parent must fail',
      () => !listBefore.includes('[1]'))

    // ══ §1.12b — A MOVED ACTION ══════════════════════════════════════════════
    console.log('\n§1.12b — the moved action')
    let r = await applyPolicyOp({ ideaId, op: 'acceptMove', policyId: byNumber(state, 3)!.id })
    if ('notOnThisIdea' in r) throw new Error('acceptMove could not find the row')
    // ⚠ §1.3's second half: the policy it implements is not settled, so it waits WITH it.
    // ⚠ CAPTURED, NOT RE-READ INSIDE THE CONTROL. `r` is reassigned below, so a control that
    // closed over it would run against a later state than the one it claims to be about — a
    // control quietly measuring the wrong thing is worse than no control.
    const parkedState = r.state
    ok('accepted while its policy is unsettled, it is parked and has NOT entered the kernel',
      byNumber(parkedState, 3)?.moveStatus === 'ACCEPTED'
        && byNumber(parkedState, 3)?.movedToActionId === null
        && !parkedState.actions.some((a) => a.step === approaches[2]))
    control('an action in the kernel before its policy was settled must fail',
      () => !parkedState.actions.some((a) => a.step === approaches[2]) === false)

    r = await applyPolicyOp({ ideaId, op: 'settle', policyId: byNumber(state, 5)!.id })
    if ('notOnThisIdea' in r) throw new Error('settle could not find the row')
    ok('once its policy is settled the action renders in coherent actions',
      r.state.actions.some((a) => a.step === approaches[2]),
      `${r.state.actions.length} action(s)`)
    ok('and it now carries the id of the action it became',
      !!byNumber(r.state, 3)?.movedToActionId)
    const listAfterMove = await renderedPolicyList(ideaId)
    ok('and it renders in the policy list no longer',
      !listAfterMove.includes('[3]') && listBefore.includes('[3]'))
    control('an item that was never in the policy list proves nothing here',
      () => listBefore.includes('[3]') === false)
    ok('settling records the approach on the idea',
      (r.state.settled ?? '') === approaches[4])

    // ══ §1.12c — A DECLINED CAUSE RENDERS AS A RECORDED WEAKNESS ═════════════
    console.log('\n§1.12c — the declined cause')
    const offered = byNumber(r.state, 4)?.impliedCause as Record<string, unknown> | null
    ok('the sort offered a cause the diagnosis does not hold',
      offered?.status === 'OFFERED' && offered?.cause === IMPLIED_CAUSE)
    r = await applyPolicyOp({
      ideaId, op: 'declineCause', policyId: byNumber(r.state, 4)!.id, reason: DECLINE_REASON,
    })
    if ('notOnThisIdea' in r) throw new Error('declineCause could not find the row')
    const declined = byNumber(r.state, 4)?.impliedCause as Record<string, unknown> | null
    ok('a decline renders as DECLINED, with the reason, against the policy',
      declined?.status === 'DECLINED' && declined?.declinedReason === DECLINE_REASON)
    // ⚠⚠ THE HALF THAT WOULD GO UNNOTICED. §1.4 is explicit that a decline is a real weakness
    // the adversarial read must be able to see — which it cannot if declining wiped the claim.
    ok('and the cause itself survives the decline, so the weakness is still readable',
      declined?.cause === IMPLIED_CAUSE)
    control('a decline that forgot what was claimed must fail',
      () => ({ status: 'DECLINED' } as Record<string, unknown>).cause === IMPLIED_CAUSE)
    ok('no cause was added to the diagnosis by a decline',
      (await prisma.diagnosisCause.count({ where: { ideaId } })) === 2)

    // ══ §1.4 — AND ACCEPTING ONE MARKS THE CAUSES SECTION CHANGED ═══════════
    //
    // ⚠⚠ TWO THINGS, NOT ONE. §6's criterion is "accepting adds it AND marks the causes section
    // changed". Creating the row is the easy half; the half that would go unbuilt is the field
    // that still claims the user agreed to a diagnosis which has since grown a cause.
    const causesBefore = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'causes' } },
      select: { status: true },
    })
    await prisma.ideaFieldState.upsert({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'causes' } },
      create: { ideaId, fieldKey: 'causes', status: 'ACCEPTED' },
      update: { status: 'ACCEPTED' },
    })
    // A second policy with an implied cause, offered the way the sort offers one.
    const fifth = byNumber(r.state, 5)!.id
    await prisma.policyOption.update({
      where: { id: fifth },
      data: { impliedCause: { cause: 'Appeals are heard by the body that refused.', why: 'x', status: 'OFFERED' } as never },
    })
    r = await applyPolicyOp({ ideaId, op: 'acceptCause', policyId: fifth })
    if ('notOnThisIdea' in r) throw new Error('acceptCause could not find the row')

    ok('accepting adds the cause to the diagnosis, marked as the user\'s',
      // ⚠ BY THE CAUSE'S OWN TEXT, not by a count of USER rows — `source` DEFAULTS to USER on
      // DiagnosisCause, so the fixture's own two causes are USER too and a count would have
      // passed on rows this operation never touched.
      (await prisma.diagnosisCause.count({
        where: { ideaId, source: 'USER', cause: 'Appeals are heard by the body that refused.' },
      })) === 1)
    const causesAfter = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'causes' } },
      select: { status: true, proposal: true },
    })
    ok('and the causes section is marked changed rather than left claiming agreement',
      causesAfter?.status === 'AWAITING_CONFIRMATION', `${causesBefore?.status ?? 'none'} → ${causesAfter?.status}`)
    const proposed = String((causesAfter?.proposal as { value?: unknown } | null)?.value ?? '')
    ok('the re-proposed list carries the new cause AND the ones already there',
      proposed.includes('Appeals are heard by the body that refused.')
        && proposed.includes('Nobody is obliged to disclose the terms.'),
      `${proposed.split('\n').length} lines`)
    // ⚠ A LIST THINNER THAN THE ROWS IS THE FAILURE THIS GUARDS. Re-proposing only the addition
    // would silently drop the diagnosis the user already agreed to.
    control('a re-proposal that dropped the existing causes must fail',
      () => '1. (contributory) Appeals are heard by the body that refused.'
        .includes('Nobody is obliged to disclose the terms.'))

    // ══ §1.12d — A RESTORED POLICY RENDERS WITH ITS ORIGINAL NUMBER ══════════
    console.log('\n§1.12d — reject, then restore')
    const sixId = byNumber(r.state, 6)!.id
    r = await applyPolicyOp({ ideaId, op: 'reject', policyId: sixId, reason: 'Too narrow to matter.' })
    if ('notOnThisIdea' in r) throw new Error('reject could not find the row')
    ok('a rejected policy leaves the rendered list',
      !(await renderedPolicyList(ideaId)).includes('[6]'))
    ok('but keeps its row, its number and its reason',
      byNumber(r.state, 6)?.status === 'RULED_OUT'
        && byNumber(r.state, 6)?.ruleOutReason === 'Too narrow to matter.')

    r = await applyPolicyOp({ ideaId, op: 'restore', policyId: sixId })
    if ('notOnThisIdea' in r) throw new Error('restore could not find the row')
    const restored = byNumber(r.state, 6)
    ok('a restored policy renders with its ORIGINAL number, not a new one',
      restored?.number === 6 && restored?.id === sixId)
    ok('and it is back in the rendered list under that number',
      (await renderedPolicyList(ideaId)).includes('[6]'))
    // §1.10 — "we rejected this once, for this reason, and changed our minds" has to survive.
    ok('and the reason it was once rejected is retained as history',
      restored?.ruleOutReason === 'Too narrow to matter.')
    control('a restore that renumbered the policy must fail',
      () => nextNumber([{ number: 6 }, { number: 7 }]) === 6)
    const erased: { ruleOutReason: string | null } = { ruleOutReason: null }
    control('a restore that erased the old reason must fail',
      () => erased.ruleOutReason === 'Too narrow to matter.')

    // ══ §1.9/§1.10 — WHAT THE USER LEAVES WITH ═══════════════════════════════
    console.log('\n§1.9/§1.10 — rounds, and leaving it open')
    let rounds = await applyPolicyOp({ ideaId, op: 'countRound' })
    rounds = await applyPolicyOp({ ideaId, op: 'countRound' })
    if ('notOnThisIdea' in rounds) throw new Error('countRound failed')
    ok('after two rounds Lex offers to proceed unresolved',
      rounds.state.offerUnresolved && rounds.state.rounds === 2)
    const unres = await applyPolicyOp({
      ideaId, op: 'proceedUnresolved', reason: 'It turns on a cost figure we do not have yet.',
    })
    if ('notOnThisIdea' in unres) throw new Error('proceedUnresolved failed')
    ok('proceeding unresolved records WHY, not just that it is open',
      unres.state.unresolved
        && unres.state.unresolvedWhy === 'It turns on a cost figure we do not have yet.')
    const noReason: { unresolved: boolean; unresolvedWhy: string | null } =
      { unresolved: true, unresolvedWhy: null }
    control('an unresolved state with no reason must fail',
      () => noReason.unresolved && !!noReason.unresolvedWhy)

    // ══ §1.5 — THE PAIRINGS ══════════════════════════════════════════════════
    console.log('\n§1.5 — the pairings')
    const drivenBy = new Map<number, number | null>([[1, null], [2, 1]])
    const pairs = pairPolicies(
      [{ number: 7, causeNumbers: [1] }, { number: 4, causeNumbers: [1] }, { number: 5, causeNumbers: [2] }],
      drivenBy,
    )
    ok('two policies on the same cause are ALTERNATIVES',
      pairs.some((p) => p.relationship === 'ALTERNATIVES'
        && [p.a, p.b].sort().join() === '4,7'))
    ok('a policy on a cause driven by another policy\'s cause is a CHAIN',
      pairs.some((p) => p.relationship === 'CHAIN'))
    control('an unrelated pair must not read as a chain',
      () => pairPolicies([{ number: 1, causeNumbers: [] }, { number: 2, causeNumbers: [] }], drivenBy)
        .some((p) => p.relationship === 'CHAIN'))

    // ══ §1.8 — THE CHAIN-LINK, IN BOTH GENERATED DOCUMENTS ═══════════════════
    console.log('\n§1.8 — the half-delivery warning, in both documents')
    let snapshot: ProposalSnapshot | null = null
    try { snapshot = await buildProposalSnapshot(ideaId) } catch (e) {
      ok('a snapshot can be built from the fixture', false, (e as Error).message)
    }
    if (snapshot) {
      const opts = snapshot.options ?? []
      ok('the snapshot carries the chain-link off the row',
        opts.some((o) => o.chainLink === CHAIN_MERGED) && opts.some((o) => o.chainLink === CHAIN_5),
        `${opts.length} option(s)`)
      // §1.7 — a superseded parent is not an option any more.
      ok('and it drops the superseded parents',
        !opts.some((o) => o.number === 1 || o.number === 2))
      control('a snapshot still carrying a superseded parent must fail',
        () => ![{ number: 1 }, { number: 7 }].some((o) => o.number === 1))

      const long = documentText(buildProposalDocument(snapshot).model)
      const short = documentText(buildSummaryDocument(snapshot).model)
      ok('the chain-link renders in the long report',
        long.includes(CHAIN_MERGED) && long.includes(CHAIN_5))
      ok('the chain-link renders in the summary too',
        short.includes(CHAIN_MERGED) && short.includes(CHAIN_5))
      // ⚠ POSITION IS PART OF THE CLAIM. §1.8 is about a sentence that gets cut; one printed
      // after the actions is a sentence the reader meets too late to act on. Each document is
      // measured against ITS OWN next section, not a heading borrowed from the other.
      ok("it renders inside the long report's Guiding Policy section",
        long.indexOf(CHAIN_MERGED) > long.indexOf('Guiding Policy')
          && long.indexOf(CHAIN_MERGED) < long.indexOf('What would be done'))
      ok("and inside the summary's, above Proposed Actions",
        short.indexOf(CHAIN_MERGED) > short.indexOf('Guiding Policy')
          && short.indexOf(CHAIN_MERGED) < short.indexOf('Proposed Actions'))
      control('a warning printed after the actions must fail this',
        () => short.indexOf('Proposed Actions') < short.indexOf('Guiding Policy'))
      // ⚠ THE CONTROL IS THE RENDERER RUN AGAIN ON A SNAPSHOT WITH THE FIELD STRIPPED. If the
      // sentence appeared anyway it would be coming from somewhere else and this check would be
      // measuring the wrong string.
      const stripped: ProposalSnapshot = {
        ...snapshot,
        options: (snapshot.options ?? []).map((o) => ({ ...o, chainLink: null })),
      }
      control('with no chain-link on any row the long report must not print one',
        () => documentText(buildProposalDocument(stripped).model).includes(CHAIN_MERGED))
      control('with no chain-link on any row the summary must not print one',
        () => documentText(buildSummaryDocument(stripped).model).includes(CHAIN_MERGED))
      ok('a superseded parent\'s chain-link does not reach either document',
        !long.includes(CHAIN_1) && !short.includes(CHAIN_1))
    }

    // ══ ONE LIST OF OPERATIONS, NOT TWO ══════════════════════════════════════
    console.log('\n§1 — the route validates against the same list it dispatches on')
    const routeSrc = code('app/api/ideas/[id]/guiding-policy/route.ts')
    ok('PatchSchema is built from POLICY_OPS rather than restating it',
      /z\.enum\(POLICY_OPS/.test(routeSrc))
    ok('and the route no longer carries its own copy of the switch',
      !/switch \(op\)/.test(routeSrc), `${POLICY_OPS.length} operations`)

    // ══ §2 — EVIDENCE HAS SOMEWHERE TO PUT A DATE, AND SAYS WHAT IT MAKES OF IT ══
    console.log('\n§2 — evidence dates')

    // §2a — the column exists AND holds a value. ⚠ A schema assertion standing in for a value
    // assertion is CLAUDE.md §23.3's named failure shape, so this reads a real row.
    const dated = await prisma.evidenceItem.findFirst({
      where: { sourceDate: { not: null } },
      select: { sourceDate: true, sourceDateBasis: true, body: true, title: true },
    })
    ok('a real evidence row carries a date and a basis',
      !!dated?.sourceDate && !!dated?.sourceDateBasis,
      dated ? `${dated.sourceDate?.toISOString().slice(0, 10)} (${dated.sourceDateBasis})` : 'none')

    // §2b — the date comes off the corpus row, in the three shapes the corpora actually use.
    ok('an ISO corpus date reads as CORPUS_ROW',
      readCorpusDate('2014-01-16').basis === 'CORPUS_ROW'
        && readCorpusDate('2014-01-16').date?.toISOString().slice(0, 10) === '2014-01-16')
    ok('a bare year is a date, not a failure',
      readCorpusDate('1978').date?.getUTCFullYear() === 1978)
    ok('an empty corpus date is CORPUS_ROW_UNDATED, not UNPARSEABLE',
      readCorpusDate('').basis === 'CORPUS_ROW_UNDATED' && readCorpusDate(null).date === null)
    ok('rubbish is UNPARSEABLE, and kept distinct so a parser bug stays visible',
      readCorpusDate('last Tuesday').basis === 'UNPARSEABLE')
    // ⚠⚠ NO SOURCE ROW IS NOT "UNDATED". A reasoning step Lex wrote is not an undated document,
    // and §2c's count is wrong the moment those two are the same value.
    ok('a write with no source row records NO_SOURCE_ROW',
      sourceDateFields(null).sourceDateBasis === 'NO_SOURCE_ROW')
    control('a source row and no source row must not record the same basis',
      () => sourceDateFields(null).sourceDateBasis === sourceDateFields({ date: '' }).sourceDateBasis)

    // §2c — the URL route, on the shape that carried the 2014 Lords date and nothing else did.
    ok('a Hansard URL date is recovered',
      dateFromUrl('https://api.parliament.uk/historic-hansard/lords/2014/jan/16/x')
        ?.toISOString().slice(0, 10) === '2014-01-16')
    ok('an Act URL yields its year',
      dateFromUrl('https://www.legislation.gov.uk/ukpga/2014/6/section/1')?.getUTCFullYear() === 2014)
    control('a URL with no date must yield none',
      () => dateFromUrl('https://example.com/some/page') !== null)

    // §2d — the three judgements.
    const old = evidenceStanding({
      sourceDate: new Date(Date.UTC(2014, 0, 16)), sourceDateBasis: 'CORPUS_ROW',
      body: 'The scheme cost £4.2m in its first year.', now: new Date(Date.UTC(2026, 8, 1)),
    })
    ok('a claim past the threshold says to check the figures',
      old.staleness === 'NEEDS_CHECKING' && old.ageYears === 12
        && /check the figures/i.test(old.label), old.label)
    const bare = evidenceStanding({
      sourceDate: new Date(Date.UTC(2025, 0, 1)), sourceDateBasis: 'CORPUS_ROW',
      body: 'Officials say the position has improved.', now: new Date(Date.UTC(2026, 8, 1)),
    })
    ok('a claim with no figures is labelled an assertion, not evidence',
      bare.standing === 'ASSERTION' && /assertion rather than evidence/.test(bare.label))
    // ⚠⚠ THE SUBSTITUTION THAT IS THE WHOLE DEFECT: undated read as current.
    const none = evidenceStanding({ sourceDate: null, sourceDateBasis: 'CORPUS_ROW_UNDATED', body: '£3m' })
    ok('an undated row is UNDATED and never CURRENT',
      none.staleness === 'UNDATED' && /^Undated\./.test(none.label), none.label)
    control('an undated row must not be able to read as current',
      () => evidenceStanding({ sourceDate: null, sourceDateBasis: null, body: '£3m' }).staleness === 'CURRENT')
    ok('the threshold is stated once', EVIDENCE_STALE_YEARS === 5)
    ok('figures are found in the shapes findings actually use',
      figuresIn('It rose 12% to £4.2m across 1,340 cases').length >= 3,
      figuresIn('It rose 12% to £4.2m across 1,340 cases').join(' · '))
    control('prose with no quantity must yield no figures',
      () => figuresIn('The position has improved somewhat.').length > 0)

    // §2d, third part — a position change names what it was weighed against, or says nothing was.
    ok('a change with contrary findings names them',
      /weighed against 2 contrary findings/.test(
        weighedAgainstLine({ changedPosition: true, others: [
          { kind: 'CONTRADICTS', title: 'A' }, { kind: 'CONTRADICTS', title: 'B' },
        ] }) ?? ''))
    // ⚠⚠ THE HALF THAT WOULD BE DROPPED. "Nothing was weighed against it" is the finding.
    ok('a change with nothing behind it SAYS nothing was weighed against it',
      /nothing was weighed against it/.test(
        weighedAgainstLine({ changedPosition: true, others: [] }) ?? ''))
    control('an unchanged claim must produce no line at all',
      () => weighedAgainstLine({ changedPosition: false, others: [] }) !== null)

    // ⚠ AND IT REACHES THE PANEL. The library being right is not the feature working: §A1's
    // defect was a correct filter reading the wrong key. This asserts the assembled panel.
    // ⚠⚠ SCOPED TO A ROW THE PANEL WILL ACTUALLY CONTAIN, and the first version was not. A bare
    // `findFirst` on `sourceDate != null` returned an arbitrary row, and once a new build wrote
    // rows of its own it returned a REJECTED one — which `buildQuestionPanel` filters out, so
    // the assertion failed against correct code. A check that picks its own subject must pick it
    // by the same predicate the thing under test uses.
    const walked = await prisma.evidenceItem.findFirst({
      where: { sourceDate: { not: null }, status: { not: 'REJECTED' } },
      orderBy: { createdAt: 'asc' },
      select: { ideaId: true, id: true },
    })
    if (walked) {
      const panel = await buildQuestionPanel(walked.ideaId)
      const entry = panel.headings.flatMap((h) => h.entries).concat(panel.unfiled)
        .find((e) => e.id === walked.id)
      ok('the standing renders on the assembled panel entry',
        !!entry && !!entry.standingLabel && entry.staleness !== undefined,
        entry?.standingLabel?.slice(0, 60))
      ok('and every entry on that panel has one — none can pass as current by omission',
        panel.headings.flatMap((h) => h.entries).concat(panel.unfiled)
          .every((e) => !!e.standingLabel))
      control('an entry with an empty standing line must fail that',
        () => [{ standingLabel: '' }].every((e) => !!e.standingLabel))
    } else {
      ok('a dated evidence row exists to assert the panel against', false, 'none found')
    }

    // ══ §4 — THE TWO WORDINGS ══════════════════════════════════════════════════
    console.log('\n§4 — the two wordings')
    const twelve = balanceSentence(12)
    ok('the balance is stated in BOTH currencies',
      /4 full builds/.test(twelve) && /3 full builds and 3 re-runs/.test(twelve)
        && /12 re-runs/.test(twelve), twelve)
    ok('and it names the prices, so any other split can be worked out',
      /A full build costs 3 and a re-run costs 1/.test(twelve))
    ok('the honest middle state survives',
      /not for a full build/.test(balanceSentence(2)))
    ok('an exhausted allowance still says so plainly',
      balanceSentence(0) === 'You have used your build allowance.')
    // ⚠ THE OLD SENTENCE WAS TRUE AND MISLEADING. This is the assertion that it is gone.
    control('"You have 4 builds left." alone must not satisfy §4a',
      () => /3 full builds and 3 re-runs/.test('You have 4 builds left.'))

    const agendaSrc = code('components/lex/AgendaPanel.tsx')
    ok('the header count is the actionable one, not the total',
      /count=\{actionable\}/.test(agendaSrc) && /const total = actionable \+ challenges/.test(agendaSrc))
    ok('and the total is rendered inside',
      /\{total\} in all/.test(agendaSrc))

    // ══ §5 — THE PASS ADDED AFTER A BUILD RAN ══════════════════════════════════
    console.log('\n§5 — the unbilled pass, recorded')
    const historic = freshPassLog().filter((x) => x.key !== 'CAUSES_COMMENTARY')
    const added = passesAddedSince(historic)
    ok('a build whose log predates a pass reports that pass as added since',
      added.length === 1, added.join(', '))
    ok('and a current log reports none', passesAddedSince(freshPassLog()).length === 0)
    control('an empty log must not claim every pass was added since',
      () => passesAddedSince([]).length > 0)
    const progressSrc = code('components/lex/BuildProgress.tsx')
    ok('the resume copy counts the passes rather than saying "eight"',
      !/the eight passes already done/.test(progressSrc)
        && /\{build\.incomplete\.ranPasses\} pass/.test(progressSrc))
    ok('and the added pass is announced to the user',
      /passesAddedSince\.length > 0/.test(progressSrc) && /at no\s*\n?\s*cost to your allowance/.test(progressSrc))
  } finally {
    // ⚠ THE FIXTURE GOES, AND THE CHECK RE-READS TO SAY SO. "Deleted" is a claim about the
    // database, not about the call that was made.
    await prisma.idea.delete({ where: { id: ideaId } }).catch(() => {})
    const left = await prisma.idea.count({ where: { id: ideaId } })
    ok('the scratch idea is gone', left === 0, left ? `${left} still there` : idea.id.slice(0, 8))
  }

  // ══ THE CONTROLS ═══════════════════════════════════════════════════════════
  console.log('\n── negative controls (each must FIRE) ──')
  let dead = 0
  for (const c of controls) {
    if (c.fired) console.log(`  ✓ fired — ${c.label}`)
    else { dead++; console.log(`  ✗ DID NOT FIRE — ${c.label}`) }
  }

  console.log(`\n${pass} passed, ${fail} failed, ${controls.length} controls (${dead} dead)\n`)
  process.exit(fail || dead ? 1 : 0)
}

main()
  .catch(async (e) => {
    console.error('\ncheck:lex-25p threw:', e)
    // ⚠ A THROW MUST NOT LEAVE A SCRATCH IDEA IN CHARLIE'S LIST.
    await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } }).catch(() => {})
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
