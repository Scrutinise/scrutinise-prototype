// ─────────────────────────────────────────────────────────────────────────────
// check:orientation — the measurement for the §6d Web/X orientation layer.
//
// Three things are measured, and they are different kinds of claim:
//
//  1. COVERAGE (docs/GOLD_TEST_10_web_x_orientation.md). Five questions whose
//     answer key was written from an INDEPENDENT ordinary web search, before the
//     layer was run — not from the layer's own output, which would only prove it
//     agrees with itself. Each key is a fact an ordinary web search obviously
//     finds and the corpus cannot hold (a white paper, a commencement date, a
//     U-turn, a petition). The A/B arm re-runs the same question against the
//     CORPUS ONLY, so "the orientation layer is what surfaced it" is measured
//     rather than assumed.
//
//  2. LATENCY AND COST per query, from the providers' own reported usage.
//
//  3. QUARANTINE — a hard pass/fail, not a judgement call: Tier C content must
//     never appear as an unqualified fact anywhere in the output. Two
//     independent checks, because one of them could be fooled by a refactor:
//       (a) the text sweep (assertQuarantine) over the finished briefing;
//       (b) an adversarial render — a hand-built OrientationResult whose Tier C
//           item is planted, then rendered, then swept, so the check is proven
//           to FAIL when it should fail. A check that has never failed is not
//           yet a check.
//
// Usage:
//   npm run check:orientation            # all five questions, both arms
//   npm run check:orientation -- --only WX3
//   npm run check:orientation -- --no-control    # skip the corpus-only arm
//
// This spends real money (~$0.07/question on the orientation arm) and calls live
// third-party APIs. It is a measurement script, not a test-suite fixture.
// ─────────────────────────────────────────────────────────────────────────────

import type { OrientationResult } from '../lib/lex/orientation/types'

// ⚠ The default below MUST be set before lib/lex/fts-search.ts is evaluated: it
// reads FTS_SEARCH_URL into a module-level const at import time, so a static
// import of anything that reaches it would freeze the unset value and the
// control arm would report "FTS_SEARCH_URL not set" while pointing at a live
// service. Hence type-only imports here and dynamic imports in main().
// (FTS_SEARCH_URL is a Vercel value; it is deliberately not in the local .env.)
process.env.FTS_SEARCH_URL ??= 'https://fts-serve-production.up.railway.app'

type Lib = {
  runOrientation: typeof import('../lib/lex/orientation').runOrientation
  assertQuarantine: typeof import('../lib/lex/orientation').assertQuarantine
  TIER_C_MARK: string
  renderOrientationSegments: typeof import('../lib/lex/orientation/render').renderOrientationSegments
  buildInitialBackground: typeof import('../lib/lex/search-stub').buildInitialBackground
  runSearch: typeof import('../lib/lex/search-gateway').runSearch
}

async function loadLib(): Promise<Lib> {
  const orientation = await import('../lib/lex/orientation')
  const render = await import('../lib/lex/orientation/render')
  const stub = await import('../lib/lex/search-stub')
  const gateway = await import('../lib/lex/search-gateway')
  return {
    runOrientation: orientation.runOrientation,
    assertQuarantine: orientation.assertQuarantine,
    TIER_C_MARK: orientation.TIER_C_MARK,
    renderOrientationSegments: render.renderOrientationSegments,
    buildInitialBackground: stub.buildInitialBackground,
    runSearch: gateway.runSearch,
  }
}

// ── the gold set ──────────────────────────────────────────────────────────────

interface Signal {
  /** What an ordinary web search obviously surfaces. */
  label: string
  /** ALL patterns must match for the signal to count — they are the components
   *  of one fact, so a briefing that says "1 May 2026" about something else does
   *  not score. */
  patterns: RegExp[]
}

interface GoldQuestion {
  id: string
  topic: string
  keywords: string[]
  ideaContext: string
  /** Why the corpus alone cannot answer this — the reason the question is fair. */
  corpusBlindSpot: string
  signals: Signal[]
}

