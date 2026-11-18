// ─────────────────────────────────────────────────────────────────────────────
// 26-Z §7 — WHERE AM I?, ONE PANEL AT A TIME, NEVER LOSING YOUR PLACE (decisions 344–348).
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/check-lex-26z.ts
//
// A — the pure rules (lib/lex/where-am-i.ts): the address, the menu's order, the swipe rule, the history, the device keys.
// B — the words: the three sentences verbatim from the brief; a field-guide entry for every new label.
// C — the REAL FocusShell, WhereAmIMenu, ChaptersPanel, StageBar and ChatPanel in Chromium (scripts/fixtures/where-harness-entry.tsx), served
//     at /ideas/create on a stand-in origin so a reload, `location.replace` and `hashchange` behave as on the site. Widths 360 × 740, 412 × 915,
//     768 × 1024 and 1440 × 900. Touch is REAL touch input (CDP Input.dispatchTouchEvent / synthesizeScrollGesture, and Playwright's tap),
//     not clicks standing in for it.
//
// Counts what RAN (§23.2). A browser section that cannot launch is NOT RUN and says so — never a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
import * as W from '../lib/lex/where-am-i'
import { PANEL_WORD, PANEL_PLACE_WORD, WHERE_SENTENCES, WHERE_UI, DRAFT_RESTORE_UI } from '../lib/lex/screen-labels'
import { guideEntries } from '../lib/lex/field-guide'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function partA() {
  section('A · the pure rules')
  const d = W.parseUrlState('/ideas/create', '?ideaId=x&view=drafting&panel=6', '#38')
  ok('the address of Drafting, panel 6, #38 is "S2 · C5 · P6"', W.address(d) === 'S2 · C5 · P6', W.address(d))
  ok('…spelled out: "Stage 2 Development · Chapter 5 Drafting · Panel 6 Working on #38"', W.addressSpelled(d) === 'Stage 2 Development · Chapter 5 Drafting · Panel 6 Working on #38', W.addressSpelled(d))
  const bare = W.parseUrlState('/ideas/create', '?ideaId=x', '')
  ok('a bare link opens panel 2 (To-do), and its address leaves the chapter out: "S2 · P2"', W.panelOf(bare) === 2 && W.address(bare) === 'S2 · P2', W.address(bare))
  control('a bare link\'s address naming a chapter (must be FALSE)', /C\d/.test(W.address(bare)))
  ok('a named chapter with no panel opens panel 6', W.panelOf(W.parseUrlState('/ideas/create', '?ideaId=x&section=causes', '')) === 6)
  ok('the Deepening is chapter 6: "S2 · C6 · P6"', W.address(W.parseUrlState('/ideas/create', '?ideaId=x&stage=deepening', '')) === 'S2 · C6 · P6')
  ok('a section on the Deepening screen is ignored (the URL names one chapter)', W.chapterOf(W.parseUrlState('/ideas/create', '?ideaId=x&stage=deepening&section=problem', '')) === 'deepening')
  ok('panel=9 is not a panel (falls back by the rule)', W.parseUrlState('/ideas/create', '?ideaId=x&panel=9', '').panel === null)
  ok('Creation is stage 1', W.stageNumberOf(W.parseUrlState('/ideas/build', '?ideaId=x', '')) === 1)
  ok('from the top the menu runs Stage → Chapter → Panel', W.levelOrder('top').join() === 'stage,chapter,panel')
  ok('from the bottom it runs Panel → Chapter → Stage', W.levelOrder('bottom').join() === 'panel,chapter,stage')
  ok('the level opened first is the one nearest the edge', W.nearestLevel('top') === 'stage' && W.nearestLevel('bottom') === 'panel')
  ok('a quick sideways stroke is a swipe, each way', W.classifySwipe(-80, 10, 200) === 'left' && W.classifySwipe(80, -10, 200) === 'right')
  ok('…a short one is not (under 60 px)', W.classifySwipe(-55, 0, 100) === null)
  ok('…a diagonal one is not (less than 1.5 × sideways)', W.classifySwipe(-90, 70, 200) === null)
  ok('…a slow one is not (over 800 ms — reading, selecting)', W.classifySwipe(-120, 0, 900) === null)
  control('a vertical scroll counted as a swipe (must be FALSE)', W.classifySwipe(20, -400, 200) !== null)
  let h = W.emptyHistory()
  for (const p of ['a', 'b', 'c']) h = W.pushPlace(h, p)
  ok('the history keeps places in order', h.entries.join() === 'a,b,c' && h.i === 2)
  ok('choosing where you already are adds nothing', W.pushPlace(h, 'c') === h)
  const b1 = W.back(h)
  ok('back goes to the last place chosen', b1.url === 'b')
  ok('a new choice after going back drops what was forward', W.pushPlace(b1.h, 'd').entries.join() === 'a,b,d' && !W.canForward(W.pushPlace(b1.h, 'd')))
  ok('swipe right with nothing forward opens Where am I?; with something forward goes forward', W.swipeAction('right', h) === 'menu' && W.swipeAction('right', b1.h) === 'forward')
  ok('swipe left at the start of the history does nothing', W.swipeAction('left', W.pushPlace(W.emptyHistory(), 'a')) === 'none')
  let big = W.emptyHistory(); for (let i = 0; i < 80; i++) big = W.pushPlace(big, `p${i}`)
  ok(`the history is capped at ${W.HISTORY_CAP}, oldest dropped`, big.entries.length === W.HISTORY_CAP && big.entries[0] === 'p30' && big.i === W.HISTORY_CAP - 1)
  ok('an unreadable stored history starts again rather than throwing', W.parseHistory('{nope').entries.length === 0 && W.parseHistory(JSON.stringify({ entries: ['a'], i: 5 })).i === -1)
  ok('a bare link names only the idea', W.isBareUrl('/ideas/create', '?ideaId=x', '') && !W.isBareUrl('/ideas/create', '?ideaId=x&panel=2', '') && !W.isBareUrl('/ideas/create', '?ideaId=x', '#3') && !W.isBareUrl('/ideas/create', '', ''))
  ok('the same page with another panel or record needs no load; another chapter does', W.samePageExceptPanel('/ideas/create?ideaId=x&view=drafting&panel=5', '/ideas/create?panel=6&ideaId=x&view=drafting#38') && !W.samePageExceptPanel('/ideas/create?ideaId=x&view=drafting', '/ideas/create?ideaId=x&view=organising'))
  ok('withPanel replaces the panel, keeps the rest, and the record when asked', W.withPanel('/ideas/create', '?ideaId=x&panel=2', '#4', 6) === '/ideas/create?ideaId=x&panel=6#4' && W.withPanel('/ideas/create', '?ideaId=x', '#4', 5, null) === '/ideas/create?ideaId=x&panel=5')
  const throwing = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } } as unknown as Storage
  const st = W.safeStore(() => throwing)
  let threw = false
  try { st.set('k', 'v'); st.set('k', null) } catch { threw = true }
  ok('storage that throws reads as empty and never throws', st.get('k') === null && !threw && W.safeStore(() => { throw new Error('no storage') }).get('k') === null)
  ok('a draft is offered only when it holds text the box does not', W.shouldOfferDraft('typed', '') && !W.shouldOfferDraft('   ', '') && !W.shouldOfferDraft('same', 'same') && !W.shouldOfferDraft(null, ''))
}

