// 26-S2 decision 190 - MEASURE "Re-sort into headings" and "Consolidate this heading" on a SCRATCH COPY of Charlie's idea. Real model spend, labelled
// "measurement" (the script's name). The copy is deleted at the end; the original is never touched.
//
//   npx tsx --env-file=.env scripts/measure-lex-resort.ts [ideaPrefix]
//
// Prints: the re-sort (calls, pence, seconds, how many moved, per-heading counts) and, per heading, the consolidate (actions in, folded, merged,
// refused, pence, seconds), then the live total before and after. Writes scripts/_out/measure-lex-resort.json for the record.
import { mkdirSync, writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { SEVEN_HEADINGS } from './lib/seven-headings'
import * as RS from '../lib/lex/action-resort'

async function main() {
  const prefix = process.argv[2] ?? '452c5ade'
  const copy = await scratchCopy(prefix, 'resort')
  const out: Record<string, unknown> = { on: prefix, at: new Date().toISOString() }
  try {
    await RS.setHeadingPlan(copy.id, SEVEN_HEADINGS)
    const live0 = await prisma.lexCoherentAction.count({ where: { ideaId: copy.id, status: 'LIVE' } })
    const plan = await RS.resortPlan(copy.id)
    if (!plan.ok) throw new Error((plan as { error: string }).error)
    const t0 = Date.now()
    let pence = 0, unpriced = false, moved = 0, unchanged = 0, notPlaced = 0, calls = 0
    for (const ids of plan.data.batches) {
      const r = await RS.resortBatch(copy.id, copy.userId, ids)
      calls++
      if (!r.ok) { console.log('BATCH FAILED', (r as { error: string }).error); break }
      moved += r.data.moved; unchanged += r.data.unchanged; notPlaced += r.data.notPlaced
      if (r.data.pence == null) unpriced = true; else pence += r.data.pence
      console.log(`  re-sort batch ${calls}/${plan.data.batches.length}: ${ids.length} actions, moved ${r.data.moved}, ${r.data.pence}p`)
    }
    const fin = await RS.resortFinish(copy.id)
    const secs = Math.round((Date.now() - t0) / 1000)
    const heads = await prisma.actionHeading.findMany({ where: { ideaId: copy.id }, orderBy: { orderIndex: 'asc' } })
    const per: Record<string, number> = {}
    for (const h of heads) per[h.name] = await prisma.lexCoherentAction.count({ where: { ideaId: copy.id, status: 'LIVE', headingId: h.id } })
    out.resort = { actions: live0, calls, pence: unpriced ? null : pence, seconds: secs, moved, unchanged, notPlaced, perHeading: per, finish: fin.ok ? fin.data : fin }
    console.log('RE-SORT', JSON.stringify(out.resort))

    const cons: unknown[] = []
    let cPence = 0, cActions = 0, cCalls = 0, cSecs = 0
    for (const h of heads) {
      const n = per[h.name]
      if (n < 2) { cons.push({ heading: h.name, actions: n, skipped: true }); continue }
      const s0 = Date.now()
      const r = await RS.consolidateHeading(copy.id, copy.userId, h.id)
      const sec = Math.round((Date.now() - s0) / 1000)
      if (!r.ok) { const er = (r as { error: string }).error; cons.push({ heading: h.name, actions: n, error: er }); console.log('CONSOLIDATE FAILED', h.name, er); continue }
      cCalls++; cSecs += sec; cActions += n; cPence += r.data.pence ?? 0
      cons.push({ heading: h.name, actions: n, folded: r.data.folded.length, merged: r.data.merged.length, refused: r.data.refused, after: r.data.after, pence: r.data.pence, seconds: sec })
      console.log(`  consolidate ${h.name}: ${n} -> ${r.data.after} (folded ${r.data.folded.length}, merged ${r.data.merged.length}, refused ${r.data.refused.length}) ${r.data.pence}p ${sec}s`)
    }
    const live1 = await prisma.lexCoherentAction.count({ where: { ideaId: copy.id, status: 'LIVE' } })
    out.consolidate = { perHeading: cons, actions: cActions, calls: cCalls, pence: cPence, seconds: cSecs, liveBefore: live0, liveAfter: live1 }
    console.log(`CONSOLIDATE total: ${live0} -> ${live1} live; ${cPence.toFixed(2)}p over ${cCalls} calls, ${cSecs}s`)
    mkdirSync('scripts/_out', { recursive: true })
    writeFileSync('scripts/_out/measure-lex-resort.json', JSON.stringify(out, null, 2))
  } finally { await deleteScratch(copy.id) }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
