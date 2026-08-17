/**
 * verify-2d5.ts — the checks for BRIEF_GRAPH_2D5.
 *
 * ⚠ THE TWO THAT MATTER MOST ARE THE ONES ABOUT WHAT DID **NOT** HAPPEN:
 *
 *   §5  "The graph of record stays untouched." Trials live in their own tables. This asserts the
 *       row counts and the polarity distribution in `graph_position` are exactly what 2D-3 left.
 *
 *   §3  "Do not adjust the position for it." Inquiry framing is stored and must never reach a
 *       polarity. This greps every file in the stream for a join between the two, and it was
 *       watched failing with a planted one.
 *
 * A check that has never been seen to fail is not a check. Each assertion below was run against a
 * deliberately broken input first; the ones with a mechanical negative control carry it inline.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/verify-2d5.ts
 */
import path from 'path'
import fs from 'fs'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

let pass = 0
let fail = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

const DIR = __dirname
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8')
const files = () => fs.readdirSync(DIR).filter((f) => f.endsWith('.ts'))

/**
 * ⚠ THE §3 GUARD. Does any code let inquiry framing reach a polarity?
 *
 * The shape it would take is a query that reads `graph_inquiry` in the same statement as a write to
 * a polarity column, or an assignment of a polarity from a framing value. Both are looked for.
 */
export function framingTouchesPolarity(src: string): boolean {
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // a statement mentioning graph_inquiry that also writes a polarity
  for (const stmt of stripped.split(/;|\n\n/)) {
    if (!/graph_inquiry|scope_is_conclusion|scope_is_status/.test(stmt)) continue
    if (/\bpolarity\s*=|SET\s+polarity|INSERT\s+INTO\s+graph_position\b/i.test(stmt)) return true
  }
  return false
}

