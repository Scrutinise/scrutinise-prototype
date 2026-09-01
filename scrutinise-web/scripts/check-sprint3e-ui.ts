// ─────────────────────────────────────────────────────────────────────────────
// §19-E Tasks 5, 6, 7 — the three surfaces.
//
// Task 5 — the editing surfaces were too small: ~2.5 lines of a draft that was
//          routinely 600–1,300 characters, in a box with `resize-none` on it.
// Task 6 — there was no way to delete an idea at all.
// Task 7 — Diagnosis silently became panel-only, and dictation was undiscoverable.
//
// The matcher (Task 7's load-bearing piece) is tested for real here, including the
// case that matters most: it must REFUSE when two causes fit equally well, because
// picking one would be the platform choosing the user's root cause for them.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { matchCause, AMBIGUOUS, type CauseRow } from '../lib/lex/match-cause'
import { LIVE_IDEA } from '../lib/lex/idea-visibility'

const ROOT = path.join(__dirname, '..')
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${label}`)
  else { fail++; console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const PANEL = 'components/lex/FieldsPanel.tsx'
const CARD = 'components/lex/AcceptCard.tsx'
const DEEP = 'components/lex/DeepeningPanel.tsx'

console.log('§19-E Tasks 5/6/7 — editing surfaces, deletion, the Diagnosis chat path\n')

// ── TASK 5 ───────────────────────────────────────────────────────────────────
console.log('§5 — a long Lex draft is readable without scrolling, and the box can be dragged')
const panel = code(PANEL)
ok('there is an auto-sizing textarea component', /function GrowTextarea/.test(panel))
ok('...that sizes to its CONTENT', /el\.style\.height = `\$\{Math\.min\(el\.scrollHeight, GROW_MAX_PX\)\}px`/.test(panel))
ok('...resetting to auto first, so deleting text shrinks it again',
  /el\.style\.height = 'auto'/.test(panel),
  'without this the box stays at its high-water mark for the session')
ok('...with a floor well above the old three rows', /GROW_MIN_ROWS = 8/.test(panel))
ok('...and a ceiling, so a very long value cannot push Save off the screen', /GROW_MAX_PX = \d+/.test(panel))
ok('...and it is drag-resizable', /resize-y/.test(panel))
ok('...and a user drag STOPS the auto-sizing for that box',
  /userSized/.test(panel) && /ResizeObserver/.test(panel),
  'a box that springs back to a computed height as you type is worse than one that never moved')
ok('the narrative box uses it', /<GrowTextarea[\s\S]{0,200}Write as much or as little/.test(panel))
ok('the proposed-output box uses it', /<GrowTextarea[\s\S]{0,260}Write it here if you/.test(panel))
ok('the structured slots use it', /<GrowTextarea[\s\S]{0,200}minRows=\{4\}/.test(panel))
ok('a keyword list still gets a SMALL box, not eight rows',
  /minRows=\{isList \? 2 : GROW_MIN_ROWS\}/.test(panel))
ok('NO editor in the panel is resize-none any more', !/resize-none/.test(panel),
  code(PANEL).match(/.{0,60}resize-none.{0,40}/)?.[0])
ok('the chat accept card is resizable too and sizes to the draft',
  !/resize-none/.test(code(CARD)) && /Math\.min\(20, Math\.max\(6/.test(code(CARD)))
ok('the Deepening triage boxes are resizable too', !/resize-none/.test(code(DEEP)))

// ── TASK 6 ───────────────────────────────────────────────────────────────────
console.log('\n§6 — an idea can be deleted')
const ROUTE = 'app/api/ideas/[id]/route.ts'
const route = code(ROUTE)
ok('there is a DELETE handler', /export async function DELETE/.test(route))
ok('OWNER ONLY — a collaborator cannot delete what they were invited to help with',
  /idea\.creatorId !== user\.id/.test(route) && /403/.test(route))
ok('...and it does NOT reach for authorizeIdea, whose answer admits collaborators',
  !/authorizeIdea/.test(route))
ok('SOFT — deletedAt is set, nothing is destroyed',
  /data: \{ deletedAt: new Date\(\) \}/.test(route) && !/prisma\.idea\.delete/.test(route))
ok('a public idea is REFUSED with a reason, not silently no-opped',
  /PUBLIC_STAGES/.test(route) && /409/.test(route) && /Withdraw it instead/.test(read(ROUTE)))
ok('deleting twice is idempotent, not a 404 on the second press',
  /alreadyDeleted: true/.test(route))

console.log('\n§6 — and it is actually gone')
ok('the schema carries deletedAt', /deletedAt\s+DateTime\?/.test(read('prisma/schema.prisma')))
ok('the SQL delta is idempotent', /ADD COLUMN IF NOT EXISTS "deletedAt"/.test(read('prisma/idea_soft_delete.sql')))
ok('authorizeIdea — the chokepoint every Lex route passes — refuses a deleted idea',
  /if \(idea\.deletedAt\)/.test(code('lib/lex/authz.ts')) && /404/.test(code('lib/lex/authz.ts')))
// ══ 25-P §3 — THESE TWO WERE RED BECAUSE THE CODE GOT BETTER ═══════════════════════
//
// Both asserted the literal `deletedAt: null` in the page source. 25-O §4b replaced those
// literals with `LIVE_IDEA`, a shared predicate that contains exactly that clause and also
// hides archived ideas — so the pages became MORE correct and the checks went red.
//
// ⚠⚠ THAT IS THE JOIN-BLIND CLASS FROM THE OTHER SIDE. A source assertion cannot tell "the
// filter is gone" from "the filter moved", because it was never reading the filter — only the
// characters that used to spell it. CLAUDE.md §25: assert the value, and where the property
// really is about source, assert against the IMPORTED predicate rather than a transcription
// of it.
ok('LIVE_IDEA is the predicate, and it excludes deleted ideas',
  (LIVE_IDEA as { deletedAt: null }).deletedAt === null)
ok("it leaves the owner's dashboard list",
  /\.\.\.LIVE_IDEA/.test(code('app/dashboard/page.tsx')))
ok('it leaves both lists on /ideas',
  (code('app/ideas/page.tsx').match(/\.\.\.LIVE_IDEA/g) ?? []).length >= 2)
ok('the detail page 404s for everyone, owner included',
  /if \(!idea \|\| idea\.deletedAt\) notFound\(\)/.test(code('app/ideas/[id]/page.tsx')))
ok('...and its title does not leak through page metadata',
  /if \(!idea \|\| idea\.deletedAt\) return PRIVATE_METADATA/.test(code('app/ideas/[id]/page.tsx')))

console.log('\n§6 — the confirmation NAMES the idea')
const DIALOG = 'components/lex/DeleteIdeaDialog.tsx'
const dialog = code(DIALOG)
ok('there is a confirmation dialog', /export default function DeleteIdeaDialog/.test(dialog))
ok('...that renders the idea\'s title in the body', /\{shown\}/.test(dialog))
ok('...and on the destructive button itself, so the last thing read is the name',
  /Delete “\$\{shown/.test(dialog) || /Delete .\$\{shown/.test(dialog))
ok('...and says the delete is recoverable', /we can put it back/.test(read(DIALOG)))
ok('...and shows the server\'s own refusal rather than a generic failure',
  /body\?\.error \?\?/.test(dialog))
ok('the control is owner-only and absent once the idea is public',
  /isOwner && !\['STAGE_4', 'STAGE_5'\]\.includes\(idea\.stage\)/.test(code('app/ideas/[id]/IdeaDetailClient.tsx')))
ok('a successful delete navigates away with a HARD load, so the stale list cannot show',
  /window\.location\.href = '\/dashboard'/.test(code('app/ideas/[id]/IdeaDetailClient.tsx')))

// ── TASK 7 ───────────────────────────────────────────────────────────────────
console.log('\n§7 — Diagnosis accepts a chat answer')
const LEXROUTE = code('app/api/ideas/[id]/lex/route.ts')
const CLIENT = read('lib/lex/lex-client.ts')
ok('rootCause is a proposable field key', /'rootCause',/.test(CLIENT))
ok('...and Lex is told the user may answer in chat OR the panel',
  /They can answer HERE, in chat, or select it in the panel/.test(CLIENT))
ok('...and is told not to push when they are still weighing it up',
  /do not push them to choose/.test(CLIENT))
ok('the route resolves a named cause to a row and selects it',
  /current\?\.key === 'rootCause'/.test(LEXROUTE) && /setRootCause\(id, resolved\.id\)/.test(LEXROUTE))
ok('...and logs whether it matched, so a silent no-match is visible',
  /root cause named in chat/.test(read('app/api/ideas/[id]/lex/route.ts')))

console.log('\n§7 — the matcher, including its refusal')
const CAUSES: CauseRow[] = [
  { id: 'c1', cause: 'Senior civil servants face no personal consequence for a decision that goes wrong' },
  { id: 'c2', cause: 'Incentives reward avoiding blame rather than taking a decision' },
  { id: 'c3', cause: 'Accountability is diffused across committees so no individual owns the outcome' },
]
const m = (said: string) => matchCause(said, CAUSES)
ok('an exact quotation matches', (m(CAUSES[1].cause) as CauseRow)?.id === 'c2')
ok('a quoted fragment matches', (m('no personal consequence for a decision that goes wrong') as CauseRow)?.id === 'c1')
ok('a loose reference matches on content words', (m('the incentives one') as CauseRow)?.id === 'c2')
ok('...as does a paraphrase', (m('accountability diffused across committees') as CauseRow)?.id === 'c3')
ok('an unrelated answer matches nothing rather than the nearest thing',
  m('the weather in Aberdeen has been unusually mild') === null)
ok('an empty answer matches nothing', m('') === null)
ok('no causes on the list ⇒ no match', matchCause('anything', []) === null)
// THE ONE THAT MATTERS. Two identical causes must not resolve to whichever came first.
const TWINS: CauseRow[] = [
  { id: 'a', cause: 'Incentives reward avoiding blame' },
  { id: 'b', cause: 'Incentives reward avoiding blame' },
]
ok('two equally good matches REFUSE rather than picking the first',
  matchCause('incentives reward avoiding blame', TWINS) === AMBIGUOUS)
ok('...and the route selects nothing when the match is ambiguous',
  /const resolved = match && match !== AMBIGUOUS \? match : null/.test(LEXROUTE))

console.log('\n§7 — the dictation hint')
ok('there is a stage hint, keyed by page', /const STAGE_HINT: Record<string, string>/.test(panel))
ok('...carrying the brief\'s wording for Diagnosis',
  /Dictating is a faster way to get your ideas down — Lex will tidy up your thoughts\./.test(read(PANEL)))
ok('...saying chat and the panel both work', /You can answer in the chat or write straight into the boxes/.test(read(PANEL)))
ok('...rendered at the top of the ACTIVE stage only', /isActive && !isLocked && !collapsed && STAGE_HINT\[page\.key\]/.test(panel))
ok('...and a stage with no hint renders nothing rather than a generic line',
  Object.keys({ DIAGNOSIS: 1 }).length === 1 && !/STAGE_HINT\[page\.key\] \?\? /.test(panel))

console.log(fail === 0 ? '\nAll checks pass.' : `\n${fail} check(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
