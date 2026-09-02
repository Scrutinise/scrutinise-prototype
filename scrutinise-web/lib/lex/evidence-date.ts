// ─────────────────────────────────────────────────────────────────────────────
// 25-P §2 — WHEN A PIECE OF EVIDENCE IS FROM, AND WHAT THAT MAKES IT.
//
// 25-O §6 was asked to fix a claim that presented a 2014 Lords debate as current. It diagnosed
// instead, and the diagnosis changed the fix: **`EvidenceItem` had no date column at all.** The
// date was in the URL and in the corpus row and there was nowhere for it to land. §2 is blunt
// about what follows from that — *"No prompt instruction can work against a missing column"*.
//
// ⚠⚠ EVERYTHING HERE IS PURE, AND THAT IS THE POINT. §2d's three judgements — stale, assertion,
// weighed-against — have to give the same answer on the panel, in the report and in a check. A
// judgement re-implemented at each render surface is three judgements that agree until one is
// edited; this repository has already published a wrong number that way (a re-implemented
// `admits()` blind to `extraCorpora`).
//
// ⚠ AND NOTHING HERE ASKS A MODEL. §2b: the date is populated at write time FROM THE CORPUS ROW.
// A date a model produced is a claim about a document, not a property of it, and the whole defect
// began with a claim about a document being treated as a property of it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a row's date was got, or why it has none.
 *
 * ⚠⚠ "NO DATE" AND "NOBODY LOOKED" ARE DIFFERENT STATES. §2c requires an undated row to be
 * visibly undated and counted; a lone nullable date cannot distinguish a source that genuinely
 * carries no date from a row written before this column existed, and the second is not a finding
 * about the source at all.
 */
export type EvidenceDateBasis =
  /** Read off `corpus_sections.itemDate` for the row the finding cites. The good case. */
  | 'CORPUS_ROW'
  /** Recovered from a date embedded in the source URL. §2c's backfill only. */
  | 'URL'
  /** The corpus row was found and genuinely carries no date. A fact about the source. */
  | 'CORPUS_ROW_UNDATED'
  /** The finding cites no retrievable source row — user material, a model-written summary. */
  | 'NO_SOURCE_ROW'
  /** A date was present and could not be read. Kept distinct so a parser bug is visible. */
  | 'UNPARSEABLE'
  /** Written before 25-P. ⚠ NOT "undated" — nothing has looked. */
  | 'NOT_ASSESSED'

export const EVIDENCE_DATE_BASES: EvidenceDateBasis[] = [
  'CORPUS_ROW', 'URL', 'CORPUS_ROW_UNDATED', 'NO_SOURCE_ROW', 'UNPARSEABLE', 'NOT_ASSESSED',
]

/** One line each, for the §2c report and for the panel's own hover text. */
export const BASIS_MEANING: Record<EvidenceDateBasis, string> = {
  CORPUS_ROW: 'Dated from the corpus record for the source itself.',
  URL: 'Dated from the date in the source URL, recovered after the fact.',
  CORPUS_ROW_UNDATED: 'The source is in the corpus and carries no date.',
  NO_SOURCE_ROW: 'No retrievable source record, so there is nothing to take a date from.',
  UNPARSEABLE: 'A date was recorded against the source and could not be read.',
  NOT_ASSESSED: 'Written before evidence carried dates. Nothing has looked yet.',
}

/**
 * ⚠⚠ THE THRESHOLD, STATED ONCE AND IN ONE PLACE. §2d asks for "older than a stated threshold",
 * and a threshold that lives in three renderers is three thresholds.
 *
 * Five years is not a claim that a six-year-old debate is wrong. It is the point past which a
 * FIGURE quoted from it — a cost, a caseload, a headcount — should be checked against a current
 * one before a proposal rests on it, which is exactly what the 2014 claim needed and did not get.
 */
export const EVIDENCE_STALE_YEARS = 5

