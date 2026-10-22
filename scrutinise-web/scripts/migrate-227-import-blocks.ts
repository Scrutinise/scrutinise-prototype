// ─────────────────────────────────────────────────────────────────────────────
// 26-U §2.1 (decision 227) — move every "— More on this action, imported …" / "— A component of this action, imported …" block OUT of
// an action's statement and INTO its Commentary, under "Parts of this action, quoted", verbatim. The statement keeps only what was
// there before the first block. Nothing is deleted: the pre-migration statement is kept as a FieldRevision, in the same transaction.
//
//   npx tsx --env-file=.env scripts/migrate-227-import-blocks.ts            (dry run: counts only, writes nothing)
//   npx tsx --env-file=.env scripts/migrate-227-import-blocks.ts --apply    (writes, then reads back)
//
// Read back: no live statement over the limit; per idea, actions changed and blocks moved; every block found verbatim in the commentary.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { splitImportedBlocks, addImportedBlocks } from '../lib/lex/action-resort-pure'
import { LIMITS } from '../lib/lex/input-limits'

const APPLY = process.argv.includes('--apply')
/** `--idea <id>` limits the run to one idea (used to try it on a scratch copy first). */
const ONLY = process.argv.includes('--idea') ? process.argv[process.argv.indexOf('--idea') + 1] : null
const ORIGIN = 'IMPORT_BLOCKS_TO_COMMENTARY_227'

async function main() {
  const rows = await prisma.lexCoherentAction.findMany({
    where: { practicalStep: { contains: ', imported 20' }, ...(ONLY ? { ideaId: ONLY } : {}) },
    select: { id: true, ideaId: true, number: true, status: true, source: true, practicalStep: true, commentary: true, idea: { select: { creatorId: true } } },
  })
  const perIdea = new Map<string, { actions: number; blocks: number; wasOver: number; stillOver: number[] }>()
  const done: Array<{ id: string; blocks: string[]; statement: string }> = []
  for (const r of rows) {
    const { statement, blocks } = splitImportedBlocks(r.practicalStep)
    if (!blocks.length) continue
    const e = perIdea.get(r.ideaId) ?? { actions: 0, blocks: 0, wasOver: 0, stillOver: [] }
    e.actions++; e.blocks += blocks.length
    if (r.practicalStep.length > LIMITS.actionStatement) e.wasOver++
    if (statement.length > LIMITS.actionStatement) e.stillOver.push(r.number ?? -1)
    perIdea.set(r.ideaId, e)
    if (!APPLY) continue
    await prisma.$transaction([
      prisma.fieldRevision.create({
        data: {
          ideaId: r.ideaId, fieldKey: 'actions', targetId: r.id, targetNumber: r.number,
          previousText: r.practicalStep, previousSource: r.source, newText: statement, acceptedById: r.idea.creatorId, origin: ORIGIN,
        },
      }),
      prisma.lexCoherentAction.update({ where: { id: r.id }, data: { practicalStep: statement, commentary: addImportedBlocks(r.commentary, blocks) } }),
    ])
    done.push({ id: r.id, blocks, statement })
  }
  for (const [idea, e] of perIdea) console.log(`${APPLY ? 'MOVED' : 'WOULD MOVE'} idea ${idea.slice(0, 8)}: ${e.actions} actions, ${e.blocks} blocks; ${e.wasOver} were over ${LIMITS.actionStatement}; still over after: ${e.stillOver.length ? e.stillOver.map((n) => `#${n}`).join(', ') : 'none'}`)
  if (!perIdea.size) console.log('nothing to move')
  if (!APPLY) { console.log('(dry run — nothing written; pass --apply)'); return }

  // ── read back ──
  let verbatim = 0, missing = 0
  for (const d of done) {
    const now = await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: d.id }, select: { practicalStep: true, commentary: true } })
    for (const b of d.blocks) (now.commentary ?? '').includes(b) ? verbatim++ : missing++
    if (now.practicalStep !== d.statement) missing++
  }
  const over = await prisma.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int n FROM "LexCoherentAction" WHERE status = 'LIVE' AND length("practicalStep") > ${LIMITS.actionStatement}`
  const revs = await prisma.fieldRevision.count({ where: { origin: ORIGIN } })
  const left = await prisma.lexCoherentAction.count({ where: { practicalStep: { contains: ', imported 20' } } })
  console.log(`READ BACK: ${verbatim} blocks found verbatim in commentary, ${missing} missing; live statements over ${LIMITS.actionStatement}: ${over[0].n}; revisions kept (${ORIGIN}): ${revs}; statements still holding an imported block: ${left}`)
}
main().finally(() => prisma.$disconnect())
