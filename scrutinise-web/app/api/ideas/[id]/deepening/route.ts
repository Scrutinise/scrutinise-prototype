// GET /api/ideas/[id]/deepening — the whole Deepening state for one idea.
//
// This is the POLLING endpoint (§2.4): a run's status is read from the pass record, never
// pushed. It also carries out the lazy settle of a run that never reported back, so a
// pass cannot sit at RUNNING for ever — see settleAbandonedRuns.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { deepeningState, acceptedEvidenceFor } from '@/lib/lex/deepening'
import { settleAbandonedRuns } from '@/lib/lex/deepening-settle'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  // A serverless function that is killed mid-gather leaves the row at RUNNING with nobody
  // coming back to finish it. Settling it HERE — on the read, and by WRITING the status,
  // not by displaying a different one — is what keeps "the status shown is the status
  // stored" true (§2.1.3).
  await settleAbandonedRuns(id)

  const [state, evidenceByField] = await Promise.all([deepeningState(id), acceptedEvidenceFor(id)])
  return NextResponse.json({ ...state, evidenceByField })
}
