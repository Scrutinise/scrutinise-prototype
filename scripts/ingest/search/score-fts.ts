/**
 * score-fts.ts — Search S1b scoring harness (INERT until the index exists).
 *
 * Runs the 30 GOLD_QUERIES queries through the same BM25+title-boost path the
 * query service uses (fts-core.rankedSearch), then computes recall@20 + MRR per
 * archetype + overall, AND writes a by-eye top-20 dump per query so Charlie/CCh
 * can validate the citation-matcher key (brief addition #4).
 *
 * Scoring (approximate by design — see gold-queries.ts):
 *   recall@20 = (#expected sources whose pattern matched ≥1 top-20 hit) / (#expected)
 *   MRR       = 1 / (rank of the first top-20 hit matching ANY expected source)
 *
 * Floors (brief addition #5): archetype D (all [GRAPH]) cannot be answered by
 * text search alone — reported as an engine-floor, not a failure. A1/C3/D3 carry
 * [INFORCE] aspects (commencement/in-force metadata not yet extracted); their
 * in-force expectations are floors too. [BILLS] (F + B4) scores for real
 * (bills-api landed). Overall is reported BOTH including and excluding floors.
 *
 * Usage:  tsx search/score-fts.ts   (writes docs/FTS_S1b_SCORING.md + .json)
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch, Hit } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD, GoldQuery } from './gold-queries'

const OUT_MD = path.join(__dirname, '../../../docs/FTS_S1b_SCORING.md')
const OUT_JSON = path.join(__dirname, '../../../docs/fts_s1b_scores.json')

function haystack(h: Hit): string {
  return `${h.id}\n${h.sectionTitle ?? ''}\n${h.body}`
}

type QueryScore = {
  q: GoldQuery
  hits: Hit[]
  matched: { label: string; rank: number | null }[] // rank of first hit matching the source (1-based)
  recall: number
  mrr: number
}

function scoreQuery(q: GoldQuery, hits: Hit[]): QueryScore {
  const stacks = hits.map(haystack)
  const matched = q.expected.map((src) => {
    let rank: number | null = null
    for (let i = 0; i < stacks.length; i++) {
      if (src.patterns.some((p) => p.test(stacks[i]))) { rank = i + 1; break }
    }
    return { label: src.label, rank }
  })
  const found = matched.filter((m) => m.rank !== null).length
  const recall = q.expected.length ? found / q.expected.length : 0
  const firstRel = matched.reduce<number | null>((best, m) => {
    if (m.rank === null) return best
    return best === null ? m.rank : Math.min(best, m.rank)
  }, null)
  const mrr = firstRel ? 1 / firstRel : 0
  return { q, hits, matched, recall, mrr }
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
function pctStr(x: number): string { return `${(x * 100).toFixed(1)}%` }

function dumpQuery(s: QueryScore): string {
  const q = s.q
  const lines: string[] = []
  lines.push(`### ${q.id} (${q.archetype}/${q.persona})${q.flags.length ? ' [' + q.flags.join('][') + ']' : ''}${q.floor ? ' — ENGINE FLOOR' : ''}`)
  lines.push(`*Query:* ${q.query}`)
  lines.push(`*recall@20:* ${pctStr(s.recall)} · *MRR:* ${s.mrr.toFixed(3)}`)
  lines.push('')
  lines.push('Expected sources:')
  for (const m of s.matched) lines.push(`- ${m.rank ? `✓ @${m.rank}` : '✗ MISS'} — ${m.label}`)
  lines.push('')
  lines.push('Top-20 retrieved:')
  s.hits.forEach((h, i) => {
    lines.push(`${(i + 1).toString().padStart(2)}. [${h.tier}/${h.corpus}] score=${h.score.toFixed(3)}${h.resolved ? '↑R' : ''}${h.titleBoosted ? '↑T' : ''} \`${h.id}\``)
    lines.push(`    ${h.sectionTitle ? `**${h.sectionTitle.slice(0, 100)}** — ` : ''}${h.snippet.slice(0, 160)}`)
  })
  lines.push('')
  return lines.join('\n')
}

async function main() {
  console.log('[score] opening Lance table…')
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)
  console.log(`[score] rows=${await table.countRows()} — scoring ${GOLD.length} gold queries`)

  // Citation resolver index (archetype-A known-item fix). Reads NEON.
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()
  console.log(`[score] act index: ${actIndex.byTitle.size} titles`)

  const scores: QueryScore[] = []
  for (const q of GOLD) {
    const hits = await rankedSearch(table, q.query, { limit: 20, actIndex })
    const s = scoreQuery(q, hits)
    scores.push(s)
    console.log(`  ${q.id} ${q.archetype} recall@20=${pctStr(s.recall)} mrr=${s.mrr.toFixed(3)}${q.floor ? ' (floor)' : ''}`)
  }

  // aggregates
  const archetypes = ['A', 'B', 'C', 'D', 'E', 'F'] as const
  const byArch = archetypes.map((a) => {
    const ss = scores.filter((s) => s.q.archetype === a)
    return { archetype: a, n: ss.length, recall: mean(ss.map((s) => s.recall)), mrr: mean(ss.map((s) => s.mrr)) }
  })
  const overall = { recall: mean(scores.map((s) => s.recall)), mrr: mean(scores.map((s) => s.mrr)) }
  const nonFloor = scores.filter((s) => !s.q.floor)
  const exFloor = { recall: mean(nonFloor.map((s) => s.recall)), mrr: mean(nonFloor.map((s) => s.mrr)), n: nonFloor.length }

  // markdown report
  const md: string[] = []
  md.push('# FTS S1b — scoring report', '')
  md.push(`*Generated ${new Date().toISOString()} against the Lance FTS dataset. Expected-sources are CCh's UNVALIDATED draft — these numbers are PROVISIONAL; the top-20 dumps below are the validation artefact.*`, '')
  md.push('## Headline', '')
  md.push('| scope | recall@20 | MRR | n |', '|---|---|---|---|')
  md.push(`| overall (all 30) | ${pctStr(overall.recall)} | ${overall.mrr.toFixed(3)} | 30 |`)
  md.push(`| **overall excl. [GRAPH] floor** | **${pctStr(exFloor.recall)}** | **${exFloor.mrr.toFixed(3)}** | ${exFloor.n} |`)
  md.push('')
  md.push('## By archetype', '')
  md.push('| archetype | recall@20 | MRR | n | note |', '|---|---|---|---|---|')
  const note: Record<string, string> = { A: '[INFORCE] aspects are floors', D: 'ALL [GRAPH] — engine floor', F: '[BILLS] scores for real' }
  for (const b of byArch) md.push(`| ${b.archetype} | ${pctStr(b.recall)} | ${b.mrr.toFixed(3)} | ${b.n} | ${note[b.archetype] ?? ''} |`)
  md.push('')
  md.push('## Per-query detail + top-20 eyeball dump', '')
  for (const s of scores) md.push(dumpQuery(s))

  fs.writeFileSync(OUT_MD, md.join('\n'))
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    generatedAt: new Date().toISOString(), overall, exFloor, byArch,
    queries: scores.map((s) => ({ id: s.q.id, archetype: s.q.archetype, flags: s.q.flags, floor: s.q.floor, recall: s.recall, mrr: s.mrr, matched: s.matched })),
  }, null, 2))

  console.log('')
  console.log(`[score] overall recall@20=${pctStr(overall.recall)} mrr=${overall.mrr.toFixed(3)}`)
  console.log(`[score] excl floor recall@20=${pctStr(exFloor.recall)} mrr=${exFloor.mrr.toFixed(3)}`)
  console.log(`[score] wrote ${OUT_MD} + ${OUT_JSON}`)
}

main().catch((e) => { console.error('[score] FATAL', e); process.exit(1) })
