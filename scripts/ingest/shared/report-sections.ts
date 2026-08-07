/**
 * report-sections.ts — split a committee report body into per-finding sections (V32).
 *
 * WHY THIS EXISTS. The committees ingest stores one `corpus_sections` row per DOCUMENT, so a
 * whole committee report — up to 455,137 characters — is a single row and therefore a single
 * document in both search layers. That breaks both of them, in different ways:
 *
 *   - BM25 (live today): length normalisation buries a 68,000-word document. `Coronavirus:
 *     lessons learned to date` DOES contain "gradual and incremental", and GOLD_TEST_09's
 *     depth-200 probe never saw it, because the document could not rank at that length.
 *   - Vector (flag off): chunk.ts caps at MAX_CHUNKS=8 windows ≈ 22,240 characters, so only
 *     24.4% of committee report words are ever embedded. The rest is silently dropped.
 *
 * Splitting per finding fixes both for this corpus without touching the shared chunker: each
 * section is short enough to rank on its own and short enough to embed whole.
 *
 * THE SECOND DEFECT THIS FIXES. Text extracted from a report PDF keeps the PDF's own hard line
 * breaks and its justification spacing:
 *
 *     "…rank as one of the most important public \nhealth failures the United Kingdom has…"
 *     "housing  and  working  conditions  played  a  significant  role."
 *
 * so the substring "most important public health failures" is not present in the stored bytes
 * even though the sentence plainly is. That is why GOLD_TEST_09 scored that phrase absent.
 * `unwrap()` repairs it, and that repair is what makes phrase-level matching mean anything.
 *
 * STRUCTURE SIGNAL. Measured over a 12-report sample: these PDFs extract as ~71-character
 * lines with almost NO blank lines, so paragraph breaks are not recoverable from whitespace.
 * The reliable signal is the report's own numbered findings ("77. The initial UK policy…"),
 * present in every substantive report in the sample and absent only from procedural ones
 * ("Documents considered by the Committee", "3 Statutory Instruments reported").
 *
 * LOSSLESSNESS IS AN INVARIANT, NOT AN ASPIRATION. The split is a pure partition: no overlap,
 * nothing dropped. `splitReportBody` asserts that rejoining the sections reproduces the
 * unwrapped input exactly, and throws if it does not. A chunker that quietly lost a chapter
 * would be indistinguishable from the bug this sprint exists to fix.
 */

/** Target characters per section. ~2.5k ≈ 400 words ≈ two or three numbered findings — under
 *  chunk.ts's WHOLE_CHARS (4096), so each section embeds as exactly one whole chunk. */
export const TARGET_CHARS = parseInt(process.env.REPORT_SECTION_TARGET ?? '2500', 10)
/** Flush at this size even mid-run. A single indivisible unit longer than this is still
 *  emitted whole — splitting a finding mid-sentence would be worse than one long section. */
export const MAX_CHARS = parseInt(process.env.REPORT_SECTION_MAX ?? '6000', 10)

export interface ReportSection {
  /** 1-based position in the report. */
  ordinal: number
  /** The numbered finding this section starts at, when the report is numbered. */
  startPara: number | null
  /** The most recent heading-looking line at or before this section, when one was found. */
  heading: string | null
  text: string
}

/** Stands in for a genuine paragraph break while every PDF line wrap is joined away. U+0001
 *  cannot occur in extracted document text, so it survives the join and nothing else matches it.
 *  Written as an escape, not as a literal control character — a literal one is invisible in a
 *  diff and does not survive a copy/paste. */
const PARA_SENTINEL = '\u0001'

/**
 * Repair PDF-extracted text: rejoin hard-wrapped lines, mend words hyphenated across a break,
 * collapse justification spacing. Returns paragraph-per-line text.
 *
 * Order matters. De-hyphenation must happen while the line breaks are still there, and the
 * numbered-finding breaks must be inserted after the wrap-join, because a finding marker is
 * frequently mid-line in the extracted text.
 */
