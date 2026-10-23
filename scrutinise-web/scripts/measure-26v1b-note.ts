// ─────────────────────────────────────────────────────────────────────────────
// 26-V1b §5 — "Draft the explanatory note", FOR REAL, on a scratch copy of 452c5ade (deleted after). Prints each note and its measured price,
// and the line to paste into NOTE_RUNS (lib/lex/explanatory-note-pure.ts). Spends: one Sonnet 5.5 call per run.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26v1b-note.ts
//
// ⚠ A scratch copy carries the actions but not their documents, so each run's CLAUSE is read from 452c5ade itself — READ ONLY — and the note
// is composed with `composeNote`, which writes nothing. The spend is recorded against the copy, never against Charlie's idea.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { composeNote } from '../lib/lex/explanatory-note'
import { parseDraft } from '../lib/lex/action-draft-pure'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade'
// #38's version 1 (used by Charlie), #202's proposal 2 (textual + non-textual) and proposal 1 (an insertion at the end)
const RUNS: Array<{ n: number; role: 'VERSION' | 'PROPOSAL'; v: number }> = [{ n: 38, role: 'VERSION', v: 1 }, { n: 202, role: 'PROPOSAL', v: 2 }, { n: 202, role: 'PROPOSAL', v: 1 }]

async function main() {
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE } }, select: { id: true } })
  if (!src) throw new Error(`no idea ${SOURCE}`)
  const copy = await scratchCopy(SOURCE, '26v1b-note')
  const out: Array<{ pence: number; seconds: number; label: string }> = []
  try {
    for (const r of RUNS) {
      const [row] = await prisma.$queryRawUnsafe<Array<{ payload: unknown }>>(`
        SELECT v.payload FROM action_document d JOIN "LexCoherentAction" a ON a.id = d.action_id JOIN action_document_version v ON v.document_id = d.id
        WHERE d.idea_id = $1 AND d.kind = 'DRAFT_CLAUSE' AND a.number = $2 AND v.role = $3 AND v.v = $4`, src.id, r.n, r.role, r.v)
      if (!row) { console.log(`#${r.n} ${r.role} ${r.v}: not found`); continue }
      const ins = { ...parseDraft({ versions: [{ ...(row.payload as object), v: r.v }] })!.versions[0] }
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: r.n }, select: { number: true, title: true, practicalStep: true, commentary: true } })
      if (!a) { console.log(`#${r.n}: not on the copy`); continue }
      const res = await composeNote({ number: a.number, title: a.title, statement: a.practicalStep, detail: a.commentary, instruction: ins }, { ideaId: copy.id, userId: copy.userId })
      if (!res.ok) { console.log(`#${r.n}: FAILED — ${'error' in res ? res.error : ''}`); continue }
      const label = `#${r.n} ${r.role.toLowerCase()} ${r.v}`
      out.push({ pence: res.data.pence ?? NaN, seconds: res.data.seconds, label })
      console.log(`\n══ ${label} — ${res.data.pence?.toFixed(2)}p, ${res.data.seconds}s\nreason: ${res.data.reason}\n${res.data.body}`)
    }
    const good = out.filter((x) => Number.isFinite(x.pence))
    if (good.length) console.log(`\nPASTE into NOTE_RUNS:\n${good.map((p) => `  { pence: ${p.pence.toFixed(2)}, seconds: ${p.seconds}, on: 'scratch copy of 452c5ade, ${new Date().toISOString().slice(0, 10)} (${p.label})' },`).join('\n')}`)
  } finally { await deleteScratch(copy.id); await prisma.$disconnect() }
}
main()
