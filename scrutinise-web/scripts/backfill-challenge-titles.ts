// ─────────────────────────────────────────────────────────────────────────────
// 25-V §3 + §7 — TITLE THE CHALLENGES, AND TAKE OUR TEST APPARATUS OUT OF THE READER'S WAY.
//
// Two defects, one row, one pass.
//
// §3a — the printed report said `KERNEL TEST FAILED` in capitals **32 times**, and
// `THE ROAD TAKEN AT "guidingPolicy:instrument" MAY BE THE WRONG ONE` beside it. Both are our
// vocabulary talking to itself. `lib/lex/reader-language.ts` fixes what NEW builds write; this
// fixes what is already stored, which matters because the allowance is spent and the document
// Charlie prints today is built from these rows.
//
// §7 — **221 of 225 challenges carry no title.** The cause is not that titling failed: it is that
// titling was only ever built into ONE of the seven places a challenge is created (the
// cross-model path, 25-Q §7 — which is why exactly 4 rows have one). The other six never set it.
//
// ⚠⚠ AND THE TITLE IS DERIVED, NEVER INVENTED. Two of those six compose their text from values we
// already hold — the kernel test's name, the fork's key — so a title for them is a re-reading of
// what is there, not a new claim about the proposal. The rest are model prose with no title in
// them; those are LEFT NULL and reported, because guessing a title from a paragraph is writing
// content, and content needs a build. `title` is nullable for exactly this reason.
//
// ⚠ PLAN BY DEFAULT, and it re-reads every row it writes.
//
// Usage:
//   npx tsx --env-file=.env scripts/backfill-challenge-titles.ts            (plan)
//   npx tsx --env-file=.env scripts/backfill-challenge-titles.ts --write
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { strategyTestHeading, forkDoubtHeading } from '../lib/lex/reader-language'

const WRITE = process.argv.includes('--write')

/** `KERNEL TEST FAILED — <test>. <rest>` */
const KERNEL = /^KERNEL TEST FAILED\s*—\s*([^.]+?)\.\s*([\s\S]*)$/
/** `THE ROAD TAKEN AT "<forkKey>" MAY BE THE WRONG ONE — <doubt>` */
const FORK = /^THE ROAD TAKEN AT\s*"([^"]+)"\s*MAY BE THE WRONG ONE\s*—\s*([\s\S]*)$/

interface Change { id: string; title: string; text: string; why: string }

function rewrite(text: string): Change | null {
  const k = text.match(KERNEL)
  if (k) {
    const [, test, rest] = k
    return { id: '', title: strategyTestHeading(test.trim()), text: rest.trim(), why: 'kernel test' }
  }
  const f = text.match(FORK)
  if (f) {
    const [, forkKey, doubt] = f
    return { id: '', title: forkDoubtHeading(forkKey.trim()), text: doubt.trim(), why: 'fork doubt' }
  }
  return null
}

async function main() {
  const rows = await prisma.deepeningIssue.findMany({
    select: { id: true, ideaId: true, text: true, title: true },
  })
  console.log(`\n${rows.length} challenges in all; ${rows.filter((r) => r.title?.trim()).length} carry a title today\n`)

  const changes: Change[] = []
  for (const r of rows) {
    const c = rewrite(r.text)
    if (c) changes.push({ ...c, id: r.id })
  }

  const byWhy = new Map<string, number>()
  for (const c of changes) byWhy.set(c.why, (byWhy.get(c.why) ?? 0) + 1)
  for (const [w, n] of byWhy) console.log(`  ${String(n).padStart(3)} × ${w}`)
  console.log(`\n  sample:`)
  for (const c of changes.slice(0, 2)) {
    console.log(`    title: ${c.title}`)
    console.log(`    text : ${c.text.slice(0, 120).replace(/\s+/g, ' ')}…`)
  }

  const untouched = rows.length - changes.length - rows.filter((r) => r.title?.trim()).length
  console.log(`\n  ${changes.length} row(s) ${WRITE ? 'rewritten' : 'would be rewritten'}.`)
  console.log(`  ⚠ ${untouched} left with no title: model prose that carries none. A title for those`)
  console.log(`    would have to be written, and writing content needs a build.`)

  if (!WRITE) { console.log('\nPlan only. Nothing written. Re-run with --write.\n'); await prisma.$disconnect(); return }

  for (const c of changes) {
    await prisma.deepeningIssue.update({ where: { id: c.id }, data: { title: c.title, text: c.text } })
  }
  // ⚠ RE-READ, in one query, and assert the ABSENCE that §9 actually asks for.
  const after = await prisma.deepeningIssue.findMany({ select: { title: true, text: true } })
  const stillShouting = after.filter((a) =>
    /KERNEL TEST FAILED|THE ROAD TAKEN AT/.test(`${a.title ?? ''} ${a.text}`)).length
  const titled = after.filter((a) => a.title?.trim()).length
  console.log(`\n  re-read: ${titled} of ${after.length} now carry a title`)
  console.log(`  re-read: ${stillShouting} row(s) still contain "KERNEL TEST FAILED" or "THE ROAD TAKEN AT"`
    + `${stillShouting ? ' ⚠' : ' — none'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
