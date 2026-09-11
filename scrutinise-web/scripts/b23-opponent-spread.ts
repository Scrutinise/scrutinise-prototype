export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B23 §1 — THE OPPONENT PASS, THREE RUNS, AND THE SPREAD.
//
// "49 routes, none closed" was printed off ONE run of a pass that is not deterministic. This
// reads the per-measure exports of three unhinted runs (`B23_OPPONENT_M-XX.md`, `_run2.md`,
// `_run3.md`) and reports, per run and combined: routes found, the closes / partly / does-not-
// close / makes-it-worse split, how much the categories moved between runs, and how many
// measures had every route open each time. ⚠ Routes are matched across runs by mechanism and
// title-word overlap — a coarse pairing, named as such, because the pass does not number its
// routes stably and two runs describe the same attack in different words.
//
// Reads markdown, not JSON: runs 2 and 3 were written before the JSON export existed.
//
//   npx tsx scripts/b23-opponent-spread.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const DIR = join(__dirname, '../../docs/report_run/critique')
const OUT = join(__dirname, '../../docs/report_run/critique/OPPONENT_three_runs.md')
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)
const RUNS = [{ n: 1, suffix: '' }, { n: 2, suffix: '_run2' }, { n: 3, suffix: '_run3' }]

type Verdict = 'CLOSES' | 'PARTLY' | 'DOES_NOT_CLOSE' | 'MAKES_IT_WORSE'
const VERDICTS: Verdict[] = ['CLOSES', 'PARTLY', 'DOES_NOT_CLOSE', 'MAKES_IT_WORSE']
const LABEL: Record<Verdict, string> = { CLOSES: 'closes', PARTLY: 'partly', DOES_NOT_CLOSE: 'does not close', MAKES_IT_WORSE: 'makes it worse' }

interface Route { title: string; mechanism: string; verdict: Verdict; restsOn: string }
interface Run { ref: string; run: number; title: string; at: string; routes: Route[]; strongHit: boolean; failed: boolean }

function verdictOf(cell: string): Verdict {
  if (cell.includes('makes it worse')) return 'MAKES_IT_WORSE'
  if (cell.includes('does NOT close')) return 'DOES_NOT_CLOSE'
  if (cell.includes('partly')) return 'PARTLY'
  if (cell.includes('closes it')) return 'CLOSES'
  throw new Error(`unreadable verdict cell: ${cell}`)
}

const STRONG = ['osborn', 'kennedy', 'unison', 'a v bbc']

