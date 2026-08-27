/**
 * citations.ts — THE PARSER. One implementation, imported everywhere, never copied.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ THE IDENTITY OF A CASE IS ITS CITATION, NEVER ITS NAME. That is a design decision taken to
 * avoid the trap the brief names in §1.3, by construction rather than by care:
 *
 *   *Donoghue v Stevenson* is also *Donoghue v. Stevenson*, *M'Alister (or Donoghue) v Stevenson*
 *   and *Donoghue v Stevenson [1932] AC 562*. Meanwhile *Caparo Industries plc v Dickman* and
 *   *Caparo Group Ltd v X* are DIFFERENT CASES — and this platform has already confused their
 *   modern namesakes, returning a 2017 employment tribunal decision for "Caparo".
 *
 * So a name is only ever recorded as a VARIANT attached to a citation. Two records are never merged
 * because their names look alike. An unresolved name is visibly thin and harmless; a wrongly merged
 * one is a case that does not exist.
 *
 * ⚠⚠ AND THE PRE-2001 AUTHORITIES HAVE NO NEUTRAL CITATION. Neutral citations began in 2001. A
 * parser written only for `[2019] UKSC 22` finds nothing pre-2001 and reports success — the exact
 * failure shape this project has hit repeatedly. The LAW REPORT form is therefore first-class here
 * and is what `check-citations.ts` tests first.
 *
 * ── THE TWO FORMS ──────────────────────────────────────────────────────────────────────────────
 *   NEUTRAL      [2019] UKSC 22 · [2001] EWCA Civ 540 · [2023] EWHC 852 (Ch) · [2024] UKUT 65 (IAC)
 *                court code, sequential number, optional division in brackets. 2001 onwards.
 *   LAW REPORT   [1932] AC 562 · [1990] 2 AC 605 · [1948] 1 KB 223 · (1932) SC (HL) 31
 *                year (square OR round brackets), optional volume, series abbreviation, page.
 *
 * ⚠ Round brackets matter: a Scottish or older English citation is `(1932) SC (HL) 31`, and a
 * parser that only accepts `[` silently drops Scotland.
 */

/** Neutral-citation court codes, 2001 onwards. */
const NEUTRAL_COURTS = [
  'UKSC', 'UKPC', 'UKHL', 'EWCA', 'EWHC', 'EWCOP', 'EWFC', 'UKUT', 'UKFTT', 'UKEAT', 'EAT',
  'UKAIT', 'UKIAT', 'CSIH', 'CSOH', 'HCJAC', 'SCCR', 'NICA', 'NIQB', 'NICH', 'NIFam', 'NIMag',
  'UKPTS', 'EWCC', 'UKAITUR',
]

/**
 * Law-report series abbreviations. Ordered longest-first at build time so that `All ER Rep` wins
 * over `All ER`, and `P & CR` is not truncated to `P`.
 *
 * ⚠ Single-letter series (`P` for Probate, `Ch` for Chancery) are the dangerous ones: `[1969] 2 P
 * 147` is a citation and `[1969] 2 p 147` is not. They are matched case-sensitively and only when
 * followed by a page number, and `check-citations.ts` carries the negative controls.
 */
const SERIES = [
  'App Cas', 'All ER Rep', 'All ER (Comm)', 'All ER (D)', 'All ER', 'AC', 'QB', 'QBD', 'KB', 'KBD',
  'Ch D', 'Ch', 'Fam', 'WLR', 'WLUK', 'ER', 'LR', 'Ex D', 'CPD', 'CBNS', 'BCLC', 'BCC', 'BPIR',
  'Lloyd’s Rep', "Lloyd's Rep", 'Lloyds Rep', 'LGR', 'P & CR', 'P&CR', 'Cr App R (S)',
  'Cr App R', 'Crim LR', 'FLR', 'FCR', 'STC', 'SFTD', 'TC', 'WTLR', 'ICR', 'IRLR', 'RPC', 'FSR',
  'EMLR', 'HLR', 'JPL', 'JP', 'Con LR', 'BLR', 'TCLR', 'Env LR', 'PIQR', 'Med LR', 'Lloyd’s Law Rep',
  'EHRR', 'CMLR', 'ECR', 'ELR', 'Imm AR', 'INLR', 'ITR', 'NI', 'NIJB', 'SC', 'SLT', 'SCLR', 'SCCR',
  'SLCR', 'Ct of Sess', 'Sol Jo', 'SJ', 'LS Gaz R', 'EGLR', 'EG', 'RTR', 'RVR', 'STI', 'UKHRR',
  'BHRC', 'LGLR', 'ACD', 'COD', 'CCLR', 'Admin LR', 'PTSR',
]

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SERIES_ALT = [...SERIES].sort((a, b) => b.length - a.length).map(esc).join('|')
const NEUTRAL_ALT = NEUTRAL_COURTS.map(esc).join('|')

