// ─────────────────────────────────────────────────────────────────────────────
// check:lex-249-browser — decision 249 (CCh 23 Oct (9)): the left-hand panel's halves maximise and minimise; the typing box grows as typed
// to half the chat area and has a drag handle on its bottom edge; both remembered per browser; no colour alone.
//
// A · offline: the shared rules in lib/lex/lhp-layout.ts (the clamp, the stored-value parsing).
// B · the browser: the REAL ChatPanel in a 600px chat area and the REAL MaximiseToggle, in Chromium. Typing grows the box and stops at
//     300px; dragging the handle sets the resting height; a reload brings that height back. The toggle reads "Maximise ⤢" and then
//     "Minimise ⤡", with aria-pressed. Control: a box that kept the OLD 160px ceiling would fail the half-the-area assertion.
// C · source (labelled as such): CreateIdeaClient mounts a toggle on EACH half, hides the row divider while one is maximised, and Minimise
//     restores the equal split. That page is too large to mount here; Charlie's screen is the check of record (§9).
//
//   npx tsx --tsconfig tsconfig.json scripts/check-lex-249-browser.ts
// Counts what RAN (§23.2). A browser that cannot launch is NOT RUN, never a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import { inputHeight, parseMax, parsePx, INPUT_MIN_PX, EQUAL_SPLIT } from '../lib/lex/lhp-layout'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

function partA() {
  section('A · offline — the rules')
  ok('a long text grows the box only to half the chat area', inputHeight({ contentPx: 5000, chosenPx: null, chatAreaPx: 600 }) === 300)
  ok('an empty box sits at the user\'s chosen height', inputHeight({ contentPx: 0, chosenPx: 180, chatAreaPx: 600 }) === 180)
  ok('…and never below three lines', inputHeight({ contentPx: 0, chosenPx: 10, chatAreaPx: 600 }) === INPUT_MIN_PX)
  ok('a stored value that is not a number, or is too small, is ignored', parsePx('abc') === null && parsePx('5') === null && parsePx('200') === 200)
  ok('an unknown stored half reads as neither maximised', parseMax('sideways') === 'none' && parseMax(null) === 'none' && parseMax('chat') === 'chat')
  ok('Minimise restores an EQUAL split', EQUAL_SPLIT === 0.5)
}

async function partB() {
  section('B · the browser — the real ChatPanel and MaximiseToggle')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({
      entryPoints: [join(ROOT, 'scripts/fixtures/lhp-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'),
    })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    // A real origin, so localStorage exists and survives a reload.
    // ⚠ The harness has no Tailwind, and "half the chat area" is measured from the panel's own height, so the few layout utilities that
    // give ChatPanel its height in the product are given here too. Without them the panel is only as tall as its content.
    const LAYOUT = '*,::before,::after{box-sizing:border-box}.h-full{height:100%}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1 1 0%}.min-h-0{min-height:0}.overflow-y-auto{overflow-y:auto}.w-full{width:100%}'
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>${LAYOUT}</style></head><body style="margin:0"><div id="root"></div></body></html>` }))
    await page.route('http://harness.test/bundle.js', (r) => r.fulfill({ contentType: 'text/javascript', body: bundle }))
    const load = async () => { await page.goto('http://harness.test/'); await page.addScriptTag({ url: 'http://harness.test/bundle.js' }); await page.locator('[data-chat-input]').waitFor() }
    await load()
    const box = page.locator('[data-chat-input]')
    const h = async () => Math.round((await box.boundingBox())!.height)

    const start = await h()
    ok('the empty box opens at three lines or more', start >= INPUT_MIN_PX, `${start}px`)
    await box.fill(Array.from({ length: 8 }, (_, i) => `line ${i + 1}`).join('\n'))
    const mid = await h()
    ok('typing several lines grows the box', mid > start, `${start} → ${mid}px`)
    await box.fill(Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n'))
    const tall = await h()
    ok('a long text grows it to half the 600px chat area and no further', tall === 300, `${tall}px`)
    control('the box stopping at the OLD 160px ceiling (must be FALSE)', tall === 160)
    await box.fill('')
    await page.locator('textarea[data-chat-input]').dispatchEvent('input')

    const handle = page.locator('[data-chat-input-handle]')
    ok('the box has a drag handle on its bottom edge, named in words', (await handle.getAttribute('aria-label'))?.includes('Drag') === true)
    const hb = (await handle.boundingBox())!, bb = (await box.boundingBox())!
    ok('…directly beneath the box', Math.abs(hb.y - (bb.y + bb.height)) <= 6, `handle y ${Math.round(hb.y)}, box bottom ${Math.round(bb.y + bb.height)}`)
    const under = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-chat-input-handle]'), [hb.x + hb.width / 2, hb.y + hb.height / 2])
    ok('…and the handle is what the pointer finds there (it has a real size, not 0px)', under && hb.height >= 8, `height ${hb.height}`)
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 80, { steps: 5 })
    await page.mouse.up()
    const dragged = await h()
    ok('dragging the handle down makes the box taller', dragged >= start + 60, `${start} → ${dragged}px`)
    const stored = await page.evaluate(() => localStorage.getItem('scrutinise.chat.inputPx'))
    ok('the chosen height is remembered in this browser', stored === String(dragged), `stored ${stored}`)
    await load()
    const after = await h()
    ok('after a reload the box comes back at the chosen height', Math.abs(after - dragged) <= 2, `${dragged} → ${after}px`)

    const t = page.locator('#toggle button')
    const t0 = { text: await t.innerText(), pressed: await t.getAttribute('aria-pressed') }
    ok('the toggle reads "Maximise ⤢", not pressed', t0.text === 'Maximise ⤢' && t0.pressed === 'false', JSON.stringify(t0))
    await t.click()
    const t1 = { text: await t.innerText(), pressed: await t.getAttribute('aria-pressed') }
    ok('pressed, it reads "Minimise ⤡" — a different word AND glyph, and aria-pressed', t1.text === 'Minimise ⤡' && t1.pressed === 'true', JSON.stringify(t1))
    ok('no page errors', errors.length === 0, errors.join(' | '))
  } finally { await browser.close() }
}

function partC() {
  section('C · source (not rendered here) — CreateIdeaClient wires both halves')
  const src = readFileSync(join(ROOT, 'app/ideas/create/CreateIdeaClient.tsx'), 'utf8')
  ok('a toggle on the worklist half', /<MaximiseToggle half="the worklist"/.test(src))
  ok('a toggle on the chat half', /<MaximiseToggle half="the chat"/.test(src))
  ok('the row divider shows only when neither half is maximised', /ideaId && lhpMax === 'none' && \(\s*<RowDivider/.test(src))
  ok('Minimise (back to none) restores the equal split', /if \(m === 'none'\) setWorklistFraction\(EQUAL_SPLIT\)/.test(src))
  ok('which half is maximised is remembered in this browser', /writeStored\(LHP_KEYS\.max/.test(src) && /parseMax\(readStored\(LHP_KEYS\.max\)\)/.test(src))
}

async function main() {
  partA()
  await partB()
  partC()
  console.log(`\ncheck:lex-249-browser — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main()
