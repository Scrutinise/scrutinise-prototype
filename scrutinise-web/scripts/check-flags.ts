/**
 * check-flags.ts — regression check for the boolean-flag parsing, and for the invariant that
 * nothing reads a capability flag without going through it.
 *
 * The behaviour test alone would not have prevented the incident this exists for: the bug was not
 * that parsing was wrong, it was that ten read sites each rolled their own `=== 'true'`. So the
 * important assertion here is the SOURCE one — a future read site that reintroduces a bare
 * comparison fails this check.
 *
 * Usage: npm run check:flags
 */
import fs from 'fs'
import path from 'path'
import { parseBool, flagEnabled, capabilityLine, capabilitySnapshot, CAPABILITY_FLAGS } from '../lib/env-flags'

let passed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function section(title: string) { console.log(`\n${title}`) }

// ── 1. parsing ───────────────────────────────────────────────────────────────
section('parseBool — the forms people actually type')
for (const v of ['true', 'TRUE', 'True', ' true ', '1', 'yes', 'YES', 'on', '\ttrue\n']) {
  ok(`${JSON.stringify(v)} → true`, parseBool(v) === true)
}
for (const v of ['false', 'FALSE', 'False', ' false ', '0', 'no', 'off', '']) {
  ok(`${JSON.stringify(v)} → false`, parseBool(v) === false)
}
ok('undefined → false', parseBool(undefined) === false)

section('parseBool — THE REGRESSION: capital TRUE must be true')
ok('"TRUE" === true (the 2026-08-08 incident)', parseBool('TRUE') === true)
// The old comparison, reproduced through a `string` so tsc will actually compile it: this is the
// line that silently disabled the router and expansion in production.
{
  const oldStyle = (v: string): boolean => v === 'true'
  ok('the OLD bare comparison would have said false', oldStyle('TRUE') === false)
  ok('parseBool and the old comparison now disagree — that is the fix', parseBool('TRUE') !== oldStyle('TRUE'))
}

section('parseBool — an unrecognised value is false AND warns exactly once')
{
  const seen: string[] = []
  const orig = console.warn
  console.warn = (...a: unknown[]) => { seen.push(a.join(' ')) }
  try {
    const a = parseBool('enabled', 'CHECK_FLAGS_FAKE')
    const b = parseBool('enabled', 'CHECK_FLAGS_FAKE')
    ok('unrecognised → false', a === false && b === false)
    ok('warned exactly once for two reads', seen.length === 1, `warned ${seen.length}x`)
    ok('the warning names the variable and the value', !!seen[0]?.includes('CHECK_FLAGS_FAKE') && !!seen[0]?.includes('enabled'))
  } finally { console.warn = orig }
}

// ── 2. flagEnabled reads the live environment ────────────────────────────────
section('flagEnabled')
{
  const key = CAPABILITY_FLAGS[0]
  const before = process.env[key]
  try {
    process.env[key] = 'TRUE'
    ok(`${key}=TRUE is ON`, flagEnabled(key) === true)
    process.env[key] = 'no'
    ok(`${key}=no is off`, flagEnabled(key) === false)
    delete process.env[key]
    ok(`${key} unset is off`, flagEnabled(key) === false)
  } finally { if (before === undefined) delete process.env[key]; else process.env[key] = before }
}

