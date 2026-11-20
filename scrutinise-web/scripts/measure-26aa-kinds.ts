// ─────────────────────────────────────────────────────────────────────────────
// 26-AA item 4 — RE-MEASURE the kinds whose templates changed in 26-W and still carry 24 Oct (V2b) figures: specification, operating
// text, background note. n = 3 each, FOR REAL, on a scratch copy of 452c5ade (deleted after). Cost lines and cited sources are read from
// 452c5ade READ ONLY, as measure-26v2b-kinds.ts does. Spend cap £1.50 (BRIEF_26AA §1 item 4): the run stops before a run that could
// pass it. Costing is not here: 26-Y re-measured it on 18 Nov (n = 3) after its template changed, and those figures replaced V2b's.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26aa-kinds.ts [out-file]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { composeKindDocument, kindInput, type TemplateKind } from '../lib/lex/document-drafting'
import { KIND_RUNS } from '../lib/lex/document-drafting-pure'
import { resolveRefs } from '../lib/lex/source-registry'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade'
/** argv[5]: saved drafts wanted per kind (default 3); argv[6]: the spend cap in pence (default 150, BRIEF_26AA item 4). Item 8 (decision 355)
 *  re-measured the background note with n = 7 under a 40p cap. */
const N = Number(process.argv[5] ?? 3)
const CAP_PENCE = Number(process.argv[6] ?? 150)
const out = process.argv[2] ?? null
const ALL_KINDS: TemplateKind[] = ['SPECIFICATION', 'OPERATING_TEXT', 'BACKGROUND_NOTE']
/** argv[3]: narrow to these kinds; argv[4]: action numbers to skip (already measured), e.g. "24,25,31". */
const KINDS: TemplateKind[] = process.argv[3] ? (process.argv[3].split(',') as TemplateKind[]) : ALL_KINDS
const SKIP = new Set((process.argv[4] ?? '').split(',').filter(Boolean).map(Number))
/** A kind is tried on further actions until N drafts are SAVED (a draft the product's own guard refuses still spends; it is counted). */
const MAX_TRIES = Math.max(6, N + 3)

