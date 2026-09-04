// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §2 — POSITIONS INTO THE GENERATED DOCUMENT.
//
// ══ WHAT THE BRIEF ASKED FOR, AND WHAT WAS ACTUALLY WRONG ════════════════════
//
// The brief says *"LEX 25-M's audit found `POSITIONS` is the one heading with no
// carrier"* and asks for a carrier in the snapshot. ⚠⚠ **THAT PREMISE IS ALREADY
// CORRECTED AND THE BRIEF PREDATES THE CORRECTION.** 25-Z §A.1 rendered all
// three documents and matched the heading string: `POSITIONS` REACHES the
// evidence pack, the long report and the meeting pack. The carrier was never
// missing. The CONTENT was — every builder skips a heading with no items, and
// exactly one `EvidenceItem` in the whole database has ever carried
// `headingKey = 'POSITIONS'`, filed by the material extraction from a document
// Charlie uploaded himself.
//
// ⚠ SO THE MISSING PIECE IS A PRODUCER, NOT A CARRIER — and that is a better
// outcome than the brief expected, because it means **nothing owned by the Lex
// stream has to change for positions to reach the document.** Verified by
// reading the seam rather than assuming it: `proposal-snapshot.ts` selects
// `evidenceItem.findMany({ where: { ideaId, status: { not: 'REJECTED' } } })`
// with NO version filter, so a row written here is carried by the existing
// machinery into all three documents.
//
// ══ ⚠⚠ THE FREEZE, AND WHY IT IS ALREADY SATISFIED ═══════════════════════════
//
// §2: *"The document is frozen at publication; the graph is not. A position
// written into a proposal version must be the position as it stood then, with
// the date and the config version that produced it."*
//
// Two mechanisms, and both are needed because they fail differently:
//
//   1. `ProposalVersion.snapshot` stores the entire snapshot object as JSON, so
//      a published version renders from its own stored copy and CANNOT
//      re-render against a changed graph. That is structural.
//   2. ⚠ AND THE PROVENANCE IS WRITTEN INTO THE PROSE ANYWAY — the decay date
//      and the config version are IN the body text, not in a sibling column.
//      Mechanism 1 protects the published version; mechanism 2 protects the
//      loose text if anybody ever copies a paragraph out of it, which is the
//      failure mode a stored blob cannot reach.
//
// ══ ⚠⚠ AND THE EVIDENCE TRAVELS WITH THE CLAIM, AS A TYPE ════════════════════
//
// §2: *"Every position in the document carries its supporting acts — the vote,
// the date, the source — or it does not go in."* 25-Z §C says how, and it is
// the one instruction in that report that is about a TYPE rather than a review
// step: *"the inference and its grounds must be ONE object … a renderer must not
// be ABLE to print the claim alone."*
//
// So `grounds` here is a NON-EMPTY TUPLE — `[RecordedAct, ...RecordedAct[]]`.
// A `PositionForDocument` with no grounds does not fail a check; it does not
// compile. `positionForDocument()` is the only constructor and it returns null
// rather than an object when the grounds are empty. There is no path that
// produces a claim without its evidence, which is the difference between a rule
// and a guard.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  positionsFor, findTargetsByPhrases, parseTarget,
  type ActorPosition, type PositionTarget,
} from './positions'
import { extractPhrasesFrom } from './phrases'
import {
  getPositionCoverage, coverageSentences, describePositionCoverage, type PositionCoverage,
} from './position-coverage'
import { configVersion } from './position-config'

/** The passKey every row this producer writes carries. One string, so the rows are findable. */
export const POSITIONS_PASS_KEY = 'positions'

/** ⚠ Names the producer in the document's own source line, so a reader can tell where it came from. */
export const POSITIONS_SOURCE_TYPE = 'POSITION_GRAPH'

/**
 * One sourced thing a member did. Every field is a fact with a date; there is no room here for a
 * score, and that is deliberate — a type that cannot express our assessment cannot leak it into
 * the evidence list.
 */
export interface RecordedAct {
  what: string
  date: string
  /** ⚠ SURFACE 4 §3 — the party they sat for WHEN THEY DID THIS. Null where the act carries none. */
  partyAtTheTime: string | null
  /** 'for' | 'against' | 'took part' — how they acted, in words a non-specialist reads. */
  direction: 'for' | 'against' | 'took part'
  signalType: string
  sourceUrl: string | null
}

