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
  LIFECYCLE_STAGE_WORD, LIFECYCLE_UI, PROGRESS_WORD, CHECKLIST_WORD, PAGE_UI, DRAFTING_FILTER_WORD, DEEPENING_LOCK_UI,
  ORGANISING_TOOLBAR_UI, ADD_ACTION_UI, BRIEF_UI, BRIEF_FIELD_WORD, TONE_WORD, DEEPENING_UI, DRAFTS_UI, CBA_UI,
  PANEL_WORD, PANEL_PLACE_WORD, WHERE_SENTENCES, WHERE_UI, DRAFT_RESTORE_UI, STAGEBAR_ROW_WORD, CAUSE_UI, SOURCES_UI, ADD_RESEARCH_UI,
} from './screen-labels'
import { FACET_LABEL, SORT_LABEL } from './source-list'
import { STANCE_LABEL } from './research-notebook-schema'
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
  add: { purpose: 'Adds what was chosen in the control beside it.', fits: 'Used for "Add a draft" and "Must come after".', tool: 'see the control it sits beside' },
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
  facetsTitle: { purpose: 'Heads the classification: the causes the action attacks and its avenue.', fits: 'Causes come from the Diagnosis; the avenue (legislative, organisational, financial) decides which drafts the action needs.', tool: 'set_action_facets, classify_actions' },
  facetsTitleConditions: { purpose: 'Adds "and the conditions it delivers" when the idea has conditions.', fits: 'Conditions are the owner\'s numbered list on the Guiding Policy.', tool: 'set_action_facets' },
  lexProposes: { purpose: 'Lex\'s proposed classification (causes, avenue, conditions or order), beside the owner\'s.', fits: 'Accept takes it; Dismiss sets it aside; nothing changes until then.', tool: 'answer_facet_proposals' },
  conditionsDelivers: { purpose: 'Which of the idea\'s conditions for success this action delivers.', fits: 'Read by conditions_coverage: a condition no action delivers shows NO ACTION.', tool: 'set_action_conditions' },
  support: { purpose: 'Marks an action that delivers no condition directly (training, a pilot, a consultation).', fits: 'A support action is counted apart from the conditions it serves.', tool: 'set_action_conditions (support: true)' },
  change: { purpose: 'Opens the list beside it to change the choice.', fits: 'Used on the causes and the conditions.', tool: 'set_action_facets, set_action_conditions' },
  headingKind: { purpose: 'The type of instrument the actions under a heading make.', fits: '"Platform" means each action under it needs a specification; the kind decides which drafts are needed.', tool: 'set_heading_kind, answer_kind_proposal' },
  rename: { purpose: 'Renames a heading.', fits: 'Headings group actions into instruments (primary legislation, a code, guidance…).', limits: 'The box shows its limit.', tool: 'rename_action_heading' },
  hide: { purpose: 'Hides a heading\'s actions from the list.', fits: 'Hidden is not ruled out: the actions stay live and counted.', tool: 'hide_action_heading' },
  show: { purpose: 'Shows a hidden heading\'s actions again.', fits: 'As Hide.', tool: 'hide_action_heading (hidden: false)' },
  retireHeading: { purpose: 'Retires a heading; its actions stay, with no heading.', fits: 'Nothing is deleted: "Bring back" under Retired headings restores it.', tool: 'retire_action_heading' },
  consolidateHeading: { purpose: 'Lex looks under a heading for actions that are parts of another, or say the same thing.', fits: 'Asks first with a price; every merge can be restored.', tool: 'run_consolidation' },
  notThis: { purpose: 'Sets aside Lex\'s proposed kind for a heading; the kind is unchanged.', fits: 'As Accept beside it.', tool: 'answer_kind_proposal (accept: false)' },
  addDocument: { purpose: 'Adds a draft of the chosen kind to the action, written by the owner.', fits: 'Drafts are numbered D.<action>.<n> and have versions; the owner\'s own words.', tool: 'propose_document_text (Lex\'s text is a proposal beside the owner\'s)' },
  draftWhatActionNeeds: { purpose: 'Drafts everything the action still needs.', fits: 'Each draft is saved as a proposal as it finishes; asks first at the measured price.', tool: 'draft_document' },
  generateFree: { purpose: 'Generates the collision report from the clause and the official effects data.', fits: 'Free: built from data, not drafted.', tool: 'generate_collision_report' },
  writeInstruction: { purpose: 'Opens the drafting instruction\'s form for the owner to write.', fits: 'The instruction names what the clause amends, the duty, enforcement and purpose; its provision lines write the law rows.', tool: 'redraft_document (Lex drafts it as a proposal)' },
  draftWithLex: { purpose: 'Lex drafts it; the price is shown first.', fits: 'The draft arrives as a proposal beside the current version.', tool: 'draft_document, redraft_document' },
  draftWithLexNoPrice: { purpose: 'Lex drafts the explanatory note; the price is said before it runs.', fits: 'As "draft it with Lex".', tool: 'redraft_document' },
  writeIt: { purpose: 'Opens a form for the owner to write a missing draft.', fits: 'As "Add a draft".', tool: 'propose_document_text' },
  noneYet: { purpose: 'Says a draft the action needs does not exist yet.', fits: 'What an action needs is worked out from its avenue and its heading\'s kind, or set by hand.', tool: 'list_documents' },
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
  deleteCostLine: { purpose: 'Removes a cost line.', fits: 'The ranges are untouched.', tool: 'remove_cost_line (asks first; the one delete Lex may make)' },
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
  acceptVersion: { purpose: 'The owner accepts the draft as it stands.', fits: 'A later edit takes it back to "accepted, then changed".', tool: 'accept_document (owner\'s instruction only)' },
  generateAgain: { purpose: 'Rebuilds the collision report from the clause and the effects data.', fits: 'Free; unchanged if nothing moved.', tool: 'generate_collision_report' },
  askLexToRedraft: { purpose: 'Lex drafts a fresh version as a proposal; the price is shown first.', fits: 'An older waiting proposal is set aside, kept.', tool: 'redraft_document' },
  versions: { purpose: 'Opens the Versions tab: every version, who wrote it, what it changed, and set-aside proposals.', fits: 'Nothing is ever deleted.', tool: 'read_document' },
  reviewThisDocument: { purpose: 'The five review passes read the current version and raise issues on its parts.', fits: 'Asks first at the measured price; issues land in the Issues tab and the Risks view.', tool: 'review_document' },
  reviewIt: { purpose: 'Confirms the review at the price shown.', fits: 'As "Review this draft".', tool: 'review_document' },
  reviewAgain: { purpose: 'Reviews a version the five passes have already read, adding a second set of issues.', fits: 'As "Review this draft".', tool: 'review_document' },
  saveAsNewVersion: { purpose: 'Saves the owner\'s edit as the next version.', fits: 'Earlier versions are kept; an accepted draft then needs accepting again.', tool: none('the owner\'s own words (decision 301): Lex writes a proposal and the owner uses it') },
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
  saveTheDocument: { purpose: 'Saves a draft the owner wrote.', fits: 'As "Add a draft".', tool: 'propose_document_text' },
  title: { purpose: 'The draft\'s title.', fits: 'Shown in the tree and on the record.', tool: 'propose_document_text' },
  textWithParts: { purpose: 'The draft\'s text; "## " starts each numbered part.', fits: 'Parts are numbered D.<action>.<n>.<part>; issues attach to parts.', tool: 'propose_document_text' },
}

