/**
 * v34-divisions-probe.ts — BRIEF_INGEST_POLITICAL_SOURCES §A, step 1.
 *
 * BYTES BEFORE HYPOTHESES. Fetches nothing into the DB. Dumps the ACTUAL JSON
 * shapes of every endpoint section A depends on, so the schema is designed
 * against what the APIs return rather than against what the brief assumed:
 *
 *   1. Commons Votes API  — total, list page, one division detail (RAW keys)
 *   2. Lords Votes API    — same
 *   3. Members API        — does it give party + constituency AT A DATE?
 *   4. Bill / stage link  — does a division record name the Bill it belongs to?
 *                           If not, where does the link actually come from?
 *   5. "No division"      — is there any endpoint that says a question was
 *                           agreed without a division, or must it be inferred?
 *
 * Raw payloads are written to docs/v34_probe/*.json so the next reader can see
 * the same bytes rather than my summary of them.
 */
import fs from 'fs'
import path from 'path'

const COMMONS = 'https://commonsvotes-api.parliament.uk'
const LORDS = 'https://lordsvotes-api.parliament.uk'
const MEMBERS = 'https://members-api.parliament.uk'
const BILLS = 'https://bills-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

const OUT = path.join(__dirname, '../../docs/v34_probe')
fs.mkdirSync(OUT, { recursive: true })

interface Probe { url: string; status: number | string; ms: number; body: any; err?: string }

async function probe(label: string, url: string): Promise<Probe> {
  const t0 = Date.now()
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    const ms = Date.now() - t0
    const text = await res.text()
    let body: any
    try { body = JSON.parse(text) } catch { body = { __unparsed: text.slice(0, 2000) } }
    fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(body, null, 2))
    return { url, status: res.status, ms, body }
  } catch (e: any) {
    return { url, status: 'ERR', ms: Date.now() - t0, body: null, err: e?.message }
  }
}

function keys(o: any, depth = 0): string {
  if (o == null) return String(o)
  if (Array.isArray(o)) return `Array(${o.length})` + (o.length && depth < 2 ? ` of { ${keys(o[0], depth + 1)} }` : '')
  if (typeof o !== 'object') return typeof o
  return Object.keys(o).map(k => `${k}: ${keys(o[k], depth + 1)}`).join(', ')
}

function show(label: string, p: Probe, sample = true) {
  console.log(`\n--- ${label}`)
  console.log(`    ${p.url}`)
  console.log(`    status=${p.status} ${p.ms}ms${p.err ? ` err=${p.err}` : ''}`)
  if (p.body != null && sample) console.log(`    shape: ${keys(p.body).slice(0, 1400)}`)
}

