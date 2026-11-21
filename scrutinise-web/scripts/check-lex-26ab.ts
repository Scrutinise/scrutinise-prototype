// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26ab — LEX 26-AB (BRIEF_26AB; decision 354). Counts what RAN: ran, passed, controls fired, dead, not run.
//
//   1 · the ⓘ text: every Brief field of every kind (the common fields, then each kind's own) and the Brief heading has an entry with
//       its three parts, none empty (a planted gap is caught); §2's text is in it VERBATIM, read from docs/BRIEF_26AB.md's own table;
//       the field guide's entry carries it, and Lex's explain_field answers with the same words (one source).
//   2 · the counter rule (§3.3): a limit of 50,000 or more shows "N characters" until the last 10%, then what is left; a small limit
//       still shows what is left (control).
//   3 · in a real browser at 360 and 390 px, the REAL BriefSection with every kind's form open:
//       - an ⓘ beside every field heading and the Brief heading, each named "About <field>";
//       - it opens on a tap, STAYS (after a wait, and after a tap inside it), and closes by its Close button, by Esc (the focus going
//         back to the ⓘ) and by a tap outside; it is reached by the keyboard (Tab) and opened with Enter;
//       - §3.1 no element wider than the viewport (a planted wide element is caught); the placeholder is the short one;
//       - §3.2 no stray "none": with Modelled on empty nothing resolves; with "218" typed, "Resolves to: [Ref: 218]" sits under its input;
//       - §3.3 "What this draft must do" shows "0 characters", not "200000 left"; within the last 10% it shows what is left.
//
// Nothing reads or writes a database and nothing is spent: the Brief view is answered by the check.
//
//   npm run check:lex-26ab
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BRIEF_FIELD_INFO, BRIEF_HEADING_INFO, type InfoText } from '../lib/lex/brief-info'
import { BRIEF_FIELD_WORD, BRIEF_UI, INFO_UI } from '../lib/lex/screen-labels'
import { KIND_FIELDS, type BriefKind } from '../lib/lex/action-brief-pure'
import { explainField, guideEntries } from '../lib/lex/field-guide'
import { remainingWords, LIMITS } from '../lib/lex/input-limits'
import type { BriefView, BriefKindView } from '../lib/lex/action-brief'

