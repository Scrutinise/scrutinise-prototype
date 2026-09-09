// ─────────────────────────────────────────────────────────────────────────────
// B18 — WAIT FOR ONE BUILD ROW TO SETTLE, AND SAY WHETHER IT ACTUALLY RETRIEVED.
//
// ⚠⚠ THE SECOND HALF IS THE POINT. M-01 v2 reported DONE with 11 of 11 passes on a
// configuration where eighteen searches returned nothing, and no number anywhere on the
// row recorded that. A build's own status cannot see its retrieval. So this reads the
// `served` counters off fts-serve and vector-serve BEFORE and AFTER and prints the delta
// beside the result: a zero delta on a build that claims to have researched is a finding,
// not a rounding error.
//
// ⚠ A RESTART RESETS THE COUNTER, so `started_at` is compared too — a negative delta is a
// redeploy, not negative use, and must never be reported as engagement.
//
// Read-only apart from the poll.
//
//   npx tsx --env-file=.env scripts/_b18-watch-build.ts <buildId> [--minutes 30]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const buildId = process.argv[2]
const MINUTES = Number(process.argv[process.argv.indexOf('--minutes') + 1]) || 30

const FTS = process.env.FTS_SEARCH_URL ?? 'https://fts-serve-production-4cea.up.railway.app'
const VEC = process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app'

type Counter = { served: number | null; startedAt: string | null; detail: string }

async function readCounter(url: string): Promise<Counter> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(`${url.replace(/\/$/, '')}/stats`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return { served: null, startedAt: null, detail: `HTTP ${res.status}` }
    const j = await res.json() as any
    return { served: typeof j.served === 'number' ? j.served : null, startedAt: j.started_at ?? null,
      detail: `served=${j.served} p95=${j.warm_p95_ms}ms queued=${j.concurrency?.queued}/${j.concurrency?.maxQueue}` }
  } catch (e) { return { served: null, startedAt: null, detail: e instanceof Error ? e.message : String(e) } }
}

function delta(name: string, before: Counter, after: Counter): string {
  if (before.served == null || after.served == null) return `${name}=UNREADABLE(${after.detail})`
  if (before.startedAt !== after.startedAt) return `${name}=RESTARTED mid-run (counter reset; delta unusable)`
  const d = after.served - before.served
  return `${name}+${d}${d === 0 ? '  ⚠⚠ NOT ENGAGED' : ''}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  if (!buildId) { console.error('usage: _b18-watch-build.ts <buildId> [--minutes N]'); process.exit(2) }

  const row0 = await prisma.ideaBuild.findUnique({
    where: { id: buildId },
    select: { id: true, ideaId: true, version: true, status: true, userCritique: true },
  })
  if (!row0) { console.error(`no build ${buildId}`); process.exit(2) }

  const idea = await prisma.idea.findUnique({ where: { id: row0.ideaId }, select: { title: true } })
  console.log(`── watching build ${buildId.slice(0, 8)} · v${row0.version} · ${idea?.title ?? '?'} ──`)
  console.log(`  critique on the row: ${row0.userCritique ? `${row0.userCritique.length} chars` : 'none'}`)

  const before = { fts: await readCounter(FTS), vec: await readCounter(VEC) }
  console.log(`  counters before: fts ${before.fts.detail} · vector ${before.vec.detail}`)

  const deadline = Date.now() + MINUTES * 60_000
  let last = ''
  let row = row0 as any
  while (Date.now() < deadline) {
    row = await prisma.ideaBuild.findUnique({
      where: { id: buildId },
      select: {
        id: true, version: true, status: true, passes: true, startedAt: true, completedAt: true,
        failureReason: true, summaryMessage: true, lastStopReason: true,
      },
    })
    const passes = Array.isArray(row?.passes) ? row.passes as any[] : []
    const done = passes.filter((p) => p?.status === 'DONE' || p?.status === 'SKIPPED').length
    const running = passes.find((p) => p?.status === 'RUNNING')
    const line = `${row?.status} ${done}/${passes.length}${running ? ` · ${running.key}${running.activity ? ` — ${running.activity}` : ''}` : ''}`
    if (line !== last) { console.log(`  ${new Date().toISOString().slice(11, 19)}  ${line}`); last = line }
    if (row && row.status !== 'QUEUED' && row.status !== 'RUNNING') break
    await sleep(20_000)
  }

  const after = { fts: await readCounter(FTS), vec: await readCounter(VEC) }

  const passes = Array.isArray(row?.passes) ? row.passes as any[] : []
  console.log(`\n── settled: ${row?.status} ──`)
  console.log(`  duration        : ${row?.startedAt && row?.completedAt
    ? Math.round((new Date(row.completedAt).getTime() - new Date(row.startedAt).getTime()) / 1000) + 's' : 'n/a'}`)
  console.log(`  failureReason   : ${row?.failureReason ?? '—'}`)
  console.log(`  lastStopReason  : ${row?.lastStopReason ?? '—'}`)
  for (const p of passes) {
    console.log(`    ${String(p.key).padEnd(18)} ${String(p.status).padEnd(11)} ${p.output ?? p.failureReason ?? ''}`)
  }

  // ── the engagement question, which the row itself cannot answer ──────────────
  console.log(`\n── did it retrieve? (served delta across the run) ──`)
  console.log(`  ${delta('fts', before.fts, after.fts)}   ${delta('vector', before.vec, after.vec)}`)

  // ── and what it has to show for it ──────────────────────────────────────────
  const ev = await prisma.evidenceItem.groupBy({
    by: ['kind'], where: { ideaId: row0.ideaId, runVersion: row?.version }, _count: { _all: true },
  }).catch(() => null)
  if (ev) {
    const total = ev.reduce((a, b) => a + b._count._all, 0)
    console.log(`  evidence rows at runVersion ${row?.version}: ${total}  (${ev.map((e) => `${e.kind}:${e._count._all}`).join(' · ')})`)
  }

  console.log(`\n  summary: ${(row?.summaryMessage ?? '').slice(0, 500)}`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
