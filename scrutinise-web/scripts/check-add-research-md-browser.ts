// ─────────────────────────────────────────────────────────────────────────────
// check:add-research-md-browser — 22 Oct (CCh): "+ Add research" refused a .md file because the browser labelled it
// application/text. A text file is now read as text by its extension and by what its bytes are, never by the label alone.
//
// A · offline: extractFile, the one function every upload path calls.
// B · the browser: the REAL AddResearch dialog in Chromium (the 26-S2 harness) uploads a .md fixture labelled
//     application/text. The upload is handed to the REAL extract route (app/api/ideas/[id]/research-notebook/extract),
//     with the stub-auth seam, on a scratch copy of 452c5ade — so what is asserted is what the browser shows from the
//     real server's answer. Control: a ".md" whose bytes are not text is refused, and the refusal names ".md".
//
//   npx tsx --tsconfig tsconfig.json --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-add-research-md-browser.ts
// Counts what RAN (§23.2). A browser that cannot launch is NOT RUN, never a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { prisma } from '../lib/prisma'
import { extractFile, MaterialRejected } from '../lib/lex/user-material'
import { POST as extractRoute } from '../app/api/ideas/[id]/research-notebook/extract/route'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

const MD = Buffer.from('# Precedents\n\nThe Building Safety Act 2022 names an *accountable person* for each higher-risk building — £ and “quotes” survive.\n', 'utf8')
const NOT_TEXT = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0, 1, 2, 3, 0, 0, 255, 254, 0, 7])])

async function refusal(bytes: Buffer, mime: string, name: string): Promise<string | null> {
  try { await extractFile(bytes, mime, name); return null } catch (e) { return e instanceof MaterialRejected ? e.message : `THREW ${String(e)}` }
}

async function partA() {
  section('A · offline — extractFile decides by extension and bytes, not by the label')
  const md = await extractFile(MD, 'application/text', 'precedents.md').catch((e) => e as Error)
  ok('a .md labelled application/text (what Charlie\'s browser sent) is read, text intact', !(md instanceof Error) && md.text.includes('accountable person') && md.text.includes('£') && md.text.includes('“quotes”'), md instanceof Error ? md.message : '')
  for (const [name, mime] of [['notes.markdown', ''], ['notes.txt', 'application/octet-stream'], ['table.csv', 'text/csv'], ['notes.md', 'text/markdown']] as const) {
    ok(`${name} sent as "${mime || '(no label)'}" is read`, (await refusal(MD, mime, name)) === null)
  }
  const fake = await refusal(NOT_TEXT, 'text/plain', 'fake.md')
  ok('a ".md" whose bytes are NOT text is refused even though the label says text/plain — and the refusal names ".md"', !!fake && fake.includes('.md') && /not text/.test(fake), fake ?? 'accepted')
  control('the not-text file being accepted (must be FALSE)', fake === null)
  const png = await refusal(NOT_TEXT, 'image/png', 'chart.png')
  ok('an image is refused, naming the extension ".png"', !!png && png.includes('.png'), png ?? 'accepted')
  ok('a Windows-1252 .txt (a £ as byte 0xA3) is read, the £ intact', ((await extractFile(Buffer.from([0x43, 0x6f, 0x73, 0x74, 0x20, 0xa3, 0x35]), 'text/plain', 'cost.txt')).text) === 'Cost £5')
}

async function partB() {
  section('B · the browser — the real dialog, the real route, a .md fixture labelled application/text')
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

  const copy = await scratchCopy('452c5ade', 'md-upload')
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: copy.userId } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = owner
  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); await deleteScratch(copy.id); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const sentTypes: string[] = []
    const answers: string[] = []
    // The page needs an origin so the dialog's relative fetch resolves; the harness answers everything else itself.
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    // ⚠ THE REAL ROUTE: the browser's own multipart body, unchanged, into the product's handler.
    await page.route('**/research-notebook/extract', async (r) => {
      const req = r.request()
      const body = req.postDataBuffer() ?? Buffer.alloc(0)
      sentTypes.push(/Content-Type: ([^\r\n]+)/.exec(body.toString('latin1'))?.[1] ?? '?')
      const res = await extractRoute(new Request('http://internal.invalid/extract', { method: 'POST', headers: { 'content-type': req.headers()['content-type'] }, body }), { params: Promise.resolve({ id: copy.id }) })
      const out = await res.text()
      answers.push(`${res.status} ${out.slice(0, 160)}`)
      await r.fulfill({ status: res.status, contentType: 'application/json', body: out })
    })
    await page.goto('http://harness.test/')
    await page.addScriptTag({ content: bundle })
    await page.evaluate(() => (window as never as { __mountResearch: (w: string) => void }).__mountResearch('panel'))
    await page.waitForSelector('text=Everything Lex found or worked out')
    await page.locator('button:has(span:text-is("Sources"))').first().click()
    await page.waitForSelector('[data-sources-one-list]')

    const upload = async (name: string, mimeType: string, buffer: Buffer) => {
      await page.locator('[data-sources-one-list] button:has-text("Add research")').click()
      await page.waitForSelector('[data-focus-dialog]')
      await page.locator('[data-focus-dialog] input[type=file]').setInputFiles({ name, mimeType, buffer })
      await page.waitForFunction((n) => { const t = document.querySelector('[data-focus-dialog]')?.textContent ?? ''; return t.includes(`Read “${n}”`) || /not read|isn’t one of them|is not text/.test(t) }, name, { timeout: 30_000 })
        .catch(async () => console.log(`      (no outcome shown for ${name}; route answers so far: ${JSON.stringify(answers)}; dialog: ${(await page.locator('[data-focus-dialog]').innerText().catch(() => '(none)')).replace(/\s+/g, ' ').slice(0, 500)})`))
      const text = (await page.locator('[data-focus-dialog]').innerText()).replace(/\s+/g, ' ')
      const area = await page.locator('[data-focus-dialog] textarea').first().inputValue().catch(() => '')
      await page.keyboard.press('Escape')
      return { text, area }
    }

    const good = await upload('precedents.md', 'application/text', MD)
    ok('the browser really sent the file as application/text (the fixture reproduces the defect)', sentTypes[0] === 'application/text', sentTypes.join(', '))
    ok('the dialog says it READ "precedents.md" — no refusal', good.text.includes('Read “precedents.md”') && !/isn’t one of them|not read/.test(good.text), good.text.slice(0, 400))
    ok('…and the file\'s text is in the dialog, ready to quote (£ and curly quotes intact)', good.area.includes('accountable person') && good.area.includes('£') && good.area.includes('“quotes”'), good.area.slice(0, 200))

    const bad = await upload('fake.md', 'application/text', NOT_TEXT)
    ok('a ".md" that is not text is refused IN THE DIALOG, in words naming ".md"', /\.md/.test(bad.text) && /not text/.test(bad.text) && !bad.text.includes('Read “fake.md”'), bad.text.slice(0, 400))
    control('the not-text ".md" shown as read (must be FALSE)', bad.text.includes('Read “fake.md”'))
    ok('no uncaught page error in the whole run', errors.length === 0, errors.join(' | ').slice(0, 400))
  } finally {
    await browser.close()
    await deleteScratch(copy.id)
  }
}

async function main() {
  await partA()
  await partB()
  console.log(`\ncheck:add-research-md-browser — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  if (fail || dead) process.exit(1)
  if (ran === 0) { console.log('NOT CHECKED — nothing ran'); process.exit(1) }
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
