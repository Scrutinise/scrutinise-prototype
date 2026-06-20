/**
 * early-day-motions.ts — Early Day Motions (V29 §3.2).
 *
 * EDMs are formal motions tabled in the Commons that rarely get debated but
 * record backbench opinion — a signal absent from Hansard. Open Parliament
 * Licence v3.0, via the Oral Questions & Motions API:
 *
 *   GET /EarlyDayMotions/list?parameters.take=N&parameters.skip=M
 *     → { PagingInfo:{ Total }, Response:[{ Id, Title, MotionText, UIN,
 *         DateTabled, SponsorsCount, Status, PrimarySponsor:{ Name, Party,
 *         Constituency } }] }   (newest first)
 *
 * The list already carries the full motion text + primary sponsor + signature
 * (sponsor) count, so a page row writes one section per motion with no per-item
 * detail call. Sections key on the stable motion Id (dedup-safe across pages).
 */
const BASE = 'https://oralquestionsandmotions-api.parliament.uk'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org; contact cl@scrutinise.org)'

async function getJson(url: string, attempts = 3): Promise<any | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (res.ok) return await res.json()
    } catch { /* transient */ }
    if (i < attempts - 1) await new Promise(r => setTimeout(r, 1200 * (i + 1)))
  }
  return null
}

export interface Edm {
  id: number
  title: string
  motionText: string
  uin: string | null
  dateTabled: string | null   // YYYY-MM-DD
  sponsorsCount: number
  primarySponsor: string | null
  party: string | null
  constituency: string | null
  session: string | null
}

function mapEdm(r: any): Edm {
  return {
    id: r.Id,
    title: (r.Title ?? '').trim(),
    motionText: (r.MotionText ?? '').trim(),
    uin: r.UINWithAmendmentSuffix ?? (r.UIN != null ? String(r.UIN) : null),
    dateTabled: r.DateTabled ? String(r.DateTabled).slice(0, 10) : null,
    sponsorsCount: r.SponsorsCount ?? 0,
    primarySponsor: r.PrimarySponsor?.Name ?? null,
    party: r.PrimarySponsor?.Party ?? null,
    constituency: r.PrimarySponsor?.Constituency ?? null,
    session: r.Session ?? null,
  }
}

export async function edmTotal(): Promise<number> {
  const d = await getJson(`${BASE}/EarlyDayMotions/list?parameters.take=1&parameters.skip=0`)
  return d?.PagingInfo?.Total ?? 0
}

export async function fetchEdmPage(skip: number, take: number): Promise<Edm[] | null> {
  const d = await getJson(`${BASE}/EarlyDayMotions/list?parameters.take=${take}&parameters.skip=${skip}`)
  if (!d || !Array.isArray(d.Response)) return null
  return d.Response.map(mapEdm)
}

// Render one EDM to searchable plain text.
export function compileEdm(m: Edm): string {
  const parts: string[] = [m.title]
  const meta = [
    m.uin && `EDM ${m.uin}`,
    m.dateTabled && `Tabled: ${m.dateTabled}`,
    m.session && `Session: ${m.session}`,
    m.primarySponsor && `Primary sponsor: ${m.primarySponsor}${m.party ? ` (${m.party}${m.constituency ? `, ${m.constituency}` : ''})` : ''}`,
    `Signatures: ${m.sponsorsCount}`,
  ].filter(Boolean).join(' · ')
  if (meta) parts.push(meta)
  if (m.motionText) parts.push(m.motionText)
  return parts.join('\n')
}
