// ─────────────────────────────────────────────────────────────────────────────
// 26-W-b (decision 302) — THE FIELD GUIDE: what every section, field and button on the action record and the document view is for, how it
// fits, its limits, and the Lex tool that acts on it. Lex answers "what is this field for?" from here (explain_field, list_fields), never
// from general knowledge.
//
// HOW IT CANNOT DRIFT
//   · Every LABEL is read from the constant the screen renders (lib/lex/screen-labels.ts and the older tables it names) at the moment it is
//     asked — never copied. Rename a label there and the screen and the guide change together (26-X will rename labels).
//   · Each guide table is typed `Record<keyof <that label table>, GuideText>`, so a label added without a guide entry is a compile error.
//   · `check:lex-26w-b` renders the record and the document view in a real browser and fails on any label the guide does not hold.
//
// ⚠ PURE (CLAUDE.md §28). ⚠ Not in the per-turn prompt (293's cache savings): Lex reads it through two free tools.
// ─────────────────────────────────────────────────────────────────────────────

import {
  COMMON_UI, RECORD_UI, DOCUMENT_UI, DOCUMENT_TAB_WORD, INSTRUCTION_FIELD, INSTRUCTION_EDITOR, TOUCH_BLOCK, TREE_UI, TREE_FILTER_WORD,
  PROVISION_COLUMNS, PRECEDENT_COLUMNS, STATEMENT_LABEL, COMMENTARY_LABEL, FACET_WORD, WORKSPACE_UI, WORKSPACE_VIEW_WORD, NOTEBOOK_UI, shown,
} from './screen-labels'
import { EXTENTS } from './action-draft-pure'
import { RECORD_SECTIONS, type RecordSection } from './record-layout-pure'
import { SLOT_UI, DIRECTION_UI, type AnySlot, type Direction } from './action-record'
import { STEPS, COST_LINE_LABEL, type ActionsStep } from './action-steps'
import { FOLD_HEADER } from './action-resort-pure'
import { KIND_WORD, HEADING_KIND_WORD, type DocumentKind } from './action-documents-pure'

export type GuideArea = 'record' | 'document' | 'tree' | 'workspace' | 'research' | 'common'
export interface GuideText {
  /** What it is for, in one sentence. */
  purpose: string
  /** How it fits: what feeds it and what reads it. */
  fits: string
  /** Limits, where there are any. */
  limits?: string
  /** The Lex tool that does the same, or "none — <why>". */
  tool: string
}
export interface GuideEntry extends GuideText { key: string; area: GuideArea; label: string }

type Lbl = string | ((x: string) => string)
const none = (why: string) => `none — ${why}`

// ── words used by many controls ──────────────────────────────────────────────────────────────────────────────
const COMMON: Record<keyof typeof COMMON_UI, GuideText> = {
  save: { purpose: 'Saves what is in the box or form it sits beside.', fits: 'Every save is worded on screen ("Saved: …") and refused in words if it cannot be done.', tool: 'the tool for the field being saved (see that field)' },
  cancel: { purpose: 'Closes the box without saving; nothing changes.', fits: 'Beside every Save.', tool: none('nothing to do') },
  ok: { purpose: 'Dismisses a message the screen has shown.', fits: 'Messages say what was saved or why not; OK only hides the message.', tool: none('nothing is stored') },
  notNow: { purpose: 'Declines a priced offer; nothing is spent or changed.', fits: 'Beside every "Draft it" or "Review it" that costs money.', tool: none('nothing to do') },
  edit: { purpose: 'Opens the thing it sits beside for editing.', fits: 'The edit replaces the owner\'s own text; earlier versions are kept where the thing has versions.', tool: 'the tool for the field being edited (see that field)' },
  add: { purpose: 'Adds what was chosen in the control beside it.', fits: 'Used for "Add a document" and "Must come after".', tool: 'see the control it sits beside' },
  remove: { purpose: 'Removes the line it sits on (an order link).', fits: 'The action itself is untouched.', tool: 'set_action_order (on: false)' },
  dismiss: { purpose: 'Sets aside a proposal or a summary.', fits: 'A proposal set aside is kept, never deleted.', tool: 'see the proposal it sits beside' },
  accept: { purpose: 'Takes Lex\'s proposal as the owner\'s answer.', fits: 'Lex\'s proposals sit beside the owner\'s answers and change nothing until accepted.', tool: 'see the proposal it sits beside' },
  clear: { purpose: 'Empties the answer it sits beside.', fits: 'Used on "No cost, because".', tool: 'set_no_cost_reason (reason: null)' },
  draftIt: { purpose: 'Confirms a priced draft: Lex drafts and the result waits as a proposal.', fits: 'The price shown is measured; the draft never replaces the owner\'s version.', tool: 'draft_document, redraft_document' },
  setAside: { purpose: 'Answers Lex\'s proposal by setting it aside; it stays listed in Versions.', fits: 'Nothing is deleted.', tool: 'set_aside_proposal' },
}