const TABS: Record<keyof typeof DOCUMENT_TAB_WORD, GuideText> = {
  text: { purpose: 'The draft\'s current text, part by part.', fits: 'For a clause, the caveat is always the first line.', tool: 'read_document' },
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
  draftWhatHeadingNeeds: { purpose: 'Drafts everything the actions under a heading still need.', fits: 'Asks first at the measured price; each draft is saved as a proposal.', tool: 'draft_heading_needs' },
  changeWhatThisNeeds: { purpose: 'Sets which drafts an action needs by hand, with a reason.', fits: 'Overrides the rule that works it out from the avenue and the heading\'s kind.', tool: 'set_document_needs' },
  generateItFree: { purpose: 'Generates the collision report.', fits: 'Free.', tool: 'generate_collision_report' },
  writeIt: { purpose: 'Opens a form for the owner to write a missing draft.', fits: 'As "Add a draft".', tool: 'propose_document_text' },
  needsDerived: { purpose: 'Lets the rule work out what the action needs.', fits: 'From its avenue and its heading\'s kind.', tool: 'set_document_needs' },
  needsNothing: { purpose: 'Says the action needs no draft, with a reason.', fits: 'As "Change what this needs".', tool: 'set_document_needs' },
  needsSet: { purpose: 'Names exactly the drafts the action needs.', fits: 'As "Change what this needs".', tool: 'set_document_needs' },
}
const WORKSPACE: Record<keyof typeof WORKSPACE_UI, GuideText> = {
  conditionsTitle: { purpose: 'The idea\'s own numbered list of conditions the proposal must meet.', fits: 'Each action says which conditions it delivers; conditions_coverage shows a condition no action delivers as NO ACTION.', limits: 'Each condition is one short sentence; the box shows its limit.', tool: 'change_condition (the owner\'s list), propose_condition (Lex\'s suggestion), answer_condition_proposal' },
  moveConditionUp: { purpose: 'Moves a condition one place up the list; the numbers follow the order.', fits: 'Actions keep the conditions they deliver, whatever their number.', tool: 'change_condition (op: up)' },
  moveConditionDown: { purpose: 'Moves a condition one place down the list.', fits: 'As ↑.', tool: 'change_condition (op: down)' },
  retireCondition: { purpose: 'Retires a condition: kept, listed under "Retired (kept)", and Bring back restores it.', fits: 'Nothing is deleted.', tool: 'change_condition (op: retire)' },
  addCondition: { purpose: 'Adds a condition, in the owner\'s words, to the end of the list.', fits: 'As the conditions list.', limits: 'The box shows its limit.', tool: 'change_condition (op: add)' },
  addItToList: { purpose: 'Takes Lex\'s proposed condition into the owner\'s list.', fits: 'Lex\'s proposals change nothing until added; Dismiss sets one aside.', tool: 'answer_condition_proposal' },
  group: { purpose: 'Chooses how the list is grouped: by heading, cause, avenue or policy test.', fits: 'Organising offers all four; Drafting groups by heading.', tool: none('a view of the list; group_actions gives Lex the same grouping') },
  hideAllHeadings: { purpose: 'Hides every heading\'s actions from the list at once.', fits: 'Hidden is not ruled out: the actions stay live and counted.', tool: 'hide_action_heading (one heading at a time)' },
  showAllHeadings: { purpose: 'Shows every hidden heading\'s actions again.', fits: 'As "Hide all headings".', tool: 'hide_action_heading (hidden: false)' },
  titleThemWithLex: { purpose: 'Lex proposes a short title for every action that has no title and no proposal waiting; it reads "N actions have no title · Title them with Lex", with its price.', fits: 'On the Organising toolbar\'s "Lex and checks" row. Pressing it also shows the Untitled filter, so the N are on screen. Each proposal waits on its row under the statement ("Lex proposes: … — Accept · Not this"); a title the owner wrote is never replaced.', limits: 'The price is measured from past runs (shown on the button).', tool: 'title_actions, answer_title_proposals' },
  classifyWithLex: { purpose: 'Lex proposes the causes, avenue and conditions for every action that has none (on the Organising page).', fits: 'Proposals sit beside the owner\'s answers; nothing changes until accepted. The seven "Who, how and against" answers are proposed per action, from its record ("Ask Lex").', tool: 'classify_actions, propose_action_slots' },
  dismissThemAll: { purpose: 'Sets aside every answer Lex has proposed for "Who, how and against", on every action.', fits: 'The owner\'s own answers are not touched. (Its button left the screen with the step tabs, 26-X; Lex can still do it.)', tool: 'answer_slot_proposal (accept: false)' },
  findDuplicates: { purpose: 'Lists pairs of actions that may say the same thing.', fits: 'Free: no model is called. Merging a pair is the owner\'s choice, and can be undone.', tool: 'find_action_duplicates, merge_actions' },
  askFourSet: { purpose: 'Four models each answer the same six questions about every action, and a judge writes one digest keeping each model\'s position named. Each model reads an action\'s accepted draft where one exists, otherwise its statement, and the digest says which for each.', fits: 'On the Deepening page, section 2 (it moved from the Organising toolbar, 26-X X3; heading digests stay in Organising). Asks first at the price shown, measured over drafts; nothing is added to the list.', tool: none('a priced run started from the screen') },
  printAll: { purpose: 'A printable Actions Pack (Word and PDF) of every action, every paragraph numbered.', fits: 'No model is called.', tool: none('a file the screen builds') },
  addHeading: { purpose: 'Adds a heading, named by the owner, to group actions under.', fits: 'A primary button: pressing it opens the name box. Headings group actions into instruments; each can be given a kind.', limits: 'The box shows its limit.', tool: 'create_action_heading' },
  suggestHeadings: { purpose: 'Lex reads the Guiding Policy and suggests headings.', fits: 'The owner adds the ones they want.', tool: 'suggest_action_headings' },
  listFilter: { purpose: 'Filters the list: all actions, Unreviewed, Conflicts, or Untitled.', fits: 'Unreviewed means Lex has a proposal waiting or the action was never tested against the policy.', tool: 'list_actions' },
  askFourHeading: { purpose: 'As "Ask four models about the whole set", for the actions under one heading.', fits: 'Asks first at the price shown.', tool: none('a priced run started from the screen') },
  printHeading: { purpose: 'Prints one heading\'s actions as an Actions Pack (Word and PDF).', fits: 'As "Print all".', tool: none('a file the screen builds') },
  draftAllLegislative: { purpose: 'Drafts a drafting instruction for every legislative action under the heading that has none.', fits: 'Asks first with the total price; each draft is stored as it completes, so stopping loses nothing.', tool: 'draft_document (one action at a time)' },
  draftThem: { purpose: 'Confirms "Draft all legislative actions" at the price shown.', fits: 'As "Draft all legislative actions".', tool: 'draft_document' },
  stopAfterThis: { purpose: 'Stops "Draft all legislative actions" once the current draft finishes.', fits: 'Drafts already done are kept; pressing again carries on with the rest.', tool: none('a control on a run the screen is making') },
  reorder: { purpose: 'The drag handle (Organising): drag a row, or use the arrow keys, to reorder the list.', fits: 'The list order is the owner\'s; the order of what must come first comes from "Must come after" on each record.', tool: none('a screen control') },
  openRecord: { purpose: 'Opens the action\'s record beneath its row, on the Drafting page.', fits: 'The record opens with its drafts at the top; every other section is closed under one line saying where it stands.', tool: 'get_action' },
  closeRecord: { purpose: 'Closes the opened record.', fits: 'Nothing is saved or lost by closing.', tool: none('a screen control') },
  ruledOutBlock: { purpose: 'The actions ruled out or merged away, each with its reason.', fits: 'Kept: nothing here is deleted; Restore brings one back.', tool: 'restore_actions, unmerge_actions' },
  laterPhaseBlock: { purpose: 'The actions parked for a later phase.', fits: 'Still the owner\'s and still in the proposal; Bring back returns one to the list.', tool: 'park_actions, restore_actions' },
  retiredHeadingsBlock: { purpose: 'Headings retired by a re-sort or by hand.', fits: 'Kept; Bring back restores one.', tool: 'retire_action_heading' },
  blockShow: { purpose: 'Opens a kept block or a digest.', fits: 'A screen control.', tool: none('a screen control') },
  blockHide: { purpose: 'Closes a kept block or a digest.', fits: 'A screen control.', tool: none('a screen control') },
  restore: { purpose: 'Brings a ruled-out or merged-away action back into the list.', fits: 'A merged-away part comes out of the action it was tucked into.', tool: 'restore_actions' },
}
const VIEWS: Record<keyof typeof WORKSPACE_VIEW_WORD, GuideText> = {
  list: { purpose: 'The actions as a list, grouped.', fits: 'Both pages have it; Drafting has only the list.', tool: 'list_actions' },
  board: { purpose: 'The actions as cards on a board by heading, with possible duplicates outlined.', fits: 'An Organising view; its writes are the list\'s own.', tool: 'list_actions, find_action_duplicates' },
  coverage: { purpose: 'Causes against actions: which causes each action attacks, and any cause no action attacks.', fits: 'An Organising view.', tool: 'causes_without_action' },
  conditions: { purpose: 'Conditions against actions: a condition no action delivers reads NO ACTION.', fits: 'An Organising view.', tool: 'conditions_coverage' },
  order: { purpose: 'The order the actions must happen in, worked out from what each must come after.', fits: 'Its tab left with the step tabs (26-X); each record\'s Order section still sets what it must come after.', tool: 'set_action_order' },
  who: { purpose: 'The incentive map: who implements each action, their incentive now and what changes it.', fits: 'Its tab left with the step tabs (26-X); it becomes the Deepening\'s "Who delivers and who resists" view (315).', tool: 'set_action_slot' },
}
// 26-X addendum 321–323 — the three toolbar rows, the controls moved onto them, and the "Add action" form
const ROW = { view: 'On the Organising toolbar\'s "View" row, where nothing changes data.', add: 'On the Organising toolbar\'s "Add" row.', lex: 'On the Organising toolbar\'s "Lex and checks" row.' }
const TOOLBAR_G: Record<keyof typeof ORGANISING_TOOLBAR_UI, GuideText> = {
  rowView: { purpose: 'The first toolbar row: how the list is shown — List, Board, Coverage grid, Conditions, Group, Hide all / Show all headings, the find box and Show.', fits: ROW.view, tool: none('a row of screen controls') },
  rowAdd: { purpose: 'The second toolbar row: Add action, Add heading, Suggest headings from my guiding policy, Import actions from a document.', fits: ROW.add, tool: none('a row of screen controls') },
  rowLex: { purpose: 'The third toolbar row: the runs Lex makes and the checks — titles, classify, duplicates, re-sort, the policy test, gaps, print (the four-model digest of the whole set moved to the Deepening, 26-X X3).', fits: `${ROW.lex} Each that spends says its price first.`, tool: none('a row of screen controls') },
  addAction: { purpose: 'Adds an action of the owner\'s own: a title (required), a statement, and a heading (or Unsorted).', fits: `${ROW.add} It is the page\'s primary button. The action lands first under its heading, opened on Drafting, numbered, with its strip at "Defined ◐" until it has a statement and a heading with a kind.`, limits: 'The title and the statement show their limits.', tool: 'add_action' },
  importActions: { purpose: 'Reads a document you have filed and shows a table of every idea in it for you to change and confirm before anything is added.', fits: `${ROW.add} (Moved from above the list.)`, tool: 'import_actions_from_source' },
  checkForGaps: { purpose: 'Looks for actions the guiding policy cannot do without: a free read first, then four models; each suggestion says what fails without it.', fits: `${ROW.lex} (Moved from its own box above the list.) Nothing is an action until you accept it.`, tool: 'run_gap_check' },
  reSort: { purpose: 'Lex sorts the actions into instrument headings, one batch at a time; Undo puts them back.', fits: ROW.lex, tool: none('a run started from the screen') },
  testAgainstPolicy: { purpose: 'Tests the actions that read "? Not tested", and any whose verdict is out of date, against the Guiding Policy; the count says how many of each.', fits: `${ROW.lex} Where an action has an accepted draft the test reads the whole draft (a long one in a call of its own), otherwise its statement; each verdict says which ("tested against the draft …" / "tested against the statement"). The price is on the button, measured over drafts.`, tool: 'test_actions_against_policy' },
  untitledFilter: { purpose: 'A filter on the list: the actions with no title.', fits: 'In "Show" on the View row; "Title them with Lex" turns it on, so its count is the rows shown.', tool: 'list_actions' },
  acceptAllTitles: { purpose: 'Accepts every title Lex has proposed and that waits on its row.', fits: `${ROW.lex} Beside "Title them with Lex", only while proposals wait. A row the owner has titled since keeps the owner\'s title.`, tool: 'answer_title_proposals' },
  lexProposes: { purpose: 'Lex\'s proposed title for the action, under its statement on the row.', fits: 'A proposal: the action keeps no title until it is accepted.', tool: 'answer_title_proposals' },
  acceptTitle: { purpose: 'Takes Lex\'s proposed title as the action\'s title.', fits: 'On the row\'s proposal. A title the owner wrote is never replaced.', tool: 'answer_title_proposals' },
  notThisTitle: { purpose: 'Sets aside Lex\'s proposed title; the action stays untitled.', fits: 'On the row\'s proposal.', tool: 'answer_title_proposals' },
}
const ADD_ACTION_G: Record<keyof typeof ADD_ACTION_UI, GuideText> = {
  dialogTitle: { purpose: 'The "Add action" form: title, statement and heading.', fits: 'Save adds the action as the owner\'s (source USER); Cancel adds nothing.', tool: 'add_action' },
  title: { purpose: 'The new action\'s title — what it does, in a few words.', fits: 'Required.', limits: 'The box shows its limit.', tool: 'add_action (title)' },
  statement: { purpose: 'The new action\'s statement: the practical step, who does what.', fits: 'Optional here; "Defined" needs it. The Action details hold the rest, once added.', limits: '1,000 characters, with a counter.', tool: 'add_action (practicalStep)' },
  heading: { purpose: 'The heading the new action goes under; Unsorted puts it under no heading.', fits: 'The action lands first under it.', tool: 'add_action (heading)' },
  unsorted: { purpose: 'No heading: the action is listed under "No heading" until one is chosen.', fits: 'The default.', tool: 'add_action' },
  kind: { purpose: 'The kind of instrument the action makes — read from its heading, not chosen here.', fits: 'Set on the heading (its row in the list); every action under it shares it.', tool: 'set_heading_kind' },
  save: { purpose: 'Adds the action.', fits: 'A refusal says why in words, and nothing is added.', tool: 'add_action' },
}

