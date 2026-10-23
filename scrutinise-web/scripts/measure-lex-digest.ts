// 26-T1 §2f/§2g - MEASURE the digest on a SCRATCH COPY of Charlie's idea. Real model spend, labelled "measurement" (the script's name). The copy is
// deleted at the end; the original is never touched.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/measure-lex-digest.ts [--heading] [--set] [--judge-fixture] [ideaPrefix]
//
//   --heading        one heading (the one nearest 8 live actions): four models + judge. Prints calls, pence, seconds, per-model pence.
//   --set            the whole set (all live actions): the same.
//   --judge-fixture  ONE judge call on four CANNED model answers that plant a disagreement - proves the judge names each model's position.
//
// After each digest it asserts, on the REAL output (BRIEF_26T 2g): six answers per answering model; every action number the judge names exists and is
// live; the judge's disagreement section is present; a stale mark appears when an action is added. Writes scripts/_out/measure-lex-digest.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { CHARLIES_TEN, CONDITIONS_SOURCE } from './lib/seven-headings'
import * as D from '../lib/lex/action-digest'
import * as CD from '../lib/lex/action-conditions-server'
import { readConditions } from '../lib/lex/action-conditions-server'
import * as P from '../lib/lex/action-digest-pure'
import { callModelJson } from '../lib/lex/model-call'
import { recordUsage } from '../lib/lex/spend-ledger'
import { PREMIUM_DRAFT_MODELS } from '../lib/lex/guiding-policy-consolidate'

const args = process.argv.slice(2)
const flag = (f: string) => args.includes(f)
const prefix = args.find((a) => !a.startsWith('--')) ?? '452c5ade'
const out: Record<string, unknown> = { on: prefix, at: new Date().toISOString() }
let pass = 0, fail = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }

async function run(ideaId: string, userId: string, scope: 'HEADING' | 'SET', headingId: string | null, label: string) {
  const t0 = Date.now()
  const started = await D.startDigest(ideaId, userId, scope, headingId)
  if (!started.ok) throw new Error((started as { error: string }).error)
  let v = started.data
  const stages: Array<{ stage: string; seconds: number }> = []
  for (let i = 0; i < 6 && v.status !== 'READY' && v.status !== 'FAILED'; i++) {
    const s0 = Date.now(), before = v.status
    const r = await D.advanceDigest(ideaId, userId, v.id)
    if (!r.ok) throw new Error((r as { error: string }).error)
    v = r.data
    stages.push({ stage: before, seconds: Math.round((Date.now() - s0) / 1000) })
    console.log(`  ${label}: ${before} -> ${v.status} in ${stages[stages.length - 1].seconds}s (spent so far ${v.spentPence}p)`)
    if (v.status === 'MODELS_DONE' && v.models.some((m) => m.status === 'FAILED') && i > 1) break
    if (v.status === before) break
  }
  const seconds = Math.round((Date.now() - t0) / 1000)
  console.log(`  ${label}: ${v.status}, ${v.spentPence}p, ${seconds}s; models: ${v.models.map((m) => `${m.model}=${m.status}${m.servedBy ? `(by ${m.servedBy})` : ''}${m.pence != null ? ` ${m.pence}p` : ''}${m.error ? ` [${m.error.slice(0, 80)}]` : ''}`).join(' | ')}`)

  // §2g on the real output
  const row = await prisma.actionDigest.findUnique({ where: { id: v.id } })
  const outputs = (row?.modelOutputs ?? []) as unknown as P.StoredModelOutput[]
  const answered = outputs.filter((o) => o.status === 'OK')
  ok(`${label}: at least three of the four models answered`, answered.length >= 3, `${answered.length}`)
  ok(`${label}: every answering model gave an answer to all six questions`, answered.every((o) => new Set(o.answer!.answers.map((a) => a.question)).size === 6), answered.map((o) => `${o.model}:${o.answer!.answers.map((a) => a.question).join('')}`).join(' '))
  ok(`${label}: the judge wrote the digest (READY)`, v.status === 'READY' && !!v.judge)
  if (v.judge) {
    const live = new Set((await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { number: true } })).map((r) => r.number))
    const cited = [...v.judge.digest.weightBearing.map((w) => w.action), ...v.judge.digest.noDirectCondition.map((w) => w.action), ...v.judge.digest.conflicts.flatMap((c) => c.actions)]
    ok(`${label}: every action number the judge names exists and is live`, cited.every((n) => live.has(n)), cited.filter((n) => !live.has(n)).join())
    ok(`${label}: the prose cites no action that was not read (stray cites)`, v.judge.flags.strayCites.length === 0, `stray ${v.judge.flags.strayCites.join()}`)
    ok(`${label}: no [Ref: n] the record never carried`, v.judge.flags.unknownRefs.length === 0, v.judge.flags.unknownRefs.join())
    ok(`${label}: all six questions have a reconciled answer`, v.judge.digest.answers.length === 6, String(v.judge.digest.answers.length))
    ok(`${label}: every disagreement names only models on the panel, each with a position`, v.judge.digest.disagreements.every((d) => d.positions.length >= 1 && d.positions.every((p) => (PREMIUM_DRAFT_MODELS as readonly string[]).includes(p.model))))
    ok(`${label}: every gap says what fails without it`, v.judge.digest.gaps.every((g) => g.whatFails.length >= 30))
    console.log(`  ${label}: judge gave ${v.judge.digest.disagreements.length} disagreement(s), ${v.judge.digest.gaps.length} gap(s), ${v.judge.digest.conflicts.length} conflict(s), ${v.judge.digest.proposedConditions.length} proposed condition(s); ${v.judge.flags.badActionNumbers + v.judge.flags.unnamedModels + v.judge.flags.missingWhatFails} item(s) dropped by validation`)
  }
  const dropped = answered.map((o) => ({ model: o.model, ...o.dropped }))
  return { id: v.id, scope, status: v.status, pence: v.spentPence, unpriced: v.unpriced, seconds, stages, actions: v.staleness.then, models: v.models, dropped, judge: v.judge, table: v.table }
}

