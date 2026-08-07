/**
 * v32-committees-audit.ts — the audit BRIEF_INGEST_committees-content-gap.md §1–2 asks for,
 * plus the ADDENDUM's §A2 (government responses), §A3 (oral evidence) and §C (coverage span).
 *
 * READ-ONLY. Touches the committees API (listing walk) and Neon. No writes anywhere.
 *
 * WHY this exists rather than a reading of the code: GOLD_TEST_09 concluded committee report
 * bodies "are stubs and front matter, not report bodies". That conclusion was drawn from row
 * COUNTS in the Lance FTS table (2,575 rows over 2,511 titles → "~1 row each"). The count is
 * right; the inference is not — the committees ingest stores ONE section per DOCUMENT, so one
 * row per report is what a fully-ingested report looks like in this pipeline. This script
 * measures the bytes instead.
 *
 * Sections:
 *   A. DB side — what committees-reports / committees-evidence actually hold (word counts, not
 *      row counts), by document kind and by year.
 *   B. Source side — a windowed walk of /api/Publications recording, per year and per type,
 *      how many items carry a downloadable `documents[]` vs only an `additionalContentUrl`
 *      pointing at the (Cloudflare-challenged) publications.parliament.uk archive.
 *   C. Committee-type span — Commons / Lords / Joint, held vs available.
 *   D. Oral evidence (A3) — transcript length distribution, to tell full transcripts from stubs.
 *
 * Usage: tsx v32-committees-audit.ts [--skip-api] [--json=path]
 */
import fs from 'fs'
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { listCommitteesApiPage, CommitteesApiListItem } from './sources/committees-api'

const SKIP_API = process.argv.includes('--skip-api')
const JSON_OUT = (() => { const a = process.argv.find(x => x.startsWith('--json=')); return a ? a.split('=')[1] : null })()

const YEARS: Array<[string, string, string]> = []
for (let y = 2005; y <= 2026; y++) YEARS.push([String(y), `${y}-01-01`, `${y + 1}-01-01`])

const report: any = { generatedAt: new Date().toISOString() }

function pct(n: number, d: number) { return d === 0 ? '  —  ' : `${((n / d) * 100).toFixed(1)}%`.padStart(6) }