async function pickRuns(srcId: string): Promise<Array<{ n: number; kind: TemplateKind; why: string }>> {
  const acts = await prisma.lexCoherentAction.findMany({ where: { ideaId: srcId, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { number: true, avenue: true, commentary: true, headingId: true } })
  const heads = new Map((await prisma.actionHeading.findMany({ where: { ideaId: srcId }, select: { id: true, name: true } })).map((h) => [h.id, h.name]))
  const detail = (a: (typeof acts)[number]) => (a.commentary ?? '').trim().length > 0
  const refs = (a: (typeof acts)[number]) => /\[Ref:\s*\d+\]/.test(a.commentary ?? '')
  // up to MAX_TRIES candidates per kind, distinct actions where the idea has them (the loop stops a kind at N saved drafts)
  const three = (xs: Array<{ n: number; why: string }>, kind: TemplateKind) => {
    const r = xs.filter((x) => !SKIP.has(x.n)).slice(0, MAX_TRIES).map((x) => ({ ...x, kind }))
    for (let i = 0; r.length && r.length < N; i++) r.push({ ...r[i % r.length], why: `${r[i % r.length].why}, again` })
    return r.filter((x) => KINDS.includes(kind))
  }
  const platform = acts.filter((a) => heads.get(a.headingId ?? '') === 'The platform')
  return [
    ...three([...platform.filter(detail).map((a) => ({ n: a.number!, why: 'under The platform, with an Explanation' })), ...platform.filter((a) => !detail(a)).map((a) => ({ n: a.number!, why: 'under The platform, no Explanation' }))], 'SPECIFICATION'),
    ...three([...acts.filter((a) => a.avenue === 'ORGANISATIONAL' && detail(a)).map((a) => ({ n: a.number!, why: 'organisational, with an Explanation' })), ...acts.filter((a) => a.avenue === 'ORGANISATIONAL' && !detail(a)).map((a) => ({ n: a.number!, why: 'organisational, no Explanation' }))], 'OPERATING_TEXT'),
    ...three(acts.filter(refs).map((a) => ({ n: a.number!, why: 'its Explanation cites sources' })), 'BACKGROUND_NOTE'),
  ]
}

async function main() {
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE } }, select: { id: true } })
  if (!src) throw new Error(`no idea ${SOURCE}`)
  const runs = await pickRuns(src.id)
  console.log('runs:', runs.map((r) => `${r.kind} #${r.n} (${r.why})`).join('; '))
  const copy = await scratchCopy(SOURCE, '26aa-kinds')
  const done: Array<{ kind: TemplateKind; pence: number; seconds: number; label: string }> = []
  const log: string[] = []
  let spent = 0
  try {
    const refused: Array<{ kind: TemplateKind; pence: number; label: string }> = []
    for (const r of runs) {
      if (done.filter((d) => d.kind === r.kind).length >= N) continue
      // the dearest run so far, doubled, is the guard: never start a run that could take the total past the cap
      const worst = Math.max(5, ...done.map((d) => d.pence)) * 2
      if (spent + worst > CAP_PENCE) { console.log(`STOPPED before ${r.kind} #${r.n}: ${spent.toFixed(2)}p spent, the next could pass ${CAP_PENCE}p`); break }
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: r.n }, select: { id: true } })
      const s = await prisma.lexCoherentAction.findFirst({ where: { ideaId: src.id, number: r.n }, select: { commentary: true, costLines: { orderBy: { orderIndex: 'asc' } } } })
      if (!a || !s) { console.log(`#${r.n}: not on the copy`); continue }
      const input = await kindInput(copy.id, a.id)
      if (!input) { console.log(`#${r.n}: not live on the copy`); continue }
      input.costLines = s.costLines.map((c) => ({ label: c.label, low: c.low, high: c.high, unit: c.unit, basis: c.basis, priceYear: c.priceYear, recurrence: c.recurrence }))
      input.sources = (await resolveRefs(src.id, s.commentary ?? '')).found.filter((x) => !x.archived).map((x) => ({ number: x.number, title: x.title, citation: x.citation, snippet: x.snippet }))
      const res = await composeKindDocument(r.kind, input, { ideaId: copy.id, userId: copy.userId })
      const label = `${r.kind} #${r.n} — ${r.why}${r.kind === 'BACKGROUND_NOTE' ? `, ${input.sources.length} sources` : ''}`
      if (!res.ok) {
        const err = 'error' in res ? res.error : ''
        // a refused draft still spent: its own message states the cost ("The attempt cost 1.2p.")
        const cost = Number(/attempt cost ([\d.]+)p/.exec(err)?.[1] ?? NaN)
        if (Number.isFinite(cost)) { spent += cost; refused.push({ kind: r.kind, pence: cost, label }) }
        console.log(`${label}: REFUSED/FAILED (${Number.isFinite(cost) ? `${cost}p spent` : 'no cost stated'}) — ${err.slice(0, 220)}`); log.push(`══ ${label}: FAILED — ${err}`); continue
      }
      const pence = res.data.pence ?? NaN
      if (Number.isFinite(pence)) spent += pence
      done.push({ kind: r.kind, pence, seconds: res.data.seconds, label: `#${r.n}, ${r.why}` })
      log.push(`\n══ ${label} — ${pence.toFixed(2)}p, ${res.data.seconds}s\nreason: ${res.data.reason}\n${res.data.body}`)
      console.log(`══ ${label} — ${pence.toFixed(2)}p, ${res.data.seconds}s, ${res.data.body.length} chars (running total ${spent.toFixed(2)}p)`)
    }
    const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN
    console.log('\nOLD (24 Oct, V2b template) vs NEW (26-W template):')
    for (const k of KINDS) {
      const old = KIND_RUNS[k].map((r) => r.pence), now = done.filter((d) => d.kind === k && Number.isFinite(d.pence)).map((d) => d.pence)
      console.log(`  ${k}: old mean ${mean(old).toFixed(2)}p (n=${old.length}) → new mean ${mean(now).toFixed(2)}p (n=${now.length}); new runs ${now.map((p) => p.toFixed(2)).join(', ')}`)
    }
    for (const k of KINDS) {
      const rf = refused.filter((x) => x.kind === k)
      if (rf.length) console.log(`  ${k}: ${rf.length} draft(s) refused by the product's guard and not saved, ${rf.reduce((s, x) => s + x.pence, 0).toFixed(2)}p spent on them`)
    }
    console.log(`TOTAL SPENT: ${spent.toFixed(2)}p, refused attempts included (cap ${CAP_PENCE}p)`)
    const good = done.filter((x) => Number.isFinite(x.pence))
    const paste = `\nPASTE into KIND_RUNS:\n${good.map((p) => `  ${p.kind}: { pence: ${p.pence.toFixed(2)}, seconds: ${p.seconds}, on: 'scratch copy of 452c5ade, ${new Date().toISOString().slice(0, 10)} (${p.label}, 26-W template)' },`).join('\n')}`
    console.log(paste)
    if (out) writeFileSync(out, log.join('\n') + paste)
  } finally { console.log(`scratch copy deleted: ${await deleteScratch(copy.id)}`); await prisma.$disconnect() }
}
main()
