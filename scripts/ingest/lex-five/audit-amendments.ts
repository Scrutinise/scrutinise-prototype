/**
 * audit-amendments.ts — INGEST_LEX_FIVE §5.1. READ-ONLY: writes nothing to Neon or R2, one JSON to docs/ingest_traces.
 *
 *   A. a 20-bill stratified sample: stages walked to completion (the stage list is PAGED, 20 a page),
 *      each stage's `totalResults`, and — on every bill that has amendments, up to a cap — an ENTRY WALK
 *      (Take=20 pages) compared with `totalResults` and with one Take=1000 call.
 *   B. a true COUNT over all held bills: sum of `totalResults` across every stage. This is the denominator;
 *      "3,500 calls" was an estimate.
 * Uses shared/self-tuning-gap (the EDM sweep's controller), not a second limiter.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { createGapController } from '../shared/self-tuning-gap'

const B = 'https://bills-api.parliament.uk/api/v1'
const gap = createGapController({ userAgent: 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)', startGapMs: 250 })
const FULL = !process.argv.includes('--sample-only')

interface Stage { id: number; stageId: number; description: string; house: string; dates: string[] }

async function stagesOf(billId: number): Promise<{ stages: Stage[]; declared: number; ok: boolean }> {
  const out: Stage[] = []
  let declared = -1
  for (let skip = 0; ; skip += 20) {
    const r = await gap.getJson(`${B}/Bills/${billId}/Stages?Skip=${skip}&Take=20`)
    if (!r.body) return { stages: out, declared, ok: false }
    declared = r.body.totalResults ?? -1
    for (const s of r.body.items ?? []) out.push({ id: s.id, stageId: s.stageId, description: s.description, house: s.house, dates: (s.stageSittings ?? []).map((x: any) => String(x.date).slice(0, 10)) })
    if (!(r.body.items?.length) || out.length >= declared) break
  }
  return { stages: out, declared, ok: out.length === declared }
}

async function main() {
  const pool = getNeonPool()
  console.log('HOST', new URL(process.env.NEON_DATABASE_URL!).host)
  const held: number[] = (await pool.query(`select distinct "parentDocId" from corpus_sections where corpus='bills-api'`)).rows.map(r => Number(r.parentDocId)).sort((a, b) => a - b)
  const all = await gap.getJson(`${B}/Bills?Take=1`)
  const apiTotal: number = all.body?.totalResults
  console.log(`held ${held.length} bills; the Bills API declares ${apiTotal} (held = ${(100 * held.length / apiTotal).toFixed(1)}%)`)

  // ── A. sample ───────────────────────────────────────────────────────────────
  const sample = Array.from({ length: 20 }, (_, i) => held[Math.floor((i + 0.5) * held.length / 20)])
  const A: any[] = []
  let walked = 0
  for (const id of sample) {
    const { stages, declared, ok } = await stagesOf(id)
    const rec: any = { billId: id, stagesDeclared: declared, stagesWalked: stages.length, stagesOk: ok, perStage: [] as any[] }
    for (const s of stages) {
      const t = await gap.getJson(`${B}/Bills/${id}/Stages/${s.id}/Amendments?Take=1`)
      const total = t.body?.totalResults
      rec.perStage.push({ stage: s.id, desc: s.description, house: s.house, total, hasField: t.body ? 'totalResults' in t.body : null, status: t.status })
      if (total > 0 && walked < 6) {
        // entry walk vs declared vs a single Take=1000
        let n = 0
        const keys = new Set<number>()
        for (let skip = 0; ; skip += 20) {
          const w = await gap.getJson(`${B}/Bills/${id}/Stages/${s.id}/Amendments?Skip=${skip}&Take=20`)
          if (!w.body?.items?.length) break
          for (const it of w.body.items) { n++; keys.add(it.amendmentId) }
          if (skip + 20 >= total + 20) break
        }
        const big = await gap.getJson(`${B}/Bills/${id}/Stages/${s.id}/Amendments?Take=1000`)
        rec.perStage[rec.perStage.length - 1].walk = { entriesWalked: n, distinctAmendmentIds: keys.size, declared: total, take1000: big.body?.items?.length, agree: n === total && keys.size === total && big.body?.items?.length === total }
        walked++
      }
    }
    A.push(rec)
    const tot = rec.perStage.reduce((a: number, s: any) => a + (s.total ?? 0), 0)
    console.log(`  bill ${id}: ${stages.length}/${declared} stages, ${tot} amendments`)
  }
  const walks = A.flatMap(r => r.perStage.filter((s: any) => s.walk))
  console.log(`\nA. entry walks: ${walks.length}; agreeing (walk = totalResults = Take1000 = distinct ids): ${walks.filter((w: any) => w.walk.agree).length}`)
  for (const w of walks) console.log('   ', w.desc, w.house, JSON.stringify(w.walk))
  const missingField = A.flatMap(r => r.perStage).filter((s: any) => s.hasField === false).length
  console.log(`   responses lacking totalResults: ${missingField}`)
  const sampleTotal = A.reduce((a, r) => a + r.perStage.reduce((b: number, s: any) => b + (s.total ?? 0), 0), 0)
  console.log(`   sample total ${sampleTotal} amendments in ${A.length} bills`)

  // ── B. full count ───────────────────────────────────────────────────────────
  const B_: any = { bills: 0, billsWithAmendments: 0, stagesWalked: 0, stagesNotOk: [] as number[], calls0: gap.tally.requests, total: 0, perBill: {} as Record<number, number>, byStageDesc: {} as Record<string, number>, failedStage: 0, maxStage: { n: 0, bill: 0, stage: 0 } }
  if (FULL) {
    for (const id of held) {
      const { stages, ok } = await stagesOf(id)
      if (!ok) B_.stagesNotOk.push(id)
      let billTot = 0
      for (const s of stages) {
        const t = await gap.getJson(`${B}/Bills/${id}/Stages/${s.id}/Amendments?Take=1`)
        B_.stagesWalked++
        if (!t.body) { B_.failedStage++; continue }
        const n = t.body.totalResults ?? 0
        billTot += n
        if (n) B_.byStageDesc[`${s.house} ${s.description}`] = (B_.byStageDesc[`${s.house} ${s.description}`] ?? 0) + n
        if (n > B_.maxStage.n) B_.maxStage = { n, bill: id, stage: s.id }
      }
      B_.bills++; B_.perBill[id] = billTot; B_.total += billTot
      if (billTot) B_.billsWithAmendments++
      if (B_.bills % 25 === 0) console.log(`  B: ${B_.bills}/${held.length} bills, ${B_.total} amendments so far, ${gap.tally.requests} calls, gap ${gap.rate.gapMs}ms, 429s ${gap.rate.hits}`)
    }
    console.log(`\nB. COUNT: ${B_.total} amendments across ${B_.billsWithAmendments} of ${B_.bills} held bills; ${B_.stagesWalked} stages; failed stage reads ${B_.failedStage}; bills whose stage list did not reconcile ${B_.stagesNotOk.length}`)
    console.log('   largest stage', JSON.stringify(B_.maxStage))
    console.log('   by stage:', Object.entries(B_.byStageDesc).sort((a: any, b: any) => b[1] - a[1]).slice(0, 12))
    const calls = gap.tally.requests - B_.calls0
    console.log(`   calls used by the count: ${calls}; 429s: ${gap.rate.hits}; final gap ${gap.rate.gapMs}ms`)
    console.log(`   ≈ calls to FETCH (Take=1000 per non-empty stage; ceil(n/1000) each) + one DETAIL call per amendment for full wording: ${B_.total} detail calls`)
  }
  fs.writeFileSync(path.join(__dirname, '../../../docs/ingest_traces/lex_five_s5_volume.json'), JSON.stringify({ ranAt: new Date().toISOString(), apiTotal, held: held.length, A, B: B_, http: [...gap.tally.http.entries()], throttled: gap.rate.hits }, null, 1))
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