// ── 3. the boot line ─────────────────────────────────────────────────────────
section('capabilityLine — the boot line must answer "is X live?"')
{
  const line = capabilityLine()
  ok('names every capability flag', CAPABILITY_FLAGS.every((f) => line.includes(f.replace(/^LEX_/, ''))),
     CAPABILITY_FLAGS.filter((f) => !line.includes(f.replace(/^LEX_/, ''))).join(', '))
  ok('reports the dense preconditions', line.includes('VECTOR_SEARCH_URL') && line.includes('LEX_VECTOR_STREAMS') && line.includes('GEMINI_API_KEY'))
  ok('is a single line', !line.includes('\n'))
  const snap = capabilitySnapshot()
  ok('snapshot covers every flag', Object.keys(snap).length === CAPABILITY_FLAGS.length)

  // Never print a secret, whatever its value.
  const before = process.env.GEMINI_API_KEY
  try {
    process.env.GEMINI_API_KEY = 'sk-do-not-print-me-1234567890'
    ok('never prints the API key itself', !capabilityLine().includes('do-not-print-me'))
  } finally { if (before === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = before }
  console.log(`     boot line: ${line}`)
}

// ── 4. THE INVARIANT: no read site may bypass the helper ─────────────────────
section('source invariant — every capability flag is read through flagEnabled')
{
  const root = path.join(__dirname, '..')
  const SKIP = new Set(['node_modules', '.next', '.git', 'scripts'])
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)) }
      else if (/\.tsx?$/.test(e.name)) files.push(path.join(dir, e.name))
    }
  }
  walk(root)

  const offenders: string[] = []
  for (const f of files) {
    if (path.resolve(f) === path.resolve(root, 'lib/env-flags.ts')) continue // the helper itself
    const src = fs.readFileSync(f, 'utf8')
    src.split('\n').forEach((line, i) => {
      for (const flag of CAPABILITY_FLAGS) {
        // A bare comparison against the raw env var — the exact shape that caused the incident.
        if (new RegExp(`process\\.env\\.${flag}\\s*[!=]==`).test(line)) {
          offenders.push(`${path.relative(root, f)}:${i + 1}  ${line.trim()}`)
        }
      }
    })
  }
  ok(`no bare process.env.<FLAG> === comparison remains (${files.length} files scanned)`,
     offenders.length === 0, offenders.join(' | '))

  // And the ten known read sites must still import the helper.
  const READERS = [
    'lib/lex/search-gateway.ts', 'lib/lex/fts-search.ts', 'lib/lex/orchestrator.ts',
    'lib/lex/orientation/index.ts', 'lib/lex/query-expansion.ts',
  ]
  for (const r of READERS) {
    const src = fs.readFileSync(path.join(root, r), 'utf8')
    ok(`${r} imports flagEnabled`, /from '@\/lib\/env-flags'/.test(src))
  }
}

// ── 5. the fail-open must be loud ────────────────────────────────────────────
section('fail-open visibility')
{
  const src = fs.readFileSync(path.join(__dirname, '../lib/lex/query-expansion.ts'), 'utf8')
  ok('routeQuery has a routerFailOpen helper', /function routerFailOpen/.test(src))
  ok('it logs at error level', /routerFailOpen[\s\S]{0,400}console\.error/.test(src))
  ok('it carries a reason', /\(\$\{reason\}\)/.test(src))
  ok('missing key fails loudly rather than returning null quietly', /routerFailOpen\('missing-key'/.test(src))
  ok('an empty routing decision is treated as a failure', /no-streams-named/.test(src))
  const gw = fs.readFileSync(path.join(__dirname, '../lib/lex/search-gateway.ts'), 'utf8')
  ok('the gateway fail-open is console.error', /console\.error\('\[search-gateway\] router fail-open/.test(gw))

  // The 2026-08-08 truncation bug: five tailored per-stream queries did not fit in 512 output
  // tokens, and nothing checked finishReason, so the cut-off arrived disguised as `bad-json`.
  ok('the output budget is no longer the hardcoded 512', !/maxOutputTokens:\s*512\b/.test(src))
  ok('the output budget is configurable per call', /maxOutputTokens\?:\s*number/.test(src))
  ok('finishReason is checked', /finishReason/.test(src))
  ok('a cut-off names itself rather than looking like bad JSON', /reason: 'truncated'/.test(src))
  ok('finishReason is checked BEFORE the text is parsed',
     src.indexOf('finishReason') < src.indexOf("reason: 'empty-response'"))
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
