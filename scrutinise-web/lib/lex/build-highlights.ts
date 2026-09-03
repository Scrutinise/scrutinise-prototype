// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §1 — PUT THE GOOD MATERIAL ON THE SCREEN.
//
// ⚠⚠ THE FINDING THIS FILE EXISTS FOR, AND IT IS THE CHEAPEST FIX IN THE SPRINT BECAUSE
// THE CONTENT ALREADY EXISTS.
//
// Charlie's build produced **70 evidence items with genuine citations** — CRaG 2010 ss.1–3
// with Explanatory Note paragraph numbers, the Lords Constitution Committee's *The
// accountability of civil servants* (2012), PASC's *Who's accountable?* (2014), NAO
// major-projects material, Hansard from 1994 and 2008. Several of those are things four
// public chat models did not find when the same question was put to them.
//
// **None of it was on the screen he read.** `BuildProgress` rendered: a status badge, one
// line per pass, the summary message, the uncertainties, the forks, and the spend. Not one
// finding. Not one citation. Not one source. The evidence was in `EvidenceItem` and the
// build screen has never looked at that table.
//
// So his verdict — "weaker than a single ChatGPT query" — was a fair judgement of what he
// was shown and an unfair one on what was built. This module is the difference.
//
// ⚠ IT RANKS. §1: "The most important references and case studies go at the top.
// Everything else is a footnote or a reference list, not a peer." And: "Delete the rubbish
// rather than rendering everything at equal weight."
//
// The ranking is DETERMINISTIC and it is written down, because a ranking nobody can read is
// a ranking nobody can argue with:
//
//   1. A finding WITH A CITATION outranks one without. "The Constitution Committee reported
//      on exactly this in 2012" is worth more than "incentives encourage diffusion of
//      responsibility", and before this sprint only the second reached the user.
//   2. Among those, a finding that CONTRADICTS the draft outranks one that supports it. It
//      is the one the proposer can still act on, and burying it is how a build reads as
//      agreeable.
//      ⚠ THESE TWO WERE THE OTHER WAY ROUND AND THE SECOND REBUILD REVERSED THEM — see
//      `rankOf`. An uncited contradiction outranked a cited finding, and eight rows saying
//      "the critique rewrote summaryDiagnosis" took every leading slot from 56 cited sources.
//   3. A finding that PASSED THE PRECEDENT TEST outranks a merely topical one — the sift
//      already made that judgement and it was thrown away at render time.
//   4. A finding whose body is a bare restatement of its own title is DEMOTED, not shown.
//      That is the rubbish, and rendering it at equal weight with the rest is what makes a
//      good build look like a keyword soup.
//
// ⚠ AND NOTHING IS DELETED FROM THE DATABASE. "Delete the rubbish" is an instruction about
// the SCREEN. A demoted finding is still a row, still in the evidence panel, still
// acceptable or rejectable by the user — it simply does not compete for the top of the
// build summary. The count of what was demoted is shown, because a silent cut reads as
// "this is everything there was".
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { headingFor, HEADING_ORDER, type HeadingKey } from './question-headings'
import { resolveHeading } from './heading-map'
import { SMART_PASS_KEY, SMART_VOCABULARY_PASS_KEY, CONFIRMED_TERMS_TITLE } from './build-smart'
import { evidenceForBuild } from './evidence-scope'

export interface HighlightFinding {
  id: string
  kind: string
  title: string
  body: string
  /** The source's own citation, or null. NEVER invented. */
  citation: string | null
  url: string | null
  sourceType: string | null
  /** The §25.5 heading, resolved from the row's own tag. Null = not classified. */
  heading: HeadingKey | null
  headingLabel: string | null
  /** Why this one is where it is, in the ranking. Shown on hover / in the report. */
  rank: number
}

export interface DraftedField {
  key: string
  label: string
  /** The text as it stands — the ACCEPTED value if there is one, else the PROPOSAL. */
  text: string
  /** TRUE when this is still a proposal nobody has agreed to. */
  awaiting: boolean
}