/**
 * ⚠⚠ ONE OBJECT. THE CLAIM AND ITS GROUNDS CANNOT BE SEPARATED BY A RENDERER, BECAUSE THEY
 * CANNOT BE SEPARATED BY THE TYPE.
 *
 * `grounds` is a non-empty tuple. TypeScript will not let this object exist with an empty list, so
 * "every position carries its supporting acts or it does not go in" is enforced at compile time
 * rather than by a reviewer noticing. See the file header.
 */
export interface PositionForDocument {
  actorName: string
  identityStatement: string
  identityCaveat: string | null
  /** The stance word WITH the thing it is a stance toward, from `composeClaim`. Never a bare word. */
  claim: string
  claimCaveat: string | null
  confidenceWording: string
  /**
   * ⚠ SURFACE 4 §3 — THE NUMBER AS WELL AS THE WORDS. The brief asks for both, and the reason is
   * not bookkeeping: the words come from a three-band vocabulary, so two readings that differ by
   * a factor of two can print the same adjective. The number is what makes a printed report
   * checkable against a re-run.
   */
  confidence: number
  /** Parliament's member id where we hold one — the identifier §3 asks the document to carry. */
  parlMemberId: number | null
  /** ⚠ NON-EMPTY BY CONSTRUCTION. */
  grounds: [RecordedAct, ...RecordedAct[]]
  /** What the graph was asked about, and how we got there from the proposer's own words. */
  targetLabel: string
  targetKey: string
  matchedPhrase: string
  matchedWords: number
  /** ⚠ THE FREEZE. The date the decay was computed to, and the config that produced the numbers. */
  asOf: string
  configVersion: string
}

function directionWord(d: number): RecordedAct['direction'] {
  if (d > 0) return 'for'
  if (d < 0) return 'against'
  // ⚠ ZERO IS "TOOK PART", NOT "NEUTRAL" — an inquiry appearance or a donation carries no
  // direction at all, and calling it neutral would assert a position we have not observed.
  return 'took part'
}

/**
 * The ONLY constructor. Returns null — never a grounds-less object — when there is nothing to
 * show, so the caller has to handle absence rather than render a claim with an empty list under it.
 */
export function positionForDocument(
  actor: ActorPosition,
  ctx: { targetLabel: string; targetKey: string; matchedPhrase: string; matchedWords: number; asOf: string },
): PositionForDocument | null {
  const acts: RecordedAct[] = actor.grounds.map((g) => ({
    what: g.targetLabel ?? `${g.targetType} ${g.targetId}`,
    date: g.date,
    partyAtTheTime: g.partyAtTheTime,
    direction: directionWord(g.direction),
    signalType: g.signalType,
    sourceUrl: g.sourceUrl,
  }))
  // ⚠ THE GATE. Everything below this line has at least one act behind it.
  if (!acts.length) return null
  return {
    actorName: actor.name,
    identityStatement: actor.identityStatement,
    identityCaveat: actor.identityCaveat,
    claim: actor.claim,
    claimCaveat: actor.claimCaveat,
    confidenceWording: actor.confidenceWording,
    confidence: actor.confidence,
    parlMemberId: actor.parlMemberId,
    grounds: [acts[0], ...acts.slice(1)],
    targetLabel: ctx.targetLabel,
    targetKey: ctx.targetKey,
    matchedPhrase: ctx.matchedPhrase,
    matchedWords: ctx.matchedWords,
    asOf: ctx.asOf,
    configVersion: configVersion(),
  }
}

/**
 * One position, as the markdown body of an `EvidenceItem`.
 *
 * ⚠ THE ACTS ARE PRINTED BEFORE ANY WORD OF ASSESSMENT. On screen the record is above the
 * judgement (25-L §5); in a printed document there are no clicks and no reveal, so the same order
 * is the only thing that carries the design across. A reader who stops after the first block has
 * read facts; a reader who stops after the second has read facts and then our reading of them.
 *
 * ⚠ AND IT IS LABELLED AS OUR READING, IN WORDS, EVERY TIME. 25-Z §C: *"LIKELY — printed as Lex's
 * reasoning, never as the actor's position."*
 */
