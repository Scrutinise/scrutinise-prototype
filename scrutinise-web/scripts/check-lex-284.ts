// ─────────────────────────────────────────────────────────────────────────────
// check:lex-284 (28 Oct 2026, CCh-Lex 28 Oct (2) items 5 and 6)
//   284 — the actions find box: "63" or "#63" finds ACTION 63 first, wherever it is now (the list, Later phase, ruled out, merged
//         away), and says where it went ("merged into #207 on 12 Oct 2026"); text matches come below. "#63" never matches #630.
//   285 — the pure half of the Action details edit: `withOwnText` replaces the owner's text and keeps the quoted parts exactly.
//         (285's screen — the labelled buttons, the set-out text, the drag handle — is read in Chromium by check:lex-26u §2.)
// Part A is offline and pure. Part B mounts the REAL ActionsWorkspace in Chromium (scripts/fixtures/actions-harness-entry.tsx) with
// a store holding a merged-away, a ruled-out and a parked action, and types into the find box. No database, no model, no cost.
// ─────────────────────────────────────────────────────────────────────────────
import { join } from 'node:path'
import { build } from 'esbuild'
import { findByNumber, numberQuery, textMatches, findWords } from '../lib/lex/action-find'
import { withOwnText, detailParts } from '../lib/lex/record-layout-pure'
import type { CanonicalAction } from '../lib/lex/page1-config'

const ROOT = join(__dirname, '..')
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

const mk = (n: number, extra: Partial<CanonicalAction> = {}): CanonicalAction => ({
  id: `a${n}`, number: n, title: `Action number ${n}`, practicalStep: `Step ${n}`, status: 'LIVE', parked: false, parkedReason: null, mergedIntoId: null, ruleOutReason: null,
  commentary: null, foldedIntoId: null, ...extra,
} as unknown as CanonicalAction)

// The fixture both parts use: #63 merged into #207 on 12 Oct; #207 mentions "section 63"; #630 exists; #64 ruled out; #65 parked;
// #70 merged into #71, which was later merged into #207 (a chain).
const ACTIONS: Array<Record<string, unknown>> = [
  { n: 207, extra: { practicalStep: 'Amend section 63 of the Act so one body owns the register.' } },
  { n: 630, extra: {} },
  { n: 65, extra: { parked: true, parkedReason: 'after the pilot' } },
  { n: 63, extra: { status: 'ARCHIVED', mergedIntoId: 'a207', ruleOutReason: 'Merged into 207.', setAsideAt: '2026-10-12T10:00:00.000Z' } },
  { n: 64, extra: { status: 'RULED_OUT', ruleOutReason: 'Duplicates the duty in #12.', setAsideAt: '2026-10-20T09:00:00.000Z' } },
  { n: 71, extra: { status: 'ARCHIVED', mergedIntoId: 'a207', setAsideAt: '2026-10-15T09:00:00.000Z' } },
  { n: 70, extra: { status: 'ARCHIVED', mergedIntoId: 'a71', setAsideAt: '2026-10-14T09:00:00.000Z' } },
]

function partA() {
  section('A · offline — the number, where it went, text matches, the Action details edit')
  const all = ACTIONS.map((x) => mk(x.n as number, x.extra as Partial<CanonicalAction>))
  const live = all.filter((a) => a.status === 'LIVE'), setAside = all.filter((a) => a.status !== 'LIVE')
  ok('"63", "#63", " # 63 " are the number 63; "63 fees", "6.3" and "sixty" are not', numberQuery('63') === 63 && numberQuery('#63') === 63 && numberQuery(' # 63 ') === 63 && numberQuery('63 fees') === null && numberQuery('6.3') === null && numberQuery('sixty') === null)
  const h63 = findByNumber(63, live, setAside, 'Europe/London')
  ok('#63, merged away, is FOUND by its number — "merged into #207 on 12 Oct 2026"', h63?.action.id === 'a63' && h63.where === 'merged into #207 on 12 Oct 2026' && h63.goTo?.id === 'a207', JSON.stringify(h63?.where))
  const h64 = findByNumber(64, live, setAside, 'Europe/London')
  ok('#64, ruled out, says so with its date and reason', h64?.where === 'ruled out on 20 Oct 2026: Duplicates the duty in #12.', h64?.where)
  ok('#65, parked, is "in Later phase (after the pilot)"', findByNumber(65, live, setAside)?.where === 'in Later phase (after the pilot)')
  ok('#207, live, is "in the list"', findByNumber(207, live, setAside)?.where === 'in the list')
  const h70 = findByNumber(70, live, setAside, 'Europe/London')
  ok('a chain is followed: #70 merged into #71, which was later merged into #207 — and "Go to" is #207', h70?.where === 'merged into #71 on 14 Oct 2026; #71 was later merged into #207' && h70.goTo?.id === 'a207', h70?.where)
  ok('a number no action has is null', findByNumber(999, live, setAside) === null)
  control('the old find (set-aside rows never searched) finding #63 (must be FALSE)', live.some((a) => a.number === 63))
  const w = (q: string) => all.filter((a) => textMatches(a, findWords(q))).map((a) => a.number)
  ok('text "63" still matches what CONTAINS 63 (#207\'s "section 63", #630\'s "Step 630")', JSON.stringify(w('63').sort()) === JSON.stringify([207, 63, 630].sort()), JSON.stringify(w('63')))
  ok('"#63" matches action 63 only — never #630', JSON.stringify(w('#63')) === '[63]', JSON.stringify(w('#63')))
  const oldHay = (a: CanonicalAction) => `#${a.number ?? ''} ${a.title ?? ''} ${a.practicalStep}`.toLowerCase().includes('#63')
  control('the old matcher keeping #630 out of "#63" (must be FALSE)', !all.filter(oldHay).some((a) => a.number === 630))

  // 285 — the Action details edit keeps the quoted parts
  const stored = 'Old words.\n\nParts of this action, quoted\n• [#34] “A part.” (its title) — why'
  ok('withOwnText replaces the owner\'s text and keeps the header and the part byte for byte', withOwnText(stored, '## New\n\nNew words.') === '## New\n\nNew words.\n\nParts of this action, quoted\n• [#34] “A part.” (its title) — why')
  ok('…emptying the text leaves the parts alone', withOwnText(stored, '  ') === 'Parts of this action, quoted\n• [#34] “A part.” (its title) — why' && detailParts(withOwnText(stored, '')).parts.length === 1)
  ok('…with no parts, the text alone; empty → null', withOwnText('x', 'y') === 'y' && withOwnText(null, '') === null)
  control('a plain replace of the whole Action details keeping the part (must be FALSE)', '## New'.includes('[#34]'))
}

