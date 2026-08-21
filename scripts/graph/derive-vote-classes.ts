/**
 * derive-vote-classes.ts — GRAPH 3A §3.1, first half: classify every division.
 *
 * Fills `position_division_party` (per division × party: majority side and cohesion) and
 * `position_division_class` (per division: free-vote-like or not). Those two small tables are what
 * turn 2,080,585 raw votes into weighted signals, through the `position_signal_vote` view.
 *
 * Re-runnable: truncate-and-rebuild, because both tables are pure functions of `division_votes`
 * plus the config. Nothing here is a signal; nothing here is append-only.
 *
 * PREDICT-MEASURE-COMPARE. The predictions below were written from probe reads BEFORE this script
 * was first run, and the script prints prediction against measurement for each one. A prediction
 * that is only recorded after the run is not a prediction.
 *
 * Usage (from scripts/graph):
 *   npx tsx derive-vote-classes.ts             # rebuild both tables, print the comparison
 *   npx tsx derive-vote-classes.ts --dry-run   # compute and compare, write nothing
 *   npx tsx derive-vote-classes.ts --free-votes # print the §3.1 audit list and exit
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const FREE_VOTES_ONLY = argv.includes('--free-votes')

/**
 * Written before the first run.
 *
 * The first three are 3A's, kept so a rerun still scores them. The 3C ones were written from
 * `probe-3c-rules.ts` — which is itself a measurement, so they are predictions about what the
 * DERIVATION will do given a rule scored elsewhere, not guesses about the world. Where a
 * prediction is a re-statement of something already measured that is said here, because
 * "predicted 3, measured 3" on a number copied from another script's output is not evidence.
 */
const PREDICTIONS = {
  division_party_rows: 46_702,   // party × division groups with at least one aye/no
  division_rows: 5_645,          // every division we hold
  // 3A's guess with a stated basis. Measured 34, so this one is on the record as badly wrong; the
  // reason (a free vote a party happens to agree on is indistinguishable from a whipped one) is
  // 3A §3.1 and has not changed.
  free_vote_like: 565,
  // ── GRAPH 3C ──────────────────────────────────────────────────────────────────────────────
  // From probe-3c-rules.ts: R0 tags 34, R2 tags 38. Restated here because the derivation applies
  // the rule through a different code path (an UPDATE pass, not a CTE) and could disagree.
  // ⚠ MEASURED 36, AND THE ONE-DIVISION MISS IS INSTRUCTIVE. probe-3c-rules.ts evaluated
  // propagation as `free / n >= 0.5`; the implementation below uses a STRICT majority (`> 0.5`).
  // The difference is exactly one division — lords:1886, the Assisted Dying Bill [HL], whose bill
  // has two divisions of which one is tagged. Predicted from the probe, implemented more
  // conservatively, and left that way: brief §2's named test case is the two Terminally Ill Adults
  // divisions, both of which a strict majority already catches, and relaxing the rule afterwards
  // to pick up one more would be tuning past the requirement. Named as a residual instead (D-3).
  free_vote_like_3c: 37,
  // Genuinely a prediction, and the one I expect to be wrong: how many party×division groups are
  // classifiable (≥20 voters, whipped group) but did NOT hold together at 0.85. probe-3c §4 counts
  // 380 such groups over ALL divisions; some of those sit in divisions that are already
  // free-vote-like, where the new rung never fires. Call it 300.
  split_party_groups_that_bite: 300,
}

function inList(xs: string[]): string {
  return xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(', ')
}