export type Staleness =
  | 'CURRENT'
  /** Older than the threshold. ⚠ Not "wrong" — "check the figures against current ones". */
  | 'NEEDS_CHECKING'
  /** No date. §2c: visibly undated, never silently assumed current. */
  | 'UNDATED'

/** EVIDENCE cites something; an ASSERTION is a statement with nothing behind it. §2d. */
export type Standing = 'EVIDENCE' | 'ASSERTION'

export interface EvidenceStanding {
  staleness: Staleness
  /** Whole years, or null when undated. */
  ageYears: number | null
  standing: Standing
  /** The figures found in the body — what makes it evidence rather than an assertion. */
  figures: string[]
  /** One sentence, rendered next to the finding. Never empty. */
  label: string
}

/**
 * ══ §2b — READ A CORPUS DATE. ═══════════════════════════════════════════════════════
 *
 * `corpus_sections.itemDate` arrives as text (`::text` in the hydrate), and across the corpora
 * that text is "2014-01-16", "2014-01-16T00:00:00.000Z", or "2014". A bare year is honoured as
 * 1 January of that year and IS a date — a Hansard volume from 1978 is genuinely from 1978.
 *
 * ⚠ RETURNS THE BASIS AS WELL AS THE DATE, so a caller cannot record a date without recording
 * where it came from. That coupling is the only thing that keeps `sourceDateBasis` honest.
 */
export function readCorpusDate(raw: string | null | undefined): {
  date: Date | null
  basis: Extract<EvidenceDateBasis, 'CORPUS_ROW' | 'CORPUS_ROW_UNDATED' | 'UNPARSEABLE'>
} {
  const s = (raw ?? '').trim()
  if (!s) return { date: null, basis: 'CORPUS_ROW_UNDATED' }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]))
    return isNaN(d.getTime()) ? { date: null, basis: 'UNPARSEABLE' } : { date: d, basis: 'CORPUS_ROW' }
  }
  const year = /^(1[6-9]\d{2}|20\d{2})$/.exec(s)
  if (year) return { date: new Date(Date.UTC(+year[1], 0, 1)), basis: 'CORPUS_ROW' }

  return { date: null, basis: 'UNPARSEABLE' }
}

/**
 * ══ §2b — THE TWO COLUMNS, FROM WHATEVER SOURCE ROW THE WRITER HAS IN HAND. ════════
 *
 * ⚠⚠ EVERY `evidenceItem.create` IN THE CODEBASE CALLS THIS, INCLUDING THE ONES WITH NO SOURCE.
 * That is the whole design: passing `null` writes `NO_SOURCE_ROW`, so a finding reasoned by a
 * model over the proposal is recorded as having no source to date rather than as undated. §2c
 * needs the difference — "the source carries no date" is a fact about a document, "there is no
 * document" is a fact about the finding, and lumping them together is how a reasoning step ends
 * up counted as an undated source.
 */
export function sourceDateFields(src?: { date?: string | null } | null): {
  sourceDate: Date | null
  sourceDateBasis: EvidenceDateBasis
} {
  if (!src) return { sourceDate: null, sourceDateBasis: 'NO_SOURCE_ROW' }
  const { date, basis } = readCorpusDate(src.date)
  return { sourceDate: date, sourceDateBasis: basis }
}

