/**
 * harness.ts — PART B. The one place a walk becomes a census row.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS ENFORCES, SO NO WALKER HAS TO REMEMBER IT
 *
 *  1. A walk lands in TWO places or neither: `docs/census/<corpus_key>.json` on disk (dated) and
 *     the `corpus_census` row the email reads. A number in the database whose walk is not on disk
 *     has no provenance, which is the whole defect this sprint exists to end.
 *  2. `held_units` is computed HERE, from `corpus_sections`, never passed in by a walker's own
 *     arithmetic — so a walker cannot report coverage against a number it made up.
 *  3. ONE retry class, here, not per walker (the brief's standing rule and §18's family: fix a
 *     failure class in the shared helper).
 *  4. Every walker can be made to FAIL: `selfTestHeld()` runs the held-side query against a
 *     deliberately mistyped corpus key and requires it to report 0 held, not 0 published. A walker
 *     that reports 100% against a corpus that does not exist is measuring nothing, and that is the
 *     shape the whole brief was written about.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 */
import fs from 'fs'
import path from 'path'

export const OUT_DIR = path.join(__dirname, '../../../../docs/census')
export const WALK_DIR = path.join(OUT_DIR, 'walks')
const REPO = path.join(__dirname, '../../../..')

export type CensusState = 'MEASURED' | 'CLAIMED' | 'DECLARED' | 'UNMEASURED' | 'NOT_STARTED' | 'BLOCKED' | 'RETIRED'

export interface CensusRow {
  corpus_key: string
  state: CensusState
  unit: string
  method: string
  walked_at?: Date | null
  published_units: number | null
  held_units: number | null
  hollow_units?: number
  absent_ids?: string[]
  absent_total?: number
  notes?: string | null
  walk_artifact_path?: string | null
}

/** ── the one retry class ─────────────────────────────────────────────────────────────────────
 *  Retryable: 429, 5xx, network. Deterministic: 404 and 4xx (returns null with `retryable:false`).
 *  ⚠ The distinction is load-bearing. Recording a throttled feed as an empty one manufactures a
 *  coverage gap out of a rate limit — V19's failure, and it has recurred in three costumes since.
 */
export async function politeFetch(
  url: string, opts: { attempts?: number; floorMs?: number; accept?: string } = {}
): Promise<{ text: string | null; status: number; retryable: boolean }> {
  const attempts = opts.attempts ?? 4
  const floor = opts.floorMs ?? 500
  const UA = 'ScrutiniseBot/1.0 (+https://www.scrutinise.org; corpus completeness census)'
  let status = 0
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...(opts.accept ? { Accept: opts.accept } : {}) } })
      status = res.status
      if (res.status === 404 || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return { text: null, status, retryable: false }
      }
      if (res.status === 429 || res.status >= 500) { await sleep(2000 * i); continue }
      const text = await res.text()
      await sleep(floor)
      return { text, status, retryable: false }
    } catch { await sleep(2000 * i) }
  }
  return { text: null, status, retryable: true }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** ── held units, computed here and only here ─────────────────────────────────────────────────
 *  `unitExpr` is the SQL that turns a section row into the publisher's unit. The default —
 *  parentDocId, falling back to the middle field of the section id — reproduces every collection
 *  shape measured on 27 Aug: pwdata carries the sitting-day file in parentDocId, legislation
 *  carries nothing there and puts the gid in the id.
 */
export const DEFAULT_UNIT_EXPR = `coalesce("parentDocId", split_part(id, ':', 2))`

export async function heldUnits(
  p: any, corpusKeys: string[], unitExpr: string = DEFAULT_UNIT_EXPR
): Promise<number> {
  if (corpusKeys.length === 0) return 0
  const r = await p.query(
    `SELECT count(DISTINCT ${unitExpr})::int n FROM corpus_sections
      WHERE corpus = ANY($1) AND status='compiled'`, [corpusKeys])
  return r.rows[0].n
}

/** ── hollow units ────────────────────────────────────────────────────────────────────────────
 *  A3 established that no distribution test finds the hollow cases on its own: `et-decisions`
 *  landing pages sit at a MEDIAN of 18 words, above the brief's 15-word floor, and `building-regs`
 *  (median 318) cannot fail a distribution test at all. The instrument that works is the sourceUrl
 *  pointing at the landing page rather than the document — and it OVER-flags (`planning-policy` is
 *  a verified false positive). So this is a CANDIDATE DETECTOR and every row it produces says so.
 *
 *  Default: a unit whose sections total fewer than `floorWords` words between them.
 */
