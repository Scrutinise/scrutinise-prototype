/**
 * extract-caselaw-case-edges.ts — BRIEF_GRAPH_5 §2.4. CITED BUT NOT HELD.
 *
 * **A judgment we do not hold can still be a target.** References to pre-2003 cases appear in the
 * post-2003 judgments we DO hold, so the edges are buildable — the direction that is unavailable is
 * OUTBOUND, from a judgment we lack. Inbound to it is exactly what our own corpus supplies.
 *
 * ── ⚠⚠ THE FOUR RULES THIS FILE IS SHAPED AROUND ────────────────────────────
 *
 * 1. **An unheld target must never render like a held one.** `held_state` is on every row and is
 *    THREE-valued, because two would be wrong in a measurable band — see the table's header for
 *    the *Rainy Sky* pair that proves it.
 *
 * 2. **Identity without a target to check against.** We cannot verify a resolution against a
 *    document we do not hold. So the identity is the CITATION, never the name: two citation forms
 *    are never merged because their names look alike, and the report states the distinct-citation
 *    count against the resolved count. ⚠ `target_name` is recorded as an OBSERVATION of what words
 *    sat in front of the citation in this judgment — it is not an identity and nothing joins on it.
 *
 * 3. **BAILII: link only, never a snippet.** Their terms forbid storing search results or HTML
 *    versions of judgments and forbid robot access. ⚠⚠ **NOTHING IN THIS FILE MAKES A NETWORK
 *    REQUEST.** `bailiiUrl()` is pure string derivation from the citation; there is no fetch, no
 *    HEAD, no validation-by-request, and no handling of any challenge page. A deep link to a public
 *    URL is fine; confirming it resolves is not, and is not attempted.
 *
 * 4. **Show the citing passage, not a headnote.** We are entitled to our own judgments' words, and
 *    they tell the reader what the case is being cited FOR — which a headnote we may not copy
 *    would not do any better.
 *
 * ⚠ The citation parser is IMPORTED from `caseref/citations.ts`, which is 50/50 under its own
 * check with half of that negative controls, and which handles the law-report form that is the
 * ONLY form a pre-2001 authority has. A second parser here would be a second thing to keep right.
 *
 *   npx tsx graph/extract-caselaw-case-edges.ts --pilot 500    # no writes
 *   npx tsx graph/extract-caselaw-case-edges.ts                # full, resumable
 */
import fs from 'fs'
import path from 'path'
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { extractCitations, normaliseCitation, nameBefore, tidyName, sentenceAround } from '../caseref/citations'
import { flattenWithRefs, courtOf } from './extract-caselaw-treatment'
import { CASE_EDGE_TABLE, HeldState } from './setup-caselaw-case-edge-table'

const CORPUS = 'tna-caselaw'
const CHECKPOINT = path.join(__dirname, 'caselaw-case-edge-checkpoint.json')
const CONCURRENCY = parseInt(process.env.G5_CONCURRENCY ?? '8', 10)
const PILOT = (() => { const i = process.argv.indexOf('--pilot'); return i >= 0 ? parseInt(process.argv[i + 1] ?? '500', 10) : 0 })()
const PASSAGE_MAX = 900

/**
 * ⚠⚠ THE ENGLISH FLOOR IS READ FROM LIVE STATE, NEVER WRITTEN DOWN. `caselaw-coverage.ts` derives
 * it from the annual histogram; hardcoding 2003 here would be the retired "17.5 GB alert line"
 * again, and it would silently go wrong the day a backfill lands.
 */
async function englishFloor(): Promise<number> {
  const { caseLawCoverage } = await import('./caselaw-coverage')
  const b = await caseLawCoverage()
  const tna = b.collections.find(c => c.corpus === CORPUS)
  if (!tna || tna.continuousFrom == null) {
    throw new Error('cannot determine the English floor from live state — refusing to guess it')
  }
  return tna.continuousFrom
}

