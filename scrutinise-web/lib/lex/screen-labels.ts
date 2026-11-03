// ─────────────────────────────────────────────────────────────────────────────
// 26-W-b (decision 302) — THE WORDS ON THE ACTION RECORD AND THE DOCUMENT VIEW, in one place.
//
// The components render these, and the field guide (lib/lex/field-guide.ts) reads the SAME constants, so renaming a label here renames it
// on the screen AND in what Lex says about it (26-X will rename labels; nothing else has to change). A label written inline in a component is
// a label the guide cannot see: `check:lex-26w-b` renders the record and the document view and fails on any label not in these tables.
//
// A function is a label with a number or a name in it ("Accept version 3"); the guide shows it with "N".
// ⚠ PURE (CLAUDE.md §28): imports only input-limits (itself import-free). Keep the words exactly as the screen has said them.
// ─────────────────────────────────────────────────────────────────────────────

import { LIMITS } from './input-limits'

/** 237 (CCh 22 Oct (7)) — the two box labels, verbatim; the number is the limit itself, so label and counter cannot disagree. */
export const STATEMENT_LABEL = `The action, in up to ${LIMITS.actionStatement.toLocaleString('en-GB')} characters`
export const COMMENTARY_LABEL = 'Action details — what this action does in full and why; parts, tables, no limit'
/** The avenue and causes on a step-1 record. */
export const FACET_WORD = { avenue: 'Avenue', causes: 'Causes' } as const

/** Words used by many controls: each is explained once, by where it sits. */
export const COMMON_UI = {
  save: 'Save',
  cancel: 'Cancel',
  ok: 'OK',
  notNow: 'Not now',
  edit: 'Edit',
  add: 'Add',
  remove: 'Remove',
  dismiss: 'Dismiss',
  accept: 'Accept',
  clear: 'Clear',
  draftIt: 'Draft it',
  setAside: 'Set aside',
} as const

/** The opened action record (ActionsWorkspace, FieldsPanel's ActionCard, ActionSlots, ActionsOrder, ActionComments, ActionRecordSections). */
export const RECORD_UI = {
  // title and statement
  editTitle: 'Edit title',
  noTitle: 'No title yet.',
  editAction: 'Edit the action',
  // the jump band
  bandMore: (n: number | string) => `≡ More (${n})`,
  // Action details
  editDetails: 'Edit the action details',
  writeDetails: 'Write them',
  saveDetails: 'Save the action details',
  // the policy test, avenue, causes, conditions
  policyTest: 'Policy test',
  testAgainstPolicy: 'Test against the policy',
  testAgain: 'Test again',
  keptWithNote: 'Kept, with your note:',
  keepWithNote: 'Keep it, with a note',
  clearNote: 'Clear the note',
  facetsTitle: 'The causes it attacks, its avenue',
  facetsTitleConditions: ' and the conditions it delivers',
  lexProposes: 'Lex proposes:',
  conditionsDelivers: 'Conditions it delivers:',
  support: 'Support',
  change: '— change',
  // heading
  headingKind: 'Kind',
  rename: 'Rename',
  hide: 'Hide',
  show: 'Show',
  retireHeading: 'Retire heading',
  consolidateHeading: 'Consolidate this heading',
  notThis: 'Not this',
  // documents section
  addDocument: 'Add a document',
  draftWhatActionNeeds: 'Draft what this action needs',
  generateFree: 'generate (free)',
  writeInstruction: 'write the instruction',
  draftWithLex: (pence: number | string) => `draft it with Lex (about ${pence}p)`,
  draftWithLexNoPrice: 'draft it with Lex',
  writeIt: 'write it',
  noneYet: 'none yet',
  // step 2 — Who, how and against
  askLex: 'Ask Lex',
  dismissAllSlotProposals: 'Dismiss all of Lex’s proposals',
  notYetAnswered: 'Not yet answered',
  answer: 'Answer',
  noDirection: 'no direction',
  linkChange: 'Link it to the action that changes it (if it is one)',
  clearAnswer: 'Clear this answer',
  slotLexProposes: 'Lex proposes',
  replaceMine: 'Replace mine with this',
  useIt: 'Use it',
  editFirst: 'Edit it first',
  editWho: 'Edit Who',
  whoImplementsLabel: 'Who implements it — a body or a role, and whether it sits inside or outside government',
  who: 'Who:',
  // step 3 — Costs
  editCosts: 'Edit costs',
  costsRanges: 'Costs (ranges with basis)',
  addACost: '+ add a cost',
  addCost: 'Add cost',
  suggestFromAshe: 'suggest from ASHE',
  priceYear: 'Price year',
  oneOff: 'one-off',
  perYear: 'per year',
  noCostOpen: 'no cost, because…',
  noCostBecause: 'No cost, because:',
  deleteCostLine: 'delete',
  // step 4 — Order
  orderTitle: 'Order — what this must come after, and why',
  orderNone: 'Nothing it must come after yet.',
  mustComeAfter: 'Must come after',
  saveReason: 'Save the reason',
  // step 1 — prune
  sources: 'Sources',
  originals: 'The originals this was made from — kept',
  laterPhase: 'Later phase',
  ruleOut: 'Rule out',
  pruneLine: 'Sources, the originals, Later phase and Rule out',
  // comments
  comments: 'Comments',
  addComment: 'Add comment',
  reply: 'Reply',
  summariseThread: 'Ask Lex to summarise this thread',
} as const

