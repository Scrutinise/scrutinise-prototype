// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-D — THE SHARE RESOLVER. A recipient's link, resolved to the version
// that was shared.
//
// ⚠ This route reads `resolveSharedProposal`, which reads the PIN
// (`Idea.publishedProposalVersionId`) and never "the latest version". If that
// ever changes, a recipient's document changes under them with no notice and the
// URL never moves — the failure §20.3 exists to prevent. `check:20bd` publishes
// v1, mints v2, and asserts this route still returns v1.
//
// ⚠ IT RETURNS THE STORED SNAPSHOT'S HEADLINE, NOT LIVE STATE. Nothing here
// touches the working proposal, and the only writes are none.
//
// Auth is OPTIONAL: LINK and PUBLIC resolve for a signed-out reader; COMMUNITY
// requires a session and a shared community with the owner (§20.7). A refusal
// names which of the two it is, because "sign in" and "you are not in this
// community" are different instructions to the reader.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { resolveSharedProposal } from '@/lib/documents/proposal-version'
import { headlineCost } from '@/lib/documents/build-proposal'

type Params = { params: Promise<{ token: string }> }

/** The reader's DB user id, or null when signed out. Never creates anything. */
async function readerId(): Promise<string | null> {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return null
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
    return user?.id ?? null
  } catch {
    return null
  }
}

const REFUSAL: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: 'That link does not point at a proposal.' },
  unpublished: { status: 404, message: 'This proposal is not published. The link may have been withdrawn.' },
  sign_in_required: { status: 401, message: 'This proposal is shared within a community. Sign in to see whether you can read it.' },
  not_in_community: { status: 403, message: 'This proposal is shared within a community you are not a member of.' },
}

export async function GET(_req: Request, { params }: Params) {
  const { token } = await params
  const outcome = await resolveSharedProposal(token, await readerId())

  if (!outcome.ok) {
    const r = REFUSAL[outcome.reason]
    return NextResponse.json({ error: outcome.reason, message: r.message }, { status: r.status })
  }

  const { proposal } = outcome
  const s = proposal.snapshot
  const field = (key: string) => {
    const f = s.fields?.find((x) => x.key === key)
    return typeof f?.value === 'string' ? f.value : null
  }

  // ⚠ Only the headline is returned, not the whole snapshot. A published version
  // is a read grant on a DOCUMENT, and shipping the entire internal object to any
  // holder of a link would quietly widen that grant to every field the assembler
  // happens to carry.
  return NextResponse.json({
    proposal: {
      title: proposal.title,
      ownerName: proposal.ownerName,
      versionNumber: proposal.versionNumber,
      publishedAt: proposal.publishedAt,
      changeNote: proposal.changeNote,
      visibility: proposal.visibility,
      summary: s.summaryDescription ?? null,
      problem: field('challenge'),
      pivotalObstacle: field('pivotalObstacle'),
      approach: field('chosenApproach'),
      actionCount: s.actions?.length ?? 0,
      headlineCost: headlineCost(s.actions ?? []),
      problemCost: s.costs?.problemCost ?? null,
      // The honesty figures travel with the link, so a recipient sees them before
      // they open the file rather than only inside it.
      coverage: s.coverage ?? null,
      openQuestions: (s.knownUnknowns?.length ?? 0) + (s.issues?.filter((i) => i.status === 'OPEN').length ?? 0),
      downloads: {
        proposalPdf: `/api/proposals/${token}/download?kind=PROPOSAL&format=pdf`,
        proposalDocx: `/api/proposals/${token}/download?kind=PROPOSAL&format=docx`,
        summaryPdf: `/api/proposals/${token}/download?kind=PROPOSAL_SUMMARY&format=pdf`,
        summaryDocx: `/api/proposals/${token}/download?kind=PROPOSAL_SUMMARY&format=docx`,
      },
    },
  })
}
