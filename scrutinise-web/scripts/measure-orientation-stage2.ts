/**
 * measure-orientation-stage2.ts - SEARCH-29 stages 1 and 2 on REAL IDEAS: cost and time per stage, and what stage 2 found that the user's words alone did not.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/measure-orientation-stage2.ts --ideas <id>,<id>,… [--out s29-five-ideas.json]
 *
 * Per idea, exactly the build's ORIENT pass in miniature, under PRODUCTION'S flag string (/api/health), with spend attributed to the idea:
 *   1. stage 1  — runOrientationV2 on the user's full input (web + X, filter on)
 *   2. the opening query, written the way the build writes it (writeQueries)
 *   3. the corpus searches the build makes (BACKGROUND_BRIEFING + LEGAL_LANDSCAPE, merged, first 20):
 *        WITHOUT_1  the user's words only            ┐ two runs of the SAME arm = the noise floor. The router is an LLM call, so two identical
 *        WITHOUT_2  the user's words only            ┘ searches differ; a difference smaller than that is not a finding.
 *        WITH       the user's words + stage 1's terms (stage 2)
 *   "Found by stage 2" = in WITH's first 20 and in NEITHER WITHOUT run. "Lost" = in BOTH WITHOUT runs and not in WITH.
 * Cost and time per stage are read from the ledger / the clock, never estimated.
 */
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
const OUT = path.join(__dirname, '../../docs/census', arg('out') ?? 's29-five-ideas.json')