/** 321 — "the field guide says which row a control is on": the existing workspace controls, by row. */
const WORKSPACE_ROW: Partial<Record<keyof typeof WORKSPACE_UI, keyof typeof ROW>> = {
  group: 'view', hideAllHeadings: 'view', showAllHeadings: 'view', listFilter: 'view',
  addHeading: 'add', suggestHeadings: 'add',
  classifyWithLex: 'lex', findDuplicates: 'lex', printAll: 'lex',
}
const onRows = <K extends string>(texts: Record<K, GuideText>, rows: Partial<Record<K, keyof typeof ROW>>): Record<K, GuideText> =>
  Object.fromEntries((Object.keys(texts) as K[]).map((k) => [k, rows[k] && !texts[k].fits.includes(ROW[rows[k]!]) ? { ...texts[k], fits: `${ROW[rows[k]!]} ${texts[k].fits}` } : texts[k]])) as Record<K, GuideText>

const NOTEBOOK: Record<keyof typeof NOTEBOOK_UI, GuideText> = {
  bringBack: { purpose: 'Brings set-aside notes back.', fits: 'Setting aside never deletes a note.', tool: 'answer_notes (op: bring_back)' },
  shareWithTeam: { purpose: 'Shares one of the user\'s own notes with the team.', fits: 'Only a note\'s author can share it.', tool: 'answer_notes (op: share)' },
  makeMineOnly: { purpose: 'Makes one of the user\'s own notes private to them.', fits: 'Only a note\'s author can make it private.', tool: 'answer_notes (op: mine_only)' },
  bringBackIntoRecord: { purpose: 'Brings a set-aside note back into the record.', fits: 'As Bring back.', tool: 'answer_notes (op: bring_back)' },
  putInRecord: { purpose: 'The owner takes a note Lex wrote (unreviewed) into the record.', fits: 'Lex\'s own findings wait, unreviewed, until the owner puts them in.', tool: 'answer_notes (op: put_in_record)' },
}

const FILTERS: Record<keyof typeof TREE_FILTER_WORD, GuideText> = {
  all: { purpose: 'Shows every action\'s drafts.', fits: 'A filter on the tree.', tool: 'list_documents' },
  missing: { purpose: 'Shows actions missing a draft they need.', fits: 'A filter on the tree.', tool: 'list_documents' },
  drafted: { purpose: 'Shows drafts drafted but not accepted.', fits: 'A filter on the tree.', tool: 'list_documents' },
  accepted: { purpose: 'Shows accepted drafts.', fits: 'A filter on the tree.', tool: 'list_documents' },
}

// 26-X X3b §7 — the draft words that were hard-coded in their components
const DRAFTS_G: Record<keyof typeof DRAFTS_UI, GuideText> = {
  ideaTab: { purpose: 'The idea page\'s tab listing the drafts on its actions, read-only.', fits: 'Drafted and accepted in the Deepening and on the Drafting page. Uploaded files are under Sources, not here.', tool: 'list_documents' },
  ideaTabLead: { purpose: 'Says what the Drafts tab holds and where its drafts are worked on.', fits: 'On the idea page\'s Drafts tab.', tool: 'list_documents' },
  deepeningTree: { purpose: 'The drafts tree on the Deepening: every action\'s drafts, with their numbers, kinds and status, and what is still needed.', fits: 'Below the Deepening\'s six sections.', tool: 'list_documents, read_document' },
  risksByDraft: { purpose: 'The Risks view\'s issues grouped by the draft they were raised on.', fits: 'In the Deepening, section 3.', tool: 'review_document' },
  risksOnAction: { purpose: 'Issues raised on an action or the proposal, not on one of its drafts.', fits: 'In the Risks view, under the drafts.', tool: 'review_document' },
  findInTree: { purpose: 'Finds a draft in the tree by title or number (38, 38.2, D.38.2).', fits: 'The drafts tree.', tool: 'list_documents' },
  noDraftYet: { purpose: 'Says a draft the action needs does not exist yet.', fits: 'In the drafts tree, beside the kind.', tool: 'list_documents' },
  kindToAdd: { purpose: 'Chooses the kind of draft "Add a draft" adds.', fits: 'On the record\'s Drafts section.', tool: 'propose_document_text' },
  eachDraft: { purpose: 'Lists each draft a run queued, with its state.', fits: 'Under "Draft what this heading needs".', tool: 'list_documents' },
}

// ── labels held in the older tables ────────────────────────────────────────────────────────────────────────────
const SECTIONS: Record<RecordSection, GuideText> = {
  brief: { purpose: 'The Brief: the owner\'s instructions for the action\'s draft — what it must do, what it is modelled on, its tone and form, what it must include and must not, and the kind\'s own fields.', fits: 'Under the statement and above the Draft, with "Draft it" between them. The drafter reads it first, then the Action details. A draft clause\'s own fields are its drafting instruction.', limits: 'Every save is a version; the earlier ones are kept.', tool: 'read_brief, propose_brief' },
  detail: { purpose: 'The action\'s full explanation: what it does and why, its parts and reasoning.', fits: 'The statement is the headline; an instrument\'s text goes in a draft, never here.', limits: 'No limit; more than 3,000 characters of instrument-like text from Lex is refused.', tool: 'set_action_detail, add_action_details_section' },
  documents: { purpose: 'The action\'s drafts: each with its number, kind, status and version, and what is still needed.', fits: 'Opens each draft in the draft view.', tool: 'list_documents, read_document' },
  law: { purpose: 'The law rows this action\'s drafting instruction wrote.', fits: 'The idea\'s whole law is on the Overview\'s Law tab.', tool: 'read_document' },
  costs: { purpose: 'The cost ranges, cost lines, or "no cost, because".', fits: 'The full costing is in the Deepening.', tool: 'set_action_costs, add_cost_line, set_no_cost_reason' },
  order: { purpose: 'What this action must come after, and why.', fits: 'The order is derived from these links.', tool: 'set_action_order' },
  comments: { purpose: 'The comment thread on the action.', fits: 'Everyone who can see the idea sees it.', tool: 'add_action_comment, reply_to_comment' },
}
const SLOTS: Record<AnySlot, GuideText> = {
  who: { purpose: 'Who implements it, a body or a role, inside or outside government.', fits: 'Stored on the action itself.', tool: 'set_action_slot (slot: who)' },
  incentiveNow: { purpose: 'Whether the implementer\'s present incentive pulls with the action, against it or neither, and why.', fits: 'Read by the incentive map.', tool: 'set_action_slot (slot: incentiveNow)' },
  whatChangesIt: { purpose: 'What in the proposal changes that incentive, usually another action (linked).', fits: 'Read by the incentive map.', tool: 'set_action_slot (slot: whatChangesIt)' },
  skill: { purpose: 'Why they would have the skill to do it.', fits: 'On the Deepening, section 6.', tool: 'set_action_slot (slot: skill)' },
  how: { purpose: 'How it is enforced, by whom, with what consequence.', fits: 'On the Deepening, section 6.', tool: 'set_action_slot (slot: how)' },
  against: { purpose: 'What will oppose it, and the counter to each.', fits: '"Specific enough" needs it answered.', tool: 'set_action_slot (slot: against)' },
  worked: { purpose: 'The measure that would tell us it worked.', fits: 'On the Deepening, section 6.', tool: 'set_action_slot (slot: worked)' },
}
const DIRECTIONS_G: Record<Direction, GuideText> = {
  WITH: { purpose: 'The present incentive pulls with the action.', fits: 'A choice on "Incentive now".', tool: 'set_action_slot (direction)' },
  AGAINST: { purpose: 'The present incentive pulls against the action.', fits: 'A choice on "Incentive now".', tool: 'set_action_slot (direction)' },
  INDIFFERENT: { purpose: 'The present incentive neither helps nor hinders.', fits: 'A choice on "Incentive now".', tool: 'set_action_slot (direction)' },
}
const STEP_G: Record<ActionsStep, GuideText> = {
  // 26-X 308: the step tabs are gone; these four words now head the record's sections (one line each, saying where it stands)
  1: { purpose: 'The record\'s classification: the heading, avenue, causes and the policy verdict.', fits: 'The list is sorted on the Organising page; this is one action\'s part of it.', tool: 'classify_actions, set_action_facets, merge_actions, rule_out_actions' },
  2: { purpose: 'Who, how and against for this action.', fits: 'Edited on the Deepening page, section 6 "Who delivers and who resists", per action; no longer a section of the record (315).', tool: 'set_action_slot, propose_action_slots' },
  3: { purpose: 'A cost range for this action.', fits: 'A section of the record; the roll-up is in the Deepening.', tool: 'set_action_costs, add_cost_line, set_no_cost_reason' },
  4: { purpose: 'What this action must come after.', fits: 'A section of the record; the order is derived from these links.', tool: 'set_action_order' },
}
const COST_G: Record<keyof typeof COST_LINE_LABEL, GuideText> = {
  implementationCost: { purpose: 'What it costs government to put the action in place.', fits: 'One of the three cost ranges.', tool: 'set_action_costs' },
  enforcementCost: { purpose: 'What it costs to enforce once in place.', fits: 'One of the three cost ranges.', tool: 'set_action_costs' },
  regulatoryFriction: { purpose: 'What it costs those who must comply.', fits: 'One of the three cost ranges.', tool: 'set_action_costs' },
}

