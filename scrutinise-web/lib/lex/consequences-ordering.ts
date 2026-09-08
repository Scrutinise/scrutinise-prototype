// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 5 §1 — THE ORDERING, AND WHAT IT RESTS ON.
//
// ⚠⚠ THE BRIEF'S WARNING IS THE STARTING POINT: *"Do not invent an importance score. This
// project has twice produced a ranked list that was really alphabetical and said 'top 40'
// over it."* So the question is not what order would be nicest; it is what order the stored
// data can carry without anybody adding a judgement to it.
//
// ⚠ WHAT THE DATA SUPPORTS, AND IT IS EXACTLY ONE THING: the KIND of reference. `detection`
// is a stored column with a CHECK constraint behind it, written by three extractors with
// three different warrants, and the three are genuinely different strengths of evidence — an
// enacting power the instrument names itself, an identity the document asserted, and a name
// we resolved out of prose. That is an ordering read off the record, not a score.
//
// ⚠⚠ WHAT THE DATA DOES NOT SUPPORT, STATED RATHER THAN QUIETLY OMITTED: whether the
// REFERRING provision is itself still in force. The brief names it as the second candidate
// and it is the right thing to want — a reference from a repealed section is a weaker
// consequence than one from live law. We cannot answer it here today. The repeal record lives
// in the effects table under a corpus-prefixed identifier at four different granularities,
// and — decisively — the ABSENCE of a repeal edge is not evidence that a provision is in
// force. Ordering by an in-force flag we cannot compute would rank live law below repealed
// law wherever our effects coverage is thin, which is the confident wrong answer §4 forbids.
//
// So: order by kind, group by what the words do, count everything, and SAY SO ON SCREEN.
// ─────────────────────────────────────────────────────────────────────────────

import { DETECTION_KINDS, type Detection, type InboundRow } from './statutory-graph'
import { cleanCitationText, DISPOSITION_WORDS, type ClassifiedGroup } from './statutory-consequences'

/**
 * The kinds present in an answer, strongest first.
 *
 * ⚠ DERIVED FROM `DETECTION_KINDS`, NOT RESTATED. That record is keyed by `Detection`, so it
 * is the one complete list of the ladder; sorting its entries by `strength` is what makes it
 * impossible to add a kind and silently leave it out of the order. A hand-kept list here
 * could only ever be right by accident — which is the wording `heading-map.ts` uses about the
 * last hand-kept list this codebase had.
 */
export function kindsPresent(rows: InboundRow[]): Detection[] {
  const seen = new Set<Detection>(rows.map((r) => r.detection))
  return (Object.keys(DETECTION_KINDS) as Detection[])
    .filter((k) => seen.has(k))
    .sort((a, b) => DETECTION_KINDS[a].strength - DETECTION_KINDS[b].strength)
}

/**
 * ⚠⚠ THE ORDER, IN THE USER'S WORDS, AND WHAT IT IS NOT.
 *
 * The positions surface computes exactly this sentence (`Ranking`) and SURFACE 3's filer threw
 * it away, so a document printed five names out of two hundred and fifty-four in alphabetical
 * order as though those five were the significant ones. This is the same sentence for the same
 * reason, and it is CARRIED to each renderer rather than recomputed by each of them.
 *
 * ⚠ IT SAYS THE THING WE CANNOT DO. A note that only explains the order teaches a reader that
 * the order means more than it does.
 */
