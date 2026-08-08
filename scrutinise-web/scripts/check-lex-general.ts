/**
 * check-lex-general.ts — the check for the general corpus chat (/admin/lex-general).
 *
 * Two kinds of assertion, and the first is the one that would actually catch a
 * regression:
 *
 *  1. SOURCE INVARIANTS. The surface exists BECAUSE it bypasses the idea structure,
 *     so the things that must stay true of it are structural, not behavioural: it
 *     goes through the search gateway and nothing else, it never sets a tier (a
 *     tier-scoped call takes the branch that skips fusedStream entirely, which would
 *     silently make this a worse test surface than the thing it is testing), and it
 *     touches no idea data. A behavioural test cannot see any of those; a grep can.
 *
 *  2. A LIVE TURN, when the environment can serve one. Built-inert is how the stats
 *     layer shipped six bugs in a tsc-clean build, so this runs a real question
 *     against the real index and the real model, then asserts the answer only cites
 *     things that were actually retrieved.
 *
 * Usage:
 *   npm run check:lex-general                 # source invariants + one live turn
 *   npm run check:lex-general -- --offline    # source invariants only
 *   npm run check:lex-general -- --q "your own question"
 *
 * NOTE: a live turn increments `served` on fts-serve (and, once dense engages,
 * vector-serve). Those counters are the evidence of record for whether production
 * traffic is reaching the services — so if you run this while a measurement is in
 * flight, say so, or a check run will read as a user.
 */
import fs from 'fs'
import path from 'path'
import { runGeneralCorpusChat } from '../lib/lex/general-chat'

let passed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(title: string) { console.log(`\n${title}`) }

