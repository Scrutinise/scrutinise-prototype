// ─────────────────────────────────────────────────────────────────────────────
// check:lex-298-299 (CCh-Lex 2 Nov (1) D + E) — Add research, simplified (298); the Sources list's filters, sort and search (299).
//
//   A · COLD READ of 452c5ade (plain reads; nothing written): the real listRegistryDetail / duplicateGroups / searchRegistry on Charlie's
//       sources — every source has one kind and the counts add up; Refs 12 and 13 (the competency framework's page and its PDF) are one
//       possible-duplicate group, as are 189 and 217 (the Management Code's summary and its full text); a word only in 217's HELD text finds
//       217 "in the held text"; the hash the form would compute for a filed text equals the one the list holds (so a re-filed file is caught).
//   B · BROWSER — the Sources list (the REAL QuestionPanel → SourcesRegistry → SourceBrowser) against the stand-in server: pills with counts,
//       a pill narrows the list, All filters (every kind with counts, Bears on #N, Possible duplicates), sort, search.
//   C · BROWSER — the REAL AddResearch: 1 what · 2 Title (from the file's name); "Already added as [Ref: N]" by text hash and by web address,
//       "Yes" makes it a further note; the picker link opens SourceBrowser with a search box; Quote / Comment / More behind "+"; a thought alone
//       goes to "My own observation". Each saved request is read back from the stand-in.
// Counts what RAN (§23.2); a browser that cannot launch is NOT RUN, never a pass. Every property has a control that stays false.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/check-lex-298-299.ts
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { listRegistryDetail, searchRegistry, heldTextHash } from '../lib/lex/source-registry'
import { duplicateGroups, facetCounts, SOURCE_FACETS, applySourceFilter } from '../lib/lex/source-list'

const IDEA = '452c5ade-3153-400a-bf48-3b71aaa52773'
let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