/**
 * `[2001] EWCA Civ 540`, `[2023] EWHC 852 (Ch)`, `[2019] UKSC 22`.
 * The division word (`Civ`, `Crim`, `Admlty`, `Fam`, `Pat`, `KB`, `QB`, `Ch`, `TCC`, `Comm`) is
 * optional and may be a word or a trailing bracket, and BOTH are captured — `[2003] EWHC 2582
 * (Admin)` and `[2003] EWHC 2582` are the same court and a different case number.
 */
const NEUTRAL_RX = new RegExp(
  String.raw`\[(1[89]\d{2}|20\d{2})\]\s*(` + NEUTRAL_ALT + String.raw`)\s*([A-Z][a-z]{2,6}\s+)?(\d{1,5})(\s*\(([A-Za-z&\s]{2,20})\))?`,
  'g',
)

/**
 * `[1932] AC 562`, `[1990] 2 AC 605`, `(1932) SC (HL) 31`, `(1979) 68 Cr App R 128`.
 * Year in square OR round brackets · optional volume · series · optional parenthesised court
 * (`(HL)`, `(H.L.)`) · page.
 */
const LAWREP_RX = new RegExp(
  String.raw`[\[\(](1[6-9]\d{2}|20\d{2})[\]\)]\s*(\d{1,3}\s+)?(` + SERIES_ALT + String.raw`)\s*(\(([A-Z][A-Za-z.\s]{1,8})\)\s*)?(\d{1,4})\b`,
  'g',
)

export type CitationKind = 'neutral' | 'law-report'

export interface Citation {
  /** As written in the document, verbatim. Kept because a report that cannot quote its own evidence is a claim. */
  raw: string
  /** The identity. Whitespace collapsed, brackets normalised — nothing else. */
  normalised: string
  kind: CitationKind
  year: number
  /** `UKSC`, `EWCA`, or the law-report series (`AC`, `WLR`). */
  series: string
  /** Character offset in the body it came from. */
  index: number
}

/** Collapse whitespace and normalise the punctuation that varies between typesetters. */
export function normaliseCitation(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\.\s*/g, '.')      // A.C. → A.C.
    .replace(/\bA\.C\./g, 'AC').replace(/\bQ\.B\./g, 'QB').replace(/\bK\.B\./g, 'KB')
    .replace(/\bW\.L\.R\./g, 'WLR').replace(/\bAll E\.R\./g, 'All ER')
    .replace(/\(\s*/g, '(').replace(/\s*\)/g, ')')
    .trim()
}

export function extractCitations(text: string): Citation[] {
  const out: Citation[] = []
  const seenSpan = new Set<string>()

  for (const [rx, kind] of [[NEUTRAL_RX, 'neutral'], [LAWREP_RX, 'law-report']] as Array<[RegExp, CitationKind]>) {
    rx.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      const raw = m[0]
      const span = `${m.index}:${m.index + raw.length}`
      // ⚠ A neutral citation can contain something the law-report pattern also matches. The neutral
      //   pass runs FIRST and claims its span, so the same characters are never counted twice.
      if ([...seenSpan].some((s) => {
        const [a, b] = s.split(':').map(Number)
        return m!.index < b && m!.index + raw.length > a
      })) continue
      seenSpan.add(span)
      out.push({
        raw,
        normalised: normaliseCitation(raw),
        kind,
        year: parseInt(m[1], 10),
        series: kind === 'neutral' ? m[2] : m[3],
        index: m.index,
      })
    }
  }
  return out.sort((a, b) => a.index - b.index)
}

