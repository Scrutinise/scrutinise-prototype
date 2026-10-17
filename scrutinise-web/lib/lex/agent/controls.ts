// 26-P §6b — THE ONE CONTROLS SOURCE THE AGENT READS.
//
// ⚠⚠ IT IS VERIFIED AGAINST THE UI, NOT GENERATED FROM IT, AND THE DIFFERENCE IS STATED (LEX_26P_REPORT §5).
// The labels live as string literals in ~40 components, so a generator would need a UI-side registry
// (`<Control id label>`) — a refactor across the components, not in this brief. What this file does
// instead: each entry names the component `file` that renders `label` VERBATIM, and `check:lex-26p`
// asserts (1) the label is in that file and (2) that file has an importer reaching a route
// (CLAUDE.md §23.1). So a label renamed in the UI fails a check, and a label here that is on no screen
// fails one too. ⚠ That is the guard against a repeat of "Redraft from what I found" — a control Lex
// named from hand-kept copy that was on no screen.
//
// ⚠ ADDING AN ENTRY FOR A CONTROL THAT DOES NOT EXIST would turn this from a map into a fabrication. Add
// the label to the component FIRST.

import { LEX_STAGES } from '../stages'
import { PRODUCT_FACTS } from '../product-facts'
import { PAGE_SEQUENCE } from '../page1-config'

export interface Control {
  /** Exactly what the screen prints. */
  label: string
  /** Repo-relative path of a component that contains `label` verbatim. */
  file: string
  /** Where it is, in the product's own vocabulary. */
  where: string
  /** What pressing it does — one clause. */
  does: string
  /** 26-S2 §3d — the Coherent Actions step(s) this control belongs to. Lex names a control from another step only with “that is in step N”. */
  steps?: Array<1 | 2 | 3 | 4>
}

export const CONTROLS: readonly Control[] = [
  { label: 'Add research', file: 'components/lex/AddResearch.tsx', where: 'the “+” just above the box you type in, on every stage', does: 'adds a file, a link, pasted text of any length, a quote or just a thought to the research notebook, with its source — and I read it' },
  { label: 'Give feedback on Lex', file: 'components/lex/ChatPanel.tsx', where: 'beneath the chat, above the box you type in', does: 'opens a dialogue to pass a problem back to the Scrutinise team, showing exactly what would be sent first' },
  { label: 'prior chat', file: 'components/lex/ChatPanel.tsx', where: 'the strip at the top of the chat', does: 'shows the earlier conversation, which is hidden when the chat opens' },
  { label: 'Add to report', file: 'components/lex/QuestionPanel.tsx', where: 'on a source in THE RESEARCH', does: 'marks it as one of the sources the proposal itself rests on, so it appears in DRAFT STRATEGY' },
  { label: 'Remove from report', file: 'components/lex/QuestionPanel.tsx', where: 'on the same card, once a source has been added', does: 'takes the source back out of DRAFT STRATEGY' },
  { label: 'Check for gaps', file: 'components/lex/ActionGapCheck.tsx', where: 'the actions section', does: 'runs the gap check on the coherent actions', steps: [1] },
  { label: 'Import actions from a document', file: 'components/lex/ActionImport.tsx', where: 'the actions section, beside “Check for gaps”', does: 'reads a document you have filed and shows a table of every idea in it — what is new, what adds to an action you already have, what belongs to the policy — for you to change and confirm before anything is added', steps: [1] },
  { label: 'Consolidate', file: 'components/lex/GuidingPolicyScreen.tsx', where: 'the guiding-policy screen', does: 'drafts the guiding policy from the candidates marked as part of the solution' },
  { label: 'Rule out', file: 'components/lex/FieldsPanel.tsx', where: 'on a candidate approach', does: 'rules the candidate out, with a reason; it can be restored' },
  { label: 'Add approach', file: 'components/lex/FieldsPanel.tsx', where: 'beneath the candidate approaches', does: 'adds an approach of your own as a candidate' },
  { label: 'Skip', file: 'components/lex/FieldsPanel.tsx', where: 'on a field that is waiting for you', does: 'leaves the field unfilled for now' },
  { label: 'Accept', file: 'components/lex/ActionGapCheck.tsx', where: 'on a proposal', does: 'accepts the proposal into your idea' },
  { label: 'Dismiss', file: 'components/lex/ActionGapCheck.tsx', where: 'on a proposal', does: 'dismisses the proposal' },
  // 26-Q — the coherent-actions workspace (components/lex/ActionsWorkspace.tsx). Each label is printed there verbatim.
  { label: 'Title these for me', file: 'components/lex/ActionsWorkspace.tsx', where: 'the toolbar above the list of coherent actions', does: 'has me draft a short title for every untitled action, as proposals you accept or edit', steps: [1] },
  { label: 'Classify with Lex', file: 'components/lex/ActionsWorkspace.tsx', where: 'the same toolbar', does: 'has me propose, for every action that has none, the facets of the step you are in — step 1 the causes it attacks and its avenue, step 4 its sequence and what it comes before; in steps 2 and 3 it proposes nothing — all proposals you can correct', steps: [1, 4] },
  { label: 'Find duplicates', file: 'components/lex/ActionsWorkspace.tsx', where: 'the same toolbar', does: 'lists the pairs of actions that read as near-duplicates, closest first, with a Merge? button beside each', steps: [1] },
  { label: 'Suggest headings from my guiding policy', file: 'components/lex/ActionsWorkspace.tsx', where: 'the same toolbar', does: 'offers starting headings drawn from your settled guiding policy, which you can add, rename or ignore', steps: [1] },
  { label: 'Add heading', file: 'components/lex/ActionsWorkspace.tsx', where: 'the same toolbar', does: 'creates a heading of your own to sort actions under', steps: [1] },
  { label: 'Coverage grid', file: 'components/lex/ActionsWorkspace.tsx', where: 'a view tab above the list of actions', does: 'shows causes against actions, so a cause with no action against it is an empty row', steps: [1] },
  { label: 'Later phase', file: 'components/lex/ActionsWorkspace.tsx', where: 'on an open action, and in the bulk bar', does: 'parks an action under a collapsed Later phase header; it stays yours and can be brought back', steps: [1] },
  { label: 'Ask Lex to review and merge', file: 'components/lex/ActionsWorkspace.tsx', where: 'the bulk bar, with exactly two actions selected', does: 'asks me how the two relate and merges them if they are one thing; the originals are kept', steps: [1] },
  { label: 'Compare', file: 'components/lex/ActionsWorkspace.tsx', where: 'the bulk bar, with exactly two actions selected', does: 'shows the two side by side with my verdict on how they relate, and changes nothing', steps: [1] },
  // 26-S2 §3 — the step bar (components/lex/ActionsSteps.tsx prints the labels from lib/lex/action-steps.ts) and what belongs to each step.
  { label: 'Sort and prune', file: 'lib/lex/action-steps.ts', where: 'step 1 on the step bar at the top of the Coherent Actions section', does: 'moves to step 1: titles, headings, causes, avenue, the policy verdict, merging duplicates, ruling out, the gap check and the import — the screen then shows only step 1’s tools', steps: [1] },
  { label: 'Who, how and against', file: 'lib/lex/action-steps.ts', where: 'step 2 on the same step bar', does: 'moves to step 2: who implements each action — the screen then shows only step 2’s tools', steps: [2] },
  { label: 'Costs', file: 'lib/lex/action-steps.ts', where: 'step 3 on the same step bar', does: 'moves to step 3: a cost range for each action — the screen then shows only step 3’s tools', steps: [3] },
  { label: 'Order', file: 'lib/lex/action-steps.ts', where: 'step 4 on the same step bar', does: 'moves to step 4: which actions come first (sequence and what comes before) — the screen then shows only step 4’s tools', steps: [4] },
  { label: 'Test against the policy', file: 'components/lex/ActionsWorkspace.tsx', where: 'the toolbar (it counts the untested actions) and on an open action that reads ? Not tested (step 1)', does: 'runs the same test the import uses — fits, does not fit, or conflicts with your Guiding Policy, with a one-line reason — on the actions that were never tested, and says what it cost; on one open action it tests it again', steps: [1] },
  { label: 'Keep it, with a note', file: 'components/lex/ActionsWorkspace.tsx', where: 'on an open action whose policy test says Conflicts (step 1)', does: 'keeps the action in the list with your reason for keeping it, so it no longer counts as waiting for a decision', steps: [1] },
  { label: 'Re-run', file: 'components/lex/RerunOptions.tsx', where: 'on THE IDEA stage, at the top of the page', does: 'opens a dialogue that says what a re-run will do and cost before anything is spent' },
]

