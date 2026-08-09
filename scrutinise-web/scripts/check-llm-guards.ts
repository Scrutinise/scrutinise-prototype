/**
 * check-llm-guards.ts — enforces CLAUDE.md §18: a truncated LLM response must name itself as
 * truncated, everywhere.
 *
 * This is a SOURCE invariant, not a behaviour test, and that is deliberate. The class has recurred
 * four times (query-expansion 29 Jul, web-orientation 6 Aug, general-chat 8 Aug, query-router
 * 8 Aug) and each time the fix was applied to one call site while the others kept the exposure. A
 * behavioural test can only catch the call site it exercises; this catches the NEXT one somebody
 * adds.
 *
 * The rule it encodes: any file that asks a model for JSON must also look at `finishReason`,
 * because a truncated JSON payload is broken JSON and will otherwise be reported as a parse
 * failure — sending the reader after a serialiser fault when the fault is a number in the request.
 *
 * Usage: npm run check:llm-guards
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'scripts', 'public'])

let passed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name), out) }
    else if (/\.tsx?$/.test(e.name)) out.push(path.join(dir, e.name))
  }
  return out
}

const files = walk(ROOT)
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/')

console.log('CLAUDE.md §18 — a truncated LLM response must name itself as truncated\n')

// ── 1. every JSON-mode model call must look at finishReason ──────────────────
console.log('JSON-mode call sites')
const jsonSites = files.filter((f) => /responseMimeType:\s*'application\/json'/.test(fs.readFileSync(f, 'utf8')))
ok(`found JSON-mode call sites to check (${jsonSites.length})`, jsonSites.length > 0)

const unguarded: string[] = []
for (const f of jsonSites) {
  const src = fs.readFileSync(f, 'utf8')
  // Either it checks directly, or it delegates to the shared guard. Both satisfy the rule; the
  // shared guard is preferred, which is what the second assertion below is about.
  const guarded = /finishReason/.test(src) || /gemini-finish/.test(src)
  if (!guarded) unguarded.push(rel(f))
}
ok('every JSON-mode call site checks finishReason (directly or via the shared guard)',
   unguarded.length === 0, unguarded.join(', '))

// ── 2. the guard exists and is shared ────────────────────────────────────────
console.log('\nthe shared guard')
const guardPath = path.join(ROOT, 'lib/lex/gemini-finish.ts')
ok('lib/lex/gemini-finish.ts exists', fs.existsSync(guardPath))
if (fs.existsSync(guardPath)) {
  const g = fs.readFileSync(guardPath, 'utf8')
  ok('it distinguishes truncation from other non-STOP reasons', /MAX_TOKENS/.test(g) && /'truncated'/.test(g) && /'blocked'/.test(g))
  ok('it reports the budget that was hit', /maxOutputTokens=\$\{budget\}/.test(g))
  ok('it shows the tail, so a cut-off mid-word is recognisable', /slice\(-80\)/.test(g))
  ok('an ABSENT finishReason is treated as fine (never fail closed on a missing field)',
     /if \(!finish \|\| finish === 'STOP'\) return null/.test(g))
}

const importers = files.filter((f) => /from '.*gemini-finish'/.test(fs.readFileSync(f, 'utf8')))
ok(`the guard is actually used (${importers.length} importer(s))`, importers.length >= 3,
   importers.map(rel).join(', '))

// ── 3. no JSON call may check AFTER parsing ──────────────────────────────────
// Parsing first defeats the point: the parse throws on the truncated payload and the reader is
// sent after a serialiser fault. Where both appear in a file, finishReason must come first.
console.log('\nordering — the check must come BEFORE the parse')
const lateChecks: string[] = []
for (const f of jsonSites) {
  const src = fs.readFileSync(f, 'utf8')
  const finish = src.search(/finishReason|geminiFinishProblem|assertGeminiFinished/)
  const parse = src.search(/JSON\.parse\(/)
  if (finish >= 0 && parse >= 0 && finish > parse) lateChecks.push(`${rel(f)} (check at ${finish}, parse at ${parse})`)
}
ok('finishReason is looked at before the first JSON.parse', lateChecks.length === 0, lateChecks.join(', '))

// ── 4. the tightest budgets, reported not failed ─────────────────────────────
// A budget is a judgement about the expected output size, so this cannot be a pass/fail. It is
// printed so an undersized one is visible when it next causes trouble.
console.log('\noutput budgets in use (reported, not asserted)')
const budgets: Array<{ file: string; line: number; value: number }> = []
for (const f of files) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const m = line.match(/maxOutputTokens:\s*(\d+)/)
    if (m) budgets.push({ file: rel(f), line: i + 1, value: parseInt(m[1], 10) })
  })
}
for (const b of budgets.sort((a, z) => a.value - z.value)) {
  console.log(`     ${String(b.value).padStart(5)}  ${b.file}:${b.line}`)
}
const tiny = budgets.filter((b) => b.value < 1024)
if (tiny.length) {
  console.log(`     ⚠ ${tiny.length} call site(s) under 1024 tokens — fine if the output really is that small,`)
  console.log('       but these are the ones that will hit the ceiling first.')
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