export interface BuildHighlights {
  /**
   * ⚠ WHAT WAS ACTUALLY DRAFTED. §1: "The summary screen must show what was actually
   * drafted. A build that produces a cited legal landscape and displays a keyword soup is
   * misrepresenting its own work."
   *
   * ⚠⚠ READ FROM `IdeaFieldState.proposal`, NOT FROM THE `Idea` COLUMNS. This is the
   * single most misreadable thing about a finished build and it has already misled one
   * review: the canonical `Idea` columns are ALL EMPTY after a build, and correctly so —
   * the draft lives in the field state until a human accepts it. Anyone reading the `Idea`
   * row alone concludes the build produced nothing.
   */
  drafted: DraftedField[]
  /** Contradictions and cited findings, ranked. The top of the screen. */
  leading: HighlightFinding[]
  /** Everything else that was kept, for the collapsed reference list. */
  supporting: HighlightFinding[]
  /** ⚠ Demoted as restatement. Counted, never silently dropped. */
  demotedCount: number
  /** Terms of art the corpus confirmed, and the ones it could not. §2b. */
  vocabulary: {
    confirmed: string[]
    unverified: Array<{ term: string; why: string }>
  }
  /** §2d's four answers, and the critique's own "read this first" picks. */
  judgements: HighlightFinding[]
  /**
   * ⚠⚠ WHERE THE EVIDENCE OR THE CRITIQUE MOVED THE DRAFT — its own section, and the
   * second full rebuild is why it exists.
   *
   * These rows are `kind: CONTRADICTS` and carry no citation, because their source is a
   * pass rather than a document. That combination put them at the TOP of the ranked list
   * (a contradiction outranks everything) — so the screen led with eight rows saying *"The
   * critique rewrote summaryDiagnosis"* and pushed **56 cited sources** below them.
   *
   * §1 is explicit: *"Cited findings and named sources lead. Abstractions follow."* A note
   * about our own process is neither. It is genuinely valuable — *"I first concluded X; the
   * evidence says Y"* is the best sentence a build produces — but it belongs beside the
   * work, not in front of the record.
   */
  changes: HighlightFinding[]
  /** Every distinct source cited anywhere above, for the collapsed source list. */
  sources: Array<{ citation: string; url: string | null; count: number }>
}

/** The kernel fields worth showing on the summary screen, in reading order. */
const DRAFTED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'title', label: 'Working title' },
  { key: 'challenge', label: 'The problem' },
  { key: 'summaryDiagnosis', label: 'The diagnosis' },
  { key: 'pivotalObstacle', label: 'The pivotal obstacle' },
  { key: 'summaryGuidingPolicy', label: 'The guiding policy' },
  { key: 'whatItRulesOut', label: 'What it rules out' },
  { key: 'conditionsForSuccess', label: 'Conditions for success' },
  { key: 'summaryCoherentActions', label: 'The plan' },
]

function proposalText(row: { value: string | null; proposal: unknown; status: string }): string {
  if (row.status === 'ACCEPTED' && row.value?.trim()) return row.value.trim()
  const p = row.proposal as { value?: unknown } | null
  const v = p?.value
  if (typeof v === 'string') return v.trim()
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => typeof x === 'string' && x.trim())
      .map(([k, x]) => `${k}: ${String(x).trim()}`)
      .join('\n')
  }
  return row.value?.trim() ?? ''
}

/**
 * Is this finding's body a bare restatement of its own title?
 *
 * ⚠ THE TEST IS DELIBERATELY CONSERVATIVE, because the cost of demoting a real finding is
 * higher than the cost of showing a weak one. A body is only rubbish when it is short AND
 * carries almost nothing the title does not already say.
 */
function isRestatement(title: string, body: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
  const t = new Set(norm(title))
  const b = norm(body)
  if (!b.length) return true
  if (b.length > 40) return false
  const novel = b.filter((w) => !t.has(w) && w.length > 3)
  return novel.length < 5
}

/**
 * The rank. Higher leads. Written as one expression so the ordering can be read off the
 * page rather than reconstructed from a sort comparator.
 */
