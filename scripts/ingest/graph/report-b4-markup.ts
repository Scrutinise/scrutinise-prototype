/**
 * report-b4-markup.ts — CC BRIEF B4. A markup-only verification sample.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * WHY: THE STRONGEST EVIDENCE TYPE WAS THE LEAST TESTED
 * ════════════════════════════════════════════════════════════════════════════
 * T5 returned 20 of 20 — and drew ZERO `markup` rows, because it was stratified
 * by measure and markup is 2–5% of the table. So the report's headline rate
 * measures the `text` detector, while every quoted example in §4 rests on the
 * `markup` one: the source document asserting the target BY URI. This run
 * produces the markup rate and nothing else.
 *
 * ⚠⚠ THE TWO RATES ARE NEVER AVERAGED. Two rates with two denominators is the
 * honest presentation. One blended figure would describe neither detector and
 * would be read as describing both.
 *
 * ⚠⚠ THE VERIFIER IS IMPORTED FROM `report-t5-verify.ts`, NOT RESTATED. A check
 * that re-implements the logic it is checking tests the copy — the defect that
 * made a 25-H "control" reject a claim the real code accepted because a heredoc
 * had eaten its regex escapes. `judge`, `verifyRow`, `reexamine` and
 * `runControls` all come from there, so if the markup rate and the text rate
 * ever disagree it is about the rows and cannot be about the checker.
 *
 * ⚠ Draw is proportional to each measure's markup population (CRAG 11, HRA 37,
 * EqA 79 — 127 in all), by md5, with a fixed seed so the same 25 rows come back.
 *
 *   npx tsx graph/report-b4-markup.ts
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { MEASURES, writeText, writeJson, closeZip } from './report-common'
import { Row, Verdict, verifyRow, reexamine, runControls } from './report-t5-verify'

const SAMPLE_SIZE = 25
/** ⚠ A floor, as in T5: under this many actually checked and no rate is quoted. */
const MIN_CHECKED = 18
const SEED = 'report-run-b4-markup-2026-08-30'

/** Recorded before the draw, per brief §4. */
const PREDICTION = {
  pass_rate_expected: '22 of 25 (88%)',
  expected_checker_failures: 1,
  expected_below_the_t5_text_rate: true,
  reasoning:
    'T5\'s supplementary three-per-detector draw gave markup 2 of 3, and its single failure was a ' +
    'misattributed source_provision_ref rather than a wrong target. T2 then measured that class at ' +
    '19.1% of rows naming a provision, so the markup rate should sit below T5\'s 20/20 text rate.',
}

