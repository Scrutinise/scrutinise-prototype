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
import { LIFECYCLE_STAGE_WORD, CHECKLIST_WORD, DRAFTING_FILTER_WORD, PROGRESS_WORD, ORGANISING_TOOLBAR_UI, ADD_ACTION_UI } from '../screen-labels'
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
  /** 26-X 308 (was 26-S2's four steps) — the Coherent Actions PAGE this control is on. Lex names a control on the other page only as
   *  “that is on the Organising page” (or Drafting), and says how to get there. */
  page?: 'Organising' | 'Drafting'
}

export const CONTROLS: readonly Control[] = [
  { label: 'Add research', file: 'components/lex/AddResearch.tsx', where: 'the “+” just above the box you type in, on every stage', does: 'adds a file, a link, pasted text of any length, a quote or just a thought to the research notebook, with its source — and I read it' },
  { label: 'Give feedback on Lex', file: 'components/lex/ChatPanel.tsx', where: 'beneath the chat, above the box you type in', does: 'opens a dialogue to pass a problem back to the Scrutinise team, showing exactly what would be sent first' },
  { label: 'prior chat', file: 'components/lex/ChatPanel.tsx', where: 'the strip at the top of the chat', does: 'shows the earlier conversation, which is hidden when the chat opens' },
  { label: 'Add to report', file: 'components/lex/QuestionPanel.tsx', where: 'on a source in THE RESEARCH', does: 'marks it as one of the sources the proposal itself rests on, so it appears in DRAFT STRATEGY' },
  { label: 'Remove from report', file: 'components/lex/QuestionPanel.tsx', where: 'on the same card, once a source has been added', does: 'takes the source back out of DRAFT STRATEGY' },
  // 26-X addendum 321: both are on the Organising toolbar's rows now; each component prints its words through ORGANISING_TOOLBAR_UI (screen-labels.ts)
  { label: 'Check for gaps', file: 'components/lex/ActionGapCheck.tsx', where: 'the Organising toolbar, the “Lex and checks” row', does: 'runs the gap check on the coherent actions: a free read, then four models; the suggestions open beneath the row, each to accept or dismiss', page: 'Organising' },
  { label: 'Import actions from a document', file: 'components/lex/ActionImport.tsx', where: 'the Organising toolbar, the “Add” row', does: 'reads a document you have filed and shows a table of every idea in it — what is new, what adds to an action you already have, what belongs to the policy — for you to change and confirm before anything is added', page: 'Organising' },
  { label: 'Consolidate', file: 'components/lex/GuidingPolicyScreen.tsx', where: 'the guiding-policy screen', does: 'drafts the guiding policy from the candidates marked as part of the solution' },
  { label: 'Rule out', file: 'components/lex/FieldsPanel.tsx', where: 'on a candidate approach', does: 'rules the candidate out, with a reason; it can be restored' },
  { label: 'Add approach', file: 'components/lex/FieldsPanel.tsx', where: 'beneath the candidate approaches', does: 'adds an approach of your own as a candidate' },
  { label: 'Skip', file: 'components/lex/FieldsPanel.tsx', where: 'on a field that is waiting for you', does: 'leaves the field unfilled for now' },
  { label: 'Accept', file: 'components/lex/ActionGapCheck.tsx', where: 'on a proposal', does: 'accepts the proposal into your idea' },
  { label: 'Dismiss', file: 'components/lex/ActionGapCheck.tsx', where: 'on a proposal', does: 'dismisses the proposal' },
  // 26-Q — the coherent-actions workspace (components/lex/ActionsWorkspace.tsx). Each label is printed there verbatim.
  // 26-X addendum 321–323 — the three toolbar rows (View · Add · Lex and checks), "Add action", and the title proposals, from screen-labels.ts
  { label: 'Title them with Lex', file: 'components/lex/ActionsWorkspace.tsx', where: 'the Organising toolbar’s “Lex and checks” row, reading “N actions have no title · Title them with Lex” with its price', does: 'has me propose a short title for each action with no title and no proposal waiting; pressing it also shows the Untitled filter, and each proposal waits on its row under the statement — “Lex proposes: … — Accept · Not this”. A title you wrote is never replaced', page: 'Organising' },
  { label: 'Accept all N proposed titles', file: 'components/lex/ActionsWorkspace.tsx', where: 'beside “Title them with Lex”, only while proposals wait', does: 'accepts every waiting title proposal at once; a row you have titled since keeps your title', page: 'Organising' },
  { label: 'Not this', file: 'components/lex/ActionsWorkspace.tsx', where: 'on a title proposal of mine on a row', does: 'sets my proposed title aside; the action stays untitled', page: 'Organising' },
  { label: 'Untitled', file: 'components/lex/ActionsWorkspace.tsx', where: 'the “Show” filter on the toolbar’s View row', does: 'shows only the actions with no title', page: 'Organising' },
  { label: 'Add action', file: 'components/lex/ActionsWorkspace.tsx', where: 'the Organising toolbar’s “Add” row (a filled, primary button)', does: 'opens a small form — Title (required), Statement (optional, 1,000 characters), Heading (or Unsorted); the kind comes from the heading. The action is yours, lands first under its heading, and opens on the Drafting page', page: 'Organising' },
  { label: 'View', file: 'components/lex/ActionsWorkspace.tsx', where: 'the first row of the Organising toolbar', does: 'holds how the list is shown — List, Board, Coverage grid, Conditions, Group, Hide all / Show all headings, the find box and Show; nothing on it changes the actions', page: 'Organising' },
  { label: 'Lex and checks', file: 'components/lex/ActionsWorkspace.tsx', where: 'the third row of the Organising toolbar', does: 'holds the runs I make and the checks: titles, classify, duplicates, re-sort, the policy test, four models, gaps and print, each with its price where it spends', page: 'Organising' },
  { label: 'Classify with Lex', file: 'components/lex/ActionsWorkspace.tsx', where: 'the Organising toolbar', does: 'has me propose, for every action that has none, the causes it attacks and its avenue (and the conditions it delivers, where the idea has conditions). All proposals you can correct', page: 'Organising' },
  { label: 'Ask Lex', file: 'components/lex/ActionSlots.tsx', where: 'in “Who, how and against” on an open action (Drafting)', does: 'has me propose the answers for that one action (the slots with no answer of yours), each beside its slot with a one-line reason and the source where I used one', page: 'Drafting' },
  { label: 'Use it', file: 'components/lex/ActionSlots.tsx', where: 'on a proposal of mine beside an empty slot in “Who, how and against”', does: 'copies my proposed answer into the slot, marked as accepted from me', page: 'Drafting' },
  { label: 'Replace mine with this', file: 'components/lex/ActionSlots.tsx', where: 'on a proposal of mine beside an answer YOU wrote in “Who, how and against”', does: 'is the only way my proposal replaces your answer; it is a deliberate choice, never automatic', page: 'Drafting' },
  { label: 'Find duplicates', file: 'components/lex/ActionsWorkspace.tsx', where: 'the same toolbar', does: 'lists the pairs of actions that read as near-duplicates, closest first, with a Merge? button beside each', page: 'Organising' },
  { label: 'Suggest headings from my guiding policy', file: 'components/lex/ActionsWorkspace.tsx', where: 'the same toolbar', does: 'offers starting headings drawn from your settled guiding policy, which you can add, rename or ignore', page: 'Organising' },
  { label: 'Add heading', file: 'components/lex/ActionsWorkspace.tsx', where: 'the Organising toolbar’s “Add” row (a filled, primary button)', does: 'opens a box for the name, then creates a heading of your own to sort actions under', page: 'Organising' },
  { label: 'Coverage grid', file: 'components/lex/ActionsWorkspace.tsx', where: 'a view tab above the list of actions', does: 'shows causes against actions, so a cause with no action against it is an empty row', page: 'Organising' },
  { label: 'Later phase', file: 'components/lex/ActionsWorkspace.tsx', where: 'on an open action, and in the bulk bar', does: 'parks an action under a collapsed Later phase header; it stays yours and can be brought back', page: 'Organising' },
  { label: 'Ask Lex to review and merge', file: 'components/lex/ActionsWorkspace.tsx', where: 'the bulk bar, with exactly two actions selected', does: 'asks me how the two relate and merges them if they are one thing; the originals are kept', page: 'Organising' },
  { label: 'Consolidate this heading', file: 'components/lex/ActionsWorkspace.tsx', where: 'on a heading’s own row (Organising), once the heading holds two or more actions — shown or hidden', does: 'asks first, then has me read the actions under that heading and sort out two things: parts of a bigger action are tucked into that action’s Commentary, quoted word for word with their number, and two actions saying the same thing are joined into one with both originals kept; nothing is deleted, “Restore” puts any of them back as its own row, and “Undo this consolidation” reverses the whole pass', page: 'Organising' },
  { label: 'Compare', file: 'components/lex/ActionsWorkspace.tsx', where: 'the bulk bar, with exactly two actions selected', does: 'shows the two side by side with my verdict on how they relate, and changes nothing', page: 'Organising' },
  // 26-X 308/318 — the two pages over the one action list (the four-step bar is gone; these labels print from lib/lex/screen-labels.ts)
  { label: 'Organising', file: 'lib/lex/screen-labels.ts', where: 'the page bar at the top of the Coherent Actions section, and line 4 of the Development checklist', does: 'shows the list with its organising tools only: headings, classify, duplicates, the policy test, rule out, Later phase, the views and the find box — each row with its progress strip, and no drafting control', page: 'Organising' },
  { label: 'Drafting', file: 'lib/lex/screen-labels.ts', where: 'the same page bar, and line 5 of the Development checklist', does: 'shows the same list with each action’s progress (Defined, Briefed, Drafted, Reviewed, Accepted), filters by where each stands, and opens an action’s record with its drafts at the top', page: 'Drafting' },
  { label: 'Open', file: 'lib/lex/screen-labels.ts', where: 'on each row of the Organising page (the title does the same)', does: 'goes to the Drafting page with that action open', page: 'Organising' },
  { label: '← Back to Organising', file: 'lib/lex/screen-labels.ts', where: 'at the top of an action opened on the Drafting page', does: 'returns to the Organising page at the same place, with the same filters', page: 'Drafting' },
  { label: 'Needs no draft, because…', file: 'lib/lex/screen-labels.ts', where: 'at the top of an action’s drafts, on the Drafting page', does: 'records, with your reason, that this action needs no draft; it then counts as done for the Deepening', page: 'Drafting' },
  { label: 'Deepen now', file: 'lib/lex/screen-labels.ts', where: 'on the Deepening’s page while it is locked (the owner only)', does: 'opens the Deepening before every action is drafted, with your reason; the reason is printed on everything the Deepening produces' },
  { label: 'Test against the policy', file: 'components/lex/ActionsWorkspace.tsx', where: 'the Organising toolbar’s “Lex and checks” row (“Test against the policy (N untested)”; pressing it shows the Unreviewed filter) and on an open action that reads ? Not tested', does: 'runs the same test the import uses — fits, does not fit, or conflicts with your Guiding Policy, with a one-line reason — on the actions that were never tested, and says what it cost; on one open action it tests it again', page: 'Organising' },
  { label: 'Keep it, with a note', file: 'components/lex/ActionsWorkspace.tsx', where: 'on an open action whose policy test says Conflicts', does: 'keeps the action in the list with your reason for keeping it, so it no longer counts as waiting for a decision', page: 'Organising' },
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
  // 26-X — the seven lifecycle stages on the bar, the Development checklist's lines and the Drafting filters are on the screen too
  for (const w of [...Object.values(LIFECYCLE_STAGE_WORD), ...Object.values(CHECKLIST_WORD), ...Object.values(DRAFTING_FILTER_WORD), ...Object.values(PROGRESS_WORD)]) out.add(normLabel(w))
  // 26-X addendum 321–323 — the toolbar's rows and the "Add action" form
  for (const w of [...Object.values(ORGANISING_TOOLBAR_UI), ...Object.values(ADD_ACTION_UI)]) out.add(normLabel(w))
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
