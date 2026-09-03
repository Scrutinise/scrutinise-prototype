// ─────────────────────────────────────────────────────────────────────────────────────────
// check:lex-25w — the notification that never happened, and the four decisions of 25-W.
//
// CLAUDE.md §23 (a check must prove its subject is reachable, and report checks RUN not only
// checks PASSED), §25 (assert the data present in the rendered output), §26 (the cold read)
// and §27 all apply.
//
// ⚠ THE SUBJECT OF THE DOCUMENT ASSERTIONS IS THE PILOT PROPOSAL — an idea this check did not
// create, did not title and does not touch, read through the same assembler and renderers the
// download route calls.
//
// Usage: npm run check:lex-25w
// ─────────────────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import { sendBuildCompleteEmail } from '../lib/email'
import { PASS_CEILING_MS, PASS_BUDGET_MS, HARD_STOP_MS, BUILD_PASSES } from '../lib/lex/build-config'
import { resumablePassKey, isResumable } from '../lib/lex/build-carry'
import { resolvedVectorStreams } from '../lib/lex/query-router'
import { buildState } from '../lib/lex/build'
import type { Block, DocumentModel } from '../lib/documents/model'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
let passed = 0, failed = 0, dead = 0, controls = 0
const notChecked: string[] = []
const findings: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
/** ⚠ The lambda returns whether the PROPERTY holds on a deliberately broken input. A control
 *  that merely re-matches the old text is the dead kind (CLAUDE.md §23). */