export function describeOrdering(kinds: Detection[]): string {
  if (!kinds.length) return 'There is nothing here to order.'
  // ⚠ NUMBERED, AND THE GLOSS IN BRACKETS. The first rendering joined three kinds and three
  // glosses with em-dashes and semicolons into one 120-word sentence with nested dashes, which
  // is unreadable in a printed report — and an unreadable caveat is one nobody reads.
  const named = kinds.map((k, i) =>
    `(${i + 1}) ${DETECTION_KINDS[k].what} [${DETECTION_KINDS[k].gloss}]`)
  return 'These are ordered by what kind of reference each one is, strongest evidence first. '
    + `${named.join('; ')}. `
    + 'That order comes from a value the graph records for every reference, not from any judgement '
    + 'about which reference matters more. '
    + 'We cannot yet tell you whether the provision doing the referring is itself still in force, and '
    + 'we have not guessed: our record of repeals is not complete enough for its silence to mean '
    + '"still in force", so ordering by it would put live law below repealed law wherever that record '
    + 'is thin. Within each kind these are grouped by what the words do, largest group first — which '
    + 'is a count, not a ranking.'
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ENABLING SECTION — the kind that may FALL with the target.
// ─────────────────────────────────────────────────────────────────────────────

export interface EnablingGroup {
  /** The instrument made under the target. */
  sourceGid: string
  sourceType: InboundRow['sourceType']
  /** How many enacting references it makes to the target. */
  references: number
  /** The provisions of the TARGET its powers are drawn from, where the preamble names them. */
  targetProvisions: string[]
  /** ⚠ The enacting words themselves. A made-under claim with no quotable words is not shown. */
  words: string | null
  /**
   * ⚠⚠ DO THE QUOTED ENACTING WORDS ACTUALLY NAME THE TARGET? `null` when we hold no title for
   * the target and cannot ask.
   *
   * Found by reading the first worked example rather than by any check. `nisr/2010/381` appears
   * under the Constitutional Reform Act 2005 and its entire enacting text reads *"in exercise of
   * the powers conferred by sections 55 and 55A of the Judicature (Northern Ireland) Act 1978"* —
   * and the Judicature Act is not among its recorded enabling targets at all. The URI stored is an
   * explicit `legislation.gov.uk/id/ukpga/2005/4`, so the extractor read a citation from the
   * preamble REGION; the likeliest source is the footnote hanging off that Act's name, whose
   * amendment note cites the Constitutional Reform Act. ⚠ That mechanism is INFERRED. The
   * misattribution itself is verified against the stored bytes.
   *
   * ⚠ SO THE BLOCK SAYS SO, PER INSTRUMENT. A reader who checks one quotation against
   * legislation.gov.uk and finds a different Act named distrusts the whole panel — and would be
   * right to. Naming the mismatch is the difference between a limit and a lie.
   */
  quotedWordsNameTheTarget: boolean | null
}

export interface EnablingSet {
  groups: EnablingGroup[]
  /** ⚠ INSTRUMENTS, NOT ROWS. What a reader needs is how many instruments, not how many mentions. */
  instruments: number
  references: number
  /** Instruments whose enacting words did not survive extraction. Counted, never dropped. */
  unquotable: number
  /** ⚠ Instruments whose quoted words name some OTHER Act. Counted and labelled, never dropped. */
  quotationMismatch: number
  /** True when we hold no title for the target, so the question could not be asked at all. */
  cannotCheckQuotations: boolean
}

/**
 * ⚠ ONE NORMALISER, AND IT EXISTS BECAUSE THE FIRST VERSION OF THIS TEST WAS WRONG.
 *
 * Matching a stored title against a preamble on the raw strings reported `nisr/2008/35` as a
 * mismatch when its words name the Magistrates' Courts (Northern Ireland) Order 1981 exactly —
 * the preamble carries a curly apostrophe and the title a straight one. A test that fails on
 * punctuation would put a warning beside correct rows, and a warning that fires on correct rows
 * is one a reader learns to ignore.
 */
function normalise(s: string): string {
  return s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

/**
 * The distinctive part of an Act's title — everything before a trailing year or a bracketed
 * qualifier is kept, a leading "The" dropped.
 *
 * ⚠ NOT THE WHOLE TITLE. `corpus_acts` records "(revoked)" and other suffixes that no preamble
 * contains, so a whole-title match would report a mismatch on every revoked instrument.
 */
/**
 * Do these words name the target?
 *
 * ⚠⚠ THE YEAR IS DROPPED ON THE SECOND ATTEMPT, AND MEASURING IS WHAT FORCED IT. `citation_text`
 * is capped at 300 characters by the extractor, so a preamble reading *"…section 148(1) of the
 * Constitutional Reform Act"* is cut off before its year. Requiring the year flagged 61 of the
 * Constitutional Reform Act's 120 instruments, and most of those were that clip rather than a
 * wrong attribution.
 *
 * ⚠ THE COST OF DROPPING IT, NAMED: two Acts sharing a name and differing only in year — a Finance
 * Act, say — would pass this test against each other. That is a false NEGATIVE, and it is the
 * direction to err in for a warning printed beside a row. A warning that fires on correct rows is
 * one a reader learns to skip, and then it is worth nothing when a real one arrives.
 */
function namesTarget(words: string, stem: string): boolean {
  const w = normalise(words)
  if (w.includes(stem)) return true
  const noYear = stem.replace(/\s+\d{4}$/, '')
  return noYear !== stem && w.includes(noYear)
}

function titleStem(title: string): string {
  // ⚠⚠ ANY TRAILING BRACKET, NOT A LIST OF THE ONES WE HAPPEN TO HAVE SEEN. The first version
  // stripped `(revoked)` only, and `corpus_acts` records the European Communities Act 1972 as
  // "European Communities Act 1972 (repealed)". The stem then matched nothing, and the check
  // reported **100% of 3,054 instruments** as quoting a different Act — a warning on every
  // correct row, which is worse than no warning at all. Measured before and after: 3,054 → 24.
  return normalise(title.replace(/^The\s+/i, '').replace(/\s*\([^)]*\)\s*$/, ''))
}

/**
 * ⚠⚠ GROUPED BY REFERRING INSTRUMENT, WHICH IS THE BRIEF'S THIRD CANDIDATE AND IS RIGHT HERE.
 *
 * A preamble that names four sections of the target produces four rows and is ONE instrument
 * standing on that Act. Listing the rows would inflate the apparent consequence fourfold, in
 * the one place where over-reporting costs most: a committee counts instruments.
 */
export function groupEnabling(rows: InboundRow[], targetTitle: string | null = null): EnablingSet {
  const stem = targetTitle ? titleStem(targetTitle) : null
  const by = new Map<string, EnablingGroup>()
  for (const r of rows) {
    const g = by.get(r.sourceGid) ?? {
      sourceGid: r.sourceGid,
      sourceType: r.sourceType,
      references: 0,
      targetProvisions: [] as string[],
      words: null as string | null,
      quotedWordsNameTheTarget: null as boolean | null,
    }
    // ⚠ ANY of the instrument's enacting references may carry the name; one that does settles it.
    if (stem && g.quotedWordsNameTheTarget !== true) {
      g.quotedWordsNameTheTarget = namesTarget(r.citationText, stem)
    }
    g.references++
    if (r.targetProvisionRef && !g.targetProvisions.includes(r.targetProvisionRef)) {
      g.targetProvisions.push(r.targetProvisionRef)
    }
    if (!g.words) g.words = cleanCitationText(r.citationText)
    by.set(r.sourceGid, g)
  }
  const groups = [...by.values()].sort(
    (a, b) => b.references - a.references || a.sourceGid.localeCompare(b.sourceGid))
  return {
    groups,
    instruments: groups.length,
    references: rows.length,
    unquotable: groups.filter((g) => !g.words).length,
    quotationMismatch: groups.filter((g) => g.quotedWordsNameTheTarget === false).length,
    cannotCheckQuotations: stem === null,
  }
}

/** How many instruments an enabling block lists before it says how many it did not. */
export const ENABLING_SHOWN = 12

/**
 * The enabling block, as the body of one evidence row.
 *
 * ⚠ THE QUOTATION IS THE POINT. §2: *"On paper there are no clicks: each reference carries its
 * quoted words and its source in the document itself, or it does not go in."* An instrument
 * with no surviving enacting words is COUNTED in the tail and not asserted in the list.
 *
 * ⚠⚠ AND IT NEVER SAYS THESE INSTRUMENTS WOULD FALL. §4: that is a legal conclusion, and the
 * reader draws it. This says what the words are and what question they raise.
 */
export function renderEnablingBody(target: string, e: EnablingSet): string {
  const lines: string[] = []
  // ⚠⚠ "IN THEIR OWN ENACTING WORDS" WAS AN OVER-CLAIM AND THE FIRST LIVE RUN PROVED IT. On the
  // Constitutional Reform Act 2005, 60 of 120 quote enacting words that do not name that Act —
  // some clipped at the extractor's 300-character cap, at least one resolved from a footnote. The
  // opening line is what a skimmer reads, so the qualification goes there and not only at the
  // bottom: "recorded as made under" is what we can stand behind for all of them.
  const qualified = e.quotationMismatch > 0
    ? ` For ${e.quotationMismatch.toLocaleString()} of them the words we can quote do not name this Act — see the note below.`
    : ''
  lines.push(
    `${e.instruments.toLocaleString()} ${e.instruments === 1 ? 'instrument is' : 'instruments are'} `
    + `recorded as made under ${target}, across `
    + `${e.references.toLocaleString()} ${e.references === 1 ? 'enacting reference' : 'enacting references'}.`
    + qualified)
  lines.push('')
  lines.push(
    'This is a different and stronger fact than a mention. An instrument that merely mentions an Act '
    + 'survives its repeal; an instrument whose enabling power is repealed may fall with it, and each '
    + 'of these would have to be read on its own terms before that could be settled.')
  lines.push('')
  const quotable = e.groups.filter((g) => g.words)
  for (const g of quotable.slice(0, ENABLING_SHOWN)) {
    const provs = g.targetProvisions.length ? ` (naming ${g.targetProvisions.join(', ')})` : ''
    // ⚠⚠ THE CLAIM IS ABOUT THE WORDS WE CAN SHOW, NOT ABOUT THE GRAPH BEING WRONG. Two causes
    // look identical from here: a preamble clipped at 300 characters before the Act's name, and a
    // target the graph resolved from a footnote rather than from the enacting words
    // (`nisr/2010/381` is the second — its whole enacting text names the Judicature (Northern
    // Ireland) Act 1978, which is not among its recorded targets at all). Saying "names a
    // different Act" would assert the second when it might be the first. What is certainly true —
    // and what the reader is about to discover for themselves — is that the quotation in front of
    // them does not name the Act it is filed under.
    //
    // ⚠ AND IT IS ON THE ROW, not only counted at the bottom. A reader checks the quotation
    // immediately below the instrument's name; a caveat three paragraphs later arrives after they
    // have already decided the panel is wrong.
    const flag = g.quotedWordsNameTheTarget === false
      ? ' ⚠ the words we can quote do not name the target. Either the preamble was clipped before'
        + ' it got there, or the graph reached the target through a footnote — we have not checked'
        + ' which, so read this one against the instrument itself'
      : ''
    lines.push(`${g.sourceGid}${provs}:${flag}`)
    lines.push(`  “${g.words!.slice(0, 300)}”`)
    // ⚠ A BARE URL, NOT A MARKDOWN LINK. The question panel renders this field with
    // `whitespace-pre-wrap` and not as markdown, so a link shows its brackets; a bare URL is
    // at least selectable. The same finding SURFACE 3 recorded for the positions body.
    lines.push(`  https://www.legislation.gov.uk/${g.sourceGid}`)
  }
  const rest = quotable.length - Math.min(quotable.length, ENABLING_SHOWN)
  if (rest > 0) {
    lines.push('')
    lines.push(`…and ${rest.toLocaleString()} further ${rest === 1 ? 'instrument' : 'instruments'} not listed here.`)
  }
  if (e.unquotable > 0) {
    lines.push('')
    lines.push(
      `${e.unquotable.toLocaleString()} of the ${e.instruments.toLocaleString()} have no quotable enacting `
      + 'words in our extract, so they are counted and not shown.')
  }
  // ⚠ COUNTED AS WELL AS FLAGGED. The tail beyond the listed instruments carries these too, and a
  // reader who sees only the first twelve would otherwise take the rate to be whatever they saw.
  if (e.quotationMismatch > 0) {
    lines.push('')
    lines.push(
      `For ${e.quotationMismatch.toLocaleString()} of the ${e.instruments.toLocaleString()}, the words `
      + 'we can quote do not name this Act — either the preamble we hold stops short of it, or the '
      + 'graph reached this target through a footnote rather than through the enacting words. They '
      + 'are listed rather than dropped, because dropping them would under-report the reach. '
      + '⚠ Read those against the instrument itself before relying on them.')
  }
  if (e.cannotCheckQuotations) {
    lines.push('')
    lines.push(
      'We hold no title for this enactment, so we could not check whether these quotations name it. '
      + 'That is a gap in our record of the target, not a judgement about these instruments.')
  }
  return lines.join('\n')
}

/**
 * ⚠⚠ THE ONE LINE THE SUMMARY DOCUMENTS PRINT.
 *
 * Measured by reading the builders: the LONG REPORT prints an evidence row's `body`; the
 * EVIDENCE PACK prints its `title` and `siftReason`; the MEETING PACK prints `title` and
 * `citation`, and nothing else. The old sift reason was *"From the citation graph: what refers
 * to <gid>"* — no count, no words, no source — so two of the three documents printed a
 * disposition with nothing behind it. On paper there are no clicks.
 */
export function enablingSiftReason(target: string, e: EnablingSet): string {
  const first = e.groups.find((g) => g.words)
  // ⚠ SAME QUALIFICATION AS THE BODY'S OPENING LINE. This is the sentence the evidence pack
  // prints; a claim that is qualified in the long report and bare here is qualified nowhere a
  // summary reader will see.
  const q = e.quotationMismatch > 0
    ? ` For ${e.quotationMismatch.toLocaleString()} of them the words we can quote do not name it.`
    : ''
  return `${e.instruments.toLocaleString()} ${e.instruments === 1 ? 'instrument is' : 'instruments are'} `
    + `recorded as made under ${target}.${q}`
    + (first ? ` ${first.sourceGid}: “${first.words!.slice(0, 160)}”.` : '')
}

/** The same for a reference group — the quotation, the scale, and where to go and read it. */
export function consequencesSiftReason(g: ClassifiedGroup): string {
  const places = new Set(g.members.map((m) => `${m.sourceGid} ${m.sourceProvisionRef ?? ''}`)).size
  const head = `${g.members.length.toLocaleString()} `
    + `${g.members.length === 1 ? 'reference' : 'references'} in `
    + `${places.toLocaleString()} ${places === 1 ? 'provision' : 'provisions'} that ${g.label}: `
    + `${DISPOSITION_WORDS[g.disposition]}.`
  return g.evidence
    ? `${head} ${g.evidence.sourceGid}${g.evidence.provision ? ` ${g.evidence.provision}` : ''}: `
      + `“${g.evidence.words.slice(0, 160)}”.`
    : `${head} None of them has quotable words in our extract, so this grouping is counted and not evidenced.`
}