/**
 * ══ §2c — RECOVER A DATE FROM A URL, FOR THE BACKFILL ONLY. ═════════════════════════
 *
 * The 2014 Lords claim's date was in its URL and nowhere else reachable after the fact:
 * `…/lords/2014/jan/16/…`. Hansard, legislation.gov.uk and the TNA case archive all put the date
 * in the path, in three different shapes.
 *
 * ⚠ THIS IS A BACKFILL TOOL, NOT A WRITE-TIME ONE. At write time the corpus row is in hand and is
 * better; a URL is a filename, and a filename can be wrong in ways a record cannot.
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function dateFromUrl(url: string | null | undefined): Date | null {
  const u = (url ?? '').toLowerCase()
  if (!u) return null

  // /2014/jan/16/ — historic Hansard.
  const named = /\/((?:1[6-9]|20)\d{2})\/([a-z]{3})\/(\d{1,2})(?:\/|$)/.exec(u)
  if (named) {
    const m = MONTHS.indexOf(named[2])
    if (m >= 0) return new Date(Date.UTC(+named[1], m, +named[3]))
  }
  // /2014-01-16 or /2014/01/16 — pwdata, TNA.
  const numeric = /\/((?:1[6-9]|20)\d{2})[-/](\d{2})[-/](\d{2})(?:[^\d]|$)/.exec(u)
  if (numeric) {
    const mm = +numeric[2]
    const dd = +numeric[3]
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return new Date(Date.UTC(+numeric[1], mm - 1, dd))
    }
  }
  // /ukpga/2014/6 — an Act's year. ⚠ A YEAR ONLY, and that is all it claims.
  const act = /\/(ukpga|ukic|uksi|asp|nia|wsi|ssi|anaw)\/((?:1[6-9]|20)\d{2})\//.exec(u)
  if (act) return new Date(Date.UTC(+act[2], 0, 1))

  return null
}

/**
 * ══ §2d — WHAT A DATE AND A BODY MAKE OF A CLAIM. ═══════════════════════════════════
 *
 * ⚠⚠ THE FIGURES TEST IS DELIBERATELY LITERAL, AND ITS LIMIT IS STATED RATHER THAN HIDDEN.
 * It looks for a quantity in the text: a sum of money, a percentage, a count, a year-on-year
 * change. It cannot tell a load-bearing figure from an incidental one, so it is used to say
 * "there is nothing quantitative here at all", which is a safe thing to say, and never to say
 * "this figure is good".
 */
const FIGURE_PATTERNS: RegExp[] = [
  /£\s?\d[\d,.]*\s*(?:bn|billion|m|million|k|thousand)?/gi,
  /\b\d[\d,.]*\s?(?:%|per cent|percent)/gi,
  /\b\d[\d,]{2,}\b/g,
  /\b\d[\d,.]*\s*(?:bn|billion|million|thousand)\b/gi,
]

export function figuresIn(text: string | null | undefined): string[] {
  const t = text ?? ''
  const out = new Set<string>()
  for (const re of FIGURE_PATTERNS) {
    for (const m of t.matchAll(re)) out.add(m[0].trim())
  }
  return [...out]
}

export function wholeYearsBetween(from: Date, to: Date): number {
  let y = to.getUTCFullYear() - from.getUTCFullYear()
  const before =
    to.getUTCMonth() < from.getUTCMonth()
    || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate())
  if (before) y -= 1
  return y
}

/**
 * The three §2d judgements, together, because they are read together.
 *
 * ⚠ AN UNDATED ROW IS NEVER "CURRENT". That substitution is the original defect in one line: a
 * 2014 debate read as though it described today because nothing said otherwise.
 */
/**
 * ══════════ ⚠⚠ 25-V §6 — A DATE WE ONLY KNOW TO THE YEAR PRINTS AS THE YEAR ══════════
 *
 * §6: *"58 date flags print **2010-01-01** for 100 rows that only ever carried a year. That is
 * invented precision, and it is the opposite of the standing principle."*
 *
 * MEASURED on the Civil Service proposal: of 473 dated evidence rows, **152 fall on 1 January** —
 * 100 of them on exactly `2010-01-01`, and 36 of the 152 have `sourceDateBasis = 'URL'`, where a
 * year lifted out of a path is the only thing there was to lift. That is not a publication date;
 * it is a year with a day appended by whatever parsed it.
 *
 * ⚠ WE CANNOT TELL A COERCED 1 JANUARY FROM A GENUINE ONE, and that decides the rule. A stored
 * date carries no precision flag, so the choice is between asserting a day we may not have and
 * asserting a year we certainly do. A handful of documents genuinely published on 1 January will
 * print as "2010" instead of "2010-01-01": a small loss of precision, and never a false claim.
 * The reverse error — telling a reader we know the day when we know the year — is the one the
 * standing principle forbids.
 *
 * ⚠ THE AGE IS UNAFFECTED. "16 years old" was always computed from the year and stays exactly as
 * it was; only the stamp beside it stops overstating what is known.
 */
