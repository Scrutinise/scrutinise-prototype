/**
 * legislation-sections.ts — split a legislation-tier document that is stored as ONE giant
 * `corpus_sections` row into its natural sub-units (V33 §1).
 *
 * WHY THIS EXISTS. `docs/LEGISLATION_TRUNCATION_AND_FLAG.md` measured the legislation tier at
 * 79.2% of body words embedded, and found the loss is not spread thinly — it is concentrated in
 * a handful of rows that each hold a whole document:
 *
 *     0.5% embedded   760,509 words   eur-lex:32007B0143:1     (the 2007 EU general budget)
 *     0.6% embedded   648,822 words   eur-lex:32014B0067:1
 *    14.3% embedded             —     explanatory-notes  (410 rows for 9.2M words)
 *    65.8% embedded             —     explanatory-memoranda
 *
 * Note the `:1`. **This is a SECTIONING defect, not a chunk-cap one.** `chunk.ts` embeds at most
 * MAX_CHUNKS=8 windows ≈ 22,240 characters per row; raising the cap to 64 would still leave a
 * 760,509-word row embedding a small fraction of itself. Only splitting the document fixes it —
 * the same conclusion the committees work reached for reports (`report-sections.ts`).
 *
 * TWO INPUT SHAPES, MEASURED NOT ASSUMED (v33-probe-pathological.ts, 18 real bodies):
 *
 *   - `eur-lex` — HTML-derived, and the whole document arrives as **a single line**. There is no
 *     whitespace structure at all: `eur-lex:32007B0143:1` is 4,250,493 characters on one line.
 *     The only structure signal is the instrument's own `Article N` / `CHAPTER N` / `ANNEX N`
 *     headings, which have to be told apart from the far more numerous CROSS-REFERENCES to
 *     articles — `32001L0108` has 57 occurrences of "Article N" of which 12 are headings.
 *   - `explanatory-notes` / `explanatory-memoranda` — PDF-extracted, ~40–75 character lines with
 *     almost no blank lines, numbered paragraphs ("1.1 This explanatory memorandum…", "77. The
 *     initial UK policy…"). **The same shape the committee reports had**, so `unwrap()` from
 *     `report-sections.ts` is reused verbatim rather than re-implemented: it repairs the hard
 *     line wraps that stop "public \nhealth failures" containing "public health failures", and
 *     it already breaks before a numbered finding.
 *
 * HOW A HEADING IS TOLD FROM A REFERENCE. A heading is `Article 5 ` preceded by a sentence
 * terminator and followed by a capital or a digit. A reference is not:
 *
 *     "…laid down in Article 251 of the Treaty"      → preceded by "in ", never breaks
 *     "…in particular Article 47(2) thereof"          → no space after the number, never breaks
 *     "8. Article 20 shall be deleted"                → followed by lowercase "shall", no break
 *     "…replaced by the following: Article 21 1. The" → after ':' and before a digit — HEADING ✓
 *     "…rules of procedure. Article 2 1. No later"    → after '.' and before a digit — HEADING ✓
 *
 * Checked against every "Article N" in `eur-lex:32001L0108:1`: 12 headings found, 45 references
 * correctly left alone. A false break costs nothing but a slightly smaller section — the split
 * is lossless either way — so the rule is tuned to avoid false NEGATIVES on real headings.
 *
 * LOSSLESSNESS IS AN INVARIANT, NOT AN ASPIRATION. `assertLossless` is imported from
 * `report-sections.ts` — the same function the committee rechunk is held to, not a copy of it.
 * A document either round-trips exactly or it is skipped and counted; nothing is half-written.
 *
 * WHY THE SAME 2,500-CHARACTER TARGET AS COMMITTEES, and not something larger for legislation:
 * BM25 length normalisation is computed across the WHOLE `corpus_fts` table, not per corpus. If
 * committee findings sit at ~2,500 characters and re-sectioned legislation at ~12,000, the
 * legislation rows are systematically penalised against them for every shared query. Matching
 * the committee target is what keeps the two comparable. It also puts every section under
 * `chunk.ts`'s WHOLE_CHARS (4,096), so each embeds as exactly one whole chunk with no overlap.
 */
import { unwrap, assertLossless, splitOversizeLines, ReportSection } from './report-sections'

/** Same defaults as `report-sections.ts` — see the header note on why they match. */
export const TARGET_CHARS = parseInt(process.env.LEG_SECTION_TARGET ?? '2500', 10)
export const MAX_CHARS = parseInt(process.env.LEG_SECTION_MAX ?? '6000', 10)

/** A sentence terminator plus whitespace: the left-hand context a heading must follow. */
const TERM = `[.;:!?)”"'\\]]\\s`

/**
 * `Article 5 `, `Article 22a ` — but only after a sentence terminator and only when what
 * follows opens a provision (a capital, a digit, an opening bracket or quote). See the header
 * for the five cases this was tuned against.
 */