async function partA() {
  section('A · cold read — 452c5ade')
  const list = await listRegistryDetail(IDEA)
  const live = await prisma.ideaSource.count({ where: { ideaId: IDEA, archivedAt: null } })
  ok(`every live source is listed (${list.length} of ${live})`, list.length === live && live > 0)
  const counts = facetCounts(list)
  console.log(`    kinds: ${SOURCE_FACETS.map((f) => `${f} ${counts[f]}`).join(' · ')}`)
  ok('every source has exactly one kind, and the kinds add up to the list', SOURCE_FACETS.reduce((a, f) => a + counts[f], 0) === list.length && list.every((s) => SOURCE_FACETS.includes(s.facet)))
  ok('the 203 corpus sources are "Found by Lex"', list.filter((s) => s.kind === 'CORPUS').every((s) => s.facet === 'lex'))
  const groups = duplicateGroups(list)
  const together = (a: number, b: number) => groups.some((g) => g.numbers.includes(a) && g.numbers.includes(b))
  console.log(`    possible-duplicate groups: ${groups.length}, ${groups.reduce((a, g) => a + g.numbers.length, 0)} sources`)
  ok('Refs 12 and 13 (the competency framework\'s page and its PDF) are one group — "same document"', together(12, 13) && groups.find((g) => g.numbers.includes(12))!.reasons.includes('same document'))
  ok('Refs 189 and 217 (the Management Code\'s 54-word summary and its full text) are one group — "same title"', together(189, 217))
  control('Ref 1 (Charlie\'s own .docx) grouped with Ref 217 (must be FALSE)', together(1, 217))
  // Hansard is keyed by sitting day: 46 and 91 are two speeches of one debate titled "Civil Service" (grouped by TITLE), but 20 and 37 share only a day.
  const hansardOnlyByDay = groups.filter((g) => g.reasons.length === 1 && g.reasons[0] === 'same document' && g.numbers.every((n) => /^pwdata-/.test(list.find((s) => s.number === n)?.corpusKey ?? '')))
  ok('no group is joined only by a Hansard sitting day', hansardOnlyByDay.length === 0, hansardOnlyByDay.map((g) => g.numbers.join('+')).join(', '))
  control('two SECTIONS of one Act (Refs 20 and 37, CRAG 2010) grouped as one document (must be FALSE)', together(20, 37))
  control('two written answers eight years apart grouped by their shared heading (Refs 126 and 176) (must be FALSE)', together(126, 176))
  const s217 = list.find((s) => s.number === 217)
  ok('217 holds a text hash (it has a document\'s text)', !!s217?.textHash)
  const m = s217?.materialId ? await prisma.ideaUserMaterial.findUnique({ where: { id: s217.materialId }, select: { text: true } }) : null
  ok('the hash the form computes for a text equals the one the list holds for it once filed (re-filing the same file is caught)', !!m?.text && (await heldTextHash(m.text)) === s217!.textHash)
  control('a one-character change still matching (must be FALSE)', !!m?.text && (await heldTextHash(`${m.text}.`)) === s217!.textHash)
  const r = await searchRegistry(IDEA, 'probation reinstatement')
  const hit = r.matches.find((x) => x.id === s217?.id)
  ok('a search for words only in 217\'s held text ("probation reinstatement") finds 217, "in the held text"', !!hit && hit.where.includes('held text') && !hit.where.includes('title'), JSON.stringify(r).slice(0, 300))
  console.log(`    (held text searched for ${r.searchedText} sources; ${r.notHeld} hold none and were matched on title and snippet only)`)
  const r2 = await searchRegistry(IDEA, 'competency framework')
  ok('a title search ("competency framework") finds both 12 and 13', [12, 13].every((n) => r2.matches.some((x) => x.id === list.find((s) => s.number === n)?.id)))
  const bears = list.filter((s) => s.bearsOn.length)
  ok(`"Bears on #N" has something to filter on (${bears.length} sources bear on an action)`, bears.length > 0)
  if (bears.length) {
    const n = bears[0].bearsOn[0]
    const f = applySourceFilter(list, { facets: [], bearsOn: n, duplicatesOnly: false, searchIds: null }, 'ref')
    ok(`…and filtering on #${n} keeps only sources that bear on it (${f.length})`, f.length > 0 && f.every((s) => s.bearsOn.includes(n)))
  }
  const az = applySourceFilter(list, { facets: [], bearsOn: null, duplicatesOnly: false, searchIds: null }, 'az').map((s) => s.title.toLowerCase())
  ok('A–Z sorts by title', az.every((t, i) => i === 0 || az[i - 1].localeCompare(t, 'en-GB', { sensitivity: 'base' }) <= 0))
  return { groups: groups.map((g) => `${g.numbers.join('+')} (${g.reasons.join(', ')})`) }
}

