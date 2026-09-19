// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §1 — THE ELICITATION ENGINE. Four exchanges, then a confirmation.
//
// §25 inverts the flow: the user decides, Lex writes. This is the deciding half. It
// asks four questions, applies the existing §19-D problem gate to the first, says back
// what it understood, and waits. Nothing is drafted here and nothing may be drafted
// until `status === 'CONFIRMED'` — the confirmation BLOCKS the build (§6), and it
// blocks it in the build's own claim path rather than by the UI declining to offer a
// button.
//
// FOUR THINGS THIS FILE WILL NOT DO:
//   · It will not touch PAGE_SEQUENCE, the field machine's transitions, or any existing
//     field's semantics. 25-A adds a path (§0). On CONFIRM it uses `submitBox` — the
//     ordinary, unchanged save path — to put the user's own words where the rest of the
//     product already looks for them.
//   · It will not claim to have read a document. Exchange 4 captures; 25-D reads.
//   · It will not press the problem gate a third time. Two, then it takes what it is
//     given and says so without reproach (M_PROBLEM_GATE).
//   · It will not lose the user's own knowledge into the general pile. Exchange 3 is
//     stored with `ownKnowledgeProvenance = USER_TESTIMONY` and is labelled as
//     testimony in every prompt that reads it, because §25.3 and every later citation
//     depend on telling it apart from retrieved material.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { submitBox } from './field-machine'
import { looksLikeASolution, MAX_PROBLEM_PRESSES } from './method'
import {
  ELICITATION_STEPS, stepDef,
  CONFIRM_PREFIX, CONFIRM_SUFFIX, CORRECTION_PROMPT, CLOSING_QUESTION, READING_CAPTURED_NOTE,
  type ElicitationStepKey,
} from './elicitation-config'
import { pressOnProblem, fallbackPress, writeUnderstanding, proposeTitle } from './elicitation-client'
import { llmFailed, llmOk } from './build-llm'
import { appendTranscript, lexBubble, readTranscript, userBubble, type TranscriptMessage } from './transcript'

export const ELICITATION_STAGE = 'ELICITATION'

// ── State ────────────────────────────────────────────────────────────────────

export interface ElicitationStepView {
  key: ElicitationStepKey
  label: string
  question: string
  /** 25-E §4a — the short line for the card, or null when the hints say it better. */
  cardPrompt: string | null
  hints: string[]
  optional: boolean
  /** Answered (or deliberately passed over). */
  done: boolean
  /** The stored answer, so a reload shows what was said rather than an empty box. */
  answer: string | null
}

/**
 * 25-E §1 — WHAT THE USER SHOULD SEE, DECIDED BY THE SERVER, EXHAUSTIVELY.
 *
 * ⚠⚠ THIS EXISTS BECAUSE THE CLIENT COULD RENDER NOTHING AT ALL. It chose between three
 * blocks using three INDEPENDENT conditions — `currentStep !== 'confirm'`,
 * `status === 'AWAITING_CONFIRMATION'`, and `status === 'CONFIRMED'` — and there is a real,
 * reachable state in which all three are false: `IN_PROGRESS` with `currentStep === 'confirm'`,
 * which is exactly where a failed understanding leaves the row. The user gets a page with no
 * controls on it and no way to do anything.
 *
 * Three booleans that must be exhaustive but are not checked for exhaustiveness is a dead end
 * waiting to be reached. ONE value from a closed union cannot be. The file header already
 * claimed this contract — "the server returns the current step and this renders whatever it is
 * told" — and this is the first version of the code that keeps it.
 */
export type ElicitationPhase =
  /** A question is outstanding. Render it. */
  | 'QUESTION'
  /** Every question is answered and the paragraph could not be written. Offer a retry. */
  | 'UNDERSTANDING_FAILED'
  /** The paragraph is written and the user has not yet agreed to it. */
  | 'AWAITING_CONFIRMATION'
  /** Agreed. The build may be started. */
  | 'CONFIRMED'

export interface ElicitationState {
  ideaId: string
  status: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
  /** 25-E §1 — the one value the client switches on. See `ElicitationPhase`. */
  phase: ElicitationPhase
  steps: ElicitationStepView[]
  /** The step the user is on. Null once CONFIRMED. */
  currentStep: ElicitationStepKey | null
  /** 25-H §3 — an answer has changed since the reading was agreed. See `elicitationState`. */
  staleUnderstanding: boolean
  /** §1c — the paragraph, when there is one. */
  understanding: string | null
  /** Problem-gate observability: whether it armed, and how many presses are spent. */
  problemGate: { fired: boolean; presses: number; spent: boolean }
  /** Exchange 4, captured and NOT read. */
  reading: { url: string | null; fileName: string | null; note: string | null; status: string }
  /** The goal options, so the client never hard-codes them. */
  corrections: number
  /** The transcript so far, for the chat column. */
  messages: TranscriptMessage[]
  /** Has a build already been started for this idea? Drives the UI's next move. */
  hasBuild: boolean
}

