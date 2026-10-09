// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-H §1–§5 — THE STAGE BANNER: ON EVERY GENERATED DOCUMENT, BEFORE ANYTHING ELSE.
//
// ⚠⚠ TWO DIFFERENT THINGS, KEPT APART (BRIEF_26H §1). The STAGE says where the work has got to
// (The First Pass … In Force). The REVIEW STATUS says whether anyone outside has looked at it.
// "First Scrutiny" is a review status, true of everything made in stages 1–3. It is NOT the name of
// stage 2 — that is "The First Draft" — and it must never be used as one.
//
// ⚠ NOT `Idea.stage` (STAGE_1…5: Create/Draft/Develop/Campaign/Legislate — docs/CLAUDE.md §3), which is the
// platform's visibility ladder and a different thing. This is the seven-stage model Charlie adopted on 25 Sep
// 2026. Since DECISION 136 the workspace bar (`lib/lex/stages.ts`) names its first two stages from the same
// words — The First Pass, The First Draft, The Deepening — so the bar and the documents are one scheme.
// Nothing here reads `Idea.stage` to decide a document's stage.
//
// ⚠ NO IMPORTS. Pure data and pure functions, so the FAQ (a client-safe module) and the builders read
// ONE copy of the stage names and the caveat (CLAUDE.md §28; check:client-boundary).
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, DocumentModel } from './model'

export type SevenStageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface SevenStage {
  n: SevenStageNumber
  name: string
  /** One line, from BRIEF_26H §2. */
  does: string
  /** §3 — In Force is stated and not built (Decision 102): there is nothing to build it with. */
  available: boolean
}

export const SEVEN_STAGES: readonly SevenStage[] = [
  { n: 1, name: 'The First Pass', does: 'what is already there', available: true },
  { n: 2, name: 'The First Draft', does: 'what you propose, specifically', available: true },
  { n: 3, name: 'The Deepening', does: 'what it would actually take', available: true },
  { n: 4, name: 'Private Scrutiny', does: 'what your allies say is wrong', available: true },
  { n: 5, name: 'Public Scrutiny', does: 'what your opponents say is wrong', available: true },
  // §2b — "Submission", not "Parliamentary submission": a select committee inquiry, a consultation, a
  // department and a private member's bill are all doors.
  { n: 6, name: 'Submission', does: 'into the system that decides', available: true },
  // §3 — marked as not yet available, in the same form everywhere. Needs post-implementation review
  // tracking, which sits with Search and does not exist.
  { n: 7, name: 'In Force', does: 'did it work', available: false },
]

export const NOT_YET_AVAILABLE = 'not yet available'

/** BRIEF_26H §4, verbatim. */
export const STAGE_CAVEAT_HEADING = 'Scrutiny requires something to scrutinise.'
export const STAGE_CAVEAT =
  'A proposal that says “we would change this by legislation” cannot be argued with. One that says '
  + '“we would repeal section 12 and replace it with this text” can — and being argued with is the '
  + 'point. A specific proposal may be specifically wrong, and that is how it improves. Vagueness is '
  + 'not caution; it is the absence of a proposal.'

export function stageByNumber(n: SevenStageNumber): SevenStage {
  const s = SEVEN_STAGES.find((x) => x.n === n)
  if (!s) throw new Error(`unknown stage ${n}`) // a closed union; a silent fallback here would mislabel a document
  return s
}

// ── review status (§5) ───────────────────────────────────────────────────────

export type ReviewStatusKey = 'FIRST_SCRUTINY' | 'PRIVATELY_REVIEWED' | 'PUBLICLY_REVIEWED'

/** A review that a deliberate act recorded: how many reviewers, and the date (ISO, yyyy-mm-dd). */
export interface ReviewEvidence {
  reviewers: number
  date: string
}

