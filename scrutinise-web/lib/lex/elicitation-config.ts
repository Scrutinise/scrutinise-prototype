// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §1 — MINIMUM ELICITATION. The four exchanges, and the copy.
//
// §25 inverts the flow: the user decides, Lex writes. This file is the whole of what
// we ask before Lex goes away and drafts — four questions and a confirmation. It is
// configuration, not logic: the engine (elicitation.ts) walks it, the client renders
// whatever step the server says is current, and nothing here knows about the field
// machine or the build.
//
// ⚠ THE COPY IN THIS FILE IS CHARLIE'S, AND IT IS VERBATIM FROM THE BRIEF. Where it
// was "lightly smoothed" the brief says so and the smoothed version is what is here.
// Do not paraphrase it in place; change the brief, then change this.
//
// ⚠ 25-A ADDS A PATH, IT DOES NOT REMOVE ONE (§0). None of these keys is a FieldDef,
// none of them appears in PAGE_SEQUENCE, and the existing Page-1 conversation is
// untouched. An idea built the current way never reaches this file.
// ─────────────────────────────────────────────────────────────────────────────

/** The steps, in order. `profile` is conditional (§1a — skipped for a returning user). */
export type ElicitationStepKey = 'problem' | 'goal' | 'ownKnowledge' | 'reading' | 'profile' | 'confirm'

export interface ElicitationStep {
  key: ElicitationStepKey
  /** Short label for the progress rail. */
  label: string
  /** The platform-authored question. Lex may elaborate on it; this is what is shown
   *  when a Lex turn fails, so the flow never stalls (the §13 Task 3 rule). */
  question: string
  /**
   * 25-E §4a — THE SHORT LINE ON THE CARD, when a short line helps.
   *
   * ⚠⚠ THE OPENING QUESTION WAS PRINTED TWICE, VERBATIM. `question` for the first step IS
   * `OPENING_ASK`, and Lex has already said `OPENING_ASK` in the transcript directly above
   * the card — so the user read the same eighty-word paragraph twice in a row, and the
   * card's own job (say what goes in THIS box) was done by neither copy.
   *
   * `question` stays exactly as it is: it is what the transcript says and what is shown when
   * a Lex turn fails, and the §13 Task 3 rule depends on it. This is a SEPARATE, shorter
   * string for the card. `null` means the hint list is the better description and the card
   * shows no prompt at all — which is the brief's own instruction for the first step.
   */
  cardPrompt?: string | null
  /** Sub-prompts shown beside the box, as on the existing narrative boxes. */
  hints?: string[]
  /** A step the user may pass over without answering. */
  optional?: boolean
}

/**
 * §1b — LEX'S OPENING ASK, VERBATIM.
 *
 * The whole premise of §25 is that the outlying detail the user has and we do not is
 * worth more than another round of structured questions, so the first thing said asks
 * for exactly that.
 */
export const OPENING_ASK =
  'Tell me as much as you can about this issue and why you want it solved — what you’ve seen, what ' +
  'you know that isn’t written down anywhere, and what you think is really going on. The outlying ' +
  'details are often what change the whole approach, so nothing is too small to mention.'

/** §1a item 2 — what the user wants to happen. Stored as `goalKind`. */
export const GOAL_KINDS = [
  { key: 'LAW_CHANGE', label: 'A change in the law' },
  { key: 'APPLICATION_CHANGE', label: 'A change in how a rule is applied' },
  { key: 'INSTITUTIONAL_PRESSURE', label: 'Pressure on an institution' },
  { key: 'UNSURE', label: 'Not sure yet' },
] as const

export type GoalKind = (typeof GOAL_KINDS)[number]['key']

export function isGoalKind(v: unknown): v is GoalKind {
  return typeof v === 'string' && GOAL_KINDS.some((g) => g.key === v)
}

