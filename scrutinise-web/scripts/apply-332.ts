// LEX 332 (CCh-Lex 7 Nov (1)) — the data half, on 452c5ade. DRY RUN by default; --apply writes, then reads every write back.
//
//   1. #207's instrument is the Code text: D.207.1 (a draft clause, never versioned — one Lex proposal, dismissed) is SET ASIDE, kept:
//      status SUPERSEDED, superseded_by = D.207.2 (the Code). Nothing is deleted; its rows stay readable.
//   2. Its useful content is OFFERED as a proposal on #59's Brief (#59 "Governed by a statutory Accountability and Delivery Code" is the
//      clause that makes the Code statutory, and has no document yet). Built from D.207.1's stored fields WORD FOR WORD — no model call,
//      nothing reworded; each point is labelled with where it came from. Every subsection, the caveat and the drafting note are carried
//      (a coverage test runs before anything is written); only the "Illustrative, not settled" banner is left out.
//   3. #207's split proposal against the Code's Brief: already written 7 Nov (D.207.2 BRIEF_PROPOSAL v1) — confirmed, not written again.
//   4. Ledger row 9900 (193): a ledger row since 29 Sep on a deleted idea with no purpose — labelled purpose 'check', flagged purposeInferred,
//      as 193's backfill labelled the others. ⚠ An inference: the row is a lex.agent.turn by the owner's account on an idea since deleted.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/apply-332.ts            (dry run: prints what would be written)
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/apply-332.ts --apply
import { prisma } from '@/lib/prisma'
import { writeBriefProposal, briefView } from '@/lib/lex/action-brief'
import { parseBrief, briefProblems, briefBody, type Brief } from '@/lib/lex/action-brief-pure'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
const APPLY = process.argv.includes('--apply')
const LEDGER_ROW = 9900

interface ClauseProposal {
  clause?: string; purpose?: string; dutyOnWhom?: string; enforcedHow?: string; commencement?: string; extent?: string[]
  precedents?: Array<{ how?: string; docUri?: string; provisionPath?: string | null }>
  provisions?: Array<{ note?: string; docUri?: string; relation?: string; provisionPath?: string | null }>
}

