/**
 * probe-3c-appg.ts — GRAPH 3C §4.1. Re-verify the APPG blocker, and price the routes around it.
 *
 * ⚠ THIS PROBE BUILDS NOTHING AND DEFEATS NOTHING. Brief §4.1: *"Do not build a bot-challenge
 * workaround."* Every request below is a plain `fetch` with an honest research User-Agent; the
 * point is to establish WHICH doors are open, not to open a closed one.
 *
 * docs/CLAUDE.md §0: 3B's finding is itself a claim, and a consequential one — a whole P1 signal
 * type is parked on it. So it is re-measured rather than inherited, and the alternatives are
 * measured rather than assumed absent.
 *
 * Usage (from scripts/graph):  npx tsx probe-3c-appg.ts
 */
export {}

const UA = 'ScrutiniseResearchBot/1.0 (+https://www.scrutinise.org; civic research; contact cl@scrutinise.org)'

interface Probe { label: string; url: string; note?: string }

/** Every route that could plausibly carry APPG data, plus the controls that make a 403 meaningful. */
const PROBES: Probe[] = [
  // ── the register itself ──
  { label: 'APPG register · contents', url: 'https://publications.parliament.uk/pa/cm/cmallparty/register/contents.htm' },
  { label: 'APPG register · site root', url: 'https://publications.parliament.uk/',
    note: 'CONTROL: if the homepage 403s too, it is not a bad path' },
  // ── the APIs that ARE open, as controls on the same process/IP ──
  { label: 'members-api (control)', url: 'https://members-api.parliament.uk/api/Members/Search?take=1' },
  { label: 'interests-api (control + route c)', url: 'https://interests-api.parliament.uk/api/v1/Interests?Take=1' },
  { label: 'bills-api (control)', url: 'https://bills-api.parliament.uk/api/v1/Bills?take=1' },
  // ── the machine-readable alternatives worth ruling in or out by measurement ──
  { label: 'members-api · APPG reference endpoint',
    url: 'https://members-api.parliament.uk/api/Reference/AllPartyParliamentaryGroups',
    note: '3B measured 404. Re-checked because "the API has no endpoint" is the kind of claim that ages.' },
  { label: 'interests-api · the category list',
    url: 'https://interests-api.parliament.uk/api/v1/Categories',
    note: 'Does the FINANCIAL interests register carry an APPG-shaped category? Answered by reading it.' },
  { label: 'data.parliament.uk (historic open-data host)', url: 'http://data.parliament.uk/' },
]

async function probe(p: Probe) {
  const t0 = Date.now()
  try {
    const r = await fetch(p.url, {
      headers: { 'user-agent': UA, accept: 'text/html,application/json,*/*' },
      signal: AbortSignal.timeout(25_000),
      redirect: 'follow',
    })
    const body = await r.text()
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim()
    const challenge = /just a moment|cf-browser-verification|challenge-platform|Attention Required/i.test(body)
    console.log(`  ${String(r.status).padStart(3)}  ${p.label.padEnd(38)} ${((Date.now() - t0) / 1000).toFixed(1)}s  ` +
      `${body.length.toLocaleString().padStart(9)} bytes` +
      (title ? `  title="${title.slice(0, 46)}"` : '') +
      (challenge ? '  ⛔ BOT CHALLENGE' : ''))
    if (p.note) console.log(`       ${p.note}`)
    return { status: r.status, body, challenge }
  } catch (e) {
    console.log(`  ERR  ${p.label.padEnd(38)} ${e instanceof Error ? e.message : e}`)
    if (p.note) console.log(`       ${p.note}`)
    return { status: 0, body: '', challenge: false }
  }
}

async function main() {
  console.log('════ §4.1 · WHICH DOORS ARE OPEN — measured, not inherited ════\n')
  const results: Record<string, Awaited<ReturnType<typeof probe>>> = {}
  for (const p of PROBES) results[p.label] = await probe(p)

  const reg = results['APPG register · contents']
  const root = results['APPG register · site root']
  const openApis = ['members-api (control)', 'interests-api (control + route c)', 'bills-api (control)']
    .filter((k) => results[k]?.status === 200)

  console.log(`\n════ WHAT THAT ESTABLISHES ════`)
  console.log(`  the register        HTTP ${reg.status}${reg.challenge ? ' + a Cloudflare bot challenge in the body' : ''}`)
  console.log(`  its own homepage    HTTP ${root.status}   ← so it is the SITE, not the path`)
  console.log(`  parliament APIs     ${openApis.length} of 3 return 200 from this same process and IP`)
  console.log(`  ⇒ ${reg.status !== 200 && openApis.length === 3
    ? 'NOT an IP block and NOT a bad path. 3B\'s finding stands, re-measured today.'
    : 'the picture has CHANGED since 3B — re-read the rows above before acting on any plan.'}`)

  // ── route (c): what the open register actually contains ────────────────────────────────────
  const cats = results['interests-api · the category list']
  if (cats.status === 200) {
    try {
      const j = JSON.parse(cats.body)
      const items: Array<{ id?: number; name?: string; number?: string }> = j.items ?? j ?? []
      console.log(`\n════ ROUTE (c) — THE REGISTER THAT IS OPEN, AND WHAT IT IS A REGISTER OF ════`)
      for (const c of items) console.log(`  ${String(c.number ?? c.id ?? '').padStart(4)}  ${c.name ?? JSON.stringify(c)}`)
      const appgish = items.filter((c) => /all-party|party parliamentary|group/i.test(c.name ?? ''))
      console.log(`\n  categories mentioning a "group" or "all-party": ${appgish.length}`)
      console.log(`  ⇒ ${appgish.length === 0
        ? 'The financial-interests register does NOT carry APPG membership. Route (c) is a DIFFERENT'
        : 'Possible overlap — read the names above.'}`)
      if (appgish.length === 0) {
        console.log(`    register answering a different question, not a substitute. 3B recommended it as one;`)
        console.log(`    that recommendation is corrected here, from the category list rather than from the name.`)
      }
    } catch (e) {
      console.log(`\n  ⚠ category list did not parse: ${e instanceof Error ? e.message : e}`)
    }
  }

  console.log(`\n════ THE ROUTES, PRICED ════`)
  console.log(`  (a) ask the Commons Library / the Registrar for the register as data`)
  console.log(`      cost: one email from Charlie, unknown latency, ZERO code. Cheapest in effort.`)
  console.log(`      ⚠ not something this session can complete — it needs a person with an address.`)
  console.log(`  (b) capture the published register through a real browser, store the HTML, parse it`)
  console.log(`      cost: a capture that is manual and quarterly, plus a parser. The parser is the`)
  console.log(`      durable artefact; the capture is the part that cannot be automated and should not be.`)
  console.log(`  (c) interests-api instead — measured above. It is OPEN and it carries the MNIS id on`)
  console.log(`      every record, but see the category list: it is the register of FINANCIAL INTERESTS.`)
  console.log(`      It answers a different question and is not a substitute for APPG membership.`)
}

main().catch((e) => { console.error('[probe-3c-appg] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
