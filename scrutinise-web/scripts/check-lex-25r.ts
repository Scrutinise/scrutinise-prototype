// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25r — THE COLD READ. §4c's mechanism, and the sprint's real deliverable.
//
// 25-R §4c: *"Propose what would have caught all three. ⚠ Not a rule — a mechanism. A rule was
// added last sprint and did not survive contact with the next two sprints."*
//
// ══ WHAT A COLD READ IS, AND WHY THE OTHER CHECKS DID NOT CATCH THESE ═══════════════
//
// CLAUDE.md §25 says a check must assert the data present in the rendered output. All three of
// this sprint's defects had a check that did exactly that and passed — because the check
// **created the conditions the feature needs, and then asserted the feature worked**:
//
//   · `check:lex-25p` called `readPolicyState()` on its fixture. That function calls
//     `ensureNumbered()`. So the policies were numbered BECAUSE THE CHECK NUMBERED THEM, and it
//     then asserted they were numbered. In production nothing calls it, and a real idea built
//     today has 0 of 3 numbered.
//   · `check:lex-25q` called `applyFieldEdit()` directly, which is downstream of the gate that
//     decides whether an offer is ever computed. The gate was asserted by a source grep.
//   · `check:lex-25o` never read a row at all — it is one of the 18 the 25-P audit counted as
//     reading no system output.
//
// So the mechanism is not "read the output". It is:
//
//   ⚠⚠ A COLD READ TAKES A SUBJECT THE CHECK DID NOT CREATE AND DID NOT TOUCH, AND CALLS ONLY
//   WHAT THE BROWSER CALLS. No fixture, no setup, no calling the feature's own functions first.
//   If the feature needs something to have happened, the cold read finds out whether it happened
//   — rather than making it happen and admiring the result.
//
// ⚠ IT RUNS AGAINST REAL BUILT IDEAS ON PRODUCTION, and it is READ-ONLY: it creates nothing,
// writes nothing, and calls no function that has a side effect. That is not a nicety —
// `readPolicyState` is exactly such a function, and calling it here would destroy the measurement
// by numbering the very rows under test.
//
// Usage: npm run check:lex-25r
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { computeCanonicalState } from '../lib/lex/state'
import { commentaryIsSubstantive, type CausesCommentary } from '../lib/lex/build-commentary'
import { collapsedByDefault } from '../lib/lex/panel-collapse'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const controls: Array<{ label: string; fired: boolean }> = []
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  let held: boolean
  try { held = propertyHoldsOnBrokenInput() } catch { held = false }
  controls.push({ label, fired: !held })
}