// ── the action record ─────────────────────────────────────────────────────────────────────────────────────────
const RECORD: Record<keyof typeof RECORD_UI, GuideText> = {
  editTitle: { purpose: 'Changes the action\'s short title.', fits: 'The title names the action in lists, the tree and the printed packs; the statement says what it does.', limits: 'One line.', tool: 'set_action_title' },
  noTitle: { purpose: 'Says the action has no title yet.', fits: 'Lex can propose titles for every action (title_actions); the owner accepts them.', tool: 'title_actions, answer_title_proposals' },
  editAction: { purpose: 'Edits the action\'s statement: what the action is, in one or two sentences.', fits: 'The statement is the action\'s headline; the full explanation goes in Action details.', limits: 'The statement box shows its limit; text over it is refused, never cut.', tool: 'edit_action_statement' },
  bandMore: { purpose: 'Opens the record\'s remaining sections when the jump band is too narrow to show them all.', fits: 'The jump band names every section with its state in words.', tool: none('a screen control; get_action reads the whole record') },
  editDetails: { purpose: 'Edits the owner\'s own text in Action details.', fits: 'The quoted parts below it (merged components, imported passages) are kept exactly as stored.', limits: 'No limit.', tool: 'set_action_detail, add_action_details_section' },
  writeDetails: { purpose: 'Starts the Action details when none are written.', fits: 'As "Edit the action details".', tool: 'set_action_detail, add_action_details_section' },
  saveDetails: { purpose: 'Saves the Action details.', fits: 'Replaces the owner\'s own text above the quoted parts; the parts are kept.', tool: 'set_action_detail' },
  policyTest: { purpose: 'Shows whether the action fits the idea\'s Guiding Policy, and why.', fits: 'Set by the policy test (when actions are imported, or by "Test against the policy"); an action that conflicts is ruled out, edited and re-tested, or kept with a note.', tool: 'test_actions_against_policy' },
  testAgainstPolicy: { purpose: 'Runs the policy test on this action.', fits: 'The same test the import runs; it costs pence, said before it runs.', tool: 'test_actions_against_policy' },
  testAgain: { purpose: 'Runs the policy test again, after an edit.', fits: 'As "Test against the policy".', tool: 'test_actions_against_policy' },
  keptWithNote: { purpose: 'The owner\'s reason for keeping an action the policy conflicts with.', fits: 'Shown with the conflict, on the record and in the printed pack.', tool: 'keep_conflict_note' },
  keepWithNote: { purpose: 'Keeps an action the policy test says conflicts, with the owner\'s reason.', fits: 'The conflict stays visible; the note says why the owner kept it.', limits: 'At least 3 characters; the box shows its limit.', tool: 'keep_conflict_note' },
  clearNote: { purpose: 'Removes the keep-it note; the conflict is shown unanswered again.', fits: 'As "Keep it, with a note".', tool: 'keep_conflict_note (note: null)' },
  facetsTitle: { purpose: 'Heads the classification: the causes the action attacks and its avenue.', fits: 'Causes come from the Diagnosis; the avenue (legislative, organisational, financial) decides which documents the action needs.', tool: 'set_action_facets, classify_actions' },
  facetsTitleConditions: { purpose: 'Adds "and the conditions it delivers" when the idea has conditions.', fits: 'Conditions are the owner\'s numbered list on the Guiding Policy.', tool: 'set_action_facets' },
  lexProposes: { purpose: 'Lex\'s proposed classification (causes, avenue, conditions or order), beside the owner\'s.', fits: 'Accept takes it; Dismiss sets it aside; nothing changes until then.', tool: 'answer_facet_proposals' },
  conditionsDelivers: { purpose: 'Which of the idea\'s conditions for success this action delivers.', fits: 'Read by conditions_coverage: a condition no action delivers shows NO ACTION.', tool: 'set_action_conditions' },
  support: { purpose: 'Marks an action that delivers no condition directly (training, a pilot, a consultation).', fits: 'A support action is counted apart from the conditions it serves.', tool: 'set_action_conditions (support: true)' },
  change: { purpose: 'Opens the list beside it to change the choice.', fits: 'Used on the causes and the conditions.', tool: 'set_action_facets, set_action_conditions' },
  headingKind: { purpose: 'The type of instrument the actions under a heading make.', fits: '"Platform" means each action under it needs a specification; the kind decides which documents are needed.', tool: 'set_heading_kind, answer_kind_proposal' },
  rename: { purpose: 'Renames a heading.', fits: 'Headings group actions into instruments (primary legislation, a code, guidance…).', limits: 'The box shows its limit.', tool: 'rename_action_heading' },
  hide: { purpose: 'Hides a heading\'s actions from the list.', fits: 'Hidden is not ruled out: the actions stay live and counted.', tool: 'hide_action_heading' },
  show: { purpose: 'Shows a hidden heading\'s actions again.', fits: 'As Hide.', tool: 'hide_action_heading (hidden: false)' },
  retireHeading: { purpose: 'Retires a heading; its actions stay, with no heading.', fits: 'Nothing is deleted: "Bring back" under Retired headings restores it.', tool: 'retire_action_heading' },
  consolidateHeading: { purpose: 'Lex looks under a heading for actions that are parts of another, or say the same thing.', fits: 'Asks first with a price; every merge can be restored.', tool: 'run_consolidation' },
  notThis: { purpose: 'Sets aside Lex\'s proposed kind for a heading; the kind is unchanged.', fits: 'As Accept beside it.', tool: 'answer_kind_proposal (accept: false)' },
  addDocument: { purpose: 'Adds a document of the chosen kind to the action, written by the owner.', fits: 'Documents are numbered D.<action>.<n> and have versions; the owner\'s own words.', tool: 'propose_document_text (Lex\'s text is a proposal beside the owner\'s)' },
  draftWhatActionNeeds: { purpose: 'Drafts every document the action still needs.', fits: 'Each draft is saved as a proposal as it finishes; asks first at the measured price.', tool: 'draft_document' },
  generateFree: { purpose: 'Generates the collision report from the clause and the official effects data.', fits: 'Free: built from data, not drafted.', tool: 'generate_collision_report' },
  writeInstruction: { purpose: 'Opens the drafting instruction\'s form for the owner to write.', fits: 'The instruction names what the clause amends, the duty, enforcement and purpose; its provision lines write the law rows.', tool: 'redraft_document (Lex drafts it as a proposal)' },
  draftWithLex: { purpose: 'Lex drafts the document; the price is shown first.', fits: 'The draft arrives as a proposal beside the current version.', tool: 'draft_document, redraft_document' },
  draftWithLexNoPrice: { purpose: 'Lex drafts the explanatory note; the price is said before it runs.', fits: 'As "draft it with Lex".', tool: 'redraft_document' },
  writeIt: { purpose: 'Opens a form for the owner to write a missing document.', fits: 'As "Add a document".', tool: 'propose_document_text' },
  noneYet: { purpose: 'Says a document the action needs does not exist yet.', fits: 'What an action needs is worked out from its avenue and its heading\'s kind, or set by hand.', tool: 'list_documents' },
  askLex: { purpose: 'Lex proposes answers to the seven questions of step 2 for this action.', fits: 'Each proposal sits beside its slot; an answer the owner wrote is never overwritten.', tool: 'propose_action_slots' },
  dismissAllSlotProposals: { purpose: 'Sets aside every waiting proposal on this action\'s seven slots.', fits: 'The owner\'s answers are untouched.', tool: 'answer_slot_proposal (slot: all, accept: false)' },
  notYetAnswered: { purpose: 'Says a step-2 question has no answer yet.', fits: '"Specific enough" needs Who and Against answered.', tool: 'set_action_slot' },
  answer: { purpose: 'Opens a step-2 question for the owner to answer.', fits: 'The answer is the owner\'s; Lex\'s proposals sit beside it.', tool: 'set_action_slot (dictated: true with the owner\'s words)' },
  noDirection: { purpose: 'Clears the with/against/indifferent choice on "Incentive now".', fits: 'The direction says whether the implementer\'s present incentive pulls with the action.', tool: 'set_action_slot' },
  linkChange: { purpose: 'Links "What changes it" to the action that changes the incentive, where it is one.', fits: 'Read by the incentive map.', tool: 'set_action_slot (link)' },
  clearAnswer: { purpose: 'Empties a step-2 answer.', fits: 'Kept in the slot\'s history.', tool: 'set_action_slot (text: "")' },
  slotLexProposes: { purpose: 'Lex\'s proposed answer to a step-2 question, beside the owner\'s.', fits: 'Use it, Edit it first, or Dismiss.', tool: 'answer_slot_proposal' },
  replaceMine: { purpose: 'Replaces the owner\'s own answer with Lex\'s proposal, at the owner\'s press.', fits: 'The only way a proposal replaces something the owner wrote.', tool: 'answer_slot_proposal (replace: true)' },
  useIt: { purpose: 'Takes Lex\'s proposal as the answer to an unanswered question.', fits: 'As "Lex proposes".', tool: 'answer_slot_proposal' },
  editFirst: { purpose: 'Copies Lex\'s proposal into the answer box to edit before saving.', fits: 'Saved as the owner\'s answer.', tool: 'set_action_slot' },
  editWho: { purpose: 'Edits who implements the action.', fits: 'Who is the first of step 2\'s seven questions.', tool: 'set_action_slot (slot: who)' },
  whoImplementsLabel: { purpose: 'Who implements the action: a body or a role, inside or outside government.', fits: 'Read by step 2\'s "specific enough" and by the printed packs.', tool: 'set_action_slot (slot: who)' },
  who: { purpose: 'Who implements the action.', fits: 'As "Who implements it".', tool: 'set_action_slot (slot: who)' },
  editCosts: { purpose: 'Edits the action\'s three cost ranges.', fits: 'Step 3: a range with its basis is enough; the full costing is in the Deepening.', tool: 'set_action_costs' },
  costsRanges: { purpose: 'The action\'s cost ranges: low, high, unit and basis for each of the three costs.', fits: 'Read by the Costs step\'s checklist and the printed packs.', tool: 'set_action_costs' },
  addACost: { purpose: 'Adds one costed line to the action (staff, capital, other).', fits: 'Cost lines add up in the costing; staffing lines can be suggested from ASHE.', tool: 'add_cost_line' },
  addCost: { purpose: 'Saves the cost line being written.', fits: 'As "+ add a cost".', tool: 'add_cost_line' },
  suggestFromAshe: { purpose: 'Suggests a staffing cost from the ASHE pay survey for the grade, FTE and months given.', fits: 'A suggestion the owner accepts or overrides.', tool: none('a calculation the screen makes; add_cost_line takes the figures') },
  priceYear: { purpose: 'The year whose prices a cost figure is in.', fits: 'Left for the owner: a stated year is a claim.', tool: 'add_cost_line' },
  oneOff: { purpose: 'Marks a cost as paid once.', fits: 'Pre-filled from the category; change it if wrong.', tool: 'add_cost_line' },
  perYear: { purpose: 'Marks a cost as recurring each year.', fits: 'As one-off.', tool: 'add_cost_line' },
  noCostOpen: { purpose: 'Answers the cost question with "no cost", and why.', fits: 'Not a blank: the checklist, the row and the Proposal all say it in the owner\'s words.', tool: 'set_no_cost_reason' },
  noCostBecause: { purpose: 'The owner\'s reason the action costs nothing.', fits: 'As "no cost, because…".', limits: 'At least 3 characters; the box shows its limit.', tool: 'set_no_cost_reason' },
  deleteCostLine: { purpose: 'Removes a cost line.', fits: 'The ranges are untouched.', tool: none('it deletes the line, and Lex is offered no tool that deletes; the owner presses it') },
  orderTitle: { purpose: 'Heads the Order section: what this action must come after, and why.', fits: 'The whole order is worked out from these links; an impossible circle is refused, naming both actions.', tool: 'set_action_order' },
  orderNone: { purpose: 'Says nothing has to come before this action.', fits: 'As the Order section.', tool: 'set_action_order' },
  mustComeAfter: { purpose: 'Records that this action must come after another, with an optional reason.', fits: 'As the Order section.', limits: 'The reason is up to 300 characters.', tool: 'set_action_order' },
  saveReason: { purpose: 'Saves the reason on an order link.', fits: 'As "Must come after".', tool: 'set_action_order' },
  sources: { purpose: 'Where the action came from: the sources the policy test and the import drew on.', fits: 'Read-only provenance.', tool: 'get_action' },
  originals: { purpose: 'The actions this one was merged from, kept beneath it.', fits: 'A merge never deletes; each original can be restored.', tool: 'unmerge_actions' },
  laterPhase: { purpose: 'Moves the action to "Later phase": not now, still kept.', fits: 'Restore brings it back.', tool: 'park_actions' },
  ruleOut: { purpose: 'Rules the action out, with a reason.', fits: 'Kept under "Ruled out and merged away"; Restore brings it back.', limits: 'A reason of at least 3 characters is needed.', tool: 'rule_out_actions' },
  pruneLine: { purpose: 'Heads the step-1 part: sources, the originals, Later phase and Rule out.', fits: 'Step 1 is Sort and prune.', tool: 'park_actions, rule_out_actions' },
  comments: { purpose: 'The comment thread on this action; everyone who can see the idea sees it.', fits: 'Comments are notes in the research notebook tagged to the action.', tool: 'add_action_comment, reply_to_comment' },
  addComment: { purpose: 'Adds a comment on this action.', fits: 'As Comments.', tool: 'add_action_comment' },
  reply: { purpose: 'Replies beneath a comment; nobody can change what someone else wrote.', fits: 'As Comments.', tool: 'reply_to_comment' },
  summariseThread: { purpose: 'Lex reads the thread and says what was said; stored nowhere.', fits: 'Costs under 1p.', tool: 'summarise_action_thread' },
}