export function renderPositionBody(p: PositionForDocument, ranking?: RankingNote | null): string {
  const lines: string[] = []

  // ⚠ SURFACE 4 §3 — the actor, with the identifier that makes them checkable. A name alone is
  // not an identity: two members have shared a name, and a report a reader cannot verify against
  // Parliament's own record is a report they have to take on trust.
  const who = [
    p.actorName,
    p.parlMemberId !== null ? `Parliament member id ${p.parlMemberId}` : null,
  ].filter(Boolean).join(', ')
  lines.push(`What the record shows. ${who} — ${p.identityStatement}`
    + `${p.identityCaveat ? ` (${p.identityCaveat})` : ''}.`)
  lines.push('')
  for (const g of p.grounds) {
    // ⚠ EACH ACT ON ITS OWN LINE WITH ITS OWN LINK, SPELLED OUT IN FULL. The question panel
    // renders this field with `whitespace-pre-wrap` and NOT as markdown, so a bullet written as
    // "- " shows a literal hyphen and a markdown link shows its brackets. Plain lines and bare
    // URLs are what that renderer can actually present, and a bare URL is at least selectable.
    // ⚠ THE PARTY IS THE ONE ON THE VOTE RECORD, so it is printed beside the act and never
    // beside the name: it was true of that act on that day and may not be true today.
    lines.push(`${g.date} — ${g.direction} “${g.what}” (${g.signalType}`
      + `${g.partyAtTheTime ? `, sitting as ${g.partyAtTheTime}` : ''})`)
    lines.push(g.sourceUrl ? `    ${g.sourceUrl}` : '    No link is held for this record.')
  }
  lines.push('')
  // ⚠ THE WORD "OUR READING" IS NOT DECORATION. Without it the sentence below is a statement
  // about a member's beliefs rather than a statement about what we computed from the acts above.
  lines.push(`Our reading of those acts, which is an estimate and not a finding: `
    + `${p.claim}.${p.claimCaveat ? ` ${p.claimCaveat}.` : ''} `
    + `Confidence: ${p.confidenceWording} (${p.confidence.toFixed(2)} on a scale of 0 to 1).`)
  lines.push('')
  lines.push(`How this question was chosen. We matched the phrase “${p.matchedPhrase}” `
    + `(${p.matchedWords} word${p.matchedWords === 1 ? '' : 's'}) from the proposal's own text `
    + `against the titles of divisions and motions we hold, and asked the graph about `
    + `“${p.targetLabel}”.`)
  // ══ ⚠⚠ SURFACE 4 — AND WHY THIS PERSON RATHER THAN ANOTHER ═══════════════════════════════
  // Five names out of 254, in name order, printed without saying so, read as the five who
  // matter. `positionsFor()` computes the sentence that makes that honest and SURFACE 3's filer
  // discarded it.
  if (ranking && ranking.ofMatched > ranking.shown) {
    lines.push('')
    lines.push(`Who else is here. ${ranking.note
      ?? `${ranking.shown} of ${ranking.ofMatched.toLocaleString()} people with a record on this, `
        + `ordered by ${ranking.key}.`}`)
  }
  lines.push('')
  // ⚠⚠ THE FREEZE, IN THE PROSE. See the file header: the stored snapshot protects the published
  // document, and this sentence protects any paragraph anybody copies out of it.
  lines.push(`Computed on ${p.asOf} under method ${p.configVersion}. The graph changes; this `
    + `paragraph does not. Re-read it against the live record before relying on it.`)

  return lines.join('\n')
}

/** The order, in the graph's own words. ⚠ Never restated by a caller — see `Ranking`. */
export interface RankingNote {
  note: string | null
  ofMatched: number
  shown: number
  key: string
}

/**
 * ⚠⚠ THE ONE LINE THE SUMMARY DOCUMENTS WILL PRINT.
 *
 * Measured by rendering all three: the LONG REPORT prints an evidence row's `body`, but the
 * EVIDENCE PACK and the MEETING PACK print only its title, citation and `siftReason`. So a
 * position whose grounds live solely in the body reaches one document out of three, and §2 is
 * explicit that "every position in the document carries its supporting acts … or it does not go
 * in" — in a printed report there are no clicks.
 *
 * `siftReason` is the field those builders show, and its contract is "the one-line reason this
 * source bears on the proposal, VERBATIM OR ABSENT, never invented". For a position the honest
 * one-liner is the act itself plus how the question was chosen, both composed from data.
 */
