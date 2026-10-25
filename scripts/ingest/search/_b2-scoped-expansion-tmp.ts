/**
 * _b2-scoped-expansion-tmp.ts — THROWAWAY. CC's follow-up: does B2 recover when
 * legislation-tier SCOPING is combined with stage-3 query EXPANSION (the prior
 * scoped test used the raw query only; the July A/B test showed expansion alone
 * recovers Use Classes Order @1 and LURA 2023 @11 unscoped, but never tried scoped).
 * Mirrors score-fts.ts's exact expansion mechanism (expandQuery + Set-merge keywords).
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch, Hit } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD } from './gold-queries'

type Expansion = { anchors: string[]; termsOfArt: string[]; rephrasings: string[] }

// NOTE: the production expandQuery() (scrutinise-web/lib/lex/query-expansion.ts) is
// currently broken against live gemini-2.5-flash — the model's "thinking" mode consumes
// the entire maxOutputTokens=512 budget before writing any output (finishReason=MAX_TOKENS,
// ~488 thoughtsTokenCount), so JSON.parse always fails and expandQuery silently degrades to
// EMPTY (verified via _expansion-raw-debug-tmp.ts). This is a live infra regression unrelated
// to B2 — flagging for CC/Charlie separately. For THIS measurement only, a local copy with
// thinkingConfig:{thinkingBudget:0} added (the documented Gemini fix) is used so the actual
// question (does B2 recover under expansion+scoping) can be answered.
const EMPTY_EXP: Expansion = { anchors: [], termsOfArt: [], rephrasings: [] }
const EXPANSION_SCHEMA = {
  type: 'object',
  properties: {
    anchors: { type: 'array', items: { type: 'string' } },
    termsOfArt: { type: 'array', items: { type: 'string' } },
    rephrasings: { type: 'array', items: { type: 'string' } },
  },
  required: ['anchors', 'termsOfArt', 'rephrasings'],
}
const SYSTEM_PROMPT = `You are a UK parliamentary research assistant. Given a set of keywords describing a policy idea, return search terms that will locate the relevant primary legislation, statutory instruments, and parliamentary material in a full-text corpus search engine.

Your output feeds BM25 keyword search only — it is never shown to users or cited as fact. A hallucinated Act name simply scores zero and causes no harm.

Return three arrays:
- anchors: full statutory names of the likely anchor Acts, SIs, or retained-EU instruments (e.g. "Data Protection Act 2018", "UK GDPR", "Financial Services and Markets Act 2000") — up to 5 entries
- termsOfArt: statutory terms-of-art for this concept (e.g. "data controller", "personal data", "lawful basis") — up to 8 entries
- rephrasings: alternative lay phrasings of the same concept (e.g. "privacy law", "information rights") — up to 4 entries

UK law only. No elaboration. Each string must be 60 characters or fewer.`

async function expandQueryFixed(keywords: string[]): Promise<Expansion> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return EMPTY_EXP
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Keywords: ${keywords.join(', ')}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: 'application/json', responseSchema: EXPANSION_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  )
  if (!res.ok) { console.warn('[expandQueryFixed] HTTP', res.status); return EMPTY_EXP }
  const data: any = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') return EMPTY_EXP
  try {
    const obj = JSON.parse(text)
    const toArr = (v: unknown) => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
    return { anchors: toArr(obj.anchors), termsOfArt: toArr(obj.termsOfArt), rephrasings: toArr(obj.rephrasings) }
  } catch { return EMPTY_EXP }
}

async function expandWithRetry(keywords: string[]): Promise<Expansion> { return expandQueryFixed(keywords) }

function haystack(h: Hit): string { return `${h.id}\n${h.sectionTitle ?? ''}\n${h.body}` }
function matchRanks(patterns: RegExp[], hits: Hit[]): number | null {
  const stacks = hits.map(haystack)
  for (let i = 0; i < stacks.length; i++) if (patterns.some((p) => p.test(stacks[i]))) return i + 1
  return null
}

async function main() {
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()

  const q = GOLD.find((g) => g.id === 'B2')!
  console.log(`B2 — "${q.query}"`)
  console.log('')

  console.log(`DEBUG LEX_QUERY_EXPANSION=${JSON.stringify(process.env.LEX_QUERY_EXPANSION)} GEMINI_API_KEY set=${!!process.env.GEMINI_API_KEY}`)
  const exp = await expandWithRetry([q.query])
  const added = [...new Set([...exp.anchors, ...exp.termsOfArt, ...exp.rephrasings])]
  const merged = [...new Set([q.query, ...added])].map((k) => k.trim()).filter(Boolean).join(' ')
  console.log(`Expansion anchors: ${exp.anchors.join('; ')}`)
  console.log(`Expansion termsOfArt: ${exp.termsOfArt.join('; ')}`)
  console.log(`Expansion rephrasings: ${exp.rephrasings.join('; ')}`)
  console.log(`Merged query: ${merged}`)
  console.log('')

  const raw = await rankedSearch(table, q.query, { limit: 20, actIndex })
  const rawScoped = await rankedSearch(table, q.query, { limit: 20, actIndex, tier: 'legislation' })
  const expUnscoped = await rankedSearch(table, merged, { limit: 20, actIndex })
  const expScoped = await rankedSearch(table, merged, { limit: 20, actIndex, tier: 'legislation' })

  console.log('Per expected source — rank in each arm (null = not in top 20):')
  for (const e of q.expected) {
    console.log(`  ${e.label}`)
    console.log(`    raw / unscoped:        ${matchRanks(e.patterns, raw)}`)
    console.log(`    raw / SCOPED:          ${matchRanks(e.patterns, rawScoped)}`)
    console.log(`    expansion / unscoped:  ${matchRanks(e.patterns, expUnscoped)}`)
    console.log(`    expansion / SCOPED:    ${matchRanks(e.patterns, expScoped)}`)
  }
  console.log('')

  console.log('expansion + SCOPED (tier=legislation) — top 10 for eyeball:')
  expScoped.slice(0, 10).forEach((h, i) => {
    console.log(`${i + 1}. [${h.tier}/${h.corpus}] score=${h.score.toFixed(3)} \`${h.id}\``)
    console.log(`   ${h.sectionTitle ? `**${h.sectionTitle}** — ` : ''}${h.body.replace(/\s+/g, ' ').trim().slice(0, 200)}`)
  })
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
