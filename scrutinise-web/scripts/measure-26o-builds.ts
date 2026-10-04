// ─────────────────────────────────────────────────────────────────────────────
// measure-26o-builds — BRIEF_26O §6 + CCh follow-up item 4: a REAL build on a SCRATCH COPY of a real idea, on a chosen
// model arm, with the retrieval stack the Railway worker uses. Prints what the build cost, how long it took, what it
// found, and saves the kernel it wrote so it can be laid beside another arm's.
//
//   $env:LEX_BUILD_DRIVER='worker'; npx tsx --env-file=.env scripts/measure-26o-builds.ts 452c5ade flash38|default <outfile.json>
//
// ⚠⚠ SPENDS REAL MONEY (~30–60p a build). It runs on a COPY (scripts/lib/scratch-copy.ts) and deletes it in a `finally`;
// the original idea is never written.
// ⚠ ONE VARIABLE. Both arms run THIS working tree's code with the worker's retrieval configuration (read off Railway on
// 4 Oct) — only the model environment differs. `flash38` points EVERY Gemini pass at gemini-3.8-flash (the build passes,
// the verification and repair passes, the SMART critique, the research passes); the SMART panel's outside Claude member
// is left in place, because the panel exists for vendor divergence and removing it would change the experiment twice.
// ⚠ THE RACE. The Railway `build-worker` polls every 5s. This enqueues and claims in the same breath, as
// b18-run-build-locally.ts does; if the worker wins, this STOPS and says so rather than reporting a build that ran on the
// wrong code and model.

import { writeFileSync } from 'node:fs'

const IDEA = process.argv[2]
const ARM = process.argv[3] as 'flash38' | 'default'
const OUT = process.argv[4]
if (!IDEA || !['flash38', 'default'].includes(ARM) || !OUT) { console.error('usage: measure-26o-builds.ts <ideaPrefix> flash38|default <out.json>'); process.exit(2) }

// the worker's configuration, read off Railway 4 Oct 2026 (scripts/b18-retrieval-preflight.ts)
process.env.FTS_SEARCH_URL = 'https://fts-serve-production-4cea.up.railway.app'
process.env.VECTOR_SEARCH_URL = 'https://vector-serve-production.up.railway.app'
process.env.LEX_VECTOR_STREAMS = 'caselaw,committees,debates,guidance,legislation'
process.env.LEX_QUERY_ROUTER = '1'
if (ARM === 'flash38') {
  const m = 'gemini-3.8-flash'
  process.env.LEX_BUILD_MODEL = m
  for (const k of ['REPAIR', 'SMART', 'VERIFY']) process.env[`LEX_BUILD_MODEL_${k}`] = m
  process.env.LEX_BUILD_SMART_MODELS = `${m},claude-sonnet-5`
  process.env.LEX_DEEPENING_MODEL = m
  process.env.LEX_SIFT_MODEL = m
  process.env.QUERY_EXPANSION_MODEL = m
}

import { prisma } from '../lib/prisma'
import { claimBuild, claimQueuedBuild, runBuildToCompletion } from '../lib/lex/build'
import { DEFAULT_FRAMING } from '../lib/lex/build-config'
import { assertRetrievalConfig } from '../lib/lex/harness-preflight'
import { priceBuild } from '../lib/lex/build-cost'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const KERNEL_KEYS = ['title', 'challenge', 'whoAffectedImpactCost', 'rootCause', 'pivotalObstacle', 'summaryDiagnosis', 'chosenApproach', 'whatItRulesOut', 'leverage', 'conditionsForSuccess', 'summaryGuidingPolicy', 'summaryCoherentActions']

