import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getRootCommunityId, getSubtreeIds } from '@/lib/community'

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2d — bulk question upload.
//
// Mirrors `scripts/import-central-seed.ts`, with ONE deliberate difference: the
// script aborts the whole file when a context tag is unknown, and this does
// not. In a UI, telling the admin which three of two hundred rows are wrong is
// more useful than refusing all two hundred — so a bad row fails and is named,
// and the rows around it still import.
//
// Everything else is the script's discipline, kept:
//   · two steps — parse and validate, show exactly what will be created, then
//     write only on an explicit confirmation;
//   · an unknown context is an ERROR, never a guess. A context tag's KIND
//     (out in the world / behind the scenes) cannot be inferred from a
//     question, so inventing one would put the question on the wrong side of
//     the toggle forever;
//   · idempotent on question text and answer body, so re-uploading the same
//     file writes nothing;
//   · the Notes column is read for nothing. It exists so the person filling in
//     the spreadsheet has somewhere to talk to themselves.
//
// Attribution: every row is authored by the UPLOADING USER. That is stated on
// the upload screen, because it is the thing that goes wrong quietly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The template's columns, in the template's order — matched to the shipped
 * workbook exactly.
 *
 * ⚠ Stage 2e: the Notes column is headed `Notes (not imported)` in the file
 *   Charlie supplied, and this list is the validator's idea of what the file
 *   looks like, so it says the same. `Notes` on its own is still accepted as a
 *   heading (someone's older copy), and both are read for nothing.
 */
export const TEMPLATE_COLUMNS = [
  'Question',
  'Context',
  'Topics',
  'Answer',
  'Sources',
  'Local example',
  'Notes (not imported)',
] as const

/** Read for nothing, ever. Asserted by check:central. */
export const NEVER_IMPORTED_COLUMNS = ['Notes (not imported)', 'Notes'] as const

/**
 * The sheet the questions are on.
 *
 * ⚠ NOT `SheetNames[0]`. The shipped template's first sheet is "Read me first",
 *   so reading sheet one would have parsed the instructions as questions and
 *   reported that the file has no Question column. Named sheet first, first
 *   sheet only as a fallback for a plain .csv or a hand-rolled workbook.
 */
export const QUESTIONS_SHEET = 'Questions'

/**
 * Rows the template ships with, which are not data.
 *
 * The row under the header explains each column ("Required. One question, in
 * the words it was actually asked."), and three grey rows carry worked examples
 * the readme asks you to delete. Someone will forget. They are reported as
 * skipped with the reason, not as errors — an unedited example row is a normal
 * thing to leave in, not a mistake worth colouring red.
 */
const EXAMPLE_PREFIX = /^EXAMPLE\s*[—–-]\s*delete this row\.?\s*/i
const GUIDANCE_CELL = /^(Required|Optional)\.\s/i

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
export const MAX_ROWS = 500

export type ParsedRow = {
  /** 1-based row number as the admin sees it in their spreadsheet (header = 1). */
  rowNumber: number
  question: string
  context: string
  topics: string[]
  answer: string
  sources: string[]
  localExample: string
  /** A row the template ships with: its column guidance, or a worked example. */
  scaffold: 'guidance' | 'example' | null
}

export type RowPlan = {
  rowNumber: number
  question: string
  context: string
  topics: string[]
  hasAnswer: boolean
  sources: string[]
  localExample: string | null
  /** create — a new question; add-answer — question exists, answer is new;
   *  skip — already present in full; error — reported, nothing written. */
  action: 'create' | 'add-answer' | 'skip' | 'error'
  /** Why this row will not be written, in words an admin can act on. */
  errors: string[]
  /** Why a valid row writes nothing. */
  note: string | null
}

export type ImportPlan = {
  communityId: string
  communityName: string
  columns: string[]
  missingColumns: string[]
  rows: RowPlan[]
  counts: {
    total: number
    questionsToCreate: number
    answersToCreate: number
    skipped: number
    errors: number
  }
  /** Topic labels that are not in the tag set and would be created with the
   *  questions. Topics, unlike contexts, have no ambiguous kind, so they can be
   *  created — unpromoted, so they land in the dropdown, not the chip row. */
  topicsToCreate: string[]
  knownContexts: string[]
}

// ── parsing ──────────────────────────────────────────────────────────────────

function cell(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).replace(/ /g, ' ').trim()
}