async function main() {
  console.log('=== 1. COMMONS VOTES API ===')
  const cTotal = await probe('commons-total', `${COMMONS}/data/divisions.json/searchTotalResults?queryParameters.take=1`)
  show('total', cTotal)
  console.log(`    VALUE: ${JSON.stringify(cTotal.body)}`)

  const cList = await probe('commons-list', `${COMMONS}/data/divisions.json/search?queryParameters.take=3&queryParameters.skip=0`)
  show('list (take=3)', cList)
  if (Array.isArray(cList.body) && cList.body[0]) {
    console.log(`    FULL first entry:\n${JSON.stringify(cList.body[0], null, 2).split('\n').map(l => '      ' + l).join('\n')}`)
  }

  const cId = Array.isArray(cList.body) && cList.body[0]?.DivisionId
  if (cId) {
    const cDetail = await probe('commons-detail', `${COMMONS}/data/division/${cId}.json`)
    show(`detail ${cId}`, cDetail)
    const b = cDetail.body
    if (b) {
      console.log(`    top-level keys: ${Object.keys(b).join(', ')}`)
      const m = (b.Ayes ?? [])[0]
      if (m) console.log(`    member record: ${JSON.stringify(m)}`)
      // Does anything in the payload name a Bill or a stage?
      const flat = JSON.stringify(b).toLowerCase()
      console.log(`    mentions "bill"? ${flat.includes('"bill')} | "stage"? ${flat.includes('stage')} | "amendment"? ${flat.includes('amendment')}`)
    }
  }

  // Is there a date-windowed search? (needed for incremental refresh)
  const cWindow = await probe('commons-list-datewindow',
    `${COMMONS}/data/divisions.json/search?queryParameters.startDate=2023-03-01&queryParameters.endDate=2023-03-31&queryParameters.take=5`)
  show('list windowed by date', cWindow)
  console.log(`    entries: ${Array.isArray(cWindow.body) ? cWindow.body.length : 'n/a'}`)

  console.log('\n=== 2. LORDS VOTES API ===')
  const lTotal = await probe('lords-total', `${LORDS}/data/Divisions/searchTotalResults`)
  show('total', lTotal); console.log(`    VALUE: ${JSON.stringify(lTotal.body)}`)
  const lList = await probe('lords-list', `${LORDS}/data/Divisions/search?take=3&skip=0`)
  show('list (take=3)', lList)
  const lId = Array.isArray(lList.body) && lList.body[0]?.divisionId
  if (lId) {
    const lDetail = await probe('lords-detail', `${LORDS}/data/Divisions/${lId}`)
    show(`detail ${lId}`, lDetail)
    const b = lDetail.body
    if (b) {
      console.log(`    top-level keys: ${Object.keys(b).join(', ')}`)
      const m = (b.contents ?? [])[0]
      if (m) console.log(`    member record: ${JSON.stringify(m)}`)
      const flat = JSON.stringify(b).toLowerCase()
      console.log(`    mentions "bill"? ${flat.includes('"bill')} | "amendment"? ${flat.includes('amendment')}`)
    }
  }

  console.log('\n=== 3. MEMBERS API — party + constituency AT A DATE ===')
  // A member who changed party is the test case, not a member who never did.
  const mSearch = await probe('members-search', `${MEMBERS}/api/Members/Search?House=1&IsCurrentMember=true&take=1`)
  show('search', mSearch)
  const mid = mSearch.body?.items?.[0]?.value?.id
  console.log(`    first member id: ${mid}`)
  if (mid) {
    const hist = await probe('members-history', `${MEMBERS}/api/Members/History?ids=${mid}`)
    show('History (party + constituency over time)', hist)
    const v = hist.body?.[0]?.value ?? hist.body?.items?.[0]?.value
    if (v) console.log(`    history keys: ${Object.keys(v).join(', ')}`)
    fs.writeFileSync(path.join(OUT, 'members-history-full.json'), JSON.stringify(hist.body, null, 2))
  }
  // Bulk: is there a "all members as at date" endpoint? That is what attributes
  // a vote to the person who held the seat AT THE TIME.
  const asAt = await probe('members-asat', `${MEMBERS}/api/Members/Search?House=1&MembershipStartedSince=2023-01-01&take=1`)
  show('Search MembershipStartedSince', asAt)
  console.log(`    totalResults: ${asAt.body?.totalResults}`)

  console.log('\n=== 4. BILL / STAGE LINK ===')
  // The brief: provision -> amendment that inserted it -> division on that amendment.
  // Check whether the Bills API exposes stages and, on a stage, any division ids.
  const bills = await probe('bills-list', `${BILLS}/api/v1/Bills?take=1`)
  show('bills', bills)
  const billId = bills.body?.items?.[0]?.billId
  console.log(`    first billId: ${billId}`)
  if (billId) {
    const stages = await probe('bill-stages', `${BILLS}/api/v1/Bills/${billId}/Stages?take=5`)
    show('bill stages', stages)
    const st = stages.body?.items?.[0]
    if (st) console.log(`    stage record: ${JSON.stringify(st).slice(0, 800)}`)
    const amend = await probe('bill-amendments', `${BILLS}/api/v1/Bills/${billId}/Stages/${st?.id ?? 0}/Amendments?take=3`)
    show('stage amendments', amend)
  }

  console.log('\n=== 5. "PASSED WITHOUT A DIVISION" — is it ever stated? ===')
  // If nothing states it, it must be derived: a stage that completed with no
  // division on it. Record which of those two it is.
  console.log('    (derived from §4: a Bill stage with zero divisions attached)')

  console.log(`\nRaw payloads written to ${OUT}`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
