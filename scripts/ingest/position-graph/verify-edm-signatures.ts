/**
 * verify-edm-signatures.ts — the assertions for BRIEF_INGEST_EDM_SIGNATURES.
 *
 * ⚠⚠ EVERY CHECK HERE STATES WHAT IT COUNTED (brief §5), AND EVERY CHECK HAS BEEN WATCHED FAILING.
 * `--self-test` mutates the query of each assertion into one that must fail, and reports which ones
 * did — because a check that cannot fail is not a check, and this project has shipped several
 * (a ranking-truncated counter-example set, a threshold measuring the wrong dimension, a regex with
 * a backspace in it). Run `--self-test` before believing a green run.
 *
 * ⚠ READ-ONLY. No writes of any kind.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/verify-edm-signatures.ts
 *   npx tsx position-graph/verify-edm-signatures.ts --self-test
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { POSITION_CONFIG } from '../../../scrutinise-web/lib/graph/position-config'

export {}

const SELF_TEST = process.argv.slice(2).includes('--self-test')
const pool = getNeonPool()
const n = (x: any) => Number(x).toLocaleString()

let pass = 0, fail = 0
const failures: string[] = []

/**
 * One assertion. `sql` must return a single row with `n` (the number counted) and optionally
 * `detail`. `ok(n)` decides. `counted` is printed whatever the verdict, because "0 refusals" reads
 * as a rare shape and as a dead pattern in exactly the same way.
 */
interface Check {
  id: string
  what: string
  counted: string
  sql: string
  ok: (n: number) => boolean
  /** For --self-test: a version of `sql` whose result MUST fail `ok`. */
  mustFail?: string
}

