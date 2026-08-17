/**
 * resolve-offices-posts.ts — BRIEF_GRAPH_2D4 §2: office-by-date, on a source that states tenure.
 *
 * 2D-3 tried this against `graph_member_name` and it failed for a reason worth repeating: those
 * windows record **when a NAME FORM was carried, not when an OFFICE was held.** One surface of
 * 6,512 qualified, and it scored 63.8% against ground truth. `graph_member_post` (built by
 * sweep-posts.ts from the Members API's Biography endpoint) states a post name with a start AND an
 * end date, which is the fact the mechanism needed all along.
 *
 * ⚠ THE VALIDATION IS DIFFERENT IN KIND FROM 2D-3's, AND THAT MATTERS.
 * 2D-3 could score office-by-date against `division_votes`, because a vote independently carries
 * the true member id. **There is no equivalent independent truth for "who held post X on date D" —
 * the register IS the assertion.** So this reports three things instead of one accuracy figure:
 *   1. internal consistency — how many posts are genuinely held one-at-a-time
 *   2. a hand spot-check against posts whose holders are a matter of public record
 *   3. what the mechanism does on the brief's MNIS 3296 case
 * Claiming an accuracy percentage here would be exactly the inference-travelling-as-measurement
 * this project's working rule forbids.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/resolve-offices-posts.ts --build [--apply]
 *   npx tsx position-graph/resolve-offices-posts.ts --spotcheck
 *   npx tsx position-graph/resolve-offices-posts.ts --canterbury
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { classifySurface, holderOn, OFFICE_CONFIDENCE, type Tenure } from './resolve-offices'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const APPLY = flag('apply')
const RUN_ID = process.env.GRAPH_2D4_RUN_ID ?? 'offices-posts-2d4'
const n = (v: unknown) => Number(v).toLocaleString('en-GB')

const DDL = `
CREATE TABLE IF NOT EXISTS graph_office_post (
  post_norm      TEXT PRIMARY KEY,
  example_name   TEXT NOT NULL,
  kind           TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('office','simultaneous','single-holder','undatable')),
  n_holders      INTEGER NOT NULL,
  n_spells       INTEGER NOT NULL,
  first_start    DATE,
  last_end       DATE,
  key_source     TEXT NOT NULL DEFAULT 'office-by-date',
  confidence     REAL,
  run_id         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS graph_office_post_holder (
  post_norm  TEXT NOT NULL REFERENCES graph_office_post(post_norm) ON DELETE CASCADE,
  mnis_id    INTEGER NOT NULL,
  name       TEXT,
  start_date DATE,
  end_date   DATE,
  PRIMARY KEY (post_norm, mnis_id, start_date)
);
CREATE INDEX IF NOT EXISTS graph_office_post_holder_idx ON graph_office_post_holder (post_norm);`


/**
 * Is this post held by ONE PERSON AT A TIME?
 *
 * ⚠ THIS REPLACED A PER-PERSON COLLAPSE THAT verify-2d4 CAUGHT AS WRONG. The first version merged
 * each person's spells into min(start)..max(end) and then ran the generic overlap test. Two bugs in
 * one line: a NULL end means "still in post" and is therefore MAXIMAL, but the collapse preferred a
 * concrete date over it and so NARROWED the window; and merging spells at all invents a tenure the
 * register does not assert, over any gap between two spells. The result was 13 posts classified as
 * offices whose stored holders demonstrably overlap.
 *
 * The correct test is the definition: no two DIFFERENT people may hold it at the same time. One
 * person holding it twice with a gap is not a conflict, and is not merged away either.
 */
export function classifyPost(spells: Tenure[]): 'office' | 'simultaneous' | 'single-holder' | 'undatable' {
  const people = new Set(spells.map((s) => s.mnisId))
  if (people.size < 2) return 'single-holder'
  if (spells.some((s) => !s.start)) return 'undatable'
  const END = '9999-12-31'
  for (let i = 0; i < spells.length; i++) {
    for (let j = i + 1; j < spells.length; j++) {
      const a = spells[i]
      const b = spells[j]
      if (a.mnisId === b.mnisId) continue
      if (a.start! <= (b.end ?? END) && b.start! <= (a.end ?? END)) return 'simultaneous'
    }
  }
  return 'office'
}

async function tenures(pool: ReturnType<typeof getNeonPool>) {
  // ⚠ ONE ROW PER SPELL, not per person. A minister can hold the same post twice with a gap, and
  // collapsing the two spells into min(start)..max(end) would swallow whoever held it in between.
  const { rows } = await pool.query<{ post_norm: string; example: string; kind: string; mnis_id: number; start_date: string | null; end_date: string | null; name: string }>(`
    SELECT p.post_norm, MIN(p.post_name) OVER (PARTITION BY p.post_norm) example, p.kind,
           p.mnis_id, p.start_date::text, p.end_date::text, r.name_display name
    FROM graph_member_post p JOIN graph_member_register r ON r.mnis_id = p.mnis_id
    ORDER BY p.post_norm, p.start_date`)
  const by = new Map<string, { example: string; kind: string; spells: Tenure[] }>()
  for (const r of rows) {
    const e = by.get(r.post_norm) ?? by.set(r.post_norm, { example: r.example, kind: r.kind, spells: [] }).get(r.post_norm)!
    e.spells.push({ mnisId: r.mnis_id, start: r.start_date, end: r.end_date, name: r.name })
  }
  return by
}

