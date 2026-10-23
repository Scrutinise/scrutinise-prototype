// ─────────────────────────────────────────────────────────────────────────────
// 22 Oct (7) — 233 and 238 on Charlie's idea 452c5ade.
//   233: create "Consequential amendments and repeals" under Primary legislation, statement verbatim, Commentary pointing at the
//        Actions Pack's generated annexe (nothing retyped); then policy-test it with the product's own testAgainstPolicy.
//   238: #202's Commentary gains the one-line merit standard for every publicly funded body, at its head, replacing the 232 line as
//        the standard. The previous Commentary is kept as a FieldRevision. The redraft is NOT run here (asks-first; Charlie's).
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/apply-233-238.ts            (dry run)
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/apply-233-238.ts --apply    (writes, policy-tests, reads back)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { addAction } from '../lib/lex/field-machine'
import { assignHeading, testAgainstPolicy } from '../lib/lex/action-structure'
import { LIMITS } from '../lib/lex/input-limits'

const APPLY = process.argv.includes('--apply')
const IDEA_PREFIX = '452c5ade'
const HEADING = 'Primary legislation'

// 233 — CCh 22 Oct (7), verbatim.
const STATEMENT_233 = 'A Schedule of consequential amendments and repeals, generated from what the clauses touch: the count in the report, the full list in the annexe, refreshed when the effects data is.'
const COMMENTARY_233 = [
  'The schedule itself is not kept here. It is generated, and nothing in it is retyped:',
  '- the full list is the annexe "Consequential amendments and repeals" at the end of the Actions Pack (Outputs → Actions Pack);',
  '- the counts are in the Background Report, section 8;',
  '- both are built from the drafting instructions\' amends / repeals / modifies lines and the official record of effects, so they change when either does.',
].join('\n')

// 238 — CCh 22 Oct (7). The quoted standard keeps CCh's own elision; it is not filled in here.
const MARK_238 = 'Drafting decision (CCh, 22 Oct 2026, 238):'
const DECISION_238 = `${MARK_238} the clause states the standard in one line for every publicly funded body — "appointment and advancement … on merit on the basis of fair and open competition" — and cites section 10 of the Constitutional Reform and Governance Act 2010 as the existing instance of it, not as the standard. No process duty and no reporting. This replaces the 232 decision below as the standard.`
const ORIGIN_238 = 'DRAFTING_DECISION_238'

async function main() {
  const ideas = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Idea" WHERE id LIKE ${IDEA_PREFIX + '%'}`
  if (ideas.length !== 1) throw new Error(`expected one idea ${IDEA_PREFIX}…, found ${ideas.length}`)
  const ideaId = ideas[0].id
  const idea = await prisma.idea.findUniqueOrThrow({ where: { id: ideaId }, select: { creatorId: true } })
  if (STATEMENT_233.length > LIMITS.actionStatement) throw new Error(`233 statement is ${STATEMENT_233.length} characters, over ${LIMITS.actionStatement}`)

  // ── 233 ──
  const heads = await prisma.actionHeading.findMany({ where: { ideaId, name: HEADING }, select: { id: true } })
  if (heads.length !== 1) throw new Error(`expected one heading "${HEADING}", found ${heads.length}`)
  let a233 = await prisma.lexCoherentAction.findFirst({ where: { ideaId, status: 'LIVE', practicalStep: STATEMENT_233 }, select: { id: true, number: true, headingId: true, policyTestVerdict: true } })
  if (a233) console.log(`233 already exists as #${a233.number} — not created again`)
  else console.log(`${APPLY ? 'CREATING' : 'WOULD CREATE'} 233 under "${HEADING}" (${STATEMENT_233.length} characters)`)
  if (APPLY && !a233) {
    const row = await addAction(ideaId, { practicalStep: STATEMENT_233, commentary: COMMENTARY_233, source: 'USER' })
    a233 = { id: row.id, number: row.number, headingId: null, policyTestVerdict: null }
  }
  if (APPLY && a233 && a233.headingId !== heads[0].id) {
    const r = await assignHeading(ideaId, [a233.id], heads[0].id)
    if (!r.ok) throw new Error(`assign heading: ${JSON.stringify(r)}`)
  }
  if (APPLY && a233 && (!a233.policyTestVerdict || a233.policyTestVerdict === 'NOT_TESTED')) {
    const t = await testAgainstPolicy(ideaId, idea.creatorId, { ids: [a233.id] })
    console.log(`policy test: ${JSON.stringify(t)}`)
  }

  // ── 238 ──
  const a202 = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId, number: 202 }, select: { id: true, commentary: true, source: true, title: true } })
  if ((a202.commentary ?? '').includes(MARK_238)) console.log('#202 already carries 238 — unchanged')
  else {
    const next = `${DECISION_238}\n\n${a202.commentary ?? ''}`.trim()
    console.log(`${APPLY ? 'WRITING' : 'WOULD WRITE'} #202: commentary ${a202.commentary?.length ?? 0} → ${next.length} characters`)
    if (APPLY) await prisma.$transaction([
      prisma.fieldRevision.create({
        data: { ideaId, fieldKey: 'actionCommentary', targetId: a202.id, targetNumber: 202, previousText: a202.commentary ?? '', previousSource: a202.source, newText: next, acceptedById: idea.creatorId, origin: ORIGIN_238 },
      }),
      prisma.lexCoherentAction.update({ where: { id: a202.id }, data: { commentary: next } }),
    ])
  }

  if (!APPLY) { console.log('(dry run — nothing written; pass --apply)'); return }
  // ── read back, plain client ──
  const back = await prisma.lexCoherentAction.findFirstOrThrow({ where: { id: a233!.id }, select: { number: true, practicalStep: true, commentary: true, headingId: true, policyTestVerdict: true, policyTestReason: true, source: true } })
  console.log(`READ BACK 233: #${back.number} · statement verbatim ${back.practicalStep === STATEMENT_233} · commentary as written ${back.commentary === COMMENTARY_233} · under "${HEADING}" ${back.headingId === heads[0].id} · source ${back.source}`)
  console.log(`READ BACK 233 policy test: ${back.policyTestVerdict} — ${back.policyTestReason}`)
  const b202 = await prisma.lexCoherentAction.findFirstOrThrow({ where: { id: a202.id }, select: { commentary: true } })
  console.log(`READ BACK #202: 238 at head of Commentary ${(b202.commentary ?? '').startsWith(DECISION_238)} · 232 line still below ${(b202.commentary ?? '').includes('Drafting decision (CCh, 22 Oct 2026, 232):')}`)
  console.log(`revisions kept (${ORIGIN_238}): ${await prisma.fieldRevision.count({ where: { origin: ORIGIN_238 } })}`)
}
main().finally(() => prisma.$disconnect())
