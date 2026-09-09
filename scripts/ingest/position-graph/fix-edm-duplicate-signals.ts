/**
 * fix-edm-duplicate-signals.ts — one member, one motion, one live signal.
 *
 * ⚠⚠ WHY THIS EXISTS, AND IT IS THE THIRD TIME THIS SPRINT. Check C2 asserts that no (actor, motion)
 * pair carries more than one live `edm_signature` signal. It passed on the 64-motion pilot, passed at
 * 947 motions, and **failed on 42 pairs once all 60,995 were loaded** — the same shape as A3 and A6:
 * an invariant true of the sample and false of the corpus.
 *
 * WHAT THEY ARE, read rather than assumed:
 *
 *   271 (motion, member) pairs appear twice in the publisher's record
 *     183   one of the two is withdrawn      → the edge view already drops it, no double count
 *       9   both withdrawn                   → neither is an edge
 *      79   BOTH LIVE                        → of these, the ones whose two dates DIFFER produce two
 *                                              signals; the ones sharing a date collapse on the
 *                                              natural key. That leaves 42.
 *
 * They are concentrated on a few members in 1993–1996 — Sir Harold Walker (MNIS 1006) and Robert
 * Hughes (MNIS 980) account for most — with the two rows days to months apart. That is the same era
 * whose records `edm.parliament.uk` itself warns about: *"As this motion is using historical data, we
 * may not have the record of the original ordering, in which case signatories are listed
 * alphabetically."*
 *
 * ⚠ THE JUDGEMENT, STATED SO IT CAN BE DISAGREED WITH. **A member cannot sign a motion twice without
 * withdrawing in between**, and neither row is withdrawn — so the second row is a duplicate RECORD, not
 * a second ACT. Two signals would give that member double the evidence mass on that motion for one
 * act. So the EARLIEST signal is kept (the date the member first put their name to it) and the later
 * one is retired.
 *
 * ⚠ IT IS RETIRED, NOT DELETED. `superseded_by` points the duplicate at the row that survives, which
 * is the append-only correction design §2 specifies — so the fact that the publisher's record held two
 * remains visible, and `edm_signatory` keeps both rows untouched either way.
 *
 * ⚠ 42 of 2,002,626 signals is 0.002%. This is not a material change to any number in the report; it is
 * here because "one act, one signal" is either true or it is not.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/fix-edm-duplicate-signals.ts            # report, change nothing
 *   npx tsx position-graph/fix-edm-duplicate-signals.ts --apply
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const APPLY = process.argv.slice(2).includes('--apply')
const pool = getNeonPool()
const n = (x: any) => Number(x).toLocaleString()

async function main() {
  const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
  if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
  console.log(`host ${host}`)

  const { rows: [before] } = await pool.query<{ pairs: string; extra: string; total: string }>(`
    WITH d AS (SELECT actor_id, target_id, COUNT(*) c FROM position_signal_stored
                WHERE signal_type='edm_signature' AND superseded_by IS NULL
                GROUP BY 1,2 HAVING COUNT(*) > 1)
    SELECT COUNT(*)::text AS pairs, COALESCE(SUM(c - 1),0)::text AS extra,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL)::text AS total
      FROM d`)
  console.log(`\n   (actor, motion) pairs with >1 live signal   ${n(before.pairs)}`)
  console.log(`   surplus signals (one act counted twice)     ${n(before.extra)}`)
  console.log(`   live edm_signature signals                  ${n(before.total)}`)
  if (Number(before.pairs) === 0) { console.log('\n   ✓ nothing to fix.'); await endNeonPool(); return }

  const { rows: sample } = await pool.query(`
    WITH d AS (SELECT actor_id, target_id FROM position_signal_stored
                WHERE signal_type='edm_signature' AND superseded_by IS NULL
                GROUP BY 1,2 HAVING COUNT(*) > 1)
    SELECT e.canonical_name AS who, e.parl_member_id AS mnis, d.target_id AS motion,
           (SELECT string_agg(s.observed_at::text, ' | ' ORDER BY s.observed_at)
              FROM position_signal_stored s
             WHERE s.actor_id=d.actor_id AND s.target_id=d.target_id
               AND s.signal_type='edm_signature' AND s.superseded_by IS NULL) AS dates
      FROM d JOIN graph_entity e ON e.id = d.actor_id ORDER BY 1, 3 LIMIT 6`)
  console.log(`\n   sample:`); console.table(sample)

  const { rows: byMember } = await pool.query(`
    WITH d AS (SELECT actor_id, target_id FROM position_signal_stored
                WHERE signal_type='edm_signature' AND superseded_by IS NULL
                GROUP BY 1,2 HAVING COUNT(*) > 1)
    SELECT e.canonical_name AS who, e.parl_member_id AS mnis, COUNT(*)::int AS motions
      FROM d JOIN graph_entity e ON e.id = d.actor_id GROUP BY 1,2 ORDER BY 3 DESC LIMIT 8`)
  console.log(`   concentrated on:`); console.table(byMember)

  if (!APPLY) { console.log('\n   no --apply: nothing changed.'); await endNeonPool(); return }

  // ⚠ ONE STATEMENT. `keep` picks the earliest live signal per (actor, motion); the UPDATE retires
  // every other live signal for that pair, pointing it at the survivor. Because both halves read the
  // same statement snapshot, a row cannot be both kept and retired, and it cannot half-apply.
  const { rows: [res] } = await pool.query<{ retired: string }>(`
    WITH keep AS (
      SELECT DISTINCT ON (actor_id, target_id) actor_id, target_id, id, observed_at
        FROM position_signal_stored
       WHERE signal_type='edm_signature' AND superseded_by IS NULL
       ORDER BY actor_id, target_id, observed_at, id
    ), dup AS (
      SELECT s.id, k.id AS keep_id
        FROM position_signal_stored s
        JOIN keep k ON k.actor_id = s.actor_id AND k.target_id = s.target_id
       WHERE s.signal_type='edm_signature' AND s.superseded_by IS NULL AND s.id <> k.id
    ), done AS (
      UPDATE position_signal_stored o SET superseded_by = dup.keep_id
        FROM dup WHERE o.id = dup.id
      RETURNING o.id
    )
    SELECT COUNT(*)::text AS retired FROM done`)
  console.log(`\n   retired (superseded by the earliest signal for the same pair)  ${n(res.retired)}`)

  const { rows: [after] } = await pool.query<{ pairs: string; total: string }>(`
    WITH d AS (SELECT actor_id, target_id FROM position_signal_stored
                WHERE signal_type='edm_signature' AND superseded_by IS NULL
                GROUP BY 1,2 HAVING COUNT(*) > 1)
    SELECT (SELECT COUNT(*) FROM d)::text AS pairs,
           (SELECT COUNT(*) FROM position_signal_stored
             WHERE signal_type='edm_signature' AND superseded_by IS NULL)::text AS total`)
  console.log(`\n   read back:`)
  console.log(`     pairs with >1 live signal   ${n(after.pairs)}   ${Number(after.pairs) === 0 ? '✓ one act, one signal' : '❌ still duplicated'}`)
  console.log(`     live edm_signature signals  ${n(after.total)}   (was ${n(before.total)}, −${n(Number(before.total) - Number(after.total))})`)
  console.log(`\n   ⚠ position_estimate must be rebuilt after this: 42 actors' estimates were computed`)
  console.log(`     from the duplicated signals. Run scripts/graph/build-position-estimates.ts.`)
  await endNeonPool()
}
main().catch(async (e) => {
  console.error('[fix-edm-duplicate-signals] FATAL', e instanceof Error ? e.stack : e)
  await endNeonPool().catch(() => {}); process.exit(1)
})