/**
 * Topics and Sources are multi-valued in one cell.
 *
 * ⚠ A COMMA IS NOT A SEPARATOR, AND CANNOT BE (26 Aug 2026). It used to be, and
 * that quietly corrupted five of the thirty-five topics the shipped template
 * offers in its own "Valid values" list — every one whose name contains a
 * comma:
 *
 *     Department for Culture, Media and Sport
 *     Department for Environment, Food and Rural Affairs
 *     Department for Science, Innovation and Technology
 *     Foreign, Commonwealth and Development Office
 *     Ministry of Housing, Communities and Local Government
 *
 * Picking DCMS from the list produced the tags "Department for Culture" and
 * "Media and Sport" — two new topics nobody asked for, created silently. It
 * mangled citation text in Sources for the same reason.
 *
 * The template has always said "Separate several with a semicolon", so this is
 * the parser being made to match its own documentation. Someone who commas them
 * anyway now gets one long unknown topic, which the preview SHOWS them as a
 * topic that would be created — visible and correctable, rather than silent.
 */
function splitList(v: string): string[] {
  return v
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Read an .xlsx or .csv upload into rows.
 *
 * SheetJS sniffs the format from the bytes, so one path handles both and a
 * mislabelled extension still reads correctly. `raw: false` keeps everything as
 * the strings the admin typed — a question that starts with a number must not
 * arrive as a float.
 */
export function parseUpload(buffer: Buffer): { rows: ParsedRow[]; columns: string[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false })
  const sheetName =
    wb.SheetNames.find((n) => n.trim().toLowerCase() === QUESTIONS_SHEET.toLowerCase()) ??
    wb.SheetNames[0]
  if (!sheetName) throw new ImportFormatError('That file has no sheets in it.')
  const sheet = wb.Sheets[sheetName]

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false })
  if (grid.length === 0) throw new ImportFormatError('That file is empty.')

  const header = (grid[0] as unknown[]).map(cell)
  const index = new Map<string, number>()
  header.forEach((h, i) => {
    const key = h.toLowerCase()
    if (key && !index.has(key)) index.set(key, i)
  })
  // ⚠ SheetJS will read almost anything as a one-cell CSV, so "it parsed" is
  // not evidence that this is the right file. A header row carrying none of the
  // template's columns is a different document, and saying so beats handing the
  // admin an empty preview with no explanation.
  if (!TEMPLATE_COLUMNS.some((c) => index.has(c.toLowerCase()))) {
    throw new ImportFormatError(
      'That does not look like the question template — none of its columns are here. ' +
        `The first row reads: ${header.filter(Boolean).slice(0, 6).join(' | ') || '(empty)'}. ` +
        `It needs at least ${TEMPLATE_COLUMNS.slice(0, 2).join(' and ')}.`,
    )
  }

  const at = (row: unknown[], name: string): string => {
    const i = index.get(name.toLowerCase())
    return i === undefined ? '' : cell(row[i])
  }

  const rows: ParsedRow[] = []
  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r] as unknown[]
    const row: ParsedRow = {
      rowNumber: r + 1,
      question: at(raw, 'Question'),
      context: at(raw, 'Context'),
      topics: splitList(at(raw, 'Topics')),
      answer: at(raw, 'Answer'),
      sources: splitList(at(raw, 'Sources')),
      localExample: at(raw, 'Local example'),
      scaffold: null,
      // The Notes column is deliberately not read. See NEVER_IMPORTED_COLUMNS.
    }
    // A row that is blank across every column we read is spreadsheet padding,
    // not an error the admin needs to see.
    if (!row.question && !row.context && !row.answer && row.topics.length === 0) continue

    if (EXAMPLE_PREFIX.test(row.question)) {
      row.scaffold = 'example'
    } else if (GUIDANCE_CELL.test(row.question) && GUIDANCE_CELL.test(row.context)) {
      row.scaffold = 'guidance'
    }
    rows.push(row)
  }

  return { rows, columns: header.filter(Boolean) }
}

export class ImportFormatError extends Error {}

// ── validating ───────────────────────────────────────────────────────────────

/**
 * Build the plan: exactly what would be created, and which rows would not be,
 * with the reason on each. Writes nothing.
 */
