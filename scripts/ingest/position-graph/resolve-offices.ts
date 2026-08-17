/**
 * resolve-offices.ts — BRIEF_GRAPH_2D3_CONTINUED §2: an office plus a date is a deterministic lookup.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * CHARLIE'S INSIGHT, AND WHY IT DISSOLVES THE LARGEST CATEGORY IN THE AMENDMENT 2 SIGNAL TABLE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * > *"As for Archbishops of Canterbury, we can identify them by cross-referencing the date. There's
 * > only ever one A of C at a time."*
 *
 * `graph_identity_signal` scores 150 of 187 pairs `disjoint-service`, 139 of them episcopal.
 * Amendment 2 read those as ambiguity that could not be resolved. They are not ambiguous: they are
 * **an office held in succession**, and the register already states who held it when.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * FOUR THINGS THIS REFUSES TO DO
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * 1. **It does not decide an office by the name looking grand.** The test is the REGISTER showing
 *    non-overlapping tenure across every holder of the surface. `sharma` normalises Lord Sharma and
 *    Mr Virendra Sharma together, they sat simultaneously, and the overlap test refuses the surface
 *    outright. That refusal is counted, not hidden.
 * 2. **It does not write to `graph_entity`.** The brief asks for a `key_source` of its own and it
 *    gets one — on the RESOLUTION, not on the entity. An entity is a claim that mentions are one
 *    actor; an office cluster is several actors sharing a title, so stamping a member id on the
 *    cluster would build exactly the composite actor Amendment 2 §1 rules out. Resolution is
 *    per OCCURRENCE, and each occurrence carries its own date.
 * 3. **It does not resolve an undated occurrence.** No date, no lookup — recorded as
 *    `undated`, and counted, because the count is the honest limit of the method.
 * 4. **It does not trust itself.** `--validate` scores the mechanism against ground truth: division
 *    votes already carry the true member id, so resolving (surface, division date) and comparing is
 *    a measured accuracy rather than an argument. The brief's MNIS 3296 case is checked by name.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/resolve-offices.ts --self-test
 *   npx tsx position-graph/resolve-offices.ts --build [--apply]
 *   npx tsx position-graph/resolve-offices.ts --validate
 *   npx tsx position-graph/resolve-offices.ts --resolve [--apply]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const APPLY = flag('apply')
const RUN_ID = process.env.GRAPH_2D3_RUN_ID ?? 'offices-2d3'

/** office-by-date sits ABOVE a name match and BELOW a stable key: the register asserts the
 *  succession, so it is not our inference — but the surface still had to be recognised as an office. */
export const OFFICE_CONFIDENCE = 0.95

export interface Tenure { mnisId: number; start: string | null; end: string | null; name: string }

/** Do two tenures overlap? A NULL end means "still current". A NULL start makes it unplaceable. */
export function overlaps(a: Tenure, b: Tenure): boolean {
  if (!a.start || !b.start) return false          // unplaceable — handled separately, never as "no overlap"
  const aEnd = a.end ?? '9999-12-31'
  const bEnd = b.end ?? '9999-12-31'
  return a.start <= bEnd && b.start <= aEnd
}

/**
 * Is this surface an OFFICE — a title held by one person at a time?
 *
 * ⚠ `undatable` is returned rather than folded into either answer. A surface whose holders cannot
 * all be placed on a timeline has not been shown to be an office and has not been shown not to be
 * one, and a method that guessed here would be wrong in exactly the cases that matter.
 */
export function classifySurface(tenures: Tenure[]): 'office' | 'simultaneous' | 'single-holder' | 'undatable' {
  if (tenures.length < 2) return 'single-holder'
  if (tenures.some((t) => !t.start)) return 'undatable'
  for (let i = 0; i < tenures.length; i++) {
    for (let j = i + 1; j < tenures.length; j++) if (overlaps(tenures[i], tenures[j])) return 'simultaneous'
  }
  return 'office'
}

