/**
 * v37-gap-filler.ts — V37 §4: DETECT → SIZE → PRICE → QUEUE. Primed and ready, not
 * silently autonomous.
 *
 * All three V37 layers produce the same artefact: a list of identifiers we should
 * hold and do not. This is what turns that list into corpus.
 *
 * ── WHY SIZING IS EXACT AND NOT ESTIMATED ──────────────────────────────────────
 * The brief says "everything computed before anything is spent". The fetch from
 * legislation.gov.uk costs **£0** (OGL v3.0); the money is the embed. So this fetches
 * first — which is free and yields the REAL section count and the REAL bodies — and
 * prices the embed off those bytes. No estimate, no extrapolation, and no repeat of
 * V36's "77,000 sections" figure that turned out to belong to a different population.
 *
 * ── THE THRESHOLD CANNOT BE EVADED BY A HUNDRED SMALL JOBS ─────────────────────
 * Below £15 runs automatically; at or above £15 it stops and asks. The gate is
 * applied to **this run plus the running month-to-date total**, held in
 * `gap_filler_spend` on Neon, because a threshold checked only against the current
 * job is a threshold that a loop defeats.
 *
 * ── A GAP HALF-FILLED IS WORSE THAN A GAP ──────────────────────────────────────
 * It stops appearing in the report while still being missing from the answers. So
 * the full scope is fetch → chunk → embed → keyword index → semantic index → service
 * restarts, every step VERIFIED by reading state back, and **any skipped step makes
 * the run report INCOMPLETE rather than success**. The restarts are the step that
 * gets forgotten: `fts-serve` calls `openTable()` once at boot and will serve a stale
 * snapshot forever, and `vector-serve` does not auto-deploy from GitHub at all.
 *
 * Usage:
 *   tsx v37-gap-filler.ts --plan --batch 5            # detect, fetch, size, price. No spend.
 *   tsx v37-gap-filler.ts --run  --batch 5            # the above, then fill if the gate passes
 *   tsx v37-gap-filler.ts --plan --batch 5 --source citation|completeness
 */
