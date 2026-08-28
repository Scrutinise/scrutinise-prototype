/**
 * argument-propagate.ts — ARGUMENT 1A §2. THE CHEAP HALF: SPREAD THE SEEDS THROUGH THE INDEX.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ WHAT THIS IS, AND HOW IT DIVERGES FROM THE BRIEF'S WORDING — SAID FIRST BECAUSE IT CHANGES
 * WHAT EVERY NUMBER BELOW IS A PROPORTION OF.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * §2 asks to *"score every paragraph in the parliamentary collections by similarity to each tag's
 * seed set"* and calls it *"arithmetic over an index that exists"*. It is arithmetic — but it is
 * not arithmetic anything on this machine can run. `corpus_vec.lance` is **147.58 GB** and a
 * full scan of 22.7 million vectors is a memory-bound job that belongs on a rented box
 * (docs/CLAUDE.md §17), not in a script. What exists and is free is `vector-serve`'s ANN, which
 * returns the **top K** neighbours of a query.
 *
 * So propagation here is **top-K retrieval per seed, unioned**, and that has one consequence that
 * must be stated everywhere the numbers appear:
 *
 *   **We cannot say how many paragraphs IN THE CORPUS clear a threshold. We can only say how many
 *   of the RETRIEVED candidates do.** Where the lowest score returned for a seed is still above a
 *   threshold, the count at that threshold is CENSORED — the true number is larger and unknown,
 *   and it is printed as `>= n (censored)` rather than as `n`.
 *
 * A full scan would answer it properly and is priced in the report as a decision, not assumed.
 *
 * ── WHAT IS DELIBERATELY NOT DONE ──────────────────────────────────────────────────────────────
 * No polarity handling. *"Nobody will enforce this"* and *"the enforcement regime is working well"*
 * are near neighbours — same subject, same vocabulary, opposite claim — and similarity returns
 * both. The brief: report the rate, do not chase it. The rate is measured in §4 by hand, not here.
 *
 * ⚠⚠ AND THE BRIEF'S SHOULDER TEST CANNOT BE RUN HERE AT ALL — see `shoulder()` below. A shoulder
 * is the fall-off between a tag's neighbourhood and the bulk of the corpus, and top-K retrieval
 * removes the bulk of the corpus before anyone can look at it. The first version of this script
 * reported "no signal" for all ten tags; that was the cut-off talking. It is now reported as
 * UNMEASURABLE, which is a different and honest thing.
 *
 * Usage:
 *   FTS_SEARCH_URL=… VECTOR_SEARCH_URL=… npm run argument:propagate [--k 120] [--seeds-per-tag 12] [--write]
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { PATTERNS, FTS_PHRASES, TAGS, PARLIAMENTARY_CORPORA, type Tag } from './argument/taxonomy'
import { SEEDS } from './argument/seeds'

const V = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
const F = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')
const OUT = path.join(__dirname, '../../docs/census/argument-1a-propagation.json')

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : d
}
const K = arg('k', 120)
const SEEDS_PER_TAG = arg('seeds-per-tag', 12)
const WRITE = process.argv.includes('--write')
const THRESHOLDS = [0.60, 0.65, 0.70, 0.75, 0.80]

interface Hit { chunkId: string; id: string; corpus: string; score: number; snippet: string; probe: string }

async function vectorBatch(queries: string[], limit: number): Promise<any[][]> {
  const out: any[][] = []
  // Batched in small groups: the service does ONE scan per batch, but a batch of thirty would sit
  // in its queue long enough to matter to anything else using it.
  for (let i = 0; i < queries.length; i += 6) {
    const group = queries.slice(i, i + 6)
    const res = await fetch(`${V}/vector-search-batch`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: group.map((q) => ({ query: q, limit, corpora: PARLIAMENTARY_CORPORA })) }),
    })
    if (!res.ok) throw new Error(`vector batch ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const j = await res.json() as any
    for (const q of (j.queries ?? [])) out.push(q.ok ? (q.results ?? []) : [])
  }
  return out
}

function histogram(scores: number[]): string {
  if (!scores.length) return '(none)'
  const buckets = new Array(10).fill(0)
  for (const s of scores) buckets[Math.min(9, Math.max(0, Math.floor(s * 10)))]++
  return buckets.map((n, i) => `${(i / 10).toFixed(1)}:${n}`).join(' ')
}

/**
 * ⚠⚠ THE SHOULDER TEST CANNOT BE RUN OVER A TOP-K SET, AND THE FIRST RUN IS WHAT SHOWED IT.
 *
 * The brief asks for the shape of the score distribution, because *"a tag whose distribution has no
 * shoulder is a tag with no signal"*. A shoulder is the fall-off between the matching neighbourhood
 * and the bulk of the corpus — and **top-K retrieval deletes the bulk of the corpus before you can
 * look at it.** Every tag came back with its candidates packed into two or three hundredths of
 * score, and the first version of this function duly reported "⚠ NO — no signal" for all of them.
 * That was the cut-off talking, not the tags.
 *
 * So the spread is still computed and printed, and it is labelled UNMEASURABLE rather than
 * negative. Answering the brief's question needs the full scan priced in the report.
 */
