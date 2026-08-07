/**
 * v32-committees-phrase-check.ts — the acceptance test for BRIEF_INGEST_committees-content-gap.md §5,
 * and a correction of how GOLD_TEST_09 measured the same thing.
 *
 * GOLD_TEST_09 established "all 10 candidate conclusion phrases absent from committee text" by
 * BM25-searching each phrase at depth 200 over the whole `parliamentary` tier and then testing
 * literal containment in what came back. That measures RETRIEVABILITY, not PRESENCE, and it does
 * so with two hazards it did not control for:
 *
 *   1. A committee report is stored as ONE section — up to 455,137 characters. BM25 length
 *      normalisation buries a document that long, so it never enters a depth-200 result set and
 *      is never available to be containment-tested.
 *   2. The text extracted from a report PDF keeps the PDF's own hard line breaks and its
 *      justification spacing. "…one of the most important public \nhealth failures…" does not
 *      contain the substring "most important public health failures". The phrase is there; the
 *      test could not see it.
 *
 * So this reads the bodies DIRECTLY from R2 and matches on whitespace-normalised text. It answers
 * "is this phrase in the corpus at all", which is the ingest question. Retrievability is measured
 * separately (that is a search-thread question and a different fix).
 *
 * Read-only.  Usage: tsx v32-committees-phrase-check.ts [--all] [--json=path]
 *   default: report/response bodies only (~3.8k R2 reads). --all: every committees-* body.
 */
import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { r2Get } from './shared/r2-client'

const ALL = process.argv.includes('--all')
const JSON_OUT = (() => { const a = process.argv.find(x => x.startsWith('--json=')); return a ? a.split('=')[1] : null })()
const CONCURRENCY = parseInt(process.env.PHRASE_CHECK_CONCURRENCY ?? '32', 10)

/** The ten from GOLD_TEST_09 §probe-committee-conclusions, verbatim and in its order. */
export const GOLD_09_PHRASES: Array<{ phrase: string; note: string }> = [
  { phrase: 'recklessness, hubris and greed', note: 'Carillion (HC 769, May 2018) — the BEIS/Work & Pensions verdict on the directors' },
  { phrase: 'hubris and greed', note: 'shorter variant of the same' },
  { phrase: 'rotten corporate culture', note: 'Carillion — alternative wording from the same Summary' },
  { phrase: 'cosy club', note: 'Carillion — the Big Four verdict' },
  { phrase: 'most important public health failures', note: 'Coronavirus: lessons learned to date (HC 92, Oct 2021)' },
  { phrase: 'public health failures', note: 'shorter variant of the same' },
  { phrase: 'gradual and incremental', note: 'lessons learned — on the initial covid strategy' },
  { phrase: 'unimaginable cost', note: 'PAC on Test and Trace' },
  { phrase: 'measurable difference', note: 'PAC — whether Test and Trace met its objective' },
  { phrase: 'eye-watering', note: 'PAC variant' },
]

/** Collapse every run of whitespace to a single space — the same normalisation chunk.ts applies
 *  before embedding, so a phrase that survives this is a phrase the vector layer can see. */
const norm = (s: string) => s.replace(/\s+/g, ' ').toLowerCase()

async function mapPool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i], i) }
  }))
  return out
}

type Hit = { id: string; title: string; date: string | null; words: number; rawHit: boolean }

async function main() {
  const p = getNeonPool()
  const where = ALL
    ? `corpus LIKE 'committees%' AND status='compiled'`
    : `corpus='committees-reports' AND status='compiled' AND ("sectionTitle" ILIKE 'Report:%' OR "sectionTitle" ILIKE 'Special Report:%' OR "sectionTitle" ILIKE 'Government Response:%')`
  const { rows } = await p.query<{ id: string; sectionTitle: string | null; r2Key: string | null; wordCount: number | null; itemDate: Date | null }>(
    `SELECT id, "sectionTitle", "r2Key", "wordCount", "itemDate" FROM corpus_sections WHERE ${where} AND "r2Key" IS NOT NULL ORDER BY id`)

  console.log(`[phrase-check] scanning ${rows.length.toLocaleString()} ${ALL ? 'committees-*' : 'report/response'} bodies from R2 (concurrency ${CONCURRENCY})`)
  console.log(`[phrase-check] matching on WHITESPACE-NORMALISED text; "raw" column shows whether the`)
  console.log(`               phrase is also contiguous in the stored bytes (GOLD_TEST_09's test).\n`)

  const found = new Map<string, Hit[]>()
  for (const c of GOLD_09_PHRASES) found.set(c.phrase, [])

  let read = 0, misses = 0
  const t0 = Date.now()
  await mapPool(rows, CONCURRENCY, async (r) => {
    const body = await r2Get(r.r2Key!)
    read++
    if (read % 500 === 0) process.stdout.write(`\r   …${read}/${rows.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
    if (!body) { misses++; return }
    const n = norm(body)
    const raw = body.toLowerCase()
    for (const c of GOLD_09_PHRASES) {
      const needle = norm(c.phrase)
      if (n.includes(needle)) {
        found.get(c.phrase)!.push({
          id: r.id, title: (r.sectionTitle ?? '').slice(0, 90),
          date: r.itemDate ? String(r.itemDate).slice(0, 10) : null,
          words: r.wordCount ?? 0, rawHit: raw.includes(c.phrase.toLowerCase()),
        })
      }
    }
  })
  process.stdout.write(`\r   read ${read} bodies, ${misses} R2 misses, ${((Date.now() - t0) / 1000).toFixed(0)}s\n\n`)

  let present = 0
  const results: any[] = []
  for (const c of GOLD_09_PHRASES) {
    const hits = found.get(c.phrase)!
    const rawHits = hits.filter(h => h.rawHit).length
    if (hits.length) present++
    const mark = hits.length === 0 ? '❌ ABSENT ' : rawHits === 0 ? '✅ PRESENT (whitespace-split — invisible to a literal scan)' : '✅ PRESENT'
    console.log(`${mark}  "${c.phrase}"`)
    console.log(`      ${hits.length} document(s), ${rawHits} contiguous in the raw bytes — ${c.note}`)
    for (const h of hits.slice(0, 3)) console.log(`        ${h.id}  ${h.date ?? '—'}  ${h.words}w  ${h.title}`)
    results.push({ ...c, docs: hits.length, rawDocs: rawHits, hits: hits.slice(0, 5) })
  }

  console.log(`\n[phrase-check] ${present}/${GOLD_09_PHRASES.length} phrases present in the ${ALL ? 'committees corpora' : 'report/response bodies'} we hold.`)
  if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), scanned: rows.length, scope: ALL ? 'all' : 'reports', results }, null, 2)); console.log(`[phrase-check] wrote ${JSON_OUT}`) }
  await endNeonPool()
}

main().catch((e) => { console.error('[phrase-check] FATAL', e); process.exit(1) })
