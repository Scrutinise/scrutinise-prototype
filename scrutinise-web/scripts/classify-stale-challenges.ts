import { prisma } from '../lib/prisma'
import { callModelJson } from '../lib/lex/model-call'
import { priceBuild, formatSpend } from '../lib/lex/build-cost'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { writeFileSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-W §D (decision 54) — WHICH OF 178 EARLIER CRITICISMS STILL STAND AGAINST THIS DRAFT.
//
// ⚠⚠ IT WRITES NOTHING. Charlie: *"Report the counts and a sample of each category to
// Charlie before writing anything. A model deciding which criticisms of his proposal to
// retire is a judgement he should see first."* There is no `--write` in this file, and no
// Prisma call in it that is not a read. Adding one is a separate decision.
//
// ⚠⚠ NOVELTY IS NOT THE TEST. APPLICABILITY IS. 25-V measured that 0 of v9's 47 challenges
// duplicate earlier text WORD FOR WORD and it would be easy to conclude from that number
// that all 178 earlier ones are original and must be kept. That is the wrong question: two
// criticisms can make the same point in different words, and a criticism can be perfectly
// original and still be aimed at a sentence that was deleted four drafts ago. So each old
// challenge is judged against the DRAFT AS IT NOW STANDS, and against the substance — not
// the wording — of the current set.
//
// The three categories are Charlie's, verbatim:
//   DUPLICATE   — duplicated in substance by a current challenge → archive
//   APPLICABLE  — original and still applicable to text that still exists → promote into the
//                 current set, marked with the draft it was raised against
//   SUPERSEDED  — original but attacking text that no longer exists → archive, with that
//                 reason recorded
//
// ⚠ A FOURTH OUTCOME EXISTS AND IS NOT ONE OF THE THREE: `UNDECIDED`. A model that must
// choose one of three labels will always choose one, and a forced choice on a criticism it
// could not place is a judgement dressed as a measurement. Anything the model declines to
// place, or returns malformed, is counted separately and stays where it is.
//
// ⚠ §27 — the prompt describes the SHAPE of each judgement and quotes NO specimen criticism.
//
// Usage: npx tsx --env-file=.env scripts/classify-stale-challenges.ts [ideaId]
// ─────────────────────────────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDEA = process.argv.slice(2).find((a) => UUID.test(a)) ?? '452c5ade-3153-400a-bf48-3b71aaa52773'
const MODEL = 'gemini-2.5-flash'
const BATCH = 10
// ⚠ ../docs — this script runs from the scrutinise-web package and the project's docs are a
// level up. Writing the report LAST, to a path that did not exist, threw away eighteen model
// calls that had already been paid for; the write is now the first thing proved, below.
const OUT = '../docs/25W_CHALLENGE_CLASSIFICATION.md'

type Verdict = 'DUPLICATE' | 'APPLICABLE' | 'SUPERSEDED' | 'UNDECIDED'

const CLASSIFY_SYSTEM = [
  'You are auditing the criticisms made of a policy proposal over nine successive drafts.',
  'The proposal has been rewritten repeatedly. You are given THE DRAFT AS IT NOW STANDS, then',
  'THE CRITICISMS RAISED AGAINST THE CURRENT DRAFT, then a numbered list of OLDER CRITICISMS',
  'raised against earlier drafts.',
  '',
  'For each older criticism decide ONE of:',
  '',
  '  DUPLICATE  — a criticism in the current set already makes this point. The wording will',
  '               differ; you are judging the SUBSTANCE. Name the current criticism it',
  '               duplicates, by its number.',
  '  APPLICABLE — the point is not made by any current criticism, AND it still bites on the',
  '               draft as it now stands. The thing it objects to is still in the proposal.',
  '  SUPERSEDED — the point is not made by any current criticism, but what it attacks is no',
  '               longer in the proposal: the mechanism, body, power, duty or wording it',
  '               objects to has been removed or replaced. Say what is gone.',
  '  UNDECIDED  — you cannot tell which of the three it is. Use this rather than guessing.',
  '               An older criticism you cannot place is a real outcome and it is wanted.',
  '',
  'Rules that decide the hard cases:',
  '  · Being differently worded from every current criticism does NOT make it APPLICABLE.',
  '    Ask whether the current set already answers it, however differently it is put.',
  '  · Being aimed at an earlier draft does NOT make it SUPERSEDED. Ask whether the thing it',
  '    objects to is still there. Most of the proposal survives from draft to draft.',
  '  · A criticism of a general weakness the proposal still has is APPLICABLE even if the',
  '    specific sentence it quoted has been rewritten.',
  '  · Never soften or improve a criticism to make it fit a category.',
  '',
  'Give a reason of at most 25 words for every verdict. For SUPERSEDED the reason must name',
  'what is no longer in the proposal. For DUPLICATE, `duplicateOf` is required.',
  'Return one entry per numbered older criticism. Every number must appear exactly once.',
].join('\n')

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          verdict: { type: 'string', enum: ['DUPLICATE', 'APPLICABLE', 'SUPERSEDED', 'UNDECIDED'] },
          duplicateOf: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['n', 'verdict', 'reason'],
      },
    },
  },
  required: ['verdicts'],
}