// ── 26-X (308–318) — the lifecycle, the checklist, the two pages, the strip, the lock ──────────────────────────────────
const LIFECYCLE_G: Record<keyof typeof LIFECYCLE_STAGE_WORD, GuideText> = {
  creation: { purpose: 'Lifecycle stage 1: saying what you want to change; Lex’s first pass over it.', fits: 'Its state line counts Lex’s runs; its screen is where material is added and the idea re-run.', tool: none('a stage of the lifecycle, shown on the bar') },
  development: { purpose: 'Lifecycle stage 2: the problem, the causes and the guiding policy, then organising the actions, drafting each one and the Deepening.', fits: 'It carries a checklist, not sub-stages; its state line counts the actions, drafted and accepted.', tool: 'list_actions, list_documents' },
  privateScrutiny: { purpose: 'Lifecycle stage 3: what your allies say is wrong.', fits: 'Not yet open: its page is its own brief, after this one.', tool: none('not yet built') },
  publicScrutiny: { purpose: 'Lifecycle stage 4: what your opponents say is wrong.', fits: 'Not yet open.', tool: none('not yet built') },
  promotion: { purpose: 'Lifecycle stage 5: winning the support the proposal needs.', fits: 'Not yet open; its plan is the checklist’s last line.', tool: none('not yet built') },
  submission: { purpose: 'Lifecycle stage 6: the idea lodged with a decision-maker — an MP for a Private Member’s Bill, a committee as evidence, a consultation, a department.', fits: 'Recorded with the body, the date and the form, by the owner; nothing records one yet, so it reads "not submitted".', tool: none('not yet built') },
  inForce: { purpose: 'Lifecycle stage 7: did it work, once in force.', fits: 'Stated and not built: there is nothing yet to track it with.', tool: none('not yet built') },
}
const LIFECYCLE_UI_G: Record<keyof typeof LIFECYCLE_UI, GuideText> = {
  youAreHere: { purpose: 'Marks the stage, page or checklist line the user is on, in words.', fits: 'Always with a filled disc and a heavier border — never colour alone.', tool: none('a screen marker') },
  notYetOpen: { purpose: 'Says a stage has nothing built behind it yet.', fits: 'Private Scrutiny, Public Scrutiny and Promotion read so until their pages are built.', tool: none('a state in words') },
  notYetAvailable: { purpose: 'Says something is stated but not built.', fits: 'In Force, and the Promotional plan.', tool: none('a state in words') },
  notSubmitted: { purpose: 'Says the idea has not been lodged with a decision-maker.', fits: 'Submission’s state until a submission is recorded.', tool: none('a state in words') },
}
const PROGRESS_G: Record<keyof typeof PROGRESS_WORD, GuideText> = {
  defined: { purpose: 'The action has its statement, a heading, and the heading’s kind.', fits: 'The first state of the strip; ◐ while it is begun but not all three are set (an action just added with only its title reads ◐).', tool: 'assign_action_heading, set_heading_kind' },
  briefed: { purpose: 'The action has a saved Brief for its draft, or needs no draft.', fits: 'A draft clause also counts once it has a drafting instruction (its own fields are the instruction). ◐ when only some kinds of the draft are briefed.', tool: 'read_brief, propose_brief' },
  drafted: { purpose: 'The action’s draft (its instrument) has a version.', fits: 'Companions — the collision report, the explanatory note — are not the draft; a costing is the draft only of a financial action.', tool: 'draft_document, list_documents' },
  reviewed: { purpose: 'All five review passes have read the draft’s current version.', fits: '◐ when some have; a new version needs reading again.', tool: 'review_document' },
  accepted: { purpose: 'The owner has accepted the draft at its current version.', fits: '◐ when it was accepted at an earlier version and has changed since. Accepted or "needs no draft" counts as done for the Deepening.', tool: 'accept_document' },
  noDraft: { purpose: 'The action needs no draft, for the reason the owner gave.', fits: 'Shown as "Defined ● · needs no draft ✓"; it counts as done for the Deepening.', tool: 'set_document_needs (mode: nothing)' },
}
const CHECKLIST_G: Record<keyof typeof CHECKLIST_WORD, GuideText> = {
  problem: { purpose: 'Checklist line 1: is the problem written?', fits: 'Opens the problem in the Diagnosis.', tool: none('a line that opens a section') },
  causes: { purpose: 'Checklist line 2: the causes, and how many have actions against them.', fits: 'Opens the causes.', tool: 'causes_without_action' },
  policy: { purpose: 'Checklist line 3: whether a guiding policy is chosen.', fits: 'Opens the guiding policy.', tool: none('a line that opens a section') },
  organising: { purpose: 'Checklist line 4: the live actions, their headings and conditions, and how many are untested against the policy.', fits: 'Opens the Organising page.', tool: 'list_actions' },
  drafting: { purpose: 'Checklist line 5: how many actions are accepted, need no draft, or are still to go.', fits: 'Opens the Drafting page; "0 to go" opens the Deepening.', tool: 'list_documents' },
  deepening: { purpose: 'Checklist line 6: the Deepening — collisions, four models, the review passes, costs, who delivers.', fits: 'Locked until every live action is accepted or needs no draft; the owner can open it early with a reason.', tool: none('a page; its runs are started from the screen') },
  promotion: { purpose: 'Checklist line 7: the promotional plan.', fits: 'Not yet available.', tool: none('not yet built') },
  locked: { purpose: 'Says the Deepening is locked, with how many actions are still to go.', fits: 'Shown with 🔒 and the word, never a colour alone.', tool: none('a state in words') },
}
const PAGE_G: Record<keyof typeof PAGE_UI, GuideText> = {
  organising: { purpose: 'The page with the list’s organising tools only: headings, classify, duplicates, the policy test, rule out, Later phase, the views and the find box.', fits: 'Every row shows its progress strip; there is no drafting control on it. An action’s title goes to Drafting with it open.', tool: 'list_actions, classify_actions' },
  drafting: { purpose: 'The same list with each action’s progress, filtered by where each stands; opening an action shows its record with its drafts at the top.', fits: 'Its counts say how many are accepted, need no draft, or are still to go.', tool: 'list_documents, draft_document' },
  backToOrganising: { purpose: 'Returns from an action on Drafting to the Organising page.', fits: 'At the same place in the list, with the same filters and find box.', tool: none('a screen control') },
  openInDrafting: { purpose: 'Opens an action on the Drafting page.', fits: 'On every Organising row; the title does the same.', tool: 'get_action' },
  needsNoDraftBecause: { purpose: 'Records that the action needs no draft, with the owner’s reason.', fits: 'The same store as the tree’s "Needs no draft"; the action then counts as done for the Deepening.', limits: '300 characters, with a counter.', tool: 'set_document_needs (mode: nothing)' },
  saveNoDraft: { purpose: 'Saves "needs no draft" with the reason typed.', fits: 'As "Needs no draft, because…".', tool: 'set_document_needs (mode: nothing)' },
  needsDraftAfterAll: { purpose: 'Takes "needs no draft" back: what the action needs is worked out again from its avenue and heading.', fits: 'The reason given before is not kept on the action.', tool: 'set_document_needs (mode: derived)' },
}
// ── 26-Z (decisions 344–348) — Where am I?, the panels, Focus view, never losing your place ──────────────────────────────────────────
type PanelKey = '1' | '2' | '3' | '4' | '5' | '6' | '7'
const PANEL_G: Record<PanelKey, GuideText> = {
  1: { purpose: 'Panel 1: where you are — the seven stages and Development’s seven chapters, each with its state.', fits: 'On a desktop (Full view and Focus view) it is the bar above the workspace, out of view when the page opens: scroll up to see it. On a phone it is a panel of its own, and the Where am I? menu shows the same lines.', tool: none('a screen; Lex reads the same state through its own tools') },
  2: { purpose: 'Panel 2: what to do next — the worklist, then what to read, the gaps and what you know that we do not.', fits: 'Left column, top half, on a desktop. The panel opened when the address names nothing else.', tool: none('a screen') },
  3: { purpose: 'Panel 3: the conversation with Lex.', fits: 'Left column, lower half, "Lex" tab, on a desktop. On a phone its typing box stays above the bottom bar and above the keyboard.', tool: none('this is Lex') },
  4: { purpose: 'Panel 4: your private notes on this idea.', fits: 'Left column, lower half, "Notes" tab, on a desktop. Private to you.', tool: none('notes are private; Lex does not read them') },
  5: { purpose: 'Panel 5: the chapters to work on and, under Organising and Drafting, the actions by number.', fits: 'Choosing one opens it in panel 6; going back returns to this list where you left it.', tool: 'list_actions' },
  6: { purpose: 'Panel 6: the chapter or the record you are working on; its name is that chapter ("Organising the actions") or that record ("#38").', fits: 'The centre column on a desktop: the problem, the causes, the policy, the Organising or Drafting list with the record open, or the Deepening.', tool: 'get_action' },
  7: { purpose: 'Panel 7: the research and sources.', fits: 'The right column on a desktop.', tool: 'read_source' },
}
const PANEL_PLACE_G: Record<keyof typeof PANEL_PLACE_WORD, GuideText> = {
  top: { purpose: 'Says a panel sits across the top on a desktop.', fits: 'In the text label of a panel block in the Where am I? menu.', tool: none('a label') },
  left: { purpose: 'Says a panel sits in the left column on a desktop.', fits: 'As "across the top".', tool: none('a label') },
  centre: { purpose: 'Says a panel sits in the centre column on a desktop.', fits: 'As "across the top".', tool: none('a label') },
  right: { purpose: 'Says a panel sits in the right column on a desktop.', fits: 'As "across the top".', tool: none('a label') },
}
const WHERE_SENTENCES_G: Record<keyof typeof WHERE_SENTENCES, GuideText> = {
  stages: { purpose: 'The first of three sentences shown once at the top of the Where am I? menu: what a stage is.', fits: 'Dismissed with "Got it"; brought back with "?".', tool: none('a sentence') },
  chapters: { purpose: 'The second sentence: what a chapter is.', fits: 'As the first.', tool: none('a sentence') },
  panels: { purpose: 'The third sentence: what a panel is.', fits: 'As the first.', tool: none('a sentence') },
}
const WHERE_UI_G: Record<keyof typeof WHERE_UI, GuideText> = {
  button: { purpose: 'Opens the Where am I? menu: Panel, Chapter and Stage.', fits: 'At the left of the bar along the foot of the screen. The menu rises from the bottom, Panel → Chapter → Stage upwards, so the nearest level is under your thumb. Drag over a level to open it and lift on an item to go there, or tap a level then tap an item. On a desktop in Focus view, W opens it.', tool: none('a screen control') },
  stage: { purpose: 'The menu’s Stage level: the seven stages, each with its state.', fits: 'Choosing Development opens its To-do; stages with nothing built yet say so and cannot be chosen.', tool: none('a screen control') },
  chapter: { purpose: 'The menu’s Chapter level: Development’s seven chapters, each with its state and the Deepening’s lock.', fits: 'Choosing one opens it in panel 6.', tool: none('a screen control') },
  panel: { purpose: 'The menu’s Panel level: a small picture of the desktop with its seven panels.', fits: 'Tap a block to work in that panel; each block says where it sits on a desktop.', tool: none('a screen control') },
  youAreHere: { purpose: 'Marks your stage, chapter and panel in the menu, in words.', fits: 'With a filled disc and a heavier border, never colour alone.', tool: none('a screen marker') },
  gotIt: { purpose: 'Folds away the three sentences at the top of the menu.', fits: 'Remembered on this device; "?" brings them back.', tool: none('a screen control') },
  explain: { purpose: 'Brings back the three sentences about stages, chapters and panels.', fits: 'At the top of the Where am I? menu.', tool: 'explain_field' },
  explainLabel: { purpose: 'The spoken name of the "?" button.', fits: 'Read by a screen reader and shown on hover.', tool: none('a label') },
  close: { purpose: 'Closes the Where am I? menu without going anywhere.', fits: 'Tapping outside it, pressing Esc, or swiping it back to its edge does the same.', tool: none('a screen control') },
  addressPanelTitle: { purpose: 'The panel the address opens: your place one line per level — "S2: Stage 2 Development", "C4: Chapter 4 Organising the actions", "P6: Organising the actions".', fits: 'Tap the address at the right of the bottom bar to open it; it stays until you press Close, tap the address again or press Esc. It opens by itself the first time.', tool: none('a screen panel') },
  backWhereYouWere: { purpose: 'Says the page has put you back where you were on this device: the same chapter, record, panel and scroll.', fits: 'Shown briefly after a reload or a plain link to the idea. A link that names a place goes there instead.', tool: none('a message') },
  focusView: { purpose: 'Shows one panel at a time on a desktop, exactly as on a phone, with the Where am I? bar along the foot.', fits: 'Keys: ← back, → forward, W opens Where am I?, Esc closes it. Remembered in this browser. Below 768 px Focus view is the only layout.', tool: none('a screen control') },
  fullView: { purpose: 'Shows the three columns side by side, as before; panels can be hidden and resized.', fits: 'Remembered in this browser.', tool: none('a screen control') },
  focusToggleLabel: { purpose: 'The spoken name of the Focus view · Full view switch.', fits: 'In the header on a desktop.', tool: none('a label') },
  noChaptersOutside: { purpose: 'What the Chapter level says outside Development: that stage and its state.', fits: 'Only Development has chapters today.', tool: none('a label') },
  chaptersOfActions: { purpose: 'The list of actions under Organising or Drafting in panel 5.', fits: 'Choosing one opens its record in panel 6. Swipe left to come back.', tool: 'list_actions' },
  addressLabel: { purpose: 'Your place as an address, "S2 · C5 · P6": stage, chapter, panel.', fits: 'At the right of the bottom bar. Tap it to see it spelled out one line per level. It comes from the page’s address, so a copied link opens the same place.', tool: none('a label') },
}
const STAGEBAR_ROW_G: Record<keyof typeof STAGEBAR_ROW_WORD, GuideText> = {
  stages: { purpose: 'Labels the row of the seven stages, from Creation to In Force, on the bar above the workspace.', fits: 'On a desktop, at the left of the row. The seven stages always sit in one row there.', tool: none('a label') },
  chapters: { purpose: 'Labels the row of Development’s seven chapters, each with its state, under the stages.', fits: 'On a desktop, at the left of the row. Each chapter opens its page.', tool: none('a label') },
}
const DRAFT_RESTORE_G: Record<keyof typeof DRAFT_RESTORE_UI, GuideText> = {
  offer: { purpose: 'Says this box held text you had not sent or saved when the page was closed or reloaded.', fits: 'Kept on this device only, for Lex’s message, Edit the action, Edit the action details, the Brief, comments and Add research. Never sent by itself.', tool: none('kept on the device, not on the server') },
  restore: { purpose: 'Puts the unsent text back in the box.', fits: 'You still press Send or Save yourself.', tool: none('a screen control') },
  discard: { purpose: 'Throws the unsent text away.', fits: 'Nothing on the server changes.', tool: none('a screen control') },
}
const DRAFT_FILTER_G: Record<keyof typeof DRAFTING_FILTER_WORD, GuideText> = {
  all: { purpose: 'Shows every live action on the Drafting page.', fits: 'Actions in Later phase are not counted.', tool: 'list_actions' },
  toBrief: { purpose: 'Shows the actions whose draft has no Brief yet.', fits: 'A filter on the Drafting page; each action is under exactly one.', tool: 'list_documents' },
  toDraft: { purpose: 'Shows the actions with a Brief and no draft yet.', fits: 'As "to brief".', tool: 'list_documents' },
  toReview: { purpose: 'Shows the actions drafted but not yet read by all five review passes.', fits: 'As "to brief".', tool: 'list_documents' },
  toAccept: { purpose: 'Shows the actions whose draft has been reviewed and not yet accepted.', fits: 'As "to brief".', tool: 'list_documents' },
  noDraft: { purpose: 'Shows the actions that need no draft, with their reasons.', fits: 'They count as done for the Deepening.', tool: 'list_documents' },
  accepted: { purpose: 'Shows the actions whose draft is accepted at its current version.', fits: 'They count as done for the Deepening.', tool: 'list_documents' },
}
const LOCK_G: Record<keyof typeof DEEPENING_LOCK_UI, GuideText> = {
  deepenNow: { purpose: 'The owner opens the Deepening before every action is drafted.', fits: 'It asks for a reason, recorded with the owner and the time; everything the Deepening produces then says "Deepened with N actions undrafted — reason: …".', tool: none('the owner’s decision, made on the screen') },
  overrideReason: { purpose: 'The owner’s reason for deepening early.', fits: 'Printed on the Deepening page and on every output it produces.', limits: 'The box shows its limit.', tool: none('the owner’s decision, made on the screen') },
  recordOverride: { purpose: 'Records the reason and opens the Deepening.', fits: 'An override is added to the record, never replacing an earlier one.', tool: none('the owner’s decision, made on the screen') },
}

