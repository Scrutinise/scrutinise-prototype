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
  ELICITATION_STEPS, GOAL_KINDS, isGoalKind, stepDef,
  CONFIRM_PREFIX, CONFIRM_SUFFIX, CORRECTION_PROMPT, OPENING_ASK, READING_CAPTURED_NOTE,
  type ElicitationStepKey,
} from './elicitation-config'
import { pressOnProblem, fallbackPress, writeUnderstanding } from './elicitation-client'
import { llmFailed, llmOk } from './build-llm'
import { appendTranscript, lexBubble, readTranscript, userBubble, type TranscriptMessage } from './transcript'

export const ELICITATION_STAGE = 'ELICITATION'

// ── State ────────────────────────────────────────────────────────────────────

export interface ElicitationStepView {
  key: ElicitationStepKey
  label: string
  question: string
  hints: string[]
  optional: boolean
  /** Answered (or deliberately passed over). */
  done: boolean
  /** The stored answer, so a reload shows what was said rather than an empty box. */
  answer: string | null
}

export interface ElicitationState {
  ideaId: string
  status: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
  steps: ElicitationStepView[]
  /** The step the user is on. Null once CONFIRMED. */
  currentStep: ElicitationStepKey | null
  /** §1c — the paragraph, when there is one. */
  understanding: string | null
  /** Problem-gate observability: whether it armed, and how many presses are spent. */
  problemGate: { fired: boolean; presses: number; spent: boolean }
  /** Exchange 4, captured and NOT read. */
  reading: { url: string | null; fileName: string | null; note: string | null; status: string }
  /** The goal options, so the client never hard-codes them. */
  goalKinds: ReadonlyArray<{ key: string; label: string }>
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
    const created = await prisma.ideaElicitation.create({ data: { ideaId, profileSkipped } })
    // The opening ask is said ONCE, when the row is created, so it survives a reload
    // without being repeated on every poll.
    await appendTranscript(ideaId, [lexBubble(OPENING_ASK, ELICITATION_STAGE, 'elicitation:problem')])
    return created
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
      const label = GOAL_KINDS.find((g) => g.key === row.goalKind)?.label ?? row.goalKind
      const bits = [label, row.goalDetail, row.ruledOut ? `Ruled out: ${row.ruledOut}` : ''].filter(Boolean)
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
      // ⚠ NOT just "text present". While the gate has an unspent press outstanding the
      // step is not finished, or a solution-shaped answer would walk straight through
      // the gate that exists to catch it.
      return !!row.problem?.trim() && !gateOutstanding(row)
    case 'goal': return !!row.goalKind
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
type Hydrated = Row & { ownKnowledgeSeen: boolean; readingSeen: boolean; problemAnswersAfterPress: number }

function hydrate(row: Row, messages: TranscriptMessage[]): Hydrated {
  const userTurns = messages.filter((m) => m.role === 'user')
  const answered = (field: string) => userTurns.some((m) => m.field === field)
  const problemAnswers = userTurns.filter((m) => m.field === 'elicitation:problem').length
  return {
    ...row,
    ownKnowledgeSeen: answered('elicitation:ownKnowledge'),
    readingSeen: answered('elicitation:reading'),
    // Presses are interleaved with answers: press 1 comes after answer 1. So the number
    // of answers GIVEN AFTER the last press is (answers - presses).
    problemAnswersAfterPress: Math.max(0, problemAnswers - row.problemPresses),
  }
}

function activeSteps(row: { profileSkipped: boolean }) {
  return ELICITATION_STEPS.filter((s) => s.key !== 'profile' || !row.profileSkipped)
}

export async function elicitationState(ideaId: string, userId: string): Promise<ElicitationState> {
  const base = await ensureRow(ideaId, userId)
  const messages = await readTranscript(ideaId)
  const row = hydrate(base, messages)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aboutYouNarrative: true } })
  const aboutYou = user?.aboutYouNarrative ?? null

  const steps: ElicitationStepView[] = activeSteps(row).map((s) => ({
    key: s.key,
    label: s.label,
    question: s.question,
    hints: s.hints ?? [],
    optional: !!s.optional,
    done: stepDone(row, s.key, aboutYou),
    answer: answerOf(row, s.key, aboutYou),
  }))

  const current = steps.find((s) => !s.done)?.key ?? null
  const hasBuild = (await prisma.ideaBuild.count({ where: { ideaId } })) > 0

  return {
    ideaId,
    status: row.status as ElicitationState['status'],
    steps,
    currentStep: row.status === 'CONFIRMED' ? null : current,
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
    goalKinds: GOAL_KINDS.map((g) => ({ key: g.key, label: g.label })),
    corrections: row.corrections,
    messages,
    hasBuild,
  }
}

// ── Answering a step ─────────────────────────────────────────────────────────

export interface AnswerInput {
  step: ElicitationStepKey
  /** Free text for problem / ownKnowledge / profile / goalDetail. */
  text?: string
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
  if (base.status === 'CONFIRMED') throw new ElicitationClosed()
  const def = stepDef(input.step)
  if (!def) throw new Error(`Unknown elicitation step: ${input.step}`)

  const text = (input.text ?? '').trim()
  const said: TranscriptMessage[] = []
  const lexSaid: string[] = []

