/**
 * project-edm-signatures.ts — extrapolate the finished load from the part of it that has landed.
 *
 * ⚠⚠ THIS IS ONLY LEGITIMATE BECAUSE THE WORK LIST IS ORDERED BY `md5(motion_id)`. That ordering was
 * chosen so an id-ordered pilot could not be one session's motions — and the second thing it buys is
 * this: a partial load is an **unbiased sample of the corpus**, so the mean signature count over the
 * motions fetched so far is an estimate of the mean over all of them. If the order were `motion_id`
 * the sample would be the oldest motions and every projection from it would be wrong in a direction
 * nobody could see.
 *
 * ⚠ It also states the projection's own error bar, because a projection without one is a claim
 * dressed as a measurement.
 *
 * ⚠ READ-ONLY.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/project-edm-signatures.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const n = (x: any) => Number(x).toLocaleString()

async function main() {
  const { rows: [s] } = await pool.query<Record<string, string>>(`
    SELECT (SELECT COUNT(*) FROM edm_sponsor)::text                                          AS all_motions,
           (SELECT COALESCE(SUM(sponsors_count),0) FROM edm_sponsor)::text                    AS published,
           (SELECT COUNT(*) FROM edm_signatory_fetch WHERE http_status = 200)::text            AS done,
           (SELECT COUNT(*) FROM edm_signatory)::text                                          AS rows_held,
           (SELECT COUNT(*) FROM edm_signatory WHERE is_withdrawn)::text                        AS withdrawn,
           (SELECT COUNT(*) FROM edm_signatory WHERE sponsoring_order = 1)::text                AS sponsors,
           (SELECT COUNT(*) FROM edm_signatory WHERE mnis_id IS NULL)::text                     AS no_mnis,
           (SELECT COUNT(*) FROM graph_edm_signature_edge)::text                                AS edges,
           (SELECT stddev_samp(c) FROM (SELECT COUNT(*) c FROM edm_signatory GROUP BY motion_id) q)::text AS sd,
           (SELECT COALESCE(SUM(count_expected),0) FROM edm_signatory_fetch WHERE http_status=200)::text AS snapshot_for_done`)

  const done = Number(s.done), all = Number(s.all_motions)
  const held = Number(s.rows_held)
  const mean = held / Math.max(done, 1)
  const sd = Number(s.sd || 0)
  // ⚠⚠ THE STANDARD ERROR OF AN ESTIMATED TOTAL, AND THE FIRST VERSION OF THIS LINE WAS WRONG IN THE
  // DANGEROUS DIRECTION. It read `sd × √N × √((N−n)/(N−1))`, which has no `√n` in it at all and so
  // does not shrink as the sample grows: on 3,246 motions it produced **±16,392** and made a 107,000
  // shortfall against the published target look like a five-sigma discrepancy that had to be explained.
  // The correct estimator is
  //
  //     SE(total) = N × (sd / √n) × √(1 − n/N)
  //
  // which on the same numbers is **±71,058** — a fifth as tight, and enough that the gap is only just
  // outside it. A falsely narrow interval does not merely overstate precision; it manufactures
  // findings, which is worse than having no interval at all.
  //
  // ⚠ And even the corrected figure is optimistic here: sd ≈ mean, so the per-motion distribution is
  // heavily right-tailed and a normal approximation understates the spread of a SUM. Read the interval
  // as a floor on the uncertainty, not a bound on it.
  const se = all * (sd / Math.sqrt(Math.max(done, 1))) * Math.sqrt(Math.max(0, 1 - done / all))

  console.log(`\n════ WHERE THE LOAD IS ${'═'.repeat(56)}`)
  console.log(`   motions answered            ${n(done)} of ${n(all)}   ${((100 * done) / all).toFixed(2)}%`)
  console.log(`   signature rows held         ${n(held)}`)
  console.log(`     withdrawn                ${n(s.withdrawn)}   ${((100 * Number(s.withdrawn)) / Math.max(held, 1)).toFixed(2)}%`)
  console.log(`     primary sponsors         ${n(s.sponsors)}`)
  console.log(`     unidentified (no MNIS)   ${n(s.no_mnis)}`)
  console.log(`   signature EDGES            ${n(s.edges)}`)

  console.log(`\n════ PROJECTED, FROM AN md5-ORDERED (UNBIASED) SAMPLE ${'═'.repeat(25)}`)
  console.log(`   mean signatures per motion  ${mean.toFixed(2)}   (sd ${sd.toFixed(1)})`)
  console.log(`   → projected rows at 100%    ${n(Math.round(mean * all))}  ± ${n(Math.round(1.96 * se))} (95%)`)
  console.log(`   the published target        ${n(s.published)}  (SUM of sponsors_count, snapshot 2026-08-16)`)
  const pubMean = Number(s.published) / all
  console.log(`   the target's own mean       ${pubMean.toFixed(2)}`)
  console.log(`   ⚠ projection ÷ target       ${((mean / pubMean) * 100).toFixed(2)}%`)
  const gap = Number(s.published) - mean * all
  // ⚠⚠ AT 100% THERE IS NO SAMPLING ERROR, AND THE FIRST VERSION OF THIS PRINTED NONSENSE THERE.
  // The finite-population correction takes `se` to 0 when done == all, so a real +624 difference came
  // out as "624.0σ — OUTSIDE the sampling error, do NOT explain it yet, re-read this at 100%" while
  // sitting AT 100%. A guard that is right in the middle of its range and absurd at its boundary is
  // still a broken guard: the sigma framing only means anything while something is being estimated.
  // Once every motion is in, the difference is a FACT and the only question is what explains it.
  const complete = done >= all
  console.log(`   gap to target              ${n(Math.round(gap))}${complete ? '' : `  = ${(Math.abs(gap) / Math.max(se, 1)).toFixed(1)}σ`}`)
  if (complete) {
    console.log(`      → 100% sampled: this is not an estimate and not a discrepancy. It is the`)
    console.log(`        difference between the publisher's 2026-08-16 snapshot and what the API`)
    console.log(`        returns today, and the line below is its whole explanation.`)
  } else {
    const sigmas = Math.abs(gap) / Math.max(se, 1)
    console.log(`   ${sigmas < 2
      ? '   → inside the sampling error. Nothing to explain yet.'
      : `   → ⚠ OUTSIDE the sampling error at ${((100 * done) / all).toFixed(1)}% sampled. Do NOT explain it yet: the`
        + `\n        per-motion distribution is heavily right-tailed (sd ${sd.toFixed(1)} ≈ mean ${mean.toFixed(1)}), so a`
        + `\n        normal interval understates the spread of a SUM. Re-read this at 100%.`}`)
  }

  console.log(`\n   ⚠ AND THE TARGET IS ITSELF STALE. Over the motions answered so far the publisher's`)
  console.log(`     snapshot sums to ${n(s.snapshot_for_done)} and the arrays actually returned sum to ${n(held)}`)
  console.log(`     — a difference of ${n(held - Number(s.snapshot_for_done))} (${(((held - Number(s.snapshot_for_done)) / Math.max(1, Number(s.snapshot_for_done))) * 100).toFixed(3)}%), which is signatures added`)
  console.log(`     since 2026-08-16 rather than an error in either direction.`)

  const edgeRate = Number(s.edges) / Math.max(held, 1)
  console.log(`\n════ PROJECTED SIGNALS ${'═'.repeat(56)}`)
  console.log(`   edges ÷ rows held           ${(edgeRate * 100).toFixed(2)}%  (the rest are withdrawn,`)
  console.log(`                               the sponsor, or a member with no graph_entity)`)
  console.log(`   → projected signature signals ${n(Math.round(mean * all * edgeRate))}`)
  console.log(`   + sponsorship signals already stored 59,925`)
  console.log(`   = projected live edm_signature signals ${n(Math.round(mean * all * edgeRate) + 59_925)}`)

  await endNeonPool()
}
main().catch(async (e) => { console.error('FATAL', e instanceof Error ? e.stack : e); await endNeonPool().catch(() => {}); process.exit(1) })