/** The document view (DocumentView, its tabs, the comparison, the review ask) and the drafting instruction's editor. */
export const DOCUMENT_UI = {
  acceptVersion: (n: number | string) => `Accept version ${n}`,
  generateAgain: 'Generate again (free)',
  askLexToRedraft: 'Ask Lex to redraft',
  versions: (n: number | string) => `Versions (${n})`,
  reviewThisDocument: 'Review this document',
  reviewIt: 'Review it',
  reviewAgain: 'Review again',
  saveAsNewVersion: 'Save as a new version',
  useItAsVersion: (n: number | string) => `Use it as version ${n}`,
  takeAll: 'Take all',
  takeThis: 'Take this',
  saveAsVersion: (n: number | string) => `Save as version ${n}`,
  whyLexDrafted: 'Why Lex drafted it this way',
  whatLexSays: 'What Lex says about it',
  readAgain: 'Read it again',
  asItStands: 'As it stands',
  lexProposesColumn: 'Lex proposes',
  yourWorkingCopy: 'Your working copy',
  precedents: 'Precedents',
  saveTheDocument: 'Save the document',
  title: 'Title',
  textWithParts: 'The text — use “## ” to start each numbered part',
} as const

/** The drafting instruction's editor (ActionDraftSection's Editor): the labels beyond INSTRUCTION_FIELD's. */
export const INSTRUCTION_EDITOR = {
  notChosen: 'not chosen',
  provisionsLine: 'Amends / inserts into / repeals — one line each:',
  clause: 'The clause — its first line is always the caveat, added if you leave it out',
  plainWording: 'Wording, in plain English',
  purposeOneLine: 'Purpose — one line',
} as const

/** The documents tree on the Overview's Documents tab and in the Deepening (DocumentsTree). */
export const TREE_UI = {
  draftWhatHeadingNeeds: 'Draft what this heading needs',
  changeWhatThisNeeds: 'Change what this needs',
  generateItFree: 'Generate it (free)',
  writeIt: 'Write it',
  needsDerived: 'Work it out from the avenue and instrument',
  needsNothing: 'Needs no document',
  needsSet: 'Needs exactly these',
} as const
export const TREE_FILTER_WORD = { all: 'All', missing: 'Missing', drafted: 'Drafted, not accepted', accepted: 'Accepted' } as const

/** The Coherent Actions workspace, outside an opened record: the toolbar, the list's rows and headings, the kept blocks at its foot
 *  (ActionsWorkspace, ActionDigest, ActionDraftSection's DraftAllButton) and the idea's conditions list (ActionsStructureTools). */
export const WORKSPACE_UI = {
  conditionsTitle: 'Conditions the proposal must meet',
  // the conditions list
  moveConditionUp: '↑',
  moveConditionDown: '↓',
  retireCondition: 'Retire',
  addCondition: 'Add condition',
  addItToList: 'Add it to the list',
  // the toolbar
  group: 'Group',
  hideAllHeadings: 'Hide all headings',
  showAllHeadings: 'Show all headings',
  titleTheseForMe: 'Title these for me',
  classifyWithLex: 'Classify with Lex',
  dismissThemAll: 'Dismiss them all',
  findDuplicates: 'Find duplicates',
  askFourSet: 'Ask four models about the whole set',
  printAll: 'Print all',
  addHeading: 'Add heading',
  suggestHeadings: 'Suggest headings from my guiding policy',
  listFilter: 'Show',
  // under a heading
  askFourHeading: 'Ask four models about this heading',
  printHeading: 'Print this heading',
  draftAllLegislative: 'Draft all legislative actions',
  draftThem: 'Draft them',
  stopAfterThis: 'Stop after this one',
  // a row
  reorder: '⠿',
  openRecord: 'open +',
  closeRecord: 'Close −',
  // the kept blocks at the foot of step 1
  ruledOutBlock: 'Ruled out and merged away',
  laterPhaseBlock: 'Later phase',
  retiredHeadingsBlock: 'Retired headings',
  blockShow: 'show +',
  blockHide: 'hide −',
  restore: 'Restore',
} as const
/** The workspace's views (the tabs above the list); which a step offers is the workspace's STEP_VIEWS. */
export const WORKSPACE_VIEW_WORD = { list: 'List', board: 'Board', coverage: 'Coverage grid', conditions: 'Conditions', order: 'The order, derived', who: 'By who' } as const

/** The research notebook's controls on a note (ResearchNotebook). */
export const NOTEBOOK_UI = {
  bringBack: 'Bring back',
  shareWithTeam: 'Share with the team',
  makeMineOnly: 'Make mine only',
  bringBackIntoRecord: 'Bring back into the record',
  putInRecord: 'Put in the record',
} as const

/** The document view's five tabs. */
export const DOCUMENT_TAB_WORD = { text: 'Text', instruction: 'Instruction', touches: 'What it touches', versions: 'Versions', issues: 'Issues' } as const

/** The provisions table's columns, and the precedents table's. */
export const PROVISION_COLUMNS = ['Act', 'Provision', 'What we do', 'Why'] as const
export const PRECEDENT_COLUMNS = ['Act', 'Provision', 'What we take from it'] as const

/** The drafting instruction's fields: the same words in the Instruction tab and in its editor. */
export const INSTRUCTION_FIELD = {
  instrument: 'Instrument',
  dutyOnWhom: 'Duty on whom',
  enforcedHow: 'Enforced how',
  commencement: 'Commencement',
  extent: 'Extent',
  purpose: 'Purpose',
} as const

/** "What it touches": its five blocks, numbered on screen. */
export const TOUCH_BLOCK = {
  held: 'The text as held',
  effects: 'Changes already made to it, from the official record',
  madeUnder: 'Statutory instruments made under it',
  judgments: 'Judgments interpreting it',
  near: 'Near provisions, with their question',
} as const

/** A label shown with "N" where the screen shows a number or a name. */
export const shown = (l: string | ((x: string) => string)): string => (typeof l === 'function' ? l('N') : l)