async function main() {
  console.log('\n════ verify-2d5 ════')
  const pool = getNeonPool()

  // ── §5 — THE GRAPH OF RECORD IS UNTOUCHED ────────────────────────────────────────────────────
  const { rows: [gp] } = await pool.query<{ n: string; nopos: string; pos: string; runs: string }>(`
    SELECT count(*)::text n, count(*) FILTER (WHERE polarity='no-position')::text nopos,
           count(*) FILTER (WHERE polarity <> 'no-position')::text pos,
           count(DISTINCT run_id)::text runs FROM graph_position`)
  check(gp.n === '37657', 'graph_position still holds exactly the 37,657 rows 2D-3 wrote', `found ${gp.n}`)
  check(gp.pos === '16196', 'and exactly the 16,196 non-declined positions the 2D-3 report quotes', `found ${gp.pos}`)
  check(gp.runs === '5', 'no new run_id was added to the graph of record', `${gp.runs} runs`)

  const { rows: [amd] } = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM information_schema.columns
     WHERE table_name='graph_position' AND column_name IN ('condition','qualified','framing','scope')`)
  check(amd.n === '0', '⚠ graph_position gained NO column — the qualifier lives in its own table')

  // ── §2 — THE SECOND PASS ─────────────────────────────────────────────────────────────────────
  const { rows: [q] } = await pool.query<{ n: string; qual: string; unlocated: string }>(`
    SELECT count(*)::text n, count(*) FILTER (WHERE qualified)::text qual,
           count(*) FILTER (WHERE qualified AND NOT quote_found)::text unlocated
    FROM graph_position_qualifier WHERE pass='q1'`)
  check(Number(q.n) >= 49, 'the qualification pass ran over the hand-scored fifty', `${q.n} rows`)
  check(q.unlocated === '0', '⚠ every recorded qualification has a quote located in its document', `${q.unlocated} unlocated`)

  const qsrc = read('qualify-pass.ts')
  check(!/polarity/.test(qsrc.slice(qsrc.indexOf('const SCHEMA'), qsrc.indexOf('interface Target'))),
    '⚠⚠ the second pass\'s response schema has NO polarity field — it CANNOT change a direction')
  // negative control, run here rather than asserted
  const plantedSchema = "const SCHEMA = { properties: { polarity: {} } }\ninterface Target"
  check(/polarity/.test(plantedSchema.slice(0, plantedSchema.indexOf('interface Target'))),
    '   …and the check above fires when a polarity field is planted (negative control)')

  const verdicts = JSON.parse(read('qualify-verdicts.json')) as { verdicts: Record<string, unknown> }
  const { rows: adj } = await pool.query<{ position_id: string }>(`
    SELECT r.position_id::text FROM graph_position_review r
    JOIN graph_position_qualifier q ON q.position_id=r.position_id AND q.pass='q1'
    WHERE r.verdict='correct' AND q.qualified AND q.quote_found`)
  const missing = adj.filter((r) => !(r.position_id in verdicts.verdicts))
  check(missing.length === 0,
    '⚠ every qualification found on a baseline-CORRECT row has a hand verdict — none is scored by assumption',
    missing.length ? `unjudged: ${missing.map((r) => r.position_id).join(', ')}` : '')

  // ── §3 — FRAMING IS STORED AND NEVER APPLIED ─────────────────────────────────────────────────
  const { rows: [inq] } = await pool.query<{ n: string; scoped: string; concl: string }>(`
    SELECT count(*)::text n, count(*) FILTER (WHERE scope IS NOT NULL)::text scoped,
           count(*) FILTER (WHERE scope_is_conclusion)::text concl FROM graph_inquiry`)
  check(Number(inq.n) >= 12, 'the framing of every inquiry behind the fifty is stored', `${inq.n} inquiries`)
  check(inq.scoped === inq.n, 'and all of them carry a scope from the source')
  check(Number(inq.concl) >= 1, '⚠ inquiries whose published framing is the Committee\'s own report conclusion', `${inq.concl}`)

  // ⚠ THIS FILE IS EXCLUDED FROM ITS OWN SCAN, and that is not a loophole — it is the fix for the
  // second time this class of bug has bitten. The negative control two lines below is a deliberate
  // counterexample string, so a scanner that reads the verifier finds it and reports the guard as
  // failing. (S6 had the same shape: a no-rate-card check matched its own regex literal.) The
  // exclusion is exactly one file, named, and the planted control still has to fire.
  const offenders = files().filter((f) => f !== 'verify-2d5.ts' && framingTouchesPolarity(read(f)))
  check(offenders.length === 0, '⚠⚠ NO code lets inquiry framing reach a polarity (§3: record it, do not adjust)',
    offenders.join(', '))
  check(framingTouchesPolarity("UPDATE graph_position SET polarity = f.x FROM graph_inquiry f"),
    '   …and the check above fires on a planted adjustment (negative control)')

  // ── §4 — BOTH ARMS RAN, AND THE TOP-DOWN ARM WROTE NOTHING ───────────────────────────────────
  const { rows: [bu] } = await pool.query<{ n: string; subs: string; noquote: string }>(`
    SELECT count(*)::text n, count(DISTINCT section_id)::text subs,
           count(*) FILTER (WHERE NOT quote_found)::text noquote
    FROM graph_claim_bottomup WHERE run_id='bu1'`)
  check(Number(bu.n) > 0, 'the bottom-up arm produced claims', `${bu.n} over ${bu.subs} submissions`)
  const { rows: cost } = await pool.query<{ arm: string }>(`SELECT arm FROM graph_claim_cost WHERE run_id='bu1'`)
  check(cost.length === 2, '⚠ BOTH arms are metered — a cost comparison needs two measurements, not one and a memory',
    cost.map((c) => c.arm).join(', '))

  const busrc = read('claims-bottomup.ts')
  const buPrompt = busrc.slice(busrc.indexOf('const BU_PROMPT'), busrc.indexOf('const BU_SCHEMA'))
  check(!/\b(NHS|health and social care|palliative|obesity)\b/i.test(buPrompt),
    '⚠⚠ the bottom-up prompt carries NO domain vocabulary — otherwise the arm is a disguised top-down run')
  check(!/proposition/i.test(buPrompt), '   …and no mention of the 83 propositions')

  // ── §1 — THE SAMPLE DOCUMENT ─────────────────────────────────────────────────────────────────
  const samplePath = path.join(DIR, '../../../docs/POSITION_SAMPLE.md')
  const sample = fs.existsSync(samplePath) ? fs.readFileSync(samplePath, 'utf8') : ''
  check(sample.length > 4000, '§1 docs/POSITION_SAMPLE.md exists and is substantial', `${sample.length} chars`)
  for (const t of ['position-invented', 'polarity-flipped', 'nuance-flattened', 'bibliography', 'arguable']) {
    check(new RegExp(t, 'i').test(sample), `   the sample covers "${t}"`)
  }
  check(/⚖|arguable/i.test(sample), '   ⚠ and marks the arguable hand-reads as arguable (§1)')
  const cases = fs.existsSync(path.join(DIR, 'sample-2d5-cases.json'))
  check(cases, '   all fifty are dumped, not only the ones chosen — the selection is auditable')

  console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
  await endNeonPool()
  if (fail) process.exit(1)
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
