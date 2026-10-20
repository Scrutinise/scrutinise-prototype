/**
 * analyse-ara.ts — INGEST_LEX_FIVE §2.1, second half. Offline over docs/ingest_traces/lex_five_s2_audit.json.
 * Splits "published by the department" into the department's OWN annual report and accounts versus
 * the reports of other bodies it publishes (arm's-length bodies, agencies), by comparing the title's
 * prefix (the words before "annual report") with the department's name and abbreviation.
 * Prints the own-report grid and every unmatched prefix, so a miss is visible rather than assumed.
 */
import fs from 'fs'
import path from 'path'
const UA = 'Scrutinise/1.0 (civic-tech; contact@scrutinise.org)'

const norm = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|of|for)\b/g, ' ').replace(/\s+/g, ' ').trim()

async function main() {
  const file = path.join(__dirname, '../../../docs/ingest_traces/lex_five_s2_audit.json')
  const a = JSON.parse(fs.readFileSync(file, 'utf8'))
  const orgs: any[] = []
  let url: string | null = 'https://www.gov.uk/api/organisations'
  while (url) { const r = await fetch(url, { headers: { 'User-Agent': UA } }); const d: any = await r.json(); orgs.push(...d.results); url = d.next_page_url ?? null }
  const info = new Map<string, { names: Set<string> }>()
  for (const o of orgs) {
    const slug = o.id.split('/').pop() as string
    const names = new Set<string>([norm(o.title)])
    if (o.details?.abbreviation) names.add(norm(o.details.abbreviation))
    // Titles the departments really use (read from the data below, not invented): DfE, HMT, DWP style acronyms come from abbreviation.
    names.add(norm(o.title.replace(/\s*\(.*\)\s*$/, '')))
    info.set(slug, { names })
  }
  // Departments that publish under a short name that is not the gov.uk abbreviation.
  const EXTRA: Record<string, string[]> = {
    'hm-treasury': ['hmt', 'treasury', 'hm treasury'],
    'department-for-digital-culture-media-sport': ['dcms'],
    'department-for-digital-culture-media-and-sport': ['dcms'],
    'department-for-culture-media-and-sport': ['dcms'],
    'ministry-of-housing-communities-local-government': ['mhclg'],
    'ministry-of-housing-communities-and-local-government-2018-2021': ['mhclg'],
    'department-for-business-energy-and-industrial-strategy': ['beis'],
    'department-for-environment-food-rural-affairs': ['defra'],
    'foreign-commonwealth-development-office': ['fcdo'],
    'foreign-commonwealth-office': ['fco'],
    'northern-ireland-office': ['nio'],
    'uk-export-finance': ['ukef'],
    'department-of-health-and-social-care': ['department of health', 'dhsc', 'dh'],
    'department-for-business-and-trade': ['dbt'],
    'department-for-science-innovation-and-technology': ['dsit'],
    'department-for-international-trade': ['dit'],
    'department-for-levelling-up-housing-and-communities': ['dluhc'],
    'department-for-communities-and-local-government': ['dclg'],
    'department-of-health': ['dh'],
    'hm-revenue-customs': ['hmrc', 'hm revenue and customs'],
  }
  for (const [k, v] of Object.entries(EXTRA)) for (const n of v) info.get(k)?.names.add(norm(n))

  const grid = (a.strict as any[]).filter(x => x.primary === x.org && x.type !== 'document_collection')
  const own: any[] = [], other: any[] = []
  for (const x of grid) {
    const prefix = norm(x.title.split(/annual\s+reports?/i)[0] ?? '')
    const names = info.get(x.org)?.names ?? new Set()
    const isOwn = prefix === '' || [...names].some(n => n && (prefix === n || prefix === n + ' dept' || prefix.startsWith(n + ' ')) && !/ agency| authority| commission/.test(prefix))
    ;(isOwn ? own : other).push(x)
  }
  console.log(`primary-published by a department: ${grid.length}; judged the DEPARTMENT'S OWN: ${own.length}; other bodies' reports: ${other.length}`)

  const fys = [...new Set(own.map(x => x.fy))].filter(f => f >= '2015-16' || f === 'none').sort()
  const orgsOwn = [...new Set(own.map(x => x.org))].sort()
  console.log('\nOWN-REPORT GRID (FY 2015-16 onward; count)')
  console.log(['org'.padEnd(56), ...fys.map(f => f.slice(2).padStart(6))].join(' '))
  for (const o of orgsOwn) console.log([o.padEnd(56), ...fys.map(f => { const n = own.filter(x => x.org === o && x.fy === f).length; return (n ? String(n) : '.').padStart(6) })].join(' '))

  const dupes = new Map<string, any[]>()
  for (const x of own) { const k = `${x.org}|${x.fy}`; dupes.set(k, [...(dupes.get(k) ?? []), x]) }
  console.log('\n(org, FY) with more than one own-matching document:')
  for (const [k, v] of dupes) if (v.length > 1 && !k.endsWith('none')) console.log(' ', k, v.map(x => `${x.type}:${x.title}`))
  console.log('\nown with FY none:')
  for (const x of own.filter(x => x.fy === 'none')) console.log(' ', x.org, '|', x.title, '|', x.type, x.date, x.link)

  const prefixes = new Map<string, number>()
  for (const x of other) { const p = norm(x.title.split(/annual\s+reports?/i)[0] ?? ''); prefixes.set(`${x.org} :: ${p}`, (prefixes.get(`${x.org} :: ${p}`) ?? 0) + 1) }
  console.log(`\nNOT-OWN prefixes (${prefixes.size} distinct) — review for misses:`)
  for (const [k, n] of [...prefixes.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 400)) console.log(' ', n, k)
  const fetchSet = own.filter(x => x.type === 'corporate_report' && x.fy !== 'none' && x.fy >= '2015-16')
  const cons = (re: RegExp) => fetchSet.filter(x => re.test(x.title)).length
  console.log(`\nFETCH SET (own, corporate_report, FY >= 2015-16): ${fetchSet.length} documents; titles naming accounts/report variants: results/datasets/summary ${cons(/results|dataset|technical|summary|sector|core tables/i)}`)
  for (const x of fetchSet.filter(x => /results|dataset|technical|summary|sector|core tables|supplement/i.test(x.title))) console.log('   not the main report?', x.date, x.title)
  fs.writeFileSync(path.join(__dirname, '../../../docs/ingest_traces/lex_five_s2_fetchset.json'), JSON.stringify(fetchSet, null, 1))
  fs.writeFileSync(path.join(__dirname, '../../../docs/ingest_traces/lex_five_s2_own.json'), JSON.stringify({ own, other }, null, 1))
}
main().catch(e => { console.error(e); process.exit(1) })
