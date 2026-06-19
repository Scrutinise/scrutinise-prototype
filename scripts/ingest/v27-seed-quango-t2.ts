/**
 * v27-seed-quango-t2.ts — V27 §3: Quango Tranche 2 seeder.
 *
 * T2 (Corpus Status xls "Quango Universe" tiers), two cohorts:
 *   A. The NEXT ~40 live arm's-length bodies by relevant-format weight — i.e.
 *      ranks 21–60 of the same live / non-ministerial / non-HMRC ranking T1
 *      took its top 20 from. Broad statute-adjacent format set (same as T1).
 *   B. Ministerial departments, RESTRICTED to statute-adjacent formats only
 *      (statutory_guidance, regulation, manual, manual_section) to avoid the
 *      policy/press-release noise that dominates a department's gov.uk output.
 *      HMRC excluded (dedicated hmrc-* corpora).
 *
 * Same machinery as T1: govuk-content rows under corpus 'quangos-govuk' (OGL),
 * URL-level dedup against every gov.uk URL already in corpus_sections, the
 * utaac_decision + fatality_notice exclusions, breakers arm automatically.
 *
 * GUARD (brief §3): if an org's live measured count exceeds 5× its register
 * estimate (QUANGO_UNIVERSE.csv relevantDocs), PAUSE that org — do not seed it —
 * and report it, rather than seeding blind against a ballooned facet.
 *
 * Modes:
 *   default (--dry-run): derive both cohorts, re-measure each org's live facet
 *     counts, print the per-org table + the 5× guard verdicts. NOTHING written.
 *   --seed: ⚠️ POST-PUSH only. Walks search.json per org, client-filters to the
 *     cohort's format set, URL-dedupes, seeds govuk-content rows (priority 3),
 *     skipping any guard-paused org.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'

const CSV = path.join(__dirname, '../../scrutinise-docs/QUANGO_UNIVERSE.csv')
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const CORPUS = 'quangos-govuk'
const T1_SIZE = 20
const T2_ALB_COUNT = 40
const GUARD_MULTIPLE = 5

// Broad statute-adjacent set (ALBs) — identical to v22-seed-quango-t1.ts.
const RELEVANT_EXACT = new Set([
  'guidance', 'statutory_guidance', 'detailed_guide', 'manual', 'manual_section',
  'policy_paper', 'decision', 'regulation', 'notice', 'research',
  'independent_report', 'impact_assessment', 'corporate_report',
  'consultation_outcome', 'closed_consultation', 'open_consultation',
  'government_response', 'standard', 'code_of_practice', 'circular',
])
const RELEVANT_SUFFIX = /_(report|decision|guidance|notice|direction|standard|regulation|return)$/
const EXCLUDED_FORMATS = /(_tribunal_decision$|^international_treaty$|^hmrc_manual|^utaac_decision$|^fatality_notice$)/

function isRelevantAlb(format: string): boolean {
  if (EXCLUDED_FORMATS.test(format)) return false
  return RELEVANT_EXACT.has(format) || RELEVANT_SUFFIX.test(format)
}

// Narrow statute-adjacent set (ministerial departments) — brief §3.
const MINISTERIAL_FORMATS = new Set(['statutory_guidance', 'regulation', 'manual', 'manual_section'])
function isRelevantMinisterial(format: string): boolean {
  if (EXCLUDED_FORMATS.test(format)) return false
  return MINISTERIAL_FORMATS.has(format)
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

interface Org { title: string; slug: string; bodyType: string; estRelevant: number; cohort: 'alb' | 'ministerial' }

function parseCsv(): Array<{ title: string; slug: string; bodyType: string; status: string; estRelevant: number }> {
  const lines = fs.readFileSync(CSV, 'utf8').trim().split('\n')
  const out = []
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

function deriveCohorts(): Org[] {
  const all = parseCsv()
  // Cohort A — ALBs ranked 21..60 (T1 took 1..20).
  const albs = all
    .filter(r => r.status === 'live' && r.bodyType !== 'Ministerial department' && r.slug !== 'hm-revenue-customs' && r.estRelevant > 0)
    .sort((a, b) => b.estRelevant - a.estRelevant)
  const t2Albs = albs.slice(T1_SIZE, T1_SIZE + T2_ALB_COUNT)
    .map(r => ({ ...r, cohort: 'alb' as const }))
  // Cohort B — ministerial departments (format-restricted), HMRC excluded.
  const ministerial = all
    .filter(r => r.status === 'live' && r.bodyType === 'Ministerial department' && r.slug !== 'hm-revenue-customs')
    .sort((a, b) => b.estRelevant - a.estRelevant)
    .map(r => ({ ...r, cohort: 'ministerial' as const }))
  return [...t2Albs, ...ministerial].map(r => ({ title: r.title, slug: r.slug, bodyType: r.bodyType, estRelevant: r.estRelevant, cohort: r.cohort }))
}

interface Measured { org: Org; measured: number; paused: boolean }

async function measureOrg(org: Org): Promise<Measured> {
  const data = await fetchJson(`https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(org.slug)}&count=0&facet_format=300`)
  const rule = org.cohort === 'ministerial' ? isRelevantMinisterial : isRelevantAlb
  let measured = 0
  for (const opt of data.facets?.format?.options ?? []) {
    if (rule(opt.value.slug)) measured += opt.documents
  }
  // 5× guard uses the broad register estimate; for ministerial (narrow rule) the
  // measured count is a subset of the estimate, so it can only pause an ALB
  // whose live facet ballooned vs the snapshot.
  const paused = org.estRelevant > 0 && measured > GUARD_MULTIPLE * org.estRelevant
  return { org, measured, paused }
}

async function main() {
  const seed = process.argv.includes('--seed')
  const cohorts = deriveCohorts()
  console.log(`T2 cohorts: ${cohorts.filter(o => o.cohort === 'alb').length} ALBs (ranks 21–${T1_SIZE + T2_ALB_COUNT}) + ${cohorts.filter(o => o.cohort === 'ministerial').length} ministerial departments (format-restricted)\n`)

  const measured: Measured[] = []
  let albTotal = 0, minTotal = 0
  for (const org of cohorts) {
    const m = await measureOrg(org)
    measured.push(m)
    if (org.cohort === 'alb') albTotal += m.paused ? 0 : m.measured
    else minTotal += m.paused ? 0 : m.measured
    const flag = m.paused ? '  ⏸ PAUSED (>5× est)' : ''
    console.log(`  [${org.cohort === 'alb' ? 'ALB' : 'MIN'}] ${org.title.slice(0, 46).padEnd(46)} est ${String(org.estRelevant).padStart(6)} → measured ${String(m.measured).padStart(6)}${flag}`)
    await sleep(400)
  }

  const paused = measured.filter(m => m.paused)
  console.log(`\n  T2 ALB total (relevant, ex-paused):        ${albTotal.toLocaleString()}`)
  console.log(`  T2 ministerial total (narrow, ex-paused):  ${minTotal.toLocaleString()}`)
  console.log(`  T2 GRAND TOTAL to seed:                    ${(albTotal + minTotal).toLocaleString()}`)
  if (paused.length > 0) {
    console.log(`\n  ⏸ ${paused.length} org(s) PAUSED (measured > 5× register estimate) — reported, NOT seeded:`)
    for (const m of paused) console.log(`     ${m.org.title} (${m.org.slug}): est ${m.org.estRelevant} → measured ${m.measured}`)
  }

  if (!seed) {
    console.log('\n[dry-run] nothing seeded — pass --seed POST-PUSH.')
    await endNeonPool()
    return
  }

  // ── SEED PATH ───────────────────────────────────────────────────────────────
  const pool = getNeonPool()
  console.log('\n[seed] loading existing gov.uk sourceUrls for URL-level dedup…')
  const existing = await pool.query<{ url: string }>(`
    SELECT DISTINCT "sourceUrl" AS url FROM corpus_sections WHERE "sourceUrl" LIKE 'https://www.gov.uk/%'`)
  const held = new Set(existing.rows.map(r => r.url))
  console.log(`[seed] ${held.size.toLocaleString()} gov.uk URLs already held`)

  let seeded = 0
  for (const m of measured) {
    if (m.paused) { console.log(`[seed] ${m.org.slug}: SKIPPED (guard-paused)`); continue }
    const rule = m.org.cohort === 'ministerial' ? isRelevantMinisterial : isRelevantAlb
    let fetched = 0
    for (let start = 0; start < 300_000; start += 1500) {
      const data = await fetchJson(`https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(m.org.slug)}&fields=format,link&count=1500&start=${start}`)
      const results: Array<{ format?: string; link?: string }> = data.results ?? []
      if (results.length === 0) break
      fetched += results.length
      const rows = []
      for (const r of results) {
        if (!r.link || !r.format || !rule(r.format)) continue
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
    console.log(`[seed] ${m.org.slug} (${m.org.cohort}): walked ${fetched}, measured ~${m.measured} relevant`)
  }
  console.log(`\n[seed] quangos-govuk T2: ${seeded.toLocaleString()} new rows`)
  await pool.query(`
    UPDATE corpus_targets SET notes = COALESCE(notes, '') || ' | V27 T2 seeded: ' || $2 || ' rows.', updated_at = NOW()
    WHERE corpus_key = $1`, [CORPUS, seeded])
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
