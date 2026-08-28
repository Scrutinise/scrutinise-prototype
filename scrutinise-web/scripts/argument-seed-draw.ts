/**
 * argument-seed-draw.ts — ARGUMENT 1A §1. DRAW CANDIDATE PASSAGES FOR HAND-LABELLING.
 *
 * ⚠ THIS DRAWS. IT DOES NOT LABEL. Labelling is a person reading the passage, and the output of
 * this script is the reading list. Nothing here decides that a passage carries a tag.
 *
 * TWO ARMS, BECAUSE THEY MISS DIFFERENT THINGS:
 *   · **dense** — the tag's probe queries against `vector-serve`, scoped to the parliamentary
 *     tier. Finds passages that MEAN the move even when they use none of its usual words.
 *   · **keyword** — the tag's literal phrases against `fts-serve`, then the body fetched from R2
 *     and the tag's own REGEX re-applied. FTS proposes, the regex disposes: a BM25 hit on
 *     "who is going to enforce" would otherwise admit every passage containing "enforce".
 *
 * ⚠ POST-STRATIFIED, NOT DRAWN AT RANDOM, and the brief says why: *"a random sample of 15 million
 * parliamentary paragraphs is overwhelmingly recent and overwhelmingly Commons, because that is
 * where the volume is."* Candidates are bucketed by (collection, decade) and taken round-robin
 * across buckets, so a decade with two candidates contributes both and 2010s Commons does not
 * contribute two hundred. **The strata and the counts are printed.**
 *
 * ⚠ A RANDOM CONTROL ARM IS DRAWN TOO, and it is the honest half. The brief: *"'this paragraph
 * makes no argument' must be an easy, unpunished answer, and a large share of any honest sample
 * will be exactly that. If fewer than a third of a random control sample come back untagged, the
 * labelling is over-eager."* The control is drawn `ORDER BY md5(id)` with no probe near it.
 *
 * Usage:
 *   FTS_SEARCH_URL=… VECTOR_SEARCH_URL=… npm run argument:seed-draw
 */
import fs from 'node:fs'
import path from 'node:path'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { PATTERNS, PROBES, FTS_PHRASES, TAGS, PARLIAMENTARY_CORPORA, type Tag } from './argument/taxonomy'

const V = (process.env.VECTOR_SEARCH_URL ?? '').replace(/\/$/, '')
const F = (process.env.FTS_SEARCH_URL ?? '').replace(/\/$/, '')
const OUT = path.join(__dirname, '../../docs/census/argument-1a-candidates.json')

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`)
  return i >= 0 ? parseInt(process.argv[i + 1], 10) : d
}
const PER_PROBE = arg('per-probe', 40)
const PER_TAG = arg('per-tag', 40)
const CONTROL_N = arg('control', 120)

interface Candidate {
  tag: Tag
  arm: 'dense' | 'keyword' | 'control'
  id: string
  chunkId: string
  corpus: string
  decade: string
  speaker: string | null
  words: number | null
  score: number | null
  /** The passage a person will read and judge. */
  text: string
  /** For the keyword arm: which pattern confirmed it. */
  confirmedBy?: string
  probe: string
}

async function vectorBatch(queries: Array<{ query: string; limit: number }>): Promise<any[][]> {
  const res = await fetch(`${V}/vector-search-batch`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queries: queries.map((q) => ({ ...q, corpora: PARLIAMENTARY_CORPORA })) }),
  })
  if (!res.ok) throw new Error(`vector batch ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json() as any
  return (j.queries ?? []).map((q: any) => (q.ok ? (q.results ?? []) : []))
}

async function fts(query: string, limit: number): Promise<any[]> {
  const res = await fetch(`${F}/fts-search`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit, corpora: PARLIAMENTARY_CORPORA }),
  })
  if (!res.ok) throw new Error(`fts ${res.status}`)
  return ((await res.json()) as any).results ?? []
}

/** The sentence carrying the match, with a little either side — what a labeller needs to judge. */
function around(body: string, re: RegExp, width = 700): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  const m = flat.match(re)
  if (!m || m.index === undefined) return flat.slice(0, width)
  const start = Math.max(0, m.index - Math.floor(width / 3))
  return (start > 0 ? '… ' : '') + flat.slice(start, start + width)
}

