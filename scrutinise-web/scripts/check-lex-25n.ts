// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25n — the sprint's own guards.
//
// ⚠ EVERY ASSERTION HAS A NEGATIVE CONTROL THAT MUST FIRE (CLAUDE.md §23). A check that
// cannot fail is not a check, and this repository has a register of the shapes that produce
// one: an assertion over dead code (§23.1), a schema assertion standing in for a value
// assertion (§23.3), a threshold measuring the wrong dimension.
//
// ⚠ AND WHERE A PROPERTY IS ABOUT A VALUE, THE ASSERTION READS THE VALUE. §5's document
// assertions build a real document from a real snapshot and read the text that comes out;
// §1a's resume assertions run the real pass-log functions over a real log. Grep-shaped
// assertions are used only where the property IS about the source — "this string is not in
// this file", "this component is imported by a route".
//
// Usage: npm run check:lex-25n
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  freshPassLog, resumablePassKey, unrunPasses, isResumable, reopenForResume,
  type PassRecord, type PassStatus,
} from '../lib/lex/build-carry'
import {
  HEADING_ORDER, HEADINGS_ABOVE_DIVIDER, HEADING_REDIRECTS, RETIRED_HEADINGS,
  QUESTION_HEADINGS, liveHeading, isHeadingKey, statedGap,
  type HeadingKey,
} from '../lib/lex/question-headings'
import { headingsWithProducers, headingForPassKey } from '../lib/lex/heading-map'
import { PANEL_ROLES, PANEL_KEYS, HIDE_PANEL_LABEL, gridTemplate, DEFAULT_LAYOUT } from '../lib/lex/panel-layout'
import { WORKLIST_PARTS } from '../app/api/ideas/[id]/worklist/route'
import { MEETING_PACK_SECTIONS, ALL_MEETING_PACK_SECTIONS } from '../lib/documents/build-meeting-pack'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const controls: Array<{ label: string; fired: boolean }> = []
/** Assert that a deliberately broken version of the property FAILS. */
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

/**
 * ⚠⚠ THE SAME FILE WITH ITS COMMENTS REMOVED — AND FOUR ASSERTIONS IN THIS FILE NEEDED IT.
 *
 * Every "this string must NOT appear" assertion here was failing against code that is correct,
 * because the ⚠ note EXPLAINING the deletion quotes the deleted string. `!/own words/` cannot
 * pass on a file whose comment says *"was `In ${owner}'s own words`"*.
 *
 * That is not a formatting annoyance; it is a check measuring the wrong thing — the property is
 * about what the document EMITS, and a comment emits nothing. The house style here is heavily
 * commented on purpose, so an absence assertion has to read the code.
 */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** A pass log stopped at a ceiling: some DONE, the rest NOT_REACHED. Exactly build v7's shape. */
function stoppedLog(): PassRecord[] {
  const log = freshPassLog()
  return log.map((p, i) => ({
    ...p,
    status: (i < log.length - 2 ? 'DONE' : 'NOT_REACHED') as PassStatus,
  }))
}