export function positionSiftReason(p: PositionForDocument): string {
  const g = p.grounds[0]
  return `Matched to this proposal on the phrase “${p.matchedPhrase}”. Most recent recorded act: `
    + `${g.date}, ${g.direction} “${g.what}”. ${p.grounds.length} recorded act`
    + `${p.grounds.length === 1 ? '' : 's'} in total, listed in full in the long report.`
}

/**
 * ⚠⚠ THE COVERAGE ROW'S TITLE, WITH THE SUBSTANCE IN IT.
 *
 * The MEETING PACK prints one line per finding — `title — citation` — and nothing else. A row
 * titled "What this section does not cover" is, in that document, a promise with no content: the
 * reader is told a caveat exists and not what it says. The title is the ONE field every builder
 * prints, so the essential fact goes in it.
 *
 * ⚠ Generated, like everything else here. The count of signal types with no data and the date the
 * record begins are both read off the coverage object.
 */
export function coverageTitle(c: PositionCoverage): string {
  const absent = c.layers.filter((l) => l.status === 'no-source-data')
  const widest = c.records.reduce<typeof c.records[number] | null>(
    (m, r) => (!m || r.yearsAfterEarliest > m.yearsAfterEarliest ? r : m), null)
  const bits: string[] = []
  if (widest?.earliest) bits.push(`our record of ${widest.what} begins ${widest.earliest}`)
  if (absent.length) {
    bits.push(`${absent.length} signal type${absent.length === 1 ? '' : 's'} have no source data`)
  }
  return bits.length
    ? `What this section does not cover — ${bits.join(', and ')}`
    : 'What this section does not cover'
}

/**
 * The same, for the coverage row. ⚠ Composed from the object, so it moves when the graph does —
 * a summary document must not carry a caveat the long report has outgrown.
 */
export function coverageSiftReason(c: PositionCoverage): string {
  const absent = c.layers.filter((l) => l.status === 'no-source-data')
  const widest = c.records.reduce<typeof c.records[number] | null>(
    (m, r) => (!m || r.yearsAfterEarliest > m.yearsAfterEarliest ? r : m), null)
  const parts: string[] = []
  if (widest?.earliest) parts.push(`Our record of ${widest.what} begins ${widest.earliest}`)
  if (absent.length) {
    parts.push(`${absent.length} signal type${absent.length === 1 ? '' : 's'} `
      + `(${absent.map((l) => l.what).join('; ')}) have no source data at all`)
  }
  if (!c.answerKey.exists || c.answerKey.scored === 0) {
    parts.push('and the stance estimates have never been scored against a verified answer key')
  }
  return `${parts.join('; ')}. The full statement is in the long report.`
}