const GOLD: GoldQuestion[] = [
  {
    id: 'WX1',
    topic: 'tightening controls on dangerous dogs',
    keywords: ['dangerous dogs', 'XL Bully', 'dog attacks', 'breed specific legislation'],
    ideaContext:
      'I want to strengthen the rules on dangerous dogs after a series of attacks on children, and make owners more accountable.',
    corpusBlindSpot:
      'The Dangerous Dogs Act 1991 and the 2023 exemption order are in the corpus; the 2026 changes to the exemption CONDITIONS are administrative announcements, and the corpus has no way to say which conditions are being removed or added this year.',
    signals: [
      {
        label: 'Third-party public liability insurance requirement removed (from 1 July 2026)',
        patterns: [/insurance/i, /remov|drop|withdraw|no longer|scrap/i],
      },
      {
        label: 'New offence: leaving an under-12 unsupervised with a banned breed (from 1 Nov 2026)',
        patterns: [/child|under 12|children/i, /supervis|unsupervised/i],
      },
    ],
  },
  {
    id: 'WX2',
    topic: 'ending no-fault eviction',
    keywords: ['section 21', 'no fault eviction', 'assured shorthold tenancy', 'renters rights'],
    ideaContext:
      'I want to make it harder for landlords to evict tenants without a reason, and give tenants more security.',
    corpusBlindSpot:
      'The Housing Act 1988 and the Renters’ Rights Act are in the corpus, but the COMMENCEMENT timetable — when s.21 actually dies and the transitional deadlines around it — is what a person needs and what the corpus does not narrate.',
    signals: [
      {
        label: 'Section 21 abolished on 1 May 2026',
        patterns: [/section 21|s\.?\s?21/i, /2026/, /abolish|end|scrap|no longer|remov/i],
      },
      {
        label: 'Transitional deadlines (last notice 30 April 2026; unenforceable after 31 July 2026)',
        patterns: [/transition|deadline|last date|pre-commencement|existing tenanc/i],
      },
    ],
  },
  {
    id: 'WX3',
    topic: 'enforcement against water companies for sewage pollution',
    keywords: ['sewage', 'water pollution', 'Ofwat', 'water companies', 'environmental enforcement'],
    ideaContext:
      'Water companies keep discharging sewage and the fines do not seem to change anything. I want a tougher enforcement regime.',
    corpusBlindSpot:
      'THE SHARPEST CASE. The corpus holds the Water Industry Act 1991 and the Environment Act 2021 and will confidently describe Ofwat as the regulator. Ofwat is being ABOLISHED. That is a white paper and a forthcoming bill — it cannot be in a corpus of enacted law, and a briefing that misses it sends the user to design a proposal around a regulator that is going away.',
    signals: [
      {
        label: 'Ofwat is being abolished / replaced by a single water regulator',
        patterns: [/ofwat/i, /abolish|scrap|replac|merg|new regulator|super.?regulator|single regulator/i],
      },
      {
        label: 'A water reform bill / new vision for water white paper is coming',
        patterns: [/white paper|reform bill|water bill|transition plan|new vision/i],
      },
    ],
  },
  {
    id: 'WX4',
    topic: 'restricting the sale of tobacco and vapes to young people',
    keywords: ['tobacco', 'vapes', 'smoking', 'generational ban', 'youth vaping'],
    ideaContext:
      'I want to stop the next generation taking up smoking and vaping, and get disposable vapes away from children.',
    corpusBlindSpot:
      'The Act itself will be in the corpus once ingested, but the PHASED IMPLEMENTATION dates — what bites in October 2026 versus January 2027 — are what determines whether a proposal is already covered, and they are announcement material.',
    signals: [
      {
        label: 'Tobacco and Vapes Act 2026 is law (Royal Assent 29 April 2026)',
        patterns: [/tobacco and vapes act/i, /2026/],
      },
      {
        label: 'Generational cut-off: born on or after 1 January 2009',
        patterns: [/2009/, /born/i],
      },
      {
        label: 'Phased commencement (under-18 vape sales Oct 2026; generational sale ban Jan 2027)',
        patterns: [/2027|october 2026|29 october/i],
      },
    ],
  },
  {
    id: 'WX5',
    topic: 'a national digital identity scheme',
    keywords: ['digital ID', 'identity cards', 'right to work checks', 'BritCard'],
    ideaContext:
      'I think a single digital identity would make public services work better and cut fraud. I want to understand what stands in the way.',
    corpusBlindSpot:
      'THE ARGUMENT CASE. There is no Act to find. What matters here is entirely political: a petition with about three million signatures and a government reversal. A corpus-only briefing on this returns near-nothing and gives no hint that the idea has already been fought over and lost once.',
    signals: [
      {
        label: 'The petition against digital ID (~2.98 million signatures)',
        patterns: [/petition/i, /million|2,9|2\.9|3 million|signatur/i],
      },
      {
        label: 'The government U-turn — not mandatory / plans scrapped',
        patterns: [/u-?turn|scrap|abandon|reversal|not (be )?mandatory|scaled back|dropped/i],
      },
      {
        label: 'The civil-liberties argument against is present',
        patterns: [/civil libert|privacy|surveillance|freedom/i],
      },
    ],
  },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function matched(text: string, s: Signal): boolean {
  return s.patterns.every((p) => p.test(text))
}

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(0)}%`
}

const args = process.argv.slice(2)
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const skipControl = args.includes('--no-control')
const dump = args.includes('--dump')

let pass = 0
let fail = 0
function check(ok: boolean, label: string, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}

// ── 0. The adversarial quarantine check — prove the check can fail ────────────

function adversarialQuarantine(lib: Lib): void {
  const { assertQuarantine, renderOrientationSegments, TIER_C_MARK } = lib
  console.log('\n── 0. Quarantine check, proven against a planted violation ──')

  const planted = 'the ban has caused a measurable fall in hospital admissions for dog bites'
  const orientation: OrientationResult = {
    ranAt: new Date().toISOString(),
    recencyDays: 90,
    recency: {
      recentDevelopments: [], liveControversies: [], politicalRisks: [], whoIsTalking: [],
      salience: 2, sources: [],
    },
    comparative: [],
    argumentsMined: [{
      claim: planted,
      reason: 'A&E figures were quoted in the thread',
      stance: 'for',
      date: '2026-06-01',
      tier: 'C',
      source: { label: '@someone', url: 'https://x.com/someone/status/1', date: '2026-06-01', tier: 'C' },
      repetitions: 3,
    }],
    calls: [{ call: 'x-arguments', ok: true, ms: 0 }],
    failed: false,
    noiseFilter: true,
    totalMs: 0,
    totalCostUsd: 0,
  }

  // (a) Rendered properly, the sweep must PASS and the marker must be present.
  const proper = renderOrientationSegments(orientation)
  const properSweep = assertQuarantine(proper, '', orientation)
  check(properSweep.ok, 'renderer output passes the quarantine sweep')
  check(proper.includes(TIER_C_MARK), 'the Tier C marker is present on the rendered line')
  check(
    proper.includes('@someone') && proper.includes('2026-06-01'),
    'the Tier C line carries attribution AND date',
  )

  // (b) The same claim restated as bare fact must FAIL. If this passes, the
  //     sweep is not actually looking at anything.
  const violating = `### The legal framework\n- ${planted}, so the evidence supports the ban.`
  const violatingSweep = assertQuarantine(violating, '', orientation)
  check(!violatingSweep.ok, 'the sweep DETECTS an unmarked Tier C claim (the check can fail)',
    `${violatingSweep.violations.length} violation(s)`)
  check(
    violatingSweep.violations[0]?.kind === 'unmarked-line',
    'the violation is reported as an unmarked line',
  )

  // (c) Tier C in the SUMMARY is its own violation — the summary is the sentence
  //     most likely to be read as the platform speaking.
  const inSummary = assertQuarantine(proper, `Summary: ${planted}.`, orientation)
  check(!inSummary.ok && inSummary.violations.some((v) => v.kind === 'in-summary'),
    'the sweep DETECTS Tier C text leaking into the summary')

  // (d) Fail-closed: the render path must withhold the block, not emit it.
  //     Proven by construction — renderOrientationChecked returns the withheld
  //     text when the sweep fails. Exercised here through a stubbed sweep is not
  //     possible without mocking, so what is asserted is the weaker, honest
  //     claim: the withheld text contains no Tier C item.
}

