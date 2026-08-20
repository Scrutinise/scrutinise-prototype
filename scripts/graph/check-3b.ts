/**
 * check-3b.ts — GRAPH 3B's checks, and the self-test that proves each one CAN fail.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE SELF-TEST IS NOT OPTIONAL
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * docs/CLAUDE.md and this sprint's brief both: *a guard that cannot fail is not a guard*, and *a
 * ranking that cannot rank is the same failure class as a metric that cannot fail*. 3A's own
 * self-test broke one thing and expected twelve assertions to fail; **ten said DID NOT FIRE**,
 * because they were structural and no config change could falsify them. So every break here is
 * purpose-built for the one property it attacks, and `--self-test` reports any that DID NOT FIRE
 * as a failure of the check, not of the code.
 *
 * Usage (from scripts/graph):
 *   npx tsx check-3b.ts
 *   npx tsx check-3b.ts --self-test
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import {
  aggregate, composeClaim, describeStance, SignalForMath,
} from '../../scrutinise-web/lib/graph/position-math'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

const SELF_TEST = process.argv.includes('--self-test')

let pass = 0
let fail = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? '  ' + detail : ''}`) }
  else { fail++; failures.push(name); console.log(`  ❌ ${name}${detail ? '  ' + detail : ''}`) }
}

const sig = (o: Partial<SignalForMath> & { id: string }): SignalForMath => ({
  signalType: 'vote', derivation: 'free-vote-heuristic:v1', direction: 1,
  rawWeight: 0.7, observedAt: '2025-06-20', ...o,
})

const AS_OF = '2026-08-20'

// ══════════════════════════════════════════════════════════════════════════════════════════════
// The properties, each as a function so the self-test can run them against a broken implementation.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** GRAPH 3B §1 — a claim never travels without the thing it is a claim about. */
function checkClaimNamesItsTarget(compose: typeof composeClaim) {
  const one = compose('supported', [
    { label: 'Terminally Ill Adults (End of Life) Bill: Amendment 12', date: '2025-06-20', direction: 1 },
  ])
  ok('a claim names its target', one.claim.includes('Amendment 12'), `→ "${one.claim}"`)
  ok('a claim dates its target', one.claim.includes('2025-06-20'))
  ok('a single-target claim carries no multi-target caveat', one.caveat === null)

  const two = compose('supported', [
    { label: 'Bill: Third Reading', date: '2025-06-20', direction: 1 },
    { label: 'Bill: Amendment 12', date: '2025-06-20', direction: -1 },
  ])
  ok('a multi-target claim names both targets',
    two.claim.includes('Third Reading') && two.claim.includes('Amendment 12'))
  ok('a multi-target claim shows each side separately',
    two.claim.includes('for “Bill: Third Reading”') && two.claim.includes('against “Bill: Amendment 12”'),
    `→ "${two.claim}"`)
  ok('a multi-target claim carries the do-not-read-this-as-the-subject caveat',
    two.caveat !== null && /not toward the Bill or the subject/.test(two.caveat))
  ok('no targets renders as absence, never as a score',
    compose('supported', []).claim === 'no recorded signal')
}

/** GRAPH 3B §1 — the sort key must actually separate, or say that it does not. */
function checkRankingDisclosesTies(rank: (a: RankRow[]) => RankResult) {
  // 40 actors, all identical: exactly the case that produced an alphabetical "top 40".
  const tied: RankRow[] = Array.from({ length: 40 }, (_, i) => ({
    name: `Actor ${String(i).padStart(2, '0')}`, confidence: 0.671356, signalCount: 2,
  }))
  const r1 = rank(tied)
  ok('an all-tied page reports that the order is name order only', r1.shownOrderIsNameOrderOnly)
  ok('an all-tied page produces a note that says so',
    r1.note !== null && /not a ranking/i.test(r1.note!), `→ "${r1.note}"`)
  ok('an all-tied page counts the ties', r1.tiedAtTop === 40)

  // One actor genuinely ahead: the page must NOT cry tie.
  const separable: RankRow[] = [
    { name: 'Zoe', confidence: 0.81, signalCount: 5 },
    ...tied,
  ]
  const r2 = rank(separable)
  ok('a separable page does not claim to be tied', !r2.shownOrderIsNameOrderOnly)
  ok('a separable page still discloses ties below the top', r2.tiedAtTop === 1)

  // Confidence equal, signal count different: the second key must break it.
  const r3 = rank([
    { name: 'Alpha', confidence: 0.5, signalCount: 1 },
    { name: 'Beta', confidence: 0.5, signalCount: 4 },
  ])
  ok('signal count breaks a confidence tie', r3.order[0] === 'Beta', `→ ${r3.order.join(', ')}`)
  const r4 = rank([
    { name: 'Beta', confidence: 0.5, signalCount: 2 },
    { name: 'Alpha', confidence: 0.5, signalCount: 2 },
  ])
  ok('name breaks a confidence+count tie, A first', r4.order[0] === 'Alpha')
}

