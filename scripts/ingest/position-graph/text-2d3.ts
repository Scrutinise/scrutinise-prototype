/**
 * text-2d3.ts — reading a submission, and checking a quotation against it.
 *
 * The second half is the part that matters. `findExtract` is the only mechanical check in this
 * sprint on whether the model made something up: a position arrives with a passage attached, and
 * either that passage is in the document we hold or it is not. The model cannot certify its own
 * quotation, so we look.
 */
import { r2Get } from '../shared/r2-client'

/**
 * ⚠ THE CORPUS TEXT IS NOT FULLY ENTITY-DECODED, AND THAT WAS THE PILOT'S 25.9%.
 *
 * `committees-evidence` compiled text in R2 carries LITERAL HTML entities. Measured over 200 random
 * documents: **24 (12.0%) contain at least one, 5,322 occurrences** — `&#xa0;` (5,212), `&#x2011;`
 * (107), `&#xad;` (3). A model reading `Barbara&#xa0;Rayment` quotes "Barbara Rayment", which is
 * the correct reading of the document, and to a matcher that did not decode it looked exactly like
 * an invented quotation.
 *
 * This is a READ-SIDE repair for the position graph and NOT a fix to the corpus. The entities are
 * still in R2 and still in whatever the search stack indexed; that belongs to the ingest thread and
 * is reported rather than quietly papered over here.
 */
