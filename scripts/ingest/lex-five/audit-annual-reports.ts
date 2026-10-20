/**
 * audit-annual-reports.ts — INGEST_LEX_FIVE §2.1. Read-only. Writes nothing to Neon or R2.
 *
 * (1) What the corpus already holds with "annual report and accounts" in the title, by corpus.
 * (2) What gov.uk itself lists, per ministerial department (live AND closed predecessors),
 *     published on or after 2015-04-01: walked from /api/search.json with filter_organisations,
 *     not assumed from a departments x years grid.
 *
 * Output: docs/ingest_traces/lex_five_s2_audit.json + a printed grid (org x financial year).
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function j(url: string): Promise<any> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (r.ok) return r.json()
    if (r.status === 429 || r.status >= 500) { await sleep(2000 * (a + 1)); continue }
    throw new Error(`${r.status} ${url}`)
  }
  throw new Error(`gave up ${url}`)
}

const TITLE = /annual\s+report(?:s)?\s*(?:and|&)\s*accounts?|annual\s+report|resource\s+accounts|departmental\s+accounts/i
const SINCE = '2015-04-01'

/** Financial year as "YYYY-YY" (start year). Titles say "2022 to 2023", "2016 - 2017", "2022-23", "2022/23",
 *  or only a year-end ("year ended 31 March 2024"). Anything else is 'none' and is printed, never guessed. */
function fyOf(title: string): string {
  const m = /(20\d{2})\s*(?:-|–|—|\/|to)\s*(20)?(\d{2})\b/i.exec(title)
  if (m) return `${m[1]}-${m[3]}`
  const ye = /year\s+ended\s+(?:\d{1,2}\s+)?march\s+(20\d{2})/i.exec(title)
  if (ye) { const e = Number(ye[1]); return `${e - 1}-${String(e).slice(2)}` }
  return 'none'
}

