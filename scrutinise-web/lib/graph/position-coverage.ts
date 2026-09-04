// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §1 — WHAT THE POSITION GRAPH COULD NOT SEE, GENERATED FROM LIVE
// STATE ON EVERY CALL.
//
// ⚠⚠ WHY THIS FILE EXISTS, IN ONE SENTENCE FROM THE BRIEF:
//
//     "A silent gap reads as 'nobody has a position', which is the exact
//      opposite of the truth."
//
// What a user saw before this file: positions for the people we hold records
// on, and NOTHING AT ALL about the people or the periods we do not. The screen
// offered a count — "1 person has a record here" — which invites the reader to
// conclude that nobody else took a position. The count was true. The impression
// it left was false, and that is the same defect class as the citation URL
// space (25-V) and the challenge title (25-W): correct data reaching the output
// stripped of the qualification that made it correct.
//
// ── THE PATTERN IS BORROWED, NOT INVENTED ────────────────────────────────────
//
// `scripts/ingest/graph/coverage.ts` already does exactly this job for the
// cross-reference graph, and `check-4a-coverage.ts` fails its build if any
// string in it states a figure about the corpus. The brief is explicit that
// this must FOLLOW that pattern rather than start a second one, so the shape
// here is deliberately the same: a queried object, a `describe…` function that
// only interpolates, and a check that plants a violation and watches the rule
// fire.
//
// ⚠⚠ EVERY NUMBER AND EVERY DATE BELOW IS QUERIED. There is no string in this
// file that states a figure about the graph, and `check-surface-3.ts` fails the
// build if one appears. The rule exists because this project has already had a
// hardcoded caveat outlive its own truth, be retired twice, and come back a
// third time by living in a comment.
//
// ⚠⚠ AND THE SIGNAL LADDER IS DERIVED FROM THE CONFIG, NEVER RESTATED HERE.
// `POSITION_CONFIG.halfLifeYears` is keyed by `SignalType`, so it is the one
// complete list of the ladder; iterating it is what makes it IMPOSSIBLE to add
// a signal type and silently omit it from the coverage statement. A hand-kept
// list in this file could only ever be right by accident — which is the exact
// wording `heading-map.ts` uses about the last hand-kept list we had.
//
// ⚠⚠ AND THE "OUR RECORD STARTS LATE" TEST HAS NO THRESHOLD IN IT. A number
// like "warn if the record begins within 25 years" would be a figure about the
// graph, written down, going stale — the precise thing this file forbids. The
// test is instead SELF-REFERENTIAL: a record is late if it begins later than
// the earliest date the position graph holds ANYWHERE. Commons divisions begin
// twenty-odd years after our own EDM record does, and that gap is arithmetic on
// two queried dates rather than a judgement anybody typed.
// ─────────────────────────────────────────────────────────────────────────────

import { getNeonPool } from '@/lib/pg-pool'
import { POSITION_CONFIG, configVersion, type SignalType } from './position-config'

/**
 * ⚠ WHERE A SCORED ANSWER KEY WOULD LIVE.
 *
 * Design §8 gates every estimate on "a hand-labelled validation set … Charlie validates". No such
 * table exists today. The name is declared here and PROBED at run time rather than asserted, so
 * that on the day a later sprint creates and populates it the coverage statement changes by
 * itself — nobody has to remember to come back and delete a sentence.
 */
export const ANSWER_KEY_TABLE = 'position_answer_key'

/**
 * How a signal type stands in relation to one particular answer.
 *
 * ⚠⚠ THE THIRD VALUE IS THE ONE THE BRIEF ASKED FOR BY NAME. "Searched and found nothing" and
 * "we hold no data of this kind at all" are different facts about different things — the first is
 * about this question, the second is about us — and collapsing them tells a user that a member has
 * sponsored no amendments when the truth is that we have never ingested an amendment.
 */
