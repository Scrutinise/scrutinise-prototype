/**
 * probe-id-prefix.ts — before pruning a cursor scan with an id-range bound, check the assumption
 * the bound rests on: that every row of the collection has an id starting `tna-caselaw:`. A bound
 * that is wrong does not run slowly, it silently skips rows — which is the failure this project
 * has paid for before (build-fts-index's forward-only cursor). WRITES NOTHING.
 */
import { namesPool, endNamesPool } from '../names/names-pool'

;(async () => {
  const p = namesPool()
  const r = (await p.query(
    `SELECT COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE id LIKE 'tna-caselaw:%')::int AS prefixed,
            MIN(id) AS min_id, MAX(id) AS max_id
       FROM corpus_sections WHERE corpus='tna-caselaw'`)).rows[0]
  console.log(`rows ${r.n.toLocaleString()}   id starts 'tna-caselaw:' on ${r.prefixed.toLocaleString()} ` +
    `(${((100 * r.prefixed) / r.n).toFixed(3)}%)`)
  console.log(`min id  ${r.min_id}`)
  console.log(`max id  ${r.max_id}`)
  const outside = (await p.query(
    `SELECT COUNT(*)::int AS n FROM corpus_sections
      WHERE corpus='tna-caselaw' AND (id < 'tna-caselaw:' OR id >= 'tna-caselaw;')`)).rows[0].n
  console.log(`rows OUTSIDE the ['tna-caselaw:', 'tna-caselaw;') range: ${outside}  ` +
    `${outside === 0 ? '— the bound is safe' : '— THE BOUND WOULD SKIP THESE'}`)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
