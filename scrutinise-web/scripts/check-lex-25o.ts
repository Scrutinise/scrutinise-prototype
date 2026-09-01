// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25o — the sprint's own guards.
//
// ⚠ EVERY ASSERTION HAS A NEGATIVE CONTROL THAT MUST FIRE (CLAUDE.md §23). And 25-N's own
// lesson is applied from the start: an "this string must NOT appear" assertion reads the file
// with its COMMENTS STRIPPED, because the ⚠ note explaining a deletion quotes the deleted
// string. Four of 25-N's assertions failed against correct code for exactly that reason.
//
// ⚠ WHERE A PROPERTY IS ABOUT A VALUE, THE ASSERTION READS THE VALUE. §1's allowance arithmetic
// runs the real pricing over real shapes; §5's commentary predicate is IMPORTED from the module
// that writes it rather than restated (25-N §4's lesson, where a re-implemented predicate
// published a number that was wrong).
//
// Usage: npm run check:lex-25o
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  PILOT_ALLOWANCE_THIRDS, FULL_BUILD_THIRDS, REUSE_BUILD_THIRDS,
} from '../lib/lex/allowance'
import { LIVE_IDEA, INCLUDING_ARCHIVED } from '../lib/lex/idea-visibility'
import { BUILD_PASSES, type BuildPassKey } from '../lib/lex/build-config'
import { commentaryIsSubstantive, type CausesCommentary } from '../lib/lex/build-commentary'
import { PUBLIC_VIEW_HOLDING_LINE } from '../app/ideas/[id]/public/page'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const controls: Array<{ label: string; fired: boolean }> = []
/** The lambda returns whether the PROPERTY HOLDS on deliberately broken input. It must not. */
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  let held: boolean
  try { held = propertyHoldsOnBrokenInput() } catch { held = false }
  controls.push({ label, fired: !held })
}