type Row = NonNullable<Awaited<ReturnType<typeof prisma.ideaElicitation.findUnique>>>

/** Create the row on first read. Idempotent, race-safe on the unique index. */
async function ensureRow(ideaId: string, userId: string): Promise<Row> {
  const existing = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (existing) return existing
  // §1a — the profile is reused across ideas, so a returning user never sees it.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aboutYouNarrative: true } })
  const profileSkipped = !!user?.aboutYouNarrative?.trim()
  try {
    // ⚠⚠ 26-C §2c/§2g — THE OPENING ASK IS NO LONGER WRITTEN TO THE TRANSCRIPT.
    // It used to be said here, once, so it survived a reload without repeating. §2's one-box
    // screen replaces it with static page copy (`PROBLEM_INTRO`) above the box — there is no
    // chat turn to open with any more, and writing one here would be Lex "replying" before
    // the user has said anything, one of the (at most two) replies §3a caps spent on nothing.
    return await prisma.ideaElicitation.create({ data: { ideaId, profileSkipped } })
  } catch {
    const again = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
    if (again) return again
    throw new Error('Could not create the elicitation row')
  }
}

function answerOf(row: Row, key: ElicitationStepKey, aboutYou: string | null): string | null {
  switch (key) {
    case 'problem': return row.problem
    case 'goal': {
      // 26-B §2 — their words, and nothing else. No label, no kind.
      const bits = [row.goalDetail, row.ruledOut ? `Ruled out: ${row.ruledOut}` : ''].filter(Boolean)
      return bits.length ? bits.join(' — ') : null
    }
    case 'ownKnowledge': return row.ownKnowledge
    case 'reading': return row.readingUrl ?? row.readingFileName ?? row.readingNote
    case 'profile': return aboutYou
    case 'confirm': return row.understanding
  }
}

/**
 * Is a step finished? An OPTIONAL step counts as finished once the user has moved past
 * it, which is derived from the transcript (`hydrate`) rather than stored as a second
 * kind of emptiness — "left blank" and "never reached" must not look alike.
 */
function stepDone(row: Hydrated, key: ElicitationStepKey, aboutYou: string | null): boolean {
  switch (key) {
    case 'problem':
      // ⚠⚠ 26-C §3a — NOT JUST "TEXT PRESENT, AND NO GATE OUTSTANDING" ANY MORE.
      // The problem "step" is now the whole one-box conversation: the intake, then at
      // most two Lex-initiated replies (see `decideNextReply`). It is not done merely
      // because the gate has nothing outstanding right now — a fresh intake with no
      // reply asked yet is also "not outstanding" and is very much not done. It is done
      // once the CLOSING question (§3a) has been asked and answered, or the two-reply
      // ceiling is reached, whichever comes first.
      return !!row.problem?.trim() && !gateOutstanding(row) && (row.closingAsked || row.problemPresses >= MAX_PROBLEM_PRESSES)
    // 26-B §2 DECIDED — the outcome is required text. A row from before 26-B with a `goalKind`
    // and no text still reads as done, so an old idea is not sent back to a question it answered.
    case 'goal': return !!row.goalDetail?.trim() || (!!row.goalKind && row.goalSeen)
    case 'ownKnowledge': return row.ownKnowledgeSeen
    case 'reading': return row.readingSeen
    case 'profile': return row.profileSkipped || !!aboutYou?.trim()
    case 'confirm': return row.status === 'CONFIRMED'
  }
}

/** A press has been made and the user has not answered it yet. */
function gateOutstanding(row: Hydrated): boolean {
  return row.problemGateFired && row.problemAnswersAfterPress === 0 && row.problemPresses > 0
}

// The two "seen" flags and the answers-after-press counter are derived from the
// transcript rather than stored, so that no column can drift out of step with what was
// actually said. See `hydrate`.
type Hydrated = Row & {
  goalSeen: boolean; ownKnowledgeSeen: boolean; readingSeen: boolean; problemAnswersAfterPress: number
  /** 26-C §3a — has Lex's SECOND, closing reply already been sent? Derived from the
   *  transcript rather than a new column, the same way `goalSeen` etc. are — see
   *  `decideNextReply` for why this can't just be "presses === MAX". */
  closingAsked: boolean
}

function hydrate(row: Row, messages: TranscriptMessage[]): Hydrated {
  const userTurns = messages.filter((m) => m.role === 'user')
  const answered = (field: string) => userTurns.some((m) => m.field === field)
  const problemAnswers = userTurns.filter((m) => m.field === 'elicitation:problem').length
  const closingAsked = messages.some(
    (m) => m.role === 'lex' && m.field === 'elicitation:problem' && m.content.includes(CLOSING_QUESTION),
  )
  return {
    ...row,
    // 26-B §2 — the goal step is optional free text now; "seen" is the transcript, as for the
    // others. ⚠ A row from before 26-B has a `goalKind` and a bubble, so it reads as seen too.
    goalSeen: answered('elicitation:goal') || !!row.goalKind,
    ownKnowledgeSeen: answered('elicitation:ownKnowledge'),
    readingSeen: answered('elicitation:reading'),
    // Presses are interleaved with answers: press 1 comes after answer 1. So the number
    // of answers GIVEN AFTER the last press is (answers - presses).
    problemAnswersAfterPress: Math.max(0, problemAnswers - row.problemPresses),
    closingAsked,
  }
}

