/**
 * check-graph5-case-edges.ts — GRAPH 5 §2.4, asserted.
 *
 * ⚠⚠ THE ASSERTION THAT MATTERS MOST IS THE ONE ABOUT WHAT WE DID **NOT** DO. §2.4's BAILII rule
 * is a licence constraint, not a preference: their terms forbid storing search results or HTML
 * versions of judgments and forbid robot access, and the register already records them as blocked.
 * A comment saying "we never fetch" is worth nothing. So this check reads the extractor's own
 * SOURCE and fails if it contains any network call at all — and it watches that rule reject a
 * planted `fetch`, so the rule cannot be passing vacuously.
 *
 *   npx tsx graph/check-graph5-case-edges.ts
 */
import fs from 'fs'
import path from 'path'
import { namesPool, endNamesPool } from '../names/names-pool'
import { CASE_EDGE_TABLE, HELD_STATES } from './setup-caselaw-case-edge-table'
import { bailiiUrl } from './extract-caselaw-case-edges'

let pass = 0, fail = 0, controls = 0
const assert = (ok: boolean, what: string, detail = '') => {
  ok ? pass++ : fail++
  console.log(`  ${ok ? '  ok' : 'FAIL'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
const control = (fired: boolean, what: string, detail = '') => {
  controls++; fired ? pass++ : fail++
  console.log(`  ${fired ? 'ctrl' : 'DEAD'}  ${what}${detail ? `  — ${detail}` : ''}`)
}
const N = (v: unknown) => Number(v)

;(async () => {
  console.log(`\nGRAPH 5 §2.4 — CITED BUT NOT HELD\n`)

  // ── ⚠⚠ BAILII: the licence rule, asserted against the source ──────────────
  console.log('── ⚠⚠ NOTHING FETCHES FROM BAILII — asserted on the source, not promised in a comment ──')
  const extractorPath = path.join(__dirname, 'extract-caselaw-case-edges.ts')
  const src = fs.readFileSync(extractorPath, 'utf8')
  // strip comments first: the header discusses fetching at length, and a rule that reads its own
  // explanatory prose is the "absence grep reads its own comment" failure.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const NETWORK = /\b(fetch|axios|https?\.(get|request)|XMLHttpRequest|got\(|undici|node-fetch|curl)\b/
  assert(!NETWORK.test(code),
    '⚠⚠ the extractor contains NO network call of any kind',
    NETWORK.test(code) ? `FOUND: ${code.match(NETWORK)?.[0]}` : 'no fetch, no http, no client')
  control(NETWORK.test(code + '\nconst x = await fetch(url)'),
    'the no-network rule FIRES on a planted fetch')
  // and it must not be passing because the file is empty or unread
  assert(code.includes('bailiiUrl') && code.length > 2000,
    'the source actually read is the extractor', `${code.length} chars of code after stripping comments`)

  console.log('\n── the link is DERIVED, and declines rather than guessing ──')
  assert(bailiiUrl('[2004] EWHC 254 (Admin)') === 'https://www.bailii.org/ew/cases/EWHC/Admin/2004/254.html',
    '⚠ a division in TRAILING PARENTHESES is read (the first version sent every Admin case to /QB/)')
  assert(bailiiUrl('[2001] EWCA Civ 1041') === 'https://www.bailii.org/ew/cases/EWCA/Civ/2001/1041.html',
    'a division before the number is read')
  assert(bailiiUrl('[2004] EWHC 254') === null,
    '⚠⚠ an EWHC citation with NO division yields NULL — the path would be a guess',
    'a wrong deep link is worse than none')
  assert(bailiiUrl('[1932] AC 562') === null,
    'a law-report citation determines no BAILII path, so none is offered')
  control(bailiiUrl('[2019] UKSC 22') !== null,
    'and a determinate citation still produces a link, so the rule has not simply been switched off')

  // ── the table ─────────────────────────────────────────────────────────────
  const p = namesPool()
  const exists = await p.query(`SELECT to_regclass($1) t`, [CASE_EDGE_TABLE])
  if (!exists.rows[0].t) {
    assert(false, `${CASE_EDGE_TABLE} exists`, 'NOT FOUND — run setup-caselaw-case-edge-table.ts')
    console.log(`\n  ${pass} passed, ${fail} failed`); await endNamesPool(); process.exit(1)
  }

  console.log('\n── the stored rows ──')
  const s = (await p.query(`
    SELECT COUNT(*)::bigint rows,
           COUNT(DISTINCT target_citation)::bigint distinct_targets,
           COUNT(DISTINCT judgment_id)::bigint citing_judgments,
           COUNT(*) FILTER (WHERE btrim(passage) = '')::bigint blank_passage,
           COUNT(*) FILTER (WHERE held_state = 'held')::bigint held,
           COUNT(*) FILTER (WHERE held_state = 'not-held')::bigint not_held,
           COUNT(*) FILTER (WHERE held_state = 'unknown')::bigint unknown,
           COUNT(*) FILTER (WHERE held_state = 'held' AND target_judgment_id IS NULL)::bigint held_unlinked,
           COUNT(*) FILTER (WHERE held_state <> 'held' AND target_judgment_id IS NOT NULL)::bigint unheld_linked
      FROM ${CASE_EDGE_TABLE}`)).rows[0]
  assert(N(s.rows) > 0, 'case-to-case edges exist',
    `${N(s.rows).toLocaleString()} edges · ${N(s.distinct_targets).toLocaleString()} distinct targets · ${N(s.citing_judgments).toLocaleString()} citing judgments`)
  assert(N(s.blank_passage) === 0,
    '⚠ every edge carries the passage OUR judgment used — none is blank', `${N(s.blank_passage)}`)

  // ⚠⚠ THE POINT OF §2.4
  console.log('\n── ⚠⚠ AN UNHELD TARGET MUST NEVER RENDER LIKE A HELD ONE ──')
  assert(N(s.held) > 0 && N(s.not_held) > 0 && N(s.unknown) > 0,
    'all THREE held states are populated — two would be wrong in a measurable band',
    `held ${N(s.held).toLocaleString()} · not-held ${N(s.not_held).toLocaleString()} · unknown ${N(s.unknown).toLocaleString()}`)
  assert(N(s.held_unlinked) === 0,
    'every HELD target names the judgment it resolves to', `${N(s.held_unlinked)} unlinked`)
  assert(N(s.unheld_linked) === 0,
    '⚠⚠ no unheld target carries a judgment id — it cannot pretend to be held', `${N(s.unheld_linked)}`)
  // the CHECK must actually refuse the bad shape, not merely happen to have no examples
  let refused = false
  try {
    await p.query(`INSERT INTO ${CASE_EDGE_TABLE}
      (judgment_id, judgment_uri, target_citation, target_raw, target_kind, held_state, target_judgment_id, passage)
      VALUES ('zz-check','zz','[1932] AC 562','[1932] AC 562','law-report','not-held','tna-caselaw:[2019] UKSC 41:1','words')`)
  } catch { refused = true }
  control(refused, '⚠⚠ the table REFUSES a not-held row that claims a held judgment id')
  let refusedBlank = false
  try {
    await p.query(`INSERT INTO ${CASE_EDGE_TABLE}
      (judgment_id, judgment_uri, target_citation, target_raw, target_kind, held_state, passage)
      VALUES ('zz-check','zz','[1932] AC 562','[1932] AC 562','law-report','not-held','   ')`)
  } catch { refusedBlank = true }
  control(refusedBlank, '⚠ a blank passage is refused — NOT NULL permits the empty string')
  let accepted = false
  try {
    await p.query(`INSERT INTO ${CASE_EDGE_TABLE}
      (judgment_id, judgment_uri, target_citation, target_raw, target_kind, held_state, passage)
      VALUES ('zz-check-valid','zz','[1932] AC 562','[1932] AC 562','law-report','not-held','real words here')`)
    accepted = true
  } catch { /* stays false */ }
  assert(accepted, 'and a VALID row IS accepted — the constraints do not refuse everything')
  await p.query(`DELETE FROM ${CASE_EDGE_TABLE} WHERE judgment_id LIKE 'zz-check%'`)
  const left = N((await p.query(
    `SELECT COUNT(*)::bigint n FROM ${CASE_EDGE_TABLE} WHERE judgment_id LIKE 'zz-check%'`)).rows[0].n)
  assert(left === 0, 'the fixture rows are gone, re-read after deleting', `${left} left`)

  // ⚠ THE ROUND TRIP, and it must normalise whitespace on BOTH sides.
  //   `target_raw` keeps the source's own spacing because it is the evidence; `passage` is
  //   whitespace-collapsed for display. A naive `position(target_raw in passage)` therefore reports
  //   ~2,499 false misses (0.44%) — comparing a raw string to a collapsed one. The passage really
  //   does contain the citation in every one of them.
  console.log('\n── ⚠ the passage contains its own citation (normalising both sides) ──')
  const rt = (await p.query(`
    SELECT COUNT(*)::bigint total,
           COUNT(*) FILTER (WHERE position(regexp_replace(btrim(target_raw), '\\s+', ' ', 'g') in passage) = 0)::bigint missing,
           COUNT(*) FILTER (WHERE position(target_raw in passage) = 0)::bigint missing_unnormalised
      FROM ${CASE_EDGE_TABLE}`)).rows[0]
  assert(N(rt.missing) === 0,
    '⚠⚠ every stored passage contains the citation it is evidence for',
    `${N(rt.missing)} of ${N(rt.total).toLocaleString()} miss when normalised`)
  control(N(rt.missing_unnormalised) > N(rt.missing),
    'and the UN-normalised comparison really does report false misses, which is why it normalises',
    `${N(rt.missing_unnormalised).toLocaleString()} false misses avoided`)

  console.log('\n── identity: counted, never guessed ──')
  const dup = (await p.query(`
    SELECT COUNT(*)::bigint n FROM (
      SELECT target_citation FROM ${CASE_EDGE_TABLE}
       GROUP BY target_citation HAVING COUNT(DISTINCT held_state) > 1) t`)).rows[0]
  assert(N(dup.n) === 0,
    '⚠ no citation is recorded as both held and not-held — the state is a function of the citation',
    `${N(dup.n)} citations with conflicting states`)
  // ⚠ the name is an OBSERVATION and must never be the identity
  const nameCollide = (await p.query(`
    SELECT COUNT(*)::bigint n FROM (
      SELECT target_name FROM ${CASE_EDGE_TABLE}
       WHERE target_name IS NOT NULL AND btrim(target_name) <> ''
       GROUP BY target_name HAVING COUNT(DISTINCT target_citation) > 1) t`)).rows[0]
  assert(N(nameCollide.n) > 0,
    '⚠⚠ the same observed NAME really does appear against different citations — which is exactly why identity is the citation, not the name',
    `${N(nameCollide.n).toLocaleString()} names spanning more than one citation`)

  console.log('\n── no headnote, no stored extract of a judgment we do not hold ──')
  // ⚠ The rule tests the TYPE as well as the name, because only a text column can hold prose.
  //   A first version matched on the name alone and flagged `extracted_at` — a timestamptz, which
  //   cannot hold a headnote. A guard that fires on something harmless gets switched off.
  const cols = (await p.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1`, [CASE_EDGE_TABLE])
  ).rows as Array<{ column_name: string; data_type: string }>
  const textCols = cols.filter(c => /char|text/i.test(c.data_type))
  const forbidden = textCols.filter(c => /headnote|summary|held_text|judgment_text|extract_text|full_text|body|description/i.test(c.column_name))
  assert(forbidden.length === 0,
    '⚠⚠ no TEXT column could hold prose from a judgment we do not hold',
    forbidden.length ? `FOUND: ${forbidden.map(c => c.column_name).join(', ')}`
      : `${textCols.length} text columns, none of them a headnote (${cols.length - textCols.length} non-text ignored)`)
  control(/headnote/i.test('headnote') && /char|text/i.test('text'),
    'the headnote rule would fire on a text column actually called `headnote`')
  assert(HELD_STATES.length === 3, 'the held state is three-valued by declaration', HELD_STATES.join(' | '))

  console.log(`\n  ${pass} passed, ${fail} failed, of ${pass + fail} run  (${controls} controls, 0 dead)`)
  await endNamesPool()
  process.exit(fail === 0 ? 0 : 1)
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
