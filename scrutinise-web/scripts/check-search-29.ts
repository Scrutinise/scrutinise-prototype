/**
 * check-search-29.ts - SEARCH-29: Option B's answer-context floor, orientation v2's behaviour when it cannot run, and that both are REACHED.
 *
 *   npm run check:search-29
 *
 * Offline: no model call, no database. Every assertion has a control that stays false (CLAUDE.md §23).
 */
import fs from 'node:fs'
import path from 'node:path'
import { selectAnswerContext } from '../lib/lex/answer-context'
import { runOrientationV2, termsForSearch, type OrientationV2 } from '../lib/lex/orientation/v2'

let pass = 0, fail = 0, controlsFired = 0, controlsDead = 0
const ok = (name: string, cond: boolean, detail = '') => { if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`) } }
const control = (name: string, propertyHolds: boolean) => { if (!propertyHolds) controlsFired++; else { controlsDead++; console.log(`  ✗✗ CONTROL DEAD: ${name} — the broken input still satisfied the property`) } }

// ── a result list in SCORE order where stream C's hits are all below the sixteenth place ──────────────────
const mk = (stream: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${stream}:${i}`, stream }))
const scoreOrder = [...mk('A', 14), ...mk('B', 14), ...mk('C', 6)] // C is ranked 29th onward
const perStream = [
  { stream: 'A', ids: mk('A', 14).map((r) => r.id) },
  { stream: 'B', ids: mk('B', 14).map((r) => r.id) },
  { stream: 'C', ids: mk('C', 6).map((r) => r.id) },
]
const countOf = (rows: Array<{ stream: string }>, s: string) => rows.filter((r) => r.stream === s).length

const plain = scoreOrder.slice(0, 16)
ok('premise: the plain prefix holds NO stream-C hit (the defect Option B answers)', countOf(plain, 'C') === 0)

const sel = selectAnswerContext(scoreOrder, perStream, 16, 2)
ok('floor 2: stream C holds exactly 2 places', countOf(sel.context, 'C') === 2, `got ${countOf(sel.context, 'C')}`)
ok('floor 2: C holds ITS BEST two (C:0, C:1), not any two', sel.context.some((r) => r.id === 'C:0') && sel.context.some((r) => r.id === 'C:1'))
ok('floor 2: the context is exactly 16 long', sel.context.length === 16, `got ${sel.context.length}`)
ok('floor 2: A and B each keep at least 2', countOf(sel.context, 'A') >= 2 && countOf(sel.context, 'B') >= 2)
ok('floor 2: the rest go by score — the 14 non-reserved places are the best 14 of the others', (() => {
  const reserved = new Set(['A:0', 'A:1', 'B:0', 'B:1', 'C:0', 'C:1'])
  const rest = sel.context.filter((r) => !reserved.has(r.id)).map((r) => r.id)
  const want = scoreOrder.filter((r) => !reserved.has(r.id)).slice(0, 10).map((r) => r.id)
  return rest.length === 10 && rest.every((id, i) => id === want[i])
})(), 'non-reserved places are not the next-best by score')
ok('floor 2: incoming order preserved (indexes strictly increasing)', sel.context.every((r, i, a) => i === 0 || scoreOrder.findIndex((x) => x.id === r.id) > scoreOrder.findIndex((x) => x.id === a[i - 1].id)))
ok('floor 2: no duplicate ids', new Set(sel.context.map((r) => r.id)).size === sel.context.length)
ok('report names what changed: 2 added (C:0, C:1), 2 displaced', sel.report.added.length === 2 && sel.report.displaced.length === 2, JSON.stringify({ a: sel.report.added, d: sel.report.displaced }))
ok('report counts stream C: 0 before, 2 after', (() => { const c = sel.report.perStream.find((s) => s.stream === 'C'); return !!c && c.inContextBefore === 0 && c.inContextAfter === 2 })())
control('the plain prefix has stream C represented', countOf(plain, 'C') >= 2)

// degenerate cases are today's behaviour EXACTLY
ok('floor 0 returns exactly the plain prefix', JSON.stringify(selectAnswerContext(scoreOrder, perStream, 16, 0).context.map((r) => r.id)) === JSON.stringify(plain.map((r) => r.id)))
const balanced = [...mk('A', 3), ...mk('B', 3), ...mk('C', 3), ...mk('A', 20).map((r) => ({ id: 'A2' + r.id, stream: 'A' }))]
const balPer = [{ stream: 'A', ids: mk('A', 3).map((r) => r.id) }, { stream: 'B', ids: mk('B', 3).map((r) => r.id) }, { stream: 'C', ids: mk('C', 3).map((r) => r.id) }]
ok('every stream already holds 2+: the result is exactly the plain prefix', JSON.stringify(selectAnswerContext(balanced, balPer, 16, 2).context.map((r) => r.id)) === JSON.stringify(balanced.slice(0, 16).map((r) => r.id)))
ok('no perStream (router off): the plain prefix', selectAnswerContext(scoreOrder, undefined, 16, 2).context.length === 16 && selectAnswerContext(scoreOrder, undefined, 16, 2).report.reserved === 0)

// a floor that cannot fit is cut back and SAYS SO
const nine = Array.from({ length: 9 }, (_, i) => String.fromCharCode(65 + i))
const wide = nine.flatMap((s) => mk(s, 5))
const widePer = nine.map((s) => ({ stream: s, ids: mk(s, 5).map((r) => r.id) }))
const w = selectAnswerContext(wide, widePer, 16, 2)
ok('9 streams × floor 2 = 18 > 16: floor cut back to 1, stated in the report', w.report.floorApplied === 1 && w.context.length === 16, `floorApplied ${w.report.floorApplied}, len ${w.context.length}`)
ok('…and every one of the 9 streams still holds a place', nine.every((s) => countOf(w.context, s) >= 1))
control('floorApplied equals the requested floor when it cannot fit', w.report.floorApplied === 2)

