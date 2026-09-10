// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §7 — A PROPOSAL CAN NAME THE QUESTIONS IT CANNOT SETTLE, AND QUEUE THEM.
//
// Charlie, and it is a specification rather than a comment:
//
//   **"Identifying things that need their own idea-project is a valid output from an idea.
//     It's not an ever-flowing hierarchy."**
//
// Working the Human Rights Act measure produced nineteen rights, five of which cannot be
// resolved inside that measure: each needs its own analysis of whether the protection
// survives repeal elsewhere, is abandoned, or is re-enacted. Today the system has nowhere to
// put that. It either swallows the question, or it inflates the parent trying to answer it.
//
// The difference this makes is not a feature: **it is the difference between a tool that
// produces a document and a tool that produces a work programme.** A legislator reading
// "five of these need their own analysis, here they are, they are on the list" can staff and
// sequence that. A legislator reading one long document has been handed homework.
//
// ══ ⚠⚠ IT TERMINATES, AND THAT IS A MECHANISM AND NOT A PROMPT ═══════════════════════════
//
// Charlie's constraint: *a spawned idea is named and queued, not automatically worked;
// nothing recurses without a person asking for it.* Two things enforce it, and neither is an
// instruction to a model:
//
//   1. `refuseToSpawn()` — a spawned idea may not itself spawn. The guard is on the ROW
//      (`spawnedFromIdeaId IS NOT NULL`), so depth is capped at one by construction. A prompt
//      saying "do not go deeper" is not a cap; a row that cannot be a parent is.
//   2. A spawned idea is created and **NOT BUILT**. Nothing enqueues it. It sits at stage 1
//      with its question, waiting for a person.
//
// ⚠ THE CAP IS A SAFETY VALVE, NOT A SELECTION RULE. `SPAWN_MAX` bounds what is written in
// one pass; when it bites, the fact that it bit is returned, so a caller can say "6 of 9
// shown" rather than presenting a truncation as a finding. This codebase has already shipped
// a ranking rule used as a filter once.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callJson, llmFailed, type LlmUsage } from './build-llm'
import { M_GENERAL } from './method'
import { kernelText } from './build'

/**
 * ⚠ A BOUND ON ONE PASS, NOT A JUDGEMENT ABOUT HOW MANY QUESTIONS A PROPOSAL HAS.
 * When it bites, `cappedAt` is returned so the caller reports the truncation.
 */
export const SPAWN_MAX = 8

export interface SpawnCandidate {
  /** A short name that reads as a proposal in its own right, not as a task. */
  title: string
  /** The question that has to be settled, in one sentence, as a question. */
  question: string
  /** Why it cannot be settled inside the parent. The test the whole pass turns on. */
  whyNotHere: string
}

export interface SpawnProposal {
  candidates: SpawnCandidate[]
  /** True when `SPAWN_MAX` cut the list. Reported, never silently applied. */
  cappedAt: number | null
  /** How many the model returned before the cap and before filtering. */
  returned: number
}

/** Why an idea may not spawn. Null means it may. */
export async function refuseToSpawn(ideaId: string): Promise<string | null> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { id: true, spawnedFromIdeaId: true, archivedAt: true, deletedAt: true },
  })
  if (!idea) return 'no such idea'
  if (idea.deletedAt) return 'the idea is deleted'
  if (idea.archivedAt) return 'the idea is archived'
  // ⚠⚠ THE TERMINATION. Depth is capped at one by the row, not by a prompt.
  if (idea.spawnedFromIdeaId) {
    return 'this idea was itself spawned from another, and a spawned idea does not spawn again — '
      + 'nothing recurses without a person asking for it'
  }
  return null
}

const SPAWN_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          question: { type: 'string' },
          whyNotHere: { type: 'string' },
        },
        required: ['title', 'question', 'whyNotHere'],
      },
    },
  },
  required: ['candidates'],
} as const

/**
 * Read the proposal and name the questions it cannot settle. **Writes nothing.**
 *
 * ⚠ The separation is deliberate: proposing is a model call and writing is a change to
 * somebody's workspace, and a caller must be able to do the first and show it to a person
 * before doing the second.
 */
