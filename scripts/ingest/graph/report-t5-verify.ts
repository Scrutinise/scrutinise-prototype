/**
 * report-t5-verify.ts — T5 of `docs/CC_BRIEF_report_corpus.md`: a 20-row random
 * sample across the three measures, verified live against legislation.gov.uk.
 *
 * ⚠⚠ THE BRIEF'S RULE, AND IT SHAPES THE WHOLE FILE:
 *   "If the verification finds failures, verify the verifier before reporting
 *    them. In sprint 25-H the first pass reported 18/20 and both failures were
 *    the checker's. A false finding in this report is worse than a missing one."
 *
 * So this runs in three passes and publishes nothing from pass 1 alone:
 *
 *   PASS 0 — CONTROLS, BEFORE ANY ROW IS SCORED. A verifier that cannot fail
 *            measures nothing. Two planted rows go through the SAME function as
 *            the sample: one that must pass, one corrupted so it must fail. If
 *            the control does not behave, the run stops and reports nothing.
 *   PASS 1 — the 20 rows, live.
 *   PASS 2 — EVERY FAILURE IS RE-EXAMINED against the local CLML copy and the
 *            whole live document, and is reported as a data failure ONLY when
 *            both agree the row is wrong. Anything else is recorded as a
 *            VERIFIER failure or as NOT CHECKED, by name.
 *
 * ⚠ A ROW THAT COULD NOT BE FETCHED IS "NOT CHECKED", NOT "WRONG" AND NOT
 * "RIGHT". legislation.gov.uk rate-limits sequential fetches — fine one at a
 * time, 500s and 504s back to back — and counting a 504 as a failure would
 * publish a defect in our data that is really a defect in our manners. The
 * denominator is stated with the numerator every time, and there is a floor:
 * if fewer than 15 of the 20 were actually checked, the run says the rate is
 * not established rather than quoting a rate over 6 rows.
 *
 * ⚠ THE SAMPLE IS DRAWN BY md5, NOT BY id. `citation_edge.id` is a bigserial in
 * insertion order, which is document order, which is not random: an ORDER BY id
 * sample of tna-caselaw once came back entirely from 2003 and reported 76.1%
 * where the corpus says 26.9%.
 *
 * ⚠ THE PROVISION PREDICATE IS IMPORTED FROM `pilot-25h-crag.ts`, NOT RESTATED.
 * A control that re-implements the logic it checks tests the copy.
 *
 *   npx tsx graph/report-t5-verify.ts
 */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { provisionNamedWithAct } from './pilot-25h-crag'
import {
  MEASURES, Measure, readDocWithVersion, provisionSlice, preambleSlice, flattenClml,
  actNameRegex, countsByDetection, writeText, writeJson, closeZip,
} from './report-common'

const SAMPLE_SIZE = 20
const MIN_CHECKED = 15
/** Deterministic: the same 20 rows come back on a re-run. A "random sample"
 *  that cannot be reproduced is not evidence. */
const SEED = 'report-run-2026-08-29'
const UA = 'scrutinise-report-run/2026-08 (statutory citation verification)'
/** One request at a time, spaced. Sequential hammering returns 500s and 504s. */
const GAP_MS = 1800

/**
 * ⚠ EXPORTED so CC BRIEF B4's markup-only sample runs through THIS verifier and
 * not a re-implementation of it. A control that restates the logic it checks
 * tests the copy — the defect that made a 25-H "control" reject a claim the real
 * code accepted, purely because a heredoc had eaten its regex escapes.
 */
export type Row = {
  id: string
  ws_id: string
  target_act_id: string
  target_title: string
  target_provision_ref: string | null
  detection: string
  source_gid: string
  source_provision_ref: string | null
  source_type: string
  citation_text: string
}

export type Verdict = {
  row: Row
  url: string
  status: 'correct' | 'wrong' | 'not-checked'
  reason: string
  http: number | null
  /** set in pass 2 */
  reexamined?: { localSaysPresent: boolean | null; wholeDocSaysPresent: boolean | null; conclusion: string }
}

// ── fetching ────────────────────────────────────────────────────────────────