async function main() {
  const pool = getNeonPool()
  console.log('HOST', new URL(process.env.NEON_DATABASE_URL!).host)

  // (1) held
  // A full-table regex scan outlasts the shared pool's 60 s client timeout, so this one read-only
  // query gets its own client with a long one.
  const { Client } = await import('pg')
  const big = new Client({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 600_000, query_timeout: 600_000 })
  await big.connect()
  const held = await big.query(
    `select corpus, count(*)::int sections, count(distinct "parentDocId")::int docs
       from corpus_sections
      where "sectionTitle" ~* 'annual report( and|,? &)? accounts|resource accounts|departmental accounts'
      group by 1 order by 2 desc`)
  await big.end()
  console.log('\nHELD (title matches annual report and accounts / resource accounts):')
  for (const r of held.rows) console.log(' ', r.corpus, r.sections, 'sections', r.docs, 'docs')
  const naoAcc = await pool.query(
    `select "parentDocId", min("itemDate")::text d, count(*)::int n from corpus_sections
      where corpus='nao-reports' and "parentDocId" ~* '(annual-report|accounts)' group by 1 order by 2`)
  console.log(`  nao-reports slugs mentioning annual-report/accounts: ${naoAcc.rows.length}`)

  // (2) gov.uk
  const orgs: any[] = []
  let url: string | null = 'https://www.gov.uk/api/organisations'
  while (url) { const d = await j(url); orgs.push(...d.results); url = d.next_page_url ?? null }
  const mins = orgs.filter(o => o.format === 'Ministerial department')
  console.log(`\nministerial department records on gov.uk (format tag): ${mins.length}`)
  // ⚠ gov.uk's own format tag is incomplete: DBT, DSIT, DIT and DLUHC are tagged "Other". Added by slug,
  // and every slug that does not resolve is printed rather than silently dropped.
  const EXTRA_SLUGS = [
    'department-for-business-and-trade', 'department-for-science-innovation-and-technology',
    'department-for-international-trade', 'department-for-levelling-up-housing-and-communities',
    'department-of-health', 'department-for-communities-and-local-government',
    'department-for-business-innovation-and-skills', 'hm-revenue-customs',
  ]
  for (const s of EXTRA_SLUGS) {
    const o = orgs.find(x => x.id.endsWith('/' + s))
    if (!o) { console.log(`  ⚠ extra slug not on gov.uk: ${s}`); continue }
    if (!mins.includes(o)) { mins.push(o); console.log(`  + added ${s} (format "${o.format}")`) }
  }

  const all: Array<{ org: string; primary: string; status: string; title: string; link: string; date: string; type: string; fy: string }> = []
  const perOrg: Record<string, { total: number; walked: number; matched: number }> = {}
  // Two phrase queries: the exact title form, and the accounts-only form some departments use.
  const QUERIES = ['"annual report and accounts"', '"annual reports and accounts"', '"resource accounts"']
  for (const o of mins) {
    const slug = o.id.split('/').pop() as string
    const status = o.details?.govuk_status + (o.details?.closed_at ? ` (closed ${o.details.closed_at.slice(0, 10)})` : '')
    let totalAll = 0, walked = 0, matched = 0
    for (const q of QUERIES) {
      let start = 0
      for (;;) {
        const qs = new URLSearchParams({
          filter_organisations: slug, q, count: '100', start: String(start),
          fields: 'title,link,content_store_document_type,public_timestamp,primary_publishing_organisation',
          filter_public_timestamp: `from:${SINCE}`,
        })
        const d = await j(`https://www.gov.uk/api/search.json?${qs}`)
        if (start === 0) totalAll += d.total
        walked += d.results.length
        for (const r of d.results) {
          if (!TITLE.test(r.title)) continue
          matched++
          all.push({ org: slug, primary: (Array.isArray(r.primary_publishing_organisation) ? r.primary_publishing_organisation[0] : r.primary_publishing_organisation) ?? '', status, title: r.title, link: r.link, date: (r.public_timestamp ?? '').slice(0, 10), type: r.content_store_document_type, fy: fyOf(r.title) })
        }
        start += 100
        // The denominator check: a walk that stops before `total` is a truncated audit, and says so.
        if (start >= d.total || !d.results.length) break
        if (start >= 9900) { console.log(`  ⚠ ${slug} ${q}: stopped at search depth cap, total ${d.total}`); break }
        await sleep(200)
      }
      await sleep(200)
    }
    perOrg[slug] = { total: totalAll, walked, matched }
  }
  const short = Object.entries(perOrg).filter(([, v]) => v.walked < v.total)
  console.log(`walk completeness: ${Object.keys(perOrg).length - short.length} of ${Object.keys(perOrg).length} organisations walked to their declared total`, short.length ? short : '')

  // dedupe by link
  const seen = new Set<string>()
  const uniq = all.filter(a => (seen.has(a.link) ? false : (seen.add(a.link), true)))
  const strict = uniq.filter(a => /annual\s+report(s)?\s*(and|&)\s*accounts?/i.test(a.title))
  console.log(`\ngov.uk title matches since ${SINCE}: ${uniq.length} documents (${strict.length} titled "annual report and accounts")`)

  const byType = new Map<string, number>()
  for (const a of strict) byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
  console.log('strict by document type:', [...byType.entries()])

  // The grid counts a document against a department only where that department is its PRIMARY publisher
  // (an agency's report is often co-listed under its parent) and not a collection page.
  const grid = strict.filter(a => a.primary === a.org && a.type !== 'document_collection')
  const orgsWith = [...new Set(grid.map(a => a.org))].sort()
  const fys = [...new Set(grid.map(a => a.fy))].sort()
  console.log(`\nGRID: ${grid.length} documents; primary publisher = the department; rows org, columns FY (count; . = none listed)`)
  console.log(['org'.padEnd(52), ...fys.map(f => f.slice(2).padStart(6))].join(' '))
  for (const o of orgsWith) {
    const cells = fys.map(f => { const n = grid.filter(a => a.org === o && a.fy === f).length; return (n ? String(n) : '.').padStart(6) })
    console.log([o.padEnd(52), ...cells].join(' '))
  }
  console.log('\nco-listed under a department but primary-published elsewhere (agencies etc.):', strict.filter(a => a.primary !== a.org && a.type !== 'document_collection').length)
  console.log('document_collection pages (strict):', strict.filter(a => a.type === 'document_collection').length)

  const out = path.join(__dirname, '../../../docs/ingest_traces/lex_five_s2_audit.json')
  fs.writeFileSync(out, JSON.stringify({ since: SINCE, ranAt: new Date().toISOString(), held: held.rows, perOrg, strict, other: uniq.filter(a => !strict.includes(a)) }, null, 1))
  console.log('\nwrote', out)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