// ── the document view ──────────────────────────────────────────────────────────────────────────────────────────
const DOCUMENT: Record<keyof typeof DOCUMENT_UI, GuideText> = {
  acceptVersion: { purpose: 'The owner accepts the document as it stands.', fits: 'A later edit takes it back to "accepted, then changed".', tool: 'accept_document (owner\'s instruction only)' },
  generateAgain: { purpose: 'Rebuilds the collision report from the clause and the effects data.', fits: 'Free; unchanged if nothing moved.', tool: 'generate_collision_report' },
  askLexToRedraft: { purpose: 'Lex drafts a fresh version as a proposal; the price is shown first.', fits: 'An older waiting proposal is set aside, kept.', tool: 'redraft_document' },
  versions: { purpose: 'Opens the Versions tab: every version, who wrote it, what it changed, and set-aside proposals.', fits: 'Nothing is ever deleted.', tool: 'read_document' },
  reviewThisDocument: { purpose: 'The five review passes read the current version and raise issues on its parts.', fits: 'Asks first at the measured price; issues land in the Issues tab and the Risks view.', tool: 'review_document' },
  reviewIt: { purpose: 'Confirms the review at the price shown.', fits: 'As "Review this document".', tool: 'review_document' },
  reviewAgain: { purpose: 'Reviews a version the five passes have already read, adding a second set of issues.', fits: 'As "Review this document".', tool: 'review_document' },
  saveAsNewVersion: { purpose: 'Saves the owner\'s edit as the next version.', fits: 'Earlier versions are kept; an accepted document then needs accepting again.', tool: none('the owner\'s own words (decision 301): Lex writes a proposal and the owner uses it') },
  useItAsVersion: { purpose: 'Makes Lex\'s waiting proposal the next version.', fits: 'Not accepted until the owner accepts it.', tool: 'use_proposal (owner\'s instruction only)' },
  takeAll: { purpose: 'Copies Lex\'s whole proposal into the working copy.', fits: 'Saving then uses Lex\'s whole instruction, its provision lines and every field.', tool: 'use_proposal' },
  takeThis: { purpose: 'Copies one subsection of Lex\'s proposal into the working copy.', fits: 'The working copy is saved as the owner\'s version.', tool: none('a choice in the owner\'s working copy') },
  saveAsVersion: { purpose: 'Saves the working copy as the next version.', fits: 'Lex\'s proposal stays waiting until set aside.', tool: none('the owner\'s own words (decision 301)') },
  whyLexDrafted: { purpose: 'Lex\'s own reason for drafting it this way.', fits: 'Stored with the proposal or version.', tool: 'read_document' },
  whatLexSays: { purpose: 'What Lex says about its proposal.', fits: 'Stored with the proposal.', tool: 'read_document' },
  readAgain: { purpose: 'Reads the statute book again for "What it touches".', fits: 'Free.', tool: none('a read the screen makes') },
  asItStands: { purpose: 'The current version, in the comparison.', fits: 'Beside Lex\'s proposal and the working copy.', tool: 'read_document' },
  lexProposesColumn: { purpose: 'Lex\'s proposal, in the comparison; it cannot be edited.', fits: 'As "As it stands".', tool: 'read_document' },
  yourWorkingCopy: { purpose: 'The owner\'s working copy, editable, saved as the next version.', fits: 'As "As it stands".', tool: none('the owner\'s own words (decision 301)') },
  precedents: { purpose: 'Existing provisions the drafting instruction draws on, and what it takes from each.', fits: 'Part of the drafting instruction.', tool: 'read_document' },
  saveTheDocument: { purpose: 'Saves a document the owner wrote.', fits: 'As "Add a document".', tool: 'propose_document_text' },
  title: { purpose: 'The document\'s title.', fits: 'Shown in the tree and on the record.', tool: 'propose_document_text' },
  textWithParts: { purpose: 'The document\'s text; "## " starts each numbered part.', fits: 'Parts are numbered D.<action>.<n>.<part>; issues attach to parts.', tool: 'propose_document_text' },
}