export type SignalLayerStatus =
  /** rows of this type contributed to the answer being shown */
  | 'contributed'
  /** the graph holds rows of this type; none of them bore on the targets asked about */
  | 'searched-none'
  /** ⚠ the graph holds NO rows of this type at all, for anybody, ever */
  | 'no-source-data'

export interface SignalLayer {
  signalType: SignalType
  /**
   * Ordinary words for the type — what the member actually did.
   *
   * ⚠ A BARE NOUN PHRASE, because it is dropped into the middle of a sentence. The first draft
   * folded the qualification into it ("interests declared in the register — an alignment prior,
   * never a stance") and produced "Our record of interests declared in the register — an alignment
   * prior, never a stance begins on 13 December 2012", which is unreadable. The qualification is a
   * separate field for that reason, not because it is optional.
   */
  what: string
  /** ⚠ What this signal type IS NOT. Never dropped: it is the never-claim rule at the type level. */
  gloss: string | null
  status: SignalLayerStatus
  /** Rows of this type in the whole graph. Queried. */
  heldRows: number
  /** Rows of this type that contributed to the answer in hand. Zero unless `contributed`. */
  usedRows: number
  /** ⚠ What a reader loses when this layer is absent. Printed only when it is. */
  consequence: string
}

/** The span of a record we hold, so a reader can see what falls outside it. */
export interface RecordWindow {
  id: string
  /** The signal type this record feeds, so a surface can show only the windows its answer rests on. */
  signalType: SignalType
  what: string
  gloss: string | null
  rows: number
  earliest: string | null
  latest: string | null
  /**
   * ⚠ Non-null when this record begins LATER than the earliest thing the graph holds — computed
   * against live state, never against a threshold somebody chose.
   */
  note: string | null
  /** Whole years between the graph's earliest record and this one's start. Derived, not stated. */
  yearsAfterEarliest: number
}

export interface PositionCoverage {
  generatedAt: string
  /** Every signal type in the ladder, named whether or not it has data. */
  layers: SignalLayer[]
  /** The record windows behind those layers. */
  records: RecordWindow[]
  /** The earliest date anywhere in the position graph — the basis every window is judged against. */
  graphEarliest: string | null
  /**
   * ⚠⚠ THE ESTIMATE SIDE. `scored` is the number of rows in a hand-labelled answer key that the
   * estimates have been measured against. Design §8 requires it before any estimate is presented
   * as anything but an estimate.
   */
  answerKey: { table: string; exists: boolean; scored: number }
  /**
   * ⚠ USER JUDGEMENTS ARE NOT AN ANSWER KEY, and they are carried in a separate field so that no
   * caller can mistake one for the other. 25-L: "this is corroboration, not verification … a
   * partisan sample agrees with itself."
   */
  corroboration: { judgements: number; judges: number }
  /** The config the numbers on screen were produced by. */
  configVersion: string
}

/**
 * The ladder, in ordinary words. ⚠ KEYED BY `SignalType`, so TypeScript refuses to compile if a
 * signal type is added to the config and not described here — the failure is a build error rather
 * than a silently missing line in a coverage statement.
 */
