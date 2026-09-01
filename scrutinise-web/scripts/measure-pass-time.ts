// ─────────────────────────────────────────────────────────────────────────────
// 25-Q ADDENDUM — WHERE THE 764 SECONDS ACTUALLY GO.
//
// Charlie: *"the full build now runs 764s against a 900s ceiling — 15% margin. The commentary
// pass added in 25-O consumed most of the headroom. Measure where the time actually goes across
// the eleven passes, report the three slowest, and say whether the ceiling should rise or the
// passes should get faster. Do not change either until the measurement is in."*
//
// ⚠⚠ THIS SCRIPT CHANGES NOTHING. Not a figure of speech: it opens no write, and the two numbers
// under discussion (`HARD_STOP_MS`, `PASS_BUDGET_MS`) are only READ, so a run of this cannot be
// the thing that moves them.
//
// ⚠ IT MEASURES FROM THE PASS LOG, WHICH IS THE BUILD'S OWN RECORD. Every pass writes `startedAt`
// and `completedAt` into `IdeaBuild.passes` as it runs, so this is what happened rather than what
// a re-run today would do. That matters: re-running to measure would price today's corpus, today's
// model latency and today's queue, and the question is about builds that have already happened.
//
// ⚠ AND IT SEPARATES FULL FROM REUSE. A REUSE build skips the two research passes by design; mixing
// the two produces a mean that describes no build anybody ever ran.
//
// ⚠ THE GAPS ARE MEASURED TOO, and they are not a rounding error. A build is a chain of separate
// requests, so the wall clock between `startedAt` on the row and `completedAt` on the last pass
// includes time no pass was running — queueing, worker pickup, the jitter in `worker-queue.ts`.
// A ceiling is a wall-clock ceiling, so any recommendation that ignores the gaps is answering a
// different question from the one the ceiling asks.
//
// Usage: npm run measure:pass-time [ideaIdPrefix]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { readPassLog } from '../lib/lex/build-carry'
import { BUILD_PASSES, HARD_STOP_MS, PASS_BUDGET_MS } from '../lib/lex/build-config'

interface PassTiming { key: string; label: string; ms: number; status: string }
interface BuildTiming {
  version: number
  mode: string
  status: string
  ideaId: string
  /** Wall clock the ceiling actually measures: claim → last completed pass. */
  wallMs: number
  /** The sum of the passes' own durations. */
  passMs: number
  passes: PassTiming[]
  ranPasses: number
  /** ⚠ A resumed build's clock restarts; its wall figure is the resumed leg, not the whole. */
  resumed: boolean
}

const secs = (ms: number) => (ms / 1000).toFixed(1)
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—')

function timeBuild(row: {
  version: number; mode: string; status: string; ideaId: string
  startedAt: Date | null; resumedAt: Date | null; completedAt: Date | null; passes: unknown
}): BuildTiming | null {
  const log = readPassLog(row.passes)
  const passes: PassTiming[] = log
    .filter((p) => p.startedAt && p.completedAt)
    .map((p) => ({
      key: p.key,
      label: p.label,
      status: p.status,
      ms: new Date(p.completedAt!).getTime() - new Date(p.startedAt!).getTime(),
    }))
    // ⚠ A NEGATIVE OR ABSURD DURATION IS DROPPED AND SAID SO, not clamped. The machine clock on
    // this project has been wrong by ~14 hours once; a silently clamped -50,000s would look like
    // a fast pass.
    .filter((p) => p.ms >= 0 && p.ms < 3 * PASS_BUDGET_MS)
  if (!passes.length) return null

  const first = log.filter((p) => p.startedAt).map((p) => new Date(p.startedAt!).getTime())
  const last = log.filter((p) => p.completedAt).map((p) => new Date(p.completedAt!).getTime())
  // ══ THE CEILING'S OWN CLOCK, NOT ONE THAT LOOKS LIKE IT ═══════════════════════════
  //
  // ⚠⚠ `checkStop` measures from `resumedAt ?? startedAt` (25-N §1a: a resumed build gets a fresh
  // wall clock, because otherwise a build stopped on Monday could never be picked up on Tuesday).
  // The first version of this script measured from `startedAt` alone — so for any RESUMED build it
  // was reporting a wall clock that included the hours the build sat stopped, and calling that
  // "time against the ceiling". That is a measurement of a different thing wearing the same name,
  // and it would have argued for raising a ceiling that had never been reached.
  const start = (row.resumedAt ?? row.startedAt)?.getTime() ?? Math.min(...first)
  const end = Math.max(...last)
  return {
    version: row.version, mode: row.mode, status: row.status, ideaId: row.ideaId,
    resumed: !!row.resumedAt,
    wallMs: Math.max(0, end - start),
    passMs: passes.reduce((n, p) => n + p.ms, 0),
    passes,
    ranPasses: passes.length,
  }
}