async function judgeFixture(ideaId: string, userId: string) {
  // Four CANNED reviews that plant a disagreement on question 5 (is the non-legislative part strong enough?): two say yes, two say no.
  const MODELS = [...PREMIUM_DRAFT_MODELS]
  const mk = (yes: boolean): P.ModelAnswer => ({
    answers: [1, 2, 3, 4, 5, 6].map((q) => ({ question: q, answer: q === 5 ? (yes ? 'The non-legislative elements are strong enough: they are measured and enforced.' : 'The non-legislative elements are NOT strong enough: nothing measures them and nothing enforces them.') : `Answer ${q}: nothing remarkable.` })),
    coverage: [{ condition: 1, actions: [] }], noDirectCondition: [], weightBearing: [], missing: [], conflicts: [], proposedConditions: [],
  })
  const outputs: P.StoredModelOutput[] = MODELS.map((m, i) => ({ model: m, status: 'OK' as const, answer: mk(i < 2) }))
  const user = P.judgeUserPrompt('a fixture with canned reviews', [{ number: 1, text: 'One named owner per task' }], '#1 A fixture action', outputs)
  const t0 = Date.now()
  const result = await callModelJson<unknown>({ model: 'claude-opus-5-5', system: P.JUDGE_SYSTEM, user, schema: P.JUDGE_SCHEMA as never, maxOutputTokens: 20000, timeoutMs: 240_000, reasoningEffort: 'medium', label: 'action-digest:judge-fixture', stream: 'lex', pass: 'action-digest.judge', ideaId, userId })
  const priced = result.usage.recorded ?? await recordUsage(result.usage, { stream: 'lex', pass: 'action-digest.judge', ideaId, userId, failed: !result.ok })
  const seconds = Math.round((Date.now() - t0) / 1000)
  console.log(`  judge fixture: ok=${result.ok} ${priced.pence}p ${seconds}s`)
  if (!result.ok) console.log(`  judge fixture FAILED: ${(result as { reason: string }).reason}: ${(result as { detail: string }).detail}`)
  ok('judge fixture: the judge answered', result.ok)
  if (!result.ok) return { ok: false }
  const parsed = P.parseJudge((result as { value: unknown }).value, { actionNumbers: new Set([1]), conditionCount: 1, refNumbers: new Set() }, MODELS)
  const d5 = parsed.digest.disagreements
  const names = new Set(d5.flatMap((d) => d.positions.map((p) => p.model)))
  ok('judge fixture: it reports a disagreement', d5.length >= 1, JSON.stringify(d5))
  ok('judge fixture: the disagreement NAMES a model on each side (a yes-model and a no-model)', MODELS.slice(0, 2).some((m) => names.has(m)) && MODELS.slice(2).some((m) => names.has(m)), [...names].join())
  ok('judge fixture: positions are the models\' own (the yes side says strong enough, the no side says not)', d5.some((d) => d.positions.some((p) => MODELS.slice(0, 2).includes(p.model as never) && /strong enough|measured|enforced/i.test(p.position)) && d.positions.some((p) => MODELS.slice(2).includes(p.model as never) && /not|nothing/i.test(p.position))), JSON.stringify(d5))
  return { ok: true, pence: priced.pence, seconds, disagreements: d5 }
}

