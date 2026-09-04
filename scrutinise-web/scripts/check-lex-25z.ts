// ─────────────────────────────────────────────────────────────────────────────────────────
// check:lex-25z — the three panels, restructured.
//
// ⚠⚠ THIS SPRINT IS ALMOST ENTIRELY STRINGS AND ARRANGEMENT, so 25-T §3's read-back list IS
// the check: every string §3 replaces is asserted present, and every string it replaces is
// asserted GONE. A wording sprint whose check only looks for the new text passes happily with
// both versions on the page.
//
// ⚠ §1's half is a value assertion against the database and the assembler the browser calls,
// not a source read (CLAUDE.md §25). §26's cold read: the subject is the pilot proposal, an
// idea this check did not create and does not touch.
//
// ⚠ Comments are stripped before every absence assertion — this file's own ⚠ notes quote the
// strings that were removed.
//
// Usage: npm run check:lex-25z
// ─────────────────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { buildQuestionPanel } from '../lib/lex/question-panel'
import { collapsedByDefault } from '../lib/lex/panel-collapse'
import { PANEL_ROLES } from '../lib/lex/panel-layout'
import { EVIDENCE_DISCLOSURE } from '../lib/lex/beta-disclosure'

const PILOT = '452c5ade-3153-400a-bf48-3b71aaa52773'
let passed = 0, failed = 0, dead = 0, controls = 0
const notChecked: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
function control(label: string, holdsOnBroken: () => boolean) {
  controls++
  if (holdsOnBroken()) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label}`) }
  else console.log(`  ✓ fired — ${label}`)
}
function skip(label: string, why: string) { notChecked.push(`${label} — ${why}`); console.log(`  · NOT CHECKED ${label} — ${why}`) }

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'))

async function main() {
  console.log('\n── check:lex-25z — the three panels, restructured ──\n')

  // ══ §1 — A RESEARCH ENTRY CARRIES ITS PASSAGE ════════════════════════════════════════
  console.log('§1 — the research items open')
  const panel = await buildQuestionPanel(PILOT)
  const all = [...panel.headings.flatMap((h) => h.entries), ...panel.unfiled]
  const named = ['ARGUED', 'COURTS', 'LAW_NOW']
  ok('the panel returns entries for the pilot idea', all.length > 0, `${all.length} entries`)

  for (const key of named) {
    const h = panel.headings.find((x) => x.key === key)
    if (!h || !h.entries.length) { skip(`§1 ${key}`, 'no entries under this heading'); continue }
    const withBody = h.entries.filter((e) => e.body?.trim())
    ok(`§1 — ${key} entries carry their passage to the client`,
      withBody.length === h.entries.length,
      `${withBody.length} of ${h.entries.length}`)
  }

  // ⚠⚠ THE DEFECT, NAMED: entries with NO url were plain divs and inert on every device.
  // The passage is what makes them openable, so it must be present on exactly those.
  const noUrl = all.filter((e) => !e.url?.trim())
  ok('§1 — the entries that had no link (and so did nothing when tapped) now carry a passage',
    noUrl.length > 0 && noUrl.every((e) => e.body?.trim() || e.yourSource),
    `${noUrl.length} entries had no link; ${noUrl.filter((e) => e.body?.trim()).length} carry a passage`)

  control('the old assembler dropped the passage at the seam', () => {
    // The property: a card can render the passage. On the old PanelEntry there was no `body`
    // key at all, so this is what the client had to work with.
    const oldShape = { title: 'x', citation: null, url: null, why: null } as Record<string, unknown>
    return 'body' in oldShape
  })

  const qp = code('components/lex/QuestionPanel.tsx')
  ok('§1 — the title is a button that opens the passage, not a link-or-nothing',
    /onClick=\{\(\) => \{[\s\S]{0,400}?setOpen\(\(v\) => !v\)/.test(qp))
  ok('§1 — the opened block offers a route to the original',
    /Open the original/.test(qp))
  ok('§1 — and says so when there is no link, rather than showing a dead card',
    /No link was recorded for this source/.test(qp))

  // ══ §2 — THE MIDDLE PANEL ════════════════════════════════════════════════════════════
  console.log('\n§2 — the middle panel')
  // ⚠ THE RULE ITSELF, IMPORTED. A freshly opened page collapses every section including the
  // active one; afterwards the status rule is exactly as it was.
  ok('§2a — freshly opened, every status collapses',
    (['active', 'complete', 'visited', 'locked'] as const)
      .every((st) => collapsedByDefault(st, { freshlyOpened: true })))
  ok('§2a — and once touched, the original rule is unchanged',
    collapsedByDefault('complete') && collapsedByDefault('visited')
    && !collapsedByDefault('active') && !collapsedByDefault('locked'))
  control('without the new fact, the active section would still open on arrival', () =>
    collapsedByDefault('active'))

  const fp = code('components/lex/FieldsPanel.tsx')
  ok('§2a — neither scroll fires before the user has touched anything',
    (fp.match(/touchedRef\.current/g) ?? []).length >= 2)
  ok('§2b — the pill is on every reachable section, not only the ones you are not in',
    /\{page\.reachable && \(/.test(fp) && !/canReEnter/.test(fp))
  ok('§2b — the active section is marked by a WORD, not only by an accent colour',
    /Working on this/.test(fp))

  const cic = code('app/ideas/create/CreateIdeaClient.tsx')
  ok('§2c — the report block has left the middle panel',
    !/<ReportAdditions/.test(cic))
  ok('§2c — and the duplicate Deepening link has gone',
    !/stage=deepening/.test(cic))
  ok('§2c — "For Report Inclusion" is in Outputs',
    /title="For Report Inclusion"/.test(code('components/lex/OutputsPanel.tsx')))
  ok('§2c — the challenges render under "How hard will this be to achieve?"',
    /openHeading\.key === 'HOW_HARD'[\s\S]{0,200}?view="challenges"/.test(qp))
  const ap = code('components/lex/AgendaPanel.tsx')
  ok('§2c — and no longer in the middle panel\'s work view',
    /challengesOnly && a\.challenges\.length > 0/.test(ap))
  control('the work view used to render the challenges', () =>
    /\{!judgements && a\.challenges\.length > 0/.test(ap))

  // ══ §3 — THE READ-BACK LIST ══════════════════════════════════════════════════════════
  console.log('\n§3 — every string, new present and old gone')
  const STRINGS: Array<{ file: string; gone: string; present: string }> = [
    { file: 'components/lex/FieldsPanel.tsx',
      gone: 'Here is the draft strategy I have written',
      present: 'Here is your draft strategy to review and develop into your formal proposal. Edit' },
    { file: 'components/lex/WorkList.tsx',
      gone: 'This panel lists the decisions',
      present: 'Here are your decisions and actions:' },
    { file: 'components/lex/AgendaPanel.tsx',
      gone: 'This panel lists the decisions',
      present: 'Here are your decisions and actions:' },
    { file: 'lib/lex/panel-layout.ts',
      gone: 'This panel is where you',
      present: 'The issues, the numbers and the debates behind your strategy' },
    { file: 'components/lex/AgendaPanel.tsx',
      gone: 'Where the research changed my mind',
      present: 'Notable Research' },
    { file: 'components/lex/QuestionPanel.tsx',
      gone: 'Where the research changed my mind',
      present: 'Notable Research' },
    { file: 'components/lex/AgendaPanel.tsx',
      gone: 'Why I changed my mind',
      present: 'Why notable' },
    { file: 'components/lex/ChatPanel.tsx',
      gone: 'Type your reply',
      present: 'Chat to Lex' },
  ]
  for (const { file, gone, present } of STRINGS) {
    const src = code(file)
    ok(`§3 — "${present.slice(0, 42)}…" is on ${file.split('/').pop()}`, src.includes(present))
    ok(`§3 — and "${gone.slice(0, 42)}…" is gone from it`, !src.includes(gone))
  }
  ok('§3 — THE RESEARCH\'s role reads back off the shared constant',
    PANEL_ROLES.right.role === 'The issues, the numbers and the debates behind your strategy',
    PANEL_ROLES.right.role)

  // ══ §4 — THE CHAT OPENS CLEAN ════════════════════════════════════════════════════════
  console.log('\n§4 — the chat')
  const cp = code('components/lex/ChatPanel.tsx')
  ok('§4a — the history present at mount is hidden, all but the arrival line',
    /arrivedWith\.current \?\? 0\) - 1/.test(cp))
  ok('§4b — and an upward control labelled "prior chat" brings it back',
    /prior chat/.test(cp) && /↑/.test(cp))
  ok('§4c — nothing is filtered out of the data, only out of the view',
    /const visibleMessages = hiddenCount > 0 \? messages\.slice\(hiddenCount\) : messages/.test(cp))

  // ══ §5 — HEADINGS AND THE BETA NOTICE ════════════════════════════════════════════════
  console.log('\n§5 — headings and the Beta notice')
  const headings = cic.match(/text-base font-bold uppercase tracking-wide text-zinc-900 flex-1/g) ?? []
  ok('§5a — all three panel headings are primary-sized', headings.length === 3, `${headings.length} of 3`)
  ok('§5b — and they carry no colour of their own beyond near-black',
    !/text-(blue|amber|violet|emerald|green|red)-\d00 flex-1/.test(cic))
  ok('§5c — the disclosure has left THE RESEARCH\'s header',
    !/PANEL_ROLES\.right\.disclosure/.test(cic))
  ok('§5c — and is shown once, on opening a search-derived item',
    /showBetaNotice/.test(qp) && /onOpenedSearchItem/.test(qp))
  ok('§5c — never on the user\'s own document',
    /!e\.yourSource/.test(qp))
  const notice = code('components/lex/BetaSearchNotice.tsx')
  ok('§5d — the text is imported, not retyped',
    /EVIDENCE_DISCLOSURE/.test(notice) && !notice.includes('assembled by automated search'))
  ok('§5d — and it is still the agreed wording',
    EVIDENCE_DISCLOSURE.includes('Refining and focusing the evidence base is the proposer’s first task.'))

  // §5e — where the marker still stands.
  const marked = [
    ['the public header', 'components/PublicNav.tsx'],
    ['the proposal', 'lib/documents/build-proposal.ts'],
    ['the evidence pack', 'lib/documents/build-evidence-pack.ts'],
    ['the meeting pack', 'lib/documents/build-meeting-pack.ts'],
    ['the background briefing', 'lib/documents/build-initial-background.ts'],
  ] as const
  for (const [what, file] of marked) {
    ok(`§5e — the Beta marker still appears on ${what}`, /BETA_MARKER/.test(code(file)))
  }

  console.log(`\n── ${passed} passed, ${failed} failed, ${notChecked.length} NOT CHECKED, ` +
    `${controls} controls (${dead} dead) ──`)
  for (const n of notChecked) console.log(`  · NOT CHECKED: ${n}`)
  console.log('\n⚠ NOT TESTABLE FROM HERE — Charlie\'s iPad only:')
  for (const s of [
    'that a tap (not a click) opens an entry, and that the tap target is big enough for a thumb',
    'that the panel headings read as primary at an iPad width, not just in the markup',
    'that the modal is dismissable on touch and does not trap the page behind it',
    'that a freshly opened idea is scrolled to the top on a touch viewport',
  ]) console.log(`  · ${s}`)
  if (failed || dead) process.exitCode = 1
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