export function decodeEntities(s: string): string {
  const safe = (n: number) => (Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ')
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safe(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safe(parseInt(d, 10)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
}

/** Collapse everything a copy-out-of-HTML round trip changes, and nothing that changes meaning. */
export function normaliseForMatch(s: string): string {
  return decodeEntities(s)
    .normalize('NFKC')
    .replace(/[‘’ʼ]/g, "'")      // curly single quotes → ASCII
    .replace(/[“”]/g, '"')            // curly double quotes → ASCII
    .replace(/[‐-―−]/g, '-')     // every dash → hyphen
    .replace(/ /g, ' ')                    // nbsp
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

export interface ExtractMatch { found: boolean; offset: number | null; parts: number; partsFound: number }

/**
 * The projection matching runs on: entity-decoded, case-folded, quotes and dashes unified, and with
 * ALL whitespace removed — plus a map back to character offsets in the original string.
 *
 * ⚠ Why whitespace is REMOVED rather than collapsed. The same documents that carry raw entities
 * also carry words broken by stray spaces from the PDF/HTML extraction — "mental health ser vices",
 * "p atient records". A model quoting those writes "services" and "patient records", which is again
 * the correct reading of the document. Ignoring whitespace makes the check indifferent to an
 * artefact of our own pipeline while leaving it fully able to reject an invented sentence: every
 * letter still has to be present, in order. The `absent` cases in the pilot stayed absent under
 * this projection, which is the evidence that loosening it did not blind it.
 */
function strippedWithMap(s: string): { text: string; map: number[] } {
  const norm = decodeEntities(s).normalize('NFKC')
  let text = ''
  const map: number[] = []
  for (let i = 0; i < norm.length; i++) {
    const ch = norm[i]
    if (/[\s­​-‍﻿]/.test(ch)) continue
    let c = ch.toLowerCase()
    if ('‘’ʼ'.includes(c)) c = "'"
    else if ('“”'.includes(c)) c = '"'
    else if ('‐‑‒–—―−'.includes(c)) c = '-'
    text += c
    map.push(i)
  }
  return { text, map }
}

/**
 * Is this quotation in this document?
 *
 * An ellipsis is honoured rather than punished: a model quoting "X … Y" is eliding, not inventing,
 * so each fragment must appear IN ORDER and the match is the position of the first.
 *
 * ⚠ Fragments shorter than 12 characters are ignored rather than matched: "the" appears in every
 * document, and counting it would make the check unable to fail.
 */
export function findExtract(extract: string, docText: string): ExtractMatch {
  const doc = strippedWithMap(docText)
  const fragments = extract
    .split(/\s*(?:…|\.\.\.|\[\.\.\.\])\s*/)
    .map((f) => strippedWithMap(f).text)
    .filter((f) => f.length >= 12)
  if (!fragments.length) return { found: false, offset: null, parts: 0, partsFound: 0 }

  let cursor = 0
  let firstOffset: number | null = null
  let partsFound = 0
  for (const f of fragments) {
    const at = doc.text.indexOf(f, cursor)
    if (at < 0) break
    if (firstOffset === null) firstOffset = doc.map[at] ?? at   // offset into the ORIGINAL text
    cursor = at + f.length
    partsFound++
  }
  const found = partsFound === fragments.length
  return { found, offset: found ? firstOffset : null, parts: fragments.length, partsFound }
}

/** Fetch a compiled submission from R2. Returns null when the object is missing. */
export async function getDocText(r2Key: string): Promise<string | null> {
  const t = await r2Get(r2Key)
  return t && t.trim() ? t : null
}

/** Words, not characters — the cost model is priced in words and so is every cap in this sprint. */
export function firstWords(text: string, n: number): string {
  const words = text.split(/\s+/)
  return words.length <= n ? text : words.slice(0, n).join(' ')
}

/**
 * The submission's OWN opening line — "Written evidence submitted by X (PHS0363)".
 *
 * ⚠ This is a handover finding, not a layer this sprint builds: the concurrent Amendment 2 session
 * recorded that a per-appearance surface is unavailable because `corpus_sections.speaker` is NULL
 * on committees-evidence. It is unavailable in the DATABASE; it is present in the DOCUMENT, which
 * is in R2. `probe-2d3-header.ts` measures how often, and how often it disagrees with the API
 * submitter that 2D-1 built the entity from.
 */
/**
 * ⚠ THE FIRST VERSION OF THIS WAS ANCHORED AT CHARACTER 0 AND FOUND 15.7% OF HEADERS.
 *
 * That number was measured on 600 random documents, and then the 84% that did not parse were READ
 * rather than assumed away. The header was present in most of them; the regex was wrong in three
 * specific ways, all visible in the openings:
 *
 *     "FSH0146 - Evidence on Fisheries Written evidence submitted by Mr James Vernon (FSH0146)"
 *      ↑ the internal reference and a title come FIRST — an anchored pattern can never match
 *     "Written Evidence from the Department for Work and Pensions DES0051"
 *      ↑ "from", with the reference AFTER the name and no brackets
 *     "Science Education Policy Alliance – Written evidence ( EDU 0099 )"
 *      ↑ the name comes BEFORE the phrase, and the reference has spaces inside the brackets
 *     "Submission to the International Development Committee by Rotary International"
 *      ↑ "Submission … by", which the pattern did not know about at all
 *
 * The patterns are ordered most-specific first and tried over the first 400 characters rather than
 * from the start. A name is only accepted if it survives `plausibleSubmitter`.
 */
const HEADER_PATTERNS: RegExp[] = [
  // "…Written evidence submitted by X (ABC0123)" / "submission from X"
  // ⚠ the BARE reference code is one of the terminators. Without it the lazy capture runs past
  // "the Department for Work and Pensions" and swallows "DES0051 Devolution of Employmen" too —
  // caught by the self-test on that exact opening, not by reading the pattern.
  /(?:written|oral|supplementary|further|additional|joint|revised)?\s*evidence\s+(?:submitted|submission)?\s*(?:by|from)\s+(.{2,180}?)\s*(?:\(\s*[A-Z]{2,6}\s?\d{2,5}\s*\)|\s[A-Z]{2,6}\s?\d{2,5}\b|$|\.|;)/i,
  // "Written Evidence from the Department for Work and Pensions DES0051"
  /written\s+evidence\s+from\s+(.{2,180}?)\s*(?:\(?\s*[A-Z]{2,6}\s?\d{2,5}\s*\)?|$|\.|;)/i,
  // "Science Education Policy Alliance – Written evidence ( EDU 0099 )" — name BEFORE the phrase
  /(?:^|\.\s|\)\s)\s*([A-Z][^.;()]{3,120}?)\s*[–—-]\s*written\s+evidence/i,
  // "Submission to the X Committee by Rotary International on the …"
  /submission\s+to\s+the\s+[^.;]{3,90}?\s+by\s+(.{2,120}?)\s*(?:\s+on\s+the\s|\(|$|\.|;)/i,
  // "EVIDENCE OF THE UK ENVIRONMENTAL LAW ASSOCIATION TO THE HOUSE OF COMMONS …"
  /evidence\s+of\s+(.{3,120}?)\s+to\s+the\s+(?:house|select|committee)/i,
]
const REFERENCE_RE = /\(?\s*\b([A-Z]{2,6})\s?(\d{2,5})\b\s*\)?/

/**
 * A captured string that is not a body's name. Without this the looser patterns happily return
 * "the Committee's call for evidence on" — a longer match is not a better one.
 */
export function plausibleSubmitter(s: string): boolean {
  const t = s.trim()
  if (t.length < 3 || t.length > 160) return false
  if (!/[a-z]/.test(t)) return /^[A-Z][A-Z .'&-]{4,}$/.test(t)   // an ALL-CAPS body name is fine
  if (/^(the\s+)?(committee|inquiry|call for evidence|following|this|our|these|above|attached)\b/i.test(t)) return false
  return /[A-Za-z]{3}/.test(t)
}

export function parseDocumentHeader(text: string): { submitter: string | null; reference: string | null } {
  const head = decodeEntities(text.slice(0, 600)).replace(/\s+/g, ' ')
  const refM = REFERENCE_RE.exec(head)
  const reference = refM ? `${refM[1]}${refM[2]}` : null
  for (const re of HEADER_PATTERNS) {
    const m = re.exec(head)
    if (!m?.[1]) continue
    let submitter = m[1].trim().replace(/^[-–—,;:.\s]+|[-–—,;:.\s]+$/g, '')
    // "…by the Champs Public Health Collaborative on behalf of nine councils" — first named body only.
    submitter = submitter.split(/\s+(?:on behalf of|in partnership with|and others)\s+/i)[0].trim()
    // A leading reference code that crept into the capture.
    submitter = submitter.replace(/^[A-Z]{2,6}\s?\d{2,5}\s*[-–—:]?\s*/, '').trim()
    if (plausibleSubmitter(submitter)) return { submitter, reference }
  }
  return { submitter: null, reference }
}

// ── offline self-test ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const doc = 'Written evidence submitted by NHS Providers (PHS0616)\nWe believe that Section 21 '
    + 'no-fault eviction should be abolished, and we say so plainly. Funding must rise.'
  const cases: Array<[string, boolean]> = [
    ['verbatim quotation is found', findExtract('Section 21 no-fault eviction should be abolished', doc).found],
    ['curly-quote and dash normalisation', findExtract('Section 21 no‑fault eviction should be abolished', doc).found],
    ['a fabricated quotation is NOT found', !findExtract('We call for a total ban on private landlords', doc).found],
    ['an elided quotation is found', findExtract('We believe that Section 21 … Funding must rise', doc).found],
    ['elision OUT OF ORDER is not found', !findExtract('Funding must rise … We believe that Section 21', doc).found],
    ['a too-short fragment cannot carry a match', !findExtract('the', doc).found],
    ['offset points into the ORIGINAL document text',
      doc.slice(findExtract('Funding must rise', doc).offset ?? 0).startsWith('Funding must rise')],
    // ── the pilot's 25.9%, each cause turned into a test ──
    ['a literal &#xa0; in the document does not break a match',
      findExtract('Barbara Rayment, Chair', 'Panel: Barbara&#xa0;Rayment,&#xa0;Chair, Children and Young').found],
    ['a word broken by a stray space does not break a match',
      findExtract('poor transfer of care from child to adult mental health services',
        'x poor transfer of care from child to adult mental health ser vices y').found],
    ['a soft hyphen does not break a match',
      findExtract('preventative care', 'we favour preven­tative care throughout').found],
    ['⚠ NEGATIVE CONTROL — loosening whitespace did NOT blind the check',
      !findExtract('we call for the immediate abolition of the private rented sector', doc).found],
    ['⚠ NEGATIVE CONTROL — a plausible paraphrase is still rejected',
      !findExtract('Section 21 no-fault evictions ought to be scrapped entirely', doc).found],
    ['header submitter parsed', parseDocumentHeader(doc).submitter === 'NHS Providers'],
    ['header reference parsed', parseDocumentHeader(doc).reference === 'PHS0616'],
    ['supplementary header parsed', parseDocumentHeader('Supplementary written evidence submitted by The National Organisation for FASD (PHS0622) The following').submitter === 'The National Organisation for FASD'],
    ['on-behalf-of trimmed', parseDocumentHeader('Written evidence submitted by the Champs Public Health Collaborative on behalf of nine councils (PHS0363)').submitter === 'the Champs Public Health Collaborative'],
    ['a document with no header returns null', parseDocumentHeader('Q1 Chair: Good morning everyone.').submitter === null],
    // ── the four real openings the anchored pattern could not reach, each taken verbatim ──
    ['reference and title BEFORE the phrase',
      parseDocumentHeader('FSH0146 - Evidence on Fisheries Written evidence submitted by Mr James Vernon (FSH0146) Le').submitter === 'Mr James Vernon'],
    ['"Written Evidence from X" with a trailing reference',
      parseDocumentHeader('Written Evidence from the Department for Work and Pensions DES0051 Devolution of Employmen').submitter === 'the Department for Work and Pensions'],
    ['name BEFORE the phrase, spaced reference',
      parseDocumentHeader('Science Education Policy Alliance – Written evidence ( EDU 0099 ) Following a meeting wi').submitter === 'Science Education Policy Alliance'],
    ['"Submission to the X Committee by Y"',
      parseDocumentHeader('Submission to the International Development Committee by Rotary International on the Impac').submitter === 'Rotary International'],
    ['"EVIDENCE OF X TO THE HOUSE OF COMMONS"',
      parseDocumentHeader('EVIDENCE OF THE UK ENVIRONMENTAL LAW ASSOCIATION TO THE HOUSE OF COMMONS EUROPEAN SCRUTINY').submitter === 'THE UK ENVIRONMENTAL LAW ASSOCIATION'],
    ['a reference is read even when no name is',
      parseDocumentHeader('COE0010 Some prose with no recognisable submitter phrase at all here.').reference === 'COE0010'],
    // ⚠ negative controls: a looser pattern must not start returning boilerplate as a body.
    ['"the Committee" is not a submitter', !plausibleSubmitter('the Committee')],
    ['"the following" is not a submitter', !plausibleSubmitter('The following evidence')],
    ['a real body is a plausible submitter', plausibleSubmitter('Royal College of Nursing')],
    ['an ALL-CAPS body name is a plausible submitter', plausibleSubmitter('THE UK ENVIRONMENTAL LAW ASSOCIATION')],
  ]
  let bad = 0
  for (const [name, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) selftest()
