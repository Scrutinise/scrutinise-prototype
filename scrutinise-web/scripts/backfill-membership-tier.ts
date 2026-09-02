/**
 * CENTRAL 25-C §1f — TIER THE EXISTING ROWS BY DERIVATION, NOT BY DEFAULT.
 *
 * Run:  npx tsx --env-file=.env scripts/backfill-membership-tier.ts          (lists)
 *       npx tsx --env-file=.env scripts/backfill-membership-tier.ts --write  (writes)
 *
 * ⚠⚠ THE COLUMN'S DEFAULT IS GROUP AND THAT IS NOT THE ANSWER. Defaulting
 * everybody to GROUP takes nobody's rights away, which is exactly why it is the
 * wrong thing to do: it would record as "invited at top level" people who were
 * invited into one branch, and the tier would then be a column that says
 * nothing. §1f says derive it from how each person actually joined.
 *
 * ⚠ THE SIGNALS ARE ORDERED AND EACH ROW PRINTS THE ONE THAT DECIDED IT. A row
 * no signal reaches is reported as NOT DETERMINED and is NOT written — a
 * backfill that silently falls back to a default is the same failure as the
 * default itself (docs/CLAUDE.md §23.2: count what you could not check).
 *
 * ⚠ THE CLOSING REPORT IS A RE-READ, not the intent. It re-queries every row
 * after writing and prints what the database now says.
 */
import { prisma } from '../lib/prisma'
import { tierForArrival, type MembershipTier } from '../lib/membership-tier'

const WRITE = process.argv.includes('--write')

/** Two rows written inside one `$transaction` land milliseconds apart, not identically. */
const CO_CREATED_MS = 2_000

type Derivation = {
  userId: string
  email: string
  rootId: string
  rootName: string
  current: MembershipTier
  derived: MembershipTier | null
  signal: string
  evidence: string
}

