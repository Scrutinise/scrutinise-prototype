// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-E §5a — THE EVIDENCE PACK. §20.1's fourth output, and 20-B/D scaffolded it
// with its inputs already named.
//
// 20-B/D's framing is the right one and it decides everything below:
//
//     "An MP's office can hand over a proposal; the annex is what survives being checked."
//
// The Proposal is an argument. THIS is the thing somebody goes through line by line, and
// its value is entirely in being answerable — every source, every figure's basis, every
// alternative ruled out, every source considered and set aside, and every gap the author
// already knew about.
//
// ⚠⚠ THE SECTION THAT MAKES IT WORTH HANDING OVER IS "CONSIDERED AND SET ASIDE". A pack
// that lists what was used is a bibliography. A pack that lists what was looked at and
// REJECTED, with the reason, is the one that answers the question a hostile reader actually
// asks — "did you see the 2013 assessment?" — before they ask it. That is why §2a had to be
// built before this could be.
//
// ⚠ GROUPED BY THE QUESTION IT ANSWERS (§3's headings), not by document type. The pack is
// read by somebody checking a claim, and they arrive with a question, not with a filing
// system. Findings the producer never tagged go under an explicit "not filed" heading
// rather than being swept into the first one.
//
// ⚠ NO PRISMA, NO MODEL CALL, NO IDEA STATE. It reads the snapshot and nothing else —
// `check:20bd` asserts both bans over this whole directory. Everything here is either a
// value from the snapshot or a count of values from the snapshot.
//
// ⚠ AND IT MUST RENDER A v1 SNAPSHOT. `excludedSources`, `outstanding` and
// `evidence[].headingKey` arrived in shape 2; a version published before them is still a
// version somebody holds a link to. Every read of those members is defensive, and their
// ABSENCE is stated ("this version predates…") rather than rendered as an empty section,
// which would say the author had nothing to declare.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import type { Block, DocumentModel, Run, SourceRef } from './model'
import { QUESTION_HEADINGS, type HeadingKey } from '@/lib/lex/question-headings'
import {
  assertRenderableSnapshot,
  snapshotHash,
  type ProposalSnapshot,
  type SnapshotCostLine,
  type SnapshotEvidence,
} from './proposal-snapshot'
import type { ProposalBuildResult } from './build-proposal'

function text(s: string): Run[] { return [{ text: s }] }

const NOT_FILED = 'Not filed under a question'

/** A cost line with no stated basis. Rendered as that, never as a figure standing alone. */
function basisOf(l: { basis: string | null; benchmarkId: string | null }): string {
  if (l.basis?.trim()) return l.basis.trim()
  if (l.benchmarkId) return `From benchmark ${l.benchmarkId} — no basis text was stored.`
  // ⚠ THE SENTENCE THAT MATTERS MOST IN THIS DOCUMENT. A number with no basis is the thing
  // a committee finds first, and printing it silently beside numbers that do have one is
  // how a whole annex loses its credibility for one line.
  return 'NO BASIS STATED — this figure has nothing behind it in the record.'
}

function moneyRange(low: number | null, high: number | null, unit: string | null): string {
  const fmt = (n: number) => `£${n.toLocaleString('en-GB')}`
  if (low == null && high == null) return 'not costed'
  if (low != null && high != null && low !== high) return `${fmt(low)}–${fmt(high)}${unit && unit !== 'GBP' ? ` ${unit}` : ''}`
  const one = low ?? high!
  return `${fmt(one)}${unit && unit !== 'GBP' ? ` ${unit}` : ''}`
}

