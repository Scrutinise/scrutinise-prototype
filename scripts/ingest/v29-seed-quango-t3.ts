/**
 * v29-seed-quango-t3.ts — V29 §2: Quango Tranche 3 — THE TAIL.
 *
 * T1 (V22/V23) took non-ministerial ranks 1–20 by relevant-doc weight; T2 (V27)
 * took non-ministerial ranks 21–60 + ALL ministerial departments (format-
 * restricted). T3 closes the org universe to 100%: every REMAINING org in
 * QUANGO_UNIVERSE.csv with relevant-format docs that T1/T2 did not cover — i.e.
 * non-ministerial ranks 61+ (and any other body type not already seeded).
 * Diminishing returns per org is expected and fine — the point is org closure.
 *
 * Same machinery as T1/T2: govuk-content rows under corpus 'quangos-govuk'
 * (OGL), the broad statute-adjacent format set, URL-level dedup against every
 * gov.uk URL already in corpus_sections, utaac_decision + fatality_notice
 * excluded, the per-org 5× register-estimate guard.
 *
 * Modes:
 *   --count    (no network) CSV-only sizing: covered vs tail org counts + the
 *              register relevant-doc sum of the tail. Instant.
 *   default (--dry-run): re-measure each tail org's live relevant facet count,
 *              print per-org table + 5× guard verdicts + the seed total. Nothing
 *              written. (~one search.json facet call per org.)
 *   --seed     ⚠️ POST-PUSH only. Walks search.json per tail org, client-filters
 *              to the broad set, URL-dedupes, seeds govuk-content rows (prio 3),
 *              skipping guard-paused orgs. Re-baseline quangos-govuk at drain.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const CSV = path.join(__dirname, '../../docs/QUANGO_UNIVERSE.csv')
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const CORPUS = 'quangos-govuk'
const T1_T2_ALB_COVERED = 60     // non-ministerial ranks 1..60 already seeded
const GUARD_MULTIPLE = 5

// Broad statute-adjacent set — identical to T1/T2.
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
  let res: Response
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA } })
  } catch (e) {
    // transient network throw (ECONNRESET etc.) — retry, don't kill the walk
    if (attempt > 4) throw e
    console.warn(`  network throw — retry ${attempt} in ${5 * attempt}s`)
    await sleep(5_000 * attempt)
    return fetchJson(url, attempt + 1)
  }
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 3) throw new Error(`${url}: HTTP ${res.status} after ${attempt} attempts`)
    console.warn(`  HTTP ${res.status} — cooling 60s (attempt ${attempt})`)
    await sleep(60_000)
    return fetchJson(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

interface CsvOrg { title: string; slug: string; bodyType: string; status: string; estRelevant: number }

function parseCsv(): CsvOrg[] {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n')
  const out: CsvOrg[] = []
  for (const line of lines.slice(1)) {
    const cols: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) { cols.push(cur); cur = '' }
      else cur += ch
    }
    cols.push(cur)
    out.push({ title: cols[0], slug: cols[1], bodyType: cols[2], status: cols[3], estRelevant: Number(cols[6]) || 0 })
  }
  return out
}

// Covered = the slugs T1+T2 already seeded: non-ministerial ranks 1..60 (live,
// est>0) + all ministerial departments + HMRC (dedicated corpora).
function coveredSlugs(all: CsvOrg[]): Set<string> {
  const albRanking = all
    .filter(r => r.status === 'live' && r.bodyType !== 'Ministerial department' && r.slug !== 'hm-revenue-customs' && r.estRelevant > 0)
    .sort((a, b) => b.estRelevant - a.estRelevant)
  const covered = new Set<string>(albRanking.slice(0, T1_T2_ALB_COVERED).map(r => r.slug))
  for (const r of all) if (r.bodyType === 'Ministerial department') covered.add(r.slug)
  covered.add('hm-revenue-customs')
  return covered
}

// The T3 tail: every org with relevant-format docs not already covered.
function deriveTail(all: CsvOrg[]): CsvOrg[] {
  const covered = coveredSlugs(all)
  return all
    .filter(r => r.estRelevant > 0 && !covered.has(r.slug))
    .sort((a, b) => b.estRelevant - a.estRelevant)
}

interface Measured { org: CsvOrg; measured: number; paused: boolean }

async function measureOrg(org: CsvOrg): Promise<Measured> {
  const data = await fetchJson(`https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(org.slug)}&count=0&facet_format=300`)
  let measured = 0
  for (const opt of data.facets?.format?.options ?? []) {
    if (isRelevant(opt.value.slug)) measured += opt.documents
  }
  const paused = org.estRelevant > 0 && measured > GUARD_MULTIPLE * org.estRelevant
  return { org, measured, paused }
}

async function main() {
  const all = parseCsv()
  const tail = deriveTail(all)

  if (process.argv.includes('--count')) {
    const covered = coveredSlugs(all)
    const byStatus = new Map<string, number>()
    for (const o of tail) byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1)
    const regSum = tail.reduce((s, o) => s + o.estRelevant, 0)
    console.log(`QUANGO_UNIVERSE.csv: ${all.length} orgs total`)
    console.log(`covered by T1+T2 (+HMRC): ${covered.size}`)
    console.log(`T3 tail (relevant-doc orgs not covered): ${tail.length}`)
    console.log(`  by govuk_status: ${[...byStatus.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}`)
    console.log(`  register relevant-doc sum across tail: ${regSum.toLocaleString()}`)
    console.log(`  largest 12 tail orgs: `)
    for (const o of tail.slice(0, 12)) console.log(`    ${String(o.estRelevant).padStart(6)}  [${o.status}] ${o.title.slice(0, 50)}`)
    await endNeonPool(); return
  }

  const seed = process.argv.includes('--seed')
  console.log(`T3 tail: ${tail.length} orgs with relevant-format docs (not in T1/T2)\n`)

  const measured: Measured[] = []
  let total = 0
  for (const org of tail) {
    let m: Measured
    try { m = await measureOrg(org) } catch (e) { console.warn(`  ${org.slug}: measure failed — ${e}`); continue }
    measured.push(m)
    if (!m.paused) total += m.measured
    if (m.measured > 0 || m.paused) {
      const flag = m.paused ? '  ⏸ PAUSED (>5× est)' : ''
      console.log(`  ${org.title.slice(0, 46).padEnd(46)} est ${String(org.estRelevant).padStart(6)} → measured ${String(m.measured).padStart(6)}${flag}`)
    }
    await sleep(350)
  }

  const paused = measured.filter(m => m.paused)
  console.log(`\n  T3 orgs measured: ${measured.length}`)
  console.log(`  T3 GRAND TOTAL relevant docs to seed (ex-paused): ${total.toLocaleString()}`)
  if (paused.length > 0) {
    console.log(`\n  ⏸ ${paused.length} org(s) PAUSED (measured > 5× register estimate) — reported, NOT seeded:`)
    for (const m of paused) console.log(`     ${m.org.title} (${m.org.slug}): est ${m.org.estRelevant} → measured ${m.measured}`)
  }

  if (!seed) {
    console.log('\n[dry-run] nothing seeded — pass --seed POST-PUSH.')
    await endNeonPool(); return
  }

  // ── SEED PATH (POST-PUSH) ──────────────────────────────────────────────────
  const pool = getNeonPool()
  console.log('\n[seed] loading existing gov.uk sourceUrls for URL-level dedup…')
  const existing = await pool.query<{ url: string }>(
    `SELECT DISTINCT "sourceUrl" AS url FROM corpus_sections WHERE "sourceUrl" LIKE 'https://www.gov.uk/%'`)
  const held = new Set(existing.rows.map(r => r.url))
  console.log(`[seed] ${held.size.toLocaleString()} gov.uk URLs already held`)

  let seeded = 0
  for (const m of measured) {
    if (m.paused) { console.log(`[seed] ${m.org.slug}: SKIPPED (guard-paused)`); continue }
    if (m.measured === 0) continue
    let fetched = 0
    for (let start = 0; start < 300_000; start += 1500) {
      const data = await fetchJson(`https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(m.org.slug)}&fields=format,link&count=1500&start=${start}`)
      const results: Array<{ format?: string; link?: string }> = data.results ?? []
      if (results.length === 0) break
      fetched += results.length
      const rows = []
      for (const r of results) {
        if (!r.link || !r.format || !isRelevant(r.format)) continue
        const docPath = r.link.replace(/^\//, '')
        if (/^https?:/.test(docPath)) continue
        const url = `https://www.gov.uk/${docPath}`
        if (held.has(url)) continue
        held.add(url)
        rows.push({ id: `${CORPUS}:${docPath}`, corpus: CORPUS, docId: docPath, sourceType: 'govuk-content', priority: 3 })
      }
      if (rows.length > 0) { const { affected } = await bulkInsertQueueRows(rows); seeded += affected }
      await sleep(500)
    }
    console.log(`[seed] ${m.org.slug}: walked ${fetched}, measured ~${m.measured}`)
  }
  console.log(`\n[seed] quangos-govuk T3: ${seeded.toLocaleString()} new rows`)
  await pool.query(`
    UPDATE corpus_targets SET notes = COALESCE(notes, '') || ' | V29 T3 tail seeded: ' || $2 || ' rows.', updated_at = NOW()
    WHERE corpus_key = $1`, [CORPUS, seeded])
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