const ARTICLE_RE = new RegExp(`(${TERM})(Article\\s\\d{1,3}[a-z]?\\s)(?=[A-Z0-9(“"\\[])`, 'g')

/** `CHAPTER IV `, `ANNEX II `, `TITLE 2 `, `PART I `, `SECTION 3 ` — the upper-case division
 *  headings EU instruments and UK schedules both use. Upper case is required: "part 3 of the
 *  Regulation" is prose, "PART 3" is a division. */
const DIVISION_RE = new RegExp(`(${TERM})((?:ANNEX|CHAPTER|TITLE|SECTION|PART|SUBSECTION)\\s+[IVXLC0-9]{1,6}[A-Za-z]?\\s)(?=[A-Z0-9(“"\\[])`, 'g')

/** `1.1 This explanatory memorandum…`, `7.13 The instrument…` — the dotted numbering explanatory
 *  memoranda use. `unwrap()` already handles the plain `77. ` form the notes use. */
const DOTTED_PARA_RE = new RegExp(`(${TERM})(\\d{1,3}\\.\\d{1,3}\\s+)(?=[A-Z“"(])`, 'g')

/**
 * Insert a line break before each structural heading. Only ever converts whitespace that is
 * already there into a newline — never inserts or removes a character of content, which is what
 * lets the `flat()` guard below be an equality rather than an approximation.
 */
export function insertStructuralBreaks(text: string): string {
  return text
    .replace(ARTICLE_RE, '$1\n$2')
    .replace(DIVISION_RE, '$1\n$2')
    .replace(DOTTED_PARA_RE, '$1\n$2')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
}

/**
 * The structural marker a line opens with — `Article 22a`, `CHAPTER IV`, `ANNEX II`. Used both
 * as a break point and as the section title, so it is deliberately NOT extended to bare numbered
 * paragraphs: every line already starts at a paragraph boundary (the break passes above put it
 * there), so a `77.` break point would be redundant, and "77." is not a title anyone can read.
 */
export function headingOf(line: string): string | null {
  const m = /^((?:Article\s\d{1,3}[a-z]?)|(?:(?:ANNEX|CHAPTER|TITLE|SECTION|PART|SUBSECTION)\s+[IVXLC0-9]{1,6}[A-Za-z]?))(?=\s|$)/.exec(line)
  return m ? m[1] : null
}

/**
 * Partition a legislation document body into embeddable sub-units.
 * @throws if the partition is not lossless — see the header note.
 */
export function splitLegislationBody(raw: string): ReportSection[] {
  const unwrapped = unwrap(raw)
  if (!unwrapped) return []

  const structured = insertStructuralBreaks(unwrapped)
  const text = splitOversizeLines(structured, MAX_CHARS)

  // Both passes must move whitespace only. `unwrap` is allowed to change content (it mends
  // hyphenation and strips control bytes) and is the baseline; everything after it is not.
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim()
  if (flat(text) !== flat(unwrapped)) {
    throw new Error('[legislation-sections] structural/oversize split altered content — refusing to write')
  }

  const lines = text.split('\n')
  const sections: ReportSection[] = []
  let buf: string[] = []
  let bufChars = 0
  let heading: string | null = null
  let pendingHeading: string | null = null
  let startPara: number | null = null

  const flush = () => {
    if (buf.length) sections.push({ ordinal: sections.length + 1, startPara, heading, text: buf.join('\n') })
    buf = []; bufChars = 0; startPara = null
    heading = pendingHeading
  }

  for (const line of lines) {
    const h = headingOf(line)
    // A structural heading opens a new section rather than trailing the previous one — but only
    // once the current one has real content, or a run of `ANNEX I` / `CHAPTER 1` headings would
    // each become their own two-word section.
    if (h && bufChars >= TARGET_CHARS / 2) { pendingHeading = h; flush() }
    // Flush BEFORE a line that would carry the section past MAX_CHARS, not after. The committee
    // splitter only tests the ceiling on the way out, so a nearly-full buffer plus a MAX-sized
    // line yields a section of TARGET+MAX; measured on 75 real bodies that produced 20 sections
    // over the ceiling. Since `splitOversizeLines` has already capped every LINE at MAX_CHARS,
    // pre-flushing makes "no section exceeds MAX_CHARS" true by construction rather than by luck.
    if (buf.length && bufChars + line.length + 1 > MAX_CHARS) { pendingHeading = h ?? heading; flush() }
    if (!buf.length) {
      if (h) heading = h
      const num = /^(\d{1,3})[.\s]/.exec(line)
      startPara = num ? Number(num[1]) : null
    }
    buf.push(line)
    bufChars += line.length + 1
    if (bufChars >= TARGET_CHARS) { pendingHeading = heading; flush() }
  }
  pendingHeading = null
  flush()

  assertLossless(text, sections.map((s) => s.text))
  return sections
}