/** Who held the office on this date? Exactly one, or null. */
export function holderOn(tenures: Tenure[], date: string): Tenure | null {
  const hits = tenures.filter((t) => t.start && t.start <= date && (t.end ?? '9999-12-31') >= date)
  return hits.length === 1 ? hits[0] : null
}

const DDL = `
CREATE TABLE IF NOT EXISTS graph_office (
  office_norm   TEXT PRIMARY KEY,
  classification TEXT NOT NULL CHECK (classification IN ('office','simultaneous','single-holder','undatable')),
  n_holders     INTEGER NOT NULL,
  first_start   DATE,
  last_end      DATE,
  example_name  TEXT,
  run_id        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS graph_office_holder (
  office_norm  TEXT NOT NULL REFERENCES graph_office(office_norm) ON DELETE CASCADE,
  mnis_id      INTEGER NOT NULL,
  display_name TEXT,
  start_date   DATE,
  end_date     DATE,
  PRIMARY KEY (office_norm, mnis_id, start_date)
);
CREATE INDEX IF NOT EXISTS graph_office_holder_norm_idx ON graph_office_holder (office_norm);
CREATE TABLE IF NOT EXISTS graph_office_resolution (
  id              BIGSERIAL PRIMARY KEY,
  office_norm     TEXT NOT NULL,
  occurrence_kind TEXT NOT NULL,
  occurrence_ref  TEXT NOT NULL,
  entity_id       BIGINT REFERENCES graph_entity(id) ON DELETE CASCADE,
  surface         TEXT NOT NULL,
  observed_on     DATE,
  mnis_id         INTEGER,
  outcome         TEXT NOT NULL CHECK (outcome IN ('resolved','undated','no-holder-on-date','ambiguous-date')),
  key_source      TEXT NOT NULL DEFAULT 'office-by-date',
  confidence      REAL,
  run_id          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (occurrence_kind, occurrence_ref, office_norm)
);
CREATE INDEX IF NOT EXISTS graph_office_res_mnis_idx ON graph_office_resolution (mnis_id) WHERE mnis_id IS NOT NULL;`

async function tenuresBySurface(pool: ReturnType<typeof getNeonPool>) {
  const { rows } = await pool.query<{ surface_norm: string; mnis_id: number; start_date: string | null; end_date: string | null; name: string }>(`
    SELECT n.surface_norm, n.mnis_id,
           MIN(n.start_date)::text AS start_date,
           CASE WHEN bool_or(n.end_date IS NULL) THEN NULL ELSE MAX(n.end_date)::text END AS end_date,
           MIN(r.name_display) AS name
    FROM graph_member_name n JOIN graph_member_register r ON r.mnis_id = n.mnis_id
    GROUP BY n.surface_norm, n.mnis_id`)
  const bySurface = new Map<string, Tenure[]>()
  for (const r of rows) {
    const arr = bySurface.get(r.surface_norm) ?? bySurface.set(r.surface_norm, []).get(r.surface_norm)!
    arr.push({ mnisId: r.mnis_id, start: r.start_date, end: r.end_date, name: r.name })
  }
  return bySurface
}