export const ELICITATION_STEPS: ElicitationStep[] = [
  {
    key: 'problem',
    label: 'The problem',
    // ⚠ NULL, deliberately. Lex has just asked this in full, one card above. The hints
    // below are what a user needs here; a second copy of the paragraph is not.
    cardPrompt: null,
    // The user-visible label is "The problem", never "Challenge" — docs/CLAUDE.md §4,
    // reversed by §19-D Task 1a. A vague label invites a vague answer.
    question: OPENING_ASK,
    hints: [
      'what is going wrong, and for whom',
      'what you have seen yourself',
      'why it matters',
      'what you think is really going on',
    ],
  },
  {
    key: 'goal',
    label: 'What you want',
    cardPrompt: 'What do you want to happen?',
    question: 'What do you want to happen — and is there anything you’ve already ruled out?',
    hints: [
      'the kind of change you are after',
      'what that would look like in practice',
      'anything you have already decided against, and why',
    ],
  },
  {
    key: 'ownKnowledge',
    label: 'What you know',
    cardPrompt: 'What won’t we find in the record?',
    // ⚠ This is the exchange the whole build leans on, and the one the record cannot
    // supply. It is stored with its provenance (USER_TESTIMONY) because every later
    // citation depends on telling it apart from retrieved material.
    question:
      'What do you know about this that we won’t find in the record — your own experience, what you’ve ' +
      'been told, what the paperwork doesn’t show?',
    hints: [
      'what you have seen or been told directly',
      'what the official record gets wrong or leaves out',
      'who actually decides things here',
    ],
    optional: true,
  },
  {
    key: 'reading',
    label: 'Anything to read',
    cardPrompt: 'A link, a report, a letter — anything you’d like me to have.',
    // ⚠ NEVER-CLAIM AT THE FIRST EXCHANGE. Ingestion is 25-D. We capture what they give
    // us and say plainly that Lex will read it in a later sprint. Pretending to have
    // read it is the cheapest possible lie and the most damaging one.
    question: 'Is there anything you’d like me to read — a link, a report, a letter?',
    hints: ['a link', 'a document you already have'],
    optional: true,
  },
  {
    key: 'profile',
    label: 'About you',
    cardPrompt: 'A bit about you and your experience here.',
    // Reused across every idea (the existing `aboutYou` User-scoped field), so a
    // returning user never sees this step.
    question:
      'Tell me a bit about you — your experience in this area and in politics, and what you’re hoping ' +
      'Scrutinise can do for you.',
    hints: [
      'who you are',
      'your experience in this area',
      'your experience in politics generally',
      'whether you have a team or resources',
    ],
    optional: true,
  },
  {
    key: 'confirm',
    label: 'Confirm',
    cardPrompt: null,
    question: 'Here’s what I understand you’re trying to do.',
  },
]

export function stepDef(key: string): ElicitationStep | undefined {
  return ELICITATION_STEPS.find((s) => s.key === key)
}

/** What we say about a document we have taken and have NOT read. Said once, plainly. */
export const READING_CAPTURED_NOTE =
  'Noted — I’ve kept that with the idea. I can’t read documents yet, so I won’t pretend I have: ' +
  'nothing in what I draft comes from it. That’s coming in a later sprint.'

/**
 * §1c — THE CONFIRMATION STEP.
 *
 * Charlie's instinct that a warning reads as tense is right, and this is the fix:
 * confident and collaborative, not fearful. The sentence that does the work is
 * "now is the cheapest moment to say so" — it is a statement about cost, not a threat.
 */
export const CONFIRM_PREFIX = 'Here’s what I understand you’re trying to do —'
export const CONFIRM_SUFFIX =
  'Everything I write next follows from this, so if I’ve got the wrong end of anything, now is the ' +
  'cheapest moment to say so. Otherwise I’ll go and build it.'

export const CONFIRM_YES_LABEL = 'That’s right — build it'
export const CONFIRM_NO_LABEL = 'Not quite — let me correct you'

/** What we ask for when the user presses "Not quite". Re-runs the confirmation ONLY. */
export const CORRECTION_PROMPT =
  'Tell me what I’ve got wrong and I’ll say it back to you again. We don’t go back to the start — ' +
  'just correct the bit that’s off.'

/**
 * §5 — CHARLIE'S CREDIBILITY POINT, PLACED AFTER THE WORK RATHER THAN BEFORE IT.
 *
 * A warning before the user has invested reads as a threat; after the work is done it
 * reads as respect. That placement is the decision — the words are secondary to it.
 */
export const CREDIBILITY_NOTE =
  'Everything above is mine until you’ve been through it. If this goes to an MP or a committee, ' +
  'you’ll be asked to defend it — so where you disagree, or where I’ve put words in your mouth, ' +
  'change it. Where I’m wrong, that’s the most useful thing you can tell me.'

/** §5 — direct editing is essential and encouraged, and the copy has to SAY so. */
export const DIRECT_EDITING_NOTE =
  'Put any of it in your own words. That isn’t a fallback for when I get it wrong — it’s the point: ' +
  'the words you’d defend are better than the words I’d write.'
