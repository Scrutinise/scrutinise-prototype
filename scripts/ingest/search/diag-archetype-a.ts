/**
 * diag-archetype-a.ts — Search S1b archetype-A failure diagnosis (one-off).
 *
 * The brief: for each archetype-A gold query, find where the target legislation
 * section sits in the FULL BM25 result list (not just top-20), and decide
 * present-but-out-ranked (ranking problem → tier boost) vs absent (retrieval
 * problem → the section's indexed text lacks the citation terms → titles/citation
 * backfill is the fix).
 *
 * Two probes per expected source:
 *   1. EXISTS — direct id-filter lookup in Lance: is the row in the corpus at all?
 *      (independent of BM25; uses the gov.uk path tail of the gold pattern.)
 *   2. BM25 RANK — run the query as plain BM25 (no title-boost) over a large
 *      candidate set (k=DIAG_K), and report the rank of the first hit whose
 *      id\nsectionTitle matches the gold pattern, both in raw-BM25 order and in
 *      the title-boosted order the live engine uses. ">k / absent" if not found.
 *
 * Legislation gold patterns match on the id (gov.uk path), which the diagnostic
 * carries even when bodies aren't fetched — so DIAG selects light columns only.
 *
 * Usage: tsx search/diag-archetype-a.ts   (env: NEON not needed; R2 + Lance only)
 *        DIAG_K=100000 tsx search/diag-archetype-a.ts
 */
import fs from 'fs'
import path from 'path'
import { connectLance, FTS_TABLE } from './lance'
import { queryTerms, TITLE_BOOST } from './fts-core'
import { GOLD, GoldQuery, GoldSource } from './gold-queries'

const DIAG_K = parseInt(process.env.DIAG_K ?? '50000', 10)
// Auto-generated table only; the authoritative narrative lives in the hand-written
// docs/FTS_ARCHETYPE_A_DIAG.md (this file must not clobber it).
const OUT_MD = path.join(__dirname, '../../../docs/FTS_ARCHETYPE_A_DIAG_TABLE.md')

/** The gov.uk-path tail of a legislation gold pattern, for a LIKE existence probe.
 *  e.g. /ukpga/1988/50:section-21\b/ → 'ukpga/1988/50:section-21'. Returns null
 *  for free-text patterns (no path) — those are body-matched, not id-matched. */
function pathTail(p: RegExp): string | null {
  const src = p.source.replace(/\\\//g, '/') // regex .source escapes '/' as '\/'
  const m = src.match(/((?:ukpga|uksi|ukla|asp|wsi|nisr|nia|asc|mwa|eudr|eudn)\/\d+\/[0-9A-Za-z]+(?::[a-z]+-[0-9A-Za-z]+)?)/i)
  if (!m) return null
  return m[1].replace(/\\b/g, '')
}

type LightHit = { id: string; corpus: string; tier: string; sectionTitle: string | null; score: number }

function haystack(h: LightHit): string { return `${h.id}\n${h.sectionTitle ?? ''}` }

async function main() {
  const conn = await connectLance()
  const table = await conn.openTable(FTS_TABLE)
  const total = await table.countRows()
  console.log(`[diag] table=${FTS_TABLE} rows=${total} DIAG_K=${DIAG_K}`)

  const aQueries = GOLD.filter((q) => q.archetype === 'A')
  const md: string[] = []
  md.push('# FTS S1b — Archetype A failure diagnosis', '')
  md.push(`*Generated ${new Date().toISOString()} · Lance rows=${total} · BM25 candidate depth k=${DIAG_K} · TITLE_BOOST=${TITLE_BOOST}.*`, '')
  md.push('For each archetype-A query: does the target legislation row EXIST in the corpus,')
  md.push('and where does it sit in the **full** BM25 list (raw + title-boosted)?', '')
  md.push('| query | expected source | exists? | raw-BM25 rank | boosted rank | verdict |')
  md.push('|---|---|---|---|---|---|')

  for (const q of aQueries) {
    // 1) BM25 candidate set (light columns; body not needed for id-matched leg patterns).
    const terms = queryTerms(q.query)
    const rows = (await table
      .search(q.query, 'fts', 'body')
      .select(['id', 'corpus', 'tier', 'sectionTitle'])
      .limit(DIAG_K)
      .toArray()) as any[]
    const rawHits: LightHit[] = rows.map((r) => ({
      id: r.id, corpus: r.corpus, tier: r.tier, sectionTitle: r.sectionTitle ?? null,
      score: typeof r._score === 'number' ? r._score : 0,
    }))
    // boosted order = the live engine's re-rank (title-boost when a query term is in the title)
    const boosted = rawHits
      .map((h) => {
        const tb = !!h.sectionTitle && terms.some((t) => h.sectionTitle!.toLowerCase().includes(t))
        return { h, bscore: h.score * (tb ? TITLE_BOOST : 1) }
      })
      .sort((a, b) => b.bscore - a.bscore)
      .map((x) => x.h)

    for (const src of q.expected) {
      // 2) existence probe via id LIKE (legislation sources only; free-text → n/a)
      const tail = src.patterns.map(pathTail).find((t): t is string => !!t) ?? null
      let exists = 'n/a (free-text)'
      if (tail) {
        // contains-match: act-level tails (no section ref) continue with ':section-…',
        // so an ends-with probe would false-negative. '%tail%' answers "does any row
        // for this act/section exist".
        const safe = tail.replace(/'/g, "''")
        const hit = (await table.query().where(`id LIKE '%${safe}%'`).select(['id']).limit(1).toArray()) as any[]
        exists = hit.length ? `yes \`${hit[0].id}\`` : 'NO'
      }
      // 3) ranks within BM25 candidate set
      const rawRank = rawHits.findIndex((h) => src.patterns.some((p) => p.test(haystack(h))))
      const boostRank = boosted.findIndex((h) => src.patterns.some((p) => p.test(haystack(h))))
      const rawStr = rawRank >= 0 ? `#${rawRank + 1}` : `>${DIAG_K} / absent`
      const boostStr = boostRank >= 0 ? `#${boostRank + 1}` : `>${DIAG_K} / absent`

      let verdict: string
      if (tail && exists === 'NO') verdict = 'NOT IN CORPUS'
      else if (rawRank < 0) verdict = 'ABSENT from BM25 (body lacks citation terms) → retrieval'
      else if (rawRank >= 20) verdict = 'PRESENT but out-ranked → ranking'
      else verdict = 'present in top-20 (matcher gap?)'

      const label = src.label.replace(/\|/g, '\\|')
      md.push(`| ${q.id} | ${label} | ${exists} | ${rawStr} | ${boostStr} | ${verdict} |`)
      console.log(`  ${q.id} :: ${src.label} :: exists=${exists.split(' ')[0]} raw=${rawStr} boost=${boostStr} :: ${verdict}`)
    }
  }

  md.push('')
  fs.writeFileSync(OUT_MD, md.join('\n'))
  console.log(`[diag] wrote ${OUT_MD}`)
}

main().catch((e) => { console.error('[diag] FATAL', e); process.exit(1) })