async function main() {
  const prefix = process.argv[2]
  console.log('\n══ 25-Q addendum — where the build spends its time ══════════════════════\n')
  console.log(`  ceiling (HARD_STOP_MS)   ${secs(HARD_STOP_MS)}s, the whole build`)
  console.log(`  per pass (PASS_BUDGET_MS) ${secs(PASS_BUDGET_MS)}s, inside one request`)
  console.log(`  ${BUILD_PASSES.length} passes configured today\n`)
  console.log('  ⚠ THIS SCRIPT WRITES NOTHING AND CHANGES NEITHER NUMBER.\n')

  const rows = await prisma.ideaBuild.findMany({
    where: {
      ...(prefix ? { ideaId: { startsWith: prefix } } : {}),
      startedAt: { not: null },
    },
    orderBy: { startedAt: 'desc' },
    take: 60,
    select: {
      version: true, mode: true, status: true, ideaId: true,
      startedAt: true, resumedAt: true, completedAt: true, passes: true,
    },
  })
  const timed = rows.map(timeBuild).filter((t): t is BuildTiming => !!t)
  const full = timed.filter((t) => t.mode !== 'REUSE')
  const reuse = timed.filter((t) => t.mode === 'REUSE')
  console.log(`  ${timed.length} builds with usable timings — ${full.length} FULL, ${reuse.length} REUSE.\n`)
  if (!full.length) { console.log('  No FULL builds to measure.'); return }

  // ── 1. THE BUILDS THEMSELVES ────────────────────────────────────────────────
  console.log('── the most recent FULL builds ──')
  console.log('  ver  status     passes  pass time   wall clock   gap    of ceiling')
  for (const t of full.slice(0, 10)) {
    const gap = t.wallMs - t.passMs
    console.log(
      `  v${String(t.version).padEnd(3)} ${t.status.padEnd(10)} ${String(t.ranPasses).padStart(2)}/${BUILD_PASSES.length}`
      + `   ${secs(t.passMs).padStart(7)}s   ${secs(t.wallMs).padStart(8)}s`
      + `  ${secs(gap).padStart(6)}s   ${pct(t.wallMs, HARD_STOP_MS).padStart(5)}`
      + `   ${t.ideaId.slice(0, 8)}${t.resumed ? '  (resumed — clock restarted)' : ''}`,
    )
  }

  // ── 2. PER PASS, ACROSS THE FULL BUILDS ────────────────────────────────────
  //
  // ⚠ THE MEDIAN LEADS, NOT THE MEAN. One pass that timed out at its budget drags a mean of
  // five runs by 40 seconds and would put the wrong pass at the top of the list.
  const byPass = new Map<string, number[]>()
  for (const t of full) {
    for (const p of t.passes) {
      if (!byPass.has(p.key)) byPass.set(p.key, [])
      byPass.get(p.key)!.push(p.ms)
    }
  }
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const stats = BUILD_PASSES.map((def) => {
    const xs = byPass.get(def.key) ?? []
    return {
      key: def.key,
      label: def.label,
      runs: xs.length,
      med: xs.length ? median(xs) : 0,
      max: xs.length ? Math.max(...xs) : 0,
      min: xs.length ? Math.min(...xs) : 0,
    }
  })
  const totalMed = stats.reduce((n, s) => n + s.med, 0)

  console.log('\n── per pass, across those FULL builds (median) ──')
  console.log('  pass                        runs   median      min      max   share')
  for (const s of stats) {
    console.log(
      `  ${s.key.padEnd(18)} ${s.label.slice(0, 8).padEnd(8)} ${String(s.runs).padStart(4)}`
      + `  ${secs(s.med).padStart(7)}s ${secs(s.min).padStart(7)}s ${secs(s.max).padStart(7)}s`
      + `  ${pct(s.med, totalMed).padStart(5)}`,
    )
  }
  console.log(`  ${''.padEnd(27)}       ${secs(totalMed).padStart(7)}s   ← the passes' own time`)

  // ── 2b. THE ONE COMPLETE BUILD, PASS BY PASS ───────────────────────────────
  //
  // ⚠⚠ THE MEDIANS ABOVE DESCRIBE NO SINGLE BUILD, and on this sample they cannot: only one run
  // has ever executed all eleven passes, so every other column is a median over runs that
  // stopped at a different point. The build Charlie is asking about is a specific one, and its
  // own numbers are the ones the ceiling question turns on.
  const complete0 = full.find((t) => t.ranPasses === BUILD_PASSES.length)
  if (complete0) {
    console.log(`\n── v${complete0.version}, the only build that has run all ${BUILD_PASSES.length} passes ──`)
    const ordered = BUILD_PASSES
      .map((d) => complete0.passes.find((x) => x.key === d.key))
      .filter((x): x is PassTiming => !!x)
    let cum = 0
    for (const x of ordered) {
      cum += x.ms
      console.log(`  ${x.key.padEnd(18)} ${secs(x.ms).padStart(7)}s   cumulative ${secs(cum).padStart(7)}s`
        + `   ${pct(x.ms, complete0.passMs).padStart(4)}`)
    }
    console.log(`  ${'passes'.padEnd(18)} ${secs(complete0.passMs).padStart(7)}s`)
    console.log(`  ${'wall clock'.padEnd(18)} ${secs(complete0.wallMs).padStart(7)}s`
      + `   ${pct(complete0.wallMs, HARD_STOP_MS)} of the ceiling, `
      + `${secs(HARD_STOP_MS - complete0.wallMs)}s to spare`)
  }

  // ── 3. THE THREE SLOWEST, WHICH IS WHAT WAS ASKED FOR ──────────────────────
  const slowest = [...stats].filter((s) => s.runs > 0).sort((a, b) => b.med - a.med).slice(0, 3)
  console.log('\n── the three slowest ──')
  for (const [i, s] of slowest.entries()) {
    console.log(`  ${i + 1}. ${s.label} (${s.key}) — ${secs(s.med)}s median, `
      + `${pct(s.med, totalMed)} of the passes' time, over ${s.runs} run${s.runs === 1 ? '' : 's'}`)
  }
  const topThree = slowest.reduce((n, s) => n + s.med, 0)
  console.log(`  together: ${secs(topThree)}s, ${pct(topThree, totalMed)} of the passes' time.`)

  // ── 4. WHAT THE COMMENTARY PASS COST ───────────────────────────────────────
  //
  // ⚠ THE CLAIM UNDER TEST. "The commentary pass consumed most of the headroom" is checkable:
  // it has its own median, and the builds that predate it have their own totals.
  const commentary = stats.find((s) => s.key === 'CAUSES_COMMENTARY')
  console.log('\n── what 25-O\'s commentary pass actually costs ──')
  if (!commentary || commentary.runs === 0) {
    // ⚠ SAID PLAINLY RATHER THAN ESTIMATED. 25-Q's own report records that this pass HAS STILL
    // NEVER BEEN GENERATED, so there is no measurement to make and inventing one would be worse
    // than the gap.
    console.log('  ⚠ IT HAS NEVER RUN — 0 timings in this sample. So it cannot be what consumed')
    console.log('    the headroom, and any figure attributing time to it would be invented.')
    console.log(`    Its budget if it does run is the per-pass ceiling: up to ${secs(PASS_BUDGET_MS)}s.`)
  } else {
    console.log(`  ${secs(commentary.med)}s median over ${commentary.runs} run(s) — `
      + `${pct(commentary.med, totalMed)} of the passes' time.`)
    console.log(`  Without it the passes would total ${secs(totalMed - commentary.med)}s.`)
  }

  // ── 5. HOW CLOSE ANY OF THIS ACTUALLY CAME TO THE CEILING ──────────────────
  const worst = [...full].sort((a, b) => b.wallMs - a.wallMs)[0]
  const medWall = median(full.map((t) => t.wallMs))
  const gaps = full.map((t) => t.wallMs - t.passMs)
  console.log('\n── against the ceiling ──')
  console.log(`  median FULL build wall clock  ${secs(medWall)}s  (${pct(medWall, HARD_STOP_MS)} of the ceiling)`)
  console.log(`  worst in this sample          ${secs(worst.wallMs)}s  (${pct(worst.wallMs, HARD_STOP_MS)}) — v${worst.version} ${worst.ideaId.slice(0, 8)}`)
  console.log(`  median gap (no pass running)  ${secs(median(gaps))}s  (${pct(median(gaps), medWall)} of the wall clock)`)
  const complete = full.filter((t) => t.ranPasses === BUILD_PASSES.length)
  console.log(`  builds that ran all ${BUILD_PASSES.length} passes: ${complete.length} of ${full.length}`)
  const stoppedOnTime = await prisma.ideaBuild.count({
    where: { failureReason: { contains: 'time' } },
  })
  console.log(`  builds ever stopped by the clock: ${stoppedOnTime}`)
  // ── 5b. WHERE THE DEAD TIME SITS, WHICH DECIDES THE WHOLE QUESTION ─────────
  //
  // ⚠⚠ THE GAP IS NOT SPREAD THINLY, AND THAT IS THE FINDING. A build losing five seconds
  // between each of eleven passes and a build losing 595 seconds before its first pass have the
  // same "gap" total and are completely different problems — the first is the cost of a worker
  // architecture, the second is a stall. Averaging them describes neither.
  //
  // So this prints the WAIT BEFORE EACH PASS on the builds that came closest to the ceiling. A
  // recommendation about a time ceiling that has not looked at this is answering from a total.
  const nearest = [...full].sort((a, b) => b.wallMs - a.wallMs).slice(0, 3)
  console.log('\n── where the dead time sits, on the three builds closest to the ceiling ──')
  for (const t of nearest) {
    const row = rows.find((r) => r.version === t.version && r.ideaId === t.ideaId)!
    const log = readPassLog(row.passes).filter((x) => x.startedAt)
    let prevEnd = (row.resumedAt ?? row.startedAt)!.getTime()
    const waits: Array<{ key: string; wait: number }> = []
    for (const x of log) {
      const st = new Date(x.startedAt!).getTime()
      waits.push({ key: x.key, wait: (st - prevEnd) / 1000 })
      if (x.completedAt) prevEnd = new Date(x.completedAt!).getTime()
    }
    const worst = [...waits].sort((a, b) => b.wait - a.wait)[0]
    const rest = waits.filter((w) => w !== worst)
    const restTotal = rest.reduce((n, w) => n + w.wait, 0)
    console.log(`  v${t.version} ${t.status.padEnd(9)} wall ${secs(t.wallMs).padStart(7)}s  `
      + `longest single wait: ${worst.wait.toFixed(1)}s before ${worst.key}; `
      + `all ${rest.length} others together: ${restTotal.toFixed(1)}s`)
  }
  console.log('  → a single stall, not an evenly-spread overhead.')

  // ── 6. WHAT THE PER-PASS BUDGET ACTUALLY BINDS ON ──────────────────────────
  //
  // ⚠⚠ MEASURED, NOT ASSUMED, AND IT CHANGES THE ANSWER. `PASS_BUDGET_MS` reads like a ceiling on
  // every pass. It is enforced in ONE place — `build-research.ts`, between questions — and
  // `build.ts` only logs it. So the slowest pass in the build has no time budget at all, which is
  // visible in the numbers above: a pass whose max exceeds the budget is not misbehaving, it is
  // unbudgeted.
  const over = stats.filter((s2) => s2.runs > 0 && s2.max > PASS_BUDGET_MS)
  console.log('\n── which passes have ever exceeded the per-pass budget ──')
  if (!over.length) {
    console.log(`  none — no pass has run longer than ${secs(PASS_BUDGET_MS)}s in this sample.`)
  } else {
    for (const s2 of over) {
      console.log(`  ${s2.key.padEnd(18)} max ${secs(s2.max)}s against a ${secs(PASS_BUDGET_MS)}s budget`
        + `  (+${secs(s2.max - PASS_BUDGET_MS)}s)`)
    }
    console.log('  ⚠ RESEARCH checks the budget between questions, so it can overshoot by one')
    console.log('    question. Every other pass is unbudgeted; the only backstop is the stuck')
    console.log(`    threshold in build-settle.ts, at ${secs(PASS_BUDGET_MS + 120_000)}s.`)
  }

  console.log('\n  ⚠ The recommendation belongs in the report, not in this script — a script that')
  console.log('    printed a verdict would be read as one having been acted on.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