async function build(pool: ReturnType<typeof getNeonPool>) {
  if (APPLY) for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  const bySurface = await tenuresBySurface(pool)
  const counts: Record<string, number> = { office: 0, simultaneous: 0, 'single-holder': 0, undatable: 0 }
  const offices: Array<[string, Tenure[]]> = []
  const classified: Array<[string, ReturnType<typeof classifySurface>, Tenure[]]> = []
  for (const [norm, tenures] of bySurface) {
    const cls = classifySurface(tenures)
    counts[cls]++
    classified.push([norm, cls, tenures])
    if (cls === 'office') offices.push([norm, tenures])
  }
  console.log(`\n════ §2 OFFICES — ${bySurface.size.toLocaleString('en-GB')} register surfaces classified ════`)
  console.log(`  office (succession, never simultaneous)  ${String(counts.office).padStart(6)}`)
  console.log(`  ⚠ simultaneous — two people at once      ${String(counts.simultaneous).padStart(6)}   REFUSED: not an office`)
  console.log(`  single-holder — nothing to resolve       ${String(counts['single-holder']).padStart(6)}`)
  console.log(`  ⚠ undatable — a holder has no start date ${String(counts.undatable).padStart(6)}   REFUSED: cannot be shown either way`)

  const biggest = offices.sort((a, b) => b[1].length - a[1].length).slice(0, 8)
  console.log(`\n  the eight offices with the most holders:`)
  for (const [norm, t] of biggest) console.log(`    ${norm.padEnd(38)} ${String(t.length).padStart(2)} holders, ${t.map((x) => x.start?.slice(0, 4)).sort().join(' → ')}`)

  if (!APPLY) { console.log(`\n  (dry run — nothing written)`); return offices }

  // ⚠ EVERY classification is stored, not just the offices. "323 surfaces refused because two
  // people held the title at once" IS the finding; a table holding only the successes would report
  // a method that works on everything it was allowed to look at. Batched, because 6,511 single
  // INSERTs over Neon is four minutes of round trips for 300 KB of rows.
  const rest = classified.filter(([, cls]) => cls !== 'office')
  for (let i = 0; i < rest.length; i += 500) {
    const batch = rest.slice(i, i + 500)
    await pool.query(
      `INSERT INTO graph_office (office_norm, classification, n_holders, first_start, last_end, example_name, run_id)
       SELECT * FROM unnest($1::text[], $2::text[], $3::int[], $4::date[], NULL::date[], $5::text[], $6::text[])
       ON CONFLICT (office_norm) DO UPDATE SET classification = EXCLUDED.classification`,
      [batch.map((b) => b[0]), batch.map((b) => b[1]), batch.map((b) => b[2].length),
        batch.map((b) => b[2].map((t) => t.start).filter(Boolean).sort()[0] ?? null),
        batch.map((b) => b[2][0].name), batch.map(() => RUN_ID)])
  }
  console.log(`  ${rest.length} non-office classifications recorded (the refusals are the finding)`)

  for (const [norm, tenures] of offices) {
    const starts = tenures.map((t) => t.start).filter(Boolean).sort()
    const ends = tenures.map((t) => t.end).filter(Boolean).sort()
    await pool.query(
      `INSERT INTO graph_office (office_norm, classification, n_holders, first_start, last_end, example_name, run_id)
       VALUES ($1,'office',$2,$3,$4,$5,$6)
       ON CONFLICT (office_norm) DO UPDATE SET n_holders=EXCLUDED.n_holders, last_end=EXCLUDED.last_end`,
      [norm, tenures.length, starts[0] ?? null, tenures.some((t) => !t.end) ? null : (ends[ends.length - 1] ?? null), tenures[0].name, RUN_ID])
    for (const t of tenures) {
      await pool.query(
        `INSERT INTO graph_office_holder (office_norm, mnis_id, display_name, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [norm, t.mnisId, t.name, t.start, t.end])
    }
  }
  console.log(`\n  ${offices.length} offices and their holders written.`)
  return offices
}

/**
 * ⚠ THE MECHANISM IS SCORED AGAINST GROUND TRUTH BEFORE IT IS TRUSTED.
 *
 * `division_votes` already carries the TRUE member id for every vote. So for every vote cast by a
 * member whose register surface is an office, resolving (surface, division date) and comparing to
 * the id we already know gives a measured accuracy — not an argument that the method should work.
 * A wrong answer here is precisely the brief's warning: a fabricated voting record for a named person.
 */
async function validate(pool: ReturnType<typeof getNeonPool>) {
  const bySurface = await tenuresBySurface(pool)
  const offices = new Map([...bySurface].filter(([, t]) => classifySurface(t) === 'office'))
  console.log(`\n════ VALIDATION against ${offices.size} offices, using division votes as ground truth ════`)

  const { rows } = await pool.query<{ member_id: number; division_date: string; surface_norm: string }>(`
    SELECT DISTINCT v.member_id, v.division_date::text, n.surface_norm
    FROM division_votes v
    JOIN graph_member_name n ON n.mnis_id = v.member_id
    WHERE n.surface_norm = ANY($1::text[])`, [[...offices.keys()]])
  let right = 0
  let wrong = 0
  let noHolder = 0
  const wrongExamples: string[] = []
  for (const r of rows) {
    const h = holderOn(offices.get(r.surface_norm)!, r.division_date)
    if (!h) { noHolder++; continue }
    if (h.mnisId === r.member_id) right++
    else {
      wrong++
      if (wrongExamples.length < 8) wrongExamples.push(`${r.surface_norm} on ${r.division_date}: register says MNIS ${h.mnisId}, the vote was cast by MNIS ${r.member_id}`)
    }
  }
  const scored = right + wrong
  console.log(`  (surface, date) pairs tested        ${rows.length.toLocaleString('en-GB')}`)
  console.log(`  resolved to exactly one holder      ${scored.toLocaleString('en-GB')}`)
  console.log(`  ✓ matched the true member id        ${right.toLocaleString('en-GB')}  (${(100 * right / Math.max(1, scored)).toFixed(2)}%)`)
  console.log(`  ✗ WRONG PERSON                      ${wrong.toLocaleString('en-GB')}  (${(100 * wrong / Math.max(1, scored)).toFixed(2)}%)`)
  console.log(`  no holder on that date              ${noHolder.toLocaleString('en-GB')}  (a gap in the register's dates, not a wrong answer)`)
  for (const w of wrongExamples) console.log(`      ⚠ ${w}`)

  // The brief's named counter-example, checked by name rather than by assumption.
  const { rows: ac } = await pool.query<{ mnis_id: number; name_display: string; s: string; e: string }>(`
    SELECT r.mnis_id, r.name_display, MIN(n.start_date)::text s, MAX(n.end_date)::text e
    FROM graph_member_register r JOIN graph_member_name n ON n.mnis_id = r.mnis_id
    WHERE n.surface_norm = 'archbishop of canterbury' GROUP BY 1,2 ORDER BY 3`)
  console.log(`\n  ── the brief's counter-example: 'archbishop of canterbury' ──`)
  for (const a of ac) {
    const { rows: [v] } = await pool.query<{ n: string }>(`SELECT COUNT(*)::text n FROM division_votes WHERE member_id=$1`, [a.mnis_id])
    console.log(`    MNIS ${String(a.mnis_id).padStart(5)}  ${(a.name_display ?? '').padEnd(34)} ${a.s ?? '?'} → ${a.e ?? 'current'}  ${v.n} votes`)
  }
  const { rows: [win] } = await pool.query<{ n: string }>(`
    SELECT COUNT(*)::text n FROM division_votes v JOIN graph_member_name n ON n.mnis_id=v.member_id
    WHERE n.surface_norm LIKE 'bishop of%' AND v.division_date BETWEEN '1991-01-01' AND '2002-12-31'`)
  console.log(`    Bishops' votes in the 1991–2002 window: ${win.n}`)
  console.log(`    ⚠ none of them is attributed by this mechanism — a division vote already carries its`)
  console.log(`      own member id, so office-by-date is never consulted for one. It is consulted only`)
  console.log(`      where all we hold is a name and a date.`)
}

/** Apply the lookup to the occurrences that actually need it: dated, name-only person mentions. */
async function resolve(pool: ReturnType<typeof getNeonPool>) {
  const bySurface = await tenuresBySurface(pool)
  const offices = new Map([...bySurface].filter(([, t]) => classifySurface(t) === 'office'))
  const { rows } = await pool.query<{ edge_id: string; entity_id: string; surface: string; name_norm: string; d: string | null }>(`
    SELECT ge.id::text edge_id, en.id::text entity_id, en.canonical_name surface, en.name_norm,
           ge.last_seen::text d
    FROM graph_edge ge JOIN graph_entity en ON en.id = ge.subject_id
    WHERE en.kind='person' AND en.parl_member_id IS NULL AND en.name_norm = ANY($1::text[])`, [[...offices.keys()]])
  console.log(`\n════ RESOLVE — ${rows.length.toLocaleString('en-GB')} unkeyed person edges whose surface is an office ════`)
  const out = { resolved: 0, undated: 0, noHolder: 0 }
  for (const r of rows) {
    let outcome: string
    let mnis: number | null = null
    if (!r.d) { outcome = 'undated'; out.undated++ } else {
      const h = holderOn(offices.get(r.name_norm)!, r.d)
      if (h) { outcome = 'resolved'; mnis = h.mnisId; out.resolved++ } else { outcome = 'no-holder-on-date'; out.noHolder++ }
    }
    if (APPLY) {
      await pool.query(
        `INSERT INTO graph_office_resolution (office_norm, occurrence_kind, occurrence_ref, entity_id, surface,
           observed_on, mnis_id, outcome, confidence, run_id)
         VALUES ($1,'gave-evidence-to',$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (occurrence_kind, occurrence_ref, office_norm) DO NOTHING`,
        [r.name_norm, r.edge_id, r.entity_id, r.surface, r.d, mnis, outcome, mnis ? OFFICE_CONFIDENCE : null, RUN_ID])
    }
  }
  console.log(`  resolved to a named holder    ${out.resolved}`)
  console.log(`  ⚠ undated — cannot be resolved ${out.undated}   (the honest limit of the method)`)
  console.log(`  no holder on that date         ${out.noHolder}`)
  if (!APPLY) console.log(`  (dry run — nothing written)`)
}

function selftest() {
  const durham: Tenure[] = [
    { mnisId: 1, start: '2003-01-01', end: '2013-12-31', name: 'A' },
    { mnisId: 2, start: '2014-01-01', end: null, name: 'B' },
  ]
  const sharma: Tenure[] = [
    { mnisId: 10, start: '2010-05-06', end: null, name: 'Lord Sharma' },
    { mnisId: 11, start: '2007-05-01', end: '2024-05-30', name: 'Mr Virendra Sharma' },
  ]
  const cases: Array<[string, boolean]> = [
    ['a succession is an office', classifySurface(durham) === 'office'],
    ['⚠ two people at once is NOT an office', classifySurface(sharma) === 'simultaneous'],
    ['a single holder is not an office', classifySurface([durham[0]]) === 'single-holder'],
    ['⚠ a missing start date is undatable, not "no overlap"',
      classifySurface([{ mnisId: 3, start: null, end: null, name: 'C' }, durham[0]]) === 'undatable'],
    ['an open-ended tenure overlaps a later one', overlaps({ mnisId: 1, start: '2000-01-01', end: null, name: 'A' }, durham[1])],
    ['the holder on a date inside the first tenure', holderOn(durham, '2008-06-01')?.mnisId === 1],
    ['the holder on a date inside the second', holderOn(durham, '2020-06-01')?.mnisId === 2],
    ['a date before any tenure resolves to nobody', holderOn(durham, '1999-01-01') === null],
    ['a boundary date belongs to the tenure that contains it', holderOn(durham, '2013-12-31')?.mnisId === 1],
    ['⚠ a date covered by two tenures resolves to NOBODY, never to the first',
      holderOn([durham[0], { mnisId: 9, start: '2005-01-01', end: '2009-01-01', name: 'X' }], '2006-01-01') === null],
    ['office confidence sits above a name match and below a stable key',
      OFFICE_CONFIDENCE > 0.9 && OFFICE_CONFIDENCE < 1.0],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}

async function main() {
  if (flag('self-test')) { selftest(); return }
  const pool = getNeonPool()
  try {
    if (flag('build')) await build(pool)
    if (flag('validate')) await validate(pool)
    if (flag('resolve')) await resolve(pool)
    if (!flag('build') && !flag('validate') && !flag('resolve')) { await build(pool); await validate(pool) }
  } finally { await endNeonPool() }
}
// ⚠ GUARDED. verify-2d3.ts imports classifySurface/holderOn from here; without this an
// import RAN THE SCRIPT, which ended the shared pool underneath the caller ('Called end on pool
// more than once'). A module that does work on import is a module that cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[resolve-offices] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
