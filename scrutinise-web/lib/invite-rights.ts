/**
 * CENTRAL 25-A §3a — who may invite, as a setting rather than a rule in code.
 *
 * ⚠⚠ READ THIS BEFORE USING THE ROLE NAMES. Charlie's two names are not two
 * roles in the database. The only roles that exist are `CommunityMemberRole`:
 * OWNER, ADMIN, MEMBER, held per node. So:
 *
 *   COMMUNITY_ADMIN  = OWNER or ADMIN on the ROOT Community.
 *   BRANCH_MANAGER   = OWNER or ADMIN on a BRANCH (a node with a parent).
 *
 * ⚠ "Branch manager" collides with something that already exists and grants
 * NOTHING: `Community.managerId`, the assigned-manager pointer, whose own
 * schema comment says it "is not itself a permission grant". A branch manager
 * for the purpose of INVITING is the membership role, not that pointer — and
 * the two can disagree, because the pointer can name somebody who holds no
 * OWNER/ADMIN row at all.
 *
 * ⚠ THE OWNER ALWAYS HOLDS THE RIGHT and is deliberately not listable in the
 * setting: a setting that can take away the owner's own right is a setting that
 * can lock a Community out of inviting anybody.
 */
export const INVITE_RIGHT_ROLES = ['COMMUNITY_ADMIN', 'BRANCH_MANAGER'] as const
export type InviteRightRole = (typeof INVITE_RIGHT_ROLES)[number]

export const INVITE_RIGHT_LABEL: Record<InviteRightRole, string> = {
  COMMUNITY_ADMIN: 'Community admins',
  BRANCH_MANAGER: 'Branch managers',
}

export const INVITE_RIGHT_DESCRIPTION: Record<InviteRightRole, string> = {
  COMMUNITY_ADMIN:
    'Anyone who is an owner or admin of the Community itself. They can invite anywhere in it.',
  BRANCH_MANAGER:
    'Anyone who is an owner or admin of a branch. They can invite to their own branch and the branches under it — not to the Community as a whole, and not to somebody else’s branch.',
}

/** The default, which is exactly what every Community could do before the setting existed. */
export const DEFAULT_INVITE_RIGHTS: InviteRightRole[] = ['COMMUNITY_ADMIN', 'BRANCH_MANAGER']

export function parseInviteRights(stored: string[] | null | undefined): InviteRightRole[] {
  if (!stored) return DEFAULT_INVITE_RIGHTS
  const kept = stored.filter((r): r is InviteRightRole =>
    (INVITE_RIGHT_ROLES as readonly string[]).includes(r),
  )
  return kept
}