/**
 * 26-C §2a — ONE SCREEN, ONE BOX. `goal` and `profile` are no longer asked here: Charlie's
 * decision of 19 Sep is "one big dump of whatever they can give us, and Lex will need to
 * sift through it" — there is no separate outcome question and no separate About You
 * question on this door any more. Their keys and columns stay (CLAUDE.md §11 — nothing is
 * deleted), simply unreached: `goalDetail`/`goalKind` stay null from this door, exactly as
 * 26-B already left `goalKind` unwritten, and `aboutYou` is collected elsewhere.
 */
function activeSteps(_row: { profileSkipped: boolean }) {
  return ELICITATION_STEPS.filter((s) => s.key === 'problem' || s.key === 'confirm')
}

export async function elicitationState(ideaId: string, userId: string): Promise<ElicitationState> {
  const base = await ensureRow(ideaId, userId)
  const messages = await readTranscript(ideaId)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aboutYouNarrative: true } })
  const hasBuild = (await prisma.ideaBuild.count({ where: { ideaId } })) > 0
  return projectState(ideaId, base, messages, user?.aboutYouNarrative ?? null, hasBuild)
}

/**
 * ⚠⚠ 25-I §1 — THE STATE OF AN IDEA THAT DOES NOT EXIST YET.
 *
 * Charlie found that **loading the page created an idea in his account**. Nobody asked for
 * one. His list filled with things he did not make, and the one place he goes to find his
 * real work stopped being trustworthy.
 *
 * The cause was that the client had no way to draw the first question without a row to draw
 * it from, so it minted one on mount to have something to render. The answer is not to mint
 * it later — it is to be able to render the first question **from nothing**, so an idea is
 * created when a person *starts* one.
 *
 * ⚠ IT IS THE SAME PROJECTION, DELIBERATELY. A hand-written "empty view" beside the real one
 * is two shapes for one screen, and they drift — which is exactly the defect 25-H fixed on
 * page one, where two writers for one field came to disagree. This runs `projectState` over
 * a blank row, so the pre-creation view and the post-creation view cannot differ.
 *
 * ⚠ `ideaId: ''` IS THE SIGNAL, and the client switches on it. An empty string rather than a
 * plausible-looking id, because a fake id is something a caller can accidentally use.
 *
 * Nothing is written. No row, no transcript, no idea.
 */
export async function blankElicitationState(userId: string): Promise<ElicitationState> {
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { aboutYouNarrative: true },
  })
  const aboutYou = user?.aboutYouNarrative ?? null
  const now = new Date()
  // ⚠ TYPED AS `Row`, NOT CAST. If the schema gains a column, this stops compiling — which
  // is the point: a blank state that silently lacks a field the projection reads would
  // render a first question subtly unlike the real one.
  const blank: Row = {
    id: '', ideaId: '',
    problem: null, problemPresses: 0, problemGateFired: false,
    goalKind: null, goalDetail: null, ruledOut: null,
    ownKnowledge: null, ownKnowledgeProvenance: 'USER_TESTIMONY',
    readingUrl: null, readingFileName: null, readingNote: null, readingStatus: 'NOT_READ',
    // §1a — a returning user never sees the profile step, and that must be true of the
    // first question they are shown, not just of the row once it exists.
    profileSkipped: !!aboutYou?.trim(),
    understanding: null, corrections: 0, status: 'IN_PROGRESS', confirmedAt: null,
    createdAt: now, updatedAt: now,
  }
  // 26-C §2c — nothing to seed: the opening ask is now the screen's own static copy
  // (`PROBLEM_INTRO`), not a chat turn, so there is no transcript message before the
  // user's first answer.
  return projectState('', blank, [], aboutYou, false)
}

