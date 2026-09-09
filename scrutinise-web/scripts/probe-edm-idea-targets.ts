/**
 * probe-edm-idea-targets.ts — BRIEF_INGEST_EDM_SIGNATURES §3: WHICH real idea has a MOTION as its
 * target, and how many actors does its positions surface show?
 *
 * ⚠ READ-ONLY. Nothing is written; `filePositionsForIdea` is not called, because it writes
 * EvidenceItem rows. This calls the same two functions it calls — `extractPhrasesFrom` and
 * `findTargetsByPhrases` — and then `positionsFor`, so the number reported is the number the surface
 * would show and not an approximation of it.
 *
 * ⚠ IT MUST BE RUN BEFORE AND AFTER THE LOAD. §3's prediction is "1 actor → roughly 35", and a
 * measurement of the AFTER alone cannot say whether the before was 1.
 *
 * Usage (from scrutinise-web):
 *   tsx --env-file=.env scripts/probe-edm-idea-targets.ts
 *   tsx --env-file=.env scripts/probe-edm-idea-targets.ts --idea <id>
 */
import { prisma } from '@/lib/prisma'
import { extractPhrasesFrom } from '@/lib/graph/phrases'
import { findTargetsByPhrases, positionsFor, parseTarget, type PositionTarget } from '@/lib/graph/positions'
import { positionForDocument, renderPositionBody } from '@/lib/graph/position-block'

const argv = process.argv.slice(2)
const ONE = (() => { const i = argv.indexOf('--idea'); return i >= 0 ? argv[i + 1] : null })()
/** The idea surface's own default (position-block.ts: `opts.limit ?? 5`). */
const SURFACE_LIMIT = 5

async function main() {
  const ideas = await prisma.idea.findMany({
    where: ONE ? { id: ONE } : {},
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: ONE ? 1 : 80,
  })
  console.log(`\n════ ${ideas.length} ideas ${'═'.repeat(60)}`)

  const rows: Array<{ id: string; title: string; target: string; label: string; matched: number; shown: number; note: string | null }> = []
  for (const idea of ideas) {
    const el = await prisma.ideaElicitation.findUnique({
      where: { ideaId: idea.id }, select: { problem: true, goalDetail: true },
    })
    const phrases = extractPhrasesFrom(idea.title ?? '', `${el?.problem ?? ''} ${el?.goalDetail ?? ''}`.trim())
    if (!phrases.length) continue
    const matches = await findTargetsByPhrases(phrases, 1)
    if (!matches.length) continue
    const m = matches[0]
    const target = parseTarget(`${m.type}:${m.id}`)
    if (!target) continue
    const res = await positionsFor([target as PositionTarget], {
      limit: SURFACE_LIMIT, actorKind: 'person', maxGroundsPerActor: 12,
    })
    rows.push({
      id: idea.id, title: (idea.title ?? '').slice(0, 46), target: `${m.type}:${m.id}`,
      label: String(m.label ?? '').slice(0, 44), matched: res.ranking.ofMatched,
      shown: res.actors.length, note: res.ranking.note,
    })
  }

  const edms = rows.filter((r) => r.target.startsWith('edm:'))
  console.log(`\n   ideas that resolve to a target        ${rows.length}`)
  console.log(`   of those, whose target is a MOTION    ${edms.length}   ← §3 needs one of these`)
  console.log(`   whose target is a division            ${rows.length - edms.length}`)

  const show = (list: typeof rows, title: string) => {
    if (!list.length) return
    console.log(`\n   ── ${title} ──`)
    console.log(`   ${'target'.padEnd(16)}${'actors'.padEnd(8)}${'shown'.padEnd(7)}${'idea'.padEnd(48)}matched target`)
    for (const r of list) {
      console.log(`   ${r.target.padEnd(16)}${String(r.matched).padEnd(8)}${String(r.shown).padEnd(7)}${r.title.padEnd(48)}${r.label}`)
      if (r.note) console.log(`      ranking note: ${r.note}`)
    }
  }
  show(edms, 'MOTION targets — the ones this sprint changes')
  show(rows.filter((r) => !r.target.startsWith('edm:')).slice(0, 10), 'division targets, for contrast (first 10)')

  console.log(`\n   ⚠ EVERY MOTION TARGET ABOVE, for --motions on the sweep:`)
  console.log(`     ${[...new Set(edms.map((r) => r.target.split(':')[1]))].join(',')}`)

  if (edms.length) {
    const best = edms.reduce((a, b) => (a.matched >= b.matched ? a : b))
    console.log(`\n   ⚠ THE NAMED IDEA TO SCORE §3's PREDICTION AGAINST (the most actors of the motion set):`)
    console.log(`     idea   ${best.id}`)
    console.log(`     title  ${best.title}`)
    console.log(`     target ${best.target}  "${best.label}"`)
    console.log(`     actors with a recorded position: ${best.matched}   (the surface shows ${best.shown} of them)`)

    // ⚠⚠ §3's THIRD BULLET, RENDERED RATHER THAN ASSERTED. "Check the ranking sentence still travels"
    // cannot be answered by looking at `ranking.note`: `renderPositionBody` prints the sentence only
    // when `ofMatched > shown`, and with one actor and a limit of five that is FALSE — correctly, and
    // indistinguishably from the SURFACE 4 bug where the sentence was computed and thrown away. The
    // only way to tell those apart is to render the paragraph and look for the words.
    const target = parseTarget(best.target)!
    const res = await positionsFor([target as PositionTarget], {
      limit: SURFACE_LIMIT, actorKind: 'person', maxGroundsPerActor: 4,
    })
    const el = await prisma.ideaElicitation.findUnique({ where: { ideaId: best.id }, select: { problem: true } })
    const ctx = {
      targetLabel: best.label, targetKey: best.target,
      matchedPhrase: '(as matched above)', matchedWords: 2,
      asOf: new Date().toISOString().slice(0, 10),
    }
    const ranking = { note: res.ranking.note, ofMatched: res.ranking.ofMatched, shown: res.actors.length, key: res.ranking.key }
    console.log(`\n   ── the paragraph the document would carry, for the top-ranked actor ──`)
    const p = res.actors.length ? positionForDocument(res.actors[0], ctx) : null
    if (!p) console.log(`   (no actor with grounds)`)
    else {
      const body = renderPositionBody(p, ranking)
      console.log(body.split('\n').map((l) => '   ' + l).join('\n'))
      console.log(`\n   ⚠ "Who else is here" present in the rendered paragraph: ${body.includes('Who else is here') ? 'YES' : 'NO'}`)
      console.log(`     (ofMatched ${ranking.ofMatched} > shown ${ranking.shown}: ${ranking.ofMatched > ranking.shown})`)
    }
    void el
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