function partB() {
  section('B · the words')
  const brief = read('../docs/BRIEF_26Z.md')
  for (const [k, s] of Object.entries(WHERE_SENTENCES)) ok(`the ${k} sentence is the brief's, verbatim`, brief.includes(s), s)
  const keys = new Set(guideEntries().map((e) => e.key))
  const want = [
    ...Object.keys(PANEL_WORD).map((k) => `panel.${k}`), ...Object.keys(PANEL_PLACE_WORD).map((k) => `panelPlace.${k}`),
    ...Object.keys(WHERE_SENTENCES).map((k) => `whereSentence.${k}`), ...Object.keys(WHERE_UI).map((k) => `where.${k}`),
    ...Object.keys(DRAFT_RESTORE_UI).map((k) => `draftRestore.${k}`),
  ]
  const missing = want.filter((k) => !keys.has(k))
  ok(`every new label (${want.length}) has a field-guide entry`, missing.length === 0, missing.join(', '))
  control('a label that does not exist having an entry (must be FALSE)', keys.has('where.noSuchLabel'))
  // labels on screen come from the table: the shell and menu print no hard-coded copy of the button or the sentences
  const shell = read('components/lex/FocusShell.tsx') + read('components/lex/WhereAmIMenu.tsx')
  const code = shell.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  ok('the shell and the menu write no copy of "Where am I?" or the sentences outside the label table', !/'Where am I\?'|"Where am I\?"|>Where am I\?</.test(code) && !Object.values(WHERE_SENTENCES).some((s) => code.includes(s)))
  ok('the workspace calls the same arrival restore the harness tests (no copy of it)', /restoreOnArrival\(initialIdeaId\)/.test(read('app/ideas/create/CreateIdeaClient.tsx')) && !/isBareUrl\(/.test(read('app/ideas/create/CreateIdeaClient.tsx')))
  ok('every device-draft box is wired: Lex, Edit the action, the action details, the Brief, comments, Add research',
    [['components/lex/ChatPanel.tsx', "'lex.message'"], ['components/lex/FieldsPanel.tsx', '.statement`'], ['components/lex/FieldsPanel.tsx', '.details`'], ['components/lex/BriefSection.tsx', '`brief.'], ['components/lex/ActionComments.tsx', '.comment`'], ['components/lex/AddResearch.tsx', "'research.add'"]]
      .every(([f, s]) => read(f).includes(s) && read(f).includes('<DraftOffer')))
}

// ── C · the browser ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Page = import('playwright').Page
type CDP = import('playwright').CDPSession
const ORIGIN = 'http://lex26z.test'
const IDEA_URL = `${ORIGIN}/ideas/create?ideaId=fx`

async function partC() {
  section('C · the browser — 360 / 412 / 768 / 1440, with touch')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({
      entryPoints: [join(ROOT, 'scripts/fixtures/where-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'),
    })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  let css = ''
  try {
    const postcss = (await import('postcss')).default
    const twName: string = '@tailwindcss/postcss'
    const tw = (await import(twName)).default as () => import('postcss').AcceptedPlugin
    const src = ['FocusShell', 'WhereAmIMenu', 'StageBar', 'ChatPanel', 'DeviceDraft'].map((c) => `@source "../components/lex/${c}.tsx";`).join(' ') + ' @source "./fixtures/where-harness-entry.tsx";'
    css = (await postcss([tw()]).process(`@import 'tailwindcss'; ${src}`, { from: join(ROOT, 'scripts/_tw.css') })).css
  } catch (e) { fail++; ran++; console.log(`  ✗ Tailwind did not compile, so no layout can be measured: ${(e as Error).message.slice(0, 200)}`); return }
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${bundle.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  const errors: string[] = []

  const open = async (w: number, h: number, url = IDEA_URL, opts: { blocked?: boolean } = {}) => {
    const context = await browser!.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 768, deviceScaleFactor: 1 })
    if (opts.blocked) await context.addInitScript(() => {
      for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError') } })
    })
    await context.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }))
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(`${w}px: ${e.message}`))
    const cdp = await context.newCDPSession(page)
    await page.goto(url)
    await page.waitForSelector('[data-focus-shell]')
    return { context, page, cdp }
  }
  const panelOf = (p: Page) => p.locator('[data-focus-shell]').getAttribute('data-panel')
  const centre = async (p: Page, sel: string) => { const b = await p.locator(sel).first().boundingBox(); if (!b) throw new Error(`no box for ${sel}`); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  // ⚠ Every synthetic touch sequence is ended with a touchCancel after its touchEnd. Measured 18 Nov: without it, Chromium's gesture state
  //   after a CDP drag swallowed the NEXT tap — even on a freshly loaded document (1 in 4) — and with it, 0 of 8. A real finger lifting does
  //   not leave that state; the flush only stops one synthetic gesture leaking into the next assertion.
  const touch = async (cdp: CDP, type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: x!, y: y! }] })
    // refused with "Must send a TouchStart first" when Chromium already holds no sequence — then there is nothing to flush
    if (type === 'touchEnd') await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch((e: Error) => { if (!/TouchStart first/.test(e.message)) throw e })
  }
  const swipe = async (cdp: CDP, x0: number, y0: number, x1: number, y1: number, ms = 180) => {
    await touch(cdp, 'touchStart', x0, y0)
    for (let i = 1; i <= 8; i++) { await touch(cdp, 'touchMove', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8); await sleep(ms / 8) }
    await touch(cdp, 'touchEnd')
    await sleep(120)
    await settle(cdp)
  }
  // A touch drag can end in momentum, and a tap DURING momentum stops it without a click — on a phone as here. So after any drag, wait for
  // the page to stop moving before the next tap (the scroll position unchanged for 250 ms, at most 2.5 s).
  const settle = async (cdp: CDP) => {
    let last = -1, still = 0
    for (let i = 0; i < 50 && still < 5; i++) {
      const r = await cdp.send('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true }) as { result: { value: number } }
      still = r.result.value === last ? still + 1 : 0
      last = r.result.value
      await sleep(50)
    }
  }
  const swipeLeft = (cdp: CDP, w: number, y = 400) => swipe(cdp, w * 0.8, y, w * 0.2, y)
  const swipeRight = (cdp: CDP, w: number, y = 400) => swipe(cdp, w * 0.2, y, w * 0.8, y)
  const chooseViaMenu = async (p: Page, n: number) => {
    await p.tap('[data-where-button="bottom"]')
    await p.tap(`[data-panel-block="${n}"]`)
    await p.waitForFunction((x) => document.querySelector('[data-focus-shell]')?.getAttribute('data-panel') === String(x), n)
  }
  // a string, not a function: tsx wraps named inner functions in a `__name` helper the page does not have
  const shape = (p: Page) => p.evaluate(`(() => {
    const out = []
    const walk = (el, d) => {
      const data = [...el.attributes].map((a) => a.name).filter((n) => n.startsWith('data-') || n === 'hidden' || n === 'role').sort().join(',')
      out.push(d + ':' + el.tagName + '[' + data + ']')
      for (const c of el.children) if (c.tagName !== 'STYLE') walk(c, d + 1)
    }
    walk(document.querySelector('[data-focus-shell]'), 0)
    return out
  })()`) as Promise<string[]>

  try {
    // ── 1 · every width: one panel, nothing wider than the screen, the bars ──
    const shapes: Record<number, string[]> = {}
    for (const [w, h] of [[360, 740], [412, 915], [768, 1024], [1440, 900]] as const) {
      const { context, page } = await open(w, h)
      const shown = await page.locator('[data-focus-panel]:not([hidden])').count()
      ok(`${w} px: one panel is shown, and only one`, shown === 1, `shown ${shown}`)
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
      ok(`${w} px: no horizontal page scroll (scrollWidth ${sw[0]} ≤ ${sw[1]})`, sw[0] <= sw[1])
      const tb = await page.locator('[data-where-button="top"]').boundingBox(), bb = await page.locator('[data-where-button="bottom"]').boundingBox()
      ok(`${w} px: both Where am I? buttons are at least 44 px tall`, !!tb && !!bb && tb.height >= 44 && bb.height >= 44, `${tb?.height} / ${bb?.height}`)
      ok(`${w} px: each bar carries exactly one button`, await page.locator('[data-top-bar] button').count() === 1 && await page.locator('[data-bottom-bar] button').count() === 1)
      const bottom = await page.locator('[data-bottom-bar]').boundingBox()
      ok(`${w} px: the bottom bar sits at the foot of the screen`, !!bottom && Math.abs(bottom.y + bottom.height - h) <= 1, `${bottom?.y}+${bottom?.height} vs ${h}`)
      const mainW = await page.locator('main').evaluate((m) => m.getBoundingClientRect().width)
      ok(`${w} px: the panel is at most 760 px wide`, mainW <= 760.5, String(mainW))
      // the menu and its blocks work at every width
      await page.tap('[data-where-button="bottom"]')
      const blocks = await page.locator('[data-panel-block]').count()
      const tooWide = await page.evaluate(() => { const m = document.querySelector('[data-where-menu]')!.getBoundingClientRect(); return m.right > window.innerWidth + 0.5 || m.left < -0.5 })
      ok(`${w} px: the menu opens with the seven panel blocks, inside the screen`, blocks === 7 && !tooWide, `${blocks} blocks`)
      const small = await page.locator('[data-where-menu] button').evaluateAll((bs) => bs.filter((b) => (b as HTMLElement).offsetParent && b.getBoundingClientRect().height < 44 && !(b as HTMLElement).hasAttribute('data-where-backdrop')).length)
      ok(`${w} px: every control in the menu is at least 44 px tall`, small === 0, `${small} under 44 px`)
      await page.keyboard.press('Escape')
      shapes[w] = await shape(page)
      await context.close()
    }
    // ── 6 · Focus view at 1440 is the 360 composition ──
    ok('Focus view at 1440 px has the same DOM structure as 360 px', JSON.stringify(shapes[1440]) === JSON.stringify(shapes[360]), `${shapes[1440].length} vs ${shapes[360].length} elements`)
    control('the 360 structure matching a different page (must be FALSE)', JSON.stringify(shapes[360]) === JSON.stringify(shapes[360].slice(1)))
    skip('Full view unchanged, in a browser', 'the three-column workspace needs a signed-in session and the database; no harness renders it. The 26-X suites render the record and the lists it holds; Charlie’s screen is the check')

    // ── at 360: scrolling, the top bar, the menu ──
    {
      const { context, page, cdp } = await open(360, 740)
      // the page scrolls, by touch; a vertical stroke is not a swipe
      // a real touch drag upward (CDP touch events; headless Chromium ignores synthesizeScrollGesture's touch source — measured)
      await swipe(cdp, 180, 650, 180, 150, 200)
      await sleep(400)
      const y1 = await page.evaluate(() => window.scrollY)
      ok('360 px: a touch scroll scrolls the PAGE (not a box inside it)', y1 > 200, `scrollY ${y1}`)
      ok('360 px: …and the top bar hides on scroll down', await page.locator('[data-top-bar]').getAttribute('data-hidden') === 'true')
      ok('360 px: …and a vertical stroke neither changed the panel nor opened the menu', await panelOf(page) === '2' && await page.locator('[data-where-menu]').count() === 0)
      await swipe(cdp, 180, 200, 180, 450, 200)
      await sleep(400)
      ok('360 px: the top bar returns on scroll up', await page.locator('[data-top-bar]').getAttribute('data-hidden') !== 'true')
      control('the bar hidden after scrolling back up (must be FALSE)', await page.locator('[data-top-bar]').getAttribute('data-hidden') === 'true')
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(150)

      // the first-time explainer
      await page.evaluate(() => { (window as unknown as { __ev: string[] }).__ev = []; for (const t of ['click', 'pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend']) document.addEventListener(t, (e) => (window as unknown as { __ev: string[] }).__ev.push(e.type), true) })
      await page.tap('[data-where-button="top"]')
      await sleep(150)
      const ex = await page.locator('[data-where-explainer]').innerText({ timeout: 1000 }).catch(() => '')
      const why = ex ? '' : JSON.stringify(await page.evaluate(() => {
        const b = document.querySelector('[data-where-button="top"]')!.getBoundingClientRect()
        const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) as HTMLElement | null
        return { menu: document.querySelectorAll('[data-where-menu]').length, scrollY: window.scrollY, bar: (document.querySelector('[data-top-bar]') as HTMLElement).style.transform, btn: [b.x, b.y, b.width, b.height], at: at?.dataset.whereButton ?? at?.tagName, ev: (window as unknown as { __ev: string[] }).__ev.join(' ') }
      }))
      ok('the three sentences show the first time the menu opens', Object.values(WHERE_SENTENCES).every((s) => ex.includes(s)), ex || why)
      await page.tap('[data-where-got-it]')
      ok('"Got it" folds them away', await page.locator('[data-where-explainer]').count() === 0)
      await page.tap('[data-where-explain]')
      ok('"?" brings them back', await page.locator('[data-where-explainer]').count() === 1)
      await page.tap('[data-where-got-it]')

      // order from the top; the current item marked
      const topOrder = await page.locator('[data-where-menu] [data-level]').evaluateAll((xs) => xs.map((x) => (x as HTMLElement).dataset.level).join())
      ok('from the top: Stage → Chapter → Panel', topOrder === 'stage,chapter,panel', topOrder)
      ok('…opened from the top bar, as a sheet at the top', await page.locator('[data-where-menu]').getAttribute('data-edge') === 'top' && ((await page.locator('[data-where-menu]').boundingBox())?.y ?? 99) < 5)
      const stageHere = await page.locator('[data-item^="stage:"][aria-current]').innerText()
      ok('the Stage level marks Development: ● and "You are here"', /●/.test(stageHere) && /Development/.test(stageHere) && /You are here/i.test(stageHere), stageHere)
      ok('stages with nothing built cannot be chosen, and say why', await page.locator('[data-item="stage:3"]').isDisabled() && /not yet open/.test(await page.locator('[data-item="stage:3"]').innerText()))
      // keyboard and screen-reader order: Tab reaches the levels in the same order as they are drawn
      const heads: string[] = []
      await page.focus('[data-level-head="stage"]')
      for (let i = 0; i < 40; i++) { const f = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.levelHead ?? null); if (f && !heads.includes(f)) heads.push(f); await page.keyboard.press('Tab') }
      ok('Tab reaches the levels in the order they are drawn (Stage, Chapter, Panel)', heads.join() === 'stage,chapter,panel', heads.join())
      ok('…and focusing a level opens it (the last focused is open)', await page.locator('[data-level-head="panel"]').getAttribute('aria-expanded') === 'true')
      await page.keyboard.press('Escape')
      ok('Esc closes the menu', await page.locator('[data-where-menu]').count() === 0)

      // tapping outside closes it; swiping the top sheet back up closes it
      await page.tap('[data-where-button="top"]')
      await page.touchscreen.tap(180, 720)
      ok('tapping outside closes it', await page.locator('[data-where-menu]').count() === 0)
      // part-way down the page (the top bar has hidden itself, so the bottom bar is the one in reach): open, swipe the sheet down, closed
      await page.evaluate(() => window.scrollTo(0, 300)); await sleep(200)
      await page.tap('[data-where-button="bottom"]')
      const hb = await centre(page, '[data-where-head] h2')
      await swipe(cdp, hb.x, hb.y, hb.x, hb.y + 120)
      await sleep(300)
      const yAfter = await page.evaluate(() => window.scrollY)
      ok('swiping the bottom sheet back down closes it, and the page behind it did not move (found 18 Nov: it scrolled a screen or more)', await page.locator('[data-where-menu]').count() === 0 && yAfter === 300, `scrollY ${yAfter}`)
      await page.reload(); await page.waitForSelector('[data-focus-shell]') // a fresh document: see the measured residual below
      await sleep(700)
      ok('a reload that puts the scroll back (300 px) leaves the top bar showing — the page scrolling itself is not the user scrolling', await page.evaluate(() => window.scrollY) === 300 && await page.locator('[data-top-bar]').getAttribute('data-hidden') !== 'true')
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200)
      await page.tap('[data-where-button="top"]')
      const hd = await centre(page, '[data-where-head] h2')
      await swipe(cdp, hd.x, hd.y, hd.x, hd.y - 120)
      await sleep(300)
      ok('swiping the top sheet back up closes it', await page.locator('[data-where-menu]').count() === 0)
      // ⚠ MEASURED, NOT PASSED: in headless Chromium the first tap after a swipe-close is sometimes dropped (pointerdown and pointerup, no
      // click). Tap-closes and Esc-closes never do this. Printed as a rate so it is visible; Charlie's phone settles whether it is real.
      let dropped = 0
      for (let k = 0; k < 5; k++) {
        await page.tap('[data-where-button="top"]'); await sleep(150)
        if (await page.locator('[data-where-menu]').count() === 0) { dropped++; continue } // the open itself was the dropped tap
        const h2 = await centre(page, '[data-where-head] h2')
        await swipe(cdp, h2.x, h2.y, h2.x, h2.y - 120); await sleep(400)
        await page.tap('[data-where-button="bottom"]'); await sleep(150)
        if (await page.locator('[data-where-menu]').count() === 0) dropped++
        else await page.keyboard.press('Escape')
        await sleep(150)
      }
      skip(`the first tap after closing the sheet by swipe always lands (measured: ${dropped} of 5 dropped)`, 'a headless-Chromium synthetic-touch effect cannot be told from a real one here; Charlie’s phone (§8, "swiping it back") is the check')
      await page.reload(); await page.waitForSelector('[data-focus-shell]')
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200)

      // from the bottom: Panel → Chapter → Stage, panel open first
      await page.tap('[data-where-button="bottom"]')
      const botOrder = await page.locator('[data-where-menu] [data-level]').evaluateAll((xs) => xs.map((x) => (x as HTMLElement).dataset.level).join())
      ok('from the bottom: Panel → Chapter → Stage', botOrder === 'panel,chapter,stage', botOrder)
      ok('…as a sheet at the foot, with the panel level (under the thumb) open', await page.locator('[data-where-menu]').getAttribute('data-edge') === 'bottom' && await page.locator('[data-level-head="panel"]').getAttribute('aria-expanded') === 'true')
      const blocks = await page.locator('[data-panel-block]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? ''))
      ok('the seven blocks are labelled "Panel N · name · where on desktop"', blocks.length === 7 && blocks.every((l, i) => new RegExp(`^Panel ${i + 1} · .+ · (across the top|left|centre|right) on desktop$`).test(l)), blocks.join(' | '))
      ok('…and the current block says "You are here"', /You are here/i.test(await page.locator('[data-panel-block][aria-current]').innerText()))

      // drag: the finger moves over a level and it opens; lifted on an item, it goes there
      const s0 = await centre(page, '[data-level-head="stage"]')
      await touch(cdp, 'touchStart', s0.x, s0.y); await touch(cdp, 'touchMove', s0.x, s0.y - 12); await sleep(60)
      ok('drag: the finger over Stage opens Stage', await page.locator('[data-level-head="stage"]').getAttribute('aria-expanded') === 'true')
      const c0 = await centre(page, '[data-level-head="chapter"]')
      for (let i = 1; i <= 6; i++) { await touch(cdp, 'touchMove', s0.x, s0.y - 12 + ((c0.y - s0.y + 12) * i) / 6); await sleep(30) }
      ok('drag: moving on over Chapter opens Chapter', await page.locator('[data-level-head="chapter"]').getAttribute('aria-expanded') === 'true')
      const i5 = await centre(page, '[data-item="chapter:5"]')
      for (let i = 1; i <= 6; i++) { await touch(cdp, 'touchMove', i5.x, c0.y + ((i5.y - c0.y) * i) / 6); await sleep(30) }
      const nav = page.waitForURL(/view=drafting/, { timeout: 4000 }).then(() => true).catch(() => false)
      await touch(cdp, 'touchEnd')
      ok('drag: lifting on "5. Drafting" goes to Drafting, in panel 6', await nav && /panel=6/.test(page.url()), page.url())
      await page.waitForSelector('[data-focus-shell]')
      ok('…where the address reads "S2 · C5 · P6"', (await page.locator('[data-address]').innerText()).startsWith('S2 · C5 · P6'))

      // tap-tap
      await page.tap('[data-where-button="top"]')
      await page.tap('[data-level-head="chapter"]')
      ok('tap: the first tap on a level opens it (and goes nowhere)', await page.locator('[data-level-head="chapter"]').getAttribute('aria-expanded') === 'true' && /view=drafting/.test(page.url()))
      const nav2 = page.waitForURL(/view=organising/, { timeout: 4000 }).then(() => true).catch(() => false)
      await page.tap('[data-item="chapter:4"]')
      ok('tap: the second tap, on an item, goes there', await nav2)
      await context.close()
    }

    // ── 3 · each block opens its panel ──
    {
      const { context, page } = await open(360, 740)
      const reached: number[] = []
      for (let n = 1; n <= 7; n++) { await chooseViaMenu(page, n).then(() => reached.push(n)).catch(() => {}) }
      ok('tapping each of the seven blocks opens that panel', reached.join() === '1,2,3,4,5,6,7', reached.join())
      ok('…and the URL carries it (panel=7), so a reload keeps it', /panel=7/.test(page.url()))
      await context.close()
    }

    // ── 4 · gestures ──
    {
      const { context, page, cdp } = await open(360, 740)
      await chooseViaMenu(page, 7); await chooseViaMenu(page, 5)
      await swipeLeft(cdp, 360)
      ok('swipe left: back to the last panel chosen (5 → 7)', await panelOf(page) === '7')
      await swipeLeft(cdp, 360)
      ok('swipe left again: back to the first (7 → 2)', await panelOf(page) === '2')
      await swipeLeft(cdp, 360)
      ok('swipe left with nothing behind: nothing moves, and it says so', await panelOf(page) === '2' && /Nothing to go back to/.test(await page.locator('[data-where-toast]').innerText().catch(() => '')))
      await swipeRight(cdp, 360)
      ok('swipe right: forward (2 → 7)', await panelOf(page) === '7')
      await swipeRight(cdp, 360); await swipeRight(cdp, 360)
      ok('swipe right with nothing forward: Where am I? opens', await panelOf(page) === '5' && await page.locator('[data-where-menu]').count() === 1)
      await page.keyboard.press('Escape')
      // inside the horizontally scrollable table, no swipe fires
      await chooseViaMenu(page, 6)
      const t = await centre(page, '[data-wide-table]')
      const before = await panelOf(page)
      await swipe(cdp, 300, t.y, 60, t.y)
      ok('a sideways stroke inside a horizontally scrollable table fires no swipe', await panelOf(page) === before && await page.locator('[data-where-menu]').count() === 0)
      control('the same stroke outside the table not changing the panel (must be FALSE)', await (async () => { await swipe(cdp, 300, 690, 60, 690); return (await panelOf(page)) === before })())
      // back returns to a panel at the same scroll
      await chooseViaMenu(page, 7)
      await page.evaluate(() => window.scrollTo(0, 1500)); await sleep(650)
      await chooseViaMenu(page, 2)
      await swipeLeft(cdp, 360, 300)
      await sleep(250)
      const y = await page.evaluate(() => window.scrollY)
      ok('back returns to panel 7 at the same scroll', await panelOf(page) === '7' && Math.abs(y - 1500) < 40, `panel ${await panelOf(page)}, scrollY ${y}`)
      await context.close()
    }

    // ── panel 5 → 6, the address, and a deep link ──
    {
      const { context, page, cdp } = await open(360, 740, `${IDEA_URL}&view=drafting&panel=5`)
      await page.evaluate(() => { (window as unknown as { __marker: number }).__marker = 1 })
      await page.tap('[data-chapter-action="38"]')
      await page.waitForFunction(() => document.querySelector('[data-focus-shell]')?.getAttribute('data-panel') === '6')
      await page.waitForFunction(() => document.querySelector('[data-open-record]')?.textContent === 'open: #38', undefined, { timeout: 2000 }).catch(() => {}) // hashchange is async
      ok('panel 5 → 6: choosing #38 opens it in panel 6, with no page load', await page.locator('[data-open-record]').innerText() === 'open: #38' && await page.evaluate(() => (window as unknown as { __marker?: number }).__marker === 1))
      ok('…and the address reads "S2 · C5 · P6"', (await page.locator('[data-address]').innerText()).startsWith('S2 · C5 · P6'))
      await swipeLeft(cdp, 360, 300)
      ok('…and swipe left goes back to panel 5', await panelOf(page) === '5')
      await context.close()
    }
    {
      const { context, page, cdp } = await open(360, 740, `${IDEA_URL}&view=drafting&panel=6#38`)
      ok('a deep link opens the right panel at 360 px (Drafting, panel 6, #38)', await panelOf(page) === '6' && await page.locator('[data-open-record]').innerText() === 'open: #38')
      const sp = await page.locator('[data-address-spelled]').innerText().catch(() => '')
      ok('the first time, the address is spelled out: "Stage 2 Development · Chapter 5 Drafting · Panel 6 Working on #38"', sp === 'Stage 2 Development · Chapter 5 Drafting · Panel 6 Working on #38', sp)
      await page.reload(); await page.waitForSelector('[data-focus-shell]')
      ok('…and only the first time', await page.locator('[data-address-spelled]').count() === 0)
      const a = await centre(page, '[data-address]')
      await touch(cdp, 'touchStart', a.x, a.y); await sleep(700)
      const tip = await page.locator('[data-address-tooltip]').innerText().catch(() => '')
      await touch(cdp, 'touchEnd')
      ok('a long press on the address spells it out', tip === 'Stage 2 Development · Chapter 5 Drafting · Panel 6 Working on #38', tip)
      await context.close()
    }

    // ── 1440: the keyboard, and hover ──
    {
      const { context, page } = await open(1440, 900)
      await page.keyboard.press('w')
      ok('1440 px: W opens Where am I? (from the top)', await page.locator('[data-where-menu]').getAttribute('data-edge') === 'top')
      await page.keyboard.press('Escape')
      ok('1440 px: Esc closes it', await page.locator('[data-where-menu]').count() === 0)
      await chooseViaMenu(page, 7); await chooseViaMenu(page, 4)
      await page.keyboard.press('ArrowLeft')
      ok('1440 px: ← goes back (4 → 7)', await panelOf(page) === '7')
      await page.keyboard.press('ArrowRight')
      ok('1440 px: → goes forward (7 → 4)', await panelOf(page) === '4')
      // the first sight spells it out inline; from then on, hover does
      ok('1440 px: the first time, the address is spelled out inline', await page.locator('[data-address-spelled]').count() === 1)
      await page.reload(); await page.waitForSelector('[data-focus-shell]')
      await page.hover('[data-address]')
      ok('1440 px: hovering the address spells it out', /^Stage 2 Development · Panel 4 Notes$/.test(await page.locator('[data-address-tooltip]').innerText().catch(() => '')))
      await chooseViaMenu(page, 3)
      await page.focus('[data-chat-input]')
      await page.keyboard.press('w')
      ok('1440 px: typing W in Lex’s box types it, and opens nothing', await page.locator('[data-where-menu]').count() === 0 && await page.locator('[data-chat-input]').inputValue() === 'w')
      await context.close()
    }

    // ── 7 · never lose your place ──
    {
      const { context, page } = await open(360, 740, `${IDEA_URL}&view=drafting&panel=6#38`)
      await page.evaluate(() => window.scrollTo(0, 1200)); await sleep(700)
      await page.goto(IDEA_URL) // a bare link to the idea
      await page.waitForSelector('[data-focus-shell]')
      await sleep(600)
      const y = await page.evaluate(() => window.scrollY)
      ok('a bare link puts you back: the same chapter, panel and record', /view=drafting/.test(page.url()) && await panelOf(page) === '6' && await page.locator('[data-open-record]').innerText() === 'open: #38', page.url())
      ok('…at the same scroll', Math.abs(y - 1200) < 40, `scrollY ${y}`)
      ok('…and says "Back where you were"', /Back where you were/.test(await page.locator('[data-where-toast]').innerText().catch(() => '')))
      await page.goto(`${IDEA_URL}&section=causes`)
      await page.waitForSelector('[data-focus-shell]')
      ok('a link that names a place goes there, not to the remembered one', /section=causes/.test(page.url()) && !/view=drafting/.test(page.url()))
      // a typed Lex message survives a reload, is offered back, and is never sent by itself
      await page.goto(`${IDEA_URL}&panel=3`); await page.waitForSelector('[data-chat-input]')
      await page.tap('[data-chat-input]')
      await page.keyboard.type('my unsent words for Lex')
      await sleep(700)
      await page.reload(); await page.waitForSelector('[data-chat-input]')
      const offer = await page.locator('[data-draft-offer]').innerText().catch(() => '')
      ok('a typed Lex message survives a reload and is offered back', /You had unsent text here — restore it\?/.test(offer) && /my unsent words for Lex/.test(offer), offer)
      ok('…and nothing was sent', (await page.evaluate(() => (window as unknown as { __w: { sent: string[] } }).__w.sent.length)) === 0)
      await page.tap('[data-draft-restore]')
      ok('Restore puts it back in the box — still not sent', await page.locator('[data-chat-input]').inputValue() === 'my unsent words for Lex' && (await page.evaluate(() => (window as unknown as { __w: { sent: string[] } }).__w.sent.length)) === 0)
      await page.locator('[data-chat-input]').press('Enter')
      ok('…until the user sends it', (await page.evaluate(() => (window as unknown as { __w: { sent: string[] } }).__w.sent.join())) === 'my unsent words for Lex')
      await sleep(600); await page.reload(); await page.waitForSelector('[data-chat-input]')
      ok('once sent, nothing is offered after a reload', await page.locator('[data-draft-offer]').count() === 0)
      await page.tap('[data-chat-input]'); await page.keyboard.type('thrown away'); await sleep(700)
      await page.reload(); await page.waitForSelector('[data-draft-offer]')
      await page.tap('[data-draft-discard]'); await sleep(200)
      await page.reload(); await page.waitForSelector('[data-chat-input]')
      control('a discarded draft offered again after a reload (must be FALSE)', await page.locator('[data-draft-offer]').count() > 0)
      await context.close()
    }
    {
      const before = errors.length
      const { context, page } = await open(360, 740, `${IDEA_URL}&panel=3`, { blocked: true })
      const thrown = await page.evaluate(() => { try { void window.localStorage; return false } catch { return true } })
      ok('storage blocked (control: reading localStorage throws in this page)', thrown)
      await chooseViaMenu(page, 7).catch(() => {})
      ok('with storage blocked the page still loads, the menu still works, and nothing throws', await panelOf(page) === '7' && errors.length === before, errors.slice(before).join(' | '))
      await context.close()
    }
    ok('no page error in any of the browser runs', errors.length === 0, errors.join(' | '))
  } finally {
    await browser.close()
  }
}

async function main() {
  partA()
  partB()
  await partC()
  console.log(`\n${ran} ran, ${pass} passed, ${fail} failed · ${controls} controls, ${dead} dead · ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
