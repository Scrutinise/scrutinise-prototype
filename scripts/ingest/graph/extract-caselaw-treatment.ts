/**
 * extract-caselaw-treatment.ts — BRIEF_GRAPH_5 §3. HOW COURTS HAVE TREATED IT.
 *
 * ⚠⚠⚠ THE LINE THIS FILE MUST NOT CROSS. We never say a provision or a case is "no longer good
 * law". That is a legal conclusion, people act on it, and being wrong about it could cost somebody
 * badly. **We report the treatment, quote the words, cite the judgment, and let the reader
 * conclude.** There is no column in `caselaw_treatment_edge` that could hold such a conclusion and
 * nothing here computes one.
 *
 * ── WHAT THIS DOES ───────────────────────────────────────────────────────────
 *
 * Finds a formulaic treatment phrase (`treatment-patterns.ts`), identifies WHAT it is about, and
 * stores the court's own sentence beside it with the court and the date.
 *
 * ── ⚠⚠ THE THREE WAYS THIS COULD PRODUCE A CONFIDENT WRONG ANSWER ────────────
 *
 * 1. **Polarity.** Handled in `treatment-patterns.ts` by ordering and by `negated()`.
 *
 * 2. **Direction.** "*Smith was overruled in Jones*" — the subject is Smith, and the nearest
 *    citation is Jones. Every pattern declares which side its subject is on, and a match whose
 *    subject is not on that side is REFUSED, never satisfied from the other.
 *
 * 3. **Ambiguity.** "*We follow Smith but decline to follow Brown*" — two subjects, two
 *    treatments, one sentence. ⚠ **Where more than one candidate subject sits on the declared side
 *    of the phrase, this REFUSES and counts the refusal.** It does not take the nearest.
 *    §2.2's rule generalises: an honest flat list beats a confident wrong ranking, and a citator
 *    that names the wrong case as overruled is worse than one that says nothing.
 *
 * ⚠ The refusal counters are printed with the results and reported in `GRAPH_5_REPORT.md`. A
 * refusal that is merely absent from the output is indistinguishable from a phrase nobody wrote.
 *
 * ── AND WHAT IS DELIBERATELY NOT CLASSIFIED ──────────────────────────────────
 *
 * ⚠ "Considered" and "mentioned" are not treatments and there is no pattern for them. **Most
 * citations are exactly that, and leaving them unclassified is the honest result**, not a gap.
 *
 *   npx tsx graph/extract-caselaw-treatment.ts --pilot 800   # no writes; prints every hit
 *   npx tsx graph/extract-caselaw-treatment.ts               # full, resumable
 */
import fs from 'fs'
import path from 'path'
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { parseLegUri } from './graph-common'
import { identitiesFor, loadIdentityBridge } from './identity'
import { extractCitations, normaliseCitation } from '../caseref/citations'
import { findTreatments, Treatment, Direction } from './treatment-patterns'
import { TREATMENT_TABLE } from './setup-caselaw-edge-tables'

const CORPUS = 'tna-caselaw'
const CHECKPOINT = path.join(__dirname, 'caselaw-treatment-checkpoint.json')
const CONCURRENCY = parseInt(process.env.G5_CONCURRENCY ?? '32', 10)
const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu']
const PILOT = (() => { const i = process.argv.indexOf('--pilot'); return i >= 0 ? parseInt(process.argv[i + 1] ?? '800', 10) : 0 })()

/**
 * ⚠⚠ A SECOND COPY OF A MAP THAT MUST AGREE WITH ANOTHER FILE, AND IT IS DECLARED AS SUCH.
 *
 * The original is `COURT_FROM_NEUTRAL` in `caseref/build-records.ts`. That file belongs to the
 * INGEST stream and this sprint may not edit it (§5), so the change needed there — `export` the
 * const — is REPORTED rather than made, and until it happens there are two copies.
 *
 * ⚠ The regnal-year trap appeared in four code paths because a fix went into one of two places
 * that had to agree WITH NO CHECK THAT THEY AGREED. So `check-graph5-treatment.ts` reads
 * `build-records.ts` and fails if any pair here is missing or different there. Two copies with a
 * check is a stopgap; two copies without one is the bug.
 */
