/**
 * CENTRAL 25-C §1 — THE TWO-TIER MEMBERSHIP MODEL.
 *
 * ⚠⚠ WHAT THIS IS NOT. It is not a deletion of the root membership row. The row
 * a branch join creates on the root is still created, still there, still what
 * `check:central`'s branch-implies-root invariant asserts, and still what lets a
 * branch member see the Community they belong to. Twelve gates read that row;
 * deleting it breaks all twelve. **Only the rights detach** — two of them:
 * `canCreateBranchUnder` and `inviteRightFor`.
 *
 * ⚠ THE TIER THAT DECIDES ANYTHING IS THE ONE ON THE ROOT ROW. `rootTierFor()`
 * is the only reader, and every gate goes through it rather than reading the
 * column. A branch row carries a mirror of the root value so that a human
 * reading the table is never shown two answers for one person; `setMembershipTier`
 * writes every row in the tree in one transaction to keep it that way.
 *
 * ⚠ THIS FILE IS PURE AND HAS NO IMPORTS, DELIBERATELY, for two reasons. It is
 * imported by CLIENT components for the labels, and a `prisma` import at module
 * scope is how a client bundle acquires a database driver. And `lib/community.ts`
 * imports `tierForArrival` from here, so anything this file imported back from
 * there would be a cycle. The database half — `rootTierFor`, `setMembershipTier`
 * — lives in `lib/community-permissions.ts` beside the gates that use it.
 */

export const MEMBERSHIP_TIERS = ['GROUP', 'BRANCH'] as const
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number]

/** §1b — the two tiers, named in the UI exactly as Charlie named them. */
export const TIER_LABEL: Record<MembershipTier, string> = {
  GROUP: 'Group member',
  BRANCH: 'Branch member',
}

export const TIER_DESCRIPTION: Record<MembershipTier, string> = {
  GROUP:
    'Invited at top level. May found a branch and become its manager, may invite people at top level, and may invite people into branches.',
  BRANCH:
    'Invited into one branch. May invite others into that branch. May not found a branch and may not invite at top level.',
}

/**
 * ⚠ NOT A COLOUR CUE. Charlie is colour blind, so the tier is carried by the
 * WORD and by a filled-vs-outline background — never by hue alone. These
 * classes differ in fill as well as in colour for exactly that reason.
 */
export const TIER_BADGE: Record<MembershipTier, string> = {
  GROUP: 'bg-slate-800 text-white',
  BRANCH: 'border border-slate-400 bg-transparent text-slate-700',
}

// ─────────────────────────────────────────────────────────────────────────────
// The pure rules. Imported by the check rather than restated in it (§25.3).
// ─────────────────────────────────────────────────────────────────────────────

/** §1b — may somebody of this tier found a branch? */
export function tierMayFoundBranch(tier: MembershipTier | null): boolean {
  return tier === 'GROUP'
}

/** §1b — may somebody of this tier invite at TOP LEVEL, on tier alone? */
export function tierMayInviteAtTopLevel(tier: MembershipTier | null): boolean {
  return tier === 'GROUP'
}

/**
 * §1f — the tier a NEW root membership takes, from how the person arrived.
 *
 * ⚠ The whole rule, in one place, so the join path and the backfill cannot
 * disagree: a root row created ON the root is GROUP; a root row created as the
 * side-effect of a branch join is BRANCH.
 */
export function tierForArrival(params: {
  /** The node they were actually invited to / joined. */
  joinedNodeId: string
  rootId: string
}): MembershipTier {
  return params.joinedNodeId === params.rootId ? 'GROUP' : 'BRANCH'
}