async function hydrate(ids: string[]): Promise<Map<string, any>> {
  if (!ids.length) return new Map()
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, corpus, "sectionTitle", speaker, "itemDate", "wordCount" AS words, "r2Key"
    FROM corpus_sections WHERE id IN (${Prisma.join(ids)})`
  return new Map(rows.map((r) => [r.id, r]))
}

const decadeOf = (d: any) => d ? `${Math.floor(new Date(d).getUTCFullYear() / 10) * 10}s` : 'undated'

/** Round-robin across (collection, decade) buckets so the draw spreads instead of piling up. */
function postStratify(cands: Candidate[], take: number): Candidate[] {
  const buckets = new Map<string, Candidate[]>()
  for (const c of cands) {
    const k = `${c.corpus} ${c.decade}`
    const a = buckets.get(k) ?? []
    a.push(c); buckets.set(k, a)
  }
  for (const a of buckets.values()) a.sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
  const keys = [...buckets.keys()].sort()
  const out: Candidate[] = []
  for (let round = 0; out.length < take; round++) {
    let added = 0
    for (const k of keys) {
      const a = buckets.get(k)!
      if (round < a.length) { out.push(a[round]); added++; if (out.length >= take) break }
    }
    if (!added) break
  }
  return out
}

async function main() {
  if (!V || !F) { console.error('VECTOR_SEARCH_URL and FTS_SEARCH_URL are both required — this reads the live indexes'); process.exit(2) }
  console.log('── ARGUMENT 1A §1 · SEED CANDIDATE DRAW ──')
  console.log(`  dense arm  : ${TAGS.length} tags x ${PROBES.COST.length} probes, ${PER_PROBE} each, tier=parliamentary`)
  console.log(`  keyword arm: ${TAGS.length} tags x ${FTS_PHRASES.COST.length} phrases, regex-confirmed against the R2 body`)
  console.log(`  target     : ${PER_TAG} candidates per tag after post-stratification, plus ${CONTROL_N} random controls\n`)

  const all: Candidate[] = []

  // ── dense arm ──────────────────────────────────────────────────────────────────────────────────
  for (const tag of TAGS) {
    const results = await vectorBatch(PROBES[tag].map((q) => ({ query: q, limit: PER_PROBE })))
    const ids = Array.from(new Set(results.flat().map((h: any) => h.id)))
    const meta = await hydrate(ids)
    let kept = 0
    results.forEach((hits, i) => {
      for (const h of hits) {
        const m = meta.get(h.id)
        if (!m || !PARLIAMENTARY_CORPORA.includes(m.corpus)) continue
        all.push({
          tag, arm: 'dense', id: h.id, chunkId: h.chunkId ?? `${h.id}#0`, corpus: m.corpus,
          decade: decadeOf(m.itemDate), speaker: m.speaker ?? null, words: m.words ?? null,
          score: h.score ?? null, text: (h.snippet ?? '').replace(/\s+/g, ' ').trim(),
          probe: PROBES[tag][i],
        })
        kept++
      }
    })
    console.log(`  dense   ${tag.padEnd(18)} ${kept} hits over ${PROBES[tag].length} probes`)
  }

  // ── keyword arm ────────────────────────────────────────────────────────────────────────────────
  for (const tag of TAGS) {
    let proposed = 0, confirmed = 0
    for (const phrase of FTS_PHRASES[tag]) {
      const hits = await fts(phrase, 30).catch(() => [])
      proposed += hits.length
      const meta = await hydrate(hits.map((h: any) => h.id))
      for (const h of hits) {
        const m = meta.get(h.id)
        if (!m || !m.r2Key || !PARLIAMENTARY_CORPORA.includes(m.corpus)) continue
        const body = await r2Get(m.r2Key).catch(() => null)
        if (!body) continue
        const hit = PATTERNS[tag].find((p) => p.test(body))
        if (!hit) continue          // ⚠ FTS proposed it; the regex refused it. That is the design.
        confirmed++
        all.push({
          tag, arm: 'keyword', id: h.id, chunkId: `${h.id}#0`, corpus: m.corpus,
          decade: decadeOf(m.itemDate), speaker: m.speaker ?? null, words: m.words ?? null,
          score: null, text: around(body, hit), confirmedBy: String(hit), probe: phrase,
        })
      }
    }
    console.log(`  keyword ${tag.padEnd(18)} ${proposed} proposed by BM25 → ${confirmed} confirmed by the tag's own regex`)
  }

  // ── post-stratify per tag ──────────────────────────────────────────────────────────────────────
  const selected: Candidate[] = []
  console.log('\n  ── post-stratification, per tag ──')
  for (const tag of TAGS) {
    const mine = all.filter((c) => c.tag === tag)
    const dedup = new Map<string, Candidate>()
    for (const c of mine) if (!dedup.has(c.chunkId)) dedup.set(c.chunkId, c)
    const picked = postStratify([...dedup.values()], PER_TAG)
    selected.push(...picked)
    const strata = new Set(picked.map((c) => `${c.corpus} ${c.decade}`))
    console.log(`    ${tag.padEnd(18)} ${mine.length} raw → ${dedup.size} distinct → ${picked.length} drawn across ${strata.size} strata`)
  }

  // ── the random control arm ─────────────────────────────────────────────────────────────────────
  const control = await prisma.$queryRaw<any[]>`
    SELECT id, corpus, speaker, "itemDate", "wordCount" AS words, "r2Key"
    FROM corpus_sections
    WHERE corpus = ANY(${PARLIAMENTARY_CORPORA}) AND status = 'compiled' AND "r2Key" IS NOT NULL
      AND "itemDate" >= '1800-01-01' AND "wordCount" BETWEEN 40 AND 400
    ORDER BY md5(id) LIMIT ${CONTROL_N}`
  const controls: Candidate[] = []
  for (const r of control) {
    const body = await r2Get(r.r2Key).catch(() => null)
    if (!body) continue
    controls.push({
      tag: 'COST', arm: 'control', id: r.id, chunkId: `${r.id}#0`, corpus: r.corpus,
      decade: decadeOf(r.itemDate), speaker: r.speaker ?? null, words: Number(r.words ?? 0),
      score: null, text: body.replace(/\s+/g, ' ').trim().slice(0, 900), probe: '(random control — no probe)',
    })
  }
  console.log(`\n  control arm: ${controls.length} random passages drawn ORDER BY md5(id), 40–400 words`)

  fs.writeFileSync(OUT, JSON.stringify({
    takenAt: new Date().toISOString(), perProbe: PER_PROBE, perTag: PER_TAG,
    vector: V, fts: F, candidates: selected, controls,
  }, null, 2))
  console.log(`\n  wrote ${OUT} — ${selected.length} candidates + ${controls.length} controls, UNLABELLED`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('FAILED', e); await prisma.$disconnect(); process.exit(1) })