export function provisionPath(ref: string | null): string | null {
  if (!ref) return null
  if (!/^(section|schedule|paragraph|article|regulation|rule|part|chapter)-/i.test(ref)) return null
  return ref.replace(/-/g, '/')
}

let lastFetch = 0
export async function politeFetch(url: string): Promise<{ ok: boolean; status: number | null; body: string | null; err: string | null }> {
  const wait = GAP_MS - (Date.now() - lastFetch)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  for (let attempt = 0; attempt < 3; attempt++) {
    lastFetch = Date.now()
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
      if (res.status >= 500 || res.status === 429) {
        // ⚠ a 5xx is OUR rate, not their data. Back off and try again; if it
        // never comes back the row is NOT CHECKED, never "wrong".
        if (attempt < 2) { await new Promise(r => setTimeout(r, 4000 * (attempt + 1))); continue }
        return { ok: false, status: res.status, body: null, err: `HTTP ${res.status} after 3 attempts` }
      }
      if (!res.ok) return { ok: false, status: res.status, body: null, err: `HTTP ${res.status}` }
      return { ok: true, status: res.status, body: await res.text(), err: null }
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 4000 * (attempt + 1))); continue }
      return { ok: false, status: null, body: null, err: `fetch failed: ${(e as Error).message}` }
    }
  }
  return { ok: false, status: null, body: null, err: 'unreachable' }
}

// ── the check ───────────────────────────────────────────────────────────────

/**
 * Does the live text of this provision, as published today, refer to the target?
 *
 * ⚠ Exported so the controls go through THIS function and not a copy of it.
 */
export function judge(xml: string, r: Row): { ok: boolean; reason: string } {
  const nameRx = actNameRegex(r.target_title)
  const hasUri = xml.includes(`/${r.target_act_id}`)
  const hasName = nameRx.test(xml)
  if (!hasUri && !hasName) return { ok: false, reason: 'live text contains neither the target URI nor the Act name' }
  if (r.target_provision_ref) {
    // ⚠ "Part 1" appearing ANYWHERE in a long Act is not evidence that THIS
    // reference is to Part 1. The provision must be named in the same phrase as
    // the Act — and in ANY occurrence of the name, not the first. 25-H marked
    // two rows wrong whose parse was right by anchoring on the first.
    const flat = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const v = provisionNamedWithAct(flat, r.target_provision_ref, nameRx)
    if (!v.ok) return {
      ok: false,
      reason: v.occurrences === 0
        ? 'the Act is not named in the live text at all'
        : `names the Act in ${v.occurrences} place(s) but "${r.target_provision_ref}" is in none of those phrases`,
    }
  }
  return { ok: true, reason: hasUri ? 'target URI present in the live provision' : 'Act named in the live provision text' }
}

export async function verifyRow(r: Row): Promise<Verdict> {
  const p = provisionPath(r.source_provision_ref)
  const url = `https://www.legislation.gov.uk/${r.source_gid}${p ? '/' + p : ''}/data.xml`
  const res = await politeFetch(url)
  if (!res.ok || !res.body) {
    // ⚠ A 404 on a provision PATH is not proof the row is wrong: an `enabling`
    // row sits in the enacting words, which have no addressable path, and a
    // CLML internal id has none either. Those are NOT CHECKED at this URL and
    // pass 2 re-examines them against the whole document.
    return { row: r, url, status: 'not-checked', reason: res.err ?? 'no body', http: res.status }
  }
  const v = judge(res.body, r)
  return { row: r, url, status: v.ok ? 'correct' : 'wrong', reason: v.reason, http: res.status }
}

// ── pass 0: the controls ────────────────────────────────────────────────────

/**
 * A verifier that cannot fail measures nothing. Both controls go through
 * `judge`, the same function the sample goes through.
 */
