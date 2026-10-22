// ─────────────────────────────────────────────────────────────────────────────
// check:lex-read-section-turn — 212, CCh 21 Oct (2): "an excerpt cut mid-subsection on CRaG s.5 is followed by the
// full text in the same turn".
//
// Default (free): a scripted model drives ONE real turn — search_corpus against the real corpus, then read_section —
// and the check reads what the platform actually handed back inside that turn: s.5's excerpt marked cut off, then
// the whole held section (byte-identical to the stored object).
// --live: the same question to the real model (Sonnet 5.5, ~5p, recorded in the ledger). Asserts the MODEL chose to
// read s.5 in full in the same turn after seeing the cut excerpt.
//
// ⚠ Needs FTS_SEARCH_URL in the launching shell (it is not in .env). Runs on a scratch copy of 452c5ade, deleted after.
// Usage:  FTS_SEARCH_URL=… npm run check:lex-read-section-turn [-- --live]
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { runAgentTurn } from '../lib/lex/agent/loop'
import { readSection } from '../lib/lex/read-section'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const CRAG_S5 = 'primary-acts-2000plus:ukpga/2010/25:section-5'
const Q = 'What does section 5 of the Constitutional Reform and Governance Act 2010 require of the Civil Service Code, subsection by subsection?'
const LIVE = process.argv.includes('--live')

type Step = { text?: string; tool?: { name: string; input: unknown } }
/** Records every request; answers from a script, or passes through to the real API. */
function recording(steps: Step[] | null) {
  const calls: Array<Record<string, unknown>> = []
  const real = steps ? null : new Anthropic({ timeout: 120_000, maxRetries: 2 })
  let i = 0
  const client = {
    messages: {
      create: async (params: Record<string, unknown>, opts?: unknown) => {
        calls.push(params)
        if (real) return real.messages.create(params as never, opts as never)
        const s = steps![Math.min(i++, steps!.length - 1)]
        const content = s.tool ? [{ type: 'tool_use', id: `tu_${i}`, name: s.tool.name, input: s.tool.input }] : [{ type: 'text', text: s.text ?? '' }]
        return { id: `m_${i}`, type: 'message', role: 'assistant', model: String(params.model), content, stop_reason: s.tool ? 'tool_use' : 'end_turn', usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }
      },
    },
  }
  return { client: client as unknown as Anthropic, calls }
}

/** Every tool_result the platform sent back in this turn, in order, with the tool_use it answers. */
function toolExchanges(calls: Array<Record<string, unknown>>) {
  const msgs = (calls.at(-1)?.messages ?? []) as Array<{ role: string; content: unknown }>
  const uses = new Map<string, { name: string; input: unknown }>()
  const out: Array<{ name: string; input: unknown; result: string }> = []
  for (const m of msgs) {
    if (!Array.isArray(m.content)) continue
    for (const b of m.content as Array<Record<string, unknown>>) {
      if (b.type === 'tool_use') uses.set(String(b.id), { name: String(b.name), input: b.input })
      if (b.type === 'tool_result') {
        const u = uses.get(String(b.tool_use_id))
        const text = typeof b.content === 'string' ? b.content
          : (b.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join('\n')
        out.push({ name: u?.name ?? '?', input: u?.input, result: text })
      }
    }
  }
  return out
}

let pass = 0, fail = 0
function ok(name: string, cond: boolean, control: boolean, why = '') {
  const good = cond && !control
  good ? pass++ : fail++
  console.log(`${good ? '✓' : '✗'} ${name}${good ? '' : `  [assertion ${cond}, control ${control}] ${why}`}`)
}

async function main() {
  if (!process.env.FTS_SEARCH_URL) throw new Error('FTS_SEARCH_URL is not set — corpus search cannot run, so this check would prove nothing.')
  const held = await readSection(CRAG_S5)
  if (held.status !== 'text') throw new Error(`CRaG s.5 is not readable: ${held.status} ${held.reason}`)
  const copy = await scratchCopy('452c5ade', 'read-section-turn')
  try {
    const rec = recording(LIVE ? null : [
      { tool: { name: 'search_corpus', input: { query: 'Constitutional Reform and Governance Act 2010 section 5 Civil Service Code', limit: 8 } } },
      { tool: { name: 'read_section', input: { id: CRAG_S5 } } },
      { text: `Section 5 read in full (${CRAG_S5}).` },
    ])
    const r = await runAgentTurn({ ideaId: copy.id, userId: copy.userId, message: Q, history: [], summary: null, client: rec.client, turnId: `chk-rs-${Date.now()}` } as never)
    const ex = toolExchanges(rec.calls)
    console.log(`(${LIVE ? 'live' : 'scripted'} turn: ${r.cost.calls} calls, ${r.cost.pence.toFixed(2)}p, tools: ${r.toolLog.map((t) => t.name).join(' → ')})`)

    const searchAt = ex.findIndex((e) => e.name === 'search_corpus' && e.result.includes('excerpts_cut_off') && e.result.includes(CRAG_S5))
    const search = ex[searchAt]
    ok('search_corpus hands back s.5 as an excerpt and names it cut off', searchAt >= 0, false, JSON.stringify(ex.map((e) => [e.name, e.result.slice(0, 200)])))
    // The excerpts reach the model as text in the untrusted block: "[n] id=<id> · …" then the clipped snippet on the next line.
    const block = search?.result.split(`id=${CRAG_S5}`)[1] ?? ''
    const excerpt = (block.split('\n').slice(1).join('\n').split(/\n\n|\n\[\d+\] id=/)[0] ?? '').trim()
    const lastSub = held.text!.match(/\(\d+\)/g)?.at(-1) ?? ''
    ok('the excerpt stops before the section ends (cut mid-section, last subsection missing)', !!excerpt && excerpt.length < held.text!.length && !excerpt.includes(held.text!.slice(-80)), !excerpt, `excerpt ${excerpt.length} of ${held.text!.length}; last subsection ${lastSub}`)

    const readAt = ex.findIndex((e, i) => i > searchAt && e.name === 'read_section' && String((e.input as { id?: string })?.id ?? '').startsWith(CRAG_S5.slice(0, -1)))
    const read = ex[readAt]
    ok('read_section on s.5 follows, in the SAME turn', readAt > searchAt && searchAt >= 0, false)
    ok('…and what it hands back is the whole held text, byte-identical', !!read && read.result.includes(held.text!) && read.result.includes('"complete":true'), !!excerpt && read?.result.includes(held.text!) === excerpt.includes(held.text!), read?.result.slice(0, 300))
    if (LIVE) ok('the model, not a script, chose to read it', readAt > searchAt, false)
  } finally {
    if (!LIVE) await prisma.$executeRaw`DELETE FROM "LlmSpend" WHERE "ideaId" = ${copy.id} AND "pass" = 'lex.agent.turn'` // scripted usage is fiction
    await deleteScratch(copy.id)
    await prisma.$disconnect()
  }
  console.log(`\ncheck:lex-read-section-turn${LIVE ? ' --live' : ''} ${pass}/${pass + fail}${fail ? ` — ${fail} FAILED` : ''}`)
  process.exitCode = fail ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