async function main() {
  // ⚠ production's flag string is set BEFORE any lib module is imported (CLAUDE.md §29.2: imports hoist, so a flag set after them is too late).
  const prod: any = await (await fetch('https://www.scrutinise.org/api/health')).json()
  if (!prod?.capabilities) throw new Error('/api/health unreadable — refusing to run under an unknown flag string (CLAUDE.md §19)')
  for (const [k, v] of Object.entries(prod.capabilities)) process.env[k] = v ? 'true' : 'false'
  process.env.LEX_VECTOR_STREAMS = (prod.retrieval?.vectorStreams ?? []).join(',')
  // the experiment's own switches, set explicitly: orientation v2 is what is being measured; the terms are handed over by this script, not by a flag
  process.env.LEX_WEB_ORIENTATION = 'true'

  const { prisma } = await import('../lib/prisma')
  const { enterBuildContext } = await import('../lib/lex/build-context')
  const { elicitationContext } = await import('../lib/lex/elicitation')
  const { testimonyBlock, testimonyForFacts } = await import('../lib/lex/testimony')
  const { frameQuery } = await import('../lib/lex/build-config')
  const { writeQueries, extractedQuery } = await import('../lib/lex/build-query')
  const { runOrientationV2, termsForSearch } = await import('../lib/lex/orientation/v2')
  const { runSearch } = await import('../lib/lex/search-gateway')

  const ids = (arg('ideas') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!ids.length) throw new Error('--ideas <id>,<id>,…')
  console.log(`production ${String(prod.commit).slice(0, 7)} flags ${JSON.stringify(prod.capabilities)}`)

  const ledger = async (ideaId: string, since: Date) => {
    await new Promise((r) => setTimeout(r, 2500)) // the ledger writes are fire-and-forget
    const rows: any[] = await prisma.$queryRaw`SELECT pass, count(*)::int n, round(sum("estCostPence")::numeric,3)::float pence FROM "LlmSpend" WHERE "ideaId" = ${ideaId} AND "createdAt" >= ${since} GROUP BY pass ORDER BY pass`
    return rows
  }
  const penceOf = (rows: any[], like: RegExp) => rows.filter((r) => like.test(r.pass)).reduce((a, r) => a + (r.pence ?? 0), 0)

  const report: any[] = []
  for (const id of ids) {
    const idea = await prisma.idea.findUnique({ where: { id }, select: { id: true, title: true, creatorId: true } })
    if (!idea) { console.log(`${id}: not found`); continue }
    const ctx = await elicitationContext(id, idea.creatorId)
    const input = ctx ? testimonyBlock(ctx, 6000) : ''
    const build = await prisma.ideaBuild.findFirst({ where: { ideaId: id }, orderBy: { createdAt: 'desc' }, select: { framing: true } })
    if (!ctx || !input || !build) { console.log(`${id}: ${!ctx ? 'no context' : !input ? 'no input text' : 'no build row (framing unknown)'} — skipped`); continue }
    const framed = frameQuery(build.framing as any, ctx)
    enterBuildContext({ userId: idea.creatorId, ideaId: id, buildId: null, step: 'stage2-measure', purpose: 'measurement' } as any)
    console.log(`\n=== ${id}  "${(idea.title ?? '').slice(0, 60)}"  input ${input.length} chars`)
    const rec: any = { ideaId: id, title: idea.title, inputChars: input.length }

    // stage 1
    let since = new Date(); let t0 = Date.now()
    const o = await runOrientationV2({ input, noiseFilter: true })
    rec.stage1 = { ms: Date.now() - t0, costPence: penceOf(await ledger(id, since), /^orientation\./), failed: o.failed, arguments: o.arguments.length, dropped: o.dropped.length, vocabulary: Object.fromEntries(Object.entries(o.vocabulary).map(([k, v]) => [k, (v as string[]).length])), calls: o.calls.map((c) => ({ call: c.call, ok: c.ok, ms: c.ms, costUsd: c.costUsd, reason: c.reason })) }
    const terms = termsForSearch(o)
    rec.terms = terms
    console.log(`  stage 1: ${rec.stage1.ms}ms  ${rec.stage1.costPence.toFixed(2)}p  ${o.arguments.length} arguments  ${terms.length} terms${o.failed ? '  ⚠ FAILED' : ''}`)

    // the opening query, as the build writes it
    since = new Date(); t0 = Date.now()
    const openingJob = { id: 'ORIENT', question: 'What does the record hold that bears on this problem, and what law governs it today?', lookingFor: 'The statutes, committee reports, evaluations and judgments a specialist in this field would reach for first — named by the terms the field actually uses.' }
    const written = await writeQueries({ jobs: [openingJob], context: [testimonyForFacts(ctx), framed.promptBlock].filter(Boolean).join('\n\n'), onUsage: () => {} })
    const opening = written.get('ORIENT') ?? extractedQuery('ORIENT', ctx.problem || ctx.goalDetail || '')
    rec.openingQuery = { terms: opening.terms, provenance: opening.provenance, ms: Date.now() - t0, costPence: penceOf(await ledger(id, since), /./) }
    console.log(`  opening query (${opening.provenance}, ${rec.openingQuery.ms}ms): ${opening.terms.join(' ')}`)

    // the corpus searches, three arms
    const arm = async (label: string, extraTerms: string[]) => {
      const s = new Date(); const t = Date.now()
      const seen = new Set<string>(); const merged: Array<{ id: string; title: string; corpus: string }> = []
      let failed = false
      for (const intent of ['BACKGROUND_BRIEFING', 'LEGAL_LANDSCAPE'] as const) {
        const out = await runSearch({ keywords: opening.terms, intent, ideaContext: framed.ideaContext, limit: 16, ...(extraTerms.length ? { extraTerms } : {}) })
        if (out.failed) { failed = true; continue }
        for (const r of out.results) if (!seen.has(r.id)) { seen.add(r.id); merged.push({ id: r.id, title: (r as any).title ?? r.id, corpus: r.id.split(':')[0] }) }
      }
      const top = merged.slice(0, 20)
      const cost = penceOf(await ledger(id, s), /^search\./)
      console.log(`  ${label.padEnd(10)} ${Date.now() - t}ms  ${cost.toFixed(2)}p  ${top.length} results  corpora ${[...new Set(top.map((r) => r.corpus))].join(',')}${failed ? '  ⚠ a search failed' : ''}`)
      return { label, ms: Date.now() - t, costPence: cost, failed, top }
    }
    const w1 = await arm('WITHOUT_1', [])
    const w2 = await arm('WITHOUT_2', [])
    const wi = await arm('WITH', terms)
    const ids1 = new Set(w1.top.map((r) => r.id)), ids2 = new Set(w2.top.map((r) => r.id)), idsW = new Set(wi.top.map((r) => r.id))
    const foundByStage2 = wi.top.filter((r) => !ids1.has(r.id) && !ids2.has(r.id))
    const lostByStage2 = [...new Map([...w1.top, ...w2.top].map((r) => [r.id, r])).values()].filter((r) => ids1.has(r.id) && ids2.has(r.id) && !idsW.has(r.id))
    const noiseXor = w1.top.filter((r) => !ids2.has(r.id)).length + w2.top.filter((r) => !ids1.has(r.id)).length
    rec.arms = { WITHOUT_1: w1, WITHOUT_2: w2, WITH: wi }
    rec.comparison = { noiseFloorSymmetricDifference: noiseXor, foundByStage2, lostByStage2, withVsWithout1Overlap: wi.top.filter((r) => ids1.has(r.id)).length }
    console.log(`  noise floor (WITHOUT_1 vs WITHOUT_2, ids that differ): ${noiseXor}`)
    console.log(`  FOUND BY STAGE 2 (in WITH, in neither WITHOUT): ${foundByStage2.length}`)
    for (const r of foundByStage2.slice(0, 10)) console.log(`     + [${r.corpus}] ${r.title.slice(0, 100)}   (${r.id})`)
    console.log(`  LOST (in both WITHOUT runs, not in WITH): ${lostByStage2.length}`)
    for (const r of lostByStage2.slice(0, 6)) console.log(`     - [${r.corpus}] ${r.title.slice(0, 100)}`)
    report.push(rec)
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ takenAt: new Date().toISOString(), commit: prod.commit, flags: prod.capabilities, report }, null, 1))
  console.log(`\n-> ${OUT}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