function projectState(
  ideaId: string,
  base: Row,
  messages: TranscriptMessage[],
  aboutYou: string | null,
  hasBuild: boolean,
): ElicitationState {
  const row = hydrate(base, messages)

  const steps: ElicitationStepView[] = activeSteps(row).map((s) => ({
    key: s.key,
    label: s.label,
    question: s.question,
    // ⚠ `?? null`, NOT `?? s.question`. Falling back to the full question is precisely the
    // duplication §4a exists to remove — a step that forgets to set a card prompt should
    // show the hints, not reprint the paragraph the transcript already carries.
    cardPrompt: s.cardPrompt ?? null,
    hints: s.hints ?? [],
    optional: !!s.optional,
    done: stepDone(row, s.key, aboutYou),
    answer: answerOf(row, s.key, aboutYou),
  }))

  const current = steps.find((s) => !s.done)?.key ?? null

  // ⚠ 25-H §3 — HAS AN ANSWER MOVED SINCE THE READING WAS AGREED?
  //
  // Editing a pill does not un-confirm (see `answerStep`), which keeps a one-word
  // correction from throwing the user back to the start. The cost of that choice is that
  // the agreed understanding can go stale — so it is DETECTED and SAID, rather than left
  // for the user to notice that the paragraph they agreed to describes the answer they
  // just changed.
  //
  // ⚠ AND IT IS ALSO WHAT DECIDES THE PRICE. 25-G's `reuseSourceFor` refuses to reuse the
  // research when the elicitation has moved since the build that used it — so an edit here
  // means the next build searches again. The screen quotes both facts together, because
  // "your reading is out of date" and "this will now cost 33p rather than 12p" are the same
  // event and a user should not have to join them up.
  const staleUnderstanding =
    row.status === 'CONFIRMED' && !!base.confirmedAt && base.updatedAt > base.confirmedAt


  // 25-E §1 — one value, derived once, here. See `ElicitationPhase`.
  //
  // ⚠ THE ORDER IS THE MEANING. CONFIRMED wins outright. Then a written paragraph waiting
  // for agreement. Then — and this is the branch that did not exist — every question
  // answered with NO paragraph, which is a failed write and not a question to re-ask.
  // Anything else is a question.
  const phase: ElicitationPhase =
    row.status === 'CONFIRMED' ? 'CONFIRMED'
      : row.status === 'AWAITING_CONFIRMATION' && row.understanding ? 'AWAITING_CONFIRMATION'
        : current === 'confirm' ? 'UNDERSTANDING_FAILED'
          : 'QUESTION'

  return {
    ideaId,
    status: row.status as ElicitationState['status'],
    phase,
    steps,
    currentStep: row.status === 'CONFIRMED' ? null : current,
    staleUnderstanding,
    understanding: row.understanding,
    problemGate: {
      fired: row.problemGateFired,
      presses: row.problemPresses,
      spent: row.problemPresses >= MAX_PROBLEM_PRESSES,
    },
    reading: {
      url: row.readingUrl,
      fileName: row.readingFileName,
      note: row.readingNote,
      status: row.readingStatus,
    },
    corrections: row.corrections,
    messages,
    hasBuild,
  }
}

// ── Answering a step ─────────────────────────────────────────────────────────

export interface AnswerInput {
  /**
   * 25-H §3 — this is a deliberate EDIT of an answer already given, not a fresh answer.
   * The only thing it unlocks is re-answering a CONFIRMED elicitation; everything else
   * about the step behaves identically, so an edit cannot take a path a first answer
   * could not.
   */
  editing?: boolean
  step: ElicitationStepKey
  /** Free text for problem / ownKnowledge / profile / goalDetail. */
  text?: string
  /**
   * 26-C §2a/§2d — THE SECOND BOX, submitted TOGETHER with `text` on the very first
   * 'problem' answer only. One combined intake, not two turns: `text` is kept verbatim as
   * testimony (`yourAccount`); this goes into `ownKnowledge` alongside anything added in
   * a later reply. Ignored on every call after the first (there is no second box once the
   * conversation has started — a reply answers Lex's question, in one box).
   */
  background?: string
  goalKind?: string
  ruledOut?: string
  readingUrl?: string
  readingFileName?: string
  /** The user chose to pass over an optional step. */
  skip?: boolean
}

export class ElicitationClosed extends Error {
  constructor() { super('This idea’s elicitation is already confirmed.') }
}

/**
 * Store one answer and return the fresh state plus whatever Lex says about it.
 *
 * The whole step machine lives here rather than in the client, for the same reason
 * `currentField` does (§3.4): the server owns "what next", and a client that decides it
 * is a second source of truth about where the user is.
 */