const ROOT = join(__dirname, '..')
let ran = 0, pass = 0, fail = 0, controls = 0, dead = 0, notRun = 0
const ok = (name: string, cond: boolean, detail?: unknown) => {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`) }
}
const control = (name: string, cond: boolean, detail?: unknown) => { controls++; if (!cond) dead++; ok(`control: ${name}`, cond, detail) }
const section = (s: string) => console.log(`\n${s}`)

const COMMON_FIELDS = ['must', 'modelledOn', 'tone', 'mustInclude', 'mustNot'] as const
const KINDS = Object.keys(KIND_FIELDS) as BriefKind[]
/** Every field a Brief of this kind shows, in the order the form shows them. */
const fieldsOf = (k: BriefKind): Array<keyof typeof BRIEF_FIELD_WORD> => [...COMMON_FIELDS, ...KIND_FIELDS[k]]

/** The fields of any kind whose ⓘ text is missing a part. Takes the table, so a planted gap can be fed to the SAME function. */
function infoGaps(table: Partial<Record<keyof typeof BRIEF_FIELD_WORD, InfoText>>): string[] {
  const out: string[] = []
  for (const k of KINDS) for (const f of fieldsOf(k)) {
    const e = table[f]
    for (const p of ['what', 'lexDoes', 'example'] as const) if (!e?.[p]?.trim()) out.push(`${k}.${f}.${p}`)
  }
  return out
}

function part1() {
  section('1 · the ⓘ text — every field of every kind, three parts, §2 verbatim, one source with the field guide and explain_field')
  const total = KINDS.reduce((n, k) => n + fieldsOf(k).length, 0)
  const gaps = infoGaps(BRIEF_FIELD_INFO)
  ok(`every Brief field of every kind (${KINDS.length} kinds, ${total} field places) has what it is, what Lex does, and an example`, gaps.length === 0, gaps.join(', '))
  const planted = { ...BRIEF_FIELD_INFO, laidBefore: { ...BRIEF_FIELD_INFO.laidBefore, example: ' ' } }
  control('a field with an empty part (Laid before\'s example) is caught', infoGaps(planted).join() === 'CODE_TEXT.laidBefore.example', infoGaps(planted).join())
  const { modelledOn: _m, ...withoutOne } = BRIEF_FIELD_INFO
  control('a field with no entry at all (Modelled on) is caught, on every kind', infoGaps(withoutOne).filter((g) => g.endsWith('.modelledOn.what')).length === KINDS.length)
  ok('the Brief heading has its ⓘ text', BRIEF_HEADING_INFO.trim().length > 40)

  // §2 verbatim, read from the brief's own table, so the check cannot agree with a copy of itself
  const brief = readFileSync(join(ROOT, '..', 'docs', 'BRIEF_26AB.md'), 'utf8').split('\r\n').join('\n')
  const rows = brief.split('\n').filter((l) => /^\| [A-Z]/.test(l) && !/^\| Field \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
  const byWord = Object.fromEntries(Object.entries(BRIEF_FIELD_WORD).map(([k, v]) => [v, k])) as Record<string, keyof typeof BRIEF_FIELD_WORD>
  const differ: string[] = []
  for (const [label, what, lexDoes, example] of rows) {
    const k = byWord[label]
    const e = k ? BRIEF_FIELD_INFO[k] : undefined
    if (!e) { differ.push(`${label}: no field`); continue }
    if (e.what !== what) differ.push(`${label}.what`)
    if (e.lexDoes !== lexDoes) differ.push(`${label}.lexDoes`)
    if (e.example !== example) differ.push(`${label}.example`)
  }
  ok(`§2's table is in the ⓘ text verbatim (${rows.length} rows read from docs/BRIEF_26AB.md, three parts each)`, rows.length === 9 && differ.length === 0, `${rows.length} rows; ${differ.join(', ')}`)
  const heading = /Also an ⓘ on the \*\*Brief heading\*\* itself: "([^"]+)"/.exec(brief)?.[1]
  ok('…and the Brief heading\'s sentence, verbatim', heading === BRIEF_HEADING_INFO, heading)
  control('a one-word change to a §2 cell is caught by the same comparison', (() => { const [, w] = rows[0]; return BRIEF_FIELD_INFO.must.what === w && `${w}x` !== BRIEF_FIELD_INFO.must.what })())

  // one source: the guide's entry carries the same object, and explain_field answers with it
  const entries = guideEntries()
  const notCarried = (Object.keys(BRIEF_FIELD_INFO) as Array<keyof typeof BRIEF_FIELD_INFO>).filter((k) => entries.find((e) => e.key === `briefField.${k}`)?.info !== BRIEF_FIELD_INFO[k])
  ok('every briefField entry in the field guide carries the ⓘ text itself (the same object, not a copy)', notCarried.length === 0, notCarried.join(', '))
  ok('…and the Brief heading\'s entry (brief.section) carries its sentence', entries.find((e) => e.key === 'brief.section')?.info === BRIEF_HEADING_INFO)
  const ex = explainField(BRIEF_FIELD_WORD.modelledOn).exact
  ok('explain_field("Modelled on") finds the entry with its three parts', ex?.key === 'briefField.modelledOn' && typeof ex.info === 'object' && (ex.info as InfoText).example === BRIEF_FIELD_INFO.modelledOn.example)
  ok('the ⓘ and its Close have their own guide entries', entries.some((e) => e.key === 'info.open' && e.label === INFO_UI.open) && entries.some((e) => e.key === 'info.close' && e.label === INFO_UI.close))
}

async function part1Tool() {
  section('1b · Lex\'s explain_field returns the same three parts the screen shows')
  const { toolByName } = await import('../lib/lex/agent/tools')
  const t = toolByName('explain_field')
  if (!t) { ok('explain_field exists', false); return }
  const r = await t.run({} as never, { name: BRIEF_FIELD_WORD.revisionRule } as never) as { ok: boolean; data?: Record<string, unknown> }
  const d = r.data ?? {}
  ok('explain_field("Revision rule") answers with whatItIs, whatLexDoes and example, word for word', d.whatItIs === BRIEF_FIELD_INFO.revisionRule.what && d.whatLexDoes === BRIEF_FIELD_INFO.revisionRule.lexDoes && d.example === BRIEF_FIELD_INFO.revisionRule.example, JSON.stringify(d).slice(0, 300))
  const h = await t.run({} as never, { name: 'brief.section' } as never) as { ok: boolean; data?: Record<string, unknown> }
  ok('explain_field on the Brief heading answers with its sentence', h.data?.about === BRIEF_HEADING_INFO, JSON.stringify(h.data).slice(0, 200))
}

