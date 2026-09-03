import { prisma } from '../lib/prisma'
import { callModelJson } from '../lib/lex/model-call'
import { priceBuild, formatSpend } from '../lib/lex/build-cost'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-W §C (decision 53) — GIVE THE UNTITLED CHALLENGES A NAME.
//
// 25-Q §7 added `DeepeningIssue.title` and asked for it in ONE of the seven places a
// challenge is created, so most rows have none. 25-V fixed the write paths permanently and
// backfilled the 51 that had a liftable first sentence; what is left is model prose with no
// title in it, and a title has to be written rather than extracted.
//
// ⚠⚠ RUN THE RENDER FIX FIRST, AND IT IS ALREADY IN THIS SPRINT. Until 25-W §C widened
// `SnapshotIssue` and the two renderers, a title was invisible in every document — even the
// 39 rows that already had one. Spending money to produce data nothing reads is the exact
// shape this sprint keeps finding, and doing it in that order would have been a fourth
// instance of it.
//
// ⚠ IT NEVER OVERWRITES. Only rows whose title is null or blank are read, and the update is
// guarded on that again at write time, so a title somebody wrote by hand between the read
// and the write survives.
//
// ⚠ IT IS NOT A CONTENT WRITER. The instruction is to NAME the point the challenge already
// makes, in the challenge's own terms — not to summarise it, judge it, sharpen it or add to
// it. A title that introduces a noun the text does not contain is a title that has invented
// a criticism, which is the failure this is one careless prompt away from.
//
// ⚠ §27 — the prompt describes the SHAPE of a good title and gives NO specimen title. An
// illustration is a template a model may lift, and a lifted title would be a title about
// somebody else's proposal wearing this one's clothes.
//
// Usage:
//   npx tsx --env-file=.env scripts/backfill-issue-titles.ts <ideaId>            (report)
//   npx tsx --env-file=.env scripts/backfill-issue-titles.ts <ideaId> --write
// ─────────────────────────────────────────────────────────────────────────────────────────

// ⚠ A UUID, not "an argument with a dash in it" — the first version of this matched the
// SCRIPT'S OWN PATH and reported "0 challenges, nothing to do" on a full table.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IDEA = process.argv.slice(2).find((a) => UUID.test(a))
  ?? '452c5ade-3153-400a-bf48-3b71aaa52773'
const WRITE = process.argv.includes('--write')
const BATCH = 20
const MODEL = 'gemini-2.5-flash'

const SYSTEM = [
  'You name criticisms. You are given numbered criticisms of a policy proposal, each one a',
  'paragraph of prose. For each, return a short name for the point it makes.',
  '',
  'What a good name does:',
  '  · it names the SPECIFIC objection, using the words the criticism itself uses — the',
  '    mechanism, body, power, cost or gap it is actually about;',
  '  · it is a noun phrase, normally three to six words, with no final full stop;',
  '  · it is distinguishable from the other names in the same batch. Two criticisms that',
  '    would take the same name are two criticisms you have named too vaguely.',
  '',
  'What a name must never do:',
  '  · introduce a subject, a body, a figure or a claim that is not in the criticism you are',
  '    naming. You are naming what is there, not improving it or extending it;',
  '  · restate the whole criticism — a name is a handle, not a summary;',
  '  · carry anything over from these instructions, from another proposal, or from a',
  '    criticism other than the one you are naming;',
  '  · pass judgement on whether the criticism is right. That is not yours to decide.',
  '',
  'Return one entry per criticism, keyed by the number you were given. Every number must',
  'appear exactly once.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    titles: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, title: { type: 'string' } },
        required: ['n', 'title'],
      },
    },
  },
  required: ['titles'],
}