async function build(pool: ReturnType<typeof getNeonPool>) {
  if (APPLY) for (const st of DDL.split(/;\s*\n/).filter((s) => s.trim())) await pool.query(st)
  const by = await tenures(pool)
  const counts: Record<string, number> = { office: 0, simultaneous: 0, 'single-holder': 0, undatable: 0 }
  const offices: Array<[string, { example: string; kind: string; spells: Tenure[] }]> = []
  for (const [norm, e] of by) {
    const cls = classifyPost(e.spells)
    counts[cls]++
    if (cls === 'office') offices.push([norm, e])
  }
  console.log(`\n════ §2 OFFICES FROM POSTS — ${n(by.size)} distinct post names ════`)
  console.log(`  office (held one at a time, dated)       ${String(counts.office).padStart(6)}   ← usable`)
  console.log(`  ⚠ simultaneous — several holders at once ${String(counts.simultaneous).padStart(6)}   REFUSED: "Minister of State" is not one office`)
  console.log(`  single-holder — nothing to resolve       ${String(counts['single-holder']).padStart(6)}`)
  console.log(`  ⚠ undatable — a holder has no start date ${String(counts.undatable).padStart(6)}   REFUSED`)
  console.log(`\n  compare 2D-3's attempt on graph_member_name: 1 office of 6,512 surfaces.`)

  const ranked = offices.sort((a, b) => b[1].spells.length - a[1].spells.length)
  console.log(`\n  the twelve offices with the most successive holders:`)
  for (const [, e] of ranked.slice(0, 12)) {
    const yrs = e.spells.map((s) => s.start?.slice(0, 4)).filter(Boolean)
    console.log(`    ${e.example.slice(0, 62).padEnd(62)} ${String(e.spells.length).padStart(2)} spells  ${yrs[0]}-${yrs[yrs.length - 1]}`)
  }

  if (!APPLY) { console.log(`\n  (dry run — nothing written)`); return }
  for (const [norm, e] of by) {
    const distinct = new Set(e.spells.map((s) => s.mnisId))
    const cls = classifyPost(e.spells)
    const starts = e.spells.map((s) => s.start).filter(Boolean).sort()
    const ends = e.spells.map((s) => s.end).filter(Boolean).sort()
    await pool.query(
      `INSERT INTO graph_office_post (post_norm, example_name, kind, classification, n_holders, n_spells,
         first_start, last_end, confidence, run_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (post_norm) DO UPDATE SET classification=EXCLUDED.classification,
         n_holders=EXCLUDED.n_holders, n_spells=EXCLUDED.n_spells`,
      [norm, e.example, e.kind, cls, distinct.size, e.spells.length, starts[0] ?? null,
        e.spells.some((s) => !s.end) ? null : (ends[ends.length - 1] ?? null),
        cls === 'office' ? OFFICE_CONFIDENCE : null, RUN_ID])
    if (cls !== 'office') continue
    for (const s of e.spells) {
      await pool.query(
        `INSERT INTO graph_office_post_holder (post_norm, mnis_id, name, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [norm, s.mnisId, s.name, s.start, s.end])
    }
  }
  console.log(`\n  ${n(by.size)} post classifications written; holders written for the ${counts.office} offices.`)
}

/** Posts whose holders on a given date are a matter of public record. A hand check, not a metric. */
const SPOT: Array<[string, string, string]> = [
  ['secretary of state for health and social care', '2019-01-15', 'Matt Hancock'],
  ['secretary of state for health and social care', '2022-01-15', 'Sajid Javid'],
  ['chancellor of the exchequer', '2018-06-01', 'Philip Hammond'],
  ['chancellor of the exchequer', '2021-06-01', 'Rishi Sunak'],
  ['secretary of state for foreign and commonwealth affairs', '2017-06-01', 'Boris Johnson'],
  // ⚠ THE ONE THAT MISSES, KEPT IN DELIBERATELY. On 2019-11-01 Jacob Rees-Mogg was Leader of the
  // House — and the register files that spell under "Lord President of the Council and Leader of the
  // House of Commons (Privy Council Office)". The bare "Leader of the House of Commons" post exists
  // too, with different holders. ONE OFFICE, SEVERAL POST-NAME VARIANTS, and the row below proves
  // the mechanism is right while the KEY is incomplete.
  ['leader of the house of commons', '2019-11-01', 'Jacob Rees-Mogg'],
  // The same date and the same office, under the register's own compound spelling for that period.
  ['lord president of the council and leader of the house of commons', '2024-10-01', 'Lucy Powell'],
  ['lord president of the council and leader of the house of commons', '2023-01-15', 'Penny Mordaunt'],
]

async function spotcheck(pool: ReturnType<typeof getNeonPool>) {
  const by = await tenures(pool)
  console.log(`\n════ HAND SPOT-CHECK — posts whose holders are public record ════`)
  console.log(`  ⚠ This is a hand check on six cases, NOT an accuracy rate. There is no independent`)
  console.log(`  truth table for "who held post X on date D" — the register is the assertion.\n`)
  let right = 0
  let wrong = 0
  let missing = 0
  for (const [postNorm, date, expected] of SPOT) {
    const e = by.get(postNorm)
    if (!e) { console.log(`  ? ${postNorm} — post not in the register at all`); missing++; continue }
    const collapsed = e.spells
    const h = holderOn(collapsed, date)
    // ⚠ ZERO holders and TWO holders are different failures and must not print the same string.
    // Zero usually means the sweep has not reached that member yet; two means the post genuinely
    // overlaps and is not an office. Reading "(no single holder)" for both hid an incomplete fetch.
    const matching = collapsed.filter((t) => t.start && t.start <= date && (t.end ?? '9999-12-31') >= date)
    const got = h?.name ?? (matching.length === 0 ? '(NOBODY on that date - fetch may be incomplete)' : `(${matching.length} SIMULTANEOUS: ${matching.map((m) => m.name).join(', ').slice(0, 46)})`)
    const ok = got.toLowerCase().includes(expected.toLowerCase().split(' ').pop()!)
    if (ok) right++; else wrong++
    console.log(`  ${ok ? '✓' : '✗'} ${postNorm.slice(0, 48).padEnd(48)} ${date}  expected ${expected.padEnd(18)} got ${got}`)
  }
  console.log(`\n  ${right} right · ${wrong} wrong · ${missing} post absent, of ${SPOT.length} hand cases`)
}

async function canterbury(pool: ReturnType<typeof getNeonPool>) {
  console.log(`\n════ THE BRIEF'S TEST CASE — MNIS 3296 AND THE ARCHBISHOPS ════`)
  const { rows } = await pool.query<{ mnis_id: number; name: string; s: string | null; e: string | null; votes: string }>(`
    SELECT r.mnis_id, r.name_display name, MIN(n.start_date)::text s, MAX(n.end_date)::text e,
           (SELECT COUNT(*)::text FROM division_votes v WHERE v.member_id = r.mnis_id) votes
    FROM graph_member_register r JOIN graph_member_name n ON n.mnis_id = r.mnis_id
    WHERE n.surface_norm = 'archbishop of canterbury' GROUP BY 1,2 ORDER BY 3 NULLS FIRST`)
  for (const r of rows) console.log(`  MNIS ${String(r.mnis_id).padStart(5)}  ${(r.name ?? '').padEnd(34)} ${r.s ?? '(no start date)'} -> ${r.e ?? 'current'}   ${r.votes} votes`)

  const { rows: posts } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text n FROM graph_member_post WHERE post_norm LIKE '%archbishop%' OR post_norm LIKE '%bishop of%'`)
  console.log(`\n  episcopal posts in graph_member_post: ${posts[0].n}`)
  console.log(`  ⚠ THE MINISTERIAL SOURCE DOES NOT COVER AN EPISCOPAL SEE. A see is not a government,`)
  console.log(`  opposition or party post, so it is absent from the Biography endpoint — and MNIS 3296`)
  console.log(`  therefore stays UNRESOLVED. That is the correct outcome: this sprint gives ministers a`)
  console.log(`  tenure source and leaves bishops exactly where 2D-3 left them.`)
  const { rows: [v] } = await pool.query<{ n: string }>(`
    SELECT COUNT(*)::text n FROM division_votes v JOIN graph_member_name m ON m.mnis_id = v.member_id
    WHERE m.surface_norm LIKE 'bishop of%' AND v.division_date BETWEEN '1991-01-01' AND '2002-12-31'`)
  console.log(`\n  Bishops' votes in the 1991-2002 window: ${v.n}`)
  console.log(`  ⚠ NONE of them can be misattributed by this mechanism, and the reason is structural`)
  console.log(`  rather than lucky: a division vote already carries its own member id, so office-by-date`)
  console.log(`  is never consulted for one. It is consulted only where all we hold is a name and a date.`)
}

async function main() {
  const pool = getNeonPool()
  try {
    if (flag('build')) await build(pool)
    if (flag('spotcheck')) await spotcheck(pool)
    if (flag('canterbury')) await canterbury(pool)
    if (!flag('build') && !flag('spotcheck') && !flag('canterbury')) { await build(pool); await spotcheck(pool); await canterbury(pool) }
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[resolve-offices-posts] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