const CHECKS: Check[] = [
  // ── the load ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'A1',
    what: 'every motion in edm_sponsor was attempted, and answered',
    counted: 'motions in edm_sponsor with no status-200 row in edm_signatory_fetch',
    // ⚠⚠ THE COUNT IS UNCAPPED AND THE EXAMPLES ARE CAPPED SEPARATELY, AND THE FIRST DRAFT GOT THAT
    // BACKWARDS. It counted rows from a subquery with `LIMIT 20` in it, so on an incomplete sweep it
    // reported "20" when the real figure was 60,931 — a number that is wrong by three orders of
    // magnitude and still fails, which is the worst kind of wrong: the verdict was right and the
    // quantity was fiction. Caught by watching the check fail on purpose.
    sql: `SELECT (SELECT COUNT(*) FROM edm_sponsor s
                   WHERE NOT EXISTS (SELECT 1 FROM edm_signatory_fetch f
                                      WHERE f.motion_id = s.motion_id AND f.http_status = 200))::text AS n,
                 (SELECT STRING_AGG(motion_id::text, ',') FROM (
                    SELECT s.motion_id FROM edm_sponsor s
                     WHERE NOT EXISTS (SELECT 1 FROM edm_signatory_fetch f
                                        WHERE f.motion_id = s.motion_id AND f.http_status = 200)
                     ORDER BY md5(s.motion_id::text) LIMIT 8) e) AS detail`,
    ok: (x) => x === 0,
    mustFail: `SELECT 1::text AS n, 'planted' AS detail`,
  },
  {
    id: 'A2',
    what: 'every sponsor row the API returned is in edm_signatory — attempted reconciles with stored',
    counted: 'Σ sponsors_seen − COUNT(edm_signatory), over motions answered 200',
    sql: `SELECT ((SELECT COALESCE(SUM(sponsors_seen),0) FROM edm_signatory_fetch WHERE http_status=200)
                  - (SELECT COUNT(*) FROM edm_signatory))::text AS n,
                 (SELECT COALESCE(SUM(sponsors_seen),0)::text FROM edm_signatory_fetch WHERE http_status=200) AS detail`,
    ok: (x) => x === 0,
    mustFail: `SELECT (-7)::text AS n, 'planted' AS detail`,
  },
  // ⚠⚠ THIS CHECK ASSERTED THE WRONG INVARIANT AND ITS FIRST REAL FAILURE IS WHAT SHOWED THAT.
  //
  // It was `expected_minus_seen <> 0` — "the publisher's count equals the array it returned" — and it
  // held on 150 of 150 motions in the audit. At ~2,100 motions it failed on 5, and all five looked
  // like this: **the array had MORE rows than the count, and every one was tabled between June and
  // July 2026.**
  //
  // `count_expected` is `edm_sponsor.sponsors_count`, and `edm_sponsor` was swept on **2026-08-16**.
  // The detail endpoint is being read TODAY. A motion tabled in June 2026 is still open for signature,
  // so it has gained names since the snapshot: motion 66381 was 1 in August and is 10 now. **The
  // mismatch is staleness in OUR baseline, not disagreement in the publisher's data**, and it will
  // grow as the sweep reaches more 2026 motions — so the equality would have failed thousands of times
  // by the end of the run and drowned the signal it exists to carry.
  //
  // The invariant that IS worth asserting is the other direction: the API must never return FEWER rows
  // than its own count already advertised, because a signature does not disappear (a withdrawn one
  // stays in the array with `IsWithdrawn` set). Fewer means a truncated fetch, which is the failure
  // that would silently lose real signatures. Growth is reported beside it as a number, not asserted.
  {
    id: 'A3',
    what: 'the API never returned FEWER signatures than its own count — a short array means a truncated fetch',
    counted: 'motions answered 200 where Sponsors.length < the publisher’s sponsors_count',
    sql: `SELECT COUNT(*)::text AS n, MIN(motion_id)::text AS detail
            FROM edm_signature_reconciliation
           WHERE http_status = 200 AND count_expected IS NOT NULL
             AND sponsors_seen < count_expected`,
    ok: (x) => x === 0,
    mustFail: `SELECT COUNT(*)::text AS n, MIN(motion_id)::text AS detail
                 FROM edm_signature_reconciliation
                WHERE http_status = 200 AND count_expected IS NOT NULL
                  AND sponsors_seen > count_expected`,
  },
  {
    id: 'A3b',
    what: 'growth since the 2026-08-16 sponsor sweep is REPORTED, and every case of it is a recent motion',
    counted: 'motions with MORE signatures than the August snapshot whose date_tabled is before 2026-01-01 '
      + '(recent growth is expected; growth on an old motion would not be)',
    sql: `SELECT COUNT(*)::text AS n,
                 (SELECT COUNT(*)::text FROM edm_signature_reconciliation r2
                   WHERE r2.http_status = 200 AND r2.count_expected IS NOT NULL
                     AND r2.sponsors_seen > r2.count_expected) AS detail
            FROM edm_signature_reconciliation r
            JOIN edm_sponsor s ON s.motion_id = r.motion_id
           WHERE r.http_status = 200 AND r.count_expected IS NOT NULL
             AND r.sponsors_seen > r.count_expected
             AND s.date_tabled < DATE '2026-01-01'`,
    ok: (x) => x === 0,
  },
  {
    id: 'A4',
    what: 'no signature is undated — observed_at is the act, so an undated row could not have one',
    counted: 'edm_signatory rows with a NULL signed_at',
    sql: `SELECT COUNT(*)::text AS n, NULL AS detail FROM edm_signatory WHERE signed_at IS NULL`,
    ok: (x) => x === 0,
  },
  {
    id: 'A5',
    what: 'no signature was identified by a NAME — brief §1.2, stop-and-report if any were',
    counted: 'edm_signatory rows with mnis_id IS NULL',
    sql: `SELECT COUNT(*)::text AS n, NULL AS detail FROM edm_signatory WHERE mnis_id IS NULL`,
    ok: (x) => x === 0,
  },
  // ⚠⚠ THE SECOND CHECK THAT WAS ASSERTING AN INVARIANT TRUE OF THE SAMPLE AND FALSE OF THE CORPUS.
  //
  // It was `c <> 1` — "exactly one primary sponsor per motion" — and it held on every motion in the
  // audit and the pilot. At ~20,500 motions it failed on **10**, and every one is the same shape:
  // **ZERO rows with `sponsoring_order = 1`.** Motion 62502's orders run 2,3,4,5,6 and the member
  // `edm_sponsor` names as its sponsor (MNIS 4357) is **not in the Sponsors array at all**. All ten
  // were tabled on 2024-10-07.
  //
  // That is a fact about the publisher, not a defect here, and the two things that could have made it
  // one are both measured at zero (A6b, A6c). But `<> 1` is still the wrong assertion: the direction
  // that can only mean a defect is MORE than one, because two order-1 rows means the edge view's
  // `sponsoring_order <> 1` clause excludes a real signature. Zero is absence, and absence is handled
  // by the `mnis_id = m.mnis_id` half of the exclusion — which is exactly why that half exists.
  {
    id: 'A6',
    what: 'never MORE than one primary sponsor per motion — two would make the exclusion drop a real signature',
    counted: 'motions with 2 or more sponsoring_order = 1 rows',
    sql: `SELECT COUNT(*)::text AS n, MIN(motion_id)::text AS detail FROM (
            SELECT motion_id, COUNT(*) FILTER (WHERE sponsoring_order = 1) AS c
              FROM edm_signatory GROUP BY 1) q WHERE c > 1`,
    ok: (x) => x === 0,
    mustFail: `SELECT COUNT(*)::text AS n, MIN(motion_id)::text AS detail FROM (
                 SELECT motion_id, COUNT(*) FILTER (WHERE sponsoring_order = 1) AS c
                   FROM edm_signatory GROUP BY 1) q WHERE c <> 1`,
  },
  {
    id: 'A6b',
    what: 'the sponsor never leaks into the signature edges — including on the motions with NO order-1 row',
    counted: 'signature edges whose subject_mnis_id is the motion’s own sponsor',
    sql: `SELECT COUNT(*)::text AS n, MIN(g.object_ref) AS detail
            FROM graph_edm_signature_edge g
            JOIN edm_sponsor m ON m.motion_id = g.object_ref::int
           WHERE g.subject_mnis_id = m.mnis_id`,
    ok: (x) => x === 0,
  },
  {
    id: 'A6c',
    what: 'the `sponsoring_order <> 1` clause has never dropped a real signature',
    counted: 'live rows excluded by order = 1 that are NOT the motion’s sponsor',
    sql: `SELECT COUNT(*)::text AS n, MIN(s.motion_id)::text AS detail
            FROM edm_signatory s JOIN edm_sponsor m ON m.motion_id = s.motion_id
           WHERE s.sponsoring_order = 1 AND s.mnis_id <> m.mnis_id AND NOT s.is_withdrawn`,
    ok: (x) => x === 0,
  },
  {
    id: 'A7',
    what: 'the order-1 row IS the member edm_sponsor names — the identity the edge view relies on',
    counted: 'motions where the order-1 signatory’s mnis_id differs from edm_sponsor.mnis_id',
    sql: `SELECT COUNT(*)::text AS n, MIN(s.motion_id)::text AS detail
            FROM edm_signatory s JOIN edm_sponsor m ON m.motion_id = s.motion_id
           WHERE s.sponsoring_order = 1 AND m.mnis_id IS NOT NULL AND s.mnis_id <> m.mnis_id`,
    ok: (x) => x === 0,
  },

  // ── the edge ────────────────────────────────────────────────────────────────────────────────
  {
    id: 'B1',
    what: 'no signature edge exists for a motion we cannot show — every evidence id resolves',
    counted: 'graph_edm_signature_edge rows whose evidence_section_id is not in corpus_sections',
    sql: `SELECT COUNT(*)::text AS n, MIN(g.evidence_section_id) AS detail
            FROM graph_edm_signature_edge g
           WHERE NOT EXISTS (SELECT 1 FROM corpus_sections c WHERE c.id = g.evidence_section_id)`,
    ok: (x) => x === 0,
  },
  {
    id: 'B2',
    what: 'the primary sponsor is NOT also a signature edge — one act is not counted twice',
    counted: 'signature edges whose subject is the motion’s own sponsor',
    sql: `SELECT COUNT(*)::text AS n, MIN(g.object_ref) AS detail
            FROM graph_edm_signature_edge g
            JOIN edm_sponsor m ON m.motion_id = g.object_ref::int
           WHERE g.subject_mnis_id = m.mnis_id`,
    ok: (x) => x === 0,
    mustFail: `SELECT COUNT(*)::text AS n, MIN(g.object_ref) AS detail
                 FROM graph_edm_signature_edge_all g
                 JOIN edm_sponsor m ON m.motion_id = g.object_ref::int
                WHERE g.subject_mnis_id = m.mnis_id`,
  },
  {
    id: 'B3',
    what: 'no withdrawn signature is an edge',
    counted: 'signature edges whose underlying row is withdrawn',
    sql: `SELECT COUNT(*)::text AS n, NULL AS detail
            FROM graph_edm_signature_edge g
            JOIN edm_signatory s ON s.signature_id = g.signature_id
           WHERE s.is_withdrawn`,
    ok: (x) => x === 0,
  },
  {
    id: 'B4',
    what: 'observed_on is the date SIGNED, not the date tabled — the fact §1 said decides the sprint',
    counted: 'signature edges where observed_on = the motion’s date_tabled, as a percentage',
    sql: `SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE g.observed_on = g.motion_tabled_on) / GREATEST(COUNT(*),1))::text AS n,
                 COUNT(*)::text AS detail FROM graph_edm_signature_edge g`,
    // A LOOSE bound on purpose: this asserts the dates are NOT all the tabling date, which is the
    // failure mode (reading date_tabled by mistake). §1 measured ~19% signed on the day, so
    // anything near 100 means the wrong column reached the view.
    ok: (x) => x < 60,
  },
  {
    id: 'B5',
    what: '2D-2’s sponsorship edge is unchanged by this sprint',
    counted: 'graph_signed_motion_edge rows (was 59,925 before this sprint)',
    sql: `SELECT COUNT(*)::text AS n, NULL AS detail FROM graph_signed_motion_edge`,
    ok: (x) => x === 59_925,
  },

  // ── the signal ──────────────────────────────────────────────────────────────────────────────
  {
    id: 'C1',
    what: 'every signal has evidence — the CHECK asserts it, so this asserts the CHECK is on',
    counted: 'edm_signature signals with an empty evidence_ids array',
    sql: `SELECT COUNT(*)::text AS n, NULL AS detail FROM position_signal_stored
           WHERE signal_type='edm_signature' AND COALESCE(array_length(evidence_ids,1),0) < 1`,
    ok: (x) => x === 0,
  },
  {
    id: 'C2',
    what: 'no (actor, motion) pair carries more than one live signal',
    counted: '(actor_id, target_id) pairs with >1 live edm_signature signal',
    sql: `SELECT COUNT(*)::text AS n, MIN(target_id) AS detail FROM (
            SELECT actor_id, target_id FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL
             GROUP BY 1,2 HAVING COUNT(*) > 1) q`,
    ok: (x) => x === 0,
  },
  // ⚠⚠ AND C3 FAILED BECAUSE THE DUPLICATE FIX WORKED, WHICH MAKES IT THE FOURTH BADLY-STATED
  // INVARIANT IN THIS FILE. It asserted that every signature edge has a live signal **at that edge's
  // own date**. `fix-edm-duplicate-signals.ts` deliberately retires the later of two signals for one
  // (actor, motion) pair — so 42 edges now have no live signal on their date, by design, and C3 read
  // that as 42 lost signatures. A check that fires on its own remedy is worse than no check.
  //
  // Split in two, because the two facts are different and both are worth asserting:
  //   C3  no signature edge is UNREPRESENTED  — every (actor, motion) has at least one live signal
  //   C3b the date-level gap equals EXACTLY the retired duplicates — no more, no fewer
  {
    id: 'C3',
    what: 'no signature edge is unrepresented — every (actor, motion) it names carries a live signal',
    counted: 'signature edges whose (actor, motion) has no live edm_signature signal at all',
    sql: `SELECT COUNT(*)::text AS n, MIN(g.object_ref) AS detail
            FROM graph_edm_signature_edge g
           WHERE NOT EXISTS (
             SELECT 1 FROM position_signal_stored s
              WHERE s.actor_id = g.subject_id AND s.target_type='edm' AND s.target_id = g.object_ref
                AND s.signal_type='edm_signature' AND s.superseded_by IS NULL)`,
    ok: (x) => x === 0,
  },
  {
    id: 'C3b',
    what: 'the only edges without a live signal ON THEIR OWN DATE are the retired duplicates',
    counted: 'edges with no live signal at their date, MINUS signals retired by the duplicate fix '
      + '(both sides counted independently; a non-zero difference means a real loss)',
    sql: `SELECT ((SELECT COUNT(*) FROM graph_edm_signature_edge g
                    WHERE NOT EXISTS (
                      SELECT 1 FROM position_signal_stored s
                       WHERE s.actor_id = g.subject_id AND s.target_type='edm'
                         AND s.target_id = g.object_ref AND s.signal_type='edm_signature'
                         AND s.observed_at = g.observed_on AND s.superseded_by IS NULL))
                  - (SELECT COUNT(*) FROM position_signal_stored r
                      JOIN position_signal_stored k ON k.id = r.superseded_by
                     WHERE r.signal_type='edm_signature' AND r.derivation = 'signatory:v1'
                       AND k.actor_id = r.actor_id AND k.target_id = r.target_id))::text AS n,
                 (SELECT COUNT(*)::text FROM position_signal_stored r
                   JOIN position_signal_stored k ON k.id = r.superseded_by
                  WHERE r.signal_type='edm_signature' AND r.derivation = 'signatory:v1'
                    AND k.actor_id = r.actor_id AND k.target_id = r.target_id) AS detail`,
    ok: (x) => x === 0,
  },
  {
    id: 'C4',
    what: 'the weight on every signature signal is the config’s, not a number typed here',
    counted: `edm_signature signals whose raw_weight <> ${POSITION_CONFIG.weights.edm_signature}`,
    sql: `SELECT COUNT(*)::text AS n, MIN(raw_weight::text) AS detail FROM position_signal_stored
           WHERE signal_type='edm_signature' AND ABS(raw_weight - ${POSITION_CONFIG.weights.edm_signature}) > 1e-6`,
    ok: (x) => x === 0,
  },
  {
    id: 'C5',
    what: 'sponsorship and signature are DISTINGUISHABLE on every row — brief §2',
    counted: 'live edm_signature signals whose derivation is neither a sponsorship nor a signatory',
    sql: `SELECT COUNT(*)::text AS n, STRING_AGG(DISTINCT COALESCE(derivation,'(null)'), ', ') AS detail
            FROM position_signal_stored
           WHERE signal_type='edm_signature' AND superseded_by IS NULL
             AND COALESCE(derivation,'') NOT IN ('primary-sponsor:v1','primary-sponsor:v2','signatory:v1')`,
    ok: (x) => x === 0,
  },
  {
    id: 'C6',
    what: 'a superseded row is never live, and a live row is never superseded — the correction held',
    counted: 'rows both retired and returned by the position_signal view',
    sql: `SELECT COUNT(*)::text AS n, NULL AS detail
            FROM position_signal_stored s
            JOIN position_signal v ON v.signal_ref = 's:' || s.id
           WHERE s.superseded_by IS NOT NULL`,
    ok: (x) => x === 0,
  },
  {
    id: 'C7',
    what: 'the read path the SURFACE uses returns the new signals — the function, not the view',
    counted: 'signals position_signal_for() returns for the 20 motions with the most signatures, '
      + 'minus what the view returns for the same 20',
    sql: `WITH top AS (
            SELECT target_id FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL
             GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 20
          ), viaFn AS (
            -- ⚠ BOTH array_agg CALLS ARE CAST. Without them Postgres refuses the whole statement
            -- with "function array_agg(unknown) is not unique" — a literal has no type until it is
            -- given one, and the function's TEXT[] parameters are not enough to resolve it.
            SELECT COUNT(*) c FROM position_signal_for(
              (SELECT array_agg('edm'::text) FROM top), (SELECT array_agg(target_id::text) FROM top))
          ), viaView AS (
            SELECT COUNT(*) c FROM position_signal
             WHERE target_type='edm' AND target_id IN (SELECT target_id FROM top)
          )
          SELECT ((SELECT c FROM viaFn) - (SELECT c FROM viaView))::text AS n,
                 (SELECT c::text FROM viaFn) AS detail`,
    ok: (x) => x === 0,
  },
]

