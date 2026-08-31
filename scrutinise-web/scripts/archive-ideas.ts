// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-O §4 — ARCHIVE PRE-REBUILD IDEAS. LIST FIRST, ARCHIVE SECOND, RE-READ THIRD.
//
// §4a: *"Print the list first. Every idea and build about to be archived: id, title, owner,
// created date, build count. **Charlie sees this list before anything is hidden.**"*
//
// ⚠⚠ SO THE DEFAULT IS A DRY RUN, AND THERE IS NO FLAG THAT ARCHIVES WITHOUT PRINTING. Running
// this with no arguments lists and changes nothing. `--archive` is required to write, and it
// prints the same list first anyway — §4a's gate is a property of the script rather than of the
// operator's memory.
//
// ⚠⚠ AND IT RE-READS. §4c: *"Re-read the rows back after archiving and report what is actually
// hidden — not what the update statement claimed."* 25-H is why: three copies reported deleted
// were still in the database five days later, two carrying real titles and indistinguishable
// from Charlie's own ideas on any list. `updateMany` returning `{ count: 6 }` is the update's
// opinion. This prints the re-read.
//
// ⚠ ARCHIVE IS NOT DELETE. Every build, finding and note survives; only `archivedAt` moves, and
// `--unarchive` puts it back. Nothing here is irreversible, which is the only reason it is safe
// to run at all.
//
// Usage:
//   tsx --env-file=.env scripts/archive-ideas.ts                      # list the candidates
//   tsx --env-file=.env scripts/archive-ideas.ts --owners a@b,c@d     # narrow to owners
//   tsx --env-file=.env scripts/archive-ideas.ts --ids 1234,5678      # narrow to ids (prefixes ok)
//   tsx --env-file=.env scripts/archive-ideas.ts --ids … --archive --reason "…"
//   tsx --env-file=.env scripts/archive-ideas.ts --ids … --unarchive
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}
const has = (name: string) => process.argv.includes(`--${name}`)

/**
 * ⚠ AN ID FILTER MATCHES ON A PREFIX, because the list above prints eight characters and a
 * human retyping a full uuid is a human who will mistype one. A prefix that matches more than
 * one idea is refused rather than resolved — see below.
 */
async function resolveIds(prefixes: string[]): Promise<string[]> {
  const out: string[] = []
  for (const p of prefixes) {
    const hits = await prisma.idea.findMany({
      where: { id: { startsWith: p.trim() } },
      select: { id: true, title: true },
    })
    if (hits.length === 0) {
      console.log(`  ⚠ "${p}" matches NO idea — skipped, and nothing else is affected.`)
      continue
    }
    if (hits.length > 1) {
      // ⚠ AMBIGUITY IS REFUSED, NEVER RESOLVED. Picking one would hide the wrong person's work
      // and the operator would have no way to know it had happened.
      console.log(`  ⚠ "${p}" matches ${hits.length} ideas — REFUSED. Give more characters.`)
      hits.forEach((h) => console.log(`      ${h.id}  ${h.title ?? ''}`))
      continue
    }
    out.push(hits[0].id)
  }
  return out
}

