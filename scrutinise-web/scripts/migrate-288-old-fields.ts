// ─────────────────────────────────────────────────────────────────────────────
// 288 (CCh-Lex 28 Oct (5), replacing (4)) — the retired fields on all 15 of Charlie's ideas:
//   · Target organisation → the action's Who (`whoImplements`) where Who is empty; otherwise into its Action details (`commentary`)
//     under "## Moved from the old fields on 28 Oct", above "Parts of this action, quoted". A FieldRevision is written FIRST, in
//     the same transaction, every time.
//   · Mechanism → NOT moved (hidden from the screen, column kept). Intended wording → nothing (0 actions hold any).
//   · UNDO OF THE (4) RUN: (4) had copied Mechanism (and Target) into the Explanation on 73 actions (origin
//     OLD_FIELDS_TO_EXPLANATION_288). Where an action's commentary is still exactly what that run wrote, it is put back to what it
//     was before — itself with a FieldRevision first (origin OLD_FIELDS_288_UNDONE). A commentary edited since is reported, not touched.
// Nothing is deleted: the three columns keep their values. Idempotent.
//
//   npx tsx --env-file=.env scripts/migrate-288-old-fields.ts            (dry run: counts per idea, writes nothing)
//   npx tsx --env-file=.env scripts/migrate-288-old-fields.ts --apply    (writes, then reads back)
//   … --idea <id-prefix>                                                  (one idea only)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { LIVE_IDEA } from '../lib/lex/idea-visibility'
import { detailParts, withOwnText } from '../lib/lex/record-layout-pure'

const APPLY = process.argv.includes('--apply')
const ONLY = process.argv.includes('--idea') ? process.argv[process.argv.indexOf('--idea') + 1] : null
const ORIGIN_4 = 'OLD_FIELDS_TO_EXPLANATION_288'
const ORIGIN_UNDO = 'OLD_FIELDS_288_UNDONE'
const ORIGIN_WHO = 'TARGET_ORG_TO_WHO_288'
const ORIGIN_DETAILS = 'TARGET_ORG_TO_ACTION_DETAILS_288'
const MOVED_HEADING = '## Moved from the old fields on 28 Oct'

const oneLine = (s: string) => s.trim().replace(/\r\n/g, '\n').replace(/\n+/g, ' ')

async function main() {
  const rows = await prisma.lexCoherentAction.findMany({
    where: { idea: LIVE_IDEA, ...(ONLY ? { ideaId: { startsWith: ONLY } } : {}) },
    select: {
      id: true, ideaId: true, number: true, source: true, commentary: true, whoImplements: true, targetOrganisation: true,
      idea: { select: { creatorId: true, title: true } },
    },
    orderBy: [{ ideaId: 'asc' }, { number: 'asc' }],
  })
  const firstRun = await prisma.fieldRevision.findMany({
    where: { origin: ORIGIN_4, targetId: { in: rows.map((r) => r.id) } },
    orderBy: { createdAt: 'asc' }, select: { targetId: true, previousText: true, newText: true },
  })
  const runOf = new Map(firstRun.map((f) => [f.targetId!, f]))

  type Tally = { title: string; undone: number; editedSince: number[]; toWho: number; toDetails: number }
  const perIdea = new Map<string, Tally>()
  const expect: Array<{ id: string; commentary: string | null; who: string | null }> = []
  for (const r of rows) {
    const t = perIdea.get(r.ideaId) ?? { title: r.idea.title ?? '(untitled)', undone: 0, editedSince: [], toWho: 0, toDetails: 0 }
    let commentary = r.commentary
    let who = r.whoImplements
    const writes: Array<ReturnType<typeof prisma.fieldRevision.create>> = []

    // ── 1. put back what the (4) run wrote ──
    const prior = runOf.get(r.id)
    // only a (4) result that carries a Mechanism line differs from what (5) wants; one with Target alone is already (5)'s result
    if (prior && commentary === prior.newText && prior.newText.includes('**Mechanism:**')) {
      const back = prior.previousText || null
      writes.push(prisma.fieldRevision.create({ data: { ideaId: r.ideaId, fieldKey: 'actionCommentary', targetId: r.id, targetNumber: r.number, previousText: commentary ?? '', previousSource: r.source, newText: back ?? '', acceptedById: r.idea.creatorId, origin: ORIGIN_UNDO } }))
      commentary = back
      t.undone++
    } else if (prior && (commentary ?? '').includes('**Mechanism:**')) t.editedSince.push(r.number ?? -1)

    // ── 2. Target organisation → Who where empty, else Action details ──
    const target = r.targetOrganisation?.trim() ? oneLine(r.targetOrganisation) : null
    if (target && who !== target && !(commentary ?? '').includes(`**Target organisation:** ${target}`)) {
      if (!who?.trim()) {
        writes.push(prisma.fieldRevision.create({ data: { ideaId: r.ideaId, fieldKey: 'actionWhoImplements', targetId: r.id, targetNumber: r.number, previousText: who ?? '', previousSource: r.source, newText: target, acceptedById: r.idea.creatorId, origin: ORIGIN_WHO } }))
        who = target
        t.toWho++
      } else {
        const own = detailParts(commentary).text
        const section = `${MOVED_HEADING}\n\n- **Target organisation:** ${target}`
        const next = withOwnText(commentary, own ? `${own}\n\n${section}` : section)
        writes.push(prisma.fieldRevision.create({ data: { ideaId: r.ideaId, fieldKey: 'actionCommentary', targetId: r.id, targetNumber: r.number, previousText: commentary ?? '', previousSource: r.source, newText: next ?? '', acceptedById: r.idea.creatorId, origin: ORIGIN_DETAILS } }))
        commentary = next
        t.toDetails++
      }
    }
    if (!writes.length) continue
    perIdea.set(r.ideaId, t)
    expect.push({ id: r.id, commentary, who })
    if (APPLY) await prisma.$transaction([...writes, prisma.lexCoherentAction.update({ where: { id: r.id }, data: { commentary, whoImplements: who } })] as never)
  }

  for (const [idea, t] of perIdea) {
    console.log(`${APPLY ? 'DONE' : 'WOULD DO'} ${idea.slice(0, 8)} "${t.title.slice(0, 50)}": (4)-run put back ${t.undone}; Target organisation → Who ${t.toWho}, → Action details ${t.toDetails}${t.editedSince.length ? `; edited since the (4) run, NOT touched: ${t.editedSince.map((n) => `#${n}`).join(', ')}` : ''}`)
  }
  console.log(`TOTAL: ${expect.length} actions on ${perIdea.size} ideas`)
  if (!APPLY) { console.log('(dry run — nothing written; pass --apply)'); return }

  // ── read back, plain client ──
  let same = 0, differ = 0
  for (const e of expect) {
    const now = await prisma.lexCoherentAction.findUniqueOrThrow({ where: { id: e.id }, select: { commentary: true, whoImplements: true } })
    now.commentary === e.commentary && now.whoImplements === e.who ? same++ : differ++
  }
  const leftover = await prisma.lexCoherentAction.count({ where: { idea: LIVE_IDEA, commentary: { contains: '**Mechanism:**' } } })
  console.log(`READ BACK: ${same} actions as written, ${differ} differ; live actions whose details still carry a moved Mechanism line: ${leftover}`)
}
main().finally(() => prisma.$disconnect())
