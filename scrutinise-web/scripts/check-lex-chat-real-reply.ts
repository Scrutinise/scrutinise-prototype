// ─────────────────────────────────────────────────────────────────────────────
// check:lex-chat-real-reply — CCh-Lex 28 Oct (2) item 1: 235 did not hold on REAL replies. check:lex-235-chat-browser renders a typed
// fixture; this one only ever uses text the model actually wrote.
//
// What was wrong (28 Oct): `stripViolations` — the honesty filter's last resort — rebuilt the reply from sentences joined with a SPACE,
// and its sentence splitter splits on every line break. Any reply that tripped one violation reached the chat as one paragraph with
// "## " mid-line. 452c5ade's replies of 23 Oct 17:06 and 27 Oct 10:05 are stored that way.
//
// A · cold read (§26): Charlie's own stored replies on 452c5ade, read with plain prisma. Each one that carries structure is put through
//     the REAL `stripViolations` with one of its own sentences flagged, and must keep every heading, list and table. Control: the old
//     join-with-a-space rebuild must LOSE them (a control that stays false). Already-flattened stored replies are counted and printed.
// B · live (--live, spends ≈10–20p): one real Lex turn on a SCRATCH copy, through `handleAgentTurn` — the same save the route uses —
//     then the stored content is read back and rendered by the REAL ChatPanel in Chromium. The rendered headings, list items and table
//     must match what the model's own raw text held. Also renders a Part A stripped reply in the same panel.
//
//   npm run check:lex-chat-real-reply              (A, and B reported NOT RUN)
//   npm run check:lex-chat-real-reply -- --live    (A and B)
// Counts what RAN (§23.2).
// ─────────────────────────────────────────────────────────────────────────────

import { join } from 'node:path'
import { build } from 'esbuild'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { markdownToBlocks } from '../lib/documents/markdown'
import { stripViolations, splitSentences, type Violation } from '../lib/lex/agent/honesty'
import { handleAgentTurn } from '../lib/lex/agent/turn'
import { enterPurpose } from '../lib/lex/build-context'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade-3153-400a-bf48-3b71aaa52773'
const LIVE = process.argv.includes('--live')
const ROOT = join(__dirname, '..')

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)

