// ─────────────────────────────────────────────────────────────────────────────
// deepening-retrieval.ts — BRIEF_SEARCH_S7 §2. The two retrieval jobs the Deepening needs.
//
// Two are buildable now and two are not. The two that are not are named at the bottom with
// reasons, because "not yet" with a reason is a decision and "not yet" without one is a backlog
// item that quietly stops happening — which is the reason S7 exists at all.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { runSearch } from './search-gateway'
import type { SearchResult } from './page1-config'

// ════════════════════════════════════════════════════════════════════════════════════════════
// PRECEDENT — has this been tried, and what happened?
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Three documents read TOGETHER, around one instrument:
 *
 *   INTENDED   the explanatory note — what the provision was FOR
 *   PREDICTED  the impact assessment — what was expected of it
 *   OBSERVED   the post-implementation review — what actually happened
 *
 * ⚠⚠ RETURNED AS A GROUP, NOT A RANKED LIST, and this is the whole design. §2: "The value is the
 * comparison — intended, predicted, observed — and a flat ranking destroys it." A ranked list of
 * twenty documents about an instrument answers a different question; three documents about ONE
 * instrument, in that order, is the question the Deepening is asking.
 *
 * ⚠ THERE IS NO SEPARATE COLLECTION OF POST-IMPLEMENTATION REVIEWS, and looking for one is how
 * this gets written up as impossible. The "what happened" leg lives INSIDE `impact-assessments`,
 * distinguished by section title. Measured: **1,014 sections** whose title names a
 * post-implementation review — the brief says 1,235, and the smaller number is what the corpus
 * actually holds today.
 */
export interface PrecedentLeg {
  leg: 'intended' | 'predicted' | 'observed'
  /** What this leg IS, in words the prompt can use. */
  whatItIs: string
  id: string
  title: string
  snippet: string
  url: string | null
  date: string | null
}

export interface Precedent {
  /** The instrument these documents are about, e.g. `uksi/2013/687`. */
  gid: string
  instrumentTitle: string | null
  legs: PrecedentLeg[]
  /** ⚠ Which legs are MISSING. Stated, because two of three is a different finding from three. */
  missing: Array<'intended' | 'predicted' | 'observed'>
  /** The honest line when a leg is absent, split by audience (§2.2). Null when all three are present. */
  note: RenderedBlock | null
}

const LEG_MEANING: Record<PrecedentLeg['leg'], string> = {
  intended: 'what the provision was FOR — the department\'s own statement of purpose, laid alongside it',
  predicted: 'what the government EXPECTED it to do, before it did it — costs, benefits, options weighed',
  observed: 'what actually HAPPENED — the post-implementation review, written after the fact',
}

/**
 * ⚠⚠⚠ THE SECTION-TITLE RULE IS WRONG ABOUT THE WORLD, AND IT IS WRONG IN THE ONE DIRECTION THIS
 * FILE EXISTS TO PREVENT. CORRECTED 2026-09-07 (S18 §2). DO NOT USE — see `impactLegOf` below.
 *
 * The rule reads: *"A row whose section title names a post-implementation review is the OBSERVED
 * leg."* The title test is accurate. **The inference from it is not.** Every standard HMG impact
 * assessment carries a front-matter box HEADED "Post-implementation review", and what is inside
 * that box is a TICK: *"Will the policy be reviewed? It will be reviewed. If applicable, set
 * review date: 5 years post implementation."* It is a promise to look, written before the measure
 * commenced. One of the sampled sections reads *"Will the policy be reviewed? **No.** If
 * applicable, set review date: N/A"* — and under the title rule that document is the answer to
 * "what actually HAPPENED".
 *
 * MEASURED, 30 such sections sampled by md5(id) and read out of R2:
 *   promise-only 25 · review-only 1 · both 0 · neither 4
 *
 * ⚠ THE DEFECT WAS INVISIBLE UNTIL THE JOIN WAS FIXED, WHICH IS WHY IT SURFACED NOW. The
 * `impact-assessments` legs of `retrievePrecedent` had never returned a row (the id/parentDocId
 * bug fixed below), so this rule had never once been applied to a real document. The first render
 * after the fix put a signature page and a review date under the heading "what actually HAPPENED".
 * **Fixing a retrieval bug ARMED a labelling bug**, and a fix that shipped without reading its own
 * output would have converted a silent gap into a confident falsehood on 952 instruments.
 *
 * @deprecated Title-only, and title is not enough. Kept and exported because
 *   `check-s7-retrieval.ts` and `check-deepening.ts` assert on it and a signature that vanishes
 *   under its callers is its own incident. It now answers the question it can actually answer —
 *   *does this section's TITLE name a review* — and no caller in this codebase decides a leg
 *   from it any more.
 */
