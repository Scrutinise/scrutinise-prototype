// ─────────────────────────────────────────────────────────────────────────────
// 26-S BROWSER PASS (17 Oct 2026) — Charlie's findings A–G on the Coherent Actions screen, checked IN A BROWSER.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s-browser.ts            (A: offline · B: real Chromium)
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26s-browser.ts --db       (+ C: the real functions on a scratch copy)
//
// A  offline   — the limits are one set of numbers; the rejection sentence; the provenance wording; the source of every control.
// B  browser   — the REAL components in Chromium, against a stand-in server that uses the real request schema and rejection words.
//                Every write re-reads the list; a refusal says "Not saved: …" with OK; a success says what happened; a failed re-read is said.
// C  database  — assignToNewHeading, the "moved nothing is a refusal" rule and the 600-character reason, on a scratch copy of 452c5ade.
//
// Counts what RAN (§23.2). A browser check that cannot launch is NOT RUN and says so — never a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { LIMITS, clampToLimit, remainingWords } from '../lib/lex/input-limits'
import { ActionStructureBody, OP_WORDS, INPUT_WORDS } from '../lib/lex/action-structure-schema'
import { describeIssues, explainFailure } from '../lib/api-rejection'
import { provenanceWords, provenanceLine, modelFamily } from '../lib/lex/action-facets'
import { describeSource } from '../lib/lex/action-ideas'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