// a stream with one hit reserves one
const thin = selectAnswerContext(scoreOrder, [...perStream.slice(0, 2), { stream: 'C', ids: ['C:5'] }], 16, 2)
ok('a stream with a single hit reserves that one', countOf(thin.context, 'C') === 1 && thin.context.some((r) => r.id === 'C:5'))

// ── orientation v2: a failure must say it failed ───────────────────────────────────────────────────────
async function v2checks() {
  const savedG = process.env.GEMINI_API_KEY, savedX = process.env.GROK_API_KEY
  delete process.env.GEMINI_API_KEY; delete process.env.GROK_API_KEY
  const o = await runOrientationV2({ input: 'a proposal about something', noiseFilter: true })
  ok('v2 with no keys: failed is true (never reads as "nothing is being argued")', o.failed === true)
  ok('v2 with no keys: both calls are recorded, each with its reason', o.calls.length === 2 && o.calls.every((c) => c.ok === false && !!c.reason), JSON.stringify(o.calls.map((c) => c.reason)))
  const empty = await runOrientationV2({ input: '   ' })
  ok('v2 with empty input: failed, no calls, no throw', empty.failed === true && empty.calls.length === 0)
  const web = await runOrientationV2({ input: 'x', x: false })
  ok('v2 with X switched off: only the web call is recorded', web.calls.length === 1 && web.calls[0].call === 'v2-web')
  if (savedG) process.env.GEMINI_API_KEY = savedG
  if (savedX) process.env.GROK_API_KEY = savedX
  control('a failed run claims success', o.failed === false)

  const fake = (v: Partial<OrientationV2['vocabulary']>, failed = false): OrientationV2 => ({
    version: 2, ranAt: '', noiseFilter: true, arguments: [], dropped: [], merged: 0, calls: [], failed, xCapExceeded: false, totalMs: 0, totalCostUsd: 0,
    vocabulary: { keyTerms: [], statutoryTerms: [], people: ['A Person'], organisations: [], places: ['A Place'], ...v },
  })
  const t = termsForSearch(fake({ statutoryTerms: ['The Example Act 1999'], keyTerms: ['term one', 'Term One', 'term two'], organisations: ['Some Regulator'] }))
  ok('termsForSearch: statutory terms first, then key terms, then organisations; case-duplicates collapsed; people and places excluded', JSON.stringify(t) === JSON.stringify(['The Example Act 1999', 'term one', 'term two', 'Some Regulator']), JSON.stringify(t))
  ok('termsForSearch: a failed orientation yields no terms', termsForSearch(fake({ keyTerms: ['x'] }, true)).length === 0)
  ok('termsForSearch: cap holds', termsForSearch(fake({ keyTerms: Array.from({ length: 40 }, (_, i) => 't' + i) }), 20).length === 20)
}

// ── reached? (CLAUDE.md §23.1) ─────────────────────────────────────────────────────────────────────────
const root = path.join(__dirname, '..')
const src = (f: string) => fs.readFileSync(path.join(root, f), 'utf8')
function reached() {
  const build = src('lib/lex/build.ts')
  ok('build.ts imports orientation v2', /from '\.\/orientation\/v2'/.test(build))
  ok("build.ts's ORIENT pass CALLS runOrientationV2 (the call v1 never had)", /async function orientPass[\s\S]*?runOrientationV2\(/.test(build))
  ok('build.ts hands the stage-2 terms to runSearch as extraTerms', /extraTerms/.test(build.slice(build.indexOf('async function orientPass'))))
  ok('runSearch passes extraTerms to the router in BOTH routing branches', (src('lib/lex/search-gateway.ts').match(/q\.extraTerms/g) ?? []).length >= 3)
  ok('the router puts the terms in its user message', /Further vocabulary the wider debate uses/.test(src('lib/lex/query-expansion.ts')))
  ok('general-chat.ts calls selectAnswerContext behind the flag', /answerStreamFloorEnabled\(\)\s*\?\s*selectAnswerContext/.test(src('lib/lex/general-chat.ts')))
  const routes = fs.readdirSync(path.join(root, 'app/api'), { recursive: true }) as string[]
  let importer = false
  for (const f of routes) if (/route\.ts$/.test(f) && /lib\/lex\/general-chat|runGeneralCorpusChat/.test(src('app/api/' + f))) { importer = true; break }
  ok('general-chat.ts is imported by an API route (so the floor can reach a user)', importer)
  const flags = src('lib/env-flags.ts')
  for (const f of ['LEX_ORIENTATION_V2', 'LEX_ORIENTATION_TERMS', 'LEX_ANSWER_STREAM_FLOOR']) ok(`${f} is a registered capability flag`, new RegExp(`'${f}'`).test(flags))
  control('the reached-assertion would pass for a function build.ts never calls', /async function orientPass[\s\S]*?thisFunctionDoesNotExist\(/.test(build))
}

async function main() {
  await v2checks()
  reached()
  console.log(`\ncheck:search-29 — ${pass} passed, ${fail} failed · controls: ${controlsFired} fired, ${controlsDead} dead`)
  process.exit(fail || controlsDead ? 1 : 0)
}
main()