export function legForImpactSection(sectionTitle: string | null): 'predicted' | 'observed' {
  return /post[-\s]?implementation|pir\b|review of the (regulation|order|instrument)/i
    .test(sectionTitle ?? '') ? 'observed' : 'predicted'
}

/**
 * ⚠⚠ THE RULE THAT SEPARATES "PREDICTED" FROM "OBSERVED", AND IT IS A PROPERTY OF THE DOCUMENT,
 * NOT OF THE SECTION.
 *
 * legislation.gov.uk publishes a post-implementation review as its OWN `ukia` document, and the
 * stage is carried on every one of its rows in `attribution` — *"Health and Safety Executive —
 * Post Implementation"*. A section is an OUTCOME if and only if the assessment it belongs to is
 * itself a post-implementation review. Counted over the live collection:
 *
 *   Final 1,081 · **Post Implementation 71** · Enactment 11 · Consultation 2 · Implementation 1 · Options 1
 *
 * — i.e. 71 of 1,169 assessments, 6.1%, are reviews. (CC-Ingest's independent sweep of the source
 * feed found 73 on the same day, from the other side; the two agree.)
 *
 * ⚠ THE UNKNOWN CASE DEFAULTS TO `predicted`, AND THAT DIRECTION IS DELIBERATE. A prediction
 * mislabelled as an outcome tells a user that something was measured when nothing was; an outcome
 * mislabelled as a prediction merely understates what we hold. Only the first is a claim about the
 * world that we cannot support, so a null or unrecognised stage is never an outcome.
 *
 * Exported and self-tested without a database, for the reason the old rule gave and did not meet.
 */
export function impactLegOf(
  attribution: string | null,
): 'predicted' | 'observed' {
  // `attribution` is "{department} — {stage}"; the stage is what decides it.
  const stage = (attribution ?? '').split('—').slice(1).join('—').trim().toLowerCase()
  return /^post[\s-]?implementation\b/.test(stage) ? 'observed' : 'predicted'
}

/**
 * ⚠⚠ THE PREDICTED AND OBSERVED LEGS HAD NEVER RETURNED A ROW. FIXED 2026-09-07 (S18 §1).
 *
 * The join was `s.id LIKE '%:{gid}:%'`, which is right for explanatory material — an explanatory
 * note's id is `explanatory-notes:ukpga/2010/25:1`, and the instrument gid is literally inside it.
 * **It cannot be right for an impact assessment.** An assessment's id is
 * `impact-assessments:2020-57:1`: the middle segment is the ASSESSMENT's own number on
 * legislation.gov.uk, not the instrument it appraises. The instrument lives in `parentDocId`.
 *
 * Measured before the fix, not reasoned:
 *
 *   · **0 of 18,759** `impact-assessments` ids contain a `/` at all, so not one of them could ever
 *     satisfy a LIKE against a gid — the two legs were structurally dead from the day S7 shipped.
 *   · The correct join reaches **1,049 instruments** and **17,770 sections**.
 *   · **952 instruments** were being told *"NO POST-IMPLEMENTATION REVIEW EXISTS for this
 *     instrument — nobody has published an assessment of whether it worked"* while we hold
 *     **1,197 post-implementation-review sections** for them.
 *
 * ⚠⚠ THAT LAST LINE IS WHY THIS IS A CORRECTNESS FIX AND NOT A RECALL IMPROVEMENT. The block's
 * whole purpose is to keep a prediction from being read as an outcome, and the note is written to
 * be trusted. A confident, cited "nobody has ever checked" — over a review we are holding — is the
 * same class of error pointing the other way, and it is worse, because the absence is the finding
 * this platform sells.
 *
 * ⚠ 989 impact-assessment sections carry a NULL `parentDocId` and remain unreachable BY INSTRUMENT
 * by either join. Reported to ingest, not papered over here: they are reachable by subject search
 * and by nothing else.
 *
 * ⚠ NEVER INVENTS A LEG. A missing post-implementation review is extremely common — most
 * instruments have never had one — and the honest output says so. Filling the gap with the impact
 * assessment's own predictions, which is the tempting move, would turn "nobody has checked whether
 * this worked" into "here is what it achieved".
 */
