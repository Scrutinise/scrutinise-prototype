/**
 * check-score-scope.ts — the cross-stream score landmine, and the invariant that stops it
 * coming back (BRIEF_SEARCH_S2B §0).
 *
 * THE DEFECT. `fuseWeightedRrf` overwrites `score` with a reciprocal-rank value (≈0.008–0.016)
 * while an unfused stream carries raw BM25 (≈5–25). `groupForPanel` opened with a global
 * `sort((a,b) => b.score - a.score)`. So with per-stream vector on for SOME streams — which is
 * exactly what `LEX_VECTOR_STREAMS=legislation` does today and what Stage 2C widens — every
 * fused hit sorted below every unfused hit, and the panel's 20-cap then clipped the fused
 * stream off the end. Nothing threw. The only symptom was a stream quietly missing.
 *
 * WHAT THIS CHECK DOES, in the order that matters:
 *   1. Proves the runtime assertion can FAIL. `assertSingleScorer` on a mixed list must throw;
 *      a check trusted to pass without ever being seen to fail is worth nothing (the stale
 *      `check:flags` assertion had been failing for a day against correct code — the reverse
 *      error is worse and quieter).
 *   2. Reproduces the OLD `groupForPanel` verbatim (`groupForPanelPreFix` below) and measures
 *      what it does to a Stage-2C-shaped list, against what the shipped one does. Same input,
 *      two functions, one number each — the S2A `--pre-fix` discipline.
 *   3. Asserts the fix changes NOTHING for single-scorer input, which is every call today.
 *   4. The SOURCE invariant: no file may sort by `.score` except score-scope.ts. That is the
 *      half that outlives this sprint — the instance is fixed by (2), the class by (4).
 *
 * Usage: npm run check:score-scope
 */
import fs from 'fs'
import path from 'path'
import { assertSingleScorer, sortByScore, scorersIn, type ScorerId } from '../lib/lex/score-scope'
import { groupForPanel } from '../lib/lex/search-stub'
import { fuseWeightedRrf } from '../lib/lex/fusion'
import type { SearchResult, SearchResultType } from '../lib/lex/page1-config'

let passed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(title: string) { console.log(`\n${title}`) }

// ── the fixture ──────────────────────────────────────────────────────────────
// Shaped like what the routed path actually hands `groupForPanel` with
// LEX_VECTOR_STREAMS=legislation: five streams, interleaved round-robin (interleave.ts), of
// which ONE is fused and four are not. Seven display types are present because the legislation
// stream returns Acts, SIs and retained/EU law — that is the ordinary case, not a contrived one,
// and 7 types × ≤3 = 21 candidates for 20 slots is where the cap starts biting.
function hit(id: string, type: SearchResultType, score: number, scorer: ScorerId): SearchResult {
  return { id, type, title: id, citation: id, snippet: '', score, scorer, url: '', date: '' }
}

/** One stream's ranking: `n` hits, descending in its own scorer's units. */
function stream(prefix: string, types: SearchResultType[], top: number, step: number, scorer: ScorerId, n = 6): SearchResult[] {
  return Array.from({ length: n }, (_, i) =>
    hit(`${prefix}-${i + 1}`, types[i % types.length], top - i * step, scorer))
}