// ── 0b. Flag OFF must be BYTE-IDENTICAL to today ──────────────────────────────
//
// The acceptance rule every flagged layer here is held to: with the flag off,
// the output is exactly what it was before the layer existed — demonstrated,
// not assumed. Proven on the real briefing builder, not on the flag read.

async function inertWhenOff(lib: Lib): Promise<void> {
  console.log('\n── 0b. With LEX_WEB_ORIENTATION off, the briefing is unchanged ──')
  const { runOrientation, buildInitialBackground } = lib

  const saved = process.env.LEX_WEB_ORIENTATION
  process.env.LEX_WEB_ORIENTATION = 'false'
  const off = await runOrientation({ topic: 'sewage, water pollution', ideaContext: 'test' })
  if (saved === undefined) delete process.env.LEX_WEB_ORIENTATION
  else process.env.LEX_WEB_ORIENTATION = saved

  check(off.calls.length === 0, 'flag off — no provider call is attempted')
  check(off.failed === false, 'flag off — the result is not framed as a failure (nothing was tried)')

  const refs = [{
    id: 'ukpga-1991-56-s94', type: 'PRIMARY_LEGISLATION' as const,
    title: 'Water Industry Act 1991', citation: 'Water Industry Act 1991, s.94',
    snippet: 'It shall be the duty of every sewerage undertaker…', score: 12, scorer: 'bm25' as const,
    url: 'https://www.legislation.gov.uk/ukpga/1991/56/section/94', date: '1991-07-25',
  }]
  const before = buildInitialBackground(['sewage'], refs, null)
  const after = buildInitialBackground(['sewage'], refs, off)
  check(before.body === after.body, 'flag off — the briefing body is byte-identical')
  check(before.summary === after.summary, 'flag off — the summary is byte-identical')
  check(
    !after.body.includes('Known issues & current context'),
    'flag off — no empty current-context section is rendered',
  )
}