/** The three panels, as HowItWorksModal.tsx names them. */
export const PANEL_NAMES = ['WORKING AREA', 'DRAFT STRATEGY', 'THE RESEARCH'] as const
const PANEL_FILE = 'components/lex/HowItWorksModal.tsx'

export function allControlFiles(): Array<{ label: string; file: string }> {
  return [
    ...CONTROLS.map((c) => ({ label: c.label, file: c.file })),
    ...PANEL_NAMES.map((n) => ({ label: n, file: PANEL_FILE })),
  ]
}

export const normLabel = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Every label Lex may name. Controls, panels, stage names, and the field labels the screen prints.
 * ⚠ Derived from the same constants the UI imports (`LEX_STAGES`, `PAGE_SEQUENCE`) wherever the UI
 * imports them — so for those, it IS generated from what the screen uses.
 */
export function knownLabels(): Set<string> {
  const out = new Set<string>()
  for (const c of CONTROLS) out.add(normLabel(c.label))
  for (const p of PANEL_NAMES) out.add(normLabel(p))
  for (const s of LEX_STAGES) { out.add(normLabel(s.name)); out.add(normLabel(`stage ${s.n}`)) }
  for (const page of PAGE_SEQUENCE) {
    if ((page as { label?: string }).label) out.add(normLabel((page as { label?: string }).label!))
    for (const f of page.fields) if (f.label) out.add(normLabel(f.label))
  }
  // Names quoted inside PRODUCT_FACTS answers ("What you have put in the report", "Remove from report", …).
  for (const f of PRODUCT_FACTS) {
    for (const m of f.answer.matchAll(/[“"]([^”"]{3,60})[”"]/g)) out.add(normLabel(m[1]))
  }
  return out
}

/** `explain(topic)` — the product facts and controls that match, and ONLY those. */
export function explainTopic(topic: string): { facts: Array<{ question: string; answer: string }>; controls: Control[] } {
  const words = normLabel(topic).split(' ').filter((w) => w.length > 2)
  if (!words.length) return { facts: [], controls: [] }
  const hit = (text: string) => {
    const t = normLabel(text)
    return words.filter((w) => t.includes(w)).length >= Math.min(2, words.length)
  }
  return {
    facts: PRODUCT_FACTS.filter((f) => hit(`${f.question} ${f.answer}`)),
    controls: CONTROLS.filter((c) => hit(`${c.label} ${c.where} ${c.does}`)),
  }
}
