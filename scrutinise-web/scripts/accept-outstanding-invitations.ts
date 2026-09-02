/**
 * CENTRAL 25-A §7j — the people already stuck.
 *
 * Several invitees have platform accounts and no membership, because their
 * Community invitation was never redeemed. This sweeps them.
 *
 *   npx tsx --env-file=.env scripts/accept-outstanding-invitations.ts           # LIST ONLY
 *   npx tsx --env-file=.env scripts/accept-outstanding-invitations.ts --write   # do it
 *
 * ⚠⚠ IT IS NOT A ONE-OFF SCRIPT. Every decision and every write is
 * `lib/invite-acceptance.ts`, which is the same function §7c calls at first
 * sign-in. This file is a way of running it over the backlog and printing what
 * happened — Charlie's standing rule is fix the writer, then sweep the backlog,
 * because a separate backfill path is a second thing to get wrong.
 *
 * ⚠ LIST FIRST, ALWAYS. Without `--write` nothing is written and the table
 * below is what a real run would create — produced by the same code that would
 * then create it, not by a query that resembles it.
 *
 * ⚠ AND THE REPORT AT THE END IS A RE-READ. What the database holds afterwards,
 * never what the write claimed.
 */
import { acceptOutstandingInvitations } from '../lib/invite-acceptance'
import { prisma } from '../lib/prisma'

function table(rows: string[][], headers: string[]) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  )
  const line = (cells: string[]) =>
    '  ' + cells.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ')
  console.log(line(headers))
  console.log('  ' + widths.map((w) => '-'.repeat(w)).join('  '))
  for (const r of rows) console.log(line(r))
}

async function main() {
  const write = process.argv.includes('--write')

  console.log(
    write
      ? '\nCENTRAL 25-A §7j — ACCEPTING OUTSTANDING INVITATIONS (writing)\n'
      : '\nCENTRAL 25-A §7j — outstanding invitations (LIST ONLY, nothing will be written)\n',
  )

  // The plan always comes from a dry run first, so what is printed is what the
  // real run is about to do.
  const plan = await acceptOutstandingInvitations({ dryRun: true })

  if (plan.ambiguous.length > 0) {
    console.log('⚠ AMBIGUOUS — REPORTED, NOT RESOLVED. Nothing will be written for these:\n')
    for (const a of plan.ambiguous) {
      console.log(`  ${a.email}`)
      console.log(`    ${a.reason}`)
      console.log(`    invitations: ${a.inviteIds.join(', ')}`)
    }
    console.log('')
  }

  if (plan.planned.length === 0) {
    console.log('  Nothing to accept — no account holds an unredeemed invitation.\n')
  } else {
    console.log(`${plan.planned.length} invitation(s) would be accepted on their behalf:\n`)
    table(
      plan.planned.map((p) => [
        p.name ?? '(no name)',
        p.email,
        p.isBranch ? `branch “${p.communityName}”` : `“${p.communityName}”`,
        p.invitedByName ?? '(unknown)',
        p.effect,
      ]),
      ['person', 'email', 'invited to', 'invited by', 'what will be created'],
    )
    console.log('')
  }

  if (plan.skipped.length > 0) {
    console.log('Not in scope:\n')
    for (const sk of plan.skipped) {
      console.log(`  ${sk.email} → ${sk.communityName}: ${sk.reason}`)
    }
    console.log('')
  }

  if (!write) {
    console.log('Nothing was written. Re-run with --write to do it.\n')
    return
  }

  const result = await acceptOutstandingInvitations({ dryRun: false })

  console.log('\n── what the database holds now, re-read row by row ──\n')
  if (result.created.length === 0) {
    console.log('  no memberships were created\n')
  } else {
    table(
      result.created.map((c) => [
        c.email,
        c.communityName,
        c.role,
        c.invitedByName ?? '(unknown)',
        c.acceptedOnBehalf ? 'accepted on their behalf' : '⚠ NOT MARKED as on-behalf',
      ]),
      ['email', 'community', 'role', 'invited by', 'consent'],
    )
    console.log('')
  }

  const notLanded = result.skipped.filter((sk) => sk.reason.includes('DID NOT LAND'))
  if (notLanded.length > 0) {
    console.log('⚠⚠ WRITES THAT DID NOT LAND:')
    for (const sk of notLanded) console.log(`  ${sk.email} → ${sk.communityName}`)
    process.exitCode = 1
  }

  // And the invitations must now be spent — one that stays live can be used again.
  const stillLive = await prisma.communityInvite.findMany({
    where: { id: { in: result.planned.map((p) => p.inviteId) } },
    select: { id: true, email: true, usedCount: true, maxUses: true },
  })
  const unconsumed = stillLive.filter((i) => i.usedCount < i.maxUses)
  console.log(
    unconsumed.length === 0
      ? `  all ${stillLive.length} invitation(s) are now spent`
      : `⚠ ${unconsumed.length} invitation(s) are still redeemable: ${unconsumed.map((u) => u.email).join(', ')}`,
  )
  if (unconsumed.length > 0) process.exitCode = 1
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
