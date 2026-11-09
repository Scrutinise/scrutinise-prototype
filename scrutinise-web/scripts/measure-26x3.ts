// 26-X X3 (311) — MEASURE the four-model digest and the policy test OVER DRAFTS, on a SCRATCH COPY of Charlie's idea (CCh-Lex 7 Nov (2): "Re-measure
// the digest and the policy test over drafts on scratch before the buttons show a price"). Real model spend, labelled "measurement" by this
// script's name. The copy carries the idea's live documents (so #207's accepted Code is read as a draft); it is deleted at the end; the
// original is never touched.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --tsconfig tsconfig.json --env-file=.env scripts/measure-26x3.ts [--set] [--heading] [--policy] [ideaPrefix]
//
// Prints, per run: pence, seconds, characters read, and what was read per action - and asserts on the REAL output: the action with an accepted
// draft was read by its draft (D-number and version), every other by its statement; the policy verdicts record what they read.
// Writes scripts/_out/measure-26x3.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch, copyDocuments } from './lib/scratch-copy'
import * as D from '../lib/lex/action-digest'
import type { StoredModelOutput } from '../lib/lex/action-digest-pure'
import { testAgainstPolicy } from '../lib/lex/action-structure'
import { acceptedDrafts, parseReadMark } from '../lib/lex/accepted-drafts'
import { parseRecord } from '../lib/lex/action-record'
import { policyTestCalls, POLICY_TEST_ITEM_CHARS } from '../lib/lex/policy-test-pure'

const args = process.argv.slice(2)
const flag = (f: string) => args.includes(f)
const all = !flag('--set') && !flag('--heading') && !flag('--policy')
const prefix = args.find((a) => !a.startsWith('--')) ?? '452c5ade'
const out: Record<string, unknown> = { on: prefix, at: new Date().toISOString() }
let pass = 0, fail = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }

async function digest(ideaId: string, userId: string, scope: 'SET' | 'HEADING', headingId: string | null, label: string, draftActions: Map<number, string>) {
  const t0 = Date.now()
  const started = await D.startDigest(ideaId, userId, scope, headingId)
  if (!started.ok) throw new Error((started as { error: string }).error)
  let v = started.data
  for (let i = 0; i < 6 && v.status !== 'READY' && v.status !== 'FAILED'; i++) {
    const s0 = Date.now(), before = v.status
    const r = await D.advanceDigest(ideaId, userId, v.id)
    if (!r.ok) throw new Error((r as { error: string }).error)
    v = r.data
    console.log(`  ${label}: ${before} -> ${v.status} in ${Math.round((Date.now() - s0) / 1000)}s (spent so far ${v.spentPence}p)`)
    if (v.status === before) break
  }
  const seconds = Math.round((Date.now() - t0) / 1000)
  const row = await prisma.actionDigest.findUnique({ where: { id: v.id } })
  const outputs = (row?.modelOutputs ?? []) as unknown as StoredModelOutput[]
  const answered = outputs.filter((o) => o.status === 'OK')
  const chars = answered[0]?.dataChars ?? null
  console.log(`  ${label}: ${v.status}, ${v.spentPence}p${v.unpriced ? ' (a floor: a call was unpriced)' : ''}, ${seconds}s, ${chars} characters of data; models: ${v.models.map((m) => `${m.model}=${m.status}${m.servedBy ? `(by ${m.servedBy})` : ''}${m.pence != null ? ` ${m.pence}p` : ''}${m.error ? ` [${m.error.slice(0, 80)}]` : ''}`).join(' | ')}`)
  console.log(`  ${label}: ${v.readsLine}`)
  if (v.failure) console.log(`  ${label}: FAILURE ON THE DIGEST: ${v.failure}`)
  ok(`${label}: at least three of the four models answered`, answered.length >= 3, `${answered.length}`)
  ok(`${label}: the judge wrote the digest (READY)`, v.status === 'READY' && !!v.judge)
  ok(`${label}: every answer stores what it read and how many characters`, answered.length > 0 && answered.every((o) => Array.isArray(o.read) && typeof o.dataChars === 'number'))
  const reads = v.reads ?? []
  for (const [n, d] of draftActions) {
    const r = reads.find((x) => x.n === n)
    if (!r) continue // not in this scope
    ok(`${label}: #${n} was read by its accepted draft ${d}`, r.read.what === 'draft' && r.read.d === d, JSON.stringify(r.read))
  }
  const others = reads.filter((x) => !draftActions.has(x.n))
  // a heading may hold only the drafted action (the "Accountability Code" heading holds #207 alone): then there is nothing to read by its statement
  if (reads.length > draftActions.size) ok(`${label}: every action with no accepted draft was read by its statement (${others.length})`, others.length > 0 && others.every((x) => x.read.what === 'statement'))
  ok(`${label}: the view says what was read`, /accepted draft/.test(v.readsLine) && /statement/.test(v.readsLine), v.readsLine)
  return { id: v.id, scope, status: v.status, pence: v.spentPence, unpriced: v.unpriced, seconds, actions: v.staleness.then, chars, models: v.models, readsLine: v.readsLine, draftsCut: v.draftsCut }
}

