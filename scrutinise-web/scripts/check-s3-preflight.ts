/**
 * check-s3-preflight.ts — watch the S3 §7 guards fail before trusting them.
 *
 * §7.1 a disabled router and a failed router must be distinguishable.
 * §7.2 a harness must refuse to run degraded, and print its resolved config.
 *
 * Both are guards against a SILENT wrong answer, which is the category that never
 * announces itself — so neither is believed here until it has been seen to fire.
 *
 * Usage: npx tsx --env-file=.env --tsconfig tsconfig.json scripts/check-s3-preflight.ts
 */
import { assertRetrievalConfig, retrievalFlagState, resolvedConfigLine } from '../lib/lex/harness-preflight'

type Case = {
  name: string
  env: Record<string, string | undefined>
  expectThrow: boolean
  expectMentions?: string
}

const FULL = {
  FTS_SEARCH_URL: 'https://fts-serve-production-4cea.up.railway.app',
  VECTOR_SEARCH_URL: 'https://vector-serve-production.up.railway.app',
  LEX_VECTOR_STREAMS: 'legislation',
  LEX_QUERY_ROUTER: 'true',
}

const CASES: Case[] = [
  { name: 'fully configured → runs', env: FULL, expectThrow: false },
  // Each of the three silent degraders must be caught INDIVIDUALLY. A guard that only
  // fires when everything is missing would have passed the exact run that misled us.
  { name: 'FTS_SEARCH_URL missing', env: { ...FULL, FTS_SEARCH_URL: undefined }, expectThrow: true, expectMentions: 'FTS_SEARCH_URL' },
  { name: 'LEX_VECTOR_STREAMS empty', env: { ...FULL, LEX_VECTOR_STREAMS: '' }, expectThrow: true, expectMentions: 'LEX_VECTOR_STREAMS' },
  { name: 'LEX_QUERY_ROUTER off', env: { ...FULL, LEX_QUERY_ROUTER: 'false' }, expectThrow: true, expectMentions: 'LEX_QUERY_ROUTER' },
  // The exact shape of this machine on 2026-08-16 — the state that produced ROUTING 16/30.
  { name: 'the V36 acceptance-run state', env: { ...FULL, FTS_SEARCH_URL: undefined, LEX_VECTOR_STREAMS: '', LEX_QUERY_ROUTER: undefined }, expectThrow: true, expectMentions: 'LEX_QUERY_ROUTER' },
]

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {}
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]! }
  try { return fn() } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]! }
  }
}

function main() {
  let pass = 0, fail = 0
  for (const c of CASES) {
    const r = withEnv(c.env, () => {
      try { assertRetrievalConfig('check'); return { threw: false, msg: '' } }
      catch (e) { return { threw: true, msg: String((e as Error).message) } }
    })
    const mentionsOk = !c.expectMentions || r.msg.includes(c.expectMentions)
    const ok = r.threw === c.expectThrow && mentionsOk
    ok ? pass++ : fail++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(32)} threw=${r.threw} (expected ${c.expectThrow})${c.expectMentions ? ` mentions ${c.expectMentions}=${r.msg.includes(c.expectMentions)}` : ''}`)
  }

  // §7.2's second half: the resolved state must be printable and must SAY it is degraded.
  const degradedLine = withEnv({ ...FULL, LEX_QUERY_ROUTER: 'false' }, () => resolvedConfigLine())
  const healthyLine = withEnv(FULL, () => resolvedConfigLine())
  const lineOk = degradedLine.includes('DEGRADED') && degradedLine.includes('router=OFF') && healthyLine.includes('fully-configured')
  lineOk ? pass++ : fail++
  console.log(`${lineOk ? 'PASS' : 'FAIL'}  resolved-config line is self-describing`)
  console.log(`        degraded: ${degradedLine}`)
  console.log(`        healthy : ${healthyLine}`)

  // §7.1: the flag state must be readable, so a reporter can print OFF vs FAILED.
  const offState = withEnv({ ...FULL, LEX_QUERY_ROUTER: 'false' }, () => retrievalFlagState().routerOn)
  const onState = withEnv(FULL, () => retrievalFlagState().routerOn)
  const stateOk = offState === false && onState === true
  stateOk ? pass++ : fail++
  console.log(`${stateOk ? 'PASS' : 'FAIL'}  router state readable by callers (off=${offState} on=${onState})`)

  console.log(`\n[check] ${pass}/${pass + fail} passed`)
  if (fail) process.exitCode = 1
}

main()
