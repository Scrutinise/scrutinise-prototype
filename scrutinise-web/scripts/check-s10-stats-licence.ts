/**
 * check-s10-stats-licence.ts — S10 §4.2. THE REGISTER AND THE RUNNING CONFIGURATION MUST AGREE.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * "A licence declaration sitting as a bare string in a dashboard is a compliance obligation with no
 * owner and no date." §4.2 asks for it recorded with the date and the decider, and for a check
 * asserting the register and the running configuration agree. This is that check.
 *
 * ⚠⚠ WHAT THIS CHECK CAN AND CANNOT SEE, STATED PLAINLY RATHER THAN IMPLIED (docs/CLAUDE.md §19).
 * It reads `STATS_USE_CONTEXT` from the environment it is RUN IN. Run locally, that is the local
 * shell — NOT Vercel, which is unreadable from this machine because the token is SAML-blocked. So
 * a green result here proves the register agrees with THIS environment, and says nothing about
 * production. To make it say something about production it has to run in production's environment.
 * That limitation is printed in the output, every run, rather than left for a reader to infer.
 *
 * ⚠ THE DIRECTION IS THE TRAP, AND ONE ASSERTION EXISTS ONLY TO PIN IT. `commercialUseExcluded`
 * means a series is WITHHELD under `commercial` and PERMITTED under `non-commercial`. "Non-
 * commercial" reads like the cautious setting and is the permissive one. An assertion below drives
 * the real gate both ways and fails if that ever inverts — because if it did, the platform would
 * quietly serve IMF series in a context the licence excludes, and nothing else would notice.
 *
 * Usage:  npx tsx --env-file=.env scripts/check-s10-stats-licence.ts [--self-test]
 */
import { STATS_LICENCE_DECISION } from '../lib/lex/stats-licence-register'
import { statsUseContext, searchCatalogue } from '../lib/lex/stats-catalogue'

export {}

const selfTest = process.argv.includes('--self-test')
let pass = 0
let fail = 0
const failed: string[] = []
function ok(label: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; failed.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function run(breaks: Set<string>) {
  pass = 0; fail = 0; failed.length = 0
  const decision = breaks.has('drift')
    ? { ...STATS_LICENCE_DECISION, useContext: 'commercial' as const }
    : STATS_LICENCE_DECISION
  const running = statsUseContext()

  console.log('\n1. the decision is a decision — it has an owner, a date and a basis')
  ok('the register names a use context', decision.useContext === 'commercial' || decision.useContext === 'non-commercial')
  ok('the register carries an ISO date', /^\d{4}-\d{2}-\d{2}$/.test(breaks.has('undated') ? '' : decision.decidedOn),
    'a compliance decision with no date cannot be reviewed or aged out')
  ok('the register names who decided it', (breaks.has('unowned') ? '' : decision.decidedBy).trim().length > 10)
  ok('the register states the basis', decision.basis.trim().length > 40)
  ok('the register states what would make it need re-taking', decision.revisitWhen.trim().length > 40)

  console.log('\n2. the register and the RUNNING configuration agree')
  console.log(`     declared: ${decision.useContext}`)
  console.log(`     running:  ${running}   (from STATS_USE_CONTEXT in THIS environment)`)
  ok('declared use context === running use context', decision.useContext === running,
    `the dashboard and the register have diverged; one of them is wrong and nobody was told`)

  console.log('\n3. the licence gate runs in the direction the register assumes')
  const probe = 'international monetary fund'
  const nc = await searchCatalogue(probe, { limit: 5, useContext: 'non-commercial' })
  const cm = await searchCatalogue(probe, { limit: 5, useContext: 'commercial' })
  if (nc.unavailable || cm.unavailable) {
    console.log('  ! the statistics store is unreachable from here — the gate direction could NOT be')
    console.log('    asserted. Reported, not skipped silently: an unavailable store and a permissive')
    console.log('    gate must never produce the same green tick.')
    ok('gate direction asserted', false, 'statistics store unavailable (STATS_DATABASE_URL)')
  } else {
    const ncWithheld = breaks.has('invert') ? cm.licenceWithheld : nc.licenceWithheld
    const cmWithheld = breaks.has('invert') ? nc.licenceWithheld : cm.licenceWithheld
    console.log(`     non-commercial withholds ${ncWithheld}, commercial withholds ${cmWithheld}`)
    ok('commercial is the RESTRICTIVE context (it withholds more than non-commercial)',
      cmWithheld > ncWithheld,
      'if this inverts, restricted series are being served in a context the licence excludes')
    ok('non-commercial withholds nothing (the whole store is searchable)', ncWithheld === 0)
    // ⚠ THE LOAD-BEARING ARM. "commercial withholds more" would pass just as well if the query had
    // matched nothing at all in either arm. The permissive arm must actually RETURN something.
    ok('the permissive arm actually returns series (so the comparison is not two empty sets)',
      nc.results.length > 0, 'both arms empty — the comparison above proves nothing')
  }
  return { pass, fail, failed: [...failed] }
}

async function main() {
  console.log('═'.repeat(96))
  console.log('S10 §4.2 — CHECK: THE STATS LICENCE REGISTER AGREES WITH THE DEPLOYMENT')
  console.log('═'.repeat(96))
  console.log('⚠ This reads STATS_USE_CONTEXT from the environment it runs in. Locally that is this shell,')
  console.log('  NOT Vercel (SAML-blocked, docs/CLAUDE.md §19). Green here does not mean green in production.')
  const clean = await run(new Set())
  console.log(`\n${'═'.repeat(96)}\nRESULT: ${clean.pass}/${clean.pass + clean.fail} pass`)
  if (clean.fail) { console.log(`FAILED: ${clean.failed.join(' · ')}`); process.exitCode = 1 }

  if (selfTest) {
    const BREAKS: Array<{ name: string; mustFail: string }> = [
      { name: 'drift', mustFail: 'declared use context === running use context' },
      { name: 'undated', mustFail: 'the register carries an ISO date' },
      { name: 'unowned', mustFail: 'the register names who decided it' },
      { name: 'invert', mustFail: 'commercial is the RESTRICTIVE context (it withholds more than non-commercial)' },
    ]
    console.log(`\n${'═'.repeat(96)}\nSELF-TEST — every assertion watched failing first\n${'═'.repeat(96)}`)
    let fired = 0
    for (const b of BREAKS) {
      console.log(`\n── BREAK: ${b.name} ──`)
      const r = await run(new Set([b.name]))
      const didFail = r.failed.includes(b.mustFail)
      console.log(`  → ${didFail ? `FIRED ✓` : `DID NOT FIRE ✗ — "${b.mustFail}" still passed`}`)
      if (didFail) fired++
    }
    console.log(`\n${'═'.repeat(96)}\nSELF-TEST: ${fired}/${BREAKS.length} breaks fired`)
    if (fired !== BREAKS.length) process.exitCode = 1
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