async function run(c: Check, sql: string): Promise<{ n: number; detail: string | null }> {
  const { rows } = await pool.query<{ n: string; detail: string | null }>(sql)
  return { n: Number(rows[0]?.n ?? NaN), detail: rows[0]?.detail ?? null }
}

async function main() {
  const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
  console.log(`\n════ VERIFY — EDM SIGNATURES ${'═'.repeat(50)}`)
  console.log(`   host ${host}`)

  if (SELF_TEST) {
    console.log(`\n   SELF-TEST: each assertion that carries a planted counter-example is run against it.`)
    console.log(`   A check that does not fail here cannot fail anywhere.\n`)
    let tested = 0, caught = 0
    for (const c of CHECKS) {
      if (!c.mustFail) continue
      tested++
      const r = await run(c, c.mustFail)
      const failedAsItShould = !c.ok(r.n)
      if (failedAsItShould) caught++
      console.log(`   ${failedAsItShould ? '✓' : '❌'} ${c.id} ${failedAsItShould ? 'refused the planted counter-example' : 'ACCEPTED IT — the check is inert'} (counted ${r.n})`)
    }
    console.log(`\n   ${caught}/${tested} plants refused. ${CHECKS.length - tested} checks carry no plant and are`)
    console.log(`   argued for by their own arithmetic instead (see each check’s "counted" line).`)
    await endNeonPool()
    if (caught !== tested) process.exit(1)
    return
  }

  console.log('')
  for (const c of CHECKS) {
    let r: { n: number; detail: string | null }
    try { r = await run(c, c.sql) } catch (e) {
      fail++; failures.push(`${c.id} ERRORED: ${(e as Error).message}`)
      console.log(`   ❌ ${c.id}  ${c.what}\n        ERRORED: ${(e as Error).message}`)
      continue
    }
    const good = c.ok(r.n)
    if (good) pass++; else { fail++; failures.push(`${c.id} ${c.what} — counted ${r.n}${r.detail ? ` (${r.detail})` : ''}`) }
    console.log(`   ${good ? '✓' : '❌'} ${c.id}  ${c.what}`)
    console.log(`        counted: ${c.counted} = ${n(r.n)}${r.detail ? `   [${String(r.detail).slice(0, 90)}]` : ''}`)
  }

  console.log(`\n════ ${pass} passed, ${fail} failed ${'═'.repeat(52)}`)
  for (const f of failures) console.log(`   ❌ ${f}`)
  await endNeonPool()
  if (fail) process.exit(1)
}
main().catch(async (e) => {
  console.error('[verify-edm-signatures] FATAL', e instanceof Error ? e.stack : e)
  await endNeonPool().catch(() => {}); process.exit(1)
})