export async function retrievePrecedent(gid: string): Promise<Precedent> {
  const rows = await prisma.$queryRaw<Array<{
    id: string; corpus: string; sectionTitle: string | null; sourceUrl: string | null
    itemDate: string | null; parentTitle: string | null; wordCount: number | null
    attribution: string | null
  }>>`
    SELECT s.id, s.corpus, s."sectionTitle", s."sourceUrl", s."itemDate"::text AS "itemDate",
           s."wordCount", s.attribution, a.title AS "parentTitle"
    FROM corpus_sections s
    LEFT JOIN corpus_acts a ON a.gid = s."parentDocId"
    WHERE s.status = 'compiled'
      AND (
        -- explanatory material: the gid IS in the id
        (s.corpus IN ('explanatory-notes', 'explanatory-memoranda') AND s.id LIKE ${'%:' + gid + ':%'})
        -- impact assessments: the gid is in parentDocId and NOWHERE in the id
        OR (s.corpus = 'impact-assessments' AND s."parentDocId" = ${gid})
      )
      -- WARNING: a flat LIMIT here would reintroduce the bug it replaced. Ordered by corpus,
      -- explanatory-notes sorts before impact-assessments, and a long Act's notes run to
      -- hundreds of sections, so a single cap would silently drop the assessment rows again and
      -- the block would say "no impact assessment is held" for exactly the biggest instruments.
      -- The cap is therefore PER COLLECTION, not per instrument.
      -- (No backticks in this comment: it lives inside a JS template literal.)
      AND s.id IN (
        SELECT id FROM (
          SELECT s2.id, row_number() OVER (PARTITION BY s2.corpus ORDER BY s2.id) AS rn
          FROM corpus_sections s2
          WHERE s2.status = 'compiled'
            AND (
              (s2.corpus IN ('explanatory-notes', 'explanatory-memoranda') AND s2.id LIKE ${'%:' + gid + ':%'})
              OR (s2.corpus = 'impact-assessments' AND s2."parentDocId" = ${gid})
            )
        ) t WHERE t.rn <= 120
      )
    ORDER BY s.corpus, s.id`

  // ⚠⚠ AND THE SECOND HALF OF THE SAME DEFECT: WHICH section of the assessment is picked.
  //
  // The old code took the first row in `ORDER BY s.corpus, s.id`, which for an assessment is
  // section `:1` — and section `:1` is the HMG front sheet. Read out of R2 for the plastic-straws
  // assessment it is seventy-one words of *"Title: … IA No: … RPC Reference No: … Contact for
  // enquiries: Dan Quinlan"*. It carries no cost, no benefit and no finding. The PREDICTED leg
  // would have been the cover of the document even after the join was fixed.
  //
  // This is S16's committees finding in a second collection — *"C1's currently-PASSING key is the
  // report's COVER PAGE … retrieving on its title and answering nothing"* — and it is why the leg
  // is now chosen by what the section IS, with the front sheet ranked LAST rather than first.
  //
  // ⚠ IT IS A PREFERENCE, NOT A FILTER. A ranking rule used as a filter discards the rows that
  // would have matched; if an assessment holds nothing but its front sheet, the front sheet is
  // still returned — with `Summary` as its title, so the reader can see what they were given.
  const PREDICTED_PREFERENCE = [
    'costs and benefits', 'preferred option', 'options considered',
    'problem under consideration', 'policy objectives', 'rationale for intervention',
    'risks and assumptions', 'rpc opinion',
  ]
  const rank = (r: { sectionTitle: string | null; wordCount: number | null }): number => {
    const t = (r.sectionTitle ?? '').trim().toLowerCase()
    const i = PREDICTED_PREFERENCE.findIndex((p) => t.startsWith(p))
    if (i >= 0) return i
    // Unnamed or unrecognised sections sit between the preferred list and the front sheet.
    if (t === 'summary') return PREDICTED_PREFERENCE.length + 1
    return PREDICTED_PREFERENCE.length
  }
  const ordered = [...rows].sort((a, b) => {
    if (a.corpus !== b.corpus) return a.corpus < b.corpus ? -1 : 1
    if (a.corpus !== 'impact-assessments') return a.id < b.id ? -1 : 1
    const d = rank(a) - rank(b)
    // Longest first inside a preference band: a 15-word "Costs and benefits" stub and a 1,700-word
    // one are both correctly named, and only one of them says anything.
    return d !== 0 ? d : (b.wordCount ?? 0) - (a.wordCount ?? 0)
  })

  const legs: PrecedentLeg[] = []
  const seen = new Set<string>()
  for (const r of ordered) {
    // ⚠⚠ THE STAGE DECIDES, NOT THE SECTION TITLE. See `impactLegOf` — 25 of 30 sections titled
    // "Post-implementation review" are the front-sheet box promising a future review, and one of
    // them promises NOT to hold one. Deciding from the title put a signature page under the
    // heading "what actually HAPPENED".
    const leg: PrecedentLeg['leg'] = r.corpus === 'impact-assessments'
      ? impactLegOf(r.attribution)
      : 'intended'
    // One document per leg — the comparison is between legs, not within them.
    if (seen.has(leg)) continue
    seen.add(leg)
    legs.push({
      leg,
      whatItIs: LEG_MEANING[leg],
      id: r.id,
      title: r.sectionTitle || r.parentTitle || r.id,
      snippet: '',
      url: r.sourceUrl,
      date: r.itemDate,
    })
  }

  const order: Array<PrecedentLeg['leg']> = ['intended', 'predicted', 'observed']
  legs.sort((a, b) => order.indexOf(a.leg) - order.indexOf(b.leg))
  const missing = order.filter((l) => !seen.has(l))

  return {
    gid,
    instrumentTitle: rows[0]?.parentTitle ?? null,
    legs,
    missing,
    note: missing.length ? precedentNote(missing) : null,
  }
}