export async function answerStep(
  ideaId: string, userId: string, input: AnswerInput,
): Promise<{ state: ElicitationState; messages: string[] }> {
  const base = await ensureRow(ideaId, userId)
  // ⚠⚠ 25-H §3 — A CONFIRMED ELICITATION IS EDITABLE, AND IT WAS NOT.
  //
  // `ElicitationClosed` was right when the only way back was to start again: it stopped a
  // stale tab re-answering a question after the build had been agreed. But §3 makes the
  // pills reopen each answer — "editing an answer and rebuilding is the natural iteration
  // loop" — and that loop is unreachable if the first confirmation closes the door.
  //
  // ⚠ THE GUARD IS NOT REMOVED, IT IS NARROWED. An edit must SAY it is an edit
  // (`input.editing`), so an ordinary answer POST from an old tab is still refused. And
  // editing does NOT un-confirm: 25-E's gate stays satisfied so the user is not thrown
  // back to the start for changing a word — instead the understanding becomes STALE and
  // the screen says so, with Confirm offered to regenerate it.
  if (base.status === 'CONFIRMED' && !input.editing) throw new ElicitationClosed()
  const def = stepDef(input.step)
  if (!def) throw new Error(`Unknown elicitation step: ${input.step}`)

  const text = (input.text ?? '').trim()
  const said: TranscriptMessage[] = []
  const lexSaid: string[] = []

  switch (input.step) {
    case 'problem': {
      // §3a — the closing question ("is there anything more…") is the one place on this
      // door a "no, nothing more" is a real answer, not an empty box. The intake itself
      // still requires text (`isIntake` below): the FIRST answer cannot be skipped.
      if (!text && !(input.skip && base.problem?.trim())) {
        throw new Error('The problem step needs an answer.')
      }
      said.push(userBubble(text || '(nothing more to add)', ELICITATION_STAGE, 'elicitation:problem'))

      // ══ 26-C §2a/§3a — ONE COMBINED INTAKE, THEN AT MOST TWO REPLIES, NEVER SILENT ══
      //
      // ⚠⚠ §1's fix lives here. The old code let a step complete with NOTHING said back —
      // exactly what froze idea a1a08ff4 on 19 Sep: the server correctly moved the user on
      // to the next question and the transcript recorded no acknowledgement of it at all,
      // so any client hiccup at that instant looked identical to a dead page. Every branch
      // below now either appends a Lex bubble to `said`, or takes the LAST allowed reply —
      // in which case `maybeAskForConfirmation` below writes the understanding paragraph
      // within this same turn. No path leaves the transcript exactly as it found it.
      const priorMessages = await readTranscript(ideaId)
      const priorClosingAsked = priorMessages.some(
        (m) => m.role === 'lex' && m.field === 'elicitation:problem' && m.content.includes(CLOSING_QUESTION),
      )
      const isIntake = !base.problem?.trim()

      if (isIntake) {
        // The problem box, verbatim (testimony — never rewritten after this: see the
        // provenance rule in page-one.ts), and the second box alongside it (§2d).
        const background = (input.background ?? '').trim()
        await prisma.ideaElicitation.update({
          where: { ideaId },
          data: {
            problem: text,
            ...(background ? { ownKnowledge: background, ownKnowledgeProvenance: 'USER_TESTIMONY' as const } : {}),
          },
        })

        // ══ 26-C §5 — NAMED IN LEX'S FIRST RESPONSE, NOT LEFT "UNTITLED IDEA" ══════
        //
        // ⚠ ONLY WHEN THE TITLE IS STILL THE PLACEHOLDER `ensureIdea` wrote it as. A
        // failure here must never overwrite a title the user has since typed themselves.
        const PLACEHOLDER_TITLE = 'Untitled idea'
        const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
        if (idea?.title === PLACEHOLDER_TITLE) {
          const titled = await proposeTitle(text)
          if (llmOk(titled) && titled.value.title.trim()) {
            await prisma.idea.update({
              where: { id: ideaId },
              data: { title: titled.value.title.trim().slice(0, 200) },
            })
          } else if (llmFailed(titled)) {
            console.warn('[lex-diag] 26c title proposal failed — left as "Untitled idea"', {
              reason: titled.reason, detail: titled.detail,
            })
          }
        }
      } else {
        // A REPLY to one of Lex's own questions. `problem` is never rewritten here —
        // everything past the intake is additional testimony, appended.
        const existingBackground = base.ownKnowledge?.trim()
        await prisma.ideaElicitation.update({
          where: { ideaId },
          data: {
            ownKnowledge: [existingBackground, text].filter(Boolean).join('\n\n'),
            ownKnowledgeProvenance: 'USER_TESTIMONY',
          },
        })
      }

      const presses = base.problemPresses
      console.log('[lex-diag] 26c problem/reply turn', {
        ideaId, isIntake, presses, priorClosingAsked, textLen: text.length,
      })

      if (presses >= MAX_PROBLEM_PRESSES || priorClosingAsked) {
        // §3b — the ceiling is reached, or the closing question has already been put and
        // answered. Lex stops asking; nothing more is said here, and the paragraph below
        // is what the user sees next.
        break
      }

      // §19-D — THE PROBLEM GATE, unchanged in substance and reused rather than
      // reimplemented, and only a candidate ON THE INTAKE: a press asking "are you sure
      // that's not a solution" makes no sense as a reply to a question Lex itself asked.
      const shaped = isIntake && looksLikeASolution(text)
      if (shaped) {
        // Press. The proposal is offered so agreeing is one click, and the press says
        // openly that it is Lex's reading. This is reply ONE of the (at most) two — the
        // closing question (§3a) still follows once this is answered.
        const result = await pressOnProblem({ text, pressesAlready: presses })
        const press = llmOk(result) ? result.value : fallbackPress()
        if (llmFailed(result)) {
          console.warn('[lex-diag] 25a problem press fell back to the deterministic form', {
            reason: result.reason, detail: result.detail,
          })
        }
        await prisma.ideaElicitation.update({
          where: { ideaId },
          data: { problemGateFired: true, problemPresses: { increment: 1 } },
        })
        const bubble = press.reading
          ? `${press.press}\n\nMy reading of it, so you only have to agree or correct me: ${press.reading}`
          : press.press
        said.push(lexBubble(bubble, ELICITATION_STAGE, 'elicitation:problem'))
        lexSaid.push(bubble)
        break
      }

      // Not solution-shaped (or this answers Lex's own question already) — the closing
      // question, verbatim (§3a). Whichever reply this is, it is always the LAST Lex may
      // ask: "at most twice, not three times."
      await prisma.ideaElicitation.update({
        where: { ideaId },
        data: { problemGateFired: true, problemPresses: { increment: 1 } },
      })
      said.push(lexBubble(CLOSING_QUESTION, ELICITATION_STAGE, 'elicitation:problem'))
      lexSaid.push(CLOSING_QUESTION)
      break
    }

    case 'goal': {
      // 26-B §2 DECIDED — the outcome, in their words, required. `goalKind` is never written
      // again and `ruledOut` is no longer asked (a view of the remedy); the column keeps what
      // older rows hold.
      if (!text) throw new Error('Say what you want to be different — one line is enough.')
      await prisma.ideaElicitation.update({ where: { ideaId }, data: { goalDetail: text } })
      said.push(userBubble(text, ELICITATION_STAGE, 'elicitation:goal'))
      break
    }

    case 'ownKnowledge': {
      await prisma.ideaElicitation.update({
        where: { ideaId },
        data: {
          ownKnowledge: input.skip ? null : (text || null),
          // Re-asserted on every write. The provenance is the point of the column.
          ownKnowledgeProvenance: 'USER_TESTIMONY',
        },
      })
      said.push(userBubble(
        input.skip || !text ? '(nothing to add here)' : text,
        ELICITATION_STAGE, 'elicitation:ownKnowledge',
      ))
      break
    }

    case 'reading': {
      const url = (input.readingUrl ?? '').trim() || null
      const fileName = (input.readingFileName ?? '').trim() || null
      await prisma.ideaElicitation.update({
        where: { ideaId },
        data: {
          readingUrl: url,
          readingFileName: fileName,
          readingNote: text || null,
          // ⚠ NEVER CHANGED IN 25-A. Ingestion is 25-D.
          readingStatus: 'NOT_READ',
        },
      })
      said.push(userBubble(
        url || fileName || text || '(nothing to read)',
        ELICITATION_STAGE, 'elicitation:reading',
      ))
      if (url || fileName) {
        said.push(lexBubble(READING_CAPTURED_NOTE, ELICITATION_STAGE, 'elicitation:reading'))
        lexSaid.push(READING_CAPTURED_NOTE)
      }
      break
    }

    case 'profile': {
      if (input.skip || !text) {
        await prisma.ideaElicitation.update({ where: { ideaId }, data: { profileSkipped: true } })
      } else {
        // The ordinary, unchanged save path — `aboutYou` is a User-scoped field and this
        // is how every other surface writes it.
        await submitBox(ideaId, userId, 'aboutYou', text)
      }
      said.push(userBubble(text || '(skipped)', ELICITATION_STAGE, 'elicitation:profile'))
      break
    }

    case 'confirm':
      throw new Error('The confirmation step is reached with confirmElicitation / correctElicitation.')
  }

  if (said.length) await appendTranscript(ideaId, said)

  // When that was the last question, write the understanding paragraph and wait (§1c).
  const state = await maybeAskForConfirmation(ideaId, userId)
  return { state, messages: lexSaid }
}

