// ─────────────────────────────────────────────────────────────────────────────
// verify:lex-26p-run — A REAL CONFIRM ON EACH ASKS-FIRST *RUN*, ON A SCRATCH COPY, AND WHAT EACH ONE REALLY COST.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/verify-lex-26p-run.ts 452c5ade [--rerun]
//
// WHY. 26-P exercised the confirmation STEP (a signed token, a button, single use, an undo) on `rule_out_candidate`. It did
// NOT run the actions behind Confirm for the three expensive processes — and the prices on those cards were the brief's
// figures. This runs each for real on a copy of a real idea and reports the measured cost, from the ledger, per process.
//
// ⚠⚠ THIS SPENDS REAL MONEY (consolidation ≈ 12p, gap check ≈ 14p, comparison ≈ 2p, a re-run 30p+ with --rerun). It runs on a
// COPY (scripts/lib/scratch-copy.ts) and deletes it in a `finally`; the original is never written.
//
// ⚠ THE ONE SUBSTITUTION. The consolidation and re-run tools call the product's own route handlers in-process, and those
// call `getAuthenticatedUser()` (Clerk) — which has no session in a script. This replaces ONLY that function with the
// scratch idea's owner. Everything else is the product's own code: the confirm token, `handleConfirm`, the route's gate,
// the four drafting models, the judge, the ledger. (It works because tsx compiles to CommonJS, where an import is a
// property read at call time.)

process.env.LEX_AGENT_SECRET = process.env.LEX_AGENT_SECRET || 'verify-lex-26p-run-secret'

import { prisma } from '../lib/prisma'
import { handleAgentTurn, handleConfirm } from '../lib/lex/agent/turn'
import { listToolCalls } from '../lib/lex/agent/tool-log'
import { execute, toolByName } from '../lib/lex/agent/tools'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SRC = process.argv[2] ?? '452c5ade'
const RERUN = process.argv.includes('--rerun')
/** --only gap,consolidation,comparison — run just those (each spends). Default: gap, consolidation, comparison. */
const onlyArg = process.argv.indexOf('--only')
const ONLY = new Set((onlyArg > -1 ? process.argv[onlyArg + 1] : 'gap,consolidation,comparison').split(','))

async function ledgerSince(ideaId: string, since: Date) {
  const rows = await prisma.$queryRaw<Array<{ pass: string; model: string; n: bigint; pence: number | null; tin: bigint; tout: bigint }>>`
    SELECT "pass", "model", count(*) n, sum("estCostPence")::float pence, sum("tokensIn") tin, sum("tokensOut") tout
    FROM "LlmSpend" WHERE "ideaId" = ${ideaId} AND "createdAt" >= ${since} GROUP BY 1,2 ORDER BY 4 DESC NULLS LAST`
  const total = rows.reduce((s, r) => s + (r.pence ?? 0), 0)
  return { rows, total }
}