async function dbSide() {
  const p = getNeonPool()

  console.log('\n═══ A. WHAT THE DB ACTUALLY HOLDS ═══════════════════════════════════════════\n')

  const kinds = await p.query(`
    SELECT COALESCE(NULLIF(split_part("sectionTitle", ':', 1), ''), '(untitled / marker)') AS kind,
           count(*)::int                                                   AS rows,
           count(*) FILTER (WHERE status = 'compiled')::int                AS compiled,
           COALESCE(round(avg("wordCount") FILTER (WHERE status='compiled')), 0)::int AS avg_words,
           COALESCE(max("wordCount"), 0)::int                              AS max_words,
           count(*) FILTER (WHERE status='compiled' AND "wordCount" < 500)::int AS under_500w,
           COALESCE(sum("wordCount"), 0)::bigint                           AS total_words
    FROM corpus_sections WHERE corpus = 'committees-reports'
    GROUP BY 1 ORDER BY rows DESC`)

  console.log('committees-reports, by document kind (the title prefix the source sets):')
  console.log('   kind                          rows  compiled  avg words   max words  <500w      total words')
  for (const r of kinds.rows) {
    console.log(`   ${String(r.kind).slice(0, 26).padEnd(26)} ${String(r.rows).padStart(6)}  ${String(r.compiled).padStart(8)}  ${String(r.avg_words).padStart(9)}  ${String(r.max_words).padStart(10)}  ${String(r.under_500w).padStart(5)}  ${String(r.total_words).padStart(15)}`)
  }
  report.dbKinds = kinds.rows

  // The headline: are "Report:" rows stubs?
  const verdict = await p.query(`
    SELECT count(*)::int rows, count(DISTINCT "sectionTitle")::int titles,
           round(avg("wordCount"))::int avg_words, min("wordCount")::int min_words, max("wordCount")::int max_words,
           count(*) FILTER (WHERE "wordCount" >= 10000)::int over_10k,
           count(*) FILTER (WHERE "wordCount" < 500)::int  under_500,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "wordCount")::int median
    FROM corpus_sections
    WHERE corpus='committees-reports' AND status='compiled' AND "sectionTitle" ILIKE 'Report:%'`)
  const v = verdict.rows[0]
  console.log(`\n   ► "Report:" rows: ${v.rows} rows / ${v.titles} distinct titles`)
  console.log(`     words per row: min ${v.min_words}, median ${v.median}, mean ${v.avg_words}, max ${v.max_words}`)
  console.log(`     ${v.over_10k} rows are >10,000 words; only ${v.under_500} are <500 words`)
  console.log(`     VERDICT: ${v.median > 3000 ? 'FULL REPORT BODIES — not stubs' : 'stub-like'}`)
  report.reportRowVerdict = v

  // A2 — government responses
  const gr = await p.query(`
    SELECT split_part("sectionTitle", ':', 1) AS kind, count(*)::int rows,
           round(avg("wordCount"))::int avg_words,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "wordCount")::int median,
           count(*) FILTER (WHERE "wordCount" < 500)::int under_500
    FROM corpus_sections WHERE corpus='committees-reports' AND status='compiled'
      AND ("sectionTitle" ILIKE 'Government Response:%' OR "sectionTitle" ILIKE 'Special Report:%')
    GROUP BY 1 ORDER BY rows DESC`)
  console.log('\n   ► A2 — government responses (a "Special Report" usually PUBLISHES the response):')
  for (const r of gr.rows) console.log(`     ${String(r.kind).padEnd(22)} ${String(r.rows).padStart(5)} rows, median ${String(r.median).padStart(6)} words, mean ${String(r.avg_words).padStart(6)}, ${r.under_500} under 500w`)
  report.govResponses = gr.rows

  // A3 — oral evidence
  const oe = await p.query(`
    SELECT CASE WHEN id LIKE '%:oralevidence:%' THEN 'oral' ELSE 'written' END AS kind,
           count(*)::int rows, round(avg("wordCount"))::int avg_words,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "wordCount")::int median,
           max("wordCount")::int max_words,
           count(*) FILTER (WHERE "wordCount" < 500)::int  under_500,
           count(*) FILTER (WHERE "wordCount" >= 5000)::int over_5k
    FROM corpus_sections WHERE corpus='committees-evidence' AND status='compiled'
    GROUP BY 1 ORDER BY rows DESC`)
  console.log('\n   ► A3 — evidence, oral vs written (a real hearing transcript runs 8k–25k words):')
  for (const r of oe.rows) console.log(`     ${String(r.kind).padEnd(8)} ${String(r.rows).padStart(7)} rows, median ${String(r.median).padStart(6)}w, mean ${String(r.avg_words).padStart(6)}w, max ${String(r.max_words).padStart(7)}w, ${r.under_500} <500w, ${r.over_5k} >5,000w`)
  report.evidenceKinds = oe.rows

  // year span, held
  const yr = await p.query(`
    SELECT extract(year from "itemDate")::int AS yr,
           count(*) FILTER (WHERE corpus='committees-reports' AND "sectionTitle" ILIKE 'Report:%')::int reports,
           count(*) FILTER (WHERE corpus='committees-reports' AND ("sectionTitle" ILIKE 'Government Response:%' OR "sectionTitle" ILIKE 'Special Report:%'))::int responses,
           count(*) FILTER (WHERE corpus='committees-evidence')::int evidence
    FROM corpus_sections WHERE corpus LIKE 'committees%' AND status='compiled' AND "itemDate" IS NOT NULL
    GROUP BY 1 ORDER BY 1`)
  console.log('\n   ► held, by year (§C historical depth):')
  console.log('     year   report bodies   responses    evidence')
  for (const r of yr.rows) console.log(`     ${String(r.yr).padEnd(6)} ${String(r.reports).padStart(13)} ${String(r.responses).padStart(11)} ${String(r.evidence).padStart(11)}`)
  report.heldByYear = yr.rows

  // markers
  const mk = await p.query(`
    SELECT corpus, availability_note, count(*)::int n FROM corpus_sections
    WHERE corpus LIKE 'committees%' AND status <> 'compiled' GROUP BY 1,2 ORDER BY n DESC LIMIT 10`)
  console.log('\n   ► non-compiled rows (the honest-denominator markers):')
  for (const r of mk.rows) console.log(`     ${String(r.n).padStart(7)}  ${r.corpus}  "${String(r.availability_note ?? '').slice(0, 70)}"`)
  report.markers = mk.rows

  await endNeonPool()
}

/** The three publication types that carry a committee's own conclusions and the government's reply.
 *  Ids read from /api/PublicationType rather than hardcoded — they are stable but cheap to confirm. */
const PRIORITY_TYPES = ['Report', 'Special Report', 'Government Response']

