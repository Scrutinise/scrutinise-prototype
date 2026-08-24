// ─────────────────────────────────────────────────────────────────────────────
// verify:recent-ideas-ui — RENDER THE STOPGAP PREVIOUS-IDEAS PANEL AND LOOK AT IT.
//
// The panel is a temporary measure (24 Aug 2026): nothing in the product lists ideas made
// on /ideas/build, so a finished build is reachable only by pasting a URL. It should be
// deleted when a real "my ideas" surface exists — and so should this file.
//
// ⚠ IT IS CHECKED BY RENDERING, NOT BY GREP, WHICH IS 25-E's LESSON. A grep can tell you a
// link is written down. It cannot tell you the branch containing it is reachable, and that
// distinction is what left `IdeaBuild` empty for eight sprints.
//
// ⚠ ONE ASSERTION IS A BREAK-TEST. Two of the assertions below are NEGATIVE ("this link is
// absent"), and a negative assertion passes for free if the matcher never matches anything
// — the 25-E harness had exactly that bug. So the same matcher is run against input that
// SHOULD produce the link, and required to find it.
//
// ⚠ WHAT THIS IS NOT: a browser walk. Static markup covers shape and copy, not clicks.
//
// Usage: npm run verify:recent-ideas-ui
// ─────────────────────────────────────────────────────────────────────────────
import * as React from 'react'
;(globalThis as any).React = React
import { renderToStaticMarkup } from 'react-dom/server'
import RecentIdeasPanel, { type RecentIdea } from '../components/lex/RecentIdeasPanel'

const recent: RecentIdea[] = [
  { ideaId: '452c5ade-3153-400a-bf48-3b71aaa52773', title: 'Untitled idea',
    excerpt: 'The civil service is plagued by the same issues as any bureaucracy, but worse because it is a public service…',
    elicitationStatus: 'CONFIRMED', buildStatus: 'DONE', passesComplete: 7,
    updatedAt: '2026-08-24T01:30:29.510Z' },
  { ideaId: 'aaaaaaaa-0000-0000-0000-000000000000', title: 'Untitled idea',
    excerpt: 'A second idea with no build started at all.',
    elicitationStatus: 'IN_PROGRESS', buildStatus: null, passesComplete: null,
    updatedAt: '2026-08-20T09:00:00.000Z' },
]

let pass = 0, fail = 0
const ok = (l: string, c: boolean, d = '') => { c ? (pass++, console.log(`  ✓ ${l}${d && ' — ' + d}`)) : (fail++, console.log(`  ✗ ${l}${d && ' — ' + d}`)) }

const html = renderToStaticMarkup(<RecentIdeasPanel recent={recent} hiddenEmpty={9} />)

ok('the panel renders at all', html.includes('Your previous ideas (2)'))
ok('a row is identified by the USER’S WORDS, not the title', html.includes('The civil service is plagued'))
ok('the useless title is NOT what identifies a row', !html.includes('>Untitled idea<'))
ok('a DONE build offers the kernel link',
   html.includes('/ideas/create?ideaId=452c5ade-3153-400a-bf48-3b71aaa52773'))
ok('a build that never ran does NOT offer a kernel link',
   !html.includes('/ideas/create?ideaId=aaaaaaaa-0000-0000-0000-000000000000'),
   'a link to a kernel that was never drafted is a dead end wearing a button')
ok('every row is openable here', html.includes('/ideas/build?ideaId=452c5ade-3153-400a-bf48-3b71aaa52773')
   && html.includes('/ideas/build?ideaId=aaaaaaaa-0000-0000-0000-000000000000'))
ok('elicitation and build state are reported SEPARATELY',
   html.includes('elicitation confirmed') && html.includes('build done (7/7)')
   && html.includes('elicitation in progress') && html.includes('no build started'))
ok('the hidden shells are counted out loud, not dropped silently', html.includes('9 empty ideas hidden'))

// ⚠ THE NEGATIVE ASSERTION ABOVE COULD PASS VACUOUSLY. If the matcher never matched
// anything, "a build that never ran does NOT offer a kernel link" would pass while
// testing nothing — which is exactly the bug the 25-E harness had (a Tailwind class made
// its matcher report every button as disabled). So: flip that row to DONE and require the
// SAME matcher to find the link.
const flipped = renderToStaticMarkup(
  <RecentIdeasPanel recent={[{ ...recent[1], buildStatus: 'DONE', passesComplete: 7 }]} hiddenEmpty={0} />)
ok('BREAK-TEST — the same matcher DOES find the link when the build is DONE',
   flipped.includes('/ideas/create?ideaId=aaaaaaaa-0000-0000-0000-000000000000'),
   'so the negative assertion above is real, not vacuous')

// The negative control: with nothing to show, the panel must not appear at all.
const emptyHtml = renderToStaticMarkup(<RecentIdeasPanel recent={[]} hiddenEmpty={0} />)
ok('CONTROL — no panel when there is nothing to list', !emptyHtml.includes('Your previous ideas'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