export async function planImport(communityId: string, buffer: Buffer): Promise<ImportPlan> {
  const rootId = await getRootCommunityId(communityId)
  const community = await prisma.community.findUniqueOrThrow({
    where: { id: rootId },
    select: { id: true, name: true },
  })

  const { rows, columns } = parseUpload(buffer)
  if (rows.length > MAX_ROWS) {
    throw new ImportFormatError(`That file has ${rows.length} rows; the limit is ${MAX_ROWS} in one upload.`)
  }

  const required = ['Question', 'Context']
  const lower = new Set(columns.map((c) => c.toLowerCase()))
  const missingColumns = required.filter((c) => !lower.has(c.toLowerCase()))

  const tags = await prisma.questionTag.findMany({
    where: { communityId: rootId },
    select: { kind: true, label: true },
  })
  const knownContexts = tags.filter((t) => t.kind.startsWith('CONTEXT_')).map((t) => t.label)
  const knownContextLower = new Map(knownContexts.map((l) => [l.toLowerCase(), l]))
  const knownTopics = new Map(
    tags.filter((t) => t.kind === 'TOPIC').map((t) => [t.label.toLowerCase(), t.label]),
  )

  const existing = await prisma.question.findMany({
    where: { communityId: rootId },
    select: { id: true, text: true, answers: { select: { body: true } } },
  })
  const byText = new Map(existing.map((q) => [q.text, q]))

  // Two rows in the SAME file can collide with each other as well as with the
  // database — a plan that only checked the database would promise two
  // creations and deliver one.
  const seenInFile = new Set<string>()
  const seenAnswersInFile = new Map<string, Set<string>>()

  const topicsToCreate = new Set<string>()
  const plan: RowPlan[] = []

  for (const row of rows) {
    // The template's own scaffolding is reported and skipped before anything
    // else is judged. Its guidance row would otherwise fail on every column at
    // once, which reads as a broken file rather than a row to delete.
    if (row.scaffold) {
      plan.push({
        rowNumber: row.rowNumber,
        question: row.question,
        context: row.context,
        topics: row.topics,
        hasAnswer: Boolean(row.answer),
        sources: row.sources,
        localExample: row.localExample || null,
        action: 'skip',
        errors: [],
        note:
          row.scaffold === 'guidance'
            ? 'This is the template’s column guidance, not a question. Skipped.'
            : 'This is one of the template’s example rows. Skipped — delete it from the file if you like.',
      })
      continue
    }

    const errors: string[] = []
    if (missingColumns.length) {
      errors.push(`The file has no ${missingColumns.join(' or ')} column.`)
    }
    if (!row.question) errors.push('No question text.')
    else if (row.question.length < 5) errors.push('Question is too short (5 characters minimum).')
    else if (row.question.length > 500) errors.push(`Question is ${row.question.length} characters; the limit is 500.`)

    let canonicalContext = ''
    if (!row.context) {
      errors.push('No context. Every question needs one, and it must be one the Community already uses.')
    } else {
      const match = knownContextLower.get(row.context.toLowerCase())
      if (!match) {
        errors.push(
          `“${row.context}” is not a context in this Community. ` +
            `Use one of: ${knownContexts.join(', ')}.`,
        )
      } else canonicalContext = match
    }

    const canonicalTopics = row.topics.map((t) => knownTopics.get(t.toLowerCase()) ?? t)
    if (row.topics.length > 8) errors.push(`${row.topics.length} topics; the limit is 8.`)

    if (errors.length) {
      plan.push({
        rowNumber: row.rowNumber,
        question: row.question,
        context: row.context,
        topics: canonicalTopics,
        hasAnswer: Boolean(row.answer),
        sources: row.sources,
        localExample: row.localExample || null,
        action: 'error',
        errors,
        note: null,
      })
      continue
    }

    for (const t of canonicalTopics) if (!knownTopics.has(t.toLowerCase())) topicsToCreate.add(t)

    const dbQuestion = byText.get(row.question)
    const inFile = seenInFile.has(row.question)
    const knownAnswers = new Set([
      ...(dbQuestion?.answers.map((a) => a.body) ?? []),
      ...(seenAnswersInFile.get(row.question) ?? []),
    ])

    let action: RowPlan['action']
    let note: string | null = null
    if (!dbQuestion && !inFile) {
      action = 'create'
    } else if (row.answer && !knownAnswers.has(row.answer)) {
      action = 'add-answer'
      note = inFile
        ? 'Another row in this file asks the same question — this adds its answer to that one.'
        : 'This question is already in the library — this adds a new answer to it.'
    } else {
      action = 'skip'
      note = row.answer
        ? 'Already in the library, with this answer. Nothing to write.'
        : 'Already in the library. Nothing to write.'
    }

    seenInFile.add(row.question)
    if (row.answer) {
      const set = seenAnswersInFile.get(row.question) ?? new Set<string>()
      set.add(row.answer)
      seenAnswersInFile.set(row.question, set)
    }

    plan.push({
      rowNumber: row.rowNumber,
      question: row.question,
      context: canonicalContext,
      topics: canonicalTopics,
      hasAnswer: Boolean(row.answer),
      sources: row.sources,
      localExample: row.localExample || null,
      action,
      errors: [],
      note,
    })
  }

  return {
    communityId: rootId,
    communityName: community.name,
    columns,
    missingColumns,
    rows: plan,
    counts: {
      total: plan.length,
      questionsToCreate: plan.filter((r) => r.action === 'create').length,
      answersToCreate: plan.filter((r) => (r.action === 'create' || r.action === 'add-answer') && r.hasAnswer).length,
      skipped: plan.filter((r) => r.action === 'skip').length,
      errors: plan.filter((r) => r.action === 'error').length,
    },
    topicsToCreate: [...topicsToCreate].sort(),
    knownContexts,
  }
}

