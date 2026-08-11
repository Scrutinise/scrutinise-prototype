/**
 * v34-divisions-probe3.ts — §A step 1c. Two decisive questions.
 *
 *   Q6. What is the REAL page cap on each list endpoint? probe2 asked for
 *       take=200 and got 25 back. V28's enumerateDivisions() breaks out of the
 *       loop on `page.length < take`, so a silent server-side cap makes it stop
 *       after ONE page and report success. Measure the cap before trusting any
 *       enumeration count.
 *
 *   Q7. Is the `Party` on a division member the party AT THE DATE of the
 *       division, or the member's party NOW? Decisive for whether the Members
 *       API is needed for party at all. Test: member 172 sat as Independent
 *       2023-04-23 → 2024-05-28 and as Labour either side. Find divisions in
 *       each window and read the recorded Party.
 */
const COMMONS = 'https://commonsvotes-api.parliament.uk'
const LORDS = 'https://lordsvotes-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

async function get(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
  const t = await res.text()
  try { return JSON.parse(t) } catch { return { __status: res.status, __raw: t.slice(0, 300) } }
}

async function main() {
  console.log('=== Q6. REAL page cap ===')
  for (const take of [25, 26, 40, 50, 100, 200]) {
    const c = await get(`${COMMONS}/data/divisions.json/search?queryParameters.take=${take}&queryParameters.skip=0`)
    const l = await get(`${LORDS}/data/Divisions/search?take=${take}&skip=0`)
    console.log(`  take=${String(take).padStart(3)}  commons→${Array.isArray(c) ? c.length : JSON.stringify(c).slice(0, 60)}   lords→${Array.isArray(l) ? l.length : JSON.stringify(l).slice(0, 60)}`)
    await new Promise(r => setTimeout(r, 350))
  }

  console.log('\n  ⚠ V28 enumerateDivisions(take=100) + `if (page.length < take) break`')
  console.log('    → would stop after page 1 if the server caps below 100.')

  console.log('\n=== Q7. Party AT THE DATE? (member 172: Independent 2023-04-23 → 2024-05-28) ===')
  const windows: Array<[string, string, string]> = [
    ['before switch (expect Labour)', '2023-01-01', '2023-04-20'],
    ['during Independent spell',      '2023-06-01', '2024-05-01'],
    ['after return (expect Labour)',  '2024-09-01', '2025-03-01'],
  ]
  for (const [label, from, to] of windows) {
    const list = await get(`${COMMONS}/data/divisions.json/search?queryParameters.startDate=${from}&queryParameters.endDate=${to}&queryParameters.take=25`)
    if (!Array.isArray(list) || !list.length) { console.log(`  ${label}: no divisions listed`); continue }
    let found = false
    for (const entry of list.slice(0, 8)) {
      const d = await get(`${COMMONS}/data/division/${entry.DivisionId}.json`)
      const all = [...(d.Ayes ?? []), ...(d.Noes ?? []), ...(d.NoVoteRecorded ?? []), ...(d.AyeTellers ?? []), ...(d.NoTellers ?? [])]
      const m = all.find((x: any) => x.MemberId === 172)
      if (m) {
        const where = (d.Ayes ?? []).some((x: any) => x.MemberId === 172) ? 'AYE'
          : (d.Noes ?? []).some((x: any) => x.MemberId === 172) ? 'NO' : 'NO-VOTE-RECORDED'
        console.log(`  ${label}`)
        console.log(`    div ${d.DivisionId} ${String(d.Date).slice(0, 10)} → Party="${m.Party}" (${m.PartyAbbreviation}) from="${m.MemberFrom}" [${where}]`)
        found = true; break
      }
      await new Promise(r => setTimeout(r, 350))
    }
    if (!found) console.log(`  ${label}: member 172 not found in first 8 divisions of window`)
  }

  console.log('\n=== Q8. Does the date-window search page reliably? (for a resumable enumeration) ===')
  const w = await get(`${COMMONS}/data/divisions.json/search?queryParameters.startDate=2023-01-01&queryParameters.endDate=2023-12-31&queryParameters.take=25&queryParameters.skip=0`)
  const w2 = await get(`${COMMONS}/data/divisions.json/search?queryParameters.startDate=2023-01-01&queryParameters.endDate=2023-12-31&queryParameters.take=25&queryParameters.skip=25`)
  const ids1 = Array.isArray(w) ? w.map((d: any) => d.DivisionId) : []
  const ids2 = Array.isArray(w2) ? w2.map((d: any) => d.DivisionId) : []
  const overlap = ids1.filter(i => ids2.includes(i))
  console.log(`  page1=${ids1.length} page2=${ids2.length} overlap=${overlap.length} (0 = paging works)`)
  console.log(`  page1 first/last: ${ids1[0]} … ${ids1[ids1.length - 1]}`)
  console.log(`  page2 first/last: ${ids2[0]} … ${ids2[ids2.length - 1]}`)

  console.log('\n=== Q9. Are division ids dense? (id 1..N enumeration vs list-walking) ===')
  let ok = 0, missing = 0
  for (const id of [1, 2, 3, 500, 1000, 1500, 2000, 2300, 2361, 2400, 2411, 2412, 2500]) {
    const d = await get(`${COMMONS}/data/division/${id}.json`)
    if (d && d.DivisionId != null) { ok++; console.log(`  id ${id}: OK ${String(d.Date).slice(0, 10)}`) }
    else { missing++; console.log(`  id ${id}: MISSING (${JSON.stringify(d).slice(0, 80)})`) }
    await new Promise(r => setTimeout(r, 300))
  }
  console.log(`  ${ok} present, ${missing} missing of 13 probed`)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