const TABS: Record<keyof typeof DOCUMENT_TAB_WORD, GuideText> = {
  text: { purpose: 'The document\'s current text, part by part.', fits: 'For a clause, the caveat is always the first line.', tool: 'read_document' },
  instruction: { purpose: 'The drafting instruction: what the clause amends, the duty, enforcement, commencement, extent, purpose and precedents.', fits: 'Its provision lines write the idea\'s law rows.', tool: 'read_document' },
  touches: { purpose: 'What the clause touches in the statute book: the text held, changes already made, instruments made under it, judgments, near provisions.', fits: 'Computed from the instruction\'s named provisions; free.', tool: 'statute_effects, read_section' },
  versions: { purpose: 'Every version and proposal, with who wrote it and what it changed.', fits: 'Nothing is deleted.', tool: 'read_document' },
  issues: { purpose: 'What the five review passes have read and raised, and the open issues by part.', fits: 'Issues are answered in the Risks view or by redrafting.', tool: 'review_document' },
}

const FIELDS: Record<keyof typeof INSTRUCTION_FIELD, GuideText> = {
  instrument: { purpose: 'The type of instrument the clause belongs in.', fits: 'Part of the drafting instruction.', tool: 'redraft_document' },
  dutyOnWhom: { purpose: 'Who the duty falls on.', fits: 'Part of the drafting instruction.', tool: 'redraft_document' },
  enforcedHow: { purpose: 'How the duty is enforced.', fits: 'Part of the drafting instruction.', tool: 'redraft_document' },
  commencement: { purpose: 'When the provision comes into force.', fits: 'Legislative actions only.', tool: 'redraft_document' },
  extent: { purpose: 'Where the provision applies (England, Wales, Scotland, Northern Ireland).', fits: 'Legislative actions only.', tool: 'redraft_document' },
  purpose: { purpose: 'What the clause is for, in one line.', fits: 'Part of the drafting instruction.', tool: 'redraft_document' },
}
const EDITOR: Record<keyof typeof INSTRUCTION_EDITOR, GuideText> = {
  notChosen: { purpose: 'No instrument chosen yet.', fits: 'As Instrument.', tool: 'redraft_document' },
  provisionsLine: { purpose: 'The provisions the clause amends, inserts into or repeals, one per line.', fits: 'Each line writes a law row when the version is saved.', tool: 'redraft_document' },
  clause: { purpose: 'The clause\'s text.', fits: 'Its first line is always the caveat, added if left out.', tool: 'redraft_document' },
  plainWording: { purpose: 'The wording in plain English, for a non-legislative action.', fits: 'As the clause.', tool: 'redraft_document' },
  purposeOneLine: { purpose: 'What the clause is for, in one line.', fits: 'As Purpose.', tool: 'redraft_document' },
}
const BLOCKS: Record<keyof typeof TOUCH_BLOCK, GuideText> = {
  held: { purpose: 'The provision\'s text as the corpus holds it.', fits: 'Block 1 of What it touches.', tool: 'read_section' },
  effects: { purpose: 'Changes already made to the provision, from the official effects record.', fits: 'Block 2.', tool: 'statute_effects' },
  madeUnder: { purpose: 'Statutory instruments whose enacting words name the provision.', fits: 'Block 3.', tool: 'search_corpus' },
  judgments: { purpose: 'Judgments citing the provision.', fits: 'Block 4.', tool: 'search_corpus' },
  near: { purpose: 'Neighbouring provisions, each with the question it raises.', fits: 'Block 5.', tool: 'read_section' },
}
const TREE: Record<keyof typeof TREE_UI, GuideText> = {
  draftWhatHeadingNeeds: { purpose: 'Drafts every document the actions under a heading still need.', fits: 'Asks first at the measured price; each draft is saved as a proposal.', tool: none('not yet: draft_document covers one action') },
  changeWhatThisNeeds: { purpose: 'Sets which documents an action needs by hand, with a reason.', fits: 'Overrides the rule that works it out from the avenue and the heading\'s kind.', tool: 'set_document_needs' },
  generateItFree: { purpose: 'Generates the collision report.', fits: 'Free.', tool: 'generate_collision_report' },
  writeIt: { purpose: 'Opens a form for the owner to write a missing document.', fits: 'As "Add a document".', tool: 'propose_document_text' },
  needsDerived: { purpose: 'Lets the rule work out what the action needs.', fits: 'From its avenue and its heading\'s kind.', tool: 'set_document_needs' },
  needsNothing: { purpose: 'Says the action needs no document, with a reason.', fits: 'As "Change what this needs".', tool: 'set_document_needs' },
  needsSet: { purpose: 'Names exactly the documents the action needs.', fits: 'As "Change what this needs".', tool: 'set_document_needs' },
}
const WORKSPACE: Record<keyof typeof WORKSPACE_UI, GuideText> = {
  conditionsTitle: { purpose: 'The idea\'s own numbered list of conditions the proposal must meet.', fits: 'Each action says which conditions it delivers; conditions_coverage shows a condition no action delivers as NO ACTION.', limits: 'Each condition is one short sentence; the box shows its limit.', tool: 'change_condition (the owner\'s list), propose_condition (Lex\'s suggestion), answer_condition_proposal' },
  moveConditionUp: { purpose: 'Moves a condition one place up the list; the numbers follow the order.', fits: 'Actions keep the conditions they deliver, whatever their number.', tool: 'change_condition (op: up)' },
  moveConditionDown: { purpose: 'Moves a condition one place down the list.', fits: 'As ↑.', tool: 'change_condition (op: down)' },
  retireCondition: { purpose: 'Retires a condition: kept, listed under "Retired (kept)", and Bring back restores it.', fits: 'Nothing is deleted.', tool: 'change_condition (op: retire)' },
  addCondition: { purpose: 'Adds a condition, in the owner\'s words, to the end of the list.', fits: 'As the conditions list.', limits: 'The box shows its limit.', tool: 'change_condition (op: add)' },
  addItToList: { purpose: 'Takes Lex\'s proposed condition into the owner\'s list.', fits: 'Lex\'s proposals change nothing until added; Dismiss sets one aside.', tool: 'answer_condition_proposal' },
  group: { purpose: 'Chooses how the list is grouped: by heading, cause, avenue or policy test.', fits: 'Step 1 offers all four; later steps group by heading.', tool: none('a view of the list; group_actions gives Lex the same grouping') },
  hideAllHeadings: { purpose: 'Hides every heading\'s actions from the list at once.', fits: 'Hidden is not ruled out: the actions stay live and counted.', tool: 'hide_action_heading (one heading at a time)' },
  showAllHeadings: { purpose: 'Shows every hidden heading\'s actions again.', fits: 'As "Hide all headings".', tool: 'hide_action_heading (hidden: false)' },
  titleTheseForMe: { purpose: 'Lex proposes a short title for every action that has none.', fits: 'Each proposal waits on its row until the owner uses it, edits it or says no.', tool: 'title_actions, answer_title_proposals' },
  classifyWithLex: { purpose: 'Lex proposes this step\'s classification for every action that has none: causes, avenue and conditions in step 1, the seven answers in step 2.', fits: 'Proposals sit beside the owner\'s answers; nothing changes until accepted.', tool: 'classify_actions, propose_action_slots' },
  dismissThemAll: { purpose: 'Sets aside every answer Lex has proposed in step 2, on every action.', fits: 'The owner\'s own answers are not touched.', tool: 'answer_slot_proposal (accept: false)' },
  findDuplicates: { purpose: 'Lists pairs of actions that may say the same thing.', fits: 'Free: no model is called. Merging a pair is the owner\'s choice, and can be undone.', tool: 'find_action_duplicates, merge_actions' },
  askFourSet: { purpose: 'Four models each answer the same six questions about every action, and a judge writes one digest keeping each model\'s position named.', fits: 'Asks first at the price shown; nothing is added to the list.', tool: none('a priced run started from the screen') },
  printAll: { purpose: 'A printable Actions Pack (Word and PDF) of every action, every paragraph numbered.', fits: 'No model is called.', tool: none('a file the screen builds') },
  addHeading: { purpose: 'Adds a heading, named by the owner, to group actions under.', fits: 'Headings group actions into instruments; each can be given a kind.', limits: 'The box shows its limit.', tool: 'create_action_heading' },
  suggestHeadings: { purpose: 'Lex reads the Guiding Policy and suggests headings.', fits: 'The owner adds the ones they want.', tool: 'suggest_action_headings' },
  listFilter: { purpose: 'Filters the list: all actions, Unreviewed, Conflicts, or Not yet specific.', fits: 'Unreviewed means Lex has a proposal waiting or the action was never tested against the policy.', tool: 'list_actions' },
  askFourHeading: { purpose: 'As "Ask four models about the whole set", for the actions under one heading.', fits: 'Asks first at the price shown.', tool: none('a priced run started from the screen') },
  printHeading: { purpose: 'Prints one heading\'s actions as an Actions Pack (Word and PDF).', fits: 'As "Print all".', tool: none('a file the screen builds') },
  draftAllLegislative: { purpose: 'Drafts a drafting instruction for every legislative action under the heading that has none.', fits: 'Asks first with the total price; each draft is stored as it completes, so stopping loses nothing.', tool: 'draft_document (one action at a time)' },
  draftThem: { purpose: 'Confirms "Draft all legislative actions" at the price shown.', fits: 'As "Draft all legislative actions".', tool: 'draft_document' },
  stopAfterThis: { purpose: 'Stops "Draft all legislative actions" once the current draft finishes.', fits: 'Drafts already done are kept; pressing again carries on with the rest.', tool: none('a control on a run the screen is making') },
  reorder: { purpose: 'The drag handle: drag a row, or use the arrow keys, to reorder the list.', fits: 'The list order is the owner\'s; step 4\'s derived order comes from "Must come after".', tool: none('a screen control') },
  openRecord: { purpose: 'Opens the action\'s record beneath its row.', fits: 'The record shows this step\'s sections.', tool: 'get_action' },
  closeRecord: { purpose: 'Closes the opened record.', fits: 'Nothing is saved or lost by closing.', tool: none('a screen control') },
  ruledOutBlock: { purpose: 'The actions ruled out or merged away, each with its reason.', fits: 'Kept: nothing here is deleted; Restore brings one back.', tool: 'restore_actions, unmerge_actions' },
  laterPhaseBlock: { purpose: 'The actions parked for a later phase.', fits: 'Still the owner\'s and still in the proposal; Bring back returns one to the list.', tool: 'park_actions, restore_actions' },
  retiredHeadingsBlock: { purpose: 'Headings retired by a re-sort or by hand.', fits: 'Kept; Bring back restores one.', tool: 'retire_action_heading' },
  blockShow: { purpose: 'Opens a kept block or a digest.', fits: 'A screen control.', tool: none('a screen control') },
  blockHide: { purpose: 'Closes a kept block or a digest.', fits: 'A screen control.', tool: none('a screen control') },
  restore: { purpose: 'Brings a ruled-out or merged-away action back into the list.', fits: 'A merged-away part comes out of the action it was tucked into.', tool: 'restore_actions' },
}
const VIEWS: Record<keyof typeof WORKSPACE_VIEW_WORD, GuideText> = {
  list: { purpose: 'The actions as a list, grouped.', fits: 'Every step has it.', tool: 'list_actions' },
  board: { purpose: 'The actions as cards on a board by heading, with possible duplicates outlined.', fits: 'A step-1 view; its writes are the list\'s own.', tool: 'list_actions, find_action_duplicates' },
  coverage: { purpose: 'Causes against actions: which causes each action attacks, and any cause no action attacks.', fits: 'A step-1 view.', tool: 'causes_without_action' },
  conditions: { purpose: 'Conditions against actions: a condition no action delivers reads NO ACTION.', fits: 'A step-1 view.', tool: 'conditions_coverage' },
  order: { purpose: 'The order the actions must happen in, worked out from what each must come after.', fits: 'A step-4 view.', tool: 'set_action_order' },
  who: { purpose: 'The incentive map: who implements each action, their incentive now and what changes it.', fits: 'A step-2 view.', tool: 'set_action_slot' },
}
const NOTEBOOK: Record<keyof typeof NOTEBOOK_UI, GuideText> = {
  bringBack: { purpose: 'Brings set-aside notes back.', fits: 'Setting aside never deletes a note.', tool: 'answer_notes (op: bring_back)' },
  shareWithTeam: { purpose: 'Shares one of the user\'s own notes with the team.', fits: 'Only a note\'s author can share it.', tool: 'answer_notes (op: share)' },
  makeMineOnly: { purpose: 'Makes one of the user\'s own notes private to them.', fits: 'Only a note\'s author can make it private.', tool: 'answer_notes (op: mine_only)' },
  bringBackIntoRecord: { purpose: 'Brings a set-aside note back into the record.', fits: 'As Bring back.', tool: 'answer_notes (op: bring_back)' },
  putInRecord: { purpose: 'The owner takes a note Lex wrote (unreviewed) into the record.', fits: 'Lex\'s own findings wait, unreviewed, until the owner puts them in.', tool: 'answer_notes (op: put_in_record)' },
}