type Shape = { headings: number; listItems: number; tables: number }
/** What the markdown source holds, counted from its lines — independent of the parser under test. */
function sourceShape(md: string): Shape {
  const lines = md.split('\n')
  const tables = lines.reduce((n, l, i) => n + (/^\s*\|/.test(l) && !/^\s*\|/.test(lines[i - 1] ?? '') ? 1 : 0), 0)
  return {
    headings: lines.filter((l) => /^#{1,6}\s+\S/.test(l)).length,
    listItems: lines.filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length,
    tables,
  }
}
function parsedShape(md: string): Shape {
  const b = markdownToBlocks(md) as Array<{ kind: string; items?: unknown[] }>
  return {
    headings: b.filter((x) => x.kind === 'heading').length,
    listItems: b.filter((x) => x.kind === 'bullets').reduce((n, x) => n + (x.items?.length ?? 0), 0),
    tables: b.filter((x) => x.kind === 'table').length,
  }
}
const same = (a: Shape, b: Shape) => a.headings === b.headings && a.listItems === b.listItems && a.tables === b.tables
/** The rebuild that shipped until 28 Oct, kept ONLY as the control. */
const oldRebuild = (reply: string, bad: string) => splitSentences(reply).filter((s) => s !== bad).join(' ').trim()

let strippedSample: { reply: string; shape: Shape } | null = null

async function partA() {
  section('A · cold read — Charlie\'s real stored replies through the real stripViolations')
  const idea = await prisma.idea.findUnique({ where: { id: SOURCE }, select: { aiChatHistory: true } })
  const lex = ((idea?.aiChatHistory as Array<Record<string, unknown>>) ?? []).filter((m) => m.role === 'lex').map((m) => ({ at: String(m.timestamp ?? ''), text: String(m.content ?? '') }))
  const flattened = lex.filter((m) => /[^\n]#{2,3} \S/.test(m.text) && (m.text.match(/\n/g) ?? []).length <= 2)
  console.log(`  ${lex.length} stored Lex replies; ${flattened.length} already stored flattened (${flattened.map((m) => m.at.slice(0, 16)).join(', ') || 'none'}) — the fix cannot restore those`)
  const structured = lex.filter((m) => { const s = sourceShape(m.text); return s.headings + s.tables > 0 && s.listItems > 0 })
  if (!structured.length) { skip('A', 'no stored reply with headings or tables AND a list'); return }
  let checked = 0
  for (const m of structured) {
    // A real sentence of the reply's own prose — never a heading, list item or table row — stands in for the flagged claim.
    const bad = splitSentences(m.text).find((s) => !/^(#|\||[-*•]\s|\d+[.)]\s)/.test(s) && s.length > 30)
    if (!bad) continue
    checked++
    const v: Violation[] = [{ kind: 'unconfirmed-claim', sentence: bad, detail: 'check' }]
    const out = stripViolations(m.text, v, [])
    const before = parsedShape(m.text), after = parsedShape(out)
    ok(`${m.at.slice(0, 16)}: keeps ${before.headings} heading(s), ${before.listItems} list item(s), ${before.tables} table(s) after a sentence is removed`, same(before, after) && !out.includes(bad), `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`)
    control(`${m.at.slice(0, 16)}: the pre-28-Oct rebuild keeping that structure (must be FALSE)`, same(before, parsedShape(oldRebuild(m.text, bad))))
    if (!strippedSample) strippedSample = { reply: out, shape: sourceShape(out) }
  }
  console.log(`  ${checked} real replies put through the filter`)
}

type Rendered = { headings: number; listItems: number; tables: number; hashes: boolean; stars: boolean; text: string }

async function renderInChatPanel(reply: string): Promise<Rendered | string> {
  let chromium: typeof import('playwright').chromium
  try { chromium = (await import('playwright')).chromium } catch (e) { return `playwright is not loadable: ${(e as Error).message}` }
  const r = await build({
    entryPoints: [join(ROOT, 'scripts/fixtures/chat-md-harness-entry.tsx')], bundle: true, write: false, format: 'iife', jsx: 'automatic', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent', tsconfig: join(ROOT, 'tsconfig.json'),
  })
  let browser
  try { browser = await chromium.launch() } catch (e) { return `Chromium would not launch: ${(e as Error).message.slice(0, 120)}` }
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
    await page.route('http://harness.test/', (rt) => rt.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' }))
    await page.route('**/api/**', (rt) => rt.fulfill({ contentType: 'application/json', body: '{}' }))
    await page.goto('http://harness.test/')
    await page.evaluate((reply) => { (window as unknown as { __chat: unknown }).__chat = { reply, userText: 'check' } }, reply)
    await page.addScriptTag({ content: r.outputFiles[0].text })
    await page.locator('#chat-panel [data-md="reply"]').first().waitFor({ timeout: 10000 }).catch(() => {})
    return await page.evaluate(() => {
      const root = (document.querySelector('#chat-panel [data-md="reply"]') ?? document.createElement('div')) as HTMLElement
      const t = root.innerText
      return {
        headings: root.querySelectorAll('[data-md="heading"]').length,
        listItems: root.querySelectorAll('li').length,
        tables: root.querySelectorAll('table').length,
        hashes: /(^|\n)#{1,6} /.test(t) || /\S #{2,3} \S/.test(t),
        stars: t.includes('**'),
        text: t,
      }
    })
  } finally { await browser.close() }
}

function assertRendered(label: string, raw: Shape, seen: Rendered) {
  ok(`${label}: ${raw.headings} heading(s) render as headings`, seen.headings === raw.headings && !seen.hashes, `rendered ${seen.headings}, "#" left: ${seen.hashes}`)
  ok(`${label}: ${raw.listItems} list item(s) render as list items`, seen.listItems === raw.listItems, `rendered ${seen.listItems}`)
  ok(`${label}: ${raw.tables} table(s) render as tables`, seen.tables === raw.tables, `rendered ${seen.tables}`)
  ok(`${label}: no "**" left in the bubble`, !seen.stars)
}

async function partB() {
  section('B · live — a real model reply, saved by handleAgentTurn, read back, rendered by the real ChatPanel')
  if (!LIVE) { skip('B (live turn + browser)', 'pass --live; it spends one Lex turn, ≈10–20p, on a scratch copy'); return }

  // Records every response the model sends, so the model's OWN text can be compared with what was stored.
  const real = new Anthropic({ timeout: 120_000, maxRetries: 2 })
  const responses: Anthropic.Message[] = []
  const client = { messages: { create: async (p: unknown) => { const res = await real.messages.create(p as never) as Anthropic.Message; responses.push(res); return res } } } as unknown as Anthropic

  const copy = await scratchCopy(SOURCE, 'chat-real-reply')
  try {
    enterPurpose('check')
    const r = await handleAgentTurn({
      ideaId: copy.id, user: { id: copy.userId }, idea: { id: copy.id, creatorId: copy.userId, aiChatHistory: [] },
      message: 'Without changing anything: give me a short overview of three of my actions. Use a heading, then a bulleted list naming the three, then a small table of their numbers and titles.',
      readOnly: true, client, clientTurnId: `check-${Date.now()}`,
    })
    ok('the turn completed', r.status === 200, `status ${r.status}`)
    const final = [...responses].reverse().find((m) => m.stop_reason !== 'tool_use')
    const modelText = final ? final.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('') : ''
    const raw = sourceShape(modelText)
    console.log(`  the model wrote ${modelText.length} chars, ${(modelText.match(/\n/g) ?? []).length} line breaks; shape ${JSON.stringify(raw)}; turn cost ${r.result?.cost.pence.toFixed(2)}p`)
    ok('the model\'s own reply carries structure to test (a heading or table, and a list)', raw.headings + raw.tables > 0 && raw.listItems > 0, JSON.stringify(raw))

    const stored = ((await prisma.idea.findUnique({ where: { id: copy.id }, select: { aiChatHistory: true } }))?.aiChatHistory as Array<Record<string, unknown>> ?? [])
      .filter((m) => m.role === 'lex').pop()
    const storedText = String(stored?.content ?? '')
    ok('the stored reply keeps the model\'s line breaks', (storedText.match(/\n/g) ?? []).length >= (modelText.trim().match(/\n/g) ?? []).length - 2, `model ${(modelText.match(/\n/g) ?? []).length}, stored ${(storedText.match(/\n/g) ?? []).length}`)
    ok('the stored reply keeps the model\'s shape', same(sourceShape(storedText), raw), `stored ${JSON.stringify(sourceShape(storedText))}`)

    const seen = await renderInChatPanel(storedText)
    if (typeof seen === 'string') skip('the browser half', seen)
    else assertRendered('the stored live reply in ChatPanel', raw, seen)
  } finally {
    await deleteScratch(copy.id)
    const left = await prisma.idea.findUnique({ where: { id: copy.id }, select: { deletedAt: true } })
    ok('the scratch copy is gone (re-read)', !left || !!left.deletedAt)
  }

  if (strippedSample) {
    const sample: { reply: string; shape: Shape } = strippedSample
    const seen = await renderInChatPanel(sample.reply)
    if (typeof seen === 'string') skip('the stripped real reply in the browser', seen)
    else assertRendered('a real reply after the honesty filter, in ChatPanel', sample.shape, seen)
  } else skip('the stripped real reply in the browser', 'Part A produced none')
}

async function main() {
  await partA()
  await partB()
  console.log(`\ncheck:lex-chat-real-reply — ${pass} passed, ${fail} failed — ${ran} assertions ran, ${controls} controls (${dead} dead), ${notRun} not run`)
  await prisma.$disconnect()
  process.exit(fail || dead ? 1 : 0)
}
main()
