/**
 * verify-stream-scoping.ts — prove that per-stream vector fusion changes the LEGISLATION
 * stream and NOTHING ELSE.
 *
 * This is the acceptance check for docs/SPRINT.md "confirm the scoping holds". The claim it
 * has to establish is negative — "no other stream moved" — and a negative claim is exactly the
 * kind that gets asserted rather than tested. So this runs the REAL retrieval path for every
 * stream, twice (flag off, flag on), and diffs the actual result id sequences.
 *
 * The dense half is served by a LOCAL stand-in HTTP service rather than a mock, because the
 * thing most likely to be wrong is the wire contract between the gateway and the vector
 * service — tier being dropped, or echoed back unchanged — and a mock of runVectorSearch would
 * skip precisely that. The stand-in deliberately answers with ids drawn from the live FTS
 * results, so hydration against corpus_sections succeeds and the fused output is comparable.
 *
 * Run from scrutinise-web:
 *   FTS_SEARCH_URL=https://fts-serve-production.up.railway.app \
 *     npx tsx --tsconfig tsconfig.json scripts/verify-stream-scoping.ts
 */
import http from 'http'
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../.env') })

// Which stream is under test. Rows 4-7 of the 6 Aug bundle each need the identical check
// for their own stream, so the stream and its probe query are parameters, not constants.
const TARGET = (process.argv.find((a) => a.startsWith('--stream='))?.split('=')[1] ?? 'legislation')
const PROBES: Record<string, string> = {
  legislation: 'data protection',
  debates: 'universal credit rollout',
  committees: 'committee inquiry evidence',
  caselaw: 'judicial review unreasonable',
  guidance: 'complaints handling',
}
const QUERY = process.argv.find((a) => a.startsWith('--query='))?.split('=')[1] ?? PROBES[TARGET] ?? 'data protection'
const LIMIT = 8

/** Vector hits the stand-in will return, filled from live FTS results before the run. */
let standInHits: { id: string; corpus: string; tier: string; score: number; snippet: string }[] = []
/** Every tier the stand-in was asked for, so we can prove the scoping reached the wire. */
const tiersRequested: (string | null)[] = []
/** Every corpus scope the stand-in was asked for. Since 2026-08-06 the parliamentary tier is
 *  split server-side by corpus, so "the scoping reached the wire" is no longer answered by the
 *  tier alone — debates and committees BOTH send tier='parliamentary' and differ only here. */
const scopesRequested: { corpora: string[] | null; excludeCorpora: string[] | null }[] = []

function startStandIn(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => { raw += c })
      req.on('end', () => {
        const { tier, corpora, excludeCorpora } = JSON.parse(raw || '{}')
        tiersRequested.push(tier ?? null)
        scopesRequested.push({ corpora: corpora ?? null, excludeCorpora: excludeCorpora ?? null })
        // Honour the scope the way the real service does — including echoing it back, which
        // the adapter now REQUIRES (it refuses unscoped results for a scoped request). A
        // stand-in that echoed without filtering would pass the adapter's check while proving
        // nothing about the filter, so it does both.
        let hits = tier ? standInHits.filter((h) => h.tier === tier) : standInHits
        if (corpora?.length) hits = hits.filter((h) => corpora.includes(h.corpus))
        if (excludeCorpora?.length) hits = hits.filter((h) => !excludeCorpora.includes(h.corpus))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          query: QUERY, tier: tier ?? null,
          corpora: corpora ?? null, excludeCorpora: excludeCorpora ?? null,
          ms: 1, count: hits.length, results: hits,
        }))
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

const ids = (rs: { id: string }[]) => rs.map((r) => r.id).join('|')