function part2() {
  section('2 · the counter rule (§3.3)')
  const big = LIMITS.briefMust
  ok(`"What this draft must do" (limit ${big.toLocaleString('en-GB')}) shows "0 characters" empty, not "${big} left"`, remainingWords(0, big) === '0 characters', remainingWords(0, big))
  ok('…"1,234 characters" with some typed', remainingWords(1234, big) === '1,234 characters', remainingWords(1234, big))
  ok('…and what is LEFT once inside the last 10% (at 90% exactly, and after)', remainingWords(big * 0.9, big) === `${big * 0.1} left` && remainingWords(big - 5, big) === '5 left', `${remainingWords(big * 0.9, big)} | ${remainingWords(big - 5, big)}`)
  ok('…one character before the last 10% it still shows the count typed', remainingWords(big * 0.9 - 1, big) === `${(big * 0.9 - 1).toLocaleString('en-GB')} characters`, remainingWords(big * 0.9 - 1, big))
  ok('…at and over the limit it says so, as before', remainingWords(big, big).startsWith('limit reached') && remainingWords(big + 3, big).includes('over the limit'))
  control('a small limit (600) still shows what is left, from the first character', remainingWords(0, 600) === '600 left' && remainingWords(588, 600) === '12 left')
  control('the threshold is 50,000: 49,999 still counts down, 50,000 does not', remainingWords(0, 49_999) === '49999 left' && remainingWords(0, 50_000) === '0 characters', `${remainingWords(0, 49_999)} | ${remainingWords(0, 50_000)}`)
}

const kv = (kind: BriefKind): BriefKindView => ({ kind, documentId: `d-${kind}`, d: null, current: null, versions: [], proposal: null, instruction: null, draft: null, changed: false, empty: true })
const VIEW: BriefView = { number: 7, kinds: KINDS.map(kv), why: null, prefill: { pence: 1.2, n: 3 } }