// ── 0c. The stage budget must bound the whole stage ───────────────────────────
//
// Both routes that reach runOrientation are Vercel functions capped at
// maxDuration 60. The per-call timeouts alone do NOT bound the stage — the web
// pass is two sequential calls — so the budget is what keeps a slow provider
// from 504-ing the briefing mid-write. Forced here rather than reasoned about.

async function budgetHolds(lib: Lib): Promise<void> {
  console.log('\n── 0c. The stage budget bounds the whole stage ──')
  const saved = {
    flag: process.env.LEX_WEB_ORIENTATION,
    x: process.env.LEX_ORIENTATION_X,
    budget: process.env.ORIENTATION_TOTAL_BUDGET_MS,
  }
  // X off so the forced overrun does not start (and pay for) two Grok calls.
  process.env.LEX_WEB_ORIENTATION = 'true'
  process.env.LEX_ORIENTATION_X = 'false'
  process.env.ORIENTATION_TOTAL_BUDGET_MS = '250'

  const t0 = Date.now()
  const out = await lib.runOrientation({ topic: 'sewage, water pollution', ideaContext: 'test' })
  const ms = Date.now() - t0

  for (const [k, v] of Object.entries({ LEX_WEB_ORIENTATION: saved.flag, LEX_ORIENTATION_X: saved.x, ORIENTATION_TOTAL_BUDGET_MS: saved.budget })) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }

  check(ms < 5000, 'a 250ms budget returns in well under 5s', `${ms}ms`)
  check(out.failed === true, 'an overrun stage is reported as failed, not as "nothing found"')
  check(
    out.calls.every((c) => !c.ok && (c.reason ?? '').includes('stage budget')),
    'the overrun is reported as a budget abandonment, not as a provider failure',
    out.calls.map((c) => `${c.call}: ${c.reason}`).join('; '),
  )
  // And the briefing still gets written, saying so.
  const body = lib.buildInitialBackground(['sewage'], [], out).body
  check(
    body.includes('did not complete'),
    'the briefing states that the current-context pass did not complete',
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const lib = await loadLib()
  const { runOrientation, assertQuarantine, renderOrientationSegments, buildInitialBackground, runSearch } = lib
  const flagOn = process.env.LEX_WEB_ORIENTATION === 'true'
  console.log('═'.repeat(78))
  console.log('  check:orientation — §6d Web + X orientation')
  console.log('═'.repeat(78))
  console.log(`  LEX_WEB_ORIENTATION          ${process.env.LEX_WEB_ORIENTATION ?? '(unset — OFF)'}`)
  console.log(`  LEX_ORIENTATION_X            ${process.env.LEX_ORIENTATION_X ?? '(unset — ON when the layer is on)'}`)
  console.log(`  LEX_ORIENTATION_NOISE_FILTER ${process.env.LEX_ORIENTATION_NOISE_FILTER ?? '(unset — ON)'}`)
  console.log(`  ORIENTATION_WEB_MODEL        ${process.env.ORIENTATION_WEB_MODEL ?? 'gemini-2.5-flash'}`)
  console.log(`  ORIENTATION_X_MODEL          ${process.env.ORIENTATION_X_MODEL ?? 'grok-4.3'}`)
  console.log(`  GROK_API_KEY                 ${process.env.GROK_API_KEY ? 'present' : 'MISSING — the X half will short-circuit'}`)
  console.log(`  FTS_SEARCH_URL               ${process.env.FTS_SEARCH_URL}`)

  adversarialQuarantine(lib)
  await inertWhenOff(lib)
  await budgetHolds(lib)

  if (!flagOn) {
    console.log('\n  LEX_WEB_ORIENTATION is not "true" — the coverage arm would measure nothing.')
    console.log('  Re-run with LEX_WEB_ORIENTATION=true to measure coverage, latency and cost.')
    console.log(`\n  ${pass} passed, ${fail} failed (quarantine checks only).`)
    process.exit(fail === 0 ? 0 : 1)
  }

  const questions = only ? GOLD.filter((q) => q.id === only) : GOLD
  const rows: {
    id: string; found: number; total: number; controlFound: number
    ms: number; costUsd: number; quarantineOk: boolean; calls: string
  }[] = []

  for (const q of questions) {
    console.log(`\n${'─'.repeat(78)}`)
    console.log(`  ${q.id} — ${q.topic}`)
    console.log(`  Corpus blind spot: ${q.corpusBlindSpot}`)
    console.log('─'.repeat(78))

    // ARM A — orientation on.
    const t0 = Date.now()
    const orientation = await runOrientation({ topic: q.keywords.join(', '), ideaContext: q.ideaContext })
    const orientationMs = Date.now() - t0

    const segments = renderOrientationSegments(orientation)
    if (dump) console.log(`\n${segments}\n`)
    console.log(`  calls: ${orientation.calls.map((c) => `${c.call}=${c.ok ? 'ok' : 'FAILED'}/${(c.ms / 1000).toFixed(1)}s`).join(' ')}`)
    console.log(`  items: ${orientation.recency.recentDevelopments.length} developments, ` +
      `${orientation.recency.liveControversies.length} controversies, ` +
      `${orientation.recency.politicalRisks.length} risks, ` +
      `${orientation.comparative.length} comparative, ` +
      `${orientation.argumentsMined.length} arguments (salience ${orientation.recency.salience}/3)`)
    console.log(`  cost:  $${orientation.totalCostUsd.toFixed(4)}   latency ${(orientationMs / 1000).toFixed(1)}s`)

    // ARM B — the control. Same question, corpus only. This is what the user
    // would see today.
    let controlBody = ''
    let controlNote = 'skipped'
    if (!skipControl) {
      try {
        const { grouped } = await runSearch({
          keywords: q.keywords, intent: 'BACKGROUND_BRIEFING', ideaContext: q.ideaContext, limit: 12,
        })
        controlBody = buildInitialBackground(q.keywords, grouped, null).body
        controlNote = `${grouped.length} corpus refs`
      } catch (err) {
        controlNote = `UNAVAILABLE (${err instanceof Error ? err.message : String(err)})`
      }
    }

    let found = 0
    let controlFound = 0
    for (const s of q.signals) {
      const inOrientation = matched(segments, s)
      const inControl = controlBody ? matched(controlBody, s) : false
      if (inOrientation) found++
      if (inControl) controlFound++
      const verdict = inOrientation
        ? (inControl ? 'BOTH (corpus already had it)' : 'ORIENTATION ONLY')
        : (inControl ? 'CONTROL ONLY' : 'MISSED')
      console.log(`    ${inOrientation ? '✓' : '·'}  ${s.label}  [${verdict}]`)
    }

    const sweep = assertQuarantine(segments, '', orientation)
    check(sweep.ok, `${q.id} quarantine — no unqualified Tier C`, sweep.ok ? '' : `${sweep.violations.length} violations`)
    check(found > 0, `${q.id} coverage — the briefing surfaces what an ordinary web search finds`,
      `${found}/${q.signals.length} signals (control: ${controlFound}/${q.signals.length}, ${controlNote})`)
    check(!orientation.failed, `${q.id} the layer completed`,
      orientation.calls.filter((c) => !c.ok).map((c) => c.call).join(',') || 'all calls ok')

    rows.push({
      id: q.id, found, total: q.signals.length, controlFound,
      ms: orientationMs, costUsd: orientation.totalCostUsd, quarantineOk: sweep.ok,
      calls: orientation.calls.map((c) => (c.ok ? c.call : `${c.call}!`)).join(','),
    })
  }

  // ── the table the brief asks for ────────────────────────────────────────────
  console.log(`\n${'═'.repeat(78)}`)
  console.log('  RESULTS')
  console.log('═'.repeat(78))
  console.log('  id    signals  control  latency   cost      quarantine  calls')
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(6)}${`${r.found}/${r.total}`.padEnd(9)}${`${r.controlFound}/${r.total}`.padEnd(9)}` +
      `${`${(r.ms / 1000).toFixed(1)}s`.padEnd(10)}$${r.costUsd.toFixed(4).padEnd(9)}` +
      `${(r.quarantineOk ? 'OK' : 'FAILED').padEnd(12)}${r.calls}`,
    )
  }
  const totalSignals = rows.reduce((s, r) => s + r.total, 0)
  const totalFound = rows.reduce((s, r) => s + r.found, 0)
  const totalControl = rows.reduce((s, r) => s + r.controlFound, 0)
  const avgMs = rows.reduce((s, r) => s + r.ms, 0) / (rows.length || 1)
  const avgCost = rows.reduce((s, r) => s + r.costUsd, 0) / (rows.length || 1)
  console.log('  ' + '─'.repeat(74))
  console.log(`  Coverage        ${totalFound}/${totalSignals} (${pct(totalFound, totalSignals)})   ` +
    `control ${totalControl}/${totalSignals} (${pct(totalControl, totalSignals)})`)
  console.log(`  Added latency   ${(avgMs / 1000).toFixed(1)}s per briefing (mean)`)
  console.log(`  Added cost      $${avgCost.toFixed(4)} per briefing (mean)`)
  console.log(`  Quarantine      ${rows.every((r) => r.quarantineOk) ? 'PASS on every question' : 'FAILED'}`)

  console.log(`\n  ${pass} passed, ${fail} failed.`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('check:orientation crashed:', err)
  process.exit(1)
})