const root = path.join(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

/**
 * Code only — block comments and whole-line `//` comments removed.
 *
 * These files explain themselves at length, and several of the invariants below are
 * phrased as "this file must never mention X", which the prose violates while the
 * code does not. Grepping the comments would make the check fail for saying WHY the
 * rule exists, which is the one thing that would get the comment deleted. Trailing
 * comments are left alone so a `https://` inside a string is never truncated.
 */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const args = process.argv.slice(2)
const offline = args.includes('--offline')
const qIndex = args.indexOf('--q')
const QUESTION =
  qIndex >= 0 && args[qIndex + 1]
    ? args[qIndex + 1]
    // Cross-cutting on purpose: legislation, committee scrutiny and case law all
    // plausibly hold something. With the router live this should dispatch to 2+
    // streams; with it dark it makes exactly one unfiltered call. That difference
    // is the whole reason this page was built.
    : 'What powers do regulators have to compel disclosure of information from companies, and how has that been scrutinised?'

// ── 1. it retrieves through the gateway, and only through the gateway ────────
section('retrieval path')
{
  const src = code('lib/lex/general-chat.ts')
  ok('imports runSearch from the search gateway', /import \{ runSearch[\s\S]{0,80}from '\.\/search-gateway'/.test(src))
  ok('calls runSearch', /await runSearch\(/.test(src))
  ok('does NOT call runFtsSearch directly', !/runFtsSearch/.test(src))
  ok('does NOT call runVectorSearch directly', !/runVectorSearch/.test(src))
  ok('does NOT call the legacy searchLegislation', !/searchLegislation/.test(src))
  // Untiered is load-bearing: search-gateway.ts's tier-scoped branch calls
  // runFtsSearch directly and never reaches fusedStream, so a tier here would make
  // this page exercise the ONE path it is meant to be a control for.
  ok('never passes a tier', !/\btier\s*:/.test(src))
  ok('uses the GENERAL_CORPUS_CHAT intent', /intent: 'GENERAL_CORPUS_CHAT'/.test(src))
}

// ── 2. no writes to idea data ────────────────────────────────────────────────
section('no idea data is read or written')
{
  const src = code('lib/lex/general-chat.ts')
  const route = code('app/api/admin/lex-general/route.ts')
  ok('general-chat.ts does not import prisma', !/from '@\/lib\/prisma'/.test(src))
  ok('general-chat.ts never touches prisma', !/prisma\./.test(src))
  ok('general-chat.ts never touches stageSearches', !/stageSearches/.test(src))
  ok('the route does not import prisma', !/from '@\/lib\/prisma'/.test(route))
  ok('the route never writes', !/\.update\(|\.create\(|\.upsert\(|\.delete\(/.test(route))
}

// ── 3. admin-gated ───────────────────────────────────────────────────────────
section('admin gate')
{
  const route = read('app/api/admin/lex-general/route.ts')
  ok('the route authenticates', /getAuthenticatedUser\(\)/.test(route))
  ok('the route checks the role itself', /\['ADMIN', 'SUPER_ADMIN'\]\.includes\(user\.role\)/.test(route))
  ok('the route validates its body with zod', /BodySchema\.safeParse/.test(route))
  ok('the route is rate limited', /checkRateLimit\(/.test(route))
  // The page's own gate is app/admin/layout.tsx — assert it still gates, because the
  // page carries no gate of its own and would be wide open if that layout moved.
  const layout = read('app/admin/layout.tsx')
  ok('app/admin/layout.tsx still role-gates everything under /admin',
    /\['ADMIN', 'SUPER_ADMIN'\]\.includes\(dbUser\.role\)/.test(layout))
  ok('the page lives under /admin so that gate applies', fs.existsSync(path.join(root, 'app/admin/lex-general/page.tsx')))
  // Middleware protects /api/admin(.*) — belt and braces with the in-route check.
  ok('middleware protects /api/admin', /'\/api\/admin\(\.\*\)'/.test(read('middleware.ts')))
}

// ── 4. a live turn ───────────────────────────────────────────────────────────
async function liveTurn() {
  section('live turn')
  const haveFts = !!process.env.FTS_SEARCH_URL?.trim()
  const haveKey = !!process.env.GEMINI_API_KEY?.trim()
  if (!haveFts) {
    console.log('  ! FTS_SEARCH_URL is not set in this environment — the turn will exercise the')
    console.log('    honest-failure path only. That path is worth checking, but it is NOT the')
    console.log('    happy path; set FTS_SEARCH_URL to test retrieval for real.')
  }
  if (!haveKey) console.log('  ! GEMINI_API_KEY is not set — expect a retrieval-only result.')

  console.log(`\n  Q: ${QUESTION}\n`)
  const t0 = Date.now()
  const out = await runGeneralCorpusChat({ question: QUESTION })
  const wallMs = Date.now() - t0
  const d = out.diagnostics

  console.log('  diagnostics:')
  console.log(`    streams:        ${d.routedStreams?.join(', ') ?? '(none — untiered single call)'}`)
  console.log(`    flags on:       ${Object.entries(d.flags).filter(([, v]) => v).map(([k]) => k).join(' ') || '(all off)'}`)
  console.log(`    expansion:      ${d.expansionAdded.join(' ') || '(none)'}`)
  console.log(`    retrieved:      ${d.retrieved} (${d.grouped} after grouping)`)
  console.log(`    search:         ${d.searchMs} ms${d.searchFailed ? `  FAILED — ${d.searchFailureReason}` : ''}`)
  console.log(`    answer:         ${d.answerMs ?? '—'} ms${d.answerFailureReason ? `  FAILED — ${d.answerFailureReason}` : ''}`)
  console.log(`    wall:           ${wallMs} ms`)
  if (out.results.length) {
    console.log('\n  top results:')
    for (const r of out.results.slice(0, 8)) {
      console.log(`    ${out.cited.includes(r.id) ? '*' : ' '} [${r.type}] ${(r.title || r.id).slice(0, 70)}  (${r.score.toFixed(3)})`)
    }
  }
  if (out.answer) console.log(`\n  answer:\n${out.answer.split('\n').map((l) => `    ${l}`).join('\n')}`)

  // Invariants that must hold whatever the environment could serve.
  ok('never throws', true)
  ok('a citation always points at something retrieved', d.droppedCitations.length === 0, d.droppedCitations.join(', '))
  ok('cited ids are all in the result set', out.cited.every((id) => out.results.some((r) => r.id === id)))
  ok('a failed search produces NO answer (never law from memory)', !(d.searchFailed && out.answer !== null))
  ok('a failed search returns no results either', !(d.searchFailed && out.results.length > 0))
  ok('an answer implies retrieval ran', !(out.answer !== null && d.searchFailed))
  if (haveFts && haveKey) {
    ok('retrieval returned something', d.retrieved > 0, 'the index answered with nothing at all')
    ok('an answer was produced', out.answer !== null, d.answerFailureReason ?? '')
    ok('only sources shown to Lex could be cited', d.contextCount > 0 && d.contextCount <= d.retrieved)
    // The regression from the first live run: the structured cited field came back empty under
    // an answer full of [n] markers, so the UI would have said "0 cited" about a fully-cited
    // answer. (That field is now citedMarkers, not citedIds — see ANSWER_SCHEMA.)
    if (out.answer && /\[\d+\]/.test(out.answer)) {
      ok('an answer with [n] markers resolves to at least one cited source', out.cited.length > 0)
    }
    // Since citations became markers there is only one way to drop one: pointing at a number
    // outside the range we showed. Every drop is therefore a real grounding failure and worth
    // naming in the run, rather than being averaged away.
    if (d.droppedCitations.length) {
      console.log(`  ⚠ cited source numbers never shown (range was [1..${d.contextCount}]): ${d.droppedCitations.join(', ')}`)
    }
    ok('no citation points outside the sources shown', d.droppedCitations.length === 0,
       d.droppedCitations.join(', '))
    // Not a pass/fail on routing — the flags are an environment fact, not this
    // module's behaviour — but it is the number the page exists to show.
    console.log(`\n  routing: ${d.routedStreams?.length ? `${d.routedStreams.length} stream(s) dispatched` : 'ROUTER NOT ENGAGED — one untiered call'}`)
  }
}

function report() {
  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
}

if (offline) {
  console.log('\n--offline: skipping the live turn')
  report()
} else {
  liveTurn().then(report, (err) => {
    // runGeneralCorpusChat is documented as never throwing. If it does, that IS the
    // finding — do not let it exit 0.
    console.error('\n  ✗ the turn threw, which it is contracted never to do:', err)
    process.exit(1)
  })
}