async function main() {
  const ownersArg = arg('owners')
  const idsArg = arg('ids')
  const archive = has('archive')
  const unarchive = has('unarchive')
  const reason = arg('reason') ?? 'Made under the previous structure, before the 25-x rebuild.'

  if (archive && unarchive) {
    console.log('⚠ --archive and --unarchive together. Refusing rather than guessing.')
    process.exit(1)
  }

  const ids = idsArg ? await resolveIds(idsArg.split(',')) : null
  const owners = ownersArg ? ownersArg.split(',').map((o) => o.trim()) : null

  const where = {
    deletedAt: null,
    ...(ids ? { id: { in: ids } } : {}),
    ...(owners ? { creator: { email: { in: owners } } } : {}),
    // When unarchiving, the targets are the hidden ones; otherwise the visible ones.
    ...(unarchive ? { archivedAt: { not: null } } : {}),
  }

  const rows = await prisma.idea.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, title: true, createdAt: true, stage: true, archivedAt: true,
      creator: { select: { email: true, preferredName: true, firstName: true } },
      _count: { select: { builds: true } },
    },
  })

  // ══ §4a — THE LIST, ALWAYS, BEFORE ANYTHING ELSE ═══════════════════════════
  console.log(`\n── ${rows.length} idea${rows.length === 1 ? '' : 's'} ${unarchive ? 'to restore' : 'in scope'} ──\n`)
  console.log('  id        created     builds  stage       owner                          title')
  for (const r of rows) {
    const who = r.creator.email ?? r.creator.preferredName ?? r.creator.firstName ?? '—'
    console.log(
      `  ${r.id.slice(0, 8)}  ${r.createdAt.toISOString().slice(0, 10)}  ` +
      `${String(r._count.builds).padStart(6)}  ${String(r.stage).padEnd(10)}  ` +
      `${who.padEnd(30)} ${(r.title ?? '').slice(0, 44)}` +
      `${r.archivedAt ? '   [already archived]' : ''}`,
    )
  }
  const builds = rows.reduce((n, r) => n + r._count.builds, 0)
  console.log(`\n  ${rows.length} ideas, ${builds} builds. ⚠ Builds are NOT touched — they are kept with the idea.`)

  if (!archive && !unarchive) {
    console.log('\n  DRY RUN. Nothing has been changed.')
    console.log('  Add --archive (with --reason) to hide these, or --unarchive to put them back.\n')
    await prisma.$disconnect()
    return
  }

  if (!rows.length) {
    console.log('\n  Nothing in scope. Nothing done.\n')
    await prisma.$disconnect()
    return
  }

  // ⚠ NARROWED OR NOTHING. An --archive with no --ids and no --owners would hide every idea on
  // the platform, and the operator who typed it would find out from the dashboard.
  if (!ids && !owners) {
    console.log('\n  ⚠ REFUSED: --archive needs --ids or --owners. Archiving everything is not a thing')
    console.log('    anybody means, and a script that allows it will eventually do it.\n')
    process.exit(1)
  }

  const targetIds = rows.map((r) => r.id)
  const res = await prisma.idea.updateMany({
    where: { id: { in: targetIds } },
    data: unarchive
      ? { archivedAt: null, archivedReason: null }
      : { archivedAt: new Date(), archivedReason: reason },
  })
  console.log(`\n  updateMany reported: ${res.count} rows. ⚠ That is its OPINION — the re-read follows.`)

  // ══ §4c — THE RE-READ. REPORT ONLY WHAT YOU RE-READ ════════════════════════
  const after = await prisma.idea.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, title: true, archivedAt: true, archivedReason: true },
  })
  console.log('\n── re-read from the database ──\n')
  let wrong = 0
  for (const a of after) {
    const ok = unarchive ? a.archivedAt === null : a.archivedAt !== null
    if (!ok) wrong++
    console.log(
      `  ${ok ? '✓' : '✗'} ${a.id.slice(0, 8)}  archivedAt=${a.archivedAt ? a.archivedAt.toISOString().slice(0, 16) : 'null'}` +
      `  ${(a.title ?? '').slice(0, 40)}`,
    )
  }
  console.log(`\n  ${after.length - wrong} of ${after.length} are in the state asked for.`)
  if (wrong) {
    console.log('  ⚠⚠ SOME ROWS DID NOT MOVE. Do not report this as done.')
    process.exit(1)
  }

  // ══ §4d — THE NEGATIVE, ASSERTED AGAINST THE REAL READ PATHS ═══════════════
  //
  // ⚠ NOT "the column is set" — that is the same fact twice. This asks the queries the PRODUCT
  // asks: the owner's dashboard, the public list. A hide one read path forgets is worse than no
  // hide at all (§4d), and only the read paths can say.
  if (!unarchive) {
    const { LIVE_IDEA } = await import('../lib/lex/idea-visibility')
    const stillVisible = await prisma.idea.findMany({
      where: { id: { in: targetIds }, ...LIVE_IDEA },
      select: { id: true },
    })
    console.log(`\n  §4d — of ${targetIds.length} archived ideas, ${stillVisible.length} still pass the live-idea filter.`)
    console.log(`  ${stillVisible.length === 0 ? '✓ zero, as required.' : '✗ SOME ARE STILL VISIBLE.'}`)

    // ⚠⚠ AND THE CONTROL. A filter that returns nothing because it is broken looks exactly like
    // a filter that returns nothing because it worked. One unarchived idea must still come back.
    const control = await prisma.idea.findFirst({
      where: { id: { notIn: targetIds }, ...LIVE_IDEA },
      select: { id: true, title: true },
    })
    console.log(`  control — an idea that was NOT archived: ${control ? `${control.id.slice(0, 8)} "${(control.title ?? '').slice(0, 40)}" ✓ still visible` : '✗ NONE FOUND — the filter may be returning nothing at all'}`)
    if (stillVisible.length || !control) process.exit(1)
  }

  console.log('')
  await prisma.$disconnect()
}

void main()