const MERGE_SYSTEM = [
  'You are given the criticisms raised against the current draft of a policy proposal, each',
  'numbered. Find the groups that make the SAME point in different words.',
  '',
  'A group is two or more criticisms a reader would be annoyed to meet twice — they object to',
  'the same thing for the same reason, and answering one answers the others. Criticisms about',
  'the same TOPIC that object to different things are NOT a group.',
  '',
  'Return only genuine groups. Returning none is a valid and common answer; inventing groups',
  'to look productive would merge two distinct objections into one and lose a criticism.',
  'For each group give the numbers in it and a reason of at most 25 words saying what the',
  'shared point is.',
].join('\n')

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          members: { type: 'array', items: { type: 'integer' } },
          reason: { type: 'string' },
        },
        required: ['members', 'reason'],
      },
    },
  },
  required: ['groups'],
}

/** The draft as it now stands, from the product's own assembler — not a query restated here. */
function draftText(s: Awaited<ReturnType<typeof buildProposalSnapshot>>): string {
  const out: string[] = [`TITLE: ${s.title}`]
  if (s.summaryDescription) out.push(`SUMMARY: ${s.summaryDescription}`)
  for (const f of s.fields) {
    // ⚠ A structured field's value is an object; its `slots` are the renderable form. Reading
    // only the string case would silently drop whole sections of the draft the model is
    // asked to judge against — and a judgement made against half a draft is worse than none.
    const v = typeof f.value === 'string'
      ? f.value.trim()
      : f.slots.filter((sl) => sl.value?.trim()).map((sl) => `${sl.label}: ${sl.value.trim()}`).join('; ')
    if (v) out.push(`${f.label} [${f.status}]: ${v}`)
  }
  if (s.causes.length) {
    out.push('CAUSES:')
    for (const c of s.causes) out.push(`  - ${c.cause}${c.isRootCause ? ' [ROOT CAUSE]' : ''}`)
  }
  if (s.options.length) {
    out.push('POLICY OPTIONS UNDER CONSIDERATION:')
    for (const o of s.options) out.push(`  - ${o.approach}${o.status === 'RULED_OUT' ? ` [RULED OUT: ${o.ruleOutReason ?? 'no reason recorded'}]` : ''}`)
  }
  if (s.actions.length) {
    out.push('ACTIONS:')
    for (const a of s.actions) out.push(`  - ${a.practicalStep}${a.wording ? ` (wording: ${a.wording})` : ''}`)
  }
  return out.join('\n')
}

const oneLine = (t: string) => t.replace(/\s+/g, ' ').trim()

