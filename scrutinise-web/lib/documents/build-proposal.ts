// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B §3a/§3b — THE PROPOSAL and THE SUMMARY, built from the snapshot.
//
// TWO RENDERERS OVER ONE BLOCK MODEL. Sprint 2.5's `model.ts` says in its own
// header that the Initial Background is the first thing built through it and the
// full proposal document is meant to be the second. So this is a new BUILDER —
// snapshot in, `DocumentModel` out — and not a second export path. `renderDocx`
// and `renderPdf` learn nothing about proposals.
//
// ⚠ THE SEAM. Nothing in this file touches Prisma or `lib/lex/deepening*`. It
// reads `ProposalSnapshot` and nothing else, which is what lets 25-C keep
// changing the underlying shapes while this file stays still.
//
// FOUR CONTENT RULES, ALL OF WHICH ALREADY EXIST ELSEWHERE AND HOLD HERE:
//
//   1. RENDERING OF STORED STATE ONLY. No model call, no computed prose. If the
//      snapshot does not hold it, it does not appear.
//   2. EVERY CLAIM CARRIES ITS SOURCE, and a claim with nothing behind it is
//      VISIBLY MARKED rather than quietly presented — the never-claim rule, in
//      the artefact that leaves the building.
//   3. A GAP IS STATED, NOT OMITTED. "What this proposal does not establish" is
//      a section of the document, not an omission from it.
//   4. THE USER'S OWN KNOWLEDGE IS ATTRIBUTED TO THEM, never blended into Lex's
//      prose.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, DocumentModel, Run, SourceRef } from './model'
import { markdownToBlocks } from './markdown'
// 25-M §2b — the write-up carries every section the right-hand panel holds, in the panel's
// own order. ⚠ The heading vocabulary is IMPORTED, never restated: `question-headings.ts`
// imports nothing and is held to §20-B's import ban precisely so the document stack can read
// it without reaching into mid-flight Lex modules (see that file's header).
import { QUESTION_HEADINGS, HEADING_ORDER, liveHeading, type HeadingKey } from '../lex/question-headings'
import {
  assertRenderableSnapshot,
  snapshotHash,
  type ProposalSnapshot,
  type SnapshotAction,
  type SnapshotCostFigure,
  type SnapshotField,
} from './proposal-snapshot'

export interface ProposalBuildResult {
  model: DocumentModel
  /** sha-256 over exactly the snapshot that was rendered. */
  fingerprint: string
  sourceLabel: string
}

/**
 * ⚠ WHICH FIELDS GET THE UNSUPPORTED MARKER, AND WHY IT IS NOT ALL OF THEM.
 *
 * Rule 2 is about CLAIMS — assertions about the world that a reader could check
 * and that could be wrong. These are those fields.
 *
 * A guiding-policy field is a DECISION, not a claim: "we rule out a licensing
 * regime" is the user's judgement, and stamping it "unsupported" would be a
 * category error that trains the reader to ignore the marker on the fields where
 * it means something. Those are attributed instead (§ "The user's own knowledge").
 *
 * ⚠ Getting this wrong in either direction is a real failure. Marking everything
 * makes the marker noise; marking nothing is the quiet presentation the rule
 * exists to stop. `check:20bd` asserts both halves.
 */
const CLAIM_FIELDS = new Set([
  'challenge',
  'whoAffectedImpactCost',
  'rootCause',
  'legalLandscape',
  'pivotalObstacle',
])

const UNSUPPORTED_NOTE =
  'Not evidenced — no source in the record backs this. It is the proposer’s statement, offered as such.'

function text(s: string): Run[] {
  return [{ text: s }]
}

function fieldByKey(snapshot: ProposalSnapshot, key: string): SnapshotField | undefined {
  return snapshot.fields.find((f) => f.key === key)
}

/** The stored value as prose, or null when there is nothing to render. */
function fieldText(field: SnapshotField | undefined): string | null {
  if (!field) return null
  if (field.status !== 'ACCEPTED' && field.status !== 'SKIPPED') return null
  if (typeof field.value === 'string' && field.value.trim()) return field.value.trim()
  return null
}

function money(f: SnapshotCostFigure | null): string | null {
  if (!f) return null
  const unit = f.unit ?? 'GBP'
  const sym = unit === 'GBP' ? '£' : `${unit} `
  const fmt = (n: number) => `${sym}${n.toLocaleString('en-GB')}`
  if (f.low != null && f.high != null) {
    return f.low === f.high ? fmt(f.low) : `${fmt(f.low)}–${fmt(f.high)}`
  }
  if (f.low != null) return `${fmt(f.low)} (low end only)`
  if (f.high != null) return `${fmt(f.high)} (high end only)`
  return null
}

/**
 * A costed figure and its basis, together, always.
 *
 * ⚠ A figure with no basis is rendered as "no basis stated", NEVER dropped and
 * never shown bare. A bare number in a document sent to a committee clerk reads
 * as a costing; an uncosted number with its silence named reads as what it is.
 */
function figureRuns(label: string, f: SnapshotCostFigure | null): Run[] | null {
  const amount = money(f)
  if (!amount) return null
  const runs: Run[] = [{ text: `${label}: `, bold: true }, { text: amount }]
  if (f?.basis) runs.push({ text: ` — ${f.basis}`, italic: true })
  else runs.push({ text: ' — no basis stated', italic: true })
  if (f?.userOverride) runs.push({ text: ' (proposer’s figure, overriding the benchmark)', italic: true })
  if (f?.priceYear) runs.push({ text: ` [${f.priceYear} prices]` })
  return runs
}

