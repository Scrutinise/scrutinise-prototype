/**
 * trial-checks.ts — BRIEF_GRAPH_2D4 §1's two remaining asks, both of which are about NOT trusting
 * the improvement.
 *
 *   --suspect   the bibliography / self-introduction rule, with its own FALSE-POSITIVE RATE measured
 *               before it is applied to anything. §1: "report the rule's own false-positive rate
 *               before applying it."
 *   --declined  the OPPOSITE failure. §1: "a 'no position' that should have been 'against' is
 *               invisible in a hand-score of extracted positions. Score a sample of submissions the
 *               model declined." A threshold change that stops over-attributing can start
 *               under-attributing, and only this direction shows it.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/trial-checks.ts --self-test
 *   npx tsx position-graph/trial-checks.ts --suspect
 *   npx tsx position-graph/trial-checks.ts --declined v2 [--n 12]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, findExtract } from './text-2d3'

export {}

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const str = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d }
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }

/**
 * Is this extract the kind of passage that is present in the document and yet no evidence of a
 * position? 2D-3 found two: a line from a BIBLIOGRAPHY and the SUBMITTER INTRODUCING ITSELF.
 * `findExtract` cannot catch either, because the words genuinely are there.
 *
 * ⚠ Three narrow tests, and the positional one is the one most likely to be wrong — a conclusion
 * also lives at the end of a document. Which is why the rule is scored before it is used.
 */
export function suspectExtract(extract: string, doc: string): { suspect: boolean; why: string } {
  if (/\bet al\b|\bdoi:|https?:\/\/|\b(?:19|20)\d{2}\)\s*[.;]|\bvol\.?\s*\d+\b|\bpp?\.\s*\d+/i.test(extract)) {
    return { suspect: true, why: 'citation-shape' }
  }
  const introduces = /\b(we are|our organisation is|i am the|is the (?:membership|professional|representative) (?:body|organisation)|was established in|our (?:role|remit) is|are vital as)\b/i.test(extract)
  const argues = /\bshould\b|\bmust\b|\bwe (?:support|oppose|welcome|recommend|call|believe|urge)\b|\bneeds? to be\b/i.test(extract)
  if (introduces && !argues) return { suspect: true, why: 'self-introduction' }
  /**
   * ⚠ THE POSITIONAL TEST IS OFF BY DEFAULT, AND THE MEASUREMENT IS WHY.
   *
   * Scored over the 50 hand-read positions it produced the rule's ONLY false positive — #16097,
   * "Investment in transformation on a local level…", a genuine conclusion that happens to sit in
   * the last 6% of its document. With the tail test on, the rule flags 1 of 23 accepted extracts
   * (4.3%); with it off, 0 of 23. It cannot tell a reference list from a closing argument, and it
   * was never going to: both live at the end.
   */
  if (TAIL_RULE) {
    const at = findExtract(extract, doc).offset
    if (at !== null && doc.length > 4000 && at / doc.length > 0.94) return { suspect: true, why: 'document-tail' }
  }
  return { suspect: false, why: '' }
}
/** Enable with --tail-rule to reproduce the measurement that rejected it. */
const TAIL_RULE = process.argv.includes('--tail-rule')

async function suspect(pool: ReturnType<typeof getNeonPool>) {
  const { rows } = await pool.query<{ id: string; verdict: string; failure_type: string | null; extract: string; r2key: string; note: string }>(`
    SELECT r.position_id::text id, r.verdict, r.failure_type, p.extract, c."r2Key" r2key, COALESCE(r.note,'') note
    FROM graph_position_review r JOIN graph_position p ON p.id = r.position_id
    JOIN corpus_sections c ON c.id = p.section_id ORDER BY r.position_id`)
  const good = rows.filter((r) => r.verdict === 'correct')
  console.log(`\n════ §1 — THE SUSPECT-EXTRACT RULE, SCORED BEFORE BEING APPLIED ════`)
  console.log(`  negative class: the ${good.length} extracts the reader judged CORRECT. Flagging one is a FALSE POSITIVE.`)
  console.log(`  positive class: the two 2D-3 named — a bibliography line and a self-introduction.\n`)

  const cache = new Map<string, string>()
  let fp = 0
  let tn = 0
  let caught = 0
  const lines: string[] = []
  for (const r of rows) {
    let doc = cache.get(r.r2key)
    if (doc === undefined) { doc = (await getDocText(r.r2key)) ?? ''; cache.set(r.r2key, doc) }
    const v = suspectExtract(r.extract, doc)
    const knownBad = /bibliograph|introducing itself|self-description/i.test(r.note)
    if (v.suspect && r.verdict === 'correct') { fp++; lines.push(`⚠ FALSE POSITIVE #${r.id} (${v.why}) "${r.extract.slice(0, 66)}"`) }
    else if (v.suspect && knownBad) { caught++; lines.push(`✓ caught #${r.id} (${v.why}) — ${r.note.slice(0, 66)}`) }
    else if (v.suspect) lines.push(`· flagged #${r.id} (${v.why}) — baseline ${r.verdict}/${r.failure_type ?? ''}`)
    else {
      if (r.verdict === 'correct') tn++
      if (knownBad) lines.push(`✗ MISSED #${r.id} — ${r.note.slice(0, 66)}`)
    }
  }
  console.log(`  correct extracts NOT flagged            ${tn}/${good.length}`)
  console.log(`  ⚠ correct extracts FLAGGED             ${fp}/${good.length} = ${(100 * fp / Math.max(1, good.length)).toFixed(1)}% false-positive rate`)
  console.log(`  of the two known-bad, caught            ${caught}/2\n`)
  for (const l of lines) console.log(`    ${l}`)
  const verdict = fp === 0 && caught >= 1 ? 'a WARNING flag is safe to apply'
    : fp > 0 ? 'NOT safe as a filter — it flags extracts the reader accepted'
      : 'catches nothing on this sample; not worth applying'
  console.log(`\n  ⚠ VERDICT: ${verdict}.`)
  console.log(`  And it stays a FLAG, never a delete: a positive class of two is far too small to`)
  console.log(`  justify discarding rows, and the tail test cannot tell a reference from a conclusion.`)
}

