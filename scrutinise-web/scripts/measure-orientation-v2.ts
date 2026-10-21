/**
 * measure-orientation-v2.ts - SEARCH-29 stage 1. Does orientation v2 produce arguments and vocabulary on a REAL idea, what does the
 * noise filter remove, and what does it cost?
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-orientation-v2.ts --list
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-orientation-v2.ts --ideas <id>,<id> [--out s29-orientation-v2.json]
 *
 * For each idea: the user's input is built exactly as the build's ORIENT pass builds it (`testimonyBlock(elicitationContext(...))`), stage 1 is run
 * with the noise filter ON and again with it OFF, and spend is attributed to the idea so the ledger rows can be read back. What the filter "removes"
 * is reported two ways and they are not the same thing: the model's own LOGGED drops (filter ON), and arguments the OFF run found that the ON run
 * has no near-match for. The second includes run-to-run variance, which is stated, not hidden.
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { enterBuildContext } from '../lib/lex/build-context'
import { elicitationContext } from '../lib/lex/elicitation'
import { testimonyBlock } from '../lib/lex/testimony'
import { runOrientationV2, termsForSearch, type OrientationV2, type V2Argument } from '../lib/lex/orientation/v2'

const argv = process.argv.slice(2)
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
const OUT = path.join(__dirname, '../../docs/census', arg('out') ?? 's29-orientation-v2.json')

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'be', 'that', 'this', 'it', 'as', 'by', 'with', 'from', 'at', 'was', 'were', 'will', 'would', 'should', 'could', 'has', 'have', 'had', 'not', 'no', 'they', 'their', 'them', 'we', 'our', 'you', 'your'])
const toks = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
const jac = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i) }
const near = (a: V2Argument, list: V2Argument[]) => list.some((b) => jac(toks(a.claim + ' ' + a.reason), toks(b.claim + ' ' + b.reason)) >= 0.4)

function summary(o: OrientationV2) {
  const by = (f: (a: V2Argument) => string) => o.arguments.reduce<Record<string, number>>((m, a) => { const k = f(a); m[k] = (m[k] ?? 0) + 1; return m }, {})
  return {
    ok: !o.failed, ms: o.totalMs, costUsd: Number(o.totalCostUsd.toFixed(4)),
    arguments: o.arguments.length, bySide: by((a) => a.side), byTier: by((a) => a.source.tier),
    undated: o.arguments.filter((a) => a.undated).length, unverifiedSource: o.arguments.filter((a) => !a.source.verified).length,
    merged: o.merged, dropped: o.dropped.length, droppedByReason: o.dropped.reduce<Record<string, number>>((m, d) => { m[d.reason] = (m[d.reason] ?? 0) + 1; return m }, {}),
    vocabulary: Object.fromEntries(Object.entries(o.vocabulary).map(([k, v]) => [k, v.length])),
    xPosts: o.calls.find((c) => c.call === 'v2-x')?.postsFetched ?? null, xCapExceeded: o.xCapExceeded,
    calls: o.calls.map((c) => ({ call: c.call, ok: c.ok, ms: c.ms, costUsd: c.costUsd, reason: c.reason })),
  }
}

async function main() {
  if (argv.includes('--list')) {
    const ideas = await prisma.idea.findMany({ where: { deletedAt: null }, select: { id: true, title: true, creatorId: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 40 })
    for (const i of ideas) {
      const ctx = await elicitationContext(i.id, i.creatorId).catch(() => null)
      const len = ctx ? testimonyBlock(ctx, 6000).length : 0
      if (len > 150) console.log(`${i.id}  input=${String(len).padStart(5)} chars  ${i.updatedAt.toISOString().slice(0, 10)}  ${(i.title ?? '').slice(0, 70)}`)
    }
    await prisma.$disconnect(); return
  }
  const ids = (arg('ideas') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!ids.length) throw new Error('--ideas <id>,<id> or --list')
  const report: any[] = []
  for (const id of ids) {
    const idea = await prisma.idea.findUnique({ where: { id }, select: { id: true, title: true, creatorId: true } })
    if (!idea) { console.log(`${id}: not found`); continue }
    const ctx = await elicitationContext(id, idea.creatorId)
    const input = ctx ? testimonyBlock(ctx, 6000) : ''
    if (!input) { console.log(`${id}: no input text`); continue }
    enterBuildContext({ userId: idea.creatorId, ideaId: id, buildId: null, step: 'orientation-v2', purpose: 'measurement' } as any)
    const since = new Date()
    console.log(`\n=== ${id}  "${(idea.title ?? '').slice(0, 60)}"  input ${input.length} chars`)
    console.log(`    input begins: ${input.slice(0, 200).replace(/\s+/g, ' ')}`)
    const on = await runOrientationV2({ input, noiseFilter: true })
    const off = await runOrientationV2({ input, noiseFilter: false })
    const onSum = summary(on), offSum = summary(off)
    const onlyInOff = off.arguments.filter((a) => !near(a, on.arguments))
    const onlyInOn = on.arguments.filter((a) => !near(a, off.arguments))
    console.log('  FILTER ON :', JSON.stringify(onSum))
    console.log('  FILTER OFF:', JSON.stringify(offSum))
    console.log(`  OFF-only arguments (no near match in the ON run): ${onlyInOff.length}; ON-only: ${onlyInOn.length}  (the ON-only count is run-to-run variance, not the filter)`)
    for (const a of onlyInOff.slice(0, 6)) console.log(`     [${a.source.tier} ${a.side}] ${a.claim.slice(0, 140)}  — reason: ${a.reason.slice(0, 80) || '(none)'}`)
    console.log(`  LOGGED DROPS (filter ON): ${on.dropped.length}`)
    for (const d of on.dropped.slice(0, 8)) console.log(`     [${d.reason}] ${d.what.slice(0, 140)}`)
    console.log('  VOCABULARY (ON):', JSON.stringify(on.vocabulary).slice(0, 600))
    console.log('  stage-2 terms:', termsForSearch(on).join('; '))
    await new Promise((r) => setTimeout(r, 3000)) // let the fire-and-forget ledger writes land
    const rows: any[] = await prisma.$queryRaw`SELECT pass, model, failed, "toolCalls", "postsFetched", round("estCostPence"::numeric,3)::text pence, purpose FROM "LlmSpend" WHERE "ideaId" = ${id} AND "createdAt" >= ${since} AND pass LIKE 'orientation.%' ORDER BY "createdAt"`
    console.log(`  LEDGER ROWS for this idea since the run began: ${rows.length}`)
    for (const r of rows) console.log('     ', JSON.stringify(r))
    report.push({ ideaId: id, title: idea.title, inputChars: input.length, on: { summary: onSum, result: on }, off: { summary: offSum, result: off }, onlyInOff: onlyInOff.map((a) => ({ side: a.side, tier: a.source.tier, claim: a.claim, reason: a.reason })), ledgerRows: rows })
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), report }, null, 1))
  console.log(`\n-> ${OUT}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
