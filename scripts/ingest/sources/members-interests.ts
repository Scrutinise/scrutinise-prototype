/**
 * members-interests.ts — Register of Members' Financial Interests (V29 §3.4).
 *
 * The declared financial interests of MPs (and the Lords register) — gifts,
 * earnings, donations, shareholdings, property. Open Parliament Licence v3.0,
 * via interests-api.parliament.uk:
 *
 *   GET /api/v1/Interests/?Take=N&Skip=M&ExpandChildInterests=true
 *     → { totalResults, items:[{ id, summary, registrationDate, publishedDate,
 *         category:{ number, name, type }, member:{ nameDisplayAs, house,
 *         memberFrom, party }, fields:[{ name, description, value }] }] }
 *
 * Decision (brief §3.4): ONE SECTION PER INTEREST. Each interest is a
 * self-contained declaration (member + category + value/fields), so it is the
 * natural addressable unit — a query for a member or a company lands the
 * specific interest rather than a member's whole concatenated register. The list
 * carries the full fields, so a page row writes one section per interest with no
 * per-item detail call. Sections key on the stable interest id.
 */
const BASE = 'https://interests-api.parliament.uk'
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

export interface Interest {
  id: number
  summary: string
  registrationDate: string | null
  category: string | null
  member: string | null
  house: string | null
  party: string | null
  constituency: string | null
  text: string
}

function compileInterestText(it: any): string {
  const parts: string[] = []
  const member = it.member?.nameDisplayAs ?? ''
  if (member) parts.push(member)
  const meta = [
    it.member?.house && it.member.house,
    it.member?.party && it.member.party,
    it.member?.memberFrom && it.member.memberFrom,
    it.category?.name && `Category ${it.category.number ?? ''}: ${it.category.name}`.trim(),
    it.registrationDate && `Registered: ${it.registrationDate}`,
  ].filter(Boolean).join(' · ')
  if (meta) parts.push(meta)
  if (it.summary) parts.push(it.summary)
  for (const f of it.fields ?? []) {
    const v = (f.value ?? '').toString().trim()
    if (v) parts.push(`${f.name ?? f.description ?? 'Detail'}: ${v}`)
  }
  return parts.join('\n')
}

export async function interestsTotal(): Promise<number> {
  const d = await getJson(`${BASE}/api/v1/Interests/?Take=1&ExpandChildInterests=true`)
  return d?.totalResults ?? 0
}

export async function fetchInterestsPage(skip: number, take: number): Promise<Interest[] | null> {
  const d = await getJson(`${BASE}/api/v1/Interests/?Take=${take}&Skip=${skip}&ExpandChildInterests=true`)
  if (!d || !Array.isArray(d.items)) return null
  return d.items.map((it: any): Interest => ({
    id: it.id,
    summary: (it.summary ?? '').trim(),
    registrationDate: it.registrationDate ?? null,
    category: it.category?.name ?? null,
    member: it.member?.nameDisplayAs ?? null,
    house: it.member?.house ?? null,
    party: it.member?.party ?? null,
    constituency: it.member?.memberFrom ?? null,
    text: compileInterestText(it),
  }))
}