/**
 * The case NAME immediately preceding a citation — recorded as a VARIANT, never as an identity.
 *
 * ⚠ It returns null rather than guessing. A citation with no readable name is a citation with no
 * readable name: the record then says the case is cited N times and says nothing about its title,
 * which is the honest state. `getCaseName` inventing a plausible name is how two cases merge.
 */
export function nameBefore(text: string, citationIndex: number): string | null {
  const window = text.slice(Math.max(0, citationIndex - 160), citationIndex)

  /**
   * ⚠⚠ `Re B`, `In re H`, `Re S (FC)` — A WHOLE CATEGORY OF CASE NAME WITH NO "v" IN IT.
   *
   * Found by reading the extraction's "most frequently matched, never named" list, which was
   * supposed to surface regex artefacts and instead surfaced ten real and heavily-cited cases:
   * `[2013] UKSC 33` (503 citing documents), `[1996] AC 563` (409), `[2005] 1 AC 593` (334). Nine
   * of those ten are family cases reported as *In re <initial>*. The `X v Y` pattern below can
   * never match one, so the entire family-law canon was arriving unnamed — and an unnamed record
   * cannot be found by a user typing the name.
   *
   * ⚠ It is tried FIRST because "Re B" is short and the `v` pattern would otherwise reach back past
   * it into the previous sentence and find an unrelated `X v Y`.
   */
  const flatWin = window.replace(/\s+/g, ' ').trimEnd()
  // up to TWO parentheticals: "In re E (Children) (abduction: custody appeal)" is one case name
  const reMatch = /((?:In\s+)?[Rr]e\s+[A-Z][A-Za-z'’\-.]*(?:\s*\([^)]{1,60}\)){0,2}(?:\s+(?:and|&)\s+[A-Z][A-Za-z'’\-.]*)?)\s*[,\s]*$/.exec(flatWin)
  if (reMatch) {
    const nm = reMatch[1].trim().replace(/[,;:]$/, '')
    if (nm.length >= 4 && nm.length <= 90) return nm
  }
  // "<Party> v <Party>" — allow the punctuation and bracketed asides real reports use.
  const rx = /([A-Z][A-Za-z'’\-.()]*(?:\s+(?:of|and|the|for|&|\(or\)|[A-Za-z'’\-.()]+)){0,10}?\s+v\.?\s+[A-Z][A-Za-z'’\-.()]*(?:\s+(?:of|and|the|for|&|[A-Za-z'’\-.()]+)){0,10}?)\s*[,\s]*$/
  const m = rx.exec(window.replace(/\s+/g, ' ').trimEnd())
  if (!m) return null
  let name = m[1].trim().replace(/[,;:]$/, '')

  /**
   * ⚠ TRIM THE LEADING CONNECTIVE, BECAUSE REAL JUDGMENTS ARE WRITTEN IN SENTENCES. Measured on the
   * 400-judgment pilot, the capture regularly picks up the words a judge introduces a case with:
   *
   *     "Lord Oliver of Aylmerton in Caparo Industries Plc v Dickman and others"
   *     "Thus in Ashingdane v United Kingdom"
   *     "House of Lords in Berkeley v Secretary of State"
   *
   * A leading "<up to 60 characters> in " is dropped when what remains is still a `X v Y` — so the
   * introduction goes and the case name stays.
   *
   * ⚠ IT IS A TRIM, NOT A CORRECTION, and it cannot invent an identity: the identity is the
   * citation, and names are only ever variants. If this trim is wrong the record carries a slightly
   * odd variant, which is visible and harmless; the citation it hangs off is unaffected.
   */
  name = tidyName(name)

  if (name.length < 6 || name.length > 140) return null
  if (!/\sv\.?\s/.test(name)) return null
  return name
}

/**
 * Exported so it can be applied RETROSPECTIVELY to names already extracted, without re-reading
 * 74,896 judgments to fix a string.
 *
 * ⚠ IT EXISTS BECAUSE THE TRIM LANDED MID-RUN. The full `tna-caselaw` extraction was already in
 * flight when this was written, so its stored names carry the untrimmed form. Re-scanning would
 * cost ~40 minutes to change a string; `build-records.ts` imports this and applies it to what is on
 * disk. ⚠ The same function both places — a second copy that drifted would produce two spellings of
 * the same variant and no way to tell which run made which.
 */
