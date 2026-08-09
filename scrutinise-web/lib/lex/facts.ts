// ─────────────────────────────────────────────────────────────────────────────
// The never-claim invariant (§19-C Task 1b — extends the 3-B §12 rules).
//
// Lex has twice asserted things that were not true, in the same shape both times:
//   · "You'll find an initial overview of the current data protection law in the
//     legislation panel on the right" — the panel held road-traffic stub fixtures
//     Lex had never looked at.
//   · "I've pulled some options together" — said before a single PolicyOption row
//     existed.
// Both are the same defect: the model describing the WORLD from its own expectations
// instead of from state. Prompt scolding does not fix that; giving it the facts does.
//
// So every turn now carries a FACTS OF THIS TURN block — what is actually persisted,
// what the panel actually contains, what searches actually ran and what they actually
// returned — and the prompt confines Lex's claims to it.
//
// // Mechanism, not vibes: if Lex can only see the facts, it can only state the facts.
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalState, SearchResult, SearchResultType } from './page1-config'
import type { StageSearchRecord, ResearchRecord } from './stage-search'
import { interleaveStreams } from './interleave'

/** How many references the facts block names. Unchanged at 8 — what changed is WHICH 8. */
const FACTS_LIST_CAP = 8

/** Partition a stored (grouped) result list into one bucket per display type, in first-appearance
 *  order, so interleaveStreams can sample across the buckets instead of taking a prefix. */
function byType(results: SearchResult[]): SearchResult[][] {
  const buckets = new Map<SearchResultType, SearchResult[]>()
  for (const r of results) {
    const arr = buckets.get(r.type) ?? []
    arr.push(r)
    buckets.set(r.type, arr)
  }
  return [...buckets.values()]
}

export interface TurnFacts {
  /** The active page and the field the platform says is current. */
  state: CanonicalState
  /** A search that ran as part of THIS turn (stage entry, refresh, or ad-hoc). */
  search?: StageSearchRecord | ResearchRecord | null
  /** Child records written in this turn, e.g. "3 policy options". */
  wrote?: string[]
  /** A generation that was attempted and FAILED this turn (§19-C Tasks 4/5). */
  generationFailed?: string | null
}

function panelSummary(state: CanonicalState): string[] {
  const lines: string[] = []
  const active = state.pages.find((p) => p.key === state.stage)
  if (active) {
    const done = active.fields.filter((f) => f.status === 'ACCEPTED' || f.status === 'SKIPPED').length
    lines.push(`Middle panel — "${active.label}": ${done} of ${active.fields.length} boxes settled.`)
    const awaiting = active.fields.filter((f) => f.status === 'AWAITING_CONFIRMATION')
    if (awaiting.length) lines.push(`  Awaiting the user's Save: ${awaiting.map((f) => f.label).join(', ')}.`)
  }
  lines.push(
    `Records that exist right now: ${state.diagnosisCauses.length} cause(s), ` +
    `${state.policyOptions.length} policy option(s), ${state.actions.length} action(s).`,
  )
  return lines
}

function searchSummary(search: TurnFacts['search']): string[] {
  if (!search) {
    return ['No corpus search ran in this turn. You have NOT looked anything up; do not imply you have.']
  }
  if (!search.ok) {
    return [
      'A corpus search was attempted in this turn and DID NOT COMPLETE. There are no results.',
      'Say so plainly if it is relevant. Do not describe, summarise or hint at any content.',
      'Never point the user at the panel as though something were waiting there.',
    ]
  }
  if (!search.results.length) {
    return ['A corpus search ran in this turn and returned NOTHING. Say that it found nothing — not that it failed, and not that results are in the panel.']
  }
  const lines = [`A corpus search ran in this turn and returned ${search.results.length} reference(s), now in the right-hand panel:`]
  // ⚠ NOT `.slice(0, 8)`. These records store `grouped`, which groupForPanel returns as TYPE
  // BLOCKS concatenated (≤3 per type) — so a plain prefix of 8 covers barely three blocks and
  // the later types never reach Lex at all. It is the same failure as the routed
  // `perStream.flat()` slice (lib/lex/interleave.ts), one layer down and inside the system
  // prompt: Lex is told these titles are "the ONLY things you may say were found", so a type
  // missing here is a type Lex must deny having found. Sampling across the blocks costs nothing
  // and removes the class.
  // floor 1, not the default 2: this is a list of titles, not answer context, so one committee
  // report named beats none named. The reason the default exists is stated in interleave.ts.
  const shown = interleaveStreams(byType(search.results), FACTS_LIST_CAP, { floor: 1, label: 'facts' })
  for (const r of shown) {
    lines.push(`  - ${r.citation || r.title} (${r.type.toLowerCase().replace(/_/g, ' ')})`)
  }
  if (search.results.length > shown.length) lines.push(`  … and ${search.results.length - shown.length} more.`)
  lines.push('These titles are the ONLY things you may say were found.')
  return lines
}

/** Render the block injected into the system prompt for this turn. */
export function buildFactsBlock(facts: TurnFacts): string {
  const { state } = facts
  const lines = [
    'FACTS OF THIS TURN — the state of the platform right now, as recorded by the server.',
    'Everything you assert about what exists, what was written, what the panels show, or what was',
    'found must come from this list. If something is not here, it did not happen: say so, or say',
    'nothing about it. Never tell the user to look at something you cannot see here.',
    '',
    `Current section: ${state.pages.find((p) => p.key === state.stage)?.label ?? state.stage}.`,
    `Current box: ${state.currentField ? `${state.currentField.key} (${state.currentField.status})` : 'none — this section is complete'}.`,
    ...panelSummary(state),
  ]

  if (facts.wrote?.length) {
    lines.push(`Written to the database in this turn: ${facts.wrote.join('; ')}.`)
  }

  lines.push('', ...searchSummary(facts.search ?? null))

  if (facts.generationFailed) {
    lines.push(
      '',
      `A draft of "${facts.generationFailed}" was attempted this turn and FAILED to generate.`,
      'Tell the user plainly that you could not draft it and offer to try again. Do NOT invent',
      'placeholder text, and do NOT pretend a draft is waiting in the panel.',
    )
  }

  return lines.join('\n')
}