function rankOf(row: {
  kind: string; citation: string | null; precedentTestPassed: boolean | null; passKey: string
}): number {
  let r = 0
  // ⚠⚠ THE CITATION IS WORTH MORE THAN THE KIND, AND THE SECOND FULL REBUILD REVERSED
  // THESE TWO WEIGHTS.
  //
  // They were `CONTRADICTS +100`, `citation +50` — so an UNCITED contradiction outranked a
  // CITED finding, and the run produced eight uncited "the critique rewrote X" rows that
  // took every leading slot while 56 cited sources sat below them. §1's sentence is
  // "cited findings and named sources LEAD"; the ranking said the opposite.
  //
  // (Those process rows now have their own section entirely — see `changes` — so this
  // reversal is belt and braces rather than the whole fix. It is made anyway, because the
  // next uncited CONTRADICTS producer will not be one of the two this sprint knows about.)
  if (row.citation?.trim()) r += 100                // 1 — a named source, which is the point
  if (row.kind === 'CONTRADICTS') r += 60           // 2 — the one they can still act on
  if (row.precedentTestPassed) r += 25              // 3 — the sift's own judgement, not discarded
  if (row.kind === 'PRECEDENT') r += 10
  if (row.passKey === SMART_PASS_KEY) r += 5        // the terms of art the proposer had never met
  return r
}

/**
 * A row that records what a PASS did to the draft, rather than what a document says.
 *
 * ⚠ MATCHED ON THE TITLES THE TWO PRODUCERS ACTUALLY WRITE, which is a coupling worth
 * naming: `revisePass` writes "The research changed my mind about …" and `smartPass` writes
 * "The critique rewrote …". Both are in `build.ts` and both are the only writers of an
 * uncited CONTRADICTS. If a third producer appears, it belongs in this list — and until it
 * does, it will simply rank as an uncited finding rather than being mis-filed.
 */
function isProcessNote(row: { kind: string; citation: string | null; title: string }): boolean {
  if (row.citation?.trim()) return false
  return /^The research changed my mind about |^The critique rewrote /.test(row.title)
}

const LEADING_CAP = parseInt(process.env.LEX_BUILD_LEADING_CAP ?? '8', 10)

/**
 * Everything the build screen needs, read from what the build actually stored.
 *
 * ⚠ SCOPED TO THIS BUILD'S `runVersion`. A re-run must not show the previous run's
 * findings beside its own — `supersedeOlderProposals` marks the old ones REJECTED, and
 * this filters on status as well, so a finding the USER rejected also disappears from the
 * summary. Their judgement, honoured.
 */