export function unwrap(raw: string): string {
  // FIRST, and for two reasons. (a) PDF extraction leaves C0 control bytes in the text, and a
  // NUL reaching a `sectionTitle` is rejected by Postgres outright — `invalid byte sequence for
  // encoding "UTF8": 0x00` (22021), which is how the full pass first died at publication 275 of
  // 3,802. docs/CLAUDE.md §13 lists this contamination class explicitly. (b) It guarantees the
  // text cannot already contain PARA_SENTINEL, which would otherwise forge a paragraph break.
  // Tabs and newlines are kept — the wrap-joining below needs them.
  let t = (raw ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  t = t.replace(/\r\n?/g, '\n')
  // "inde-\npendent" → "independent", before the line breaks are joined away
  t = t.replace(/([A-Za-z])-\n[ \t]*([a-z])/g, '$1$2')
  // blank lines are genuine paragraph breaks where they survive extraction — keep them as \n
  t = t.replace(/\n[ \t]*\n+/g, PARA_SENTINEL)
  // every remaining newline is a PDF line wrap. THIS is the repair that makes
  // "public \nhealth failures" contain the substring "public health failures".
  t = t.replace(/[ \t]*\n[ \t]*/g, ' ')
  // justification spacing: "housing  and  working" → "housing and working"
  t = t.replace(/[ \t]{2,}/g, ' ')
  t = t.replace(new RegExp(PARA_SENTINEL, "g"), '\n')
  // Break before each numbered finding. Requires a sentence end (or start of line) before it,
  // so a figure reference mid-sentence — "as table 12. shows" — cannot open a finding.
  t = t.replace(/([.!?:”"'\)]\s+)(\d{1,3}\.\s+)(?=[A-Z“"'(])/g, '$1\n$2')
  return t.split('\n').map(l => l.trim()).filter(Boolean).join('\n')
}

/** Looks like a heading: short, no terminal sentence punctuation, starts with a capital. */
function isHeading(line: string): boolean {
  if (line.length < 4 || line.length > 80) return false
  if (/[.;:,]$/.test(line)) return false
  if (!/^[A-Z0-9“"']/.test(line)) return false
  return (line.match(/ /g) ?? []).length <= 10
}

/**
 * Split into indivisible units — one numbered finding each where the report is numbered,
 * otherwise one line of the unwrapped text.
 *
 * The sequence guard earns its place: a bare "9980." in a table of figures matched the naive
 * pattern on `The Remediation of Dangerous Cladding`. A number only opens a finding if it
 * continues the run, allowing a small forward jump for a chapter break and a reset to 1.
 */
function toUnits(text: string): Array<{ text: string; para: number | null }> {
  const units: Array<{ text: string; para: number | null }> = []
  let lastNo = 0
  for (const line of text.split('\n')) {
    const m = /^(\d{1,3})\.\s+(?=[A-Z“"'(])/.exec(line)
    if (m) {
      const n = Number(m[1])
      if (n === lastNo + 1 || (n === 1 && lastNo > 1) || (n > lastNo && n - lastNo <= 3)) {
        units.push({ text: line, para: n }); lastNo = n; continue
      }
    }
    units.push({ text: line, para: null })
  }
  return units
}

/**
 * Break any line longer than `limit` at word boundaries.
 *
 * WHY THIS IS NEEDED, found by the check script rather than by reasoning: a "unit" is only
 * indivisible because a numbered finding should not be cut mid-sentence — but a body whose
 * sentence punctuation did not survive PDF extraction yields ONE unit for the whole report,
 * and the size-based flush cannot split it. The first fixture run produced a single 15,830-
 * character section from a 60-finding input. Without this, the worst-case report — precisely
 * the kind this sprint exists to fix — would come out as one blob again.
 *
 * Operates on the text BEFORE partitioning, so the sections still rejoin to it exactly.
 */
function splitOversizeLines(text: string, limit: number): string {
  return text.split('\n').flatMap((line) => {
    if (line.length <= limit) return [line]
    const out: string[] = []
    let rest = line
    while (rest.length > limit) {
      let cut = rest.lastIndexOf(' ', limit)
      if (cut <= 0) cut = limit // a single word longer than the limit: cut it rather than loop
      out.push(rest.slice(0, cut))
      rest = rest.slice(cut + (rest[cut] === ' ' ? 1 : 0))
    }
    if (rest) out.push(rest)
    return out
  }).join('\n')
}

/**
 * Partition a report body into per-finding sections.
 * @throws if the partition is not lossless — see the header note.
 */
export function splitReportBody(raw: string): ReportSection[] {
  const unwrapped = unwrap(raw)
  if (!unwrapped) return []
  const text = splitOversizeLines(unwrapped, MAX_CHARS)

  // The oversize split must move whitespace only — never a character of content.
  const flat = (s: string) => s.replace(/\s+/g, ' ')
  if (flat(text) !== flat(unwrapped)) {
    throw new Error('[report-sections] oversize-line split altered content — refusing to write')
  }

  const units = toUnits(text)
  const sections: ReportSection[] = []
  let buf: string[] = []
  let bufChars = 0
  let startPara: number | null = null
  let heading: string | null = null

  const flush = (nextHeading: string | null) => {
    if (buf.length) {
      sections.push({ ordinal: sections.length + 1, startPara, heading, text: buf.join('\n') })
    }
    buf = []; bufChars = 0; startPara = null
    heading = nextHeading
  }

  for (const u of units) {
    // a heading opens a new section rather than trailing the previous one
    if (u.para === null && isHeading(u.text)) {
      if (bufChars >= TARGET_CHARS / 2) flush(u.text)
      else if (!buf.length) heading = u.text
    }
    if (!buf.length) startPara = u.para
    buf.push(u.text)
    bufChars += u.text.length + 1
    if (bufChars >= TARGET_CHARS) flush(heading)
  }
  flush(null)

  assertLossless(text, sections.map(s => s.text))
  return sections
}

/**
 * The losslessness invariant, exported so the check script can exercise THIS code rather than a
 * re-implementation of it. A negative control that tests a copy of the assertion proves only
 * that the copy works.
 * @throws if the sections are not a pure partition of `text`.
 */
export function assertLossless(text: string, sectionTexts: string[]): void {
  const rejoined = sectionTexts.join('\n')
  if (rejoined !== text) {
    throw new Error(`[report-sections] LOSSY SPLIT: unwrapped input ${text.length} chars, rejoined ${rejoined.length} chars — refusing to write a partial report`)
  }
}