async function main() {
  const pool = getNeonPool()
  const byGid = new Map(MEASURES.map(m => [m.gid, m]))

  // ── the markup population, measured before the draw ──────────────────────
  const { rows: pop } = await pool.query(
    `SELECT target_act_id, COUNT(*)::int n FROM ${CITATION_TABLE}
     WHERE target_act_id = ANY($1::text[]) AND detection = 'markup'
     GROUP BY 1`, [MEASURES.map(m => m.gid)])
  const population = Object.fromEntries(pop.map((r: any) => [r.target_act_id, r.n]))
  const total = pop.reduce((n: number, r: any) => n + r.n, 0)
  console.log('── B4 · markup-only verification ──')
  console.log(`  markup population: ${pop.map((r: any) => `${byGid.get(r.target_act_id)!.ws_id} ${r.n}`).join(', ')} — ${total} in all`)
  console.log(`  prediction (logged before the draw): ${PREDICTION.pass_rate_expected}, of which ${PREDICTION.expected_checker_failures} expected to be the checker's`)

  // ── proportional draw, by md5 ────────────────────────────────────────────
  const quota: Record<string, number> = {}
  let assigned = 0
  for (const r of pop) {
    quota[r.target_act_id] = Math.max(1, Math.round(SAMPLE_SIZE * r.n / total))
    assigned += quota[r.target_act_id]
  }
  // trim/pad on the largest population so the draw is exactly SAMPLE_SIZE
  const biggest = pop.slice().sort((a: any, b: any) => b.n - a.n)[0].target_act_id
  quota[biggest] += SAMPLE_SIZE - assigned
  console.log(`  proportional quota: ${Object.entries(quota).map(([g, n]) => `${byGid.get(g)!.ws_id} ${n}`).join(', ')}`)

  const draw: Row[] = []
  for (const [gid, n] of Object.entries(quota)) {
    const m = byGid.get(gid)!
    const { rows } = await pool.query(
      `SELECT id::text, target_act_id, target_provision_ref, detection, source_gid,
              source_provision_ref, source_type, citation_text
       FROM ${CITATION_TABLE}
       WHERE target_act_id = $1 AND detection = 'markup'
       ORDER BY md5(id::text || $2) LIMIT $3`, [gid, SEED, n])
    for (const r of rows) draw.push({ ...r, ws_id: m.ws_id, target_title: m.title } as Row)
  }
  console.log(`  drawn: ${draw.length} markup rows from a population of ${total}`)
  if (draw.some(r => r.detection !== 'markup')) throw new Error('a non-markup row reached the draw — the sample is not what it says it is')

  // ── PASS 0 — the verifier, made to pass once and fail twice ──────────────
  console.log('\n══ PASS 0 — CONTROLS (the same runControls T5 used, on THIS draw) ══')
  const controls = runControls(draw)
  for (const l of controls.lines) console.log(l)
  if (!controls.ok) {
    console.error('\n⚠⚠ THE CONTROLS DID NOT BEHAVE. No rate is reported.')
    writeText('verification_markup.md', `# Markup verification — NOT RUN\n\nThe verifier's own controls failed, so no rate is reported.\n\n${controls.lines.join('\n')}\n`)
    closeZip(); await endNeonPool(); process.exit(1)
  }
  console.log('  controls behave — the verifier can pass and can fail. Proceeding.')

  // ── PASS 1 ───────────────────────────────────────────────────────────────
  console.log(`\n══ PASS 1 — ${draw.length} markup rows against legislation.gov.uk ══`)
  const first: Verdict[] = []
  for (const r of draw) {
    const v = await verifyRow(r)
    first.push(v)
    console.log(`  ${v.status.toUpperCase().padEnd(11)} ${r.ws_id} ${r.source_gid}:${r.source_provision_ref ?? '(preamble)'} → ${r.target_provision_ref ?? '(act-level)'}  — ${v.reason}`)
  }

  // ── PASS 2 — re-examine every non-pass before recording it ───────────────
  const needsWork = first.filter(v => v.status !== 'correct')
  console.log(`\n══ PASS 2 — re-examining ${needsWork.length} non-pass row(s) against our copy AND the whole live document ══`)
  const final: Verdict[] = []
  for (const v of first) {
    if (v.status === 'correct') { final.push(v); continue }
    const re = await reexamine(v)
    console.log(`  ${v.status} → ${re.status.toUpperCase()}  ${v.row.source_gid}:${v.row.source_provision_ref ?? '(preamble)'}`)
    console.log(`      ${re.reexamined!.conclusion}`)
    final.push(re)
  }

  // ── the rate ─────────────────────────────────────────────────────────────
  const correct = final.filter(v => v.status === 'correct').length
  const wrong = final.filter(v => v.status === 'wrong').length
  const notChecked = final.filter(v => v.status === 'not-checked').length
  const checked = correct + wrong
  const established = checked >= MIN_CHECKED
  const checkerFailures = final.filter(v => v.reexamined?.conclusion.startsWith('VERIFIER FAILURE')).length
  const misattributed = final.filter(v => v.reexamined?.conclusion.startsWith('MISATTRIBUTED')).length

  console.log('\n══ RESULT — THE MARKUP RATE ══')
  console.log(`  ${correct} correct, ${wrong} wrong, ${notChecked} not checked, of ${final.length} markup rows drawn from a population of ${total}`)
  console.log(`  rate: ${checked ? `${correct} of ${checked} actually checked (${(100 * correct / checked).toFixed(1)}%)` : 'n/a'}`)
  if (!established) console.log(`  ⚠⚠ FEWER THAN ${MIN_CHECKED} CHECKED — the rate is NOT established and must not be quoted.`)
  console.log(`  first-pass non-passes: ${checkerFailures} were the CHECKER's, ${misattributed} were a misattributed source provision, ${wrong} survived as data failures`)
  console.log(`  ⚠ this is NOT averaged with T5's text-detector rate of 20/20. Two rates, two denominators.`)

  const common: Record<string, number> = {}
  for (const v of final.filter(x => x.status === 'wrong')) {
    const k = v.reexamined?.conclusion ?? v.reason
    common[k] = (common[k] ?? 0) + 1
  }
  if (Object.keys(common).length) {
    console.log('  what the failures have in common:')
    for (const [k, n] of Object.entries(common).sort((a, b) => b[1] - a[1])) console.log(`     ${n} × ${k.slice(0, 150)}`)
  } else {
    console.log('  what the failures have in common: nothing survived re-examination as a data failure.')
  }

  console.log('\n══ B4 PREDICTION SCORED ══')
  console.log(`  predicted ${PREDICTION.pass_rate_expected}; actual ${correct} of ${checked}`)
  console.log(`  predicted ${PREDICTION.expected_checker_failures} checker failure(s); actual ${checkerFailures}`)
  const belowText = checked > 0 && (correct / checked) < 1.0
  console.log(`  predicted the markup rate would sit BELOW T5's text rate of 20/20 (100%): actual ${checked ? (100 * correct / checked).toFixed(1) : '—'}% — ${belowText ? 'HOLDS' : 'WRONG'}`)

  // ── write ────────────────────────────────────────────────────────────────
  const md: string[] = []
  md.push('# Markup-only verification sample')
  md.push('')
  md.push(`*Generated ${new Date().toISOString()}. Corpus track, brief B4.*`)
  md.push('')
  md.push('## The rate')
  md.push('')
  md.push(`**${correct} of ${checked}** markup rows verified correct — drawn from a population of **${total} markup rows** across the three measures (${pop.map((r: any) => `${byGid.get(r.target_act_id)!.ws_id} ${r.n}`).join(', ')}).`)
  md.push('')
  md.push(established
    ? `${notChecked} row(s) could not be fetched and are NOT CHECKED — counted neither correct nor wrong.`
    : `⚠⚠ Only ${checked} of ${final.length} rows could be checked, below the floor of ${MIN_CHECKED}. **No rate is established.**`)
  md.push('')
  md.push('### ⚠ This rate is not the T5 rate and the two are never averaged')
  md.push('')
  md.push('| sample | detector | rate | denominator |')
  md.push('|---|---|---|---|')
  md.push(`| T5 (brief §6) | \`text\` (19 of 20 rows) | 20 of 20 | 20 rows stratified by measure, from 3,237 |`)
  md.push(`| B4 (this) | \`markup\` only | ${correct} of ${checked} | ${final.length} rows drawn from a markup population of ${total} |`)
  md.push('')
  md.push('Two rates with two denominators is the honest presentation. A single blended figure would describe neither detector and would be read as describing both.')
  md.push('')
  md.push('## The verifier was made to fail before anything was scored')
  md.push('')
  md.push('A verification pass that cannot fail is worth nothing, and this is the one number the Method section prints. The controls below run through `runControls()` and `judge()` — **the same functions the sample runs through**, imported from `report-t5-verify.ts` rather than restated, so a disagreement between the two rates can only be about the rows.')
  md.push('')
  for (const l of controls.lines) md.push(`- ${l.trim()}`)
  md.push('')
  md.push('## Every failure was re-examined before being recorded')
  md.push('')
  md.push(`Each non-pass was put against our own local CLML copy **and** the whole live document. Of ${needsWork.length} first-pass non-passes: **${checkerFailures} were the checker's**, **${misattributed} were a misattributed source provision** (the reference real and in the document, but not in the provision the row names), and **${wrong} survived** as data failures.`)
  md.push('')
  md.push('## Every row')
  md.push('')
  md.push('| # | measure | source document | provision | target | verdict | what the live document said |')
  md.push('|---|---|---|---|---|---|---|')
  final.forEach((v, i) => {
    const why = (v.reexamined?.conclusion ?? v.reason).replace(/\|/g, '\\|')
    md.push(`| ${i + 1} | ${v.row.ws_id} | \`${v.row.source_gid}\` | \`${v.row.source_provision_ref ?? '(preamble)'}\` | ${v.row.target_provision_ref ?? '(act-level)'} | **${v.status}** | ${why} |`)
  })
  md.push('')
  md.push('## What the failures have in common')
  md.push('')
  if (Object.keys(common).length === 0) md.push('Nothing survived re-examination as a data failure, so there is nothing they have in common. Stated rather than left as an empty section.')
  else for (const [k, n] of Object.entries(common).sort((a, b) => b[1] - a[1])) md.push(`- **${n} ×** ${k}`)
  md.push('')
  md.push('## The prediction, logged before the draw')
  md.push('')
  md.push(`Predicted **${PREDICTION.pass_rate_expected}**, of which **${PREDICTION.expected_checker_failures}** expected to be the checker's, and the markup rate expected to sit **below** T5's text rate.`)
  md.push('')
  md.push(`Actual: **${correct} of ${checked}**, **${checkerFailures}** the checker's, and the rate ${belowText ? 'did' : 'did not'} sit below T5's.`)
  md.push('')

  writeText('verification_markup.md', md.join('\n'))
  writeJson('verification_markup.json', {
    generated_at: new Date().toISOString(),
    brief: 'B4 — a markup-only verification sample',
    detector: 'markup',
    seed: SEED, sample_size: SAMPLE_SIZE, min_checked_floor: MIN_CHECKED,
    markup_population: population, markup_population_total: total,
    proportional_quota: quota,
    correct, wrong, not_checked: notChecked, checked, rate_established: established,
    rate: checked ? correct / checked : null,
    rate_denominator_note: `${checked} markup rows actually checked, drawn from a population of ${total} markup rows across the three measures.`,
    never_averaged_with: {
      t5_text_rate: '20 of 20',
      why: 'Two detectors, two denominators. A blended figure would describe neither and would be read as describing both.',
    },
    verifier: {
      imported_from: 'report-t5-verify.ts — judge, verifyRow, reexamine, runControls',
      why: 'A check that re-implements the logic it is checking tests the copy. Importing means a disagreement between the markup and text rates can only be about the rows.',
      controls: controls.lines,
      controls_behaved: controls.ok,
    },
    first_pass_non_passes: needsWork.length,
    checker_failures: checkerFailures,
    misattributed_source_provision: misattributed,
    prediction: { ...PREDICTION, recorded_before_draw: true },
    verdicts: final,
  })
  console.log('\n  wrote docs/report_run/verification_markup.md and .json')
  closeZip()
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[b4] FATAL', e); process.exit(1) })
}
