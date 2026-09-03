import { prisma } from '../lib/prisma'
import { writeFileSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-X §5 — EVERYTHING CURRENTLY ACCEPTED, MARKED OR RULED OUT ON AN IDEA.
//
// Charlie has settled nothing on the accountability proposal deliberately, but has pressed
// buttons at random while testing. ⚠⚠ With §1 built that stops being harmless: a field
// accepted by accident is now PROTECTED from every future build, exactly as if he had meant
// it — the build will offer a revision beside it and never replace it. A stray click becomes
// a permanent floor on the quality of that field.
//
// ⚠⚠ IT CLEARS NOTHING AND HAS NO --write. §5b: "Do not clear anything yourself. Show him the
// list." There is no write path in this file.
//
// Usage: npx tsx --env-file=.env scripts/list-settled-decisions.ts [ideaId]
// ─────────────────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDEA = process.argv.slice(2).find((a) => UUID.test(a)) ?? '452c5ade-3153-400a-bf48-3b71aaa52773'
const OUT = '../docs/25X_SETTLED_ON_ACCOUNTABILITY.md'

const one = (t: string | null | undefined, n = 160) => {
  const s = (t ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n)}…` : s
}

async function main() {
  writeFileSync(OUT, '(this run has not finished)\n', 'utf8')

  const idea = await prisma.idea.findUnique({
    where: { id: IDEA }, select: { title: true, createdAt: true },
  })
  if (!idea) { console.error('no such idea'); process.exit(1) }

  const builds = await prisma.ideaBuild.findMany({
    where: { ideaId: IDEA }, orderBy: { version: 'asc' },
    select: { version: true, status: true, completedAt: true },
  })
  const lastDone = [...builds].reverse().find((b) => b.status === 'DONE' && b.completedAt)

  // ── 1. Fields ────────────────────────────────────────────────────────────────────────
  const fields = await prisma.ideaFieldState.findMany({
    where: { ideaId: IDEA },
    orderBy: { fieldKey: 'asc' },
    select: { fieldKey: true, status: true, value: true, proposal: true, updatedAt: true },
  })
  const accepted = fields.filter((f) => f.status === 'ACCEPTED')
  const skipped = fields.filter((f) => f.status === 'SKIPPED')
  const awaiting = fields.filter((f) => f.status === 'AWAITING_CONFIRMATION')

  // ── 2. Causes ────────────────────────────────────────────────────────────────────────
  const causes = await prisma.diagnosisCause.findMany({
    where: { ideaId: IDEA },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, cause: true, isRootCause: true, source: true, number: true, createdAt: true },
  })
  const marked = causes.filter((c) => c.isRootCause)

  // ── 3. Policy options ────────────────────────────────────────────────────────────────
  const options = await prisma.policyOption.findMany({
    where: { ideaId: IDEA },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, approach: true, status: true, ruleOutReason: true, number: true, updatedAt: true },
  })
  const ruledOut = options.filter((o) => o.status === 'RULED_OUT')
  const chosen = options.filter((o) => o.status === 'CHOSEN')

  // ── 4. Evidence the user acted on ────────────────────────────────────────────────────
  const evidence = await prisma.evidenceItem.groupBy({
    by: ['status'], where: { ideaId: IDEA }, _count: { _all: true },
  })

  // ── 5. Challenges the user acted on ──────────────────────────────────────────────────
  const issues = await prisma.deepeningIssue.groupBy({
    by: ['status'], where: { ideaId: IDEA }, _count: { _all: true },
  })

  const md = [
    `# 25-X §5 — everything settled on *${idea.title}*`,
    ``,
    `Idea \`${IDEA}\`. Read ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    `Builds: ${builds.map((b) => `v${b.version}:${b.status}`).join(' ')}.`,
    ``,
    `⚠⚠ **Why you are being shown this.** With 25-X §1 built, an ACCEPTED field is protected`,
    `from every future build: the build proposes beside it and never replaces it. **A field`,
    `accepted by a stray click while testing is now a permanent floor on that field's quality.**`,
    `Anything below that you did not mean, reopen with **Change** on the field (or untick the`,
    `root cause / un-rule-out the option) before the next build.`,
    ``,
    `⚠ **Nothing here has been changed.** This script has no write path.`,
    ``,
    `## 1. Accepted fields — ${accepted.length}`,
    ``,
    accepted.length ? [
      `| field | accepted text | last touched |`,
      `|---|---|---|`,
      ...accepted.map((f) => `| \`${f.fieldKey}\` | ${one(f.value)} | ${f.updatedAt.toISOString().slice(0, 16).replace('T', ' ')} |`),
    ].join('\n') : '_none_',
    ``,
    `⚠ Of those, **${accepted.filter((f) => f.proposal).length}** already carry a build's suggested`,
    `revision beside them (25-X §1b) and are waiting on a take-it-or-leave-it.`,
    ``,
    `## 2. Skipped fields — ${skipped.length}`,
    ``,
    skipped.length ? skipped.map((f) => `- \`${f.fieldKey}\``).join('\n') : '_none_',
    ``,
    `## 3. Root-cause marks — ${marked.length}`,
    ``,
    marked.length ? marked.map((c) =>
      `- **${c.number ?? '–'}. ${one(c.cause, 200)}**\n  - written by ${c.source}` +
      (lastDone?.completedAt && c.source === 'LEX_CORPUS' && c.createdAt < lastDone.completedAt
        ? ' · ⚠ predates the last completed build, so decision 60 now protects it from the revise pass'
        : '')).join('\n') : '_none — nothing is marked as the root cause_',
    ``,
    `Causes on the idea: ${causes.length} (${causes.filter((c) => c.source === 'USER').length} yours,`,
    `${causes.filter((c) => c.source === 'LEX_CORPUS').length} written by Lex).`,
    ``,
    `## 4. Policy options ruled out — ${ruledOut.length}`,
    ``,
    ruledOut.length ? ruledOut.map((o) =>
      `- **${o.number ?? '–'}. ${one(o.approach, 200)}**\n  - reason: ${one(o.ruleOutReason, 200) || '⚠ none recorded'}`).join('\n')
      : '_none_',
    ``,
    `## 5. Guiding policy chosen — ${chosen.length}`,
    ``,
    chosen.length ? chosen.map((o) => `- **${o.number ?? '–'}. ${one(o.approach, 200)}**`).join('\n')
      : '_none — no approach is committed_',
    ``,
    `Candidates on the idea: ${options.length}.`,
    ``,
    `## 6. Fields awaiting confirmation — ${awaiting.length}`,
    ``,
    `Not settled, and listed only so the picture is complete: these are Lex's proposals that`,
    `nobody has taken or left.`,
    ``,
    awaiting.length ? awaiting.map((f) => `- \`${f.fieldKey}\``).join('\n') : '_none_',
    ``,
    `## 7. Review decisions on findings and challenges`,
    ``,
    `Evidence: ${evidence.map((e) => `${e.status} ${e._count._all}`).join(' · ') || 'none'}`,
    ``,
    `Challenges: ${issues.map((i) => `${i.status} ${i._count._all}`).join(' · ') || 'none'}`,
  ].join('\n')

  writeFileSync(OUT, md, 'utf8')
  console.log(`\naccepted ${accepted.length} · skipped ${skipped.length} · awaiting ${awaiting.length}`)
  console.log(`root-cause marks ${marked.length} · ruled out ${ruledOut.length} · chosen ${chosen.length}`)
  console.log(`\nwritten to ${OUT} — nothing was changed.`)
  for (const f of accepted) console.log(`  ACCEPTED ${f.fieldKey.padEnd(24)} ${one(f.value, 90)}`)
  for (const c of marked) console.log(`  ROOT     ${String(c.number ?? '-').padEnd(24)} ${one(c.cause, 90)}`)
  for (const o of ruledOut) console.log(`  RULEDOUT ${String(o.number ?? '-').padEnd(24)} ${one(o.approach, 90)}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
