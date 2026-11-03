// ─────────────────────────────────────────────────────────────────────────────
// 26-W §5 / decision 305 — the clean-up of #207 on 452c5ade (Charlie's idea).
//
// On 2 Nov 00:07–00:08 UTC Lex wrote a four-part draft Code into #207's Action details with add_action_details_section (append only:
// `current.trim() + "\n\n" + section`), because it had no tool for documents. This script:
//   1. copies the four sections, in order and verbatim, into a Lex PROPOSAL on #207's CODE TEXT document, through writeTextProposal —
//      the writer "Draft what this action needs" uses — so the document view offers Use it / Edit / Set aside. (Not onto D.207.1: that
//      is the DRAFT_CLAUSE document, whose proposals are read as a drafting instruction and cannot be "used" as text. See the report.)
//   2. keeps a FieldRevision holding the 33,554-character state (previousText) and the restored state (newText), then
//   3. restores Action details to the text before the first section — the 00:07 content, proven by the tool log's own lengths.
// Guards: aborts unless the Action details are exactly the 2 Nov 00:08:51 state (length, updatedAt, the four headings, the arithmetic).
// Step 1 runs before steps 2–3, so a failure part-way leaves the text in BOTH places, never in neither. Nothing is deleted.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/apply-26w-305.ts            (dry run: prints what it would do)
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/apply-26w-305.ts --write
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { writeTextProposal } from '../lib/lex/action-documents'
import { refsIn } from '../lib/lex/action-digest-pure'
import { TEMPLATES } from '../lib/lex/document-drafting-pure'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
const WRITE = process.argv.includes('--write')
const EXPECT = { total: 33554, before: 17946, sections: [3120, 4330, 4753, 3397], updatedAt: '2026-11-02T00:08:51.765Z' }
const FIRST = '## DRAFT CODE FOR APPROVAL (1 of 4)'
const ORIGIN = 'LEX_26W_305_MOVED_TO_DOCUMENT'
const REASON = 'Lex’s draft from chat, 2 Nov. Lex wrote these four sections into the Action details of #207 at 00:08 UTC on 2 November 2026, because it then had no tool for documents. They are moved here unchanged, as Lex’s proposal, and the Action details are put back as they were at 00:07. Not a fresh draft: no model was called.'

async function main() {
  const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: IDEA, number: 207 }, select: { id: true, number: true, source: true, commentary: true, updatedAt: true, idea: { select: { creatorId: true } } } })
  if (!a) throw new Error('#207 not found on 452c5ade')
  const c = a.commentary ?? ''
  const idx = c.indexOf(FIRST)
  const before = c.slice(0, idx).trimEnd()
  const sectionsText = c.slice(idx)
  const parts = sectionsText.split(/\n\n(?=## DRAFT CODE FOR APPROVAL \(\d of 4\))/)
  const problems: string[] = []
  if (c.length !== EXPECT.total) problems.push(`Action details are ${c.length} characters, expected ${EXPECT.total}`)
  if (a.updatedAt.toISOString() !== EXPECT.updatedAt) problems.push(`#207 was changed at ${a.updatedAt.toISOString()}, after Lex's write at ${EXPECT.updatedAt}`)
  if (idx < 0) problems.push('the first draft-Code heading is not there')
  if (before.length !== EXPECT.before) problems.push(`text before the sections is ${before.length}, expected ${EXPECT.before} (the tool log's 21,068 − 3,120 − 2)`)
  if (`${before}\n\n${sectionsText}` !== c) problems.push('before + "\\n\\n" + sections does not rebuild the field exactly')
  if (parts.length !== 4 || parts.some((p, i) => p.length !== EXPECT.sections[i])) problems.push(`sections are ${parts.map((p) => p.length).join(', ')}, expected ${EXPECT.sections.join(', ')}`)
  console.log(`#207 ${a.id}: ${c.length} chars; before ${before.length}; sections ${parts.map((p) => p.length).join(' + ')} = ${sectionsText.length}`)
  if (problems.length) { console.log('ABORT, nothing written:\n - ' + problems.join('\n - ')); process.exitCode = 1; return }
  const existing = await prisma.actionDocument.findMany({ where: { actionId: a.id }, select: { number: true, kind: true, status: true } })
  console.log('documents on #207 now:', existing.map((d) => `D.207.${d.number} ${d.kind} ${d.status}`).join('; '))
  if (!WRITE) { console.log('dry run — pass --write'); return }

  // 1 — the proposal first: from here on the text is in two places, never in none.
  const w = await writeTextProposal(IDEA, a.id, 'CODE_TEXT', TEMPLATES.CODE_TEXT.title, { body: sectionsText, reason: REASON, pence: null, sources: refsIn(sectionsText), payload: { movedFrom: 'actionCommentary', actionNumber: 207, writtenAt: EXPECT.updatedAt, brief: '26-W 305' } })
  console.log(`proposal written: ${w.d} proposal ${w.v} (document ${w.documentId})`)

  // 2–3 — revision, then the restore, in one transaction, guarded on the row not having moved in the meantime.
  const rev = await prisma.$transaction(async (tx) => {
    const now = await tx.lexCoherentAction.findUnique({ where: { id: a.id }, select: { commentary: true, updatedAt: true } })
    if (now?.commentary !== c || now.updatedAt.toISOString() !== EXPECT.updatedAt) throw new Error('#207 changed while this ran; the proposal is written, the Action details are NOT restored')
    const r = await tx.fieldRevision.create({ data: { ideaId: IDEA, fieldKey: 'actionCommentary', targetId: a.id, targetNumber: a.number, previousText: c, previousSource: 'LEX', newText: before, acceptedById: a.idea.creatorId, origin: ORIGIN } })
    await tx.lexCoherentAction.update({ where: { id: a.id }, data: { commentary: before } })
    return r
  })
  console.log(`FieldRevision ${rev.id} (${ORIGIN}); Action details restored to ${before.length} characters`)
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