async function policy(ideaId: string, userId: string, draftActionIds: Set<string>) {
  const live = await prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { id: true, number: true, title: true, practicalStep: true }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] })
  const drafts = await acceptedDrafts(ideaId)
  const runOne = async (label: string, ids: string[]) => {
    const items = live.filter((a) => ids.includes(a.id)).map((a) => ({ draftChars: drafts.get(a.id)?.body.length ?? 0, statementChars: (a.title?.length ?? 0) + a.practicalStep.length }))
    const chars = items.reduce((n, x) => n + x.draftChars + Math.min(x.statementChars, POLICY_TEST_ITEM_CHARS), 0)
    const calls = policyTestCalls(items).length
    const t0 = Date.now()
    const r = await testAgainstPolicy(ideaId, userId, { ids })
    const seconds = Math.round((Date.now() - t0) / 1000)
    if (!r.ok) { ok(`${label}: the test finished`, false, (r as { error: string }).error); return null }
    console.log(`  ${label}: tested ${r.data.tested} in ${r.data.batches} call(s) (predicted ${calls}), ${r.data.pence}p, ${seconds}s, ${chars} characters; ${JSON.stringify(r.data.counts)}`)
    ok(`${label}: the calls made are the calls the price predicts`, r.data.batches === calls, `${r.data.batches} vs ${calls}`)
    return { calls: r.data.batches, chars, pence: r.data.pence, seconds, tested: r.data.tested, counts: r.data.counts }
  }
  const statements = live.filter((a) => !draftActionIds.has(a.id)).slice(0, 20).map((a) => a.id)
  const a = await runOne('policy test, 20 statements', statements)
  const b = await runOne('policy test, the accepted draft(s) alone', [...draftActionIds])
  // what each verdict recorded it read, read back plainly
  const rows = await prisma.lexCoherentAction.findMany({ where: { id: { in: [...statements, ...draftActionIds] } }, select: { id: true, number: true, record: true, policyTestVerdict: true } })
  const marks = rows.map((r) => ({ id: r.id, n: r.number, read: parseReadMark(parseRecord(r.record).policyTestRead) }))
  ok('policy test: every action with an accepted draft records that it read the draft (D-number, version)', marks.filter((m) => draftActionIds.has(m.id)).every((m) => m.read?.what === 'draft' && m.read.d === drafts.get(m.id)?.d && m.read.v === drafts.get(m.id)?.v), JSON.stringify(marks.filter((m) => draftActionIds.has(m.id))))
  ok('policy test: every other tested action records that it read the statement', marks.filter((m) => !draftActionIds.has(m.id)).every((m) => m.read?.what === 'statement'))
  return { statements: a, drafts: b }
}

async function main() {
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: prefix }, deletedAt: null }, select: { id: true } })
  if (!src) throw new Error(`no idea ${prefix}`)
  const copy = await scratchCopy(prefix, 'x3-measure')
  console.log(`scratch copy ${copy.id} of ${src.id}`)
  try {
    const n = await copyDocuments(src.id, copy.id)
    const drafts = await acceptedDrafts(copy.id)
    const nums = new Map((await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id }, select: { id: true, number: true, headingId: true } })).map((a) => [a.id, a]))
    const draftActions = new Map([...drafts.values()].map((d) => [nums.get(d.actionId)!.number!, d.d]))
    console.log(`copied ${n} documents; accepted drafts on the copy: ${[...draftActions].map(([k, d]) => `#${k} ${d}`).join(', ') || 'none'}`)
    ok('the copy carries at least one accepted draft to read', drafts.size > 0)
    out.acceptedDrafts = [...drafts.values()].map((d) => ({ d: d.d, kind: d.kind, v: d.v, chars: d.body.length }))
    if (all || flag('--set')) out.set = await digest(copy.id, copy.userId, 'SET', null, 'SET digest', draftActions)
    if (all || flag('--heading')) {
      const first = [...drafts.values()][0]
      const headingId = first ? nums.get(first.actionId)?.headingId ?? null : null
      if (headingId) out.heading = await digest(copy.id, copy.userId, 'HEADING', headingId, 'HEADING digest (the heading holding the draft)', draftActions)
      else ok('a heading holds the accepted draft', false)
    }
    if (all || flag('--policy')) out.policy = await policy(copy.id, copy.userId, new Set(drafts.keys()))
  } finally {
    const gone = await deleteScratch(copy.id)
    console.log(`scratch copy deleted: ${gone}`)
  }
  mkdirSync('scripts/_out', { recursive: true })
  writeFileSync('scripts/_out/measure-26x3.json', JSON.stringify(out, null, 2))
  console.log(`\nmeasure-26x3: ${pass} passed, ${fail} failed`)
  await prisma.$disconnect()
  process.exit(fail ? 1 : 0)
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