function main() {
  console.log('── check:lex-25n ──\n')

  // ══ §1a — A PARTIAL BUILD CAN BE RESUMED ═══════════════════════════════════
  console.log('§1a — the stopped build')

  const stopped = stoppedLog()
  // ⚠⚠ THE DEFECT, STATED AS A PROPERTY. `stopBuild` rewrites remaining passes to
  // NOT_REACHED, and `nextPassKey` only ever returns PENDING or RUNNING — which is why
  // `resumable` was false on build v7 of idea 452c5ade (8 of 10 passes done, 30 Aug 2026).
  ok('§1a — a build stopped at a ceiling IS resumable', isResumable(stopped))
  ok('§1a — and it resumes from the first pass that did not run',
    resumablePassKey(stopped) === stopped[stopped.length - 2].key,
    String(resumablePassKey(stopped)))
  ok('§1a — the unrun passes are named, not counted',
    unrunPasses(stopped).length === 2
    && unrunPasses(stopped).every((p) => typeof p.label === 'string' && p.label.length > 0))
  control('a log with nothing left to run claims to be resumable',
    () => isResumable(freshPassLog().map((p) => ({ ...p, status: 'DONE' as PassStatus }))))
  control('a log that has done NOTHING claims to be resumable — that is a start, not a resume',
    () => isResumable(freshPassLog()))

  // ⚠ §23.3 — THE ASSERTION REACHES THE OUTPUT. Not "the function exists": the reopened log
  // must actually contain PENDING passes the engine can pick up.
  const reopened = reopenForResume(stopped)
  ok('§1a — reopening puts the unrun passes back to PENDING, and touches nothing else',
    reopened.filter((p) => p.status === 'PENDING').length === 2
    && reopened.filter((p) => p.status === 'DONE').length === stopped.filter((p) => p.status === 'DONE').length)
  control('reopening a log with a hard FAILED pass steps over it',
    () => {
      const broken = stopped.map((p, i) => (i === 1 ? { ...p, status: 'FAILED' as PassStatus } : p))
      // ORIENT..FAILED stops the build: nothing after it may be resumed.
      return resumablePassKey(broken) !== null
    })

  // ⚠ THE CLOCK. Without `resumedAt` the resume is a button that cannot work — a build over
  // its 900s ceiling stops again before its first pass, for ever.
  const buildSrc = read('lib/lex/build.ts')
  ok('§1a — the time ceiling is measured from the RESUME, not the original start',
    /row\?\.resumedAt \?\? row\?\.startedAt/.test(buildSrc))
  ok('§1a — and the SPEND ceiling is not reset with it',
    /priceBuild\(usages\)/.test(buildSrc) && /spend ceiling is NOT reset|SPEND CEILING IS NOT RESET/i.test(buildSrc))
  ok('§1a — a resume is bounded, so a build that always stops cannot loop',
    /MAX_RESUMES/.test(buildSrc) && /resumeCount >= MAX_RESUMES/.test(buildSrc))
  ok('§1a — and it writes no new IdeaBuild row, so it spends no allowance',
    /resumeBuild/.test(buildSrc)
    && !/resumeBuild[\s\S]{0,2000}?ideaBuild\.create/.test(buildSrc))

  const progress = read('components/lex/BuildProgress.tsx')
  ok('§1a — the screen says a build did not finish, names what did not run, and offers to carry on',
    /This build did not finish/.test(progress)
    && /incomplete\.unrun\.join/.test(progress)
    && /Carry on from/.test(progress))
  ok('§1a — and it says the summary is MISSING rather than leaving a blank where it goes',
    /incomplete\.noSummary/.test(progress) && /never wrote my own account/.test(progress))
  control('the resume control rendered on a running build',
    () => {
      const client = read('app/ideas/build/BuildIdeaClient.tsx')
      return !/onResume=\{!running \? resumeBuildNow : undefined\}/.test(client)
    })

  // ══ §1b — PANELS RESIZE ONLY ON DRAG ═══════════════════════════════════════
  console.log('\n§1b — the panels')

  // ⚠⚠ THE ONE-CHARACTER FIX, ASSERTED AS A VALUE. A bare `Nfr` is `minmax(auto, Nfr)`, whose
  // automatic minimum lets a long citation or URL widen the track past the fraction the user
  // set — which is exactly "clicking an item in the right-hand panel re-proportions all three
  // columns", with nothing in our code having moved.
  const template = gridTemplate(DEFAULT_LAYOUT)
  ok('§1b — every column track has a ZERO minimum, so content cannot widen it',
    template.split(' ').filter((t) => t.includes('fr')).length === 0
    || /minmax\(0,/.test(template),
    template)
  ok('§1b — and the create page builds its template the same way',
    /minmax\(0, \$\{\(\(panels\.layout\.width\[k\] \/ totalW\) \* 100\)/.test(read('app/ideas/create/CreateIdeaClient.tsx')))
  control('a template built with a bare fr unit',
    () => /minmax\(0,/.test(gridTemplate(DEFAULT_LAYOUT).replace(/minmax\(0, ([^)]+)\)/g, '$1')))

  const divider = read('components/lex/PanelDivider.tsx')
  ok('§1b — the divider carries a visible grip, not just a coloured strip',
    /rounded-full bg-zinc-300/.test(divider) && /cursor-col-resize/.test(divider))
  ok('§1b — and the left panel has its own divider between the worklist and the chat',
    /export function RowDivider/.test(divider)
    && /<RowDivider/.test(read('app/ideas/create/CreateIdeaClient.tsx')))
  ok('§1b — both are keyboard-operable, because a drag handle has no other route',
    /ArrowLeft/.test(divider) && /ArrowUp/.test(divider))

  // ══ §1c — EVERY HEADING TOGGLES BOTH WAYS ══════════════════════════════════
  console.log('\n§1c — the headings')

  const fields = read('components/lex/FieldsPanel.tsx')
  // ⚠ THE OLD CONDITION IS THE BUG: `complete || visited` meant an ACTIVE section — which is
  // what "Work on this" makes it — had no toggle at all.
  ok('§1c — a section is collapsible whenever it is not locked',
    /const collapsible = !isLocked/.test(fields))
  ok('§1c — and the default still depends on the status, with a set for each direction',
    /manualExpanded/.test(fields) && /manualCollapsed/.test(fields)
    && /collapsedByDefault/.test(fields))
  control('collapsible gated on the old completed-or-visited condition',
    () => /const collapsible = !isLocked/.test(
      fields.replace('const collapsible = !isLocked',
        "const collapsible = page.status === 'complete'")))

  const agenda = read('components/lex/AgendaPanel.tsx')
  ok('§1c — Decisions and "Where the research changed my mind" toggle too',
    /aria-expanded=\{open\}/.test(agenda) && /\{open && <div className="mt-2 space-y-3">/.test(agenda))
  ok('§1c — and a worklist jump opens the section it lands on',
    /hashchange/.test(agenda))

  // ══ §2 — NAMING ════════════════════════════════════════════════════════════
  console.log('\n§2 — naming and layout')

  ok('§2 — the three panels are named in Charlie’s words',
    PANEL_ROLES.left.name === 'WORKING AREA'
    && PANEL_ROLES.middle.name === 'DRAFT STRATEGY'
    && PANEL_ROLES.right.name === 'THE RESEARCH')
  ok('§2 — two subtitles are deleted and THE RESEARCH keeps its sentence, verbatim',
    PANEL_ROLES.left.role === '' && PANEL_ROLES.middle.role === ''
    && PANEL_ROLES.right.role.startsWith('This panel is where you’ll find the background'))
  ok('§2 — "Collapse" is gone; every column says "Hide this Panel", from one constant',
    HIDE_PANEL_LABEL === 'Hide this Panel'
    && !/collapse ‹|collapse ›/.test(read('app/ideas/create/CreateIdeaClient.tsx'))
    && (read('app/ideas/create/CreateIdeaClient.tsx').match(/HIDE_PANEL_LABEL/g)?.length ?? 0) >= 6)
  control('a column with a hand-written collapse label',
    () => !/collapse ›/.test(`${read('app/ideas/create/CreateIdeaClient.tsx')}\ncollapse ›`))

  ok('§2 — the "Background" and "Resources" headings are gone from inside the panel',
    !/>Background<\/div>/.test(read('components/lex/BackgroundPanel.tsx'))
    && !/>\s*Resources\s*<\/div>/.test(read('components/lex/QuestionPanel.tsx')))
  ok('§2 — and the explanatory line is Charlie’s, verbatim',
    /Everything Lex found or worked out:/.test(read('components/lex/QuestionPanel.tsx')))
  ok('§2 — the count says what it counts',
    /\{done\} of \{total\} approved/.test(fields))

  const modal = read('components/lex/HowItWorksModal.tsx')
  ok('§2 — "You can:" is deleted from the tour intro',
    /three panels which all work together\.'/.test(modal) && !/all work together\. You can:/.test(modal))
  ok('§2 — the purpose sentence is in the modal, verbatim, under the welcome',
    /The purpose of this tool is not to solve everything for you, but to give you the insight to lead an informed debate\. Through debate and scrutiny we build better legislation\./
      .test(modal.replace(/'\s*\n\s*\+ '/g, ''))
    && modal.indexOf('PURPOSE_STATEMENT}') > modal.indexOf('Welcome to Scrutinise'))
  ok('§2 — and the tour teaches the names that are on the screen',
    /WORKING AREA/.test(modal) && /DRAFT STRATEGY/.test(modal) && /THE RESEARCH/.test(modal))

  ok('§2 — the forced-staging card is gone from the research panel',
    !/This part’s complete/.test(read('components/lex/BackgroundPanel.tsx')))

  // ══ §3 — THE THREE COLUMNS ═════════════════════════════════════════════════
  console.log('\n§3 — one logic for the three columns')

  const qPanel = read('components/lex/QuestionPanel.tsx')
  ok('§3a — "Make priority" is "Add to report", with a balancing "Remove from report"',
    /Add to report/.test(qPanel) && /Remove from report/.test(qPanel)
    && !/Make priority/.test(qPanel))
  ok('§3a — and what is added appears in the middle column, under its own heading',
    /What you have put in the report/.test(read('components/lex/ReportAdditions.tsx'))
    && /<ReportAdditions/.test(read('app/ideas/create/CreateIdeaClient.tsx')))
  ok('§3a — the heading arrives with its first item, from the server’s order',
    /data\.headings\s*\n?\s*\.map\(\(h\) => \(\{ key: h\.key, heading: h\.heading, entries: h\.entries\.filter\(\(e\) => e\.priority/
      .test(read('components/lex/ReportAdditions.tsx')))

  ok('§3b — Decisions and the change of mind moved to the right-hand panel',
    /view="judgements"/.test(qPanel)
    && /view="work"/.test(read('app/ideas/create/CreateIdeaClient.tsx'))
    && /export type AgendaView/.test(agenda))
  control('the middle column still rendering the decisions',
    () => /view="judgements"/.test(read('app/ideas/create/CreateIdeaClient.tsx')))

  const create = read('app/ideas/create/CreateIdeaClient.tsx')
  ok('§3c — the left panel has Lex and Notes tabs, defaulting to Lex',
    /useState<'lex' \| 'notes'>\('lex'\)/.test(create) && /<NotesPanel/.test(create))
  // ⚠ 25-R ADDENDUM A3 MOVED THIS SENTENCE, AND THE FACT SURVIVED THE MOVE. The arrival
  // preamble is now one line in Charlie's words; "only conversations started on this page" is
  // no longer in it. The thing §3c was protecting — that the user is TOLD which conversations
  // this pane holds — is now the `this page only` marker in the tab strip, which is where
  // somebody asking that question actually looks. Asserted there.
  ok('§3c — and it says the chat holds only this page’s conversations',
    /this page only/.test(code('app/ideas/create/CreateIdeaClient.tsx')))
  const notes = read('components/lex/NotesPanel.tsx')
  ok('§3c — notes are titled, grouped, sortable and hideable',
    /placeholder="Untitled note"/.test(notes)
    && /Under a heading/.test(notes)
    && /draggable/.test(notes)
    && /hidden: !n\.hidden/.test(notes))
  ok('§3c — and the user’s original idea is seeded under "My original idea"',
    /My original idea/.test(read('app/api/ideas/[id]/notes/route.ts')))
  // ⚠⚠ PRIVACY IS THE KEY, NOT A FLAG. Every read and every write in the route is scoped to
  // (ideaId, userId); a `visibility` column would be the thing somebody later sets wrong.
  const notesRoute = read('app/api/ideas/[id]/notes/route.ts')
  ok('§3c — every note query is scoped to (ideaId, userId), and there is no visibility flag',
    (notesRoute.match(/userId: authz\.user\.id/g)?.length ?? 0) >= 5
    // ⚠ AGAINST THE CODE, not the prose. The header's own sentence is "private to the user …
    // never shared", which the naive regex reads as a sharing flag.
    && !/visibility|isPrivate|isShared|sharedWith/.test(code('app/api/ideas/[id]/notes/route.ts')))
  control('a note query that is not scoped to the user',
    () => /userId: authz\.user\.id/.test(notesRoute.replace(/userId: authz\.user\.id/g, 'userId: undefined')))

  ok('§3d — the worklist panel text is Charlie’s, verbatim',
    /This panel lists the decisions and actions you need to take to build the draft strategy/
      .test(read('components/lex/WorkList.tsx')))
  ok('§3d — and so is the draft’s own introduction',
    /Here is the draft strategy I have written for you to review and develop into your formal/
      .test(fields))

  // ⚠ §3e's ORDER IS DATA, so it is asserted without rendering anything.
  ok('§3e — the worklist has four parts, in the brief’s order',
    WORKLIST_PARTS.map((p) => p.key).join(',') === 'read,decide,scrutiny,promote',
    WORKLIST_PARTS.map((p) => p.title).join(' · '))
  ok('§3e — and the two outward parts carry Charlie’s wording, verbatim',
    (WORKLIST_PARTS.find((p) => p.key === 'scrutiny')?.blurb ?? '')
      .includes('riends and experts willing to read this and ask hard questions')
    && (WORKLIST_PARTS.find((p) => p.key === 'promote')?.blurb ?? '')
      .includes('Build support for your idea from the public and parliamentarians'))
  const worklist = read('components/lex/WorkList.tsx')
  ok('§3e — every item is a real checkbox, which is what makes it work on a phone',
    /type="checkbox"/.test(worklist) && /void tick\(item\.key, e\.target\.checked\)/.test(worklist))
  ok('§3e — an item that lives elsewhere is a route link, never an in-page fragment',
    /item\.href \?/.test(worklist) && !/href=\{`#\$\{item\./.test(worklist))
  control('a worklist item rendered as a fragment link, which does nothing on mobile',
    () => !/href=\{`#\$\{item\.anchor\}`\}/.test(`${worklist}\nhref={\`#\${item.anchor}\`}`))

  // ══ §4 — THE CONTENTS LIST ═════════════════════════════════════════════════
  console.log('\n§4 — the right-hand contents')

  ok('§4 — HOW HARD and COST_DURATION sit above the divider, in that order',
    HEADINGS_ABOVE_DIVIDER.join(',') === 'HOW_HARD,COST_DURATION'
    && HEADING_ORDER[0] === 'HOW_HARD' && HEADING_ORDER[1] === 'COST_DURATION')
  ok('§4 — Cost and duration EXISTS, and its caveat is part of the heading',
    QUESTION_HEADINGS.some((h) => h.key === 'COST_DURATION')
    && /purely financial view/.test(statedGap('COST_DURATION', 'no-producer')))
  ok('§4 — and it is honest about having no producer rather than "we found nothing"',
    !headingsWithProducers().has('COST_DURATION')
    && /No pass costs this yet/.test(statedGap('COST_DURATION', 'no-producer')))

  // ⚠⚠ THE RETIREMENT, AND THE PROPERTY THAT MAKES IT SAFE. Deleting the heading is easy;
  // not losing the rows filed under it is the whole job.
  ok('§4 — "The strongest case against" is gone from the panel vocabulary',
    !QUESTION_HEADINGS.some((h) => h.heading === 'The strongest case against')
    && !HEADING_ORDER.includes('AGAINST' as HeadingKey))
  ok('§4 — but a stored AGAINST row still resolves, to its stated destination',
    isHeadingKey('AGAINST') && liveHeading('AGAINST') === 'ARGUED')
  ok('§4 — every retired heading has a destination; none is a silent hole',
    RETIRED_HEADINGS.length > 0
    && RETIRED_HEADINGS.every((k) => {
      const dest = HEADING_REDIRECTS[k]
      return !!dest && HEADING_ORDER.includes(dest)
    }))
  ok('§4 — and no producer declares a heading the panel no longer draws',
    [...headingsWithProducers()].every((h) => HEADING_ORDER.includes(h)),
    [...headingsWithProducers()].filter((h) => !HEADING_ORDER.includes(h)).join(',') || 'none')
  ok('§4 — the adversarial pass writes to the live heading, not through the redirect',
    headingForPassKey('ADVERSARIAL') === 'ARGUED')
  control('a retired key that resolves to nothing',
    () => liveHeading('AGAINST') !== null && !HEADING_ORDER.includes(liveHeading('AGAINST')!))
  control('a producer left pointing at the retired heading',
    () => {
      const producers = new Set([...headingsWithProducers(), 'AGAINST' as HeadingKey])
      return [...producers].every((h) => HEADING_ORDER.includes(h))
    })

  // ⚠ EVERY READER OF A STORED KEY GOES THROUGH THE REDIRECT. Two of the four did not, and
  // `check:lex-25d` caught one of them — the evidence pack was dropping the rows into
  // "not filed under a question" and telling the reader their question was never recorded.
  for (const [file, label] of [
    ['lib/documents/build-evidence-pack.ts', 'the evidence pack'],
    ['lib/documents/build-proposal.ts', 'the long report'],
    ['app/proposals/[token]/page.tsx', 'the public proposal page'],
    ['lib/documents/build-meeting-pack.ts', 'the meeting pack'],
  ] as const) {
    ok(`§4 — ${label} resolves a stored heading through liveHeading`, /liveHeading\(/.test(read(file)))
  }

  ok('§4 — clicking a contents item shows that item only',
    // Nothing renders beside the library any more: the panel hands its two Inputs items and
    // its notices IN, so one component decides what is on screen.
    (read('components/lex/BackgroundPanel.tsx').match(/<QuestionPanel/g)?.length ?? 0) === 1
    && /inputs=\{\{ retrieved: retrievedNode, background: backgroundNode \}\}/.test(read('components/lex/BackgroundPanel.tsx'))
    && /\{!openKey && \(/.test(qPanel))
  ok('§4 — Inputs is a group holding the two items the brief names',
    /__inputs_retrieved/.test(qPanel) && /__inputs_background/.test(qPanel)
    && /Everything we retrieved, by document type/.test(qPanel)
    && /The basic idea — initial background/.test(qPanel))
  ok('§4 — Decisions is first on the list, above Outputs',
    qPanel.indexOf("setOpenKey('__decisions')") < qPanel.indexOf("setOpenKey('__outputs')"))
  ok('§4 — items can be moved between sections, and a retired heading is refused',
    /Move…/.test(qPanel)
    && /HEADING_ORDER\.includes\(headingKey\)/.test(read('app/api/ideas/[id]/panel/route.ts')))
  control('the move endpoint accepting a retired heading',
    () => !/HEADING_ORDER\.includes\(headingKey\)/.test(read('app/api/ideas/[id]/panel/route.ts')))

  // ══ §5 — THE DOCUMENTS ═════════════════════════════════════════════════════
  console.log('\n§5 — the two documents, and a third')

  const proposalSrc = read('lib/documents/build-proposal.ts')
  ok('§5a — no internal working count is written into either document',
    !/settled kernel fields carry no source/.test(code('lib/documents/build-proposal.ts')))
  ok('§5a — and the draft is declared once, at the top, only when it is true',
    /This is a DRAFT report for a proposal in process/.test(proposalSrc)
    && /if \(unevidenced === 0 && open === 0\) return \[\]/.test(proposalSrc))
  control('a draft banner that prints on a finished proposal too',
    () => /if \(unevidenced === 0 && open === 0\) return \[\]/.test(
      proposalSrc.replace('if (unevidenced === 0 && open === 0) return []', '')))

  ok('§5b — the summary carries the four headings the brief names',
    ["text('The problem')", "text('Cause')", "text('Guiding Policy')", "text('Proposed Actions')"]
      .every((h) => proposalSrc.includes(h)))
  ok('§5b — a field with several candidates takes the top one and LABELS it',
    /Current leading cause, of \$\{causes\.length\} under consideration/.test(proposalSrc)
    && /Current leading approach, of \$\{liveOptions\.length\} under consideration/.test(proposalSrc))
  ok('§5c — "Guiding Policy", not "The approach"',
    !/text\('The approach'\)/.test(code('lib/documents/build-proposal.ts')))
  ok('§5c — the proposer’s own words are attributed without being personally framed',
    !/own words/.test(code('lib/documents/build-proposal.ts'))
    && /First-hand account/.test(proposalSrc))
  ok('§5c — the long report lists the approaches under consideration',
    /None has been committed to yet/.test(proposalSrc))
  ok('§5c — the six sections exist, in the brief’s order and wording',
    /REPORT_SECTIONS/.test(proposalSrc)
    && ['DRAFT STRATEGY', 'HOW HARD WILL THIS BE TO ACHIEVE', 'WHAT THE LAW SAYS NOW',
        'QUESTIONS THE RESEARCH COULD', 'CHALLENGES', 'SOURCES']
      .every((t) => proposalSrc.includes(t)))
  ok('§5c — and both renderers repeat the section name on every page of it',
    /stampSection/.test(read('lib/documents/render-pdf.ts'))
    && /new Header\(/.test(read('lib/documents/render-docx.ts')))
  control('a PDF that stamps the section only where it starts',
    () => {
      const pdf = read('lib/documents/render-pdf.ts')
      return /const newPage = \(\) => \{[^}]*stampSection\(\)/.test(
        pdf.replace('cur.y = A4[1] - MARGIN; stampSection()', 'cur.y = A4[1] - MARGIN'))
    })

  ok('§5d — Outputs paints on a read that skips the snapshot',
    /quick=1/.test(read('components/lex/OutputsPanel.tsx'))
    && /opts\.quick/.test(read('lib/documents/proposal-export.ts')))
  ok('§5d — and an unchecked file is a third state, never rendered as current',
    /d\.stale === null/.test(read('components/lex/OutputsPanel.tsx'))
    && /Checking whether it still matches/.test(read('components/lex/OutputsPanel.tsx')))
  ok('§5d — generation says "Building reports"',
    /Building reports/.test(read('components/lex/OutputsPanel.tsx')))
  control('a quick read that reports an unchecked file as current',
    () => /d\.stale === null/.test(read('components/lex/OutputsPanel.tsx').replace(/d\.stale === null/g, 'false')))

  ok('§5e — the meeting pack exists, with its five sections in the brief’s order',
    MEETING_PACK_SECTIONS.map((s) => s.key).join(',')
      === 'decisions,questions,challenges,background,evidence')
  ok('§5e — it leads on what is open, not on the settled kernel',
    MEETING_PACK_SECTIONS[0].key === 'decisions'
    && MEETING_PACK_SECTIONS.findIndex((s) => s.key === 'background') > 2)
  ok('§5e — the user chooses what to include, and everything is on by default',
    ALL_MEETING_PACK_SECTIONS.length === MEETING_PACK_SECTIONS.length
    && /opts\.sections\?\.length \? opts\.sections : ALL_MEETING_PACK_SECTIONS/
      .test(read('lib/documents/build-meeting-pack.ts')))
  ok('§5e — what was left out is named on the pack itself',
    /Left out of this printing/.test(read('lib/documents/build-meeting-pack.ts')))
  // ⚠⚠ THE CACHE TRAP. The store is idempotent by hash; without the sections in the hash, a
  // user who unticked two sections and pressed Generate would get the CACHED file back —
  // reported as freshly generated, with the sections they removed still in it.
  ok('§5e — the chosen sections are part of the fingerprint, so a re-choice re-renders',
    /\$\{snapshotHash\(snapshot\)\}:\$\{\[\.\.\.opts\.sections\]\.sort\(\)\.join\(','\)\}/
      .test(read('lib/documents/proposal-export.ts')))
  control('a fingerprint that ignores the chosen sections',
    () => /:\$\{\[\.\.\.opts\.sections\]/.test(
      read('lib/documents/proposal-export.ts').replace(/`\$\{snapshotHash\(snapshot\)\}:[^`]*`/, 'snapshotHash(snapshot)')))

  // ══ §23.1 — EVERY COMPONENT THIS SPRINT ADDS IS REACHED FROM A ROUTE ═══════
  console.log('\n§23.1 — reachability')

  const importers = [
    read('app/ideas/create/CreateIdeaClient.tsx'),
    read('app/ideas/build/BuildIdeaClient.tsx'),
    read('components/lex/QuestionPanel.tsx'),
    read('components/lex/BackgroundPanel.tsx'),
  ].join('\n')
  for (const name of ['RerunBanner', 'NotesPanel', 'ReportAdditions']) {
    ok(`§23.1 — ${name} is imported by something a route renders`,
      new RegExp(`import ${name} from`).test(importers) && new RegExp(`<${name}`).test(importers))
  }
  control('a component nothing imports counted as reachable',
    () => /import NoSuchPanel from/.test(importers))

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