async function browserParts() {
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('B and C (the browser)', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({ entryPoints: [join(ROOT, 'scripts/fixtures/research-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json') })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('B and C (the browser)', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  const S = (number: number, kind: string, title: string, extra: Record<string, unknown> = {}) => ({
    id: `s${number}`, number, kind, title, url: null, citation: null, sourceType: null, author: null, publishedAt: null, snippet: null, readStatus: 'READ', readNote: null,
    corpusKey: null, materialId: null, archived: false, createdAt: `2026-10-${String(10 + (number % 20)).padStart(2, '0')}T00:00:00Z`, addedBy: 'u1', bearsOn: [], textHash: null, noteCount: 0, ...extra,
  })
  const SOURCES = [
    S(1, 'DOCUMENT', 'My own report on civil service accountability', { sourceType: 'document', materialId: 'd1' }),
    S(2, 'URL', 'The Civil Service code - GOV.UK', { url: 'https://www.gov.uk/government/publications/civil-service-code/the-civil-service-code', sourceType: 'web page', bearsOn: [207] }),
    S(3, 'DOCUMENT', 'Notes I pasted from a briefing', { sourceType: 'pasted text' }),
    S(4, 'OWN_OBSERVATION', 'My own observation', { sourceType: 'own observation' }),
    S(12, 'CORPUS', 'Civil Service competency framework', { corpusKey: 'quangos-govuk:government/publications/civil-service-competency-framework:2', addedBy: null }),
    S(13, 'CORPUS', 'Civil Service competency framework', { corpusKey: 'quangos-govuk:government/publications/civil-service-competency-framework:1', addedBy: null, bearsOn: [207, 31] }),
    S(217, 'DOCUMENT', 'Civil Service Management Code', { sourceType: 'text/plain', materialId: 'd217', textHash: 'hash-of-the-management-code' }),
  ]
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: bundle })
    await page.evaluate((src) => { (window as never as { __r: { store: { sources: unknown[] } } }).__r.store.sources = src }, SOURCES)
    const mount = (w: string) => page.evaluate((x) => (window as never as { __mountResearch: (w: string) => void }).__mountResearch(x), w)
    const shownNumbers = async () => (await page.locator('[data-sources-list] > li').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-source-number')))))

    // ── B · the Sources list ──
    section('B · browser — the Sources list (QuestionPanel → SourcesRegistry → SourceBrowser)')
    await mount('panel')
    await page.waitForSelector('text=Everything Lex found or worked out')
    await page.locator('button:has(span:text-is("Sources"))').first().click()
    await page.waitForSelector('[data-source-browser="list"] [data-source-count]')
    ok('the list shows all 7, Ref order by default', JSON.stringify(await shownNumbers()) === JSON.stringify([1, 2, 3, 4, 12, 13, 217]), JSON.stringify(await shownNumbers()))
    const pills = await page.locator('[data-quick-facet]').allInnerTexts()
    ok('three quick pills, in order, with counts: Documents 2 · Web pages 1 · Found by Lex 2', pills.map((p) => p.replace(/\s+/g, ' ').trim()).join(' | ') === '○ Documents 2 | ○ Web pages 1 | ○ Found by Lex 2', pills.join(' | '))
    await page.locator('[data-quick-facet="document"]').click()
    ok('"Documents" narrows the list to the two documents (a file and filed text — not pasted text, not the web page)', JSON.stringify(await shownNumbers()) === '[1,217]', JSON.stringify(await shownNumbers()))
    const on = page.locator('[data-quick-facet="document"]')
    ok('…and the pill that is on says so without colour: ● filled glyph, 2px border, aria-pressed', (await on.getAttribute('aria-pressed')) === 'true' && (await on.innerText()).includes('●') && /border-2/.test((await on.getAttribute('class')) ?? ''))
    control('the Web pages pill also showing as on (must be FALSE)', (await page.locator('[data-quick-facet="web"]').getAttribute('aria-pressed')) === 'true')
    await page.locator('[data-quick-facet="lex"]').click()
    ok('two pills together show either kind (Documents + Found by Lex)', JSON.stringify(await shownNumbers()) === '[1,12,13,217]', JSON.stringify(await shownNumbers()))
    await page.locator('[data-quick-facet="document"]').click(); await page.locator('[data-quick-facet="lex"]').click()
    await page.locator('[data-all-filters]').click()
    const kinds = (await page.locator('[data-filter-panel] fieldset').innerText()).replace(/\s+/g, ' ')
    ok('All filters lists every kind with its count', /Documents \(2\).*Web pages \(1\).*Pasted text \(1\).*My own notes \(1\).*Found by Lex \(2\)/.test(kinds), kinds)
    await page.locator('[data-facet="pasted"]').check()
    ok('"Pasted text" shows the pasted source alone', JSON.stringify(await shownNumbers()) === '[3]', JSON.stringify(await shownNumbers()))
    await page.locator('[data-facet="pasted"]').uncheck()
    const bearsOpts = await page.locator('[data-bears-on] option').allInnerTexts()
    ok('"Bears on" offers each action a source bears on, with how many: #31 (1), #207 (2)', bearsOpts.join(' | ') === 'any action | #31 (1) | #207 (2)', bearsOpts.join(' | '))
    await page.locator('[data-bears-on]').selectOption('207')
    ok('Bears on #207 shows the two sources tied to it', JSON.stringify(await shownNumbers()) === '[2,13]', JSON.stringify(await shownNumbers()))
    await page.locator('[data-bears-on]').selectOption('')
    await page.locator('[data-dups-only]').check()
    ok('"Possible duplicates" shows 12 and 13', JSON.stringify(await shownNumbers()) === '[12,13]', JSON.stringify(await shownNumbers()))
    const grp = (await page.locator('[data-dup-groups]').innerText()).replace(/\s+/g, ' ')
    ok('…the group is named with its reason, and nothing is merged', /\[Ref: 12\], \[Ref: 13\] — same document/.test(grp) && /Nothing is merged, and a number is never reused/.test(grp), grp)
    ok('…and each card says which it may duplicate', /Possible duplicate of \[Ref: 13\]/.test(await page.locator('li[data-source-number="12"]').innerText()))
    control('Ref 1 marked as a possible duplicate (must be FALSE)', (await page.locator('li[data-source-number="1"] [data-possible-duplicate]').count()) > 0)
    await page.locator('[data-dups-only]').uncheck()
    await page.locator('[data-source-sort]').selectOption('az')
    const azTitles = await page.locator('[data-sources-list] > li').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-source-number'))))
    ok('Sort A–Z orders by title', JSON.stringify(azTitles) === '[12,13,217,4,1,3,2]', JSON.stringify(azTitles))
    await page.locator('[data-source-sort]').selectOption('added')
    // the fixture's dates: 217 → 27 Oct (newest), 13 → 23 Oct, 12 → 22 Oct … 1 → 11 Oct (oldest)
    ok('Sort by date added puts the newest first', JSON.stringify(await shownNumbers()) === '[217,13,12,4,3,2,1]', JSON.stringify(await shownNumbers()))
    await page.locator('[data-source-search]').fill('management code')
    await page.waitForFunction(() => /found in/.test(document.querySelector('[data-source-count]')?.textContent ?? ''))
    ok('search narrows to what matches ("management code" → 217)', JSON.stringify(await shownNumbers()) === '[217]', JSON.stringify(await shownNumbers()))
    ok('…and says what it searched', /“management code” found in 1/.test(await page.locator('[data-source-count]').innerText()))
    await page.locator('[data-source-search]').fill('')
    await page.waitForFunction(() => document.querySelectorAll('[data-sources-list] > li').length === 7)
    ok('clearing the search shows all 7 again', (await shownNumbers()).length === 7)

    // ── C · Add research ──
    section('C · browser — Add research (298)')
    const last = () => page.evaluate(() => (window as never as { __r: { lastSave: Record<string, unknown> } }).__r.lastSave)
    const open = async () => { await mount('add'); await page.locator('button:has-text("Add research")').first().click(); await page.waitForSelector('[data-focus-dialog]') }
    await open()
    const dlg = page.locator('[data-focus-dialog]')
    const legends = await dlg.locator('legend').allInnerTexts()
    ok('the form opens on 1 · what, then 2 · Title — no source drop-down', legends.length === 2 && /^1 ·/.test(legends[0]) && /^2 · Title/i.test(legends[1]) && (await dlg.locator('select[aria-label="Which source"]').count()) === 0, legends.join(' | '))
    ok('Quote, Comment and More are hidden behind "+ Add a quote", "+ Add your comment", "+ More details"', (await dlg.locator('textarea[aria-label="Quote"]').count()) === 0 && (await dlg.locator('textarea[aria-label="Comment"]').count()) === 0 && (await dlg.locator('[data-more-panel]').count()) === 0
      && (await dlg.locator('[data-add-quote]').count()) === 1 && (await dlg.locator('[data-add-comment]').count()) === 1 && (await dlg.locator('[data-more-details]').count()) === 1)
    await dlg.locator('[data-add-quote]').click()
    ok('"+ Add a quote" opens the quote and its location', (await dlg.locator('textarea[aria-label="Quote"]').count()) === 1 && (await dlg.locator('input[aria-label="Where the quote is from"]').count()) === 1)
    await dlg.locator('[data-more-details]').click()
    ok('"+ More details" opens stance, tags and bears-on', /Supports/.test(await dlg.locator('[data-more-panel]').innerText()))

    // a file: the title from the file's name; "Already added" by the text's hash; Yes → a further note
    await page.evaluate(() => { (window as never as { __r: Record<string, unknown> }).__r.extractReply = { ok: true, title: 'Civil Service Management Code.pdf', filename: 'Civil Service Management Code.pdf', text: 'CIVIL SERVICE MANAGEMENT CODE. Chapter 1. Taking up appointment.', truncated: false, textHash: 'hash-of-the-management-code' } })
    await dlg.locator('input[type="file"]').setInputFiles({ name: 'Civil Service Management Code.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
    await page.waitForSelector('[data-already-added]')
    ok('2 · Title is prefilled from the file\'s name (without its extension), editable', (await dlg.locator('input[data-title]').inputValue()) === 'Civil Service Management Code' && !(await dlg.locator('input[data-title]').isDisabled()))
    const dupText = (await dlg.locator('[data-already-added]').innerText()).replace(/\s+/g, ' ')
    ok('the same file again: "Already added as [Ref: 217] … (the same text) — add this as a further note to it?"', /Already added as \[Ref: 217\]/.test(dupText) && /the same text/.test(dupText) && /add this as a further note to it\?/.test(dupText), dupText)
    await dlg.locator('[data-dup-yes]').click()
    ok('"Yes" makes it a further note on [Ref: 217] (shown in words), and the title field goes', (await dlg.locator('[data-further-note-on="217"]').count()) === 1 && (await dlg.locator('input[data-title]').count()) === 0)
    await dlg.locator('textarea[aria-label="Quote"]').fill('Taking up appointment.')
    await page.locator('[data-focus-dialog-foot] [data-save]').click()
    await page.waitForFunction(() => !!(window as never as { __r: { lastSave?: unknown } }).__r.lastSave)
    const s1 = await last() as { sourceId?: string; newSource?: unknown; quote?: string }
    ok('…and Save files the note against [Ref: 217] — no new source', s1.sourceId === 's217' && !s1.newSource && s1.quote === 'Taking up appointment.', JSON.stringify(s1).slice(0, 200))
    control('the save creating a second copy (must be FALSE)', !!s1.newSource)

    // a web address already on the list; "No" keeps it a new source
    await page.evaluate(() => { const r = (window as never as { __r: Record<string, unknown> }).__r; r.lastSave = undefined; r.extractReply = undefined })
    await open()
    await dlg.locator('input[aria-label="Web address"]').fill('https://gov.uk/government/publications/civil-service-code/the-civil-service-code/')
    await page.waitForSelector('[data-already-added="2"]')
    ok('the same page by another spelling of its address (no www, a trailing slash): "Already added as [Ref: 2] (the same web address)"', /the same web address/.test(await dlg.locator('[data-already-added]').innerText()))
    await dlg.locator('[data-dup-no]').click()
    ok('"No" dismisses it, and the title field stays for a new source', (await dlg.locator('[data-already-added]').count()) === 0 && (await dlg.locator('input[data-title]').count()) === 1)
    await page.keyboard.press('Escape')

    // the picker: "This is a further note on a source I've already added"
    await open()
    await dlg.locator('[data-further-note-link]').click()
    await page.waitForSelector('[data-further-note-picker] [data-source-search]')
    ok('the link opens the Sources list\'s own picker, with a search box that has the focus', await page.evaluate(() => document.activeElement?.hasAttribute('data-source-search') ?? false))
    ok('…with the same quick pills as the Sources list', (await page.locator('[data-further-note-picker] [data-quick-facet]').count()) === 3)
    ok('…and "My own observation" is not offered (a thought is written in the form)', !/My own observation/.test(await page.locator('[data-source-picker-list]').innerText()))
    await page.locator('[data-further-note-picker] [data-source-search]').fill('competency')
    await page.waitForFunction(() => document.querySelectorAll('[data-pick-source]').length === 2)
    ok('typing narrows it ("competency" → 12 and 13)', (await page.locator('[data-pick-source]').count()) === 2)
    await page.locator('[data-pick-source="13"]').click()
    ok('Choose → "A further note on [Ref: 13] …", with Change', (await dlg.locator('[data-further-note-on="13"]').count()) === 1 && /Change/.test(await dlg.locator('[data-further-note-on="13"]').innerText()))
    await dlg.locator('[data-add-comment]').click()
    await dlg.locator('textarea[aria-label="Comment"]').fill('The framework is the old one; the 2013–17 PDF is the one cited.')
    await page.locator('[data-focus-dialog-foot] [data-save]').click()
    await page.waitForFunction(() => !!(window as never as { __r: { lastSave?: unknown } }).__r.lastSave)
    const s2 = await last() as { sourceId?: string; comment?: string }
    ok('…Save files it against [Ref: 13]', s2.sourceId === 's13' && /2013–17/.test(s2.comment ?? ''), JSON.stringify(s2).slice(0, 200))

    // a thought alone
    await page.evaluate(() => { (window as never as { __r: Record<string, unknown> }).__r.lastSave = undefined })
    await open()
    await dlg.locator('[data-add-comment]').click()
    await dlg.locator('textarea[aria-label="Comment"]').fill('Departments already publish owners for major projects; extend that.')
    await page.locator('[data-focus-dialog-foot] [data-save]').click()
    await page.waitForFunction(() => !!(window as never as { __r: { lastSave?: unknown } }).__r.lastSave)
    const s3 = await last() as { ownObservation?: boolean; sourceId?: string; newSource?: unknown }
    ok('a thought alone is filed as "My own observation" (no source picked, none created)', s3.ownObservation === true && !s3.sourceId && !s3.newSource, JSON.stringify(s3).slice(0, 200))

    // a quote with no source cannot be saved, and says why
    await open()
    await dlg.locator('[data-add-quote]').click()
    await dlg.locator('textarea[aria-label="Quote"]').fill('Words from somewhere.')
    ok('a quote with no source cannot be saved, and the foot says why in words', await page.locator('[data-focus-dialog-foot] [data-save]').isDisabled() && /A quote needs its source/.test(await page.locator('[data-save-hint]').innerText()))
    // pasted text is filed as "pasted text"
    await dlg.locator('textarea[placeholder^="Paste an article"]').fill('A briefing I was sent: owners should be named in the annual report.')
    await dlg.locator('input[data-title]').fill('A briefing')
    await page.evaluate(() => { (window as never as { __r: Record<string, unknown> }).__r.lastSave = undefined })
    await page.locator('[data-focus-dialog-foot] [data-save]').click()
    await page.waitForFunction(() => !!(window as never as { __r: { lastSave?: unknown } }).__r.lastSave)
    const s4 = await last() as { newSource?: { kind?: string; sourceType?: string; title?: string } }
    ok('pasted text is filed as a DOCUMENT with sourceType "pasted text" (so the Sources list can count it as Pasted text)', s4.newSource?.kind === 'DOCUMENT' && s4.newSource?.sourceType === 'pasted text' && s4.newSource?.title === 'A briefing', JSON.stringify(s4).slice(0, 200))

    ok('no uncaught page error in the whole run', errors.length === 0, errors.join(' | ').slice(0, 400))
  } finally { await browser.close() }
}

async function main() {
  let summary: { groups: string[] } | null = null
  try { summary = await partA() } catch (e) { fail++; ran++; console.log(`  ✗ part A threw: ${(e as Error).message.slice(0, 300)}`) }
  await browserParts()
  if (summary) console.log(`\n452c5ade possible-duplicate groups (reported, not merged):\n  ${summary.groups.join('\n  ')}`)
  console.log(`\ncheck:lex-298-299 — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