async function main() {
  if (!process.env.FTS_SEARCH_URL) {
    console.error('FTS_SEARCH_URL must be set — otherwise runFtsSearch falls back to the stub and this proves nothing.')
    process.exit(1)
  }

  const standIn = await startStandIn()
  process.env.VECTOR_SEARCH_URL = standIn.url

  // Import AFTER env is set: vector-search.ts reads VECTOR_SEARCH_URL at module load.
  const { STREAMS, perStreamVectorActive } = await import('../lib/lex/query-router')

  // ── pass 1: flag OFF (the default) ──────────────────────────────────────────
  delete process.env.LEX_VECTOR_STREAMS
  console.log(`perStreamVectorActive() with flag unset: ${perStreamVectorActive()}  (must be false)`)
  const before: Record<string, string> = {}
  for (const s of STREAMS) before[s.name] = ids(await s.search(QUERY, LIMIT))

  // Seed the stand-in from the legislation stream's own live results, reversed, so fusion has
  // something real to reorder. Reversing guarantees the fused order MUST differ if fusion ran.
  const target = STREAMS.find((s) => s.name === TARGET)
  if (!target) { console.error(`unknown stream "${TARGET}"`); process.exit(1) }
  const tgtHits = await target.search(QUERY, LIMIT)
  standInHits = tgtHits.slice().reverse().map((r, i) => ({
    // The corpus MUST be the hit's real one, parsed from the id (`corpus:doc:ref`). A
    // placeholder here silently broke the committees check: corpusToType('x','parliamentary')
    // resolves to DEBATE, so committees' types:['COMMITTEE'] filter discarded every dense hit
    // and the stream looked unchanged — a harness bug that reads exactly like a scoping bug.
    id: r.id, corpus: r.id.split(':')[0], tier: target.tier, score: 1 - i * 0.01, snippet: '',
  }))
  console.log(`stand-in seeded with ${standInHits.length} ${TARGET} vectors (live ids, reversed order)`)

  // ── pass 2: flag ON, legislation only ───────────────────────────────────────
  process.env.LEX_VECTOR_STREAMS = TARGET
  console.log(`perStreamVectorActive() with flag=${TARGET}: ${perStreamVectorActive()}  (must be true)`)
  const after: Record<string, string> = {}
  for (const s of STREAMS) after[s.name] = ids(await s.search(QUERY, LIMIT))

  standIn.close()

  // ── verdict ─────────────────────────────────────────────────────────────────
  console.log('\n stream        flag OFF vs flag ON')
  let failures = 0
  for (const s of STREAMS) {
    const changed = before[s.name] !== after[s.name]
    // The flag keys on stream NAME, so exactly one stream may change — even where two share
    // a tier (debates/committees both sit on `parliamentary`). That is the property under test.
    const expected = s.name === TARGET
    const ok = changed === expected
    if (!ok) failures++
    console.log(
      `  ${s.name.padEnd(12)} ${changed ? 'CHANGED' : 'identical'}` +
      `  ${ok ? '✓' : '✗ EXPECTED ' + (expected ? 'CHANGED' : 'identical')}` +
      `  (${before[s.name].split('|').filter(Boolean).length} → ${after[s.name].split('|').filter(Boolean).length} results)`,
    )
  }

  const nonLegTiers = tiersRequested.filter((t) => t !== target.tier)
  console.log(`\n  dense service called with tiers: ${JSON.stringify([...new Set(tiersRequested)])}`)
  if (nonLegTiers.length) {
    console.log(`  ✗ the dense service was queried for a tier other than ${target.tier}: ${JSON.stringify(nonLegTiers)} — scoping leaked`)
    failures++
  } else if (tiersRequested.length === 0) {
    console.log('  ✗ the dense service was never called — the fusion path did not run, so this proves nothing')
    failures++
  } else {
    console.log(`  ✓ the dense service was only ever asked for tier=${target.tier}`)
  }

  // The corpus scope must also have reached the wire, and must match what the stream declares.
  // For debates and committees the tier check above is satisfied by BOTH streams, so without
  // this a committees run that silently searched the whole parliamentary tier would still
  // report "scoping confirmed".
  const expectCorpora = target.corpora ?? null
  const expectExclude = target.excludeCorpora ?? null
  const sameList = (a: string[] | null, b: string[] | null) =>
    JSON.stringify(a ? [...a].sort() : null) === JSON.stringify(b ? [...b].sort() : null)
  const wrongScope = scopesRequested.filter(
    (s) => !sameList(s.corpora, expectCorpora) || !sameList(s.excludeCorpora, expectExclude),
  )
  console.log(`  dense service called with corpus scopes: ${JSON.stringify(scopesRequested.map((s) => s.corpora ?? s.excludeCorpora ?? null).filter((v, i, a) => a.indexOf(v) === i))}`)
  if (wrongScope.length) {
    console.log(`  ✗ expected corpora=${JSON.stringify(expectCorpora)} excludeCorpora=${JSON.stringify(expectExclude)}, got ${JSON.stringify(wrongScope[0])} — corpus scoping leaked`)
    failures++
  } else {
    console.log(`  ✓ the dense service was only ever asked for this stream's corpus scope`)
  }

  console.log(failures === 0 ? '\nSCOPING CONFIRMED' : `\nSCOPING NOT CONFIRMED — ${failures} failure(s)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