function code(rel: string): string {
  const p = join(process.cwd(), rel)
  if (!existsSync(p)) return ''
  return readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * ⚠⚠ THE SUBJECT IS CHOSEN BY WHAT THE USER DID, NOT BY WHAT THE CHECK NEEDS. The most recently
 * built idea that finished a build — whatever state that leaves it in. Choosing "an idea where the
 * guiding policy page is still open" would be selecting the sample that makes the feature look
 * well, which is the whole failure this file exists to catch.
 */
async function subjects(limit = 3) {
  const builds = await prisma.ideaBuild.findMany({
    where: { status: 'DONE' },
    orderBy: { completedAt: 'desc' },
    take: 20,
    select: { ideaId: true, version: true, completedAt: true },
  })
  const seen = new Set<string>()
  const out: Array<{ ideaId: string; version: number }> = []
  for (const b of builds) {
    if (seen.has(b.ideaId)) continue
    seen.add(b.ideaId)
    out.push({ ideaId: b.ideaId, version: b.version })
    if (out.length >= limit) break
  }
  return out
}

/**
 * ⚠⚠ IMPORTED, NOT COPIED — AND THE FIRST DRAFT OF THIS FILE COPIED IT.
 *
 * It kept its own `complete || visited` plus a regex asserting the copy still matched the panel.
 * That guard went RED on the first run after the rule was fixed, which is the guard working and
 * is also the argument against needing one: the rule now lives in `lib/lex/panel-collapse.ts`,
 * the panel calls it, this calls it, and there is nothing to drift.
 */

/**
 * ⚠ THE DATE THE IN-BUILD SORT SHIPPED. A build older than this could not have sorted its own
 * candidates, so asserting it on one would fail correct code — and skipping it silently would let
 * the assertion pass on an empty set. It is NOT CHECKED, counted, and printed.
 */
const SORT_IN_BUILD_SINCE = new Date('2026-09-01T14:00:00Z')

/** Things this run could not check, and why. Printed at the end so a skip cannot read as a pass. */
const unverified: string[] = []

async function main() {
  console.log('\n── check:lex-25r — the cold read ──\n')
  console.log('  ⚠ READ-ONLY. It creates nothing and calls nothing with a side effect.\n')

  const src = code('components/lex/FieldsPanel.tsx')
  ok('the panel calls the shared collapse rule rather than writing its own',
    /pageCollapsedByDefault\(page\.status\)/.test(src))
  ok('and a collapsed page still unmounts its fields rather than hiding them',
    /\{!isLocked && !collapsed && \(/.test(src))
  // ⚠⚠ THE RULE ITSELF — AND ADDENDUM A1 REVERSED IT, so this assertion is reversed with it.
  // 25-R opened `visited` sections because a build marks every page visited and was hiding its
  // own output. Charlie's answer was neither of §6's options: keep them collapsed and tidy, and
  // announce the build through the WORKLIST instead. So `visited` collapses again — deliberately
  // this time — and what makes that safe is asserted in the A4 block below, not here.
  ok('a page a build has written to collapses, per A1',
    collapsedByDefault('visited') && collapsedByDefault('complete'))
  ok('and the page the user is working in stays open', !collapsedByDefault('active'))
  control('a rule that collapsed the active page would fail that',
    () => !((s: string) => s !== 'locked')('active'))

  const subj = await subjects()
  if (!subj.length) { console.log('  No completed builds to read.'); process.exit(1) }
  console.log(`\n  reading ${subj.length} real built idea(s), most recent first:`)
  for (const s of subj) console.log(`    ${s.ideaId.slice(0, 8)} v${s.version}`)

  for (const s of subj) {
    const tag = s.ideaId.slice(0, 8)
    console.log(`\n══ ${tag} ══`)
    // ⚠ `computeCanonicalState` is what the page loads. It has no side effect on these rows.
    const st = await computeCanonicalState(s.ideaId)
    if (!st) { ok(`${tag}: state loads`, false); continue }

    // ── §1 — THE COMMENTARY REACHES A SCREEN ─────────────────────────────────
    const build = await prisma.ideaBuild.findFirst({
      where: { ideaId: s.ideaId, causesCommentary: { not: undefined } },
      orderBy: { version: 'desc' },
      select: { version: true, causesCommentary: true },
    })
    const commentary = (build?.causesCommentary ?? null) as unknown as CausesCommentary | null
    const hasCommentary = commentaryIsSubstantive(commentary)
    if (!hasCommentary) {
      console.log(`  §1 ${tag}: no substantive commentary on v${build?.version ?? '—'} — nothing to render, skipped`)
    } else {
      const causesPage = st.pages.find((p) => p.fields.some((f) => f.key === 'causes'))
      // ══ ADDENDUM A4 — THE SECTION IS SHUT AGAIN, SO WHAT MUST BE TRUE HAS CHANGED ══════
      //
      // A1 restored the collapse: after a build the kernel sections are tidy and the WORKLIST is
      // the entry point. So "its section is open" is no longer the property — it would now fail
      // on correct code, which is the same mistake as asserting the broken gate in §3.
      //
      // ⚠⚠ WHAT MUST BE TRUE INSTEAD (A4): **a section that is shut must be shut, not absent**,
      // and opening it must mount and fetch. The three halves of that are asserted here and
      // below; the fourth — that it visibly draws — was measured live in production and is
      // recorded in the report, because a cold read cannot see a paint.
      ok(`§1 ${tag}: there is a commentary for the section to hold`, !!causesPage)
      ok(`§1 ${tag}: and the route would hand it over`,
        commentaryIsSubstantive(commentary),
        `build v${build?.version}`)
    }

    // ── §2 — THE GUIDING POLICY, WITHOUT TOUCHING IT ─────────────────────────
    //
    // ⚠⚠ READ WITH `prisma`, NOT WITH `readPolicyState`. That function calls `ensureNumbered`,
    // which WRITES — so calling it here would number the rows and then assert they were numbered,
    // which is precisely how `check:lex-25p` passed while a real idea had none.
    const pols = await prisma.policyOption.findMany({
      where: { ideaId: s.ideaId, kind: 'GUIDING_POLICY', status: { not: 'RULED_OUT' }, mergedIntoId: null },
      select: { number: true, sortedAt: true, kindReason: true, importance: true },
    })
    if (!pols.length) {
      console.log(`  §2 ${tag}: no live policy options — skipped`)
    } else {
      ok(`§2 ${tag}: every candidate is numbered after a build`,
        pols.every((p) => p.number != null),
        `${pols.filter((p) => p.number != null).length}/${pols.length} numbered`)
      // ══ THE SORT CAN ONLY BE ASSERTED ON A BUILD THAT RAN AFTER IT SHIPPED ══════
      //
      // ⚠⚠ AND A BUILD THAT PREDATES IT IS **NOT CHECKED**, NOT PASSED. Every existing build ran
      // before the sort was added to the approach pass, so asserting it on them would fail
      // correct code; quietly excluding them would let the whole of §2's second half pass on an
      // empty set. Both are wrong in the same direction as the defects this sprint is about.
      //
      // ⚠ SO IT IS COUNTED, AND THE COUNT IS PRINTED AT THE END. `unverified` is what stops
      // "skipped" from reading as "fine".
      const built = await prisma.ideaBuild.findFirst({
        where: { ideaId: s.ideaId, status: 'DONE' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true, version: true },
      })
      const afterSort = !!built?.completedAt && built.completedAt >= SORT_IN_BUILD_SINCE
      if (!afterSort) {
        unverified.push(`§2 ${tag}: the sort — newest build v${built?.version} finished `
          + `${built?.completedAt?.toISOString().slice(0, 16)}, before the in-build sort shipped`)
        console.log(`  · §2 ${tag}: sort NOT CHECKED — v${built?.version} predates the in-build sort`)
      } else {
        ok(`§2 ${tag}: the sort has run on them`,
          pols.every((p) => !!p.sortedAt),
          `${pols.filter((p) => p.sortedAt).length}/${pols.length} sorted`)
        ok(`§2 ${tag}: and Lex's reasoning is there to show`,
          pols.every((p) => !!p.kindReason),
          `${pols.filter((p) => p.kindReason).length}/${pols.length} carry a reason`)
      }
      const policyPage = st.pages.find((p) => p.fields.some((f) => f.key === 'policyOptions'))
      // A1 — shut is correct now. What matters is that the page exists to be opened.
      ok(`§2 ${tag}: the candidates have a section to be opened into`, !!policyPage,
        `page "${policyPage?.key}" is ${policyPage?.status}`)
    }

    // ── §3 — WOULD THE REWRITE OFFER EVEN BE COMPUTED? ───────────────────────
    //
    // ⚠ THE GATE, EVALUATED THE WAY `/lex` EVALUATES IT. `route.ts` only reads policy rows when
    // `currentField` is `policyOptions`; with anything else `livePolicies` is empty, Lex is never
    // shown the numbers, and `resolvePolicyTarget` can only return null. So the offer cannot fire
    // no matter what Lex says.
    // ⚠⚠ THE FIRST VERSION OF THIS ASSERTED `currentField === 'policyOptions'` — which was the
    // BROKEN GATE, not the property. It went red correctly before the fix and would have gone on
    // demanding the user stand in one place for ever. The property is: **wherever the user is, if
    // this idea has candidates, the offer path can see them.**
    const cf = st.currentField?.key ?? null
    const visible = pols.filter((p) => p.number != null)
    ok(`§3 ${tag}: the offer path can see the candidates from wherever the user is`,
      pols.length === 0 || visible.length === pols.length,
      `currentField=${cf ?? 'null'} · ${visible.length}/${pols.length} candidates addressable by number`)
  }

  // ── §3a — THE GATE IS GONE FROM THE ROUTE ──────────────────────────────────
  //
  // ⚠ THIS ONE IS LEGITIMATELY A SOURCE ASSERTION: the property is "the code does not condition
  // this read on the current field", which is a fact about the code. Asserting it on data would
  // need an authenticated turn against a live model.
  console.log('\n§3a — the read is no longer gated on where the user is standing')
  const lexSrc = code('app/api/ideas/[id]/lex/route.ts')
  ok('the policy rows are read unconditionally',
    /const policyRows = await prisma\.policyOption\.findMany/.test(lexSrc))
  ok('and not behind a currentField test',
    !/currentField\?\.key === 'policyOptions'\s*\n?\s*\?/.test(lexSrc)
      && !/current\?\.key === 'policyOptions' \|\|/.test(lexSrc))
  control('the old gated read would fail that',
    () => /const policyRows = await prisma\.policyOption\.findMany/
      .test("const policyRows = current?.key === 'policyOptions' ? await prisma.policyOption.findMany({}) : []"))

  // ══════════ ADDENDUM A4 — A SHUT SECTION MUST BE SHUT, NOT ABSENT ══════════
  //
  // Charlie's A1 re-collapses the sections 25-R opened, so the original defect must not return.
  // These are the properties that make collapsing safe.
  console.log('\n──A4 — the collapse is safe because opening mounts and fetches ──')

  const panel = code('components/lex/FieldsPanel.tsx')
  // 1. SHUT, NOT ABSENT. The heading, its counts and its toggle are OUTSIDE the `!collapsed`
  //    guard, so a collapsed section is a thing on the page that can be opened.
  ok('a collapsed section still renders its heading and toggle',
    panel.indexOf('aria-expanded={!collapsed}') < panel.indexOf('{!isLocked && !collapsed && ('),
    'the toggle is above the guard that hides the fields')
  // 2. OPENING MOUNTS. The fields — and the commentary with them — are inside that guard, so
  //    they are created on open rather than revealed.
  ok('and the contents are inside the guard, so opening MOUNTS them',
    /\{!isLocked && !collapsed && \(/.test(panel))
  // 3. MOUNTING FETCHES. ⚠ The panel's effect must depend only on the id — a "fetch once ever"
  //    guard would make the first open of a session draw nothing, which is the defect returning
  //    by another route.
  const cc = code('components/lex/CausesCommentary.tsx')
  ok('the commentary fetches on mount, with nothing that could skip a first open',
    /useEffect\(\(\) => \{ void load\(\) \}, \[load\]\)/.test(cc)
      && !/hasLoaded|didFetch|fetchedOnce/.test(cc))
  // 4. AND IT IS AT THE TOP OF THE SECTION, not the third card down. Measured in production on
  //    1 Sep: mounted inside `CausesField` it began 1,080px — 1.4 viewport heights — below the
  //    section heading, behind two full field cards. That is A5's remainder.
  ok('the commentary renders above the section\'s fields, not inside the third one',
    panel.indexOf('<CausesCommentaryPanel') < panel.indexOf('page.fields.map(')
      && !/function CausesField[\s\S]{0,400}<CausesCommentaryPanel/.test(panel))
  control('the old placement — inside CausesField — would fail that',
    () => !/function CausesField[\s\S]{0,400}<CausesCommentaryPanel/.test(
      'function CausesField({ ideaId }) { return (<div><CausesCommentaryPanel ideaId={ideaId} /></div>) }'))

  // ── A2 — THE WORKLIST IS THE ENTRY POINT ───────────────────────────────────
  console.log('\n── A2 — the build announces itself through the worklist ──')
  const wl = code('app/api/ideas/[id]/worklist/route.ts')
  ok('the first thing to read after a build is the diagnosis, in Charlie\'s words',
    /Read the diagnosis I’ve prepared/.test(wl)
      && /are you happy with both the description of the/.test(wl))
  ok('and it appears only once a build has produced one',
    /if \(agenda\.buildVersion != null\) \{[\s\S]{0,400}read:diagnosis/.test(wl))
  control('an item present before any build would fail that',
    () => /if \(agenda\.buildVersion != null\)/.test("readItems.set('__diagnosis', {})"))

  // ── A3 — MINIMAL TEXT ON ARRIVAL ───────────────────────────────────────────
  console.log('\n── A3 — the Lex panel on arrival ──')
  const createSrc = code('app/ideas/create/CreateIdeaClient.tsx')
  ok('the arrival line is the one Charlie wrote',
    /Welcome to the Strategic analysis, I’m Lex, ask me anything here\./.test(createSrc))
  ok('and it shows only on arrival, not standing over a transcript',
    /leftTab === 'lex' && messages\.length === 0/.test(createSrc))
  ok('the longer preamble is gone',
    !/Talk to me, Lex, and I’ll help you shape each part/.test(createSrc))
  ok('and the chat box is a large one',
    /rows=\{3\}/.test(code('components/lex/ChatPanel.tsx')))
  control('the old one-row box would fail that',
    () => /rows=\{3\}/.test('rows={1}'))

  // ── §3b — A MERGE IS NOT A CASE THE OFFER HANDLES ──────────────────────────
  console.log('\n§3b — what the offer can and cannot express')
  const fe = code('lib/lex/field-edit.ts')
  ok('the offer covers a single policy row and a single text field',
    /'POLICY_OPTION'/.test(fe) && /'TEXT_FIELD'/.test(fe))
  // ⚠ ASSERTED AS AN ABSENCE, ON PURPOSE. §3b asks for this to be said plainly rather than
  // discovered later: a merge creates a row and supersedes two, which no EditTarget can express.
  ok('and it has no kind that can express a MERGE of two candidates',
    !/'MERGE'|POLICY_MERGE/.test(fe))
  control('a file that did name a merge kind would fail that',
    () => !/'MERGE'/.test("kind: 'MERGE'"))

  // ── §3c — LEX MUST NOT SEND THE USER ON AN ERRAND ──────────────────────────
  console.log('\n§3c — Lex never tells the user to go and do it by hand')
  const lexClientSrc = code('lib/lex/lex-client.ts')
  ok('the prompt forbids sending the user to another stage to do it themselves',
    /never tell the user to go and do|cannot write it yourself|do NOT send them to another stage/i.test(lexClientSrc))
  control('an unchanged prompt must fail that',
    () => /never tell the user to go and do/i.test('Discuss it conversationally.'))

  console.log('\n── negative controls (each must FIRE) ──')
  let dead = 0
  for (const c of controls) {
    if (c.fired) console.log(`  ✓ fired — ${c.label}`)
    else { dead++; console.log(`  ✗ DID NOT FIRE — ${c.label}`) }
  }
  // ⚠⚠ CLAUDE.md §23.2 — REPORT CHECKS *RUN*, NOT ONLY CHECKS PASSED. A check absent from the
  // list is a finding, not a formatting choice.
  if (unverified.length) {
    console.log(`\n── ${unverified.length} NOT CHECKED, and why ──`)
    for (const u of unverified) console.log(`  · ${u}`)
    console.log('  ⚠ These are not passes. Nothing above should be read as covering them.')
  }

  console.log(`\n${pass} passed, ${fail} failed, ${unverified.length} not checked, `
    + `${controls.length} controls (${dead} dead)\n`)
  process.exit(fail || dead ? 1 : 0)
}

main()
  .catch((e) => { console.error('\ncheck:lex-25r threw:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
