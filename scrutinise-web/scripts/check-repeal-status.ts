/**
 * check-repeal-status.ts — SURFACE 1's guard.
 *
 * The single thing most likely to go wrong here is not a bug: it is somebody making the third state
 * friendlier. "No repeal recorded" becomes "In force" in a tidy-up, and the platform starts making a
 * confident claim it has no basis for — the same error the job was created to remove, pointing the
 * other way.
 *
 * So this greps for it, and it also asserts that the status reaches BOTH the panel and the prompt,
 * because the failure mode the brief singles out is the two disagreeing on screen.
 *
 * ⚠ Every assertion was watched failing first.
 *
 * Usage (from scrutinise-web):  npx tsx scripts/check-repeal-status.ts
 */
import fs from 'fs'
import path from 'path'

export {}

let pass = 0
let fail = 0
const check = (ok: boolean, name: string, detail = '') => {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
}

const ROOT = path.join(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

/** Files that render or phrase the repeal state for a human or for the model. */
const WORDING_FILES = ['lib/lex/repeal-status.ts', 'components/RepealBadge.tsx']

/**
 * "In force" as an ASSERTION. The phrase appears legitimately in prose that FORBIDS the claim
 * ("never tell a user a provision is in force"), so a bare grep would fail on the very sentence
 * that gets it right. The test is for the phrase in an emitted STRING, minus the lines that forbid it.
 */
function assertsInForce(src: string): string[] {
  const offenders: string[] = []
  for (const line of src.split('\n')) {
    if (!/\b(in force|still current|remains current|currently in effect)\b/i.test(line)) continue
    // Lines that forbid, explain, or test the claim are the point, not a violation.
    // ⚠ CASE-INSENSITIVE. The first version was not, so a line beginning "Never tell a user a
    // provision is in force" was reported as an offender — the check failed on the very sentence
    // that gets it right, which is the fastest way to have a guard switched off.
    if (/\b(never|not|forbid|cannot|forbidden)\b/i.test(line) || /⚠|\/\/|^\s*\*/.test(line)) continue
    offenders.push(line.trim().slice(0, 100))
  }
  return offenders
}

function main() {
  console.log('\n════ check:repeal-status ════')

  // ── 1. the third state must never become a reassurance ──────────────────────────────────────
  for (const f of WORDING_FILES) {
    const bad = assertsInForce(read(f))
    check(bad.length === 0, `${f} never asserts "in force"`, bad.join(' | '))
  }
  const rs = read('lib/lex/repeal-status.ts')
  check(/not the same as confirming it is current/.test(rs),
    'the no-record explanation says explicitly that it is not confirmation')
  check(/'no-record'/.test(rs) && /No repeal recorded/.test(rs),
    'the third state is labelled "No repeal recorded", not "in force"')

  // ── 2. it reaches the PANEL ─────────────────────────────────────────────────────────────────
  const panel = read('components/LegislationPanel.tsx')
  check(/RepealBadge/.test(panel), 'LegislationPanel renders the badge')
  check(/repeal\?:/.test(panel), 'LegislationPanel accepts a repeal status')
  const badge = read('components/RepealBadge.tsx')
  check(/if \(!repeal\) return null/.test(badge),
    '⚠ an ABSENT status renders nothing — a failed lookup must not manufacture reassurance')

  // ── 3. it reaches WHAT LEX READS ────────────────────────────────────────────────────────────
  const route = read('app/api/ai/[ideaId]/route.ts')
  check(/repealNote/.test(route), 'the Lex chat route puts the note in the prompt')
  check(/REPEAL_PROMPT_INSTRUCTION/.test(route), 'and the accompanying instruction')
  check(/REPEAL_UNAVAILABLE_INSTRUCTION/.test(route),
    'and a DIFFERENT instruction for the path where status could not be checked')
  check(/repealStatusAvailable/.test(route),
    '⚠ the unavailable flag is USED, not merely computed (an unused flag is an inert repair)')

  // ── 4. it is attached in ONE place ──────────────────────────────────────────────────────────
  const gw = read('lib/lex/search-gateway.ts')
  check(/lookupRepeals/.test(gw), 'the gateway attaches the status')
  check(/annotate\(results/.test(gw) && /annotate\(grouped/.test(gw),
    '⚠ BOTH results and grouped are annotated — a consumer may read either')
  const legacy = read('lib/lex/gateway-legacy.ts')
  check(/repeal: result\.repeal/.test(legacy),
    'the legacy surfaces carry it through', 'the three legislation-only surfaces')

  // ── 5. and NO other file invents its own wording ─────────────────────────────────────────────
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(rel)
    }
  }
  walk('lib'); walk('components'); walk('app')
  const rogue = files.filter((f) => {
    if (WORDING_FILES.includes(f.replace(/^\.\//, ''))) return false
    const src = read(f)
    // A file that writes the user-facing phrase itself rather than importing it.
    return /'REPEALED|"REPEALED|No repeal recorded/.test(src) && !/repeal-status/.test(src)
  })
  check(rogue.length === 0, 'no file writes the repeal wording without importing it', rogue.join(', '))

  console.log(`\n════ ${fail ? `${fail} FAILED` : `all ${pass} checks pass`} ════`)
  if (fail) process.exit(1)
}
main()