// ── §1c — the confirmation step ──────────────────────────────────────────────

/** The full bubble the user reads: our framing around Lex's paragraph. */
export function confirmationBubble(paragraph: string): string {
  return `${CONFIRM_PREFIX} ${paragraph.trim()}\n\n${CONFIRM_SUFFIX}`
}

/**
 * If every question is answered and there is no paragraph yet, write one and move to
 * AWAITING_CONFIRMATION. Returns fresh state either way.
 */
async function maybeAskForConfirmation(ideaId: string, userId: string): Promise<ElicitationState> {
  const state = await elicitationState(ideaId, userId)
  if (state.status !== 'IN_PROGRESS') return state
  if (state.currentStep !== 'confirm') return state
  await runUnderstanding(ideaId, userId)
  return elicitationState(ideaId, userId)
}

/** Write (or rewrite) the understanding paragraph and park at AWAITING_CONFIRMATION. */
async function runUnderstanding(
  ideaId: string, userId: string, correction?: { previous: string; whatIsWrong: string },
): Promise<void> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (!row) throw new Error('No elicitation row')
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aboutYouNarrative: true } })

  const result = await writeUnderstanding({
    problem: row.problem ?? '',
    goalDetail: row.goalDetail ?? '',
    ruledOut: row.ruledOut ?? '',
    ownKnowledge: row.ownKnowledge ?? '',
    aboutYou: user?.aboutYouNarrative ?? '',
    correction,
  })

  // ⚠ NO DETERMINISTIC FALLBACK PARAGRAPH, AND THAT IS THE DECISION. A stitched-together
  // restatement of the four answers would look exactly like a paragraph Lex had thought
  // about, and the user would confirm it — which is the §19-C "silent stub" failure at
  // the one step whose entire job is catching a misunderstanding. A failed confirmation
  // says so and offers a retry; it never manufactures something to agree with.
  if (llmFailed(result)) {
    console.error('[lex-diag] 25a understanding failed — reporting, not substituting', {
      reason: result.reason, detail: result.detail,
    })
    const line =
      'I couldn’t put together what I understand you’re trying to do just then — that’s on me. ' +
      'Try again in a moment, and I won’t start building until you’ve seen it and agreed.'
    await appendTranscript(ideaId, [lexBubble(line, ELICITATION_STAGE, 'elicitation:confirm')])
    return
  }

  const paragraph = result.value.paragraph.trim()
  await prisma.ideaElicitation.update({
    where: { ideaId },
    data: { understanding: paragraph, status: 'AWAITING_CONFIRMATION' },
  })
  await appendTranscript(ideaId, [lexBubble(confirmationBubble(paragraph), ELICITATION_STAGE, 'elicitation:confirm')])
}

