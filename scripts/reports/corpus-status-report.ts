/**
 * corpus-status-report.ts — re-runnable corpus status workbook generator.
 *
 * Spec: docs/reports/corpus-status-report.md (written alongside this script — the brief
 * referenced that spec but it did not exist, so the contract is documented there now).
 *
 * GRAIN RULE (from the brief, non-negotiable): org / collection level, NEVER section level.
 * Every row in every tab is a corpus, an organisation, or a collection — never an individual
 * document or section. Section counts appear only as aggregate columns.
 *
 * Reads (all read-only):
 *   - corpus DB (NEON_DATABASE_URL, from scrutinise-web/.env): corpus_targets, corpus_sections,
 *     source_status, ingest_queue, corpus_snapshots
 *   - docs/QUANGO_UNIVERSE.csv (1,255 orgs, measured 2026-06-12 by enumerate-quangos.ts)
 *   - stats DB (STATS_DATABASE_URL, from scripts/stats/.env) for the Statistics tab — optional,
 *     the tab is skipped with a note if the DB is unreachable rather than failing the run.
 *
 * Usage: npm run corpus-status        (from scripts/reports/)
 * Output: docs/reports/output/corpus-status-<YYYY-MM-DD>.xlsx
 */
import 'dotenv/config'
import * as XLSX from 'xlsx'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { tierFor, jurisdictionFor } from '../ingest/search/corpus-map'

const ROOT = path.join(__dirname, '../..')
const OUT_DIR = path.join(ROOT, 'docs/reports/output')
const QUANGO_CSV = path.join(ROOT, 'docs/QUANGO_UNIVERSE.csv')

// The corpus DB URL lives in scrutinise-web/.env; the stats DB URL in scripts/stats/.env.
require('dotenv').config({ path: path.join(ROOT, 'scrutinise-web/.env') })
require('dotenv').config({ path: path.join(ROOT, 'scripts/stats/.env') })

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

/** Which corpora belong on the themed tabs. Corpus keys, not section ids — grain rule. */
const REGULATORS = new Set([
  'ofgem', 'ico', 'lgsco', 'fca-handbook', 'cps-guidance', 'sentencing-council',
  'college-of-policing', 'ofcom', 'nao-reports', 'cma-cases', 'psa', 'ombudsman',
])
const INQUIRIES = new Set(['inquiry-reports', 'inquiry-evidence', 'independent-reviews', 'law-commission'])

interface TargetRow {
  corpus_key: string; display_label: string | null; est_sections: number | null
  est_is_confirmed: boolean | null; priority: number | null; blocked: boolean | null
  blocked_reason: string | null; notes: string | null; retired: boolean | null; updated_at: Date | null
}
interface ActualRow {
  corpus: string; sections: string; compiled: string; words: string
  licences: string | null; jurisdictions: string | null; first_seen: Date | null; last_seen: Date | null
}
interface BreakerRow { source_key: string; state: string; trip_reason: string | null; tripped_at: Date | null; zero_output_streak: number | null }
interface QueueRow { corpus: string; status: string; n: string }

/** Minimal CSV reader — QUANGO_UNIVERSE.csv is machine-generated, but org names contain commas. */
function readCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const split = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let q = false
    for (const c of line) {
      if (c === '"') q = !q
      else if (c === ',' && !q) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out
  }
  const head = split(lines[0])
  return lines.slice(1).map((l) => {
    const cells = split(l)
    const row: Record<string, string> = {}
    head.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })
}

function sheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[], widths?: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows)
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }))
  else if (rows.length) ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.min(46, Math.max(12, k.length + 4)) }))
  if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] as string }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
}