const FILTERS: Record<keyof typeof TREE_FILTER_WORD, GuideText> = {
  all: { purpose: 'Shows every action\'s documents.', fits: 'A filter on the tree.', tool: 'list_documents' },
  missing: { purpose: 'Shows actions missing a document they need.', fits: 'A filter on the tree.', tool: 'list_documents' },
  drafted: { purpose: 'Shows documents drafted but not accepted.', fits: 'A filter on the tree.', tool: 'list_documents' },
  accepted: { purpose: 'Shows accepted documents.', fits: 'A filter on the tree.', tool: 'list_documents' },
}

// ── labels held in the older tables ────────────────────────────────────────────────────────────────────────────
const SECTIONS: Record<RecordSection, GuideText> = {
  detail: { purpose: 'The action\'s full explanation: what it does and why, its parts and reasoning.', fits: 'The statement is the headline; an instrument\'s text goes in a document, never here.', limits: 'No limit; more than 3,000 characters of instrument-like text from Lex is refused.', tool: 'set_action_detail, add_action_details_section' },
  documents: { purpose: 'The action\'s documents: each with its number, kind, status and version, and what is still needed.', fits: 'Opens each document in the document view.', tool: 'list_documents, read_document' },
  law: { purpose: 'The law rows this action\'s drafting instruction wrote.', fits: 'The idea\'s whole law is on the Overview\'s Law tab.', tool: 'read_document' },
  who: { purpose: 'Step 2: who implements it, their incentive, what changes it, skill, how it is enforced, what opposes it, what tells us it worked.', fits: '"Specific enough" needs Who and Against.', tool: 'set_action_slot, propose_action_slots' },
  costs: { purpose: 'Step 3: the cost ranges, cost lines, or "no cost, because".', fits: 'The full costing is in the Deepening.', tool: 'set_action_costs, add_cost_line, set_no_cost_reason' },
  order: { purpose: 'Step 4: what this action must come after, and why.', fits: 'The order is derived from these links.', tool: 'set_action_order' },
  comments: { purpose: 'The comment thread on the action.', fits: 'Everyone who can see the idea sees it.', tool: 'add_action_comment, reply_to_comment' },
}
const SLOTS: Record<AnySlot, GuideText> = {
  who: { purpose: 'Who implements it, a body or a role, inside or outside government.', fits: 'Stored on the action itself.', tool: 'set_action_slot (slot: who)' },
  incentiveNow: { purpose: 'Whether the implementer\'s present incentive pulls with the action, against it or neither, and why.', fits: 'Read by the incentive map.', tool: 'set_action_slot (slot: incentiveNow)' },
  whatChangesIt: { purpose: 'What in the proposal changes that incentive, usually another action (linked).', fits: 'Read by the incentive map.', tool: 'set_action_slot (slot: whatChangesIt)' },
  skill: { purpose: 'Why they would have the skill to do it.', fits: 'Step 2.', tool: 'set_action_slot (slot: skill)' },
  how: { purpose: 'How it is enforced, by whom, with what consequence.', fits: 'Step 2.', tool: 'set_action_slot (slot: how)' },
  against: { purpose: 'What will oppose it, and the counter to each.', fits: '"Specific enough" needs it answered.', tool: 'set_action_slot (slot: against)' },
  worked: { purpose: 'The measure that would tell us it worked.', fits: 'Step 2.', tool: 'set_action_slot (slot: worked)' },
}
const DIRECTIONS_G: Record<Direction, GuideText> = {
  WITH: { purpose: 'The present incentive pulls with the action.', fits: 'A choice on "Incentive now".', tool: 'set_action_slot (direction)' },
  AGAINST: { purpose: 'The present incentive pulls against the action.', fits: 'A choice on "Incentive now".', tool: 'set_action_slot (direction)' },
  INDIFFERENT: { purpose: 'The present incentive neither helps nor hinders.', fits: 'A choice on "Incentive now".', tool: 'set_action_slot (direction)' },
}
const STEP_G: Record<ActionsStep, GuideText> = {
  1: { purpose: 'Step 1: sort the list, classify each action, merge duplicates, rule out what does not fit.', fits: 'The screen shows only the tools for the step the owner is on.', tool: 'classify_actions, set_action_facets, merge_actions, rule_out_actions' },
  2: { purpose: 'Step 2: who, how and against for each action.', fits: 'As the step bar.', tool: 'set_action_slot, propose_action_slots' },
  3: { purpose: 'Step 3: a cost range for each action.', fits: 'As the step bar.', tool: 'set_action_costs, add_cost_line, set_no_cost_reason' },
  4: { purpose: 'Step 4: the order, from what each action must come after.', fits: 'As the step bar.', tool: 'set_action_order' },
}
const COST_G: Record<keyof typeof COST_LINE_LABEL, GuideText> = {
  implementationCost: { purpose: 'What it costs government to put the action in place.', fits: 'One of the three cost ranges.', tool: 'set_action_costs' },
  enforcementCost: { purpose: 'What it costs to enforce once in place.', fits: 'One of the three cost ranges.', tool: 'set_action_costs' },
  regulatoryFriction: { purpose: 'What it costs those who must comply.', fits: 'One of the three cost ranges.', tool: 'set_action_costs' },
}

