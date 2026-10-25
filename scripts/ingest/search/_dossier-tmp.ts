/**
 * _dossier-tmp.ts — THROWAWAY. Human-eyeball dossier per CC's ask: side-by-side
 * question / expected-answer / actual top-10 (vector-alone, BM25-alone) for the 6
 * archetype-B queries + 2 contrast successes. Read-only against the existing
 * rebuilt corpus_vec — no new embeds beyond live query embedding (negligible), no spend.
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { Pool } from 'pg'
import { connectLance, FTS_TABLE } from './lance'
import { rankedSearch } from './fts-core'
import { loadActIndex } from './citation-resolver'
import { GOLD } from './gold-queries'
import { embedQuery } from './vector-core'
import { VEC_TABLE } from './vector-common'

const IDS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'A2', 'A5']
const WEB_VERIFIED = new Set(['B1', 'B2', 'B3', 'B4', 'B5', 'B6'])

function snip(s: string, n = 220): string { return s.replace(/\s+/g, ' ').trim().slice(0, n) }

async function main() {
  const conn = await connectLance()
  const ftsTable = await conn.openTable(FTS_TABLE)
  const vecTable = await conn.openTable(VEC_TABLE)
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, statement_timeout: 120_000 })
  const actIndex = await loadActIndex(pool)
  await pool.end()

  const lines: string[] = []
  lines.push('# VECTOR_DOSSIER — human-eyeball hits/misses, archetype B + 2 contrast successes', '')
  lines.push(`*Generated ${new Date().toISOString()}, read-only against the current (post-rebuild) corpus_fts + corpus_vec. No new embeds beyond live query embedding, no spend.*`, '')

  for (const id of IDS) {
    const q = GOLD.find((g) => g.id === id)!
    lines.push('---', '', `## ${id} (archetype ${q.archetype}) — "${q.query}"`, '')

    lines.push(`**Provenance:** ${WEB_VERIFIED.has(id) ? 'web-verified (checked against live government sources)' : 'CCh draft, unvalidated'}`, '')
    lines.push('**Expected answer (as written in gold-queries.ts):**', '')
    for (const e of q.expected) lines.push(`- ${e.label}`)
    lines.push('')

    // BM25-alone
    const bmHits = await rankedSearch(ftsTable, q.query, { limit: 10, actIndex })
    lines.push('**BM25-alone — top 10:**', '')
    bmHits.forEach((h, i) => {
      lines.push(`${i + 1}. [${h.tier}/${h.corpus}] \`${h.id}\``)
      lines.push(`   ${h.sectionTitle ? `**${h.sectionTitle}** — ` : ''}${snip(h.body)}`)
    })
    if (!bmHits.length) lines.push('(no hits)')
    lines.push('')

    // vector-alone
    const qvec = await embedQuery(q.query)
    const rows = await vecTable.vectorSearch(Float32Array.from(qvec)).distanceType('cosine').nprobes(24).refineFactor(2).limit(200).toArray() as any[]
    const best = new Map<string, { sectionId: string; corpus: string; tier: string; score: number }>()
    for (const r of rows) {
      const sim = 1 - (typeof r._distance === 'number' ? r._distance : 1)
      const cur = best.get(r.sectionId)
      if (!cur || sim > cur.score) best.set(r.sectionId, { sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, score: sim })
    }
    const vecTop = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10)
    const ids = vecTop.map((v) => v.sectionId)
    const esc = (s: string) => s.replace(/'/g, "''")
    const meta = new Map<string, { sectionTitle: string | null; body: string }>()
    if (ids.length) {
      const inList = ids.map((i) => `'${esc(i)}'`).join(',')
      const metaRows = await ftsTable.query().where(`id IN (${inList})`).select(['id', 'sectionTitle', 'body']).toArray() as any[]
      for (const r of metaRows) meta.set(r.id, { sectionTitle: r.sectionTitle ?? null, body: r.body ?? '' })
    }
    lines.push('**Vector-alone — top 10:**', '')
    vecTop.forEach((v, i) => {
      const m = meta.get(v.sectionId)
      lines.push(`${i + 1}. [${v.tier}/${v.corpus}] score=${v.score.toFixed(3)} \`${v.sectionId}\``)
      lines.push(`   ${m?.sectionTitle ? `**${m.sectionTitle}** — ` : ''}${m ? snip(m.body) : '(metadata unavailable — section may have been removed since indexing)'}`)
    })
    if (!vecTop.length) lines.push('(no hits)')
    lines.push('')

    // zero-score assessment
    const bmMatch = q.expected.map((e) => e.patterns.some((p) => bmHits.some((h) => p.test(`${h.id}\n${h.sectionTitle ?? ''}\n${h.body}`))))
    const vecMatch = q.expected.map((e) => e.patterns.some((p) => ids.some((sid) => { const m = meta.get(sid); return p.test(`${sid}\n${m?.sectionTitle ?? ''}\n${m?.body ?? ''}`) })))
    const anyMatch = bmMatch.some(Boolean) || vecMatch.some(Boolean)
    if (!anyMatch) {
      lines.push(`**ZERO-SCORE — neither arm's top-10 matched any expected source.** Both arms' actual retrieved documents are listed above for direct eyeball comparison against the expected list.`, '')
    }
  }

  const fs = require('fs')
  const out = path.join(__dirname, '../../../docs/VECTOR_DOSSIER.md')
  fs.writeFileSync(out, lines.join('\n'))
  console.log(`wrote ${out}`)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