// ── writing ──────────────────────────────────────────────────────────────────

export type ImportResult = {
  plan: ImportPlan
  written: {
    questions: number
    answers: number
    topicTags: number
  }
  /** The rows that were not written, unchanged from the plan. */
  failed: RowPlan[]
}

/**
 * Apply the plan. The file is re-parsed and re-planned here rather than trusting
 * a plan posted back by the browser — a preview is a promise about a file, not a
 * writable instruction, and the two must be computed from the same bytes.
 *
 * ATTRIBUTION: every question and answer is authored by `uploaderId`. There is
 * no per-row author column and there will not be one; a bulk vector that could
 * name any author is a bulk impersonation vector.
 */
export async function applyImport(params: {
  communityId: string
  standingOnId: string
  uploaderId: string
  buffer: Buffer
}): Promise<ImportResult> {
  const { communityId, standingOnId, uploaderId, buffer } = params
  const plan = await planImport(communityId, buffer)
  const { rows } = parseUpload(buffer)
  const byRow = new Map(rows.map((r) => [r.rowNumber, r]))

  // New topics land unpromoted, on every node, because the tag set is seeded
  // per node (Stage 2b) and a member standing at a branch reads that branch's.
  const nodeIds = await getSubtreeIds(plan.communityId)
  let topicTags = 0
  if (plan.topicsToCreate.length) {
    const present = new Set(
      (
        await prisma.questionTag.findMany({
          where: { communityId: { in: nodeIds }, kind: 'TOPIC', label: { in: plan.topicsToCreate } },
          select: { communityId: true, label: true },
        })
      ).map((t) => `${t.communityId}\u0000${t.label}`),
    )
    const toCreate = nodeIds.flatMap((nodeId) =>
      plan.topicsToCreate
        .filter((label) => !present.has(`${nodeId}\u0000${label}`))
        .map((label) => ({ communityId: nodeId, kind: 'TOPIC', label, promoted: false, sortOrder: 99 })),
    )
    if (toCreate.length) {
      topicTags = (await prisma.questionTag.createMany({ data: toCreate, skipDuplicates: true })).count
    }
  }

  // The author's branch, resolved once — the same rule the single-question POST
  // route uses, so a bulk question is tagged the way a typed one is.
  const branchId = await resolveBranchId(uploaderId, standingOnId, plan.communityId)

  let questions = 0
  let answers = 0
  for (const row of plan.rows) {
    if (row.action === 'error' || row.action === 'skip') continue
    const source = byRow.get(row.rowNumber)
    if (!source) continue

    let questionId: string
    if (row.action === 'create') {
      const created = await prisma.question.create({
        data: {
          communityId: plan.communityId,
          authorId: uploaderId,
          text: source.question,
          scope: 'COMMUNITY',
          branchId,
          contextTags: [row.context],
          topicTags: row.topics,
        },
        select: { id: true },
      })
      questionId = created.id
      questions++
    } else {
      const found = await prisma.question.findFirst({
        where: { communityId: plan.communityId, text: source.question },
        select: { id: true },
      })
      if (!found) continue
      questionId = found.id
    }

    if (source.answer) {
      const already = await prisma.answer.findFirst({
        where: { questionId, body: source.answer },
        select: { id: true },
      })
      if (!already) {
        await prisma.answer.create({
          data: {
            questionId,
            authorId: uploaderId,
            body: source.answer,
            sources: source.sources,
            localExample: source.localExample || null,
          },
        })
        answers++
      }
    }
  }

  return {
    plan,
    written: { questions, answers, topicTags },
    failed: plan.rows.filter((r) => r.action === 'error'),
  }
}

async function resolveBranchId(userId: string, standingOnId: string, rootId: string): Promise<string | null> {
  const standingOn = await prisma.community.findUnique({
    where: { id: standingOnId },
    select: { id: true, parentCommunityId: true },
  })
  if (standingOn?.parentCommunityId) return standingOn.id
  const nodeIds = await getSubtreeIds(rootId)
  const membership = await prisma.communityMember.findFirst({
    where: {
      userId,
      communityId: { in: nodeIds },
      community: { parentCommunityId: { not: null } },
    },
    orderBy: { joinedAt: 'asc' },
    select: { communityId: true },
  })
  return membership?.communityId ?? null
}
