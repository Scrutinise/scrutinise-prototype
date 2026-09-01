// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-P §1 — THE GUIDING POLICY SCREEN.
//
// GET   → the numbered list, the sort's verdicts, the pairings, the ratings, the state.
// POST  → `sort` (§1.2/§1.5/§1.6) and `merge` (§1.7) — the two operations that call a model.
// PATCH → every operation that does not: accept/decline a move, accept/decline a cause, settle,
//         phase, reject, restore, proceed-unresolved.
//
// ⚠⚠ 25-P §1.11 — WHY A TARGETED EDIT IS SAFE HERE, AND WHAT MAKES IT SAFE.
//
// §1.11 asks whether a targeted pass can rewrite the guiding-policy field without a full build,
// and names the risk: 25-L's, where a second pass not given everything the first was given
// overwrites good work with a thinner version, silently.
//
// **It is safe, and for a structural reason rather than a careful one.** The state lives in
// `PolicyOption` ROWS, which are individually addressable: every operation below names the rows
// it touches by id and cannot reach the others. The 25-L failure mode needs a single-value
// overwrite, and there is one — `setLoopProposal(ideaId, 'policyOptions', …)` writes the whole
// field as one string.
//
// ⚠ SO THAT FIELD IS RE-DERIVED FROM ALL THE ROWS AFTER EVERY MUTATION, never written from a
// model's output. `syncPolicyField` below is the only writer. A model that returned four
// policies cannot shrink a list of eighteen, because the model's answer is never the source of
// the field — the rows are, and the field is a projection of them.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { modelForPass } from '@/lib/lex/build-config'
import { sortPolicies, judgeMerge, nextNumber } from '@/lib/lex/guiding-policy'
import {
  readPolicyState, applyPolicyOp, syncPolicyField, ensureNumbered,
  writeMerge, writeSort, POLICY_OPS, type PolicyOp,
} from '@/lib/lex/guiding-policy-state'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

/**
 * ⚠ THE STATE READER AND THE NON-MODEL OPERATIONS LIVE IN `lib/lex/guiding-policy-state.ts`.
 * Not for tidiness: §1.12's checks have to run the operations and read the state back, and a
 * check that imports a route handler would have to fake an authenticated `Request` to do it.
 * One implementation, two callers — this route and the checks.
 */
const readState = readPolicyState


export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await readState(id))
}

// ══ THE TWO OPERATIONS THAT CALL A MODEL ═══════════════════════════════════════

