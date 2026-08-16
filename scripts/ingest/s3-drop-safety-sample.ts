/**
 * s3-drop-safety-sample.ts — the measurement the DROP decision actually needs.
 *
 * The chain so far:
 *   1. per-instrument counts        → 5,106 instruments "short", ~37,154 sections behind
 *   2. dot-leader triage            → the orphans are real text, not retracted placeholders
 *   3. ref-format check             → the two sides model amending instruments differently
 *   4. amendment-target spot check  → 9 of 9 "lost" provisions ARE held, under the TARGET act
 *
 * Step 4 is the answer but n=9 across 3 instruments cannot authorise dropping 1.73 GB.
 * This scales it: draw a RANDOM sample of orphaned legacy sections from across the whole
 * shortfall population and ask, for each, whether its text is held ANYWHERE in the corpus.
 *
 * Matching is by SECTION TITLE, not by ref. Refs are exactly what differs between the two
 * models (`357TA` under the amending Act vs `section-357TA` under the target), so a
 * ref-based test measures the naming convention rather than the content. Titles are
 * distinctive and survive the re-modelling. Only titles long enough to be discriminating
 * are used, and the unusable remainder is REPORTED rather than quietly dropped from the
 * denominator.
 *
 * Read-only. Drops nothing.
 *
 * Usage: tsx s3-drop-safety-sample.ts [--n 400]
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const N = (() => { const i = process.argv.indexOf('--n'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : 400 })()
const n = (v: any) => Number(v).toLocaleString('en-GB')
const norm = (s: any) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

async function main() {
  const pool = getNeonPool()

  // ⚠ Split into cheap steps. A single CTE doing both GROUP BYs, the join and an
  // md5() ordering over 914k legacy rows and 18.3M corpus rows times out.
  console.log('computing the shortfall instrument list…')
  const { rows: counts } = await pool.query(
    `SELECT li."legislationGovUkId" AS gid, count(*)::int AS legacy_n
       FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
      GROUP BY 1`)
  const { rows: corpusCounts } = await pool.query(
    `SELECT split_part(id, ':', 2) AS gid, count(*)::int AS corpus_n FROM corpus_sections GROUP BY 1`)
  const corpusBy = new Map<string, number>()
  for (const r of corpusCounts) corpusBy.set(r.gid, Number(r.corpus_n))
  const shortGids = counts
    .filter((r: any) => (corpusBy.get(r.gid) ?? 0) > 0 && (corpusBy.get(r.gid) ?? 0) < Number(r.legacy_n))
    .map((r: any) => r.gid)
  console.log(`  shortfall instruments: ${n(shortGids.length)}`)

  console.log('drawing the sample…')
  const { rows: sample } = await pool.query(`
    SELECT li."legislationGovUkId" AS gid, ls."sectionNumber", ls."sectionTitle"
      FROM "LegislationSection" ls JOIN "LegislationItem" li ON li.id = ls."legislationItemId"
     WHERE li."legislationGovUkId" = ANY($1::text[]) AND ls."sectionTitle" IS NOT NULL
     ORDER BY md5(ls.id) LIMIT $2`, [shortGids, N])

  const usable = sample.filter((r: any) => norm(r.sectionTitle).length >= 18)
  const unusable = sample.length - usable.length
  console.log(`sampled ${n(sample.length)} legacy sections from shortfall instruments`)
  console.log(`  usable (title >= 18 normalised chars): ${n(usable.length)}`)
  console.log(`  unusable (title too short/generic)   : ${n(unusable)}  ← reported, not silently dropped`)

  const titles = [...new Set(usable.map((r: any) => String(r.sectionTitle)))]
  console.log(`\nchecking ${n(titles.length)} distinct titles against the whole corpus (one scan)…`)
  const { rows: found } = await pool.query(
    `SELECT DISTINCT "sectionTitle" FROM corpus_sections WHERE "sectionTitle" = ANY($1::text[])`, [titles])
  const foundSet = new Set(found.map((r: any) => norm(r.sectionTitle)))

  const held = usable.filter((r: any) => foundSet.has(norm(r.sectionTitle)))
  const missing = usable.filter((r: any) => !foundSet.has(norm(r.sectionTitle)))
  const pct = usable.length ? (held.length / usable.length) * 100 : 0

  console.log(`\n════ IS THE "LOST" TEXT HELD ANYWHERE IN THE CORPUS? ════`)
  console.log(`  held somewhere in corpus : ${n(held.length)} / ${n(usable.length)}  (${pct.toFixed(1)}%)`)
  console.log(`  not found by title       : ${n(missing.length)}  (${(100 - pct).toFixed(1)}%)`)
  if (missing.length) {
    console.log(`\n  examples NOT found (these are what a DROP would actually cost):`)
    for (const m of missing.slice(0, 15)) {
      console.log(`    ${String(m.gid).padEnd(22)} s.${String(m.sectionNumber).padEnd(10)} "${String(m.sectionTitle).slice(0, 70)}"`)
    }
  }

  console.log(`\n  ⚠ A title match proves the PROVISION is held, not that the two texts are`)
  console.log(`    byte-identical or equally current. It is the right test for "would the drop`)
  console.log(`    make something unreachable", and the wrong one for "is the corpus copy better".`)

  await endNeonPool()
}

main().catch((e) => { console.error(e); process.exit(1) })
