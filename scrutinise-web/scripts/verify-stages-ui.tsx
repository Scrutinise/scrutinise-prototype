// ─────────────────────────────────────────────────────────────────────────────
// 25-K §1/§8 — RENDER the stage indicator and read the markup.
//
// ⚠⚠ THIS IS THE ONLY CHECK THAT CAN ANSWER §8's TEST. "A stranger opens the product and
// at every screen can answer *where am I, and what do I do next?*" is a question about what
// comes out of the renderer, not about what is written in the source. A grep can tell you a
// `<nav>` is written down; it cannot tell you the branch containing it is reachable, and
// that gap is what left `IdeaBuild` empty for eight sprints.
//
// ⚠ AND IT IS THE ONLY WAY TO VERIFY THIS AT ALL FROM A CC SESSION. §0: the three-column
// desktop layout cannot be walked from here — the browser reports a 0×0 viewport, so every
// `lg:` breakpoint fails to match and the desktop arrangement never renders. The indicator
// is not behind a breakpoint, so it CAN be rendered, and this renders it.
//
// Usage: tsx scripts/verify-stages-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StageBar from '../components/lex/StageBar'
// ⚠ 25-L split the vocabulary from the counting so a client component could import the
// names without dragging `pg` into the browser bundle. `StageContext` went with the counts.
// This import survived because `tsx` erases a type-only import and the harness kept passing.
import { LEX_STAGES, stageHref, type LexStageKey } from '../lib/lex/stages'
import type { StageContext } from '../lib/lex/stage-context'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}

/** Text only, so an assertion cannot be satisfied by a class name or an attribute. */
function text(html: string): string {
  return html.split(/<[^>]+>/).join(' ').split(/\s+/).join(' ').trim()
}

function ctx(here: LexStageKey, ideaId: string | null): StageContext {
  return {
    ideaId,
    here,
    stages: LEX_STAGES.map((s) => ({
      ...s,
      href: stageHref(s.key, ideaId),
      detail: ideaId ? '23 fields, 10 decisions waiting' : null,
      available: ideaId ? true : s.key === 'idea',
      unavailableReason: ideaId || s.key === 'idea' ? null : 'Opens once you’ve told me the idea.',
    })),
  }
}

console.log('── verify:stages-ui ──')

// ── every stage, rendered as the current one ────────────────────────────────
for (const stage of LEX_STAGES) {
  const html = renderToStaticMarkup(<StageBar context={ctx(stage.key, 'abc-123')} />)
  const t = text(html)

  ok(`${stage.name}: all three stages are on the screen`,
    LEX_STAGES.every((s) => t.includes(s.name)), t.slice(0, 200))

  ok(`${stage.name}: the screen says WHICH stage this is, in words`,
    t.includes(`Stage ${stage.n} of 3, ${stage.name}.`), t.slice(0, 200))

  ok(`${stage.name}: it says what this stage is FOR`,
    t.includes(stage.purpose), t.slice(0, 260))

  // ⚠ §21 — the "you are here" cue must not be a colour. Two of the three cues are
  // readable in static markup: the word and the filled glyph.
  ok(`${stage.name}: "You are here" is printed, not implied by a highlight`,
    t.includes('You are here'), t.slice(0, 200))
  ok(`${stage.name}: the current tile carries the filled glyph and the others do not`,
    (html.match(/●/g) ?? []).length === 1 && (html.match(/○/g) ?? []).length === 2,
    `● ${(html.match(/●/g) ?? []).length}, ○ ${(html.match(/○/g) ?? []).length}`)

  // ⚠ MOVEMENT IN BOTH DIRECTIONS. The other two are anchors with real hrefs; the current
  // one is not a link to itself.
  // ⚠ `&amp;` — renderToStaticMarkup escapes the ampersand, correctly, so a raw string
  // comparison against `stageHref` fails on markup that is right. Decode before comparing;
  // do NOT loosen the comparison, which would stop it noticing a wrong href.
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].split('&amp;').join('&'))
  ok(`${stage.name}: the other two stages are reachable from here`,
    hrefs.length === 2
    && LEX_STAGES.filter((s) => s.key !== stage.key).every((s) => hrefs.includes(stageHref(s.key, 'abc-123'))),
    hrefs.join(' | '))

  // ⚠⚠ THE ONE THAT WOULD SILENTLY UNDO §1. Stage 1's link has to carry the escape or a
  // user with a finished build is bounced straight back to stage 2 by 25-G's redirect.
  if (stage.key !== 'idea') {
    ok(`${stage.name}: the route back to stage 1 carries the anti-bounce escape`,
      hrefs.some((h) => h.includes('stage=idea')), hrefs.join(' | '))
  }
}

// ── the very first screen, before an idea exists ────────────────────────────
{
  const html = renderToStaticMarkup(<StageBar context={ctx('idea', null)} />)
  const t = text(html)
  ok('with no idea yet, all three stages are still SHOWN',
    LEX_STAGES.every((s) => t.includes(s.name)), t.slice(0, 200))
  // ⚠ A REASON, NOT AN INERT TILE. "Nothing there" and "you cannot go there" are different
  // facts and a user who cannot tell them apart assumes the second.
  ok('the two that are not open yet SAY WHY, rather than sitting inert',
    t.includes('Opens once you’ve told me the idea.'), t.slice(0, 260))
  ok('and nothing links anywhere before there is an idea to link to',
    !/href="/.test(html), html.slice(0, 200))
}

console.log(`\n${pass} passed, ${fail} failed.`)
process.exit(fail ? 1 : 0)