async function apiSide() {
  console.log('\n═══ B/C. WHAT THE SOURCE OFFERS ════════════════════════════════════════════\n')
  console.log('Walking /api/Publications per TYPE per year-window.')
  console.log('⚠ The type filter is not cosmetic. An unfiltered year walk 500s server-side partway')
  console.log('  through most years (deep Skip), which silently truncates the year and understates')
  console.log('  the gap. Filtering by type keeps Skip shallow and the walk completes.')
  console.log('The listing carries documents[], additionalContentUrl and committee.house, so no')
  console.log('per-item detail call is needed.\n')

  const typeIds = await fetchTypeIds()
  const apiReport: any = {}

  for (const typeName of PRIORITY_TYPES) {
    const typeId = typeIds.get(typeName)
    if (!typeId) { console.log(`   ${typeName}: type id not found — skipped`); continue }

    console.log(`\n   ════ ${typeName} (typeId=${typeId}) ════`)
    console.log('     year    total   downloadable   archive-only   neither    Commons/Lords/Joint')
    const perYear: Record<string, any> = {}
    const houses = new Map<string, { withDocs: number; total: number }>()
    const inquiry = { with: 0, without: 0 }
    const resp = { linked: 0, total: 0 }
    let T = 0, D = 0, A = 0, N = 0

    for (const [year, start, end] of YEARS) {
      let skip = 0, total = -1
      const acc = { withDocs: 0, archiveOnly: 0, neither: 0, total: 0 }
      const h3 = new Map<string, number>()
      while (true) {
        const page = await listCommitteesApiPage('Publications', skip, 100, { start, end }, typeId)
        if (!page) { console.log(`     ${year}: LISTING FAILED at skip=${skip} — this year is PARTIAL`); break }
        if (total < 0) total = page.totalResults
        for (const it of page.items as Array<CommitteesApiListItem & any>) {
          const hasDocs = (it.documents ?? []).length > 0
          const hasArchive = Boolean(it.additionalContentUrl || it.additionalContentUrl2)
          const bucket = hasDocs ? 'withDocs' : hasArchive ? 'archiveOnly' : 'neither'
          acc[bucket]++; acc.total++
          const house = it.committee?.house ?? '?'
          h3.set(house, (h3.get(house) ?? 0) + 1)
          const key = `${house} / ${it.committee?.category?.name ?? '?'}`
          const cur = houses.get(key) ?? { withDocs: 0, total: 0 }
          cur.total++; if (hasDocs) cur.withDocs++
          houses.set(key, cur)
          if ((it.businesses ?? []).length > 0) inquiry.with++; else inquiry.without++
          resp.total++
          if ((it.governmentResponses?.publication ?? []).length > 0 || it.responseToPublicationId) resp.linked++
        }
        skip += 100
        if (skip >= total || page.items.length === 0) break
      }
      perYear[year] = acc
      T += acc.total; D += acc.withDocs; A += acc.archiveOnly; N += acc.neither
      const hs = ['Commons', 'Lords', 'Joint'].map(k => `${k[0]}:${h3.get(k) ?? 0}`).join(' ')
      console.log(`     ${year}  ${String(acc.total).padStart(6)}  ${String(acc.withDocs).padStart(13)}  ${String(acc.archiveOnly).padStart(13)}  ${String(acc.neither).padStart(8)}    ${hs}`)
    }
    console.log(`     TOTAL ${String(T).padStart(6)}  ${String(D).padStart(13)}  ${String(A).padStart(13)}  ${String(N).padStart(8)}`)
    console.log(`     → ${A} ${typeName} bodies reachable ONLY via the publications.parliament.uk archive URL.`)
    console.log(`     §C house/category span:`)
    for (const [h, c] of [...houses.entries()].sort((a, b) => b[1].total - a[1].total)) {
      console.log(`        ${h.padEnd(26)} ${String(c.total).padStart(6)} items, ${String(c.withDocs).padStart(6)} downloadable (${pct(c.withDocs, c.total)})`)
    }
    console.log(`     §B inquiry id present on ${inquiry.with}/${inquiry.with + inquiry.without} (${pct(inquiry.with, inquiry.with + inquiry.without)})`)
    console.log(`     §B report↔response link present on ${resp.linked}/${resp.total} (${pct(resp.linked, resp.total)})`)

    apiReport[typeName] = { typeId, perYear, totals: { total: T, downloadable: D, archiveOnly: A, neither: N }, houses: Object.fromEntries(houses), inquiry, resp }
  }
  report.api = apiReport
}

async function fetchTypeIds(): Promise<Map<string, number>> {
  const res = await fetch('https://committees-api.parliament.uk/api/PublicationType', {
    headers: { 'User-Agent': 'Scrutinise-Ingest/1.0 (legal corpus research)' },
  })
  const list = (await res.json()) as Array<{ id: number; name: string }>
  return new Map(list.map(t => [t.name, t.id]))
}

async function main() {
  await dbSide()
  if (!SKIP_API) await apiSide()
  if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2)); console.log(`\n[audit] wrote ${JSON_OUT}`) }
}

main().catch((e) => { console.error('[audit] FATAL', e); process.exit(1) })
