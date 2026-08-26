/**
 * sweep-lance-predicates.ts — ADDENDUM C3, standing rule:
 *   "Sweep the codebase for quoted identifiers in LanceDB predicates. Anywhere else this appears is
 *    silently doing nothing and reporting success. Report the list before changing any of it."
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT IS LOOKING FOR, AND WHY IT IS NOT A STYLE CHECK
 *
 * LanceDB's DataFusion predicate parser accepts a DOUBLE-QUOTED identifier, matches NOTHING, and
 * raises nothing (measured on all three tables, 24 Aug 2026):
 *
 *     corpus_fts     id = 'x'                  → 1        "id" = 'x'                  → 0
 *     corpus_chunks  sectionId IN (…2000 ids)  → 2000     "sectionId" IN (…2000 ids)  → 0
 *     corpus_vec     sectionId IN (…2000 ids)  → 2000     "sectionId" IN (…2000 ids)  → 0
 *
 * So `delete("\"id\" = 'x'")` removes nothing, returns normally, and the caller reports success.
 * It is also ~70× faster, because it prunes every fragment — which is what makes it read as a
 * working optimisation rather than a bug.
 *
 * ⚠ THIS SCRIPT CHANGES NOTHING. It reports. The addendum requires the list before any fix.
 *
 * ── HOW IT DECIDES A CALL IS A LANCE PREDICATE ─────────────────────────────────────────────────
 * A file is IN SCOPE if it mentions LanceDB at all — an import of `@lancedb/lancedb`, of our own
 * `search/lance` / `vector-common` helpers, or a use of `connectLance`. Postgres files are out of
 * scope entirely, because in SQL the double-quoted identifier is CORRECT and required for our
 * camelCase columns — the two languages disagree about the same characters, which is the whole trap.
 *
 * Within those files every argument to a predicate-taking method is read:
 *   countRows( · delete( · where( · prefilter/filter( · mergeInsert(…).when*(
 * and flagged if a `"…"` wraps something that looks like a bare identifier.
 *
 * ⚠ THE CHECK IS WATCHED FAILING FIRST. `--self-test` runs the detector over four literals whose
 * verdicts are known — two quoted (must flag), two bare (must not) — and exits non-zero unless it
 * gets all four right. A detector that flags nothing looks identical to a clean codebase.
 *
 * Usage:
 *   tsx c3a/sweep-lance-predicates.ts --self-test
 *   tsx c3a/sweep-lance-predicates.ts
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '../../..')
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.vercel', 'coverage'])

/** A file only counts if it actually talks to LanceDB. */
const LANCE_MARKERS = [
  '@lancedb/lancedb',
  'connectLance',
  "from '../search/lance'",
  "from './lance'",
  'vector-common',
  'lancedb.connect',
]

/** The methods whose string argument is a DataFusion predicate. */
const PRED_METHODS = ['countRows', 'delete', 'where', 'prefilter', 'filter', 'whenNotMatchedBySourceDelete']

/**
 * Does this predicate string quote an identifier?
 * `"id" = 'x'`, `"sectionId" IN (…)`, `NOT "corpus" = 'y'` → yes.
 * A double quote around a VALUE is not the trap (DataFusion values are single-quoted), so any
 * `"…"` immediately followed by an operator, or preceded by one, is what we look for.
 */
export function quotesAnIdentifier(pred: string): boolean {
  return /"[A-Za-z_][A-Za-z0-9_]*"\s*(=|!=|<>|<|>|<=|>=|\bIN\b|\bLIKE\b|\bIS\b)/i.test(pred)
    || /(=|!=|<>|<|>|<=|>=|\bIN\b|\bLIKE\b)\s*"[A-Za-z_][A-Za-z0-9_]*"\s*($|\)|\s+(AND|OR)\b)/i.test(pred)
}

function selfTest(): void {
  const cases: Array<[string, boolean, string]> = [
    [`"id" = 'x'`, true, 'the exact form that matched 0 of 168,569 rows in the C3 dry run'],
    [`"sectionId" IN (1,2,3)`, true, 'the form that would have made the purge a silent no-op'],
    [`id = 'x'`, false, 'the bare form — the one that works'],
    [`corpus IN ('oecd','written-answers')`, false, 'bare, multi-value, single-quoted VALUES are fine'],
  ]
  let bad = 0
  console.log('── SELF-TEST: the detector, watched getting all four right before it is trusted\n')
  for (const [pred, expected, why] of cases) {
    const got = quotesAnIdentifier(pred)
    const ok = got === expected
    if (!ok) bad++
    console.log(`  ${ok ? '✓' : '✗'}  ${expected ? 'FLAG  ' : 'ALLOW '} ${pred.padEnd(28)}  ${why}`)
  }
  console.log(bad === 0 ? '\n4/4 — the detector distinguishes the two forms.' : `\n⛔ ${bad} wrong — do not trust the sweep below.`)
  if (bad) process.exit(1)
}

interface Hit { file: string; line: number; method: string; pred: string }

/**
 * ⚠ THE LIMIT OF A STATIC SWEEP, STATED RATHER THAN HIDDEN.
 *
 * `c2/c3-probe-pred2.ts` emits `"id" = '…'` — the exact broken form — and no regex over the source
 * can see it, because the identifier is a VARIABLE:
 *
 *     for (const variant of [key, `"${key}"`])
 *       await tbl.countRows(`${variant} = '${esc(one)}'`)
 *
 * A predicate composed at runtime is undecidable from the text. So the sweep reports those call
 * sites SEPARATELY and by name, as "must be read by hand" — rather than counting them clean and
 * printing a reassuring zero. A sweep whose blind spot is unstated is worse than no sweep.
 */