/**
 * BAILII's own path scheme, DERIVED from a neutral citation. ⚠ Never fetched, never verified by
 * request. Returns null when the citation does not determine a path — a search URL is offered by
 * the surface, not stored as if it were the judgment's address.
 */
export function bailiiUrl(citation: string): string | null {
  // ⚠⚠ THE DIVISION APPEARS ON EITHER SIDE OF THE NUMBER, AND THE FIRST VERSION READ ONLY ONE.
  //   `[2001] EWCA Civ 1041`      — division BEFORE the number
  //   `[2004] EWHC 254 (Admin)`   — division AFTER it, in parentheses
  // Reading only the first form sent every Administrative Court case to `/EWHC/QB/`, i.e. a
  // confident link to the wrong division. ⚠ A wrong deep link is worse than no deep link: the
  // reader follows it, lands on a different case or a 404, and stops trusting the record. Where
  // the citation does not determine the path, this returns NULL and the surface offers a search.
  const m = /^\[(\d{4})\]\s+([A-Z]+)\s*(?:([A-Z][A-Za-z]+)\s+)?(\d+)(?:\s*\(([A-Za-z]+)\))?/.exec(citation)
  if (!m) return null
  const [, year, court, divBefore, num, divAfter] = m
  const div = divAfter ?? divBefore ?? null
  const map: Record<string, string | null> = {
    UKSC: 'uk/cases/UKSC', UKHL: 'uk/cases/UKHL', UKPC: 'uk/cases/UKPC',
    UKUT: 'uk/cases/UKUT', UKEAT: 'uk/cases/UKEAT',
    CSIH: 'scot/cases/ScotCS', CSOH: 'scot/cases/ScotCS',
    NICA: 'nie/cases/NICA', NIQB: 'nie/cases/NIQB',
    // ⚠ these two REQUIRE a division; without one the path is a guess, so we decline to build it
    EWCA: div ? `ew/cases/EWCA/${div}` : null,
    EWHC: div ? `ew/cases/EWHC/${div}` : null,
  }
  const p = map[court]
  return p ? `https://www.bailii.org/${p}/${year}/${num}.html` : null
}

export const stats = {
  docs: 0, occurrences: 0, selfCites: 0, rows: 0,
  held: 0, notHeld: 0, unknown: 0,
  withName: 0, withParagraph: 0, noPassage: 0,
}

export type CaseEdgeRow = {
  judgmentId: string; judgmentUri: string; court: string | null; judgmentDate: string | null
  paragraphNum: string | null
  targetCitation: string; targetRaw: string; targetKind: string; targetYear: number | null
  targetName: string | null
  heldState: HeldState; targetJudgmentId: string | null
  passage: string; bailiiUrl: string | null
}