async function partB() {
  section('B · the browser — the real ActionsWorkspace in Chromium, typing in the find box')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/actions-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 400)}`); return }
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, timezoneId: 'Europe/London' })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: bundle })
    // built here, not inside evaluate: tsx names arrow functions with a `__name` helper the page does not have
    const rows = ACTIONS.map((r) => ({ id: `a${r.n}`, number: r.n, title: `Action number ${r.n} does a thing`, practicalStep: `Step ${r.n}`, whoImplements: null, wording: null, headingId: null, targetCauseIds: [], avenue: null, link: null,
      sequence: null, beforeIds: [], parked: false, parkedReason: null, mergedFrom: [], status: 'LIVE', ruleOutReason: null, mergedIntoId: null, facetProposal: null, titleProposal: null,
      source: 'LEX', mechanismType: null, targetOrganisation: null, benefits: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, policyTest: null, ...(r.extra as object) }))
    await page.evaluate((rs) => { (window as never as { __h: { store: { actions: unknown[] } } }).__h.store.actions.push(...rs) }, rows)
    await page.evaluate(() => (window as never as { __mount: (w: string) => void }).__mount('workspace'))
    await page.waitForSelector('[data-action-id]')
    const box = page.locator('input[aria-label="Find in the actions"]')
    const card = page.locator('[data-find-number]')
    const listNums = async () => (await page.locator('ul > li[data-action-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action-id')))).filter(Boolean)

    await box.fill('63')
    const t63 = (await card.innerText().catch(() => '')).replace(/\s+/g, ' ')
    ok('"63": action #63 comes FIRST, with where it went — "merged into #207 on 12 Oct 2026"', /^#63(?!d)/.test(t63) && t63.includes('— merged into #207 on 12 Oct 2026'), t63)
    const cardTop = (await card.boundingBox())?.y ?? 1e9
    const firstRowTop = (await page.locator('ul > li[data-action-id]').first().boundingBox())?.y ?? -1
    ok('…above the text matches', cardTop < firstRowTop, `card ${cardTop}, first row ${firstRowTop}`)
    const l63 = await listNums()
    ok('…and the text matches are below it: #207 ("section 63") and #630', l63.includes('a207') && l63.includes('a630'), l63.join(','))
    await box.fill('#63')
    const l63h = await listNums()
    ok('"#63": the same card, and #630 is NOT among the text matches', /^#63(?!d)/.test((await card.innerText()).trim()) && !l63h.includes('a630'), l63h.join(','))
    await page.locator('[data-find-show]').click()
    await page.waitForTimeout(150)
    ok('"Show it in Ruled out and merged away" opens that block with #63 in view', await page.locator('[data-set-aside-id="a63"]').isVisible())
    await box.fill('63')
    await page.locator('[data-find-goto]').click()
    await page.waitForTimeout(150)
    ok('"Go to #207" opens #207 in the list', await page.locator('[data-action-id="a207"] [data-full-card]').count() > 0)
    await box.fill('64')
    ok('"64": ruled out, with its date and reason', (await card.innerText()).includes('ruled out on 20 Oct 2026: Duplicates the duty in #12.'), await card.innerText())
    await box.fill('#65')
    ok('"#65": "in Later phase (after the pilot)"', (await card.innerText()).includes('in Later phase (after the pilot)'))
    await box.fill('999')
    ok('"999": says no action has that number, and where it looked', /No action #999 on this idea/.test(await card.innerText()))
    await box.fill('register')
    ok('a word is a text search only — no number card', (await card.count()) === 0)
    control('a number card on a word search (must be FALSE)', (await card.count()) > 0)
    ok('no uncaught page error', errors.length === 0, errors.join(' | ').slice(0, 300))
  } finally { await browser.close() }
}

async function main() {
  partA()
  await partB()
  console.log(`\ncheck:lex-284 — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main()