async function main() {
  const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = probe
  const copy = await scratchCopy(prefix, 'digest')
  try {
    if (!(await readConditions(copy.id)).items.length) { await CD.seedConditions(copy.id, copy.userId, CHARLIES_TEN, CONDITIONS_SOURCE); console.log('  (the copy had no conditions: Charlie\'s ten were seeded on the COPY)') }
    const headings = await prisma.actionHeading.findMany({ where: { ideaId: copy.id, archivedAt: null }, orderBy: { orderIndex: 'asc' } })
    const counts: Array<{ id: string; name: string; n: number }> = []
    for (const h of headings) counts.push({ id: h.id, name: h.name, n: await prisma.lexCoherentAction.count({ where: { ideaId: copy.id, status: 'LIVE', headingId: h.id } }) })
    const live = await prisma.lexCoherentAction.count({ where: { ideaId: copy.id, status: 'LIVE' } })
    console.log(`  the copy: ${live} live actions; headings: ${counts.map((c) => `${c.name}=${c.n}`).join(', ')}`)
    out.live = live; out.headings = counts
    if (flag('--judge-fixture')) out.judgeFixture = await judgeFixture(copy.id, copy.userId)
    if (flag('--heading')) {
      const pick = [...counts].filter((c) => c.n >= 2).sort((a, b) => Math.abs(a.n - 8) - Math.abs(b.n - 8))[0]
      if (!pick) throw new Error('no heading with two or more live actions on the copy')
      console.log(`  HEADING digest on “${pick.name}” (${pick.n} actions)`)
      out.heading = await run(copy.id, copy.userId, 'HEADING', pick.id, `heading ${pick.name}`)
      // §2g: a stale mark appears when an action is added
      const spare = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, status: 'LIVE', NOT: { headingId: pick.id } }, select: { id: true } })
      if (spare) {
        await prisma.lexCoherentAction.update({ where: { id: spare.id }, data: { headingId: pick.id } })
        const v = (await D.listDigests(copy.id)).find((d) => d.headingId === pick.id)
        ok('a stale mark appears when an action is added to the heading', !!v && v.staleness.stale && !!v.staleSentence, v?.line)
      }
    }
    if (flag('--set')) { console.log('  SET digest'); out.set = await run(copy.id, copy.userId, 'SET', null, 'set') }
    mkdirSync('scripts/_out', { recursive: true })
    writeFileSync('scripts/_out/measure-lex-digest.json', JSON.stringify(out, null, 2))
  } finally { await deleteScratch(copy.id) }
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