const LAYER_WORDS: Record<SignalType, { what: string; gloss: string | null; consequence: string }> = {
  vote: {
    what: 'votes in recorded divisions of the Commons and the Lords',
    gloss: 'the only signal here that is a plain fact about an act rather than a reading of one',
    consequence: 'without it there is no record of how anybody actually voted',
  },
  edm_signature: {
    what: 'signatures on Early Day Motions',
    gloss: 'voluntary, unwhipped and deliberate',
    consequence: 'without it a member who never got a vote on a subject, but signed motions about '
      + 'it for years, looks silent',
  },
  amendment_sponsorship: {
    what: 'amendments a member put their name to',
    gloss: null,
    consequence: 'without it the most active form of legislative effort there is — writing the '
      + 'change yourself — is invisible, and a member who fought a Bill line by line without ever '
      + 'winning a division appears not to have engaged with it at all',
  },
  committee_membership: {
    what: 'seats held on select and public bill committees',
    gloss: null,
    consequence: 'without it we cannot show that a member has spent years on the committee that '
      + 'scrutinises exactly this subject, which is the commonest reason one member knows a field '
      + 'far better than their voting record suggests',
  },
  declared_interest: {
    what: 'interests declared in the register',
    gloss: 'an alignment prior, never a stance',
    consequence: 'without it a financial or professional connection to the subject is not visible '
      + 'beside the position it might bear on',
  },
  witness_appearance: {
    what: 'appearances as a witness before a committee inquiry',
    gloss: 'attention, not a side',
    consequence: 'without it the fact that somebody turned up to give evidence on this subject is '
      + 'lost, and that is a signal of attention even when it carries no direction',
  },
  political_donation: {
    what: 'donations recorded in the Electoral Commission register',
    gloss: 'a funding path, never a position',
    consequence: 'without it a declared funding relationship between a donor and a recipient is not '
      + 'on the page beside the record it might bear on',
  },
}

/**
 * The signal types in ladder order.
 *
 * ⚠⚠ DERIVED FROM THE CONFIG, NOT RESTATED. `halfLifeYears` is `Record<SignalType, …>`, so its
 * keys ARE the ladder. A new signal type appears in the coverage statement the moment it appears
 * in the config, with no edit here — and that is the property `check-surface-3.ts` asserts.
 */
export function ladder(): SignalType[] {
  return Object.keys(POSITION_CONFIG.halfLifeYears) as SignalType[]
}

interface HeldCounts {
  held: Record<string, number>
  windows: RecordWindow[]
  graphEarliest: string | null
}

let cached: { at: number; value: HeldCounts } | null = null
const CACHE_MS = 300_000

/**
 * What the graph holds, per signal type, and the span of each record.
 *
 * ⚠ CACHED FOR MINUTES, NOT PRECOMPUTED. These are whole-table counts and they belong on a page a
 * user is waiting for. A cache that expires is a figure that moves when the graph does; a constant
 * is a figure that does not. Only the first is allowed here.
 */