export function runControls(sample: Row[]): { ok: boolean; lines: string[] } {
  const lines: string[] = []
  const r = sample.find(x => x.target_provision_ref) ?? sample[0]
  const d = readDocWithVersion(r.source_gid)
  const slice = d ? (r.source_provision_ref ? provisionSlice(d.xml, r.source_provision_ref) : preambleSlice(d.xml)) : null
  const material = slice ?? d?.xml ?? ''

  // POSITIVE: the local copy of a real row must be judged correct
  const pos = judge(material, r)
  lines.push(`  POSITIVE control — ${r.source_gid}:${r.source_provision_ref ?? '(preamble)'} → ${r.target_act_id}: ${pos.ok ? 'PASSES' : `⚠ FAILS — ${pos.reason}`}`)

  // NEGATIVE 1: the same material, asked about an Act that is not in it
  const negAct = judge(material, { ...r, target_act_id: 'ukpga/2022/18', target_title: 'Down Syndrome Act 2022', target_provision_ref: null })
  lines.push(`  NEGATIVE control (wrong Act) — must be REJECTED: ${negAct.ok ? '⚠⚠ ACCEPTED — the verifier cannot fail' : `rejected — ${negAct.reason}`}`)

  // NEGATIVE 2: the right Act, a provision it does not name in that phrase
  const negProv = judge(material, { ...r, target_provision_ref: 'section-9999' })
  lines.push(`  NEGATIVE control (wrong provision) — must be REJECTED: ${negProv.ok ? '⚠⚠ ACCEPTED — the provision half of the verifier cannot fail' : `rejected — ${negProv.reason}`}`)

  return { ok: pos.ok && !negAct.ok && !negProv.ok, lines }
}

// ── pass 2: re-examine every failure before publishing it ───────────────────

export async function reexamine(v: Verdict): Promise<Verdict> {
  const r = v.row
  const nameRx = actNameRegex(r.target_title)

  // (a) what does OUR copy say?
  const d = readDocWithVersion(r.source_gid)
  let localSaysPresent: boolean | null = null
  if (d) {
    const slice = r.source_provision_ref ? provisionSlice(d.xml, r.source_provision_ref) : preambleSlice(d.xml)
    const flat = flattenClml(slice ?? d.xml)
    localSaysPresent = nameRx.test(flat) || (slice ?? d.xml).includes(`/${r.target_act_id}`)
  }

  // (b) what does the WHOLE live document say, rather than the provision path?
  const whole = await politeFetch(`https://www.legislation.gov.uk/${r.source_gid}/data.xml`)
  let wholeDocSaysPresent: boolean | null = null
  if (whole.ok && whole.body) wholeDocSaysPresent = nameRx.test(whole.body) || whole.body.includes(`/${r.target_act_id}`)

  let conclusion: string
  let status = v.status
  if (v.status === 'not-checked') {
    if (wholeDocSaysPresent === true) {
      status = 'correct'
      conclusion = 'NOT the data: the provision path is not addressable (an enabling reference sits in the enacting words, which have no path), but the whole live document does carry the reference. Counted as correct on the whole-document check.'
    } else if (wholeDocSaysPresent === false) {
      status = 'wrong'
      conclusion = 'the whole live document does not carry the reference either — this is a data failure, not a fetch failure'
    } else {
      conclusion = 'still not checked: neither the provision nor the whole document could be fetched. NOT counted either way.'
    }
  } else if (localSaysPresent === true && wholeDocSaysPresent === true) {
    status = 'correct'
    conclusion = 'VERIFIER FAILURE, not a data failure: both our copy and the whole live document carry the reference; the provision-path check was looking in the wrong place.'
  } else if (localSaysPresent === true && wholeDocSaysPresent === false) {
    conclusion = 'our copy carries the reference and the live document no longer does — the referring provision has been AMENDED OR REVOKED since our bytes were taken. A staleness finding about the corpus, not a parse error.'
  } else if (localSaysPresent === false && wholeDocSaysPresent === true) {
    // ⚠⚠ The first version of this function had no branch here and fell through
    // to "neither our copy nor the live document supports this row" — a
    // conclusion its own evidence refutes, since wholeDocSaysPresent is TRUE.
    // The distinction it was flattening is the most consequential one in the
    // whole run: the citation is real and the target is real, and it is the
    // SOURCE PROVISION that is wrong.
    conclusion = 'MISATTRIBUTED PROVISION: the reference IS in the live document but is NOT in the provision this row names. ' +
      'The citation is real and the target is real; source_provision_ref points at a provision that does not contain it. ' +
      '⚠ source_provision_ref is the column that answers "which provision breaks if you repeal this", so a wrong value here ' +
      'is worse than a missing one.'
  } else if (localSaysPresent === null || wholeDocSaysPresent === null) {
    status = 'not-checked'
    conclusion = `could not be established: local copy ${localSaysPresent === null ? 'not held' : String(localSaysPresent)}, ` +
      `whole live document ${wholeDocSaysPresent === null ? 'not fetched' : String(wholeDocSaysPresent)}. NOT counted either way.`
  } else {
    conclusion = 'confirmed: neither our copy nor the live document supports this row.'
  }
  return { ...v, status, reexamined: { localSaysPresent, wholeDocSaysPresent, conclusion } }
}