/**
 * ⚠⚠ 25-C §2.2 — TWO AUDIENCES, SPLIT AT CONSTRUCTION.
 *
 * These blocks are stored on `EvidenceItem.body`, which is BOTH rendered in the Deepening panel
 * AND fed to the adversarial reader in the build's pass 5. Until now they carried one string
 * containing sentences addressed to the model — "Say so plainly", "Do NOT substitute…", "Never
 * tell a user…" — and the user read those on screen, as instructions to nobody.
 *
 * The brief is explicit that the fix is at CONSTRUCTION, never by stripping text afterwards, and
 * that is the right call: a stripper is a regex over prose that silently stops matching the day
 * someone rewords the sentence, and the failure mode is the leak coming back unnoticed.
 *
 * So every block returns both halves and the caller chooses. `forUser` states the FACT and the
 * caveat as something a reader can act on; `forModel` carries the imperative. The substance is
 * never model-only — a caveat the user cannot see is a caveat that cannot protect them.
 */
export interface RenderedBlock {
  /** Shown on screen. Facts and caveats addressed to the reader. */
  forUser: string
  /** Added to a prompt, never rendered. Imperatives addressed to the model. */
  forModel: string
}

/** ⚠ Exported and tested: the sentence that stops an absence being read as a finding. */
export function precedentNote(missing: Array<'intended' | 'predicted' | 'observed'>): RenderedBlock {
  const words: Record<string, string> = {
    intended: 'no explanatory note is held for this instrument',
    predicted: 'no impact assessment is held for this instrument',
    observed: 'NO POST-IMPLEMENTATION REVIEW EXISTS for this instrument — nobody has published an '
      + 'assessment of whether it worked',
  }
  return {
    // The absence itself is a finding the user needs, and the reason it matters is a fact about
    // evidence rather than an instruction — so it stays on screen.
    forUser: `⚠ ${missing.map((m) => words[m]).join('; ')}. A prediction is not an outcome.`,
    forModel: 'Say so plainly. Do NOT substitute what was PREDICTED for what was OBSERVED.',
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// DEVOLUTION_SCOPE — is this reserved to Westminster, or devolved?
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ WHICH PARLIAMENT A DOCUMENT CAME FROM MUST BE UNMISTAKABLE, and §2 says so in terms — the same
 * requirement that applied when Scottish debates joined the search. So jurisdiction is derived
 * from the document's own identifier and carried as a first-class field, never inferred from the
 * title and never left for the reader to work out.
 *
 * Measured coverage, 17 Aug 2026:
 *   Scotland   ssi 87,398 · asp 25,985 · scottish-parliament-or 1,044,188 · scottish-courts 13,070
 *   Wales      wsi 70,062 · anaw 4,717 · asc 4,585 · mwa 1,446
 *   N. Ireland nisr 129,681 · nisi 23,920 · nia 9,367 · ni-judgments 7,927
 */
export type Jurisdiction = 'UK-wide' | 'Scotland' | 'Wales' | 'Northern Ireland' | 'England & Wales' | 'unknown'

const DOCTYPE_JURISDICTION: Record<string, Jurisdiction> = {
  asp: 'Scotland', ssi: 'Scotland',
  anaw: 'Wales', asc: 'Wales', mwa: 'Wales', wsi: 'Wales',
  nia: 'Northern Ireland', nisi: 'Northern Ireland', nisr: 'Northern Ireland', apni: 'Northern Ireland',
  ukpga: 'UK-wide', uksi: 'UK-wide', ukla: 'UK-wide', ukcm: 'UK-wide',
}

/**
 * ⚠ DERIVED FROM THE IDENTIFIER, NOT FROM THE TITLE. A title containing the word "Scotland" may be
 * a UK Act about Scotland (the Scotland Act 1998 is `ukpga`), which is the opposite of a devolved
 * instrument. Exported and tested, because getting this wrong tells a user the wrong Parliament
 * can legislate for them.
 */
export function jurisdictionOf(id: string): Jurisdiction {
  const parts = id.split(':')
  const gid = parts.length >= 2 ? parts[1] : ''
  const doctype = gid.split('/')[0]?.toLowerCase() ?? ''
  if (DOCTYPE_JURISDICTION[doctype]) return DOCTYPE_JURISDICTION[doctype]
  if (/scottish-parliament|scottish-courts/.test(parts[0] ?? '')) return 'Scotland'
  if (/^ni-/.test(parts[0] ?? '')) return 'Northern Ireland'
  return 'unknown'
}

export interface DevolutionResult {
  id: string
  jurisdiction: Jurisdiction
  title: string
  snippet: string
  url: string | null
  type: string
  /// 25-P §2b — carried off the SearchResult so the evidence row it becomes can be dated.
  /// Dropping it here was why the devolution finding had no date to write.
  date: string | null
}

export interface DevolutionScope {
  query: string
  results: DevolutionResult[]
  /** Counts per jurisdiction — the shape of the answer before anyone reads a single document. */
  byJurisdiction: Record<string, number>
  /** ⚠ The line needed so a pattern is not read as a legal conclusion, split by audience (§2.2). */
  note: RenderedBlock
}

/**
 * Retrieve material across jurisdictions for a subject.
 *
 * ⚠⚠ THIS DOES NOT ANSWER "IS IT RESERVED". It shows WHO HAS LEGISLATED, which is evidence and not
 * a conclusion. The reservation question is settled by Schedule 5 to the Scotland Act, Schedule 7A
 * to the Government of Wales Act and Schedule 2/3 to the Northern Ireland Act — and we hold those
 * as text, not as a structured answer. A retrieval layer that implied otherwise would be answering
 * a constitutional question with a frequency count, which is exactly the kind of confident wrong
 * claim this platform exists not to make.
 */
export async function retrieveDevolutionScope(query: string, limit = 24): Promise<DevolutionScope> {
  const out = await runSearch({
    keywords: query.trim().split(/\s+/).filter(Boolean),
    intent: 'DEVOLUTION_SCOPE',
    limit,
  })
  // ⚠⚠ `.slice(limit)` IS LOad-BEARING, AND ITS ABSENCE WAS A REAL DEFECT (found S8 §1, by
  // reading a persisted artefact rather than a counter). `limit` is passed to `runSearch` as the
  // per-call cap, but the ROUTED path returns the union of every stream it dispatched — five
  // streams at ~60 hits each. A `limit = 24` call came back with 360 results, and
  // `devolutionBlock` renders one two-line entry per result, so the block written into an
  // EvidenceItem body was **577 lines long** across two runs. Nothing errored: the caller asked
  // for 24, got 360, and stored all of them.
  //
  // The cap belongs here rather than in the caller because the block is this module's artefact.
  // `byJurisdiction` is counted AFTER the slice, so the shape line describes the items actually
  // shown — a count over 360 above a list of 24 would be a caption that disagrees with its table.
  const results: DevolutionResult[] = out.results.slice(0, limit).map((r: SearchResult) => ({
    id: r.id,
    jurisdiction: jurisdictionOf(r.id),
    title: r.title || r.citation || r.id,
    snippet: r.snippet,
    url: r.url || null,
    type: String(r.type),
    date: r.date || null,
  }))
  const byJurisdiction: Record<string, number> = {}
  for (const r of results) byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] ?? 0) + 1
  return { query, results, byJurisdiction, note: DEVOLUTION_NOTE }
}