// ── assembled ──────────────────────────────────────────────────────────────────────────────────────────────────
const fromTable = <K extends string>(area: GuideArea, prefix: string, labels: Record<K, Lbl>, texts: Record<K, GuideText>): GuideEntry[] =>
  (Object.keys(texts) as K[]).map((k) => ({ key: `${prefix}.${k}`, area, label: shown(labels[k]), ...texts[k] }))

/** Every entry, its label read NOW from the table the screen renders. */
export function guideEntries(): GuideEntry[] {
  const kindTexts = Object.fromEntries((Object.keys(KIND_WORD) as DocumentKind[]).map((k) => [k, { purpose: `A ${KIND_WORD[k]}: one of the kinds of document an action can have.`, fits: 'Which kinds an action needs comes from its avenue and its heading\'s kind, or is set by hand.', tool: 'list_documents, draft_document' }])) as Record<DocumentKind, GuideText>
  const headingKindTexts = Object.fromEntries(Object.keys(HEADING_KIND_WORD).map((k) => [k, { purpose: `A heading whose actions make ${HEADING_KIND_WORD[k as keyof typeof HEADING_KIND_WORD]}.`, fits: 'Decides which documents its actions need.', tool: 'set_heading_kind' }])) as Record<keyof typeof HEADING_KIND_WORD, GuideText>
  return [
    ...fromTable('common', 'common', COMMON_UI, COMMON),
    ...fromTable('record', 'record', RECORD_UI, RECORD),
    ...fromTable('record', 'section', Object.fromEntries(RECORD_SECTIONS.map((s) => [s.key, s.label])) as Record<RecordSection, string>, SECTIONS),
    ...fromTable('record', 'slot', Object.fromEntries(Object.entries(SLOT_UI).map(([k, v]) => [k, v.label])) as Record<AnySlot, string>, SLOTS),
    ...fromTable('record', 'direction', Object.fromEntries(Object.entries(DIRECTION_UI).map(([k, v]) => [k, v.word])) as Record<Direction, string>, DIRECTIONS_G),
    ...fromTable('record', 'step', Object.fromEntries(Object.entries(STEPS).map(([k, v]) => [k, v.label])) as Record<ActionsStep, string>, STEP_G),
    ...fromTable('record', 'cost', COST_LINE_LABEL, COST_G),
    { key: 'record.statement', area: 'record', label: STATEMENT_LABEL, purpose: 'The action\'s statement: what the action is.', fits: 'The headline; Action details hold the rest.', limits: 'The label states the limit.', tool: 'edit_action_statement' },
    { key: 'record.commentary', area: 'record', label: COMMENTARY_LABEL, ...SECTIONS.detail },
    { key: 'record.quotedParts', area: 'record', label: FOLD_HEADER, purpose: 'Parts quoted into the Action details: merged components and imported passages, each with its source.', fits: 'Kept exactly as stored when the owner edits their own text.', tool: 'get_action' },
    { key: 'record.avenue', area: 'record', label: FACET_WORD.avenue, purpose: 'The avenue: legislative, organisational or financial.', fits: 'Decides which documents the action needs.', tool: 'set_action_facets' },
    { key: 'record.causes', area: 'record', label: FACET_WORD.causes, purpose: 'The causes from the Diagnosis that the action attacks.', fits: 'causes_without_action lists causes no action attacks.', tool: 'set_action_facets' },
    ...fromTable('document', 'kind', KIND_WORD, kindTexts),
    ...fromTable('record', 'headingKind', HEADING_KIND_WORD, headingKindTexts),
    ...fromTable('document', 'document', DOCUMENT_UI, DOCUMENT),
    ...fromTable('document', 'tab', DOCUMENT_TAB_WORD, TABS),
    ...fromTable('document', 'field', INSTRUCTION_FIELD, FIELDS),
    ...fromTable('document', 'editor', INSTRUCTION_EDITOR, EDITOR),
    ...fromTable('document', 'touch', TOUCH_BLOCK, BLOCKS),
    ...PROVISION_COLUMNS.map((c) => ({ key: `document.provisionColumn.${c}`, area: 'document' as const, label: c, purpose: `The "${c}" column of the drafting instruction's provisions table.`, fits: 'Each row is a provision the clause acts on; it writes a law row.', tool: 'read_document' })),
    ...PRECEDENT_COLUMNS.map((c) => ({ key: `document.precedentColumn.${c}`, area: 'document' as const, label: c, purpose: `The "${c}" column of the precedents table.`, fits: 'Precedents are existing provisions the draft draws on.', tool: 'read_document' })),
    ...fromTable('tree', 'tree', TREE_UI, TREE),
    ...fromTable('tree', 'filter', TREE_FILTER_WORD, FILTERS),
    ...fromTable('workspace', 'workspace', WORKSPACE_UI, WORKSPACE),
    ...fromTable('workspace', 'view', WORKSPACE_VIEW_WORD, VIEWS),
    // the facets heading is two table words, shown as one line when the idea has conditions
    { key: 'record.facetsTitleWithConditions', area: 'record', label: RECORD_UI.facetsTitle + RECORD_UI.facetsTitleConditions, ...RECORD.facetsTitle, tool: 'set_action_facets, set_action_conditions, classify_actions' },
    ...EXTENTS.map((x) => ({ key: `document.extent.${x}`, area: 'document' as const, label: x, purpose: `A place the provision extends to: ${x}.`, fits: 'One of the Extent choices in the drafting instruction; legislative actions only.', tool: 'redraft_document' })),
    ...fromTable('research', 'notebook', NOTEBOOK_UI, NOTEBOOK),
  ]
}

