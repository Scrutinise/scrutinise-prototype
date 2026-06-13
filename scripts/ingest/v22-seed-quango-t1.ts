/**
 * v22-seed-quango-t1.ts — V22 §6: Quango Tranche 1 seeder.
 *
 * T1 (proposed tiers, Corpus Status xls): top 20 LIVE arm's-length bodies by
 * relevant-format weight — body type ≠ Ministerial department (those are T2,
 * format-restricted), HMRC excluded (hmrc-manuals/-codes-guidance/-ancillary
 * already dedicated corpora).
 *
 * Modes:
 *   default (--dry-run): derive T1 from scrutinise-docs/QUANGO_UNIVERSE.csv,
 *     re-measure each T1 org's live format facets (20 cheap count=0 queries),
 *     print the per-org/per-format table. NOTHING is written.
 *   --seed: ⚠️ ONLY after Charlie confirms tiers AND after the V22 push.
 *     Walks search.json per org (count=1500 pages), client-filters to the
 *     relevant-format set, URL-dedupes against every gov.uk-sourced corpus in
 *     corpus_sections (the queue is NOT a dedup source — cleanup deletes done
 *     rows), seeds govuk-content rows under corpus 'quangos-govuk' (OGL),
 *     priority 3. Breakers arm automatically.
 *
 * Format exclusions (V22 brief §6): utaac_decision + fatality_notice excluded
 * on top of the V21 rule (tribunal decisions ride FCL/et-decisions; fatality
 * notices are not legal corpus). UTAAC overlap note: gov.uk holds 2,019
 * utaac_decision docs vs FCL's ukut/aac feed ~1,250 (V19, 25 pages) —
 * partial overlap, neither seeded here.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const CSV = path.join(__dirname, '../../scrutinise-docs/QUANGO_UNIVERSE.csv')
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const CORPUS = 'quangos-govuk'
const T1_SIZE = 20

// Relevance rule — keep in lockstep with enumerate-quangos.ts (the measurement
// this seeder's tiers were triaged from).
const RELEVANT_EXACT = new Set([
  'guidance', 'statutory_guidance', 'detailed_guide', 'manual', 'manual_section',
  'policy_paper', 'decision', 'regulation', 'notice', 'research',
  'independent_report', 'impact_assessment', 'corporate_report',
  'consultation_outcome', 'closed_consultation', 'open_consultation',
  'government_response', 'standard', 'code_of_practice', 'circular',
])
const RELEVANT_SUFFIX = /_(report|decision|guidance|notice|direction|standard|regulation|return)$/
const EXCLUDED_FORMATS = /(_tribunal_decision$|^international_treaty$|^hmrc_manual|^utaac_decision$|^fatality_notice$)/

function isRelevant(format: string): boolean {
  if (EXCLUDED_FORMATS.test(format)) return false
  return RELEVANT_EXACT.has(format) || RELEVANT_SUFFIX.test(format)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchJson(url: string, attempt = 1): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 3) throw new Error(`${url}: HTTP ${res.status} after ${attempt} attempts`)
    console.warn(`  HTTP ${res.status} — cooling 60s (attempt ${attempt})`)
    await sleep(60_000)
    return fetchJson(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

interface T1Org { title: string; slug: string; bodyType: string; relevantDocs: number }

function deriveT1(): T1Org[] {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n')
  const orgs: T1Org[] = []
  for (const line of lines.slice(1)) {
    // CSV fields are unquoted except titles never contain commas... they DO
    // (e.g. "Foreign, Commonwealth & Development Office") — the file quotes
    // them; minimal CSV split with quote awareness:
    const cols: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
      else cur += ch
    }
    cols.push(cur)
    const [title, slug, bodyType, status] = cols
    const relevantDocs = Number(cols[6])
    if (status !== 'live') continue
    if (bodyType === 'Ministerial department') continue
    if (slug === 'hm-revenue-customs') continue
    if (!relevantDocs) continue
    orgs.push({ title, slug, bodyType, relevantDocs })
  }
  orgs.sort((a, b) => b.relevantDocs - a.relevantDocs)
  return orgs.slice(0, T1_SIZE)
}

async function main() {
  const seed = process.argv.includes('--seed')
  const t1 = deriveT1()

  console.log(`T1 — top ${T1_SIZE} live non-ministerial ALBs by relevant docs (HMRC excluded):\n`)
  let grandTotal = 0
  const liveFacets: Array<{ org: T1Org; counts: Record<string, number>; total: number }> = []
  for (const org of t1) {
    const data = await fetchJson(`https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(org.slug)}&count=0&facet_format=200`)
    const counts: Record<string, number> = {}
    let total = 0
    for (const opt of data.facets?.format?.options ?? []) {
      if (isRelevant(opt.value.slug)) { counts[opt.value.slug] = opt.documents; total += opt.documents }
    }
    grandTotal += total
    liveFacets.push({ org, counts, total })
    const top = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 4)
      .map(([f, n]) => `${f} ${n.toLocaleString()}`).join(' · ')
    console.log(`  ${org.title.padEnd(52)} ${String(total).padStart(7)}  (${org.bodyType}) ${top}`)
    await sleep(500)
  }
  console.log(`\n  T1 TOTAL (live re-measure, V22 exclusions applied): ${grandTotal.toLocaleString()} docs`)

  if (!seed) {
    console.log('\n[dry-run] nothing seeded — pass --seed after Charlie confirms tiers (and only post-push).')
    return
  }

  // ── SEED PATH (gated) ──────────────────────────────────────────────────────
  const pool = getNeonPool()
  console.log('\n[seed] loading existing gov.uk sourceUrls for URL-level dedup…')
  const existing = await pool.query<{ url: string }>(`
    SELECT DISTINCT "sourceUrl" AS url FROM corpus_sections
    WHERE "sourceUrl" LIKE 'https://www.gov.uk/%'`)
  const held = new Set(existing.rows.map(r => r.url))
  console.log(`[seed] ${held.size.toLocaleString()} gov.uk URLs already held`)

  let seeded = 0
  for (const { org, total } of liveFacets) {
    let fetched = 0
    for (let start = 0; start < 200_000; start += 1500) {
      const data = await fetchJson(`https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(org.slug)}&fields=format,link&count=1500&start=${start}`)
      const results: Array<{ format?: string; link?: string }> = data.results ?? []
      if (results.length === 0) break
      fetched += results.length
      const rows = []
      for (const r of results) {
        if (!r.link || !r.format || !isRelevant(r.format)) continue
        const docPath = r.link.replace(/^\//, '')
        if (/^https?:/.test(docPath)) continue // external links — exempt-org content, out of T1 scope
        if (held.has(`https://www.gov.uk/${docPath}`)) continue
        held.add(`https://www.gov.uk/${docPath}`) // also dedupes multi-org docs within this run
        rows.push({
          id: `${CORPUS}:${docPath}`,
          corpus: CORPUS,
          docId: docPath,
          sourceType: 'govuk-content',
          priority: 3,
        })
      }
      if (rows.length > 0) {
        const { affected } = await bulkInsertQueueRows(rows)
        seeded += affected
      }
      await sleep(500)
    }
    console.log(`[seed] ${org.slug}: walked ${fetched} docs (expected ~${total} relevant)`)
  }
  console.log(`[seed] quangos-govuk T1: ${seeded.toLocaleString()} new rows`)
  await pool.query(`
    UPDATE corpus_targets SET notes = COALESCE(notes, '') || ' | V22 T1 seeded: ' || $2 || ' rows.'
    WHERE corpus_key = $1`, [CORPUS, seeded])
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
