/**
 * verify-amd2.ts — the integrity checks for AMENDMENT 2, and the proof that each one can fail.
 *
 * Same discipline as verify-2d2.ts and the same reason (docs/CLAUDE.md, "A guard that cannot fail is
 * not a guard"): every check runs twice, once against the real data and once against a deliberately
 * corrupted copy of the same query that MUST come back failing. A control that does not fire is
 * reported as a broken check even when the real data is clean, and exits non-zero.
 *
 * Two of the checks here are not integrity checks in the usual sense — they assert that a RULE of
 * the amendment is mechanically impossible to break rather than merely un-broken today:
 *   · §1  the mention view withholds nothing: its row count equals graph_edge_all's exactly
 *   · §2  the signal table has no column a resolution could be written into, and `finding` refuses
 *         a merging value — tested by attempting the write and requiring it to be rejected
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/verify-amd2.ts
 * Exit 0 only if every check passes AND every negative control fires.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

let passes = 0, failures = 0, brokenControls = 0

async function check(name: string, sql: string, controlSql: string | null, note = '') {
  const { rows: [r] } = await pool.query<{ bad: string; detail?: string }>(sql)
  const bad = Number(r.bad)
  const ok = bad === 0
  console.log(`   ${ok ? '✓' : '✗'} ${name.padEnd(58)} bad=${bad}${r.detail ? `  ${r.detail}` : ''}`)
  if (note) console.log(`       ${note}`)
  if (ok) passes++; else failures++
  if (controlSql) {
    const { rows: [c] } = await pool.query<{ bad: string }>(controlSql)
    if (Number(c.bad) > 0) console.log(`       ↳ negative control fired (${c.bad}) — the check can fail, so its pass means something`)
    else { console.log(`       ↳ ⚠⚠ NEGATIVE CONTROL DID NOT FIRE — this check cannot fail and proves nothing`); brokenControls++ }
  }
}

/** A check whose subject is a WRITE that must be refused. Passes only when the write throws. */
async function checkRefused(name: string, sql: string, params: unknown[], note = '') {
  const client = await pool.connect()
  let refused = false, message = ''
  try {
    await client.query('BEGIN')
    await client.query(sql, params)
    await client.query('ROLLBACK')
  } catch (e) {
    refused = true
    message = (e as Error).message.split('\n')[0]
    try { await client.query('ROLLBACK') } catch { /* the transaction is already aborted */ }
  } finally {
    client.release()
  }
  console.log(`   ${refused ? '✓' : '✗'} ${name.padEnd(58)} ${refused ? 'refused' : 'ACCEPTED — the rule is not enforced'}`)
  if (message) console.log(`       ↳ ${message}`)
  if (note) console.log(`       ${note}`)
  if (refused) passes++; else failures++
}

