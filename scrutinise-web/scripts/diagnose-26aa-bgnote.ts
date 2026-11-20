// ─────────────────────────────────────────────────────────────────────────────
// 26-AA item 8 (decision 355) step 1 — WHY ARE BACKGROUND NOTES REFUSED? Diagnosis only: nothing in the product changes.
//
// Re-drafts the background note for #24, #25 and #36 (the three refused on 20 Nov) on a scratch copy of 452c5ade (deleted after; the
// cited sources are read from 452c5ade READ ONLY, as measure-26aa-kinds.ts does). The model call is the product's own, wrapped so the RAW
// draft is kept; the body is rebuilt by the product's `templateBody` and judged by the product's `proposalShape` / `isProposing` (imported,
// never restated). For every paragraph the guard counts as proposing, it prints whether the paragraph REPORTS a cited source ("[Ref: n]"
// with a reporting verb: says, proposes, argues …) or speaks in the note's own voice. Spend cap 20p (CCh's GO 1322Z): stops before 18p.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/diagnose-26aa-bgnote.ts <out-file> [runs-per-action=2]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { composeKindDocument, kindInput } from '../lib/lex/document-drafting'
import { templateBody, proposalShape, bodyParagraphs, isProposing, type TemplateAnswer } from '../lib/lex/document-drafting-pure'
import { callModelJson } from '../lib/lex/model-call'
import { resolveRefs } from '../lib/lex/source-registry'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade'
const ACTIONS = [24, 25, 36]
const STOP_AT = 18
const out = process.argv[2]
const RUNS = Number(process.argv[3] ?? 2)
/** For the REPORT only (the verdict is isProposing's): does the paragraph attribute what it says to a cited source? */
const REPORTS_A_SOURCE = /\[Ref:\s*\d+\][^.]*\b(?:says?|states?|proposes?|propos(?:al|als)|argues?|recommends?|suggests?|sets? out|describes?|calls? for|notes?|finds?|warns?|envisages?)\b|\b(?:says?|states?|proposes?|argues?|recommends?|suggests?|sets? out|describes?|calls? for|notes?|finds?|warns?|envisages?)\b[^.]*\[Ref:\s*\d+\]|\b(?:the|this) (?:source|blueprint|report|paper|document|review|guidance)\b[^.]*\b(?:says?|states?|proposes?|argues?|recommends?|suggests?|sets? out|describes?|calls? for|envisages?)\b/i
/** For the REPORT only: the words that tripped the guard (display; the guard's own patterns are not exported). */
const TRIGGERS = /\b(?:should|ought to|could|might|recommend(?:s|ed|ation)?|propos(?:e|es|ed|al)|suggest(?:s|ed)?|consider(?:ing)?|we would|it is proposed)\b/gi

async function main() {
  if (!out) throw new Error('give an out-file')
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE } }, select: { id: true } })
  if (!src) throw new Error(`no idea ${SOURCE}`)
  const copy = await scratchCopy(SOURCE, '26aa-bgnote-diagnose')
  const log: string[] = []
  let spent = 0
  const tally = { runs: 0, refused: 0, proposing: 0, reported: 0, own: 0 }
  try {
    for (const n of ACTIONS) for (let k = 0; k < RUNS; k++) {
      if (spent > STOP_AT) { log.push(`STOPPED at ${spent.toFixed(2)}p`); console.log(`STOPPED at ${spent.toFixed(2)}p`); break }
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: n }, select: { id: true } })
      const s = await prisma.lexCoherentAction.findFirst({ where: { ideaId: src.id, number: n }, select: { commentary: true } })
      if (!a || !s) { console.log(`#${n}: not on the copy`); continue }
      const input = await kindInput(copy.id, a.id)
      if (!input) continue
      input.sources = (await resolveRefs(src.id, s.commentary ?? '')).found.filter((x) => !x.archived).map((x) => ({ number: x.number, title: x.title, citation: x.citation, snippet: x.snippet }))
      let raw: TemplateAnswer | null = null
      let pence = 0
      const call = (async (args: Parameters<typeof callModelJson>[0]) => {
        const r = await callModelJson<TemplateAnswer>(args as never)
        if (r.ok) raw = r.value
        return r
      }) as typeof callModelJson
      const res = await composeKindDocument('BACKGROUND_NOTE', input, { ideaId: copy.id, userId: copy.userId, call })
      pence = res.ok ? (res.data.pence ?? 0) : Number(/(?:attempt cost|It cost) ([\d.]+)p/.exec((res as { error: string }).error)?.[1] ?? 0)
      spent += pence
      tally.runs++
      if (!raw) { log.push(`\n══ #${n} run ${k + 1}: NO DRAFT — ${(res as { error?: string }).error}`); continue }
      const allowed = new Set([...input.sources.map((x) => x.number)])
      const { body } = templateBody('BACKGROUND_NOTE', raw, { hasCommentary: !!input.detail?.trim(), allowedRefs: allowed })
      const shape = proposalShape('BACKGROUND_NOTE', body)
      if (shape.refused) tally.refused++
      const paras = bodyParagraphs(body)
      const flagged = paras.filter(isProposing)
      const lines = flagged.map((p) => {
        const rep = REPORTS_A_SOURCE.test(p)
        if (rep) tally.reported++; else tally.own++
        tally.proposing++
        return `  ${rep ? 'REPORTS A SOURCE' : 'OWN VOICE       '} [${[...new Set((p.match(TRIGGERS) ?? []).map((t) => t.toLowerCase()))].join(', ')}] ${p}`
      })
      const head = `══ #${n} run ${k + 1}: ${shape.refused ? 'REFUSED' : 'saved'} — ${shape.proposing} of ${shape.paragraphs} paragraphs counted as proposing (refused above 40%) — ${pence.toFixed(2)}p (running ${spent.toFixed(2)}p)`
      console.log(head)
      log.push(`\n${head}\nsources: ${input.sources.map((x) => `[Ref: ${x.number}] ${x.title}`).join('; ')}\nCOUNTED AS PROPOSING:\n${lines.join('\n') || '  (none)'}\nTHE DRAFT:\n${body}`)
    }
    const sum = `\nSUMMARY: ${tally.runs} drafts, ${tally.refused} refused. Of ${tally.proposing} paragraphs the guard counted as proposing, ${tally.reported} report a cited source and ${tally.own} speak in the note's own voice. Spent ${spent.toFixed(2)}p.`
    console.log(sum); log.push(sum)
    writeFileSync(out, log.join('\n'))
  } finally { console.log(`scratch copy deleted: ${await deleteScratch(copy.id)}`); await prisma.$disconnect() }
}
main()