async function main() {
  console.log(WRITE ? '=== WRITING ===' : '=== DRY RUN (pass --write to apply) ===\n')

  const roots = await prisma.community.findMany({
    where: { parentCommunityId: null, deletedAt: null },
    select: { id: true, name: true },
  })

  const derivations: Derivation[] = []

  for (const root of roots) {
    const branches = await prisma.community.findMany({
      where: { parentCommunityId: root.id },
      select: { id: true, name: true },
    })
    const branchIds = new Set(branches.map((b) => b.id))

    const rootRows = await prisma.communityMember.findMany({
      where: { communityId: root.id },
      include: { user: { select: { id: true, email: true } } },
    })

    for (const row of rootRows) {
      const branchRows = await prisma.communityMember.findMany({
        where: { userId: row.userId, communityId: { in: [...branchIds] } },
        include: { community: { select: { name: true } } },
        orderBy: { joinedAt: 'asc' },
      })

      let derived: MembershipTier | null = null
      let signal = ''
      let evidence = ''

      // ── SIGNAL 1: the invitation they came through, which names its own node.
      // The strongest available, and the only one that is a stored fact rather
      // than an inference from timestamps.
      if (row.invitedViaInviteId) {
        const invite = await prisma.communityInvite.findUnique({
          where: { id: row.invitedViaInviteId },
          select: { communityId: true, community: { select: { name: true } } },
        })
        if (invite) {
          derived = tierForArrival({ joinedNodeId: invite.communityId, rootId: root.id })
          signal = 'INVITE_PROVENANCE'
          evidence = `invitedVia an invitation to “${invite.community.name}”`
        }
      }

      // ── SIGNAL 2: they founded the Community. Nobody invited them into it.
      if (!derived && row.role === 'OWNER') {
        derived = 'GROUP'
        signal = 'FOUNDER'
        evidence = 'holds the OWNER row on the Community itself'
      }

      // ── SIGNAL 3: no branch membership at all, so nothing could have brought
      // them in through one.
      if (!derived && branchRows.length === 0) {
        derived = 'GROUP'
        signal = 'NO_BRANCH'
        evidence = 'member of the Community and of no branch'
      }

      // ── SIGNAL 4: the root row and a branch row were written together. That
      // is the shape of Stage 1.2's branch-implies-root side-effect: the branch
      // join created both, milliseconds apart, inside one transaction.
      if (!derived) {
        const coCreated = branchRows.find(
          (b) => Math.abs(b.joinedAt.getTime() - row.joinedAt.getTime()) <= CO_CREATED_MS,
        )
        if (coCreated) {
          derived = 'BRANCH'
          signal = 'CO_CREATED_WITH_BRANCH'
          const gap = Math.abs(coCreated.joinedAt.getTime() - row.joinedAt.getTime())
          evidence = `root row and “${coCreated.community.name}” written ${gap}ms apart — the branch join made both`
        }
      }

      // ── SIGNAL 5: they were in the Community before any branch existed for
      // them, by more than a transaction's width. They arrived at top level and
      // joined a branch later.
      if (!derived) {
        const earliestBranch = branchRows[0]
        if (
          earliestBranch &&
          earliestBranch.joinedAt.getTime() - row.joinedAt.getTime() > CO_CREATED_MS
        ) {
          derived = 'GROUP'
          signal = 'ROOT_FIRST'
          const gap = Math.round(
            (earliestBranch.joinedAt.getTime() - row.joinedAt.getTime()) / 1000,
          )
          evidence = `joined the Community ${gap}s before “${earliestBranch.community.name}”`
        }
      }

      if (!derived) {
        signal = 'NOT DETERMINED'
        evidence = `${branchRows.length} branch row(s), none co-created, none later — no signal reaches this row`
      }

      derivations.push({
        userId: row.userId,
        email: row.user.email,
        rootId: root.id,
        rootName: root.name,
        current: row.tier as MembershipTier,
        derived,
        signal,
        evidence,
      })
    }
  }

  console.log(`${derivations.length} root membership row(s) across ${roots.length} Community(ies)\n`)
  for (const d of derivations) {
    const change =
      d.derived === null
        ? 'NOT DETERMINED — left alone'
        : d.derived === d.current
          ? `${d.derived} (unchanged)`
          : `${d.current} → ${d.derived}  ⚠ CHANGE`
    console.log(`  ${d.email}`)
    console.log(`    ${d.rootName}: ${change}`)
    console.log(`    signal: ${d.signal} — ${d.evidence}`)
  }

  const changes = derivations.filter((d) => d.derived !== null && d.derived !== d.current)
  const undetermined = derivations.filter((d) => d.derived === null)
  console.log(`\n${changes.length} change(s), ${undetermined.length} not determined`)

  if (!WRITE) {
    console.log('\nNothing written. Re-run with --write to apply.')
    return
  }

  for (const d of derivations) {
    if (d.derived === null) continue
    // ⚠ Every row in the tree, so the branch rows mirror the root row and a
    // human reading the table is never shown two answers for one person.
    const treeIds = [
      d.rootId,
      ...(
        await prisma.community.findMany({
          where: { parentCommunityId: d.rootId },
          select: { id: true },
        })
      ).map((c) => c.id),
    ]
    await prisma.communityMember.updateMany({
      where: { userId: d.userId, communityId: { in: treeIds } },
      data: { tier: d.derived },
    })
  }

  // ── THE CLOSING REPORT IS A RE-READ. Not what was intended — what is there.
  console.log('\n=== RE-READ AFTER WRITING ===')
  for (const d of derivations) {
    const rows = await prisma.communityMember.findMany({
      where: { userId: d.userId },
      select: { tier: true, community: { select: { name: true, parentCommunityId: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    const shown = rows
      .map((r) => `${r.community.parentCommunityId ? '' : 'ROOT '}${r.community.name}=${r.tier}`)
      .join(', ')
    const ok = d.derived === null || rows.every((r) => r.tier === d.derived)
    console.log(`  ${ok ? '✓' : '✗'} ${d.email}: ${shown}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

export {}