// ── run ─────────────────────────────────────────────────────────────────────

async function main() {
  const pool = getNeonPool()
  const byWs = new Map<string, Measure>(MEASURES.map(m => [m.gid, m]))

  // stratified: an equal share from each measure, drawn by md5 so the draw is
  // reproducible and is not insertion order
  const per = Math.ceil(SAMPLE_SIZE / MEASURES.length)
  const sample: Row[] = []
  for (const m of MEASURES) {
    const { rows } = await pool.query(
      `SELECT id::text, target_act_id, target_provision_ref, detection, source_gid,
              source_provision_ref, source_type, citation_text
       FROM ${CITATION_TABLE} WHERE target_act_id = $1
       ORDER BY md5(id::text || $2) LIMIT $3`, [m.gid, SEED, per])
    for (const r of rows) sample.push({ ...r, ws_id: m.ws_id, target_title: m.title } as Row)
  }
  // trim to exactly SAMPLE_SIZE, deterministically
  sample.sort((a, b) => a.id.localeCompare(b.id))
  const draw = sample.slice(0, SAMPLE_SIZE)
  console.log(`sample: ${draw.length} rows, ${new Set(draw.map(r => r.ws_id)).size} measures, drawn by md5(id||seed) with seed "${SEED}"`)
  const det = countsByDetection(draw)
  console.log(`  detection in the sample: markup ${det.markup}, text ${det.text}, enabling ${det.enabling}`)

  // ── PASS 0 ────────────────────────────────────────────────────────────────
  console.log('\n══ PASS 0 — CONTROLS (a verifier that cannot fail measures nothing) ══')
  const controls = runControls(draw)
  for (const l of controls.lines) console.log(l)
  if (!controls.ok) {
    console.error('\n⚠⚠ THE CONTROLS DID NOT BEHAVE. No rate is reported. Per brief §6 a false finding is worse than a missing one.')
    writeText('verification_sample.md', `# Verification — NOT RUN\n\nThe verifier's own controls failed, so no rate is reported.\n\n${controls.lines.join('\n')}\n`)
    closeZip(); await endNeonPool(); process.exit(1)
  }
  console.log('  controls behave — the verifier can pass and can fail. Proceeding.')

  // ── PASS 1 ────────────────────────────────────────────────────────────────
  console.log(`\n══ PASS 1 — ${draw.length} rows against legislation.gov.uk (one at a time, ${GAP_MS}ms apart) ══`)
  const verdicts: Verdict[] = []
  for (const r of draw) {
    const v = await verifyRow(r)
    verdicts.push(v)
    console.log(`  ${v.status.toUpperCase().padEnd(11)} ${r.ws_id} ${r.source_gid}:${r.source_provision_ref ?? '(preamble)'} [${r.detection}] → ${r.target_provision_ref ?? '(act-level)'}  — ${v.reason}`)
  }

  // ── PASS 2 ────────────────────────────────────────────────────────────────
  const needsWork = verdicts.filter(v => v.status !== 'correct')
  console.log(`\n══ PASS 2 — re-examining ${needsWork.length} non-pass row(s) before any of them is reported ══`)
  const final: Verdict[] = []
  for (const v of verdicts) {
    if (v.status === 'correct') { final.push(v); continue }
    const re = await reexamine(v)
    console.log(`  ${v.status} → ${re.status.toUpperCase()}  ${v.row.source_gid}:${v.row.source_provision_ref ?? '(preamble)'}`)
    console.log(`      ${re.reexamined!.conclusion}`)
    final.push(re)
  }

  // ── the rate ──────────────────────────────────────────────────────────────
  const correct = final.filter(v => v.status === 'correct').length
  const wrong = final.filter(v => v.status === 'wrong').length
  const notChecked = final.filter(v => v.status === 'not-checked').length
  const checked = correct + wrong
  const established = checked >= MIN_CHECKED

  console.log('\n══ RESULT ══')
  console.log(`  ${correct} correct, ${wrong} wrong, ${notChecked} NOT CHECKED, out of ${final.length} drawn.`)
  console.log(`  rate: ${checked === 0 ? 'n/a' : `${correct} of ${checked} rows actually checked (${(100 * correct / checked).toFixed(1)}%)`}`)
  if (!established) console.log(`  ⚠⚠ FEWER THAN ${MIN_CHECKED} ROWS WERE ACTUALLY CHECKED — the rate above is NOT established and must not be quoted.`)
  const verifierFailures = final.filter(v => v.reexamined?.conclusion.startsWith('VERIFIER FAILURE')).length
  const notAddressable = final.filter(v => v.reexamined?.conclusion.startsWith('NOT the data')).length
  console.log(`  of the non-passes in pass 1: ${verifierFailures} were the VERIFIER's, ${notAddressable} were an unaddressable provision path, ${wrong} survived re-examination.`)

  // what the wrong ones have in common
  const common: Record<string, number> = {}
  for (const v of final.filter(x => x.status === 'wrong')) {
    const k = v.reexamined?.conclusion ?? v.reason
    common[k] = (common[k] ?? 0) + 1
  }
  if (Object.keys(common).length) {
    console.log('  what the failures have in common:')
    for (const [k, n] of Object.entries(common).sort((a, b) => b[1] - a[1])) console.log(`     ${n} × ${k}`)
  }

  // ── SUPPLEMENTARY: a detection-stratified draw ────────────────────────────
  //
  // ⚠⚠ The brief's 20 rows are stratified by MEASURE, and `markup` is 2–5% of
  // the table, so a 20-row draw is very likely to contain none — this one
  // contained zero. That means the brief's sample tests the `text` detector and
  // says nothing whatever about the `markup` one, which is the detector the
  // report will lean on hardest, because a markup edge is the source document
  // asserting the target BY URI. A rate that silently covers one detector and
  // is read as covering three is the kind of number this whole run exists to
  // avoid. So a second, smaller draw takes rows from each detector by name.
  // It is ADDITIONAL to the brief's 20 and is reported separately, never merged
  // into the headline rate.
  console.log('\n══ SUPPLEMENTARY — a detection-stratified draw, because the brief\'s 20 contained no markup rows ══')
  const supp: Row[] = []
  for (const d of ['markup', 'text', 'enabling']) {
    const { rows } = await pool.query(
      `SELECT id::text, target_act_id, target_provision_ref, detection, source_gid,
              source_provision_ref, source_type, citation_text
       FROM ${CITATION_TABLE} WHERE target_act_id = ANY($1::text[]) AND detection = $2
       ORDER BY md5(id::text || $3) LIMIT 3`, [MEASURES.map(m => m.gid), d, SEED])
    for (const r of rows) supp.push({ ...r, ws_id: byWs.get(r.target_act_id)!.ws_id, target_title: byWs.get(r.target_act_id)!.title } as Row)
  }
  const suppVerdicts: Verdict[] = []
  for (const r of supp) {
    let v = await verifyRow(r)
    if (v.status !== 'correct') v = await reexamine(v)
    suppVerdicts.push(v)
    console.log(`  ${v.status.toUpperCase().padEnd(11)} [${r.detection.padEnd(8)}] ${r.source_gid}:${r.source_provision_ref ?? '(preamble)'} → ${r.target_provision_ref ?? '(act-level)'}  — ${v.reexamined?.conclusion ?? v.reason}`)
  }
  const suppByDet: Record<string, { correct: number; wrong: number; notChecked: number }> = {}
  for (const v of suppVerdicts) {
    const b = suppByDet[v.row.detection] ??= { correct: 0, wrong: 0, notChecked: 0 }
    if (v.status === 'correct') b.correct++; else if (v.status === 'wrong') b.wrong++; else b.notChecked++
  }
  for (const [d, b] of Object.entries(suppByDet))
    console.log(`    ${d.padEnd(9)} ${b.correct} correct, ${b.wrong} wrong, ${b.notChecked} not checked (of ${b.correct + b.wrong + b.notChecked})`)
  console.log('  ⚠ These are 3 rows per detector. Three rows establish that a detector is not systematically broken.')
  console.log('    They do NOT establish a rate, and no rate is quoted for them.')

  // ── P6, scored ────────────────────────────────────────────────────────────
  console.log('\n══ P6 SCORED ══')
  console.log('  predicted ≥17 of 20 correct on the first pass, and that at least one first-pass failure would be the verifier\'s.')
  console.log(`  actual: pass 1 gave ${verdicts.filter(v => v.status === 'correct').length} correct of ${verdicts.length};`)
  console.log(`          after re-examination ${correct} correct, ${wrong} wrong, ${notChecked} not checked;`)
  console.log(`          ${verifierFailures} first-pass failure(s) were the verifier's — prediction ${verifierFailures >= 1 ? 'HOLDS' : 'WRONG'}.`)

  // ── write ─────────────────────────────────────────────────────────────────
  const md: string[] = []
  md.push(`# Verification sample — 20 rows against legislation.gov.uk`)
  md.push(``)
  md.push(`*Generated ${new Date().toISOString()}. Corpus track, \`CC_BRIEF_report_corpus.md\` T5.*`)
  md.push(``)
  md.push(`## The rate`)
  md.push(``)
  md.push(`**${correct} correct, ${wrong} wrong, ${notChecked} not checked, out of ${final.length} drawn.**`)
  md.push(``)
  md.push(established
    ? `Rate: **${correct} of ${checked}** rows that were actually checked — ${(100 * correct / checked).toFixed(1)}%.`
    : `⚠⚠ Only ${checked} of ${final.length} rows could be checked, which is below the floor of ${MIN_CHECKED}. **No rate is established** and none should be quoted. A rate over a handful of rows that happened to be fetchable is not a measurement.`)
  md.push(``)
  md.push(`A row that could not be fetched is **NOT CHECKED** — not "wrong" and not "right". legislation.gov.uk rate-limits sequential fetches, and counting a 504 as a failure would publish a defect in our data that is really a defect in our manners.`)
  md.push(``)
  md.push(`## How the sample was drawn`)
  md.push(``)
  md.push(`Stratified across the three measures, ${per} from each, ordered by \`md5(id || '${SEED}')\` and trimmed to ${SAMPLE_SIZE}. The seed is fixed so the same rows come back on a re-run — a random sample that cannot be reproduced is not evidence. It is **not** drawn by \`id\`, which is insertion order, which is document order.`)
  md.push(``)
  md.push(`Detection split in the sample: markup ${det.markup}, text ${det.text}, enabling ${det.enabling}. (Not summed — three strengths of evidence.)`)
  md.push(``)
  md.push(`## Pass 0 — the verifier's own controls`)
  md.push(``)
  md.push(`A verifier that cannot fail measures nothing, so the checker was made to pass once and fail twice before any row was scored. All three go through \`judge()\`, the same function the sample goes through.`)
  md.push(``)
  for (const l of controls.lines) md.push(`- ${l.trim()}`)
  md.push(``)
  md.push(`## Pass 2 — every failure re-examined before it was reported`)
  md.push(``)
  md.push(`In sprint 25-H the first pass reported 18/20 and **both** failures were the checker's. So no first-pass failure is published here until it has been put against our own local copy of the document *and* the whole live document, and both agree the row is wrong.`)
  md.push(``)
  md.push(`Of the ${needsWork.length} non-passes in pass 1: **${verifierFailures} were the verifier's**, ${notAddressable} were a provision path that does not exist (an \`enabling\` reference sits in the enacting words, which have no addressable path), and **${wrong} survived**.`)
  md.push(``)
  md.push(`## Every row`)
  md.push(``)
  md.push(`| # | measure | source | detection | target provision | verdict | why |`)
  md.push(`|---|---|---|---|---|---|---|`)
  final.forEach((v, i) => {
    const why = (v.reexamined?.conclusion ?? v.reason).replace(/\|/g, '\\|')
    md.push(`| ${i + 1} | ${v.row.ws_id} | \`${v.row.source_gid}:${v.row.source_provision_ref ?? '(preamble)'}\` | ${v.row.detection} | ${v.row.target_provision_ref ?? '(act-level)'} | **${v.status}** | ${why} |`)
  })
  md.push(``)
  md.push(`## What the failures have in common`)
  md.push(``)
  if (Object.keys(common).length === 0) md.push(`Nothing survived re-examination as a data failure.`)
  else for (const [k, n] of Object.entries(common).sort((a, b) => b[1] - a[1])) md.push(`- **${n} ×** ${k}`)
  md.push(``)
  md.push(`## ⚠ What this rate does NOT cover`)
  md.push(``)
  md.push(`**The brief's sample is stratified by measure, and it drew markup ${det.markup}, text ${det.text}, enabling ${det.enabling}.** \`markup\` is 2–5% of the table, so a 20-row draw is very likely to contain none, and this one contained ${det.markup}. The headline rate therefore measures the \`text\` detector and says nothing whatever about the \`markup\` one — which is the detector the report will lean on hardest, because a markup edge is the source document asserting the target *by URI*. A rate that silently covers one detector and is read as covering three is exactly the kind of number this run exists to avoid.`)
  md.push(``)
  md.push(`So a **supplementary draw** takes three rows from each detector by name. It is additional to the brief's 20 and is **not merged into the rate above**:`)
  md.push(``)
  md.push(`| detector | correct | wrong | not checked |`)
  md.push(`|---|---|---|---|`)
  for (const [d, b] of Object.entries(suppByDet)) md.push(`| ${d} | ${b.correct} | ${b.wrong} | ${b.notChecked} |`)
  md.push(``)
  md.push(`Three rows per detector establish that a detector is not systematically broken. They do **not** establish a rate, and none is quoted for them.`)
  md.push(``)
  md.push(`Two further limits, stated rather than left to be discovered:`)
  md.push(``)
  md.push(`- **For an act-level row the check is "the target Act is named in this provision as published today".** That is exactly the claim the row makes, so it is the right check — but it tests the parse and the staleness, not the resolution of the target's identity. A row that names the right Act for the wrong reason would pass.`)
  md.push(`- **The verifier and the extractor read the same kind of bytes**, though from different points in time: the extractor read the August 2026 bulk file, the verifier read the live site today. So this measures parse correctness and staleness, not whether legislation.gov.uk's own markup is right.`)
  md.push(``)

  writeText('verification_sample.md', md.join('\n'))
  writeJson('verification_sample.json', {
    generated_at: new Date().toISOString(),
    seed: SEED, sample_size: SAMPLE_SIZE, min_checked_floor: MIN_CHECKED,
    correct, wrong, not_checked: notChecked, checked, rate_established: established,
    rate: checked === 0 ? null : correct / checked,
    detection_in_the_sample: det,
    controls: controls.lines,
    verifier_failures_in_pass_1: verifierFailures,
    unaddressable_provision_paths: notAddressable,
    verdicts: final,
    supplementary_detection_stratified: {
      note: 'ADDITIONAL to the brief\'s 20 rows and never merged into the rate. Three rows per detector, because the brief\'s measure-stratified draw contained no markup rows at all and would otherwise have been read as covering all three detectors.',
      by_detection: suppByDet,
      verdicts: suppVerdicts,
    },
  })
  console.log('\n  wrote docs/report_run/verification_sample.md and .json')
  closeZip()
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[t5] FATAL', e); process.exit(1) })
}
