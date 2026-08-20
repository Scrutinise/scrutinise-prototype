/**
 * probe-3b-appg-route.ts — GRAPH 3B §2.1. The APPG register 403s from Node and LOADS IN A BROWSER
 * on this same machine. So it is not an IP block and it is not a bad path — it is the client.
 *
 * ⚠ This distinction decides whether §2.1 is buildable this sprint or is a blocker for Charlie, so
 * it gets measured rather than guessed. docs/CLAUDE.md §0.
 *
 *   evidence so far · publications.parliament.uk/    (homepage)      Node fetch → 403
 *                   · …/pa/cm/cmallparty/register/contents.htm       Node fetch → 403
 *                   · the same URL in claude-in-chrome                          → 200, full register
 *                   · members-api.parliament.uk                      Node fetch → 200
 *
 * Same machine, same egress IP, different result — so the block keys on the CLIENT, not the
 * network. Playwright drives a real Chromium with a real TLS fingerprint and is already a
 * dependency of this repo. If it gets through, §2.1 is an ordinary ingest job.
 *
 * Usage (from scripts/graph):  npx tsx probe-3b-appg-route.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

// ⚠ Static import, not `await import('playwright')` — the dynamic form resolves to a CJS namespace
// whose `chromium` is undefined here, which fails as "Cannot read properties of undefined". Matches
// scripts/ingest/test-fca-playwright.ts.
import { chromium } from 'playwright'

export {}

const URLS = [
  ['current register contents', 'https://publications.parliament.uk/pa/cm/cmallparty/250716/contents.htm'],
  ['archived 2015 contents', 'https://publications.parliament.uk/pa/cm/cmallparty/register/contents.htm'],
  ['a subject group page', 'https://publications.parliament.uk/pa/cm/cmallparty/register/beer.htm'],
]

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ locale: 'en-GB' })
  const page = await ctx.newPage()
  try {
    for (const [label, url] of URLS) {
      try {
        const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 })
        const text = await page.evaluate(() => document.body?.innerText ?? '')
        const title = await page.title()
        console.log(`   ${String(r?.status() ?? 0).padStart(3)}  ${label.padEnd(28)} ${String(text.length).padStart(8)} chars  "${title.slice(0, 70)}"`)
        if ((r?.status() ?? 0) === 200) {
          // Is it the register, or a Cloudflare interstitial that happens to be 200?
          const looksReal = /All-Party|Register/i.test(title) || /All-Party/i.test(text.slice(0, 400))
          console.log(`        ${looksReal ? '✓ real register content' : '⚠ 200 but does not look like the register — check for an interstitial'}`)
          console.log(`        first 160 chars: ${text.replace(/\s+/g, ' ').slice(0, 160)}`)
        }
      } catch (e) {
        console.log(`   ERR  ${label.padEnd(28)} ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
      }
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
