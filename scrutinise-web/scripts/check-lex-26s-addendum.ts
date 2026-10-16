// 26-S ADDENDUM 1 — 153 (the restored action), 154 (the feedback admin list), 156/§C record-keeping.
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s-addendum.ts
// A: COLD READ of 452c5ade (plain reads). B: FULL RUN on a scratch copy — a real FeedbackItem written, listed through the real route,
// its status changed and read back, attachments opened, a non-admin refused; the scratch is deleted. No model spend.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, controls = 0, dead = 0
const ok = (n: string, c: boolean, d = '') => { if (c) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n}${d ? `\n      ${d}` : ''}`) } }
const control = (n: string, holds: boolean) => { controls++; if (holds) { dead++; console.log(`  ✗ DEAD CONTROL — ${n}`) } else console.log(`  · control fired — ${n}`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n')

async function main() {
  section('A · COLD READ — 153, on Charlie\'s idea (plain reads)')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
  if (idea) {
    const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: idea.id, practicalStep: { contains: 'statutory duty for specific, named officials' } } })
    ok('the action deleted on 2 Oct is back, exactly once', rows.length === 1)
    const a = rows[0]
    ok('…as RULED OUT (so it lists under “Ruled out and merged away”), with the verdict as the reason', a?.status === 'RULED_OUT' && /CONFLICTS/.test(a.ruleOutReason ?? '') && /rules out thresholds/.test(a.ruleOutReason ?? ''), a?.ruleOutReason ?? '')
    ok('…carrying its policy-test verdict, and a number', a?.policyTestVerdict === 'CONFLICTS' && a.number != null)
    ok('…and it is not in the live list', (await prisma.lexCoherentAction.count({ where: { ideaId: idea.id, status: 'LIVE', practicalStep: { contains: 'statutory duty for specific, named officials' } } })) === 0)
    control('a restore that put it back LIVE would pass the "ruled out" test (must be FALSE)', a?.status === 'LIVE')
  } else console.log('  – NOT RUN — idea 452c5ade is not in this database')

  section('B · FULL RUN — 154, the feedback admin list (scratch copy, real routes)')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  const copy = await scratchCopy('452c5ade', 'add1')
  const g = globalThis as { __STUB_AUTH_USER?: unknown }
  const call = async (path: string, method: string, body?: unknown, q = '') => {
    const mod = await import(`../app/api/admin/feedback-items${path}/route`)
    const res = await mod[method](new Request(`http://internal.invalid/${q}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }))
    return { status: res.status as number, res, json: res.headers.get('content-type')?.includes('json') ? await res.json() : null as any }
  }
  try {
    g.__STUB_AUTH_USER = owner
    const item = await prisma.feedbackItem.create({
      data: {
        userId: owner!.id, ideaId: copy.id, stage: 'ACTIONS', surface: 'BUG_REPORT', originalText: 'Assign to heading says not valid.', summarisedText: 'Bulk assign to heading was refused.',
        technicalDetail: { control: 'Assign to heading', error: 'That request was not valid.', actionIds: [3, 4] } as never,
        attachments: [{ key: `_feedback/${copy.id}/${owner!.id}/zz-check.png`, name: 'screenshot.png', contentType: 'image/png', bytes: 2048 }] as never,
      },
    })
    const list = await call('', 'GET')
    const row = list.json.items.find((i: any) => i.id === item.id)
    ok('the item is in the list, newest first, as “User N” (never a name)', !!row && /^User \d+$/.test(row.userRef) && list.json.items[0].id === list.json.items.slice().sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))[0].id && !JSON.stringify(row).includes(owner!.name ?? '\u0000'))
    ok('a bug report shows its technical block verbatim', row?.isBugReport === true && row.technicalDetail?.error === 'That request was not valid.' && row.technicalDetail?.actionIds?.length === 2)
    ok('…and its attachment by name and size (never the storage key)', row?.attachments?.[0]?.name === 'screenshot.png' && !JSON.stringify(row).includes('_feedback/'))
    ok('a new item starts as New', row?.status === 'NEW' && list.json.counts.NEW >= 1)
    const up = await call('', 'PATCH', { id: item.id, status: 'TRIAGED', adminNotes: 'Reproduced: the bar sent ids.' })
    const back = await prisma.feedbackItem.findUnique({ where: { id: item.id } })
    ok('a status change and notes are saved, and read back from the database', up.status === 200 && back?.status === 'TRIAGED' && back.adminNotes === 'Reproduced: the bar sent ids.' && !!back.statusChangedAt)
    ok('…and the list now shows it as “Looked at” in the filtered view', (await call('', 'GET', undefined, '?status=TRIAGED')).json.items.some((i: any) => i.id === item.id))
    const bad = await call('', 'PATCH', { id: item.id, status: 'DONE' })
    ok('a status that is not one of the four is refused naming the input, nothing changed', bad.status === 422 && /the status/.test(bad.json.error) && !/not valid\.?$/i.test(bad.json.error) && (await prisma.feedbackItem.findUnique({ where: { id: item.id } }))?.status === 'TRIAGED', bad.json?.error)
    const empty = await call('', 'PATCH', { id: item.id })
    ok('a save with neither status nor notes is refused in words', empty.status === 422 && /neither a status nor notes/.test(empty.json.error))
    const att = await call('/attachment', 'GET', undefined, `?id=${item.id}&index=0`)
    ok('the attachment opens by a fresh signed link (302), minted from the row’s key', att.status === 302 && /^https?:\/\//.test(att.res.headers.get('location') ?? ''))
    const none = await call('/attachment', 'GET', undefined, `?id=${item.id}&index=7`)
    ok('a file number the item does not have is refused, not guessed', none.status === 404)
    control('a route that took the key from the request would open index 7 (must be FALSE)', none.status === 302)
    g.__STUB_AUTH_USER = { ...owner, id: 'zz-citizen', role: 'CITIZEN' }
    ok('a non-admin cannot list, change or open (403 each)', (await call('', 'GET')).status === 403 && (await call('', 'PATCH', { id: item.id, status: 'RESOLVED' })).status === 403 && (await call('/attachment', 'GET', undefined, `?id=${item.id}&index=0`)).status === 403)
    control('the non-admin change reached the row (must be FALSE)', (await prisma.feedbackItem.findUnique({ where: { id: item.id } }))?.status === 'RESOLVED')
  } finally {
    g.__STUB_AUTH_USER = owner
    ok('the scratch idea (and its feedback item) deletes cleanly', (await deleteScratch(copy.id)) === true)
  }

  section('C · source — reached, and the records')
  ok('the admin page links to the Feedback list (a page nothing links to is a page nobody opens)', read('app/admin/page.tsx').includes('href="/admin/feedback"'))
  ok('…and the list component is mounted by that page', read('app/admin/feedback/page.tsx').includes('<FeedbackItemsAdmin />'))
  const log = read('../docs/CHANGE_LOG.md')
  ok('CHANGE_LOG records 156 (what “entered the Deepening” means; the briefing documents stay Stage 1)', /Decision 156/.test(log) && /user-started Deepening pass/.test(log))
  ok('CHANGE_LOG records the unlogged push of 7a28d52', /7a28d52/.test(log) && /carries every local commit/.test(log))
  const ent = read('../docs/entity_list_v5.md')
  ok('entity_list_v5 has the 26-S and 26-R tables', ['ActionImportPass', 'IdeaSource', 'ResearchNote', 'ResearchNoteReply'].every((t) => ent.includes(t)) && /purpose/.test(ent))
  section('D · decisions 163 and 165 — the guard on aggregateToDocuments')
  const { aggregateToDocuments } = await import('../lib/lex/grain')
  const mixed = [{ id: 'a:1', score: 12, scorer: 'bm25' as const }, { id: 'b:1', score: 0.02, scorer: 'rrf' as const }]
  let refused = ''
  try { aggregateToDocuments(mixed, 'max') } catch (e) { refused = String(e) }
  ok('aggregateToDocuments REFUSES a mixed bm25 + rrf list (it used to sort it silently)', /tried to compare scores across 2 scorers/.test(refused), refused)
  ok('…and still aggregates a single-scorer list, best first', aggregateToDocuments([{ id: 'a:1', score: 1, scorer: 'bm25' as const }, { id: 'b:1', score: 3, scorer: 'bm25' as const }], 'max')[0].documentKey.startsWith('b'))
  control('a guard that never threw would pass the "refused" test (must be FALSE)', refused === '')
  console.log(`\n${pass + fail} assertions · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead)`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch(async (e) => { console.error('FATAL', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