// 26-X X3 §6a — the Deepening page's sections
const DEEPENING_G: Record<keyof typeof DEEPENING_UI, GuideText> = {
  collision: { purpose: 'The consequential schedule and every draft\'s collision report, with counts: the clause\'s own lines, "What depends on this" and "Provisions that refer to this — for review".', fits: 'Generated from the drafts and the law data; free. Each report says when it is out of date. Actions that need a report and have none are listed.', tool: 'list_documents, read_document' },
  fourModels: { purpose: 'The four-model digest of the whole set, reading each action\'s accepted draft where one exists, otherwise its statement; the digest says which, per action.', fits: 'Heading digests stay on Organising. The price on the button is measured over drafts.', tool: none('a priced run started from the screen') },
  reviews: { purpose: 'The five review passes over every accepted draft: how many have read each one, and the price of the rest.', fits: 'The Risks view below lists every issue the passes raise, by draft.', tool: 'review_document (one draft at a time)' },
  coherence: { purpose: 'The gap check and the conditions × actions table, side by side.', fits: 'The gap check\'s suggestions are not actions until accepted; the table is the owner\'s own links.', tool: 'run_gap_check, conditions_coverage' },
  costs: { purpose: 'Costs and benefits: the cost lines rolled up by heading for years 1 to 5, the analysis (net present value, benefit–cost ratio or "benefits not valued — no BCR"), its Gaps, and Generate the Cost–benefit report.', fits: 'Section 5 of the Deepening. The roll-up shows whatever lines exist, read-only, even while the Deepening is locked; the report is generated once it opens. A one-off line falls in year 1; a per-year line in each year of its duration; a line with no recurrence is under "Not said", counted, never placed in a year.', tool: 'read_cba_summary, explain_cba_figure, generate_cba_report' },
  who: { purpose: 'Who delivers each action and who resists it: the seven answers per action (Who, Incentive now, What changes it, Skill, How, Against, What tells us it worked), the incentive map "By who", and how many actions rely on an implementer whose incentive is against with nothing to change it.', fits: 'On the Deepening page, section 6. It opens whatever the lock says, because it reads the actions, not the drafts. It moved here from each action\'s record (315).', tool: 'set_action_slot, propose_action_slots, answer_slot_proposal' },
  whoShowAll: { purpose: 'Lists every live action in "Who delivers and who resists".', fits: 'One of three filters on section 6 of the Deepening.', tool: 'list_actions' },
  whoShowNotSpecific: { purpose: 'Lists the actions not yet specific enough: Who or Against is unanswered.', fits: 'One of three filters on section 6 of the Deepening.', tool: 'get_action' },
  whoShowNothingChanges: { purpose: 'Lists the actions whose implementer\'s incentive is against and nothing in the proposal changes it.', fits: 'One of three filters on section 6 of the Deepening; the count above it says how many.', tool: 'get_action' },
  reviewAll: { purpose: 'Runs the review passes that have not yet read each accepted draft, one draft after another.', fits: 'Asks first at the summed measured price; a pass that already read a version is not run again; each draft is saved as it finishes.', tool: 'review_document (one draft at a time)' },
  reviewGo: { purpose: 'Confirms "Review every accepted draft" at the price shown.', fits: 'As "Review every accepted draft".', tool: 'review_document' },
  readAgain: { purpose: 'Reads the Deepening\'s sections again from the record.', fits: 'Free; nothing is changed.', tool: none('a screen control') },
  undated: { purpose: 'The column for cost lines that do not say whether they are one-off or per year.', fits: 'Counted and summed apart; never guessed into a year. Say the recurrence on the line to move it.', tool: 'add_cost_line' },
  noHeading: { purpose: 'The row for cost lines on actions not under a heading.', fits: 'As every heading row.', tool: 'set_action_costs' },
  total: { purpose: 'The total of every row.', fits: 'Uprated to the latest price year, as the cost summary.', tool: 'set_action_costs' },
  year: { purpose: 'A year of the five, from the start.', fits: 'One-off lines are in year 1.', tool: 'set_action_costs' },
}

