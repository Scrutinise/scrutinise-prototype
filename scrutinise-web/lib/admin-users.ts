/**
 * CENTRAL 25-A §6 — the admin user list, with the part of a user that lives at
 * Clerk rather than in our database.
 *
 * ⚠⚠ THE FACT THAT SHAPES THIS WHOLE FILE: WE RECORD NO SIGN-IN OF OUR OWN.
 * There is no login table. `User.lastActiveAt` exists as a column, is selected
 * by the GDPR export, and **is never written by anything** — so it is null for
 * every user on the platform, and a list that rendered it would show an empty
 * column that looks exactly like "nobody has ever come back".
 *
 * Everything about signing in therefore comes from Clerk, and Clerk gives ONE
 * timestamp per user (`lastSignInAt`, overwritten at each sign-in) — not a
 * history. See docs/CENTRAL_25A_REPORT.md §6b: "every login since launch"
 * cannot be built from what exists, and this module does not pretend otherwise.
 *
 * ⚠ §6d — ASSERT THE NEGATIVE. A user who has never signed in reads "Never
 * signed in". A user Clerk has no record of reads "No Clerk account". A user
 * whose lookup failed reads "Clerk did not answer". None of them is ever blank,
 * because a blank cell and "hasn't come back" look identical and mean opposite
 * things.
 */
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import type { SignInState } from '@/lib/admin-users-labels'

/** How much later than account creation still counts as "the sign-up itself". */
const SIGNUP_WINDOW_MS = 10 * 60 * 1000

export type { SignInState }
export { SIGN_IN_STATES, SIGN_IN_STATE_LABEL } from '@/lib/admin-users-labels'

export type AdminUserRow = {
  id: string
  name: string
  email: string
  username: string
  role: string
  status: string
  /** Sign-up date, from our own record. */
  joinDate: string
  credibilityScore: string | null
  ideaCount: number
  /** ⚠ Clerk's, and the ONLY sign-in fact that exists. Null in every state but RETURNED/SIGNUP_ONLY. */
  lastSignInAt: string | null
  signInState: SignInState
  /** "Password", "Google", "Email code" — however many they have set up. */
  signInMethods: string[]
  memberships: { communityId: string; name: string; isBranch: boolean; role: string; joinedAt: string }[]
}

/**
 * A Clerk id we minted ourselves for a seeded or historical row, rather than
 * one Clerk issued. Those accounts cannot sign in and never could, which is a
 * different fact from "has not signed in".
 */
export function isSeededClerkId(clerkId: string): boolean {
  return !clerkId.startsWith('user_')
}

/** Turn a provider string ("oauth_google", "google") into "Google". */
function providerLabel(provider: string): string {
  const bare = provider.replace(/^oauth_/, '').replace(/_/g, ' ')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

type ClerkFacts = {
  lastSignInAt: number | null
  createdAt: number
  passwordEnabled: boolean
  providers: string[]
}

/**
 * The §6d decision, on its own so the check can drive it directly with each
 * case rather than through a live Clerk call.
 *
 * `facts` is the Clerk record; `null` means Clerk has no user with that id;
 * `undefined` means we could not ask.
 */
export function describeSignIn(
  clerkId: string,
  facts: ClerkFacts | null | undefined,
): { state: SignInState; lastSignInAt: Date | null; methods: string[] } {
  if (isSeededClerkId(clerkId)) return { state: 'SEEDED', lastSignInAt: null, methods: [] }
  if (facts === undefined) return { state: 'UNKNOWN', lastSignInAt: null, methods: [] }
  if (facts === null) return { state: 'NO_CLERK_ACCOUNT', lastSignInAt: null, methods: [] }

  const methods: string[] = []
  if (facts.passwordEnabled) methods.push('Password')
  for (const p of facts.providers) methods.push(providerLabel(p))
  if (methods.length === 0) methods.push('Email code')

  if (facts.lastSignInAt === null) {
    return { state: 'NEVER', lastSignInAt: null, methods }
  }

  const state: SignInState =
    facts.lastSignInAt - facts.createdAt <= SIGNUP_WINDOW_MS ? 'SIGNUP_ONLY' : 'RETURNED'
  return { state, lastSignInAt: new Date(facts.lastSignInAt), methods }
}

/**
 * Ask Clerk about a batch of ids.
 *
 * Returns a map id → facts for everyone Clerk knows, and `null` for an id it
 * does not. ⚠ On a failed call it returns `undefined` for the whole batch, so
 * "Clerk did not answer" is distinguishable from "Clerk says no such user" —
 * they are opposite conclusions and must never render the same (§18/§19).
 */
export async function fetchClerkFacts(
  clerkIds: string[],
): Promise<Map<string, ClerkFacts | null> | undefined> {
  const askable = clerkIds.filter((id) => !isSeededClerkId(id))
  const found = new Map<string, ClerkFacts | null>()
  if (askable.length === 0) return found

  try {
    const client = await clerkClient()
    // Clerk caps `userId` filters per request; 100 is comfortably inside it.
    for (let i = 0; i < askable.length; i += 100) {
      const batch = askable.slice(i, i + 100)
      const res = await client.users.getUserList({ userId: batch, limit: batch.length })
      for (const u of res.data) {
        found.set(u.id, {
          lastSignInAt: u.lastSignInAt,
          createdAt: u.createdAt,
          passwordEnabled: u.passwordEnabled,
          providers: u.externalAccounts.map((a) => a.provider),
        })
      }
    }
  } catch (err) {
    console.error('[admin-users] Clerk lookup failed —', err instanceof Error ? err.message : err)
    return undefined
  }

  // An id Clerk did not return is an id Clerk does not have.
  for (const id of askable) if (!found.has(id)) found.set(id, null)
  return found
}

export const ADMIN_USER_SORTS = ['lastSignIn', 'joined', 'name'] as const
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number]

