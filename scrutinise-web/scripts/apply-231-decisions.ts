// ─────────────────────────────────────────────────────────────────────────────
// 22 Oct (6) — 231 and decision 187 on Charlie's idea 452c5ade.
//   231: the drafting decisions (220, 221, the Code, and "an unmatched pair is void; the duty travels upward") go at the head of #38's
//        and #59's Commentary, so Lex drafts from what the record says. The previous Commentary is kept as a FieldRevision.
//   232: #202's clause cites CRaG 2010 s.10 as the standard and creates no duty — written into its Commentary the same way.
//   187: the heading "Legislation" is renamed "Primary legislation".
//
//   npx tsx --env-file=.env scripts/apply-231-decisions.ts            (dry run)
//   npx tsx --env-file=.env scripts/apply-231-decisions.ts --apply    (writes, then reads back)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const APPLY = process.argv.includes('--apply')
const IDEA_PREFIX = '452c5ade'
const ORIGIN = 'DRAFTING_DECISIONS_231'
const MARK = 'Drafting decisions (CCh, 22 Oct 2026):'
const DECISIONS = [
  MARK,
  '220 — “publicly funded body” means a public authority listed in Schedule 1 to the Freedom of Information Act 2000, and a contracting authority within the Procurement Act 2023 in respect of work done under contract, with a power to extend by order; commencement phased: departments, then arm’s-length bodies, then the rest; the condition-of-funding mechanism is a financial action, not drafted here.',
  '221 — the goal statement is published; the full accountability record is visible up the line, to Parliament and to the National Audit Office.',
  'The Code — issued by the Minister for the Civil Service and laid before Parliament; it may be changed only to improve the service in line with the general principles; the Code itself is held to the brevity test.',
  'The pair (duty and means) — an unmatched pair is void; the duty travels upward.',
].join('\n')
const MARK_232 = 'Drafting decision (CCh, 22 Oct 2026, 232):'
const DECISION_232 = `${MARK_232} the clause cites section 10 of the Constitutional Reform and Governance Act 2010 (selection on merit on the basis of fair and open competition) as the standard that remains, and creates no duty of its own.`
const WRITES: Array<{ n: number; mark: string; text: string }> = [
  { n: 38, mark: MARK, text: DECISIONS },
  { n: 59, mark: MARK, text: DECISIONS },
  { n: 202, mark: MARK_232, text: DECISION_232 },
]

async function main() {
  const ideas = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Idea" WHERE id LIKE ${IDEA_PREFIX + '%'}`
  if (ideas.length !== 1) throw new Error(`expected one idea ${IDEA_PREFIX}…, found ${ideas.length}`)
  const ideaId = ideas[0].id
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId }, select: { creatorId: true } })

  for (const { n, mark, text } of WRITES) {
    const a = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId, number: n }, select: { id: true, commentary: true, source: true, title: true } })
    if ((a.commentary ?? '').includes(mark)) { console.log(`#${n} already carries the decisions — unchanged`); continue }
    const next = `${text}\n\n${a.commentary ?? ''}`.trim()
    console.log(`${APPLY ? 'WRITING' : 'WOULD WRITE'} #${n} (${a.title ?? 'untitled'}): commentary ${a.commentary?.length ?? 0} → ${next.length} characters`)
    if (!APPLY) continue
    await prisma.$transaction([
      prisma.fieldRevision.create({
        data: { ideaId, fieldKey: 'actionCommentary', targetId: a.id, targetNumber: n, previousText: a.commentary ?? '', previousSource: a.source, newText: next, acceptedById: idea.creatorId, origin: ORIGIN },
      }),
      prisma.lexCoherentAction.update({ where: { id: a.id }, data: { commentary: next } }),
    ])
  }

  const headings = await prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true } })
  const leg = headings.filter((h) => h.name === 'Legislation')
  const prim = headings.filter((h) => h.name === 'Primary legislation')
  console.log(`headings: ${headings.map((h) => h.name).join(' · ')}`)
  if (prim.length) console.log('a heading named "Primary legislation" already exists — rename skipped')
  else if (leg.length !== 1) console.log(`expected one heading "Legislation", found ${leg.length} — rename skipped`)
  else if (APPLY) await prisma.actionHeading.update({ where: { id: leg[0].id }, data: { name: 'Primary legislation' } })
  else console.log('WOULD RENAME "Legislation" → "Primary legislation"')

  if (!APPLY) { console.log('(dry run — nothing written; pass --apply)'); return }
  // ── read back ──
  for (const { n, text } of WRITES) {
    const a = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId, number: n }, select: { commentary: true } })
    console.log(`READ BACK #${n}: decisions verbatim at head of Commentary: ${(a.commentary ?? '').startsWith(text)}`)
  }
  const after = await prisma.actionHeading.findMany({ where: { ideaId }, select: { name: true } })
  console.log(`READ BACK headings: ${after.map((h) => h.name).join(' · ')}`)
  console.log(`revisions kept (${ORIGIN}): ${await prisma.fieldRevision.count({ where: { origin: ORIGIN } })}`)
}
main().finally(() => prisma.$disconnect())
