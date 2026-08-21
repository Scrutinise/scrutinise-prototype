/**
 * audit-3c-distribution.ts — GRAPH 3C §1. The before/after distributions, with what each figure
 * is a proportion OF.
 *
 * Brief §6: *"the before/after distributions first, with what each figure is a proportion OF —
 * that is the evidence the score now means something."*
 *
 * ⚠ THE "BEFORE" COLUMN IS NOT RECOMPUTED HERE. It is 3B's measurement of the same table, taken
 * on 2026-08-20 and reproduced by `probe-3c.ts --section 2` on 2026-08-21 before anything in this
 * sprint was applied. Both are recorded below with their date. A "before" that this script derived
 * from today's rows would not be a before at all.
 *
 * Usage (from scripts/graph):  npx tsx audit-3c-distribution.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { configVersion } from '../../scrutinise-web/lib/graph/position-config'

export {}

/**
 * PREDICTIONS, written before `build-position-estimates.ts` was run with the 3C config.
 *
 * Reasoning recorded with each, so a miss is diagnosable rather than merely embarrassing.
 */
const PREDICTIONS = {
  // The signal layer's ROW COUNT is unchanged — 3C reclassifies signals, it does not add or
  // remove any — so the estimate count should be within a few rows of 3B's 2,304,858. Not exactly
  // equal, because `party-split:v1` now carries a weight where an unrecognised class would have
  // carried NULL, but nothing was unrecognised before either.
  estimates: 2_304_858,
  // A per-division estimate aggregates ONE vote, so its stance is w·d/(w·d + 0.9), which varies
  // with the weight class (6 of them) and the decay (one value per division date). ~2,000 distinct
  // division dates × up to 6 classes, plus the EDM arm. Call it 8,000. The number that matters is
  // that it clears §1's floor of 20 by orders of magnitude, not that this guess is close.
  distinct_stance: 8_000,
  // Nothing can reach |stance| = 1 any more: the shrinkage denominator is strictly greater than
  // the numerator whenever mass is finite. This one is not a guess, it is arithmetic, and it is
  // stated as a prediction so that a non-zero answer is a loud failure rather than a curiosity.
  at_abs_one: 0,
  // `consistency` is the OLD stance score, and the old table had exactly 3 distinct values. The
  // rebuild changes the CLASSIFICATION of some signals but not the fact that a division estimate
  // holds one vote, so consistency should still be exactly 3 values: +1, 0, -1.
  distinct_consistency: 3,
}

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}`)

    const { rows: [meta] } = await pool.query<{ config_version: string; as_of: string; built_at: string }>(
      `SELECT config_version, as_of::text, built_at::text FROM position_estimate_meta ORDER BY id DESC LIMIT 1`)
    console.log(`estimate table built by config_version ${meta.config_version}, as-of ${meta.as_of}, at ${meta.built_at}`)
    console.log(`this code's config_version               ${configVersion()}` +
      (meta.config_version === configVersion() ? '  ✓ same' : '  ⚠ DIFFERENT — the table is stale'))

    // ══ 1 · headline ══════════════════════════════════════════════════════════════════════════
    const { rows: [d] } = await pool.query<Record<string, string>>(`
      SELECT COUNT(*)::text AS n,
             COUNT(DISTINCT stance_score)::text AS ds,
             COUNT(DISTINCT consistency)::text  AS dc,
             COUNT(DISTINCT confidence)::text   AS df,
             COUNT(*) FILTER (WHERE ABS(stance_score) >= 0.999999)::text AS at1,
             COUNT(*) FILTER (WHERE consistency IS NULL)::text AS nullc,
             MAX(ABS(stance_score))::text AS maxabs,
             MAX(confidence)::text AS maxconf
        FROM position_estimate`)
    const n = Number(d.n)
    const pc = (x: number) => `${((100 * x) / n).toFixed(4)}%`

    console.log(`\n════ 1 · THE HEADLINE — every % below is OF ALL ${n.toLocaleString()} ESTIMATE ROWS ════`)
    const rows: Array<[string, string, string, number | null]> = [
      ['estimate rows', '2,304,858', Number(d.n).toLocaleString(), PREDICTIONS.estimates],
      ['distinct stance_score values', '3', Number(d.ds).toLocaleString(), PREDICTIONS.distinct_stance],
      ['distinct consistency values', '(was the stance column: 3)', Number(d.dc).toLocaleString(), PREDICTIONS.distinct_consistency],
      ['distinct confidence values', '18,701', Number(d.df).toLocaleString(), null],
      ['rows at |stance| = 1.00', `2,140,510 (92.87%)`, `${Number(d.at1).toLocaleString()} (${pc(Number(d.at1))})`, PREDICTIONS.at_abs_one],
      ['max |stance|', '1.000000', Number(d.maxabs).toFixed(6), null],
      ['max confidence', '0.496962', Number(d.maxconf).toFixed(6), null],
    ]
    console.log(`  ${'measure'.padEnd(30)} ${'BEFORE (3B, 20 Aug)'.padStart(26)}  ${'AFTER (3C)'.padStart(22)}  predicted`)
    for (const [label, before, after, pred] of rows) {
      console.log(`  ${label.padEnd(30)} ${before.padStart(26)}  ${after.padStart(22)}  ${pred === null ? '—' : pred.toLocaleString()}`)
    }
    if (Number(d.nullc) > 0) console.log(`  ⚠ ${Number(d.nullc).toLocaleString()} rows have a NULL consistency — written by a build predating 3C`)
    console.log(`\n  §1's own floor: at least 20 distinct stance values across 2.3M rows.`)
    console.log(`  ${Number(d.ds) >= 20 ? `✓ ${Number(d.ds).toLocaleString()} — cleared by ${Math.round(Number(d.ds) / 20)}×` : `❌ ${d.ds} — THE FIX HAS NOT WORKED`}`)

    // ══ 2 · the stance distribution ═══════════════════════════════════════════════════════════
    console.log(`\n════ 2 · STANCE — the histogram that used to be three lines ════`)
    const { rows: st } = await pool.query<{ b: string; n: string }>(`
      SELECT CASE WHEN stance_score = 0 THEN 'a  exactly 0'
                  WHEN ABS(stance_score) < 0.10 THEN 'b  |s| 0.00-0.10'
                  WHEN ABS(stance_score) < 0.20 THEN 'c  |s| 0.10-0.20'
                  WHEN ABS(stance_score) < 0.30 THEN 'd  |s| 0.20-0.30'
                  WHEN ABS(stance_score) < 0.40 THEN 'e  |s| 0.30-0.40'
                  WHEN ABS(stance_score) < 0.50 THEN 'f  |s| 0.40-0.50'
                  WHEN ABS(stance_score) < 0.75 THEN 'g  |s| 0.50-0.75'
                  ELSE                               'h  |s| 0.75-1.00' END AS b,
             COUNT(*)::text AS n
        FROM position_estimate GROUP BY 1 ORDER BY 1`)
    for (const r of st) {
      const c = Number(r.n)
      console.log(`  ${r.b.slice(3).padEnd(18)} ${c.toLocaleString().padStart(11)}  ${pc(c).padStart(9)}  ${'█'.repeat(Math.max(0, Math.round((60 * c) / n)))}`)
    }

    console.log(`\n════ 3 · CONFIDENCE — before, and after ════`)
    const { rows: cb } = await pool.query<{ b: string; n: string }>(`
      SELECT CASE WHEN confidence < 0.05 THEN 'a 0.00-0.05'
                  WHEN confidence < 0.10 THEN 'b 0.05-0.10'
                  WHEN confidence < 0.15 THEN 'c 0.10-0.15'
                  WHEN confidence < 0.35 THEN 'd 0.15-0.35'
                  WHEN confidence < 0.50 THEN 'e 0.35-0.50'
                  WHEN confidence < 0.65 THEN 'f 0.50-0.65'
                  ELSE                        'g 0.65+' END AS b,
             COUNT(*)::text AS n
        FROM position_estimate GROUP BY 1 ORDER BY 1`)
    const beforeConf: Record<string, string> = {
      '0.00-0.05': '511,048 (22.17%)', '0.05-0.10': '959,862 (41.65%)',
      '0.10-0.15': '720,123 (31.25%)', '0.15-0.35': '113,825 (4.94%) [0.15-0.50]',
      '0.35-0.50': '(in the row above)', '0.50-0.65': '0 (0%)', '0.65+': '0 (0%)',
    }
    for (const r of cb) {
      const key = r.b.slice(2)
      const c = Number(r.n)
      console.log(`  ${key.padEnd(12)} before ${(beforeConf[key] ?? '—').padStart(28)}   after ${c.toLocaleString().padStart(11)}  ${pc(c).padStart(9)}`)
    }

    // ══ 4 · by target type ═══════════════════════════════════════════════════════════════════
    console.log(`\n════ 4 · BY TARGET TYPE — % columns are OF THAT TYPE'S OWN ROWS ════`)
    const { rows: tt } = await pool.query<Record<string, string>>(`
      SELECT target_type, COUNT(*)::text AS n,
             COUNT(DISTINCT stance_score)::text AS ds,
             COUNT(DISTINCT confidence)::text AS df,
             ROUND(AVG(ABS(stance_score))::numeric, 4)::text AS mean_abs,
             ROUND(AVG(confidence)::numeric, 4)::text AS mean_conf,
             ROUND(MAX(confidence)::numeric, 4)::text AS max_conf
        FROM position_estimate GROUP BY 1 ORDER BY 2::bigint DESC`)
    console.log(`  ${'type'.padEnd(14)} ${'rows'.padStart(11)} ${'distinct s'.padStart(11)} ${'distinct c'.padStart(11)} ${'mean |s|'.padStart(9)} ${'mean conf'.padStart(10)} ${'max conf'.padStart(9)}`)
    for (const r of tt) {
      console.log(`  ${r.target_type.padEnd(14)} ${Number(r.n).toLocaleString().padStart(11)} ${Number(r.ds).toLocaleString().padStart(11)} ${Number(r.df).toLocaleString().padStart(11)} ${r.mean_abs.padStart(9)} ${r.mean_conf.padStart(10)} ${r.max_conf.padStart(9)}`)
    }

    // ══ 5 · the class reclassification, which is what moved the numbers ══════════════════════
    console.log(`\n════ 5 · WHAT §2 RECLASSIFIED — vote signals by class, % OF ALL VOTE SIGNALS ════`)
    //
    // ⚠⚠ THE "BEFORE" COLUMN IS RECONSTRUCTED BY QUERY, NOT TYPED IN FROM A REPORT.
    //
    // My first draft of this block hard-coded six numbers I had inferred, and one of them
    // (`whipped-with:v1`) I had not measured at all — the derivation had already been re-run, so
    // the pre-3C counts were gone from the database and I was about to publish an arithmetic
    // guess beside five measurements with nothing to distinguish them.
    //
    // They do not have to be guessed. 3A/3B's classification is exactly reproducible from what is
    // still here: the FIVE-argument `position_vote_class()` is untouched (setup-3c refuses DROPs),
    // and the old free-vote rule is recoverable because `free_vote_source` records which of the 36
    // divisions were tagged on their own numbers ('no-party-cohesive', the 34 3A had) and which by
    // propagation (the 2 3C added). So the query below IS 3A/3B's ladder, run today.
    const { rows: before } = await pool.query<{ derivation: string; n: string }>(`
      SELECT position_vote_class(pp.is_unwhipped_group,
                                 dc.free_vote_source = 'no-party-cohesive',
                                 pp.is_whipped_party, pp.majority_side, v.vote) AS derivation,
             COUNT(*)::text AS n
        FROM division_votes v
        JOIN graph_entity e ON e.parl_member_id = v.member_id AND e.kind = 'person'
        JOIN position_division_class dc ON dc.house = v.house AND dc.division_id = v.division_id
        LEFT JOIN position_division_party pp
          ON pp.house = v.house AND pp.division_id = v.division_id AND pp.party = v.party
       WHERE v.vote IN ('aye','no')
       GROUP BY 1`)
    const before3B: Record<string, number> = Object.fromEntries(
      before.map((r) => [r.derivation, Number(r.n)]))
    before3B['party-split:v1'] ??= 0
    const { rows: cls } = await pool.query<{ derivation: string; n: string }>(
      `SELECT derivation, COUNT(*)::text AS n FROM position_signal_vote GROUP BY 1 ORDER BY 2::bigint DESC`)
    const totalVotes = cls.reduce((a, r) => a + Number(r.n), 0)
    console.log(`  ${'class'.padEnd(30)} ${'after'.padStart(11)} ${'% of votes'.padStart(11)}  ${'before (3B)'.padStart(12)}  delta`)
    for (const r of cls) {
      const after = Number(r.n)
      const before = before3B[r.derivation]
      const delta = before === undefined ? '' : `${after - before > 0 ? '+' : ''}${(after - before).toLocaleString()}`
      console.log(`  ${r.derivation.padEnd(30)} ${after.toLocaleString().padStart(11)} ` +
        `${((100 * after) / totalVotes).toFixed(3).padStart(10)}%  ${(before === undefined ? '—' : before.toLocaleString()).padStart(12)}  ${delta}`)
    }
    console.log(`  ${'TOTAL'.padEnd(30)} ${totalVotes.toLocaleString().padStart(11)}`)
    const beforeTotal = Object.values(before3B).reduce((a, b) => a + b, 0)
    console.log(`  ${'(before, reconstructed)'.padEnd(30)} ${beforeTotal.toLocaleString().padStart(11)}` +
      (beforeTotal === totalVotes ? '  ✓ same rows, reclassified — nothing added, nothing lost'
        : `  ❌ ROW COUNT MOVED by ${(totalVotes - beforeTotal).toLocaleString()} — the reconstruction is not comparable`))
    const lostRebels = (before3B['rebellion:v1'] ?? 0) - Number(cls.find((c) => c.derivation === 'rebellion:v1')?.n ?? 0)
    console.log(`\n  ⚠ The ${lostRebels.toLocaleString()} signals that left rebellion:v1 did not vanish. They are now`)
    console.log(`    party-split:v1 or free-vote-heuristic:v1, at 0.7 instead of 0.9 — a vote cast in a party`)
    console.log(`    that did not hold together, which is the member's own view and not an act of defiance.`)

    // ══ 6 · storage, priced ══════════════════════════════════════════════════════════════════
    const { rows: [sz] } = await pool.query<{ tbl: string; bytes: string; db: string }>(`
      SELECT pg_size_pretty(pg_total_relation_size('position_estimate')) AS tbl,
             pg_total_relation_size('position_estimate')::text AS bytes,
             pg_database_size(current_database())::text AS db`)
    console.log(`\n════ 6 · WHAT THE TABLE COSTS — closing 3A's D-1 ════`)
    console.log(`  position_estimate  ${sz.tbl}  =  $${((Number(sz.bytes) / 1e9) * 0.35).toFixed(3)} / month at $0.35 per GB-month`)
    console.log(`  whole database     ${(Number(sz.db) / 1e9).toFixed(2)} GB  =  $${((Number(sz.db) / 1e9) * 0.35).toFixed(2)} / month`)
    console.log(`  3A's D-1 proposed dropping 90% of these rows to save space. At these prices that`)
    console.log(`  saves under twenty cents a month. CLOSED — do not drop them.`)
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[audit-3c-distribution] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