export async function buildHighlights(ideaId: string, runVersion: number): Promise<BuildHighlights> {
  const [fieldRows, evidence, vocabGap] = await Promise.all([
    prisma.ideaFieldState.findMany({
      where: { ideaId, fieldKey: { in: DRAFTED_FIELDS.map((f) => f.key) } },
      select: { fieldKey: true, status: true, value: true, proposal: true },
    }),
    // ⚠ 25-Y §1c — the build's own findings PLUS the user's own documents, which belong to the
    // idea rather than to a run. Without this the finished-build screen showed a user their
    // corpus findings and silently omitted the ones from the document they supplied.
    prisma.evidenceItem.findMany({
      where: { ...evidenceForBuild(ideaId, runVersion), status: { not: 'REJECTED' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, kind: true, title: true, body: true, citation: true, url: true,
        sourceType: true, headingKey: true, passKey: true, precedentTestPassed: true,
      },
    }),
    prisma.deepeningPass.findUnique({
      where: { ideaId_passKey: { ideaId, passKey: SMART_VOCABULARY_PASS_KEY } },
      select: { knownUnknowns: true },
    }),
  ])

  const byKey = new Map(fieldRows.map((r) => [r.fieldKey, r]))
  const drafted: DraftedField[] = []
  for (const f of DRAFTED_FIELDS) {
    const row = byKey.get(f.key)
    if (!row) continue
    const text = proposalText(row)
    if (!text) continue
    drafted.push({ key: f.key, label: f.label, text, awaiting: row.status === 'AWAITING_CONFIRMATION' })
  }

  // ── The judgements: §2d's four answers, which carry no citation by design. ──
  const judgementTitles = new Set([
    'How hard this will be to pass',
    'The barriers this will actually meet',
    'How likely this is to succeed',
    'What is most likely to go wrong',
    'What to read first',
    'What I would cut',
  ])
  // ⚠ The confirmed-terms row is neither a judgement nor a finding to rank — it is the
  // vocabulary list, and it is rendered in its own section. Excluded from both so it
  // cannot appear twice.
  judgementTitles.add(CONFIRMED_TERMS_TITLE)

  const asHighlight = (r: typeof evidence[number]): HighlightFinding => {
    const heading = resolveHeading(r)
    return {
      id: r.id,
      kind: r.kind as string,
      title: r.title,
      body: r.body,
      citation: r.citation,
      url: r.url,
      sourceType: r.sourceType,
      heading,
      headingLabel: heading ? headingFor(heading)?.heading ?? null : null,
      rank: rankOf(r),
    }
  }

  const judgements = evidence
    .filter((r) => judgementTitles.has(r.title) && r.title !== CONFIRMED_TERMS_TITLE)
    .map(asHighlight)
  const rest = evidence.filter((r) => !judgementTitles.has(r.title))

  const changes: HighlightFinding[] = []
  const kept: HighlightFinding[] = []
  let demotedCount = 0
  for (const r of rest) {
    // ⚠ Its own section, ahead of the demotion test — a note about what a pass did to the
    // draft is not a finding, and it is not rubbish either.
    if (isProcessNote(r)) { changes.push(asHighlight(r)); continue }
    // ⚠ A CITED FINDING IS NEVER DEMOTED AS RESTATEMENT. A short body attached to a real
    // source is still a source the proposer can follow; the rubbish this removes is the
    // uncited abstraction whose body says the title again.
    if (!r.citation?.trim() && isRestatement(r.title, r.body)) { demotedCount++; continue }
    kept.push(asHighlight(r))
  }

  const headingRank = (h: HeadingKey | null) => (h ? HEADING_ORDER.indexOf(h) : HEADING_ORDER.length)
  kept.sort((a, b) => b.rank - a.rank || headingRank(a.heading) - headingRank(b.heading) || a.title.localeCompare(b.title))

  const leading = kept.slice(0, LEADING_CAP)
  const supporting = kept.slice(LEADING_CAP)

  // ── Sources, deduplicated. The collapsed list under everything. ────────────
  const sourceMap = new Map<string, { citation: string; url: string | null; count: number }>()
  for (const r of kept) {
    const c = r.citation?.trim()
    if (!c) continue
    const existing = sourceMap.get(c)
    if (existing) existing.count++
    else sourceMap.set(c, { citation: c, url: r.url, count: 1 })
  }

  // ── The vocabulary. Confirmed terms are the SMART pass's cited findings; the
  //    unverified ones are the stated gap the same pass wrote. ────────────────
  // ⚠ THE TERM LIST, NOT THE FINDING TITLES. This used to read the SMART pass's cited
  // findings and show their titles under a heading that says "the words this field actually
  // uses" — which is a different thing, and on the first full run it showed "(none)" while
  // the corpus had confirmed seven of twelve terms. `CONFIRMED_TERMS_TITLE` is one row
  // written by the pass that knows the answer.
  const confirmedRow = evidence.find((r) => r.passKey === SMART_PASS_KEY && r.title === CONFIRMED_TERMS_TITLE)
  const confirmed = confirmedRow
    ? confirmedRow.body.split('\n').filter((l) => l.startsWith('• ')).map((l) => l.slice(2).trim()).filter(Boolean)
    : []
  const raw = vocabGap?.knownUnknowns
  // ⚠ THE TERM IS PULLED OUT OF THE QUESTION, and the two surfaces are why.
  //
  // The gap is STORED as a question — `What is "Carltona principle" (doctrine), and does it
  // bear on this?` — because that is what the §22 known-unknowns panel renders and a
  // statement would read wrongly there. On THIS screen it sits under a heading that already
  // says these are terms of art, so the question form reads as noise around the one word
  // that matters. The quoted name is lifted out; anything that does not match keeps the
  // whole string rather than being dropped.
  const unverified: Array<{ term: string; why: string }> = Array.isArray(raw)
    ? (raw as Array<{ question?: unknown; why?: unknown }>)
        .map((g) => {
          const q = String(g?.question ?? '').trim()
          const named = /"([^"]{2,})"/.exec(q)
          const kind = /\(([^)]{2,30})\)/.exec(q)
          return {
            term: named ? `${named[1]}${kind ? ` (${kind[1]})` : ''}` : q,
            why: String(g?.why ?? '').trim(),
          }
        })
        .filter((g) => g.term)
    : []

  return {
    drafted,
    leading,
    supporting,
    demotedCount,
    vocabulary: { confirmed, unverified },
    judgements,
    changes,
    sources: [...sourceMap.values()].sort((a, b) => b.count - a.count || a.citation.localeCompare(b.citation)),
  }
}
