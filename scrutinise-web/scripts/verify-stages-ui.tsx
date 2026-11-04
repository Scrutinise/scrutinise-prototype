// ─────────────────────────────────────────────────────────────────────────────
// 25-K §1/§8 → 26-X §2–§3 (316) — RENDER the stage indicator and read the markup.
//
// ⚠⚠ THIS IS A CHECK OF WHAT COMES OUT OF THE RENDERER, not of what is written in the source (25-K §8: "where am I, and what do I do
// next?"). 26-X replaced the three-stage bar ("Stage N of 3") with the seven lifecycle stages, each with a state line, and — on the
// Development screens — the checklist. ⚠ MOVED BY 316: was "all three stages", "Stage N of 3, name", "the other two are reachable".
//
// Usage: tsx scripts/verify-stages-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StageBar from '../components/lex/StageBar'
import { LEX_STAGES, LIFECYCLE_KEYS, lifecycleOfScreen, stageHref, type LexStageKey } from '../lib/lex/stages'
import { LIFECYCLE_STAGE_WORD } from '../lib/lex/screen-labels'
import { stageContext, type StageContext } from '../lib/lex/stage-context'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}
/** Text only, so an assertion cannot be satisfied by a class name or an attribute. */
const text = (html: string) => html.split(/<[^>]+>/).join(' ').split(/\s+/).join(' ').trim()

/** A context of the shape the server builds, for an idea that exists (the counts are fixtures; the shape is the page's). */
function ctx(here: LexStageKey, ideaId: string): StageContext {
  return {
    ideaId, here, current: lifecycleOfScreen(here), checklistHere: here === 'deepening' ? 'deepening' : null,
    lifecycle: LIFECYCLE_KEYS.map((k, i) => ({ key: k, n: i + 1, name: LIFECYCLE_STAGE_WORD[k], state: `state of ${k}`,
      href: k === 'creation' ? stageHref('idea', ideaId) : k === 'development' ? stageHref('strategy', ideaId) : null })),
    checklist: here === 'idea' ? null : [
      { key: 'problem', n: 1, label: 'The problem', state: 'written', mark: '●', href: `/x?section=problem` },
      { key: 'deepening', n: 6, label: 'The Deepening', state: 'locked — 3 to go', mark: '🔒', href: '/x?stage=deepening' },
    ],
    stages: LEX_STAGES.map((s) => ({ ...s, href: stageHref(s.key, ideaId), detail: null, available: true, unavailableReason: null })),
  }
}
const names = LIFECYCLE_KEYS.map((k) => LIFECYCLE_STAGE_WORD[k])

async function main() {
  console.log('── verify:stages-ui ──')
  for (const screen of LEX_STAGES) {
    const html = renderToStaticMarkup(<StageBar context={ctx(screen.key, 'abc-123')} />)
    const t = text(html)
    const bar = html.slice(0, html.indexOf('</ol>'))
    ok(`${screen.name}: all seven lifecycle stages are on the screen, in order`, names.every((n, i) => i === 0 || t.indexOf(n) > t.indexOf(names[i - 1])), t.slice(0, 260))
    ok(`${screen.name}: each stage has its state line`, LIFECYCLE_KEYS.every((k) => t.includes(`state of ${k}`)))
    // §21 — the "you are here" cue is not a colour: the word, and the filled glyph on exactly one tile
    ok(`${screen.name}: "You are here" is printed once, on ${screen.key === 'idea' ? 'Creation' : 'Development'}`, (html.match(/data-you-are-here/g) ?? []).length === 1 && new RegExp(`data-lifecycle-stage="${lifecycleOfScreen(screen.key)}"[\\s\\S]*?You are here`).test(html))
    ok(`${screen.name}: the current tile carries the filled glyph and the other six do not`, (bar.match(/●/g) ?? []).length === 1 && (bar.match(/○/g) ?? []).length === 6, `● ${(bar.match(/●/g) ?? []).length}, ○ ${(bar.match(/○/g) ?? []).length}`)
    ok(`${screen.name}: ${screen.key === 'idea' ? 'its purpose line' : 'the Development checklist'} says what to do here`, screen.key === 'idea' ? t.includes(screen.purpose) : /data-development-checklist/.test(html) && t.includes('locked — 3 to go'))
    const hrefs = [...bar.matchAll(/href="([^"]+)"/g)].map((m) => m[1].split('&amp;').join('&'))
    // ⚠⚠ THE ONE THAT WOULD SILENTLY UNDO 25-K §1: Creation's link carries the escape, or a built idea bounces back to the workspace
    if (screen.key !== 'idea') ok(`${screen.name}: Creation is reachable from here, with the anti-bounce escape`, hrefs.some((h) => h === stageHref('idea', 'abc-123') && h.includes('stage=idea')), hrefs.join(' | '))
    if (screen.key === 'deepening') ok('The Deepening: Development (the current stage) links back to the workspace', hrefs.includes(stageHref('strategy', 'abc-123')), hrefs.join(' | '))
    ok(`${screen.name}: the stages with nothing built behind them are not links`, hrefs.every((h) => h.includes('/ideas/build') || h.includes('/ideas/create')))
  }
  // ── the very first screen, before an idea exists — through the real stageContext (no database is read with no idea) ──
  const html = renderToStaticMarkup(<StageBar context={await stageContext(null, 'idea')} />)
  const t = text(html)
  ok('with no idea yet, all seven stages are still SHOWN', names.every((n) => t.includes(n)), t.slice(0, 200))
  ok('the ones not open yet SAY WHY, rather than sitting inert', t.includes('opens once Lex has built the idea') && t.includes('not yet open'), t.slice(0, 300))
  ok('and only Creation links anywhere before there is an idea', [...html.matchAll(/href="([^"]+)"/g)].length <= 1)
  console.log(`\n${pass} passed, ${fail} failed.`)
  process.exit(fail ? 1 : 0)
}
void main()