// 26-Y (334–341) — benefit lines, a cost line's appraisal, section 5, the settings, the reports
const CBA_G: Record<keyof typeof CBA_UI, GuideText> = {
  benefits: { purpose: 'What the action is claimed to deliver, beside its costs: what is gained, who gains, how it would be measured, and its value with the value\'s source — or "not valued".', fits: 'In the record\'s Costs section, under the cost lines. A benefit with no source is stored as not valued and never enters a total. The Actions Pack prints Benefits after Costs.', limits: 'Up to 40 lines per action.', tool: 'add_benefit_line, set_benefit_line' },
  addBenefit: { purpose: 'Adds a benefit line to the action.', fits: 'Every save is kept as a revision.', tool: 'add_benefit_line' },
  whatGained: { purpose: 'What is gained, in a phrase.', fits: 'The line\'s name in the report.', limits: '300 characters.', tool: 'add_benefit_line' },
  whoGains: { purpose: 'Who gains: the Exchequer, a department, citizens, business, or other.', fits: 'The report totals valued benefits by who gains.', tool: 'add_benefit_line' },
  whoNamed: { purpose: 'Names who gains, where it is one body ("Cabinet Office").', fits: 'Optional.', limits: '120 characters.', tool: 'add_benefit_line' },
  howMeasured: { purpose: 'How the benefit would be measured, whether or not it is valued.', fits: 'Printed with the line; a measure without a value is still worth stating.', limits: '600 characters.', tool: 'add_benefit_line' },
  valuedAt: { purpose: 'The benefit\'s value: low and high, the price year, one-off or per year, and for how long.', fits: 'Counts only with a source. A single figure is read as a floor.', tool: 'set_benefit_line' },
  notValued: { purpose: 'Marks the benefit as recorded but not valued.', fits: 'It is listed under Gaps in the report and in no total; with nothing valued there is no net present value and no BCR, never a zero.', tool: 'set_benefit_line' },
  notValuedWhy: { purpose: 'Why the benefit is not valued, for example "no source measures this yet".', fits: 'Printed in the report\'s Gaps.', limits: '600 characters.', tool: 'set_benefit_line' },
  source: { purpose: 'Where the value comes from.', fits: 'One of: a source on this idea ([Ref: n]), a held unit-cost row, a Green Book paragraph (a manifest key), or your own estimate with a reason.', tool: 'set_benefit_line' },
  sourceRef: { purpose: 'A numbered source on this idea, as [Ref: n].', fits: 'The number must be in the idea\'s source list.', tool: 'set_benefit_line' },
  sourceBenchmark: { purpose: 'A held unit-cost row (for example Greater Manchester\'s Unit Cost Database).', fits: 'Only rows the platform holds can be chosen.', tool: 'set_benefit_line' },
  sourceCitation: { purpose: 'A paragraph of HM Treasury guidance, as a key such as green-book:8.58.', fits: 'Refused unless the platform holds that paragraph; the nearest held keys are offered.', limits: '60 characters.', tool: 'set_benefit_line' },
  sourceOwner: { purpose: 'Your own estimate.', fits: 'Counts, with your reason, and is listed among the owner\'s assumptions in the report\'s Gaps.', tool: 'set_benefit_line' },
  ownerReason: { purpose: 'The reason behind your own estimate.', fits: 'Printed beside the figure.', limits: '600 characters.', tool: 'set_benefit_line' },
  healthEffect: { purpose: 'Marks a health effect, whose real value is uprated 2% a year before discounting (Green Book 8.58).', fits: 'It is discounted at the same rate as everything else; there is no separate health rate.', tool: 'set_benefit_line' },
  editBenefit: { purpose: 'Opens the benefit line for editing.', fits: 'The old wording is kept as a revision.', tool: 'set_benefit_line' },
  removeBenefit: { purpose: 'Takes the benefit line off the action.', fits: 'Nothing is deleted: it moves to "Removed and set aside" and can be restored.', tool: 'set_benefit_line (status)' },
  restoreBenefit: { purpose: 'Puts a removed or set-aside benefit line back.', fits: 'It counts again if it is valued with a source.', tool: 'set_benefit_line (status)' },
  removedBenefits: { purpose: 'The benefit lines removed, and Lex\'s proposals set aside.', fits: 'Kept, never deleted; each can be restored.', tool: 'list_actions' },
  lexProposes: { purpose: 'A benefit line Lex proposes, waiting for your answer.', fits: 'It counts in nothing until you accept it. Lex may value a benefit only from a source it holds and names.', tool: 'add_benefit_line' },
  forAppraisal: { purpose: 'What a cost line carries for the cost–benefit analysis beyond its figure: who pays, an employer on-cost, the optimism-bias project type, and a citation.', fits: 'Under each cost line in the Costs section.', tool: 'set_cost_line_appraisal' },
  whoPays: { purpose: 'Who pays the cost: the Exchequer, a department, citizens, business, or other.', fits: 'The report totals costs by payer; a line that does not say is listed under Gaps.', tool: 'set_cost_line_appraisal' },
  onCost: { purpose: 'An uplift on a staffing line for employer costs (National Insurance, pension), with its source.', fits: 'Without one the line reads "excludes employer costs" and is a floor. Lex may propose one only with a source it holds; it waits for you.', tool: 'set_cost_line_appraisal' },
  onCostSource: { purpose: 'Where the on-cost rate comes from.', fits: 'Printed in the report\'s Assumptions.', limits: '300 characters.', tool: 'set_cost_line_appraisal' },
  excludesEmployer: { purpose: 'Says a staffing line has no on-cost uplift, so it is a floor.', fits: 'Listed under Gaps in the report.', tool: 'set_cost_line_appraisal' },
  obType: { purpose: 'A capital line\'s project type from Table 1 of the optimism-bias guidance.', fits: 'Optimism bias never changes the headline figures (342): the line is banded from that type\'s lower to its upper bound, in a range shown beside the headline. A running-cost line is banded by the outsourcing row, the nearest analogue, not a rule.', tool: 'set_cost_line_appraisal' },
  obLower: { purpose: 'Lowers the upper end of a capital line\'s optimism-bias band below Table 1\'s upper bound.', fits: 'Owner only, with a reason; it changes the band, never the headline; listed among the owner\'s assumptions.', tool: none('the owner\'s alone') },
  obLowerReason: { purpose: 'Why the rate is lower: which risks are managed.', fits: 'Printed beside the line in the report.', limits: '600 characters.', tool: none('the owner\'s alone') },
  citationKey: { purpose: 'A paragraph of HM Treasury guidance the cost line relies on, as a key such as gb-discounting:3.8.', fits: 'Refused unless the platform holds that paragraph, with the nearest held keys offered. A paragraph number is never typed free-hand.', limits: '60 characters.', tool: 'set_cost_line_appraisal' },
  summary: { purpose: 'The analysis in figures: net present value, benefit–cost ratio, present values of costs and of valued benefits.', fits: 'Computed from the lines and HM Treasury\'s tables with no model; free. Each figure has a trace.', tool: 'read_cba_summary, explain_cba_figure' },
  npv: { purpose: 'Present value of valued benefits minus present value of costs, as a range.', fits: 'Not computed when no benefit is valued.', tool: 'explain_cba_figure' },
  bcr: { purpose: 'Present value of valued benefits divided by present value of costs, as a range.', fits: '"benefits not valued — no BCR" when nothing is valued; never a zero.', tool: 'explain_cba_figure' },
  gaps: { purpose: 'What the analysis does not cover: benefits not valued, lines with no duration or figure, the owner\'s own assumptions, floors, and what the platform does not hold.', fits: 'Printed before the totals in every report.', tool: 'read_cba_summary' },
  generate: { purpose: 'Generates a new version of the Cost–benefit report, as Word and PDF.', fits: 'Free except Lex\'s narrative, whose price is shown; asks first. Opens with the Deepening. Earlier versions are kept.', tool: 'generate_cba_report' },
  generateGo: { purpose: 'Confirms "Generate the Cost–benefit report" at the price shown.', fits: 'As Generate.', tool: 'generate_cba_report' },
  generateFree: { purpose: 'Generates the report without Lex\'s narrative, for nothing.', fits: 'Every table, Gaps and the trace are the same.', tool: 'generate_cba_report (narrative: false)' },
  versions: { purpose: 'Every version of the Cost–benefit report, with Word and PDF, and how many lines have changed since each.', fits: 'A version never changes; a new generation is a new version.', tool: 'read_cba_summary' },
  settings: { purpose: 'The idea\'s appraisal period, start year and price year.', fits: 'On the Overview. The owner sets them; the default is 10 years from the current financial year, in its prices.', tool: 'set_appraisal_period' },
  periodYears: { purpose: 'How many years the analysis covers.', fits: 'The Green Book\'s usual for policy is 10.', limits: '1 to 60 years.', tool: 'set_appraisal_period' },
  startYear: { purpose: 'The first year of delivery, as a financial year.', fits: 'It may not be before the price year.', tool: 'set_appraisal_period' },
  priceYear: { purpose: 'The year the figures are shown in, and the present-value base year.', fits: 'The deflator\'s range is shown beside it; a line in a year the deflator does not hold is not converted and says so.', tool: 'set_appraisal_period' },
  useDefault: { purpose: 'Puts a setting back to its default.', fits: 'The default is recorded as the default, not as your choice.', tool: 'set_appraisal_period' },
  report: { purpose: 'The Cost–benefit report: a summary, Gaps, Assumptions, the tables, sensitivity, optimism bias per line, Lex\'s narrative and the trace.', fits: 'An Output Report; generated from the Deepening, listed here with its versions.', tool: 'generate_cba_report' },
  iaDraft: { purpose: 'An Impact Assessment summary sheet in the government\'s shape, from the same analysis.', fits: 'Not available until the platform holds the IA template.', tool: none('not built until the IA template is held') },
}

