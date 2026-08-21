// ─────────────────────────────────────────────────────────────────────────────
// 25-D §3 / §25.5 — THE RIGHT-HAND PANEL, ASSEMBLED BY QUESTION.
//
// ⚠ THIS IS A REORGANISATION OF MATERIAL THAT ALREADY EXISTS, NOT A NEW PANEL. Everything
// here is a row somebody else wrote: EvidenceItem (the build's questions, the Deepening's
// passes, the jobs, the user's documents), DeepeningPass (whether a question ran at all),
// IdeaSourceDecision (what the user set aside). There is NO MODEL CALL in this file and
// there must never be one — the same rule the agenda is held to, for the same reason: a
// panel that re-summarised the findings would be another opinion about them, billed on
// every page load.
//
// ⚠⚠ THE HARD PART IS THE EMPTY HEADINGS, NOT THE FULL ONES.
//
// A heading with nothing under it renders as a STATED GAP. And there are three different
// reasons it can be empty, which must never share a sentence:
//
//   `asked-found-nothing`  the question ran and the corpus returned nothing we could use
//   `not-asked`            it did not fire on this draft (devolution on a reserved matter)
//   `no-producer`          nothing in this build can answer it — OUR gap, not the record's
//
// Collapsing those three into "nothing found" would tell a user the voting record holds
// nothing about their subject, when the truth is that Lex cannot read the voting record.
// That is a false statement about the world, made to cover a gap in our tooling, and it is
// the failure this whole section exists to prevent.
//
// ⚠ AND EVERY ENTRY CARRIES ITS OWN REASON LINE, OR SAYS IT HAS NONE. The reason is the
// sift's — written as "what this bears on and how" — and it is never generated here. A
// finding whose sift reason is null (every row written before the sift existed) is shown
// WITH that fact attached rather than with a plausible sentence invented for it.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { evidenceLabel, isAssembled } from './evidence-labels'
import { resolveHeading, isUserMaterialPass } from './heading-map'
import {
  QUESTION_HEADINGS, HEADING_ORDER, HEADINGS_WITH_NO_PRODUCER, statedGap,
  type EmptyReason, type HeadingKey,
} from './question-headings'
import { INTERROGATION_LIBRARY } from './interrogation-library'

export interface PanelEntry {
  id: string
  title: string
  citation: string | null
  url: string | null
  /** The badge — assembled record vs a model's reading of one document. */
  label: string
  /**
   * §3 rule 2 — ONE SENTENCE ON WHY THIS MATTERS. The sift's own reason, verbatim. Null
   * where none was recorded, and the UI says so rather than filling it in.
   */
  why: string | null
  /** TRUE when this is the user's own document or link (§25.6), not corpus material. */
  yourSource: boolean
  /** Deterministically assembled by us, rather than a model's reading. */
  assembled: boolean
  /** The field this bears on — `challenge`, `causes:<id>`, `actions:<id>`, or null. */
  fieldRef: string | null
  /** §3 rule 3 — TRUE when it bears on what the user is looking at right now. */
  bearsOnFocus: boolean
  /** The user excluded this source. It stays visible, marked, with its reason. */
  excluded: boolean
  exclusionReason: string | null
}

export interface PanelHeading {
  key: HeadingKey
  heading: string
  entries: PanelEntry[]
  /** Null when the heading has entries. Otherwise the stated gap, with its reason typed. */
  gap: { reason: EmptyReason; text: string } | null
  /** Which of this heading's questions actually ran, for the honest version of "we looked". */
  questionsRun: string[]
  /** Questions filed here that did not fire on this draft. */
  questionsNotRun: string[]
}

export interface QuestionPanel {
  ideaId: string
  headings: PanelHeading[]
  /** How many entries bear on what the user is currently reading. */
  focusCount: number
  focusFieldRef: string | null
  /** Every entry, in one flat list — what the collapsed full source list underneath renders. */
  totalEntries: number
  /**
   * ⚠ NAMED, NOT DROPPED. Evidence rows that resolve to no heading at all. §3: "a source
   * with no heading is a gap in the library, not a source to drop." The panel shows these
   * under an explicit "not filed" note rather than hiding them, and the count is here so a
   * report can state it.
   */
  unfiled: PanelEntry[]
}

