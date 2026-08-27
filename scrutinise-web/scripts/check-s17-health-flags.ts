/**
 * check-s17-health-flags.ts — S17 §3. THE FLAG SNAPSHOT ON `/api/health`, ASSERTED.
 *
 * ⚠ EVERY ASSERTION HERE IS WATCHED FAILING FIRST. The two properties that make this endpoint
 * worth building are also the two that are easy to get wrong and impossible to notice:
 *
 *   1. **It reports what is IN FORCE, not what was SET.** A capitalised `TRUE` in Vercel once
 *      disabled the router silently. If this endpoint read `process.env` directly it would print
 *      `"LEX_QUERY_ROUTER": true` while the app treated it as false — a wrong answer that looks
 *      like a right one, on the one surface built to prevent exactly that. Asserted by SETTING
 *      the variable to `TRUE` and requiring the payload to say `false`.
 *   2. **It leaks nothing.** Names and booleans only. Asserted by scanning the whole serialised
 *      payload for the VALUE of every secret-shaped variable in the environment, and the scanner
 *      is watched catching a deliberately planted one — a leak detector that has never caught a
 *      leak is not a leak detector.
 *
 * Usage:  npm run check:s17-flags
 */
import { CAPABILITY_FLAGS, capabilitySnapshot } from '../lib/env-flags'

let pass = 0
let fail = 0
function assert(ok: boolean, what: string, counted: string) {
  if (ok) { pass++; console.log(`  ok   ${what} — ${counted}`) }
  else { fail++; console.log(`  FAIL ${what} — ${counted}`) }
}

/** Variables whose VALUE must never appear in the payload. Read from the live environment so a
 *  new secret is covered the day it is added, rather than when someone remembers to list it. */
const SECRET_SHAPED = Object.keys(process.env).filter((k) =>
  /(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|_URL)$/.test(k) && (process.env[k] ?? '').trim().length >= 8)

function leaks(payload: string): string[] {
  return SECRET_SHAPED.filter((k) => payload.includes((process.env[k] as string).trim()))
}

async function main() {
  console.log('── S17 §3 · /api/health capability snapshot ──')
  console.log(`  ${CAPABILITY_FLAGS.length} capability flags declared · ${SECRET_SHAPED.length} secret-shaped variables in this environment\n`)

  // ── 1. the payload's shape ─────────────────────────────────────────────────────────────────
  const { GET } = await import('../app/api/health/route')
  const body = await (await GET()).json() as any
  const names = Object.keys(body.capabilities ?? {})
  assert(names.length === CAPABILITY_FLAGS.length && CAPABILITY_FLAGS.every((f) => names.includes(f)),
    'every declared capability flag appears in the payload',
    `${names.length} keys returned against ${CAPABILITY_FLAGS.length} declared`)
  assert(names.every((n) => typeof body.capabilities[n] === 'boolean'),
    'every capability value is a boolean',
    `${names.filter((n) => typeof body.capabilities[n] === 'boolean').length} of ${names.length} are booleans`)
  assert(typeof body.retrieval?.vectorSearchUrl === 'boolean' && typeof body.retrieval?.ftsSearchUrl === 'boolean'
    && typeof body.retrieval?.geminiKey === 'boolean',
    'the three retrieval gates are presence booleans',
    `retrieval = ${JSON.stringify(body.retrieval)}`)
  assert(typeof body.commit === 'string' && typeof body.env === 'string',
    'the commit and env fields the endpoint already carried are still there',
    `commit=${body.commit} env=${body.env}`)

  // ── 2. IN FORCE, not SET — the defect this exists to catch, watched in both directions ──────
  // ⚠⚠ MY FIRST VERSION OF THIS ASSERTED THE WRONG THING AND THE RUN CAUGHT IT. It required
  // `TRUE` to report FALSE, on the strength of the 2026-08-08 incident. But that incident was
  // caused by read sites comparing `=== 'true'`, and `lib/env-flags.ts` was written to remove
  // exactly that: `parseBool` lower-cases, so `TRUE` now correctly means ON. The assertion was
  // wrong about the world, not about the code, and it is recorded here rather than quietly
  // rewritten — asserting a fixed bug still exists is its own way of measuring nothing.
  //
  // The property that actually distinguishes IN FORCE from SET is a value that is set and
  // UNRECOGNISED. `enabled` is truthy to any naive `process.env.X ? …` reader and is FALSE to
  // the app. That is the case a `process.env` implementation of this endpoint would get wrong.
  const before = process.env.LEX_QUERY_ROUTER
  try {
    process.env.LEX_QUERY_ROUTER = 'enabled'
    const unrecognised = (await (await GET()).json() as any).capabilities.LEX_QUERY_ROUTER
    assert(unrecognised === false,
      'a set-but-unrecognised value reports as false — what is in force, not what was set',
      `LEX_QUERY_ROUTER='enabled' → ${JSON.stringify(unrecognised)} (a naive process.env read would report true here)`)

    process.env.LEX_QUERY_ROUTER = 'TRUE'
    const capitalised = (await (await GET()).json() as any).capabilities.LEX_QUERY_ROUTER
    assert(capitalised === true,
      'a capitalised TRUE reports as true — env-flags normalises it, and this pins that',
      `LEX_QUERY_ROUTER='TRUE' → ${JSON.stringify(capitalised)} (false here would mean the 2026-08-08 defect had come back)`)

    process.env.LEX_QUERY_ROUTER = 'true'
    const lower = (await (await GET()).json() as any).capabilities.LEX_QUERY_ROUTER
    assert(lower === true,
      'a lower-case true reports as true — the check can fail in both directions',
      `LEX_QUERY_ROUTER='true' → ${JSON.stringify(lower)}`)

    delete process.env.LEX_QUERY_ROUTER
    const unset = (await (await GET()).json() as any).capabilities.LEX_QUERY_ROUTER
    assert(unset === false, 'an unset flag reports as false', `unset → ${JSON.stringify(unset)}`)
  } finally {
    if (before === undefined) delete process.env.LEX_QUERY_ROUTER
    else process.env.LEX_QUERY_ROUTER = before
  }

  // ── 3. the leak scan, and the scanner watched CATCHING one ──────────────────────────────────
  const payload = JSON.stringify(await (await GET()).json())
  const found = leaks(payload)
  assert(found.length === 0, 'no secret-shaped value appears in the payload',
    `scanned ${payload.length} bytes against ${SECRET_SHAPED.length} values; ${found.length} found${found.length ? `: ${found.join(', ')}` : ''}`)

  const canary = SECRET_SHAPED[0]
  if (!canary) {
    console.log('  ⚠ SKIPPED the leak-detector self-test: this environment holds no secret-shaped variable to plant.')
  } else {
    const planted = payload.slice(0, -1) + `,"planted":${JSON.stringify(process.env[canary])}}`
    assert(leaks(planted).includes(canary),
      'the leak detector catches a planted secret — it is capable of failing',
      `planted ${canary} into the payload and the scanner returned ${JSON.stringify(leaks(planted))}`)
  }

  // ── 4. the snapshot the endpoint serves is the module's, not a copy ─────────────────────────
  const direct = capabilitySnapshot()
  const served = (await (await GET()).json() as any).capabilities
  assert(JSON.stringify(direct) === JSON.stringify(served),
    'the served snapshot equals capabilitySnapshot() exactly — no second implementation',
    `${Object.keys(direct).length} keys compared`)

  console.log(`\n  ${pass} passed · ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('FAILED', e); process.exit(1) })
