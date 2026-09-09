/**
 * probe-edm-public-page.ts — BRIEF_INGEST_EDM_SIGNATURES §3: is there a source INDEPENDENT of the
 * API to hand-check 30 signatures against?
 *
 * §3: *"Hand-check 30 signatures against Parliament's own page for that motion. A count of rows
 * inserted proves nothing about what is in them."* Checking the API against itself proves nothing
 * either, so the check needs the HTML page a member of the public sees.
 *
 * ⚠ READ-ONLY, and it fetches three pages, not a corpus. `publications.parliament.uk` is a
 * Cloudflare bot challenge (recorded in this project's notes) — `edm.parliament.uk` is a different
 * host and is tested here rather than assumed either way.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-edm-public-page.ts
 */
export {}

const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

async function get(url: string): Promise<{ status: number; ct: string; len: number; body: string }> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } })
    const body = await res.text()
    return { status: res.status, ct: res.headers.get('content-type') ?? '', len: body.length, body }
  } catch (e) {
    return { status: -1, ct: '', len: 0, body: e instanceof Error ? e.message : String(e) }
  }
}

async function main() {
  // Motion 66501 — read in the API probe: 24 sponsors, primary Zöe Franklin (MNIS 5313).
  const candidates = [
    'https://edm.parliament.uk/early-day-motion/66501',
    'https://edm.parliament.uk/early-day-motion/66501/publication-of-legal-advice-on-local-government-reorganisation',
    'https://edm.parliament.uk/EarlyDayMotion/66501',
  ]
  head('§3.0 CAN WE REACH THE PUBLIC PAGE AT ALL?')
  let good: { url: string; body: string } | null = null
  for (const u of candidates) {
    const r = await get(u)
    console.log(`   ${String(r.status).padStart(4)}  ${String(r.len).padStart(7)} bytes  ${r.ct.split(';')[0].padEnd(24)} ${u}`)
    if (r.status === 200 && r.len > 2000 && !good) good = { url: u, body: r.body }
    if (r.status !== 200) console.log(`         → ${r.body.slice(0, 160).replace(/\s+/g, ' ')}`)
    await new Promise((res) => setTimeout(res, 400))
  }
  if (!good) {
    console.log(`\n   ❌ no public page reachable from node. §3's hand-check needs another route`)
    console.log(`      (the project's notes: the Internet Archive serves some blocked hosts to`)
    console.log(`       plain fetch, and claude-in-chrome can load pages that 403 here).`)
    return
  }

  head('§3.1 WHAT THE PAGE SAYS — the signatory block')
  const html = good.body
  console.log(`   ${good.url}`)
  // Names on the EDM site are rendered in a signatures list. Report what is actually in the markup
  // rather than assuming a class name: print every distinct element that carries a member link.
  const memberLinks = [...html.matchAll(/href="([^"]*(?:member|members)[^"]*)"[^>]*>([^<]{2,60})</gi)]
  console.log(`   anchors that look like member links: ${memberLinks.length}`)
  for (const m of memberLinks.slice(0, 8)) console.log(`      ${m[1].slice(0, 70)}  →  "${m[2].trim()}"`)

  // The signature count and dates, whatever wrapper they use.
  for (const pat of [
    /signatures?[^<]{0,40}/gi,
    /(\d+)\s*signature/gi,
    /class="[^"]*signator[^"]*"/gi,
    /class="[^"]*sponsor[^"]*"/gi,
    /Sponsor/g,
  ]) {
    const hits = [...html.matchAll(pat)].slice(0, 6).map((m) => m[0].replace(/\s+/g, ' ').trim())
    if (hits.length) console.log(`\n   /${pat.source.slice(0, 40)}/ → ${JSON.stringify(hits)}`)
  }

  head('§3.2 A DATED SIGNATURE ON THE PAGE?')
  // The API gives CreatedWhen per signature. If the page shows dates too, the hand-check can prove
  // the DATE and not only the name — which is the field the brief says decides the sprint.
  const dateish = [...html.matchAll(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/g)]
  console.log(`   date strings on the page: ${dateish.length}`)
  console.log(`   first few: ${JSON.stringify([...new Set(dateish.map((d) => d[1]))].slice(0, 8))}`)

  // Dump a slice around the first member link so the real structure is visible rather than guessed.
  const i = html.search(/href="[^"]*member/i)
  if (i > 0) {
    head('§3.3 RAW MARKUP AROUND THE FIRST MEMBER LINK')
    console.log(html.slice(Math.max(0, i - 700), i + 1400).replace(/\n\s*\n/g, '\n'))
  }
}

main().catch((e) => { console.error('[probe-edm-public-page] FATAL', e instanceof Error ? e.stack : e); process.exit(1) })