/**
 * 25-E §1 — RETRY THE UNDERSTANDING, after it failed to write.
 *
 * ⚠⚠ THE SECOND DEAD END ON THIS STEP, AND IT IS INDEPENDENT OF THE FIRST. When
 * `writeUnderstanding` fails, `runUnderstanding` returns early: `status` stays
 * `IN_PROGRESS` and `understanding` stays null, while `currentStep` is `'confirm'`
 * (because `stepDone('confirm')` is only true at CONFIRMED). The client then renders
 * NOTHING AT ALL — the question card is suppressed on `currentStep === 'confirm'`, the
 * confirmation block needs `AWAITING_CONFIRMATION`, and the build card needs `CONFIRMED`.
 * Three conditions, none of them met, and a user sitting in front of a page with no
 * controls on it.
 *
 * The apology bubble said "try again in a moment" and there was **no way to try again**.
 *
 * ⚠ IT IS ITS OWN ACTION RATHER THAN AN EMPTY `correct`. `correctElicitation` increments
 * the correction count and writes a user bubble — so retrying through it would record the
 * user as having corrected Lex when they did nothing of the kind, and would put the
 * correction PROMPT into the transcript as if they had said it.
 */
export async function retryUnderstanding(ideaId: string, userId: string): Promise<ElicitationState> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (!row) throw new Error('No elicitation row')
  if (row.status === 'CONFIRMED') throw new ElicitationClosed()
  await runUnderstanding(ideaId, userId)
  return elicitationState(ideaId, userId)
}

/** "Not quite — let me correct you". Re-runs the CONFIRMATION, not the whole of Page 1. */
export async function correctElicitation(
  ideaId: string, userId: string, whatIsWrong: string,
): Promise<ElicitationState> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (!row) throw new Error('No elicitation row')
  if (row.status === 'CONFIRMED') throw new ElicitationClosed()

  const said = (whatIsWrong ?? '').trim()
  await prisma.ideaElicitation.update({
    where: { ideaId },
    data: { corrections: { increment: 1 }, status: 'IN_PROGRESS' },
  })
  await appendTranscript(ideaId, [
    userBubble(said || CORRECTION_PROMPT, ELICITATION_STAGE, 'elicitation:confirm'),
  ])
  await runUnderstanding(ideaId, userId, {
    previous: row.understanding ?? '',
    whatIsWrong: said,
  })
  return elicitationState(ideaId, userId)
}

/**
 * "That's right — build it".
 *
 * Marks the elicitation CONFIRMED and puts the user's own words where the rest of the
 * product already looks for them, through the ORDINARY save path (`submitBox`). Nothing
 * here is a proposal: these are the user's words, authored by the user, so they are
 * ACCEPTED — which is exactly what `submitBox` means and why it is the function used.
 *
 * ⚠ It does NOT start the build. The build is claimed by its own endpoint, so that
 * "confirmed" and "building" are two states and not one, and a failed build does not
 * un-confirm an elicitation the user did agree to.
 */
