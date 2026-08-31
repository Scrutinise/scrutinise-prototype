// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-O §7 — MEASURE THE DUPLICATE FETCHES BEFORE DECIDING ANYTHING.
//
// 25-N's live walk found `/panel` fetched twice (the second caller added by
// `ReportAdditions`) and `/agenda` twice (pre-existing) — three heavy reads on one paint, with
// the first paint sitting pending for several seconds on Charlie's idea.
//
// ⚠⚠ §7 IS EXPLICIT THAT MEASUREMENT COMES FIRST: *"Do not optimise before the measurement says
// these are the problem — a slow first paint has more than one possible cause and this is the
// one that happens to be visible."* De-duplicating a call that costs 40ms would be a change
// that reads like a fix and moves nothing, and the real cause would still be there.
//
// ⚠ IT TIMES THE ASSEMBLERS, NOT THE HTTP. `buildQuestionPanel` and `buildAgenda` are what the
// routes do; adding a network round trip would measure Vercel's cold start as well and make the
// number unattributable. The question is which assembler is expensive, and this answers it.
//
// ⚠ AND A SAVING FIGURE MUST COME FROM A RUN THAT FINISHED (§7). Every timing below is around a
// completed call; a timeout is reported as a timeout and never averaged in.
//
// Usage: tsx --env-file=.env scripts/measure-panel-fetches.ts <ideaIdPrefix>
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { buildQuestionPanel } from '../lib/lex/question-panel'
import { buildAgenda } from '../lib/lex/agenda'
import { buildState } from '../lib/lex/build'

const RUNS = 3

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number[]; ok: boolean }> {
  const ms: number[] = []
  let ok = true
  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now()
    try { await fn() } catch (e) {
      ok = false
      console.log(`  ⚠ ${label} run ${i + 1} threw: ${e instanceof Error ? e.message : String(e)}`)
    }
    ms.push(Date.now() - t0)
  }
  return { label, ms, ok }
}

async function main() {
  const prefix = process.argv[2]
  if (!prefix) {
    console.log('Usage: tsx --env-file=.env scripts/measure-panel-fetches.ts <ideaIdPrefix>')
    process.exit(1)
  }
  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: prefix } },
    select: { id: true, title: true },
  })
  if (!idea) { console.log(`No idea starting "${prefix}"`); process.exit(1) }

  console.log(`\n── 25-O §7 — what the first paint of /ideas/create actually costs ──`)
  console.log(`idea ${idea.id.slice(0, 8)} "${idea.title}"   ${RUNS} runs each\n`)

  // ⚠ ONE WARM-UP THAT IS NOT COUNTED. The first query on a cold Neon compute pays the wake-up,
  // and averaging that in would attribute the database's start-up to whichever call ran first.
  await buildAgenda(idea.id).catch(() => {})

  const results = [
    // The four calls 25-N's walk saw, in the order the page issues them.
    await time('/agenda      (WorkList)', () => buildAgenda(idea.id)),
    await time('/agenda      (AgendaPanel — the duplicate)', () => buildAgenda(idea.id)),
    await time('/panel       (ReportAdditions — added by 25-N)', () => buildQuestionPanel(idea.id)),
    await time('/panel?field (QuestionPanel)', () => buildQuestionPanel(idea.id, { focusFieldRef: 'causes' })),
    // Not a duplicate, but it is on the same paint and is the other candidate.
    await time('/build       (BuildProgress + RerunBanner)', () => buildState(idea.id)),
  ]

  console.log('  call                                          runs (ms)          median')
  for (const r of results) {
    const sorted = [...r.ms].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    console.log(
      `  ${r.label.padEnd(44)} ${r.ms.map((m) => String(m).padStart(5)).join(' ')}   ${String(median).padStart(6)}`
      + `${r.ok ? '' : '   ⚠ threw'}`,
    )
  }

  const med = (r: typeof results[number]) => [...r.ms].sort((a, b) => a - b)[Math.floor(r.ms.length / 2)]
  const agendaDup = med(results[1])
  const panelDup = med(results[2])
  const total = results.reduce((n, r) => n + med(r), 0)

  console.log(`\n  total of all five, median          : ${total} ms`)
  console.log(`  the two DUPLICATE calls            : ${agendaDup + panelDup} ms`)
  console.log(`  duplicates as a share of the paint : ${((agendaDup + panelDup) / total * 100).toFixed(1)}%`)
  console.log('')
  console.log('  ⚠ These run in parallel in the browser, so removing a duplicate saves the paint')
  console.log('    time only if it is the SLOWEST call. Compare the medians above, not the total.')
  const slowest = results.reduce((a, b) => (med(a) >= med(b) ? a : b))
  console.log(`  ⚠ the slowest single call is: ${slowest.label} at ${med(slowest)} ms`)
  console.log(`    ${/duplicate|ReportAdditions/.test(slowest.label)
    ? '→ a duplicate IS the critical path. De-duplicating would move the paint.'
    : '→ a duplicate is NOT the critical path. De-duplicating would save requests, not seconds.'}`)
  console.log('')

  await prisma.$disconnect()
}

void main()