function datestamp(d: Date): string {
  const iso = d.toISOString().slice(0, 10)
  return iso.endsWith('-01-01') ? iso.slice(0, 4) : iso
}

export function evidenceStanding(input: {
  sourceDate: Date | null
  sourceDateBasis: string | null
  body: string | null
  title?: string | null
  now?: Date
}): EvidenceStanding {
  const now = input.now ?? new Date()
  const figures = figuresIn(`${input.title ?? ''}\n${input.body ?? ''}`)
  const standing: Standing = figures.length ? 'EVIDENCE' : 'ASSERTION'

  if (!input.sourceDate) {
    const basis = (input.sourceDateBasis ?? 'NOT_ASSESSED') as EvidenceDateBasis
    const why = BASIS_MEANING[basis] ?? BASIS_MEANING.NOT_ASSESSED
    return {
      staleness: 'UNDATED', ageYears: null, standing, figures,
      label: `Undated. ${why}${standing === 'ASSERTION'
        ? ' No figures are quoted, so this is an assertion rather than evidence.' : ''}`,
    }
  }

  const ageYears = wholeYearsBetween(input.sourceDate, now)
  const stamp = datestamp(input.sourceDate)
  if (ageYears >= EVIDENCE_STALE_YEARS) {
    return {
      staleness: 'NEEDS_CHECKING', ageYears, standing, figures,
      label: standing === 'EVIDENCE'
        ? `From ${stamp}, ${ageYears} years old. Check the figures against current ones before relying on them.`
        : `From ${stamp}, ${ageYears} years old, and quotes no figures — an assertion rather than evidence.`,
    }
  }
  return {
    staleness: 'CURRENT', ageYears, standing, figures,
    label: standing === 'EVIDENCE'
      ? `From ${stamp}.`
      : `From ${stamp}. No figures are quoted, so this is an assertion rather than evidence.`,
  }
}

/**
 * ══ §2d, THIRD PART — WHAT A POSITION-CHANGING CLAIM WAS WEIGHED AGAINST. ═══════════
 *
 * §2d: *"a claim that changed Lex's position names what it was weighed against, or says nothing
 * was."*
 *
 * ⚠⚠ "OR SAYS NOTHING WAS" IS THE HALF THAT MATTERS AND THE HALF THAT WOULD BE DROPPED. A
 * finding that turned the proposal round on its own, unopposed, is a weaker thing than one that
 * beat three contrary sources — and the two are indistinguishable unless the second sentence is
 * printed. So this returns a sentence in BOTH cases and never an empty string.
 *
 * `weighedAgainst` is the other evidence on the same question: same idea, same pass, same run.
 * A CONTRADICTS row on the same question is the strongest form of it.
 */
export function weighedAgainstLine(input: {
  changedPosition: boolean
  others: Array<{ kind: string; title: string }>
}): string | null {
  if (!input.changedPosition) return null
  const contrary = input.others.filter((o) => o.kind === 'CONTRADICTS')
  if (contrary.length) {
    const names = contrary.slice(0, 3).map((o) => o.title)
    return `This changed the proposal's position. It was weighed against ${contrary.length} `
      + `contrary finding${contrary.length === 1 ? '' : 's'}: ${names.join('; ')}`
      + `${contrary.length > 3 ? ', and others' : ''}.`
  }
  if (input.others.length) {
    return `This changed the proposal's position. ${input.others.length} other finding`
      + `${input.others.length === 1 ? ' was' : 's were'} on the same question, none of them contrary.`
  }
  return 'This changed the proposal\'s position, and nothing was weighed against it — '
    + 'no other finding on this question was retrieved.'
}