/**
 * What the platform can PROVE about review. ⚠ §5b — a contribution, a comment, a view or a rating is never
 * turned into a review here. Both fields are null today because NOTHING on the platform records a private
 * (Stage 4) or public (Stage 5) review as the seven-stage model defines them (see the report, §5a); the
 * type exists so the day something does, the counterparts are one assignment and not a redesign.
 */
export interface ReviewRecord {
  privateReview: ReviewEvidence | null
  publicReview: ReviewEvidence | null
}

export const NO_REVIEW_RECORDED: ReviewRecord = { privateReview: null, publicReview: null }

export interface ReviewStatus {
  key: ReviewStatusKey
  /** The label, e.g. "First Scrutiny" or "Privately reviewed — 4 reviewers, 12 May 2027". */
  label: string
  /** One sentence saying what the label means, so it is never a bare flag. */
  meaning: string
}

export const FIRST_SCRUTINY_LABEL = 'First Scrutiny'

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const plural = (n: number) => `${n} reviewer${n === 1 ? '' : 's'}`

/**
 * §5 — the strongest review the record PROVES, with its number and date. Public beats private because
 * Stage 5 comes after Stage 4. Anything that is not both a count above zero and a date is not a review.
 */
export function reviewStatus(rec: ReviewRecord = NO_REVIEW_RECORDED): ReviewStatus {
  const ok = (e: ReviewEvidence | null): e is ReviewEvidence => !!e && e.reviewers > 0 && /^\d{4}-\d{2}-\d{2}/.test(e.date)
  if (ok(rec.publicReview)) {
    return {
      key: 'PUBLICLY_REVIEWED',
      label: `Publicly reviewed — ${plural(rec.publicReview.reviewers)}, ${longDate(rec.publicReview.date.slice(0, 10))}`,
      meaning: 'People outside your own circle, including those who disagree, have been through it and this is how many and when.',
    }
  }
  if (ok(rec.privateReview)) {
    return {
      key: 'PRIVATELY_REVIEWED',
      label: `Privately reviewed — ${plural(rec.privateReview.reviewers)}, ${longDate(rec.privateReview.date.slice(0, 10))}`,
      meaning: 'Allies you chose have been through it and this is how many and when. Nobody who opposes it has yet.',
    }
  }
  return {
    key: 'FIRST_SCRUTINY',
    label: FIRST_SCRUTINY_LABEL,
    meaning:
      'Nobody outside the team that made it has reviewed this, as far as the platform has a record. '
      + 'It carries Lex’s drafting and the author’s decisions, and nothing else.',
  }
}

/**
 * §5's counterpart line — said on every document so that "First Scrutiny" is never a flag that only ever
 * disappears. States plainly what removes it, and that the platform cannot yet tell.
 */
export const REVIEW_COUNTERPARTS_NOTE =
  'Other review statuses: “Privately reviewed” (through Stage 4, with the number of reviewers and the date) and '
  + '“Publicly reviewed” (through Stage 5, likewise). The platform does not yet record either, so every '
  + 'document is First Scrutiny until it does.'

// ── the banner ───────────────────────────────────────────────────────────────

export function stageSentence(n: SevenStageNumber): string {
  return `This is a Stage ${n} document: ${stageByNumber(n).name}.`
}

/** The seven stages, one line each, this one marked in WORDS (never colour alone). */
export function stageListLines(current: SevenStageNumber): string[] {
  return SEVEN_STAGES.map((s) => {
    const mark = s.n === current ? ' — this document' : ''
    const avail = s.available ? '' : ` (${NOT_YET_AVAILABLE})`
    return `${s.n} · ${s.name} — ${s.does}${avail}${mark}`
  })
}

/**
 * §4 — the blocks that open every generated document, in the brief's order: the stage in bold; the review
 * status; the seven stages with this one marked; the caveat verbatim.
 */
