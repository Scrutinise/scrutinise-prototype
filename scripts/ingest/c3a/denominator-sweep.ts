/**
 * denominator-sweep.ts — ADDENDUM C3 §1.3, generalised: how many collections answer "how complete
 * are we?" with their own row count?
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `corpus_targets.est_sections` is meant to be the size of the UNIVERSE — what the publisher has —
 * so that `held / est_sections` says how much of it we hold. `ots-reports` carried
 * est_sections = 497 with est_is_confirmed = TRUE, and 497 is exactly the number of rows we hold.
 * An estimate that equals the row count cannot disagree with it, so the completeness figure is
 * arithmetic about itself: 100%, always, whatever is missing.
 *
 * That is the same closed loop GRAPH 3B found behind the storage alert line (our constant cited the
 * handoff; the handoff cited our constant) and the same family as a check that cannot fail.
 *
 * ⚠ THIS SCRIPT ONLY REPORTS. Replacing a self-referential denominator needs a real external number
 * per collection — a publisher index, an organisation filter, a closed archive — and that is a
 * research task per row, not a sweep. `ots-reports` has one (222, from gov.uk's own organisation
 * field); most of these do not yet.
 *
 * Usage: tsx c3a/denominator-sweep.ts
 */
import { pool } from '../c2/db'
;(async () => {
  const p = pool()
  const r = (await p.query(`
    SELECT t.corpus_key, t.est_sections, t.est_is_confirmed, t.retired, coalesce(c.n,0)::int held
      FROM corpus_targets t
      LEFT JOIN (SELECT corpus, count(*)::int n FROM corpus_sections GROUP BY corpus) c ON c.corpus = t.corpus_key
     WHERE NOT coalesce(t.retired,false) ORDER BY 5 DESC`)).rows
  const eq = r.filter((x: any) => x.est_sections != null && x.est_sections === x.held)
  console.log(`live targets: ${r.length}`)
  console.log(`est_sections EXACTLY equals the row count: ${eq.length}`)
  for (const x of eq) console.log(`   ${String(x.held).padStart(8)}  ${x.corpus_key}  confirmed=${x.est_is_confirmed}`)
  const near = r.filter((x: any) => x.est_sections != null && x.est_sections !== x.held && Math.abs(x.est_sections - x.held) / Math.max(x.held, 1) < 0.001 && x.held > 0)
  console.log(`\nwithin 0.1% (a stale copy of the same number): ${near.length}`)
  for (const x of near) console.log(`   ${String(x.held).padStart(8)} held vs est ${x.est_sections}  ${x.corpus_key}`)
  const fs = await import('fs')
  const path = await import('path')
  const out = path.join(__dirname, '../../../docs/census/C3A_denominator_sweep.json')
  fs.writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), liveTargets: r.length,
    selfReferential: eq, within0_1pct: near, all: r }, null, 2))
  console.log('')
  console.log('written: docs/census/C3A_denominator_sweep.json')
  console.log('⚠ REPORT ONLY. A denominator can only be replaced by a real external one, per collection.')
  await p.end()
})()