async function main() {
  const rows = await prisma.deepeningIssue.findMany({
    where: { ideaId: IDEA },
    select: { id: true, runVersion: true, passKey: true, title: true, text: true },
    orderBy: [{ runVersion: 'asc' }, { createdAt: 'asc' }],
  })
  const untitled = rows.filter((r) => !r.title?.trim())
  console.log(`\nidea ${IDEA}: ${rows.length} challenges, ${untitled.length} untitled`)
  if (!untitled.length) { console.log('nothing to do'); return }
  if (!WRITE) {
    console.log(`\n${Math.ceil(untitled.length / BATCH)} model calls of up to ${BATCH}. Pass --write to run them.`)
    return
  }

  let tokensIn = 0, tokensOut = 0, written = 0, skipped = 0
  const proposed = new Map<string, string>()

  for (let i = 0; i < untitled.length; i += BATCH) {
    const batch = untitled.slice(i, i + BATCH)
    const user = batch.map((r, j) => `${j + 1}. ${r.text.replace(/\s+/g, ' ').trim()}`).join('\n\n')

    const res = await callModelJson<{ titles?: Array<{ n?: number; title?: string }> }>({
      model: MODEL,
      system: SYSTEM,
      user,
      schema: SCHEMA,
      maxOutputTokens: 2000,
      timeoutMs: 120_000,
      temperature: 0.2,
      label: `25w-title-${i / BATCH + 1}`,
      stream: 'lex',
      pass: 'BACKFILL_TITLE',
    })
    tokensIn += res.usage.tokensIn
    tokensOut += res.usage.tokensOut
    if (!res.ok) {
      // ⚠ The spend is counted BEFORE the bail. A failed call that burned tokens still cost
      // money, and a total that only counts successes under-reports where it matters most.
      //
      // ⚠ The cast is the same deliberate one `reranker.ts` documents: this project compiles
      // with `strict: false`, so TypeScript will not narrow a union on a BOOLEAN literal
      // discriminant. It is a config artefact, not a type hole.
      const fail = res as { reason: string; detail: string }
      console.error(`  batch ${i / BATCH + 1} FAILED: ${fail.reason} — ${fail.detail}`)
      continue
    }

    // ⚠ THE SCHEMA IS A REQUEST, NOT A GUARANTEE. A missing entry, a number out of range or
    // a duplicate is dropped by name rather than absorbed — a title written onto the wrong
    // row would be a criticism renamed into something it does not say.
    const seen = new Set<number>()
    for (const t of res.value.titles ?? []) {
      const n = typeof t?.n === 'number' ? t.n : NaN
      const title = typeof t?.title === 'string' ? t.title.trim().replace(/[.\s]+$/, '') : ''
      if (!Number.isInteger(n) || n < 1 || n > batch.length) { skipped++; continue }
      if (seen.has(n)) { skipped++; continue }
      if (!title || title.length > 90) { skipped++; continue }
      seen.add(n)
      proposed.set(batch[n - 1].id, title)
    }
    for (let k = 1; k <= batch.length; k++) if (!seen.has(k)) skipped++
    console.log(`  batch ${i / BATCH + 1}: ${seen.size}/${batch.length} named`)
  }

  // ── write, guarded ──────────────────────────────────────────────────────────────────
  for (const [id, title] of proposed) {
    const n = await prisma.deepeningIssue.updateMany({
      // ⚠ THE GUARD IS REPEATED HERE. `OR: [null, '']` is the same predicate the read used,
      // asserted at the moment of writing, so a row titled by anything else in between keeps
      // the title it was given.
      where: { id, OR: [{ title: null }, { title: '' }] },
      data: { title },
    })
    written += n.count
  }

  // ⚠ RE-READ, AND REPORT THE RE-READ. Not the intent, not the count returned by the write.
  const after = await prisma.deepeningIssue.findMany({
    where: { ideaId: IDEA }, select: { id: true, title: true, runVersion: true },
  })
  const stillUntitled = after.filter((r) => !r.title?.trim()).length

  // ⚠ PRICED BY THE PRODUCT'S OWN PRICER, not by a rate restated here. A second copy of the
  // rate table is a copy that will disagree with the first (CLAUDE.md §25 rule 3).
  const price = priceBuild([{ model: MODEL, tokensIn, tokensOut }])

  console.log(`\n── written ──`)
  console.log(`  proposed by the model : ${proposed.size}`)
  console.log(`  rows updated          : ${written}`)
  console.log(`  dropped (malformed)   : ${skipped}`)
  console.log(`  tokens                : ${tokensIn} in / ${tokensOut} out ≈ ${formatSpend(price)}`)
  console.log(`\n── re-read from the database ──`)
  console.log(`  ${after.length} challenges, ${after.length - stillUntitled} titled, ${stillUntitled} still untitled`)

  const sample = await prisma.deepeningIssue.findMany({
    where: { ideaId: IDEA, id: { in: [...proposed.keys()].slice(0, 6) } },
    select: { title: true, text: true, runVersion: true },
  })
  console.log('\n── sample, as stored ──')
  for (const s of sample) {
    console.log(`  [v${s.runVersion}] ${s.title}`)
    console.log(`      ${s.text.replace(/\s+/g, ' ').slice(0, 150)}…`)
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
