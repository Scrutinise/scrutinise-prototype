/**
 * enumerate-quangos.ts — V21 §1: measure the quango/ALB document universe on gov.uk.
 *
 * Read-only against public gov.uk APIs; the only production write is the
 * `quangos-govuk` placeholder row in corpus_targets (the honest-denominator
 * input). Run locally by CC:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/enumerate-quangos.ts
 *
 * 1. Pull the full organisations register (gov.uk Organisations API,
 *    ~1,255 orgs / 63 pages — verified 12 Jun 2026).
 * 2. Per organisation, one Search API call with count=0 + facet_format
 *    returns total docs + per-format counts.
 * 3. Output: docs/QUANGO_UNIVERSE.md (ranked table) + .csv
 *    (for the Corpus Status xls), and the corpus_targets placeholder.
 *
 * Rate: sequential, 300ms gap ≈ 3.3 rps — matches the govuk-content Railway
 * budget (300ms/5 per IP); ~7 min for the full register. 429/5xx retries
 * after 60s cooling (V20 seeder lesson). Checkpointed every 100 orgs.
 *
 * Double-counting caveat (documented in the MD): a document tagged to N
 * organisations is counted once per organisation, so the per-org sum
 * overstates the distinct-document universe. The corpus_targets estimate is
 * written with `~` provenance noting this.
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const GAP_MS = 300
const CHECKPOINT = path.join(__dirname, 'enumerate-quangos-checkpoint.json')
const DOCS_DIR = path.join(__dirname, '../../docs')

// ── Relevance rule (documented in QUANGO_UNIVERSE.md §method) ────────────────
// Substantive policy/legal/guidance content only — news, speeches, forms,
// transparency returns etc. are not corpus material.
const RELEVANT_EXACT = new Set([
  'guidance', 'statutory_guidance', 'detailed_guide', 'manual', 'manual_section',
  'policy_paper', 'decision', 'regulation', 'notice', 'research',
  'independent_report', 'impact_assessment', 'corporate_report',
  'consultation_outcome', 'closed_consultation', 'open_consultation',
  'government_response', 'standard', 'code_of_practice', 'circular',
])
// Custom document types (e.g. flood_and_coastal_erosion_risk_management_
// research_report) follow naming suffixes.
const RELEVANT_SUFFIX = /_(report|decision|guidance|notice|direction|standard|regulation|return)$/
// Already held as dedicated corpora — excluded from the quangos-govuk estimate
// so the denominator doesn't double-count (et-decisions, uk-treaties,
// hmrc-manuals are separate corpus_targets rows).
const EXCLUDED_FORMATS = /(_tribunal_decision$|^international_treaty$|^hmrc_manual)/

interface OrgRecord {
  slug: string
  title: string
  bodyType: string          // Organisations API "format" — Ministerial department / Executive agency / NDPB / Other …
  govukStatus: string       // live | exempt | transitioning | joining | closed
  parent: string | null
  totalDocs: number
  relevantDocs: number
  formats: Record<string, number>
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

async function listAllOrganisations(): Promise<Array<Omit<OrgRecord, 'totalDocs' | 'relevantDocs' | 'formats'>>> {
  const orgs: Array<Omit<OrgRecord, 'totalDocs' | 'relevantDocs' | 'formats'>> = []
  let url: string | null = 'https://www.gov.uk/api/organisations?page=1'
  while (url) {
    const data: any = await fetchJson(url)
    for (const o of data.results) {
      orgs.push({
        slug: o.details?.slug ?? o.web_url?.split('/').pop() ?? '',
        title: o.title,
        bodyType: o.format ?? 'Unknown',
        govukStatus: o.details?.govuk_status ?? 'unknown',
        parent: o.parent_organisations?.[0]?.web_url?.split('/').pop() ?? null,
      })
    }
    url = data.next_page_url ?? null
    await sleep(GAP_MS)
  }
  return orgs
}

async function countDocsForOrg(slug: string): Promise<{ total: number; formats: Record<string, number> }> {
  const url = `https://www.gov.uk/api/search.json?filter_organisations=${encodeURIComponent(slug)}&count=0&facet_format=200`
  const data = await fetchJson(url)
  const formats: Record<string, number> = {}
  for (const opt of data.facets?.format?.options ?? []) {
    formats[opt.value.slug] = opt.documents
  }
  return { total: data.total ?? 0, formats }
}

function isRelevant(format: string): boolean {
  if (EXCLUDED_FORMATS.test(format)) return false
  return RELEVANT_EXACT.has(format) || RELEVANT_SUFFIX.test(format)
}

function relevantCount(formats: Record<string, number>): number {
  return Object.entries(formats).reduce((s, [f, n]) => s + (isRelevant(f) ? n : 0), 0)
}

// ── Outputs ──────────────────────────────────────────────────────────────────

const CSV_FORMAT_COLS = [
  'guidance', 'statutory_guidance', 'detailed_guide', 'manual_section', 'manual',
  'policy_paper', 'decision', 'regulation', 'notice', 'research',
  'independent_report', 'impact_assessment', 'corporate_report',
  'consultation_outcome', 'government_response',
]

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(records: OrgRecord[]): string {
  const file = path.join(DOCS_DIR, 'QUANGO_UNIVERSE.csv')
  const header = ['organisation', 'slug', 'body_type', 'govuk_status', 'parent', 'total_docs', 'relevant_docs',
    ...CSV_FORMAT_COLS, 'other_relevant']
  const lines = [header.join(',')]
  for (const r of records) {
    const namedSum = CSV_FORMAT_COLS.reduce((s, f) => s + (isRelevant(f) ? (r.formats[f] ?? 0) : 0), 0)
    const otherRelevant = r.relevantDocs - namedSum
    lines.push([
      csvEscape(r.title), r.slug, csvEscape(r.bodyType), r.govukStatus, r.parent ?? '',
      r.totalDocs, r.relevantDocs,
      ...CSV_FORMAT_COLS.map(f => r.formats[f] ?? 0),
      otherRelevant,
    ].join(','))
  }
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8')
  return file
}

function fmtTopFormats(formats: Record<string, number>, n = 4): string {
  return Object.entries(formats)
    .filter(([f]) => isRelevant(f))
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([f, c]) => `${f} ${c.toLocaleString()}`)
    .join(' · ')
}

function writeMarkdown(records: OrgRecord[]): string {
  const file = path.join(DOCS_DIR, 'QUANGO_UNIVERSE.md')
  const ranked = [...records].sort((a, b) => b.relevantDocs - a.relevantDocs)
  const live = records.filter(r => r.govukStatus !== 'closed')
  const totalRelevant = records.reduce((s, r) => s + r.relevantDocs, 0)
  const liveRelevant = live.reduce((s, r) => s + r.relevantDocs, 0)
  const totalAll = records.reduce((s, r) => s + r.totalDocs, 0)

  const byType = new Map<string, { orgs: number; relevant: number }>()
  for (const r of records) {
    const t = byType.get(r.bodyType) ?? { orgs: 0, relevant: 0 }
    t.orgs++; t.relevant += r.relevantDocs
    byType.set(r.bodyType, t)
  }

  const lines: string[] = []
  lines.push('# QUANGO UNIVERSE — gov.uk measured enumeration (V21 §1)')
  lines.push('')
  lines.push(`*Measured ${new Date().toISOString().slice(0, 10)} against the gov.uk Organisations API (${records.length} organisations) and Search API (one facet_format query per organisation). Generated by \`scripts/ingest/enumerate-quangos.ts\` — re-run to refresh. This is the V21 scoping measurement: a ranked triage table, not a seed plan. No quango content was seeded.*`)
  lines.push('')
  lines.push('## Headline numbers')
  lines.push('')
  lines.push(`- **Organisations on the register:** ${records.length} (${live.length} not closed)`)
  lines.push(`- **Total documents (all formats, per-org sum):** ${totalAll.toLocaleString()}`)
  lines.push(`- **Relevant documents (substantive formats — see method):** ${totalRelevant.toLocaleString()} (${liveRelevant.toLocaleString()} from non-closed orgs)`)
  lines.push('')
  lines.push('⚠️ Per-org sums double-count documents tagged to multiple organisations; the distinct-document universe is smaller. The `quangos-govuk` corpus_targets placeholder carries this caveat.')
  lines.push('')
  lines.push('## Method')
  lines.push('')
  lines.push('- **Relevant formats:** exact set (guidance, statutory_guidance, detailed_guide, manual/manual_section, policy_paper, decision, regulation, notice, research, independent_report, impact_assessment, corporate_report, consultation_outcome/closed/open, government_response, standard, code_of_practice, circular) plus custom document types ending `_report`, `_decision`, `_guidance`, `_notice`, `_direction`, `_standard`, `_regulation`, `_return`.')
  lines.push('- **Excluded from the estimate** (already dedicated corpora): `*_tribunal_decision` (et-decisions), `international_treaty` (uk-treaties), `hmrc_manual*` (hmrc-manuals).')
  lines.push('- **Not counted as relevant:** news_story, press_release, speech, case_study, form, map, transparency, transaction, answer, document_collection (container), official_statistics.')
  lines.push('- **on-gov.uk vs external:** `govuk_status` — `live` publishes on gov.uk; `exempt` keeps its own website (gov.uk holds only a subset); `closed` orgs retain their archive on gov.uk.')
  lines.push('')
  lines.push('## By body type')
  lines.push('')
  lines.push('| body type | orgs | relevant docs |')
  lines.push('|---|---:|---:|')
  for (const [t, v] of [...byType.entries()].sort(([, a], [, b]) => b.relevant - a.relevant)) {
    lines.push(`| ${t} | ${v.orgs} | ${v.relevant.toLocaleString()} |`)
  }
  lines.push('')
  lines.push('## Ranked table — all organisations with ≥ 1 relevant document')
  lines.push('')
  lines.push('| # | organisation | body type | status | total docs | relevant | top formats |')
  lines.push('|---:|---|---|---|---:|---:|---|')
  let rank = 0
  for (const r of ranked) {
    if (r.relevantDocs === 0) continue
    rank++
    lines.push(`| ${rank} | ${r.title} | ${r.bodyType} | ${r.govukStatus} | ${r.totalDocs.toLocaleString()} | ${r.relevantDocs.toLocaleString()} | ${fmtTopFormats(r.formats)} |`)
  }
  lines.push('')
  const zeroCount = records.length - rank
  lines.push(`*${zeroCount} organisations have 0 relevant documents (mostly closed/renamed shells and exempt bodies publishing elsewhere). Full data incl. zeros: \`QUANGO_UNIVERSE.csv\`.*`)
  lines.push('')
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  return file
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let records: OrgRecord[] = []
  let doneSlugs = new Set<string>()
  if (fs.existsSync(CHECKPOINT)) {
    records = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'))
    doneSlugs = new Set(records.map(r => r.slug))
    console.log(`[quango] resuming from checkpoint — ${records.length} orgs already measured`)
  }

  console.log('[quango] fetching organisations register…')
  const orgs = await listAllOrganisations()
  console.log(`[quango] ${orgs.length} organisations on the register`)

  let i = 0
  for (const org of orgs) {
    i++
    if (!org.slug || doneSlugs.has(org.slug)) continue
    const { total, formats } = await countDocsForOrg(org.slug)
    records.push({ ...org, totalDocs: total, relevantDocs: relevantCount(formats), formats })
    if (records.length % 100 === 0) {
      fs.writeFileSync(CHECKPOINT, JSON.stringify(records), 'utf8')
      console.log(`[quango] ${records.length}/${orgs.length} measured (checkpointed)`)
    }
    await sleep(GAP_MS)
  }
  fs.writeFileSync(CHECKPOINT, JSON.stringify(records), 'utf8')

  // Dedupe (registry can repeat a slug across renames)
  const bySlug = new Map(records.map(r => [r.slug, r]))
  records = [...bySlug.values()]

  const mdFile = writeMarkdown(records)
  const csvFile = writeCsv(records)
  const totalRelevant = records.reduce((s, r) => s + r.relevantDocs, 0)
  console.log(`[quango] wrote ${mdFile}`)
  console.log(`[quango] wrote ${csvFile}`)
  console.log(`[quango] relevant-document universe (per-org sum): ${totalRelevant.toLocaleString()}`)

  // Honest-denominator placeholder (V21 §3). est in DOCUMENTS — sections will
  // run higher (et-decisions observed ~2.2 sections/doc); kept conservative.
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, blocked_reason, notes)
    VALUES ('quangos-govuk', 'Quangos / ALBs (gov.uk, unenumerated-by-org)', $1, false, 4, false, NULL,
            'V21 §1 measured per-org sum of relevant-format gov.uk documents (QUANGO_UNIVERSE.md). Overstates distinct docs (multi-org tagging); understates sections (~1 doc ≥ 1 section). Triage pending — no content seeded.')
    ON CONFLICT (corpus_key) DO UPDATE
      SET est_sections = EXCLUDED.est_sections, notes = EXCLUDED.notes, updated_at = NOW()
  `, [totalRelevant])
  console.log(`[targets] quangos-govuk est=${totalRelevant} (~, unenumerated-by-org)`)
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