async function main() {
  // ⚠ PROVE THE OUTPUT PATH BEFORE SPENDING ANYTHING. See the note on `OUT`.
  writeFileSync(OUT, '(this run has not finished)\n', 'utf8')

  const snapshot = await buildProposalSnapshot(IDEA)
  const draft = draftText(snapshot)

  const rows = await prisma.deepeningIssue.findMany({
    where: { ideaId: IDEA },
    select: { id: true, runVersion: true, passKey: true, title: true, text: true, status: true },
    orderBy: [{ runVersion: 'asc' }, { createdAt: 'asc' }],
  })
  const currentVersion = Math.max(...rows.map((r) => r.runVersion))
  const current = rows.filter((r) => r.runVersion === currentVersion)
  const older = rows.filter((r) => r.runVersion !== currentVersion)

  console.log(`\nidea ${IDEA} — ${rows.length} challenges`)
  console.log(`  current build v${currentVersion}: ${current.length}`)
  console.log(`  earlier drafts             : ${older.length}`)
  console.log(`  draft given to the model    : ${draft.length} chars`)

  const currentList = current
    .map((r, i) => `C${i + 1}. ${r.title ? `[${r.title}] ` : ''}${oneLine(r.text).slice(0, 400)}`)
    .join('\n')

  let tokensIn = 0, tokensOut = 0
  const verdicts = new Map<string, { verdict: Verdict; reason: string; duplicateOf: string | null }>()

  // ── 1. the 178, in batches ────────────────────────────────────────────────────────────
  for (let i = 0; i < older.length; i += BATCH) {
    const batch = older.slice(i, i + BATCH)
    const user = [
      '=== THE DRAFT AS IT NOW STANDS ===',
      draft,
      '',
      `=== CRITICISMS RAISED AGAINST THE CURRENT DRAFT (${current.length}) ===`,
      currentList,
      '',
      `=== OLDER CRITICISMS TO CLASSIFY (${batch.length}) ===`,
      batch.map((r, j) => `${j + 1}. (raised against draft ${r.runVersion}) ${r.title ? `[${r.title}] ` : ''}${oneLine(r.text)}`).join('\n\n'),
    ].join('\n')

    const res = await callModelJson<{ verdicts?: Array<{ n?: number; verdict?: string; duplicateOf?: number; reason?: string }> }>({
      model: MODEL, system: CLASSIFY_SYSTEM, user, schema: CLASSIFY_SCHEMA,
      maxOutputTokens: 4000, timeoutMs: 180_000, temperature: 0.1,
      label: `25w-classify-${i / BATCH + 1}`, stream: 'lex', pass: 'CLASSIFY_STALE',
    })
    tokensIn += res.usage.tokensIn
    tokensOut += res.usage.tokensOut
    if (!res.ok) {
      const fail = res as { reason: string; detail: string }
      console.error(`  batch ${i / BATCH + 1} FAILED: ${fail.reason} — ${fail.detail}`)
      continue
    }

    const seen = new Set<number>()
    for (const v of res.value.verdicts ?? []) {
      const n = typeof v?.n === 'number' ? v.n : NaN
      if (!Number.isInteger(n) || n < 1 || n > batch.length || seen.has(n)) continue
      const verdict = (['DUPLICATE', 'APPLICABLE', 'SUPERSEDED', 'UNDECIDED'] as const)
        .find((k) => k === v.verdict) ?? 'UNDECIDED'
      // ⚠ A DUPLICATE THAT NAMES NOTHING IS NOT A DUPLICATE. Without a current challenge to
      // point at, "this is already covered" is an unfalsifiable reason to archive a
      // criticism — which is precisely the judgement Charlie asked to see before it happens.
      const dupIdx = typeof v.duplicateOf === 'number' ? v.duplicateOf : NaN
      const dupOk = Number.isInteger(dupIdx) && dupIdx >= 1 && dupIdx <= current.length
      seen.add(n)
      verdicts.set(batch[n - 1].id, {
        verdict: verdict === 'DUPLICATE' && !dupOk ? 'UNDECIDED' : verdict,
        reason: verdict === 'DUPLICATE' && !dupOk
          ? 'called a duplicate but named no current challenge — not accepted'
          : oneLine(String(v.reason ?? '')).slice(0, 200),
        duplicateOf: verdict === 'DUPLICATE' && dupOk ? current[dupIdx - 1].id : null,
      })
    }
    console.log(`  batch ${i / BATCH + 1}: ${seen.size}/${batch.length} classified`)
  }

  // ── 2. near-duplicates WITHIN the current set ─────────────────────────────────────────
  const mergeRes = await callModelJson<{ groups?: Array<{ members?: number[]; reason?: string }> }>({
    model: MODEL, system: MERGE_SYSTEM,
    user: `=== THE DRAFT AS IT NOW STANDS ===\n${draft}\n\n=== CRITICISMS (${current.length}) ===\n${currentList}`,
    schema: MERGE_SCHEMA,
    maxOutputTokens: 3000, timeoutMs: 180_000, temperature: 0.1,
    label: '25w-merge-current', stream: 'lex', pass: 'CLASSIFY_STALE',
  })
  tokensIn += mergeRes.usage.tokensIn
  tokensOut += mergeRes.usage.tokensOut
  const groups: Array<{ members: number[]; reason: string }> = []
  if (mergeRes.ok) {
    for (const g of mergeRes.value.groups ?? []) {
      const members = (g.members ?? []).filter((m) => Number.isInteger(m) && m >= 1 && m <= current.length)
      if (new Set(members).size >= 2) groups.push({ members: [...new Set(members)], reason: oneLine(String(g.reason ?? '')) })
    }
  } else {
    const fail = mergeRes as { reason: string; detail: string }
    console.error(`  merge pass FAILED: ${fail.reason} — ${fail.detail}`)
  }

  // ── 3. report ─────────────────────────────────────────────────────────────────────────
  const counts: Record<Verdict, number> = { DUPLICATE: 0, APPLICABLE: 0, SUPERSEDED: 0, UNDECIDED: 0 }
  for (const r of older) {
    const v = verdicts.get(r.id)
    counts[v?.verdict ?? 'UNDECIDED']++
  }
  const price = priceBuild([{ model: MODEL, tokensIn, tokensOut }])

  const byVersion = new Map<number, Record<Verdict, number>>()
  for (const r of older) {
    const e = byVersion.get(r.runVersion) ?? { DUPLICATE: 0, APPLICABLE: 0, SUPERSEDED: 0, UNDECIDED: 0 }
    e[verdicts.get(r.id)?.verdict ?? 'UNDECIDED']++
    byVersion.set(r.runVersion, e)
  }

  const currentById = new Map(current.map((c) => [c.id, c]))
  const sampleOf = (v: Verdict, n: number) => older
    .filter((r) => (verdicts.get(r.id)?.verdict ?? 'UNDECIDED') === v)
    .slice(0, n)
    .map((r) => {
      const d = verdicts.get(r.id)!
      const dup = d.duplicateOf ? currentById.get(d.duplicateOf) : null
      return [
        `- **v${r.runVersion} · ${r.title ?? '(untitled)'}**`,
        `  - ${oneLine(r.text).slice(0, 300)}…`,
        `  - *reason:* ${d.reason}`,
        ...(dup ? [`  - *duplicated by:* ${dup.title ?? oneLine(dup.text).slice(0, 90)}`] : []),
      ].join('\n')
    }).join('\n')

  const md = [
    `# 25-W §D — the 178 earlier challenges, classified. NOTHING WRITTEN.`,
    ``,
    `Idea \`${IDEA}\` — *${snapshot.title}*. Current build **v${currentVersion}**.`,
    `Model \`${MODEL}\`, ${Math.ceil(older.length / BATCH) + 1} calls, **${formatSpend(price)}**.`,
    `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
    ``,
    `⚠ **This is a proposal, not a change.** No row was updated. Every count below is a`,
    `judgement a model made about criticisms of your proposal, which is why you are reading it`,
    `before anything happens.`,
    ``,
    `## Counts`,
    ``,
    `| | | what decision 54 would do |`,
    `|---|---:|---|`,
    `| Current build (v${currentVersion}) | ${current.length} | shown by default |`,
    `| **DUPLICATE** — already made by a current challenge | **${counts.DUPLICATE}** | archive |`,
    `| **APPLICABLE** — original, still bites on today's draft | **${counts.APPLICABLE}** | promote into the current set, marked "raised against draft N" |`,
    `| **SUPERSEDED** — original, but attacks text that is gone | **${counts.SUPERSEDED}** | archive, with that reason recorded |`,
    `| **UNDECIDED** — the model would not place it | **${counts.UNDECIDED}** | left alone |`,
    `| earlier total | ${older.length} | |`,
    ``,
    `Merge groups found within the current ${current.length}: **${groups.length}** ` +
      `(covering ${groups.reduce((a, g) => a + g.members.length, 0)} challenges).`,
    ``,
    `### By the draft it was raised against`,
    ``,
    `| draft | total | duplicate | applicable | superseded | undecided |`,
    `|---|---:|---:|---:|---:|---:|`,
    ...[...byVersion].sort((a, b) => a[0] - b[0]).map(([v, e]) =>
      `| v${v} | ${e.DUPLICATE + e.APPLICABLE + e.SUPERSEDED + e.UNDECIDED} | ${e.DUPLICATE} | ${e.APPLICABLE} | ${e.SUPERSEDED} | ${e.UNDECIDED} |`),
    ``,
    `## Samples`,
    ``,
    `### DUPLICATE — would be archived as already made`,
    ``, sampleOf('DUPLICATE', 6), ``,
    `### APPLICABLE — would be promoted into the current set`,
    ``, sampleOf('APPLICABLE', 6), ``,
    `### SUPERSEDED — would be archived because the target is gone`,
    ``, sampleOf('SUPERSEDED', 6), ``,
    `### UNDECIDED — would be left exactly as they are`,
    ``, sampleOf('UNDECIDED', 6) || '- none', ``,
    `### Merge groups inside the current v${currentVersion} set`,
    ``,
    ...(groups.length ? groups.map((g) => [
      `- **${g.reason}**`,
      ...g.members.map((m) => `  - C${m}: ${current[m - 1].title ?? oneLine(current[m - 1].text).slice(0, 100)}`),
    ].join('\n')) : ['- none found']),
  ].join('\n')

  writeFileSync(OUT, md, 'utf8')
  console.log(`\n${md.split('## Counts')[1]?.split('## Samples')[0] ?? ''}`)
  console.log(`\nwritten to ${OUT} — and NOTHING was written to the database.`)
  console.log(`cost: ${formatSpend(price)}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
