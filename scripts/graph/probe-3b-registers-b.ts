/**
 * probe-3b-registers-b.ts — GRAPH 3B, round two. The first probe answered three questions and
 * mis-asked two:
 *
 *   · The Bills search returned Lord Falconer's HL Bill (1 stage, 0 amendments), not Kim
 *     Leadbeater's Commons Bill. Testing the amendments endpoint on a bill that HAS no amendments
 *     proves nothing — the same shape as a negative control that cannot fail.
 *   · publications.parliament.uk 403'd. A 403 on one path is not "the register is unavailable"
 *     (docs/CLAUDE.md §0). Try the homepage, the canonical register path, and a browser-shaped
 *     request before concluding anything.
 *
 * Usage (from scripts/graph):  npx tsx probe-3b-registers-b.ts
 */
export {}

const BROWSERISH = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
}

async function probe(label: string, url: string, headers: Record<string, string> = {}) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(30_000), redirect: 'follow' })
    const body = await r.text()
    console.log(`   ${String(r.status).padStart(3)}  ${label.padEnd(46)} ${String(body.length).padStart(9)} b  ${(r.headers.get('content-type') ?? '').split(';')[0]}`)
    return { status: r.status, body, url: r.url }
  } catch (e) {
    console.log(`   ERR  ${label.padEnd(46)} ${e instanceof Error ? e.message : String(e)}`)
    return { status: 0, body: '', url }
  }
}

async function main() {
  console.log('\n════ §4.3 — the RIGHT bill this time: 3774, Terminally Ill Adults (Commons)\n')
  for (const id of [3774, 4157]) {
    const b = await probe(`Bills/${id}`, `https://bills-api.parliament.uk/api/v1/Bills/${id}`)
    if (b.status === 200) {
      const j = JSON.parse(b.body)
      console.log(`        "${j.shortTitle}"  sponsors=${(j.sponsors ?? []).length}  isAct=${j.isAct}`)
      for (const s of (j.sponsors ?? []).slice(0, 3)) {
        console.log(`          · ${s.member?.name ?? s.organisation?.name}  memberId=${s.member?.memberId ?? '—'}`)
      }
    }
    const st = await probe(`Bills/${id}/Stages`, `https://bills-api.parliament.uk/api/v1/Bills/${id}/Stages?take=50`)
    if (st.status !== 200) continue
    const stages = JSON.parse(st.body).items ?? []
    console.log(`        ${stages.length} stages`)
    let found = 0
    for (const s of stages) {
      const desc = s.description ?? s.stage?.description ?? ''
      if (!/Committee|Report|Consideration/i.test(desc)) continue
      const a = await probe(`  Stages/${s.id}/Amendments — ${desc.slice(0, 26)}`,
        `https://bills-api.parliament.uk/api/v1/Bills/${id}/Stages/${s.id}/Amendments?take=3`)
      if (a.status !== 200) continue
      const j = JSON.parse(a.body)
      console.log(`          totalResults=${j.totalResults}`)
      const one = (j.items ?? [])[0]
      if (one) {
        found++
        console.log(`          keys: ${Object.keys(one).join(', ')}`)
        console.log(`          amendmentId=${one.amendmentId} ref=${one.marshalledListText ?? one.amendmentPosition ?? '—'} decision=${one.decision ?? '—'}`)
        const sp = one.sponsors ?? []
        console.log(`          SPONSORS ON THIS AMENDMENT: ${sp.length}`)
        for (const x of sp.slice(0, 8)) {
          console.log(`            · ${x.member?.name ?? x.name ?? JSON.stringify(x).slice(0, 60)} memberId=${x.member?.memberId ?? '—'} order=${x.sortOrder ?? '—'}`)
        }
        break
      }
    }
    if (!found) console.log('        ⛔ no stage on this bill returned an amendment with sponsors')
  }

  console.log('\n\n════ §2.1 — APPG: is it a 403 on one path, or on the site?\n')
  await probe('publications.parliament.uk homepage', 'https://publications.parliament.uk/', BROWSERISH)
  await probe('cmallparty contents (browser UA)',
    'https://publications.parliament.uk/pa/cm/cmallparty/register/contents.htm', BROWSERISH)
  await probe('cmallparty 250716 contents',
    'https://publications.parliament.uk/pa/cm/cmallparty/250716/contents.htm', BROWSERISH)
  await probe('www.parliament.uk APPG landing',
    'https://www.parliament.uk/mps-lords-and-offices/standards-and-financial-interests/parliamentary-commissioner-for-standards/registers-of-interests/register-of-all-party-party-parliamentary-groups/', BROWSERISH)
  await probe('members-api search (control: does members-api work at all?)',
    'https://members-api.parliament.uk/api/Members/Search?skip=0&take=1', { Accept: 'application/json' })

  console.log('\n\n════ §2.2 — Electoral Commission, with real parameters\n')
  const ec = await probe('EC csv Donations rows=3',
    'https://search.electoralcommission.org.uk/api/csv/Donations?start=0&rows=3&query=&sort=AcceptedDate&order=desc&et=pp&et=ppm&date=Accepted&from=&to=&rptPd=&prePoll=false&postPoll=true&register=gb&optCols=Recipient&optCols=Value',
    { Accept: 'text/csv' })
  if (ec.status === 200) {
    for (const line of ec.body.split('\n').slice(0, 4)) console.log('        ' + line.slice(0, 220))
  }
  const ecTotal = await probe('EC search Donations (totals)',
    'https://search.electoralcommission.org.uk/api/search/Donations?start=0&rows=1&query=&et=pp&et=ppm&date=Accepted&register=gb&rptPd=&prePoll=false&postPoll=true',
    { Accept: 'application/json' })
  if (ecTotal.status === 200) console.log('        ' + ecTotal.body.slice(0, 400))
}

main().catch((e) => { console.error(e); process.exit(1) })
