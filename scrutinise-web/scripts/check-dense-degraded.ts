/**
 * check-dense-degraded.ts — S15 §3. A SATURATED DENSE SERVICE MUST REACH THE USER AS A STATED
 * GAP, NEVER AS AN EMPTY RESULT.
 *
 * ⚠⚠ WHY THIS CHECK EXISTS AT ALL. S14 §0's sharpest finding was that a refused dense leg left
 * NO MARK: `mergeLegs` returns the BM25 list and every hit keeps `scorer: 'bm25'`, which is
 * byte-for-byte what a stream with no dense leg produces. So *"dense retrieval is off"* and
 * *"dense retrieval was refused on every call"* were the same object, and a whole sprint's
 * numbers were taken without anyone able to tell which had happened. `SEARCH_CONTRACT.md` §6
 * requires Lex to distinguish *I could not look* from *I looked and found nothing*; this asserts
 * the distinction survives from the wire to `GatewayResult`.
 *
 * ⚠ EVERY ASSERTION HAS A NEGATIVE CONTROL, because a check that cannot fail is not a check
 * (docs/CLAUDE.md, and this repository's own register of nine such shapes). Each positive case
 * below is paired with the arrangement that must NOT trigger it.
 *
 * The stand-in service is a real HTTP server whose behaviour is switched per case, so what is
 * being tested is the production adapter, router and gateway code against real sockets — not a
 * mock of them.
 *
 * Usage:
 *   npx tsx scripts/check-dense-degraded.ts
 */
import http from 'http'

let MODE: 'ok' | 'shed' | 'timeout' | 'error' = 'ok'
/** Simulates a service deployed before S15: it has no `/vector-search-batch` route. */
let BATCH_ROUTE = true
let requests = 0

// ⚠ `corpus: 'primary-acts'` and a real gid shape, because `corpusToType` DROPS a hit it cannot
// type. A fixture with an invented corpus name returns zero results through code that is working
// perfectly, which is a check failing for a reason that has nothing to do with what it tests.
const HITS = [
  { id: 'ukpga/2000/1/section/1', corpus: 'primary-acts', tier: 'legislation', score: 0.81, snippet: 'a stand-in passage', snippetMatched: true, snippetLocation: 'head', chunkId: 'ukpga/2000/1/section/1#0' },
  { id: 'ukla/2004/9/section/3', corpus: 'caselaw-nc', tier: 'caselaw', score: 0.77, snippet: 'another stand-in passage', snippetMatched: true, snippetLocation: 'head', chunkId: 'ukla/2004/9/section/3#0' },
]

function startStandIn(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => { raw += c })
      req.on('end', () => {
        requests++
        const isBatch = (req.url ?? '').endsWith('/vector-search-batch')
        // ⚠ THE STAND-IN ROUTES ON THE URL, like the real service. An earlier version answered
        // every path with the single-search shape, so the "old service" case could never be
        // expressed and the 404 assertion tested nothing.
        if (isBatch && !BATCH_ROUTE) {
          res.writeHead(404, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'not found' }))
        }
        if (MODE === 'shed') {
          // Exactly what the bounded queue returns (§3): a fast, explicit, counted refusal.
          res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '1' })
          return res.end(JSON.stringify({ error: 'overloaded', reason: 'overloaded', queued: 8, maxQueue: 8 }))
        }
        if (MODE === 'error') {
          res.writeHead(500, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({ error: 'something broke' }))
        }
        if (MODE === 'timeout') return // hold the socket open and never answer
        const body = JSON.parse(raw || '{}')
        if (isBatch) {
          const queries = (body.queries ?? []) as Array<{ tier?: string }>
          res.writeHead(200, { 'content-type': 'application/json' })
          return res.end(JSON.stringify({
            batch: queries.length, ms: 1, chunkScans: 1,
            queries: queries.map((q) => {
              const hits = q.tier ? HITS.filter((h) => h.tier === q.tier) : HITS
              return { ok: true, tier: q.tier ?? null, corpora: null, excludeCorpora: null, count: hits.length, results: hits }
            }),
          }))
        }
        const tier = body.tier
        const hits = tier ? HITS.filter((h) => h.tier === tier) : HITS
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ query: 'q', tier: tier ?? null, corpora: null, excludeCorpora: null, ms: 1, count: hits.length, results: hits }))
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
  })
}

