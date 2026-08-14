/**
 * v36-check-retryable-guard.ts — the guard added to enumerateSections, watched
 * failing before it is trusted to pass.
 *
 * Three scenarios, driven by a stubbed global fetch so no request reaches
 * legislation.gov.uk:
 *
 *   1. every format 503s          → MUST throw RetryableSourceError.
 *                                   Under the code this replaces it returned an
 *                                   `unavailable` marker reading
 *                                   "No CLML/HTML/PDF found on TNA" — a permanent
 *                                   claim about the document built out of a rate
 *                                   limit. That is the regression this pins.
 *   2. every format 404s          → MUST NOT throw; MUST return the `unavailable`
 *                                   marker. A deterministic miss is a real fact and
 *                                   must keep its old behaviour, or the fix trades
 *                                   one wrong answer for another.
 *   3. CLML returns real content  → MUST return parsed sections and never throw.
 *
 * Scenario 2 is the one that makes this a guard rather than a tripwire: it fails if
 * the fix is over-applied, and 1 fails if it is under-applied.
 *
 * Usage: tsx v36-check-retryable-guard.ts
 */
export {}  // module scope: without it TS puts main() in the global scope and clashes with every other script here
process.env.TNA_THROTTLE_FLOOR_MS = '1'

const REAL_CLML = `<?xml version="1.0" encoding="UTF-8"?>
<Legislation xmlns="http://www.legislation.gov.uk/namespaces/legislation">
 <Primary><Body>
  <P1group><Title>Short title</Title><P1><P1para><Text>This Act may be cited as the Test Act.</Text></P1para></P1></P1group>
 </Body></Primary>
</Legislation>`

type Scenario = { name: string; status: number | 'clml'; expect: 'throw' | 'unavailable' | 'sections' }

const SCENARIOS: Scenario[] = [
  { name: 'all formats 503 (rate limited)', status: 503, expect: 'throw' },
  { name: 'all formats 500 (upstream error)', status: 500, expect: 'throw' },
  { name: 'all formats 404 (genuine miss)', status: 404, expect: 'unavailable' },
  // V36 morning-after: `ukpga/Geo5Sess2/13/3` burned all five attempts and was
  // recorded as a rate-limit failure. It was a 300 Multiple Choices — the regnal id
  // is ambiguous between `Geo5/13/3` and `Geo5Sess2/13/3`, and the body says so.
  // `!res.ok` had swept it in with 5xx. An ambiguity never resolves by retrying, so
  // 300 belongs with 404 on the deterministic side.
  { name: 'all formats 300 (ambiguous id)', status: 300, expect: 'unavailable' },
  { name: 'CLML returns real content', status: 'clml', expect: 'sections' },
]

const realFetch = globalThis.fetch

function stub(scenario: Scenario) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (scenario.status === 'clml') {
      if (url.endsWith('/data.xml')) return new Response(REAL_CLML, { status: 200 })
      return new Response('', { status: 404 })
    }
    return new Response('', { status: scenario.status })
  }) as typeof fetch
}

async function main() {
  const { enumerateSections, RetryableSourceError } = await import('./sources/tna-legislation')
  let pass = 0, fail = 0

  for (const s of SCENARIOS) {
    stub(s)
    let got: string
    let detail = ''
    try {
      const secs = await enumerateSections('uksi/2099/1')
      const un = secs.find(x => x.format === 'unavailable')
      if (secs.filter(x => x.format !== 'unavailable' && x.format !== 'effects').length > 0) {
        got = 'sections'; detail = `${secs.length} section(s)`
      } else if (un) {
        got = 'unavailable'; detail = `errorMsg="${un.errorMsg}"`
      } else {
        got = 'empty'; detail = 'no sections and no marker'
      }
    } catch (e) {
      got = e instanceof RetryableSourceError ? 'throw' : 'threw-wrong-type'
      detail = String(e).slice(0, 110)
    }
    const ok = got === s.expect
    ok ? pass++ : fail++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.name.padEnd(34)} expected=${s.expect.padEnd(12)} got=${got.padEnd(12)} ${detail}`)
  }

  globalThis.fetch = realFetch
  console.log(`\n[check] ${pass}/${pass + fail} passed`)
  if (fail > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