/**
 * 25-C §2.2 — split at construction. The SUBSTANCE is the user's (they are the one who must not
 * walk into a committee saying "this is devolved"); only the imperative is the model's.
 */
export const DEVOLUTION_NOTE: RenderedBlock = {
  forUser:
    '⚠ Each item below is labelled with the parliament or assembly that made it. This shows WHO HAS '
    + 'LEGISLATED on the subject, which is evidence — it is NOT a ruling on whether the subject is '
    + 'reserved or devolved. That question is settled by Schedule 5 to the Scotland Act 1998, '
    + 'Schedule 7A to the Government of Wales Act 2006 and Schedules 2 and 3 to the Northern Ireland '
    + 'Act 1998.',
  forModel:
    'Never tell a user a matter is devolved or reserved on the strength of what this search '
    + 'returned; say what the pattern shows and name the schedule that decides it.',
}

/** Render the group for the prompt, jurisdiction first so it cannot be missed. */
export function devolutionBlock(s: DevolutionScope): RenderedBlock {
  const lines = s.results.map((r) => `- [${r.jurisdiction}] ${r.title}\n    "${r.snippet.slice(0, 200)}"`)
  const shape = Object.entries(s.byJurisdiction)
    .sort((a, b) => b[1] - a[1]).map(([j, n]) => `${j} ${n}`).join(' · ')
  return {
    forUser: `WHO HAS LEGISLATED: ${shape}\n\n${lines.join('\n')}\n\n${s.note.forUser}`,
    forModel: s.note.forModel,
  }
}