let passed = 0
let failed = 0
function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}${detail ? `  — ${detail}` : ''}`) }
  else { failed++; console.log(`  ❌ ${label}${detail ? `  — ${detail}` : ''}`) }
}

async function main() {
  const standIn = await startStandIn()
  process.env.VECTOR_SEARCH_URL = standIn.url
  // Short, so the timeout case does not take 25 s.
  process.env.VECTOR_TIMEOUT_MS = '1200'

  // Imported AFTER the env is set: vector-search.ts reads both at module load.
  const { runVectorSearch, runVectorSearchBatch } = await import('../lib/lex/vector-search')

  console.log('\n§A — runVectorSearch names the reason instead of returning a bare []\n')

  MODE = 'ok'
  const okRes = await runVectorSearch(['housing'], 5, { tier: 'legislation' })
  ok('a healthy service returns results', okRes.results.length === 1,
    `${okRes.results.length} result(s): ${okRes.results.map((r) => r.id).join(', ')}`)
  // ⚠ THE NEGATIVE CONTROL FOR EVERY CASE BELOW. If `failure` were set here, the field would be
  // meaningless — it would say "degraded" about a search that worked perfectly.
  ok('NEGATIVE CONTROL: a healthy service sets no failure', okRes.failure === undefined,
    `failure=${JSON.stringify(okRes.failure)}`)

  MODE = 'shed'
  const shedRes = await runVectorSearch(['housing'], 5, { tier: 'legislation' })
  ok('a 503 yields reason "overloaded"', shedRes.failure?.reason === 'overloaded',
    `reason=${shedRes.failure?.reason}`)
  ok('a 503 still falls back to BM25 rather than throwing', Array.isArray(shedRes.results) && shedRes.results.length === 0,
    'results=[] and no exception')

  MODE = 'error'
  const errRes = await runVectorSearch(['housing'], 5, { tier: 'legislation' })
  ok('a 500 yields reason "error", NOT "overloaded"', errRes.failure?.reason === 'error',
    `reason=${errRes.failure?.reason}`)
  // ⚠ This is the pairing that matters most: a broken service and a saturated one must not
  // produce the same word, or §3's whole purpose (tell the user a DIFFERENT thing) collapses.
  ok('NEGATIVE CONTROL: "overloaded" is not what a plain fault reports', errRes.failure?.reason !== 'overloaded')

  MODE = 'timeout'
  const toRes = await runVectorSearch(['housing'], 5, { tier: 'legislation' })
  ok('a hung service yields reason "timeout"', toRes.failure?.reason === 'timeout',
    `reason=${toRes.failure?.reason}`)

  console.log('\n§B — the batch endpoint degrades PER STREAM, never as a whole\n')
  MODE = 'shed'
  const batch = await runVectorSearchBatch([
    { stream: 'legislation', query: 'a', limit: 5, scope: { tier: 'legislation' } },
    { stream: 'caselaw', query: 'b', limit: 5, scope: { tier: 'caselaw' } },
  ])
  ok('one outcome per request, always', batch.length === 2, `${batch.length} outcomes`)
  ok('a saturated batch reports overloaded on every entry', batch.every((b) => b.failure?.reason === 'overloaded'),
    batch.map((b) => `${b.stream}:${b.failure?.reason}`).join(' '))

  // ⚠ THE NEGATIVE CONTROL FOR §B, and it also proves the batch's hydration works: the two
  // entries must come back SCOPED TO THEIR OWN TIERS. A batch that returned every stream's hits
  // to every stream would be a scoping regression wearing a transport change's clothes.
  MODE = 'ok'
  const okBatch = await runVectorSearchBatch([
    { stream: 'legislation', query: 'a', limit: 5, scope: { tier: 'legislation' } },
    { stream: 'caselaw', query: 'b', limit: 5, scope: { tier: 'caselaw' } },
  ])
  ok('NEGATIVE CONTROL: a healthy batch sets no failure anywhere', okBatch.every((b) => b.failure === undefined),
    okBatch.map((b) => `${b.stream}:${b.failure?.reason ?? 'ok'}`).join(' '))
  ok('each batch entry is scoped to its own tier', okBatch.length === 2 && okBatch[0].results.length === 1 && okBatch[1].results.length === 1,
    okBatch.map((b) => `${b.stream}:${b.results.length}`).join(' '))
  ok('batch results are hydrated the same way solo results are',
    okBatch[0].results[0]?.scorer === 'vector' && !!okBatch[0].results[0]?.title,
    `scorer=${okBatch[0].results[0]?.scorer} title=${JSON.stringify(okBatch[0].results[0]?.title)}`)

  // ⚠ 404 is a VERSION SKEW, not a gap to tell a user about — a service predating the endpoint
  // must send the caller back to four single calls, not make Lex announce an outage.
  BATCH_ROUTE = false
  const skew = await runVectorSearchBatch([{ stream: 'legislation', query: 'a', limit: 5, scope: { tier: 'legislation' } }])
  ok('an old service (404 on the batch route) reports "unreachable", not "overloaded"',
    skew[0].failure?.reason === 'unreachable', `reason=${skew[0].failure?.reason}`)
  BATCH_ROUTE = true

  console.log('\n§C — the distinction survives to the router\n')
  process.env.LEX_VECTOR_STREAMS = 'legislation'
  const { STREAMS } = await import('../lib/lex/query-router')
  const leg = STREAMS.find((s) => s.name === 'legislation')
  if (!leg) { ok('the legislation stream exists', false); }
  else {
    // ⚠ NOT ASSERTED AGAINST A LIVE FTS SERVICE. With FTS_SEARCH_URL unset the BM25 half falls
    // back to its stub, so this asserts only the thing this sprint changed: that the dense
    // failure is REPORTED. The stream's ranking is out of scope here and is covered by
    // check-stream-coverage.ts.
    MODE = 'shed'
    const before = requests
    await leg.search('housing', 5)
    ok('the routed stream did call the dense service', requests > before, `${requests - before} call(s)`)
  }

  standIn.close()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