/** The coverage statement, as its own `EvidenceItem` body under the same heading. */
export function renderCoverageBody(c: PositionCoverage): string {
  return [
    ...coverageSentences(c).map((s) => `${s}`),
    '',
    '```',
    ...describePositionCoverage(c),
    '```',
  ].join('\n\n').replace(/\n\n```\n\n/g, '\n\n```\n').replace(/\n\n```$/, '\n```')
}

/** What the graph was asked about, and how the question was arrived at. */
export interface TargetContext {
  targetLabel: string
  targetKey: string
  matchedPhrase: string
  matchedWords: number
  asOf: string
}

export interface FiledPositions {
  ideaId: string
  /** The targets the proposal's own words resolved to, or null when nothing matched. */
  target: TargetContext | null
  positions: PositionForDocument[]
  /** Rows written, including the coverage note. */
  written: number
  /** Rows this producer had written before and replaced. */
  replaced: number
  /** ⚠ Stated on every run, whether or not anything was filed. */
  coverage: PositionCoverage
  /**
   * ⚠⚠ SURFACE 4 — WHY THESE NAMES AND NOT THE OTHER 249. `positionsFor()` has computed this
   * since GRAPH 3B and SURFACE 3's filer threw it away, so the document printed an ALPHABETICAL
   * SLICE of a 254-actor division as though those five were the significant people.
   */
  ranking: { note: string | null; ofMatched: number; shown: number; key: string } | null
  /** ⚠ Why nothing was filed, where nothing was. Never an empty result with no reason. */
  reason: string | null
}

/**
 * Compute the positions bearing on an idea and FILE THEM under the `POSITIONS` heading, so the
 * existing document machinery carries them into the evidence pack, the long report and the
 * meeting pack.
 *
 * ⚠⚠ IT REPLACES ITS OWN PREVIOUS ROWS, AND ONLY ITS OWN (`passKey = POSITIONS_PASS_KEY`).
 * A position estimate is DERIVED and recomputable by design (§2 of the design document: "estimates
 * can be dropped and rebuilt from signals at any time"), so leaving a stale reading beside a
 * current one would put two different answers under one heading. This is safe for published
 * documents for the reason in the file header: a `ProposalVersion` stores its own copy of the
 * snapshot, so replacing the live row cannot alter a document that has already been published.
 *
 * ⚠ AND IT WRITES THE COVERAGE STATEMENT AS A ROW OF ITS OWN, so §1's statement reaches the
 * document as well as the screen — which is precisely the failure 25-Z §A.1 found for the
 * no-producer caveat, screen-only for two sprints.
 */
export async function filePositionsForIdea(
  ideaId: string,
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<FiledPositions> {
  const limit = opts.limit ?? 5

  const el = await prisma.ideaElicitation.findUnique({
    where: { ideaId }, select: { problem: true, goalDetail: true },
  })
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
  // ⚠ THE PROPOSER'S OWN WORDS, AND THE TITLE IS PASSED SEPARATELY RATHER THAN CONCATENATED.
  // The route that feeds the screen deliberately uses the problem statement rather than the
  // drafted kernel (the kernel is Lex's language). The title is the proposer's too and is their
  // own summary of the subject, so a phrase drawn from it outranks one found in the body —
  // which is the only thing that can tell a central subject from a passing mention.
  const phrases = extractPhrasesFrom(
    idea?.title ?? '',
    `${el?.problem ?? ''} ${el?.goalDetail ?? ''}`.trim(),
  )
  const matches = await findTargetsByPhrases(phrases, 1)
  const coverage = await getPositionCoverage()

  if (!matches.length) {
    return {
      ideaId,
      target: null,
      positions: [],
      written: 0,
      replaced: 0,
      coverage,
      ranking: null,
      reason: 'No phrase of two or more words from the proposal matched the title of any division '
        + 'or motion we hold, so there was nothing to ask the graph about. That is a limit of our '
        + 'matching and of our record, not a statement about whether anybody has taken a position.',
    }
  }

  const m = matches[0]
  const target = parseTarget(`${m.type}:${m.id}`)
  if (!target) {
    return {
      ideaId, target: null, positions: [], written: 0, replaced: 0, coverage, ranking: null,
      reason: `The matched target (${m.type}:${m.id}) could not be parsed.`,
    }
  }

  const asOf = new Date().toISOString().slice(0, 10)
  const result = await positionsFor([target as PositionTarget], {
    limit, actorKind: 'person', maxGroundsPerActor: 12, asOf,
  })

  // ⚠⚠ SURFACE 4 — CARRIED, NOT RECOMPUTED. The graph decides what its own order means, and
  // `Ranking` exists precisely because "showing the top 5" over a list in name order is a claim
  // the data does not support.
  const ranking = {
    note: result.ranking.note,
    ofMatched: result.ranking.ofMatched,
    shown: Math.min(limit, result.actors.length),
    key: result.ranking.key,
  }

  const ctx = {
    targetLabel: m.label,
    targetKey: `${m.type}:${m.id}`,
    matchedPhrase: m.matchedPhrase,
    matchedWords: m.matchedWords,
    asOf,
  }
  // ⚠ `positionForDocument` returns null for an actor with no grounds, and those are DROPPED here
  // rather than rendered with an empty list. Absence is not a position.
  const positions = result.actors
    .map((a) => positionForDocument(a, ctx))
    .filter((p): p is PositionForDocument => p !== null)

  // ⚠ THE COVERAGE STATEMENT IS COMPUTED AGAINST WHAT ACTUALLY CONTRIBUTED, not graph-wide, so
  // "searched and found nothing" is a statement about this question.
  const used: Record<string, { n: number }> = {}
  for (const a of result.actors) {
    for (const [k, v] of Object.entries(a.signalCounts)) used[k] = { n: (used[k]?.n ?? 0) + v.n }
  }
  const scopedCoverage = await getPositionCoverage({ used })

  if (!positions.length) {
    return {
      ideaId, target: ctx, positions: [], written: 0, replaced: 0, coverage: scopedCoverage,
      ranking, reason: `We found “${m.label}” by matching “${m.matchedPhrase}”, but hold no recorded `
        + `position for anybody on it.`,
    }
  }

  if (opts.dryRun) {
    return {
      ideaId, target: ctx, positions, written: 0, replaced: 0, coverage: scopedCoverage,
      ranking, reason: 'Dry run — nothing was written.',
    }
  }

  const runVersion = await currentRunVersion(ideaId)

  const replaced = await prisma.$transaction(async (tx) => {
    const gone = await tx.evidenceItem.deleteMany({
      where: { ideaId, passKey: POSITIONS_PASS_KEY },
    })

    for (const p of positions) {
      await tx.evidenceItem.create({
        data: {
          ideaId,
          passKey: POSITIONS_PASS_KEY,
          runVersion,
          headingKey: 'POSITIONS',
          kind: 'FINDING',
          // ⚠ THE TITLE NAMES THE PERSON AND THE THING, never the stance. A heading that reads
          // "Lord X opposes this" is the sentence 25-Z §C forbids, arrived at through a title.
          title: `${p.actorName} — recorded acts bearing on “${p.targetLabel}”`,
          body: renderPositionBody(p, ranking),
          sourceType: POSITIONS_SOURCE_TYPE,
          citation: `Position graph, method ${p.configVersion}, computed ${p.asOf}`,
          url: p.grounds.find((g) => g.sourceUrl)?.sourceUrl ?? null,
          // ⚠ THE ACT ITSELF, because this is the only field the evidence pack and the meeting
          // pack print. See `positionSiftReason`.
          siftReason: positionSiftReason(p),
          // The date of the most recent act behind the claim — the source's date, not the row's.
          sourceDate: new Date(p.grounds[0].date),
          sourceDateBasis: 'CORPUS_ROW',
          status: 'PROPOSED',
        },
      })
    }

    // ⚠⚠ §1's STATEMENT, CARRIED INTO THE DOCUMENT, AT LEAST ONCE. The brief asks for this by
    // name. It is a row of its own rather than a paragraph appended to each position, so it
    // appears once under the heading however many positions there are.
    await tx.evidenceItem.create({
      data: {
        ideaId,
        passKey: POSITIONS_PASS_KEY,
        runVersion,
        headingKey: 'POSITIONS',
        kind: 'FINDING',
        title: coverageTitle(scopedCoverage),
        body: renderCoverageBody(scopedCoverage),
        sourceType: POSITIONS_SOURCE_TYPE,
        citation: `Position graph coverage, generated ${scopedCoverage.generatedAt.slice(0, 10)}`,
        siftReason: coverageSiftReason(scopedCoverage),
        url: null,
        sourceDate: null,
        // ⚠ The coverage statement is about our holdings, not about a source, so it has no source
        // date — and `NO_SOURCE_ROW` says that, rather than leaving a null nobody can interpret.
        sourceDateBasis: 'NO_SOURCE_ROW',
        status: 'PROPOSED',
      },
    })

    return gone.count
  })

  return {
    ideaId,
    target: ctx,
    positions,
    written: positions.length + 1,
    replaced,
    coverage: scopedCoverage,
    ranking,
    reason: null,
  }
}

/**
 * The build version to stamp the rows with.
 *
 * ⚠ THE CURRENT ONE, from the idea's own passes — not 1. 25-Y found 38 findings stranded at
 * `runVersion: 1` and invisible to every build after the first, because a producer outside the
 * build wrote its own default. The snapshot has no version filter so the DOCUMENT is safe either
 * way, but a Lex pass that later reads evidence for this build would not see these rows, and that
 * is the same defect one layer along.
 */
async function currentRunVersion(ideaId: string): Promise<number> {
  const latest = await prisma.deepeningPass.findFirst({
    where: { ideaId }, orderBy: { runVersion: 'desc' }, select: { runVersion: true },
  })
  return latest?.runVersion ?? 1
}