function buildStage2cList(): SearchResult[] {
  // legislation, FUSED — RRF units. The other four are raw BM25 and score 400–2,000× higher.
  // 9 legislation hits so all three of its display types can fill their ≤3 buckets: that is what
  // puts 21 candidates in front of a 20-slot cap, which is where the clip lives.
  const legislation = stream('leg', ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION'], 0.0163, 0.0004, 'rrf', 9)
  const debates = stream('deb', ['DEBATE'], 22.4, 1.1, 'bm25')
  const committees = stream('com', ['COMMITTEE'], 19.8, 0.9, 'bm25')
  const caselaw = stream('cas', ['CASE_LAW'], 17.2, 0.8, 'bm25')
  const guidance = stream('gui', ['GUIDANCE'], 15.6, 0.7, 'bm25')
  // Round-robin, as interleave.ts leaves it (floor 2 then rank-by-rank, exhausted streams skipped).
  const streams = [legislation, debates, committees, caselaw, guidance]
  const out: SearchResult[] = []
  for (const s of streams) out.push(...s.slice(0, 2))
  const longest = Math.max(...streams.map((s) => s.length))
  for (let r = 2; r < longest; r++) for (const s of streams) if (s[r]) out.push(s[r])
  return out
}

/**
 * THE DELETED CODE, kept runnable. A verbatim copy of `groupForPanel` as it stood before
 * 2026-08-09 — the global cross-stream score sort, the ≤3-per-type buckets, the type-blocked
 * flatten, the 20-cap. Nothing else in the tree may call this; it exists so the old behaviour
 * stays measurable rather than remembered (S2A's `--pre-fix`, same reasoning).
 */
function groupForPanelPreFix(results: SearchResult[]): SearchResult[] {
  const PER_TYPE_CAP = 3, TOTAL_CAP = 20
  const byType = new Map<SearchResultType, SearchResult[]>()
  for (const r of [...results].sort((a, b) => b.score - a.score)) {
    const arr = byType.get(r.type) ?? []
    if (arr.length < PER_TYPE_CAP) { arr.push(r); byType.set(r.type, arr) }
  }
  return Array.from(byType.values()).flat().slice(0, TOTAL_CAP)
}

// ── 1. the assertion must be able to FAIL ────────────────────────────────────
section('the runtime assertion — proven to fail BEFORE it is trusted to pass')
{
  const mixed = [hit('a', 'DEBATE', 12.4, 'bm25'), hit('b', 'PRIMARY_LEGISLATION', 0.0161, 'rrf')]
  let threw: Error | null = null
  try { assertSingleScorer(mixed, 'check') } catch (e) { threw = e as Error }
  ok('mixed bm25 + rrf THROWS', threw !== null)
  ok('the message names both scorers', !!threw?.message.includes('bm25') && !!threw?.message.includes('rrf'))
  ok('the message says why, not just what', !!threw?.message.includes('not comparable'))

  let sortThrew: Error | null = null
  try { sortByScore(mixed, 'check') } catch (e) { sortThrew = e as Error }
  ok('sortByScore refuses the same list', sortThrew !== null)

  // …and does not cry wolf.
  const pure = [hit('a', 'DEBATE', 12.4, 'bm25'), hit('b', 'COMMITTEE', 9.1, 'bm25')]
  let falsePositive: Error | null = null
  try { assertSingleScorer(pure, 'check') } catch (e) { falsePositive = e as Error }
  ok('a single-scorer list passes', falsePositive === null, falsePositive?.message)
  ok('an empty list passes', (() => { try { assertSingleScorer([], 'check'); return true } catch { return false } })())
  ok('sortByScore orders descending and does not mutate', (() => {
    const input = [hit('a', 'DEBATE', 3, 'bm25'), hit('b', 'DEBATE', 9, 'bm25')]
    const out = sortByScore(input, 'check')
    return out[0].id === 'b' && input[0].id === 'a'
  })())
  ok('scorersIn reports the mix in first-appearance order', scorersIn(mixed).join(',') === 'bm25,rrf')
}

// ── 2. fuseWeightedRrf must ADMIT to overwriting the score ───────────────────
section('the overwrite is now visible on the result')
{
  const vec = [hit('x', 'PRIMARY_LEGISLATION', 0.83, 'vector'), hit('y', 'PRIMARY_LEGISLATION', 0.79, 'vector')]
  const bm25 = [hit('y', 'PRIMARY_LEGISLATION', 18.2, 'bm25'), hit('z', 'PRIMARY_LEGISLATION', 11.5, 'bm25')]
  const fused = fuseWeightedRrf(vec, bm25)
  ok('every fused result is stamped rrf', fused.every((r) => r.scorer === 'rrf'), scorersIn(fused).join(','))
  ok('the fused score really is ~0.01, not the BM25 it replaced',
     fused.every((r) => r.score < 0.05), fused.map((r) => r.score.toFixed(4)).join(', '))
  ok('a fused list is therefore self-consistently sortable', (() => {
    try { sortByScore(fused, 'check'); return true } catch { return false }
  })())
}

// ── 3. THE REGRESSION, measured on both functions ────────────────────────────
section('groupForPanel — the Stage-2C list, old behaviour vs shipped')
{
  const input = buildStage2cList()
  const fusedIn = input.filter((r) => r.scorer === 'rrf').length
  const before = groupForPanelPreFix(input)
  const after = groupForPanel(input)
  const fusedBefore = before.filter((r) => r.scorer === 'rrf').length
  const fusedAfter = after.filter((r) => r.scorer === 'rrf').length
  const posBefore = before.findIndex((r) => r.scorer === 'rrf') + 1
  const posAfter = after.findIndex((r) => r.scorer === 'rrf') + 1

  console.log(`     input: ${input.length} hits, ${fusedIn} fused (legislation) / ${input.length - fusedIn} unfused`)
  console.log(`     PRE-FIX : ${before.length} shown, ${fusedBefore} fused, first fused at position ${posBefore}`)
  console.log(`     SHIPPED : ${after.length} shown, ${fusedAfter} fused, first fused at position ${posAfter}`)

  const first10Before = before.slice(0, 10).filter((r) => r.scorer === 'rrf').length
  const first10After = after.slice(0, 10).filter((r) => r.scorer === 'rrf').length
  console.log(`     fused hits in the first 10 slots: PRE-FIX ${first10Before}, SHIPPED ${first10After}`)

  ok('PRE-FIX: the fused stream is pushed behind every unfused hit', posBefore >= 13, `position ${posBefore}`)
  ok('PRE-FIX: it gets NO representation in the first 10 slots', first10Before === 0, `${first10Before}`)
  ok('PRE-FIX: the 20-cap then drops a fused hit and only a fused hit',
     before.length === 20 && fusedBefore === fusedIn - 1, `${fusedBefore} of ${fusedIn} fused candidates survived`)
  ok('SHIPPED: the fused stream leads, because the incoming list is stream-balanced', posAfter === 1)
  ok('SHIPPED: it is represented in the first 10 slots', first10After >= 2, `${first10After}`)
  // Same one hit falls off the end in this fixture — 21 candidates, 20 slots — but for a
  // different reason: pre-fix it is chosen by an incomparable score, shipped it is simply the
  // last of a balanced order. The clip-to-ZERO case is the fixture below.
  ok('SHIPPED: the cap drops the tail of the balanced order, not a stream',
     fusedAfter === fusedIn - 1 && !after.some((r) => r.id === `leg-${fusedIn}`), `${fusedAfter} of ${fusedIn}`)
  ok('SHIPPED: still ≤3 per display type', (() => {
    const n = new Map<string, number>()
    for (const r of after) n.set(r.type, (n.get(r.type) ?? 0) + 1)
    return [...n.values()].every((v) => v <= 3)
  })())
  ok('SHIPPED: still capped at 20', after.length === 20)
  ok('SHIPPED: every one of the five streams reaches the panel', (() => {
    const prefixes = new Set(after.map((r) => r.id.split('-')[0]))
    return ['leg', 'deb', 'com', 'cas', 'gui'].every((p) => prefixes.has(p))
  })())
  ok('SHIPPED: the kept hits appear in the incoming order, unreordered', (() => {
    const kept = new Set(after.map((r) => r.id))
    return input.filter((r) => kept.has(r.id)).map((r) => r.id).join(',') === after.map((r) => r.id).join(',')
  })())
}

// ── 3b. the "clipped out entirely" case — one stream away, not hypothetical ──
section('groupForPanel — a wider unfused side clips the fused stream to ZERO')
{
  // The fixture above is today's shape: four unfused streams spanning four display types, so
  // they can only claim 4×3 = 12 of the 20 slots and the fused stream still gets the rest — the
  // harm there is ordering. The moment the unfused side spans SEVEN display types (a sixth
  // stream, or the untiered fail-open path where BILL/TREATY/EU rows are not filtered out by
  // corpus) the unfused side alone fills 21 slots and the fused stream gets NOTHING. That is the
  // brief's "clipped out of the panel's 20-cap entirely", made a number rather than a worry.
  const fused = stream('leg', ['PRIMARY_LEGISLATION'], 0.0163, 0.0004, 'rrf', 6)
  const wideUnfused = ([
    ['deb', 'DEBATE'], ['com', 'COMMITTEE'], ['cas', 'CASE_LAW'], ['gui', 'GUIDANCE'],
    ['bil', 'BILL'], ['tre', 'TREATY'], ['eul', 'EU_LEGISLATION'],
  ] as Array<[string, SearchResultType]>).map(([p, t], i) => stream(p, [t], 22 - i, 0.5, 'bm25', 3))
  const input = [...fused.slice(0, 2), ...wideUnfused.flatMap((s) => s.slice(0, 2)),
                 ...fused.slice(2), ...wideUnfused.flatMap((s) => s.slice(2))]
  const before = groupForPanelPreFix(input)
  const after = groupForPanel(input)
  const fusedBefore = before.filter((r) => r.scorer === 'rrf').length
  const fusedAfter = after.filter((r) => r.scorer === 'rrf').length
  console.log(`     input: ${input.length} hits (${fused.length} fused) across 8 display types`)
  console.log(`     PRE-FIX : ${fusedBefore} fused hits reach the panel`)
  console.log(`     SHIPPED : ${fusedAfter} fused hits reach the panel`)
  ok('PRE-FIX: the fused stream is erased from the panel entirely', fusedBefore === 0, `${fusedBefore}`)
  ok('SHIPPED: the fused stream keeps its ≤3-per-type share', fusedAfter === 3, `${fusedAfter}`)
  ok('SHIPPED: still capped at 20 and ≤3 per type', after.length === 20 && (() => {
    const n = new Map<string, number>()
    for (const r of after) n.set(r.type, (n.get(r.type) ?? 0) + 1)
    return [...n.values()].every((v) => v <= 3)
  })())
}

// ── 4. and it changes nothing for a single-scorer list ───────────────────────
section('no behaviour change on the single-scorer path (i.e. every call today)')
{
  // The unrouted path hands over one stream's BM25 ranking, already in score order — which is
  // what the old sort reproduced. Old and new outputs must be byte-identical.
  const bm25Only = stream('one', ['PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'DEBATE', 'COMMITTEE', 'CASE_LAW', 'GUIDANCE'], 24.0, 0.4, 'bm25', 30)
  const before = groupForPanelPreFix(bm25Only).map((r) => r.id)
  const after = groupForPanel(bm25Only).map((r) => r.id)
  ok('same ids kept', [...before].sort().join(',') === [...after].sort().join(','),
     `pre-fix ${before.length} / shipped ${after.length}`)
  ok('same count', before.length === after.length)
  // Order DOES differ: pre-fix emitted type blocks, shipped emits rank order. State it rather
  // than hide it — the 20-cap now drops the weakest tail instead of the last type entirely.
  const beforeTypes = groupForPanelPreFix(bm25Only).map((r) => r.type)
  const afterTypes = groupForPanel(bm25Only).map((r) => r.type)
  ok('pre-fix emitted TYPE BLOCKS', new Set(beforeTypes.slice(0, 3)).size === 1)
  ok('shipped emits rank order, so no display type is clipped wholesale',
     new Set(afterTypes).size >= new Set(beforeTypes).size,
     `pre-fix ${new Set(beforeTypes).size} types / shipped ${new Set(afterTypes).size} types`)
}

// ── 5. THE SOURCE INVARIANT ──────────────────────────────────────────────────
section('source invariant — nothing sorts by score except score-scope.ts')
{
  const root = path.join(__dirname, '..')
  const SKIP = new Set(['node_modules', '.next', '.git', 'generated', 'prisma'])
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)) }
      else if (/\.tsx?$/.test(e.name)) files.push(path.join(dir, e.name))
    }
  }
  walk(root)

  // The helper itself, and this check (which reproduces the deleted code on purpose).
  const ALLOWED = new Set([
    path.resolve(root, 'lib/lex/score-scope.ts'),
    path.resolve(root, 'scripts/check-score-scope.ts'),
  ].map((p) => path.resolve(p)))

  const offenders: string[] = []
  for (const f of files) {
    if (ALLOWED.has(path.resolve(f))) continue
    const src = fs.readFileSync(f, 'utf8')
    src.split('\n').forEach((line, i) => {
      // A comparator whose body compares `.score` on both sides — the exact shape deleted from
      // groupForPanel. Comment lines are exempt: the reason this exists is written down in
      // several of them, and a doc comment is not a code path.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      if (/\.sort\s*\([^)]*\)\s*=>[^\n]*\.score[^\n]*[-<>][^\n]*\.score/.test(line)) {
        offenders.push(`${path.relative(root, f)}:${i + 1}  ${line.trim()}`)
      }
    })
  }
  ok(`no bare sort-by-score outside the helper (${files.length} files scanned)`,
     offenders.length === 0, offenders.join(' | '))

  // Prove THAT assertion can fail too: the same regex against the deleted line.
  const deleted = '  for (const r of [...results].sort((a, b) => b.score - a.score)) {'
  ok('the detector matches the line that was deleted (so it is not a no-op regex)',
     /\.sort\s*\([^)]*\)\s*=>[^\n]*\.score[^\n]*[-<>][^\n]*\.score/.test(deleted))

  // Every retrieval path must stamp a scorer, and the field must be REQUIRED so tsc is the
  // enforcement rather than reviewer attention.
  const cfg = fs.readFileSync(path.join(root, 'lib/lex/page1-config.ts'), 'utf8')
  ok('SearchResult.scorer is required, not optional', /^\s*scorer: ScorerId\s*$/m.test(cfg))
  const STAMPS: Array<[string, string]> = [
    ['lib/lex/fts-search.ts', "scorer: 'bm25'"],
    ['lib/lex/vector-search.ts', "scorer: 'vector'"],
    ['lib/lex/fusion.ts', "scorer: 'rrf'"],
    ['lib/lex/search-stub.ts', "scorer: 'stub'"],
  ]
  for (const [file, stamp] of STAMPS) {
    ok(`${file} stamps ${stamp}`, fs.readFileSync(path.join(root, file), 'utf8').includes(stamp))
  }
  const stub = fs.readFileSync(path.join(root, 'lib/lex/search-stub.ts'), 'utf8')
  ok('groupForPanel no longer sorts at all', !/groupForPanel[\s\S]{0,900}?\.sort\(/.test(stub))
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
