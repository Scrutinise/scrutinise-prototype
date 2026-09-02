/**
 * CENTRAL 25-C §1h/§1i — the group-level view's SHAPE and its SORT.
 *
 * ⚠⚠ THIS FILE IS PURE AND MUST STAY PURE. IT HAS NO IMPORTS, DELIBERATELY.
 *
 * It was carved out of `lib/group-view.ts` because `GroupLevel.tsx` — a
 * `'use client'` component — imported `sortGroupMembers` from there, and
 * `group-view.ts` imports `lib/prisma.ts`. A VALUE import pulls the whole module
 * graph into the browser bundle, so the Postgres driver went with it and the
 * Vercel build died on `dns`, `fs`, `net` and `tls`. Six errors, one edge.
 *
 * The query was already on the server and the props were already plain; neither
 * helped, because the edge was the sort function, not the data. **The only fix
 * that is a fix is cutting the edge** — aliasing the built-ins away or marking
 * the module external would have made the build pass and shipped a bundle that
 * broke in the browser instead.
 *
 * ⚠ So: nothing here may import anything. `npm run check:client-boundary`
 * walks every client component's value imports and fails if one reaches a
 * server-only module, which is what would have caught this before the push.
 */

export type MembershipTierName = 'GROUP' | 'BRANCH'

export type GroupLevelMember = {
  userId: string
  name: string
  username: string
  /** Their tier on the ROOT membership — the one that governs. */
  tier: MembershipTierName
  /** Their role on the ROOT node. */
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  /**
   * ⚠ AN ISO STRING, NOT A `Date`. This type crosses the server→client
   * boundary, and a plain serialisable payload is one less thing that has to be
   * true for the page to render. ISO-8601 also sorts lexicographically in
   * chronological order, so the sort below needs no parsing.
   */
  joinedAt: string
  /** §1h — who invited them. Null for somebody who arrived of their own accord. */
  invitedByName: string | null
  /** Which node the invitation they came through belonged to, where there was one. */
  invitedViaNodeName: string | null
  /** 25-A §7c/§7j — they never clicked anything; we accepted for them. */
  acceptedOnBehalf: boolean
  /** §1h — which branches they manage, by name. */
  managesBranches: { id: string; name: string }[]
  /** §1h — THE ANOMALY COLUMN. A group member with this false is the thing to look at. */
  managesAnyBranch: boolean
  /** Which branches they are merely a member of. */
  memberOfBranchCount: number
}

export type VacantBranch = {
  id: string
  name: string
  memberCount: number
  /** §2i — a nomination waiting on a decision, which is the action to take. */
  pendingNomineeName: string | null
  pendingNominationId: string | null
}

export type GroupLevelView = {
  rootId: string
  rootName: string
  members: GroupLevelMember[]
  vacantBranches: VacantBranch[]
  /** §1h — the count the view exists to make visible, computed once, server-side. */
  groupMembersManagingNoBranch: number
}

// ─────────────────────────────────────────────────────────────────────────────
// The sort. ⚠ ONE FUNCTION, imported by the panel AND by the check
// (docs/CLAUDE.md §26.5): a copy in the component would pass a check that still
// held the old rule.
// ─────────────────────────────────────────────────────────────────────────────

export const GROUP_SORTS = ['anomaly', 'name', 'joined', 'invitedBy', 'branches'] as const
export type GroupSort = (typeof GROUP_SORTS)[number]

export const GROUP_SORT_LABEL: Record<GroupSort, string> = {
  anomaly: 'Managing no branch first',
  name: 'Name',
  joined: 'Joined (newest first)',
  invitedBy: 'Who invited them',
  branches: 'Most branches managed',
}

/**
 * ⚠ `anomaly` IS THE DEFAULT AND THAT IS THE POINT OF §1h. The list opens on
 * the people Charlie is watching for — group members managing no branch — and
 * he does not have to know to sort for them.
 */
export function sortGroupMembers(rows: GroupLevelMember[], sort: GroupSort): GroupLevelMember[] {
  const out = [...rows]
  switch (sort) {
    case 'anomaly':
      return out.sort(
        (a, b) =>
          Number(a.tier !== 'GROUP') - Number(b.tier !== 'GROUP') ||
          Number(a.managesAnyBranch) - Number(b.managesAnyBranch) ||
          a.name.localeCompare(b.name),
      )
    case 'joined':
      // ⚠ ISO-8601 compares chronologically as a string; no Date parsing needed.
      return out.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    case 'invitedBy':
      return out.sort(
        (a, b) =>
          (a.invitedByName ?? '￿').localeCompare(b.invitedByName ?? '￿') ||
          a.name.localeCompare(b.name),
      )
    case 'branches':
      return out.sort(
        (a, b) => b.managesBranches.length - a.managesBranches.length || a.name.localeCompare(b.name),
      )
    case 'name':
    default:
      return out.sort((a, b) => a.name.localeCompare(b.name))
  }
}
