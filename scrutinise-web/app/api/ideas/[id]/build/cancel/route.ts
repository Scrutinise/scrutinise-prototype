// SPRINT 25-A §2 — "Cancel is available while running."
//
// CO-OPERATIVE, and deliberately so. This writes `cancelRequested` and returns; the
// engine checks it between passes and settles the row to CANCELLED itself. A cancel
// that flipped the status here would produce a row saying CANCELLED while the work
// carried on writing proposals underneath it — the status shown would stop being the
// status of the thing that is happening, which is the invariant this whole feature is
// built on.
//
// The consequence is honest and stated in the UI: pressing Cancel stops the build at
// the end of the pass that is running, not mid-sentence.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { buildState, requestCancel } from '@/lib/lex/build'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const active = await prisma.ideaBuild.findFirst({
    where: { ideaId: id, status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true },
  })
  if (!active) {
    return NextResponse.json({ error: 'There is no build running to cancel.', state: await buildState(id) }, { status: 409 })
  }

  const applied = await requestCancel(id, active.id)
  return NextResponse.json({ applied, state: await buildState(id) })
}