export async function proposeSpawns(input: {
  ideaId: string
  model?: string
  onUsage: (u: LlmUsage) => void
}): Promise<SpawnProposal | null> {
  const kernel = await kernelText(input.ideaId)
  if (!kernel.trim()) return null

  // The open questions the build already found, so the pass does not re-derive them.
  const issues = await prisma.deepeningIssue.findMany({
    where: { ideaId: input.ideaId, status: 'OPEN' },
    select: { title: true, text: true },
    orderBy: { createdAt: 'asc' },
    take: 60,
  })

  const system = [
    M_GENERAL,
    '',
    '════ WHICH QUESTIONS NEED THEIR OWN PROPOSAL? ════',
    '',
    'You are reading a finished policy proposal. Name the questions it CANNOT SETTLE WITHIN ITSELF',
    'and which therefore need a proposal of their own.',
    '',
    '⚠ THE TEST IS NOT "IS THIS IMPORTANT". It is: **could this be answered by writing another',
    'paragraph in THIS proposal, or does answering it require its own diagnosis, its own evidence and',
    'its own decision?** If a paragraph would do it, it belongs here and you must not name it.',
    '',
    'The shape that qualifies: the proposal repeals or removes something that was doing several jobs,',
    'and each job now needs deciding separately — does this protection survive elsewhere, is it',
    'abandoned deliberately, or must it be re-enacted? Each of those is a proposal.',
    '',
    'The shape that does NOT qualify, and these are the ones to refuse:',
    '  · an implementation step ("draft the Bill", "consult the devolved administrations") — that is',
    '    a coherent action of THIS proposal, not a separate one.',
    '  · a risk or an objection ("this may be unpopular") — that is a challenge, and it already has',
    '    somewhere to live.',
    '  · a research task ("find out what Canada did") — that is a question for the research pass.',
    '  · a restatement of the proposal at a different size.',
    '',
    '⚠ `title` READS AS A PROPOSAL IN ITS OWN RIGHT, and somebody who has not read the parent must be',
    'able to tell what it is about. Not "Article 8" — "What replaces Article 8 private-life protection',
    'after repeal".',
    '',
    '⚠ `question` IS A QUESTION, ending in a question mark, that a person could be asked to go and',
    'answer. `whyNotHere` says what makes it unanswerable inside the parent — and if you cannot write',
    'that sentence honestly, the item does not belong on this list.',
    '',
    '⚠⚠ RETURNING AN EMPTY LIST IS A REAL AND RESPECTABLE ANSWER. Most proposals do not fragment.',
    'A list padded to look thorough turns a work programme into a backlog nobody trusts.',
  ].join('\n')

  const user = [
    '═══ THE PROPOSAL ═══',
    kernel,
    issues.length ? `\n═══ QUESTIONS ALREADY OPEN ON IT (do not simply repeat these) ═══\n${
      issues.map((i) => `- ${i.title ?? ''} ${i.text}`.trim()).join('\n').slice(0, 6000)}` : '',
  ].filter(Boolean).join('\n')

  const result = await callJson<{ candidates: SpawnCandidate[] }>({
    model: input.model ?? process.env.LEX_SPAWN_MODEL ?? 'gemini-2.5-pro',
    system,
    user,
    schema: SPAWN_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_SPAWN_TOKENS ?? '8000', 10),
    timeoutMs: parseInt(process.env.LEX_SPAWN_TIMEOUT_MS ?? '120000', 10),
    temperature: 0.2,
    label: 'spawn',
  })
  input.onUsage(result.usage)
  if (llmFailed(result)) {
    console.error('[spawn] the pass did not complete', { reason: result.reason, detail: result.detail?.slice(0, 300) })
    return null
  }

  // ⚠ `?? []` IS NOT ENOUGH ON ITS OWN — a declared schema is a request, not a guarantee, and
  // this codebase has had a string arrive where an array was declared and kill four passes.
  const raw = Array.isArray(result.value?.candidates) ? result.value.candidates : []
  const clean = raw
    .filter((c) => c && typeof c.title === 'string' && typeof c.question === 'string'
      && typeof c.whyNotHere === 'string'
      && c.title.trim() && c.question.trim() && c.whyNotHere.trim())
    .map((c) => ({ title: c.title.trim(), question: c.question.trim(), whyNotHere: c.whyNotHere.trim() }))

  return {
    candidates: clean.slice(0, SPAWN_MAX),
    cappedAt: clean.length > SPAWN_MAX ? SPAWN_MAX : null,
    returned: raw.length,
  }
}