async function main() {
  assertRetrievalConfig(`26o ${ARM} ${IDEA}`)
  const copy = await scratchCopy(IDEA, `${ARM}`)
  // The copy carries the SOURCE's kernel, which a build would read as "already there". A build is measured from the
  // idea's INPUTS (title, summary, elicitation) — so the derived rows are cleared first.
  await prisma.ideaFieldState.deleteMany({ where: { ideaId: copy.id } })
  await prisma.diagnosisCause.deleteMany({ where: { ideaId: copy.id } })
  await prisma.policyOption.deleteMany({ where: { ideaId: copy.id } })
  await prisma.lexCoherentAction.deleteMany({ where: { ideaId: copy.id } })
  await prisma.idea.update({ where: { id: copy.id }, data: { chosenApproach: null, rootCause: null, pivotalObstacle: null, summaryDiagnosis: null, summaryGuidingPolicy: null, summaryCoherentActions: null, whatItRulesOut: null, leverage: null, conditionsForSuccessLex: null } as never })
  console.log(`[26o] scratch copy ${copy.id.slice(0, 8)} (${ARM}) of ${IDEA} — derived rows cleared; inputs kept`)

  try {
    const buildId = await claimBuild(copy.id, DEFAULT_FRAMING, false, 'FULL')
    if (!(await claimQueuedBuild(buildId))) {
      console.error('⚠⚠ THE RAILWAY WORKER CLAIMED IT FIRST — this build did NOT run on this working tree / model arm. Not reported.')
      writeFileSync(OUT, JSON.stringify({ arm: ARM, idea: IDEA, error: 'worker claimed the build first' }, null, 1))
      return
    }
    const t0 = Date.now()
    const view = await runBuildToCompletion(copy.id, copy.userId, buildId)
    const seconds = Math.round((Date.now() - t0) / 1000)

    const row = await prisma.ideaBuild.findUniqueOrThrow({ where: { id: buildId }, select: { passes: true, tokensIn: true, tokensOut: true, estCostPence: true, status: true } })
    const passes = row.passes as Array<{ key: string; status: string; output?: string; usages?: Array<{ model: string; tokensIn: number; tokensOut: number; tokensCached?: number }> }>
    const usages = passes.flatMap((p) => p.usages ?? [])
    const jan = priceBuild(usages as never, new Date('2027-01-15T00:00:00Z'))
    const now = priceBuild(usages as never, new Date())
    const kc = passes.find((p) => p.key === 'KERNEL_CHECK')?.output ?? null
    const km = kc?.match(/(\d+) of (\d+) kernel tests passed/)
    const evidence = await prisma.evidenceItem.findMany({ where: { ideaId: copy.id }, select: { kind: true, sourceId: true, citation: true, url: true, sourceType: true } })
    const findings = evidence.filter((e) => e.kind === 'FINDING')
    const traceable = findings.filter((e) => e.sourceId && e.citation).length
    const fields = await prisma.ideaFieldState.findMany({ where: { ideaId: copy.id, fieldKey: { in: KERNEL_KEYS } }, select: { fieldKey: true, value: true, proposal: true } })
    const text = (f: { value: unknown; proposal: unknown }) => {
      const p = (f.proposal as { value?: unknown } | null)?.value
      const v = (typeof f.value === 'string' && f.value.trim()) ? f.value : p
      return typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v)
    }
    const kernel: Record<string, string> = {}
    for (const k of KERNEL_KEYS) { const f = fields.find((x) => x.fieldKey === k); if (f) kernel[k] = text(f) }
    const causes = await prisma.diagnosisCause.findMany({ where: { ideaId: copy.id }, select: { cause: true, classification: true, isRootCause: true } })
    const actions = await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id }, select: { practicalStep: true, whoImplements: true } })

    const result = {
      arm: ARM, idea: IDEA, status: row.status, seconds, passes: `${view.passesComplete}/${view.passesTotal}`,
      tokensIn: row.tokensIn, tokensOut: row.tokensOut, rowEstCostPence: row.estCostPence == null ? null : Number(row.estCostPence),
      costPenceAtTodaysRates: now.pence, costPenceAtJan2027Rates: jan.pence, unpriced: jan.unpriced,
      byModel: Object.entries(usages.reduce((a: Record<string, { in: number; out: number; calls: number }>, u) => { const x = (a[u.model] ??= { in: 0, out: 0, calls: 0 }); x.in += u.tokensIn; x.out += u.tokensOut; x.calls++; return a }, {})),
      kernelCheck: km ? { passed: Number(km[1]), of: Number(km[2]) } : { raw: kc },
      findings: findings.length, findingsTraceable: traceable, evidenceTotal: evidence.length,
      passOutputs: passes.map((p) => `${p.key}: ${p.status}${p.output ? ' — ' + p.output.slice(0, 120) : ''}`),
      kernel, causes, actions,
    }
    writeFileSync(OUT, JSON.stringify(result, null, 1))
    console.log(`[26o] ${ARM} ${IDEA}: ${row.status} · ${seconds}s · ${view.passesComplete}/${view.passesTotal} passes · row ${result.rowEstCostPence}p · Jan-2027 ${jan.pence}p · kernel check ${km ? km[1] + '/' + km[2] : '?'} · findings ${findings.length}`)
  } finally {
    const hard = await deleteScratch(copy.id)
    console.log(`[26o] scratch copy ${copy.id.slice(0, 8)} ${hard ? 'deleted' : 'soft-deleted'}`)
    await prisma.$disconnect()
  }
}
main().catch((e) => { console.error('ERROR', e); process.exit(1) })
