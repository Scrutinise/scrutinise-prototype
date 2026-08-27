// ─────────────────────────────────────────────────────────────────────────────
// 25-J §2 — RENDER the ideas hub list and read the markup.
//
// ⚠ IT RENDERS, it does not grep. The property that matters is what a user SEES: an
// untitled idea must be recognisable by their own words, and a real title must win. A
// source check would pass on markup that never reaches the page — which is the gap that
// left `IdeaBuild` empty for eight sprints.
//
// Replaces verify-recent-ideas-ui.tsx, whose component 25-J deleted.
//
// Usage: tsx scripts/verify-my-ideas-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MyIdeasList, { type MyIdea, hasRealTitle, hrefFor, PLACEHOLDER_TITLE } from '../components/lex/MyIdeasList'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}

const base: MyIdea = {
  ideaId: 'aaaaaaaa-1111-2222-3333-444444444444',
  title: PLACEHOLDER_TITLE,
  excerpt: 'Bus services in my area were cut and the replacement never turns up',
  stage: 'STAGE_1',
  elicitationStatus: 'IN_PROGRESS',
  buildStatus: null,
  passesComplete: null,
  updatedAt: '2026-08-26T09:15:00.000Z',
}
const titled: MyIdea = {
  ...base,
  ideaId: 'bbbbbbbb-1111-2222-3333-444444444444',
  title: 'Enhancing Civil Service Accountability',
  excerpt: 'The civil service is plagued by the same issues as any bureaucracy',
  stage: 'STAGE_2',
  elicitationStatus: 'CONFIRMED',
  buildStatus: 'DONE',
  passesComplete: 8,
}

console.log('── verify:my-ideas-ui ──')
const html = renderToStaticMarkup(<MyIdeasList ideas={[base, titled]} hiddenEmpty={3} />)

ok('the list renders, open, with a count', html.includes('My ideas (2)'))

// ⚠ §2's headline requirement, asserted on rendered markup.
ok('an UNTITLED idea is identified by the user\'s own words',
  html.includes('Bus services in my area were cut'), html.slice(0, 300))
ok('…and it is NOT rendered as “Untitled idea”', !html.includes(PLACEHOLDER_TITLE), html.slice(0, 300))
ok('…and the words are LABELLED as the user\'s, not passed off as a title',
  html.includes('In your words:'))

ok('a REAL title wins over the excerpt',
  html.includes('Enhancing Civil Service Accountability')
  && !html.includes('The civil service is plagued'))

ok('the stage is shown in the five-stage vocabulary',
  html.includes('Create') && html.includes('Draft'))
ok('a build that finished says so', html.includes('built'))
ok('last worked on is shown, in a fixed locale', html.includes('26 Aug') && html.includes('UTC'))
ok('the omission is stated', html.includes('3 empty ideas are hidden'))

// ⚠ 25-G §2 / 25-F §9b — a BUILT idea opens on the proposal; an unbuilt one opens the build.
ok('a built idea opens on the proposal', hrefFor(titled) === `/ideas/create?ideaId=${titled.ideaId}`)
ok('an unbuilt idea opens on the build', hrefFor(base) === `/ideas/build?ideaId=${base.ideaId}`)

// The placeholder test is exact, not heuristic.
ok('“Untitled idea” is the only string treated as a placeholder',
  !hasRealTitle(PLACEHOLDER_TITLE) && hasRealTitle('Untitled thoughts on buses'))

// ⚠ CONTROLS — each asserts the check could have failed.
const empty = renderToStaticMarkup(<MyIdeasList ideas={[]} hiddenEmpty={0} />)
ok('CONTROL — nothing renders when there is nothing to list', !empty.includes('My ideas'))
const noHidden = renderToStaticMarkup(<MyIdeasList ideas={[base]} hiddenEmpty={0} />)
ok('CONTROL — no omission note when nothing was omitted', !noHidden.includes('hidden'))
const allTitled = renderToStaticMarkup(<MyIdeasList ideas={[titled]} hiddenEmpty={0} />)
ok('CONTROL — no “in your words” when every idea has a real title',
  !allTitled.includes('In your words:'))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