function shoulder(scores: number[]): { spread: number; measurable: false } {
  if (scores.length < 20) return { spread: 0, measurable: false }
  const s = [...scores].sort((a, b) => b - a)
  return { spread: s[Math.floor(s.length * 0.05)] - s[Math.floor(s.length * 0.5)], measurable: false }
}

async function main() {
  if (!V || !F) { console.error('VECTOR_SEARCH_URL and FTS_SEARCH_URL are both required'); process.exit(2) }
  console.log('── ARGUMENT 1A §2 · PROPAGATION ──')
  console.log(`  method   : top-${K} ANN per seed, unioned, max score per passage`)
  console.log(`  cut-off  : ${K} per seed. A count is CENSORED where the lowest returned score still clears the threshold.`)
  console.log(`  seeds    : up to ${SEEDS_PER_TAG} per tag, human-verified (scripts/argument/seeds.ts)`)
  console.log(`  writing  : ${WRITE ? 'YES — argument_tag' : 'no (dry run; pass --write)'}\n`)

  const perTag: Record<string, any> = {}
  const chunkTags = new Map<string, Set<string>>()
  const rows: Array<{ chunk_id: string; section_id: string; corpus: string; tag: string; method: string; score: number | null; evidence: string }> = []

  for (const tag of TAGS) {
    const seeds = SEEDS.filter((s) => s.tag === tag).slice(0, SEEDS_PER_TAG)
    if (!seeds.length) { console.log(`  ${tag.padEnd(18)} ⚠ NO VERIFIED SEEDS — skipped, and that is a result`); continue }

    // ── dense arm ──────────────────────────────────────────────────────────────────────────────
    const results = await vectorBatch(seeds.map((s) => s.text), K)
    const best = new Map<string, Hit>()
    let lowestReturned = 1
    results.forEach((hits, i) => {
      let min = 1
      for (const h of hits) {
        if (!PARLIAMENTARY_CORPORA.includes(h.corpus)) continue
        const cid = h.chunkId ?? `${h.id}#0`
        min = Math.min(min, h.score ?? 0)
        const prev = best.get(cid)
        if (!prev || (h.score ?? 0) > prev.score) {
          best.set(cid, { chunkId: cid, id: h.id, corpus: h.corpus, score: h.score ?? 0, snippet: h.snippet ?? '', probe: seeds[i].text.slice(0, 60) })
        }
      }
      lowestReturned = Math.min(lowestReturned, min)
    })
    const scores = [...best.values()].map((h) => h.score)
    const sh = shoulder(scores)
    const counts = THRESHOLDS.map((t) => ({
      t, n: scores.filter((s) => s >= t).length, censored: lowestReturned >= t,
    }))

    // ── pattern arm ────────────────────────────────────────────────────────────────────────────
    let proposed = 0
    // ⚠ chunkId → { pattern, corpus }. The FIRST version of this stored the string
    // `'parliamentary'` in the `corpus` column — a TIER name in a column that says corpus. It would
    // have read as a fact about the row forever, and nothing would have complained. The real corpus
    // is in hand at this point; it is carried.
    const patternHits = new Map<string, { pattern: string; corpus: string }>()
    for (const phrase of FTS_PHRASES[tag]) {
      const res = await fetch(`${F}/fts-search`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: phrase, limit: 60, corpora: PARLIAMENTARY_CORPORA }),
      })
      if (!res.ok) continue
      const hits = ((await res.json()) as any).results ?? []
      proposed += hits.length
      const ids = hits.map((h: any) => h.id)
      if (!ids.length) continue
      const meta = await prisma.$queryRaw<any[]>`
        SELECT id, corpus, "r2Key" FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`
      const byId = new Map(meta.map((m) => [m.id, m]))
      for (const h of hits) {
        const m = byId.get(h.id)
        if (!m?.r2Key || !PARLIAMENTARY_CORPORA.includes(m.corpus)) continue
        const body = await r2Get(m.r2Key).catch(() => null)
        if (!body) continue
        const p = PATTERNS[tag].find((re) => re.test(body))
        if (p) patternHits.set(`${h.id}#0`, { pattern: String(p), corpus: m.corpus })
      }
    }

    for (const h of best.values()) {
      rows.push({ chunk_id: h.chunkId, section_id: h.id, corpus: h.corpus, tag, method: 'prototype:v1', score: h.score, evidence: h.probe })
      const set = chunkTags.get(h.chunkId) ?? new Set(); set.add(tag); chunkTags.set(h.chunkId, set)
    }
    for (const [cid, pat] of patternHits) {
      rows.push({ chunk_id: cid, section_id: cid.replace(/#\d+$/, ''), corpus: pat.corpus, tag, method: 'pattern:v1', score: null, evidence: pat.pattern })
      const set = chunkTags.get(cid) ?? new Set(); set.add(tag); chunkTags.set(cid, set)
    }

    perTag[tag] = {
      seeds: seeds.length, denseCandidates: best.size, lowestReturnedScore: lowestReturned,
      thresholds: counts, shoulder: sh, patternProposed: proposed, patternConfirmed: patternHits.size,
      histogram: histogram(scores),
    }
    console.log(`  ${tag.padEnd(18)} seeds ${String(seeds.length).padStart(2)} · dense ${String(best.size).padStart(5)} distinct` +
      ` · pattern ${String(proposed).padStart(4)} proposed → ${String(patternHits.size).padStart(3)} confirmed` +
      ` · 95th-vs-median spread ${sh.spread.toFixed(3)} ⚠ NOT a shoulder test — the top-K cut-off removed the bulk of the corpus`)
    console.log(`    ${counts.map((c) => `>=${c.t.toFixed(2)} ${c.censored ? `>=${c.n}*` : c.n}`).join(' · ')}   (* censored by the top-${K} cut-off)`)
    console.log(`    score histogram: ${perTag[tag].histogram}`)
  }

  // ── overlap: a passage that carries several tags is expected and is worth counting ────────────
  const multi = [...chunkTags.values()].filter((s) => s.size > 1).length
  console.log(`\n  ── overlap ──`)
  console.log(`    ${chunkTags.size} distinct passages tagged · ${multi} carry two or more tags (${(100 * multi / (chunkTags.size || 1)).toFixed(1)}%)`)

  if (WRITE) {
    let written = 0
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500)
      const values = Prisma.join(batch.map((r) => Prisma.sql`(${r.chunk_id}, ${r.section_id}, ${r.corpus}, ${r.tag}, ${r.method}, ${r.score}, ${r.evidence})`))
      const res = await prisma.$executeRaw`
        INSERT INTO argument_tag (chunk_id, section_id, corpus, tag, method, score, evidence)
        VALUES ${values} ON CONFLICT DO NOTHING`
      written += res
    }
    // ⚠ RE-READ, NEVER REPORT THE INTENT. Three ideas were once reported deleted and were still
    // there five days later; the rule that came out of it is that a script prints what it read
    // back, not what it asked for.
    const back = await prisma.$queryRaw<any[]>`SELECT method, count(*) AS n FROM argument_tag GROUP BY 1 ORDER BY 1`
    console.log(`\n  wrote ${written} rows (of ${rows.length} offered; the rest were already there)`)
    console.log('  read back from argument_tag:')
    for (const b of back) console.log(`    ${String(b.method).padEnd(16)} ${Number(b.n).toLocaleString()}`)
  } else {
    console.log(`\n  DRY RUN — ${rows.length} rows would be written. Pass --write.`)
  }

  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(), k: K, seedsPerTag: SEEDS_PER_TAG, thresholds: THRESHOLDS,
    written: WRITE, perTag, distinctPassages: chunkTags.size, multiTagged: multi, rowsOffered: rows.length,
  }, null, 2))
  console.log(`\n  wrote ${OUT}`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
