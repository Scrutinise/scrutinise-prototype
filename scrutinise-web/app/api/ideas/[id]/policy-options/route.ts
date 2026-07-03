import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import {
  addPolicyOption,
  updatePolicyOption,
  removePolicyOption,
  ruleOutPolicyOption,
  choosePolicyApproach,
  listPolicyOptions,
  acceptField,
  skipField,
} from '@/lib/lex/field-machine'
import { orchestrateAfterWrite } from '@/lib/lex/orchestrator'

type Params = { params: Promise<{ id: string }> }

// The Page 3 policy-options loop (§17) + chosen-approach commit. Separate from the
// scalar /fields endpoint because it mutates PolicyOption child rows.
const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    approach: z.string().trim().min(1).max(2000),
    caseFor: z.string().trim().max(4000).optional(),
    caseAgainst: z.string().trim().max(4000).optional(),
    mechanismTypes: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  }),
  z.object({
    action: z.literal('update'),
    optionId: z.string().min(1),
    approach: z.string().trim().min(1).max(2000).optional(),
    caseFor: z.string().trim().max(4000).optional(),
    caseAgainst: z.string().trim().max(4000).optional(),
    mechanismTypes: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  }),
  z.object({ action: z.literal('remove'), optionId: z.string().min(1) }),
  z.object({ action: z.literal('ruleOut'), optionId: z.string().min(1), reason: z.string().trim().max(4000) }),
  z.object({ action: z.literal('confirm') }), // done curating — accept the policyOptions field
  z.object({ action: z.literal('skip') }),
  z.object({ action: z.literal('choose'), optionId: z.string().min(1) }), // commit to one approach
  z.object({ action: z.literal('skipChoose') }),
])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const body = parsed.data

  let messages: string[] = []
  try {
    switch (body.action) {
      case 'add':
        await addPolicyOption(id, {
          approach: body.approach, caseFor: body.caseFor, caseAgainst: body.caseAgainst,
          mechanismTypes: body.mechanismTypes, source: 'USER',
        })
        break
      case 'update':
        await updatePolicyOption(id, body.optionId, {
          approach: body.approach, caseFor: body.caseFor, caseAgainst: body.caseAgainst, mechanismTypes: body.mechanismTypes,
        })
        break
      case 'remove':
        await removePolicyOption(id, body.optionId)
        break
      case 'ruleOut':
        await ruleOutPolicyOption(id, body.optionId, body.reason)
        break
      case 'confirm': {
        const options = await listPolicyOptions(id)
        if (!options.length) {
          return NextResponse.json({ error: 'Add at least one candidate approach before continuing.' }, { status: 422 })
        }
        await acceptField(id, idea.creatorId, 'policyOptions', 'confirmed')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      }
      case 'skip':
        await skipField(id, 'policyOptions')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      case 'choose': {
        const ok = await choosePolicyApproach(id, idea.creatorId, body.optionId)
        if (!ok) return NextResponse.json({ error: 'That option was not found.' }, { status: 422 })
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
      }
      case 'skipChoose':
        await skipField(id, 'chosenApproach')
        messages = (await orchestrateAfterWrite(id, idea.creatorId)).messages
        break
    }
  } catch (err) {
    console.error('[policy-options] transition failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] policy-options write', { action: body.action, nextField: state?.currentField?.key ?? null })
  return NextResponse.json({ state, messages })
}