function parse(ref: string, run: number, suffix: string): Run | null {
  const file = join(DIR, `B23_OPPONENT_${ref}${suffix}.md`)
  if (!existsSync(file)) return null
  const text = readFileSync(file, 'utf8')
  const title = (text.match(/^# M-\d\d — (.*)$/m) ?? [])[1] ?? ref
  const at = (text.match(/^\*(\d{4}-\d\d-\d\d \d\d:\d\d) UTC/m) ?? [])[1] ?? '?'
  const failed = text.includes('The pass did not complete')
  const routes: Route[] = []
  // The summary table: | n | route | `MECH` | verdict |
  for (const m of text.matchAll(/^\| (\d+) \| (.*?) \| `([A-Z_]+)` \| (.*?) \|$/gm)) {
    routes.push({ title: m[2].trim(), mechanism: m[3], verdict: verdictOf(m[4]), restsOn: '' })
  }
  // Rests-on lines, in order, one per route section.
  const rests = [...text.matchAll(/^\*\*Rests on:\*\* (.*)$/gm)].map((m) => m[1])
  rests.forEach((r, i) => { if (routes[i]) routes[i].restsOn = r })
  // The pass's own words only: strip the boilerplate header and footer before scanning for markers.
  const body = text.split('## Read by a prepared opponent')[1]?.split('⚠ **`restsOn` may name')[0] ?? ''
  const strongHit = STRONG.some((s) => body.toLowerCase().includes(s))
  return { ref, run, title, at, routes, strongHit, failed }
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3))
function jaccard(a: string, b: string): number {
  const A = words(a), B = words(b)
  const inter = [...A].filter((w) => B.has(w)).length
  const union = new Set([...A, ...B]).size
  return union ? inter / union : 0
}

/** Pair each route of `a` with its best match in `b` (same mechanism preferred, then title overlap ≥ 0.25). */
function pair(a: Route[], b: Route[]): Array<{ a: Route; b: Route | null; score: number }> {
  const used = new Set<number>()
  return a.map((ra) => {
    let best = -1, bestScore = 0
    b.forEach((rb, i) => {
      if (used.has(i)) return
      const s = jaccard(ra.title, rb.title) + (ra.mechanism === rb.mechanism ? 0.25 : 0)
      if (s > bestScore) { bestScore = s; best = i }
    })
    if (best >= 0 && bestScore >= 0.35) { used.add(best); return { a: ra, b: b[best], score: bestScore } }
    return { a: ra, b: null, score: bestScore }
  })
}

function tally(routes: Route[]): Record<Verdict, number> {
  const t: Record<Verdict, number> = { CLOSES: 0, PARTLY: 0, DOES_NOT_CLOSE: 0, MAKES_IT_WORSE: 0 }
  for (const r of routes) t[r.verdict]++
  return t
}
const open = (r: Route) => r.verdict === 'DOES_NOT_CLOSE' || r.verdict === 'MAKES_IT_WORSE'

function main() {
  const runs: Run[][] = RUNS.map((R) => ALL.map((ref) => parse(ref, R.n, R.suffix)).filter((x): x is Run => !!x))
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const L: string[] = []
  L.push('# The prepared opponent — three runs, and the spread (CCW-B23 §1)')
  L.push('')
  L.push(`*${stamp} UTC · \`scripts/b23-opponent-spread.ts\` over \`B23_OPPONENT_M-XX.md\`, \`_run2.md\`, \`_run3.md\` — all unhinted, persona only, \`gemini-2.5-pro\`.*`)
  L.push('')
  L.push('The 10 September finding — *49 routes, the plan closes none* — came from one run of a pass that is not')
  L.push('deterministic. Two more runs across the twelve, same prompt, same model, same inputs. What holds across')
  L.push('three is publishable; what moves is printed as a range.')
  L.push('')

  // ── per run ──
  L.push('## Per run')
  L.push('')
  L.push('| Run | When | Measures | Routes | closes | partly | does not close | makes it worse | Measures with every route open | Named a migration case |')
  L.push('|---|---|---|---|---|---|---|---|---|---|')
  const allOpenPerRun: string[][] = []
  for (const rs of runs) {
    const routes = rs.flatMap((r) => r.routes)
    const t = tally(routes)
    const allOpen = rs.filter((r) => r.routes.length && r.routes.every(open)).map((r) => r.ref)
    allOpenPerRun.push(allOpen)
    const when = rs.map((r) => r.at).sort()
    L.push(`| ${rs[0].run} | ${when[0]}–${when[when.length - 1].slice(11)} | ${rs.length}${rs.some((r) => r.failed) ? ` (${rs.filter((r) => r.failed).length} failed)` : ''} | **${routes.length}** | **${t.CLOSES}** | ${t.PARTLY} | ${t.DOES_NOT_CLOSE} | ${t.MAKES_IT_WORSE} | ${allOpen.length} (${allOpen.join(', ')}) | ${rs.filter((r) => r.strongHit).map((r) => r.ref).join(', ') || '—'} |`)
  }
  L.push('')

  // ── combined ──
  const totals = runs.map((rs) => rs.flatMap((r) => r.routes).length)
  const tallies = runs.map((rs) => tally(rs.flatMap((r) => r.routes)))
  const range = (k: Verdict) => { const v = tallies.map((t) => t[k]); return `${Math.min(...v)}–${Math.max(...v)}` }
  const closesHeld = tallies.every((t) => t.CLOSES === 0)
  L.push('## Combined')
  L.push('')
  L.push(`- **Routes found:** ${Math.min(...totals)}–${Math.max(...totals)} per run (${totals.join(' / ')}); ${totals.reduce((a, b) => a + b, 0)} readings over three runs.`)
  L.push(`- **closes:** ${range('CLOSES')} · **partly:** ${range('PARTLY')} · **does not close:** ${range('DOES_NOT_CLOSE')} · **makes it worse:** ${range('MAKES_IT_WORSE')}`)
  L.push(`- **Routes left open (does not close + makes it worse):** ${tallies.map((t) => t.DOES_NOT_CLOSE + t.MAKES_IT_WORSE).join(' / ')} of ${totals.join(' / ')} — ${tallies.map((t, i) => `${Math.round(100 * (t.DOES_NOT_CLOSE + t.MAKES_IT_WORSE) / totals[i])}%`).join(' / ')}.`)
  L.push(`- **Measures with every route open:** ${allOpenPerRun.map((a) => a.length).join(' / ')} of 12 per run. Every run: ${ALL.filter((m) => allOpenPerRun.every((a) => a.includes(m))).join(', ') || '—'}. At least one run: ${ALL.filter((m) => allOpenPerRun.some((a) => a.includes(m))).join(', ') || '—'}.`)
  L.push('')
  L.push(closesHeld
    ? '▶▶ **"closes: 0" holds across all three runs.** No route, on any measure, in any of the ' +
      `${totals.reduce((a, b) => a + b, 0)} readings, was judged fully closed by the plan. That is the finding the report can print.`
    : `⚠⚠ **"closes: 0" does NOT hold.** The closes count was ${tallies.map((t) => t.CLOSES).join(' / ')} across the three runs. The report prints the range and says the measurement is unstable.`)
  L.push('')
  L.push('⚠ What moves is the split between *partly* and *does not close* and between *does not close* and *makes it')
  L.push('worse* — the boundary calls — and the exact count of routes. What does not move is the top line.')
  L.push('')

  // ── per measure ──
  L.push('## Per measure, three runs side by side')
  L.push('')
  L.push('*Cells are routes: closes / partly / does not close / makes it worse. "All open" = no route judged closes or partly.*')
  L.push('')
  L.push('| Measure | Run 1 | Run 2 | Run 3 | All open in | Migration case named in |')
  L.push('|---|---|---|---|---|---|')
  for (const ref of ALL) {
    const cells = runs.map((rs) => rs.find((r) => r.ref === ref))
    const fmt = (r?: Run) => r ? (r.failed ? '⚠ failed' : `${r.routes.length}: ${VERDICTS.map((v) => tally(r.routes)[v]).join('/')}`) : '—'
    const allOpenIn = cells.map((r, i) => r && r.routes.length && r.routes.every(open) ? String(i + 1) : null).filter(Boolean)
    const strong = cells.map((r, i) => r?.strongHit ? String(i + 1) : null).filter(Boolean)
    L.push(`| ${ref} — ${cells[0]?.title ?? ''} | ${fmt(cells[0])} | ${fmt(cells[1])} | ${fmt(cells[2])} | ${allOpenIn.length ? `runs ${allOpenIn.join(', ')}` : '—'} | ${strong.length ? `runs ${strong.join(', ')}` : '—'} |`)
  }
  L.push('')

  // ── route-level movement ──
  L.push('## How much the categories moved, route by route')
  L.push('')
  L.push('*Run 1 routes paired with runs 2 and 3 by mechanism and title-word overlap (Jaccard ≥ 0.35 with a 0.25 bonus for the same mechanism). A coarse pairing: an unpaired route is one the later run described differently or did not raise, not necessarily a new attack.*')
  L.push('')
  L.push('| Measure | Run 1 route | Mechanism | Run 1 | Run 2 (paired) | Run 3 (paired) |')
  L.push('|---|---|---|---|---|---|')
  let paired = 0, same = 0, moved = 0, unpaired = 0
  const moves: Record<string, number> = {}
  for (const ref of ALL) {
    const r1 = runs[0].find((r) => r.ref === ref); if (!r1) continue
    const p2 = pair(r1.routes, runs[1].find((r) => r.ref === ref)?.routes ?? [])
    const p3 = pair(r1.routes, runs[2].find((r) => r.ref === ref)?.routes ?? [])
    r1.routes.forEach((route, i) => {
      const cell = (p: { b: Route | null }) => {
        if (!p.b) { unpaired++; return '— (no pair)' }
        paired++
        if (p.b.verdict === route.verdict) { same++; return `${LABEL[p.b.verdict]} (=)` }
        moved++; const k = `${LABEL[route.verdict]} → ${LABEL[p.b.verdict]}`; moves[k] = (moves[k] ?? 0) + 1
        return `**${LABEL[p.b.verdict]}** (moved)`
      }
      L.push(`| ${ref} | ${route.title.slice(0, 90).replace(/\|/g, '\\|')} | \`${route.mechanism}\` | ${LABEL[route.verdict]} | ${cell(p2[i])} | ${cell(p3[i])} |`)
    })
  }
  L.push('')
  L.push(`**${paired} of ${paired + unpaired} pairing attempts** (each run-1 route against run 2 and against run 3) found a route in the later run: **${same} kept the same verdict, ${moved} moved**; ${unpaired} found no pair — the later run raised a differently-described attack, and that unpaired share is itself a measure of how much the pass's *wording* moves even where its verdicts do not.`)
  if (Object.keys(moves).length) {
    L.push('')
    L.push('Movements, by direction:')
    L.push('')
    for (const [k, n] of Object.entries(moves).sort((a, b) => b[1] - a[1])) L.push(`- ${k}: ${n}`)
  }
  L.push('')
  const anyToCloses = Object.keys(moves).some((k) => k.endsWith('→ closes'))
  L.push(anyToCloses
    ? '⚠ At least one route moved INTO *closes* on a later run — see above; the headline must carry the range.'
    : '▶ **No paired route moved into *closes* on any later run.** The movement is between the three open-ish categories.')
  L.push('')

  // ── mechanisms ──
  L.push('## Mechanisms, per run')
  L.push('')
  const mechs = Array.from(new Set(runs.flatMap((rs) => rs.flatMap((r) => r.routes.map((x) => x.mechanism))))).sort()
  L.push(`| Mechanism | ${RUNS.map((R) => `Run ${R.n}`).join(' | ')} |`)
  L.push(`|---|${RUNS.map(() => '---').join('|')}|`)
  for (const m of mechs) L.push(`| \`${m}\` | ${runs.map((rs) => rs.flatMap((r) => r.routes).filter((x) => x.mechanism === m).length).join(' | ')} |`)
  L.push('')

  L.push('---')
  L.push('')
  L.push('⚠ **Every `restsOn` citation in all three runs still needs checking before it is quoted** — the prompt asks')
  L.push('for a doctrine rather than an invented citation, and that is an instruction, not a guarantee. Three runs')
  L.push('agreeing on a verdict says nothing about whether the authority a route rests on exists.')
  L.push('')
  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`written: ${OUT}`)
  runs.forEach((rs, i) => { const t = tally(rs.flatMap((r) => r.routes)); console.log(`run ${i + 1}: ${rs.flatMap((r) => r.routes).length} routes`, t, 'all-open', allOpenPerRun[i].length) })
  console.log(`paired ${paired} same ${same} moved ${moved} unpaired ${unpaired}`, moves)
}

main()