export interface WrittenSpawn { id: string; title: string; reused: boolean }

/**
 * Create the queued ideas. **They are not built and nothing enqueues them.**
 *
 * ⚠ IDEMPOTENT BY (parent, title). Running the pass twice must not double the queue; a
 * candidate whose title already exists under this parent is returned with `reused: true` so
 * the caller can report "3 new, 2 already there" rather than claiming five.
 */
export async function writeSpawns(
  parentIdeaId: string,
  creatorId: string,
  candidates: SpawnCandidate[],
  passKey = 'SPAWN',
  /**
   * ⚠⚠ ADD TO A QUEUE THAT ALREADY EXISTS. OFF BY DEFAULT, AND THE REASON IS MEASURED.
   *
   * The pass is not deterministic. Run twice on the same kernel it named four questions and
   * then three different ones — which is the same instability `LOGIC_CHECK` shows, arriving in
   * a place where it does more damage: idempotency by TITLE cannot hold when the titles change
   * between runs, so re-running would have grown the queue for ever, one plausible new item at
   * a time, and every addition would have looked like a finding.
   *
   * So a parent that already has children is refused unless a caller says otherwise. **A work
   * programme that silently lengthens every time somebody re-runs a pass is not a work
   * programme.**
   */
  extendExisting = false,
): Promise<WrittenSpawn[]> {
  const refusal = await refuseToSpawn(parentIdeaId)
  if (refusal) throw new Error(`refusing to spawn: ${refusal}`)

  const already = await prisma.idea.count({ where: { spawnedFromIdeaId: parentIdeaId } })
  if (already > 0 && !extendExisting) {
    throw new Error(
      `refusing to spawn: this idea already has ${already} spawned idea(s). The pass is not `
      + 'deterministic — a second run names different questions — so writing again would grow the '
      + 'queue rather than reproduce it. Pass extendExisting to add deliberately.')
  }

  const existing = await prisma.idea.findMany({
    where: { spawnedFromIdeaId: parentIdeaId },
    select: { id: true, title: true },
  })
  const byTitle = new Map(existing.map((e) => [e.title.trim().toLowerCase(), e.id]))

  const out: WrittenSpawn[] = []
  for (const c of candidates) {
    const key = c.title.trim().toLowerCase()
    const already = byTitle.get(key)
    if (already) { out.push({ id: already, title: c.title, reused: true }); continue }
    const created = await prisma.idea.create({
      data: {
        creatorId,
        title: c.title,
        // ⚠ THE QUESTION GOES IN THE PROBLEM FIELD AS WELL AS IN `spawnedQuestion`. The column
        // is the provenance; `challenge` is what the person actually sees when they open it, and
        // an idea that opens blank is one nobody picks up.
        challenge: c.question,
        // ══ ⚠⚠ EMPTY, AND THE EMPTINESS IS LOAD-BEARING ═══════════════════════════════════
        //
        // `summaryDescription` and `govtArea` are required by the schema, and the product's own
        // `POST /api/ideas` writes `''` for both with the comment "populated by Lex". Copied
        // rather than improvised — but there is a second reason here.
        //
        // **Stage 1 → 2 fires automatically when title AND summaryDescription are both
        // non-empty.** Writing a summary would promote every spawned idea out of stage 1 the
        // first time anything patched it, which is the opposite of "named and queued, not
        // automatically worked". The blank is what keeps it waiting for a person.
        summaryDescription: '',
        govtArea: '',
        stage: 'STAGE_1',
        visibility: 'PRIVATE',
        status: 'DRAFT',
        spawnedFromIdeaId: parentIdeaId,
        spawnedQuestion: c.question,
        spawnedWhyNotHere: c.whyNotHere,
        spawnedByPassKey: passKey,
        spawnedAt: new Date(),
      },
      select: { id: true, title: true },
    })
    out.push({ id: created.id, title: created.title, reused: false })
  }
  return out
}