  switch (input.step) {
    case 'problem': {
      if (!text) throw new Error('The problem step needs an answer.')
      said.push(userBubble(text, ELICITATION_STAGE, 'elicitation:problem'))

      // §19-D — THE PROBLEM GATE, unchanged in substance and reused rather than
      // reimplemented. `looksLikeASolution` is the deterministic reading that makes the
      // decision OBSERVABLE; the model still makes the judgement.
      const presses = base.problemPresses
      const shaped = looksLikeASolution(text)
      const willPress = shaped && presses < MAX_PROBLEM_PRESSES
      console.log('[lex-diag] 25a problem gate', {
        ideaId, press: presses + 1, solutionShaped: shaped, willPress,
        sourceLen: text.length, sample: text.slice(0, 80),
      })

      if (!willPress) {
        await prisma.ideaElicitation.update({
          where: { ideaId },
          data: { problem: text, problemGateFired: base.problemGateFired || shaped },
        })
        if (shaped) {
          // The gate is spent. Take what they have given, say so once, without reproach.
          const line =
            'Understood — I’ve recorded it as you’ve put it. I’d still like to sharpen what’s going ' +
            'wrong once the causes are on the table, but that can wait; let’s get on.'
          said.push(lexBubble(line, ELICITATION_STAGE, 'elicitation:problem'))
          lexSaid.push(line)
        }
        break
      }

      // Press. The proposal is offered so agreeing is one click, and the press says
      // openly that it is Lex's reading.
      const result = await pressOnProblem({ text, pressesAlready: presses })
      const press = llmOk(result) ? result.value : fallbackPress()
      if (llmFailed(result)) {
        console.warn('[lex-diag] 25a problem press fell back to the deterministic form', {
          reason: result.reason, detail: result.detail,
        })
      }
      await prisma.ideaElicitation.update({
        where: { ideaId },
        data: { problem: text, problemGateFired: true, problemPresses: { increment: 1 } },
      })
      const bubble = press.reading
        ? `${press.press}\n\nMy reading of it, so you only have to agree or correct me: ${press.reading}`
        : press.press
      said.push(lexBubble(bubble, ELICITATION_STAGE, 'elicitation:problem'))
      lexSaid.push(bubble)
      break
    }

    case 'goal': {
      if (!isGoalKind(input.goalKind)) throw new Error('Choose what you want to happen.')
      await prisma.ideaElicitation.update({
        where: { ideaId },
        data: {
          goalKind: input.goalKind,
          goalDetail: text || null,
          ruledOut: (input.ruledOut ?? '').trim() || null,
        },
      })
      const label = GOAL_KINDS.find((g) => g.key === input.goalKind)!.label
      const ruled = (input.ruledOut ?? '').trim()
      said.push(userBubble(
        [label, text, ruled ? `Ruled out: ${ruled}` : ''].filter(Boolean).join(' — '),
        ELICITATION_STAGE, 'elicitation:goal',
      ))
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
    goalKindLabel: GOAL_KINDS.find((g) => g.key === row.goalKind)?.label ?? 'not stated',
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

  const problem = (row.problem ?? '').trim()
  if (problem) await submitBox(ideaId, userId, 'ideaNarrative', problem)

  // Exchange 2 + 3 compose the "you and the idea" narrative. The own-knowledge half is
  // LABELLED where it is stored, so a reader of the field — human or model — can see
  // which sentences are the user's testimony rather than anything retrieved.
  const goalLabel = GOAL_KINDS.find((g) => g.key === row.goalKind)?.label
  const parts = [
    goalLabel ? `What I want to happen: ${goalLabel}${row.goalDetail ? ` — ${row.goalDetail}` : ''}` : '',
    row.ruledOut ? `Already ruled out: ${row.ruledOut}` : '',
    row.ownKnowledge ? `What I know that the record won’t show (my own experience): ${row.ownKnowledge}` : '',
    row.readingUrl || row.readingFileName
      ? `Given to read, NOT yet read by Lex: ${[row.readingUrl, row.readingFileName].filter(Boolean).join(' · ')}`
      : '',
  ].filter(Boolean)
  if (parts.length) await submitBox(ideaId, userId, 'youAndIdeaNarrative', parts.join('\n\n'))

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
  goalKind: string | null
  goalKindLabel: string
  goalDetail: string
  ruledOut: string
  /** ⚠ USER TESTIMONY. Never a citable source. */
  ownKnowledge: string
  aboutYou: string
  reading: { url: string | null; fileName: string | null; read: false }
}

export async function elicitationContext(ideaId: string, userId: string): Promise<ElicitationContext | null> {
  const row = await prisma.ideaElicitation.findUnique({ where: { ideaId } })
  if (!row) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aboutYouNarrative: true } })
  return {
    problem: row.problem ?? '',
    goalKind: row.goalKind,
    goalKindLabel: GOAL_KINDS.find((g) => g.key === row.goalKind)?.label ?? 'not stated',
    goalDetail: row.goalDetail ?? '',
    ruledOut: row.ruledOut ?? '',
    ownKnowledge: row.ownKnowledge ?? '',
    aboutYou: user?.aboutYouNarrative ?? '',
    // `read` is a literal false, not a column read: 25-A cannot read a document, and a
    // field that could ever be true here would be the never-claim rule waiting to break.
    reading: { url: row.readingUrl, fileName: row.readingFileName, read: false },
  }
}