const PostSchema = z.object({
  action: z.enum(['sort', 'merge']),
  /** merge only: the two numbers the user typed. */
  numbers: z.array(z.number().int().positive()).length(2).optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  await ensureNumbered(id)
  const model = modelForPass('SMART')
  const usages: Array<{ model: string; tokensIn: number; tokensOut: number }> = []

  if (parsed.data.action === 'sort') {
    const state = await readState(id)
    const live = state.policies.filter((p) => p.status !== 'RULED_OUT' && !p.superseded)
    if (!live.length) {
      return NextResponse.json({ error: 'There are no candidate policies to sort.' }, { status: 409 })
    }
    const material = [
      '═══ THE DIAGNOSED CAUSES, NUMBERED ═══',
      ...state.causes.map((c) => `[${c.number}] ${c.isRoot ? '(marked root) ' : ''}${c.cause}`),
      '',
      '═══ THE CANDIDATE POLICIES, NUMBERED ═══',
      ...live.map((p) => `[${p.number}] ${p.approach}${p.caseFor ? `\n      For: ${p.caseFor}` : ''}`),
    ].join('\n')

    const sorted = await sortPolicies({ material, model, onUsage: (u) => usages.push(u) })
    if (!sorted) {
      return NextResponse.json(
        { error: 'The sort did not complete, so nothing has been reclassified.' }, { status: 502 },
      )
    }

    // ⚠ THE WRITE IS EXTRACTED FOR THE SAME REASON THE MERGE WRITE IS: §1.12 has to be able to
    // reclassify a policy and then assert what the screen renders, without a model in the loop.
    const written = await writeSort({ ideaId: id, state, sorted })
    console.log('[25p:policy] sorted', {
      ideaId: id, model, returned: sorted.length, written,
      actions: sorted.filter((s) => s.kind === 'COHERENT_ACTION').length,
      goals: sorted.filter((s) => s.kind === 'GOAL_RESTATEMENT').length,
      impliedCauses: sorted.filter((s) => s.impliedCause).length,
    })
    return NextResponse.json({ ...(await readState(id)), usages })
  }

  // ── merge ──────────────────────────────────────────────────────────────────
  const [na, nb] = parsed.data.numbers ?? []
  if (na == null || nb == null || na === nb) {
    return NextResponse.json({ error: 'Give two different policy numbers.' }, { status: 422 })
  }
  const rows = await prisma.policyOption.findMany({ where: { ideaId: id, number: { in: [na, nb] } } })
  const A = rows.find((r) => r.number === na)
  const B = rows.find((r) => r.number === nb)
  // ⚠ A MISSING NUMBER IS NAMED, not collapsed into "invalid input". The user typed a number
  // they read off the screen; if it is not there, which one is the useful half of the answer.
  const missing = [na, nb].filter((n) => !rows.some((r) => r.number === n))
  if (missing.length) {
    return NextResponse.json(
      { error: `There is no policy ${missing.join(' or ')} on this idea.` }, { status: 404 },
    )
  }

  const state = await readState(id)
  const causeName = new Map(state.causes.map((c) => [c.number, c.cause]))
  const causesOf = (r: typeof A) => (r?.targetCauseIds ?? [])
    .map((cid) => state.causes.find((c) => c.id === cid)?.number)
    .filter((n): n is number => !!n)

  const material = [
    '═══ THE DIAGNOSED CAUSES, NUMBERED ═══',
    ...state.causes.map((c) => `[${c.number}] ${c.cause}`),
    '',
    `═══ POLICY ${na} ═══`,
    A!.approach,
    A!.caseFor ? `For: ${A!.caseFor}` : '',
    `Attacks cause(s): ${causesOf(A).map((n) => `${n} (${causeName.get(n)})`).join('; ') || 'none recorded'}`,
    '',
    `═══ POLICY ${nb} ═══`,
    B!.approach,
    B!.caseFor ? `For: ${B!.caseFor}` : '',
    `Attacks cause(s): ${causesOf(B).map((n) => `${n} (${causeName.get(n)})`).join('; ') || 'none recorded'}`,
  ].join('\n')

  const answer = await judgeMerge({ material, model, onUsage: (u) => usages.push(u) })
  if (!answer) {
    return NextResponse.json(
      { error: 'That judgement did not complete, so nothing has changed.' }, { status: 502 },
    )
  }

  // ⚠ ONLY A `MERGE` VERDICT WRITES. The other three are ADVICE — they tell the user what the
  // relationship is and leave the act to them. A verdict that silently rearranged the list would
  // be the product deciding, which is exactly what §1 exists to stop.
  // ⚠ ONLY THE WRITE IS EXTRACTED, NOT THE JUDGEMENT. §1.12 asks that a merge be asserted on
  // its RENDERED result; the check supplies a verdict of its own and runs this same write.
  const createdNumber = await writeMerge({ ideaId: id, na, nb, answer })

  console.log('[25p:policy] merge judged', {
    ideaId: id, model, a: na, b: nb, verdict: answer.verdict, createdNumber,
  })
  return NextResponse.json({ answer, createdNumber, ...(await readState(id)), usages })
}

// ══ EVERY OPERATION THAT DOES NOT CALL A MODEL ═════════════════════════════════

const PatchSchema = z.object({
  // ⚠ THE LIST IS IMPORTED, NOT RESTATED. A tenth operation added to `POLICY_OPS` and forgotten
  // here would be rejected 422 by the validator while the handler that implements it sat there
  // working — the shape of bug that reads as "the button does nothing".
  op: z.enum(POLICY_OPS as [PolicyOp, ...PolicyOp[]]),
  policyId: z.string().uuid().optional(),
  reason: z.string().trim().max(2000).optional(),
  phase: z.enum(['NOW', 'LATER']).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const result = await applyPolicyOp({ ideaId: id, ...parsed.data })
  if ('notOnThisIdea' in result) {
    return NextResponse.json({ error: 'That policy is not on this idea.' }, { status: 404 })
  }
  return NextResponse.json(result.state)
}