/** GRAPH 3B §4.2 — per-target results are separately labelled and never summed. */
function checkPerTargetNeverSummed() {
  const forBill = sig({ id: 'a', direction: 1 })
  const againstAmendment = sig({ id: 'b', direction: -1 })
  const rolled = aggregate([forBill, againstAmendment], AS_OF, POSITION_CONFIG)
  const perA = aggregate([forBill], AS_OF, POSITION_CONFIG)
  const perB = aggregate([againstAmendment], AS_OF, POSITION_CONFIG)
  ok('for-the-Bill and against-an-amendment cancel when summed', Math.abs(rolled.stanceScore) < 0.01,
    `rolled ${rolled.stanceScore.toFixed(3)}`)
  ok('and each target on its own is unambiguous',
    perA.stanceScore === 1 && perB.stanceScore === -1,
    `${perA.stanceScore} / ${perB.stanceScore}`)
  ok('the cancelled rollup is worded "divided record", never "neutral"',
    describeStance(rolled.stanceScore) === 'divided record')
}

/** §1's diagnosis, held as an assertion so a future change cannot quietly un-fix it. */
function checkStanceIsScaleFree() {
  const one = aggregate([sig({ id: '1' })], AS_OF, POSITION_CONFIG)
  const fifty = aggregate(
    Array.from({ length: 50 }, (_, i) => sig({ id: `s${i}` })), AS_OF, POSITION_CONFIG)
  ok('stance is scale-free: 1 consistent vote and 50 give the SAME stance',
    one.stanceScore === fifty.stanceScore && one.stanceScore === 1,
    `${one.stanceScore} vs ${fifty.stanceScore} — this is WHY the page could not rank`)
  ok('…and confidence is therefore the only axis that separates them',
    fifty.confidence > one.confidence,
    `${one.confidence.toFixed(4)} → ${fifty.confidence.toFixed(4)}`)
}

interface RankRow { name: string; confidence: number; signalCount: number }
interface RankResult { order: string[]; tiedAtTop: number; shownOrderIsNameOrderOnly: boolean; note: string | null }