async function main() {
  const url = process.env.NEON_DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL not set (expected in scrutinise-web/.env)')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 })

  console.log('Reading corpus DB…')
  const [targets, actuals, breakers, queue] = await Promise.all([
    pool.query<TargetRow>(`SELECT corpus_key, display_label, est_sections, est_is_confirmed, priority,
                                  blocked, blocked_reason, notes, retired, updated_at
                           FROM corpus_targets ORDER BY corpus_key`),
    pool.query<ActualRow>(`
      SELECT corpus,
             COUNT(*)::text AS sections,
             COUNT(*) FILTER (WHERE status = 'compiled')::text AS compiled,
             COALESCE(SUM("wordCount"), 0)::text AS words,
             string_agg(DISTINCT COALESCE(licence, '(none)'), ' | ') AS licences,
             string_agg(DISTINCT COALESCE(jurisdiction, '(none)'), ' | ') AS jurisdictions,
             MIN("createdAt") AS first_seen, MAX("createdAt") AS last_seen
      FROM corpus_sections GROUP BY corpus`),
    pool.query<BreakerRow>(`SELECT source_key, state, trip_reason, tripped_at, zero_output_streak FROM source_status`),
    pool.query<QueueRow>(`SELECT corpus, status, COUNT(*)::text AS n FROM ingest_queue GROUP BY corpus, status`),
  ])

  const actualBy = new Map(actuals.rows.map((r) => [r.corpus, r]))
  const breakerBy = new Map(breakers.rows.map((r) => [r.source_key, r]))
  const queueBy = new Map<string, Record<string, number>>()
  for (const q of queue.rows) {
    const e = queueBy.get(q.corpus) ?? {}
    e[q.status] = num(q.n)
    queueBy.set(q.corpus, e)
  }

  // ---- Corpus Status (one row per tracked corpus — the ~68/70 the brief expects) ----
  const corpusRows = targets.rows
    .filter((t) => !t.retired)
    .map((t) => {
      const a = actualBy.get(t.corpus_key)
      const b = breakerBy.get(t.corpus_key)
      const q = queueBy.get(t.corpus_key) ?? {}
      const sections = num(a?.sections)
      const est = num(t.est_sections)
      return {
        'Corpus key': t.corpus_key,
        'Display label': t.display_label ?? '',
        Tier: tierFor(t.corpus_key),
        Jurisdiction: a?.jurisdictions ?? jurisdictionFor(t.corpus_key),
        Priority: t.priority ?? '',
        'Est. sections': est || '',
        'Est. confirmed': t.est_is_confirmed === null ? '' : t.est_is_confirmed ? 'yes' : 'estimate',
        'Actual sections': sections,
        Compiled: num(a?.compiled),
        'Compiled %': pct(num(a?.compiled), sections),
        'vs estimate %': est ? pct(sections, est) : null,
        Words: num(a?.words),
        Licence: a?.licences ?? '',
        'Breaker state': b?.state ?? '',
        'Trip reason': b?.trip_reason ?? '',
        'Queue done': q.done ?? 0,
        'Queue failed': q.failed ?? 0,
        'Queue skipped': q.skipped ?? 0,
        Blocked: t.blocked ? 'YES' : '',
        'Blocked reason': t.blocked_reason ?? '',
        'First ingested': a?.first_seen ? a.first_seen.toISOString().slice(0, 10) : '',
        'Last ingested': a?.last_seen ? a.last_seen.toISOString().slice(0, 10) : '',
        Notes: t.notes ?? '',
      }
    })
    .sort((x, y) => Number(y['Actual sections']) - Number(x['Actual sections']))

  // ---- Themed tabs: subsets of the same corpus grain ----
  const subset = (keys: Set<string>) => corpusRows.filter((r) => keys.has(String(r['Corpus key'])))
  const parliamentaryRows = corpusRows.filter((r) => r.Tier === 'parliamentary')
  const regulatorRows = subset(REGULATORS)
  const inquiryRows = subset(INQUIRIES)

  // ---- Quangos (org level, from the measured universe) ----
  let quangoRows: Record<string, unknown>[] = []
  let quangoNote = ''
  if (fs.existsSync(QUANGO_CSV)) {
    const seededDocs = num(actualBy.get('quangos-govuk')?.sections)
    quangoRows = readCsv(QUANGO_CSV).map((r) => ({
      Organisation: r.organisation,
      Slug: r.slug,
      'Body type': r.body_type,
      'gov.uk status': r.govuk_status,
      Parent: r.parent,
      'Total docs': num(r.total_docs),
      'Relevant docs': num(r.relevant_docs),
      Guidance: num(r.guidance),
      'Statutory guidance': num(r.statutory_guidance),
      'Policy paper': num(r.policy_paper),
      Decision: num(r.decision),
      Research: num(r.research),
    })).sort((a, b) => Number(b['Relevant docs']) - Number(a['Relevant docs']))
    quangoNote = `Measured 2026-06-12 via enumerate-quangos.ts (gov.uk Organisations API). ${quangoRows.length} orgs. `
      + `quangos-govuk corpus currently holds ${seededDocs.toLocaleString()} sections. `
      + `Caveat: a document tagged to N organisations is counted once per organisation, so the per-org sum overstates the distinct universe.`
  } else {
    quangoNote = `docs/QUANGO_UNIVERSE.csv not found — Quangos tab empty. Re-run scripts/ingest/enumerate-quangos.ts to regenerate.`
  }

  // ---- Gaps & Pending ----
  const gapRows: Record<string, unknown>[] = []
  for (const t of targets.rows.filter((x) => !x.retired)) {
    if (!actualBy.has(t.corpus_key)) {
      gapRows.push({ Type: 'Tracked but no content', Item: t.corpus_key, Detail: t.display_label ?? '', Value: '', Action: t.blocked ? `blocked: ${t.blocked_reason ?? ''}` : 'not yet seeded' })
    }
  }
  for (const a of actuals.rows) {
    if (!targets.rows.some((t) => t.corpus_key === a.corpus)) {
      gapRows.push({ Type: 'Content but untracked', Item: a.corpus, Detail: 'present in corpus_sections, absent from corpus_targets', Value: num(a.sections), Action: 'add a corpus_targets row' })
    }
  }
  for (const t of targets.rows.filter((x) => x.blocked && !x.retired)) {
    gapRows.push({ Type: 'Blocked', Item: t.corpus_key, Detail: t.blocked_reason ?? '', Value: '', Action: 'unblock or retire' })
  }
  for (const b of breakers.rows.filter((x) => x.state !== 'ok')) {
    gapRows.push({ Type: 'Breaker not OK', Item: b.source_key, Detail: `${b.state}: ${b.trip_reason ?? ''}`, Value: b.zero_output_streak ?? '', Action: 'investigate before reseeding' })
  }
  for (const [corpus, st] of queueBy) {
    if (st.failed) gapRows.push({ Type: 'Queue failures', Item: corpus, Detail: 'ingest_queue rows in failed state', Value: st.failed, Action: 'inspect lastError' })
  }
  for (const a of actuals.rows) {
    const lic = a.licences ?? ''
    if (!lic || lic.includes('(none)') || lic.includes('pending-verification')) {
      gapRows.push({ Type: 'Licence gap', Item: a.corpus, Detail: lic || '(null)', Value: num(a.sections), Action: 'verify licence at source and backfill' })
    }
  }

  // ---- Statistics tab (optional — never fails the run) ----
  let statsRows: Record<string, unknown>[] = []
  let statsNote = ''
  const statsUrl = process.env.STATS_DATABASE_URL
  if (statsUrl) {
    try {
      const sp = new Pool({ connectionString: statsUrl, ssl: { rejectUnauthorized: false }, max: 1 })
      const ds = await sp.query<{ id: string, source: string, title: string, licence: string, refreshcadence: string, lastrefreshedat: Date | null, series: string, observations: string, first: Date | null, last: Date | null }>(`
        SELECT d.id, d.source::text, d.title, d.licence, d."refreshCadence"::text AS refreshcadence, d."lastRefreshedAt" AS lastrefreshedat,
               (SELECT COUNT(*) FROM stat_series s WHERE s."datasetId" = d.id)::text AS series,
               (SELECT COUNT(*) FROM stat_observation o JOIN stat_series s2 ON s2.id = o."seriesId" WHERE s2."datasetId" = d.id)::text AS observations,
               (SELECT MIN(o."periodStart") FROM stat_observation o JOIN stat_series s3 ON s3.id = o."seriesId" WHERE s3."datasetId" = d.id) AS first,
               (SELECT MAX(o."periodStart") FROM stat_observation o JOIN stat_series s4 ON s4.id = o."seriesId" WHERE s4."datasetId" = d.id) AS last
        FROM stat_dataset d ORDER BY d.id`)
      statsRows = ds.rows.map((r) => ({
        Dataset: r.id, Source: r.source, Title: r.title, Licence: r.licence, Cadence: r.refreshcadence,
        Series: num(r.series), Observations: num(r.observations),
        From: r.first ? r.first.toISOString().slice(0, 10) : '', To: r.last ? r.last.toISOString().slice(0, 10) : '',
        'Last refreshed': r.lastrefreshedat ? r.lastrefreshedat.toISOString().slice(0, 16).replace('T', ' ') : 'never',
      }))
      const size = await sp.query<{ pretty: string }>(`SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty`)
      statsNote = `Statistics layer (separate scrutinise-stats DB): ${statsRows.length} datasets, `
        + `${statsRows.reduce((a, r) => a + Number(r.Series), 0).toLocaleString()} series, `
        + `${statsRows.reduce((a, r) => a + Number(r.Observations), 0).toLocaleString()} observations, ${size.rows[0].pretty}. `
        + `Dataset-level only — time-series values deliberately NOT folded into this workbook.`
      await sp.end()
    } catch (e) {
      statsNote = `Statistics tab skipped — stats DB unreachable: ${e instanceof Error ? e.message : String(e)}`
      console.warn('  ' + statsNote)
    }
  } else {
    statsNote = 'Statistics tab skipped — STATS_DATABASE_URL not set (expected in scripts/stats/.env).'
    console.warn('  ' + statsNote)
  }

  // ---- Summary ----
  const totalSections = corpusRows.reduce((a, r) => a + Number(r['Actual sections']), 0)
  const totalCompiled = corpusRows.reduce((a, r) => a + Number(r.Compiled), 0)
  const totalWords = corpusRows.reduce((a, r) => a + Number(r.Words), 0)
  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

  const summaryRows: Record<string, unknown>[] = [
    { Metric: 'Generated at (UTC)', Value: generatedAt, Notes: 'Re-run: npm run corpus-status (scripts/reports/)' },
    { Metric: 'Grain', Value: 'org / collection', Notes: 'No tab lists individual sections or documents' },
    { Metric: 'Corpora tracked (non-retired)', Value: corpusRows.length, Notes: `${targets.rows.length} rows in corpus_targets incl. retired` },
    { Metric: 'Corpora with content', Value: actuals.rows.length, Notes: 'distinct corpus values in corpus_sections' },
    { Metric: 'Total sections', Value: totalSections, Notes: 'aggregate only — the section grain is never listed' },
    { Metric: 'Compiled sections', Value: totalCompiled, Notes: `${pct(totalCompiled, totalSections)}% of total` },
    { Metric: 'Total words', Value: totalWords, Notes: '' },
    { Metric: 'Blocked corpora', Value: corpusRows.filter((r) => r.Blocked === 'YES').length, Notes: 'see Gaps & Pending' },
    { Metric: 'Breakers not OK', Value: breakers.rows.filter((b) => b.state !== 'ok').length, Notes: `${breakers.rows.length} sources tracked` },
    { Metric: 'Parliamentary corpora', Value: parliamentaryRows.length, Notes: 'tier = parliamentary' },
    { Metric: 'Regulators & ombudsmen corpora', Value: regulatorRows.length, Notes: '' },
    { Metric: 'Inquiries & reviews corpora', Value: inquiryRows.length, Notes: '' },
    { Metric: 'Quango universe (orgs)', Value: quangoRows.length, Notes: quangoNote },
    { Metric: 'Gaps & pending items', Value: gapRows.length, Notes: '' },
    { Metric: 'Statistics layer', Value: statsRows.length ? `${statsRows.length} datasets` : 'n/a', Notes: statsNote },
  ]

  // ---- Build workbook ----
  const wb = XLSX.utils.book_new()
  sheet(wb, 'Summary', summaryRows, [34, 22, 90])
  sheet(wb, 'Corpus Status', corpusRows)
  sheet(wb, 'Quangos', quangoRows.length ? quangoRows : [{ Note: quangoNote }])
  sheet(wb, 'Inquiries & Reviews', inquiryRows.length ? inquiryRows : [{ Note: 'No corpora matched the inquiries/reviews set.' }])
  sheet(wb, 'Regulators & Ombudsmen', regulatorRows.length ? regulatorRows : [{ Note: 'No corpora matched the regulator/ombudsman set.' }])
  sheet(wb, 'Parliamentary', parliamentaryRows.length ? parliamentaryRows : [{ Note: 'No parliamentary-tier corpora found.' }])
  sheet(wb, 'Gaps & Pending', gapRows.length ? gapRows : [{ Note: 'No gaps detected.' }], [24, 32, 60, 14, 40])
  if (statsRows.length) sheet(wb, 'Statistics', statsRows, [30, 10, 52, 30, 12, 10, 14, 12, 12, 18])

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outFile = path.join(OUT_DIR, `corpus-status-${new Date().toISOString().slice(0, 10)}.xlsx`)
  XLSX.writeFile(wb, outFile)

  console.log(`\nWrote ${outFile}`)
  console.log(`Tabs: ${wb.SheetNames.join(' | ')}`)
  console.log(`  Corpus Status          ${corpusRows.length}`)
  console.log(`  Quangos                ${quangoRows.length}`)
  console.log(`  Inquiries & Reviews    ${inquiryRows.length}`)
  console.log(`  Regulators & Ombudsmen ${regulatorRows.length}`)
  console.log(`  Parliamentary          ${parliamentaryRows.length}`)
  console.log(`  Gaps & Pending         ${gapRows.length}`)
  console.log(`  Statistics             ${statsRows.length}`)
  console.log(`Totals: ${totalSections.toLocaleString()} sections, ${totalWords.toLocaleString()} words`)

  await pool.end()
}

main().catch((e) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
