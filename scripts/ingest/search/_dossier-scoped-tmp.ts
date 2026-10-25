/**
 * _dossier-scoped-tmp.ts — THROWAWAY. Re-run B1/B2/B3 BM25-alone and vector-alone
 * SCOPED to tier='legislation' (query filter, no rebuild), compared against the
 * unscoped result. Also prints FULL section text (not a snippet) for the top 3
 * hits of every arm, per CC's ask. Read-only, no new spend beyond live query embeds.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch, Hit } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD } from './gold-queries'
import { embedQuery } from './vector-core'
import { VEC_TABLE } from './vector-common'

const IDS = ['B1', 'B2', 'B3']

function clean(s: string): string { return s.replace(/\s+/g, ' ').trim() }

function matchRank(expectedPatterns: RegExp[], hits: Array<{ id: string; sectionTitle?: string | null; body?: string }>): number | null {
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i]
    const hay = `${h.id}\n${h.sectionTitle ?? ''}\n${h.body ?? ''}`
    if (expectedPatterns.some((p) => p.test(hay))) return i + 1
  }
  return null
}

async function vectorAlone(vecTable: any, ftsTable: any, qvec: number[], tier: string | null, limit = 10) {
  let q = vecTable.vectorSearch(Float32Array.from(qvec)).distanceType('cosine').nprobes(24).refineFactor(2)
  if (tier) q = q.where(`tier = '${tier}'`)
  const rows = await q.limit(200).toArray() as any[]
  const best = new Map<string, { sectionId: string; corpus: string; tier: string; score: number }>()
  for (const r of rows) {
    const sim = 1 - (typeof r._distance === 'number' ? r._distance : 1)
    const cur = best.get(r.sectionId)
    if (!cur || sim > cur.score) best.set(r.sectionId, { sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, score: sim })
  }
  const top = [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  const ids = top.map((v) => v.sectionId)
  const esc = (s: string) => s.replace(/'/g, "''")
  const meta = new Map<string, { sectionTitle: string | null; body: string }>()
  if (ids.length) {
    const inList = ids.map((i) => `'${esc(i)}'`).join(',')
    const metaRows = await ftsTable.query().where(`id IN (${inList})`).select(['id', 'sectionTitle', 'body']).toArray() as any[]
    for (const r of metaRows) meta.set(r.id, { sectionTitle: r.sectionTitle ?? null, body: r.body ?? '' })
  }
  return top.map((v) => ({ id: v.sectionId, corpus: v.corpus, tier: v.tier, score: v.score, sectionTitle: meta.get(v.sectionId)?.sectionTitle ?? null, body: meta.get(v.sectionId)?.body ?? '' }))
}

async function main() {
  const conn = await connectLance()
  const ftsTable = await conn.openTable(FTS_TABLE)
  const vecTable = await conn.openTable(VEC_TABLE)
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()

  const lines: string[] = []
  lines.push('# SCOPED RECALL TEST — B1/B2/B3, filtered to tier=legislation vs unscoped', '')
  lines.push(`*Generated read-only against the current corpus_fts + corpus_vec. Filter only (no rebuild). Full section text shown for top 3 hits per arm.*`, '')

  for (const id of IDS) {
    const q = GOLD.find((g) => g.id === id)!
    lines.push('---', '', `## ${id} — "${q.query}"`, '')
    lines.push('**Expected answer:**', '')
    for (const e of q.expected) lines.push(`- ${e.label}`)
    lines.push('')
    const allPatterns = q.expected.flatMap((e) => e.patterns)

    // ---- BM25 ----
    const bmUnscoped = await rankedSearch(ftsTable, q.query, { limit: 10, actIndex })
    const bmScoped = await rankedSearch(ftsTable, q.query, { limit: 10, actIndex, tier: 'legislation' })
    const bmUnscopedRank = matchRank(allPatterns, bmUnscoped)
    const bmScopedRank = matchRank(allPatterns, bmScoped)

    lines.push(`**BM25-alone — UNSCOPED: expected Act found at rank ${bmUnscopedRank ?? 'NOT in top 10'}. SCOPED (tier=legislation): expected Act found at rank ${bmScopedRank ?? 'NOT in top 10'}.**`, '')
    lines.push('SCOPED (tier=legislation) — top 10:', '')
    bmScoped.forEach((h: Hit, i) => {
      lines.push(`${i + 1}. [${h.tier}/${h.corpus}] score=${h.score.toFixed(3)} \`${h.id}\``)
      if (i < 3) {
        lines.push(`   **${h.sectionTitle ?? '(no title)'}**`)
        lines.push(`   > ${clean(h.body)}`)
      } else {
        lines.push(`   ${clean(h.body).slice(0, 160)}`)
      }
    })
    if (!bmScoped.length) lines.push('(no hits)')
    lines.push('')

    // ---- Vector ----
    const qvec = await embedQuery(q.query)
    const vecUnscoped = await vectorAlone(vecTable, ftsTable, qvec, null)
    const vecScoped = await vectorAlone(vecTable, ftsTable, qvec, 'legislation')
    const vecUnscopedRank = matchRank(allPatterns, vecUnscoped)
    const vecScopedRank = matchRank(allPatterns, vecScoped)

    lines.push(`**Vector-alone — UNSCOPED: expected Act found at rank ${vecUnscopedRank ?? 'NOT in top 10'}. SCOPED (tier=legislation): expected Act found at rank ${vecScopedRank ?? 'NOT in top 10'}.**`, '')
    lines.push('SCOPED (tier=legislation) — top 10:', '')
    vecScoped.forEach((v, i) => {
      lines.push(`${i + 1}. [${v.tier}/${v.corpus}] score=${v.score.toFixed(3)} \`${v.id}\``)
      if (i < 3) {
        lines.push(`   **${v.sectionTitle ?? '(no title)'}**`)
        lines.push(`   > ${v.body ? clean(v.body) : '(metadata unavailable — see stale-vector diagnostic)'}`)
      } else {
        lines.push(`   ${v.body ? clean(v.body).slice(0, 160) : '(metadata unavailable)'}`)
      }
    })
    if (!vecScoped.length) lines.push('(no hits)')
    lines.push('')
  }

  const fs = require('fs')
  const out = path.join(__dirname, '../../../docs/VECTOR_DOSSIER_SCOPED.md')
  fs.writeFileSync(out, lines.join('\n'))
  console.log(`wrote ${out}`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