async function heldCounts(): Promise<HeldCounts> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  const pool = getNeonPool()

  // ⚠ Stored signals in one grouped pass. A type with no rows does not appear in this result at
  // all, which is exactly why the caller iterates the LADDER and looks each type up here, rather
  // than iterating what came back. Iterating the result is how a type with no data gets silently
  // skipped — the failure the brief names.
  const { rows: stored } = await pool.query<{
    signal_type: string; n: string; earliest: string | null; latest: string | null
  }>(
    `SELECT signal_type, COUNT(*)::bigint n,
            MIN(observed_at)::text earliest, MAX(observed_at)::text latest
       FROM position_signal_stored
      WHERE superseded_by IS NULL
      GROUP BY 1`)

  // ⚠ Votes are DERIVED, not stored, so they are counted at their source. `division_votes` is the
  // table `position_signal_vote` is built from and the two agree by construction; counting the
  // view instead would materialise the whole graph on a user's page load.
  const { rows: [votes] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::bigint n FROM division_votes WHERE vote IN ('aye', 'no')`)

  const { rows: houses } = await pool.query<{
    house: string; n: string; earliest: string; latest: string
  }>(
    `SELECT house, COUNT(*)::bigint n, MIN(division_date)::text earliest, MAX(division_date)::text latest
       FROM divisions GROUP BY 1 ORDER BY 1`)

  const held: Record<string, number> = { vote: Number(votes.n) }
  for (const r of stored) held[r.signal_type] = Number(r.n)

  const raw: Array<Omit<RecordWindow, 'note' | 'yearsAfterEarliest'>> = []
  for (const h of houses) {
    raw.push({
      id: `divisions:${h.house}`,
      signalType: 'vote',
      what: `recorded divisions of the ${h.house === 'commons' ? 'House of Commons' : 'House of Lords'}`,
      gloss: LAYER_WORDS.vote.gloss,
      rows: Number(h.n),
      earliest: h.earliest,
      latest: h.latest,
    })
  }
  for (const r of stored) {
    const w = LAYER_WORDS[r.signal_type as SignalType]
    if (!w) continue
    raw.push({
      id: `signals:${r.signal_type}`,
      signalType: r.signal_type as SignalType,
      what: w.what,
      gloss: w.gloss,
      rows: Number(r.n),
      earliest: r.earliest,
      latest: r.latest,
    })
  }

  // ⚠⚠ THE BASIS, AND IT IS THE GRAPH'S OWN. The earliest date this graph holds anywhere. Any
  // record starting after it is a record with a hole in front of it that our OWN data proves is
  // fillable — which is a far stronger and far more honest test than a threshold somebody picked.
  const dates = raw.map((r) => r.earliest).filter((d): d is string => !!d).sort()
  const graphEarliest = dates[0] ?? null

  const windows: RecordWindow[] = raw.map((r) => {
    const years = r.earliest && graphEarliest
      ? Math.floor((Date.parse(r.earliest) - Date.parse(graphEarliest)) / 31_557_600_000)
      : 0
    return {
      ...r,
      yearsAfterEarliest: years,
      // A record that starts where the graph starts has no hole in front of it and gets no note.
      note: years >= 1
        ? 'anything before that date is absent from this answer, which is not the same as nobody '
          + 'having taken a position'
        : null,
    }
  })

  const value = { held, windows, graphEarliest }
  cached = { at: Date.now(), value }
  return value
}

export interface CoverageOptions {
  /**
   * Signal types that actually contributed to the answer in hand, with their counts — normally
   * `PositionsResult.actors[].signalCounts` merged. Omit for a graph-wide statement.
   */
  used?: Record<string, { n: number }>
}

export async function getPositionCoverage(opts: CoverageOptions = {}): Promise<PositionCoverage> {
  const pool = getNeonPool()
  const { held, windows, graphEarliest } = await heldCounts()

  // ⚠ THE ANSWER KEY IS PROBED, NOT ASSUMED ABSENT. Two queries, because "the table is not there"
  // and "the table is there and empty" are different facts, and the second is the one that would
  // otherwise be reported as success.
  const { rows: [tbl] } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::int n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1`, [ANSWER_KEY_TABLE])
  const exists = Number(tbl.n) > 0
  let scored = 0
  if (exists) {
    // ⚠ The table name is a module constant, never user input, and it has just been matched
    // against `information_schema` — the only two facts that make this interpolation safe.
    const { rows: [k] } = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::bigint n FROM ${ANSWER_KEY_TABLE}`)
    scored = Number(k.n)
  }

  const { rows: [judged] } = await pool.query<{ n: string; judges: string }>(
    `SELECT COUNT(*)::bigint n, COUNT(DISTINCT "userId")::bigint judges
       FROM "GraphClaimJudgement" WHERE "agreed" IS NOT NULL`)

  const layers: SignalLayer[] = ladder().map((t) => {
    const heldRows = held[t] ?? 0
    const usedRows = opts.used?.[t]?.n ?? 0
    return {
      signalType: t,
      what: LAYER_WORDS[t].what,
      gloss: LAYER_WORDS[t].gloss,
      // ⚠ THE ORDER OF THESE TESTS IS THE WHOLE POINT. "No source data" is decided FIRST and by
      // the graph-wide count, so a type with nothing behind it can never be reported as having
      // been searched — which would be a false statement about the record, told to flatter us.
      status: heldRows === 0 ? 'no-source-data' : usedRows > 0 ? 'contributed' : 'searched-none',
      heldRows,
      usedRows,
      consequence: LAYER_WORDS[t].consequence,
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    layers,
    records: windows,
    graphEarliest,
    answerKey: { table: ANSWER_KEY_TABLE, exists, scored },
    corroboration: { judgements: Number(judged.n), judges: Number(judged.judges) },
    configVersion: configVersion(),
  }
}

/** Drop the memo — for a check that changes state and re-reads. */
export function resetPositionCoverageCache(): void { cached = null }

// ─────────────────────────────────────────────────────────────────────────────
// THE WORDS
//
// ⚠ TWO RENDERINGS OF ONE OBJECT, NOT TWO STATEMENTS. `coverageSentences` is
// what a user reads beside a claim; `describePositionCoverage` is the full block
// for the admin surface and the generated document. Both interpolate the SAME
// `PositionCoverage`, so the screen and the printed report cannot say different
// things — which is the failure §A.1 found for the no-producer caveat, which was
// screen-only for two sprints.
// ─────────────────────────────────────────────────────────────────────────────

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** `2016-03-09` → `9 March 2016`. Dates come from the database; only the format is written here. */
function humanDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} `
    + `${d.getUTCFullYear()}`
}

