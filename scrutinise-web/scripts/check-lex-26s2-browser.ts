// ─────────────────────────────────────────────────────────────────────────────
// 26-S2 §9 — THE RESEARCH PANEL, CHECKED IN A BROWSER (decisions 171–173).
//
//   npx tsx --env-file=.env scripts/check-lex-26s2-browser.ts
//
// The REAL QuestionPanel, SourcesRegistry, AddResearch, FocusDialog and the document viewer run in Chromium against a stand-in server that keeps a store
// (scripts/fixtures/research-harness-entry.tsx). What is asserted is what Charlie saw go wrong: a document shown twice; a five-line caveat on every card; a
// form that did not look like a form (the next section down was taken for part of it, and the save was missed).
//
// Counts what RAN (§23.2). A browser check that cannot launch is NOT RUN and says so — never a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { ownDocumentCaveat, evidenceStanding } from '../lib/lex/evidence-date'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

function partA() {
  section('A · offline — the caveat, once and short; the long form kept for the Evidence Pack')
  const short = ownDocumentCaveat({ staleness: 'UNDATED', standing: 'ASSERTION' })
  ok('the card\'s caveat is the one line Charlie asked for, word for word', short === 'Your own document: undated, no figures — read as your testimony, not as evidence.', short)
  const long = evidenceStanding({ sourceDate: null, sourceDateBasis: 'NO_SOURCE_ROW', body: null, title: 'My report' }).label
  ok('…and the LONG form still exists, unchanged in kind, for the Evidence Pack (it names an assertion rather than evidence, at length)', long.length > short.length + 40 && /assertion rather than evidence/.test(long), long)
  control('the short line being the long one (must be FALSE)', short === long)
  ok('the Evidence Pack calls evidenceStanding itself (the long form), never the short caveat', /evidenceStanding\(/.test(read('lib/documents/build-evidence-pack.ts')) && !/ownDocumentCaveat/.test(read('lib/documents/build-evidence-pack.ts')))
  ok('the panel\'s own-document entries use the short caveat', /standingLabel: ownDocumentCaveat\(/.test(read('lib/lex/question-panel.ts')))
}

async function partB() {
  section('B · the browser — the Sources item, "+ Add research" as a dialog, the import as a dialog')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({
      entryPoints: [join(ROOT, 'scripts/fixtures/research-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'),
    })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  let css = ''
  try {
    const postcss = (await import('postcss')).default
    const tw = (await import('@tailwindcss/postcss')).default
    const src = ['QuestionPanel', 'SourcesRegistry', 'AddResearch', 'FocusDialog', 'YourMaterial', 'ActionImport'].map((c) => `@source "../components/lex/${c}.tsx";`).join(' ')
    const out = await postcss([tw()]).process(`@import 'tailwindcss'; ${src}`, { from: join(ROOT, 'scripts/_tw.css') })
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
    await page.evaluate(() => (window as never as { __mountResearch: (w: string) => void }).__mountResearch('panel'))
    await page.waitForSelector('text=Everything Lex found or worked out')
    const inner = async (sel: string) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ')

    // ── 9a · one list ──
    const contents = await inner('body')
    ok('the contents list has NO separate "Your material" row — the documents are folded into Sources', !/Your material/.test(contents) && /Sources/.test(contents), contents.slice(0, 500))
    ok('…and Sources counts the document (1)', /Sources\s*1/.test(contents) || /Sources 1/.test(contents), contents.slice(0, 600))
    control('a "Your material" row on the contents list (must be FALSE)', /Your material/.test(contents))
    ok('the contents home has "+ Add research" exactly once', (await page.locator('button:has-text("Add research")').count()) === 1)

    await page.locator('button:has(span:text-is("Sources"))').first().click()
    await page.waitForSelector('[data-sources-one-list]')
    const list = await inner('[data-sources-one-list]')
    ok('the Sources item has "+ Add research" exactly ONCE, above the list', (await page.locator('[data-sources-one-list] button:has-text("Add research")').count()) === 1 && (await page.locator('[data-sources-one-list] > *').first().innerText()).includes('Add research'))
    const titleHits = (list.match(/My own report on civil service accountability/g) ?? []).length
    ok('the document appears ONCE in the whole list (it used to appear twice: Sources and Your material)', titleHits === 1, `${titleHits} times`)
    const card = page.locator('li[data-source-number="1"]')
    ok('…as a numbered card [Ref: 1], carrying its status line', (await card.count()) === 1 && /\[Ref: 1\]/.test(await card.innerText()) && /Read — 2 findings/.test(await card.innerText()))
    const short = 'Your own document: undated, no figures — read as your testimony, not as evidence.'
    ok('9b: the caveat is the ONE short line, ONCE on the card', ((await card.innerText()).split(short).length - 1) === 1 && !/No retrievable source record/.test(await card.innerText()), (await card.innerText()).slice(0, 400))
    ok('…and the card gained Open, Add to report and Set aside; "Remove" is gone from a document', (await card.locator('button:has-text("Open")').count()) === 1 && (await card.locator('button:has-text("Add to report")').count()) === 1 && (await card.locator('button:has-text("Set aside")').count()) === 1 && (await card.locator('button:text-is("Remove")').count()) === 0)
    control('a document card that still says "Remove" (must be FALSE)', (await card.locator('button:text-is("Remove")').count()) > 0)

    // Open
    await card.locator('button:has-text("Open")').click()
    await page.waitForSelector('[role=dialog]')
    ok('Open shows the text Lex kept, in a viewer', /The kept text of the report/.test(await inner('[role=dialog]')) && /That is all of it: 68 characters/.test(await inner('[role=dialog]')))
    await page.locator('[role=dialog] button[aria-label="Close"]').click()
    ok('…and ✕ closes it', (await page.locator('[role=dialog]').count()) === 0)

    // Add to report
    await card.locator('button:has-text("Add to report")').click()
    await page.waitForSelector('li[data-source-number="1"] >> text=In the report')
    ok('Add to report records the decision (PRIORITY) and the card says "★ In the report" in words', /PRIORITY/.test(JSON.stringify(await page.evaluate(() => (window as never as { __r: { lastDecision: unknown } }).__r.lastDecision))) && /In the report/.test(await card.innerText()))
    await card.locator('button:has-text("Remove from report")').click()
    await page.waitForSelector('li[data-source-number="1"] button:has-text("Add to report")')

    // Set aside - with a reason, kept
    await card.locator('button:text-is("Set aside")').click()
    const confirm = card.locator('button:text-is("Set aside")').last()
    ok('Set aside asks for a reason first: its confirm button is disabled until one is typed', await confirm.isDisabled())
    await card.locator('input[aria-label="Why this document is set aside"]').fill('I have replaced it with the final version.')
    ok('…and enabled once there is one', await confirm.isEnabled())
    await confirm.click()
    await page.waitForSelector('li[data-source-number="1"] >> text=Set aside:')
    const dec = (await page.evaluate(() => (window as never as { __r: { lastDecision: { status: string; reason: string; sourceKey: string } } }).__r.lastDecision))
    ok('the decision sent is EXCLUDED with the reason, keyed by the document — and the card shows "Set aside: <reason>" with Put back', dec.status === 'EXCLUDED' && dec.reason === 'I have replaced it with the final version.' && dec.sourceKey === 'd1' && /Set aside: I have replaced it/.test(await card.innerText()) && (await card.locator('button:has-text("Put back")').count()) === 1, JSON.stringify(dec))
    await card.locator('button:has-text("Put back")').click()
    await page.waitForSelector('li[data-source-number="1"] button:has-text("Add to report")')
    ok('Put back undoes it (INCLUDED)', (await page.evaluate(() => (window as never as { __r: { lastDecision: { status: string } } }).__r.lastDecision.status)) === 'INCLUDED')

    // ── 9d · "+ Add research" is a focused dialog ──
    await page.locator('[data-sources-one-list] button:has-text("Add research")').click()
    await page.waitForSelector('[data-focus-dialog]')
    const dlg = page.locator('[data-focus-dialog]')
    const overlayAlpha = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('[data-focus-dialog-overlay]')!).backgroundColor; const slash = c.match(/\/\s*([\d.]+%?)\s*\)/); if (slash) return slash[1].endsWith('%') ? Number(slash[1].slice(0, -1)) / 100 : Number(slash[1]); const pct = c.match(/(\d+(?:\.\d+)?)%/); if (/color-mix/.test(c) && pct) return Number(pct[1]) / 100; const m = c.match(/rgba?\(([^)]+)\)/); return m ? Number(m[1].split(/[,\s]+/)[3] ?? 1) : 1 })
    ok('the rest of the page is DIMMED behind the dialog (an overlay, not a colour change in place) and nothing behind it scrolls', overlayAlpha >= 0.3 && overlayAlpha < 1 && (await page.evaluate(() => document.body.style.overflow)) === 'hidden', `alpha ${overlayAlpha}`)
    ok('"Choose a file" is a BUTTON, not a link-like file control', (await dlg.locator('button[data-choose-file]').count()) === 1 && (await dlg.locator('button[data-choose-file]').innerText()) === 'Choose a file')
    const legends = await dlg.locator('legend').allInnerTexts()
    ok('the fields are in order: 1 file / address / text · 2 the source · 3 the quote · 4 the comment (· 5 permission only when there is text)', legends.length >= 4 && /^1 ·/.test(legends[0]) && /^2 ·/.test(legends[1]) && /^3 ·.*optional/i.test(legends[2]) && /^4 ·.*optional/i.test(legends[3]), legends.join(' | '))
    ok('ONE Save, at the foot (inside the fixed foot, outside the scrolling body)', (await dlg.locator('button:text-is("Save")').count()) === 1 && (await dlg.locator('[data-focus-dialog-foot] button:text-is("Save")').count()) === 1)
    ok('"I may share this" is not there until there is text to keep — and when it is, it is NOT ticked', (await dlg.locator('text=I may share this').count()) === 0)
    await dlg.locator('textarea[placeholder^="Paste an article"]').fill('A pasted report: every department must publish the name of the owner of each target.')
    await dlg.locator('input[aria-label="Title"]').fill('A pasted report')
    ok('…once text is pasted the box appears, unticked (never defaulted)', (await dlg.locator('text=I may share this').count()) === 1 && !(await dlg.locator('input[type=checkbox]').first().isChecked()))
    await dlg.locator('button:text-is("Save")').click()
    await page.waitForSelector('[data-focus-dialog]', { state: 'detached' })
    ok('on Save the dialog CLOSES', (await page.locator('[data-focus-dialog]').count()) === 0)
    const saved = await page.evaluate(() => (window as never as { __r: { lastSave: { newSource: { rightsConfirmed: boolean; title: string } } } }).__r.lastSave)
    ok('…the save carried the title, and rightsConfirmed false (the user did not tick it, so it was not assumed)', saved.newSource.title === 'A pasted report' && saved.newSource.rightsConfirmed === false)
    await page.waitForSelector('li[data-source-number="3"]')
    const fresh = page.locator('li[data-source-number="3"]')
    ok('the new source card carries its NUMBER, [Ref: 3], and is HIGHLIGHTED (a word and a 2px border), in the list it joined', /\[Ref: 3\]/.test(await fresh.innerText()) && /Just added — this is \[Ref: 3\]/.test(await fresh.innerText()) && (await fresh.getAttribute('data-just-added')) === 'true' && /border-2/.test((await fresh.getAttribute('class')) ?? ''))
    control('the old card [Ref: 1] also carrying the "Just added" mark (must be FALSE)', /Just added/.test(await page.locator('li[data-source-number="1"]').innerText()))

    // Escape
    await page.locator('[data-sources-one-list] button:has-text("Add research")').click()
    await page.waitForSelector('[data-focus-dialog]')
    await page.keyboard.press('Escape')
    ok('Escape closes the dialog, and the page scrolls again', (await page.locator('[data-focus-dialog]').count()) === 0 && (await page.evaluate(() => document.body.style.overflow)) !== 'hidden')

    // ── the import is a dialog too ──
    await page.evaluate(() => (window as never as { __mountResearch: (w: string) => void }).__mountResearch('import'))
    await page.waitForSelector('button:has-text("Import actions from a document")')
    ok('on load the import does NOT throw a dialog over the page', (await page.locator('[data-focus-dialog]').count()) === 0)
    await page.locator('button:has-text("Import actions from a document")').click()
    await page.waitForSelector('[data-focus-dialog]')
    ok('"Import actions from a document" opens a focused dialog with its title', /Import actions from a document/.test(await inner('[data-focus-dialog]')) && (await page.locator('[data-focus-dialog-overlay]').count()) === 1)
    await page.keyboard.press('Escape')
    ok('…closed by Escape', (await page.locator('[data-focus-dialog]').count()) === 0)

    ok('no uncaught page error in the whole run', errors.length === 0, errors.join(' | ').slice(0, 400))
  } finally { await browser.close() }
}

async function main() {
  partA()
  await partB()
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch((e) => { console.error(e); process.exit(1) })
