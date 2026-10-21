// ──────────────────────────────────────────────────────────────────────────────
// SEARCH-28 — decision 161 for Search's three route files: a rejected request names the input and the reason, in words.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-search-161.ts   (npm run check:search-161)
//
// Proved THROUGH THE REAL HANDLERS (docs/CLAUDE.md §25): a bad body is posted to each route and the answer is read.
//   app/api/search/route.ts · app/api/ideas/[id]/search/route.ts (on a scratch copy of 452c5ade) · app/api/legislation-guide/suggestions/route.ts
// Counts what RAN (§23.2). Every value assertion has a control that must stay false (§23/§25.5).
// ──────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0
function ok(name: string, cond: boolean, detail = '') {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}
function control(name: string, propertyHolds: boolean) {
  controls++
  if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`)
}
const BARE = /not valid|invalid request|bad request/i
type Rej = { error?: unknown; rejected?: Array<{ field: string; reason: string }> }
const post = async (handler: (req: never, ctx?: never) => Promise<Response>, body: unknown, ctx?: unknown) => {
  const res = await handler(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) as never, ctx as never)
  return { status: res.status, json: (await res.json()) as Rej }
}
/** What the three routes sent before: zod's flatten() object, which a client could only show as a fixed sentence. */
const OLD = { error: { formErrors: [], fieldErrors: { q: ['Too small: expected string to have >=1 characters'] } } }

async function main() {
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })

  console.log('\n── /api/search ──')
  const s = await post((await import('../app/api/search/route')).POST as never, { q: '' })
  ok('an empty query is refused (422)', s.status === 422, String(s.status))
  ok('…with a sentence, not an object', typeof s.json.error === 'string', JSON.stringify(s.json.error))
  ok('…that names the input by key and in words, and says why', typeof s.json.error === 'string' && s.json.error.includes('“q”') && s.json.error.includes('the search words') && /empty or too short/.test(s.json.error), String(s.json.error))
  ok('…and that nothing was changed, never the bare sentence', typeof s.json.error === 'string' && /Nothing was changed/.test(s.json.error) && !BARE.test(s.json.error))
  ok('…and carries the structured list', !!s.json.rejected?.some((r) => r.field === 'q'))
  const s2 = await post((await import('../app/api/search/route')).POST as never, { q: 'x', limit: 5000 })
  ok('an over-large limit says which input and the limit', typeof s2.json.error === 'string' && s2.json.error.includes('“limit”') && /100/.test(s2.json.error) || (typeof s2.json.error === 'string' && s2.json.error.includes('“limit”')), String(s2.json.error))
  control('the old flatten() body would pass the "is a sentence naming the input" test (must be FALSE)', typeof OLD.error === 'string' && String(OLD.error).includes('“q”'))

  console.log('\n── /api/ideas/[id]/search ──')
  const copy = await scratchCopy('452c5ade', 'search161')
  try {
    const ctx = { params: Promise.resolve({ id: copy.id }) }
    const h = (await import('../app/api/ideas/[id]/search/route')).POST as never
    const r1 = await post(h, { action: 'research', query: 'x' }, ctx)
    ok('a too-short research query is refused (422)', r1.status === 422, String(r1.status))
    ok('…naming the input, its words and why', typeof r1.json.error === 'string' && r1.json.error.includes('“query”') && r1.json.error.includes('the search words') && /short/.test(r1.json.error), String(r1.json.error))
    const r2 = await post(h, { action: 'frobnicate' }, ctx)
    ok('an unknown action is worded, not bare', r2.status === 422 && typeof r2.json.error === 'string' && !BARE.test(r2.json.error) && /Nothing was changed/.test(r2.json.error), String(r2.json.error))
    control('a fixed "not valid" sentence passes the worded test (must be FALSE)', !BARE.test('That request was not valid.'))
  } finally { await deleteScratch(copy.id) }

  console.log('\n── /api/legislation-guide/suggestions ──')
  const g = await post((await import('../app/api/legislation-guide/suggestions/route')).POST as never, { name: 'A', email: 'not-an-email', sectionKey: 'nonexistent', suggestion: 'short' })
  ok('a malformed suggestion is refused (422)', g.status === 422, String(g.status))
  const ge = typeof g.json.error === 'string' ? g.json.error : ''
  ok('…naming the email in the user\'s words', ge.includes('“email”') && ge.includes('your email address'), ge)
  ok('…and the suggestion text, with its minimum', ge.includes('“suggestion”') && /at least 10/.test(ge), ge)
  ok('…and saying nothing was changed', /Nothing was changed/.test(ge) && !BARE.test(ge))

  console.log(`\n${pass} passed, ${fail} failed · ${ran} assertions ran · ${controls} controls, ${dead} dead`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