/**
 * The coverage statement in ordinary words, for a surface a member of the public is reading.
 *
 * ⚠ EVERY SENTENCE IS COMPOSED FROM `c`. There is no figure and no date in this function's own
 * strings, which is what makes the statement move when the graph does.
 *
 * ⚠ IT NAMES THE WINDOWS THE ANSWER RESTS ON, not every window we hold. A user reading about one
 * member's votes does not need the span of the donations register; they need to know that the
 * division record they are looking at starts where it starts. The full list is in
 * `describePositionCoverage`, which is what the document and the admin surface print.
 */
export function coverageSentences(c: PositionCoverage): string[] {
  const out: string[] = []

  // 1 ── the windows a reader of THIS answer has to know about
  //
  // ⚠⚠ TWO RULES, AND NEITHER NAMES A SIGNAL TYPE. The first is obvious: state the window behind
  // anything that actually contributed. The second is the one that matters, and it is why this is
  // not a filter on `contributed` alone — ALWAYS state the window with the largest hole in front
  // of it, whether or not it contributed, because that is by definition the record most likely to
  // be mistaken for a complete one.
  //
  // ⚠ A first draft filtered on contributors only, and on an answer built from EDM signatures the
  // Commons window — the single fact this whole section exists to state — VANISHED FROM THE PAGE.
  // Deriving the second rule from `yearsAfterEarliest` picks the same record for the right reason
  // and keeps picking the right one if the data moves; hardcoding `signalType === 'vote'` would
  // have been the figure-about-the-graph problem wearing a different hat.
  const contributedTypes = new Set(
    c.layers.filter((l) => l.status === 'contributed').map((l) => l.signalType))
  const widest = c.records.reduce<number>((m, r) => Math.max(m, r.yearsAfterEarliest), 0)
  const relevant = c.records.filter((r) =>
    r.note && (contributedTypes.has(r.signalType) || r.yearsAfterEarliest === widest))
  for (const r of relevant) {
    out.push(`Our record of ${r.what} begins on ${humanDate(r.earliest!)} and runs to `
      + `${humanDate(r.latest!)} — ${r.note}.`)
  }

  // 2 ── what contributed, what was searched, and ⚠ what we simply do not hold
  const contributed = c.layers.filter((l) => l.status === 'contributed')
  const searched = c.layers.filter((l) => l.status === 'searched-none')
  const absent = c.layers.filter((l) => l.status === 'no-source-data')
  if (contributed.length) {
    out.push(`What is shown above draws on ${list(contributed.map((l) => l.what))}.`)
  }
  if (searched.length) {
    out.push(`We also hold ${list(searched.map((l) => l.what))}, and none of it bore on this question.`)
  }
  // ⚠⚠ NAMED, NEVER SILENTLY SKIPPED. The brief: "They are printed by name on every run rather
  // than silently skipped, and the surface must do the same."
  if (absent.length) {
    out.push(`We hold no data at all of these kinds, for anybody: ${list(absent.map((l) => l.what))}. `
      + `Their absence here says nothing about whether they exist.`)
  }

  // 3 ── the estimate is an estimate, and the acts beneath it are not
  out.push(c.answerKey.scored > 0
    ? `The stance and the confidence are estimates, scored against ${c.answerKey.scored} hand-checked `
      + `cases (method ${c.configVersion}).`
    : `The stance and the confidence are estimates. They have never been scored against a verified `
      + `answer key — no such set exists yet — so read them as our reading of the record, not as a `
      + `finding. The recorded acts themselves are facts: each one happened on the date shown, and `
      + `each links to its source.`)

  // 4 ── and a user judgement is not an answer key
  if (c.corroboration.judgements > 0) {
    out.push(`${c.corroboration.judgements} judgement${c.corroboration.judgements === 1 ? '' : 's'} `
      + `from ${c.corroboration.judges} ${c.corroboration.judges === 1 ? 'person' : 'people'} `
      + `${c.corroboration.judgements === 1 ? 'has' : 'have'} been recorded against claims like this `
      + `one. That is corroboration, not verification.`)
  }

  return out
}