/** The ranking, extracted so a break can be planted in it. Mirrors positions.ts exactly. */
function rankRows(rows: RankRow[], limit = 40): RankResult {
  const actors = rows.slice().sort((a, b) =>
    b.confidence - a.confidence ||
    b.signalCount - a.signalCount ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  const shown = actors.slice(0, limit)
  const tieKey = (a: RankRow) => `${a.confidence.toFixed(6)}|${a.signalCount}`
  const tiedAtTop = actors.length ? actors.filter((a) => tieKey(a) === tieKey(actors[0])).length : 0
  const shownAllTied = shown.length > 1 && shown.every((a) => tieKey(a) === tieKey(shown[0]))
  return {
    order: shown.map((a) => a.name),
    tiedAtTop,
    shownOrderIsNameOrderOnly: shownAllTied,
    note: shownAllTied
      ? `${shown.length} of ${actors.length} actors, tied at this confidence — ordered by name. This is not a ranking.`
      : tiedAtTop > 1 ? `${tiedAtTop} actors are tied at the top of this order.` : null,
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
async function dbChecks(pool: ReturnType<typeof getNeonPool>) {
  console.log('\n──── the database, after 3B\'s DDL')

  // The redefinition must not have changed a single classification.
  const { rows: cls } = await pool.query<{ derivation: string; n: string }>(
    `SELECT derivation, COUNT(*)::text AS n FROM position_signal_vote GROUP BY 1`)
  const got = Object.fromEntries(cls.map((r) => [r.derivation, Number(r.n)]))
  const want3A: Record<string, number> = {
    'whipped-with:v1': 1865002, 'unwhipped-group:v1': 127039,
    'small-party-unclassified:v1': 61919, 'rebellion:v1': 18493, 'free-vote-heuristic:v1': 8132,
  }
  for (const [k, v] of Object.entries(want3A)) {
    ok(`redefined view: ${k} unchanged`, got[k] === v, `${got[k]?.toLocaleString()} (3A: ${v.toLocaleString()})`)
  }
  // ⚠ Stated as an equation, not as a constant. 3A's total was 2,317,523; 3B adds P1 donation
  // signals. Hard-coding the new total would make this check pass for the wrong reason the moment
  // the register grows — the invariant that matters is that NOTHING ELSE changed.
  const { rows: [t] } = await pool.query<{ n: string; don: string }>(`
    SELECT (SELECT COUNT(*) FROM position_signal)::text AS n,
           (SELECT COUNT(*) FROM position_signal WHERE signal_type='political_donation')::text AS don`)
  ok('total signals = 3A\'s 2,317,523 + the P1 donations, and nothing else moved',
    Number(t.n) - Number(t.don) === 2317523,
    `${Number(t.n).toLocaleString()} − ${Number(t.don).toLocaleString()} donations = ${(Number(t.n) - Number(t.don)).toLocaleString()}`)

  // ⚠ The ladder must have ONE home, and this is the check that notices when it stops having one.
  // Running setup-3a.ts after setup-3b.ts re-applies schema-3a.sql, whose `CREATE OR REPLACE VIEW
  // position_signal_vote` carries the classification ladder inline — silently reverting 3B's
  // redefinition. Both versions return identical rows, so nothing else in this file would catch it.
  // It happened during this sprint, which is why the check exists.
  const { rows: [vd] } = await pool.query<{ def: string }>(
    `SELECT pg_get_viewdef('position_signal_vote'::regclass, true) AS def`)
  ok('position_signal_vote calls position_vote_class(), not a second copy of the ladder',
    /position_vote_class/.test(vd.def),
    /position_vote_class/.test(vd.def) ? '' : '← run setup-3b.ts; setup-3a.ts has reverted it')
  // ⚠ And it must NOT be defined over the set-returning function. That shape is correct and
  // 3× slower on the bulk path: `actor_id` becomes an output column, so the estimate build's
  // `WHERE actor_id BETWEEN` filter cannot be pushed down and every batch hash-joins the whole
  // vote arm. It truncated and half-rebuilt position_estimate once. See schema-3b.sql.
  ok('…and is NOT defined over position_signal_vote_for(), which would kill the estimate build',
    !/position_signal_vote_for/.test(vd.def))

  // The generated SQL weight function must know every signal type the TypeScript config knows.
  // 3B added `political_donation`; if setup-3a.ts has not been re-run, the SQL returns NULL and
  // every donation signal silently loses its weight.
  const { rows: [w] } = await pool.query<{ w: string | null }>(
    `SELECT position_raw_weight('political_donation', NULL)::text AS w`)
  ok('position_raw_weight() knows political_donation',
    w.w !== null && Math.abs(Number(w.w) - POSITION_CONFIG.weights.political_donation) < 1e-6,
    `SQL ${w.w} vs config ${POSITION_CONFIG.weights.political_donation}`)

  // The function and the view must agree, or "one definition" is a claim nobody checks.
  const { rows: samples } = await pool.query<{ target_type: string; target_id: string }>(`
    (SELECT DISTINCT target_type, target_id FROM position_signal_stored WHERE target_type='edm' LIMIT 30)
    UNION ALL (SELECT DISTINCT target_type, target_id FROM position_signal_stored WHERE target_type='inquiry' LIMIT 30)
    UNION ALL (SELECT DISTINCT target_type, target_id FROM position_signal_stored WHERE target_type='organisation' LIMIT 30)
    UNION ALL (SELECT 'division', house||':'||division_id FROM divisions ORDER BY random() LIMIT 30)`)
  const st = samples.map((s) => s.target_type)
  const si = samples.map((s) => s.target_id)
  const { rows: [d] } = await pool.query<Record<string, string>>(`
    WITH v AS (SELECT s.signal_ref, s.actor_id, s.target_type, s.target_id, s.signal_type,
                      s.direction, s.derivation, s.raw_weight, s.evidence_ids, s.observed_at, s.storage
                 FROM unnest($1::text[], $2::text[]) AS w(target_type, target_id)
                 JOIN position_signal s ON s.target_type=w.target_type AND s.target_id=w.target_id),
         f AS (SELECT signal_ref, actor_id, target_type, target_id, signal_type, direction,
                      derivation, raw_weight, evidence_ids, observed_at, storage
                 FROM position_signal_for($1::text[], $2::text[]))
    SELECT (SELECT COUNT(*) FROM v)::text AS vn, (SELECT COUNT(*) FROM f)::text AS fn,
           (SELECT COUNT(*) FROM (SELECT * FROM v EXCEPT ALL SELECT * FROM f) x)::text AS vnf,
           (SELECT COUNT(*) FROM (SELECT * FROM f EXCEPT ALL SELECT * FROM v) y)::text AS fnv`, [st, si])
  ok('position_signal_for() ≡ position_signal view, row for row',
    d.vnf === '0' && d.fnv === '0' && d.vn === d.fn,
    `${Number(d.vn).toLocaleString()} rows, ${d.vnf} / ${d.fnv} differences over ${si.length} targets`)
  ok('…and the sample was not empty (a check over zero rows passes for free)',
    Number(d.vn) > 0, `${Number(d.vn).toLocaleString()} rows compared`)

  // The read path must be fast, and "fast" is a number, not an adjective.
  const t0 = Date.now()
  await pool.query(`SELECT actor_id FROM position_signal_for($1::text[], $2::text[])`,
    [['division', 'division'], ['commons:2051', 'commons:2068']])
  const ms = Date.now() - t0
  ok('the page\'s query is under 500 ms', ms < 500, `${ms} ms (was 9,048 ms on the live page)`)

  // §2 and §4.3 — the two dataless P0 signal types stay named, every run.
  const { rows: dataless } = await pool.query<{ signal_type: string; n: string }>(`
    SELECT 'amendment_sponsorship' AS signal_type,
           (SELECT COUNT(*)::text FROM position_signal WHERE signal_type='amendment_sponsorship') AS n
    UNION ALL
    SELECT 'committee_membership',
           (SELECT COUNT(*)::text FROM position_signal WHERE signal_type='committee_membership')`)
  for (const r of dataless) {
    console.log(`  ⛔ ${r.signal_type}: ${r.n} signals — NO SOURCE DATA (design §3.3/§3.4; see report §4.3)`)
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // §2.2 — THE ELECTORAL COMMISSION REGISTER
  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n──── §2.2 · the donations register')
  const { rows: [reg] } = await pool.query<Record<string, string>>(`
    SELECT COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE donee_entity_id IS NOT NULL)::text AS donee_res,
           COUNT(*) FILTER (WHERE donor_entity_id IS NOT NULL)::text AS donor_res,
           COUNT(*) FILTER (WHERE donee_resolution IS NULL OR donor_resolution IS NULL)::text AS unlabelled,
           COUNT(DISTINCT ec_ref)::text AS refs
      FROM position_donation`)
  ok('the register is loaded', Number(reg.n) > 80000, `${Number(reg.n).toLocaleString()} rows`)
  ok('every row records HOW each end resolved, including when it did not', reg.unlabelled === '0')
  ok('the Commission\'s reference is the key and is unique', reg.refs === reg.n)

  // ⚠ The rule the whole register is written to obey. A resolution that was allowed to guess would
  // show up here as a donee resolved on a name that is not unique.
  const { rows: [merge] } = await pool.query<{ n: string }>(`
    SELECT COUNT(*)::text AS n FROM position_donation d
      JOIN graph_entity e ON e.id = d.donee_entity_id
     WHERE d.donee_entity_id IS NOT NULL
       AND (e.parl_member_id IS NULL
            OR EXISTS (SELECT 1 FROM graph_entity x
                        WHERE x.kind='person' AND x.parl_member_id IS NOT NULL
                          AND x.name_norm = e.name_norm AND x.id <> e.id))`)
  ok('no donee was resolved to an ambiguous or non-MNIS identity — the standing rule, as a query',
    merge.n === '0', `${merge.n} violations`)

  const { rows: [dtype] } = await pool.query<{ n: string }>(`
    SELECT COUNT(*)::text AS n FROM position_donation
     WHERE donee_entity_id IS NOT NULL
       AND regulated_donee_type NOT IN ('MP - Member of Parliament','Leadership Candidate','Member of Registered Political Party')`)
  ok('no mayor, councillor, MSP or candidate was name-matched to an MP',
    dtype.n === '0', `${dtype.n} violations — this is the wrongly-merged-identity case`)

  const { rows: [dsig] } = await pool.query<Record<string, string>>(`
    SELECT COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE direction <> 0)::text AS with_side,
           COUNT(*) FILTER (WHERE derivation IS NULL)::text AS undeclared,
           COUNT(*) FILTER (WHERE array_length(evidence_ids,1) IS NULL)::text AS no_evidence,
           COUNT(*) FILTER (WHERE raw_weight IS NULL)::text AS no_weight,
           COUNT(DISTINCT actor_id)::text AS members
      FROM position_signal_stored WHERE signal_type='political_donation'`)
  ok('donation signals exist', Number(dsig.n) > 0, `${dsig.n} signals over ${dsig.members} members`)
  // §2: "Direction 0 means direction 0. A donation is not a position."
  ok('EVERY donation signal is direction 0', dsig.with_side === '0', `${dsig.with_side} carry a side`)
  ok('every donation signal declares its inference (ec-donee-name-match:v1)', dsig.undeclared === '0')
  ok('every donation signal points at its evidence', dsig.no_evidence === '0')
  ok('every donation signal carries a weight from the generated SQL function', dsig.no_weight === '0')

  const { rows: [drill] } = await pool.query<{ n: string; bad: string }>(`
    SELECT COUNT(*)::text AS n,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM position_donation dn
              WHERE ('ec-donation:' || dn.ec_ref) = ANY(s.evidence_ids)))::text AS bad
      FROM position_signal_stored s WHERE s.signal_type='political_donation'`)
  ok('every donation signal\'s evidence resolves to a real register row',
    drill.bad === '0', `${drill.bad} of ${drill.n} dangling`)

  // ── NEGATIVE CONTROLS ────────────────────────────────────────────────────────────────────
  //
  // ⚠ Every §2.2 assertion above is of the form "COUNT(violations) = 0", and every one of them
  // passed on the first run. A count of zero passes just as readily when the query matches nothing
  // at all — a broken predicate, an empty table, a typo'd column name that silently matched no
  // rows. docs/CLAUDE.md: *a guard that cannot fail is not a guard*.
  //
  // So each violation query is re-run with its guard clause REMOVED, and must come back non-zero.
  // That proves the query reaches rows, and therefore that the zero above means "none of these
  // rows violate it" rather than "there were no rows".
  const controls: Array<[string, string]> = [
    ['the identity query reaches resolved donees at all',
     `SELECT COUNT(*)::text AS n FROM position_donation d JOIN graph_entity e ON e.id = d.donee_entity_id
       WHERE d.donee_entity_id IS NOT NULL`],
    ['the donee-type query reaches resolved rows at all',
     `SELECT COUNT(*)::text AS n FROM position_donation
       WHERE donee_entity_id IS NOT NULL
         AND regulated_donee_type IN ('MP - Member of Parliament','Leadership Candidate','Member of Registered Political Party')`],
    ['the evidence-drill query reaches signals whose evidence DOES resolve',
     `SELECT COUNT(*)::text AS n FROM position_signal_stored s
       WHERE s.signal_type='political_donation'
         AND EXISTS (SELECT 1 FROM position_donation dn WHERE ('ec-donation:' || dn.ec_ref) = ANY(s.evidence_ids))`],
    ['the direction-0 query reaches donation signals at all',
     `SELECT COUNT(*)::text AS n FROM position_signal_stored WHERE signal_type='political_donation' AND direction = 0`],
    ['there ARE excluded rows, so the exclusion is doing work rather than matching nothing',
     `SELECT COUNT(*)::text AS n FROM position_donation WHERE donee_resolution = 'unresolved:donee-type-excluded'`],
    ['there ARE unresolved donees, so "resolved" is not vacuously everything',
     `SELECT COUNT(*)::text AS n FROM position_donation WHERE donee_resolution = 'unresolved:no-entity'`],
  ]
  for (const [label, sql] of controls) {
    const { rows: [c] } = await pool.query<{ n: string }>(sql)
    ok(`negative control — ${label}`, Number(c.n) > 0, `${Number(c.n).toLocaleString()} rows`)
  }

  // Direction-0 signal types must never manufacture a stance. §2's hard rule for the registers.
  const { rows: [z] } = await pool.query<{ n: string; maxc: string }>(`
    SELECT COUNT(*)::text AS n, COALESCE(MAX(e.confidence), 0)::text AS maxc
      FROM position_estimate e
     WHERE e.target_type IN ('inquiry','organisation') AND e.stance_score <> 0`)
  ok('no direction-0 target ever carries a non-zero stance', z.n === '0', `${z.n} rows`)
  const { rows: [zc] } = await pool.query<{ maxc: string }>(`
    SELECT MAX(confidence)::text AS maxc FROM position_estimate
     WHERE target_type IN ('inquiry','organisation')`)
  ok('direction-0 confidence holds at the ceiling',
    Number(zc.maxc) <= POSITION_CONFIG.attentionConfidenceCeiling + 1e-6,
    `max ${zc.maxc} vs ceiling ${POSITION_CONFIG.attentionConfidenceCeiling}`)
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
async function main() {
  if (SELF_TEST) {
    console.log('════ SELF-TEST — one purpose-built break per property ════\n')
    const breaks: Array<[string, () => void]> = [
      ['claim drops the target name (the 3A behaviour)', () => {
        checkClaimNamesItsTarget(((w: string) => ({ claim: w, caveat: null })) as any)
      }],
      ['claim keeps the target but drops the multi-target caveat', () => {
        checkClaimNamesItsTarget(((w: string, ts: any[]) => ({
          claim: `${w} — ${ts.map((t) => `for “${t.label}” (${t.date})`).join('; ')}`, caveat: null,
        })) as any)
      }],
      ['claim renders every side as "for"', () => {
        checkClaimNamesItsTarget(((w: string, ts: any[]) => ({
          claim: ts.length ? `${w} — ${ts.map((t) => `for “${t.label}” (${t.date})`).join('; ')}` : 'no recorded signal',
          caveat: ts.length > 1 ? 'A stance toward these specific divisions, not toward the Bill or the subject.' : null,
        })) as any)
      }],
      ['ranking never discloses a tie (the 3A behaviour)', () => {
        checkRankingDisclosesTies((rows) => ({ ...rankRows(rows), shownOrderIsNameOrderOnly: false, note: null }))
      }],
      ['ranking always claims a tie', () => {
        checkRankingDisclosesTies((rows) => ({ ...rankRows(rows), shownOrderIsNameOrderOnly: true, note: 'not a ranking' }))
      }],
      ['ranking sorts by name alone', () => {
        checkRankingDisclosesTies((rows) => {
          const a = rows.slice().sort((x, y) => (x.name < y.name ? -1 : 1))
          return { order: a.slice(0, 40).map((r) => r.name), tiedAtTop: 1, shownOrderIsNameOrderOnly: false, note: null }
        })
      }],
      ['ranking ignores the signal-count key', () => {
        checkRankingDisclosesTies((rows) => {
          const a = rows.slice().sort((x, y) => y.confidence - x.confidence || (x.name < y.name ? -1 : 1))
          const r = rankRows(rows)
          return { ...r, order: a.slice(0, 40).map((z) => z.name) }
        })
      }],
    ]
    let notFired = 0
    for (const [label, run] of breaks) {
      const before = fail
      const silent = console.log
      console.log = () => {}
      try { run() } catch { /* a throw is also a fire */ }
      console.log = silent
      const fired = fail > before
      if (!fired) notFired++
      console.log(`  ${fired ? 'FIRED' : '❌ DID NOT FIRE'}  ${label}`)
      fail = before // reset; the self-test is not itself a failure
      failures.length = 0
    }
    console.log(`\n  ${notFired === 0 ? `✓ all ${breaks.length} breaks fire` : `❌ ${notFired} break(s) did not fire — those properties are not actually being checked`}`)
    process.exit(notFired === 0 ? 0 : 1)
  }

  console.log('════ GRAPH 3B CHECKS ════\n')
  console.log('──── §1 · the claim names what it is a claim about')
  checkClaimNamesItsTarget(composeClaim)
  console.log('\n──── §1 · the ranking discloses when it cannot rank')
  checkRankingDisclosesTies(rankRows)
  console.log('\n──── §1 · the diagnosis, held as an assertion')
  checkStanceIsScaleFree()
  console.log('\n──── §4.2 · per-target results are never summed')
  checkPerTargetNeverSummed()

  const pool = getNeonPool()
  try {
    await dbChecks(pool)
  } finally {
    await endNeonPool()
  }

  console.log(`\n════ ${pass}/${pass + fail} ════`)
  if (fail) { console.log('failed: ' + failures.join(', ')); process.exit(1) }
}

main().catch((e) => { console.error(e); process.exit(1) })
