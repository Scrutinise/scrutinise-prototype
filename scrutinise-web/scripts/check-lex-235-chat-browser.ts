// ─────────────────────────────────────────────────────────────────────────────
// check:lex-235-chat-browser — 235 (CCh 22 Oct (7)): the chat panel renders Lex's markdown (headings, bold, lists, paragraphs, tables), and
// Lex is told to lay replies out that way.
//
// A · offline: the prompt carries the layout rule; the shared parser leaves an underscore inside a word alone.
// B · the browser: the REAL ChatPanel and the REAL AskLexPanel in Chromium, given one Lex reply holding every element. Asserted on the rendered
//     DOM of each, not on source: a heading with no "#", bold with no "**", a three-item list, a numbered list, separate paragraphs, a table
//     with its cells, tool names with their underscores, an unsafe link left unlinked. Control: the USER's own "**" in the same chat stays
//     literal — the user's words are never reformatted.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/check-lex-235-chat-browser.ts
// Counts what RAN (§23.2). A browser that cannot launch is NOT RUN, never a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import { SYSTEM_PREFIX } from '../lib/lex/agent/system-prompt'
import { parseInline, markdownToBlocks } from '../lib/documents/markdown'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')

// A fixture about a placeholder subject (§27): nothing here could be lifted into a real reply as content.
const REPLY = [
  '## Fixture heading',
  '',
  'First fixture paragraph, with **fixture bold** in it.',
  '',
  'Second fixture paragraph, naming read_section and search_corpus.',
  '',
  '- fixture item one',
  '- fixture item two',
  '- fixture item three',
  '',
  '1. fixture step one',
  '2. fixture step two',
  '',
  '| Fixture column A | Fixture column B |',
  '| --- | --- |',
  '| cell a1 | cell b1 |',
  '| cell a2 | cell b2 |',
  '',
  'A [fixture link](javascript:alert(1)) that must stay unlinked, and a [safe one](https://example.org/).',
].join('\n')
const USER_TEXT = 'my own **stars** stay as typed'

function partA() {
  section('A · offline — the instruction and the parser')
  ok('Lex\'s system prompt says the chat shows markdown', /shows your reply as markdown/.test(SYSTEM_PREFIX))
  ok('…and asks for short paragraphs, a list at three or more items, one-line headings, never a wall', /short paragraphs/.test(SYSTEM_PREFIX) && /three or more items/.test(SYSTEM_PREFIX) && /single line/.test(SYSTEM_PREFIX) && /Never a wall of text/.test(SYSTEM_PREFIX))
  ok('the old "plain text … nothing to format" line is gone', !/nothing to format for a parser/.test(SYSTEM_PREFIX))
  const snake = parseInline('read_section and search_corpus')
  ok('an underscore inside a word is not emphasis', snake.every((r) => !r.italic) && snake.map((r) => r.text).join('') === 'read_section and search_corpus', JSON.stringify(snake))
  const em = parseInline('an _emphasised_ word')
  ok('…while _word_ on its own is still emphasis', em.some((r) => r.italic && r.text === 'emphasised'), JSON.stringify(em))
  const kinds = markdownToBlocks(REPLY).map((b) => b.kind)
  ok('the fixture parses to heading, paragraphs, two lists and a table', ['heading', 'paragraph', 'bullets', 'table'].every((k) => kinds.includes(k as never)) && kinds.filter((k) => k === 'bullets').length === 2, kinds.join(','))
}

type Seen = { heading: string[]; hashes: boolean; strong: string[]; stars: boolean; ul: number; ol: number; paragraphs: number; th: string[]; td: number; pipes: boolean; text: string; emInside: boolean; jsLinks: number; safeLinks: number }

