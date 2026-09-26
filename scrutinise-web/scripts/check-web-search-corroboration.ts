/**
 * check-web-search-corroboration.ts — S25 §7. Pure unit tests for
 * `dedupeFalseCorroboration()`, no live API calls — the two shapes this must tell apart:
 *
 *   - IDENTICAL snippet text across DIFFERENT urls  → the defect. Collapse to one.
 *   - DIFFERENT snippet text from the SAME url       → legitimate corroboration. Keep both.
 *
 * Modelled on the two real cases from this session's measurement (docs/SEARCH_S25_REPORT.md):
 * the Germany/Airbnb question (7 urls, 1 identical sentence — the defect) and the Irish
 * minimum-wage question (1 url, 4 different figures — legitimate, must survive).
 *
 * Usage: tsx scripts/check-web-search-corroboration.ts
 */
import { dedupeFalseCorroboration } from '../lib/lex/orientation/web-search'
import type { WebSearchResult } from '../lib/lex/orientation/web-search'

export {}

let passed = 0, failed = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function r(url: string, snippet: string): WebSearchResult {
  return { url, redirectUrl: undefined, title: `title for ${url}`, date: null, snippet, provider: 'google' }
}

function main() {
  console.log('the defect: identical sentence across different URLs (Germany/Airbnb shape)')
  {
    const sentence = 'Short-term rental hosts in Germany must register with local authorities under the Wohnraumzweckentfremdungsgesetz.'
    const results = Array.from({ length: 7 }, (_, i) => r(`https://example${i}.de/page`, sentence))
    const out = dedupeFalseCorroboration(results)
    check('collapses 7 identical-snippet results from 7 different URLs to 1', out.length === 1, `got ${out.length}`)
  }

  console.log('\nthe legitimate case: different facts, same URL (Irish minimum-wage shape)')
  {
    const results = [
      r('https://gov.ie/minimum-wage', 'Workers aged 20 and over: €12.70 per hour.'),
      r('https://gov.ie/minimum-wage', 'Workers aged 19: €11.43 per hour (90% of the full rate).'),
      r('https://gov.ie/minimum-wage', 'Workers aged 18: €10.16 per hour (80% of the full rate).'),
      r('https://gov.ie/minimum-wage', 'Workers aged under 18: €8.89 per hour (70% of the full rate).'),
    ]
    const out = dedupeFalseCorroboration(results)
    check('all 4 distinct facts from the SAME url survive untouched', out.length === 4, `got ${out.length}`)
  }

  console.log('\nan ordinary duplicate: identical snippet, SAME url — also collapses')
  {
    const results = [r('https://x.com/a', 'same fact'), r('https://x.com/a', 'same fact')]
    const out = dedupeFalseCorroboration(results)
    check('collapses to 1 (a plain duplicate, not corroboration at all)', out.length === 1)
  }

  console.log('\nmixed: some genuinely distinct, some falsely corroborating, in one batch')
  {
    const results = [
      r('https://a.com', 'fact A'),
      r('https://b.com', 'fact A'), // false corroboration with the row above
      r('https://a.com', 'fact B'), // legitimately distinct, same url as row 1
      r('https://c.com', 'fact C'),
    ]
    const out = dedupeFalseCorroboration(results)
    check('reduces from 4 to 3 (only the "fact A" pair collapses)', out.length === 3, `got ${out.length}`)
    check('"fact B" and "fact C" both survive', out.some((x) => x.snippet === 'fact B') && out.some((x) => x.snippet === 'fact C'))
  }

  console.log('\nempty snippets are never collapsed — nothing to compare')
  {
    const results = [r('https://a.com', ''), r('https://b.com', ''), r('https://c.com', '')]
    const out = dedupeFalseCorroboration(results)
    check('all 3 survive despite all having empty snippets', out.length === 3, `got ${out.length}`)
  }

  console.log('\ncase/whitespace-only differences still count as identical')
  {
    const results = [r('https://a.com', 'The  Rate Is  £10.'), r('https://b.com', 'the rate is £10.')]
    const out = dedupeFalseCorroboration(results)
    check('collapses despite whitespace/case differences', out.length === 1, `got ${out.length}`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) process.exit(1)
}

main()