const ROOT = process.cwd()
function read(rel: string): string {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : ''
}
/** ⚠ 25-N's lesson: an absence assertion must not read the comment that explains the absence. */
function code(rel: string): string {
  return read(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function main() {
  console.log('── check:lex-25o ──\n')

  // ══ §1 — THE ALLOWANCE IS RESERVED, NOT CHECKED ════════════════════════════
  console.log('§1 — the allowance')

  const allowance = read('lib/lex/allowance.ts')
  // ⚠ THE HOLD IS COUNTED. Without the in-flight query, two builds started in the same window
  // both pass the door check because neither is DONE yet — which is the race §1a is about.
  ok('§1a — an in-flight build holds thirds, counted off the QUEUED/RUNNING rows',
    /status: \{ in: \['QUEUED', 'RUNNING'\] \}/.test(allowance)
    && /reservedThirds = inFlight\.reduce/.test(allowance)
    && /grantedThirds - spentThirds - reservedThirds/.test(allowance))
  control('a remaining balance that ignores what is held',
    () => /grantedThirds - spentThirds - reservedThirds/.test(
      allowance.replace('grantedThirds - spentThirds - reservedThirds', 'grantedThirds - spentThirds')))

  // ⚠⚠ §1b's RELEASE IS STRUCTURAL — a reservation IS the row being QUEUED or RUNNING, so the
  // moment the status leaves that set the hold is gone and there is nothing to leak. The
  // assertion is therefore that NO release write exists, which is the opposite of the obvious
  // one and is the stronger property.
  ok('§1b — the release needs no write, so it cannot be missed on a path',
    !/releaseReservation|releaseAllowance/.test(code('lib/lex/allowance.ts'))
    && !/releaseReservation/.test(code('lib/lex/build.ts')))
  ok('§1b — and a hold expires, so a row stuck at RUNNING cannot hold thirds for ever',
    /RESERVATION_MAX_AGE_MS/.test(allowance)
    && /createdAt: \{ gte: new Date\(Date\.now\(\) - RESERVATION_MAX_AGE_MS\) \}/.test(allowance))
  control('a reservation with no expiry',
    () => /RESERVATION_MAX_AGE_MS/.test(allowance.replace(/RESERVATION_MAX_AGE_MS/g, 'X')))

  // §1b — a stopped build reports what came back; a DONE one reports nothing, because it spent it.
  const buildSrc = read('lib/lex/build.ts')
  ok('§1b — a FAILED or CANCELLED build says what it released; a DONE one does not',
    /row\.status === 'FAILED' \|\| row\.status === 'CANCELLED'/.test(buildSrc)
    && /releasedThirds/.test(read('components/lex/BuildProgress.tsx')))
  control('a DONE build also claiming a release',
    () => /row\.status === 'FAILED' \|\| row\.status === 'CANCELLED'/.test(
      buildSrc.replace("row.status === 'FAILED' || row.status === 'CANCELLED'", "true")))

  // ⚠⚠ §1a's REAL DEFECT: the check was priced against the mode ASKED FOR, and `reuseFrom`
  // decides what will RUN twenty lines later. A REUSE request with nothing to reuse is
  // downgraded to FULL — so one third bought a three-third build.
  ok('§1a — the allowance is priced against the mode that will RUN, not the one requested',
    /const effectiveMode: 'FULL' \| 'REUSE' = reuseFrom \? 'REUSE' : 'FULL'/.test(buildSrc)
    && /allowanceBlock\(ideaOwner\.creatorId, effectiveMode\)/.test(buildSrc)
    && /mode: effectiveMode,/.test(buildSrc)
    // and the check must come AFTER reuseFrom is resolved, or it is the old bug again
    && buildSrc.indexOf('const reuseFrom =') < buildSrc.indexOf('allowanceBlock(ideaOwner.creatorId'))
  control('the check running before the mode is decided',
    () => {
      const broken = buildSrc.replace('const effectiveMode', 'const unusedMode')
      return /const effectiveMode: 'FULL' \| 'REUSE'/.test(broken)
    })

  ok('§1a — the refusal names the shortfall rather than only that there is one',
    /you are \$\{short\} short/.test(allowance) && /const short = want - a\.remainingThirds/.test(allowance))

  // §1c — three full builds and three re-runs, as configuration.
  ok('§1c — the pilot allowance is 3 builds + 3 re-runs, and it is configuration',
    PILOT_ALLOWANCE_THIRDS === 3 * FULL_BUILD_THIRDS + 3 * REUSE_BUILD_THIRDS
    && /process\.env\.LEX_PILOT_ALLOWANCE_THIRDS/.test(allowance),
    `${PILOT_ALLOWANCE_THIRDS} thirds`)
  // ⚠ AND IT MUST NOT OVERWRITE AN ADMIN'S DECISION. The column has a database default of 4, so
  // the NOTE — required on every admin write and written by nothing else — is the only reliable
  // record that somebody decided.
  ok('§1c — an explicit admin grant survives, and the note is what marks one',
    /grantedExplicitly = !!user\?\.buildAllowanceNote/.test(allowance)
    && /grantedExplicitly \? user\.buildAllowanceThirds : PILOT_ALLOWANCE_THIRDS/.test(allowance))
  control('the pilot default overwriting an admin grant',
    () => /grantedExplicitly \? user\.buildAllowanceThirds/.test(
      allowance.replace('grantedExplicitly ? user.buildAllowanceThirds : PILOT_ALLOWANCE_THIRDS',
        'PILOT_ALLOWANCE_THIRDS')))

  // §1d — the resume control renders. ⚠ THE LIVE RESUME IS NOT PROVEN BY THIS AND SAYS SO.
  ok('§1d — the resume control renders where a build is resumable',
    /Carry on from/.test(read('components/lex/BuildProgress.tsx'))
    && /onResume=\{!running \? resumeBuildNow : undefined\}/.test(read('app/ideas/build/BuildIdeaClient.tsx')))
  console.log('    ⚠ §1d — THIS IS A RENDER ASSERTION. It proves the control is on the page and')
  console.log('      reachable. It does NOT prove a resume resumes: that needs a build that')
  console.log('      actually stops, and costs two passes. Reported as unproven, per §1d.')

  // ══ §2 — THE PUBLIC VIEW IS A HOLDING PAGE ═════════════════════════════════
  console.log('\n§2 — the public view')

  ok('§2 — the line is §2\'s, verbatim',
    PUBLIC_VIEW_HOLDING_LINE
      === 'The public view is being built. This is what your team sees today; the version the '
        + 'public will see is coming.')
  ok('§2 — "See it as others would" no longer points at the team page',
    /\/ideas\/\$\{ideaId\}\/public/.test(read('app/ideas/build/BuildIdeaClient.tsx')))
  ok('§2 — the holding page shows the title and summary and nothing else',
    /summaryDescription/.test(read('app/ideas/[id]/public/page.tsx'))
    // ⚠ NOT the kernel: a half-built public view is harder to replace than an empty one.
    && !/diagnosisCauses|chosenApproach|lexActions/.test(code('app/ideas/[id]/public/page.tsx')))
  control('a holding page that started rendering the kernel',
    () => !/chosenApproach/.test(`${code('app/ideas/[id]/public/page.tsx')}\nchosenApproach: true,`))

  // ══ §4 — ARCHIVING ═════════════════════════════════════════════════════════
  console.log('\n§4 — archiving')

  ok('§4b — archived is its own column, not an overloaded deletedAt',
    /archivedAt/.test(read('prisma/schema.prisma'))
    && JSON.stringify(LIVE_IDEA) === JSON.stringify({ deletedAt: null, archivedAt: null }))
  // ⚠⚠ §4d's PROPERTY IS ABOUT NINE CALL SITES, so the assertion is that they SHARE the
  // predicate — a hand-written `archivedAt: null` passes a grep and is exactly what drifts.
  const readers = [
    'app/dashboard/page.tsx',
    'app/ideas/page.tsx',
    'app/ideas/build/page.tsx',
    'app/ideas/create/page.tsx',
    'lib/lex/orchestrator.ts',
    'app/api/ideas/[id]/lex/route.ts',
  ]
  for (const r of readers) {
    ok(`§4d — ${r} filters through LIVE_IDEA`, /LIVE_IDEA/.test(read(r)))
  }
  ok('§4b — the two deliberate exceptions are named, not accidental',
    /GDPR data export/.test(read('app/api/user/export/route.ts'))
    && /DELIBERATELY DOES \*\*NOT\*\* APPLY `LIVE_IDEA`/.test(read('app/api/admin/ideas/search/route.ts'))
    && JSON.stringify(INCLUDING_ARCHIVED) === JSON.stringify({ deletedAt: null }))
  control('a reader that hand-writes the predicate instead of importing it',
    () => /LIVE_IDEA/.test(read('app/dashboard/page.tsx').replace(/LIVE_IDEA/g, 'archivedAt: null')))

  const archiver = read('scripts/archive-ideas.ts')
  ok('§4a — the script lists first and archives only on an explicit flag',
    /DRY RUN\. Nothing has been changed\./.test(archiver) && /has\('archive'\)/.test(archiver))
  ok('§4a — and it refuses to archive without a narrowing filter',
    /--archive needs --ids or --owners/.test(archiver))
  ok('§4c — it RE-READS and prints the re-read, not the update\'s claim',
    /That is its OPINION — the re-read follows/.test(archiver)
    && /re-read from the database/.test(archiver))
  ok('§4d — it asserts the negative AND a control that must still be visible',
    /still pass the live-idea filter/.test(archiver) && /an idea that was NOT archived/.test(archiver))
  control('an archive script with no re-read',
    () => /re-read from the database/.test(archiver.replace('re-read from the database', 'done')))

  // ══ §5 — THE COMMENTARY ════════════════════════════════════════════════════
  console.log('\n§5 — the opening commentary')

  const keys = BUILD_PASSES.map((p) => p.key)
  ok('§5 — the pass exists and runs AFTER the revision that rewrites the causes',
    keys.includes('CAUSES_COMMENTARY' as BuildPassKey)
    && keys.indexOf('CAUSES_COMMENTARY' as BuildPassKey) > keys.indexOf('REVISE' as BuildPassKey),
    keys.join(' → '))
  ok('§5 — and before the verification passes, so a late ceiling loses a check and not this',
    keys.indexOf('CAUSES_COMMENTARY' as BuildPassKey) < keys.indexOf('KERNEL_CHECK' as BuildPassKey))
  ok('§5 — it survives its own failure, because it is a briefing and not part of the kernel',
    BUILD_PASSES.find((p) => p.key === 'CAUSES_COMMENTARY')?.continueOnFailure === true)

  // ⚠⚠ §5's "ASSERT THE VALUE, NOT THE SCHEMA", and the predicate is IMPORTED rather than
  // restated — 25-N §4's lesson, where a re-implemented predicate published a wrong number.
  const full: CausesCommentary = {
    terrain: 'The evidence is mostly from debates rather than measurement.',
    complexity: 'SEVERAL_BIND',
    complexityWhy: 'Two causes each bind independently.',
    howPiecesFit: 'The second sits beneath the first.',
    conflicts: [{ claim: 'Productivity has improved', against: 'No figures are given', whyItMatters: 'It is the only source for the claim' }],
  }
  ok('§5 — a complete commentary is substantive', commentaryIsSubstantive(full))
  ok('§5 — a commentary of empty strings is NOT, though it satisfies every structural check',
    !commentaryIsSubstantive({ ...full, terrain: '   ', }))
  ok('§5 — and an empty conflicts list is refused UNLESS it is defended',
    !commentaryIsSubstantive({ ...full, conflicts: [] })
    && commentaryIsSubstantive({ ...full, conflicts: [], noConflictFound: 'Every source agrees; I read all nine.' }))
  control('a predicate that accepts an undefended empty conflicts list',
    () => commentaryIsSubstantive({ ...full, conflicts: [] }))
  control('a predicate that accepts blank prose',
    () => commentaryIsSubstantive({ ...full, terrain: '', howPiecesFit: '' }))

  const commentary = read('lib/lex/build-commentary.ts')
  ok('§5 — the prompt names the standard and forbids inventing a conflict',
    /do NOT invent a disagreement to fill the list/.test(commentary)
    && /there are plenty of numbers saying the opposite/.test(commentary))
  // ⚠ §0/§5 — IT DESCRIBES, IT DOES NOT DECIDE. 25-P owns the choice mechanics.
  ok('§5/§0 — it does not pre-empt the guiding-policy choice',
    /YOU ARE DESCRIBING, NOT DECIDING/.test(commentary)
    && !/recommend|ranked|"?bestCause"?/.test(JSON.stringify(Object.keys(full))))
  // ══ 25-R §4a NAMED THIS ASSERTION, AND 25-R's ADDENDUM MADE IT PROVE THE POINT ══════
  //
  // It used to compare CHARACTER OFFSETS IN THE SOURCE FILE — the tag's index against the index
  // of the string "Add cause" — as a proxy for what is higher on the SCREEN. It passed for a
  // sprint while the component never mounted, which is what §4a reported.
  //
  // ⚠⚠ AND THEN IT WENT RED ON A CORRECT FIX. Moving the commentary OUT of `CausesField` and up
  // to the top of the section put it LATER in the file (offset 35,719 → 91,406) and HIGHER on
  // the page. Source order and render order are unrelated, and this assertion would have argued
  // for reverting the fix.
  //
  // ⚠ THE PROPERTY IS STRUCTURAL, so it is asserted structurally: the commentary is rendered by
  // the page loop BEFORE the fields are mapped, and it is NOT inside `CausesField`. That is what
  // "above the choice" means in a component tree.
  const panelSrc = read('components/lex/FieldsPanel.tsx')
  ok('§5 — the commentary is rendered above the section\'s fields, not inside one of them',
    panelSrc.indexOf('<CausesCommentaryPanel') < panelSrc.indexOf('page.fields.map(')
    && !/function CausesField[\s\S]{0,600}<CausesCommentaryPanel/.test(panelSrc))
  control('the commentary rendered below the causes',
    () => {
      const f = read('components/lex/FieldsPanel.tsx')
      return f.indexOf('<CausesCommentaryPanel') < f.indexOf('Add cause')
        && f.indexOf('<CausesCommentaryPanel') === -1
    })

  // ══ ADDENDUM §A1 — THE KEY THE PANEL WRITES IS THE KEY THE PANEL READS ═════
  console.log('\nADDENDUM §A1 — "Add to report" wrote a row the middle column never read')

  const qp = read('lib/lex/question-panel.ts')
  // ⚠⚠ THE DEFECT WAS AN ASYMMETRY BETWEEN TWO LOOKUPS OF THE SAME MAP:
  //     exclusion: [e.sourceId, e.id].find(...)      ← both keys
  //     priority:  e.sourceId && priority.has(...)   ← sourceId only
  // The write sends `entry.id`. So the assertion is that ONE function serves both — two
  // expressions that happen to agree is one that will drift, and this is what drifting looked
  // like: working in the generated document and nowhere on screen.
  ok('§A1 — exclusion and priority resolve through ONE shared key function',
    /const decisionKey = /.test(qp)
    && /const exclusionKey = decisionKey\(e, excluded\)/.test(qp)
    && /priority: !!decisionKey\(e, priority\)/.test(qp))
  ok('§A1 — and it tries the row\'s own id FIRST, so a per-finding decision stays per-finding',
    /\[e\.id, e\.sourceId\]/.test(qp))
  control('the priority read going back to sourceId alone',
    () => /priority: !!decisionKey\(e, priority\)/.test(
      qp.replace('priority: !!decisionKey(e, priority)',
        'priority: !!(e.sourceId && priority.has(e.sourceId))')))
  control('the two lookups drifting apart again',
    () => {
      const broken = qp.replace('const exclusionKey = decisionKey(e, excluded)',
        'const exclusionKey = [e.sourceId, e.id].find((k) => k && excluded.has(k))')
      return /const exclusionKey = decisionKey\(e, excluded\)/.test(broken)
    })

  // ⚠ AND THE ROUND TRIP IS A LIVE CHECK, NOT A SOURCE ONE. A grep cannot see a join that
  // misses — `check:lex-25n` asserted the filter and the button label, both true, for a
  // feature that rendered nothing. `verify:write-paths` reads the value back through the real
  // assembler, which is the only thing that could have caught this.
  ok('§A1 — a live round-trip verifier exists for all three of 25-N\'s write paths',
    /verify-write-paths/.test(read('package.json'))
    && /it SURVIVES A RELOAD/.test(read('scripts/verify-write-paths.ts'))
    && /the Notes write path/.test(read('scripts/verify-write-paths.ts'))
    && /the worklist tick write path/.test(read('scripts/verify-write-paths.ts')))

  // ══ ADDENDUM §A2 — THE SUPPORTING SECTIONS ARE CLOSED BY DEFAULT ═══════════
  console.log('\nADDENDUM §A2 — the middle column shows the kernel, not everything at once')

  const collapsed = read('components/lex/CollapsedSection.tsx')
  ok('§A2 — the shell defaults CLOSED, which is the opposite of the kernel\'s rule',
    /defaultOpen = false/.test(collapsed) && /useState\(defaultOpen\)/.test(collapsed))
  ok('§A2 — and it is the same control as the kernel headings: a word, not a bare glyph',
    /show \+/.test(collapsed) && /hide −/.test(collapsed) && /aria-expanded=\{open\}/.test(collapsed))
  ok('§A2 — an empty section renders NOTHING rather than a heading promising content',
    /if \(empty\) return null/.test(collapsed))
  for (const [f, label] of [
    ['components/lex/ReportAdditions.tsx', '"What you have put in the report"'],
    ['components/lex/AgendaPanel.tsx', '"What to do next"'],
  ] as const) {
    ok(`§A2 — ${label} is wrapped in it`, /<CollapsedSection/.test(read(f)))
  }
  // ⚠ THE RESEARCH PANEL'S COPY OF THE AGENDA IS NOT WRAPPED — it already lives inside a
  // one-item-at-a-time contents list, and a collapse inside a collapse is two controls for one act.
  ok('§A2 — but the research panel\'s copy is NOT double-wrapped',
    /if \(judgements\) \{/.test(read('components/lex/AgendaPanel.tsx')))
  control('a supporting section left open by default',
    () => /defaultOpen = false/.test(collapsed.replace('defaultOpen = false', 'defaultOpen = true')))

  // ── controls ──────────────────────────────────────────────────────────────
  console.log('\n── negative controls: each must FIRE ──')
  for (const c of controls) {
    if (c.fired) { pass++; console.log(`  ✓ control fired — ${c.label}`) }
    else { fail++; console.log(`  ✗ CONTROL DID NOT FIRE — ${c.label}`) }
  }

  console.log(`\n${pass} passed, ${fail} failed. ${controls.length} controls, ${controls.filter((c) => c.fired).length} fired.`)
  if (fail) process.exit(1)
}

main()