function partA() {
  section('A · offline — one set of limits, the rejection sentence, the wording')
  ok('the four limits Charlie named are one set of numbers: reason 600, link 200, title 110, heading name 60', LIMITS.ruleOutReason === 600 && LIMITS.classificationLink === 200 && LIMITS.actionTitle === 110 && LIMITS.headingName === 60)
  const sch = read('lib/lex/action-structure-schema.ts')
  ok('the route\'s schema reads those numbers (not its own literals): no .max(600) / .max(80) left on a user-typed field', !/\.max\((600|80)\)/.test(sch) && /LIMITS\.ruleOutReason/.test(sch) && /LIMITS\.headingName/.test(sch) && /LIMITS\.actionTitle/.test(sch) && /LIMITS\.classificationLink/.test(sch))
  const c = clampToLimit('x'.repeat(700), 600)
  ok('clamp: 700 characters → 600 kept, and the note says 100 were not kept', c.text.length === 600 && c.cut === 100 && /Cut at 600 characters — 100 more were not kept\./.test(c.note), c.note)
  ok('…and text inside the limit is untouched with no note', clampToLimit('short', 600).note === '' && clampToLimit('short', 600).text === 'short')
  ok('the counter is a WORD: "12 left", and at the limit "limit reached (600)"', remainingWords(588, 600) === '12 left' && remainingWords(600, 600) === 'limit reached (600)')
  control('a counter that is only a bare number ("12") passing the words test (must be FALSE)', /left|limit reached/.test(String(600 - 588)))

  const over = ActionStructureBody.safeParse({ op: 'ruleOut', ids: ['a'], reason: 'x'.repeat(601) })
  ok('the schema REFUSES a 601-character reason (it is not silently cut)', !over.success)
  if (!over.success) {
    const d = describeIssues(over.error.issues, { action: OP_WORDS.ruleOut, labels: INPUT_WORDS })
    ok('…and the sentence names the input and the limit: "the reason … is too long (at most 600 characters are allowed)"', /the reason/.test(d.message) && /too long \(at most 600 characters are allowed\)/.test(d.message), d.message)
  }
  ok('the schema ACCEPTS exactly 600', ActionStructureBody.safeParse({ op: 'ruleOut', ids: ['a'], reason: 'x'.repeat(600) }).success)
  control('a 601-character reason accepted (must be FALSE)', ActionStructureBody.safeParse({ op: 'ruleOut', ids: ['a'], reason: 'x'.repeat(601) }).success)
  ok('a heading name over 60 is refused in words, not cut to 60 behind the scenes', !ActionStructureBody.safeParse({ op: 'createHeading', name: 'h'.repeat(61) }).success)
  ok('the new bulk op exists and takes the rows and a name', ActionStructureBody.safeParse({ op: 'assignToNewHeading', actionIds: ['a'], name: 'Costs' }).success && !ActionStructureBody.safeParse({ op: 'assignToNewHeading', actionIds: ['a'], name: '' }).success)
  ok('…and the old-shape rejection body is still worded (explainFailure)', /the reason/.test(explainFailure({ error: { formErrors: [], fieldErrors: { reason: ['Too big'] } } }, 422, OP_WORDS.ruleOut)) || /reason/.test(explainFailure({ error: { formErrors: [], fieldErrors: { reason: ['Too big'] } } }, 422, OP_WORDS.ruleOut)))

  ok('provenance, old stored string → "your comment during consolidation (Grok draft)"', provenanceWords('your comment on the grok-4.7 draft') === 'your comment during consolidation (Grok draft)')
  ok('…a new write says the same', describeSource({ kind: 'COMMENT', consolidationId: 'c', model: 'grok-4.7' }) === 'your comment during consolidation (Grok draft)')
  ok('…other sources are left as they were; the line begins "From: "', provenanceLine(['parked with policy 2 (item 15)', 'your comment on the claude-opus-5 draft']) === 'From: parked with policy 2 (item 15); your comment during consolidation (Claude draft)')
  ok('family, never the version: gemini-2.5-pro → Gemini, gpt-5 → GPT', modelFamily('gemini-2.5-pro') === 'Gemini' && modelFamily('gpt-5') === 'GPT')
  control('the version string surviving in the wording (must be FALSE)', /4\.7|opus-5/.test(provenanceWords('your comment on the grok-4.7 draft')))

  const ws = read('components/lex/ActionsWorkspace.tsx')
  ok('SOURCE: every user-typed bounded box on the screen is a BoundedInput (no bare maxLength left on this screen)', !/maxLength=/.test(ws))
  ok('SOURCE: the strip is sticky and holds the status and the bulk bar', /sticky top-0 z-20[^>]*data-sticky-top/.test(ws) && /\{Status\}\{BulkBar\}/.test(ws))
  ok('SOURCE: the list is re-read BEFORE a success is said (onChanged awaited)', /const fresh = await onChanged\(\)/.test(ws))
  ok('SOURCE: a refusal is "Not saved: …" with an OK button', /`Not saved: \$\{explainFailure/.test(ws) && />OK<\/button>/.test(ws))
  const fb = read('components/lex/FeedbackDialog.tsx')
  ok('SOURCE: feedback opens on "Choose…" and the stage no longer guesses a category', />Choose…<\/option>/.test(fb) && !/SURFACE_BY_STAGE/.test(read('app/ideas/create/CreateIdeaClient.tsx')))
  ok('SOURCE: a pasted image becomes an attachment (clipboard items, image/*)', /clipboardData\?\.items/.test(fb) && /startsWith\('image\/'\)/.test(fb) && /onPaste=/.test(fb))
  const qp = read('components/lex/QuestionPanel.tsx')
  ok('SOURCE: "Notebook · N notes" sits beside Sources and opens the notebook', /data-notebook-link/.test(qp) && /key === 'KEY_SOURCES'/.test(qp) && /setOpenKey\('__notebook'\)/.test(qp))
}

async function partB() {
  section('B · the browser — the real components in Chromium')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({
      entryPoints: [join(ROOT, 'scripts/fixtures/actions-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'),
    })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 400)}`); return }
  // The project's own Tailwind (v4, the same postcss plugin the app builds with), scanned over the two components — so the page LAYS OUT as it does
  // for a user, and "sticky", "below", "top-right" can be measured rather than inferred from class names.
  let css = ''
  try {
    const postcss = (await import('postcss')).default
    // Typed loosely on purpose: the package ships no type declarations, and this only feeds postcss.
    const twName: string = '@tailwindcss/postcss'
    const tw = (await import(twName)).default as () => import('postcss').AcceptedPlugin
    const out = await postcss([tw()]).process(`@import 'tailwindcss'; @source "../components/lex/ActionsWorkspace.tsx"; @source "../components/lex/BoundedInput.tsx"; @source "../components/lex/FeedbackDialog.tsx";`, { from: join(ROOT, 'app', '_harness.css') })
    css = out.css
  } catch (e) { skip('layout measurements', `Tailwind did not compile: ${(e as Error).message.slice(0, 120)}`) }
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    if (css) await page.addStyleTag({ content: css })
    await page.addScriptTag({ content: bundle })
    await page.evaluate(() => (window as never as { __mount: (w: string) => void }).__mount('workspace'))
    await page.waitForSelector('[data-action-id]')
    const text = async (sel: string) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ')
    const h = <T,>(fn: string) => page.evaluate(fn) as Promise<T>

    // ── C · "? Not tested"
    section('B1 · C — a row never tested says so, in words')
    const nt = await page.locator('[data-not-tested]').count()
    ok('four rows have no recorded policy test → four "? Not tested" labels', nt === 4, `${nt}`)
    ok('…in words and a shape: "? Not tested"', /\? Not tested/.test(await text('li[data-action-id="a1"]')))
    control('a row that WAS tested shows "Not tested" (must be FALSE)', /Not tested/.test(await text('li[data-action-id="a2"]')))

    // ── D / E · the opened record
    section('B2 · D, E — the opened record is one box; provenance is a source')
    await page.locator('li[data-action-id="a2"] button[aria-expanded]').first().click()
    const li2 = page.locator('li[data-action-id="a2"]')
    ok('opened: the row carries the box marker, a 2px border and a grey fill', (await li2.getAttribute('data-open')) === 'true' && /border-2/.test((await li2.getAttribute('class')) ?? '') && /bg-zinc-100/.test((await li2.getAttribute('class')) ?? ''))
    const geo = await page.evaluate(() => {
      const li = document.querySelector('li[data-action-id="a2"]')!
      const close = Array.from(li.querySelectorAll('button')).find((b) => /Close −/.test(b.textContent ?? ''))
      const sel = li.querySelector('select[aria-label^="Heading for action"]')
      const title = li.querySelector('[data-open-title]')
      const line = li.querySelector('[data-test-line]')
      const box = line?.firstElementChild
      if (!close || !sel || !title || !line || !box) return { missing: { close: !!close, sel: !!sel, title: !!title, line: !!line, box: !!box } }
      const c = close.getBoundingClientRect(), t = title.getBoundingClientRect(), s2 = sel.getBoundingClientRect(), b = box.getBoundingClientRect(), l = line.getBoundingClientRect(), r = li.getBoundingClientRect()
      const sameLineAsTitle = Math.abs(c.top - t.top) < 30                      // Close and the title are one line
      const menuOnTestLine = s2.top >= l.top - 2 && s2.bottom <= l.bottom + 2     // the menu is on the test line, not up with Close
      const menuRight = Math.abs(r.right - s2.right) < 40                         // right-aligned
      const testNotFull = b.width < r.width * 0.9                                // the test is not the full width of the record
      return { ok: sameLineAsTitle && menuOnTestLine && menuRight && testNotFull && s2.top > c.bottom, sameLineAsTitle, menuOnTestLine, menuRight, testNotFull, c: [c.top, c.bottom, c.left, c.right], t: [t.top, t.bottom], s2: [s2.top, s2.bottom, s2.left, s2.right], l: [l.top, l.bottom], b: [b.width], r: [r.width, r.right] }
    })
    ok('opened (18 Oct, CCh B): the title line is [title · Edit title · Close] — Close at the right of the title line; the heading menu sits on the policy-test line, right-aligned, and the test is NOT full width', !!(geo as { ok?: boolean }).ok, JSON.stringify(geo))
    ok('opened: the title is text with an "Edit title" control — no always-open box, no "Save title"', (await li2.locator('text=Edit title').count()) === 1 && (await li2.locator('input[aria-label^="Title of action"]').count()) === 0 && (await li2.locator('text=Save title').count()) === 0)
    await li2.locator('text=Edit title').click()
    ok('"Edit title" opens the title box with a counter ("… left")', (await li2.locator('input[aria-label^="Title of action"]').count()) === 1 && /\d+ left/.test(await text('li[data-action-id="a2"] [data-limit-counter]')))
    await li2.locator('button:has-text("Cancel")').first().click()
    const verdictBox = await li2.locator('text=Policy test').first().locator('xpath=..').innerText()
    ok('the verdict box carries the reason only — no "From:"', /It matches the policy/.test(verdictBox) && !/From:/.test(verdictBox), verdictBox)
    const sources = await li2.locator('[data-record-sources]').innerText()
    ok('…the record\'s Sources carries "From: your comment during consolidation (Grok draft)"', /From: your comment during consolidation \(Grok draft\)/.test(sources), sources)
    control('the old wording still on screen (must be FALSE)', /grok-4\.7/.test(await li2.innerText()))

    // ── A1 · over-long reason, the opened card
    section('B3 · A1 — the opened card: Reason box + Rule out')
    const why = li2.locator('input[aria-label="Reason to rule out action 2"]')
    await why.fill('r'.repeat(700))
    ok('700 characters typed → the box holds 600 and SAYS it cut 100', (await why.inputValue()).length === 600 && /limit reached \(600\)/.test(await li2.innerText()) && /Cut at 600 characters — 100 more were not kept/.test(await li2.innerText()))
    await li2.locator('button:has-text("Rule out")').click()
    await page.waitForSelector('[data-status-strip] >> text=Saved: #2 ruled out')
    ok('Rule out → the list was re-read (row gone) and the strip says what happened', (await page.locator('li[data-action-id="a2"]').count()) === 0 && /Saved: #2 ruled out, with your reason/.test(await text('[data-status-strip]')))
    const stored2 = await h<number>(`window.__h.store.actions.find(a => a.id==='a2').ruleOutReason.length`)
    ok('…and the server holds all 600 characters (not 400, not nothing)', stored2 === 600, `${stored2}`)

    // ── A1 · the bulk bar
    section('B4 · A1 — the bulk bar')
    await page.locator('li[data-action-id="a3"] input[type=checkbox]').check()
    await page.locator('li[data-action-id="a4"] input[type=checkbox]').check()
    const bulkWhy = page.locator('[data-bulk-bar] input[aria-label="Reason to rule out the selected actions"]')
    await bulkWhy.fill('b'.repeat(650))
    ok('bulk: 650 typed → 600 kept, counter and cut note shown', (await bulkWhy.inputValue()).length === 600 && /limit reached \(600\)/.test(await text('[data-bulk-bar]')) && /Cut at 600 characters — 50 more were not kept/.test(await text('[data-bulk-bar]')))
    await page.locator('[data-bulk-bar] button:has-text("Rule out")').click()
    await page.waitForSelector('[data-status-strip] >> text=Saved: 2 actions ruled out')
    ok('bulk Rule out → both rows left the list after the re-read; the strip says 2', (await page.locator('li[data-action-id="a3"], li[data-action-id="a4"]').count()) === 0 && (await page.locator('[data-bulk-bar]').count()) === 0)
    // ⚠ Strict on purpose: if anything else is in the strip (it once was — an unanswered digest read), this says so instead of clicking past it.
    ok('the strip holds only the save, no stray alert beside it', (await page.locator('[data-status-strip] [role=alert]').count()) === 0, JSON.stringify(await page.locator('[data-status-strip] [role=alert]').allInnerTexts()))
    await page.locator('[data-status-strip] button:has-text("OK")').click()
    ok('OK clears the strip', (await page.locator('[data-status-strip]').count()) === 0)

    // ── A1/A2 · a refusal renders
    section('B5 · A — a refusal renders as "Not saved: …" with OK, where the user is looking')
    await page.evaluate(() => { (window as never as { __h: { rejectNext: unknown } }).__h.rejectNext = { status: 422, body: { error: { formErrors: [], fieldErrors: { reason: ['Too big: expected string to have <=600 characters'] } } } } })
    await page.locator('input[aria-label="New heading name"]').fill('Will be refused')
    await page.locator('button:has-text("Add heading")').click()
    await page.waitForSelector('[data-status-strip] [role=alert]')
    const alertText = await text('[data-status-strip] [role=alert]')
    ok('the refusal says "Not saved:", names the control and the input, says nothing was changed', /Not saved: .*Add heading.*reason.*Nothing was changed/.test(alertText), alertText)
    ok('…the heading box KEEPS what was typed (a refused write does not eat the text)', (await page.locator('input[aria-label="New heading name"]').inputValue()) === 'Will be refused')
    ok('…and it sits in the sticky strip (stays on screen while the list scrolls)', /sticky top-0/.test((await page.locator('[data-sticky-top]').getAttribute('class')) ?? ''))
    await page.locator('[data-status-strip] [role=alert] button:has-text("OK")').click()
    ok('OK dismisses it', (await page.locator('[data-status-strip] [role=alert]').count()) === 0)
    // the long-list case: the user is at the BOTTOM of a 40-row list when a write is refused — the message must be in view, not 3,000px above.
    await page.locator('li[data-action-id="a40"]').scrollIntoViewIfNeeded()
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight) })
    await page.evaluate(() => { (window as never as { __h: { rejectNext: unknown } }).__h.rejectNext = { status: 422, body: { error: 'Rule out was not done. Rejected: the reason (“reason”) is too long (at most 600 characters are allowed). Nothing was changed.' } } })
    await page.locator('select[aria-label="Heading for action 40"]').selectOption('h1')
    await page.waitForSelector('[data-status-strip] [role=alert]')
    const where = await page.evaluate(() => { const r = document.querySelector('[data-status-strip] [role=alert]')!.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight, scrolled: window.scrollY } })
    ok('LONG LIST: scrolled to the bottom (scrollY > 1500) and a refusal arrives — it is INSIDE the viewport, near the top', where.scrolled > 1500 && where.top >= 0 && where.bottom <= where.vh && where.top < 150, JSON.stringify(where))
    control('the toolbar (where the message used to be drawn) is in view at this scroll (must be FALSE — it is thousands of pixels above)', await page.evaluate(() => { const r = document.querySelector('[role=tablist][aria-label="View"]')!.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight }))
    await page.locator('[data-status-strip] [role=alert] button:has-text("OK")').click()
    await page.evaluate(() => window.scrollTo(0, 0))
    const real = await page.evaluate(() => (window as never as { __h: { post: (r: unknown) => Promise<{ status: number; body: { error: string } }> } }).__h.post({ op: 'ruleOut', ids: ['a1'], reason: 'x'.repeat(601) }))
    ok('the REAL schema + words, end to end: a 601-character reason → 422 "…the reason … is too long (at most 600 characters are allowed)…"', real.status === 422 && /the reason/.test(real.body.error) && /at most 600 characters/.test(real.body.error), JSON.stringify(real.body).slice(0, 200))

    // ── A2 · the three heading paths + B
    section('B6 · A2, B — the three heading paths, each re-reads and says what happened')
    await page.locator('input[aria-label="New heading name"]').fill('Practical')
    await page.locator('button:has-text("Add heading")').click()
    await page.waitForSelector('[data-status-strip] >> text=heading “Practical” added')
    ok('1 · top "Add heading": the heading is in the list after the re-read, the box is cleared, the strip says so', (await page.locator('section[aria-label="Practical"]').count()) === 1 && (await page.locator('input[aria-label="New heading name"]').inputValue()) === '')
    await page.locator('input[aria-label="New heading name"]').fill('Practical')
    await page.locator('button:has-text("Add heading")').click()
    await page.waitForSelector('[data-status-strip] >> text=you already have a heading called “Practical”')
    ok('…adding the SAME name says "Nothing added: you already have…" (it used to do nothing, silently)', (await page.locator('section[aria-label="Practical"]').count()) === 1)
    await page.locator('select[aria-label="Heading for action 5"]').selectOption({ label: '◆ Practical' }).catch(async () => {
      const labels = await page.locator('select[aria-label="Heading for action 5"] option').allInnerTexts()
      await page.locator('select[aria-label="Heading for action 5"]').selectOption({ label: labels.find((l) => /Practical/.test(l))! })
    })
    await page.waitForSelector('[data-status-strip] >> text=#5 is now under “Practical”')
    ok('2 · the per-row menu: #5 moved into "Practical" after the re-read, and the strip says so', (await page.locator('section[aria-label="Practical"] li[data-action-id="a5"]').count()) === 1)
    await page.locator('li[data-action-id="a6"] input[type=checkbox]').check()
    await page.locator('[data-bulk-bar] select[aria-label="Assign selected to a heading"]').selectOption('__new')
    ok('3 · bulk: "+ New heading…" is in the menu and shows a name box with a counter', (await page.locator('[data-bulk-new-heading] input').count()) === 1 && /\d+ left/.test(await text('[data-bulk-new-heading]')))
    await page.locator('[data-bulk-new-heading] input').fill('Costs')
    await page.locator('[data-bulk-new-heading] button:has-text("Create and move 1")').click()
    await page.waitForSelector('[data-status-strip] >> text=heading “Costs” made')
    ok('…one step: the heading exists and #6 is on it', (await page.locator('section[aria-label="Costs"] li[data-action-id="a6"]').count()) === 1 && (await page.locator('[data-bulk-bar]').count()) === 0)

    // ── the re-read that fails is SAID
    section('B7 · a write whose re-read fails is said, not silent')
    await page.evaluate(() => { (window as never as { __h: { failReread: boolean } }).__h.failReread = true })
    await page.locator('select[aria-label="Heading for action 5"]').selectOption({ label: (await page.locator('select[aria-label="Heading for action 5"] option').allInnerTexts()).find((l) => /Costs/.test(l))! })
    await page.waitForSelector('[data-status-strip] [role=alert]')
    ok('the strip says "Saved, but the list could not be re-read…"', /Saved, but the list could not be re-read/.test(await text('[data-status-strip] [role=alert]')))
    ok('…and #5 is still shown under Practical (the screen is stale, and now it SAYS so)', (await page.locator('section[aria-label="Practical"] li[data-action-id="a5"]').count()) === 1)
    control('a failed re-read reported as a plain success (must be FALSE)', /^✓/.test(await text('[data-status-strip]')) && !/could not be re-read/.test(await text('[data-status-strip]')))
    await page.evaluate(() => { (window as never as { __h: { failReread: boolean } }).__h.failReread = false })

    // ── 190 · the find box and Hide all / Show all headings (CCh 18 Oct (5), UI items B and A)
    section('B7b · 190 UI B — the find box: title, statement and commentary; "n of m actions match"; one press clears it')
    const rowsShown = () => page.locator('li[data-action-id]').count()
    const live0 = await rowsShown()
    const box = page.locator('[data-find-box] input')
    ok('the find box is above the list and the count is not shown while it is empty', (await box.count()) === 1 && (await page.locator('[data-find-count]').count()) === 0)
    await box.fill('number 12')
    ok('typing filters the list LIVE by title: only #12 remains, and it reads "1 of N actions match"', (await rowsShown()) === 1 && (await page.locator('li[data-action-id="a12"]').count()) === 1 && new RegExp(`^1 of ${live0} actions match$`).test(await text('[data-find-count]')), `${await rowsShown()} / ${await text('[data-find-count]')}`)
    await box.fill('step 13')
    ok('…and by the STATEMENT ("Step 13")', (await rowsShown()) === 1 && (await page.locator('li[data-action-id="a13"]').count()) === 1)
    await box.fill('zebra crossing')
    ok('…and by the COMMENTARY: a word that appears only in #8\'s commentary finds #8', (await rowsShown()) === 1 && (await page.locator('li[data-action-id="a8"]').count()) === 1)
    control('the same word found in an action whose commentary does not say it (must be FALSE)', (await page.locator('li[data-action-id="a9"]').count()) === 1)
    await box.fill('zzzz nothing')
    ok('no match: zero rows and "0 of N actions match"', (await rowsShown()) === 0 && new RegExp(`^0 of ${live0} actions match$`).test(await text('[data-find-count]')))
    await page.locator('[data-find-clear]').click()
    ok('one press of Clear empties the box, removes the count and restores the whole list', (await box.inputValue()) === '' && (await page.locator('[data-find-count]').count()) === 0 && (await rowsShown()) === live0, `${await rowsShown()} vs ${live0}`)
    await box.fill('number 20'); await box.press('Escape')
    ok('Escape also clears it', (await box.inputValue()) === '' && (await rowsShown()) === live0)

    section('B7c · 190 UI A — "Hide all headings" / "Show all headings": one control beside Group')
    const hideBtn = page.locator('[data-hide-all-headings]')
    ok('the control reads "Hide all headings" while any heading shows, and sits in the toolbar with Group', (await hideBtn.count()) === 1 && /^Hide all headings$/.test((await hideBtn.innerText()).trim()) && (await page.locator('label:has-text("Group") >> xpath=..').first().locator('[data-hide-all-headings]').count()) === 1)
    await hideBtn.click()
    await page.waitForSelector('[data-status-strip] >> text=every heading is hidden')
    const hiddenAll = await h<boolean>(`window.__h.store.headings.every(x => x.hidden)`)
    ok('pressing it hides EVERY heading (the server holds hidden on all of them) and every group reads "Hidden — n actions not shown"', hiddenAll && (await page.locator('text=/Hidden — \\d+ actions? not shown/').count()) >= 3, String(hiddenAll))
    ok('…and the control now reads "Show all headings"', /^Show all headings$/.test((await hideBtn.innerText()).trim()))
    await hideBtn.click()
    await page.waitForSelector('[data-status-strip] >> text=every heading is shown')
    ok('pressing it again shows every heading, and the rows are back', (await h<boolean>(`window.__h.store.headings.every(x => !x.hidden)`)) && (await page.locator('text=/Hidden — \\d+ actions? not shown/').count()) === 0 && (await rowsShown()) === live0)
    await page.locator('[data-status-strip] button:has-text("OK")').click().catch(() => {})

    // ── 18 Oct (6) C · a heading's Hide/Show works on EVERY step and the state holds across steps
    section('B7d · 18 Oct (6) C — heading Hide/Show and Hide all work in steps 2, 3 and 4, and hold across steps')
    for (const step of [2, 3, 4]) {
      await page.evaluate((st) => { (window as never as { __h: { step: number } }).__h.step = st; (window as never as { __mount: (w: string) => void }).__mount('workspace') }, step)
      await page.waitForSelector('li[data-action-id], [data-heading-hide]')
      const hb = page.locator('section[aria-label="Legislation"] [data-heading-hide]')
      ok(`step ${step}: the heading row has its own Hide control, and Hide all sits in the top group`, (await hb.count()) === 1 && (await page.locator('[data-hide-all-headings]').count()) === 1)
      await hb.click()
      await page.waitForFunction(() => (window as never as { __h: { store: { headings: Array<{ hidden: boolean }> } } }).__h.store.headings[0].hidden === true)
      ok(`step ${step}: Hide hides the heading (the server holds it) and the row reads "Show"`, /^Show$/.test((await hb.innerText()).trim()))
      // the state belongs to the idea: the next step opens with the heading still hidden
      const next = step === 4 ? 2 : step + 1
      await page.evaluate((st) => { (window as never as { __h: { step: number } }).__h.step = st; (window as never as { __mount: (w: string) => void }).__mount('workspace') }, next)
      await page.waitForSelector('[data-heading-hide]')
      ok(`step ${step} → step ${next}: the heading is still hidden`, /^Show$/.test((await page.locator('section[aria-label="Legislation"] [data-heading-hide]').innerText()).trim()))
      await page.locator('section[aria-label="Legislation"] [data-heading-hide]').click()
      await page.waitForFunction(() => (window as never as { __h: { store: { headings: Array<{ hidden: boolean }> } } }).__h.store.headings[0].hidden === false)
      ok(`step ${next}: Show brings it back`, /^Hide$/.test((await page.locator('section[aria-label="Legislation"] [data-heading-hide]').innerText()).trim()))
      await page.locator('[data-hide-all-headings]').click()
      await page.waitForSelector('[data-status-strip] >> text=every heading is hidden')
      ok(`step ${next}: Hide all hides every heading`, await h<boolean>(`window.__h.store.headings.every(x => x.hidden)`))
      await page.locator('[data-hide-all-headings]').click()
      await page.waitForSelector('[data-status-strip] >> text=every heading is shown')
    }
    await page.evaluate(() => { (window as never as { __h: { step?: number } }).__h.step = undefined; (window as never as { __mount: (w: string) => void }).__mount('workspace') })
    await page.waitForSelector('li[data-action-id]')

    // ── 18 Oct (9) 1 · "Consolidate this heading" is on the heading's row WHETHER OR NOT the heading is shown
    section('B7f · 18 Oct (9) — "Consolidate this heading" renders on a hidden heading\'s row too; "Retire heading" replaces "Delete heading"')
    await page.evaluate(() => {
      const w = window as never as { __h: { store: { actions: Array<{ id: string; headingId: string | null }>; headings: Array<{ id: string; hidden: boolean }> } }; __mount: (s: string) => void }
      for (const a of (w.__h.store.actions as Array<{ id: string; headingId: string | null; status: string; parked: boolean }>).filter((x) => x.status === 'LIVE' && !x.parked).slice(0, 4)) a.headingId = 'h1'
      for (const hd of w.__h.store.headings) hd.hidden = true
      w.__mount('workspace')
    })
    await page.waitForSelector('[data-hide-all-headings]')
    const cons = page.locator('section[aria-label="Legislation"] [data-consolidate-button]')
    ok('every heading hidden: the heading holding actions still shows "Consolidate this heading" on its row', (await page.locator('text=/Hidden — \\d+ actions? not shown/').count()) >= 1 && (await cons.count()) === 1 && /Consolidate this heading/.test(await cons.innerText()), `in-section ${await cons.count()}; where ${await page.locator('[data-consolidate-button]').evaluateAll((e) => e.map((x) => x.closest('section')?.getAttribute('aria-label')).join('|'))}; hidden-notes ${await page.locator('text=/Hidden — \\d+ actions? not shown/').count()}; buttons ${await page.locator('[data-consolidate-button]').count()}; sections ${await page.locator('section[aria-label]').evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')).join('|'))}`)
    ok('…and the row reads Rename · colour · Show · Retire heading (not "Delete heading")', (await page.locator('section[aria-label="Legislation"] >> text=Retire heading').count()) >= 1 && (await page.locator('text=Delete heading').count()) === 0)
    control('the word "Delete heading" still on a row (must be FALSE)', (await page.locator('text=Delete heading').count()) > 0)
    await page.evaluate(() => {
      const w = window as never as { __h: { store: { actions: Array<{ id: string; headingId: string | null }>; headings: Array<{ hidden: boolean }> } }; __mount: (s: string) => void }
      for (const a of w.__h.store.actions) if (a.headingId === 'h1') a.headingId = null
      for (const hd of w.__h.store.headings) hd.hidden = false
      w.__mount('workspace')
    })
    await page.waitForSelector('li[data-action-id]')

    // ── 197 · the merge/compare panel's three one-press rule-outs
    section('B7e · 197 — "Keep #a, rule out #b" · "Keep #b, rule out #a" · "Rule out both": rule out (never delete), reason worded and editable, same strip')
    const storeRow = (n: number) => h<{ status: string; ruleOutReason: string | null } | null>(`(() => { const a = window.__h.store.actions.find(x => x.number === ${n}); return a ? { status: a.status, ruleOutReason: a.ruleOutReason } : null })()`)
    const openPair = async (x: number, y: number) => {
      await page.locator(`input[aria-label="Select action ${x}"]`).check()
      await page.locator(`input[aria-label="Select action ${y}"]`).check()
      await page.locator('button:has-text("Ask Lex to review and merge")').click()
      await page.waitForSelector('[data-pair-ruleout]')
    }
    const total0 = await h<number>(`window.__h.store.actions.length`)
    await openPair(26, 27)
    const btns = page.locator('[data-pair-ruleout] button')
    ok('the panel offers the three controls, worded with the numbers, beside the review', (await btns.count()) === 3 && (await btns.nth(0).innerText()) === 'Keep #26, rule out #27' && (await btns.nth(1).innerText()) === 'Keep #27, rule out #26' && (await btns.nth(2).innerText()) === 'Rule out both')
    await page.locator('[data-pair-ruleout-button="keepA"]').click()
    await page.waitForSelector('[data-status-strip] >> text=#27 ruled out')
    const r27 = await storeRow(27), r26 = await storeRow(26)
    ok('"Keep #26, rule out #27": #27 is ruled out with "Duplicate of #26"; #26 is untouched; the strip says "#27 ruled out"', r27?.status === 'RULED_OUT' && r27.ruleOutReason === 'Duplicate of #26' && r26?.status === 'LIVE', JSON.stringify([r26, r27]))
    ok('…and the panel has closed and the row has left the live list', (await page.locator('[data-pair-ruleout]').count()) === 0 && (await page.locator('li[data-action-id="a27"]').count()) === 0)
    await page.locator('[data-status-strip] button:has-text("OK")').click().catch(() => {})

    await openPair(28, 29)
    await page.locator('[data-pair-ruleout] input').fill('Same as the draft Act clause')
    await page.locator('[data-pair-ruleout-button="keepB"]').click()
    await page.waitForSelector('[data-status-strip] >> text=#28 ruled out')
    const r28 = await storeRow(28), r29 = await storeRow(29)
    ok('"Keep #29, rule out #28" with the reason EDITED first: #28 carries the edited words, #29 is untouched', r28?.status === 'RULED_OUT' && r28.ruleOutReason === 'Same as the draft Act clause' && r29?.status === 'LIVE', JSON.stringify([r28, r29]))
    await page.locator('[data-status-strip] button:has-text("OK")').click().catch(() => {})

    await openPair(30, 31)
    await page.locator('[data-pair-ruleout-button="both"]').click()
    await page.waitForSelector('[data-status-strip] >> text=#30 and #31 ruled out')
    const r30 = await storeRow(30), r31 = await storeRow(31)
    ok('"Rule out both": both are ruled out with "Neither needed"', r30?.status === 'RULED_OUT' && r31?.status === 'RULED_OUT' && r30.ruleOutReason === 'Neither needed' && r31.ruleOutReason === 'Neither needed')
    ok('NOTHING WAS DELETED: the store still holds every action it held (five now ruled out or kept, none removed)', (await h<number>(`window.__h.store.actions.length`)) === total0)
    await page.locator('[data-status-strip] button:has-text("OK")').click().catch(() => {})

    await openPair(32, 33)
    await page.evaluate(() => { (window as never as { __h: { rejectNext: unknown } }).__h.rejectNext = { status: 422, body: { ok: false, result: null, error: 'Those actions are no longer in the live list.' } } })
    await page.locator('[data-pair-ruleout-button="keepA"]').click()
    await page.waitForSelector('[data-status-strip] >> text=Not saved')
    const r33 = await storeRow(33)
    ok('a refusal reads "Not saved: …" in the strip, the panel stays open and nothing changed', /Not saved/.test(await text('[data-status-strip]')) && (await page.locator('[data-pair-ruleout]').count()) === 1 && r33?.status === 'LIVE')
    control('a refused rule-out that still ruled the action out (must be FALSE)', r33?.status === 'RULED_OUT')
    await page.locator('[data-status-strip] button:has-text("OK")').click().catch(() => {})

    // ── F · the feedback form
    section('B8 · F — the feedback form')
    await page.evaluate(() => (window as never as { __mount: (w: string) => void }).__mount('feedback'))
    await page.waitForSelector('select[aria-label="What is this about?"]')
    const sel = page.locator('select[aria-label="What is this about?"]')
    ok('the category opens on "Choose…" — not "The cost figures"', (await sel.inputValue()) === 'CHOOSE' && !/The cost figures/.test(await sel.evaluate((s: HTMLSelectElement) => s.selectedOptions[0].textContent ?? '')))
    await page.locator('textarea').fill('The heading did not save.')
    ok('"Show me what would be sent" is disabled until a category is chosen', await page.locator('button:has-text("Show me what would be sent")').isDisabled())
    await sel.selectOption('BUG_REPORT')
    ok('…and enabled once one is', await page.locator('button:has-text("Show me what would be sent")').isEnabled())
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' }))
      const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      document.querySelector('textarea')!.dispatchEvent(ev)
    })
    await page.waitForSelector('text=pasted-screenshot-1.png')
    ok('a screenshot pasted from the clipboard becomes an attachment in the list', (await page.locator('text=pasted-screenshot-1.png').count()) === 1)
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'plain words')
      document.querySelector('textarea')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    ok('control: a TEXT paste adds no attachment', (await page.locator('text=/pasted-screenshot-\\d/').count()) === 1)
    await page.locator('textarea').fill('y'.repeat(4100))
    ok('the 4000-character report box counts and says it cut', (await page.locator('textarea').inputValue()).length === 4000 && /Cut at 4000/.test(await page.locator('[role=dialog]').innerText()))

    ok('no uncaught page error in the whole run', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function partC() {
  section('C · database — the real functions, on a scratch copy of 452c5ade')
  const { prisma } = await import('../lib/prisma')
  const S = await import('../lib/lex/action-structure')
  const { scratchCopy, deleteScratch } = await import('./lib/scratch-copy')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' }, deletedAt: null }, select: { id: true } })
  if (!idea) { skip('the database section', 'idea 452c5ade is not in this database'); return }
  const copy = await scratchCopy('452c5ade', 'browser-26s')
  try {
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: copy.id, status: 'LIVE' }, orderBy: { orderIndex: 'asc' }, take: 4 })
    ok('the copy has live actions to move', live.length === 4, `${live.length}`)
    const r = await S.assignToNewHeading(copy.id, [live[0].id, live[1].id], 'Browser pass heading')
    ok('assignToNewHeading: heading made and 2 rows on it, one call', r.ok && (r as { data: { created: boolean; assigned: number } }).data.created && (r as { data: { assigned: number } }).data.assigned === 2)
    const hid = (r as { data: { headingId: string } }).data.headingId
    const onIt = await prisma.lexCoherentAction.count({ where: { ideaId: copy.id, headingId: hid } })
    ok('…read back: 2 rows carry the heading', onIt === 2, `${onIt}`)
    const again = await S.assignToNewHeading(copy.id, [live[2].id], 'browser PASS heading')
    ok('the same name (any case) reuses the heading, not a second one', again.ok && !(again as { data: { created: boolean } }).data.created && (await prisma.actionHeading.count({ where: { ideaId: copy.id } })) >= 1 && (again as { data: { headingId: string } }).data.headingId === hid)
    const none = await S.assignHeading(copy.id, ['no-such-action'], hid)
    ok('a move that moved NOTHING is a refusal in words, not a quiet success', !none.ok && /Nothing was changed/.test((none as { error: string }).error))
    control('a zero-row move reported as ok (must be FALSE)', none.ok)
    const long = 'p'.repeat(600)
    const p = await S.park(copy.id, [live[3].id], long)
    const parked = await prisma.lexCoherentAction.findUnique({ where: { id: live[3].id }, select: { parkedReason: true } })
    ok('a 600-character "Later phase" reason is kept whole (it was silently cut to 400)', p.ok && parked?.parkedReason?.length === 600, `${parked?.parkedReason?.length}`)
    const ro = await S.ruleOut(copy.id, [live[3].id], long)
    const ruled = await prisma.lexCoherentAction.findUnique({ where: { id: live[3].id }, select: { ruleOutReason: true, status: true } })
    ok('a 600-character rule-out reason is kept whole, read back', ro.ok && ruled?.ruleOutReason?.length === 600 && ruled.status === 'RULED_OUT')
  } finally { await deleteScratch(copy.id) }
  await prisma.$disconnect()
}

async function main() {
  partA()
  await partB()
  if (process.argv.includes('--db')) await partC(); else skip('C · the database section', 'pass --db to run it (writes to a scratch copy, then deletes it)')
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