/**
 * Order for the "last signed in" sort.
 *
 * ⚠ THE POINT OF THE SORT (§6a) IS TO SURFACE THE PEOPLE WHO NEVER CAME BACK,
 * so they sort to one end as a group instead of falling off the list as nulls.
 * Most recent first, then the ones who never returned, then the ones who never
 * could, then the ones we could not ask about.
 */
const STATE_RANK: Record<SignInState, number> = {
  RETURNED: 0,
  SIGNUP_ONLY: 1,
  NEVER: 2,
  NO_CLERK_ACCOUNT: 3,
  SEEDED: 4,
  UNKNOWN: 5,
}

export function sortAdminUsers(rows: AdminUserRow[], sort: AdminUserSort): AdminUserRow[] {
  const out = [...rows]
  if (sort === 'name') {
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }
  if (sort === 'joined') {
    out.sort((a, b) => Date.parse(b.joinDate) - Date.parse(a.joinDate))
    return out
  }
  out.sort((a, b) => {
    const rank = STATE_RANK[a.signInState] - STATE_RANK[b.signInState]
    if (rank !== 0) return rank
    const at = a.lastSignInAt ? Date.parse(a.lastSignInAt) : 0
    const bt = b.lastSignInAt ? Date.parse(b.lastSignInAt) : 0
    if (at !== bt) return bt - at
    return Date.parse(b.joinDate) - Date.parse(a.joinDate)
  })
  return out
}

/**
 * Every registered user, with what they belong to and what Clerk knows about
 * their signing in.
 *
 * Not paginated: the list has to be sortable by last sign-in across the WHOLE
 * platform to answer "who has never come back", and sorting one page of 25 by a
 * field the other pages also carry answers a different question. It is a few
 * dozen rows today and it is an admin screen.
 */
export async function listAdminUsers(sort: AdminUserSort = 'lastSignIn'): Promise<{
  users: AdminUserRow[]
  total: number
  clerkAnswered: boolean
}> {
  const users = await prisma.user.findMany({
    orderBy: { joinDate: 'desc' },
    select: {
      id: true,
      clerkId: true,
      name: true,
      email: true,
      username: true,
      role: true,
      status: true,
      joinDate: true,
      credibilityScore: { select: { totalScore: true } },
      _count: { select: { ideas: true } },
      communityMemberships: {
        select: {
          role: true,
          joinedAt: true,
          community: { select: { id: true, name: true, parentCommunityId: true, deletedAt: true } },
        },
      },
    },
  })

  const clerkFacts = await fetchClerkFacts(users.map((u) => u.clerkId))

  const rows: AdminUserRow[] = users.map((u) => {
    const described = describeSignIn(u.clerkId, clerkFacts ? clerkFacts.get(u.clerkId) : undefined)
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      role: u.role,
      status: u.status,
      joinDate: u.joinDate.toISOString(),
      credibilityScore: u.credibilityScore?.totalScore?.toString() ?? null,
      ideaCount: u._count.ideas,
      lastSignInAt: described.lastSignInAt?.toISOString() ?? null,
      signInState: described.state,
      signInMethods: described.methods,
      memberships: u.communityMemberships
        // A deleted branch is not somewhere anybody belongs.
        .filter((m) => m.community.deletedAt === null)
        .map((m) => ({
          communityId: m.community.id,
          name: m.community.name,
          isBranch: m.community.parentCommunityId !== null,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        })),
    }
  })

  return {
    users: sortAdminUsers(rows, sort),
    total: rows.length,
    // ⚠ Reported, so the page can say "Clerk did not answer" once at the top
    // rather than showing 33 rows that each look like a user with no account.
    clerkAnswered: clerkFacts !== undefined,
  }
}