export function extractCaseEdges(
  sectionId: string, xml: string, itemDate: string | null,
  heldByCitation: Map<string, string>, floor: number,
): CaseEdgeRow[] {
  stats.docs++
  const { text, paras } = flattenWithRefs(xml)
  const judgmentUri = xml.match(/<FRBRWork>[\s\S]*?<FRBRthis value="([^"]*)"/)?.[1] ?? sectionId
  const court = courtOf(sectionId)
  // ⚠ 88% of judgments cite themselves in their own header — measured by the case-reference layer.
  //   Left in, every held case would read as cited once more than it is.
  const own = normaliseCitation(sectionId.match(/^tna-caselaw:(.+):\d+$/)?.[1] ?? '')
  const out: CaseEdgeRow[] = []

  for (const c of extractCitations(text)) {
    const norm = normaliseCitation(c.raw)
    if (norm === own) { stats.selfCites++; continue }
    stats.occurrences++

    const targetJudgmentId = heldByCitation.get(norm) ?? null
    // ⚠⚠ THREE STATES. See setup-caselaw-case-edge-table.ts's header.
    let heldState: HeldState
    if (targetJudgmentId) heldState = 'held'
    else if (c.kind === 'law-report' && c.year >= floor) heldState = 'unknown'
    else heldState = 'not-held'
    // ⚠⚠ The state counters are incremented BELOW, after the passage check — not here. Counting
    // them at this point counts OCCURRENCES while the denominator counts STORED EDGES, and the
    // first full run printed held+not-held+unknown summing to 110.4% of edges built. Three
    // percentages that add up to more than 100 are at least visibly wrong; the same slip on a
    // single figure would not have been.

    // ⚠ §2.4's substitute for a headnote: OUR judgment's words.
    const passage = sentenceAround(text, c.index, c.raw.length).replace(/\s+/g, ' ').trim().slice(0, PASSAGE_MAX)
    // ⚠⚠ THE SAME INVARIANT THE TREATMENT LAYER NEEDED: the passage must contain the citation it
    // is offered as evidence for. §2.4 shows this passage INSTEAD of a headnote, so a passage that
    // does not mention the case is worse than nothing — it looks like evidence and answers a
    // different question. Counted and dropped, never stored.
    if (!passage || !passage.includes(c.raw.replace(/\s+/g, ' ').trim())) { stats.noPassage++; continue }

    // counted here, so every state percentage shares the denominator it is printed against
    if (heldState === 'held') stats.held++
    else if (heldState === 'unknown') stats.unknown++
    else stats.notHeld++

    const nm = tidyName(nameBefore(text, c.index) ?? '') || null
    if (nm) stats.withName++
    const para = paras.find(p => c.index >= p.start && c.index < p.end && p.num)
    const paragraphNum = para?.num ? para.num.replace(/\.$/, '').trim() || null : null
    if (paragraphNum) stats.withParagraph++

    out.push({
      judgmentId: sectionId, judgmentUri, court, judgmentDate: itemDate, paragraphNum,
      targetCitation: norm, targetRaw: c.raw, targetKind: c.kind, targetYear: c.year,
      targetName: nm, heldState, targetJudgmentId,
      passage, bailiiUrl: bailiiUrl(norm),
    })
  }
  stats.rows += out.length
  return out
}

async function insertRows(rows: CaseEdgeRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const pool = namesPool()
  let written = 0
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const tuples = batch.map((r, j) => {
      values.push(r.judgmentId, r.judgmentUri, r.court, r.judgmentDate, r.paragraphNum,
        r.targetCitation, r.targetRaw, r.targetKind, r.targetYear, r.targetName,
        r.heldState, r.targetJudgmentId, r.passage, r.bailiiUrl)
      const b = j * 14
      return `(${Array.from({ length: 14 }, (_, k) => `$${b + k + 1}`).join(',')})`
    })
    const res = await pool.query(
      `INSERT INTO ${CASE_EDGE_TABLE}
       (judgment_id, judgment_uri, court, judgment_date, paragraph_num,
        target_citation, target_raw, target_kind, target_year, target_name,
        held_state, target_judgment_id, passage, bailii_url)
       VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`, values)
    written += res.rowCount ?? 0
  }
  return written
}

async function mapPool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i]) }
  }))
}

