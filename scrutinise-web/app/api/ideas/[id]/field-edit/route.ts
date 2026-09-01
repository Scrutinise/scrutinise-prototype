// ─────────────────────────────────────────────────────────────────────────────
// 25-Q §1 — THE USER ACCEPTS A REWRITE LEX OFFERED IN THE CHAT.
//
// §1b: *"Lex proposes; the user accepts; only then does the panel change. Never a silent write."*
//
// ⚠⚠ THIS ROUTE IS REACHED ONLY BY A CLICK. `POST /lex` computes the offer and writes nothing;
// this writes and computes nothing. Keeping the two apart is what makes "never a silent write" a
// property of the system rather than a promise about a prompt — a model cannot reach this
// endpoint, because a model does not have a mouse.
//
// ⚠⚠ AND IT WRITES THE SAME COLUMN THE PANEL'S OWN CONTROL WRITES, with the same ownership check
// and the same trim: a policy option's `approach`, a text field's proposal through `setProposal`.
// It is not a second interpretation of what an edit means — 25-P §1.11's safety argument rests on
// each row having one meaning of "edited", and this preserves it.
//
// ⚠ THE ONE PLACE IT DOES NOT CALL `updatePolicyOption` IS DELIBERATE AND WORTH THE WORDS. The
// revision row and the replacement must land together, so both go in one `$transaction`; calling
// the helper would put the write outside it, and a failure between the two would lose exactly the
// previous wording §1d exists to keep. Same column, same guard, one transaction.
//
// ⚠ THE OFFER IS RE-VALIDATED AGAINST THE ROWS, not trusted. The client sends back the offer it
// was given; a policy that has been rejected, merged away or renumbered since is refused by name.
// This is not a privilege boundary — the owner can edit these fields directly — it is a
// staleness boundary, and the failure it prevents is a rewrite landing on the wrong policy a
// minute after the user read the card.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { applyFieldEdit, fieldEditFailed } from '@/lib/lex/field-edit-write'

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({
  kind: z.enum(['POLICY_OPTION', 'TEXT_FIELD']),
  fieldKey: z.string().min(1).max(64),
  /** The stable number the user read off the card. Required for a row target. */
  number: z.number().int().positive().nullable().optional(),
  text: z.string().trim().min(1).max(8000),
})

/**
 * ⚠ 25-Q §1d — THE SUPERSEDED TEXT, READ BACK. A `FieldRevision` row nobody can see is a record,
 * not testimony: the user has still watched their sentence disappear. This is what makes the
 * principle true from the outside rather than only in the database.
 */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const url = new URL(req.url)
  const fieldKey = url.searchParams.get('fieldKey')
  const targetId = url.searchParams.get('targetId')

  const revisions = await prisma.fieldRevision.findMany({
    where: {
      ideaId: id,
      ...(fieldKey ? { fieldKey } : {}),
      ...(targetId ? { targetId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, previousText: true, previousSource: true, createdAt: true, targetNumber: true },
  })
  return NextResponse.json({ revisions })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user } = authz

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  // ⚠ THE WRITE ITSELF IS IN `lib/lex/field-edit-write.ts`, so `check:lex-25q` runs the same
  // function rather than its own copy of the transaction. CLAUDE.md §25.3.
  const result = await applyFieldEdit({ ideaId: id, userId: user.id, ...parsed.data })
  if (fieldEditFailed(result)) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({ state: await computeCanonicalState(id), wrote: result.wrote })
}
