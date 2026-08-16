/**
 * probe-2d2-members.ts — can Parliament's OWN Members API (OPL v3.0) act as the identity register
 * the §2 sweep needs, without touching mySociety's unlicensed people.json?
 *
 * Read-only. Answers:
 *   1  how many members are reachable, current and historical, per house
 *   2  what name forms each record carries (the merge/split evidence)
 *   3  does /History give former names — the thing that makes "Theresa May" and
 *      "Baroness May of Maidenhead" ONE person rather than two
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/probe-2d2-members.ts
 */
export {}

const BASE = 'https://members-api.parliament.uk/api'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
function head(s: string) { console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 76 - s.length))}`) }

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
    if (!res.ok) { console.log(`   HTTP ${res.status} ${url}`); return null }
    return await res.json()
  } catch (e) { console.log(`   fetch failed ${url}: ${(e as Error).message}`); return null }
}

async function main() {
  head('1 — how many members does the API expose?')
  for (const [label, qs] of [
    ['Commons, current',    'House=1&IsCurrentMember=true'],
    ['Commons, former',     'House=1&IsCurrentMember=false'],
    ['Lords, current',      'House=2&IsCurrentMember=true'],
    ['Lords, former',       'House=2&IsCurrentMember=false'],
    ['all houses, no filter', ''],
  ] as const) {
    const d = await getJson(`${BASE}/Members/Search?${qs}${qs ? '&' : ''}skip=0&take=1`)
    console.log(`   ${label.padEnd(24)} totalResults = ${d?.totalResults ?? '(none)'}`)
  }

  head('2 — what a member record carries')
  const d = await getJson(`${BASE}/Members/Search?House=1&IsCurrentMember=true&skip=0&take=3`)
  const item = d?.items?.[0]?.value
  if (item) {
    console.log(`   value keys: ${Object.keys(item).join(', ')}`)
    console.log(`   ${JSON.stringify(item, null, 2).split('\n').slice(0, 30).join('\n')}`)
  }

  head('3 — name history: does the API make an MP-turned-peer ONE person?')
  // member_id 8 votes in division_votes as BOTH "Theresa May" (commons) and
  // "Baroness May of Maidenhead" (lords). If the API confirms one id spans both, the MNIS key is
  // doing exactly the work name-matching cannot.
  for (const id of [8, 36, 105]) {
    const m = await getJson(`${BASE}/Members/${id}`)
    const v = m?.value
    console.log(`\n   Members/${id}: nameDisplayAs=${JSON.stringify(v?.nameDisplayAs)} nameFullTitle=${JSON.stringify(v?.nameFullTitle)} nameListAs=${JSON.stringify(v?.nameListAs)} house=${v?.latestHouseMembership?.house}`)
    const h = await getJson(`${BASE}/Members/History?ids=${id}`)
    const rec = Array.isArray(h) ? h[0] : h?.value?.[0] ?? h?.[0]
    if (rec) {
      console.log(`     History keys: ${Object.keys(rec).join(', ')}`)
      const names = rec.nameHistory ?? rec.value?.nameHistory
      if (Array.isArray(names)) for (const n of names) console.log(`       name: ${n.nameDisplayAs ?? n.displayAs} (${n.startDate?.slice(0,10)} → ${n.endDate?.slice(0,10) ?? 'current'}) house=${n.house}`)
      const houses = rec.houseMembershipHistory ?? rec.value?.houseMembershipHistory
      if (Array.isArray(houses)) for (const x of houses) console.log(`       house: ${x.house} ${x.membershipStartDate?.slice(0,10)} → ${x.membershipEndDate?.slice(0,10) ?? 'current'}`)
    }
  }

  head('4 — is a full historical sweep cheap? page size and cost')
  const t0 = Date.now()
  const page = await getJson(`${BASE}/Members/Search?skip=0&take=20`)
  console.log(`   take=20 → ${page?.items?.length ?? 0} items in ${Date.now() - t0} ms`)
  const t1 = Date.now()
  const big = await getJson(`${BASE}/Members/Search?skip=0&take=50`)
  console.log(`   take=50 → ${big?.items?.length ?? 0} items in ${Date.now() - t1} ms  (max page size matters: it sets the sweep's call count)`)
  const t2 = Date.now()
  const huge = await getJson(`${BASE}/Members/Search?skip=0&take=200`)
  console.log(`   take=200 → ${huge?.items?.length ?? 0} items in ${Date.now() - t2} ms`)
}
main().catch((e) => { console.error('[probe-2d2-members] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