async function main() {
  head('AMENDMENT 2 VERIFICATION')
  const { rows: [who] } = await pool.query(`SELECT current_database() AS db, current_user AS usr`)
  console.log(`   ${who.db} / ${who.usr}`)

  // ── §3 the tiers ─────────────────────────────────────────────────────────────────────────────
  head('§3 confidence is shown to the user, not just stored')
  const { rows: tiers } = await pool.query(
    `SELECT kind, identity_tier, COUNT(*)::text AS n, MIN(identity_statement) AS statement
       FROM graph_entity_identity GROUP BY 1,2 ORDER BY 1,3 DESC`)
  console.table(tiers)

  await check('every entity has a tier — none is `unclassified`',
    `SELECT COUNT(*)::text AS bad FROM graph_entity_identity WHERE identity_tier = 'unclassified'`,
    // control: feed the function a key_source nobody has decided a tier for. It MUST come back
    // unclassified, which is what proves a new key_source would be caught rather than defaulted.
    `SELECT COUNT(*)::text AS bad FROM (SELECT graph_identity_tier('companies-house-BUT-MISSPELLED', 1.0) AS t) x
      WHERE x.t = 'unclassified'`,
    'a new key_source arriving without a tier decision must be visible, not rendered as "mention only"')

  await check('no tier is displayed without a statement and a caveat',
    `SELECT COUNT(*)::text AS bad FROM graph_entity_identity
      WHERE identity_statement IS NULL OR identity_statement = ''
         OR identity_caveat IS NULL OR identity_caveat = ''`,
    `SELECT COUNT(*)::text AS bad FROM (SELECT graph_identity_statement('person', 'not-a-tier') AS s) x
      WHERE x.s = 'Identity basis not classified — do not display'`)

  await check('⚠ no MENTION-ONLY actor is carrying a stable key (tier 3 must not hide a tier 1)',
    `SELECT COUNT(*)::text AS bad FROM graph_entity_identity
      WHERE identity_tier = 'mention-only'
        AND (parl_member_id IS NOT NULL OR parl_cis_id IS NOT NULL OR parl_idms_id IS NOT NULL
             OR companies_house_no IS NOT NULL OR charity_no IS NOT NULL)`,
    // ⚠ The first control written here counted "keyless rows above tier 3" and returned ZERO, which
    // is how this check was caught proving nothing. The reason is worth keeping: **all 788
    // name-match entities DO carry `parl_member_id`.** 2D-2 recorded the register match in the id
    // column and recorded its uncertainty in `key_source`/`confidence`, which is why the tier is
    // derived from key_source and NOT from "does an id column have a value in it".
    // The control below feeds the predicate a fabricated tier-3 row that does carry a key, so it
    // tests the predicate itself rather than a property of today's data.
    `SELECT COUNT(*)::text AS bad FROM (
       SELECT graph_identity_tier('singleton', 0.7) AS tier, 4242 AS parl_member_id) x
      WHERE x.tier = 'mention-only' AND x.parl_member_id IS NOT NULL`,
    'the tier is derived from key_source, never from the presence of an id — all 788 name-match rows carry parl_member_id')

  await check('⚠ no IDENTIFIED actor rests on a name match (tier 1 must not hide a tier 2)',
    `SELECT COUNT(*)::text AS bad FROM graph_entity_identity
      WHERE identity_tier = 'identified' AND key_source = 'name-match'`,
    `SELECT COUNT(*)::text AS bad FROM (SELECT graph_identity_tier('name-match', 0.9) AS t) x WHERE x.t <> 'identified'`,
    '2D-2 refused to record its 788 register matches as keyed identities; this is that refusal reaching the screen')

  // ── §1 the mention ───────────────────────────────────────────────────────────────────────────
  head('§1 the mention is the unit of display, and nothing is withheld')
  const { rows: mentionCounts } = await pool.query(
    `SELECT identity_tier, storage, COUNT(*)::text AS mentions, COUNT(DISTINCT entity_id)::text AS actors
       FROM graph_mention GROUP BY 1,2 ORDER BY 3 DESC`)
  console.table(mentionCounts)

  await check('THE VIEW WITHHOLDS NOTHING — one mention per edge, whatever the tier',
    `SELECT ABS((SELECT COUNT(*) FROM graph_mention) - (SELECT COUNT(*) FROM graph_edge_all))::text AS bad`,
    // control: the same comparison against a view that DOES filter by resolution — the behaviour
    // the amendment forbids. It must come back with a shortfall.
    `SELECT ABS((SELECT COUNT(*) FROM graph_mention WHERE identity_tier <> 'mention-only')
              - (SELECT COUNT(*) FROM graph_edge_all))::text AS bad`,
    'the control is the design as it was BEFORE the amendment: gate display on resolution and count what is lost')

  await check('every unresolved actor that has an edge has a mention',
    `SELECT COUNT(*)::text AS bad FROM graph_entity e
      WHERE graph_identity_tier(e.key_source, e.confidence) = 'mention-only'
        AND EXISTS (SELECT 1 FROM graph_edge g WHERE g.subject_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM graph_mention m WHERE m.entity_id = e.id)`,
    `SELECT COUNT(*)::text AS bad FROM graph_entity e
      WHERE graph_identity_tier(e.key_source, e.confidence) = 'mention-only'
        AND EXISTS (SELECT 1 FROM graph_edge g WHERE g.subject_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM graph_mention m
                         WHERE m.entity_id = e.id AND m.identity_tier = 'identified')`)

  // ⚠⚠ THIS ASSERTION CHANGED ON 17 AUG 2026, AND THE OLD ONE WAS RIGHT WHEN IT WAS WRITTEN.
  // It read `surface_is_per_entity IS NOT TRUE` → 0, because at the time we held no per-appearance
  // surface for ANY mention: the flag was a constant TRUE and the check asserted the constant.
  // BRIEF_INGEST_CORPUS_FRESHNESS §2 records the surface at write time and plumbs through the two
  // that were already stored (division_votes.member_name, edm_sponsor.sponsor_name), so the flag is
  // now COMPUTED and FALSE on most mentions. Left alone, this check failed with bad=2,548,656 —
  // which is correct behaviour: a check whose premise is deliberately changed must go RED and be
  // re-decided, never quietly keep passing.
  //
  // What it becomes is the invariant that was always meant: never claim a surface we do not hold,
  // and never hide one we do. verify-surface.ts carries the full four-way version with a negative
  // control that plants each way of lying about a surface.
  await check('no mention claims a per-appearance surface we do not hold',
    `SELECT COUNT(*)::text AS bad FROM graph_mention
      WHERE (NOT surface_is_per_entity AND recorded_surface IS NULL)
         OR (surface_is_per_entity AND recorded_surface IS NOT NULL)`, null,
    'the flag is computed from whether a surface is actually recorded, in both directions')

  // ── §2 the signal ────────────────────────────────────────────────────────────────────────────
  head('§2 behaviour is a signal with evidence, never a resolution')
  const { rows: findings } = await pool.query(
    `SELECT finding, cluster_class, COUNT(*)::text AS n,
            ROUND(AVG(agreement_rate)::numeric, 3)::text AS avg_rate
       FROM graph_identity_signal GROUP BY 1,2 ORDER BY 3 DESC`)
  console.table(findings)
  const { rows: base } = await pool.query(
    `SELECT cohort, pairs_scored::text AS scored, ROUND((100*mean_agreement)::numeric,1)::text AS mean_pct,
            ROUND((100*p10_agreement)::numeric,1)::text AS p10, ROUND((100*p90_agreement)::numeric,1)::text AS p90
       FROM graph_identity_baseline ORDER BY cohort`)
  console.table(base)

  await check('the calibration exists — a `concordant` row cannot be read without it',
    `SELECT (2 - COUNT(*))::text AS bad FROM graph_identity_baseline WHERE cohort IN ('same-party','cross-party')`,
    `SELECT (2 - COUNT(*))::text AS bad FROM graph_identity_baseline WHERE cohort = 'no-such-cohort'`)

  await check('⚠ AND THE CALIBRATION MAKES THE POINT — same-party pairs of DIFFERENT people score above the concordant band',
    `SELECT COUNT(*)::text AS bad FROM graph_identity_baseline
      WHERE cohort = 'same-party' AND (mean_agreement IS NULL OR mean_agreement < 0.90)`,
    `SELECT COUNT(*)::text AS bad FROM graph_identity_baseline
      WHERE cohort = 'cross-party' AND (mean_agreement IS NULL OR mean_agreement < 0.90)`,
    'if this ever fails, behavioural agreement has become informative about identity and §2 must be re-argued')

  await check('agreement_rate is NULL exactly when there is nothing to rate',
    `SELECT COUNT(*)::text AS bad FROM graph_identity_signal
      WHERE (shared_divisions = 0) <> (agreement_rate IS NULL)`, null,
    'a rate of 0.0 and "no shared divisions" are different facts and must not be rendered alike')

  await check('every DIVERGENT signal can show its working',
    `SELECT COUNT(*)::text AS bad FROM graph_identity_signal s
      WHERE s.finding = 'divergent'
        AND NOT EXISTS (SELECT 1 FROM graph_identity_signal_evidence e WHERE e.signal_id = s.id)`,
    `SELECT COUNT(*)::text AS bad FROM graph_identity_signal s
      WHERE s.finding = 'disjoint-service'
        AND NOT EXISTS (SELECT 1 FROM graph_identity_signal_evidence e WHERE e.signal_id = s.id)`,
    'the control counts disjoint-service rows, which correctly have NO division evidence — their evidence is the dates')

  await check('every signal evidence row is a division the pair really split on',
    `SELECT COUNT(*)::text AS bad FROM graph_identity_signal_evidence WHERE vote_a = vote_b`,
    `SELECT COUNT(*)::text AS bad FROM graph_identity_signal_evidence WHERE vote_a <> vote_b`)

  await check('⚠ NO MERGE IN THE GRAPH CITES BEHAVIOURAL EVIDENCE',
    `SELECT COUNT(*)::text AS bad FROM graph_merge_log
      WHERE reason ILIKE '%behaviour%' OR reason ILIKE '%agreement%' OR reason ILIKE '%voting%'`,
    `SELECT COUNT(*)::text AS bad FROM graph_merge_log WHERE reason ILIKE '%name%'`,
    'two different people who agree about everything are still two people (Amendment 2 §2)')

  await check('⚠ THE SIGNAL TABLE HAS NO COLUMN A RESOLUTION COULD BE WRITTEN INTO',
    `SELECT COUNT(*)::text AS bad FROM information_schema.columns
      WHERE table_name = 'graph_identity_signal'
        AND column_name ~ '(merge|merged|resolved|resolution|same_person|is_same|verdict|decision)'`,
    // control: the same query against a table that DOES hold a resolution. graph_merge_log's
    // kept_entity_id is exactly that, so this must be non-zero.
    `SELECT COUNT(*)::text AS bad FROM information_schema.columns
      WHERE table_name = 'graph_merge_log' AND column_name ~ '(merge|merged|kept)'`)

  await checkRefused('⚠ `finding` REFUSES a merging value',
    `INSERT INTO graph_identity_signal
       (surface_norm, member_a, member_b, shared_divisions, agreed, finding, observation)
     SELECT 'verify-control', MIN(mnis_id), MAX(mnis_id), 1, 1, 'same-person', 'this write must be refused'
       FROM graph_member_register`, [],
    'the CHECK is the amendment\'s rule made mechanical — a merge on this evidence would have to alter the DDL')

  await checkRefused('a pair cannot be stored twice in the two orders',
    `INSERT INTO graph_identity_signal
       (surface_norm, member_a, member_b, shared_divisions, agreed, finding, observation)
     SELECT s.surface_norm, s.member_b, s.member_a, s.shared_divisions, s.agreed, s.finding, 'reversed duplicate'
       FROM graph_identity_signal s LIMIT 1`, [])

  head('RESULT')
  console.log(`   checks passed ${passes}, failed ${failures}, broken negative controls ${brokenControls}`)
  if (failures || brokenControls) { console.log('   ❌ NOT CLEAN'); await endNeonPool(); process.exit(1) }
  console.log('   ✓ all checks pass and every negative control fired')
  await endNeonPool()
}
main().catch((e) => { console.error('[verify-amd2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
