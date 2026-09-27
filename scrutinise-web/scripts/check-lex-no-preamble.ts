// ─────────────────────────────────────────────────────────────────────────────
// 26-I §8a — "Assert it: a check that fails on the presence of evaluative openers in
// Lex's output. Report which phrases the check catches."
//
// Two halves, per docs/CLAUDE.md §25 ("assert the data present in the rendered output,
// not that the code which would render it exists") — the same shape check-prompt-examples.ts
// uses for illustrative examples:
//
//   1. STATIC — every known prompt site imports NO_EVALUATIVE_PREAMBLE (source-shaped, and
//      correct to be: "does this file reference the shared instruction" genuinely is a
//      source question).
//   2. LIVE — real stored `aiChatHistory` rows (role 'lex') from real ideas, tested against
//      the same `hasEvaluativePreamble` detector the product could run at write time. This
//      is the half that actually answers "does Lex still do this", not "did we tell it not to".
//
// ⚠ NOT A GATE ON THIS RUN — reports counts and quotes every match, per §23.2 ("report
// checks run, not only checks passed"). Wire into CI as a hard gate only once a baseline
// sweep confirms it doesn't cry wolf on genuine mid-answer agreement ("that's right, but…").
//
// Usage: npx tsx --env-file=.env scripts/check-lex-no-preamble.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { hasEvaluativePreamble, EVALUATIVE_OPENER_PATTERNS } from '../lib/lex/no-preamble'

// Every prompt-construction site this sprint reached. `lex-client.ts`'s four extra
// generators (generateCauseCandidates etc.) are deliberately NOT here — they emit
// structured lists (causes, policy options), never a conversational reply with an
// "opening", so the rule does not apply to them. The legacy `app/api/ai/[ideaId]/route.ts`
// and `app/api/ai/public/route.ts` are also not here — 26-I's own investigation could not
// confirm whether that surface is still live; reported to Charlie rather than assumed.
const EXPECTED_SITES = [
  'lib/lex/lex-client.ts',
  'lib/lex/general-chat.ts',
  'lib/lex/deepening-client.ts',
  'lib/lex/deepening-adversarial.ts',
  'lib/lex/deepening-sift.ts',
]

function checkStatic(): { site: string; ok: boolean }[] {
  return EXPECTED_SITES.map((site) => {
    let text = ''
    try { text = readFileSync(site, 'utf8') } catch { return { site, ok: false } }
    return { site, ok: text.includes('NO_EVALUATIVE_PREAMBLE') }
  })
}

async function checkLive(): Promise<{ scanned: number; matches: Array<{ ideaId: string; phrase: string; excerpt: string }> }> {
  type ChatMsg = { role?: string; content?: string }
  const ideas = await prisma.idea.findMany({
    where: { aiChatHistory: { not: null } },
    select: { id: true, aiChatHistory: true },
    take: 2000,
  })
  const matches: Array<{ ideaId: string; phrase: string; excerpt: string }> = []
  let scanned = 0
  for (const idea of ideas) {
    const history = Array.isArray(idea.aiChatHistory) ? (idea.aiChatHistory as ChatMsg[]) : []
    for (const m of history) {
      if (m.role !== 'lex' || !m.content) continue
      scanned++
      const result = hasEvaluativePreamble(m.content)
      if (result.matched) {
        matches.push({ ideaId: idea.id, phrase: result.phrase!, excerpt: m.content.slice(0, 120) })
      }
    }
  }
  return { scanned, matches }
}

async function main() {
  console.log('── check:lex-no-preamble ──')
  console.log(`Patterns tested (${EVALUATIVE_OPENER_PATTERNS.length}):`)
  for (const p of EVALUATIVE_OPENER_PATTERNS) console.log(`  ${p}`)
  console.log('')

  const staticResults = checkStatic()
  for (const r of staticResults) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.site} ${r.ok ? 'imports/uses NO_EVALUATIVE_PREAMBLE' : 'MISSING the shared instruction'}`)
  }
  const staticFails = staticResults.filter((r) => !r.ok).length

  console.log('')
  const { scanned, matches } = await checkLive()
  console.log(`Live sweep: ${scanned} stored Lex reply/replies read from real ideas' aiChatHistory.`)
  if (matches.length) {
    console.log(`⚠ ${matches.length} opened with a banned phrase:`)
    for (const m of matches) console.log(`  idea ${m.ideaId} — "${m.phrase}" — "${m.excerpt}…"`)
  } else {
    console.log('✓ none matched.')
  }

  console.log('')
  console.log(`${staticResults.length - staticFails}/${staticResults.length} sites wired · ${scanned} replies scanned · ${matches.length} live matches`)
  if (staticFails > 0) process.exitCode = 1
}

main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : e); process.exitCode = 1 })