/**
 * The full block, for the admin surface and the generated document.
 *
 * ⚠ Same shape as `describeCoverage` in the citation graph's `coverage.ts`, on purpose. Two
 * coverage blocks that read differently are two things a reader has to learn.
 */
export function describePositionCoverage(c: PositionCoverage): string[] {
  const lines: string[] = []
  lines.push(`COVERAGE — what this answer could NOT see (generated ${c.generatedAt.slice(0, 16)}Z)`)

  lines.push(`  the record we hold (earliest anywhere in the graph: ${c.graphEarliest ?? 'unknown'}):`)
  for (const r of c.records) {
    lines.push(`    ${r.id} — ${r.what}${r.gloss ? ` (${r.gloss})` : ''}: `
      + `${r.rows.toLocaleString()} rows, ${r.earliest ?? 'unknown'} to ${r.latest ?? 'unknown'}`)
    if (r.note) {
      lines.push(`        ⚠ begins ${r.yearsAfterEarliest} years after the graph's earliest record — ${r.note}.`)
    }
  }

  const by = (s: SignalLayerStatus) => c.layers.filter((l) => l.status === s)
  const named = (l: SignalLayer) => `${l.what}${l.gloss ? ` — ${l.gloss}` : ''}`

  lines.push(`  contributed to this answer:`)
  for (const l of by('contributed')) {
    lines.push(`    ${l.signalType} — ${named(l)} (${l.usedRows.toLocaleString()} of `
      + `${l.heldRows.toLocaleString()} held)`)
  }
  if (!by('contributed').length) lines.push(`    (none)`)

  lines.push(`  held, and bore on nothing asked here:`)
  for (const l of by('searched-none')) {
    lines.push(`    ${l.signalType} — ${named(l)} (${l.heldRows.toLocaleString()} held)`)
  }
  if (!by('searched-none').length) lines.push(`    (none)`)

  lines.push(`  ⚠⚠ NO SOURCE DATA AT ALL — held for nobody, ever:`)
  for (const l of by('no-source-data')) {
    lines.push(`    ${l.signalType} — ${named(l)}`)
    lines.push(`        consequence: ${l.consequence}`)
  }
  if (!by('no-source-data').length) lines.push(`    (none)`)

  lines.push(`  the estimate:`)
  lines.push(c.answerKey.exists
    ? `    answer key ${c.answerKey.table}: ${c.answerKey.scored.toLocaleString()} scored cases`
    : `    ⚠⚠ NO ANSWER KEY EXISTS (${c.answerKey.table} is not a table). Every stance score and `
      + `every confidence here is UNVALIDATED — design §8's gate has never been passed.`)
  lines.push(`    config version: ${c.configVersion}`)
  lines.push(`    user judgements recorded: ${c.corroboration.judgements.toLocaleString()} from `
    + `${c.corroboration.judges.toLocaleString()} people`)
  lines.push(`        ⚠ corroboration, not verification — a partisan sample agrees with itself.`)

  return lines
}