process.env.TNA_THROTTLE_FLOOR_MS = process.env.TNA_THROTTLE_FLOOR_MS ?? '600'
import fs from 'fs'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const CITATION_GAPS = path.join(__dirname, '../../docs/corpus_citation_gaps.json')
const WORKLIST = path.join(__dirname, 'v36', 'worklist.jsonl')
const LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS gap_filler_spend (
  id          bigserial PRIMARY KEY,
  ran_at      timestamptz NOT NULL DEFAULT now(),
  batch       integer NOT NULL,
  instruments integer NOT NULL,
  sections    integer NOT NULL,
  tokens      bigint  NOT NULL,
  usd         numeric(10,4) NOT NULL,
  approved_by text NOT NULL,          -- 'auto-under-threshold' | 'charlie' | 'plan-only'
  note        text
);`

/** Batch API rate, the same $0.075/1M the vector build bills at (vector-common.ts). */
const RATE_USD_PER_MTOK = 0.075
/** £/$ — stated, not hidden, because the threshold is in POUNDS and the rate is in dollars. */
const USD_PER_GBP = 1.27
const THRESHOLD_GBP = 15

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null
}
const PLAN = process.argv.includes('--plan')
const RUN = process.argv.includes('--run')
const BATCH = Number(arg('batch') ?? 5)
const SOURCE = arg('source') ?? 'citation'

/** estTokens, matching the vector build's own estimator so the price here and the
 *  price the embed actually pays are computed the same way. */
function estTokens(body: string): number {
  return Math.ceil(body.length / 4)
}

interface Candidate { gid: string; corpus: string; refs: number; title: string | null; why: string }

function corpusFor(gid: string): string {
  const [type, seg2] = gid.split('/')
  const year = /^\d{4}$/.test(seg2) ? Number(seg2) : 0
  if (type === 'ukpga') return year >= 2000 ? 'primary-acts-2000plus' : 'primary-acts-pre-2000'
  if (type === 'uksi') return year >= 2010 ? 'si-2010plus' : 'si-pre-2010'
  if (['eur', 'eudn', 'eudr'].includes(type)) return 'retained-eu'
  return 'regional'
}

function detect(): Candidate[] {
  if (SOURCE === 'completeness') {
    if (!fs.existsSync(WORKLIST)) throw new Error(`no work list at ${WORKLIST}`)
    return fs.readFileSync(WORKLIST, 'utf8').split('\n').filter(Boolean).map(l => {
      const r = JSON.parse(l)
      return { gid: r.docId, corpus: r.corpus, refs: 0, title: null, why: `completeness:${r.reason}` }
    })
  }
  if (!fs.existsSync(CITATION_GAPS)) throw new Error(`no citation gap report at ${CITATION_GAPS} — run v37-citation-gaps.ts first`)
  const d = JSON.parse(fs.readFileSync(CITATION_GAPS, 'utf8'))
  // Only the classifications that are actually fillable. `no-ingest-route` is a
  // decision, not a gap; `needs-a-decision` is Charlie's, and filling it here would
  // be this script taking a scope decision by writing rows.
  return (d.instruments as Record<string, unknown>[])
    .filter(g => g.classification === 'known-no-text' || g.classification === 'never-seen')
    .map(g => ({
      gid: g.gid as string, corpus: corpusFor(g.gid as string),
      refs: (g.ours as number) + (g.external as number),
      title: (g.title as string) ?? null,
      why: `citation:${g.classification} (${g.ours} ours + ${g.external} external)`,
    }))
}

async function monthToDateUsd(): Promise<number> {
  const { rows } = await getNeonPool().query(
    `SELECT COALESCE(sum(usd), 0)::float8 AS spent FROM gap_filler_spend
     WHERE ran_at >= date_trunc('month', now()) AND approved_by <> 'plan-only'`)
  return rows[0].spent as number
}

async function main() {
  if (!PLAN && !RUN) throw new Error('pass --plan (no spend) or --run')
  const pool = getNeonPool()
  await pool.query(LEDGER_DDL)

  const all = detect()
  // Cap the batch. A run that discovers 80,805 gaps must not attempt 80,805 fetches
  // unattended; process a bounded batch, report, requeue the rest.
  const batch = all.slice(0, BATCH)
  console.log(`\n=== V37 §4 GAP FILLER ===`)
  console.log(`detected      : ${all.length.toLocaleString()} fillable gaps from ${SOURCE}`)
  console.log(`batch cap     : ${BATCH} — ${(all.length - batch.length).toLocaleString()} requeued\n`)

  // ── SIZE: fetch (free) to get real section counts and real bodies ────────────
  const { enumerateSections } = await import('./sources/tna-legislation')
  const { rawToText } = await import('./shared/compile')
  const { isRepealedPlaceholder } = await import('./shared/compile')

  let totalSections = 0, totalTokens = 0, withText = 0
  const sized: { c: Candidate; sections: number; tokens: number; note: string }[] = []
  for (const c of batch) {
    let sections = 0, tokens = 0, note = ''
    try {
      const secs = await enumerateSections(c.gid)
      for (const s of secs) {
        if (s.format === 'unavailable' || s.format === 'effects') continue
        const body = s.xml ? rawToText(s.xml) : (s.rawHtml ? rawToText(s.rawHtml) : '')
        // Do not price what the fix will not store. V36: a repealed provision's dot
        // leaders were being embedded at full price and retrieved as a document that
        // says nothing.
        if (!body || isRepealedPlaceholder(body)) continue
        sections++
        tokens += estTokens(body)
      }
      if (sections === 0) note = secs.find(s => s.format === 'unavailable')?.errorMsg ?? 'no storable sections'
    } catch (e) {
      note = `FETCH FAILED: ${String(e).slice(0, 90)}`
    }
    if (sections > 0) withText++
    totalSections += sections; totalTokens += tokens
    sized.push({ c, sections, tokens, note })
    console.log(`  ${c.gid.padEnd(22)} refs=${String(c.refs).padStart(5)}  sections=${String(sections).padStart(4)}  ` +
      `tokens=${tokens.toLocaleString().padStart(9)}  ${note}`)
  }

  // ── PRICE ────────────────────────────────────────────────────────────────────
  const usd = (totalTokens / 1e6) * RATE_USD_PER_MTOK
  const gbp = usd / USD_PER_GBP
  const mtd = await monthToDateUsd()
  const mtdGbp = mtd / USD_PER_GBP
  const combinedGbp = gbp + mtdGbp

  console.log(`\n── size ──`)
  console.log(`  instruments with text : ${withText}/${batch.length}`)
  console.log(`  sections to store     : ${totalSections.toLocaleString()}`)
  console.log(`  tokens to embed       : ${totalTokens.toLocaleString()}`)
  console.log(`── price ──`)
  console.log(`  this batch            : $${usd.toFixed(4)} = £${gbp.toFixed(4)}  (Batch API $${RATE_USD_PER_MTOK}/1M tok, £1=$${USD_PER_GBP})`)
  console.log(`  month to date         : $${mtd.toFixed(4)} = £${mtdGbp.toFixed(4)}`)
  console.log(`  combined              : £${combinedGbp.toFixed(4)}  against a £${THRESHOLD_GBP} threshold`)

  const gatePasses = combinedGbp < THRESHOLD_GBP
  console.log(`── gate ──`)
  console.log(`  ${gatePasses
    ? `PASS — under £${THRESHOLD_GBP} including month-to-date, so this may run automatically`
    : `STOP — £${combinedGbp.toFixed(2)} is at or over the £${THRESHOLD_GBP} threshold. Charlie approves, and "nearly under" is not a reason.`}`)

  if (PLAN || !RUN) {
    await pool.query(
      `INSERT INTO gap_filler_spend (batch, instruments, sections, tokens, usd, approved_by, note)
       VALUES ($1,$2,$3,$4,$5,'plan-only',$6)`,
      [BATCH, withText, totalSections, totalTokens, usd, `plan from ${SOURCE}; gate ${gatePasses ? 'pass' : 'stop'}`])
    console.log(`\n[filler] PLAN ONLY — nothing fetched into storage, nothing embedded, nothing indexed.`)
    console.log(`[filler] the plan is recorded in gap_filler_spend as 'plan-only' so it does not count against the month.`)
    await endNeonPool()
    return
  }

  if (!gatePasses) {
    console.log(`\n[filler] REFUSING TO RUN. Batched summary above is what Charlie approves; re-run with --approved once he has.`)
    await endNeonPool()
    process.exitCode = 2
    return
  }

  // The gate passed, and the run is still refused, because the steps below are not
  // wired here yet and a filler that stops after `fetch` fills the gap in storage and
  // not in the product — then stops reporting it. Exit 3 says "authorised, not done".
  console.log(`\n[filler] ⚠ AUTHORISED BUT NOT RUN — the full-scope steps are not wired into this script yet:`)
  console.log(`[filler]   1. fetch → store        processRow(), as v36-recovery-run.ts already drives it`)
  console.log(`[filler]   2. chunk + embed        v33-vec-catchup.ts --run v37-<tag> --chunk --embed --max-cost`)
  console.log(`[filler]                           ⚠ SCOPEABLE: it reads \`<tag>-vec-delta.jsonl\`, so the batch cap`)
  console.log(`[filler]                           propagates into the embed — the cap is real, not cosmetic.`)
  console.log(`[filler]   3. keyword index        search/fts-catchup.ts (append-safe, self-reconciling)`)
  console.log(`[filler]   4. semantic index       heavy job \`vector-reindex\` — NOT \`vector-index\`, which reports`)
  console.log(`[filler]                           success and builds nothing (both its scripts are phase:"done")`)
  console.log(`[filler]   5. RESTART BOTH SERVES  fts-serve calls openTable() once at boot and will serve a stale`)
  console.log(`[filler]                           snapshot forever; vector-serve does not auto-deploy from GitHub.`)
  console.log(`[filler]                           This is the step that gets forgotten, twice in one day in V35.`)
  console.log(`[filler]   6. verify THROUGH THE PRODUCT, not by a row count`)
  console.log(`[filler] A gap half-filled is worse than a gap: it stops appearing in the report while still`)
  console.log(`[filler] missing from the answers. So this reports INCOMPLETE rather than success.`)
  await endNeonPool()
  process.exitCode = 3
}

main().catch(e => { console.error(e); process.exitCode = 1 })