/** The same normalising the coverage check uses: numbers and prices become N, spacing and case are ignored. */
export const normLabel = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().replace(/£?\d+(?:[.,]\d+)*p?/g, 'N').replace(/\bN(?:\s*N)+/g, 'N').toLowerCase()

/** Find the entry for a label, a key, or words from either (Lex's `explain_field`). */
export function explainField(name: string): { exact: GuideEntry | null; near: GuideEntry[] } {
  const all = guideEntries()
  const q = normLabel(name)
  const exact = all.find((e) => normLabel(e.label) === q || e.key.toLowerCase() === q) ?? null
  if (exact) return { exact, near: [] }
  // A near match must share a word with the LABEL (or key) itself — a word only in the purpose ("such", "control") is not a match.
  const STOP = new Set(['the', 'and', 'for', 'this', 'that', 'what', 'with', 'field', 'button', 'section', 'box', 'control', 'such'])
  const words = q.split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.has(w))
  const scored = all.map((e) => {
    const name = `${normLabel(e.label)} ${e.key.toLowerCase()}`
    const inName = words.filter((w) => name.includes(w)).length
    const inPurpose = words.filter((w) => e.purpose.toLowerCase().includes(w)).length
    return { e, n: inName ? inName * 2 + inPurpose + (normLabel(e.label).includes(q) ? 3 : 0) : 0 }
  }).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)
  return { exact: null, near: scored.slice(0, 6).map((x) => x.e) }
}

/** Lex's `list_fields`: one line per entry in an area. */
export function listFields(area?: GuideArea): Array<{ key: string; label: string; purpose: string }> {
  return guideEntries().filter((e) => !area || e.area === area).map((e) => ({ key: e.key, label: e.label, purpose: e.purpose }))
}

/** Every Lex tool name the guide mentions (for the check: each must exist). */
export function toolsNamed(): string[] {
  const names = new Set<string>()
  // "(op: bring_back)" names an operation of the tool before it, not a tool: drop op values before reading names
  for (const e of guideEntries()) for (const m of e.tool.replace(/\bop:\s*[a-z_]+/g, '').matchAll(/\b[a-z]+(?:_[a-z]+)+\b/g)) names.add(m[0])
  return [...names].sort()
}