export function precedentBlock(p: Precedent): RenderedBlock {
  const lines = p.legs.map((l) => `- [${l.leg.toUpperCase()}] ${l.title}\n    ${l.whatItIs}`)
  return {
    forUser: `PRECEDENT FOR ${p.instrumentTitle ?? p.gid} — intended, predicted, observed:\n`
    + `${lines.join('\n') || '(nothing held)'}${p.note ? `\n\n${p.note.forUser}` : ''}`,
    forModel: p.note ? p.note.forModel : '',
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// ⚠ NOT NOW, WITH REASONS (§2). Named so they are decisions rather than omissions.
// ════════════════════════════════════════════════════════════════════════════════════════════
export const NOT_BUILT = {
  MECHANISM_ANALOGUE:
    'A mechanism solving a similar problem in an UNRELATED field. It wants results that are '
    + 'topically DISTANT, which is the opposite of what BM25 and dense retrieval both reward — '
    + 'neither can be tuned into it. Needs provisions tagged by mechanism first, which is unbuilt.',
  CONTRADICTION:
    'Documents that BEAR ON a claim, including those refuting it. That is a reranker problem, and '
    + 'the reranker is not authorised — S2C-5 measured its preference accuracy at 66.7% but only 4 '
    + 'of 15 pairs compared two documents the system actually returned, so the binding constraint '
    + 'was recall rather than ordering.',
} as const

// ── offline self-test ───────────────────────────────────────────────────────────────────────
// npx tsx lib/lex/deepening-retrieval.ts --self-test
function selftest() {
  const cases: Array<[string, boolean]> = [
    // the leg split — getting this backwards presents a prediction as an outcome
    ['⚠ a post-implementation review section is OBSERVED', legForImpactSection('Post-implementation review') === 'observed'],
    ['⚠ a hyphen-free variant is caught', legForImpactSection('Post implementation review of the Order') === 'observed'],
    ['a costs-and-benefits section is PREDICTED', legForImpactSection('Costs and benefits') === 'predicted'],
    ['an options section is PREDICTED', legForImpactSection('Options considered') === 'predicted'],
    ['⚠ a null title defaults to PREDICTED, not OBSERVED — the safer error', legForImpactSection(null) === 'predicted'],

    // jurisdiction from the identifier
    ['a Scottish SI is Scotland', jurisdictionOf('secondary:ssi/2019/1:regulation-3') === 'Scotland'],
    ['an Act of the Scottish Parliament is Scotland', jurisdictionOf('primary:asp/2010/8:section-1') === 'Scotland'],
    ['a Welsh Measure is Wales', jurisdictionOf('primary:mwa/2011/1:section-1') === 'Wales'],
    ['an anaw is Wales', jurisdictionOf('primary:anaw/2014/4:section-2') === 'Wales'],
    ['a Welsh SI is Wales', jurisdictionOf('secondary:wsi/2020/1:regulation-1') === 'Wales'],
    ['an NI Order is Northern Ireland', jurisdictionOf('secondary:nisi/1998/1504:article-3') === 'Northern Ireland'],
    ['⚠⚠ the SCOTLAND ACT itself is UK-wide, not Scotland — derived from the id, never the title',
      jurisdictionOf('primary-acts-pre-2000:ukpga/1998/46:section-28') === 'UK-wide'],
    ['a Scottish Parliament debate is Scotland', jurisdictionOf('scottish-parliament-or:2020-01-01:1') === 'Scotland'],
    ['an unknown identifier is unknown, not guessed', jurisdictionOf('mystery:zz/1/2:x') === 'unknown'],

    // the notes never let an absence read as a finding
    ['⚠ a missing PIR says nobody has assessed whether it worked',
      /NO POST-IMPLEMENTATION REVIEW EXISTS/.test(precedentNote(['observed']).forUser)],
    ['⚠ and forbids substituting the prediction for the outcome',
      /Do NOT substitute what was PREDICTED for what was OBSERVED/.test(precedentNote(['observed']).forModel)],
    ['⚠⚠ the devolution note refuses to call the reservation question',
      /NOT a ruling on whether the subject is reserved or devolved/.test(DEVOLUTION_NOTE.forUser)],
    ['   …and names the schedules that actually decide it',
      /Schedule 5 to the Scotland Act 1998/.test(DEVOLUTION_NOTE.forUser) && /Schedule 7A/.test(DEVOLUTION_NOTE.forUser)],
    ['the two unbuilt intents carry reasons, not just names',
      NOT_BUILT.MECHANISM_ANALOGUE.length > 100 && NOT_BUILT.CONTRADICTION.length > 100],
  ]
  let bad = 0
  for (const [n, ok] of cases) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}`); if (!ok) bad++ }
  console.log(bad ? `\n${bad} FAILED` : `\n${cases.length}/${cases.length} pass`)
  if (bad) process.exit(1)
}
if (require.main === module && process.argv.includes('--self-test')) selftest()
