/**
 * CENTRAL — import the pilot seed set into the question library.
 *
 *   dry run :  tsx --env-file=.env scripts/import-central-seed.ts
 *   apply   :  tsx --env-file=.env scripts/import-central-seed.ts --apply
 *
 * Flags
 *   --file=<path>            seed JSON (default ../docs/central_seed_set.json)
 *   --community=<uuid>       target ROOT Community (default: the only root)
 *   --promote-new-topics     create new TOPIC tags promoted (chip row) rather
 *                            than unpromoted (dropdown), which is what
 *                            central_stage2b.sql says a later addition gets
 *   --apply                  actually write. Everything else is a dry run.
 *
 * What this script deliberately does NOT do:
 *
 *  · It does not invent an `authorType` / `aiModel` column. The seed file marks
 *    every answer as authorType AI, and `Answer` has no such field at Stage 2b.
 *    Provenance is carried by the AUTHOR ACCOUNT instead — a single seed user
 *    (isHistoricalAccount, not a Community member) that every seeded question
 *    and answer is attributed to. Attributing them to a real member would have
 *    barred that member from voting on any of them (self-voting is refused),
 *    and in a two-member pilot that is most of the electorate.
 *
 *  · It does not import `trainingSessions`. There is no TrainingSession model
 *    (the training marketplace is a later stage), the nearest fit —
 *    ActivityClaim — pays points on approval, and the seed file's own import
 *    note says to hold the record until both participants have real accounts
 *    and never to create placeholder users. Reported, not written.
 *
 * Both are printed in the report rather than left for someone to notice.
 */
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { z } from 'zod'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// ── args ─────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const PROMOTE_NEW_TOPICS = argv.includes('--promote-new-topics')
function argValue(name: string): string | null {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const FILE = resolve(argValue('file') ?? join(__dirname, '..', '..', 'docs', 'central_seed_set.json'))
const COMMUNITY_ARG = argValue('community')

// ── the seed file's shape ────────────────────────────────────────────────────

const AnswerSchema = z.object({
  authorType: z.literal('AI'),
  aiModel: z.string(),
  body: z.string().min(1),
  sources: z.array(z.string().url()).optional(),
})
const QuestionSchema = z.object({
  text: z.string().min(1),
  context: z.string().min(1),
  topics: z.array(z.string().min(1)),
  answers: z.array(AnswerSchema),
})
const SeedSchema = z.object({
  _meta: z.object({
    title: z.string(),
    prepared: z.string(),
    topicTagsToCreate: z.array(z.string()),
  }).passthrough(),
  questions: z.array(QuestionSchema),
  trainingSessions: z.array(z.record(z.string(), z.unknown())).optional(),
})

// ── the seed author ──────────────────────────────────────────────────────────
//
// One account, clearly a seed account, never a Community member. `Lex` is the
// platform's name for the AI (docs/CLAUDE.md §4 — never "Claude" in a surface),
// and the model that actually wrote the text is recorded in the report and the
// CHANGE_LOG rather than in a column that does not exist.
const SEED_AUTHOR = {
  clerkId: 'seed_central_lex',
  username: 'lex',
  email: 'lex@scrutinise.org',
  firstName: 'Lex',
  lastName: 'Scrutinise',
  name: 'Lex',
  referralCode: 'seed-central-lex',
}

type Plan = {
  communityId: string
  communityName: string
  nodeIds: string[]
  author: { id: string | null; created: boolean }
  topicsToCreate: string[]
  missingContexts: string[]
  questionsToCreate: { text: string; context: string; topics: string[]; answers: number }[]
  questionsExisting: string[]
  answersToCreate: number
  answersExisting: number
}

async function main() {
  console.log(`\nCENTRAL seed import — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`file: ${FILE}`)

  const seed = SeedSchema.parse(JSON.parse(readFileSync(FILE, 'utf8')))
  console.log(`seed: "${seed._meta.title}" prepared ${seed._meta.prepared}`)
  console.log(`      ${seed.questions.length} questions, ` +
    `${seed.questions.reduce((s, q) => s + q.answers.length, 0)} answers, ` +
    `${seed.questions.filter((q) => q.answers.length === 0).length} deliberately unanswered`)

  // ── target Community ───────────────────────────────────────────────────────
  const roots = await prisma.community.findMany({
    where: { parentCommunityId: null },
    select: { id: true, name: true },
  })
  let root: { id: string; name: string }
  if (COMMUNITY_ARG) {
    const found = roots.find((r) => r.id === COMMUNITY_ARG)
    if (!found) throw new Error(`--community=${COMMUNITY_ARG} is not a root Community. Roots: ${roots.map((r) => r.id).join(', ') || '(none)'}`)
    root = found
  } else {
    if (roots.length !== 1) {
      throw new Error(`Expected exactly one root Community, found ${roots.length}. Pass --community=<id>. Roots: ${roots.map((r) => `${r.id} (${r.name})`).join(', ')}`)
    }
    root = roots[0]
  }

  // Every node under the root, because the Stage 2b migration seeds the tag set
  // per Community node — a member standing at a branch reads that branch's tags.
  const all = await prisma.community.findMany({ select: { id: true, parentCommunityId: true } })
  const childrenOf = new Map<string, string[]>()
  for (const c of all) {
    if (!c.parentCommunityId) continue
    childrenOf.set(c.parentCommunityId, [...(childrenOf.get(c.parentCommunityId) ?? []), c.id])
  }
  const nodeIds: string[] = []
  const stack = [root.id]
  while (stack.length) {
    const id = stack.pop()!
    nodeIds.push(id)
    stack.push(...(childrenOf.get(id) ?? []))
  }
  console.log(`\ntarget: ${root.name} (${root.id}) — ${nodeIds.length} Community nodes`)

  // ── tags ───────────────────────────────────────────────────────────────────
  const usedContexts = [...new Set(seed.questions.map((q) => q.context))].sort()
  const usedTopics = [...new Set(seed.questions.flatMap((q) => q.topics))]
  const wantedTopics = [...new Set([...seed._meta.topicTagsToCreate, ...usedTopics])].sort()

  const existingTags = await prisma.questionTag.findMany({
    where: { communityId: { in: nodeIds } },
    select: { communityId: true, kind: true, label: true, sortOrder: true },
  })
  const rootContextLabels = new Set(
    existingTags.filter((t) => t.communityId === root.id && t.kind.startsWith('CONTEXT_')).map((t) => t.label),
  )
  const rootTopicLabels = new Set(
    existingTags.filter((t) => t.communityId === root.id && t.kind === 'TOPIC').map((t) => t.label),
  )

  // A context tag's KIND (out in the world / behind the scenes) cannot be
  // inferred from a question, so an unknown context stops the import rather
  // than guessing a side for it.
  const missingContexts = usedContexts.filter((c) => !rootContextLabels.has(c))
  const topicsToCreate = wantedTopics.filter((t) => !rootTopicLabels.has(t))

  console.log(`\ncontexts used: ${usedContexts.join(', ')}`)
  if (missingContexts.length) {
    console.log(`  ✗ NOT IN THE TAG SET: ${missingContexts.join(', ')}`)
  } else {
    console.log('  ✓ all present in the Community tag set')
  }
  console.log(`topics used: ${usedTopics.sort().join(', ')}`)
  console.log(`topics to create (${PROMOTE_NEW_TOPICS ? 'promoted — chip row' : 'unpromoted — dropdown'}): ` +
    (topicsToCreate.join(', ') || '(none)'))

  // ── questions and answers ──────────────────────────────────────────────────
  const existingQuestions = await prisma.question.findMany({
    where: { communityId: root.id },
    select: { id: true, text: true, answers: { select: { body: true } } },
  })
  const byText = new Map(existingQuestions.map((q) => [q.text, q]))

  const plan: Plan = {
    communityId: root.id,
    communityName: root.name,
    nodeIds,
    author: { id: null, created: false },
    topicsToCreate,
    missingContexts,
    questionsToCreate: [],
    questionsExisting: [],
    answersToCreate: 0,
    answersExisting: 0,
  }

  for (const q of seed.questions) {
    const existing = byText.get(q.text)
    if (!existing) {
      plan.questionsToCreate.push({ text: q.text, context: q.context, topics: q.topics, answers: q.answers.length })
      plan.answersToCreate += q.answers.length
      continue
    }
    plan.questionsExisting.push(q.text)
    const bodies = new Set(existing.answers.map((a) => a.body))
    for (const a of q.answers) {
      if (bodies.has(a.body)) plan.answersExisting++
      else plan.answersToCreate++
    }
  }

  const authorExisting = await prisma.user.findUnique({
    where: { clerkId: SEED_AUTHOR.clerkId },
    select: { id: true, username: true },
  })
  plan.author = { id: authorExisting?.id ?? null, created: !authorExisting }

  console.log('\n── plan ─────────────────────────────────────────────────────')
  console.log(`author account   : ${authorExisting ? `${authorExisting.username} (${authorExisting.id}) — exists` : `${SEED_AUTHOR.username} <${SEED_AUTHOR.email}> — WOULD BE CREATED`}`)
  console.log(`topic tags       : +${topicsToCreate.length} label(s) × ${nodeIds.length} node(s) = ${topicsToCreate.length * nodeIds.length} row(s)`)
  console.log(`questions        : +${plan.questionsToCreate.length}   (already present: ${plan.questionsExisting.length})`)
  console.log(`answers          : +${plan.answersToCreate}   (already present: ${plan.answersExisting})`)
  console.log(`training sessions: ${seed.trainingSessions?.length ?? 0} HELD, not imported — no TrainingSession model at this stage, and the file's own import note says to hold until both participants have real accounts`)

  if (!APPLY) {
    console.log('\nQuestions that would be created:')
    for (const q of plan.questionsToCreate) {
      console.log(`  [${q.context}] ${q.topics.join(', ')} — ${q.answers} answer(s)`)
      console.log(`      ${q.text}`)
    }
  }

  if (missingContexts.length) {
    throw new Error(
      `Refusing to import: ${missingContexts.length} context tag(s) do not exist on the Community and their kind ` +
      `(CONTEXT_EXTERNAL / CONTEXT_INTERNAL) cannot be inferred: ${missingContexts.join(', ')}. ` +
      `Create them with the intended kind first.`,
    )
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.')
    return
  }

  // ── write ──────────────────────────────────────────────────────────────────
  const written = await prisma.$transaction(async (tx) => {
    const author = await tx.user.upsert({
      where: { clerkId: SEED_AUTHOR.clerkId },
      update: {},
      create: {
        clerkId: SEED_AUTHOR.clerkId,
        firstName: SEED_AUTHOR.firstName,
        lastName: SEED_AUTHOR.lastName,
        name: SEED_AUTHOR.name,
        username: SEED_AUTHOR.username,
        email: SEED_AUTHOR.email,
        emailVerified: false,
        ageConfirmed: true,
        role: 'CITIZEN',
        country: 'GB',
        // The same marker the historical-example accounts carry: this is seed
        // content, not a person.
        isHistoricalAccount: true,
        referralCode: SEED_AUTHOR.referralCode,
      },
      select: { id: true, username: true },
    })

    let tagRows = 0
    for (const nodeId of nodeIds) {
      const nodeTopics = existingTags.filter((t) => t.communityId === nodeId && t.kind === 'TOPIC')
      let sortOrder = nodeTopics.reduce((m, t) => Math.max(m, t.sortOrder), 0)
      const present = new Set(nodeTopics.map((t) => t.label))
      for (const label of wantedTopics) {
        if (present.has(label)) continue
        sortOrder++
        await tx.questionTag.create({
          data: {
            communityId: nodeId,
            kind: 'TOPIC',
            label,
            promoted: PROMOTE_NEW_TOPICS,
            sortOrder,
          },
        })
        tagRows++
      }
    }

    let questionRows = 0
    let answerRows = 0
    for (const q of seed.questions) {
      let questionId = byText.get(q.text)?.id ?? null
      let existingBodies = new Set(byText.get(q.text)?.answers.map((a) => a.body) ?? [])
      if (!questionId) {
        const created = await tx.question.create({
          data: {
            communityId: root.id,
            authorId: author.id,
            text: q.text,
            // Library-wide, not a branch's own question.
            scope: 'COMMUNITY',
            branchId: null,
            contextTags: [q.context],
            topicTags: q.topics,
          },
          select: { id: true },
        })
        questionId = created.id
        existingBodies = new Set()
        questionRows++
      }
      for (const a of q.answers) {
        if (existingBodies.has(a.body)) continue
        await tx.answer.create({
          data: {
            questionId,
            authorId: author.id,
            body: a.body,
            sources: a.sources ?? [],
          },
        })
        answerRows++
      }
    }

    return { authorId: author.id, tagRows, questionRows, answerRows }
  }, { timeout: 120_000, maxWait: 30_000 })

  console.log('\n── written ──────────────────────────────────────────────────')
  console.log(`author      : ${written.authorId}`)
  console.log(`topic tags  : ${written.tagRows}`)
  console.log(`questions   : ${written.questionRows}`)
  console.log(`answers     : ${written.answerRows}`)

  // ── reconcile attempted against stored ─────────────────────────────────────
  // Read back rather than trusting the write's own return: a count that agrees
  // with the plan is the only evidence the rows exist.
  const seedTexts = seed.questions.map((q) => q.text)
  const storedQuestions = await prisma.question.findMany({
    where: { communityId: root.id, text: { in: seedTexts } },
    select: { id: true, text: true, authorId: true, contextTags: true, topicTags: true, answers: { select: { body: true, sources: true, authorId: true } } },
  })
  const storedByText = new Map(storedQuestions.map((q) => [q.text, q]))

  const problems: string[] = []
  for (const q of seed.questions) {
    const stored = storedByText.get(q.text)
    if (!stored) { problems.push(`MISSING question: ${q.text.slice(0, 60)}…`); continue }
    if (stored.authorId !== written.authorId) problems.push(`wrong author on question: ${q.text.slice(0, 40)}…`)
    if (JSON.stringify(stored.contextTags) !== JSON.stringify([q.context])) problems.push(`context mismatch: ${q.text.slice(0, 40)}…`)
    if (JSON.stringify([...stored.topicTags].sort()) !== JSON.stringify([...q.topics].sort())) problems.push(`topics mismatch: ${q.text.slice(0, 40)}…`)
    for (const a of q.answers) {
      const hit = stored.answers.find((s) => s.body === a.body)
      if (!hit) { problems.push(`MISSING answer on: ${q.text.slice(0, 40)}…`); continue }
      const wantSources = a.sources ?? []
      if (JSON.stringify(hit.sources) !== JSON.stringify(wantSources)) problems.push(`sources mismatch on: ${q.text.slice(0, 40)}…`)
      if (hit.authorId !== written.authorId) problems.push(`wrong author on answer: ${q.text.slice(0, 40)}…`)
    }
  }

  const storedTopicTags = await prisma.questionTag.findMany({
    where: { communityId: { in: nodeIds }, kind: 'TOPIC' },
    select: { communityId: true, label: true, promoted: true },
  })
  for (const nodeId of nodeIds) {
    for (const label of wantedTopics) {
      if (!storedTopicTags.some((t) => t.communityId === nodeId && t.label === label)) {
        problems.push(`MISSING topic tag "${label}" on node ${nodeId}`)
      }
    }
  }

  const storedAnswerCount = storedQuestions.reduce((s, q) => s + q.answers.length, 0)
  console.log('\n── reconciliation (read back from the database) ──────────────')
  console.log(`questions in Community matching the seed: ${storedQuestions.length} / ${seed.questions.length}`)
  console.log(`answers on those questions             : ${storedAnswerCount} / ${seed.questions.reduce((s, q) => s + q.answers.length, 0)}`)
  console.log(`topic tags present on every node       : ${wantedTopics.length} × ${nodeIds.length}`)
  if (problems.length) {
    console.log(`\n✗ ${problems.length} discrepancy(ies):`)
    for (const p of problems.slice(0, 40)) console.log(`   · ${p}`)
    process.exitCode = 1
  } else {
    console.log('\n✓ every seeded row read back exactly as written.')
  }
}

main()
  .catch((e) => {
    console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