export const COURT_FROM_NEUTRAL: Record<string, string> = {
  UKSC: 'Supreme Court', UKHL: 'House of Lords', UKPC: 'Privy Council',
  EWCA: 'Court of Appeal (England and Wales)', EWHC: 'High Court (England and Wales)',
  EWCOP: 'Court of Protection', EWFC: 'Family Court', UKUT: 'Upper Tribunal',
  UKFTT: 'First-tier Tribunal', UKEAT: 'Employment Appeal Tribunal', EAT: 'Employment Appeal Tribunal',
  CSIH: 'Court of Session (Inner House)', CSOH: 'Court of Session (Outer House)',
  HCJAC: 'High Court of Justiciary (Appeal Court)', NICA: 'Court of Appeal (Northern Ireland)',
  NIQB: "High Court (Northern Ireland, Queen's Bench)",
}

export function courtOf(sectionId: string): string | null {
  const series = sectionId.match(/\[\d{4}\]\s+([A-Z]+)/)?.[1]
  return series ? (COURT_FROM_NEUTRAL[series] ?? null) : null
}

export const stats = {
  docs: 0, phrases: 0, rows: 0,
  refusedNoSubject: 0, refusedAmbiguous: 0, refusedSelfCitation: 0, refusedIncoherent: 0,
  refusedUncitedName: 0,
  caseSubjects: 0, provisionSubjects: 0,
}

/**
 * A case NAME carrying no citation of its own: "ex parte Belsham", "Reg v Central Criminal Court",
 * "Smith v Jones". ⚠ Deliberately loose — it is used ONLY to refuse, never to resolve, so a false
 * positive costs a row and a false negative costs a wrong attribution.
 */