async function main() {
  const copy = await scratchCopy(SRC, 'run-verify')
  console.log(`scratch copy ${copy.id.slice(0, 8)} of ${SRC} — "${copy.title.slice(0, 70)}"`)
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: copy.userId }, select: { id: true, email: true } })
  const user = { id: owner.id, email: owner.email }
  // The ONE substitution — see the header. `scripts/lib/stub-auth.cjs` (preloaded with --require) reads this at call time.
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })
  if (!process.execArgv.join(' ').includes('stub-auth.cjs') && !process.argv.join(' ').includes('stub-auth.cjs')) {
    console.warn('⚠ stub-auth.cjs is NOT preloaded: the consolidation / re-run routes will answer 401. Run with --require ./scripts/lib/stub-auth.cjs')
  }

  const results: Record<string, { measuredPence: number; detail: string }> = {}
  let turn = 0
  const say = async (message: string) => {
    const idea = await prisma.idea.findUniqueOrThrow({ where: { id: copy.id }, select: { id: true, creatorId: true, aiChatHistory: true } })
    const out = await handleAgentTurn({ ideaId: copy.id, user, idea, message, ui: { stage: 'strategy' }, clientTurnId: `run-verify-${Date.now()}-${turn++}` })
    if (!out.result) throw new Error(`turn failed: ${JSON.stringify(out.body).slice(0, 300)}`)
    return out.result
  }
  /** A real pending confirmation for an asks-first tool, minted by the product's own `execute` (see CONSOLIDATION below). */
  const mint = async (tool: string, input: unknown) => {
    const r = await execute(toolByName(tool)!, { ideaId: copy.id, userId: owner.id, confirmed: false, turn: { tainted: false, corpusIds: new Set(), webSources: new Map(), userMessages: [], pastedText: null } }, input)
    if (!r.pending) throw new Error(`${tool} did not return a pending confirmation: ${JSON.stringify(r).slice(0, 200)}`)
    return r.pending
  }
  const press = async (token: string) => {
    const idea = await prisma.idea.findUniqueOrThrow({ where: { id: copy.id }, select: { id: true, creatorId: true, aiChatHistory: true } })
    return handleConfirm({ ideaId: copy.id, user, idea, token })
  }

  try {
    if (process.argv.includes('--dry')) {
      // The seam, the copy and the cleanup — nothing spends.
      const { authorizeIdea } = await import('../lib/lex/authz')
      const a = await authorizeIdea(copy.id)
      const nOpts = await prisma.policyOption.count({ where: { ideaId: copy.id } })
      const nCauses = await prisma.diagnosisCause.count({ where: { ideaId: copy.id } })
      const nActs = await prisma.lexCoherentAction.count({ where: { ideaId: copy.id } })
      console.log(`DRY: authorizeIdea → ${a.error ? 'ERROR ' + a.error.status : 'ok as ' + a.user?.email}; copied ${nCauses} causes, ${nOpts} candidates, ${nActs} actions`)
      return
    }
    // ── 1 · the gap check — asks first, called directly (no route) ─────────────────────────────
    let t0 = new Date()
    if (ONLY.has('gap')) {
    console.log('\n── GAP CHECK ─────────────────────────────────────────────')
    const g = await say('Please run the gap check on my coherent actions.')
    const gp = g.pending.find((p) => /gap check/i.test(p.summary))
    console.log(`  offered: ${gp ? `"${gp.summary}" — ${gp.pence}p ${gp.priceSource}` : 'NOT OFFERED'} · reply: ${g.reply.slice(0, 140).replace(/\s+/g, ' ')}`)
    if (gp) {
      t0 = new Date()
      const r = await press(gp.token)
      const L = await ledgerSince(copy.id, t0)
      console.log(`  CONFIRMED → HTTP ${r.status} · ${String(r.body.chatText).slice(0, 160)}`)
      console.log(`  measured: ${L.total.toFixed(2)}p over ${L.rows.reduce((s, x) => s + Number(x.n), 0)} calls`)
      for (const x of L.rows) console.log(`     ${x.pass} · ${x.model} · ${x.n} calls · ${x.pence?.toFixed(2)}p`)
      results.run_gap_check = { measuredPence: L.total, detail: `${L.rows.reduce((s, x) => s + Number(x.n), 0)} calls` }
    }
    }

    // ── 2 · the consolidation — asks first, through the route ──────────────────────────────────
    if (ONLY.has('consolidation')) {
    console.log('\n── CONSOLIDATION ─────────────────────────────────────────')
    // ⚠ MINTED THROUGH `execute`, NOT ASKED OF THE MODEL: on the copy, the guiding policy is already settled, and Lex —
    // correctly — answers "Consolidate my candidates" with "that is already settled" on some runs and offers the button on
    // others. A MEASUREMENT cannot depend on that judgement. `execute` is the very function the model's call goes through,
    // so the pending token, its price and its signature are the real ones; only "the model chose to call it" is skipped.
    const c = { pending: [await mint('run_consolidation', {})], reply: '(token minted by execute — the model was not asked)' }
    const cp = c.pending.find((p) => /consolidat/i.test(p.summary))
    console.log(`  offered: ${cp ? `"${cp.summary}" — ${cp.pence}p ${cp.priceSource}` : 'NOT OFFERED'} · reply: ${c.reply.slice(0, 160).replace(/\s+/g, ' ')}`)
    if (cp) {
      t0 = new Date()
      const r = await press(cp.token)
      const L = await ledgerSince(copy.id, t0)
      const row = await prisma.guidingPolicyConsolidation.findFirst({ where: { ideaId: copy.id }, orderBy: { createdAt: 'desc' }, include: { drafts: true } })
      console.log(`  CONFIRMED → HTTP ${r.status} · ${String(r.body.chatText).slice(0, 200)}`)
      console.log(`  the consolidation row: ${row?.drafts.length ?? 0} drafts, costPence ${row?.costPence?.toFixed(2)} (drafts + judge); status ${row?.status}`)
      console.log(`  measured from the ledger (drafts + judge + action-idea extraction): ${L.total.toFixed(2)}p`)
      for (const x of L.rows) console.log(`     ${x.pass} · ${x.model} · ${x.n} calls · ${x.pence?.toFixed(2)}p`)
      const judgeFailed = row?.status === 'DRAFTING'
      if (judgeFailed) console.log('  ⚠ the JUDGE did not complete (status stayed DRAFTING) — so this total EXCLUDES the judge call and is not a complete consolidation price')
      results.run_consolidation = { measuredPence: L.total, detail: `${row?.drafts.length} drafts; row says ${row?.costPence?.toFixed(2)}p${judgeFailed ? '; JUDGE FAILED — incomplete' : ''}` }
    }
    }

    // ── 3 · the comparison — free tier (≤5p): file a document, then run it ─────────────────────
    if (ONLY.has('comparison')) {
    console.log('\n── COMPARISON ────────────────────────────────────────────')
    const doc = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1}. Where a named senior official personally owns a stated outcome, and the measure of success is published in advance, failures are traced to a decision rather than diffused across a committee. Reviews of public-sector failures repeatedly find unclear ownership of an outcome, success defined only after the event, and accountability that attaches to a role rather than to a person who could have acted differently.`).join('\n\n')
    // Filing is measured separately (it reads the document into findings — a Gemini call per document — and is not part
    // of "the comparison"). Both go through `execute`, with the document in the turn's user messages as `file_text` requires.
    const label = 'BRIEFING NOTE: OWNERSHIP OF OUTCOMES'
    const turnState = { tainted: false, corpusIds: new Set<string>(), webSources: new Map(), userMessages: [`${label}\n\n${doc}`], pastedText: null }
    const ctx = { ideaId: copy.id, userId: owner.id, turn: turnState, confirmed: false }
    t0 = new Date()
    const filed = await execute(toolByName('file_text')!, ctx, { label, text: `${label}\n\n${doc}` })
    const FL = await ledgerSince(copy.id, t0)
    console.log(`  file_text: ${filed.ok ? 'filed' : `FAILED: ${filed.error}`} · reading it into findings cost ${FL.total.toFixed(2)}p`)
    t0 = new Date()
    const cmp = await execute(toolByName('run_comparison')!, ctx, {})
    const L = await ledgerSince(copy.id, t0)
    console.log(`  run_comparison: ${cmp.ok ? 'ran' : `FAILED: ${cmp.error}`} · ${JSON.stringify(cmp.data ?? {}).slice(0, 200)}`)
    console.log(`  measured: ${L.total.toFixed(2)}p`)
    for (const x of L.rows) console.log(`     ${x.pass} · ${x.model} · ${x.n} calls · ${x.pence?.toFixed(2)}p`)
    if (cmp.ok) results.run_comparison = { measuredPence: L.total, detail: `comparison only; filing the note first cost a further ${FL.total.toFixed(2)}p` }
    }

    // ── 4 · the re-run — asks first, through the build route (30p+) ────────────────────────────
    if (RERUN) {
      console.log('\n── RE-RUN OF THE BUILD ───────────────────────────────────')
      // FULL, not REUSE: the copy has no earlier build whose research could be reused. Minted via `execute` (see above).
      const b = { pending: [await mint('rerun_build', { mode: 'FULL' })] }
      const bp = b.pending.find((p) => /re-?run/i.test(p.summary))
      console.log(`  offered: ${bp ? `"${bp.summary}" — ${bp.pence}p ${bp.priceSource}` : 'NOT OFFERED'}`)
      if (bp) {
        t0 = new Date()
        const r = await press(bp.token)
        console.log(`  CONFIRMED → HTTP ${r.status} · ${String(r.body.chatText).slice(0, 200)}`)
        // the Railway worker (or this process, if it claims) runs it; poll the row.
        const deadline = Date.now() + 22 * 60_000
        let build: { id: string; status: string; estCostPence: unknown } | null = null
        while (Date.now() < deadline) {
          build = await prisma.ideaBuild.findFirst({ where: { ideaId: copy.id }, orderBy: { version: 'desc' }, select: { id: true, status: true, estCostPence: true } })
          if (build && ['DONE', 'FAILED', 'CANCELLED'].includes(build.status)) break
          await new Promise((res) => setTimeout(res, 15_000))
        }
        const BL = await ledgerSince(copy.id, t0)
        console.log(`  build ${build?.id.slice(0, 8)} ${build?.status}; row estCostPence ${build?.estCostPence}; ledger ${BL.total.toFixed(2)}p`)
        for (const x of BL.rows) console.log(`     ${x.pass} · ${x.model} · ${x.n} calls · ${x.pence?.toFixed(2)}p`)
        if (build?.status === 'DONE') results.rerun_build = { measuredPence: BL.total, detail: `build ${build.id.slice(0, 8)}, FULL mode, on a copy with no earlier build` }
      }
    }

    console.log('\n── THE TOOL LOG (§8c) — what the owner would see on this idea ──')
    for (const row of (await listToolCalls(copy.id)).reverse()) {
      console.log(`  ${row.at.slice(11, 19)} ${row.actor} · ${row.tool} · ${row.tier} · ${row.ok ? 'ok' : 'FAILED'}${row.confirmedVia ? ' · confirmed by button' : ''} · "${row.instruction.slice(0, 50).replace(/\s+/g, ' ')}" → ${(row.result as { summary?: string })?.summary?.slice(0, 70)}`)
    }
    console.log('\nMEASURED:', JSON.stringify(results, null, 1))
  } finally {
    const hard = await deleteScratch(copy.id)
    console.log(`\nscratch copy ${copy.id.slice(0, 8)} ${hard ? 'deleted' : 'soft-deleted'}`)
    await prisma.$disconnect()
  }
}
main().catch((e) => { console.error('ERROR', e); process.exit(1) })