// 26-X X2 (309) — the Brief
const BRIEF_G: Record<keyof typeof BRIEF_UI, GuideText> = {
  section: { purpose: 'The Brief for the action\'s draft, with its version and who wrote it.', fits: 'Above "Draft it" and the Draft.', tool: 'read_brief' },
  sectionDraft: { purpose: 'The Draft: the instrument itself, with its companions under it.', fits: 'Below "Draft it".', tool: 'list_documents, read_document' },
  editBrief: { purpose: 'Opens the Brief form for an action that has no Brief yet.', fits: 'Saved as version 1.', tool: none('the owner writes the Brief on the screen; Lex can propose one with propose_brief') },
  editBriefAgain: { purpose: 'Opens the saved Brief to change it.', fits: 'Saving makes a new version; the earlier ones are kept.', tool: none('the owner writes the Brief on the screen; Lex can propose one with propose_brief') },
  saveBrief: { purpose: 'Saves the Brief as a new version.', fits: 'A field over its limit, or an empty Brief, is refused in words; nothing is cut.', tool: none('the owner saves on the screen') },
  askLexForBrief: { purpose: 'Lex writes a Brief from the statement, Action details, answers and conditions.', fits: 'It waits as a proposal beside the saved Brief; an owner\'s Brief is never overwritten. Asks first, at the measured price.', tool: 'propose_brief' },
  lexProposesBrief: { purpose: 'Lex\'s proposed Brief, waiting beside the saved one.', fits: 'Use it, edit it then save, or set it aside — nothing changes until the owner does.', tool: 'read_brief' },
  useBrief: { purpose: 'Takes Lex\'s proposed Brief as the next version.', fits: 'The proposal is kept, marked used.', tool: none('the owner\'s answer, on the screen') },
  editThenSave: { purpose: 'Opens Lex\'s proposed Brief in the form so the owner can change it before saving.', fits: 'The saved version is the owner\'s.', tool: none('the owner\'s answer, on the screen') },
  setAside: { purpose: 'Sets Lex\'s proposed Brief aside.', fits: 'It is kept; the saved Brief is unchanged.', tool: none('the owner\'s answer, on the screen') },
  addPoint: { purpose: 'Adds a numbered point to "Must include" or "Must not".', fits: 'Points keep their order.', limits: 'Up to 60 points.', tool: 'propose_brief' },
  removePoint: { purpose: 'Takes a point out of the form before saving.', fits: 'Earlier saved versions keep it.', tool: none('the owner edits on the screen') },
  draftIt: { purpose: 'Lex drafts the action\'s draft from its Brief; the result waits as a proposal.', fits: 'Between the Brief and the Draft. Refused while the Brief is empty. Asks first, at the measured price for the kind; the draft records the Brief version it followed.', tool: 'draft_document, redraft_document' },
  briefEmpty: { purpose: 'Says why "Draft it" cannot run: there is no Brief.', fits: 'Write the Brief, or ask Lex to prefill it.', tool: 'propose_brief' },
  briefChanged: { purpose: 'Says the Brief was saved again after the draft was drafted, or the draft was written before any Brief.', fits: 'Draft it again, or accept the draft as it is.', tool: 'read_brief' },
  draftedFrom: { purpose: 'Names the Brief version the draft was drafted from.', fits: 'Shown under "Draft it".', tool: 'read_brief' },
  noBriefYet: { purpose: 'Says the draft has no Brief yet.', fits: 'The strip reads "Briefed ○".', tool: 'read_brief' },
  instructionIsBrief: { purpose: 'A draft clause\'s own Brief fields: its drafting instruction (instrument, provisions, duty, enforcement, commencement, extent).', fits: 'Read in place from the clause\'s versions; editing it makes a new clause version.', tool: 'redraft_document' },
  editInstruction: { purpose: 'Opens the drafting instruction\'s editor.', fits: 'Saving writes a new version of the clause and its law rows.', tool: 'redraft_document' },
  companionOf: { purpose: 'Says which draft a collision report, explanatory note or schedule goes with.', fits: 'One instrument per action; the rest are its companions (313).', tool: 'list_documents' },
  acceptSplit: { purpose: 'Uses a proposed split of the Action details: the paragraphs that are the Brief go into it, and the rest stay as the Action details.', fits: 'The old Action details are kept in the history. Refused if the details have changed since the split was proposed.', tool: none('the owner\'s answer, on the screen') },
}
const BRIEF_FIELD_G: Record<keyof typeof BRIEF_FIELD_WORD, GuideText> = {
  must: { purpose: 'What the draft must do, in the owner\'s words.', fits: 'The first thing the drafter reads.', limits: 'No limit of its own; the box counts.', tool: 'propose_brief' },
  modelledOn: { purpose: 'The source the draft takes its form from: a [Ref: n] held in full, a corpus section, or none.', fits: 'Its form, never its duties.', tool: 'propose_brief' },
  tone: { purpose: 'The draft\'s tone and form: statutory, code, guidance, specification or plain rules.', fits: 'One choice, or not said.', tool: 'propose_brief' },
  mustInclude: { purpose: 'Numbered points the draft must carry.', fits: 'The drafter carries out each, and says in its gaps any it could not.', limits: 'Up to 60 points of 6,000 characters each.', tool: 'propose_brief' },
  mustNot: { purpose: 'Numbered points the draft must not contain.', fits: 'Nothing listed here may appear in the draft.', limits: 'Up to 60 points of 6,000 characters each.', tool: 'propose_brief' },
  issuedBy: { purpose: 'A code text\'s Brief: who issues the code.', fits: 'Code text only.', limits: '1,000 characters.', tool: 'propose_brief' },
  laidBefore: { purpose: 'A code text\'s Brief: whether and before whom it is laid.', fits: 'Code text only.', limits: '1,000 characters.', tool: 'propose_brief' },
  appliesTo: { purpose: 'A code text\'s Brief: the bodies or people it applies to.', fits: 'Code text only.', limits: '1,000 characters.', tool: 'propose_brief' },
  revisionRule: { purpose: 'A code text\'s Brief: how and when the code may be changed.', fits: 'Code text only.', limits: '1,000 characters.', tool: 'propose_brief' },
  users: { purpose: 'A specification\'s Brief: who uses the system.', fits: 'Specification only.', limits: '1,000 characters.', tool: 'propose_brief' },
  records: { purpose: 'A specification\'s Brief: what it records.', fits: 'Specification only.', limits: '1,000 characters.', tool: 'propose_brief' },
  measures: { purpose: 'A specification\'s Brief: what it measures.', fits: 'Specification only.', limits: '1,000 characters.', tool: 'propose_brief' },
  basis: { purpose: 'A costing\'s Brief: what the figures rest on.', fits: 'Costing only; the figures come from the cost lines.', limits: '1,000 characters.', tool: 'propose_brief' },
  priceYear: { purpose: 'A costing\'s Brief: the price year the figures are in.', fits: 'Costing only.', limits: '1,000 characters.', tool: 'propose_brief' },
}
const TONE_G: Record<keyof typeof TONE_WORD, GuideText> = Object.fromEntries((Object.keys(TONE_WORD) as Array<keyof typeof TONE_WORD>).map((t) => [t, { purpose: `"Tone and form": the draft reads as ${TONE_WORD[t]}.`, fits: 'One of the five choices in the Brief.', tool: 'propose_brief' }])) as Record<keyof typeof TONE_WORD, GuideText>

// 26-AA item 5 — the Sources list (SourceBrowser) and Add research (AddResearch): 26-W-b left these two unchecked
const SOURCES_G: Record<keyof typeof SOURCES_UI, GuideText> = {
  sort: { purpose: 'Orders the sources: newest first, A–Z, or by Ref number.', fits: 'A view only; a source\'s number never changes.', tool: 'list_sources' },
  allFilters: { purpose: 'Opens every filter: each kind with its count, "Bears on", and possible duplicates.', fits: 'The three quick pills stay beside it.', tool: none('a view of the list; list_sources and list_research_notebook read the same sources') },
  fewerFilters: { purpose: 'Closes the full filters again.', fits: 'Filters already on stay on, and the button says "(on)".', tool: none('a view of the list') },
  kind: { purpose: 'Heads the kinds of source to show: documents, web pages, pasted text, your own notes, found by Lex.', fits: 'Ticking none shows every kind.', tool: 'list_sources' },
  bearsOn: { purpose: 'Shows only the sources tied to one action: by a note on it, or by the action citing the source\'s [Ref: n].', fits: 'Lists only the actions that have a source tied to them.', tool: 'what_have_i_read_on' },
  possibleDuplicates: { purpose: 'Shows only sources that may be the same one twice: the same document, address or text.', fits: 'They are shown together, never merged; a number is never reused.', tool: none('a view; nothing merges sources') },
  clear: { purpose: 'Turns every filter and the search off.', fits: 'Shown only while something is filtering the list.', tool: none('a view of the list') },
  choose: { purpose: 'Picks this source for a further note in Add research.', fits: 'In "This is a further note on a source I\'ve already added".', tool: 'add_research_note (with the source)' },
}
const FACET_G: Record<keyof typeof FACET_LABEL, GuideText> = Object.fromEntries((Object.keys(FACET_LABEL) as Array<keyof typeof FACET_LABEL>).map((k) => [k, { purpose: `A kind of source: ${FACET_LABEL[k].toLowerCase()}. As a filter, shows only those (the number is how many).`, fits: 'A quick pill or a box under "Kind"; several can be on at once.', tool: 'list_sources' }])) as Record<keyof typeof FACET_LABEL, GuideText>
const SORT_G: Record<keyof typeof SORT_LABEL, GuideText> = Object.fromEntries((Object.keys(SORT_LABEL) as Array<keyof typeof SORT_LABEL>).map((k) => [k, { purpose: `Sorts the sources: ${SORT_LABEL[k]}.`, fits: 'One of the choices under "Sort".', tool: 'list_sources' }])) as Record<keyof typeof SORT_LABEL, GuideText>
const STANCE_G: Record<keyof typeof STANCE_LABEL, GuideText> = Object.fromEntries((Object.keys(STANCE_LABEL) as Array<keyof typeof STANCE_LABEL>).map((k) => [k, { purpose: `The note's stance: it ${k === 'UNDECIDED' ? 'is not yet decided' : k === 'CONTEXT' ? 'gives context' : STANCE_LABEL[k].toLowerCase()} on what it bears on.`, fits: 'A word and a shape (✓ ✗ ○ ?), under "+ More details".', tool: 'add_research_note, update_research_note' }])) as Record<keyof typeof STANCE_LABEL, GuideText>
const ADD_RESEARCH_G: Record<keyof typeof ADD_RESEARCH_UI, GuideText> = {
  addResearch: { purpose: 'Opens the one form for adding research: a file, a link, pasted text, a quote, or just a thought.', fits: 'Every note cites a source on the Sources list: a new one, one already added, or "My own observation".', tool: 'add_research_note' },
  close: { purpose: 'Closes the Add research form.', fits: 'What was typed is kept on this device until it is saved.', tool: none('the form itself') },
  what: { purpose: 'Step 1: what is being added — a file, a web address or text, or nothing but a thought.', fits: 'Any one of them; a thought alone is filed as "My own observation".', tool: 'add_research_note' },
  chooseFile: { purpose: 'Picks a file; its text is read so a passage can be chosen as the quote.', fits: 'The title is filled from the file\'s name, editable.', tool: 'file_text, add_research_note' },
  fetchPage: { purpose: 'Fetches a readable view of the web address, to quote from.', fits: 'A page that refuses (some answer 403) says so; then paste its text.', tool: 'file_url, add_research_note' },
  fetching: { purpose: 'Says the page or file is being read.', fits: 'As "Fetch a readable view".', tool: none('a state, not a control') },
  pasteText: { purpose: 'Takes pasted text of any length as the source\'s text.', fits: 'A passage of it can be chosen as the quote; the rest is kept and read into findings.', tool: 'add_research_note' },
  useSelection: { purpose: 'Makes the passage selected in the text above the quote.', fits: 'Select by dragging across the text first.', limits: 'The quote is up to 8,000 characters.', tool: 'extract_quotes, add_research_note' },
  clearText: { purpose: 'Empties the text that was read from a file or page.', fits: 'Then another can be chosen or pasted.', tool: none('the form itself') },
  dupYes: { purpose: 'Files this as a further note on the source already added, rather than a second copy.', fits: 'Offered when the text\'s fingerprint or the address matches a source on the list.', tool: 'add_research_note (with the source)' },
  dupNo: { purpose: 'Adds it as a new source even though it looks like one already added.', fits: 'Both then show under "Possible duplicates".', tool: 'add_research_note' },
  titleStep: { purpose: 'Step 2: the new source\'s title.', fits: 'Filled from the file\'s name or the page\'s title; editable.', limits: '300 characters.', tool: 'add_research_note' },
  sourceStep: { purpose: 'Step 2, for a further note: the source it is on.', fits: '"Change" picks another.', tool: 'add_research_note (with the source)' },
  change: { purpose: 'Picks a different source for this further note.', fits: 'As "This is a further note on a source I\'ve already added".', tool: none('the form itself') },
  furtherNote: { purpose: 'Opens a search of the Sources list to choose the source this note is on.', fits: 'The same search and filters as the Sources list.', tool: 'add_research_note (with the source)' },
  addQuote: { purpose: 'Opens the box for a quote — words from the source — and where in it they are.', fits: 'A quote needs a source.', limits: 'The quote up to 8,000 characters; where, 200.', tool: 'add_research_note' },
  addComment: { purpose: 'Opens the box for your own comment.', fits: 'A comment alone, with nothing filed, is kept as "My own observation".', limits: '8,000 characters.', tool: 'add_research_note' },
  moreDetails: { purpose: 'Opens the optional details: author, date, stance, tags, what it bears on, and "mine only".', fits: 'All can be added later.', tool: 'add_research_note, update_research_note' },
  quote: { purpose: 'Heads the quote and where in the source it is.', fits: 'As "+ Add a quote".', tool: 'add_research_note' },
  comment: { purpose: 'Heads your comment.', fits: 'As "+ Add your comment".', tool: 'add_research_note' },
  permission: { purpose: 'Heads the "I may share this" box, shown when a document\'s text is being kept.', fits: 'It is never ticked for you.', tool: none('the owner\'s own assertion') },
  mayShare: { purpose: 'Your assertion that you are allowed to keep and share this document\'s text.', fits: 'Never ticked for you.', tool: none('the owner\'s own assertion; Lex never makes it') },
  mineOnly: { purpose: 'Keeps the note visible only to you until you share it.', fits: 'Under "+ More details".', tool: 'answer_notes (op: mine_only, or op: share)' },
  removeBearsOn: { purpose: 'Takes one "bears on" link off the note being written.', fits: 'Beside each link chosen under "Bears on…".', tool: none('the form itself') },
  save: { purpose: 'Saves the research: the source on the list and the note, if there is one.', fits: 'It confirms with the source\'s number ([Ref: n]).', tool: 'add_research_note' },
  saving: { purpose: 'Says the research is being saved.', fits: 'As Save.', tool: none('a state, not a control') },
  startAgain: { purpose: 'Empties the whole form.', fits: 'Nothing is saved.', tool: none('the form itself') },
}