export function buildEvidencePackDocument(snapshot: ProposalSnapshot): ProposalBuildResult {
  assertRenderableSnapshot(snapshot)
  const blocks: Block[] = []
  // Shape 1 predates every member this document was built around. Saying so once, at the
  // top, is more useful than four empty sections that each imply nothing was recorded.
  const preShapeTwo = (snapshot.snapshotVersion ?? 1) < 2

  blocks.push({
    kind: 'paragraph',
    runs: text(
      'Everything this proposal rests on, and everything it does not. Each source is listed under the '
      + 'question it answers; each figure is listed with its basis; alternatives that were ruled out are '
      + 'listed with the reason; and sources that were considered and set aside are listed with the reason '
      + 'they were set aside. Nothing here was written for this document — it is the record as it stands.',
    ),
  })

  if (preShapeTwo) {
    blocks.push({
      kind: 'note',
      text:
        'This version was published before the record kept source decisions and outstanding items. '
        + 'The sections below that depend on them are absent because they were never recorded — not '
        + 'because there was nothing to record.',
    })
  }

  // ── 1. The sources, by the question they answer ────────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 2, runs: text('The evidence, by the question it answers') })

  const byHeading = new Map<string, SnapshotEvidence[]>()
  for (const e of snapshot.evidence ?? []) {
    const key = e.headingKey && QUESTION_HEADINGS.some((h) => h.key === e.headingKey) ? e.headingKey : NOT_FILED
    const list = byHeading.get(key) ?? []
    list.push(e)
    byHeading.set(key, list)
  }

  const order: string[] = [...QUESTION_HEADINGS.map((h) => h.key as string), NOT_FILED]
  let anyEvidence = false
  for (const key of order) {
    const items = byHeading.get(key)
    if (!items?.length) continue
    anyEvidence = true
    const def = QUESTION_HEADINGS.find((h) => h.key === (key as HeadingKey))
    blocks.push({ kind: 'heading', level: 3, runs: text(def?.heading ?? NOT_FILED) })
    if (!def) {
      blocks.push({
        kind: 'note',
        text: 'These were found before findings were filed by question, so which one they answer was never recorded.',
      })
    }
    const refs: SourceRef[] = items.map((e) => ({
      title: e.title,
      citation: e.citation ?? '',
      url: e.url ?? '',
      // ⚠ THE SIFT'S OWN REASON, VERBATIM OR NOT AT ALL. This document's whole claim is that
      // every line in it can be answered; inventing a plausible relevance sentence here
      // would be the one place a fabrication would be least likely to be noticed and most
      // damaging when it was.
      snippet: e.siftReason?.trim() || undefined,
    }))
    blocks.push({ kind: 'sources', label: def?.heading ?? NOT_FILED, refs })
  }
  if (!anyEvidence) {
    blocks.push({
      kind: 'note',
      text: 'No findings have been accepted onto this proposal. That is a statement about the record, not about the subject.',
    })
  }

  // ── 2. Considered and set aside ────────────────────────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 2, runs: text('Considered and set aside') })
  const excluded = snapshot.excludedSources ?? []
  if (excluded.length) {
    blocks.push({
      kind: 'paragraph',
      runs: text(
        `${excluded.length} source${excluded.length === 1 ? ' was' : 's were'} looked at and not used. `
        + 'They are here with the reason, because what was considered and rejected is part of the work.',
      ),
    })
    blocks.push({
      kind: 'bullets',
      items: excluded.map((e) => {
        const runs: Run[] = []
        const name = e.title?.trim() || e.citation?.trim() || e.sourceKey
        runs.push({ text: name, bold: true })
        if (e.citation?.trim() && e.citation.trim() !== name) runs.push({ text: ` — ${e.citation.trim()}` })
        if (e.url?.trim()) runs.push({ text: ` (${e.url.trim()})` })
        // ⚠ An excluded row with no reason is REPORTED as one. The write path refuses to
        // create these, so any that appear are pre-25-D or were made another way — and a
        // silently omitted reason is exactly what this section exists to make impossible.
        runs.push({ text: `\nSet aside: ${e.reason?.trim() || 'NO REASON RECORDED.'}` })
        if (e.annotation?.trim()) runs.push({ text: `\nNote: ${e.annotation.trim()}` })
        return runs
      }),
    })
  } else if (preShapeTwo) {
    blocks.push({ kind: 'note', text: 'Source decisions were not recorded when this version was published.' })
  } else {
    // ⚠ "Nothing was set aside" IS A FINDING and is stated. An omitted section reads as
    // "we did not do this part"; this reads as "we did, and the answer was none".
    blocks.push({
      kind: 'note',
      text: 'Nothing was set aside. Every source that was surfaced is either used above or has not been reviewed.',
    })
  }

  // ── 3. Alternatives ruled out ──────────────────────────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 2, runs: text('Alternatives ruled out') })
  const ruledOut = (snapshot.options ?? []).filter((o) => o.status === 'RULED_OUT')
  if (ruledOut.length) {
    blocks.push({
      kind: 'bullets',
      items: ruledOut.map((o) => ([
        { text: o.approach, bold: true } as Run,
        { text: `\nRuled out because: ${o.ruleOutReason?.trim() || 'NO REASON RECORDED.'}` } as Run,
        ...(o.caseFor?.trim() ? [{ text: `\nThe case for it was: ${o.caseFor.trim()}` } as Run] : []),
      ])),
    })
  } else {
    blocks.push({
      kind: 'note',
      text: 'No alternative was formally ruled out. A proposal with no ruled-out alternative has not yet been tested against one.',
    })
  }

  // Forks the user settled: the alternative and its case SURVIVE the decision (25-C §3a).
  const resolvedForks = snapshot.forks?.resolved ?? []
  if (resolvedForks.length) {
    blocks.push({ kind: 'heading', level: 3, runs: text('Decisions taken, and the road not taken') })
    blocks.push({
      kind: 'bullets',
      items: resolvedForks.map((f) => ([
        { text: f.chosen, bold: true } as Run,
        { text: `\nThe alternative was: ${f.alternative}` } as Run,
        { text: `\nThe case for it: ${f.caseForAlternative}` } as Run,
      ])),
    })
  }

  // ── 4. The cost basis ──────────────────────────────────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 2, runs: text('The cost basis, figure by figure') })
  const lines: SnapshotCostLine[] = snapshot.costs?.lines ?? []
  if (lines.length) {
    blocks.push({
      kind: 'bullets',
      items: lines.map((l) => ([
        { text: `${l.label} — ${moneyRange(l.low, l.high, l.unit)}`, bold: true } as Run,
        { text: `\n${basisOf(l)}` } as Run,
        ...(l.priceYear ? [{ text: `\nPrice year: ${l.priceYear}.` } as Run] : []),
      ])),
    })
    const withoutBasis = lines.filter((l) => !l.basis?.trim() && !l.benchmarkId).length
    if (withoutBasis) {
      blocks.push({
        kind: 'note',
        text: `${withoutBasis} of ${lines.length} figures have no stated basis. They are marked above rather than left to look like the rest.`,
      })
    }
  } else {
    blocks.push({ kind: 'note', text: 'No costed lines are on record for this proposal.' })
  }
  if (snapshot.costs?.problemCost) {
    blocks.push({
      kind: 'paragraph',
      runs: [{ text: 'The problem cost this is set against: ', bold: true }, { text: snapshot.costs.problemCost }],
    })
  }

  // ── 5. What was still open when this was published ─────────────────────────
  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'heading', level: 2, runs: text('What was still open when this was published') })
  const out = snapshot.outstanding
  if (!out) {
    blocks.push({
      kind: 'note',
      text: 'This version predates the record of outstanding items, so what was open at the time was never captured.',
    })
  } else {
    // ⚠ PINNED, AND SAID TO BE PINNED. §2b: the agenda is per-idea and continuous, a version
    // is per-artefact and frozen. A reader must understand that this is what the author knew
    // at THIS version — not a live list that has since moved on without them.
    blocks.push({
      kind: 'paragraph',
      runs: text(
        'This is the state of the work at the moment this version was made, and it does not change afterwards. '
        + 'The author may have resolved some of it since; this is what they knew was unfinished when they sent it.',
      ),
    })
    const c = out.counts
    blocks.push({
      kind: 'paragraph',
      runs: text(
        `${c.openIssues} of ${c.totalIssues} issue${c.totalIssues === 1 ? '' : 's'} open · `
        + `${c.unresolvedForks} decision${c.unresolvedForks === 1 ? '' : 's'} not settled · `
        + `${c.declaredGaps} declared gap${c.declaredGaps === 1 ? '' : 's'}.`,
      ),
    })
    if (out.openIssues?.length) {
      blocks.push({ kind: 'heading', level: 3, runs: text('Issues still open') })
      blocks.push({ kind: 'bullets', items: out.openIssues.map((i) => text(i.text)) })
    }
    if (out.unresolvedForks?.length) {
      blocks.push({ kind: 'heading', level: 3, runs: text('Decisions not yet settled') })
      blocks.push({
        kind: 'bullets',
        items: out.unresolvedForks.map((f) => ([
          { text: f.chosen, bold: true } as Run,
          { text: ` — or — ${f.alternative}` } as Run,
        ])),
      })
    }
    if (out.declaredGaps?.length) {
      blocks.push({ kind: 'heading', level: 3, runs: text('Gaps the research could not close') })
      blocks.push({
        kind: 'bullets',
        items: out.declaredGaps.map((g) => ([
          { text: g.question, bold: true } as Run,
          ...(g.why?.trim() ? [{ text: `\n${g.why.trim()}` } as Run] : []),
        ])),
      })
    }
    if (out.unsupportedFields?.length) {
      blocks.push({ kind: 'heading', level: 3, runs: text('Settled, with nothing in the record behind it') })
      blocks.push({ kind: 'bullets', items: out.unsupportedFields.map((f) => text(f)) })
    }
    if (!out.openIssues?.length && !out.unresolvedForks?.length
      && !out.declaredGaps?.length && !out.unsupportedFields?.length) {
      blocks.push({ kind: 'note', text: 'Nothing was outstanding at this version.' })
    }
  }

  const sourceCount = (snapshot.sources ?? []).reduce((n, g) => n + g.refs.length, 0)
  const sourceLabel = [
    'the stored proposal state',
    `${(snapshot.evidence ?? []).length} accepted finding${(snapshot.evidence ?? []).length === 1 ? '' : 's'}`,
    `${sourceCount} corpus source${sourceCount === 1 ? '' : 's'}`,
    `${excluded.length} set aside`,
    `${lines.length} costed line${lines.length === 1 ? '' : 's'}`,
  ].join(', ')

  const model: DocumentModel = {
    title: `Evidence Pack — ${snapshot.title}`,
    subtitle: 'Every source, every basis, everything set aside, and everything still open',
    sourceLabel,
    generatedAt: new Date(),
    blocks,
  }

  return {
    model,
    // The same fingerprint discipline as the Proposal: sha-256 over exactly the snapshot
    // that was rendered, so a file can be told apart from the state it claims to be of.
    fingerprint: snapshotHash(snapshot),
    sourceLabel,
  }
}

/** A stable id for a rendered pack, used where a fingerprint is wanted without the snapshot. */
export function evidencePackFingerprint(model: DocumentModel): string {
  return createHash('sha256').update(JSON.stringify(model.blocks)).digest('hex')
}