function isComposed(pred: string): boolean {
  return /\$\{/.test(pred) && /^\s*\$\{|\$\{[^}]*\}\s*(=|!=|<>|<|>|<=|>=|\bIN\b|\bLIKE\b|\bIS\b)/i.test(pred)
}

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue
      walk(path.join(dir, e.name), out)
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx') || e.name.endsWith('.js')) {
      out.push(path.join(dir, e.name))
    }
  }
}

function main() {
  if (process.argv.includes('--self-test')) { selfTest(); return }
  selfTest()   // always runs first; the sweep is worthless if the detector is

  const files: string[] = []
  walk(ROOT, files)
  const lanceFiles: string[] = []
  for (const f of files) {
    let src: string
    try { src = fs.readFileSync(f, 'utf8') } catch { continue }
    if (LANCE_MARKERS.some((m) => src.includes(m))) lanceFiles.push(f)
  }

  console.log(`\n── FILES THAT TALK TO LANCEDB: ${lanceFiles.length}`)
  console.log('   (Postgres files are deliberately out of scope — there the quoted form is CORRECT.)\n')

  const hits: Hit[] = []
  const calls: Hit[] = []
  const composed: Hit[] = []
  for (const f of lanceFiles) {
    const src = fs.readFileSync(f, 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      // ⚠ comment lines are skipped, and this file is why: its own header QUOTES the broken probe,
      //   and the first run flagged that quotation as a call site. A sweep that reads its own
      //   documentation as evidence inflates its findings with itself.
      if (/^\s*(\*|\/\/|\/\*)/.test(lines[i])) continue
      for (const m of PRED_METHODS) {
        // the predicate argument, as written — template literal, single or double quoted
        const rx = new RegExp(`\\.${m}\\s*\\(\\s*([\`'"])([\\s\\S]{0,300}?)\\1`, 'g')
        let mm: RegExpExecArray | null
        while ((mm = rx.exec(lines[i])) !== null) {
          const pred = mm[2]
          const rel = path.relative(ROOT, f).replace(/\\/g, '/')
          const hit: Hit = { file: rel, line: i + 1, method: m, pred }
          calls.push(hit)
          // a JS double-quoted string containing \" shows up as \\" in source
          if (quotesAnIdentifier(pred) || quotesAnIdentifier(pred.replace(/\\"/g, '"'))) hits.push(hit)
          else if (isComposed(pred)) composed.push(hit)
        }
      }
    }
    // second pass: predicates built into a variable then passed (the `inList` shape)
    const lines2 = src.split('\n')
    for (let i = 0; i < lines2.length; i++) {
      const l = lines2[i]
      if (!/\b(pred|predicate|filterExpr|whereClause|inList)\b/i.test(l)) continue
      const strs = [...l.matchAll(/([`'"])([^`'"\n]{0,200}?)\1/g)].map((x) => x[2])
      for (const s of strs) {
        if (!/\$\{|\bIN\b|=|LIKE/i.test(s)) continue
        if (quotesAnIdentifier(s) || quotesAnIdentifier(s.replace(/\\"/g, '"'))) {
          const rel = path.relative(ROOT, f).replace(/\\/g, '/')
          if (!hits.some((h) => h.file === rel && h.line === i + 1)) {
            hits.push({ file: rel, line: i + 1, method: '(built predicate)', pred: s })
          }
        }
      }
    }
  }

  console.log(`── PREDICATE CALL SITES READ: ${calls.length}`)
  const byFile = new Map<string, number>()
  for (const c of calls) byFile.set(c.file, (byFile.get(c.file) ?? 0) + 1)
  for (const [f, c] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`   ${String(c).padStart(3)}  ${f}`)

  console.log(`\n── QUOTED-IDENTIFIER PREDICATES FOUND: ${hits.length}`)
  if (hits.length === 0) {
    console.log('   none. Every Lance predicate in the tree uses the bare form.')
    console.log('   ⚠ That is a real finding only because the detector was watched flagging the quoted')
    console.log('     form four lines above. A sweep that finds nothing and cannot find anything is not')
    console.log('     a sweep — it is the same shape as the check that cannot fail.')
  }
  for (const h of hits) console.log(`   ${h.file}:${h.line}  .${h.method}(  ${h.pred.slice(0, 120)}`)

  console.log(`\n── PREDICATES COMPOSED AT RUNTIME — UNDECIDABLE FROM THE TEXT, READ BY HAND: ${composed.length}`)
  console.log('   The identifier is a variable here, so no sweep over the source can rule these in or out.')
  for (const h of composed) console.log(`   ${h.file}:${h.line}  .${h.method}(  ${h.pred.slice(0, 120)}`)

  const outPath = path.join(ROOT, 'docs/census/C3A_lance_predicate_sweep.json')
  fs.writeFileSync(outPath, JSON.stringify({
    generated: new Date().toISOString(),
    filesScanned: files.length,
    lanceFiles: lanceFiles.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')),
    callSites: calls,
    quotedIdentifierHits: hits,
    composedPredicatesToReadByHand: composed,
  }, null, 2))
  console.log(`\nwritten: ${path.relative(ROOT, outPath).replace(/\\/g, '/')}`)
}

main()
