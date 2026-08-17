/**
 * check-entity-decode.ts — a guard that fails if a hand-rolled entity list reappears.
 *
 * The defect BRIEF_INGEST_ENTITY_DECODE exists to fix was not a bug in a line of code. It was that
 * ten source files each strip HTML and eight of them decode entities from a list somebody typed —
 * and every such list is incomplete. `committees-portal.ts` decoded `&nbsp;` and not `&#xa0;`, the
 * numeric form of the same character, and that one omission damaged 12% of a 140,567-document
 * corpus for two months without anything reporting it.
 *
 * So the guard is not "is the text decoded" — that cannot be checked from source. It is **is there
 * a second decoder** — which can.
 *
 * ⚠ Every assertion here was watched failing first: run it against the pre-fix tree and
 * committees-portal.ts is reported.
 *
 * Usage (from scripts/ingest):  npx tsx check-entity-decode.ts
 */
import fs from 'fs'
import path from 'path'

export {}

const SOURCES = path.join(__dirname, 'sources')
const SHARED = path.join(__dirname, 'shared', 'html-entities.ts')

/** A `.replace()` whose pattern is an HTML entity — i.e. somebody decoding by hand. */
const HAND_ROLLED = /\.replace\(\s*\/&(?:#x?[0-9a-fA-F]{2,7}|[a-zA-Z]{2,9});?\/[gimsuy]*\s*,/g

/**
 * ⚠ A RATCHET, NOT A CLEAN BILL OF HEALTH.
 *
 * 17 source files decode entities by hand. Fixing all of them is a day's work with a re-ingest
 * behind it, and failing the build on a pre-existing backlog would just get the check disabled. So
 * the baseline is written down and the check fails only if the number GOES UP — the backlog cannot
 * grow, and a new source cannot arrive with a hand-written list.
 *
 * Lower this number as files are converted. Never raise it.
 */
const BASELINE_HAND_ROLLED = 16

/** Files allowed to decode by hand, with the reason. Empty is the goal, not the expectation. */
const ALLOWED = new Map<string, string>([
  // Encodes ONE entity as part of a URL-safe transform rather than as text decoding.
  ['legislation-sections.ts', 'escapes rather than decodes — writes an entity, does not read one'],
])

function main() {
  let failures = 0
  let checked = 0
  const findings: Array<{ file: string; count: number; sample: string }> = []

  console.log('\n════ check:entity-decode ════')
  if (!fs.existsSync(SHARED)) {
    console.log('  ✗ shared/html-entities.ts is MISSING — there is no single decoder to point at')
    process.exit(1)
  }
  console.log('  ✓ shared/html-entities.ts exists')

  for (const f of fs.readdirSync(SOURCES).filter((x) => x.endsWith('.ts'))) {
    checked++
    const src = fs.readFileSync(path.join(SOURCES, f), 'utf8')
    const hits = src.match(HAND_ROLLED) ?? []
    if (!hits.length) continue
    if (ALLOWED.has(f)) { console.log(`  · ${f} — allowed: ${ALLOWED.get(f)}`); continue }
    findings.push({ file: f, count: hits.length, sample: hits.slice(0, 3).join(' ') })
  }

  console.log(`  ${checked} source files scanned`)
  if (!findings.length) {
    console.log('  ✓ no source file decodes HTML entities by hand')
  } else {
    const over = findings.length > BASELINE_HAND_ROLLED
    console.log(`  ${over ? '✗' : '·'} ${findings.length} file(s) still decode by hand (baseline ${BASELINE_HAND_ROLLED}) — import decodeForIndex from shared/html-entities:`)
    for (const f of findings) console.log(`      ${f.file.padEnd(30)} ${f.count} replace calls`)
    if (over) {
      console.log(`\n  ✗ THE BACKLOG GREW: ${findings.length} > baseline ${BASELINE_HAND_ROLLED}. A new hand-written entity`)
      console.log(`    list is exactly the defect this brief was written about. Use the shared decoder.`)
      failures++
    } else {
      console.log(`    (a known backlog, held at or below its baseline — lower BASELINE_HAND_ROLLED as these are converted)`)
    }
  }

  // The positive half: the file that caused this must actually use the shared decoder.
  const portal = fs.readFileSync(path.join(SOURCES, 'committees-portal.ts'), 'utf8')
  const usesShared = /decodeForIndex\s*\(/.test(portal) && /from '\.\.\/shared\/html-entities'/.test(portal)
  console.log(`  ${usesShared ? '✓' : '✗'} committees-portal.ts uses the shared decoder`)
  if (!usesShared) failures++

  // ⚠ AND THAT IT USES THE RESULT. The first version of this fix decoded into a new variable and
  // then returned the OLD one — the repair was present and INERT, which is the failure mode
  // docs/CLAUDE.md's "built inert hides write-path bugs" note is about. A decode whose result is
  // dropped passes any grep for the function name, so the test is that every value assigned from
  // the decoder is READ somewhere afterwards.
  const inert: string[] = []
  for (const f of fs.readdirSync(SOURCES).filter((x) => x.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(SOURCES, f), 'utf8')
    for (const m of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*decodeForIndex\s*\(/g)) {
      const name = m[1]
      const after = src.slice(m.index! + m[0].length)
      // The name must appear again — returned, pushed, compared, anything.
      if (!new RegExp(`\\b${name}\\b`).test(after)) inert.push(`${f}: ${name}`)
    }
  }
  console.log(`  ${inert.length ? '✗' : '✓'} every decoded value is actually used${inert.length ? `  — DECODED THEN DISCARDED: ${inert.join(', ')}` : ''}`)
  if (inert.length) failures++

  // ⚠ THE TWIN, CHECKED FROM THIS SIDE TOO — AND THIS ASSERTION EXISTS BECAUSE ITS ABSENCE WAS
  // WATCHED. `scrutinise-web/lib/html-entities.ts` is a forced copy (the Next build root cannot
  // import from `scripts/`). With the web copy deliberately diverged, the web check failed and
  // THIS ONE STILL REPORTED "all checks pass" — a drift guard that only fires on one side leaves
  // whichever side you happened to edit unguarded, which is the half that matters.
  //
  // The ingest side decides what is STORED and the web side decides what is SHOWN. Two components
  // disagreeing about what a document says is the defect class this whole line of work removes.
  const WEB_TWIN = path.resolve(__dirname, '../../scrutinise-web/lib/html-entities.ts')
  const CORE_START = '// SHARED CORE — BYTE-IDENTICAL ACROSS'
  const CORE_END = '═ END SHARED CORE'
  const core = (file: string): string | null => {
    if (!fs.existsSync(file)) return null
    const src = fs.readFileSync(file, 'utf8')
    const i = src.indexOf(CORE_START)
    const j = src.indexOf(CORE_END, i + CORE_START.length)
    if (i < 0 || j < 0) return null
    return src.slice(i, src.indexOf('\n', j))
  }
  const mine = core(path.join(__dirname, 'shared/html-entities.ts'))
  const theirs = core(WEB_TWIN)
  if (!mine) {
    console.log('  ✗ SHARED CORE markers missing in shared/html-entities.ts')
    failures++
  } else if (!theirs) {
    // Not a pass: an unreadable twin is an unchecked twin, and this check exists to notice that.
    console.log(`  ✗ web twin unreadable or unmarked (${WEB_TWIN}) — the copy cannot be compared`)
    failures++
  } else if (mine !== theirs) {
    let at = 0
    while (at < mine.length && at < theirs.length && mine[at] === theirs[at]) at++
    console.log(`  ✗ SHARED CORE DIVERGED from the web twin at byte ${at}:`)
    console.log(`      ingest ${JSON.stringify(mine.slice(at, at + 50))}`)
    console.log(`      web    ${JSON.stringify(theirs.slice(at, at + 50))}`)
    failures++
  } else {
    console.log(`  ✓ shared core identical to the web twin (${Buffer.byteLength(mine)} bytes)`)
  }

  console.log(`\n════ ${failures ? `${failures} FAILED` : 'all checks pass'} ════`)
  if (failures) process.exit(1)
}
if (require.main === module) main()