function control(label: string, holdsOnBroken: () => boolean) {
  controls++
  if (holdsOnBroken()) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label}`) }
  else console.log(`  ✓ fired — ${label}`)
}
/**
 * ⚠ A MEASURED DEFECT THAT IS NOT A REGRESSION. It prints, it is counted, and it does NOT
 * fail the run — because a check left permanently red over an undecided question is a check
 * that gets ignored, and then it stops catching what it was built for.
 */
function finding(label: string, detail: string) {
  findings.push(`${label} — ${detail}`)
  console.log(`  ⚠⚠ FINDING ${label}
       ${detail}`)
}
function skip(label: string, why: string) { notChecked.push(`${label} — ${why}`); console.log(`  · NOT CHECKED ${label} — ${why}`) }

/** ⚠ Comments stripped before any absence is asserted — this file's own ⚠ notes quote the
 *  lines that were removed. (CLAUDE.md, 30 Aug.) */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

function textOf(m: DocumentModel): string {
  const out: string[] = [m.title, m.subtitle ?? '', m.sourceLabel]
  for (const b of m.blocks as Block[]) {
    if (b.kind === 'section') out.push(b.title)
    else if (b.kind === 'heading' || b.kind === 'paragraph') out.push(b.runs.map((r) => r.text).join(''))
    else if (b.kind === 'bullets') for (const it of b.items) out.push(it.map((r) => r.text).join(''))
    else if (b.kind === 'note') out.push(b.text)
    else if (b.kind === 'sources') for (const r of b.refs) out.push(`${r.title} ${r.citation} ${r.url} ${r.date ?? ''} ${r.snippet ?? ''}`)
  }
  return out.join('\n')
}

async function main() {
  console.log('\n── check:lex-25w — the email that was never sent, and four decisions ──\n')

  // ══ §A — A SEND IS REPORTED FROM THE RESULT, NEVER FROM THE ABSENCE OF AN ERROR ═══════
  console.log('§A — the build-complete notification')
  {
    // ⚠ THE OPERATION IS PERFORMED, not inspected. The key is removed for the duration so the
    // "we declined to send" branch is the one under test — which is exactly the branch that
    // ran on the worker at 10:22 UTC on 2 September and reported a send.
    const held = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    let result: Awaited<ReturnType<typeof sendBuildCompleteEmail>>
    try {
      result = await sendBuildCompleteEmail({
        toEmail: 'nobody@example.invalid', toName: null,
        ideaId: IDEA, ideaTitle: 'check:lex-25w', status: 'DONE',
        durationText: 'a few minutes', failureReason: null,
      })
    } finally {
      if (held !== undefined) process.env.RESEND_API_KEY = held
    }

    ok('a send with no provider key returns sent=false, not void',
      result != null && result.sent === false, `sent=${result?.sent}`)
    ok('and it says why, naming the missing key',
      typeof result?.reason === 'string' && /RESEND_API_KEY/.test(result.reason), result?.reason ?? '(none)')
    ok('and it carries no provider id, because there was no send',
      result?.providerId === null, String(result?.providerId))

    // ⚠ The control is the OLD behaviour: a function returning void. The property under test is
    // "the caller can tell a send from a skip", and on the old code it does not hold.
    control('a void-returning send would let the caller claim a send', () => {
      const old = undefined as unknown as { sent?: boolean }
      return old?.sent === false
    })

    // Source-shaped, and legitimately so: the property is about what the file may contain.
    const build = stripComments(code('lib/lex/build.ts'))
    ok('§A — the "email sent" log is inside `if (result.sent)`',
      /if \(result\.sent\) \{\s*console\.log\('\[lex-diag\] 25b build-complete email sent'/.test(build))
    // ⚠ A COUNT, NOT AN ABSENCE. The first version asserted that no line began with that
    // `console.log` — and the only remaining one does, because it is indented inside the
    // `if`. It failed on correct code, which is the assertion being wrong rather than the
    // fix: what matters is that ONE such log exists and it is the guarded one.
    ok('§A — exactly one "email sent" log exists, and it is that one',
      (build.match(/console\.log\('\[lex-diag\] 25b build-complete email sent'/g) ?? []).length === 1)
    ok('§A — a failed send is reported with the reason',
      /build-complete email NOT SENT/.test(build))
    control('the absence assertion is not reading its own comment', () => {
      // The raw file DOES contain the old line, inside the ⚠ note explaining the defect. If
      // stripComments were removed, this property would still hold and the check would be blind.
      const raw = code('lib/lex/build.ts')
      return !/25b build-complete email sent/.test(raw)
    })
  }

  // ══ §B — THE OFFER IS MADE BY DEFAULT AGAIN ══════════════════════════════════════════
  console.log('\n§B — "email me when it\'s done", ticked by default')
  {
    // ⚠ THE DATABASE'S OWN DEFAULT, read out of the catalogue rather than out of the schema
    // file. `schema.prisma` says what we intend; `information_schema` says what is in force,
    // and the migration is the thing that can fail to have run.
    const rows = await prisma.$queryRawUnsafe<Array<{ column_default: string | null }>>(
      `SELECT column_default FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'emailOnBuildComplete'`,
    )
    const def = rows[0]?.column_default ?? '(no such column)'
    ok('the User column defaults to true in the live database',
      /^true/i.test(def), def)

    // A cold read: the state the page renders from, on an idea this check did not create.
    const state = await buildState(IDEA)
    const owner = await prisma.idea.findUnique({
      where: { id: IDEA }, select: { creator: { select: { emailOnBuildComplete: true } } },
    })
    ok('buildState.emailDefault reports the owner\'s stored preference',
      state.emailDefault === owner?.creator.emailOnBuildComplete,
      `state=${state.emailDefault} row=${owner?.creator.emailOnBuildComplete}`)

    // The tab warning is DRIVER-CONDITIONAL and must stay so: deleting it would make a flip
    // back to `client` silently promise something the architecture could not keep again.
    const card = stripComments(code('components/lex/ElicitationCards.tsx'))
    ok('§B — the checkbox is still offered only under the worker driver',
      /p\.driver === 'worker'/.test(card))
    ok('§B — and the "keep this tab open" sentence is still the CLIENT branch, not deleted',
      /Keep this tab open until it finishes/.test(card))
    // ⚠⚠ THE DRIVER IS READ OFF PRODUCTION, NOT OUT OF `buildState` HERE. The first version
    // asserted `state.driver === 'worker'` and failed — correctly, and for a reason that was
    // the check's fault: `buildDriver()` reads `process.env`, and THIS SHELL is a development
    // machine with no `LEX_BUILD_DRIVER`. It was measuring the laptop and calling it
    // production. §19's rule exactly: a behavioural reading off a reachable surface.
    let liveDriver: string | null = null
    try {
      const res = await fetch('https://www.scrutinise.org/api/health', { cache: 'no-store' })
      liveDriver = res.ok ? ((await res.json()) as { build?: { driver?: string } }).build?.driver ?? null : null
    } catch { liveDriver = null }
    if (liveDriver === null) skip('§B the live driver', '/api/health unreachable from here')
    else ok('§B — the driver in force on PRODUCTION is `worker`, so the tab warning does not render',
      liveDriver === 'worker', liveDriver)
  }

  // ══ §C — THE TITLE REACHES THE DOCUMENT ══════════════════════════════════════════════
  console.log('\n§C — a challenge title, in the rendered output')
  const snapshot = await buildProposalSnapshot(IDEA)
  {
    const withTitle = snapshot.issues.filter((i) => i.title?.trim())
    ok('the snapshot carries titles at all (it dropped them entirely before 25-W)',
      withTitle.length > 0, `${withTitle.length} of ${snapshot.issues.length}`)
    ok('§C — every challenge on the pilot idea now has one',
      snapshot.issues.length > 0 && withTitle.length === snapshot.issues.length,
      `${withTitle.length}/${snapshot.issues.length}`)

    const open = snapshot.issues.find((i) => i.title?.trim() && (i.status === 'OPEN' || i.status === 'DEFERRED'))
    if (!open) skip('§C the rendered title', 'no open titled challenge on this idea')
    else {
      const long = textOf(buildProposalDocument(snapshot).model)
      const pack = textOf(buildMeetingPackDocument(snapshot).model)
      ok('§C — the title appears in the LONG REPORT, ahead of its text',
        long.includes(`${open.title!.trim()} — `), open.title!)
      ok('§C — and in the MEETING PACK',
        pack.includes(`${open.title!.trim()} — `), open.title!)
      control('the rendered-title assertion is not satisfied by any string', () => {
        const invented = 'A title no challenge on this idea carries'
        return long.includes(`${invented} — `)
      })
    }
    ok('§D — the snapshot now carries the draft each challenge was raised against',
      snapshot.issues.every((i) => Number.isInteger(i.runVersion)),
      `versions ${[...new Set(snapshot.issues.map((i) => i.runVersion))].sort((a, b) => a - b).join(',')}`)
  }

  // ══ §E — THE PASS CEILING LEAVES A RESUMABLE BUILD ═══════════════════════════════════
  console.log('\n§E — the per-pass ceiling (decision 55)')
  {
    ok('the ceiling is 600s', PASS_CEILING_MS === 600_000, `${PASS_CEILING_MS}ms`)
    ok('it is above the slowest pass ever measured (SMART, 285.5s), so it cannot bite on work',
      PASS_CEILING_MS > 285_500)
    ok('it is below the whole-build hard stop, so it fires first on a hang',
      PASS_CEILING_MS < HARD_STOP_MS, `${PASS_CEILING_MS} < ${HARD_STOP_MS}`)
    ok('and it is a different instrument from the pass BUDGET, which is unchanged',
      PASS_BUDGET_MS === 240_000, `${PASS_BUDGET_MS}ms`)

    // ⚠⚠ THE PROPERTY CHARLIE ASKED FOR, THROUGH THE PRODUCT'S OWN PREDICATE. "The pass must
    // fail with a stated reason, leaving a resumable build, not a dead one." `resumablePassKey`
    // is imported, never re-implemented (§25 rule 3) — a check that restated it would assert
    // that two copies of a rule agree.
    const first = BUILD_PASSES[0].key, second = BUILD_PASSES[1].key
    const log = (status: string) => ([
      { key: first, status: 'DONE' },
      { key: second, status },
      ...BUILD_PASSES.slice(2).map((p) => ({ key: p.key, status: 'NOT_REACHED' })),
    ] as never)
    ok('§E — a pass stopped at the ceiling (NOT_REACHED) leaves the build resumable FROM IT',
      resumablePassKey(log('NOT_REACHED')) === second && isResumable(log('NOT_REACHED')),
      String(resumablePassKey(log('NOT_REACHED'))))
    control('the same log with the pass marked FAILED would NOT be resumable', () =>
      resumablePassKey(log('FAILED')) !== null)

    const build = stripComments(code('lib/lex/build.ts'))
    ok('§E — the ceiling ends in `stopBuild`, not in a pass failure',
      /return stopBuild\(buildId, \{ kind: 'pass-time', key, elapsedMs \}\)/.test(build))
    ok('§E — a late write from an abandoned pass is refused',
      /late pass write DROPPED/.test(build))
  }

  // ══ §F — RETRIEVAL, ON BOTH SIDES ════════════════════════════════════════════════════
  console.log('\n§F — the worker retrieves the way Vercel retrieves (decision 56)')
  {
    let health: { commit?: string; retrieval?: { vectorStreams?: unknown } } | null = null
    try {
      const res = await fetch('https://www.scrutinise.org/api/health', { cache: 'no-store' })
      health = res.ok ? await res.json() : null
    } catch { health = null }

    if (!health) skip('§F production readback', '/api/health unreachable from here')
    else if (!Array.isArray(health.retrieval?.vectorStreams)) {
      skip('§F production readback',
        `production (commit ${health.commit?.slice(0, 7) ?? '?'}) predates retrieval.vectorStreams — deploy first`)
    } else {
      const vercel = (health.retrieval!.vectorStreams as unknown[]).map(String)
      ok('§F — production reports its resolved stream list', true, vercel.join(',') || '(none)')
      skip('§F worker readback',
        'the worker\'s value is a Railway variable; `npm run sync:worker-retrieval` reports both')
      console.log(`      Vercel: ${vercel.join(',') || '(none)'} · this shell: ${resolvedVectorStreams().join(',') || '(none)'}`)
    }
  }

  // ══ §G — THE SCRATCH-IDEA TEST ═══════════════════════════════════════════════════════
  console.log('\n§G — does a build preserve settled decisions (decision 57)')
  {
    const scratch = await prisma.idea.findFirst({
      where: { title: { startsWith: '25W-DECISION-SURVIVAL' } },
      select: { id: true, builds: { select: { status: true, passesComplete: true }, orderBy: { version: 'desc' }, take: 1 } },
    })
    if (!scratch) skip('§G', 'the scratch idea has been swept — see docs/25W_DECISION_SURVIVAL.json')
    else if (scratch.builds[0]?.status !== 'DONE') {
      skip('§G', `its build is ${scratch.builds[0]?.status ?? 'not started'}, not DONE`)
    } else {
      // ══ ⚠⚠ THESE ARE FINDINGS, NOT ASSERTIONS, AND THE DISTINCTION IS DELIBERATE ═══════
      //
      // Decision 57 asked what survives a build, not that everything must. Three of the four
      // do not, and writing them as `ok()` would leave this check permanently red over a
      // defect nobody has yet decided to fix — which is how a check gets switched off, and
      // then stops catching the things it WAS built to catch.
      //
      // ⚠ But they are not silently dropped either: a finding prints loudly, is counted in
      // the tally, and names what would settle it. The one property 25-V predicted SAFE is
      // asserted, because that one is a claim about the code that can regress.
      const opt = await prisma.policyOption.findFirst({
        where: { ideaId: scratch.id, status: 'RULED_OUT' }, select: { id: true },
      })
      ok('§G — the ruled-out policy option is still RULED_OUT after a full build',
        !!opt, opt ? opt.id.slice(0, 8) : 'gone or reopened')

      const fields = await prisma.ideaFieldState.findMany({
        where: { ideaId: scratch.id, fieldKey: { in: ['rootCause', 'chosenApproach'] } },
        select: { fieldKey: true, status: true, value: true },
      })
      for (const f of fields) {
        if (f.status === 'ACCEPTED') ok(`§G — the accepted \`${f.fieldKey}\` is still ACCEPTED`, true)
        else finding(`§G — an accepted \`${f.fieldKey}\` was knocked back to ${f.status} by the build`,
          'the VALUE survived; the acceptance did not. `setStatus` has no ACCEPTED guard — ' +
          'fixing that is a decision, not a regression')
      }
      const lexRoot = await prisma.diagnosisCause.count({
        where: { ideaId: scratch.id, source: 'LEX_CORPUS', isRootCause: true },
      })
      const userCauses = await prisma.diagnosisCause.count({
        where: { ideaId: scratch.id, source: { not: 'LEX_CORPUS' } },
      })
      if (lexRoot > 0) ok('§G — the root-cause mark on a Lex-authored cause survived', true)
      else finding('§G — the root-cause mark on a Lex-authored cause did NOT survive',
        `REVISE deletes every LEX_CORPUS cause and writes new ones, so the mark died with the ` +
        `row (${userCauses} user-authored cause(s) survived, as 25-V predicted)`)
    }
  }

  // ── the tally, including what was NOT checked (§23) ──────────────────────────────────
  console.log(`\n── ${passed} passed, ${failed} failed, ${findings.length} FINDINGS, ` +
    `${notChecked.length} NOT CHECKED, ${controls} controls (${dead} dead) ──`)
  for (const f of findings) console.log(`  ⚠⚠ FINDING: ${f}`)
  for (const n of notChecked) console.log(`  · NOT CHECKED: ${n}`)
  if (failed || dead) process.exitCode = 1
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
