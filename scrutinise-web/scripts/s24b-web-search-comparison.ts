// ─────────────────────────────────────────────────────────────────────────────────────────
// S24b item 3 — "the comparison CC could not run."
//
// ⚠ THE PREMISE THAT MOTIVATED THE ORIGINAL PLAN (a temporary admin route / Railway job,
// because "only CC's sandbox is blocked" from reaching Anthropic) was tested and found FALSE
// for this session: `curl` from this machine reached api.anthropic.com, api.x.ai and Google's
// API directly, all three returning proper auth errors rather than a network-level block, and
// a real authenticated Anthropic call succeeded. So this runs as a plain script against the
// SAME `webSearch()` function general-chat.ts calls in production — no temporary route to
// build, deploy or remove.
//
// Ten questions, chosen to match general-chat.ts's own SEARCH_DECISION_SYSTEM criteria
// (today's news, a very recent event, comparative foreign practice, a live political row,
// current prices/figures) — the shape of question this feature exists to answer. Providers
// per question: google, anthropic, and (S25) openai — xai is the EXISTING default and out of
// this brief's scope. ⚠ The openai arm requires OPENAI_API_KEY, which is in Vercel
// (production) but NOT in this machine's local .env as of 25 Sep 2026 — running this script
// locally will silently skip openai (searchOpenAI returns null with no key, same as any
// other adapter) until that key is added locally too, or the script is run from production.
//
// This spends real money and writes real LlmSpend ledger rows (stream: 'admin',
// pass: 's24b.web-search-comparison') — the same path general-chat.ts's chat web search
// writes through, so the numbers this measures are the numbers a real deployment would see.
//
// Usage:
//   npx tsx --env-file=.env scripts/s24b-web-search-comparison.ts
// ─────────────────────────────────────────────────────────────────────────────────────────

import { webSearch, type WebSearchProvider } from '../lib/lex/orientation/web-search'

const QUESTIONS = [
  { q: 'What is the current UK inflation rate?', kind: 'current figures' },
  { q: 'Has the UK announced any changes to Universal Credit in the last month?', kind: 'recent event' },
  { q: 'How does Germany regulate short-term rental platforms like Airbnb?', kind: 'comparative foreign practice' },
  { q: "What is the latest news on the UK's Renters' Rights Bill?", kind: 'recent event / live process' },
  { q: "How does France's carbon tax scheme compare to the UK's carbon pricing?", kind: 'comparative foreign practice' },
  { q: 'What did the Chancellor announce in the most recent Budget statement?', kind: 'recent event' },
  { q: 'Is there a current public row over NHS waiting list figures?', kind: 'live political row' },
  { q: 'What is the current minimum wage in Ireland compared to the UK?', kind: 'comparative + current figures' },
  { q: "What's the latest on the UK Government's AI regulation plans?", kind: 'recent event' },
  { q: 'How does Canada handle single-use plastic bans compared to the UK?', kind: 'comparative foreign practice' },
]

const PROVIDERS: WebSearchProvider[] = ['google', 'anthropic', 'openai']

async function main() {
  const rows: Array<{
    question: string; kind: string; provider: WebSearchProvider
    ok: boolean; ms: number; costUsd: number; resultCount: number
    reason?: string
    results: Array<{ url: string; title: string; date: string | null; snippet: string }>
  }> = []

  for (const { q, kind } of QUESTIONS) {
    for (const provider of PROVIDERS) {
      process.stderr.write(`[${provider}] ${q.slice(0, 60)}…\n`)
      const out = await webSearch({
        query: q, provider, stream: 'admin', pass: 's24b.web-search-comparison', label: 's24b-comparison',
      })
      rows.push({
        question: q, kind, provider,
        ok: out.ok, ms: out.ms, costUsd: out.costUsd, resultCount: out.results.length,
        reason: out.reason,
        results: out.results.map((r) => ({ url: r.url, title: r.title, date: r.date, snippet: r.snippet })),
      })
      process.stderr.write(`  ok=${out.ok} ms=${out.ms} cost=$${out.costUsd.toFixed(4)} results=${out.results.length}${out.reason ? ` reason=${out.reason}` : ''}\n`)
    }
  }

  console.log(JSON.stringify(rows, null, 2))

  // ── summary ──
  for (const provider of PROVIDERS) {
    const mine = rows.filter((r) => r.provider === provider)
    const totalCost = mine.reduce((s, r) => s + r.costUsd, 0)
    const totalMs = mine.reduce((s, r) => s + r.ms, 0)
    const totalResults = mine.reduce((s, r) => s + r.resultCount, 0)
    const failures = mine.filter((r) => !r.ok).length
    process.stderr.write(`\n── ${provider} ──\n`)
    process.stderr.write(`  questions: ${mine.length}, failures: ${failures}\n`)
    process.stderr.write(`  total cost: $${totalCost.toFixed(4)} (avg $${(totalCost / mine.length).toFixed(4)}/q)\n`)
    process.stderr.write(`  total time: ${totalMs}ms (avg ${Math.round(totalMs / mine.length)}ms/q)\n`)
    process.stderr.write(`  total results: ${totalResults} (avg ${(totalResults / mine.length).toFixed(1)}/q)\n`)
  }
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
