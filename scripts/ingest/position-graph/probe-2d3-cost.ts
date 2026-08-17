/**
 * probe-2d3-cost.ts — BRIEF_GRAPH_2D3 §1 "the cost, priced before spent".
 *
 * Prints the extraction population and its token bill for K = 4, 8, 12, 20, 130 inquiries, so the
 * bound is chosen against a number rather than a feeling. Reads only; spends nothing.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { AREA, areaInquirySql } from './area-2d3'
import { FLASH_IN_PER_M, FLASH_OUT_PER_M, PROMPT_OVERHEAD_TOKENS, OUT_TOKENS_PER_CALL, wordsToTokens } from './cost-2d3'

export {}

const n = (v: number) => Math.round(v).toLocaleString('en-GB')

async function main() {
  const pool = getNeonPool()
  try {
    const { rows } = await pool.query<{ object_ref: string; label: string; secs: string; words: string }>(areaInquirySql())
    console.log(`\n════ EXTRACTION POPULATION — "${AREA}" ════`)
    console.log(`  ${rows.length} inquiries hold evidence in the corpus.\n`)
    console.log('    K   submissions      words   input tok   output tok    input $   output $     total $')
    for (const K of [4, 8, 12, 20, 40, rows.length]) {
      const slice = rows.slice(0, K)
      const secs = slice.reduce((a, r) => a + Number(r.secs), 0)
      const words = slice.reduce((a, r) => a + Number(r.words), 0)
      const inTok = wordsToTokens(words) + secs * PROMPT_OVERHEAD_TOKENS
      const outTok = secs * OUT_TOKENS_PER_CALL
      const inUsd = (inTok / 1e6) * FLASH_IN_PER_M
      const outUsd = (outTok / 1e6) * FLASH_OUT_PER_M
      console.log(`  ${String(K).padStart(3)} ${n(secs).padStart(13)} ${n(words).padStart(10)} ${n(inTok).padStart(11)} ${n(outTok).padStart(12)}   $${inUsd.toFixed(2).padStart(7)}  $${outUsd.toFixed(2).padStart(7)}  $${(inUsd + outUsd).toFixed(2).padStart(8)}`)
    }
    console.log(`\n  assumptions (all stated so the score-after can attribute a miss):`)
    console.log(`    · 1 word = ${wordsToTokens(1).toFixed(2)} tokens`)
    console.log(`    · ${PROMPT_OVERHEAD_TOKENS} input tokens of instruction + proposition list per submission`)
    console.log(`    · ${OUT_TOKENS_PER_CALL} output tokens per submission (positions ONLY where taken; a`)
    console.log(`      no-position is recorded from the ask, not emitted by the model)`)
    console.log(`    · gemini-2.5-flash list $${FLASH_IN_PER_M}/M in, $${FLASH_OUT_PER_M}/M out; thinkingBudget 0`)
  } finally { await endNeonPool() }
}
main().catch((e) => { console.error('[probe-2d3-cost] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