export function tidyName(raw: string): string {
  let name = raw.trim().replace(/[,;:]$/, '')

  // "<judge or clause> in <Case>" — the commonest shape by far in judicial prose.
  const afterIn = name.replace(/^.{0,60}?\bin\s+(?=[A-Z])/, '')
  if (/\sv\.?\s/.test(afterIn) && afterIn.length >= 6) name = afterIn

  /**
   * ⚠ A SECOND SHAPE, FOUND BY READING THE OUTPUT RATHER THAN BY IMAGINING IT: `[1964] AC 40` came
   * back as **"Given that Ridge v Baldwin"**. There is no " in " to cut at — the sentence simply
   * begins "Given that…". So a leading run of connective words is dropped, from a SHORT EXPLICIT
   * LIST rather than by cleverness, and only while what remains is still an `X v Y`.
   *
   * ⚠ The cost of getting this wrong is a slightly odd VARIANT, never a wrong identity — the
   * identity is the citation. That is the whole reason it is safe to tidy names at all.
   */
  const LEADING = /^(given|that|see|also|thus|held|per|namely|whether|since|because|as|following|applying|considered|approved|distinguished|compare|cf|but|and|the|decision|judgment|case|of|in|from|by)\s+/i
  for (let i = 0; i < 6; i++) {
    const next = name.replace(LEADING, '')
    if (next === name) break
    if (!/\sv\.?\s/.test(next) || next.length < 6) break
    name = next
  }

  return name
}

/**
 * The sentence a citation sits in — evidence, so a human can check the parser rather than a count.
 *
 * ⚠ THE BOUNDARY IS ". " FOLLOWED BY A CAPITAL, not any full stop. Legal documents are full of
 * full stops that end nothing: `www.sec.gov/about/offices/`, `Ex p.`, `No. 3`, `[1990] 2 A.C. 605`.
 * Splitting on a bare ". " produced quotations that opened mid-URL — measured on a real committee
 * report, where the Caparo quote began *"of the Advisory Committee … acifr-finalreport.pdf 251 It
 * was also the view of Lord Oliver…"*. The quote was correct and read like a mistake, which for a
 * page about a case we do not hold is nearly as bad as being wrong.
 */
export function sentenceAround(text: string, index: number, len: number): string {
  const from = Math.max(0, index - 320)
  const to = Math.min(text.length, index + len + 320)
  const window = text.slice(from, to).replace(/\s+/g, ' ')
  const rel = index - from

  /**
   * Walk back to the nearest ". " followed by a capital or a quotation mark.
   *
   * ⚠⚠ IF THERE IS NO SUCH BOUNDARY, THE QUOTE BEGINS AT THE CITATION — it does NOT begin at the
   * top of the window. The first version fell back to offset 0 and produced quotations that opened
   * mid-word (*"e United Kingdom, the Scottish Ministers…"*) or with an unrelated preceding
   * sentence (*"Memorandum of Understanding and Supplementary Agreements between…"*). Both are
   * accurate transcriptions and both read as carelessness on a page whose entire job is to be
   * trusted about a case we do not hold. A short quote that starts at the citation is worth more
   * than a long one that starts anywhere.
   */
  let start = -1
  for (let i = rel - 1; i > 1; i--) {
    if (window[i] === ' ' && window[i - 1] === '.' && /[A-Z“"']/.test(window[i + 1] ?? '')) { start = i + 1; break }
  }
  if (start < 0) {
    // no boundary: take the words immediately before the citation, back to a word break
    const lead = Math.max(0, rel - 90)
    const sp = window.indexOf(' ', lead)
    start = rel - lead > 90 ? rel : (sp >= 0 && sp < rel ? sp + 1 : rel)
  }
  let end = window.length
  for (let i = rel + len; i < window.length - 2; i++) {
    if (window[i] === '.' && window[i + 1] === ' ' && /[A-Z“"']/.test(window[i + 2] ?? '')) { end = i + 1; break }
  }
  return window.slice(start, end).trim()
}

export const PARSER_INTERNALS = { NEUTRAL_RX, LAWREP_RX, SERIES, NEUTRAL_COURTS }