const UNCITED_CASE_NAME =
  /\b(?:ex\s+p(?:arte)?\.?\s+[A-Z]|R(?:eg)?\.?\s+v\.?\s+[A-Z]|[A-Z][A-Za-z'’-]+\s+v\.?\s+[A-Z])/

type Ref = { start: number; end: number; href: string }
type Para = { start: number; end: number; num: string | null }

/**
 * Flatten the judgment body to plain text WHILE RECORDING where each legislation ref and each
 * numbered paragraph landed. A separate flatten-then-search pass cannot do this: once the tags are
 * gone there is no way back to which characters were inside a `<ref>`, and matching by the ref's
 * words instead would attach a treatment to the wrong occurrence of "section 3".
 */
export function flattenWithRefs(xml: string): { text: string; refs: Ref[]; paras: Para[] } {
  const bodyAt = xml.indexOf('<judgmentBody')
  const body = bodyAt >= 0 ? xml.slice(bodyAt) : xml
  const refs: Ref[] = []
  const paras: Para[] = []
  const openParas: Array<{ start: number; num: string | null; depth: number }> = []
  // ⚠ Parts + a running length, joined ONCE at the end. A judgment is up to ~180 KB of XML over
  // thousands of tags, and `text += decoded` inside that loop makes a fresh intermediate for every
  // one of them; with several judgments in flight the process was killed for memory twice.
  // Offsets are still exact because `len` is maintained alongside.
  const parts: string[] = []
  let len = 0
  let i = 0
  let refStart = -1, refHref = ''
  // ⚠ `<num>` content is read back off the parts written since the tag opened. A first version
  // declared a `pendingNum` accumulator and never wrote to it, so every paragraph number came out
  // '' → null and the anchor column would have been empty for the whole corpus while looking
  // implemented.
  let numStart = -1, numPartIdx = -1

  const TAG = /<\/?([A-Za-z][\w:.-]*)\b([^>]*)>/g
  let m: RegExpExecArray | null
  const push = (s: string) => {
    if (!s) return
    const decoded = s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#?\w+;/g, ' ')
    parts.push(decoded)
    len += decoded.length
  }

  while ((m = TAG.exec(body)) !== null) {
    push(body.slice(i, m.index))
    i = m.index + m[0].length
    const closing = m[0].startsWith('</')
    const name = m[1]
    if (name === 'ref' && !closing) {
      if (/uk:type="legislation"/.test(m[2])) { refStart = len; refHref = m[2].match(/href="([^"]*)"/)?.[1] ?? '' }
    } else if (name === 'ref' && closing && refStart >= 0) {
      refs.push({ start: refStart, end: len, href: refHref }); refStart = -1
    } else if (name === 'num') {
      if (!closing) { numStart = len; numPartIdx = parts.length }
      else if (numStart >= 0 && openParas.length && openParas[openParas.length - 1].num === null) {
        // ⚠ only the parts written since <num> opened — a handful, not the whole document
        openParas[openParas.length - 1].num =
          parts.slice(numPartIdx).join('').replace(/\s+/g, ' ').trim() || null
        numStart = -1; numPartIdx = -1
      }
    } else if (name === 'paragraph' && !closing) {
      openParas.push({ start: len, num: null, depth: openParas.length })
    } else if (name === 'paragraph' && closing) {
      const p = openParas.pop()
      if (p) paras.push({ start: p.start, end: len, num: p.num })
    }
  }
  push(body.slice(i))
  const text = parts.join('')

  // collapse whitespace while keeping a usable offset map: replace runs in place
  // ⚠ done with a same-length substitution so every recorded offset stays valid.
  const flat = text.replace(/\s+/g, s => ' '.repeat(s.length))
  return { text: flat, refs, paras }
}

/** ⚠ The sentence the phrase sits in — the bound within which a subject may be attributed. */
export function sentenceBounds(text: string, at: number): { from: number; to: number } {
  let from = 0
  for (let i = at - 1; i > 1; i--) {
    if (text[i] === ' ' && text[i - 1] === '.' && /[A-Z“"']/.test(text[i + 1] ?? '')) { from = i + 1; break }
    if (at - i > 700) { from = i; break }
  }
  let to = text.length
  for (let i = at; i < text.length - 2; i++) {
    if (text[i] === '.' && text[i + 1] === ' ' && /[A-Z“"']/.test(text[i + 2] ?? '')) { to = i + 1; break }
    if (i - at > 700) { to = i; break }
  }
  return { from, to }
}

export type TreatmentRow = {
  judgmentId: string; judgmentUri: string; court: string | null; judgmentDate: string | null
  subjectType: 'case' | 'provision'
  subjectCitation: string | null; subjectUri: string | null
  subjectActId: string | null; subjectProvRef: string | null
  treatment: Treatment; sentence: string; matchedPhrase: string; patternId: string
  paragraphNum: string | null
}

export function extractTreatments(
  sectionId: string, xml: string, held: Set<string>, itemDate: string | null,
): TreatmentRow[] {
  stats.docs++
  const { text, refs, paras } = flattenWithRefs(xml)
  const judgmentUri = xml.match(/<FRBRWork>[\s\S]*?<FRBRthis value="([^"]*)"/)?.[1] ?? sectionId
  const court = courtOf(sectionId)
  // ⚠ the judgment's own citation is not a subject — 88% of judgments cite themselves in the header
  const ownCitation = normaliseCitation(sectionId.match(/\[(?:[^\]]+)\][^:]*/)?.[0]?.trim() ?? '')
  const cites = extractCitations(text)
  const out: TreatmentRow[] = []

  for (const hit of findTreatments(text)) {
    stats.phrases++
    const { from, to } = sentenceBounds(text, hit.index)
    const after = hit.direction === 'after'
    // candidates on the DECLARED side only
    const caseCands = cites.filter(c =>
      c.index >= from && c.index < to &&
      (after ? c.index >= hit.index + hit.length : c.index + c.raw.length <= hit.index))
    const provCands = refs.filter(r =>
      r.start >= from && r.start < to &&
      (after ? r.start >= hit.index + hit.length : r.end <= hit.index))

    const selfOnly = caseCands.length > 0 && caseCands.every(c => normaliseCitation(c.raw) === ownCitation)
    if (selfOnly && provCands.length === 0) { stats.refusedSelfCitation++; continue }
    const cands = caseCands.filter(c => normaliseCitation(c.raw) !== ownCitation)

    const total = cands.length + provCands.length
    if (total === 0) { stats.refusedNoSubject++; continue }
    // ⚠⚠ MORE THAN ONE CANDIDATE = REFUSE. Not "take the nearest".
    if (total > 1) { stats.refusedAmbiguous++; continue }

    // ⚠⚠⚠ AN UNCITED CASE NAME BETWEEN THE CANDIDATE AND THE PHRASE MEANS WE HAVE THE WRONG CASE.
    //
    // Real example, and it produced a false statement about a named authority:
    //   "…ex parte DPP [1994] 1 AC 9), during the course of which, both ex parte Belsham and a
    //    similar decision in Reg v Central Criminal Court ex parte Randle WERE EXPRESSLY OVERRULED"
    //
    // The cases overruled are Belsham and Randle. [1994] 1 AC 9 is Re Ashton — the case that DID
    // the overruling. Belsham and Randle are named without citations, so `extractCitations` cannot
    // see them, and the only visible candidate on the declared side belongs to the overruling
    // vehicle. The direction rule was right and still produced the wrong answer, because the
    // subject it wanted was invisible.
    //
    // ⚠ So: if a case NAME with no citation of its own sits between the candidate and the phrase,
    // that name is the more likely subject and we cannot identify it. REFUSE. This only ever
    // removes rows — it can never attribute a treatment to something new — and §0 makes the trade
    // obvious: naming the wrong case as overruled is the most consequential error available here.
    if (cands.length === 1) {
      const gapFrom = after ? hit.index + hit.length : cands[0].index + cands[0].raw.length
      const gapTo = after ? cands[0].index : hit.index
      const gap = text.slice(gapFrom, gapTo)
      if (UNCITED_CASE_NAME.test(gap)) { stats.refusedUncitedName++; continue }
    }

    const sentence = text.slice(from, to).replace(/\s+/g, ' ').trim().slice(0, 1200)
    if (!sentence) continue
    // ⚠⚠ THE INVARIANT THAT MAKES THE EVIDENCE CHECKABLE: the stored sentence must actually
    // contain the phrase the pattern fired on. If it does not, the quote and the classification
    // describe different pieces of text and a reader checking the row would find nothing — the
    // worst failure available here, because the row still LOOKS like evidence. This can happen
    // whenever the sentence bound clips before the phrase, or an offset drifts. Counted, dropped.
    if (!sentence.includes(hit.phrase.replace(/\s+/g, ' ').trim())) { stats.refusedIncoherent++; continue }
    const para = paras.find(p => hit.index >= p.start && hit.index < p.end && p.num)
    const paragraphNum = para?.num ? para.num.replace(/\.$/, '').trim() || null : null

    const base = {
      judgmentId: sectionId, judgmentUri, court, judgmentDate: itemDate,
      treatment: hit.treatment as Treatment, sentence,
      matchedPhrase: hit.phrase.trim(), patternId: hit.patternId, paragraphNum,
    }
    if (cands.length === 1) {
      stats.caseSubjects++
      out.push({ ...base, subjectType: 'case', subjectCitation: normaliseCitation(cands[0].raw), subjectUri: null, subjectActId: null, subjectProvRef: null })
    } else {
      const r = provCands[0]
      const target = parseLegUri(r.href)
      if (!target) { stats.refusedNoSubject++; continue }
      let actId: string | null = target.gid
      if (!held.has(target.gid)) actId = identitiesFor(target.gid).find(id => held.has(id)) ?? target.gid
      stats.provisionSubjects++
      out.push({ ...base, subjectType: 'provision', subjectCitation: null, subjectUri: r.href, subjectActId: actId, subjectProvRef: target.sectionRef })
    }
  }
  stats.rows += out.length
  return out
}

async function insertRows(rows: TreatmentRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const pool = namesPool()
  let written = 0
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const tuples = batch.map((r, j) => {
      values.push(r.judgmentId, r.judgmentUri, r.court, r.judgmentDate, r.subjectType, r.subjectCitation,
        r.subjectUri, r.subjectActId, r.subjectProvRef, r.treatment, r.sentence, r.matchedPhrase,
        r.patternId, r.paragraphNum)
      const b = j * 14
      return `(${Array.from({ length: 14 }, (_, k) => `$${b + k + 1}`).join(',')})`
    })
    const res = await pool.query(
      `INSERT INTO ${TREATMENT_TABLE}
       (judgment_id, judgment_uri, court, judgment_date, subject_type, subject_citation,
        subject_uri, subject_act_id, subject_prov_ref, treatment, sentence, matched_phrase,
        pattern_id, paragraph_num)
       VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`, values)
    written += res.rowCount ?? 0
  }
  return written
}

async function mapPool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i]) }
  }))
}

