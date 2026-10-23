// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V1 §2a — 26-U's drafting instructions MOVE into the documents store (no second store).
//
// For every action (any status) whose record carries `draft`:
//   1. its draft-clause document (N.1) is created with every version, in order, with the original time and author, and the waiting
//      proposal beside them (as a PROPOSAL, unanswered);
//   2. it is READ BACK through draftsFor and compared with the stored draft field by field — any difference stops the move for that action;
//   3. only then is `record.draft` renamed `draftBefore26V` (kept, frozen; nothing reads it), so no reader can see a stale second copy.
// Then, for live actions whose current instruction names provisions, the collision report (N.2) is generated — free, no model call.
// And 233: #203 on 452c5ade is set to hold the consequential schedule, and the schedule is generated.
//
// ⚠ 26-U recorded a version's writer only as USER or LEX. A USER version is migrated as OWNER: the owner or a collaborator, not recorded.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/migrate-26v-drafts.ts            (dry run: counts, nothing written)
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/migrate-26v-drafts.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { parseRecord } from '../lib/lex/action-record'
import { parseDraft, currentVersion } from '../lib/lex/action-draft-pure'
import { draftsFor, generateCollisionReport, generateSchedule, setNeeds } from '../lib/lex/action-documents'

const APPLY = process.argv.includes('--apply')
// Compared without the time (stored as an ISO string, read back from a timestamp) and with pence to 6 places: the record held a float
// (12.133768000000002) and NUMERIC returns the decimal (12.133768). `v` / `by` are compared on versions; a proposal must have neither.
const strip = (x: Record<string, unknown>) => { const { at: _a, v: _v, by: _b, pence, ...rest } = x; void _a; void _v; void _b; return { ...rest, ...(pence !== undefined ? { pence: pence == null ? null : Math.round(Number(pence) * 1e6) / 1e6 } : {}) } }

