// ─────────────────────────────────────────────────────────────────────────────
// 26-U §3 — "Draft this clause", FOR REAL, on a scratch copy of 452c5ade (deleted after). Prints each proposal and its measured price,
// and the line to paste into DRAFT_RUNS (lib/lex/action-draft-pure.ts). Spends: one Sonnet 5.5 call per action named.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26u-draft.ts 38 202 59
//
// ⚠ The decisions the brief fixes (220, 221, the Code) are written into the COPY's Commentary first — Lex drafts from what the record says,
// and on Charlie's own idea those lines are his to add.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { draftWithLex, draftOfAction } from '../lib/lex/action-draft'
import { touchesFor, STATE_WORDS } from '../lib/lex/action-touches'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const NUMBERS = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n))
const DECISIONS: Record<number, string> = {
  38: 'Drafting decisions (CCh, 22 Oct 2026): 220 — “publicly funded body” means a public authority listed in Schedule 1 to the Freedom of Information Act 2000, and a contracting authority within the Procurement Act 2023 in respect of work done under contract, with a power to extend by order; commencement phased: departments, then arm’s-length bodies, then the rest; the condition-of-funding mechanism is a financial action, not drafted here. 221 — the goal statement is published; the full accountability record is visible up the line, to Parliament and to the National Audit Office.',
  59: 'Drafting decision (CCh, 22 Oct 2026): the Code is issued by the Minister for the Civil Service and laid before Parliament; it may be changed only to improve the service in line with the general principles; the Code itself is held to the brevity test.',
}

async function main() {
  if (!NUMBERS.length) throw new Error('name the action numbers to draft')
  const copy = await scratchCopy('452c5ade', '26u-draft')
  try {
    for (const [n, text] of Object.entries(DECISIONS)) {
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: Number(n) }, select: { id: true, commentary: true } })
      if (a) await prisma.lexCoherentAction.update({ where: { id: a.id }, data: { commentary: `${text}\n\n${a.commentary ?? ''}`.trim() } })
    }
    const runs: Array<{ pence: number; seconds: number }> = []
    for (const n of NUMBERS) {
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: n, status: 'LIVE' }, select: { id: true, title: true } })
      if (!a) { console.log(`#${n}: not a live action on the copy`); continue }
      const r = await draftWithLex(copy.id, a.id, copy.userId)
      if (!r.ok) { console.log(`#${n}: FAILED — ${'error' in r ? r.error : ''}`); continue }
      runs.push({ pence: r.data.pence ?? NaN, seconds: r.data.seconds })
      const p = (await draftOfAction(a.id))!.proposal! // 26-V1: the draft lives in the documents store
      console.log(`\n══ #${n} ${a.title ?? ''} — ${r.data.pence?.toFixed(2)}p, ${r.data.seconds}s; OPC parts ${r.data.held.opc}, precedents held ${r.data.held.precedents}${r.data.notes.length ? `; notes: ${r.data.notes.join('; ')}` : ''}`)
      console.log(`instrument ${p.instrument} · duty on ${p.dutyOnWhom} · enforced ${p.enforcedHow} · commencement ${p.commencement} · extent ${p.extent.join(', ')}`)
      console.log('provisions:', p.provisions.map((x) => `${x.relation} ${x.docUri}${x.provisionPath ? ` ${x.provisionPath}` : ''}`).join(' | '))
      console.log('precedents:', p.precedents.map((x) => `${x.docUri}${x.provisionPath ? ` ${x.provisionPath}` : ''} (${x.how})`).join(' | '))
      console.log('citations:', p.citations.join(', '))
      console.log('reason:', p.reason)
      console.log('CLAUSE:\n' + p.clause)
      const t = await touchesFor(p)
      console.log('touches:', t.touches.map((x) => `${x.line.docUri}${x.line.provisionPath ? ` ${x.line.provisionPath}` : ''} → ${STATE_WORDS[x.state]}${x.effects ? ` · ${x.effects.headline}` : ''}${x.near.length ? ` · near: ${x.near.map((y) => y.number).join(',')}` : ''}`).join('\n         '))
    }
    const good = runs.filter((x) => Number.isFinite(x.pence))
    if (good.length) console.log(`\nPASTE into DRAFT_RUNS: ${good.map((p) => `{ pence: ${p.pence.toFixed(2)}, seconds: ${p.seconds}, on: 'scratch copy of 452c5ade, ${new Date().toISOString().slice(0, 10)}' }`).join(', ')}`)
  } finally { await deleteScratch(copy.id); await prisma.$disconnect() }
}
main()