export function stageBannerBlocks(stage: SevenStageNumber, record: ReviewRecord = NO_REVIEW_RECORDED): Block[] {
  const rs = reviewStatus(record)
  return [
    { kind: 'paragraph', runs: [{ text: stageSentence(stage), bold: true }] },
    {
      kind: 'paragraph',
      runs: [
        { text: 'Review status: ', bold: true },
        { text: `${rs.label}. `, bold: true },
        { text: `${rs.meaning} ` },
        { text: REVIEW_COUNTERPARTS_NOTE, italic: true },
      ],
    },
    { kind: 'bullets', ordered: false, items: stageListLines(stage).map((t, i) => [{ text: t, bold: SEVEN_STAGES[i].n === stage }]) },
    { kind: 'note', text: `${STAGE_CAVEAT_HEADING} ${STAGE_CAVEAT}` },
    { kind: 'rule' },
  ]
}

/** Put the banner at the very top of a document. The only place a builder's output is given one. */
export function withStageBanner(model: DocumentModel, stage: SevenStageNumber, record: ReviewRecord = NO_REVIEW_RECORDED): DocumentModel {
  return { ...model, blocks: [...stageBannerBlocks(stage, record), ...model.blocks] }
}

/**
 * ══ DECISION 135 — A DOCUMENT'S STAGE COMES FROM THE KERNEL'S PROGRESS, NOT FROM WHETHER A PASS HAS RUN ══
 *
 * Three facts, all about how far the work has got:
 *   · `built`            — a first build has completed.
 *   · `kernelComplete`   — decision 97: EVERY kernel field is accepted or skipped.
 *   · `enteredDeepening` — the user has run (or begun) a pass of the Deepening itself.
 *
 * Stage 1 until the first build. Stage 2 until the kernel is complete AND the user has entered the Deepening.
 * Stage 3 from then.
 *
 * ⚠ WHY THE OLD TEST WAS WRONG. It read "any `DeepeningPass` row with status RUN". The BUILD writes such rows
 * itself (build-research.ts, build-smart.ts), so a document made straight after a build, before the user had
 * touched the kernel, announced itself as Stage 3. The new test cannot be satisfied by a build.
 * ⚠ The facts are inputs, not read here: this file imports nothing (CLAUDE.md §28).
 */
export interface KernelProgress {
  built: boolean
  kernelComplete: boolean
  enteredDeepening: boolean
}

export function stageFromProgress(p: KernelProgress): SevenStageNumber {
  if (!p.built) return 1
  return p.kernelComplete && p.enteredDeepening ? 3 : 2
}

/**
 * Which stage a document is. ⚠ Never from `Idea.stage`. The briefing and the questions are the First Pass
 * whatever the progress (they are "what is already there" and were made from the corpus, not the kernel);
 * anything built from the kernel takes the idea's stage from `stageFromProgress`. Stage 4+ do not exist yet.
 */
export function documentStage(opts: { kind: 'FIRST_PASS' | 'KERNEL'; progress: KernelProgress }): SevenStageNumber {
  if (opts.kind === 'FIRST_PASS') return 1
  return stageFromProgress(opts.progress)
}

/** The facts as the snapshot-free reader (stage-facts.ts) and the frozen-snapshot reader both build them. */
export function kernelProgressOf(input: {
  built: boolean
  /** Status of every kernel field, a missing row as 'EMPTY'. */
  fieldStatuses: readonly string[]
  /** The Deepening's own pass keys (deepening-config PASS_KEYS) — NOT the research the build files under other keys. */
  deepeningPassKeys: readonly string[]
  passes: ReadonlyArray<{ passKey: string; status: string }>
}): KernelProgress {
  return {
    built: input.built,
    kernelComplete: input.fieldStatuses.length > 0 && input.fieldStatuses.every((s) => s === 'ACCEPTED' || s === 'SKIPPED'),
    enteredDeepening: input.passes.some((p) => input.deepeningPassKeys.includes(p.passKey) && p.status !== 'NOT_RUN'),
  }
}