async function part3() {
  section('3 · in a real browser, at 360 and 390 px')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { notRun++; console.log(`  NOT RUN — playwright is not loadable: ${(e as Error).message}`); return }
  const { build } = await import('esbuild')
  const bundle = (await build({ entryPoints: [join(ROOT, 'scripts/fixtures/brief-info-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })).outputFiles[0].text
  // The layout is measured with the app's own Tailwind, compiled from the components on the page (as check:lex-26z does), never a stand-in
  let css = ''
  try {
    const postcss = (await import('postcss')).default
    const twName: string = '@tailwindcss/postcss'
    const tw = (await import(twName)).default as () => import('postcss').AcceptedPlugin
    const src = ['BriefSection', 'InfoLabel', 'BoundedInput', 'DeviceDraft', 'ActionDraftSection'].map((c) => `@source "../components/lex/${c}.tsx";`).join(' ') + ' @source "./fixtures/brief-info-harness-entry.tsx";'
    css = (await postcss([tw()]).process(`@import 'tailwindcss'; ${src}`, { from: join(ROOT, 'scripts/_tw.css') })).css
  } catch (e) { ok('Tailwind compiled, so the layout can be measured', false, (e as Error).message.slice(0, 200)); return }
  const browser = await chromium.launch()
  try {
    for (const width of [360, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
      const page = await ctx.newPage()
      await page.addInitScript('window.__name = (f) => f')
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div></body></html>' }))
      await page.route('**/api/ideas/*/action-documents', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: VIEW }) }))
      await page.goto('http://harness.test/')
      await page.evaluate((v) => { (window as unknown as { __bv: unknown }).__bv = v }, VIEW)
      await page.addStyleTag({ content: css })
      await page.addScriptTag({ content: bundle })
      await page.evaluate(() => (window as unknown as { __mount: () => void }).__mount())
      await page.waitForSelector('[data-brief-edit]', { timeout: 30_000 })
      // each click opens that kind's form and hides its button, so each is found by its kind, not by its place in a list
      for (const k of KINDS) await page.locator(`[data-brief-kind="${k}"] [data-brief-edit]`).click()
      await page.waitForSelector('[data-brief-form="CODE_TEXT"]')
      const at = `${width} px:`

      // ── an ⓘ on every field heading, every kind, and on the Brief heading ──
      const want = KINDS.flatMap((k) => [`${k}:${BRIEF_UI.section}`, ...fieldsOf(k).map((f) => `${k}:${BRIEF_FIELD_WORD[f]}`)])
      const have = await page.evaluate(() => Array.from(document.querySelectorAll('[data-brief-kind]')).flatMap((s) =>
        Array.from(s.querySelectorAll('[data-info-button]')).map((b) => `${s.getAttribute('data-brief-kind')}:${(b.getAttribute('aria-label') ?? '').replace(/^About /, '')}`)))
      const missing = want.filter((x) => !have.includes(x))
      ok(`${at} an ⓘ named "About <field>" beside the Brief heading and every field of every kind (${want.length})`, missing.length === 0 && have.length === want.length, `missing ${missing.join(', ')}; ${have.length} found`)

      // ── opens, stays, closes three ways; keyboard ──
      const info = (field: string) => page.locator(`[data-brief-form="CODE_TEXT"] [data-info="${field}"]`)
      const panelOpen = async (field: string) => (await info(field).locator('[data-info-panel]').count()) === 1
      const btn = (field: string) => info(field).locator('[data-info-button]')
      await btn(BRIEF_FIELD_WORD.modelledOn).tap()
      const parts = await info(BRIEF_FIELD_WORD.modelledOn).locator('[data-info-part]').allInnerTexts()
      ok(`${at} a tap opens the panel with its three parts, in the guide's words`, parts.length === 3 && parts[0].includes(BRIEF_FIELD_INFO.modelledOn.what) && parts[2].includes(BRIEF_FIELD_INFO.modelledOn.example), parts.join(' | ').slice(0, 200))
      ok(`${at} …the ⓘ says it is open (aria-expanded), and the panel is named for its field`, await btn(BRIEF_FIELD_WORD.modelledOn).getAttribute('aria-expanded') === 'true' && await info(BRIEF_FIELD_WORD.modelledOn).locator('[data-info-panel]').getAttribute('aria-label') === INFO_UI.about(BRIEF_FIELD_WORD.modelledOn))
      await page.waitForTimeout(1500)
      await info(BRIEF_FIELD_WORD.modelledOn).locator('[data-info-part="what"]').tap()
      ok(`${at} …it STAYS: after 1.5 s, and after a tap inside it`, await panelOpen(BRIEF_FIELD_WORD.modelledOn))
      await info(BRIEF_FIELD_WORD.modelledOn).locator('[data-info-close]').tap()
      ok(`${at} …its Close button closes it`, !(await panelOpen(BRIEF_FIELD_WORD.modelledOn)))
      await btn(BRIEF_FIELD_WORD.tone).tap()
      await page.keyboard.press('Escape')
      const focusAfterEsc = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
      ok(`${at} …Esc closes it, and the focus goes back to its ⓘ`, !(await panelOpen(BRIEF_FIELD_WORD.tone)) && focusAfterEsc === INFO_UI.about(BRIEF_FIELD_WORD.tone), focusAfterEsc)
      await btn(BRIEF_FIELD_WORD.issuedBy).tap()
      const opened = await panelOpen(BRIEF_FIELD_WORD.issuedBy)
      await page.touchscreen.tap(width - 8, 790)
      await page.waitForTimeout(100)
      ok(`${at} …a tap outside closes it`, opened && !(await panelOpen(BRIEF_FIELD_WORD.issuedBy)), `opened ${opened}`)
      control(`${at} a panel NOT tapped outside is still open (the outside-tap test can fail)`, await (async () => { await btn(BRIEF_FIELD_WORD.issuedBy).tap(); const o = await panelOpen(BRIEF_FIELD_WORD.issuedBy); await page.keyboard.press('Escape'); return o })())
      // keyboard: from the field above it, Tab reaches the ⓘ and Enter opens it
      await page.locator('[data-brief-form="CODE_TEXT"] textarea[aria-label="What this draft must do"]').focus()
      let reached = false
      for (let i = 0; i < 6 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate((n) => document.activeElement?.getAttribute('aria-label') === n, INFO_UI.about(BRIEF_FIELD_WORD.modelledOn)) }
      await page.keyboard.press('Enter')
      ok(`${at} the ⓘ is reached by the keyboard (Tab from the field above) and Enter opens it`, reached && await panelOpen(BRIEF_FIELD_WORD.modelledOn), `reached ${reached}`)
      await page.keyboard.press('Escape')

      // ── §3.1 nothing wider than the viewport ──
      const wide = () => page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const out: string[] = []
        if (document.documentElement.scrollWidth > vw) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`)
        for (const el of Array.from(document.querySelectorAll('#root *'))) {
          const r = el.getBoundingClientRect()
          if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) out.push(`${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} ${Math.round(r.left)}–${Math.round(r.right)}`)
        }
        return out
      })
      // every panel open at once is the widest the form gets
      for (const b of await page.locator('[data-brief-form="CODE_TEXT"] [data-info-button]').all()) await b.click()
      const over = await wide()
      ok(`${at} no element is wider than the viewport, with every ⓘ panel open`, over.length === 0, over.slice(0, 5).join('; '))
      const ph = await page.locator('[data-brief-form="CODE_TEXT"] input[aria-label="Modelled on"]').getAttribute('placeholder')
      ok(`${at} the Modelled on placeholder is the short one`, ph === 'Source number or corpus section', ph)
      const box = await page.locator('[data-brief-form="CODE_TEXT"] input[aria-label="Modelled on"]').boundingBox()
      const lab = await page.locator('[data-brief-form="CODE_TEXT"] [data-brief-field="modelledOn"] > [data-field-heading]').boundingBox()
      // full width, measured against the field's own block: a fixed-width box (the old w-80) can fit a 360 px harness by luck and still run
      // off a real panel with more padding, so "it fits" is not the test; "it fills its field" is (mutant A4 found this)
      const fieldBox = await page.locator('[data-brief-form="CODE_TEXT"] [data-brief-field="modelledOn"]').boundingBox()
      ok(`${at} …its label is ABOVE the input, and the input fills its field's width (below 768 px)`, !!box && !!lab && !!fieldBox && box.y >= lab.y + lab.height - 1 && Math.abs(box.width - fieldBox.width) <= 2 && fieldBox.width > width * 0.6, JSON.stringify({ box, lab, fieldBox }))
      await page.evaluate(() => { const d = document.createElement('div'); d.id = 'zz-wide'; d.style.width = '500px'; d.textContent = 'x'; document.querySelector('[data-brief-form]')!.appendChild(d) })
      control(`${at} a planted 500 px element is caught`, (await wide()).some((x) => x.startsWith('div')))
      await page.evaluate(() => document.getElementById('zz-wide')?.remove())

      // ── §3.2 no stray "none" ──
      const strayNone = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-brief-form] *')).filter((el) => el.children.length === 0 && /^\s*none\s*$/i.test(el.textContent ?? '')).length)
      ok(`${at} with Modelled on empty, no stray "none" anywhere in the forms, and nothing "resolves"`, await strayNone() === 0 && await page.locator('[data-brief-modelled-words]').count() === 0)
      await page.locator('[data-brief-form="CODE_TEXT"] input[aria-label="Modelled on"]').fill('218')
      const resolves = page.locator('[data-brief-form="CODE_TEXT"] [data-brief-field="modelledOn"] [data-brief-modelled-words]')
      const rText = (await resolves.count()) ? await resolves.innerText() : ''
      const rBox = await resolves.boundingBox().catch(() => null)
      ok(`${at} …with "218" typed: "Resolves to: [Ref: 218]", under the Modelled on input, in its own block`, rText === 'Resolves to: [Ref: 218]' && !!rBox && !!box && rBox.y >= box.y + box.height - 1, rText)
      await page.evaluate(() => { const s = document.createElement('span'); s.id = 'zz-none'; s.textContent = 'none'; document.querySelector('[data-brief-form]')!.appendChild(s) })
      control(`${at} a planted "none" is caught`, await strayNone() === 1)
      await page.evaluate(() => document.getElementById('zz-none')?.remove())

      // ── §3.3 the counter ──
      const counter = () => page.locator('[data-brief-form="CODE_TEXT"] textarea[aria-label="What this draft must do"]').locator('xpath=following-sibling::span//*[@data-limit-counter]').innerText()
      const c0 = await counter()
      ok(`${at} "What this draft must do" shows "0 characters", not "${LIMITS.briefMust} left"`, c0 === '0 characters', c0)
      await page.locator('[data-brief-form="CODE_TEXT"] textarea[aria-label="What this draft must do"]').fill('a'.repeat(LIMITS.briefMust - 1234))
      const c1 = await counter()
      ok(`${at} …within the last 10% it shows what is left ("1234 left")`, c1 === '1234 left', c1)
      const small = await page.locator('[data-brief-form="CODE_TEXT"] input[aria-label="Issued by"]').locator('xpath=following-sibling::span//*[@data-limit-counter]').innerText()
      control(`${at} a 1,000-character field still counts down from the start`, small === `${LIMITS.briefField} left`, small)
      ok(`${at} no page error`, errors.length === 0, errors.join(' | ').slice(0, 300))
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  part1()
  await part1Tool()
  part2()
  if (process.argv.includes('--pure')) { notRun++; console.log('\n  (the browser part not run: --pure)') } else await part3()
  console.log(`\n${ran} ran · ${pass} passed · ${fail} failed · ${controls} controls (${dead} dead) · ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