async function main() {
  const rows = await prisma.lexCoherentAction.findMany({ select: { id: true, ideaId: true, number: true, status: true, avenue: true, record: true } })
  const withDraft = rows.filter((r) => parseDraft((r.record as { draft?: unknown } | null)?.draft))
  // An action whose record still carries `draft` is not moved yet, even if its document exists (a read-back that failed last time):
  // its document is verified again rather than written twice.
  const already = new Set((await prisma.actionDocument.findMany({ where: { kind: 'DRAFT_CLAUSE' }, select: { actionId: true } })).map((d) => d.actionId))
  const todo = withDraft
  const versions = todo.reduce((s, r) => s + (parseDraft((r.record as { draft?: unknown }).draft)?.versions.length ?? 0), 0)
  const proposals = todo.filter((r) => parseDraft((r.record as { draft?: unknown }).draft)?.proposal).length
  console.log(`actions whose record still carries a 26-U draft: ${withDraft.length} (on ${new Set(withDraft.map((r) => r.ideaId)).size} ideas); of them with a document already written (verify only): ${withDraft.filter((r) => already.has(r.id)).length}; ${versions} versions, ${proposals} waiting proposals`)
  if (!APPLY) { console.log('(dry run — nothing written; pass --apply)'); return }

  let moved = 0, failed = 0
  for (const r of todo) {
    const d = parseDraft((r.record as { draft?: unknown }).draft)!
    if (!already.has(r.id)) await prisma.$transaction(async (tx) => {
      const top = await tx.actionDocument.aggregate({ where: { actionId: r.id }, _max: { number: true } })
      const doc = await tx.actionDocument.create({ data: { ideaId: r.ideaId, actionId: r.id, kind: 'DRAFT_CLAUSE', title: r.avenue === 'LEGISLATIVE' ? 'Drafting instruction and clause' : 'Drafting instruction and wording', number: (top._max.number ?? 0) + 1 } })
      for (const v of d.versions) {
        const { v: _n, by, at, ...ins } = v
        void _n
        await tx.actionDocumentVersion.create({ data: { documentId: doc.id, role: 'VERSION', v: v.v, author: by === 'LEX' ? 'LEX' : 'OWNER', body: ins.clause || ins.plainWording, payload: ins as never, sources: ins.citations as never, ...(at ? { createdAt: new Date(at) } : {}) } })
      }
      if (d.proposal) {
        const { at, reason, pence, ...ins } = d.proposal
        await tx.actionDocumentVersion.create({ data: { documentId: doc.id, role: 'PROPOSAL', v: 1, author: 'LEX', body: ins.clause || ins.plainWording, payload: ins as never, sources: ins.citations as never, reason, pence: pence ?? null, ...(at ? { createdAt: new Date(at) } : {}) } })
      }
    })
    // Read back through the store's own reader and compare, field by field.
    const back = (await draftsFor([r.id])).get(r.id)
    const same = !!back && back.versions.length === d.versions.length
      && back.versions.every((v, i) => v.v === d.versions[i].v && v.by === d.versions[i].by && JSON.stringify(strip(v as never)) === JSON.stringify(strip(d.versions[i] as never)))
      && !!back.proposal === !!d.proposal
      && (!d.proposal || (JSON.stringify(strip(back.proposal as never)) === JSON.stringify(strip(d.proposal as never)) && back.proposal!.reason === d.proposal.reason
        && !('v' in (back.proposal as object)) && !('by' in (back.proposal as object))))
    if (!same) { failed++; console.log(`✗ #${r.number} (${r.id.slice(0, 8)}): read-back differs — record.draft LEFT IN PLACE`); continue }
    const rec = parseRecord(r.record) as Record<string, unknown>
    rec.draftBefore26V = rec.draft
    delete rec.draft
    await prisma.lexCoherentAction.update({ where: { id: r.id }, data: { record: rec as Prisma.InputJsonValue } })
    moved++
    console.log(`✓ #${r.number} (${r.ideaId.slice(0, 8)}): ${d.versions.length} version(s)${d.proposal ? ' + 1 proposal' : ''} moved and read back identical`)
  }
  console.log(`moved ${moved}, read-back failures ${failed}`)

  // N.2 — the collision report, for every live drafted action whose current instruction names provisions.
  const drafts = await draftsFor(withDraft.filter((r) => r.status === 'LIVE').map((r) => r.id))
  for (const r of withDraft.filter((x) => x.status === 'LIVE')) {
    const cur = currentVersion(drafts.get(r.id))
    if (!cur || !cur.provisions.some((p) => p.relation !== 'precedent')) continue
    const g = await generateCollisionReport(r.ideaId, r.id)
    console.log('error' in g ? `  ✗ #${r.number}: ${g.error}` : `  collision report ${g.data.d}: ${g.data.rows} row(s)${g.data.unchanged ? ', unchanged' : `, version ${g.data.v}`}`)
  }

  // 233 — #203 on 452c5ade holds the consequential schedule.
  const idea = (await prisma.$queryRaw<Array<{ id: string; creatorId: string }>>`SELECT id, "creatorId" FROM "Idea" WHERE id LIKE '452c5ade%'`)[0]
  const holder = idea && (await prisma.lexCoherentAction.findFirst({ where: { ideaId: idea.id, number: 203, status: 'LIVE' }, select: { id: true, practicalStep: true } }))
  if (holder?.practicalStep.startsWith('A Schedule of consequential amendments and repeals')) {
    const s = await setNeeds(idea.id, holder.id, { mode: 'set', kinds: ['CONSEQUENTIAL_SCHEDULE'], reason: 'decision 233: this action holds the consequential schedule' }, idea.creatorId)
    console.log('error' in s ? `  ✗ #203: ${s.error}` : '  #203 set to hold the consequential schedule')
    const g = await generateSchedule(idea.id)
    console.log('error' in g ? `  ✗ schedule: ${g.error}` : `  schedule ${g.data.d}: ${g.data.rows} row(s)`)
  } else console.log('  #203 not found as the schedule action — not set')
}
main().finally(() => prisma.$disconnect())