async function declined(pool: ReturnType<typeof getNeonPool>, trial: string) {
  const N = num('n', 12)
  console.log(`\n════ §1's OPPOSITE FAILURE — propositions ${trial} DECLINED, put in front of a reader ════`)
  console.log(`  Drawn from the same 49 submissions: (section, proposition) pairs where ${trial} returned`)
  console.log(`  nothing AND the baseline hand-score never covered it, so neither has been checked.\n`)
  const { rows } = await pool.query<{ section_id: string; prop: string; pid: string; r2key: string }>(`
    WITH secs AS (SELECT DISTINCT p.section_id, p.inquiry_ref FROM graph_position p
                    JOIN graph_position_review r ON r.position_id = p.id)
    SELECT s.section_id, pr.text prop, pr.id::text pid, c."r2Key" r2key
    FROM secs s
    JOIN graph_proposition pr ON pr.inquiry_refs ? s.inquiry_ref
    JOIN corpus_sections c ON c.id = s.section_id
    WHERE NOT EXISTS (SELECT 1 FROM graph_position_trial t
                       WHERE t.trial=$1 AND t.section_id=s.section_id AND t.proposition_id=pr.id)
      AND NOT EXISTS (SELECT 1 FROM graph_position gp JOIN graph_position_review gr ON gr.position_id=gp.id
                       WHERE gp.section_id=s.section_id AND gp.proposition_id=pr.id)
    ORDER BY md5(s.section_id || pr.id::text) LIMIT $2`, [trial, N])

  const cache = new Map<string, string>()
  const stop = /^(should|would|could|there|which|their|these|those|being|other|across|through|within|greater|significantly|including)$/
  for (const [i, r] of rows.entries()) {
    let doc = cache.get(r.r2key)
    if (doc === undefined) { doc = (await getDocText(r.r2key)) ?? ''; cache.set(r.r2key, doc) }
    const terms = [...new Set((r.prop.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? []).filter((w) => !stop.test(w)))]
    const lower = doc.toLowerCase()
    let best = { at: -1, hits: 0 }
    for (let at = 0; at < Math.max(1, lower.length - 200); at += 400) {
      const hits = terms.filter((t) => lower.slice(at, at + 1100).includes(t)).length
      if (hits > best.hits) best = { at, hits }
    }
    console.log(`\n──── ${i + 1}/${rows.length}  ${r.section_id} ────`)
    console.log(`PROPOSITION : ${r.prop}`)
    console.log(`TERM MATCH  : ${best.hits}/${terms.length}${best.hits <= 1 ? '   ← the document barely mentions this subject at all' : ''}`)
    if (best.hits > 1) console.log(`BEST WINDOW : …${doc.slice(best.at, best.at + 620).replace(/\s+/g, ' ')}…`)
  }
  console.log(`\n  ⚠ The window is MECHANICAL — the densest match for the proposition's distinctive words.`)
  console.log(`  It says where to look; it does not say whether a position is there. That is the read.`)
}

function selftest() {
  const doc = 'x'.repeat(5000) + ' The Committee should require a minimum NHS commitment. ' + 'y'.repeat(200)
  const cases: Array<[string, boolean]> = [
    ['a citation with et al is suspect', suspectExtract('Liddle, J., Stowell, M. et al (2022) A Qualitative Evaluation', doc).why === 'citation-shape'],
    ['a DOI is suspect', suspectExtract('BMC Geriatrics 24, 1011 doi:10.1186/s12877', doc).why === 'citation-shape'],
    ['a URL is suspect', suspectExtract('see https://www.risenortheast.co.uk for more information', doc).why === 'citation-shape'],
    ['a self-introduction is suspect',
      suspectExtract('Our thoughts on this topic are vital as both roles are integral to multidisciplinary teams', doc).why === 'self-introduction'],
    ['"we are the membership body" is suspect',
      suspectExtract('NHS Providers is the membership organisation for NHS trusts across England', doc).why === 'self-introduction'],
    // ⚠ the negative controls — the rule must not fire on a real argument
    ['a real argument is NOT suspect',
      !suspectExtract('We believe Section 21 no-fault eviction should be abolished without delay.', doc).suspect],
    ['⚠ a self-description that ALSO argues is NOT suspect',
      !suspectExtract('We are the membership body for NHS trusts and we believe funding must rise.', doc).suspect],
    ['⚠ a year in prose does not make it a citation',
      !suspectExtract('Funding has fallen in real terms since 2010 and must now be restored.', doc).suspect],
    ['⚠ a short document has no tail rule', !suspectExtract('a passage near the end of this text', 'a passage near the end of this text').suspect],
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
    if (flag('suspect')) await suspect(pool)
    if (flag('declined')) await declined(pool, str('declined', 'v2'))
  } finally { await endNeonPool() }
}
if (require.main === module) main().catch((e) => { console.error('[trial-checks] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