/**
 * The panel for one idea.
 *
 * `focusFieldRef` is what the user is reading — §3 rule 3, "reading the diagnosis shows
 * the diagnosis's evidence". It ORDERS AND MARKS; it never filters. Hiding the rest would
 * mean a finding that contradicts the diagnosis becomes invisible the moment the user
 * moves to the next page, which is the opposite of what it is for.
 */
export async function buildQuestionPanel(
  ideaId: string, opts: { focusFieldRef?: string | null } = {},
): Promise<QuestionPanel> {
  const focus = opts.focusFieldRef?.trim() || null

  const [evidence, passRows, decisions, material] = await Promise.all([
    prisma.evidenceItem.findMany({
      where: { ideaId, status: { not: 'REJECTED' } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.deepeningPass.findMany({ where: { ideaId } }),
    prisma.ideaSourceDecision.findMany({ where: { ideaId } }),
    // ⚠ §25.6 — THE DOCUMENTS THEMSELVES, not their findings. The findings are EvidenceItem
    // rows filed under whichever question they answer (§4: "under the question they answer,
    // alongside corpus material"). "Your material" is where the user finds the DOCUMENT —
    // what they attached, whether it was read, and what it produced. Two different things
    // that a single list would confuse.
    //
    // ⚠ `text` IS NOT SELECTED. The panel never renders a document body, and putting fifty
    // pages on the wire for a heading that shows a filename is how a poll becomes expensive.
    prisma.ideaUserMaterial.findMany({
      where: { ideaId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, kind: true, label: true, url: true, status: true,
        charCount: true, findingsAt: true, findingCount: true, failureReason: true,
      },
    }),
  ])

  // ⚠ Keyed on BOTH the corpus source id and the evidence row id. A user excludes a SOURCE
  // in the panel, and the panel's rows are findings ABOUT sources — so the decision has to
  // find its row by whichever id the surface that made it was holding.
  const excluded = new Map<string, string | null>()
  for (const d of decisions) {
    if (d.status === 'EXCLUDED') excluded.set(d.sourceKey, d.reason)
  }

  const toEntry = (e: (typeof evidence)[number]): PanelEntry => {
    const exclusionKey = [e.sourceId, e.id].find((k) => k && excluded.has(k))
    return {
      id: e.id,
      title: e.title,
      citation: e.citation,
      url: e.url,
      label: evidenceLabel(e.kind, e.sourceType),
      // ⚠ VERBATIM OR NULL. Never a fallback sentence — see the header.
      why: e.siftReason?.trim() || null,
      yourSource: isUserMaterialPass(e.passKey),
      assembled: isAssembled(e.sourceType),
      fieldRef: e.fieldRef,
      bearsOnFocus: !!focus && e.fieldRef === focus,
      excluded: !!exclusionKey,
      exclusionReason: exclusionKey ? excluded.get(exclusionKey) ?? null : null,
    }
  }

  const byHeading = new Map<HeadingKey, PanelEntry[]>()
  const unfiled: PanelEntry[] = []
  for (const e of evidence) {
    const key = resolveHeading(e)
    if (!key) { unfiled.push(toEntry(e)); continue }
    const list = byHeading.get(key) ?? []
    list.push(toEntry(e))
    byHeading.set(key, list)
  }

  // Which questions ran. `build-research.ts` writes one DeepeningPass row per question id,
  // so this is a fact about the run rather than an inference from what it found.
  const ranKeys = new Set(passRows.filter((p) => p.status === 'RUN' || p.status === 'FAILED').map((p) => p.passKey))

  // §25.6 — the documents, under "Your material". Each one says what it produced, because
  // a document stored and never read must not look like one that was read and had nothing
  // to say (CLAUDE.md §18: a degradation announces itself).
  for (const m of material) {
    const list = byHeading.get('YOUR_MATERIAL') ?? []
    list.push({
      id: m.id,
      title: m.label,
      citation: m.kind === 'LINK' ? 'Your link' : 'Your document',
      url: m.url,
      label: m.kind === 'LINK' ? 'Your own source — a link' : 'Your own source — a document',
      why: m.status === 'FAILED'
        ? (m.failureReason ?? 'This could not be read.')
        : m.findingsAt === null
          ? 'Stored, and not yet read into findings.'
          : m.findingCount > 0
            ? `Read — ${m.findingCount} finding${m.findingCount === 1 ? '' : 's'}, filed under the questions they answer.`
            : 'Read, and nothing in it bore on the proposal.',
      yourSource: true,
      assembled: false,
      fieldRef: null,
      bearsOnFocus: false,
      excluded: false,
      exclusionReason: null,
    })
    byHeading.set('YOUR_MATERIAL', list)
  }

  const headings: PanelHeading[] = HEADING_ORDER.map((key) => {
    const def = QUESTION_HEADINGS.find((h) => h.key === key)!
    const mine = INTERROGATION_LIBRARY.filter((q) => q.heading === key)
    const questionsRun = mine.filter((q) => ranKeys.has(q.id)).map((q) => q.panelHeading)
    const questionsNotRun = mine.filter((q) => !ranKeys.has(q.id)).map((q) => q.panelHeading)

    const entries = (byHeading.get(key) ?? []).slice().sort((a, b) => {
      // What the user is reading leads. Then contradictions and assembled records, which
      // are worth more of their time than a model's reading of one document.
      if (a.bearsOnFocus !== b.bearsOnFocus) return a.bearsOnFocus ? -1 : 1
      if (a.excluded !== b.excluded) return a.excluded ? 1 : -1
      if (a.assembled !== b.assembled) return a.assembled ? -1 : 1
      return 0
    })

    let gap: PanelHeading['gap'] = null
    if (!entries.length) {
      // ⚠ THE ORDER OF THESE TESTS IS THE HONESTY. `no-producer` is checked FIRST, because a
      // heading nothing can answer must never be reported as a search that found nothing —
      // that would blame the record for a gap in our tooling. `nothing-added` next, because
      // "you haven't added anything" is not a failure of any kind. Only then does the
      // question of whether we looked, and what we found, arise.
      const reason: EmptyReason = HEADINGS_WITH_NO_PRODUCER.includes(key)
        ? 'no-producer'
        : key === 'YOUR_MATERIAL'
          ? 'nothing-added'
          : questionsRun.length
            ? 'asked-found-nothing'
            : 'not-asked'
      gap = { reason, text: statedGap(key, reason) }
    }

    return { key, heading: def.heading, entries, gap, questionsRun, questionsNotRun }
  })

  const all = headings.flatMap((h) => h.entries)
  return {
    ideaId,
    headings,
    focusFieldRef: focus,
    focusCount: all.filter((e) => e.bearsOnFocus).length,
    totalEntries: all.length + unfiled.length,
    unfiled,
  }
}

/**
 * ⚠ THE MAPPING REPORT THE BRIEF ASKS FOR, COMPUTED RATHER THAN WRITTEN DOWN.
 *
 * §3: "report what you mapped and anything that had no home, because a source with no
 * heading is a gap in the library, not a source to drop." A prose list in a report would
 * be true on the day it was written; this is true whenever it is run, which is what makes
 * it worth having when somebody adds the eleventh question.
 */
export function headingCoverage(): Array<{
  key: HeadingKey
  heading: string
  questions: string[]
  producer: 'interrogation question' | 'deepening pass or job' | 'this sprint' | 'NONE'
}> {
  return QUESTION_HEADINGS.map((h) => {
    const questions = INTERROGATION_LIBRARY.filter((q) => q.heading === h.key).map((q) => q.panelHeading)
    const producer = questions.length
      ? 'interrogation question' as const
      : HEADINGS_WITH_NO_PRODUCER.includes(h.key)
        ? 'NONE' as const
        : h.key === 'YOUR_MATERIAL'
          ? 'this sprint' as const
          : 'deepening pass or job' as const
    return { key: h.key, heading: h.heading, questions, producer }
  })
}
