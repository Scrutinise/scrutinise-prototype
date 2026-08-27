// ─────────────────────────────────────────────────────────────────────────────
// 25-I §1 — sweep the ideas that a page load created.
//
// ⚠⚠ RE-READ AFTER DELETION. Three "deleted" verification copies survived five days in
// 25-G because a deletion was reported without being re-read, and two of them carried real
// titles, so they were indistinguishable from Charlie's own work in any list.
// A DELETE YOU DID NOT RE-READ IS A DELETE YOU DID NOT DO. Every row below is read back
// individually after its delete, and the re-read — not the intent — is what gets printed.
//
// ⚠ WHAT COUNTS AS ACCIDENTAL, and why each clause is here:
//   · the elicitation has NO content in any of its four answer fields — nobody typed
//     anything, which is the signature of a row minted by a render rather than a person;
//   · there is NO build — a built idea is work, whatever its elicitation looks like;
//   · the idea has NO title of its own ("Untitled idea") — a named idea was named by
//     somebody, or by a build that got far enough to propose one;
//   · and it is not already soft-deleted.
//
// ⚠ THE FIELD-STATE CLAUSE IS THE ONE THAT STOPS THIS BEING DESTRUCTIVE. An idea can carry
// work that never went through the elicitation — anything typed straight into the proposal
// panel at the old door. So a row with ANY non-EMPTY field state is kept, even if its
// elicitation is blank. Deleting on the elicitation alone would take real work with it.
//
// Usage:
//   tsx --env-file=.env scripts/sweep-accidental-ideas.ts            (dry run — counts only)
//   tsx --env-file=.env scripts/sweep-accidental-ideas.ts --execute  (delete, then re-read)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

interface Candidate {
  id: string
  title: string
  createdAt: Date
  creatorId: string
}

async function findCandidates(): Promise<Candidate[]> {
  const ideas = await prisma.idea.findMany({
    where: {
      deletedAt: null,
      title: 'Untitled idea',
      builds: { none: {} },
      // No elicitation at all, or one with nothing in any answer field.
      OR: [
        { elicitation: { is: null } },
        {
          elicitation: {
            is: {
              AND: [
                { OR: [{ problem: null }, { problem: '' }] },
                { goalKind: null },
                { OR: [{ ownKnowledge: null }, { ownKnowledge: '' }] },
                { OR: [{ goalDetail: null }, { goalDetail: '' }] },
                { readingUrl: null },
                { readingFileName: null },
                { OR: [{ readingNote: null }, { readingNote: '' }] },
              ],
            },
          },
        },
      ],
    },
    select: { id: true, title: true, createdAt: true, creatorId: true },
    orderBy: { createdAt: 'asc' },
  })

  // ⚠ The field-state guard, applied per idea. Anything with real work in the proposal
  // panel is NOT accidental, however empty its elicitation is.
  const keep = new Set<string>()
  for (const i of ideas) {
    const written = await prisma.ideaFieldState.count({
      where: { ideaId: i.id, status: { not: 'EMPTY' } },
    })
    if (written > 0) keep.add(i.id)
  }
  if (keep.size) {
    console.log(`  (${keep.size} kept: blank elicitation but non-empty proposal fields)`)
  }
  return ideas.filter((i) => !keep.has(i.id))
}

async function main() {
  const execute = process.argv.includes('--execute')
  const total = await prisma.idea.count({ where: { deletedAt: null } })
  const candidates = await findCandidates()

  console.log(`── 25-I §1 sweep ──`)
  console.log(`${total} live ideas; ${candidates.length} look created by a page load, not a person.\n`)
  for (const c of candidates) {
    console.log(`  ${c.createdAt.toISOString()}  ${c.id.slice(0, 8)}  "${c.title}"`)
  }

  if (!execute) {
    console.log(`\n⚠ DRY RUN — pass --execute to delete. Nothing has been changed.`)
    return
  }

  // ⚠⚠ SOFT DELETE, AND THE CHOICE IS DELIBERATE — SAY SO RATHER THAN LET "DELETED" IMPLY
  // MORE THAN HAPPENED. `deletedAt` is what every list on the site filters on, so setting
  // it achieves the whole of §1's purpose: these stop appearing in Charlie's idea list, at
  // once, everywhere. What it does NOT do is destroy 27 production rows and their cascades
  // on the strength of a heuristic I wrote this morning. If the heuristic is wrong about
  // even one row, a soft delete is one UPDATE away from being undone and a hard delete is
  // not. `--hard` is available for when Charlie is satisfied the list is right.
  const hard = process.argv.includes('--hard')
  console.log(`\n${hard ? 'HARD deleting' : 'soft-deleting (deletedAt)'}, and re-reading each one:`)
  let gone = 0
  let survived = 0
  const stamp = new Date()
  for (const c of candidates) {
    try {
      if (hard) await prisma.idea.delete({ where: { id: c.id } })
      else await prisma.idea.update({ where: { id: c.id }, data: { deletedAt: stamp } })
    } catch (e) {
      console.log(`  ✗ ${c.id.slice(0, 8)}  ${hard ? 'delete' : 'update'} threw: ${e instanceof Error ? e.message : String(e)}`)
      survived++
      continue
    }
    // ⚠ THE RE-READ. Not a count, not a return value, not the mutation's own result — the
    // row itself, fetched again by id, and the re-read is what gets printed.
    const again = await prisma.idea.findUnique({
      where: { id: c.id }, select: { id: true, deletedAt: true },
    })
    const cleared = hard ? !again : !!again?.deletedAt
    if (cleared) { console.log(`  ✓ ${c.id.slice(0, 8)}  verified ${hard ? 'gone' : 'soft-deleted'}`); gone++ }
    else { console.log(`  ✗ ${c.id.slice(0, 8)}  STILL VISIBLE after the write`); survived++ }
  }

  const after = await prisma.idea.count({ where: { deletedAt: null } })
  console.log(`\n${gone} ${hard ? 'deleted' : 'soft-deleted'} and verified, ${survived} survived.`)
  console.log(`live ideas: ${total} → ${after} (expected ${total - gone}) ${total - gone === after ? '✓' : '✗ MISMATCH'}`)
  if (!hard && gone) console.log(`\nreversible: UPDATE "Idea" SET "deletedAt"=NULL WHERE "deletedAt"='${stamp.toISOString()}';`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