async function main() {
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done: Set<string> = PILOT || !fs.existsSync(CHECKPOINT)
    ? new Set() : new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done)

  const pool = namesPool()
  const { rows: heldRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) AS gid FROM corpus_sections
      WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = new Set<string>(heldRows.map((r: { gid: string }) => r.gid))
  loadIdentityBridge()

  const all = (await pool.query(
    `SELECT id, "r2RawKey", "itemDate"::text AS d FROM corpus_sections
      WHERE corpus=$1 AND "r2RawKey" IS NOT NULL ORDER BY id`, [CORPUS])).rows
  let scope = all.filter((r: { id: string }) => !done.has(r.id))
  if (PILOT) { const step = Math.max(1, Math.floor(all.length / PILOT)); scope = all.filter((_: unknown, i: number) => i % step === 0).slice(0, PILOT) }
  console.log(`[g5-treat] ${scope.length.toLocaleString()} of ${all.length.toLocaleString()} judgments${PILOT ? ' (PILOT — NO WRITES)' : ''}`)

  let written = 0, batch: TreatmentRow[] = []
  const sample: TreatmentRow[] = []
  await mapPool(scope, CONCURRENCY, async (r: { id: string; r2RawKey: string; d: string | null }) => {
    const xml = await r2Get(r.r2RawKey)
    if (!xml) return
    const rows = extractTreatments(r.id, xml, held, r.d)
    if (PILOT) { sample.push(...rows); done.add(r.id); return }
    batch.push(...rows); done.add(r.id)
    if (batch.length >= 1000) {
      const b = batch; batch = []
      written += await insertRows(b)
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done], written, at: new Date().toISOString() }))
      console.log(`  … ${stats.docs.toLocaleString()} judgments, ${written.toLocaleString()} treatment rows`)
    }
  })
  if (!PILOT && batch.length) written += await insertRows(batch)
  if (!PILOT) fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done], written, at: new Date().toISOString() }))

  const pc = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '—'
  console.log(`\n══ §3 TREATMENT ══`)
  console.log(`  judgments read                     ${stats.docs.toLocaleString()}`)
  console.log(`  treatment phrases found            ${stats.phrases.toLocaleString()}`)
  console.log(`  edges built                        ${stats.rows.toLocaleString()}  ${pc(stats.rows, stats.phrases)} of phrases`)
  console.log(`    subject is a CASE                ${stats.caseSubjects.toLocaleString()}`)
  console.log(`    subject is a PROVISION           ${stats.provisionSubjects.toLocaleString()}`)
  console.log(`\n  ⚠ REFUSALS — counted, because a refusal that is merely absent looks like a phrase nobody wrote:`)
  console.log(`    no subject on the declared side  ${stats.refusedNoSubject.toLocaleString()}  ${pc(stats.refusedNoSubject, stats.phrases)}`)
  console.log(`    MORE THAN ONE candidate subject  ${stats.refusedAmbiguous.toLocaleString()}  ${pc(stats.refusedAmbiguous, stats.phrases)}`)
  console.log(`    only the judgment's own citation ${stats.refusedSelfCitation.toLocaleString()}  ${pc(stats.refusedSelfCitation, stats.phrases)}`)
  console.log(`    ⚠⚠ sentence did NOT contain its own phrase ${stats.refusedIncoherent.toLocaleString()}  ${pc(stats.refusedIncoherent, stats.phrases)}`)
  console.log(`    ⚠⚠⚠ an UNCITED case name sits nearer the phrase ${stats.refusedUncitedName.toLocaleString()}  ${pc(stats.refusedUncitedName, stats.phrases)}`)
  if (PILOT) {
    const byT: Record<string, number> = {}
    for (const s of sample) byT[`${s.subjectType}:${s.treatment}`] = (byT[`${s.subjectType}:${s.treatment}`] ?? 0) + 1
    console.log(`\n  by treatment: ${Object.entries(byT).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ')}`)
    console.log(`\n  PILOT — nothing written. First 14 edges, with the court's own words:`)
    sample.slice(0, 14).forEach((s, i) => {
      console.log(`\n   ${i + 1}. ${s.treatment.toUpperCase()} — ${s.subjectType}: ${s.subjectCitation ?? s.subjectUri}`)
      console.log(`      by ${s.court ?? '(court not derivable)'} in ${s.judgmentId}${s.paragraphNum ? ` at para ${s.paragraphNum}` : ''} (${s.judgmentDate ?? 'undated'})`)
      console.log(`      phrase : "${s.matchedPhrase}"  [${s.patternId}]`)
      console.log(`      words  : ${s.sentence.slice(0, 260)}`)
    })
  } else {
    console.log(`\n  rows written to ${TREATMENT_TABLE}: ${written.toLocaleString()}`)
  }
  await endNamesPool()
}

if (require.main === module) main().catch(async e => { console.error('[g5-treat] FATAL', e); await endNamesPool(); process.exit(1) })
