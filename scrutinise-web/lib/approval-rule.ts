// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL item 12 — the four approval modes, as one pure function.
//
// ⚠ THE SERVER GATE AND THE CLIENT CONTROL MUST NOT BE TWO IMPLEMENTATIONS.
// `lib/approval.ts` imports prisma, so a client component cannot call it; the
// obvious shortcut is to re-express "who may approve" in the component. Then the
// tick appears for people the route refuses (a control that always errors) or
// hides from people the route allows (a right nobody can exercise). Both are
// silent. So the rule lives here, taking already-resolved capabilities, and both
// sides call it.
// ─────────────────────────────────────────────────────────────────────────────

export const APPROVAL_MODES = ['SELF', 'BRANCH_ADMIN', 'COMMUNITY_ADMIN', 'NAMED'] as const
export type ApprovalMode = (typeof APPROVAL_MODES)[number]

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  SELF: 'Each member, on their own content',
  BRANCH_ADMIN: 'Branch admins',
  COMMUNITY_ADMIN: 'Community admins',
  NAMED: 'Named people only',
}

/** What the viewer is, resolved once against the node the content sits on. */
export type ApproverCaps = {
  viewerId: string
  /** Manage rights over the node the content lives on. */
  canManageBranch: boolean
  /** Manage rights over the Community root. */
  canManageCommunity: boolean
  /** Listed under the NAMED mode's picker. */
  isNamed: boolean
}

export function canApproveWith(params: {
  mode: ApprovalMode
  featureEnabled: boolean
  caps: ApproverCaps
  authorId: string
}): boolean {
  // An approval control that appears while the display is hidden would let
  // people mark things that nothing ever shows.
  if (!params.featureEnabled) return false

  switch (params.mode) {
    case 'SELF':
      return params.authorId === params.caps.viewerId
    case 'BRANCH_ADMIN':
      // Manage rights cascade from every ancestor, so a Community admin is a
      // branch admin's superset and needs no separate case here.
      return params.caps.canManageBranch
    case 'COMMUNITY_ADMIN':
      return params.caps.canManageCommunity
    case 'NAMED':
      return params.caps.isNamed
    default:
      return false
  }
}