/** Push a claim block plus its source line, or its visible absence. */
function pushClaim(
  blocks: Block[],
  snapshot: ProposalSnapshot,
  opts: { body: string; evidenceIds: string[]; supported: boolean; markUnsupported: boolean },
) {
  blocks.push(...markdownToBlocks(opts.body))
  if (opts.evidenceIds.length) {
    const refs = opts.evidenceIds
      .map((id) => snapshot.evidence.find((e) => e.id === id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
    if (refs.length) {
      blocks.push({
        kind: 'bullets',
        items: refs.map((e): Run[] => {
          const runs: Run[] = [{ text: e.title, bold: true }]
          if (e.citation) runs.push({ text: ` — ${e.citation}` })
          if (e.url) runs.push({ text: ` ${e.url}`, href: e.url })
          return runs
        }),
      })
    }
  } else if (opts.markUnsupported && !opts.supported) {
    blocks.push({ kind: 'note', text: UNSUPPORTED_NOTE })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §3a — THE PROPOSAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ══ 25-M §2b — EVERYTHING THE RIGHT-HAND PANEL HOLDS ═══════════════════════
 *
 * §2b: the full write-up is "the strategic kernel **and** everything the right-hand panel
 * holds". Until now the document carried the kernel, the proposer's own words, the gaps and
 * a source list — and **none** of the material filed under the panel's questions: the
 * prognosis, the statutory consequences, what was tried before, how the courts have read it,
 * the strongest case against. The best of what a build produces reached the screen and
 * stopped there.
 *
 * ⚠ IT READS ONLY THE SNAPSHOT (20-B §1). No document generator reaches into the deepening
 * modules; that seam is what has kept this stack stable through six sprints of change
 * underneath it, and the temptation to "just import `deepeningState`" for one section is
 * exactly how it would end.
 *
 * ⚠ THE ORDER IS THE PANEL'S (`HEADING_ORDER`), not this file's. It runs from what is settled
 * toward what is contested and ends on the strongest case against; a document that reordered
 * it would be making a different argument from the screen the proposer worked on.
 *
 * ⚠⚠ AN UNREVIEWED FINDING IS LABELLED, NOT PROMOTED. Until 25-M the snapshot took only
 * ACCEPTED evidence — right in principle, and it meant this section was EMPTY for every idea
 * in the database, because nothing has ever been accepted. Carrying it unlabelled would put
 * Lex's judgement into the proposer's document as though they had endorsed it. So each
 * finding says whose it is, which is the same answer this stack already gives for a source
 * nobody has reviewed (`decision: null`).
 *
 * ⚠ AN EMPTY HEADING IS SKIPPED HERE, AND THAT IS NOT THE PANEL'S RULE. On screen an empty
 * heading renders as a STATED GAP, because the reader is judging whether the search was any
 * good. In a document going to a committee clerk, thirteen headings saying "we looked and
 * found nothing" would drown the five that found something — and the absences are not lost:
 * they are collected in "What this proposal does not establish", which follows immediately
 * and is where a reader looks for them.
 */
/**
 * ══ 25-N §5c — THE SIX SECTIONS OF THE LONG REPORT ══════════════════════════════
 *
 * §5c names them: **DRAFT STRATEGY · HOW HARD WILL THIS BE TO ACHIEVE · WHAT THE LAW SAYS NOW ·
 * QUESTIONS THE RESEARCH COULDN'T ANSWER · CHALLENGES · SOURCES** — *"so a reader leafing
 * through a hundred pages always knows where they are."*
 *
 * ⚠ THEY ARE DATA, so a check can assert the order and the wording without rendering anything.
 * The same reasoning as `HEADING_ORDER` and `AGENDA_SECTIONS`: an ordering that lives inside a
 * function body can only be tested by scraping output, and the first thing to rot is the order.
 *
 * ⚠ AND THEY ARE UPPERCASE HERE, VERBATIM FROM §5c. That is the running header a reader sees,
 * and it is deliberately louder than the `level: 1` headings inside it — the whole point is
 * that it is legible when you are flicking rather than reading.
 */
export const REPORT_SECTIONS = {
  strategy: 'DRAFT STRATEGY',
  howHard: 'HOW HARD WILL THIS BE TO ACHIEVE',
  lawNow: 'WHAT THE LAW SAYS NOW',
  questions: 'QUESTIONS THE RESEARCH COULDN\u2019T ANSWER',
  challenges: 'CHALLENGES',
  sources: 'SOURCES',
} as const

function panelBlocks(snapshot: ProposalSnapshot): Block[] {
  const blocks: Block[] = []

  const byHeading = new Map<HeadingKey, ProposalSnapshot['evidence']>()
  for (const e of snapshot.evidence) {
    // ⚠⚠ 25-N §4 — THE REDIRECT, APPLIED HERE TOO. `question-headings.ts` requires every
    // reader of a stored `headingKey` to go through `liveHeading`: "a redirect applied in two
    // of three places is a redirect that puts the same finding under two headings". This was
    // one of the places that tested the raw string, so `AGAINST` — the tag on every row the
    // adversarial pass has ever written — fell out of `HEADING_ORDER` and the rows were
    // DROPPED FROM THE DOCUMENT ENTIRELY, silently, with no error.
    const k = liveHeading(e.headingKey)
    if (!k || !HEADING_ORDER.includes(k)) continue
    const list = byHeading.get(k) ?? []
    list.push(e)
    byHeading.set(k, list)
  }
  if (!byHeading.size) return blocks

  // ══ §5c — SECTIONS 2 AND 3 ══
  //
  // ⚠⚠ THE TWO §5c NAMES ARE THE TWO HEADINGS A READER ARRIVES LOOKING FOR, and they are
  // pulled OUT of the by-question list rather than left inside it. "How hard will this be to
  // achieve" is the prognosis — 25-L §3c moved it out of "the strongest case against" because
  // Charlie could not find it — and "What the law says now" is the first question anybody asks
  // of a legislative proposal. Everything else stays under one research section, in
  // `HEADING_ORDER`, because a section per question would be thirteen running headers for a
  // reader who is looking for two.
  const LEAD_SECTIONS: Array<{ key: HeadingKey; title: string }> = [
    { key: 'HOW_HARD', title: REPORT_SECTIONS.howHard },
    { key: 'LAW_NOW', title: REPORT_SECTIONS.lawNow },
  ]
  for (const lead of LEAD_SECTIONS) {
    const rows = byHeading.get(lead.key)
    if (!rows?.length) continue
    blocks.push({ kind: 'section', title: lead.title })
    const def = QUESTION_HEADINGS.find((h) => h.key === lead.key)
    blocks.push({ kind: 'heading', level: 1, runs: text(def?.heading ?? lead.key) })
    blocks.push(...evidenceRows(rows))
    // ⚠ REMOVED FROM THE MAP so the loop below cannot print it a second time. A finding under
    // two headings in one document is a document that looks padded and is.
    byHeading.delete(lead.key)
  }
  if (!byHeading.size) return blocks

  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 1, runs: text('What the research found') })

  // ⚠ HOW MANY OF THESE THE PROPOSER HAS BEEN THROUGH, said once at the top rather than left
  // for the reader to count. A document whose findings are mostly unreviewed is a different
  // document from one whose findings the proposer has signed off, and the reader cannot tell
  // the two apart without being told.
  const all = [...byHeading.values()].flat()
  const accepted = all.filter((e) => e.status === 'ACCEPTED').length
  blocks.push({
    kind: 'note',
    text: accepted === all.length
      ? `All ${all.length} findings below have been reviewed and accepted by the proposer.`
      : `${accepted} of ${all.length} findings below have been reviewed and accepted by the proposer. `
        + 'The rest are Lex’s — offered, not yet reviewed, and marked as such. Nothing here is a '
        + 'claim the proposer has made.',
  })

  for (const key of HEADING_ORDER) {
    const rows = byHeading.get(key)
    if (!rows?.length) continue
    const def = QUESTION_HEADINGS.find((h) => h.key === key)
    blocks.push({ kind: 'heading', level: 2, runs: text(def?.heading ?? key) })
    blocks.push(...evidenceRows(rows))
  }

  return blocks
}

/**
 * One finding, rendered.
 *
 * ⚠ 25-N §5c — EXTRACTED SO THE TWO LEAD SECTIONS AND THE BY-QUESTION LIST SHARE IT. §5c pulls
 * HOW HARD and WHAT THE LAW SAYS NOW out into their own sections; rendering them with a copy of
 * this loop would be two renderers of a finding, and the second one is the one that would stop
 * carrying the "not yet reviewed" mark the first time somebody changed it.
 */
function evidenceRows(rows: ProposalSnapshot['evidence']): Block[] {
  const out: Block[] = []
  for (const e of rows) {
    const unreviewed = e.status !== 'ACCEPTED'
    out.push({
      kind: 'heading',
      level: 3,
      runs: text(unreviewed ? `${e.title} — not yet reviewed` : e.title),
    })
    if (e.citation || e.url) {
      out.push({ kind: 'paragraph', runs: text([e.citation, e.url].filter(Boolean).join(' · ')) })
    }
    // ⚠ THE SIFT'S REASON, VERBATIM OR ABSENT. Never invented — a row written before the sift
    // existed has none, and saying so beats a plausible sentence.
    if (e.siftReason) out.push({ kind: 'paragraph', runs: text(e.siftReason) })
    out.push(...markdownToBlocks(e.body))
  }
  return out
}

/**
 * ══ 25-N §5a — WHERE THE PROPOSAL IS UNFINISHED, SAY SO ONCE, AT THE TOP ════════
 *
 * §5a: *"Where the proposal is unfinished, say so once, at the top: 'This is a DRAFT report for
 * a proposal in process.'"*
 *
 * ⚠⚠ AND IT REPLACES A COUNT, WHICH IS THE POINT. Both documents carried *"9 of 9 settled
 * kernel fields carry no source"* and *"167 questions remain open"* — internal working numbers,
 * in outward-facing documents. §5: *"That belongs in a separate progress report for the user —
 * a 'what is left to do' view — not in a document for a reader."*
 *
 * ⚠ THE HONESTY IS NOT REMOVED, IT IS RELOCATED AND RE-AIMED. A reader needs to know they are
 * reading a draft; they do not need our field-coverage arithmetic, which tells them nothing
 * they can act on and reads as a confession scored out of ten. The full report still carries
 * "What this proposal does not establish", which is the same honesty as PROSE — the questions
 * themselves, which a reader can weigh.
 *
 * ⚠ AND IT IS CONDITIONAL. A finished proposal must not be stamped DRAFT: a permanent banner
 * is a banner nobody reads, and it would be false on the one document it matters most on.
 */
function draftBanner(snapshot: ProposalSnapshot): Block[] {
  const unevidenced = snapshot.coverage.fieldsTotal - snapshot.coverage.fieldsSupported
  const open = snapshot.knownUnknowns.length + snapshot.issues.filter((i) => i.status === 'OPEN').length
  // ⚠ THE TEST IS INTERNAL; ONLY THE VERDICT IS PRINTED. The counts decide whether the sentence
  // appears and are never shown — which is exactly the split §5a asks for.
  if (unevidenced === 0 && open === 0) return []
  return [{
    kind: 'note',
    text: 'This is a DRAFT report for a proposal in process. Parts of it are still open, and where '
      + 'something has not been settled the document says so where it comes up.',
  }]
}

export function buildProposalDocument(snapshot: ProposalSnapshot): ProposalBuildResult {
  assertRenderableSnapshot(snapshot)
  const blocks: Block[] = []

  // ── The ask, first ─────────────────────────────────────────────────────────
  if (snapshot.summaryDescription?.trim()) {
    blocks.push({ kind: 'note', text: snapshot.summaryDescription.trim() })
  }

  // ── Diagnosis ──────────────────────────────────────────────────────────────
  // §5a — said once, at the top, and only when it is true.
  blocks.push(...draftBanner(snapshot))

  // ══ §5c — SECTION 1 ══
  blocks.push({ kind: 'section', title: REPORT_SECTIONS.strategy })
  blocks.push({ kind: 'heading', level: 1, runs: text('The problem') })

  const challenge = fieldByKey(snapshot, 'challenge')
  const challengeText = fieldText(challenge)
  if (challengeText) {
    pushClaim(blocks, snapshot, {
      body: challengeText,
      evidenceIds: challenge?.evidenceIds ?? [],
      supported: challenge?.supported ?? false,
      markUnsupported: CLAIM_FIELDS.has('challenge'),
    })
  } else {
    // A gap is stated, not omitted — including the biggest one.
    blocks.push({ kind: 'note', text: 'The problem statement has not been settled on this proposal.' })
  }

  const whoAffected = fieldByKey(snapshot, 'whoAffectedImpactCost')
  if (whoAffected?.slots.length) {
    blocks.push({ kind: 'heading', level: 2, runs: text(whoAffected.label) })
    for (const slot of whoAffected.slots) {
      blocks.push({ kind: 'paragraph', runs: [{ text: `${slot.label}: `, bold: true }, { text: slot.value }] })
    }
    if (!whoAffected.supported) blocks.push({ kind: 'note', text: UNSUPPORTED_NOTE })
  }

  if (snapshot.causes.length) {
    blocks.push({ kind: 'heading', level: 2, runs: text('Why it happens') })
    // Root-level causes first, each with its sub-causes, so the causal tree is
    // readable rather than a flat list that has lost its shape.
    const roots = snapshot.causes.filter((c) => !c.parentCauseId)
    const renderCause = (c: (typeof snapshot.causes)[number], depth: number) => {
      const head: Run[] = [{ text: c.cause, bold: true }]
      if (c.isRootCause) head.push({ text: '  [root cause]', italic: true })
      if (c.classification && c.classification !== 'UNASSESSED') {
        head.push({ text: `  [${c.classification.toLowerCase()}]`, italic: true })
      }
      // The user's own causes are attributed as theirs; Lex's corpus-seeded ones say so.
      head.push({
        text: c.source === 'USER' ? `  — ${snapshot.owner.name}’s account` : '  — identified from the corpus',
        italic: true,
      })
      blocks.push({ kind: 'heading', level: depth === 0 ? 3 : 3, runs: head })
      if (c.whyPersisted) {
        blocks.push({ kind: 'paragraph', runs: [{ text: 'Why it has persisted: ', bold: true }, { text: c.whyPersisted }] })
      }
      if (c.evidenceLine) {
        blocks.push({ kind: 'paragraph', runs: [{ text: 'Evidence: ', bold: true }, { text: c.evidenceLine }] })
      }
      pushClaim(blocks, snapshot, {
        body: '',
        evidenceIds: c.evidenceIds,
        supported: c.supported,
        markUnsupported: true,
      })
      for (const child of snapshot.causes.filter((x) => x.parentCauseId === c.id)) renderCause(child, depth + 1)
    }
    for (const c of roots) renderCause(c, 0)
  }

  const legal = fieldByKey(snapshot, 'legalLandscape')
  if (legal?.slots.length) {
    blocks.push({ kind: 'heading', level: 2, runs: text(legal.label) })
    for (const slot of legal.slots) {
      blocks.push({ kind: 'paragraph', runs: [{ text: `${slot.label}: `, bold: true }, { text: slot.value }] })
    }
    if (!legal.supported) blocks.push({ kind: 'note', text: UNSUPPORTED_NOTE })
  }

  const pivotal = fieldText(fieldByKey(snapshot, 'pivotalObstacle'))
  if (pivotal) {
    blocks.push({ kind: 'heading', level: 2, runs: text('The pivotal obstacle') })
    pushClaim(blocks, snapshot, {
      body: pivotal,
      evidenceIds: fieldByKey(snapshot, 'pivotalObstacle')?.evidenceIds ?? [],
      supported: fieldByKey(snapshot, 'pivotalObstacle')?.supported ?? false,
      markUnsupported: true,
    })
  }

  // ── Guiding policy ─────────────────────────────────────────────────────────
  blocks.push({ kind: 'rule' })
  // ⚠ 25-N §5c — "Guiding Policy", NOT "The approach". The platform's own vocabulary
  // (docs/CLAUDE.md §4, and the FAQ explains it) is "guiding policy"; the document called it
  // something else, so a reader who had been taught one word met another in the one place the
  // two had to agree.
  blocks.push({ kind: 'heading', level: 1, runs: text('Guiding Policy') })

  const approach = fieldText(fieldByKey(snapshot, 'chosenApproach'))
  if (approach) blocks.push(...markdownToBlocks(approach))
  else blocks.push({ kind: 'note', text: 'No approach has been committed to on this proposal yet.' })

  const leverage = fieldText(fieldByKey(snapshot, 'leverage'))
  if (leverage) {
    blocks.push({ kind: 'heading', level: 2, runs: text('Why this hits the obstacle') })
    blocks.push(...markdownToBlocks(leverage))
  }

  const rulesOut = fieldText(fieldByKey(snapshot, 'whatItRulesOut'))
  const ruledOutOptions = snapshot.options.filter((o) => o.status === 'RULED_OUT')
  if (rulesOut || ruledOutOptions.length) {
    blocks.push({ kind: 'heading', level: 2, runs: text('What it rules out') })
    if (rulesOut) blocks.push(...markdownToBlocks(rulesOut))
    if (ruledOutOptions.length) {
      blocks.push({
        kind: 'bullets',
        items: ruledOutOptions.map((o): Run[] => {
          const runs: Run[] = [{ text: o.approach, bold: true }]
          // ⚠ A ruled-out option without its reason is a decision with the
          // reasoning stripped off. Say that it is missing rather than listing
          // the option as though it were self-explanatory.
          runs.push({ text: o.ruleOutReason ? ` — ${o.ruleOutReason}` : ' — no reason recorded', italic: !o.ruleOutReason })
          return runs
        }),
      })
    }
  }

  const responses = fieldByKey(snapshot, 'anticipatedResponses')
  if (responses?.slots.length) {
    blocks.push({ kind: 'heading', level: 2, runs: text('Anticipated responses') })
    for (const slot of responses.slots) {
      blocks.push({ kind: 'paragraph', runs: [{ text: `${slot.label}: `, bold: true }, { text: slot.value }] })
    }
  }

  const conditions = fieldText(fieldByKey(snapshot, 'conditionsForSuccess'))
  if (conditions) {
    blocks.push({ kind: 'heading', level: 2, runs: text('Conditions for success') })
    blocks.push(...markdownToBlocks(conditions))
  }

  // ── Coherent actions ───────────────────────────────────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 1, runs: text('What would be done') })

  if (!snapshot.actions.length) {
    blocks.push({ kind: 'note', text: 'No costed actions have been recorded on this proposal yet.' })
  }
  for (const a of snapshot.actions) {
    blocks.push({ kind: 'heading', level: 2, runs: text(a.practicalStep) })
    const meta: Run[] = []
    if (a.whoImplements) meta.push({ text: `Implemented by ${a.whoImplements}. ` })
    if (a.mechanismType) meta.push({ text: `Mechanism: ${a.mechanismType}. ` })
    meta.push({
      text: a.source === 'USER' ? `Proposed by ${snapshot.owner.name}.` : 'Drafted by Lex from the toolkit.',
      italic: true,
    })
    blocks.push({ kind: 'paragraph', runs: meta })

    for (const [label, f] of [
      ['Implementation (one-off)', a.implementationCost],
      ['Enforcement (ongoing)', a.enforcementCost],
      ['Regulatory friction (ongoing)', a.regulatoryFriction],
    ] as const) {
      const runs = figureRuns(label, f)
      if (runs) blocks.push({ kind: 'paragraph', runs })
    }

    if (a.costLines.length) {
      blocks.push({
        kind: 'bullets',
        items: a.costLines.map((l): Run[] => {
          const runs: Run[] = [{ text: l.label, bold: true }]
          const amount = money({
            low: l.low, high: l.high, unit: l.unit, basis: l.basis,
            benchmarkId: l.benchmarkId, userOverride: false, priceYear: l.priceYear,
          })
          if (amount) runs.push({ text: ` — ${amount}` })
          runs.push({ text: l.basis ? ` (${l.basis})` : ' (no basis stated)', italic: !l.basis })
          return runs
        }),
      })
    }

    if (!a.supported) blocks.push({ kind: 'note', text: UNSUPPORTED_NOTE })

    // §20.4 — the legislative annex renders WHERE THE INSTRUMENT IS LEGISLATIVE,
    // inline under its action. Standalone is §20-E and is scaffolded, not built.
    if (a.legislative) {
      blocks.push({ kind: 'heading', level: 3, runs: text('Legislative annex') })
      if (a.targetOrganisation) {
        blocks.push({ kind: 'paragraph', runs: [{ text: 'Target: ', bold: true }, { text: a.targetOrganisation }] })
      }
      if (a.wording) {
        blocks.push({ kind: 'paragraph', runs: [{ text: 'Drafting intent: ', bold: true }, { text: a.wording }] })
      }
      blocks.push({
        kind: 'note',
        text: 'Drafting intent only. The provisions to amend, the operation and the linked case law are §20-E and are not established here.',
      })
    }
  }

  // ── Costs against the problem ──────────────────────────────────────────────
  const costSummaryText = typeof snapshot.costs.summary?.summary === 'string'
    ? String(snapshot.costs.summary.summary).trim()
    : null
  if (costSummaryText || snapshot.costs.problemCost) {
    blocks.push({ kind: 'rule' })
    blocks.push({ kind: 'heading', level: 1, runs: text('Cost against the cost of the problem') })
    if (snapshot.costs.problemCost) {
      blocks.push({ kind: 'paragraph', runs: [{ text: 'Cost of the problem: ', bold: true }, { text: snapshot.costs.problemCost }] })
    }
    if (costSummaryText) blocks.push(...markdownToBlocks(costSummaryText))
  }

  // ── The user's own knowledge, attributed ───────────────────────────────────
  if (snapshot.userKnowledge) {
    blocks.push({ kind: 'rule' })
    // ⚠⚠ 25-N §5c — WAS `In ${owner}'s own words`. §5c: *"Delete 'In Charlie's own words' —
    // this is an outward document."* The proposer's first-hand account is not deleted and must
    // not be: it is often the only evidence for the part of the problem no corpus has recorded.
    // What is deleted is the FRAMING — naming the author inside their own proposal reads as a
    // personal aside in a document meant to be read by people who do not know them.
    blocks.push({ kind: 'heading', level: 1, runs: text('First-hand account') })
    // ⚠ NOT blended into the prose above. `ownKnowledgeProvenance` exists exactly
    // so the user's testimony can be told apart from retrieved material, and this
    // is the section where that distinction is honoured rather than lost.
    blocks.push({
      kind: 'note',
      text: snapshot.userKnowledge.provenance === 'USER_TESTIMONY'
        ? 'The proposer’s own account, recorded as testimony. It has not been checked against the corpus.'
        : 'Recorded as retrieved material rather than the proposer’s testimony.',
    })
    blocks.push(...markdownToBlocks(snapshot.userKnowledge.text))
  }

  // ── A gap is stated, not omitted ───────────────────────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push(...panelBlocks(snapshot))

  // ══ §5c — SECTION 4 ══
  blocks.push({ kind: 'section', title: REPORT_SECTIONS.questions })
  blocks.push({ kind: 'heading', level: 1, runs: text('What this proposal does not establish') })
  blocks.push(...gapBlocks(snapshot))

  // ══ 25-L §3d — THE SOURCES THE PROPOSER CHOSE, IN THE DOCUMENT ITSELF ══════
  //
  // §3d: "Priority source — goes in the proposal document. Full source list — goes in the
  // evidence annex." Before this, the tag was decorative: everything retrieved went into
  // one undifferentiated list and the user's own judgement about what mattered reached no
  // reader at all.
  //
  // ⚠ FIRST, AND ON ITS OWN HEADING. A priority source buried in a list of forty is a
  // priority source nobody can see was chosen. This is the proposer saying "read these".
  //
  // ⚠ AND ITS ABSENCE IS STATED, NOT SKIPPED — the same rule as the empty question
  // headings. A document that silently omits the section reads as one where nothing was
  // worth choosing; one that says nobody has chosen yet reads as unfinished, which is what
  // it is. The block only appears once there ARE sources to have chosen from, so a
  // first draft is not scolded for a decision it has not reached.
  //
  // ⚠⚠ `undefined` IS A THIRD CASE, NOT A FALSY ONE. A version minted before this sprint
  // has no `prioritySources` key at all, and telling its reader "no source has been marked
  // as a priority yet" would be a claim about a decision that could not have been made.
  // Absent → the section does not appear. Empty → it appears and says nobody has chosen.
  const priority = snapshot.prioritySources
  if (priority && snapshot.sources.length) {
    blocks.push({ kind: 'rule' })
    // ══ §5c — SECTION 6 ══ (5, CHALLENGES, is emitted by `gapBlocks` above where the open
    // issues are — see the note there.)
    blocks.push({ kind: 'section', title: REPORT_SECTIONS.sources })
    blocks.push({ kind: 'heading', level: 1, runs: text('The sources this rests on') })
    if (priority.length) {
      blocks.push({
        kind: 'sources',
        label: 'Chosen by the proposer as the ones that matter',
        refs: priority.map((r): SourceRef => ({
          title: r.title, citation: r.citation, url: r.url,
          snippet: r.annotation ?? undefined,
        })),
      })
    } else {
      blocks.push({
        kind: 'paragraph',
        runs: text(
          'No source has been marked as a priority yet. Everything the research found is in the '
          + 'source list below and in the evidence annex; nothing here has been singled out by the '
          + 'proposer, which is a statement about where this draft has got to rather than about the '
          + 'sources.',
        ),
      })
    }
  }

  // ── Sources ────────────────────────────────────────────────────────────────
  if (snapshot.sources.length || snapshot.evidence.length) {
    blocks.push({ kind: 'rule' })
    blocks.push({ kind: 'heading', level: 1, runs: text('Sources') })
    for (const group of snapshot.sources) {
      const refs: SourceRef[] = group.refs.map((r) => ({
        title: r.title, citation: r.citation, url: r.url, snippet: r.snippet, date: r.date,
      }))
      blocks.push({ kind: 'sources', label: group.label, refs })
    }
    const findings = snapshot.evidence.filter((e) => e.url || e.citation)
    if (findings.length) {
      blocks.push({
        kind: 'sources',
        label: 'Accepted findings',
        refs: findings.map((e): SourceRef => ({
          title: e.title,
          citation: e.citation ?? '',
          url: e.url ?? '',
          snippet: e.siftReason ?? undefined,
        })),
      })
    }
  }

  const sourceLabel = describeSource(snapshot)
  return {
    model: {
      title: snapshot.title || 'Policy proposal',
      subtitle: 'Policy proposal',
      sourceLabel,
      generatedAt: new Date(),
      blocks,
    },
    fingerprint: snapshotHash(snapshot),
    sourceLabel,
  }
}

/**
 * ⚠ THE HONEST LIMITATIONS SECTION, AND IT IS NEVER EMPTY.
 *
 * §20.2.4: "a proposal that names its own gaps is stronger in committee than one
 * that pretends to have none". A proposal with nothing to declare gets a sentence
 * saying so, because a MISSING section reads as an omission while an explicit
 * "nothing was recorded" reads as a fact — and only one of those is true.
 */
function gapBlocks(snapshot: ProposalSnapshot): Block[] {
  const out: Block[] = []
  let anything = false

  const unevidenced = snapshot.coverage.fieldsTotal - snapshot.coverage.fieldsSupported
  const unevidencedActions = snapshot.coverage.actionsTotal - snapshot.coverage.actionsSupported
  if (unevidenced > 0 || unevidencedActions > 0) {
    anything = true
    out.push({
      kind: 'paragraph',
      runs: [{
        text: `${unevidenced} of ${snapshot.coverage.fieldsTotal} settled kernel fields and ${unevidencedActions} of ${snapshot.coverage.actionsTotal} actions carry no source in the record. Each is marked where it appears above.`,
      }],
    })
  }

  if (snapshot.knownUnknowns.length) {
    anything = true
    out.push({ kind: 'heading', level: 2, runs: text('Questions the research could not answer') })
    out.push({
      kind: 'bullets',
      items: snapshot.knownUnknowns.map((u): Run[] => [
        { text: u.question, bold: true },
        { text: u.why ? ` — ${u.why}` : '' },
      ]),
    })
  }

  const openIssues = snapshot.issues.filter((i) => i.status === 'OPEN' || i.status === 'DEFERRED')
  if (openIssues.length) {
    anything = true
    // ══ §5c — SECTION 5. ⚠ IT IS A SECTION, NOT A LEVEL-2 HEADING INSIDE THE GAPS. §0 calls
    // the challenges *"the most valuable part of the run so far"*, and they were a sub-heading
    // of "what this does not establish" — filed as a shortcoming of the proposal rather than as
    // the scrutiny it has already survived.
    out.push({ kind: 'section', title: REPORT_SECTIONS.challenges })
    out.push({ kind: 'heading', level: 1, runs: text('Challenges') })
    out.push({
      kind: 'bullets',
      items: openIssues.map((i): Run[] => [
        { text: i.text },
        { text: i.status === 'DEFERRED' ? ' [deferred]' : '', italic: true },
      ]),
    })
  }

  // A dismissed issue stays visible WITH ITS REASON. What was considered and set
  // aside is a strength; hiding it is what makes a reader distrust the rest.
  const dismissed = snapshot.issues.filter((i) => i.status === 'DISMISSED')
  if (dismissed.length) {
    anything = true
    out.push({ kind: 'heading', level: 2, runs: text('Considered and set aside') })
    out.push({
      kind: 'bullets',
      items: dismissed.map((i): Run[] => [
        { text: i.text },
        { text: i.dismissReason ? ` — ${i.dismissReason}` : ' — no reason recorded', italic: true },
      ]),
    })
  }

  if (snapshot.forks.open.length) {
    anything = true
    out.push({ kind: 'heading', level: 2, runs: text('Decisions still open') })
    out.push({
      kind: 'bullets',
      items: snapshot.forks.open.map((f): Run[] => [
        { text: f.chosen, bold: true },
        { text: ` — the alternative not taken: ${f.alternative}. ${f.caseForAlternative}` },
      ]),
    })
  }

  const failedPasses = snapshot.passes.filter((p) => p.status === 'FAILED')
  if (failedPasses.length) {
    anything = true
    out.push({ kind: 'heading', level: 2, runs: text('Research that did not complete') })
    out.push({
      kind: 'bullets',
      items: failedPasses.map((p): Run[] => [
        { text: p.passKey, bold: true },
        { text: p.failureReason ? ` — ${p.failureReason}` : ' — no reason recorded' },
      ]),
    })
  }

  if (!anything) {
    out.push({
      kind: 'paragraph',
      runs: text('Nothing was recorded as unestablished on this proposal. That is the state of the record, not a claim that no gaps exist.'),
    })
  }
  return out
}

function describeSource(snapshot: ProposalSnapshot): string {
  const sourceCount = snapshot.sources.reduce((n, g) => n + g.refs.length, 0)
  return [
    'the stored proposal state',
    `${snapshot.coverage.fieldsTotal} settled kernel field${snapshot.coverage.fieldsTotal === 1 ? '' : 's'}`,
    `${snapshot.actions.length} action${snapshot.actions.length === 1 ? '' : 's'}`,
    `${snapshot.evidence.length} accepted finding${snapshot.evidence.length === 1 ? '' : 's'}`,
    `${sourceCount} corpus source${sourceCount === 1 ? '' : 's'}`,
  ].join(', ')
}

// ─────────────────────────────────────────────────────────────────────────────
// §3b — THE SUMMARY (1–2 pages)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ DELIBERATELY SHORT, AND IT POINTS AT THE ONLINE VIEW FOR DEPTH.
 *
 * §20.1: "a committee clerk reads two pages and follows a link; they do not read
 * forty." So this is not an abridged Proposal — it is a different document with
 * six things in it: the problem, the pivotal obstacle, the approach, what it
 * rules out, headline cost against problem cost, and THE ASK.
 *
 * Everything long is TRUNCATED WITH ITS TRUNCATION VISIBLE (`…`), never silently
 * cut, and the honest-limitations line survives at one sentence — a summary that
 * drops the gaps is the one document where the never-claim rule would matter most
 * and be easiest to lose.
 */
export function buildSummaryDocument(
  snapshot: ProposalSnapshot,
  opts: { onlineViewUrl?: string | null } = {},
): ProposalBuildResult {
  assertRenderableSnapshot(snapshot)
  const blocks: Block[] = []

  // ⚠ 25-N §5b — ONE PAGE, NOT TWO, AND THE CLIPS ARE WHERE THAT IS ENFORCED. Four sections
  // at ~450 characters, four bullets of an ask, and a two-line cost comparison is a page. The
  // previous version ran to seven sections at 500–700 characters each, which is two.
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

  // §5a — said once, at the top, and only when something really is unsettled.
  blocks.push(...draftBanner(snapshot))

  // ══ 25-N §5b — FOUR HEADINGS: The problem · Cause · Guiding Policy · Proposed Actions ══
  //
  // ⚠ THEY ARE THE STRATEGIC KERNEL'S OWN WORDS. The summary used to open on "The problem",
  // then "The pivotal obstacle", then "The approach" — a vocabulary the platform teaches
  // nowhere and which drops the CAUSE entirely, so the one-page version of a proposal never
  // said why the problem happens. §5b names the four, and they are the four the kernel is made
  // of.

  const challenge = fieldText(fieldByKey(snapshot, 'challenge'))
  blocks.push({ kind: 'heading', level: 2, runs: text('The problem') })
  blocks.push({
    kind: 'paragraph',
    runs: text(challenge ? clip(challenge, 450) : 'Not yet settled on this proposal.'),
  })

  // ══ 25-N §5b — A FIELD WITH SEVERAL CANDIDATES TAKES THE TOP ONE AND SAYS SO ══════
  //
  // §5b: *"Where a field has several candidates, take the top one and label it: 'Current
  // leading cause, of 10 under consideration.'"*
  //
  // ⚠⚠ THE LABEL IS THE WHOLE INSTRUCTION, NOT THE PICKING. Printing one of ten causes with no
  // note is a document asserting a settled diagnosis on a draft that has not made one — the
  // single most misleading thing a part-way summary can do, and the reader has no way to know.
  // Printing all ten is not a one-page summary. The label is what makes the first option
  // honest.
  //
  // ⚠ AND "TOP" IS THE USER'S ORDER, NOT A SCORE. `causes` arrives in the order the panel
  // shows and §5b's own next sentence is that kernel items must be draggable so the user
  // chooses which is top. Ranking them here would overrule the control that sprint asks for.
  const causes = snapshot.causes ?? []
  const rootCause = fieldText(fieldByKey(snapshot, 'rootCause'))
  blocks.push({ kind: 'heading', level: 2, runs: text('Cause') })
  if (rootCause) {
    // A settled root cause is settled: no label, because there is nothing under consideration.
    blocks.push({ kind: 'paragraph', runs: text(clip(rootCause, 450)) })
  } else if (causes.length) {
    // ⚠ A CAUSE THE USER HAS MARKED AS ROOT WINS OVER POSITION. `isRootCause` is a decision;
    // being first in the list is only an order, and printing the first one over the top of a
    // marked root cause would overrule the user with a sort.
    const lead = causes.find((c) => c.isRootCause) ?? causes[0]
    blocks.push({ kind: 'paragraph', runs: text(clip(lead.cause, 450)) })
    if (lead.whyPersisted) {
      blocks.push({ kind: 'paragraph', runs: text(clip(lead.whyPersisted, 300)) })
    }
    blocks.push({
      kind: 'note',
      text: lead.isRootCause
        ? `Marked as the root cause, of ${causes.length} under consideration.`
        : causes.length === 1
          ? 'The only cause under consideration. No root cause has been settled on yet.'
          : `Current leading cause, of ${causes.length} under consideration. No root cause has been settled on yet.`,
    })
  } else {
    blocks.push({ kind: 'paragraph', runs: text('No cause has been recorded yet.') })
  }

  // ⚠ 25-N §5c APPLIES HERE TOO: "Guiding Policy", not "The approach". And where nothing has
  // been committed to, the candidates are LISTED rather than the absence merely stated — §5c:
  // *"List all proposed approaches rather than 'no approach has been committed to' — keep that
  // line, then list what is under consideration."*
  const approach = fieldText(fieldByKey(snapshot, 'chosenApproach'))
  const liveOptions = (snapshot.options ?? []).filter((o) => o.status !== 'RULED_OUT')
  blocks.push({ kind: 'heading', level: 2, runs: text('Guiding Policy') })
  if (approach) {
    blocks.push({ kind: 'paragraph', runs: text(clip(approach, 450)) })
  } else if (liveOptions.length) {
    blocks.push({ kind: 'paragraph', runs: text(clip(liveOptions[0].approach, 450)) })
    blocks.push({
      kind: 'note',
      text: liveOptions.length === 1
        ? 'The only approach under consideration. None has been committed to yet.'
        : `Current leading approach, of ${liveOptions.length} under consideration. None has been committed to yet.`,
    })
    if (liveOptions.length > 1) {
      blocks.push({
        kind: 'bullets',
        items: liveOptions.slice(1, 5).map((o): Run[] => [{ text: clip(o.approach, 140) }]),
      })
    }
  } else {
    blocks.push({ kind: 'paragraph', runs: text('No approach has been committed to.') })
  }

  // ── Proposed Actions ────────────────────────────────────────────────────────
  blocks.push({ kind: 'heading', level: 2, runs: text('Proposed Actions') })
  const legislativeActions = snapshot.actions.filter((a) => a.legislative)
  const shownActions = legislativeActions.length ? legislativeActions : snapshot.actions
  if (shownActions.length) {
    blocks.push({
      kind: 'bullets',
      items: shownActions.slice(0, 4).map((a): Run[] => [
        { text: a.practicalStep, bold: true },
        { text: a.targetOrganisation ? ` — ${a.targetOrganisation}` : '' },
      ]),
    })
    if (shownActions.length > 4) {
      blocks.push({ kind: 'note', text: `${shownActions.length - 4} further actions are in the full report.` })
    }
  } else {
    blocks.push({ kind: 'paragraph', runs: text('No actions have been recorded, so there is no ask to state.') })
  }

  // The cost comparison, in two lines. ⚠ It stays: it is the one number a reader wants from a
  // one-pager, and both halves say plainly when they are not in the record.
  blocks.push({
    kind: 'paragraph',
    runs: [
      { text: 'Cost of the proposal: ', bold: true },
      { text: headlineCost(snapshot.actions) ?? 'not costed in the record' },
      { text: '  ·  ' },
      { text: 'Cost of the problem: ', bold: true },
      { text: snapshot.costs.problemCost ?? 'not established in the record' },
    ],
  })

  // ⚠⚠ 25-N §5a — THE INTERNAL COUNTS ARE GONE FROM HERE.
  //
  // This is where *"9 of 9 settled kernel fields carry no source, and 167 questions remain
  // open"* was printed, on the outward-facing one-pager. §5a: those are working numbers and
  // *"belong in a separate progress report for the user — a 'what is left to do' view — not in
  // a document for a reader."* What replaces them is `draftBanner` at the top: one sentence,
  // once, saying it is a draft. The gaps themselves — the questions, in words — are still in
  // the full report under "What this proposal does not establish", where a reader can weigh
  // them instead of being handed our arithmetic.
  blocks.push({ kind: 'rule' })

  if (opts.onlineViewUrl) {
    blocks.push({
      kind: 'paragraph',
      runs: [
        { text: 'The full proposal, its sources and its evidence: ' },
        { text: opts.onlineViewUrl, href: opts.onlineViewUrl },
      ],
    })
  }

  const sourceLabel = describeSource(snapshot)
  return {
    model: {
      title: snapshot.title || 'Policy proposal',
      subtitle: 'Summary — the proposal in two pages',
      sourceLabel,
      generatedAt: new Date(),
      blocks,
    },
    fingerprint: snapshotHash(snapshot),
    sourceLabel,
  }
}

/**
 * The headline cost: the summed one-off implementation range across actions.
 *
 * ⚠ IT REFUSES TO SUM A PARTIAL SET. If any action carries no implementation
 * figure, the total is returned as null rather than as the sum of the ones that
 * happen to have numbers — a total that silently omits three of five actions is
 * the single most dangerous number this document could carry.
 */
export function headlineCost(actions: SnapshotAction[]): string | null {
  if (!actions.length) return null
  let low = 0
  let high = 0
  for (const a of actions) {
    const f = a.implementationCost
    if (!f || (f.low == null && f.high == null)) return null
    low += f.low ?? f.high ?? 0
    high += f.high ?? f.low ?? 0
  }
  const fmt = (n: number) => `£${n.toLocaleString('en-GB')}`
  return low === high ? fmt(low) : `${fmt(low)}–${fmt(high)}`
}