async function partB() {
  section('B · the browser — the real ChatPanel and AskLexPanel, one reply holding every element')
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { skip('the browser section', `playwright is not loadable: ${(e as Error).message}`); return }
  let bundle: string
  try {
    const r = await build({
      entryPoints: [join(ROOT, 'scripts/fixtures/chat-md-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
      define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'),
    })
    bundle = r.outputFiles[0].text
  } catch (e) { fail++; ran++; console.log(`  ✗ the harness did not bundle: ${(e as Error).message.slice(0, 600)}`); return }

  let browser
  try { browser = await chromium.launch() } catch (e) { skip('the browser section', `Chromium would not launch: ${(e as Error).message.slice(0, 120)}`); return }
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('http://harness.test/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    // Anything the panels ask for gets an empty answer; AskLexPanel's own request gets the reply. ⚠ Playwright tries the most recently
    // registered route first, so the catch-all is registered BEFORE the specific one.
    await page.route('**/api/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
    await page.route('**/api/ideas/harness/lex', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ chatText: REPLY }) }))
    await page.goto('http://harness.test/')
    await page.evaluate(([reply, userText]) => { (window as unknown as { __chat: unknown }).__chat = { reply, userText } }, [REPLY, USER_TEXT])
    await page.addScriptTag({ content: bundle })

    // AskLexPanel: ask, so the reply arrives through the panel's own fetch.
    const ask = page.locator('#ask-lex')
    await ask.locator('textarea').fill('fixture question')
    await ask.locator('button', { hasText: /ask|send/i }).last().click()
    await ask.locator('[data-md="heading"]').waitFor({ timeout: 10000 }).catch(() => {})

    const read = (sel: string) => page.evaluate((s) => {
      // No rendered reply (the plain-text bubble) reads as an empty one, so every assertion below fails by name rather than the check crashing.
      const root = (document.querySelector(s)!.querySelector('[data-md="reply"]') ?? document.createElement('div')) as HTMLElement
      const t = root.innerText
      return {
        heading: Array.from(root.querySelectorAll('[data-md="heading"]')).map((e) => (e as HTMLElement).innerText),
        hashes: /(^|\n)#{1,6} /.test(t),
        strong: Array.from(root.querySelectorAll('strong')).map((e) => (e as HTMLElement).innerText),
        stars: t.includes('**'),
        ul: root.querySelectorAll('ul > li').length,
        ol: root.querySelectorAll('ol > li').length,
        paragraphs: root.querySelectorAll('[data-md="paragraph"]').length,
        th: Array.from(root.querySelectorAll('th')).map((e) => (e as HTMLElement).innerText),
        td: root.querySelectorAll('td').length,
        pipes: t.includes('|'),
        text: t,
        emInside: Array.from(root.querySelectorAll('em')).some((e) => /section and search/.test((e as HTMLElement).innerText)),
        jsLinks: root.querySelectorAll('a[href^="javascript"]').length,
        safeLinks: root.querySelectorAll('a[href="https://example.org/"]').length,
      }
    }, sel) as Promise<Seen>

    for (const [name, sel] of [['ChatPanel (the agent chat)', '#chat-panel'], ['AskLexPanel (the Ask tab)', '#ask-lex']] as const) {
      const s = await read(sel)
      ok(`${name}: the heading renders as one line of its own, with no "#"`, s.heading.length === 1 && s.heading[0] === 'Fixture heading' && !s.hashes, JSON.stringify(s.heading))
      ok(`${name}: bold renders as bold, with no "**" left`, s.strong.includes('fixture bold') && !s.stars, JSON.stringify(s.strong))
      ok(`${name}: the three items are a bulleted list`, s.ul === 3, `ul items ${s.ul}`)
      ok(`${name}: the steps are a numbered list`, s.ol === 2, `ol items ${s.ol}`)
      ok(`${name}: the paragraphs are separate paragraphs`, s.paragraphs >= 3, `paragraphs ${s.paragraphs}`)
      ok(`${name}: the table renders with its header and four cells, no "|" left`, s.th.join('/') === 'Fixture column A/Fixture column B' && s.td === 4 && !s.pipes, `th ${JSON.stringify(s.th)} td ${s.td}`)
      ok(`${name}: tool names keep their underscores and italicise nothing between them`, s.text.includes('read_section and search_corpus') && !s.emInside)
      ok(`${name}: a javascript: link is not drawn as a link; the https one is`, s.jsLinks === 0 && s.safeLinks === 1, `js ${s.jsLinks} safe ${s.safeLinks}`)
    }
    const user = await page.evaluate(() => {
      const bubbles = Array.from(document.querySelectorAll('#chat-panel div')).filter((d) => (d as HTMLElement).innerText === 'my own **stars** stay as typed')
      const seen = Array.from(document.querySelectorAll('#chat-panel *')).map((d) => (d as HTMLElement).innerText).filter((t) => t && t.includes('stars')).slice(-3)
      return { found: bubbles.length > 0, strong: bubbles.some((b) => b.querySelector('strong')), seen }
    })
    if (!user.found) console.log(`      what the chat panel shows for the user's line: ${JSON.stringify(user.seen)}`)
    ok('the user\'s own message is shown exactly as typed, stars and all', user.found)
    control('the user\'s "**stars**" being turned into bold (must be FALSE)', user.strong)
    ok('no page errors', errors.length === 0, errors.join(' | '))
  } finally { await browser.close() }
}

async function main() {
  partA()
  await partB()
  console.log(`\ncheck:lex-235-chat-browser — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  process.exit(fail || dead ? 1 : 0)
}
main()