export async function hollowUnits(
  p: any, corpusKeys: string[], opts: { unitExpr?: string; floorWords?: number; predicate?: string } = {}
): Promise<number> {
  if (corpusKeys.length === 0) return 0
  const unitExpr = opts.unitExpr ?? DEFAULT_UNIT_EXPR
  if (opts.predicate) {
    const r = await p.query(
      `SELECT count(DISTINCT ${unitExpr})::int n FROM corpus_sections
        WHERE corpus = ANY($1) AND status='compiled' AND (${opts.predicate})`, [corpusKeys])
    return r.rows[0].n
  }
  const floor = opts.floorWords ?? 25
  const r = await p.query(
    `SELECT count(*)::int n FROM (
        SELECT ${unitExpr} u, sum(coalesce("wordCount",0))::bigint w
          FROM corpus_sections WHERE corpus = ANY($1) AND status='compiled' GROUP BY 1
     ) x WHERE x.w < $2`, [corpusKeys, floor])
  return r.rows[0].n
}

/** ── write: disk first, then the row the email reads ─────────────────────────────────────────*/
export async function writeCensus(p: any, rows: CensusRow[], group: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(WALK_DIR, { recursive: true })
  const summary: any[] = []

  for (const r of rows) {
    const artefact = {
      corpus_key: r.corpus_key,
      state: r.state,
      unit: r.unit,
      method: r.method,
      walked_at: (r.walked_at ?? null) && new Date(r.walked_at as any).toISOString(),
      published_units: r.published_units,
      held_units: r.held_units,
      hollow_units: r.hollow_units ?? 0,
      absent_total: r.absent_total ?? (r.absent_ids?.length ?? 0),
      absent_ids: r.absent_ids ?? [],
      notes: r.notes ?? null,
    }
    const file = path.join(OUT_DIR, `${r.corpus_key}.json`)
    fs.writeFileSync(file, JSON.stringify(artefact, null, 2))
    const rel = path.relative(REPO, file).replace(/\\/g, '/')

    await p.query(
      `INSERT INTO corpus_census (corpus_key, state, unit, method, walked_at, published_units,
                                  held_units, hollow_units, absent_ids, absent_total, notes,
                                  walk_artifact_path, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12, now())
       ON CONFLICT (corpus_key) DO UPDATE SET
         state=EXCLUDED.state, unit=EXCLUDED.unit, method=EXCLUDED.method,
         walked_at=EXCLUDED.walked_at, published_units=EXCLUDED.published_units,
         held_units=EXCLUDED.held_units, hollow_units=EXCLUDED.hollow_units,
         absent_ids=EXCLUDED.absent_ids, absent_total=EXCLUDED.absent_total,
         notes=EXCLUDED.notes, walk_artifact_path=EXCLUDED.walk_artifact_path, updated_at=now()`,
      [r.corpus_key, r.state, r.unit, r.method, r.walked_at ?? null, r.published_units,
       r.held_units, Math.min(r.hollow_units ?? 0, r.held_units ?? 0),
       JSON.stringify((r.absent_ids ?? []).slice(0, 1000)),
       r.absent_total ?? (r.absent_ids?.length ?? 0), r.notes ?? null,
       r.walk_artifact_path ?? rel])

    const pct = r.published_units && r.held_units != null
      ? `${((r.held_units / r.published_units) * 100).toFixed(1)}%` : '—'
    summary.push({ key: r.corpus_key, state: r.state, held: r.held_units, published: r.published_units, pct })
    console.log(`  ${r.state.padEnd(11)} ${r.corpus_key.padEnd(28)} ` +
      `${String(r.held_units ?? '—').padStart(9)} / ${String(r.published_units ?? '—').padStart(9)}  ${pct.padStart(7)}` +
      (r.hollow_units ? `  (hollow ${r.hollow_units.toLocaleString()})` : ''))
  }
  console.log(`\n✓ ${rows.length} census row(s) written for "${group}" — artefacts in docs/census/, rows in corpus_census`)
  return summary
}

/** ── the failure test every walker must pass ─────────────────────────────────────────────────
 *  Run the held side against a corpus key that does not exist. It must report 0 held. A harness
 *  that reports 100% here is computing `held/held` and would tick an empty corpus, which is
 *  precisely what `corpus_targets.est_sections` did for 41 collections.
 */
export async function selfTestHeld(group: string) {
  const { pool } = await import('../../c2/db')
  const p = pool()
  const real = 'primary-acts-2000plus'
  const typo = 'primary-acts-2000plusX'
  const heldReal = await heldUnits(p, [real])
  const heldTypo = await heldUnits(p, [typo])
  const published = 100
  console.log(`── self-test (${group}): can the held side report a gap? ──`)
  console.log(`  real corpus  '${real}'  held units = ${heldReal.toLocaleString()}`)
  console.log(`  typo corpus  '${typo}' held units = ${heldTypo.toLocaleString()}`)
  console.log(`  coverage against a published_units of ${published}:`)
  console.log(`     real: ${((heldReal / published) * 100).toFixed(1)}%   typo: ${((heldTypo / published) * 100).toFixed(1)}%`)
  const ok = heldTypo === 0 && heldReal > 0
  console.log(ok
    ? '  ✓ a corpus we hold nothing of reports 0%, not 100%. The measurement can fail.'
    : '  ✗ THE HELD SIDE CANNOT REPORT A GAP — do not trust any number this harness produces.')
  await p.end()
  if (!ok) process.exit(5)
}
