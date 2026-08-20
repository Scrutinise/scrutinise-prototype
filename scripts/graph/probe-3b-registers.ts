/**
 * probe-3b-registers.ts — GRAPH 3B §2 and §4.3. What is actually fetchable, before anything is
 * designed around it.
 *
 * docs/CLAUDE.md §0: verify before asserting. 3A's audit found two P0 signal types with no source
 * data by looking, not by assuming; the same discipline applies to the three P1 registers before a
 * line of ingest is written.
 *
 * Probes, and nothing is stored:
 *   §4.3  bills-api  — does /Bills/{id} really carry sponsors[], and is there an amendments feed?
 *   §2.1  APPG       — is the register published in a form a machine can read?
 *   §2.2  Electoral Commission — is the donations search API open?
 *   §2.3  Companies House — how many of our 5,496 register numbers could be joined?
 *
 * Usage (from scripts/graph):  npx tsx probe-3b-registers.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'

export {}

const UA = 'Scrutinise/1.0 (research; cl@scrutinise.org)'

async function probe(label: string, url: string, opts: RequestInit = {}) {
  const t0 = Date.now()
  try {
    const r = await fetch(url, {
      ...opts,
      headers: { 'User-Agent': UA, Accept: 'application/json, text/html;q=0.9', ...(opts.headers ?? {}) },
      signal: AbortSignal.timeout(25_000),
    })
    const ct = r.headers.get('content-type') ?? ''
    const body = await r.text()
    console.log(`   ${String(r.status).padStart(3)}  ${label.padEnd(34)} ${ct.split(';')[0].padEnd(26)} ${String(body.length).padStart(9)} bytes  ${Date.now() - t0} ms`)
    return { status: r.status, ct, body }
  } catch (e) {
    console.log(`   ERR  ${label.padEnd(34)} ${e instanceof Error ? e.message : String(e)}`)
    return { status: 0, ct: '', body: '' }
  }
}

async function main() {
  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n════ §4.3 — AMENDMENT SPONSORSHIP: what would it take?\n')
  console.log('   3A: "The API does expose it (/Bills/{id} carries sponsors[]), so this is an ingest')
  console.log('   job of a few hours." That is a claim about an API. Test it.\n')

  // The assisted dying Bill. Find its id through the search endpoint rather than guessing one.
  const search = await probe('GET /api/v1/Bills?SearchTerm=…',
    'https://bills-api.parliament.uk/api/v1/Bills?SearchTerm=Terminally%20Ill%20Adults&take=5')
  let billId: number | null = null
  if (search.status === 200) {
    try {
      const j = JSON.parse(search.body)
      const items = j.items ?? []
      for (const it of items.slice(0, 5)) console.log(`        billId ${it.billId}  ${it.shortTitle}`)
      billId = items[0]?.billId ?? null
    } catch { console.log('        (could not parse)') }
  }

  if (billId) {
    const bill = await probe(`GET /api/v1/Bills/${billId}`, `https://bills-api.parliament.uk/api/v1/Bills/${billId}`)
    if (bill.status === 200) {
      try {
        const j = JSON.parse(bill.body)
        console.log(`        top-level keys: ${Object.keys(j).join(', ')}`)
        const sponsors = j.sponsors ?? []
        console.log(`        sponsors[]: ${sponsors.length} — ${sponsors.length ? '✓ 3A\'s claim holds' : '❌ NOT PRESENT'}`)
        for (const s of sponsors.slice(0, 4)) {
          const m = s.member ?? s.organisation ?? {}
          console.log(`          · ${m.name ?? m.memberId ?? JSON.stringify(s).slice(0, 80)}  memberId=${m.memberId ?? '—'}  ${s.sponsoringHouse ?? ''}`)
        }
      } catch { console.log('        (could not parse)') }
    }

    // ⚠ The high-value signal is AMENDMENT sponsorship, not BILL sponsorship. They are different
    // facts and 3A's D-6 conflates them: a Bill has a handful of sponsors, while an amendment
    // paper has hundreds of signatures and is the stronger position statement (brief §4.3).
    const stages = await probe(`GET /Bills/${billId}/Stages`, `https://bills-api.parliament.uk/api/v1/Bills/${billId}/Stages?take=40`)
    let stageId: number | null = null
    if (stages.status === 200) {
      try {
        const j = JSON.parse(stages.body)
        const items = j.items ?? []
        console.log(`        ${items.length} stages`)
        const rep = items.find((s: any) => /Report|Committee/i.test(s.description ?? s.stage?.description ?? ''))
        stageId = rep?.id ?? items[0]?.id ?? null
        console.log(`        probing stage ${stageId} — ${rep?.description ?? rep?.stage?.description ?? '(first)'}`)
      } catch { /* */ }
    }
    if (stageId) {
      const amd = await probe(`GET …/Stages/${stageId}/Amendments`,
        `https://bills-api.parliament.uk/api/v1/Bills/${billId}/Stages/${stageId}/Amendments?take=5`)
      if (amd.status === 200) {
        try {
          const j = JSON.parse(amd.body)
          console.log(`        totalResults: ${j.totalResults}`)
          const a = (j.items ?? [])[0]
          if (a) {
            console.log(`        first amendment keys: ${Object.keys(a).join(', ')}`)
            console.log(`        amendmentId=${a.amendmentId} marshalledOrder=${a.marshalledListText?.slice(0, 40) ?? '—'}`)
            const sp = a.sponsors ?? []
            console.log(`        sponsors on an amendment: ${sp.length}`)
            for (const s of sp.slice(0, 6)) console.log(`          · ${s.member?.name ?? s.name ?? JSON.stringify(s).slice(0, 70)} (memberId ${s.member?.memberId ?? '—'})`)
          }
        } catch (e) { console.log('        (could not parse) ' + (e instanceof Error ? e.message : '')) }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n\n════ §2.1 — APPG MEMBERSHIP AND FUNDERS\n')
  await probe('publications.parliament.uk index',
    'https://publications.parliament.uk/pa/cm/cmallparty/register/contents.htm')
  await probe('members-api APPG? (Groups)',
    'https://members-api.parliament.uk/api/Reference/AllPartyParliamentaryGroups')
  const appgJson = await probe('parliament.uk APPG register JSON',
    'https://publications.parliament.uk/pa/cm/cmallparty/register/register.json')
  if (appgJson.status === 200) console.log('        ' + appgJson.body.slice(0, 200))

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n\n════ §2.2 — ELECTORAL COMMISSION DONATIONS\n')
  await probe('EC search UI', 'https://search.electoralcommission.org.uk/')
  await probe('EC api/csv', 'https://search.electoralcommission.org.uk/api/csv/Donations?start=0&rows=5')
  await probe('EC api/search', 'https://search.electoralcommission.org.uk/api/search/Donations?start=0&rows=5')

  // ══════════════════════════════════════════════════════════════════════════════════════════
  console.log('\n\n════ §2.3 — COMPANIES HOUSE JOIN CANDIDATES (from our own data)\n')
  const pool = getNeonPool()
  try {
    const { rows } = await pool.query<Record<string, string>>(`
      SELECT COUNT(*)::text AS orgs_with_number,
             COUNT(*) FILTER (WHERE company_number IS NOT NULL)::text AS companies,
             COUNT(*) FILTER (WHERE charity_number IS NOT NULL)::text AS charities
        FROM graph_entity
       WHERE kind='organisation' AND (company_number IS NOT NULL OR charity_number IS NOT NULL)`)
    console.log('   ', JSON.stringify(rows[0]))
  } catch (e) {
    console.log('   (graph_entity has no company_number/charity_number column here) —', e instanceof Error ? e.message : e)
    const { rows: cols } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='graph_entity' ORDER BY ordinal_position`)
    console.log('    graph_entity columns:', cols.map((c) => c.column_name).join(', '))
  } finally {
    await endNeonPool()
  }
  console.log(`   CH API key present in env: ${process.env.COMPANIES_HOUSE_API_KEY ? 'yes' : 'NO'}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