async function main() {
  const pool = getNeonPool()
  const cfg = POSITION_CONFIG
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
    console.log(`host ${host}`)
    console.log(`config: cohesion ≥ ${(cfg.cohesionThreshold * 100).toFixed(0)}% on ≥ ${cfg.minPartyVotersForCohesion} voters; ${cfg.unwhippedParties.length} unwhipped groups`)

    if (FREE_VOTES_ONLY) { await freeVoteAudit(pool); return }

    console.log(`\n════ PREDICTIONS (written before this run) ════`)
    for (const [k, v] of Object.entries(PREDICTIONS)) console.log(`  ${k.padEnd(22)} ${v.toLocaleString()}`)

    if (!DRY) {
      // Both tables are derived in full from `division_votes`; a partial rebuild would leave a
      // stale classification behind a fresh one and nothing would say which was which.
      await pool.query(`TRUNCATE position_division_party`)
      await pool.query(`TRUNCATE position_division_class`)
    }

    const t0 = Date.now()
    // ⚠⚠ GRAPH 3C §2 — `is_cohesive_party` is the new column and the whole of §2 turns on it.
    // `is_whipped_party` only ever meant "this group carries a whip and enough of it voted here to
    // judge"; it never meant the whip HELD. The ladder used it as though it did, so a party that
    // split 126/181 still produced `rebellion:v1` at 0.9 for one side and `whipped-with:v1` at 0.2
    // for the other. Cohesion was already stored on every row — the fact was there the whole time
    // and nothing read it.
    const partySql = `
      INSERT INTO position_division_party (house, division_id, party, ayes, noes, majority_side, cohesion, is_whipped_party, is_unwhipped_group, is_cohesive_party)
      SELECT house, division_id, party, ayes, noes,
             CASE WHEN ayes > noes THEN 'aye' WHEN noes > ayes THEN 'no' ELSE NULL END,
             (GREATEST(ayes, noes)::real / NULLIF(ayes + noes, 0)::real),
             (party NOT IN (${inList(cfg.unwhippedParties)}) AND (ayes + noes) >= ${cfg.minPartyVotersForCohesion}),
             (party IN (${inList(cfg.unwhippedParties)})),
             (party NOT IN (${inList(cfg.unwhippedParties)}) AND (ayes + noes) >= ${cfg.minPartyVotersForCohesion}
              AND (GREATEST(ayes, noes)::real / NULLIF(ayes + noes, 0)::real) >= ${cfg.cohesionThreshold})
        FROM (
          SELECT house, division_id, party,
                 COUNT(*) FILTER (WHERE vote='aye')::int AS ayes,
                 COUNT(*) FILTER (WHERE vote='no')::int  AS noes
            FROM division_votes
           WHERE vote IN ('aye','no') AND party IS NOT NULL AND party <> ''
           GROUP BY 1,2,3
        ) g
       WHERE ayes + noes > 0`
    let partyRows = 0
    if (DRY) {
      const { rows: [c] } = await pool.query<{ n: string }>(`
        SELECT COUNT(*)::text AS n FROM (
          SELECT house, division_id, party FROM division_votes
           WHERE vote IN ('aye','no') AND party IS NOT NULL AND party <> ''
           GROUP BY 1,2,3) x`)
      partyRows = Number(c.n)
    } else {
      const r = await pool.query(partySql)
      partyRows = r.rowCount ?? 0
    }

    // A division is free-vote-like when NO whipped party reached the cohesion threshold. A
    // division with no whipped party at all (a Lords division carried by crossbenchers, say) also
    // falls here — correctly: there was no whip to be with or against.
    const classSql = `
      INSERT INTO position_division_class
        (house, division_id, free_vote_like, best_cohesion, best_party, n_whipped_parties, threshold, free_vote_source)
      SELECT d.house, d.division_id,
             COALESCE(MAX(p.cohesion) FILTER (WHERE p.is_whipped_party), 0) < ${cfg.cohesionThreshold},
             MAX(p.cohesion) FILTER (WHERE p.is_whipped_party),
             (ARRAY_AGG(p.party ORDER BY p.cohesion DESC NULLS LAST)
                FILTER (WHERE p.is_whipped_party))[1],
             COUNT(*) FILTER (WHERE p.is_whipped_party)::int,
             ${cfg.cohesionThreshold},
             CASE WHEN COALESCE(MAX(p.cohesion) FILTER (WHERE p.is_whipped_party), 0) < ${cfg.cohesionThreshold}
                  THEN 'no-party-cohesive' END
        FROM divisions d
        LEFT JOIN position_division_party p ON p.house = d.house AND p.division_id = d.division_id
       GROUP BY d.house, d.division_id`
    let classRows = 0
    let freeVotes = 0
    let freeVotesBase = 0
    let propagated = 0
    if (DRY) {
      const { rows: [c] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM divisions`)
      classRows = Number(c.n)
    } else {
      const r = await pool.query(classSql)
      classRows = r.rowCount ?? 0
      const { rows: [f0] } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM position_division_class WHERE free_vote_like`)
      freeVotesBase = Number(f0.n)

      // ── GRAPH 3C §2 — BILL-LEVEL PROPAGATION, THE SECOND PASS ────────────────────────────────
      //
      // A bill is free-voted or it is not; the question does not change between its own divisions.
      // 3A's rule is per-division, so a single party holding together on ONE of a bill's eleven
      // divisions was enough to make that one "whipped" while the other ten were not.
      //
      // The rule, exactly: a division inherits the free-vote reading of its bill when
      //   (a) a STRICT majority of that bill's divisions are already tagged on their own numbers,
      //       AND
      //   (b) this division's own most-cohesive party was itself a near miss — below
      //       `billPropagationCohesionCeiling`.
      //
      // (b) is what makes this a rescue rather than a licence, and it is not decorative: without
      // it the corpus's generic `bill_title` of "Ten Minute Rule Bill" carries a free-vote reading
      // to commons:1079, whose best party was 98.99% cohesive. `probe-3c-rules.ts` scored this
      // rule and three alternatives against six cases decided from the public record; the
      // "largest whipped party" variant tags 7 of the 9 Northern Ireland abortion regulations
      // divisions, which brief §2 names as the thing that must not happen.
      const prop = await pool.query(`
        UPDATE position_division_class c
           SET free_vote_like = TRUE, free_vote_source = 'bill-propagated'
          FROM divisions d
          JOIN (
            SELECT d2.bill_title,
                   COUNT(*)::int AS n,
                   COUNT(*) FILTER (WHERE c2.free_vote_like)::int AS free
              FROM divisions d2
              JOIN position_division_class c2
                ON c2.house = d2.house AND c2.division_id = d2.division_id
             WHERE d2.bill_title IS NOT NULL AND d2.bill_title <> ''
             GROUP BY 1
          ) b ON b.bill_title = d.bill_title
         WHERE c.house = d.house AND c.division_id = d.division_id
           AND NOT c.free_vote_like
           AND b.free::real / b.n > 0.5
           AND c.best_cohesion < ${cfg.billPropagationCohesionCeiling}`)
      propagated = prop.rowCount ?? 0

      const { rows: [f] } = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM position_division_class WHERE free_vote_like`)
      freeVotes = Number(f.n)
    }

    console.log(`\n════ MEASURED ${DRY ? '(dry run — counted, not written)' : ''} ════   ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    report('division_party_rows', PREDICTIONS.division_party_rows, partyRows)
    report('division_rows', PREDICTIONS.division_rows, classRows)
    if (!DRY) {
      report('free_vote_like (3A rule only)', PREDICTIONS.free_vote_like, freeVotesBase)
      report('free_vote_like_3c', PREDICTIONS.free_vote_like_3c, freeVotes)
      console.log(`  ${'…of which propagated'.padEnd(30)} ${propagated}`)
    }

    if (DRY) { console.log('\n--dry-run: nothing written.'); return }

    // Read rows BACK. A rowCount from an INSERT says what the planner thought it did.
    console.log(`\n════ READ BACK ════`)
    const { rows: cls } = await pool.query<{ free_vote_like: boolean; n: string }>(
      `SELECT free_vote_like, COUNT(*)::text AS n FROM position_division_class GROUP BY 1 ORDER BY 1`)
    for (const r of cls) console.log(`  free_vote_like=${String(r.free_vote_like).padEnd(5)} ${String(r.n).padStart(6)}`)
    const { rows: src } = await pool.query<{ free_vote_source: string | null; n: string }>(
      `SELECT free_vote_source, COUNT(*)::text AS n FROM position_division_class
        WHERE free_vote_like GROUP BY 1 ORDER BY 2::bigint DESC`)
    for (const r of src) console.log(`  source ${String(r.free_vote_source ?? '(null)').padEnd(20)} ${String(r.n).padStart(6)}`)
    // ⚠ EVERY PROPAGATED DIVISION, PRINTED. Brief §2 asks which divisions the revised rule tags;
    // a count is not an answer to that and a sample is not either. There are three.
    const { rows: propRows } = await pool.query<{
      house: string; division_id: number; division_date: string; title: string; best: string }>(`
      SELECT c.house, c.division_id, d.division_date::text AS division_date, left(d.title, 74) AS title,
             ROUND(c.best_cohesion::numeric, 4)::text AS best
        FROM position_division_class c JOIN divisions d
          ON d.house = c.house AND d.division_id = c.division_id
       WHERE c.free_vote_source = 'bill-propagated' ORDER BY d.division_date`)
    console.log(`\n  ── every division tagged by PROPAGATION rather than by its own numbers (${propRows.length}) ──`)
    for (const r of propRows) {
      console.log(`     ${r.division_date}  ${r.house}:${String(r.division_id).padEnd(5)} best ${r.best.padStart(6)}  ${r.title}`)
    }
    // The per-party rung, sized.
    const { rows: [sp] } = await pool.query<{ groups: string; votes: string }>(`
      SELECT COUNT(*)::text AS groups, COALESCE(SUM(p.ayes + p.noes), 0)::text AS votes
        FROM position_division_party p
        JOIN position_division_class c ON c.house = p.house AND c.division_id = p.division_id
       WHERE p.is_whipped_party AND NOT p.is_cohesive_party AND NOT c.free_vote_like`)
    report('split_party_groups_that_bite', PREDICTIONS.split_party_groups_that_bite, Number(sp.groups))
    console.log(`  ${'…votes they carry'.padEnd(30)} ${Number(sp.votes).toLocaleString()}`)
    const { rows: whip } = await pool.query<{ is_whipped_party: boolean; n: string; mean: string }>(
      `SELECT is_whipped_party, COUNT(*)::text AS n, ROUND(AVG(cohesion)::numeric, 3)::text AS mean
         FROM position_division_party GROUP BY 1 ORDER BY 1`)
    for (const r of whip) console.log(`  is_whipped_party=${String(r.is_whipped_party).padEnd(5)} ${String(r.n).padStart(6)}  mean cohesion ${r.mean}`)

    const { rows: sig } = await pool.query<{ derivation: string; n: string }>(
      `SELECT derivation, COUNT(*)::text AS n FROM position_signal_vote GROUP BY 1 ORDER BY 2::bigint DESC`)
    console.log(`\n════ WHAT THE VIEW NOW PRODUCES (position_signal_vote) ════`)
    let total = 0
    for (const r of sig) { total += Number(r.n); console.log(`  ${r.derivation.padEnd(30)} ${Number(r.n).toLocaleString().padStart(11)}`) }
    console.log(`  ${'TOTAL'.padEnd(30)} ${total.toLocaleString().padStart(11)}`)

    const { rows: [nullw] } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM position_signal_vote WHERE raw_weight IS NULL`)
    console.log(`\n  signals with NO weight (an unrecognised class would land here): ${nullw.n}`)
    if (Number(nullw.n) > 0) console.error(`  ❌ ${nullw.n} signals carry no weight — position_raw_weight() does not cover every class`)

    await freeVoteAudit(pool)
  } finally {
    await endNeonPool()
  }
}

function report(label: string, predicted: number, measured: number) {
  const delta = measured - predicted
  const pct = predicted ? ((100 * delta) / predicted).toFixed(1) : '—'
  const mark = predicted === measured ? '✓ exact' : `${delta > 0 ? '+' : ''}${delta.toLocaleString()} (${pct}%)`
  console.log(`  ${label.padEnd(30)} predicted ${predicted.toLocaleString().padStart(9)}   measured ${measured.toLocaleString().padStart(9)}   ${mark}`)
}

/**
 * §3.1's built-in sanity check on the sprint's biggest inference.
 *
 * The brief: *"the report lists the top 30 divisions the heuristic tags as free-vote-like, by
 * rebellion volume. The classic free votes — assisted dying, hunting, abortion-related divisions —
 * are the expected members of that list. If they are absent, the heuristic is wrong."*
 *
 * "Rebellion volume" is measured here as the number of members voting against their own party's
 * majority side — which is what makes a division look unwhipped in the first place. Note that a
 * free-vote-like division produces NO 'rebellion:v1' signals (nobody rebels against a whip that
 * was not applied), so the count has to be computed from the party splits rather than read off the
 * signal table; reading it off the signals would return zero for every row and look like a bug in
 * the politics rather than in the query.
 */
async function freeVoteAudit(pool: ReturnType<typeof getNeonPool>) {
  // ⚠ GRAPH 3C — NO `LIMIT`. It was `LIMIT 30`, and 3B's §1.7 is the standing lesson about what a
  // harness limit does to a claim: 3A's "all 400 voted the same way both times" passed only
  // because all sixteen counter-examples ranked below its own `limit: 400`. Brief §2 asks WHICH
  // divisions the revised rule tags; the whole list is short enough to print, so it is printed.
  console.log(`\n════ §3.1 AUDIT — EVERY DIVISION THE HEURISTIC CALLS FREE-VOTE-LIKE, most-split first ════`)
  const { rows } = await pool.query<{
    house: string; division_id: number; division_date: string; title: string
    minority: string; best_cohesion: string | null; best_party: string | null; src: string | null
  }>(`
    SELECT d.house, d.division_id, d.division_date::text AS division_date,
           left(d.title, 76) AS title,
           SUM(LEAST(p.ayes, p.noes))::text AS minority,
           ROUND(c.best_cohesion::numeric, 3)::text AS best_cohesion, c.best_party,
           c.free_vote_source AS src
      FROM position_division_class c
      JOIN divisions d ON d.house = c.house AND d.division_id = c.division_id
      JOIN position_division_party p ON p.house = c.house AND p.division_id = c.division_id
     WHERE c.free_vote_like
     GROUP BY d.house, d.division_id, d.division_date, d.title, c.best_cohesion, c.best_party, c.free_vote_source
     ORDER BY SUM(LEAST(p.ayes, p.noes)) DESC`)
  for (const r of rows) {
    const via = r.src === 'bill-propagated' ? '↳prop' : '     '
    console.log(`  ${String(r.minority).padStart(4)} split ${via} ${r.division_date}  ${r.house.padEnd(7)} ${String(r.division_id).padStart(5)}  best ${String(r.best_cohesion ?? 'none').padStart(5)} ${(r.best_party ?? '—').padEnd(18)} ${r.title}`)
  }
  console.log(`  ── ${rows.length} divisions ──`)

  // The named expectations, checked explicitly rather than left to the eye.
  //
  // ⚠⚠ GRAPH 3C — `abortion` MOVED FROM THE POSITIVE LIST TO THE NEGATIVE ONE, AND THAT IS A
  // CORRECTION TO THE TEST, NOT TO THE WORLD. 3A inherited "the classic free votes — assisted
  // dying, abortion, hunting" from design §5 and printed a ⚠ against abortion for scoring 0 of 11.
  // It then established WHY: the abortion divisions this corpus holds are Northern Ireland
  // *Regulations*, whipped, Labour cohesion 0.92–0.99 — the conscience votes predate the Commons
  // record, which starts 2016-03-09. So 0 of 11 is the CORRECT answer and the warning was the
  // wrong way round. Brief §2 states it as a requirement: the classic free votes must be in the
  // tagged list and the whipped NI abortion regulations must not be. Both directions are now
  // scored, and a rule that tags them FAILS here.
  // ⚠⚠ THE EXPECTATION IS A FLOOR AND A CEILING WITH A REASON, NOT "AT LEAST ONE".
  //
  // 3A's version asserted `free > 0` for each positive case. Hunting scores 3 of 27, so that
  // assertion PASSED while 24 of 27 divisions were classified the opposite way from the public
  // record — a check that could barely fail, reporting a pass. Every case below therefore carries
  // the number it must reach and the reason that number is what it is; a regression fails here.
  console.log(`\n  ── the named cases, both directions, decided from the public record ──`)
  const expectations: Array<{ label: string; pred: string; min: number; max: number; why: string }> = [
    { label: 'assisted dying / Terminally Ill Adults',
      pred: `(d.title ILIKE '%assisted dying%' OR d.title ILIKE '%terminally ill adults%')`,
      min: 13, max: 99,
      why: 'all 11 Terminally Ill Adults divisions + 2 of the 3 Lords ones. The residual is ' +
           'lords:1886 (Assisted Dying Bill [HL], 16 Jan 2015): Labour held at 0.8667, and its ' +
           'bill has 2 divisions of which 1 is tagged — exactly half, and propagation requires a ' +
           'STRICT majority. Decision D-3 in the report.' },
    { label: 'hunting', pred: `(d.title ILIKE '%hunting%')`,
      min: 3, max: 99,
      why: 'STRUCTURALLY PARTIAL, and 3A established why: Lords Conservative cohesion on hunting ' +
           'was 0.97–0.99 BY CONVICTION. A free vote a party happens to agree on is ' +
           'indistinguishable from a whipped one by any cohesion rule, and always will be. The ' +
           'floor guards against regression; it does not claim completeness.' },
    { label: '⛔ abortion (Northern Ireland) Regulations',
      pred: `(d.title ILIKE '%abortion (northern ireland)%')`, min: 0, max: 0,
      why: 'brief §2 names these as the thing that must not be tagged. They are whipped ' +
           'Regulations, Labour cohesion 0.92–1.00; the classic conscience votes on abortion ' +
           'predate the Commons record, which starts 2016-03-09.' },
    { label: '⛔ Safety of Rwanda', pred: `(d.title ILIKE '%rwanda%' OR d.bill_title ILIKE '%rwanda%')`,
      min: 0, max: 0, why: 'party-line throughout.' },
    { label: '⛔ Universal Credit and PIP',
      pred: `(d.title ILIKE '%universal credit%' AND d.title ILIKE '%personal independence%')`,
      min: 0, max: 0,
      why: 'a REAL rebellion against a REAL whip — Labour cohesion 0.872. 3A hand-checked it, and ' +
           'it is the control that stops the cohesion threshold being raised to catch more free ' +
           'votes: at 0.90 this becomes "free-vote-like" and 49 genuine rebels stop being rebels.' },
  ]
  for (const { label, pred, min, max, why } of expectations) {
    const { rows: [r] } = await pool.query<{ total: string; free: string }>(`
      SELECT COUNT(*)::text AS total,
             COUNT(*) FILTER (WHERE c.free_vote_like)::text AS free
        FROM divisions d JOIN position_division_class c
          ON c.house = d.house AND c.division_id = d.division_id
       WHERE ${pred}`)
    const free = Number(r.free)
    const ok = Number(r.total) > 0 && free >= min && free <= max
    console.log(`  ${ok ? '✓' : '❌'} ${label.padEnd(42)} ${free} of ${r.total} tagged  (want ${min === max ? min : `${min}–${max === 99 ? r.total : max}`})`)
    console.log(`      ${why}`)
    if (max === 0) continue
    // A miss must be diagnosable, not just counted: print the party that kept the division out.
    if (Number(r.free) < Number(r.total)) {
      const { rows: misses } = await pool.query<{
        division_date: string; house: string; division_id: number; title: string
        best_cohesion: string | null; best_party: string | null }>(`
        SELECT d.division_date::text AS division_date, d.house, d.division_id, left(d.title, 64) AS title,
               ROUND(c.best_cohesion::numeric, 3)::text AS best_cohesion, c.best_party
          FROM divisions d JOIN position_division_class c
            ON c.house = d.house AND c.division_id = d.division_id
         WHERE ${pred} AND NOT c.free_vote_like
         ORDER BY c.best_cohesion ASC LIMIT 6`)
      for (const m of misses) {
        console.log(`       missed: ${m.division_date} ${m.house.padEnd(7)} best ${String(m.best_cohesion).padStart(5)} ${(m.best_party ?? '—').padEnd(24)} ${m.title}`)
      }
    }
  }

  // ── how sensitive is the whole classification to the one number it turns on ──
  //
  // The threshold is config and provisional (design §5). Reporting the count at 85% alone would
  // make it look like a fact; reporting the curve shows what kind of number it is. Computed here
  // rather than by re-running the whole derivation five times.
  console.log(`\n  ── threshold sensitivity (divisions tagged free-vote-like, of 5,645) ──`)
  for (const t of [0.75, 0.80, 0.85, 0.90, 0.95]) {
    const { rows: [r] } = await pool.query<{ n: string; assisted: string }>(`
      WITH best AS (
        SELECT d.house, d.division_id, d.title,
               COALESCE(MAX(p.cohesion) FILTER (WHERE p.is_whipped_party), 0) AS best_cohesion
          FROM divisions d
          LEFT JOIN position_division_party p ON p.house=d.house AND p.division_id=d.division_id
         GROUP BY 1,2,3)
      SELECT COUNT(*) FILTER (WHERE best_cohesion < ${t})::text AS n,
             COUNT(*) FILTER (WHERE best_cohesion < ${t}
               AND (title ILIKE '%assisted dying%' OR title ILIKE '%terminally ill adults%'
                    OR title ILIKE '%hunting%' OR title ILIKE '%abortion%'))::text AS assisted
        FROM best`)
    const mark = t === POSITION_CONFIG.cohesionThreshold ? '  ← config' : ''
    console.log(`     ≥${(t * 100).toFixed(0)}% cohesion required   ${String(r.n).padStart(5)} divisions   ${String(r.assisted).padStart(3)} of the 52 named-classic divisions${mark}`)
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('[derive-vote-classes] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