// 26-AA item 2 — the Diagnosis's cause buttons, and the Lex tools that do the same through the same functions
const CAUSE_G: Record<keyof typeof CAUSE_UI, GuideText> = {
  add: { purpose: 'Adds the cause typed above it to the Diagnosis, with why it has persisted if given.', fits: 'It gets the next cause number, which never changes or comes back.', limits: 'The cause up to 2,000 characters; why up to 4,000.', tool: 'add_cause (asks first)' },
  addAnother: { purpose: 'The same as "Add cause", once the causes have been confirmed.', fits: 'A cause thought of later still has somewhere to go.', limits: 'As "Add cause".', tool: 'add_cause (asks first)' },
  edit: { purpose: 'Opens a cause to rewrite its statement, why it has persisted, and its evidence.', fits: 'Save keeps the cause\'s number; nothing else moves.', limits: 'As "Add cause"; the evidence up to 4,000.', tool: 'edit_cause (asks first)' },
  addBeneath: { purpose: 'Adds a cause beneath this one: a deeper cause that drives it.', fits: 'Builds the chain the map draws. Not offered on the deepest level (four).', tool: 'add_cause with beneath (asks first)' },
  addBeneathSubmit: { purpose: 'Adds the deeper cause typed beside it.', fits: 'As "+ cause beneath".', tool: 'add_cause with beneath (asks first)' },
  remove: { purpose: 'Removes a cause, and the causes beneath it, from the Diagnosis.', fits: 'They are archived, not deleted: the number is kept and never reused. If it was the root cause, the root cause is cleared.', tool: 'retire_cause (asks first; undo brings it back)' },
}

// ── assembled ──────────────────────────────────────────────────────────────────────────────────────────────────
const fromTable = <K extends string>(area: GuideArea, prefix: string, labels: Record<K, Lbl>, texts: Record<K, GuideText>): GuideEntry[] =>
  (Object.keys(texts) as K[]).map((k) => ({ key: `${prefix}.${k}`, area, label: shown(labels[k]), ...texts[k] }))

/** Every entry, its label read NOW from the table the screen renders. */
export function guideEntries(): GuideEntry[] {
  const kindTexts = Object.fromEntries((Object.keys(KIND_WORD) as DocumentKind[]).map((k) => [k, { purpose: `A ${KIND_WORD[k]}: one of the kinds of draft an action can have.`, fits: 'Which kinds an action needs comes from its avenue and its heading\'s kind, or is set by hand.', tool: 'list_documents, draft_document' }])) as Record<DocumentKind, GuideText>
  const headingKindTexts = Object.fromEntries(Object.keys(HEADING_KIND_WORD).map((k) => [k, { purpose: `A heading whose actions make ${HEADING_KIND_WORD[k as keyof typeof HEADING_KIND_WORD]}.`, fits: 'Decides which drafts its actions need.', tool: 'set_heading_kind' }])) as Record<keyof typeof HEADING_KIND_WORD, GuideText>
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
    { key: 'record.avenue', area: 'record', label: FACET_WORD.avenue, purpose: 'The avenue: legislative, organisational or financial.', fits: 'Decides which drafts the action needs.', tool: 'set_action_facets' },
    { key: 'record.causes', area: 'record', label: FACET_WORD.causes, purpose: 'The causes from the Diagnosis that the action attacks.', fits: 'causes_without_action lists causes no action attacks.', tool: 'set_action_facets' },
    ...fromTable('document', 'kind', KIND_WORD, kindTexts),
    ...fromTable('record', 'headingKind', HEADING_KIND_WORD, headingKindTexts),
    ...fromTable('document', 'document', DOCUMENT_UI, DOCUMENT),
    ...fromTable('document', 'drafts', DRAFTS_UI, DRAFTS_G),
    ...fromTable('document', 'tab', DOCUMENT_TAB_WORD, TABS),
    ...fromTable('document', 'field', INSTRUCTION_FIELD, FIELDS),
    ...fromTable('document', 'editor', INSTRUCTION_EDITOR, EDITOR),
    ...fromTable('document', 'touch', TOUCH_BLOCK, BLOCKS),
    ...PROVISION_COLUMNS.map((c) => ({ key: `document.provisionColumn.${c}`, area: 'document' as const, label: c, purpose: `The "${c}" column of the drafting instruction's provisions table.`, fits: 'Each row is a provision the clause acts on; it writes a law row.', tool: 'read_document' })),
    ...PRECEDENT_COLUMNS.map((c) => ({ key: `document.precedentColumn.${c}`, area: 'document' as const, label: c, purpose: `The "${c}" column of the precedents table.`, fits: 'Precedents are existing provisions the draft draws on.', tool: 'read_document' })),
    ...fromTable('tree', 'tree', TREE_UI, TREE),
    ...fromTable('tree', 'filter', TREE_FILTER_WORD, FILTERS),
    ...fromTable('workspace', 'workspace', WORKSPACE_UI, onRows(WORKSPACE, WORKSPACE_ROW)),
    ...fromTable('workspace', 'view', WORKSPACE_VIEW_WORD, onRows(VIEWS, { list: 'view', board: 'view', coverage: 'view', conditions: 'view' })),
    // the facets heading is two table words, shown as one line when the idea has conditions
    { key: 'record.facetsTitleWithConditions', area: 'record', label: RECORD_UI.facetsTitle + RECORD_UI.facetsTitleConditions, ...RECORD.facetsTitle, tool: 'set_action_facets, set_action_conditions, classify_actions' },
    ...EXTENTS.map((x) => ({ key: `document.extent.${x}`, area: 'document' as const, label: x, purpose: `A place the provision extends to: ${x}.`, fits: 'One of the Extent choices in the drafting instruction; legislative actions only.', tool: 'redraft_document' })),
    ...fromTable('research', 'notebook', NOTEBOOK_UI, NOTEBOOK),
    // 26-X
    ...fromTable('workspace', 'lifecycle', LIFECYCLE_STAGE_WORD, LIFECYCLE_G),
    ...fromTable('workspace', 'lifecycleUi', LIFECYCLE_UI, LIFECYCLE_UI_G),
    ...fromTable('workspace', 'progress', PROGRESS_WORD, PROGRESS_G),
    ...fromTable('workspace', 'checklist', CHECKLIST_WORD, CHECKLIST_G),
    ...fromTable('workspace', 'page', PAGE_UI, PAGE_G),
    ...fromTable('workspace', 'draftingFilter', DRAFTING_FILTER_WORD, DRAFT_FILTER_G),
    ...fromTable('workspace', 'deepeningLock', DEEPENING_LOCK_UI, LOCK_G),
    // 26-X addendum 321–323
    ...fromTable('workspace', 'toolbar', ORGANISING_TOOLBAR_UI, TOOLBAR_G),
    ...fromTable('workspace', 'addAction', ADD_ACTION_UI, ADD_ACTION_G),
    // 26-X X2
    ...fromTable('record', 'brief', BRIEF_UI, BRIEF_G),
    ...fromTable('record', 'briefField', BRIEF_FIELD_WORD, BRIEF_FIELD_G),
    ...fromTable('record', 'tone', TONE_WORD, TONE_G),
    // 26-X X3
    ...fromTable('workspace', 'deepening', DEEPENING_UI, DEEPENING_G),
    // 26-Z
    ...fromTable('workspace', 'panel', PANEL_WORD as unknown as Record<PanelKey, string>, PANEL_G),
    ...fromTable('workspace', 'panelPlace', PANEL_PLACE_WORD, PANEL_PLACE_G),
    ...fromTable('workspace', 'whereSentence', WHERE_SENTENCES, WHERE_SENTENCES_G),
    ...fromTable('workspace', 'where', WHERE_UI, WHERE_UI_G),
    ...fromTable('workspace', 'stageBarRow', STAGEBAR_ROW_WORD, STAGEBAR_ROW_G),
    ...fromTable('common', 'draftRestore', DRAFT_RESTORE_UI, DRAFT_RESTORE_G),
    // 26-Y
    ...fromTable('record', 'cba', CBA_UI, CBA_G),
    // 26-AA
    ...fromTable('workspace', 'cause', CAUSE_UI, CAUSE_G),
    ...fromTable('research', 'sources', SOURCES_UI, SOURCES_G),
    ...fromTable('research', 'sourceKind', FACET_LABEL, FACET_G),
    ...fromTable('research', 'sourceSort', SORT_LABEL, SORT_G),
    ...fromTable('research', 'stance', STANCE_LABEL, STANCE_G),
    ...fromTable('research', 'addResearch', ADD_RESEARCH_UI, ADD_RESEARCH_G),
    // FocusDialog's own close mark: every focused dialog (Add research among them) shows it in its title bar
    { key: 'common.dialogClose', area: 'common', label: '✕', purpose: 'Closes the dialog.', fits: 'In the title bar of every focused dialog; Esc does the same. Anything typed in Add research is kept on this device.', tool: none('the dialog itself') },
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
