/**
 * measure-s30-noise.ts - SEARCH-30 (CCh 22 Oct): is the noise filter's keep/drop decision stable? Runs orientation v2 on ONE idea N times,
 * filter ON, and separates the two things that can move between runs:
 *
 *   DECISION  - for an X post that comes back in more than one run (same URL), did it get the same tag? This is what SEARCH-30 fixed
 *               (the model tags at temperature 0; a pure rule drops). It should be ~100%.
 *   RETRIEVAL - did the live X search and the grounded web search return the same posts / sources at all? Not in our control; reported.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-s30-noise.ts --idea <id> [--runs 3] [--out s30-noise.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { enterBuildContext } from '../lib/lex/build-context'
import { elicitationContext } from '../lib/lex/elicitation'
import { testimonyBlock } from '../lib/lex/testimony'
import { runOrientationV2, type OrientationV2, type V2Argument } from '../lib/lex/orientation/v2'

const argv = process.argv.slice(2)
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
const OUT = path.join(__dirname, '../../docs/census', arg('out') ?? 's30-noise.json')
const RUNS = Number(arg('runs') ?? 3)

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'that', 'this', 'it', 'as', 'by', 'with', 'from', 'at', 'was', 'were', 'will', 'would', 'should', 'could', 'has', 'have', 'had', 'not', 'no', 'they', 'their', 'them', 'we', 'our', 'you', 'your'])
const toks = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i) }
const near = (a: V2Argument, list: V2Argument[]) => list.some((b) => jac(toks(a.claim + ' ' + a.reason), toks(b.claim + ' ' + b.reason)) >= 0.4)
const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m }, {})
const normUrl = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?(twitter|x)\.com/, 'x.com').replace(/[?#].*$/, '').replace(/\/$/, '')

async function main() {
  const id = arg('idea'); if (!id) throw new Error('--idea <id>')
  const idea = await prisma.idea.findUnique({ where: { id }, select: { id: true, title: true, creatorId: true } })
  if (!idea) throw new Error(`${id} not found`)
  const ctx = await elicitationContext(id, idea.creatorId)
  const input = ctx ? testimonyBlock(ctx, 6000) : ''
  if (!input) throw new Error('no input text')
  enterBuildContext({ userId: idea.creatorId, ideaId: id, buildId: null, step: 'orientation-v2', purpose: 'measurement' } as any)
  console.log(`=== ${id} "${idea.title}" input ${input.length} chars, ${RUNS} runs, filter ON, X temperature ${process.env.ORIENTATION_X_TEMPERATURE ?? '0'}`)

  const runs: OrientationV2[] = []
  for (let r = 1; r <= RUNS; r++) {
    const o = await runOrientationV2({ input, noiseFilter: true })
    runs.push(o)
    const x = o.calls.find((c) => c.call === 'v2-x')
    console.log(`run ${r}: kept ${o.arguments.length} (web ${o.arguments.filter((a) => a.source.tier === 'B').length}, X ${o.arguments.filter((a) => a.source.tier === 'C').length}) · dropped ${o.dropped.length} ${JSON.stringify(count(o.dropped, (d) => d.reason))} · X posts tagged ${o.xTags?.length ?? 0} ${JSON.stringify(count(o.xTags ?? [], (t) => t.kind))} · postsFetched ${x?.postsFetched ?? '-'} · ${(o.totalCostUsd * 100 / 1.27).toFixed(1)}p est · ${(o.totalMs / 1000).toFixed(0)}s${o.failed ? ' FAILED' : ''}${x && !x.ok ? ` (X failed: ${x.reason})` : ''}`)
  }

  // DECISION stability: same URL in >= 2 runs -> same tag?
  const byUrl = new Map<string, string[]>()
  runs.forEach((o) => { const seen = new Set<string>(); for (const t of o.xTags ?? []) { const u = normUrl(t.url); if (!u || seen.has(u)) continue; seen.add(u); byUrl.set(u, [...(byUrl.get(u) ?? []), t.kind]) } })
  const repeated = [...byUrl.entries()].filter(([, ks]) => ks.length >= 2)
  const agreed = repeated.filter(([, ks]) => ks.every((k) => k === ks[0]))
  const disagreements = repeated.filter(([, ks]) => !ks.every((k) => k === ks[0]))
  // RETRIEVAL stability: how many distinct X posts, and how many came back in every run
  const inAll = [...byUrl.values()].filter((ks) => ks.length === RUNS).length
  // OUTCOME: kept arguments with a near-match in every other run
  const keptStable = runs.map((o, i) => o.arguments.filter((a) => runs.every((p, j) => j === i || near(a, p.arguments))).length)

  console.log('\n--- DECISION (what SEARCH-30 changed)')
  console.log(`X posts returned in >=2 runs: ${repeated.length}; same tag every time: ${agreed.length} (${repeated.length ? Math.round(100 * agreed.length / repeated.length) : '-'}%)`)
  for (const [u, ks] of disagreements) console.log(`   DIFFERENT TAGS ${ks.join(' / ')}  ${u}`)
  console.log('--- RETRIEVAL (live search; not in our control)')
  console.log(`distinct X posts across runs: ${byUrl.size}; returned in all ${RUNS} runs: ${inAll}`)
  console.log('--- OUTCOME')
  console.log(`kept per run: ${runs.map((o) => o.arguments.length).join(' / ')}; dropped per run: ${runs.map((o) => o.dropped.length).join(' / ')}`)
  console.log(`kept arguments with a near-match in every other run: ${keptStable.join(' / ')}`)

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), ideaId: id, title: idea.title, runs: RUNS, xTemperature: process.env.ORIENTATION_X_TEMPERATURE ?? '0',
    perRun: runs.map((o) => ({ kept: o.arguments.length, dropped: o.dropped.length, droppedByReason: count(o.dropped, (d) => d.reason), xTags: o.xTags, calls: o.calls, costUsd: o.totalCostUsd, ms: o.totalMs })),
    decision: { repeated: repeated.length, agreed: agreed.length, disagreements }, retrieval: { distinctXPosts: byUrl.size, inAllRuns: inAll }, keptStable }, null, 1))
  console.log(`\n-> ${OUT}`)
  await new Promise((r) => setTimeout(r, 3000))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