/** D.207.1's fields → #59's Brief. Returns the Brief and the clause lines NOT carried (must be only the banner). */
export function briefFromClause(p: ClauseProposal): { brief: Brief; dropped: string[] } {
  const lines = (p.clause ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const subsections: string[] = []
  const mustNot: string[] = []
  const notes: string[] = []
  const dropped: string[] = []
  for (const l of lines) {
    if (/^\(\d+\)/.test(l)) subsections.push(l)
    else if (/^\([a-z]\)/.test(l) && subsections.length) subsections[subsections.length - 1] += '\n' + l
    else if (/^Caveat:/.test(l)) mustNot.push(`From the earlier draft (D.207.1, set aside): ${l}`)
    else if (/^Drafting note:/.test(l)) notes.push(`From the earlier draft (D.207.1, set aside): ${l}`)
    else if (/^Accountability and Delivery Code$/.test(l)) continue // the clause's own heading — the Brief's subject, said in "must"
    else dropped.push(l)
  }
  const mustInclude = [
    ...(p.dutyOnWhom ? [`Who the duty is on (from D.207.1): ${p.dutyOnWhom}`] : []),
    ...(p.enforcedHow ? [`How it is enforced (from D.207.1): ${p.enforcedHow}`] : []),
    ...(p.commencement ? [`Commencement (from D.207.1): ${p.commencement}`] : []),
    ...(p.extent?.length ? [`Extent (from D.207.1): ${p.extent.join(', ')}`] : []),
    ...subsections.map((s) => `From the earlier draft (D.207.1, set aside), subsection ${s.match(/^\((\d+)\)/)![1]}: ${s}`),
    ...(p.precedents ?? []).map((x) => `Precedent (from D.207.1): ${x.how ?? ''} (${x.docUri ?? ''}${x.provisionPath ? ` ${x.provisionPath}` : ''})`),
    ...(p.provisions ?? []).map((x) => `Law it ${x.relation === 'relies_on' ? 'relies on' : x.relation ?? 'touches'} (from D.207.1): ${x.docUri ?? ''}${x.provisionPath ? ` ${x.provisionPath}` : ''} — ${x.note ?? ''}`),
    ...notes,
  ]
  return { brief: { must: p.purpose ?? '', modelledOn: null, tone: 'statutory', mustInclude, mustNot, kind: {} }, dropped }
}

async function main() {
  const a207 = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: IDEA, number: 207, status: 'LIVE' }, select: { id: true } })
  const a59 = await prisma.lexCoherentAction.findFirstOrThrow({ where: { ideaId: IDEA, number: 59, status: 'LIVE' }, select: { id: true, title: true } })
  const docs = await prisma.actionDocument.findMany({ where: { actionId: a207.id }, include: { versions: true } })
  const clause = docs.find((d) => d.number === 1 && d.kind === 'DRAFT_CLAUSE')
  const code = docs.find((d) => d.number === 2 && d.kind === 'CODE_TEXT')
  if (!clause || !code) throw new Error('D.207.1 (draft clause) or D.207.2 (code text) is not where it was measured — nothing written')
  const prop = clause.versions.filter((v) => v.role === 'PROPOSAL').sort((x, y) => y.v - x.v)[0]
  if (!prop) throw new Error('D.207.1 has no proposal to carry — nothing written')
  console.log(`1. D.207.1 ${clause.kind} ${clause.status}, ${clause.versions.filter((v) => v.role === 'VERSION').length} versions, proposal v${prop.v} (${prop.answer ?? 'waiting'}) → SUPERSEDED by D.207.2 (${code.kind} ${code.status})`)

  const { brief, dropped } = briefFromClause(prop.payload as ClauseProposal)
  const problems = briefProblems('DRAFT_CLAUSE', brief)
  if (problems.length) throw new Error(`#59's Brief would be refused: ${problems.join('; ')}`)
  const banner = dropped.length === 1 && /^Illustrative, not settled/.test(dropped[0])
  console.log(`2. #59 “${a59.title}”: proposed Brief — must ${brief.must.length} chars, ${brief.mustInclude.length} Must include, ${brief.mustNot.length} Must not, tone statutory`)
  console.log(`   COVERAGE: ${banner ? 'every clause line carried except the banner' : `NOT carried: ${dropped.map((l) => `“${l.slice(0, 60)}”`).join('; ')}`}`)
  if (!banner) throw new Error('coverage test failed — nothing written')
  const v59 = await briefView(IDEA, a59.id)
  const k59 = v59.ok ? v59.data.kinds.find((k) => k.kind === 'DRAFT_CLAUSE') : null
  if (!k59) throw new Error('#59 does not need a draft clause — nothing written')
  const already59 = k59.proposal != null

  const split = code.versions.find((v) => v.role === 'BRIEF_PROPOSAL' && !v.answer && (v.payload as { split?: unknown } | null)?.split)
  console.log(`3. #207's split proposal on the Code's Brief: ${split ? `WAITING (D.207.2 BRIEF_PROPOSAL v${split.v}) — not written again` : 'NOT FOUND'}`)

  const [row] = await prisma.$queryRawUnsafe<Array<{ id: number; purpose: string | null; inferred: boolean; live: boolean; pass: string }>>(
    `SELECT l.id::int id, l.purpose, l."purposeInferred" inferred, l.pass, EXISTS (SELECT 1 FROM "Idea" i WHERE i.id = l."ideaId") live FROM "LlmSpend" l WHERE l.id = ${LEDGER_ROW}`)
  console.log(`4. ledger row ${LEDGER_ROW}: pass ${row?.pass}, purpose ${row?.purpose ?? 'none'}, inferred ${row?.inferred}, idea ${row?.live ? 'LIVE' : 'deleted'}`)
  if (!row || row.live) throw new Error('ledger row not as measured — nothing written')

  if (!APPLY) { console.log('\n----- #59 Brief as proposed -----\n' + briefBody('DRAFT_CLAUSE', brief).slice(0, 2500) + '\n…\n(dry run — nothing written; --apply writes)'); return }

  if (clause.status !== 'SUPERSEDED') await prisma.actionDocument.update({ where: { id: clause.id }, data: { status: 'SUPERSEDED', supersededBy: code.id } })
  const back1 = await prisma.actionDocument.findUnique({ where: { id: clause.id }, select: { status: true, supersededBy: true, _count: { select: { versions: true } } } })
  console.log(`\nREAD BACK 1: D.207.1 ${back1?.status}, superseded by ${back1?.supersededBy === code.id ? 'D.207.2' : back1?.supersededBy}, ${back1?._count.versions} rows kept`)

  if (already59) console.log(`READ BACK 2: #59 already has a proposed Brief waiting (v${k59.proposal!.v}) — not written again`)
  else {
    const reason = 'Carried from #207’s earlier draft clause (D.207.1), set aside on 7 Nov because #207’s instrument is the Code text (332). That draft was a clause making the Accountability and Delivery Code statutory, which is this action’s subject. '
      + 'Its purpose, duty, enforcement, commencement and extent, every subsection, its precedent, the law it touches, its caveat and its drafting note are here word for word, each marked with where it came from — nothing reworded, no model call. It was never accepted: read it as material, not as settled text.'
    const w = await writeBriefProposal(IDEA, a59.id, 'DRAFT_CLAUSE', brief, { reason, pence: 0 })
    if (!w.ok) throw new Error((w as { error: string }).error)
    const r = await prisma.actionDocumentVersion.findFirst({ where: { documentId: w.data.documentId, role: 'BRIEF_PROPOSAL', v: w.data.v } })
    const b = parseBrief('DRAFT_CLAUSE', r?.payload)
    const d = await prisma.actionDocument.findUnique({ where: { id: w.data.documentId }, select: { status: true } })
    console.log(`READ BACK 2: ${w.data.d} (${d?.status}) BRIEF_PROPOSAL v${w.data.v}, answer ${r?.answer ?? 'waiting'}: must ${b.must.length} chars, ${b.mustInclude.length} Must include, ${b.mustNot.length} Must not, tone ${b.tone}`)
  }

  await prisma.$executeRawUnsafe(`UPDATE "LlmSpend" SET purpose = 'check', "purposeInferred" = true WHERE id = ${LEDGER_ROW} AND purpose IS NULL`)
  const [after] = await prisma.$queryRawUnsafe<Array<{ purpose: string | null; inferred: boolean }>>(`SELECT purpose, "purposeInferred" inferred FROM "LlmSpend" WHERE id = ${LEDGER_ROW}`)
  console.log(`READ BACK 4: ledger row ${LEDGER_ROW} purpose ${after?.purpose}, purposeInferred ${after?.inferred}`)
}
main().finally(() => prisma.$disconnect())