async function main() {
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done: Set<string> = PILOT || !fs.existsSync(CHECKPOINT)
    ? new Set() : new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done)

  const p = namesPool()
  const floor = await englishFloor()
  console.log(`[g5-case] English floor, DERIVED from live state: ${floor}`)

  // every neutral citation we hold → its judgment id
  const heldByCitation = new Map<string, string>()
  for (const r of (await p.query(`SELECT id FROM corpus_sections WHERE corpus=$1`, [CORPUS])).rows) {
    const m = String(r.id).match(/^tna-caselaw:(.+):\d+$/)
    if (m) heldByCitation.set(normaliseCitation(m[1]), String(r.id))
  }
  console.log(`[g5-case] ${heldByCitation.size.toLocaleString()} held citations indexed`)

  const all = (await p.query(
    `SELECT id, "r2RawKey", "itemDate"::text d FROM corpus_sections
      WHERE corpus=$1 AND "r2RawKey" IS NOT NULL ORDER BY id`, [CORPUS])).rows
  let scope = all.filter((r: { id: string }) => !done.has(r.id))
  if (PILOT) { const step = Math.max(1, Math.floor(all.length / PILOT)); scope = all.filter((_: unknown, i: number) => i % step === 0).slice(0, PILOT) }
  console.log(`[g5-case] ${scope.length.toLocaleString()} of ${all.length.toLocaleString()} judgments${PILOT ? ' (PILOT — NO WRITES)' : ''}`)

  let written = 0, batch: CaseEdgeRow[] = []
  const addWritten = (n: number) => { written += n }   // ⚠ never `written += await …` — lost update
  const sample: CaseEdgeRow[] = []
  await mapPool(scope, CONCURRENCY, async (r: { id: string; r2RawKey: string; d: string | null }) => {
    const xml = await r2Get(r.r2RawKey)
    if (!xml) return
    const rows = extractCaseEdges(r.id, xml, r.d, heldByCitation, floor)
    if (PILOT) { if (sample.length < 12) sample.push(...rows.slice(0, 1)); done.add(r.id); return }
    batch.push(...rows); done.add(r.id)
    if (batch.length >= 2000) {
      const b = batch; batch = []
      addWritten(await insertRows(b))
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done], written, at: new Date().toISOString() }))
      console.log(`  … ${stats.docs.toLocaleString()} judgments, ${written.toLocaleString()} edges`)
    }
  })
  if (!PILOT && batch.length) addWritten(await insertRows(batch))
  if (!PILOT) fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done], written, at: new Date().toISOString() }))

  const pc = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '—'
  console.log(`\n══ §2.4 CITED BUT NOT HELD ══`)
  console.log(`  judgments read              ${stats.docs.toLocaleString()}`)
  console.log(`  citation occurrences       ${stats.occurrences.toLocaleString()}  (self-citations excluded: ${stats.selfCites.toLocaleString()})`)
  console.log(`  edges built                ${stats.rows.toLocaleString()}`)
  console.log(`    ⚠ no passage, dropped    ${stats.noPassage.toLocaleString()}`)
  console.log(`\n  ⚠⚠ HELD STATE — an unheld target must never render like a held one:`)
  console.log(`    held                     ${stats.held.toLocaleString()}  ${pc(stats.held, stats.rows)}`)
  console.log(`    not-held                 ${stats.notHeld.toLocaleString()}  ${pc(stats.notHeld, stats.rows)}`)
  console.log(`    unknown                  ${stats.unknown.toLocaleString()}  ${pc(stats.unknown, stats.rows)}`)
  console.log(`\n  carrying an observed name  ${stats.withName.toLocaleString()}  ${pc(stats.withName, stats.rows)}`)
  console.log(`  anchored to a paragraph    ${stats.withParagraph.toLocaleString()}  ${pc(stats.withParagraph, stats.rows)}`)
  if (PILOT) {
    console.log(`\n  PILOT — nothing written. Sample:`)
    sample.slice(0, 8).forEach((s, i) => {
      console.log(`\n   ${i + 1}. ${s.targetCitation}  [${s.heldState.toUpperCase()}]  ${s.targetName ?? '(no name observed)'}`)
      console.log(`      cited by ${s.judgmentId}${s.paragraphNum ? ` ¶${s.paragraphNum}` : ''}`)
      console.log(`      link : ${s.bailiiUrl ?? '(citation does not determine a path — search only)'}`)
      console.log(`      our words: ${s.passage.slice(0, 200)}`)
    })
  } else {
    console.log(`\n  rows written to ${CASE_EDGE_TABLE}: ${written.toLocaleString()}`)
  }
  await endNamesPool()
}

if (require.main === module) main().catch(async e => { console.error('[g5-case] FATAL', e); await endNamesPool(); process.exit(1) })
