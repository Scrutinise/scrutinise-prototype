/**
 * v34-divisions-probe2.ts — §A step 1b. The questions probe 1 raised.
 *
 *   Q1. NoVoteRecorded — is it present on OLD divisions too, or only recent
 *       ones? (It is the brief's "absence must be distinguishable from a no
 *       vote and from not being a member" and V28's source file ignores it.)
 *   Q2. Is `Party` on a division member the party AT THE DATE, or the party
 *       NOW? The brief asserts party is not in the division lists; probe 1 shows
 *       it IS. Which of the two it is decides whether we need the Members API
 *       at all. Test with a known party-switcher.
 *   Q3. Does anything link a division to its Bill and stage? Check the Bills
 *       API for a divisions route, and check how many division titles even
 *       name a Bill.
 *   Q4. Lords `amendmentMotionNotes` — what does it actually contain?
 *   Q5. Rate: how fast can we pull details politely?
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

async function get(url: string, label?: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
  const text = await res.text()
  let body: any
  try { body = JSON.parse(text) } catch { body = { __status: res.status, __unparsed: text.slice(0, 800) } }
  if (label) fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(body, null, 2))
  return { status: res.status, body }
}

async function main() {
  console.log('=== Q1. NoVoteRecorded across time ===')
  // Sample divisions across the id range: oldest, quartiles, newest.
  const total: number = (await get(`${COMMONS}/data/divisions.json/searchTotalResults?queryParameters.take=1`)).body
  console.log(`Commons total divisions: ${total}`)
  const oldest = await get(`${COMMONS}/data/divisions.json/search?queryParameters.take=1&queryParameters.skip=${total - 1}`)
  console.log(`oldest listed: ${JSON.stringify(oldest.body?.[0]?.Date)} id=${oldest.body?.[0]?.DivisionId} "${oldest.body?.[0]?.Title?.slice(0, 70)}"`)

  const samples: number[] = []
  for (const skip of [0, Math.floor(total * 0.25), Math.floor(total * 0.5), Math.floor(total * 0.75), total - 1]) {
    const p = await get(`${COMMONS}/data/divisions.json/search?queryParameters.take=1&queryParameters.skip=${skip}`)
    if (p.body?.[0]) samples.push(p.body[0].DivisionId)
    await new Promise(r => setTimeout(r, 400))
  }
  console.log(`sampled ids: ${samples.join(', ')}`)
  for (const id of samples) {
    const d = (await get(`${COMMONS}/data/division/${id}.json`)).body
    const nv = Array.isArray(d?.NoVoteRecorded) ? d.NoVoteRecorded.length : 'MISSING'
    const ay = Array.isArray(d?.Ayes) ? d.Ayes.length : 0
    const no = Array.isArray(d?.Noes) ? d.Noes.length : 0
    console.log(`  div ${id} (${String(d?.Date).slice(0, 10)}): ayes=${ay} noes=${no} NoVoteRecorded=${nv} tellers=${(d?.AyeTellers?.length ?? 0) + (d?.NoTellers?.length ?? 0)} | "${String(d?.Title).slice(0, 60)}"`)
    await new Promise(r => setTimeout(r, 400))
  }

  console.log('\n=== Q2. Is Party on the division record the party AT THE DATE? ===')
  // Find a member with >1 party in partyHistory, then find two divisions they
  // voted in either side of the switch and compare the recorded Party.
  const hist = (await get(`${MEMBERS}/api/Members/History?ids=172`, 'members-history-172')).body
  const v = hist?.[0]?.value
  if (v?.partyHistory) {
    console.log(`  member ${v.id} partyHistory (${v.partyHistory.length}):`)
    for (const p of v.partyHistory) {
      console.log(`    ${String(p.startDate).slice(0, 10)} → ${String(p.endDate ?? 'current').slice(0, 10)}  ${p.party?.name ?? p.name ?? JSON.stringify(p).slice(0, 80)}`)
    }
    console.log(`  houseMembershipHistory (${v.houseMembershipHistory?.length}):`)
    for (const h of (v.houseMembershipHistory ?? []).slice(0, 12)) {
      console.log(`    ${String(h.membershipStartDate).slice(0, 10)} → ${String(h.membershipEndDate ?? 'current').slice(0, 10)}  ${h.membershipFrom} (house ${h.house})`)
    }
  }

  console.log('\n=== Q3. Division → Bill / stage ===')
  // (a) Any Bills API route exposing divisions?
  for (const route of [
    `${BILLS}/api/v1/Bills/3973/Stages/19928/Divisions`,
    `${BILLS}/api/v1/Divisions?take=1`,
  ]) {
    try {
      const r = await get(route)
      console.log(`  ${route}\n    status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}`)
    } catch (e: any) { console.log(`  ${route}  ERR ${e.message}`) }
  }
  // (b) How many division titles even name a Bill? Sample 200 titles.
  const page = (await get(`${COMMONS}/data/divisions.json/search?queryParameters.take=200&queryParameters.skip=0`)).body
  if (Array.isArray(page)) {
    const named = page.filter((d: any) => /\bBill\b/i.test(d.Title ?? ''))
    console.log(`  Commons: ${named.length}/${page.length} of the newest 200 division titles contain "Bill"`)
    console.log(`  examples:`)
    for (const d of page.slice(0, 8)) console.log(`    [${/\bBill\b/i.test(d.Title) ? 'BILL' : '    '}] ${d.Title.slice(0, 100)}`)
  }
  const lpage = (await get(`${LORDS}/data/Divisions/search?take=50&skip=0`)).body
  if (Array.isArray(lpage)) {
    console.log(`\n  Lords amendmentMotionNotes samples:`)
    for (const d of lpage.slice(0, 6)) {
      console.log(`    div ${d.divisionId} "${String(d.title).slice(0, 70)}"`)
      console.log(`       notes=${JSON.stringify(d.notes)} amendmentMotionNotes=${JSON.stringify(String(d.amendmentMotionNotes ?? '').slice(0, 160))}`)
    }
    const withNotes = lpage.filter((d: any) => (d.amendmentMotionNotes ?? '').trim().length > 0)
    console.log(`  ${withNotes.length}/${lpage.length} Lords divisions carry amendmentMotionNotes`)
  }

  console.log('\n=== Q5. Detail fetch rate ===')
  const t0 = Date.now()
  const ids = Array.isArray(page) ? page.slice(0, 5).map((d: any) => d.DivisionId) : []
  for (const id of ids) { await get(`${COMMONS}/data/division/${id}.json`); await new Promise(r => setTimeout(r, 400)) }
  console.log(`  5 details @400ms gap: ${Date.now() - t0}ms total → ~${Math.round((Date.now() - t0) / 5)}ms/division`)
  console.log(`  projected for 5,645 divisions: ${Math.round(((Date.now() - t0) / 5) * 5645 / 60000)} min single-threaded`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