export async function confirmElicitation(ideaId: string, userId: string): Promise<ElicitationState> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (!row) throw new Error('No elicitation row')
  if (row.status === 'CONFIRMED') return elicitationState(ideaId, userId)
  if (row.status !== 'AWAITING_CONFIRMATION' || !row.understanding) {
    throw new Error('There is nothing to confirm yet.')
  }

  // ══ 25-H §1 — THE ONE-TIME COPY INTO PAGE ONE WAS HERE, AND IT IS GONE ═══════
  //
  // This block called `submitBox('ideaNarrative', problem)` and composed the goal, the
  // ruled-outs, the own-knowledge and the reading into `submitBox('youAndIdeaNarrative')`.
  // It worked — a genuine walk fills both — and it was still the wrong shape, for a reason
  // that only became visible once §3 made every answer editable:
  //
  //   IT RAN ONCE. Edit an answer afterwards and page one still held the words from the
  //   first confirm, with nothing on any screen to say the two disagreed.
  //
  // Page one is now a PROJECTION, recomputed on every canonical-state read
  // (lib/lex/page-one.ts). The elicitation is the store; the fields are a view of it. So a
  // re-confirm, a correction and a pill-edit all reach the proposal by the same path, and
  // there is no path by which they can drift apart.
  //
  // ⚠ AND THE PROJECTION RUNS WHETHER OR NOT THIS FUNCTION IS EVER CALLED. That matters:
  // the 25-F verification harness created elicitations already-CONFIRMED and so skipped
  // this block entirely, producing copies with permanently empty page-one boxes — which
  // Charlie found, re-ran, and reported as a product defect. A projection cannot be
  // skipped by a caller taking a different route to the same state.

  await prisma.ideaElicitation.update({
    where: { ideaId },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  })
  console.log('[lex-diag] 25a elicitation confirmed', {
    ideaId, corrections: row.corrections, presses: row.problemPresses,
    hasOwnKnowledge: !!row.ownKnowledge, hasReading: !!(row.readingUrl || row.readingFileName),
  })
  return elicitationState(ideaId, userId)
}

/** The build's own gate: it may not start until the user has agreed to the reading. */
export async function isConfirmed(ideaId: string): Promise<boolean> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId }, select: { status: true } })
  return row?.status === 'CONFIRMED'
}

/** Everything the build passes need, read once. */
export interface ElicitationContext {
  problem: string
  /** 26-B §2 — what they said they are looking for. Their words, testimony; never a switch. */
  goalDetail: string
  ruledOut: string
  /** ⚠ USER TESTIMONY. Never a citable source. */
  ownKnowledge: string
  aboutYou: string
  /**
   * ⚠⚠ 25-Y §1b — `read` IS NO LONGER THE LITERAL `false`, AND THE OLD COMMENT WAS OUT OF DATE
   * RATHER THAN WRONG. It was written for 25-A, which genuinely could not read a document.
   * Extraction shipped later (`user-material.ts`), and the literal type outlived the limitation
   * it described — so the context has been saying "not read" about four documents that were
   * read, and whose 38 findings are in the evidence layer.
   */
  reading: { url: string | null; fileName: string | null; read: boolean }
  /**
   * ⚠⚠ 25-Y §1a — THE DOCUMENTS THE USER UPLOADED. This is the field whose absence was the
   * defect: `build.ts` never read `IdeaUserMaterial` — git history shows the string has never
   * appeared in that file in any commit, so it was never written rather than removed.
   *
   * ⚠ IT IS READ HERE AND NOT IN `build.ts`, deliberately, though §1a asks for the latter.
   * Every pass already receives this object, on every request, so one read here reaches all
   * eleven; a second reader of the same table in `build.ts` is the drift risk
   * `statutory-graph.ts` documents at length, and the failure it guards against — two readers
   * disagreeing — is exactly what produced this bug in the first place.
   *
   * ⚠ METADATA ONLY, NOT THE TEXT. The findings are already in the evidence layer, with
   * provenance and a verbatim quote each; putting 60,000 characters per document into every
   * pass's prompt would cost more than the build and would re-do work the extraction did once.
   * What the prompt needs is to KNOW the documents exist and were read.
   */
  materials: Array<{ label: string; kind: string; findingCount: number; read: boolean }>
  /**
   * 25-L §1 — what the user said was wrong with the LAST run, when this build is a re-run
   * they asked for through the dialogue. Null on a first build.
   *
   * ⚠ NOT PART OF THE ELICITATION ROW. It is read from the build being run and attached
   * here, because every pass already receives this object and adding a second context
   * parameter to seven pass signatures is how one of them comes to be missed.
   */
  userCritique?: string | null
}

export async function elicitationContext(ideaId: string, userId: string): Promise<ElicitationContext | null> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (!row) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aboutYouNarrative: true } })
  // ⚠ 25-Y §1a — the user's own uploaded documents, read on every pass of every build.
  const materials = await prisma.ideaUserMaterial.findMany({
    where: { ideaId },
    select: { label: true, kind: true, findingCount: true, findingsAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return {
    problem: row.problem ?? '',
    goalDetail: row.goalDetail ?? '',
    ruledOut: row.ruledOut ?? '',
    ownKnowledge: row.ownKnowledge ?? '',
    aboutYou: user?.aboutYouNarrative ?? '',
    // ⚠ 25-Y §1b — READ FROM THE COLUMN. The never-claim rule is honoured by reading the truth,
    // not by hardcoding the pessimistic answer: `readingStatus` is what the extraction sets.
    reading: { url: row.readingUrl, fileName: row.readingFileName, read: row.readingStatus === 'READ' },
    materials: materials.map((m) => ({
      label: m.label,
      kind: m.kind,
      findingCount: m.findingCount ?? 0,
      // ⚠ `findingsAt` is the stamp the extraction writes when it has finished reading. A
      // document with no findings that HAS been read is a real and different state from one
      // nobody has opened, and the prompt must not conflate them.
      read: m.findingsAt != null,
    })),
  }
}
